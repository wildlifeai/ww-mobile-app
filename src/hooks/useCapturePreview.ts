import { useState, useEffect, useRef, useCallback } from 'react'
import { Alert } from 'react-native'

import { imageReassemblerEmitter } from '../ble/emitters'
import { bleEventBus, BleEvent } from '../ble/protocol/eventBus'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import { log, logError, logWarn } from '../utils/logger'


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
    const clearDownloadTimeout = useCallback(() => {
        if (downloadTimeoutRef.current) {
            clearTimeout(downloadTimeoutRef.current)
            downloadTimeoutRef.current = null
        }
    }, [])

    // Reset inactivity timeout tracker
    const resetDownloadTimeout = useCallback(() => {
        clearDownloadTimeout()
        const DOWNLOAD_TIMEOUT = 30000 // 30s allowed between data chunks
        downloadTimeoutRef.current = setTimeout(() => {
            if (downloadRequested.current) {
                logError('[useCapturePreview] Download timed out (30s inactivity). Force finalizing.')
                imageReassemblerEmitter.emit('force_finalize')
            }
        }, DOWNLOAD_TIMEOUT)
    }, [clearDownloadTimeout])

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
            resetDownloadTimeout()
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
    }, [onImageReceived, onError, clearDownloadTimeout, resetDownloadTimeout])

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
    const startCapture = useCallback(async (captureCount: number = 1, captureInterval: number = 500) => {
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

            // Go straight to capture — no getops/setop round-trips.
            // OP 10 (camera enabled) defaults to 1 in firmware and is set during deployment.
            // If a device somehow has OP 10 = 0, the firmware returns "Camera system not
            // enabled" which is classified as CONFIG_ERROR and surfaced to the user.
            setCaptureStage(`Capturing ${captureCount} image(s)...`)
            log(`[useCapturePreview] Sending capture command (AI capture ${captureCount} ${captureInterval})...`)
            const captureResult = await session.execute(() => commandRegistry.capture(captureCount, captureInterval))
            const capturedFilename = typeof captureResult === 'string' ? captureResult : '.'
            log(`[useCapturePreview] Capture result: ${captureResult}. Target filename: ${capturedFilename}`)

            // Start Download Process Tracker
            downloadRequested.current = true
            
            resetDownloadTimeout()

            setCaptureStage('Downloading image...')
            log(`[useCapturePreview] Requesting file download for: ${capturedFilename}...`)

            let txfileSuccess = false;
            let attempts = 0;
            const maxAttempts = 3;

            while (attempts < maxAttempts && !txfileSuccess) {
                try {
                    attempts++;
                    await session.execute(() => commandRegistry.txfile(capturedFilename))
                    txfileSuccess = true;
                } catch (txErr) {
                    if (attempts >= maxAttempts) throw txErr;
                    logWarn(`[useCapturePreview] txfile attempt ${attempts} failed, retrying in 300ms...`, txErr);
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }

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
    }, [device, onCaptureStart, onError, clearDownloadTimeout, resetDownloadTimeout])

    // Clear captured image
    const clearImage = useCallback(() => {
        setCapturedImageUri(null)
        setCaptureStage('')
        downloadRequested.current = false
        setCaptureProgress(0)
        clearDownloadTimeout()
    }, [clearDownloadTimeout])

    return {
        capturedImageUri,
        isCapturing,
        captureStage,
        captureProgress,
        startCapture,
        clearImage
    }
}
