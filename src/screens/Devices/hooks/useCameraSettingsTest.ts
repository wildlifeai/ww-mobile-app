import { useState, useCallback, useEffect, useRef } from 'react'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useBle } from '../../../hooks/useBle'
import { OP_PARAMETER } from '../../../hooks/useDeviceSettings'
import { useCapturePreview } from '../../../hooks/useCapturePreview'
import { bleCommandManager } from '../../../ble/commandManager'
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
    const { write } = useBle()
    
    const [testModeBits, setTestModeBits] = useState<number>(0)
    const [cameraParams, setCameraParams] = useState<CameraTestParams>(DEFAULT_PARAMS)
    const [aeData, setAeData] = useState<AEData | null>(null)
    const [capturedImages, setCapturedImages] = useState<CapturedImageInfo[]>([])
    const [isApplying, setIsApplying] = useState(false)

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
        write,
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
        const messageListener = (msg: string) => {
            const match = msg.match(/Integration time\s*=\s*(\d+)\s*lines[\s\S]*?Analog gain\s*=\s*(\d+)[\s\S]*?Digital gain\s*=\s*(\d+)[\s\S]*?AE Mean\s*=\s*(\d+)[\s\S]*?AEConverged\?:\s*(Y|N)/i)
            if (match) {
                setAeData({
                    integration: match[1],
                    analogGain: match[2],
                    digitalGain: match[3],
                    aeMean: match[4],
                    aeConverged: match[5]
                })
            }
        }
        bleCommandManager.addMessageListener(messageListener)
        return () => bleCommandManager.removeMessageListener(messageListener)
    }, [])

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
        try {
            // 1. Write flash parameters AND quiesce background triggers.
            //    MD_INTERVAL=0 and TIMELAPSE_INTERVAL=0 are critical: if a prior
            //    deployment left these non-zero, the device re-enters monitoring mode
            //    after the test capture and fires the flash LED repeatedly.
            const ops = [
                `AI setop ${OP_PARAMETER.MD_INTERVAL} 0`,
                `AI setop ${OP_PARAMETER.TIMELAPSE_INTERVAL} 0`,
                `AI setop ${OP_PARAMETER.LED_BRIGHTNESS} ${cameraParams.ledBrightness}`,
                `AI setop ${OP_PARAMETER.FLASH_DURATION} ${cameraParams.flashDuration}`,
                `AI setop ${OP_PARAMETER.FLASH_LED} ${cameraParams.flashLed}`,
            ]
            
            // Batch write (allow 1 retry per command for transient sleep events)
            await write(device, ops, { maxRetries: 1 })
            
            // 2. Wait for device to enter DPD so all OPs are committed to CONFIG.TXT
            try {
                await bleCommandManager.waitForMessage(/^Sleep/i, 10000)
            } catch {
                // Timeout – device may already be sleeping; proceed anyway
            }
            
            // Small buffer to let DPD fully settle
            await new Promise(res => setTimeout(res, 500))

            // 3. Trigger capture via the standard capture flow.
            //    startCapture enables the camera (setop 10 1), waits for DPD,
            //    then issues 'AI capture 1 1000'.
            await capturePreview.startCapture(1, 1000)

            // 4. After capture completes, disable camera so the device returns
            //    to a quiesced idle state and does not re-enter monitoring mode.
            await write(device, [`AI setop ${OP_PARAMETER.CAMERA_ENABLED} 0`], { maxRetries: 1 })
            try {
                await bleCommandManager.waitForMessage(/^Sleep/i, 8000)
            } catch {
                // Device may not sleep if already idle — safe to ignore
            }

        } catch (e) {
            logError('[CameraSettingsTest] Error applying params or capturing:', e)
        } finally {
            setIsApplying(false)
        }
    }, [device, cameraParams, write, capturePreview])

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
        aeData,
        capturedImages,
        capturePreview
    }
}
