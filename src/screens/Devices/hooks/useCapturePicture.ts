import { useState, useCallback, useEffect, useRef } from 'react'
import { Alert } from 'react-native'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { OP_PARAMETER } from '../../../hooks/useDeviceSettings'
import { useCapturePreview } from '../../../hooks/useCapturePreview'
import { AEData, grabAeFields } from '../../../utils/aeRegisters'
import { useCaptureSteps } from './useCaptureSteps'
import { bleEventBus, BleEvent } from '../../../ble/protocol/eventBus'
import { createBleSession } from '../../../ble/session/createBleSession'
import { keepAwake } from '../../../ble/session/keepAwake'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import { log, logError, logWarn } from '../../../utils/logger'

/** The two flash settings this screen tunes: op13 (which LED) and op9 (brightness). */
export interface FlashParams {
    ledBrightness: number
    flashLed: number
}

// White balance (op27/op28) was removed from this flow on 2 September 2026: the
// gains are still in OP_PARAMETER and still reset by DeviceResetScreen, they are
// simply no longer tuned from here. Every Apply used to diff and potentially
// write two more parameters nobody was changing.

// (The day/night light-sensor state moved to its own flow - see useLightSensor.ts)

export interface CapturedImageInfo {
    uri: string
    params: FlashParams
    /** The AE register block the device sent with this capture, when it sent one */
    aeData: AEData | null
}

export interface UseCapturePictureOptions {
    device: ExtendedPeripheral | undefined
}

const DEFAULT_PARAMS: FlashParams = {
    ledBrightness: 5,
    flashLed: 0
}

/**
 * How long the device stays awake after its last activity while this screen
 * is open. Just enough for txfile to follow Captured without racing the Save
 * State; not longer, because flash and camera settings are applied at wake
 * and a longer hold would delay them. See keepAwake.ts.
 */
const CAPTURE_KEEP_AWAKE_MS = 3000

/** Parse one op value out of a getops array; returns fallback when absent/non-numeric (older firmware). */
const opInt = (ops: string[], index: number, fallback: number): number => {
    if (!ops || ops.length <= index) return fallback
    const v = parseInt(ops[index], 10)
    return isNaN(v) ? fallback : v
}

export const useCapturePicture = ({ device }: UseCapturePictureOptions) => {
    const [cameraParams, setCameraParams] = useState<FlashParams>(DEFAULT_PARAMS)
    const [aeData, setAeData] = useState<AEData | null>(null)
    const [capturedImages, setCapturedImages] = useState<CapturedImageInfo[]>([])
    const [isApplying, setIsApplying] = useState(false)
    const [applyStage, setApplyStage] = useState<string>('')

    // Refs for closures
    const currentParamsRef = useRef(cameraParams)
    const currentAeDataRef = useRef(aeData)

    useEffect(() => { currentParamsRef.current = cameraParams }, [cameraParams])
    useEffect(() => { currentAeDataRef.current = aeData }, [aeData])

    // False once the screen is gone: a Back press mid-run must not go on to
    // capture the picture the user walked away from. useCapturePreview stops
    // its own steps the same way.
    const mountedRef = useRef(true)
    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [])

    const handleImageReceived = useCallback((uri: string) => {
        setCapturedImages(prev => [{
            uri,
            params: currentParamsRef.current,
            aeData: currentAeDataRef.current
        }, ...prev])
    }, [])

    // What the device has done so far in the current run, for the step list.
    const captureSteps = useCaptureSteps({ device })

    const handleCaptureError = useCallback((e: Error) => {
        logError('[CapturePicture] Capture failed:', e)
        captureSteps.markFailed(e?.message || 'Capture failed')
        Alert.alert('Capture failed', e?.message || 'An error occurred while capturing the image.')
    }, [captureSteps])

    const capturePreview = useCapturePreview({
        device,
        onImageReceived: handleImageReceived,
        onError: handleCaptureError
    })

    // The AE register block the device sends after every capture, kept beside
    // the picture it describes. Same parser as the Light Sensor screen.
    useEffect(() => {
        const messageListener = (event: BleEvent & { type: 'TEXT_LINE' }) => {
            if (!device || event.deviceId !== device.id) return
            setAeData(prev => grabAeFields(event.line, prev) ?? prev)
        }
        bleEventBus.on('textLine', messageListener)
        return () => { bleEventBus.removeListener('textLine', messageListener) }
    }, [device])

    // Seed the UI once per mount from the device's real op values, so the lab
    // shows what the camera is actually using (not just factory defaults).
    const didSeedRef = useRef(false)
    useEffect(() => {
        if (!device?.connected || didSeedRef.current) return
        didSeedRef.current = true
        const seed = async () => {
            try {
                const session = createBleSession(device)
                const ops = await session.getOps()
                setCameraParams(prev => ({
                    ...prev,
                    ledBrightness: opInt(ops, OP_PARAMETER.LED_BRIGHTNESS, prev.ledBrightness),
                    flashLed: opInt(ops, OP_PARAMETER.FLASH_LED, prev.flashLed),
                }))
            } catch (e) {
                // Non-fatal: the lab still works with defaults; values sync on Apply.
                logError('[CapturePicture] Failed to seed params from device:', e)
            }
        }
        seed()
    }, [device])

    // Hold the device awake for the visit, so the image transfer can follow the
    // capture without waiting for a sleep and paying another wake. Released on
    // exit; if the link drops first, keepAwake writes the original back on the
    // next connection.
    useEffect(() => {
        if (!device?.connected) return
        const session = createBleSession(device)
        const deviceId = device.id
        let onScreen = true

        keepAwake.acquire(session, deviceId, CAPTURE_KEEP_AWAKE_MS)
            .then(() => {
                // Left before the raise landed: nothing else will release it.
                if (!onScreen) return keepAwake.release(session, deviceId)
            })
            .catch((e) => logWarn('[CapturePicture] could not hold the device awake:', e))

        return () => {
            onScreen = false
            keepAwake.release(session, deviceId)
                .catch((e) => logWarn('[CapturePicture] could not restore the sleep timer:', e))
        }
        // The session is a snapshot of the device at effect time on purpose: a
        // new object arrives on every redux update, and re-running this on each
        // would release and re-acquire the hold, two writes for nothing.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [device?.id, device?.connected])

    const updateCameraParam = useCallback(<K extends keyof FlashParams>(key: K, value: FlashParams[K]) => {
        setCameraParams(prev => {
            return { ...prev, [key]: value }
        })
    }, [])

    /**
     * Apply the flash settings and capture one image.
     *
     * The flash selection (op13) reaches the device, but the firmware only
     * fires the LED when its own last light decision (op25) was DARK. In a lit
     * room the check after each capture says BRIGHT, op25 stays 0, and no
     * selection here would flash. Verified on the bench on 3 September 2026:
     * `AI flash 50 500` lit the LED directly, `AI setop 25 1` made the next
     * capture flash, and a covered lens did the same through `AI light`. The
     * interim write below forces it; the proper answer is a firmware flash mode.
     */
    const applyAndCapture = useCallback(async () => {
        if (!device) return
        setIsApplying(true)
        setApplyStage('Reading current parameters...')
        captureSteps.begin()
        try {
            const session = createBleSession(device);

            // Read current params to avoid redundant writes.
            // Only brightness (OP 9) and flash LED (OP 13) need checking.
            const currentOps = await session.getOps()
            if (!mountedRef.current) {
                log('[CapturePicture] Screen left; not applying the settings')
                return
            }

            setApplyStage('Applying flash settings...')
            let changed = false
            if (currentOps[OP_PARAMETER.LED_BRIGHTNESS] !== String(cameraParams.ledBrightness)) {
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.LED_BRIGHTNESS, value: cameraParams.ledBrightness }))
                changed = true
            }
            if (currentOps[OP_PARAMETER.FLASH_LED] !== String(cameraParams.flashLed)) {
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.FLASH_LED, value: cameraParams.flashLed }))
                changed = true
            }

            // INTERIM: replace when the firmware's flash-mode parameter lands.
            //
            // Since firmware d9d9d253 (5 July 2026) op13 only chooses the LED;
            // whether it fires on a capture is decided by op25, the device's last
            // light verdict, which the check after every capture rewrites. On this
            // screen a chosen flash means "flash on this picture", so op25 is set
            // to 1 before the capture: the capture's wake restores it into the
            // flash flag, the picture is lit, and the check that follows puts the
            // real verdict back. Bench-proven 3 September 2026 (`setop 25 1`,
            // sleep, `capture`: flashed; next check: BRIGHT, op25 back to 0).
            // Skipped when the device already holds 1, so a dark scene costs
            // nothing. Only this screen writes op25; deployments are untouched.
            //
            // op25 is documented as runtime state, not user-set, which is why this
            // is interim. Charles's flash_led_modes_proposal.md (firmware repo,
            // ae_review) adds an always-on mode behind a new op parameter. When it
            // ships: write that parameter here instead, delete this block, and
            // update Capture-Picture.md and Light-Sensor.md.
            // TODO(flash-mode-op)
            let flashForced = false
            if (cameraParams.flashLed > 0 && currentOps[OP_PARAMETER.AE_FLASH_STATE] !== '1') {
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.AE_FLASH_STATE, value: 1 }))
                flashForced = true
            }
            captureSteps.markSettingsApplied(changed || flashForced, flashForced ? 'Written, flash forced on for this picture' : undefined)

            // Wait for the device to enter DPD (Sleep). The firmware selects the
            // flash LED and brightness when it wakes, so a capture that skipped
            // this would use the previous settings. Returns at once when the
            // device is already asleep, which after a hold of 3 s it usually is.
            setApplyStage('Waiting for device to sleep...')
            await session.waitForSleep(5000)
            if (!mountedRef.current) {
                log('[CapturePicture] Screen left; not sending the capture')
                return
            }

            // Trigger the capture via the shared capture path (AI capture 1 500).
            setApplyStage('')
            await capturePreview.startCapture(1, 500)

        } catch (e: any) {
            logError('[CapturePicture] Error applying params or capturing:', e)
            captureSteps.markFailed(e?.message || 'Could not apply the settings')
        } finally {
            setIsApplying(false)
            setApplyStage('')
        }
    }, [device, cameraParams, capturePreview, captureSteps])

    return {
        cameraParams,
        updateCameraParam,
        applyAndCapture,
        isApplying,
        applyStage,
        aeData,
        capturedImages,
        capturePreview,
        captureSteps
    }
}
