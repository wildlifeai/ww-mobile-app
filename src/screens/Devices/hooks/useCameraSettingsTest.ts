import { useState, useCallback, useEffect, useRef } from 'react'
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
}

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
    flashLed: 0
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
