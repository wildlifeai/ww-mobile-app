import { useState, useCallback } from 'react'

import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import { log, logError, logWarn } from '../utils/logger'

/**
 * Camera variants held in the device's two firmware slots.
 * - RP3:    Raspberry Pi Camera Module 3 (IMX708) - colour, daylight
 * - HM0360: Himax HM0360 - mono, sees IR, used in the dark with the IR flash
 */
export type CameraVariant = 'RP3' | 'HM0360' | 'unknown'

interface UseCameraSwitchOptions {
    device: ExtendedPeripheral | undefined
    onError?: (error: Error) => void
}

interface UseCameraSwitchReturn {
    /** Camera variant of the firmware image currently running */
    activeCamera: CameraVariant
    /** Camera variant recorded for the OTHER (inactive) firmware slot */
    otherSlotCamera: CameraVariant
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

// After 'switchslot' the Himax resets when it next sleeps (~a few seconds),
// then cold-boots the other image. Polling 'slots' both confirms the new
// variant and wakes the device if needed. Verified switches typically
// complete within 2 polls.
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
 * Automatic light-based switching is planned firmware-side; this hook is the
 * manual path used by the capture-preview flow.
 */
export const useCameraSwitch = ({ device, onError }: UseCameraSwitchOptions): UseCameraSwitchReturn => {
    const [activeCamera, setActiveCamera] = useState<CameraVariant>('unknown')
    const [otherSlotCamera, setOtherSlotCamera] = useState<CameraVariant>('unknown')
    const [isBusy, setIsBusy] = useState(false)
    const [stage, setStage] = useState('')

    const querySlots = useCallback(async () => {
        if (!device) throw new Error('No device connected')

        const session = createBleSession(device)
        const slots = await session.execute(() => commandRegistry.slots())

        const running = parseVariant(slots.running)
        const slotVariants = [parseVariant(slots.slotA), parseVariant(slots.slotB)] as const
        const other = slotVariants[slots.activeSlot === 0 ? 1 : 0]

        setActiveCamera(running)
        setOtherSlotCamera(other)

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
            setIsBusy(false)
            setStage('')
        }
    }, [querySlots])

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

            if (other !== target) {
                throw new Error(
                    other === 'unknown'
                        ? `The other firmware slot has not been labelled yet - it may not contain the ${target} image. Load it via a firmware update first.`
                        : `The other firmware slot holds ${other}, not ${target}. Load the ${target} image via a firmware update first.`
                )
            }

            // Flip the slot selector; the device resets at its next sleep
            setStage(`Switching to ${target}…`)
            log(`[useCameraSwitch] switching from ${running} to ${target}`)
            await session_switch(device)

            // Wait out the reset, then poll until the new image reports in
            for (let attempt = 1; attempt <= VERIFY_POLL_ATTEMPTS; attempt++) {
                setStage(`Restarting camera (${attempt}/${VERIFY_POLL_ATTEMPTS})…`)
                await delay(VERIFY_POLL_DELAY_MS)
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

            throw new Error(`Device did not come back running ${target}. Check it with the 'AI slots' command.`)
        } catch (error) {
            const err = error as Error
            logError('[useCameraSwitch] switch failed:', err)
            if (onError) onError(err)
            return false
        } finally {
            setIsBusy(false)
            setStage('')
        }
    }, [device, onError, querySlots])

    return { activeCamera, otherSlotCamera, isBusy, stage, refresh, switchTo }
}

/** Send the switchslot command in its own session */
const session_switch = async (device: ExtendedPeripheral) => {
    const session = createBleSession(device)
    return session.execute(() => commandRegistry.switchslot())
}
