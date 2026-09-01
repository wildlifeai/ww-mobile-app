import { useState, useCallback, useEffect, useRef } from 'react'
import { Alert } from 'react-native'

import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { OP_PARAMETER } from './useDeviceSettings'
import { bleEventBus, BleEvent } from '../ble/protocol/eventBus'
import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import { parseLightCheck, type LightCheck } from '../ble/protocol/lightCheck'
import { log, logError } from '../utils/logger'
import type { AEData } from '../screens/Devices/hooks/useCameraSettingsTest'

export interface LightSensorState {
    darkThreshold: number      // op23 - AE mean below this = dark
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
    /** The decision line arrived and the reading is on screen. */
    | 'ok'
    /** Firmware predates `AI light`; the caller should fall back to a capture. */
    | 'unsupported'
    /** Acknowledged, but no reading followed. See the note on measureNow. */
    | 'timeout'

/**
 * Wait for the next `AE light check` decision line from this device. Resolves
 * null on timeout, or when cancelled.
 *
 * Subscribed before the command is sent, deliberately. `AI light` is
 * acknowledged immediately and the reading follows about two seconds later, but
 * nothing guarantees that ordering under a slow render or a busy queue, and a
 * listener attached after the send could miss the line entirely.
 *
 * `cancel` matters on the paths that abandon the wait, such as firmware that
 * does not know the command: without it the listener would sit on a shared event
 * bus until the timeout, ready to consume a line meant for someone else.
 */
const waitForLightCheck = (deviceId: string, timeoutMs: number) => {
    let settle!: (result: LightCheck | null) => void
    const promise = new Promise<LightCheck | null>(resolve => { settle = resolve })

    const done = (result: LightCheck | null) => {
        clearTimeout(timer)
        bleEventBus.removeListener('textLine', listener)
        settle(result)
    }
    const listener = (event: BleEvent & { type: 'TEXT_LINE' }) => {
        if (event.deviceId !== deviceId) return
        const decision = parseLightCheck(event.line)
        if (decision) done(decision)
    }
    const timer = setTimeout(() => done(null), timeoutMs)
    bleEventBus.on('textLine', listener)

    return { promise, cancel: () => done(null) }
}

/**
 * Ceiling for the whole measurement: the command's own 8s allowance (the AI
 * processor may need a DPD wake first) plus roughly two seconds of AE sampling,
 * with headroom. Only reached when something is actually wrong, since the op10
 * preflight in measureNow removes the common cause of silence.
 */
const LIGHT_CHECK_TIMEOUT_MS = 15_000

/**
 * The WW500's day/night light sensor: the HM0360's auto-exposure registers,
 * averaged over several frames by the firmware, drive the flash decision
 * (op25). This hook reads that state, lets the engineer tune the dark
 * threshold (op23) and check interval (op24), and can trigger a fresh
 * measurement with `AI light` — no capture and no file transfer.
 *
 * Two readings arrive from the device, and both are exposed because neither is
 * always present:
 *
 * - `lightCheck`, the firmware's own decision line, carrying the verdict and
 *   every input to it. Always sent after `AI light`, but sent after an ordinary
 *   capture only when something consumes the decision (AE flash, or auto camera
 *   switch op26), so it can be absent on the photo path.
 * - `aeData`, the raw AE registers, sent after every capture and every light
 *   check. Less informative, but the only source on older firmware.
 */
export const useLightSensor = ({ device }: { device: ExtendedPeripheral | undefined }) => {
    const [state, setState] = useState<LightSensorState>(DEFAULTS)
    const [aeData, setAeData] = useState<AEData | null>(null)
    const [lightCheck, setLightCheck] = useState<LightCheck | null>(null)
    const [isBusy, setIsBusy] = useState(false)
    const [stage, setStage] = useState<string>('')

    const unmountedRef = useRef(false)
    useEffect(() => {
        unmountedRef.current = false
        return () => { unmountedRef.current = true }
    }, [])

    // Live AE lines arrive over BLE after each capture / AE check, in two forms:
    // the raw register block ("HM0360 AE regs: / Integration time = ... / AE Mean
    // = ... / AEConverged?: Y") and the firmware's own decision line, which
    // carries the verdict and every input to it.
    useEffect(() => {
        const listener = (event: BleEvent & { type: 'TEXT_LINE' }) => {
            if (!device || event.deviceId !== device.id) return
            const msg = event.line

            // Handled first and exclusively: the decision line also contains
            // "analog gain = 4", which the case-insensitive register matcher
            // below would otherwise lift into a half-built AEData carrying no
            // AE mean at all.
            const decision = parseLightCheck(msg)
            if (decision) {
                setLightCheck(decision)
                return
            }

            setAeData(prev => {
                const next = { ...(prev || { integration: '', analogGain: '', digitalGain: '', aeMean: '', aeConverged: '' }) }
                let updated = false
                const grab = (re: RegExp, key: keyof AEData) => {
                    const m = msg.match(re)
                    if (m) { next[key] = m[1]; updated = true }
                }
                grab(/Integration time\s*=\s*(\d+)/i, 'integration')
                grab(/Analog gain\s*=\s*(\d+)/i, 'analogGain')
                grab(/Digital gain\s*=\s*(\d+)/i, 'digitalGain')
                grab(/AE Mean\s*=\s*(\d+)/i, 'aeMean')
                grab(/AEConverged\?:\s*(Y|N)/i, 'aeConverged')
                return updated ? (next as AEData) : prev
            })
        }
        bleEventBus.on('textLine', listener)
        return () => { bleEventBus.removeListener('textLine', listener) }
    }, [device])

    /**
     * Drop both readings from the previous measurement.
     *
     * Call this before triggering a measurement. The readings stream in as the
     * device samples them, so without clearing first there is a window where a
     * completed measurement is paired with the *previous* one's light level —
     * indistinguishable from a correct reading, and permanent once logged.
     */
    const resetReadings = useCallback(() => {
        setAeData(null)
        setLightCheck(null)
    }, [])

    /** Read op23/24/25 from the device. */
    const refresh = useCallback(async () => {
        if (!device?.connected) return
        try {
            const session = createBleSession(device)
            const ops = await session.execute(() => commandRegistry.getops())
            if (unmountedRef.current) return
            setState(prev => ({
                darkThreshold: opInt(ops, OP_PARAMETER.AE_DARK_THRESHOLD, prev.darkThreshold),
                checkInterval: opInt(ops, OP_PARAMETER.AE_CHECK_INTERVAL, prev.checkInterval),
                flashState: ops.length > OP_PARAMETER.AE_FLASH_STATE
                    ? opInt(ops, OP_PARAMETER.AE_FLASH_STATE, 0)
                    : null,
                flashLed: ops.length > OP_PARAMETER.FLASH_LED
                    ? opInt(ops, OP_PARAMETER.FLASH_LED, 0)
                    : null,
                autoSwitch: ops.length > OP_PARAMETER.SLOT_SWITCH
                    ? opInt(ops, OP_PARAMETER.SLOT_SWITCH, 0)
                    : null,
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

    /** Write a tuning value (op23/op24) immediately. */
    const setParam = useCallback(async (key: 'darkThreshold' | 'checkInterval', value: number) => {
        setState(prev => ({ ...prev, [key]: value }))
        if (!device?.connected) return
        const index = key === 'darkThreshold' ? OP_PARAMETER.AE_DARK_THRESHOLD : OP_PARAMETER.AE_CHECK_INTERVAL
        setIsBusy(true)
        setStage('Saving…')
        try {
            const session = createBleSession(device)
            await session.execute(() => commandRegistry.setop({ index, value }))
        } catch (e) {
            logError('[LightSensor] setop failed:', e)
            Alert.alert('Update failed', `Could not write op${index} to the device.`)
        } finally {
            if (!unmountedRef.current) { setIsBusy(false); setStage('') }
        }
    }, [device])

    /**
     * Enable/disable automatic day/night camera switching (op26). When on,
     * the device reboots into the night (HM0360) image in the dark and back
     * into the colour (RP3) image in daylight, at the next sleep after a
     * light check. The light check runs even with the flash off.
     */
    const setAutoSwitch = useCallback(async (enabled: boolean) => {
        if (!device?.connected) return
        setIsBusy(true)
        setStage(`${enabled ? 'Enabling' : 'Disabling'} auto camera switch (op26)…`)
        try {
            const session = createBleSession(device)
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.SLOT_SWITCH, value: enabled ? 1 : 0 }))
            if (!unmountedRef.current) setState(prev => ({ ...prev, autoSwitch: enabled ? 1 : 0 }))
        } catch (e) {
            logError('[LightSensor] set auto switch failed:', e)
            Alert.alert('Update failed', 'Could not set op26 (auto camera switch) on the device.')
        } finally {
            if (!unmountedRef.current) { setIsBusy(false); setStage('') }
        }
    }, [device])

    /**
     * Enable the AE-driven flash (op13 = 2, IR) so the light-sensor decision
     * actually runs — with op13 = 0 (and auto camera switch op26 off) the
     * firmware skips AE sampling entirely and op25 never updates.
     */
    const enableAeFlash = useCallback(async () => {
        if (!device?.connected) return
        setIsBusy(true)
        setStage('Enabling AE flash (op13 = IR)…')
        try {
            const session = createBleSession(device)
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.FLASH_LED, value: 2 }))
            if (!unmountedRef.current) setState(prev => ({ ...prev, flashLed: 2 }))
        } catch (e) {
            logError('[LightSensor] enable AE flash failed:', e)
            Alert.alert('Update failed', 'Could not set op13 (flash LED) on the device.')
        } finally {
            if (!unmountedRef.current) { setIsBusy(false); setStage('') }
        }
    }, [device])

    /**
     * Measure the light level without capturing an image, using `AI light`.
     *
     * About two seconds of AE sampling, no JPEG, no file transfer, so it is both
     * far quicker than forcing a capture and usable on a device whose photo
     * download does not work.
     *
     * Two things make this less straightforward than it looks:
     *
     * 1. The command is an acknowledgement only. It replies "Checking light
     *    level..." immediately and the reading arrives afterwards as telemetry,
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
     * Firmware issue for the dropped request: Seeed_Grove_Vision_AI_Module_V2#202.
     */
    const measureNow = useCallback(async (): Promise<MeasureResult> => {
        if (!device?.connected || isBusy) return 'timeout'
        setIsBusy(true)
        setLightCheck(null)
        setAeData(null)
        try {
            const session = createBleSession(device)

            setStage('Measuring light…')
            const pending = waitForLightCheck(device.id, LIGHT_CHECK_TIMEOUT_MS)
            try {
                await session.execute(() => commandRegistry.light())
            } catch (e: any) {
                pending.cancel()
                if (/unrecognised/i.test(String(e?.message ?? e))) {
                    log('[LightSensor] device has no `AI light`; caller should fall back to a capture')
                    return 'unsupported'
                }
                throw e
            }

            const decision = await pending.promise
            if (!decision) {
                logError('[LightSensor] no decision line within timeout')
                return 'timeout'
            }
            log(`[LightSensor] ${decision.dark ? 'DARK' : 'BRIGHT'} at AE ${decision.meanAE}/${decision.threshold}`)
            return 'ok'
        } catch (e: any) {
            logError('[LightSensor] measure failed:', e)
            Alert.alert('Measurement failed', e?.message ?? String(e))
            return 'timeout'
        } finally {
            if (!unmountedRef.current) { setIsBusy(false); setStage('') }
        }
    }, [device, isBusy])

    return { state, aeData, lightCheck, isBusy, stage, refresh, setParam, measureNow, enableAeFlash, setAutoSwitch, resetReadings }
}
