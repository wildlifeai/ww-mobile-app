import { useState, useEffect, useRef, useCallback } from 'react'
import { Alert } from 'react-native'

import { imageReassemblerEmitter } from '../ble/emitters'
import { bleCommandManager } from '../ble/commandManager'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { log, logError } from '../utils/logger'



interface UseCapturePreviewOptions {
    /** BLE device to capture from */
    device: ExtendedPeripheral | undefined
    /** Write function from useBle hook */
    write: (peripheral: ExtendedPeripheral, data: (string | [any, any])[], options?: any) => Promise<string[]>
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
    write,
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
        const messageListener = (msg: string) => {
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

        bleCommandManager.addMessageListener(messageListener)

        return () => {
            bleCommandManager.removeMessageListener(messageListener)
        }
    }, [])

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

            // 1. Enable camera blindly (OpParam 10) to avoid unnecessary getop roundtrip
            log('[useCapturePreview] Enabling camera blindly (Op10=1)...')
            await write(device, ['AI setop 10 1'], { maxRetries: 0 })
            log('[useCapturePreview] Camera enabled. Waiting for device sleep/wake cycle to initialize hardware...')
            
            // CRITICAL FIX: After 'AI setop 10 1', the device sends 'Sleep' and enters DPD.
            // We must catch this 'Sleep' event to know it's cycling.
            // WE DO NOT WAIT FOR 'Wake' PASSIVELY - the device stays asleep until we wake it!
            // So: Wait for Sleep -> Wait 1s (allow DPD entry) -> Send Capture (wakes device)
            try {
                setCaptureStage('Waking camera hardware...')
                log('[useCapturePreview] Waiting for device to sleep (applied settings)...')
                await bleCommandManager.waitForMessage(/^Sleep/i, 10000)
                log('[useCapturePreview] Device sleeping. Waiting 1s buffer before waking...')
                await new Promise(resolve => setTimeout(resolve, 1000))
                log('[useCapturePreview] Buffer done. Sending capture to wake device.')
            } catch (e) {
                logError('[useCapturePreview] Timeout waiting for sleep. Proceeding anyway.', e)
            }

            // 2b. Start listening for the "Captured" message before requesting file download.
            // The raw string write block below resolves on the first response ("About to capture..."),
            // but the actual capture may take seconds. By starting the listener before the write, 
            // we avoid race conditions if the "Captured" message arrives very quickly after the first response.
            const captureTimeout = Math.max(30000, captureCount * captureInterval + 15000)
            log(`[useCapturePreview] Setting up listener for 'Captured' message (timeout ${captureTimeout}ms)...`)
            const capturePromise = bleCommandManager.waitForMessage(/Captured/i, captureTimeout)

            // 2. Send Capture Command with dynamic parameters
            setCaptureStage(`Capturing ${captureCount} image(s)...`)
            log(`[useCapturePreview] Sending capture command (AI capture ${captureCount} ${captureInterval})...`)
            await write(device, [`AI capture ${captureCount} ${captureInterval}`], { maxRetries: 0 })

            try {
                await capturePromise
                log('[useCapturePreview] Capture confirmed by device.')
            } catch (e) {
                logError('[useCapturePreview] Timed out waiting for Captured message.', e)
                throw new Error('Capture timed out - device did not confirm image capture')
            }

            // 3. Start Download
            downloadRequested.current = true
            
            // Set safety timeout for download
            const DOWNLOAD_TIMEOUT = 30000
            downloadTimeoutRef.current = setTimeout(() => {
                if (downloadRequested.current) {
                    logError('[useCapturePreview] Download timed out (30s). Force finalizing.')
                    imageReassemblerEmitter.emit('force_finalize')
                }
            }, DOWNLOAD_TIMEOUT)

            setCaptureStage('Downloading image...')
            log('[useCapturePreview] Requesting file download...')
            await write(device, ['AI txfile .'], { maxRetries: 1 })

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
    }, [device, write, onCaptureStart, onError])

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
