import { useState, useEffect, useRef, useCallback } from 'react'
import { Alert } from 'react-native'

import { imageReassemblerEmitter } from '../ble/emitters'
import { bleEventBus, BleEvent } from '../ble/protocol/eventBus'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import { DeviceSignal } from '../ble/protocol/deviceSignals'
import { log, logError } from '../utils/logger'



interface UseCapturePreviewOptions {
    /** BLE device to capture from */
    device: ExtendedPeripheral | undefined
    /** Optional callback when capture starts */
    onCaptureStart?: () => void
    /** Optional callback when image is received */
    onImageReceived?: (imageUri: string) => void
    /** Optional callback on error */
    onError?: (error: Error) => void
}

interface UseCapturePreviewReturn {
    /** Current captured image URI */
    capturedImageUri: string | null
    /** Whether currently capturing/downloading */
    isCapturing: boolean
    /** Current stage of capture for UI feedback */
    captureStage: string
    /** Capture progress (0-1) */
    captureProgress: number
    /** Function to start image capture */
    startCapture: (captureCount?: number, captureInterval?: number) => Promise<void>
    /** Function to clear captured image */
    clearImage: () => void
}

/**
 * Custom hook for handling the CAPTURE_PREVIEW process
 * 
 * Optimized to use FileSystem for storage and proper event listeners.
 */
export const useCapturePreview = ({
    device,
    onCaptureStart,
    onImageReceived,
    onError
}: UseCapturePreviewOptions): UseCapturePreviewReturn => {
    const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null)
    const [isCapturing, setIsCapturing] = useState(false)
    const [captureStage, setCaptureStage] = useState<string>('')
    const [captureProgress, setCaptureProgress] = useState(0)
    
    // Refs for state that shouldn't trigger re-renders or needs to be accessed in callbacks
    const downloadRequested = useRef(false)
    const downloadTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Clear timeout helper
    const clearDownloadTimeout = () => {
        if (downloadTimeoutRef.current) {
            clearTimeout(downloadTimeoutRef.current)
            downloadTimeoutRef.current = null
        }
    }

    // Listen for image download completion and progress
    useEffect(() => {
        const handleImageComplete = (fileUri: string) => {
            log('[useCapturePreview] Image download complete, URI:', fileUri)
            clearDownloadTimeout()
            
            setIsCapturing(false)
            setCaptureStage('')
            setCaptureProgress(1) 
            setCapturedImageUri(fileUri)
            downloadRequested.current = false

            if (onImageReceived) {
                onImageReceived(fileUri)
            }
        }

        const handleImageProgress = (progress: number) => {
            setCaptureStage('Downloading...')
            setCaptureProgress(progress)
        }

        const handleImageError = (errorMessage: string) => {
            logError('[useCapturePreview] Image transfer error:', errorMessage)
            clearDownloadTimeout()

            setIsCapturing(false)
            setCaptureStage('')
            setCaptureProgress(0)
            downloadRequested.current = false

            const err = new Error(errorMessage)
            if (onError) onError(err)
            else Alert.alert('Image Error', errorMessage)
        }

        imageReassemblerEmitter.on('onImageComplete', handleImageComplete)
        imageReassemblerEmitter.on('onImageProgress', handleImageProgress)
        imageReassemblerEmitter.on('onImageError', handleImageError)
        
        return () => {
            imageReassemblerEmitter.off('onImageComplete', handleImageComplete)
            imageReassemblerEmitter.off('onImageProgress', handleImageProgress)
            imageReassemblerEmitter.off('onImageError', handleImageError)
            clearDownloadTimeout()
        }
    }, [onImageReceived, onError])

    // Listen for "Finished sending" message
    useEffect(() => {
        const messageListener = (event: BleEvent & { type: 'TEXT_LINE' }) => {
            if (!device || event.deviceId !== device.id) return;
            const msg = event.line;
            // Check if we are expecting a download and receive the finish signal
            if (downloadRequested.current && msg.includes('Finished sending')) {
                const match = msg.match(/sending (\d+) bytes/)
                const expectedBytes = match ? parseInt(match[1], 10) : 'unknown'
                
                log(`[useCapturePreview] "Finished sending" detected (expected ${expectedBytes} bytes). Waiting 500ms grace period for last packets...`)
                
                // Grace period to ensure last chunks are processed from the BLE queue
                setTimeout(() => {
                     log('[useCapturePreview] Grace period ended. Triggering force_finalize.')
                     imageReassemblerEmitter.emit('force_finalize')
                }, 500)
            }
        }

        bleEventBus.on('textLine', messageListener)

        return () => {
            bleEventBus.removeListener('textLine', messageListener)
        }
    }, [device])

    // Start capture process
    const startCapture = useCallback(async (captureCount: number = 1, captureInterval: number = 1) => {
        if (!device) {
            const error = new Error('No device connected')
            logError('[useCapturePreview]', error.message)
            if (onError) onError(error)
            else Alert.alert('Error', 'No device connected')
            return
        }

        log(`[useCapturePreview] startCapture called (count=${captureCount}, interval=${captureInterval})`)

        try {
            setIsCapturing(true)
            setCaptureStage('Initializing...')
            setCapturedImageUri(null)
            setCaptureProgress(0)
            downloadRequested.current = false
            clearDownloadTimeout()

            if (onCaptureStart) onCaptureStart()

            const session = createBleSession(device);

            // 1. Enable camera (OpParam 10)
            log('[useCapturePreview] Enabling camera (Op10=1)...')
            await session.execute(() => commandRegistry.setop({ index: 10, value: 1 }))
            
            // 2. Wait explicitly for device to Sleep via EventBus
            try {
                setCaptureStage('Waking camera hardware...')
                log('[useCapturePreview] Waiting for device to sleep (applied settings)...')
                await new Promise<void>((resolve, reject) => {
                    const sleepListener = (ev: BleEvent & { type: 'DEVICE_SIGNAL' }) => {
                        if (ev.deviceId === device.id && ev.signal === DeviceSignal.SLEEP) {
                            cleanup();
                            resolve();
                        }
                    };
                    const timeout = setTimeout(() => {
                        cleanup();
                        reject(new Error("Sleep timeout"));
                    }, 10000);
                    const cleanup = () => {
                        clearTimeout(timeout);
                        bleEventBus.removeListener('deviceSignal', sleepListener);
                    };
                    bleEventBus.on('deviceSignal', sleepListener);
                });
                log('[useCapturePreview] Device sleeping. Waiting 1s buffer before waking...')
                await new Promise(resolve => setTimeout(resolve, 1000))
            } catch (e) {
                logError('[useCapturePreview] Timeout waiting for sleep. Proceeding anyway.', e)
            }

            // 3. Send Capture Command
            setCaptureStage(`Capturing ${captureCount} image(s)...`)
            log(`[useCapturePreview] Sending capture command (AI capture ${captureCount} ${captureInterval})...`)
            await session.execute(() => commandRegistry.capture(captureCount, captureInterval))

            // 4. Start Download Process Tracker
            downloadRequested.current = true
            
            const DOWNLOAD_TIMEOUT = 30000
            downloadTimeoutRef.current = setTimeout(() => {
                if (downloadRequested.current) {
                    logError('[useCapturePreview] Download timed out (30s). Force finalizing.')
                    imageReassemblerEmitter.emit('force_finalize')
                }
            }, DOWNLOAD_TIMEOUT)

            setCaptureStage('Downloading image...')
            log('[useCapturePreview] Requesting file download...')
            await session.execute(commandRegistry.txfile)

        } catch (error) {
            const err = error as Error
            logError('[useCapturePreview] Capture failed:', err)
            setIsCapturing(false)
            setCaptureStage('')
            downloadRequested.current = false
            setCaptureProgress(0)
            clearDownloadTimeout()

            if (onError) onError(err)
            else Alert.alert('Error', `Capture failed: ${err.message}`)
        }
    }, [device, onCaptureStart, onError])

    // Clear captured image
    const clearImage = useCallback(() => {
        setCapturedImageUri(null)
        setCaptureStage('')
        downloadRequested.current = false
        setCaptureProgress(0)
        clearDownloadTimeout()
    }, [])

    return {
        capturedImageUri,
        isCapturing,
        captureStage,
        captureProgress,
        startCapture,
        clearImage
    }
}
