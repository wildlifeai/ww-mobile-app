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
    /** Capture progress (0-1) */
    captureProgress: number
    /** Function to start image capture */
    startCapture: () => Promise<void>
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
            setCaptureProgress(1) 
            setCapturedImageUri(fileUri)
            downloadRequested.current = false

            if (onImageReceived) {
                onImageReceived(fileUri)
            }
        }

        const handleImageProgress = (progress: number) => {
            setCaptureProgress(progress)
        }

        imageReassemblerEmitter.on('onImageComplete', handleImageComplete)
        imageReassemblerEmitter.on('onImageProgress', handleImageProgress)
        
        return () => {
            imageReassemblerEmitter.off('onImageComplete', handleImageComplete)
            imageReassemblerEmitter.off('onImageProgress', handleImageProgress)
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
    const startCapture = useCallback(async () => {
        if (!device) {
            const error = new Error('No device connected')
            logError('[useCapturePreview]', error.message)
            if (onError) onError(error)
            else Alert.alert('Error', 'No device connected')
            return
        }

        log('[useCapturePreview] startCapture called')

        try {
            setIsCapturing(true)
            setCapturedImageUri(null)
            setCaptureProgress(0)
            downloadRequested.current = false
            clearDownloadTimeout()

            if (onCaptureStart) onCaptureStart()

            // 1. Send Capture Command
            log('[useCapturePreview] Sending capture command...')
            await write(device, ['AI capture 1 0'])
            
            // 2. Wait for "Captured" response
            const CAPTURE_TIMEOUT = 30000 
            await bleCommandManager.waitForMessage(/Captured/, CAPTURE_TIMEOUT)
            log('[useCapturePreview] Capture confirmed.')

            // 3. Start Download
            downloadRequested.current = true
            
            // Set safety timeout for download
            const DOWNLOAD_TIMEOUT = 20000
            downloadTimeoutRef.current = setTimeout(() => {
                if (downloadRequested.current) {
                    logError('[useCapturePreview] Download timed out (20s). Force finalizing.')
                    imageReassemblerEmitter.emit('force_finalize')
                    // The reassembler will decide if it has enough data to emit complete
                    // or if it resets. If it emits complete, our handleImageComplete will fire.
                }
            }, DOWNLOAD_TIMEOUT)

            log('[useCapturePreview] Requesting file download...')
            await write(device, ['AI txfile .'])

        } catch (error) {
            const err = error as Error
            logError('[useCapturePreview] Capture failed:', err)
            setIsCapturing(false)
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
        downloadRequested.current = false
        setCaptureProgress(0)
        clearDownloadTimeout()
    }, [])

    return {
        capturedImageUri,
        isCapturing,
        captureProgress,
        startCapture,
        clearImage
    }
}
