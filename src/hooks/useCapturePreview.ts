import { useState, useEffect, useRef, useCallback } from 'react'
import { Alert } from 'react-native'
import { imageReassemblerEmitter } from '../ble/emitters'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { LogEntry } from '../redux/slices/logsSlice'

interface UseCapturePreviewOptions {
    /** BLE device to capture from */
    device: ExtendedPeripheral | undefined
    /** BLE logs to monitor for capture completion */
    logs: LogEntry[]
    /** Write function from useBle hook */
    write: (peripheral: ExtendedPeripheral, commands: string[]) => Promise<void>
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
    /** Function to start image capture */
    startCapture: () => Promise<void>
    /** Function to clear captured image */
    clearImage: () => void
}

/**
 * Custom hook for handling the CAPTURE_PREVIEW process
 * 
 * This hook encapsulates the entire flow of:
 * 1. Sending 'AI capture 1 0' command
 * 2. Detecting "Captured" in BLE logs
 * 3. Auto-triggering 'AI txfile .' download
 * 4. Receiving image via imageReassemblerEmitter
 * 
 * @example
 * ```tsx
 * const { capturedImageUri, isCapturing, startCapture, clearImage } = useCapturePreview({
 *   device: bleDevice,
 *   logs: bleDeviceLogs,
 *   write: bleWrite,
 *   onImageReceived: (uri) => console.log('Image received:', uri)
 * })
 * 
 * // In your component
 * <Button onPress={startCapture} loading={isCapturing}>Capture Image</Button>
 * {capturedImageUri && <Image source={{ uri: capturedImageUri }} />}
 * ```
 */
export const useCapturePreview = ({
    device,
    logs,
    write,
    onCaptureStart,
    onImageReceived,
    onError
}: UseCapturePreviewOptions): UseCapturePreviewReturn => {
    const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null)
    const [isCapturing, setIsCapturing] = useState(false)
    const downloadRequested = useRef(false)
    const lastProcessedLength = useRef<number>(0)

    // Listen for image download completion
    useEffect(() => {
        const handleImageComplete = (base64: string) => {
            console.log('[useCapturePreview] Image download complete, base64 length:', base64?.length)
            setIsCapturing(false)
            // Convert base64 to URI format for React Native Image component
            const imageUri = `data:image/jpeg;base64,${base64}`
            setCapturedImageUri(imageUri)
            downloadRequested.current = false

            if (onImageReceived) {
                onImageReceived(imageUri)
            }
        }

        imageReassemblerEmitter.on('onImageComplete', handleImageComplete)
        return () => {
            imageReassemblerEmitter.off('onImageComplete', handleImageComplete)
        }
    }, [onImageReceived])

    // Auto-trigger download when "Captured" detected in logs
    //  This uses the EXACT logic from the old working Engineer Console implementation
    useEffect(() => {
        // console.log('[useCapturePreview] useEffect running, isCapturing:', isCapturing, 'logs length:', logs.length)

        // Don't process if logs haven't changed
        if (logs.length === lastProcessedLength.current) {
            // console.log('[useCapturePreview] Logs unchanged, skipping')
            return
        }

        // Extract the new entries
        const newEntries = logs.slice(lastProcessedLength.current)

        // Update the last processed log reference
        lastProcessedLength.current = logs.length

        console.log('[useCapturePreview] New log entries:', newEntries.length)

        // Only process if there are actually new lines
        if (newEntries.length === 0) {
            return
        }

        // Check for automation triggers in the new lines
        const combinedNewLogs = newEntries.map(e => e.content).join('\n')
        console.log('[useCapturePreview] Combined new logs includes "Captured":', combinedNewLogs.includes("Captured"))
        console.log('[useCapturePreview] State check - isCapturing:', isCapturing, 'downloadRequested:', downloadRequested.current, 'hasDevice:', !!device)

        // Automation: If waiting for capture and log contains "Captured", trigger download
        if (isCapturing && combinedNewLogs.includes("Captured") && !downloadRequested.current && device) {
            console.log('[useCapturePreview] Capture confirmed, auto-triggering download...')
            downloadRequested.current = true

            const autoEntry = {
                message: 'Capture complete. Requesting file...',
                timestamp: new Date()
            }
            console.log('[useCapturePreview]', autoEntry.message)

            write(device, ['AI txfile .']).catch((error) => {
                console.error('[useCapturePreview] Failed to request image download:', error)
                setIsCapturing(false)
                downloadRequested.current = false

                if (onError) {
                    onError(error)
                } else {
                    Alert.alert('Error', 'Failed to download captured image')
                }
            })
        }
    }, [logs, isCapturing, device, write, onError])

    // Start capture process
    const startCapture = useCallback(async () => {
        if (!device) {
            const error = new Error('No device connected')
            console.error('[useCapturePreview]', error.message)
            if (onError) {
                onError(error)
            } else {
                Alert.alert('Error', 'No device connected')
            }
            return
        }

        console.log('[useCapturePreview] startCapture called, device:', device?.name || 'undefined')

        try {
            setIsCapturing(true)
            setCapturedImageUri(null)
            downloadRequested.current = false

            if (onCaptureStart) {
                console.log('[useCapturePreview] Calling onCaptureStart callback')
                onCaptureStart()
            }

            console.log('[useCapturePreview] Starting capture & download flow')
            // Use the actual capture command from types (AI capture 1 0, not AI capture 1 1)
            await write(device, ['AI capture 1 0'])
            console.log('[useCapturePreview] Capture command sent, waiting for response...')
        } catch (error) {
            const err = error as Error
            console.error('[useCapturePreview] Capture failed:', err)
            setIsCapturing(false)
            downloadRequested.current = false

            if (onError) {
                onError(err)
            } else {
                Alert.alert('Error', 'Failed to capture image')
            }
        }
    }, [device, write, onCaptureStart, onError])

    // Clear captured image
    const clearImage = useCallback(() => {
        setCapturedImageUri(null)
        downloadRequested.current = false
    }, [])

    return {
        capturedImageUri,
        isCapturing,
        startCapture,
        clearImage
    }
}
