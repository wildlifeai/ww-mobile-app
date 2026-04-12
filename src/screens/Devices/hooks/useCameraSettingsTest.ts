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

    const applyAndCapture = useCallback(async () => {
        if (!device) return
        setIsApplying(true)
        try {
            // Write all parameters first
            const ops = [
                `AI setop ${OP_PARAMETER.LED_BRIGHTNESS} ${cameraParams.ledBrightness}`,
                `AI setop ${OP_PARAMETER.FLASH_DURATION} ${cameraParams.flashDuration}`,
                `AI setop ${OP_PARAMETER.FLASH_LED} ${cameraParams.flashLed}`,
            ]
            
            // We batch write these to the device (allow 1 retry per command for transient sleep events)
            await write(device, ops, { maxRetries: 1 })
            
            // Wait a little bit just in case
            await new Promise(res => setTimeout(res, 500))

            // Trigger Capture with dynamic settings
            await capturePreview.startCapture(1, 1)

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
