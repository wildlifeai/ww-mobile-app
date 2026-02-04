import { useCallback, useState } from 'react'
import { Alert } from 'react-native'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { useBleCommands } from './useBleCommands'
import { log, logError } from '../utils/logger'


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
 * Delays for quiesceDevice sequence (in ms)
 */
const QUIESCE_DELAYS = {
    CAMERA_ENABLE: 500,
    PARAM_CLEAR: 200,
    BUS_STABILIZATION: 1500,
    CAMERA_DISABLE: 500,
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
    const { setOperationalParam } = useBleCommands()

    /**
     * Update multiple operational parameters on the device
     */
    const updateSettings = useCallback(async (settings: Partial<DeviceSettings>) => {
        if (!device) {
            const error = new Error('No device connected')
            if (onError) {
                onError(error)
            } else {
                Alert.alert('Error', 'No device connected')
            }
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
                log(`[useDeviceSettings] Setting parameter ${index} to ${value}`)
                await setOperationalParam(device, index, value.toString())
                // Small delay between commands (Increased to 500ms for robust DPD wake/sleep handling)
                await new Promise(resolve => setTimeout(resolve, 500))
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
     * Safely quiesces the device (stops all capture activities).
     * Enforces the sequence: Enable Camera -> Clear Intervals -> Disable Camera.
     * This ensures the firmware accepts the "Stop" commands even if the camera was previously disabled.
     */
    /**
     * Safely quiesces the device (stops all capture activities).
     * 
     * @param logPrefix Custom prefix for logs
     * @param optimized If true, skips the "Enable -> Clear -> Disable" sequence and just disables.
     *                  Use ONLY when fast stop is required (e.g. End Deployment).
     *                  Use FALSE for Preparation to ensure clean slate.
     */
    const quiesceDevice = useCallback(async (logPrefix: string = '[DeviceSettings]', optimized: boolean = false) => {
        if (!device) return

        log(`${logPrefix} Quiescing device (Optimized: ${optimized})...`)
        try {
            if (!optimized) {
                // 1. Enable Camera to unlock parameters (Op 10 = 1)
                log(`${logPrefix} 1. Enabling camera to allow interval writes...`)
                await setOperationalParam(device, OP_PARAMETER.CAMERA_ENABLED, '1')
                await new Promise(r => setTimeout(r, QUIESCE_DELAYS.CAMERA_ENABLE))
            } else {
                log(`${logPrefix} Skipped camera enable step (Optimized Mode)`)
            }

            // 2. Clear Intervals (Op 11 = 0, Op 7 = 0) - ALWAYS do this
            log(`${logPrefix} 2. Clearing Motion & Timelapse intervals...`)
            await setOperationalParam(device, OP_PARAMETER.MD_INTERVAL, '0')
            await new Promise(r => setTimeout(r, QUIESCE_DELAYS.PARAM_CLEAR)) 
            await setOperationalParam(device, OP_PARAMETER.TIMELAPSE_INTERVAL, '0')
            
            // BUS SAFETY: Wait for potential "Stats" message from Himax
            log(`${logPrefix} Waiting ${QUIESCE_DELAYS.BUS_STABILIZATION}ms for bus stabilization...`)
            await new Promise(r => setTimeout(r, QUIESCE_DELAYS.BUS_STABILIZATION))

            // 3. Disable Camera (Op 10 = 0)
            log(`${logPrefix} 3. Disabling camera...`)
            await setOperationalParam(device, OP_PARAMETER.CAMERA_ENABLED, '0')
            await new Promise(r => setTimeout(r, QUIESCE_DELAYS.CAMERA_DISABLE))

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
