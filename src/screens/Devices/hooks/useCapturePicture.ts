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
import { flashHold } from '../../../ble/session/flashHold'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import { selfTestCache } from '../../../ble/protocol/selfTestCache'
import { decodeSelfTest, SelfTestIssue } from '../../../utils/deviceSelfTest'
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

    /**
     * Explain a capture failure with what the device said about itself.
     *
     * A capture on a slot whose sensor is not fitted times out, and the raw
     * message is the word TIMEOUT. The device does say why, but only once: the
     * firmware runs its camera self-test at boot, so a missing sensor is
     * reported on the first wake of a session and every warm wake after it
     * reports clean. Bench, 5 September 2026: a board with no HM0360 fitted
     * reported 0x0300, then 0x0000, then timed out three captures in a row
     * while the screen showed nothing but TIMEOUT and the Himax console said
     * "HM0360 not present at 0x24".
     */
    const captureFailureDetail = useCallback((message: string): string => {
        if (!device || !/timeout/i.test(message)) return message
        const fault = selfTestCache.getLastFault(device.id)
        if (!fault) return message
        const issues = decodeSelfTest(fault.bits).filter((i: SelfTestIssue) => i.severity === 'error')
        if (issues.length === 0) return message
        return `${message}. This device reported ${issues.map((i: SelfTestIssue) => i.title).join(' and ')} earlier in this session, which is the usual reason a capture never produces a frame.`
    }, [device])

    const handleCaptureError = useCallback((e: Error) => {
        logError('[CapturePicture] Capture failed:', e)
        const detail = captureFailureDetail(e?.message || 'Capture failed')
        captureSteps.markFailed(detail)
        Alert.alert('Capture failed', detail)
    }, [captureSteps, captureFailureDetail])

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
    //
    // The flash mode is held the same way and for the same length of visit: a
    // flash chosen here means "flash this picture", and on the firmware's
    // shipped AE mode a lit room would keep it dark. op34 goes to always-on and
    // the project's mode is written back on the way out (#283).
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

        flashHold.acquire(session, deviceId)
            .then((held) => {
                if (held && !onScreen) return flashHold.release(session, deviceId)
            })
            .catch((e) => logWarn('[CapturePicture] could not arm the flash for the visit:', e))

        return () => {
            onScreen = false
            keepAwake.release(session, deviceId)
                .catch((e) => logWarn('[CapturePicture] could not restore the sleep timer:', e))
            flashHold.release(session, deviceId)
                .catch((e) => logWarn('[CapturePicture] could not restore the flash mode:', e))
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
     * The flash selection (op13) reaches the device, but op13 alone never
     * fires: the firmware also asks its flash mode whether the flash is armed.
     * In the shipped AE mode that answer is the last light verdict, so in a lit
     * room the check after each capture says BRIGHT and no selection here would
     * flash. Verified on the bench on 3 September 2026: `AI flash 50 500` lit
     * the LED directly, forcing the verdict made the next capture flash, and a
     * covered lens did the same through `AI light`. The screen's op34 hold now
     * arms it for the visit; op25 is only forced on firmware that has no mode.
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

            // The flash is armed by the visit's op34 hold, taken when the screen
            // opened and released when it closes. A device whose firmware has no
            // flash mode never took the hold, and on those builds op25 is the
            // gate: force it for this picture the way this screen always did.
            const armedByHold = flashHold.holds(device.id)
            let flashForced = false
            if (!armedByHold && cameraParams.flashLed > 0 && currentOps[OP_PARAMETER.AE_FLASH_STATE] !== '1') {
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.AE_FLASH_STATE, value: 1 }))
                flashForced = true
            }

            const flashNote = cameraParams.flashLed === 0
                ? undefined
                : armedByHold
                    ? 'Written, flash armed for this visit'
                    : flashForced
                        ? 'Written, flash forced on for this picture'
                        : undefined
            captureSteps.markSettingsApplied(changed || flashForced, flashNote)

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
