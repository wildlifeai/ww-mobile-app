import { useState, useCallback, useEffect, useRef } from 'react'

import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import { OP_PARAMETER } from './useDeviceSettings'
import { log, logError, logWarn } from '../utils/logger'

/**
 * Camera variants held in the device's two firmware slots.
 * - RP3:    Raspberry Pi Camera Module 3 (IMX708) - colour, daylight
 * - HM0360: Himax HM0360 - mono, sees IR, used in the dark with the IR flash
 */
export type CameraVariant = 'RP3' | 'HM0360' | 'unknown'

/**
 * What each camera is called in the UI, named by the picture it produces rather
 * than by its part number: an operator picking a camera is choosing between a
 * colour image and a black and white one.
 *
 * Centralised because four screens had written their own version of this and all
 * four disagreed ("Colour" / "Colour (day)" / "RP3 · day" / "Colour (RP3)").
 * Screens that are genuinely choosing a *firmware image* rather than a picture,
 * such as the firmware updater, legitimately want the part number and should say
 * so explicitly rather than reusing these.
 */
export const CAMERA_VARIANT_LABELS: Record<Exclude<CameraVariant, 'unknown'>, string> = {
    RP3: 'Colour',
    HM0360: 'Black & White',
}

interface UseCameraSwitchOptions {
    device: ExtendedPeripheral | undefined
    onError?: (error: Error) => void
}

interface UseCameraSwitchReturn {
    /** Camera variant of the firmware image currently running */
    activeCamera: CameraVariant
    /** Camera variant recorded for the OTHER (inactive) firmware slot */
    otherSlotCamera: CameraVariant
    /** Automatic light-based switching (op26) on? null = not read / unsupported */
    autoSwitchOn: boolean | null
    /** Whether a slots query or a switch is in progress */
    isBusy: boolean
    /** Human-readable stage for UI feedback during a switch */
    stage: string
    /** Query the device for the active slot and the variant in each slot */
    refresh: () => Promise<void>
    /** Switch to the given camera (no-op if it is already active) */
    switchTo: (target: CameraVariant) => Promise<boolean>
}

/** Map a firmware variant description (e.g. "RP3 (day/colour)") to a CameraVariant */
const parseVariant = (s: string | undefined): CameraVariant => {
    if (!s) return 'unknown'
    if (/RP3/i.test(s)) return 'RP3'
    if (/HM0360/i.test(s)) return 'HM0360'
    return 'unknown'
}

// After 'switchslot' the Himax resets when it next sleeps, then cold-boots
// the other image (about 4 s) and announces itself with Wake. The switch is
// confirmed by one 'slots' query after that Wake.
//
// Nothing may be sent between 'switchslot' and the Sleep: every command is
// activity that restarts the inactivity timer, so polling 'slots' before the
// device has slept postpones the very reset being waited for. Twice on
// 3 September 2026 the polls kept the device awake until the app gave up,
// and it rebooted into the right image 20 s after the last poll, with the
// screen showing failure. The inactivity timer for a wake window is whatever
// op8 held when the device woke, so it can be 1 s (default), 3 s (a Capture
// Picture hold) or a stale 20 s from an earlier build; the Sleep budget
// covers all of them. Polling remains only as a fallback when no Sleep comes.
const RESET_SLEEP_TIMEOUT_MS = 30000
const BOOT_WAKE_TIMEOUT_MS = 15000
const VERIFY_POLL_ATTEMPTS = 4
const VERIFY_POLL_DELAY_MS = 5000

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Manual camera selection for the dual-image WW500.
 *
 * The device holds two firmware images in A/B flash slots (colour RP3 and
 * IR-capable HM0360). Switching cameras = booting the other slot: the app
 * sends 'AI switchslot', the Himax flips its slot selector and resets at its
 * next sleep. The BLE processor (and therefore the BLE connection) is not
 * affected - the reboot just looks like a Sleep/Wake cycle.
 *
 * This hook is the manual path used by the capture-preview flow. The firmware
 * can also switch automatically based on light level (op26 = 1, tuned in the
 * Light Sensor flow) - when that is on, a manual selection here may be
 * reverted at the device's next light check, so the UI warns about it.
 */
export const useCameraSwitch = ({ device, onError }: UseCameraSwitchOptions): UseCameraSwitchReturn => {
    const [activeCamera, setActiveCamera] = useState<CameraVariant>('unknown')
    const [otherSlotCamera, setOtherSlotCamera] = useState<CameraVariant>('unknown')
    const [autoSwitchOn, setAutoSwitchOn] = useState<boolean | null>(null)
    const [isBusy, setIsBusy] = useState(false)
    const [stage, setStage] = useState('')

    // A camera switch polls for up to ~30s; guard against the screen unmounting
    // mid-poll so we do not set state on an unmounted component.
    const unmountedRef = useRef(false)
    useEffect(() => {
        unmountedRef.current = false
        return () => { unmountedRef.current = true }
    }, [])

    const querySlots = useCallback(async () => {
        if (!device) throw new Error('No device connected')

        const session = createBleSession(device)
        const slots = await session.execute(() => commandRegistry.slots())

        const running = parseVariant(slots.running)
        const slotVariants = [parseVariant(slots.slotA), parseVariant(slots.slotB)] as const
        const other = slotVariants[slots.activeSlot === 0 ? 1 : 0]

        if (!unmountedRef.current) {
            setActiveCamera(running)
            setOtherSlotCamera(other)
        }

        return { running, other }
    }, [device])

    const refresh = useCallback(async () => {
        setIsBusy(true)
        setStage('Checking cameras…')
        try {
            await querySlots()
        } catch (e) {
            logWarn('[useCameraSwitch] slots query failed:', e)
        } finally {
            if (!unmountedRef.current) {
                setIsBusy(false)
                setStage('')
            }
        }
        // Also learn whether automatic (light-based) switching is on, so the
        // UI can warn that a manual selection may be reverted. Non-fatal.
        try {
            if (device) {
                const ops = await createBleSession(device).getOps()
                if (!unmountedRef.current && ops && ops.length > OP_PARAMETER.SLOT_SWITCH) {
                    setAutoSwitchOn(parseInt(ops[OP_PARAMETER.SLOT_SWITCH], 10) === 1)
                }
            }
        } catch (e) {
            logWarn('[useCameraSwitch] getops (op26) query failed:', e)
        }
    }, [querySlots, device])

    const switchTo = useCallback(async (target: CameraVariant): Promise<boolean> => {
        if (!device) {
            const err = new Error('No device connected')
            if (onError) onError(err)
            return false
        }
        if (target === 'unknown') return false

        setIsBusy(true)
        try {
            // Confirm what is currently running (also wakes the device)
            setStage('Checking cameras…')
            const { running, other } = await querySlots()

            if (running === target) {
                log(`[useCameraSwitch] ${target} already active`)
                return true
            }

            if (other !== target && other !== 'unknown') {
                throw new Error(
                    `The other firmware slot holds ${other}, not ${target}. Load the ${target} image via a firmware update first.`
                )
            }
            if (other === 'unknown') {
                // A slot only labels itself the first time its image BOOTS, and
                // that label write can be missed (it has silent failure paths) -
                // seen after a dual-image update where the first image ran only
                // briefly. Proceed: the firmware itself refuses to switch to a
                // slot without a valid secure-boot image ("Slot switch failed"),
                // and the verify polling below catches a wrong-variant boot.
                log(`[useCameraSwitch] other slot unlabelled - switching blind (firmware validates the image)`)
            }

            // Flip the slot selector; the device resets at its next sleep
            if (!unmountedRef.current) setStage(`Switching to ${target}…`)
            log(`[useCameraSwitch] switching from ${running} to ${target}`)
            const session = createBleSession(device)
            await session.execute(() => commandRegistry.switchslot())

            // Send nothing until it has slept: the reset happens on the way
            // into DPD, and any command before that only postpones it.
            if (!unmountedRef.current) setStage('Waiting for the camera to sleep, then restart (up to 30 s)…')
            const slept = await session.waitForSleep(RESET_SLEEP_TIMEOUT_MS)
            let woke = false
            if (slept) {
                if (!unmountedRef.current) setStage('Camera restarting…')
                woke = await session.waitForWake(BOOT_WAKE_TIMEOUT_MS)
            } else {
                logWarn(`[useCameraSwitch] no Sleep within ${RESET_SLEEP_TIMEOUT_MS}ms; polling instead`)
            }

            // Confirm the new image reports in. After a seen Wake the first
            // query goes at once; the delay only applies when the signals were
            // missed and the device may still be mid-reset.
            for (let attempt = 1; attempt <= VERIFY_POLL_ATTEMPTS; attempt++) {
                // Stop polling if the screen went away mid-switch
                if (unmountedRef.current) return false
                setStage(`Checking the camera (${attempt}/${VERIFY_POLL_ATTEMPTS})…`)
                if (attempt > 1 || !woke) await delay(VERIFY_POLL_DELAY_MS)
                try {
                    const check = await querySlots()
                    if (check.running === target) {
                        log(`[useCameraSwitch] now running ${target}`)
                        return true
                    }
                } catch (e) {
                    // Device may still be mid-reset - keep polling
                    log(`[useCameraSwitch] verify attempt ${attempt} failed, retrying`, e)
                }
            }

            throw new Error(
                `Device did not come back running ${target}. It may have booted the other image - ` +
                `check with 'AI slots' and switch again if needed.`
            )
        } catch (error) {
            const err = error as Error
            logError('[useCameraSwitch] switch failed:', err)
            if (onError) onError(err)
            return false
        } finally {
            if (!unmountedRef.current) {
                setIsBusy(false)
                setStage('')
            }
        }
    }, [device, onError, querySlots])

    return { activeCamera, otherSlotCamera, autoSwitchOn, isBusy, stage, refresh, switchTo }
}
