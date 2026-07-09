import { useState, useCallback, useEffect, useRef } from 'react'
import { Alert } from 'react-native'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
// unused import
import { OP_PARAMETER } from '../../../hooks/useDeviceSettings'
import { useCapturePreview } from '../../../hooks/useCapturePreview'
import { bleEventBus, BleEvent } from '../../../ble/protocol/eventBus'
import { createBleSession } from '../../../ble/session/createBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import { logError } from '../../../utils/logger'

export interface CameraTestParams {
    ledBrightness: number
    flashDuration: number
    flashLed: number
    wbRedGain: number      // op27, Q8.8 (256 = 1.0x, 0 = correction off). RP3 colour camera only
    wbBlueGain: number     // op28, Q8.8 (256 = 1.0x, 0 = correction off). RP3 colour camera only
}

// (The day/night light-sensor state moved to its own flow - see useLightSensor.ts)

export interface AEData {
    integration: string
    analogGain: string
    digitalGain: string
    aeMean: string
    aeConverged: string
}

export interface CapturedImageInfo {
    uri: string
    params: CameraTestParams
    testModeBits: number
    aeData: AEData | null
}

export interface UseCameraSettingsTestOptions {
    device: ExtendedPeripheral | undefined
}

const DEFAULT_PARAMS: CameraTestParams = {
    ledBrightness: 5,
    flashDuration: 100,
    flashLed: 0,
    wbRedGain: 286,
    wbBlueGain: 326
}

/** Parse one op value out of a getops array; returns fallback when absent/non-numeric (older firmware). */
const opInt = (ops: string[], index: number, fallback: number): number => {
    if (!ops || ops.length <= index) return fallback
    const v = parseInt(ops[index], 10)
    return isNaN(v) ? fallback : v
}

export const useCameraSettingsTest = ({ device }: UseCameraSettingsTestOptions) => {
    const [testModeBits, setTestModeBits] = useState<number>(0)
    const [cameraParams, setCameraParams] = useState<CameraTestParams>(DEFAULT_PARAMS)
    const [aeData, setAeData] = useState<AEData | null>(null)
    const [capturedImages, setCapturedImages] = useState<CapturedImageInfo[]>([])
    const [isApplying, setIsApplying] = useState(false)
    const [applyStage, setApplyStage] = useState<string>('')

    // Refs for closures
    const currentParamsRef = useRef(cameraParams)
    const currentTestModeBitsRef = useRef(testModeBits)
    const currentAeDataRef = useRef(aeData)


    useEffect(() => { currentParamsRef.current = cameraParams }, [cameraParams])
    useEffect(() => { currentTestModeBitsRef.current = testModeBits }, [testModeBits])
    useEffect(() => { currentAeDataRef.current = aeData }, [aeData])

    const handleImageReceived = useCallback((uri: string) => {
        setCapturedImages(prev => [{
            uri,
            params: currentParamsRef.current,
            testModeBits: currentTestModeBitsRef.current,
            aeData: currentAeDataRef.current
        }, ...prev])
    }, [])
    
    const handleCaptureError = useCallback((e: Error) => {
        logError('[CameraSettingsTest] Capture failed:', e)
        Alert.alert('Camera Preview Failed', e?.message || 'An error occurred while capturing preview image.')
    }, [])

    // Setup Capture Preview hook
    const capturePreview = useCapturePreview({
        device,
        onImageReceived: handleImageReceived,
        onError: handleCaptureError
    })

    // Listen for AE Data from BLE messages
    // Format:
    // HM0360 AE regs:
    //   Integration time = 66 lines
    //   Analog gain = 3
    //   Digital gain = 67
    //   AE Mean = 73
    //   AEConverged?: Y
    useEffect(() => {
        const messageListener = (event: BleEvent & { type: 'TEXT_LINE' }) => {
            if (!device || event.deviceId !== device.id) return;
            const msg = event.line;
            
            setAeData(prev => {
                const newData = { ...(prev || {
                    integration: '',
                    analogGain: '',
                    digitalGain: '',
                    aeMean: '',
                    aeConverged: ''
                }) }
                
                let updated = false;

                const intMatch = msg.match(/Integration time\s*=\s*(\d+)/i)
                if (intMatch) { newData.integration = intMatch[1]; updated = true; }

                const agMatch = msg.match(/Analog gain\s*=\s*(\d+)/i)
                if (agMatch) { newData.analogGain = agMatch[1]; updated = true; }

                const dgMatch = msg.match(/Digital gain\s*=\s*(\d+)/i)
                if (dgMatch) { newData.digitalGain = dgMatch[1]; updated = true; }

                const aeMatch = msg.match(/AE Mean\s*=\s*(\d+)/i)
                if (aeMatch) { newData.aeMean = aeMatch[1]; updated = true; }

                const convMatch = msg.match(/AEConverged\?:\s*(Y|N)/i)
                if (convMatch) { newData.aeConverged = convMatch[1]; updated = true; }

                return updated ? newData as AEData : prev;
            });
        }
        bleEventBus.on('textLine', messageListener)
        return () => { bleEventBus.removeListener('textLine', messageListener); }
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
                const ops = await session.execute(() => commandRegistry.getops())
                setCameraParams(prev => ({
                    ...prev,
                    ledBrightness: opInt(ops, OP_PARAMETER.LED_BRIGHTNESS, prev.ledBrightness),
                    flashLed: opInt(ops, OP_PARAMETER.FLASH_LED, prev.flashLed),
                    wbRedGain: opInt(ops, OP_PARAMETER.WB_RED_GAIN, prev.wbRedGain),
                    wbBlueGain: opInt(ops, OP_PARAMETER.WB_BLUE_GAIN, prev.wbBlueGain)
                }))
            } catch (e) {
                // Non-fatal: the lab still works with defaults; values sync on Apply.
                logError('[CameraSettingsTest] Failed to seed params from device:', e)
            }
        }
        seed()
    }, [device])

    const updateCameraParam = useCallback(<K extends keyof CameraTestParams>(key: K, value: CameraTestParams[K]) => {
        setCameraParams(prev => {
            return { ...prev, [key]: value }
        })
    }, [])

    /**
     * Apply flash parameters and capture a test image.
     *
     * KNOWN ISSUE: The flash LED will NOT fire during capture due to a Himax
     * firmware bug. The HM0360 strobe mode (0x03) is configured before DPD
     * but DPD resets all registers. After wake, the IMAGE task's Start Capture
     * handler never re-configures the strobe. See flash_strobe_bug_report.md.
     *
     * The capture itself works — images are taken and downloaded — but without
     * flash illumination. This will be resolved by a firmware update.
     */
    const applyAndCapture = useCallback(async () => {
        if (!device) return
        setIsApplying(true)
        setApplyStage('Reading current parameters...')
        try {
            const session = createBleSession(device);

            // Read current params to avoid redundant writes.
            // Only brightness (OP 9) and flash LED (OP 13) need checking.
            const currentOps = await session.execute(() => commandRegistry.getops())

            setApplyStage('Applying flash settings...')
            if (currentOps[OP_PARAMETER.LED_BRIGHTNESS] !== String(cameraParams.ledBrightness)) {
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.LED_BRIGHTNESS, value: cameraParams.ledBrightness }))
            }
            if (currentOps[OP_PARAMETER.FLASH_LED] !== String(cameraParams.flashLed)) {
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.FLASH_LED, value: cameraParams.flashLed }))
            }

            // White-balance gains (op27/28) - only meaningful on the RP3 colour
            // camera; harmless no-ops on HM0360 builds. 0 disables correction.
            setApplyStage('Applying white balance...')
            if (currentOps[OP_PARAMETER.WB_RED_GAIN] !== String(cameraParams.wbRedGain)) {
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.WB_RED_GAIN, value: cameraParams.wbRedGain }))
            }
            if (currentOps[OP_PARAMETER.WB_BLUE_GAIN] !== String(cameraParams.wbBlueGain)) {
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.WB_BLUE_GAIN, value: cameraParams.wbBlueGain }))
            }

            // 2. Wait for the device to naturally enter DPD (Sleep).
            setApplyStage('Waiting for device to sleep...')
            await session.waitForSleep(3000)

            // 3. Trigger capture via the standard capture flow (AI capture 1 500).
            setApplyStage('')
            await capturePreview.startCapture(1, 500)

        } catch (e) {
            logError('[CameraSettingsTest] Error applying params or capturing:', e)
        } finally {
            setIsApplying(false)
            setApplyStage('')
        }
    }, [device, cameraParams, capturePreview])

    const resetTestMode = useCallback(async () => {
        setTestModeBits(0)
        setCameraParams(DEFAULT_PARAMS)
    }, [])

    return {
        testModeBits,
        cameraParams,
        updateCameraParam,
        applyAndCapture,
        resetTestMode,
        isApplying,
        applyStage,
        aeData,
        capturedImages,
        capturePreview
    }
}
