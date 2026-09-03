import { useState, useCallback, useEffect, useRef } from 'react'

import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { OP_PARAMETER } from './useDeviceSettings'
import { bleEventBus, BleEvent } from '../ble/protocol/eventBus'
import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import { parseLightCheck, type LightCheck } from '../ble/protocol/lightCheck'
import { log, logError } from '../utils/logger'
import { AEData, grabAeFields } from '../utils/aeRegisters'

export interface LightSensorState {
    darkThreshold: number      // op23 - the firmware's mean-rule threshold
    checkInterval: number      // op24 - minutes between periodic AE checks (0 = off)
    flashState: number | null  // op25 - last AE flash decision (1 = dark/flash, 0 = bright); null = not read yet
    flashLed: number | null    // op13 - 0 = flash OFF, 1 = visible, 2 = IR (the light check runs when op13 != 0 OR op26 = 1)
    autoSwitch: number | null  // op26 - 1 = automatic day/night camera switching; null = not read yet / older firmware
}

const DEFAULTS: LightSensorState = {
    darkThreshold: 65,
    checkInterval: 15,
    flashState: null,
    flashLed: null,
    autoSwitch: null,
}

/** Parse one op value out of a getops array; fallback when absent (older firmware). */
const opInt = (ops: string[], index: number, fallback: number): number => {
    if (!ops || ops.length <= index) return fallback
    const v = parseInt(ops[index], 10)
    return isNaN(v) ? fallback : v
}

/** Outcome of a photo-free measurement, so the caller can choose what to do next. */
export type MeasureResult =
    /** The register block arrived and the reading is on screen. */
    | 'ok'
    /** Firmware predates `AI light`; the caller should fall back to a capture. */
    | 'unsupported'
    /** Acknowledged, but no register block followed. See the note on measureNow. */
    | 'timeout'

// The AE register block and its parser live in utils/aeRegisters.ts, shared
// with Capture Picture so the two screens cannot read the same block differently.
export type { AEData }

/**
 * Wait for the next complete `HM0360 AE regs` block from this device. Resolves
 * null on timeout, or when cancelled.
 *
 * Subscribed before the command is sent, deliberately. `AI light` is
 * acknowledged immediately and the block follows about a second later, but
 * nothing guarantees that ordering under a slow render or a busy queue, and a
 * listener attached after the send could miss it entirely.
 *
 * The decision line, when the firmware sends one, arrives *before* the block
 * (lightSensor.c queues it inside the light check; image_task.c queues the
 * registers afterwards), so by the time this resolves the passive listener in
 * the hook has already recorded it.
 *
 * `cancel` matters on the paths that abandon the wait, such as firmware that
 * does not know the command: without it the listener would sit on a shared event
 * bus until the timeout, ready to consume a block meant for someone else.
 */
const waitForRegisters = (deviceId: string, timeoutMs: number) => {
    let settle!: (result: AEData | null) => void
    const promise = new Promise<AEData | null>(resolve => { settle = resolve })
    let collected: AEData | null = null

    const done = (result: AEData | null) => {
        clearTimeout(timer)
        bleEventBus.removeListener('textLine', listener)
        settle(result)
    }
    const listener = (event: BleEvent & { type: 'TEXT_LINE' }) => {
        if (event.deviceId !== deviceId) return
        // The decision line also says "analog gain = 4" in one of its wordings,
        // which would otherwise be lifted into a half-built block.
        if (parseLightCheck(event.line)) return
        const next = grabAeFields(event.line, collected)
        if (!next) return
        collected = next
        if (collected.aeConverged !== '' && collected.aeMean !== '') {
            // Timing marker for the bench log: on the 2 September stream the
            // caller acted on this block up to a second after it arrived, and
            // this line says whether the wait was here or on the command's own
            // acknowledgement (logged as "light acked" by measureNow).
            log('[LightSensor] registers complete')
            done(collected)
        }
    }
    const timer = setTimeout(() => done(null), timeoutMs)
    bleEventBus.on('textLine', listener)

    return { promise, cancel: () => done(null) }
}

/**
 * Ceiling for the whole measurement: the command's own 8s allowance (the AI
 * processor may need a DPD wake first) plus the light check itself, with
 * headroom. Only reached when something is actually wrong, since the op10
 * preflight on screen entry removes the common cause of silence.
 */
const LIGHT_CHECK_TIMEOUT_MS = 15_000

/**
 * The WW500's light sensor, which is the HM0360's auto-exposure registers.
 *
 * This hook gets those registers off the device and leaves the interpretation to
 * the caller. The firmware also sends its own dark/bright verdict, and that is
 * recorded when it arrives, but the measurement never depends on it: which
 * algorithm the firmware runs, and how it words the line, is a compile-time
 * choice the app cannot see, and a version of this hook that waited on the
 * verdict turned a firmware rewording into a 15 second timeout.
 *
 * Two readings are exposed:
 *
 * - `aeData`, the raw register block. Sent after every capture and every light
 *   check on every firmware since the light sensor existed. This is the
 *   measurement.
 * - `lightCheck`, the firmware's own decision line, when it sent one. Always
 *   sent after `AI light`; sent after an ordinary capture only when something
 *   consumes the decision (AE flash, or auto camera switch op26).
 */
export const useLightSensor = ({ device }: { device: ExtendedPeripheral | undefined }) => {
    const [state, setState] = useState<LightSensorState>(DEFAULTS)
    const [aeData, setAeData] = useState<AEData | null>(null)
    const [lightCheck, setLightCheck] = useState<LightCheck | null>(null)
    const [isBusy, setIsBusy] = useState(false)
    const [stage, setStage] = useState<string>('')

    // A ref as well as state: a stream loop calls measureNow in quick succession
    // from one closure, and state captured when the loop started would let a
    // second measurement start before the first had finished.
    const busyRef = useRef(false)

    const unmountedRef = useRef(false)
    useEffect(() => {
        unmountedRef.current = false
        return () => { unmountedRef.current = true }
    }, [])

    // Live AE lines arrive over BLE after each capture / light check, in two
    // forms: the raw register block and the firmware's own decision line.
    useEffect(() => {
        const listener = (event: BleEvent & { type: 'TEXT_LINE' }) => {
            if (!device || event.deviceId !== device.id) return
            const msg = event.line

            // Handled first and exclusively: one wording of the decision line
            // also contains "analog gain = 4", which the register matcher below
            // would otherwise lift into a half-built block carrying no mean.
            const decision = parseLightCheck(msg)
            if (decision) {
                setLightCheck(decision)
                return
            }

            setAeData(prev => grabAeFields(msg, prev) ?? prev)
        }
        bleEventBus.on('textLine', listener)
        return () => { bleEventBus.removeListener('textLine', listener) }
    }, [device])

    /**
     * Drop both readings from the previous measurement.
     *
     * Call this before triggering a measurement. The readings stream in as the
     * device samples them, so without clearing first there is a window where a
     * completed measurement is paired with the *previous* one's registers,
     * indistinguishable from a correct reading and permanent once logged.
     */
    const resetReadings = useCallback(() => {
        setAeData(null)
        setLightCheck(null)
    }, [])

    /**
     * Read op13/23/24/25/26 from the device, and turn automatic day/night
     * camera switching (op26) off if it is on.
     *
     * Switching reboots the device into the other camera image at the next
     * sleep after a DARK verdict. On-demand `AI light` checks are passive and
     * never trigger it, but a capture with the photo option on, or the
     * periodic op24 check, would, and a reboot in the middle of a run is a lost
     * session. Not turned back on when leaving: a deployment's reset to
     * defaults writes op26 = 1 again, which is where the field setting comes
     * from anyway.
     */
    const refresh = useCallback(async () => {
        if (!device?.connected) return
        try {
            const session = createBleSession(device)
            const ops = await session.getOps()
            if (unmountedRef.current) return

            let autoSwitch = ops.length > OP_PARAMETER.SLOT_SWITCH
                ? opInt(ops, OP_PARAMETER.SLOT_SWITCH, 0)
                : null
            if (autoSwitch === 1) {
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.SLOT_SWITCH, value: 0 }))
                log('[LightSensor] op26 was 1 on entry; set to 0 so a light check cannot reboot the device mid-session')
                autoSwitch = 0
                if (unmountedRef.current) return
            }

            setState(prev => ({
                darkThreshold: opInt(ops, OP_PARAMETER.AE_DARK_THRESHOLD, prev.darkThreshold),
                checkInterval: opInt(ops, OP_PARAMETER.AE_CHECK_INTERVAL, prev.checkInterval),
                flashState: ops.length > OP_PARAMETER.AE_FLASH_STATE
                    ? opInt(ops, OP_PARAMETER.AE_FLASH_STATE, 0)
                    : null,
                flashLed: ops.length > OP_PARAMETER.FLASH_LED
                    ? opInt(ops, OP_PARAMETER.FLASH_LED, 0)
                    : null,
                autoSwitch,
            }))
        } catch (e) {
            logError('[LightSensor] refresh failed:', e)
        }
    }, [device])

    // Seed on connect
    const didSeedRef = useRef(false)
    useEffect(() => {
        if (!device?.connected || didSeedRef.current) return
        didSeedRef.current = true
        refresh()
    }, [device?.connected, refresh])

    /**
     * Measure the light level without capturing an image, using `AI light`.
     *
     * About a second of sensor time, no JPEG, no file transfer, so it is both
     * far quicker than forcing a capture and usable on a device whose photo
     * download does not work.
     *
     * Two things make this less straightforward than it looks:
     *
     * 1. The command is an acknowledgement only. It replies "Checking light
     *    level..." immediately and the registers arrive afterwards as telemetry,
     *    so the answer is awaited on the event bus, not on the command.
     *
     * 2. **It can fail silently.** Confirmed on hardware: the ack is sent, then
     *    nothing at all, no reading and no error. Hence the timeout below, which
     *    is the only way the app learns anything went wrong.
     *
     * There is deliberately no camera check here. Whether the camera is usable is
     * settled once on entry by `useCameraReadiness`, and nothing reachable from
     * this screen can change op10, so re-reading it every measurement would cost
     * a DPD wake to learn what we already know (see ww-mobile-app#253).
     *
     * The camera *can* still stop working mid-flow, but not in a way op10 would
     * reveal: a bench run on 2 September saw a wake where the sensor failed to
     * initialise while op10 still read 1. The firmware reports that as self-test
     * bit 8, so the honest response to a timeout is to re-run the readiness
     * check, which is what the screen does.
     *
     * No alerts here. The screen decides what a failure means, because in a
     * stream one dropped request is a missed row and not a dialog.
     *
     * Firmware issue for the dropped request: Seeed_Grove_Vision_AI_Module_V2#202.
     */
    const measureNow = useCallback(async (): Promise<MeasureResult> => {
        if (!device?.connected || busyRef.current) return 'timeout'
        busyRef.current = true
        setIsBusy(true)
        setLightCheck(null)
        setAeData(null)
        try {
            const session = createBleSession(device)

            setStage('Measuring light…')
            const pending = waitForRegisters(device.id, LIGHT_CHECK_TIMEOUT_MS)

            // The registers are awaited directly; the command is only watched
            // for failure. Its promise resolves on the "Checking light level..."
            // line, but that resolution reached this function late on the
            // 2 September bench: 0.4 s after the line on the first tick of a
            // stream, 1.3 s by the fifth, with the register block already in
            // hand each time. The command completes through a timer that fires
            // only once the JS thread is free, and the thread is busy behind
            // every incoming line. Waiting on the block instead takes that off
            // every measurement. Firmware without `AI light` still fails fast,
            // through the command's rejection, rather than sitting out the
            // 15 s timeout.
            const commandFailure: Promise<Error | null> = session.execute(() => commandRegistry.light())
                .then(() => { log('[LightSensor] light acked'); return null })
                .catch((e: any) => (e instanceof Error ? e : new Error(String(e?.message ?? e))))

            const outcome = await Promise.race([
                pending.promise,
                commandFailure.then(err => {
                    if (!err) return pending.promise
                    pending.cancel()
                    throw err
                }),
            ]).catch((e: Error) => {
                if (/unrecognised/i.test(e.message)) {
                    log('[LightSensor] device has no `AI light`; caller should fall back to a capture')
                    return 'unsupported' as const
                }
                logError('[LightSensor] measure failed:', e)
                return 'failed' as const
            })

            if (outcome === 'unsupported') return 'unsupported'
            if (outcome === 'failed') return 'timeout'
            const regs = outcome
            if (!regs) {
                logError('[LightSensor] no register block within timeout')
                return 'timeout'
            }
            log(`[LightSensor] AE mean ${regs.aeMean}, gain ${regs.analogGain}, digital ${regs.digitalGain}, integration ${regs.integration}, converged ${regs.aeConverged}`)
            return 'ok'
        } finally {
            busyRef.current = false
            if (!unmountedRef.current) { setIsBusy(false); setStage('') }
        }
    }, [device])

    return { state, aeData, lightCheck, isBusy, stage, refresh, measureNow, resetReadings }
}
