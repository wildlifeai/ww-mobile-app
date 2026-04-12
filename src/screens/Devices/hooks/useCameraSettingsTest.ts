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
     * WORKAROUND: Timelapse-based capture for flash LED testing.
     *
     * The Himax firmware has a bug where the HM0360 strobe mode (0x03) is only
     * configured in the MD sleep preparation path (before DPD), but NOT in the
     * IMAGE task's manual `capture` command handler. This means `AI capture`
     * commands never trigger the flash LED.
     *
     * Workaround: Instead of `AI capture`, we set a short timelapse interval (2s)
     * and let the device enter DPD normally (which DOES configure the strobe).
     * The device auto-wakes from the timelapse timer and captures with flash.
     *
     * TODO: Revert to direct `AI capture` once firmware is fixed.
     */
    const applyAndCapture = useCallback(async () => {
        if (!device) return
        setIsApplying(true)
        try {
            // 1. Write flash parameters to device
            const ops = [
                `AI setop ${OP_PARAMETER.LED_BRIGHTNESS} ${cameraParams.ledBrightness}`,
                `AI setop ${OP_PARAMETER.FLASH_DURATION} ${cameraParams.flashDuration}`,
                `AI setop ${OP_PARAMETER.FLASH_LED} ${cameraParams.flashLed}`,
            ]
            
            // Batch write (allow 1 retry per command for transient sleep events)
            await write(device, ops, { maxRetries: 1 })
            
            // 2. Wait for device to enter DPD so flash OPs are committed to CONFIG.TXT
            try {
                await bleCommandManager.waitForMessage(/^Sleep/i, 10000)
            } catch {
                // Timeout – device may already be sleeping; proceed anyway
            }
            
            await new Promise(res => setTimeout(res, 500))

            // 3. WORKAROUND: Set short timelapse (2s) + disable MD + enable camera.
            //    When the device enters DPD after these commands, it WILL configure
            //    the HM0360 strobe mode (0x03), enabling the flash LED.
            //    The device then auto-wakes from the timelapse timer after ~2s.
            capturePreview.clearImage()
            
            const captureOps = [
                `AI setop ${OP_PARAMETER.TIMELAPSE_INTERVAL} 2`,   // 2-second timelapse
                `AI setop ${OP_PARAMETER.MD_INTERVAL} 0`,          // Disable motion detection
                `AI setop ${OP_PARAMETER.CAMERA_ENABLED} 1`,       // Enable camera (always last)
            ]
            await write(device, captureOps, { maxRetries: 1 })

            // 4. Wait for DPD — this is where the strobe gets configured
            try {
                await bleCommandManager.waitForMessage(/^Sleep/i, 15000)
            } catch {
                // Timeout — proceed anyway
            }
            
            // 5. Device will auto-wake from timelapse in ~2s and capture WITH flash.
            //    Listen for the "Captured" message.
            try {
                await bleCommandManager.waitForMessage(/Captured/i, 30000)
            } catch {
                logError('[CameraSettingsTest] Timeout waiting for timelapse capture')
                throw new Error('Capture timed out — device did not confirm image capture')
            }
            
            // 6. Download the captured image
            await write(device, ['AI txfile .'], { maxRetries: 1 })

            // 7. Cleanup: disable camera and reset timelapse to prevent further triggers.
            //    Wait for device to finish sending the image first.
            try {
                await bleCommandManager.waitForMessage(/Finished sending/i, 30000)
            } catch {
                // Timeout — still try to clean up
            }
            
            await new Promise(res => setTimeout(res, 500))
            
            const cleanupOps = [
                `AI setop ${OP_PARAMETER.CAMERA_ENABLED} 0`,       // Disable camera
                `AI setop ${OP_PARAMETER.TIMELAPSE_INTERVAL} 0`,   // Reset timelapse
            ]
            await write(device, cleanupOps, { maxRetries: 1 })

        } catch (e) {
            logError('[CameraSettingsTest] Error applying params or capturing:', e)
            // Best-effort cleanup on error
            try {
                await write(device, [
                    `AI setop ${OP_PARAMETER.CAMERA_ENABLED} 0`,
                    `AI setop ${OP_PARAMETER.TIMELAPSE_INTERVAL} 0`,
                ], { maxRetries: 0 })
            } catch { /* ignore cleanup errors */ }
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
