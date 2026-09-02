import { useState, useCallback, useEffect, useMemo, useRef } from 'react'

import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { OP_PARAMETER } from './useDeviceSettings'
import { bleEventBus, BleEvent } from '../ble/protocol/eventBus'
import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import { parseSelfTestBits, decodeSelfTest } from '../utils/deviceSelfTest'
import { log, logWarn } from '../utils/logger'

export type ReadinessStatus =
    /** Not asked to check yet, or no device. Screens show nothing. */
    | 'unknown'
    /** Commands in flight. */
    | 'checking'
    /** Camera present and switched on. */
    | 'ready'
    /** Nothing broken, but the camera is switched off (op10 = 0). One tap fixes it. */
    | 'cameraOff'
    /** A hardware fault the app cannot fix, e.g. a disconnected ribbon cable. */
    | 'faulted'

/**
 * The device announces its self-test result after every wake, unprompted. That
 * broadcast is the same `Error bits = 0xNNNN` string the `selftest` command
 * returns, so listening costs nothing and keeps the verdict current.
 *
 * Anchored on the whole label rather than reusing parseSelfTestBits alone, which
 * matches any `0x` in any string: plenty of unrelated device chatter carries hex,
 * for example `Wakeup_event = 0x0000` and `Image Event Start Capture (0x0a01)`,
 * and treating one of those as a self-test result would corrupt the state.
 */
const ERROR_BITS_LINE = /^\s*Error bits\s*=\s*0x[0-9a-f]+/i

/**
 * Bits 8-15 are the AI processor's. The BLE processor pre-sets **all** of them
 * at boot and clears them only once the AI processor reports for itself, so a
 * self-test seen before the Himax is awake carries `0xFF00` as an initial value
 * rather than as a finding. `useBleInitialization` masks the whole AI range for
 * that reason at connect time.
 *
 * We cannot mask the range here, since bits 8 and 9 are the two this hook exists
 * to read. Instead we reject the specific pattern that can only be the preset:
 * every AI bit set at once, which would otherwise be reported as five
 * simultaneous hardware failures on a healthy device.
 */
const AI_BITS = 0xff00
const isBootPreset = (bits: number) => (bits & AI_BITS) === AI_BITS

/**
 * Is this device's camera actually usable, asked before a flow that needs it.
 *
 * Two independent things can stop a camera flow working, and they are not
 * interchangeable:
 *
 * - **A hardware fault.** The firmware runs a self-test at boot and sets a bit
 *   when the camera fails to initialise (`SELF_TEST_AI_NO_CAM`). Nothing the app
 *   sends will fix a disconnected ribbon cable.
 * - **The camera is switched off.** op10 = 0. This is a *state*, not a fault, and
 *   two commands fix it. Crucially the firmware sets **no** self-test bit for it,
 *   because `selfTest_setErrorBits()` sits inside the `if (cameraSystemEnabled)`
 *   branch, so a self-test alone cannot see this case at all.
 *
 * Reporting both as "error" would tell someone to check a cable when the real
 * answer is one tap, so they stay separate all the way to the UI.
 *
 * **The self-test half is push, not poll.** The device broadcasts its bits after
 * every wake, so this listens continuously and only asks explicitly when it has
 * never heard them. That saves a command per check, and it fixes a real failure
 * seen on the bench on 2 September: a poll returned a camera fault, the device
 * broadcast a clean result 900ms later, and the app went on showing the fault
 * because it was only reading replies to its own commands.
 *
 * **This hook sends BLE commands, so it never runs on its own.** Pass
 * `enabled: true` only once the user has chosen a flow that needs the camera.
 * The Engineer Console must not trigger it: connecting to a device should be
 * silent, and a device out in the field on an active deployment should not be
 * woken just to be inspected.
 */
export const useCameraReadiness = ({
    device,
    enabled = false,
}: {
    device: ExtendedPeripheral | undefined
    /**
     * Run the check. Gate this on the user having entered a camera flow, and on
     * the device not being mid-deployment.
     */
    enabled?: boolean
}) => {
    const [bits, setBits] = useState<number | null>(null)
    const [cameraOn, setCameraOn] = useState<boolean | null>(null)
    const [isChecking, setIsChecking] = useState(false)
    const [isFixing, setIsFixing] = useState(false)

    const unmountedRef = useRef(false)
    useEffect(() => {
        unmountedRef.current = false
        return () => { unmountedRef.current = true }
    }, [])

    // Mirrors `bits` so check() can read what has arrived *during* its own run,
    // rather than the value captured when the callback was created.
    const bitsRef = useRef<number | null>(null)

    // Free and always current: every wake tells us the answer without being asked.
    useEffect(() => {
        const listener = (event: BleEvent & { type: 'TEXT_LINE' }) => {
            if (!device || event.deviceId !== device.id) return
            if (!ERROR_BITS_LINE.test(event.line)) return
            const parsed = parseSelfTestBits(event.line)
            if (parsed === null) return
            if (isBootPreset(parsed)) {
                log('[CameraReadiness] ignoring boot preset 0x' + parsed.toString(16))
                return
            }
            bitsRef.current = parsed
            setBits(prev => {
                if (prev !== parsed) log(`[CameraReadiness] device reports 0x${parsed.toString(16).padStart(4, '0')}`)
                return parsed
            })
        }
        bleEventBus.on('textLine', listener)
        return () => { bleEventBus.removeListener('textLine', listener) }
    }, [device])

    const issues = useMemo(() => (bits === null ? [] : decodeSelfTest(bits)), [bits])

    // Derived rather than stored, so a broadcast arriving after the check moves
    // the verdict without anything having to remember to recompute it.
    const status: ReadinessStatus = useMemo(() => {
        if (isChecking) return 'checking'
        if (cameraOn === null) return 'unknown'          // no check has run yet
        // A real fault outranks the switch: turning on a camera that cannot
        // initialise would just fail again, so do not offer that as the fix.
        if (issues.some(i => i.severity === 'error')) return 'faulted'
        return cameraOn ? 'ready' : 'cameraOff'
    }, [isChecking, cameraOn, issues])

    /**
     * @param force re-read the self-test even if a broadcast already told us.
     *   Default true, because an explicit call means the caller has reason to
     *   doubt what we hold: a failed measurement, or a slot switch that booted a
     *   different firmware image onto a different sensor. Only the automatic
     *   check on entry passes false, where a recent broadcast is good enough.
     */
    const check = useCallback(async (force = true) => {
        if (!device?.connected) return
        setIsChecking(true)
        try {
            const session = createBleSession(device)

            // op10 first, deliberately. The device is usually asleep, so this
            // command wakes it, and a wake makes it announce its self-test
            // unprompted. Asking that question first therefore answers the second
            // one for free. Doing it the other way round, as this did until the
            // bench run on 2 September, sent `selftest` roughly 200ms before the
            // broadcast arrived and so never once managed to skip it.
            const ops = await session.execute(() => commandRegistry.getops())
            const on = ops && ops.length > OP_PARAMETER.CAMERA_ENABLED
                ? parseInt(ops[OP_PARAMETER.CAMERA_ENABLED], 10) === 1
                : true   // older firmware without the parameter always has it on

            if (unmountedRef.current) return
            setCameraOn(on)
            log(`[CameraReadiness] cameraOn=${on}`)

            // Only ask when this wake has not already told us, or when the caller
            // insists because it has reason to distrust what we hold.
            if (force || bitsRef.current === null) {
                const raw = await session.execute(() => commandRegistry.selftest())
                const parsed = parseSelfTestBits(raw)
                if (!unmountedRef.current && parsed !== null && !isBootPreset(parsed)) {
                    bitsRef.current = parsed
                    setBits(parsed)
                }
            }
        } catch (e) {
            // Never block a flow because the check itself failed. An engineer with
            // a flaky link should still reach the screen; the action they take
            // will report its own errors.
            logWarn('[CameraReadiness] check failed, treating as unknown:', e)
        } finally {
            if (!unmountedRef.current) setIsChecking(false)
        }
        // `bits` is read through bitsRef, so this callback stays stable and the
        // entry effect below cannot re-fire just because a broadcast landed.
    }, [device])

    /**
     * Switch the camera back on. Both writes are needed: op10 is the persisted
     * flag reloaded on every wake, while `AI enable` changes the running camera
     * system, which a write to op10 alone does not touch until the image task
     * next starts.
     */
    const fix = useCallback(async () => {
        if (!device?.connected) return
        setIsFixing(true)
        try {
            const session = createBleSession(device)
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.CAMERA_ENABLED, value: 1 }))
            await session.execute(() => commandRegistry.enableCamera())
            if (!unmountedRef.current) setCameraOn(true)
            log('[CameraReadiness] camera switched back on')
        } catch (e) {
            logWarn('[CameraReadiness] could not switch the camera on:', e)
        } finally {
            if (!unmountedRef.current) setIsFixing(false)
        }
    }, [device])

    // Runs once per connection, and only when a flow has asked for it.
    const checkedRef = useRef(false)
    useEffect(() => {
        if (!enabled || !device?.connected) {
            checkedRef.current = false
            return
        }
        if (checkedRef.current) return
        checkedRef.current = true
        check(false)
    }, [enabled, device?.connected, check])

    return { status, issues, isChecking, isFixing, check, fix }
}
