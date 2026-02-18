import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { useBleCommands } from './useBleCommands'
import { log, logError, logWarn } from '../utils/logger'


/**
 * Operational Parameter Indices
 * Maps friendly names to CONFIG.TXT parameter indices
 */
export const OP_PARAMETER = {
    SEQUENCE_NUMBER: 0,
    NUM_NN_ANALYSES: 1,
    NUM_POSITIVE_NN_ANALYSES: 2,
    NUM_COLD_BOOTS: 3,
    NUM_WARM_BOOTS: 4,
    NUM_PICTURES: 5,
    PICTURE_INTERVAL: 6,
    TIMELAPSE_INTERVAL: 7,
    INTERVAL_BEFORE_DPD: 8,
    LED_BRIGHTNESS: 9,
    CAMERA_ENABLED: 10,
    MD_INTERVAL: 11,
    FLASH_DURATION: 12,
    FLASH_LED: 13,
} as const



/**
 * Device settings interface
 * Only includes user-configurable parameters (5-13)
 */
export interface DeviceSettings {
    numPictures?: number              // Index 5 - Images per trigger (default: 3)
    pictureInterval?: number           // Index 6 - Interval between images in ms (default: 1500)
    timelapseInterval?: number         // Index 7 - Timelapse interval in seconds, 0=disabled (default: 60)
    intervalBeforeDpd?: number         // Index 8 - Inactivity timeout in ms (default: 1000)
    ledBrightness?: number             // Index 9 - LED brightness 0-100%, 0=off (default: 5)
    cameraEnabled?: boolean            // Index 10 - 0=disabled, 1=enabled (default: 1)
    motionDetectInterval?: number      // Index 11 - Motion detection interval in ms, 0=disabled (default: 1000)
    flashDuration?: number             // Index 12 - Flash duration in ms (default: 100)
    flashLed?: number                  // Index 13 - LED mask: 0=off, 1=visible, 2=IR (default: 0)
}

export interface UseDeviceSettingsOptions {
    device: ExtendedPeripheral | null
    onSettingsUpdated?: () => void
    onError?: (error: Error) => void
}

export interface UseDeviceSettingsReturn {
    updateSettings: (settings: Partial<DeviceSettings>) => Promise<void>
    applyPreset: (preset: 'default' | 'motion-detect' | 'timelapse') => Promise<void>
    quiesceDevice: (logPrefix?: string, optimized?: boolean) => Promise<void>
    isUpdating: boolean
}

/**
 * Hook for managing device operational parameters stored in CONFIG.TXT on SD card
 * 
 * @example
 * ```tsx
 * const { updateSettings, applyPreset, isUpdating } = useDeviceSettings({
 *     device: bleDevice,
 *     onSettingsUpdated: () => log('Settings updated!'),
 *     onError: (err) => Alert.alert('Error', err.message)
 * })
 * 
 * // Update individual settings
 * await updateSettings({ cameraEnabled: false, motionDetectInterval: 2000 })
 * 
 * // Apply a preset configuration
 * await applyPreset('motion-detect')
 * ```
 */
export const useDeviceSettings = ({
    device,
    onSettingsUpdated,
    onError
}: UseDeviceSettingsOptions): UseDeviceSettingsReturn => {
    const [isUpdating, setIsUpdating] = useState(false)
    const { setOperationalParam, getOperationalParam } = useBleCommands()

    // Safety: Track if component is still mounted to avoid state updates/commands after unmount
    const isMounted = useRef(true)
    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    /**
     * Update multiple operational parameters on the device
     */
    const updateSettings = useCallback(async (settings: Partial<DeviceSettings>) => {
        if (!device || !device.connected) {
            const error = new Error('No device connected')
            if (onError) onError(error)
            return
        }

        try {
            setIsUpdating(true)
            log('[useDeviceSettings] Updating settings:', settings)

            // Map settings to parameter index/value pairs
            const updates: Array<{ index: number; value: number }> = []

            if (settings.numPictures !== undefined) {
                updates.push({ index: OP_PARAMETER.NUM_PICTURES, value: settings.numPictures })
            }
            if (settings.pictureInterval !== undefined) {
                updates.push({ index: OP_PARAMETER.PICTURE_INTERVAL, value: settings.pictureInterval })
            }
            if (settings.timelapseInterval !== undefined) {
                updates.push({ index: OP_PARAMETER.TIMELAPSE_INTERVAL, value: settings.timelapseInterval })
            }
            if (settings.intervalBeforeDpd !== undefined) {
                updates.push({ index: OP_PARAMETER.INTERVAL_BEFORE_DPD, value: settings.intervalBeforeDpd })
            }
            if (settings.ledBrightness !== undefined) {
                updates.push({ index: OP_PARAMETER.LED_BRIGHTNESS, value: settings.ledBrightness })
            }
            if (settings.motionDetectInterval !== undefined) {
                updates.push({ index: OP_PARAMETER.MD_INTERVAL, value: settings.motionDetectInterval })
            }
            if (settings.flashDuration !== undefined) {
                updates.push({ index: OP_PARAMETER.FLASH_DURATION, value: settings.flashDuration })
            }
            if (settings.flashLed !== undefined) {
                updates.push({ index: OP_PARAMETER.FLASH_LED, value: settings.flashLed })
            }

            // ALWAYS set Camera Enabled LAST to ensure it picks up the intervals set above
            if (settings.cameraEnabled !== undefined) {
                updates.push({ index: OP_PARAMETER.CAMERA_ENABLED, value: settings.cameraEnabled ? 1 : 0 })
            }

            // Send each update with a small delay to avoid overwhelming the device
            for (const { index, value } of updates) {
                // Safety check before each step
                if (!isMounted.current || !device.connected) {
                    throw new Error('Update cancelled: Device disconnected or component unmounted')
                }

                log(`[useDeviceSettings] Setting parameter ${index} to ${value}`)
                await setOperationalParam(device, index, value.toString())
            }

            log('[useDeviceSettings] All settings updated successfully')
            if (onSettingsUpdated) {
                onSettingsUpdated()
            }
        } catch (error) {
            logError('[useDeviceSettings] Error updating settings:', error)
            const err = error instanceof Error ? error : new Error('Failed to update settings')
            if (onError) {
                onError(err)
            } else {
                Alert.alert('Error', 'Failed to update device settings')
            }
        } finally {
            setIsUpdating(false)
        }
    }, [device, setOperationalParam, onSettingsUpdated, onError])

    /**
     * Apply a preset configuration
     */
    const applyPreset = useCallback(async (preset: 'default' | 'motion-detect' | 'timelapse') => {
        log(`[useDeviceSettings] Applying preset: ${preset}`)

        const settings: Partial<DeviceSettings> = {
            numPictures: 3,
            pictureInterval: 1500,
            timelapseInterval: 60,
            ledBrightness: 5,
            cameraEnabled: true,
            motionDetectInterval: 1000,
            flashDuration: 100,
            flashLed: 0
        }

        if (preset === 'motion-detect') {
            Object.assign(settings, {
                timelapseInterval: 0,
                pictureInterval: 500
            })
        } else if (preset === 'timelapse') {
            Object.assign(settings, {
                motionDetectInterval: 0,
                timelapseInterval: 900,
                numPictures: 1,
                pictureInterval: 0
            })
        }

        await updateSettings(settings)
    }, [updateSettings])

    /**
     * Safely quiesces the device (stops autonomous capture triggers but keeps camera enabled).
     * 
     * Actions:
     * 1. Clear Motion Detection interval (Op 11 = 0)
     * 2. Clear Timelapse interval (Op 7 = 0)
     * 3. Enable Camera (Op 10 = 1) - Ensures device is ready for commands/preview
     * 
     * @param logPrefix Custom prefix for logs
     * @param optimized Legacy parameter (unused in current logic)
     */
    const quiesceDevice = useCallback(async (logPrefix: string = '[DeviceSettings]', optimized: boolean = false) => {
        if (!device || !device.connected) {
            logWarn(`${logPrefix} Skipping quiesce: Device not connected`)
            return
        }

        log(`${logPrefix} Quiescing device (Optimized: ${optimized})...`)
        try {
            // Note: Camera Enable (Op 10=1) was previously forced here but removed 
            // to avoid needing to unlock parameters if they are already correct.


            // 2. Clear Intervals (Op 11 = 0, Op 7 = 0) - ALWAYS do this
            log(`${logPrefix} 2. Clearing Motion & Timelapse intervals...`)

            try {
                if (!isMounted.current || !device.connected) return
                await setOperationalParam(device, OP_PARAMETER.MD_INTERVAL, '0')

                if (!isMounted.current || !device.connected) return
                await setOperationalParam(device, OP_PARAMETER.TIMELAPSE_INTERVAL, '0')
            } catch (err) {
                // If the error is fatal, we stop.
                const errMsg = err instanceof Error ? err.message : String(err)
                if (errMsg.includes('disconnected') || errMsg.includes('found') || errMsg.includes('cleared')) {
                    throw err
                }
                logWarn(`${logPrefix} Failed to clear params:`, err)
            }
            
            if (!isMounted.current || !device.connected) return
            
            if (!isMounted.current || !device.connected) return
            
            // 3. Enable Camera (Op 10 = 1)
            // We want the camera ON for previews/testing, but triggers OFF (steps above)
            log(`${logPrefix} 3. Enabling camera (Op 10=1)...`)
            try {
                if (!isMounted.current || !device.connected) return
                const currentCam = await getOperationalParam(device, OP_PARAMETER.CAMERA_ENABLED)
                
                if (!isMounted.current || !device.connected) return
                if (currentCam !== '1') {
                    await setOperationalParam(device, OP_PARAMETER.CAMERA_ENABLED, '1')
                } else {
                    log(`${logPrefix} Camera already enabled (Op 10=1), skipping write.`)
                }
            } catch (err) {
                 const errMsg = err instanceof Error ? err.message : String(err)
                 if (errMsg.includes('disconnected') || errMsg.includes('found') || errMsg.includes('cleared')) {
                     throw err
                 }

                 logWarn(`${logPrefix} Check failed, forcing enable...`)
                 if (!isMounted.current || !device.connected) return
                 await setOperationalParam(device, OP_PARAMETER.CAMERA_ENABLED, '1')
            }
            log(`${logPrefix} Device quiesced successfully.`)
        } catch (error) {
            logError(`${logPrefix} Error quiescing device:`, error)
            throw error
        }
    }, [device, setOperationalParam])

    return {
        updateSettings,
        applyPreset,
        quiesceDevice,
        isUpdating
    }
}
