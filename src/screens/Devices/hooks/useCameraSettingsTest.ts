import { useState, useCallback, useEffect, useRef } from 'react'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useBle } from '../../../hooks/useBle'
import { OP_PARAMETER } from '../../../hooks/useDeviceSettings'
import { useCapturePreview } from '../../../hooks/useCapturePreview'
import { bleCommandManager } from '../../../ble/commandManager'
import { logError } from '../../../utils/logger'

export interface CameraTestParams {
    numPictures: number
    pictureInterval: number
    ledBrightness: number
    flashDuration: number
    flashLed: number
    modelThreshold: number
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
    numPictures: 3,
    pictureInterval: 1500,
    ledBrightness: 5,
    flashDuration: 100,
    flashLed: 0,
    modelThreshold: 64
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

    // Setup Capture Preview hook
    const capturePreview = useCapturePreview({
        device,
        write,
        onImageReceived: (uri) => {
            setCapturedImages(prev => [{
                uri,
                params: currentParamsRef.current,
                testModeBits: currentTestModeBitsRef.current,
                aeData: currentAeDataRef.current
            }, ...prev])
        },
        onError: (e) => logError('[CameraSettingsTest] Capture failed:', e)
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
            const match = msg.match(/Integration time = (\d+) lines[\s\S]*?Analog gain = (\d+)[\s\S]*?Digital gain = (\d+)[\s\S]*?AE Mean = (\d+)[\s\S]*?AEConverged\?: (Y|N)/i)
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

    const toggleTestBit = useCallback((bitPos: number) => {
        const nextBits = testModeBits ^ (1 << bitPos)
        setTestModeBits(nextBits)
        
        // Smart defaults when a test is enabled:
        const isBitEnabled = (nextBits & (1 << bitPos)) !== 0
        if (isBitEnabled) {
            setCameraParams(p => {
                const newParams = { ...p }
                if (bitPos === 0) { // Tone mapping
                    newParams.numPictures = 4
                } else if (bitPos === 1) { // Save BMP
                    newParams.numPictures = 4 // must be even
                } else if (bitPos === 2) { // Flash brightness
                    newParams.numPictures = 7
                    if (newParams.flashLed === 0) newParams.flashLed = 1 // Need some flash
                } else if (bitPos === 3) { // Skip file creation
                    newParams.numPictures = 10
                    newParams.pictureInterval = 500 // fast stream
                }
                return newParams
            })
        }
    }, [testModeBits])

    const updateCameraParam = useCallback(<K extends keyof CameraTestParams>(key: K, value: CameraTestParams[K]) => {
        setCameraParams(prev => ({ ...prev, [key]: value }))
    }, [])

    const applyAndCapture = useCallback(async () => {
        if (!device) return
        setIsApplying(true)
        try {
            // Write all parameters first
            const ops = [
                `AI setop ${OP_PARAMETER.TEST_MODE_BITS} ${testModeBits}`,
                `AI setop ${OP_PARAMETER.NUM_PICTURES} ${cameraParams.numPictures}`,
                `AI setop ${OP_PARAMETER.PICTURE_INTERVAL} ${cameraParams.pictureInterval}`,
                `AI setop ${OP_PARAMETER.LED_BRIGHTNESS} ${cameraParams.ledBrightness}`,
                `AI setop ${OP_PARAMETER.FLASH_DURATION} ${cameraParams.flashDuration}`,
                `AI setop ${OP_PARAMETER.FLASH_LED} ${cameraParams.flashLed}`,
                `AI setop ${OP_PARAMETER.MODEL_THRESHOLD} ${cameraParams.modelThreshold}`,
            ]
            
            // We batch write these to the device (allow 1 retry per command for transient sleep events)
            await write(device, ops, { maxRetries: 1 })
            
            // Wait a little bit just in case
            await new Promise(res => setTimeout(res, 500))

            // Trigger Capture with dynamic settings
            await capturePreview.startCapture(cameraParams.numPictures, cameraParams.pictureInterval)

        } catch (e) {
            logError('[CameraSettingsTest] Error applying params or capturing:', e)
        } finally {
            setIsApplying(false)
        }
    }, [device, testModeBits, cameraParams, write, capturePreview])

    const resetTestMode = useCallback(async () => {
        setTestModeBits(0)
        setCameraParams(DEFAULT_PARAMS)
        if (device) {
            try {
                setIsApplying(true)
                await write(device, [`AI setop ${OP_PARAMETER.TEST_MODE_BITS} 0`], { maxRetries: 0 })
            } catch (e) {
                logError('[CameraSettingsTest] Error resetting test mode:', e)
            } finally {
                setIsApplying(false)
            }
        }
    }, [device, write])

    return {
        testModeBits,
        toggleTestBit,
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
