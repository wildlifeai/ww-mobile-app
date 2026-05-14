import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
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
    MODEL_PROJECT: 14,
    MODEL_VERSION: 15,
    MODEL_THRESHOLD: 16,
    MD_SENSITIVITY: 17,
    TEST_MODE_BITS: 18,
    IMAGES_COUNT: 19,
    IMAGES_FILE_INDEX: 20,
} as const

/**
 * Factory default values for ALL operational parameters.
 * These match the firmware's behaviour when no MANIFEST folder exists on SD card.
 */
export const FACTORY_DEFAULTS: Record<number, number> = {
    [OP_PARAMETER.SEQUENCE_NUMBER]: 1,
    [OP_PARAMETER.NUM_NN_ANALYSES]: 0,
    [OP_PARAMETER.NUM_POSITIVE_NN_ANALYSES]: 0,
    [OP_PARAMETER.NUM_COLD_BOOTS]: 0,
    [OP_PARAMETER.NUM_WARM_BOOTS]: 0,
    [OP_PARAMETER.NUM_PICTURES]: 1,
    [OP_PARAMETER.PICTURE_INTERVAL]: 500,
    [OP_PARAMETER.TIMELAPSE_INTERVAL]: 0,
    [OP_PARAMETER.INTERVAL_BEFORE_DPD]: 1000,
    [OP_PARAMETER.LED_BRIGHTNESS]: 5,
    [OP_PARAMETER.CAMERA_ENABLED]: 1,
    [OP_PARAMETER.MD_INTERVAL]: 0,
    [OP_PARAMETER.FLASH_DURATION]: 100,
    [OP_PARAMETER.FLASH_LED]: 0,
    [OP_PARAMETER.MODEL_PROJECT]: 0,
    [OP_PARAMETER.MODEL_VERSION]: 0,
    [OP_PARAMETER.MODEL_THRESHOLD]: 18,
    [OP_PARAMETER.MD_SENSITIVITY]: 1,
    [OP_PARAMETER.TEST_MODE_BITS]: 0,
    [OP_PARAMETER.IMAGES_COUNT]: 0,
    [OP_PARAMETER.IMAGES_FILE_INDEX]: 0,
}



/**
 * Device settings interface
 * Only includes user-configurable parameters (5-13)
 */
export interface DeviceSettings {
    numPictures?: number              // Index 5 - Images per trigger (default: 1)
    pictureInterval?: number           // Index 6 - Interval between images in ms (default: 500)
    timelapseInterval?: number         // Index 7 - Timelapse interval in seconds, 0=disabled (default: 0)
    intervalBeforeDpd?: number         // Index 8 - Inactivity timeout in ms (default: 1000)
    ledBrightness?: number             // Index 9 - LED brightness 0-100%, 0=dim (default: 5)
    // Note: OP_PARAMETER.CAMERA_ENABLED (Index 10) is removed. The firmware permanently defaults it to 1.
    motionDetectInterval?: number      // Index 11 - Motion detection interval in ms, 0=disabled (default: 0)
    flashDuration?: number             // Index 12 - Flash duration in ms (default: 100)
    flashLed?: number                  // Index 13 - LED mask: 0=off, 1=visible, 2=IR (default: 0)
}

export interface UseDeviceSettingsOptions {
    device: ExtendedPeripheral | null
    onSettingsUpdated?: () => void
    onError?: (error: Error) => void
}

export interface QuiesceOptions {
    quickMode?: boolean
    isEndDeployment?: boolean
    cachedOps?: string[] | null
    sessionScope?: any
}

export interface UseDeviceSettingsReturn {
    updateSettings: (device: ExtendedPeripheral, settings: Partial<DeviceSettings>) => Promise<void>
    applyPreset: (device: ExtendedPeripheral, preset: 'default' | 'motion-detect' | 'timelapse') => Promise<void>
    quiesceDevice: (device: ExtendedPeripheral, options?: QuiesceOptions) => Promise<void>
    resetToDefaults: (device: ExtendedPeripheral, onProgress?: (step: string, progress: number) => void) => Promise<void>
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
 * await updateSettings({ motionDetectInterval: 2000 })
 * 
 * // Apply a preset configuration
 * await applyPreset('motion-detect')
 * ```
 */
export const useDeviceSettings = (options?: { onSettingsUpdated?: () => void, onError?: (err: Error) => void }): UseDeviceSettingsReturn => {
    const { onSettingsUpdated, onError } = options || {}
    const [isUpdating, setIsUpdating] = useState(false)

    // Safety: Track if component is still mounted to avoid state updates/commands after unmount
    const isMounted = useRef(true)
    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    /**
     * Update multiple operational parameters on the device
     */
    const updateSettings = useCallback(async (device: ExtendedPeripheral, settings: Partial<DeviceSettings>) => {
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

            // Camera is always enabled by firmware.

            const session = createBleSession(device)
            let currentOps: string[] | null = null
            try {
                currentOps = await session.execute(commandRegistry.getops)
            } catch (err) {
                logWarn('[useDeviceSettings] Pre-fetch Ops bulk fetch failed, proceeding blindly', err)
            }

            // Send each update with a small delay to avoid overwhelming the device
            for (const { index, value } of updates) {
                // Safety check before each step
                if (!isMounted.current || !device.connected) {
                    throw new Error('Update cancelled: Device disconnected or component unmounted')
                }

                if (currentOps && currentOps.length > index) {
                    if (currentOps[index] === value.toString()) {
                        log(`[useDeviceSettings] Skipping parameter ${index} (already ${value})`)
                        continue
                    }
                }

                log(`[useDeviceSettings] Setting parameter ${index} to ${value}`)
                await session.execute(() => commandRegistry.setop({ index, value }))
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
    }, [onSettingsUpdated, onError])

    /**
     * Apply a preset configuration
     */
    const applyPreset = useCallback(async (device: ExtendedPeripheral, preset: 'default' | 'motion-detect' | 'timelapse') => {
        log(`[useDeviceSettings] Applying preset: ${preset}`)

        const settings: Partial<DeviceSettings> = {
            numPictures: 3,
            pictureInterval: 1500,
            timelapseInterval: 60,
            ledBrightness: 5,
            // Camera enabled is assumed to always be true by firmware defaults
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

        await updateSettings(device, settings)
    }, [updateSettings])

    /**
     * Safely quiesces the device (stops autonomous capture triggers but keeps camera enabled).
     * 
     * Actions:
     * 1. Clear Motion Detection interval (Op 11 = 0)
     * 2. Clear Timelapse interval (Op 7 = 0)
     * 3. Enable Camera (Op 10 = 1) - Ensures device is ready for commands/preview unless isEndDeployment is true
     * 
     * @param options Quiesce configurations
     */
    const quiesceDevice = useCallback(async (device: ExtendedPeripheral, options?: QuiesceOptions) => {
        const logPrefix = '[DeviceSettings]'
        if (!device || !device.connected) {
            logWarn(`${logPrefix} Skipping quiesce: Device not connected`)
            return
        }

        log(`${logPrefix} Quiescing device (EndDeployment: ${options?.isEndDeployment})...`)
        try {
            if (!isMounted.current || !device.connected) return
            
            // Allow caller to inject existing session context to prevent overlapping flows
            const session = options?.sessionScope || createBleSession(device)
            let currentOps = options?.cachedOps
            
            if (!currentOps) {
                try {
                    currentOps = await session.execute(commandRegistry.getops)
                } catch (err) {
                    logWarn(`${logPrefix} Ops fetch failed, continuing without state`, err)
                }
            }

            // 2. Clear Intervals (Op 11 = 0, Op 7 = 0) - ALWAYS do this
            log(`${logPrefix} 2. Clearing Motion & Timelapse intervals...`)

            try {
                if (!isMounted.current || !device.connected) return
                if (!currentOps || currentOps[OP_PARAMETER.MD_INTERVAL] !== '0') {
                    await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.MD_INTERVAL, value: '0' }))
                }

                if (!isMounted.current || !device.connected) return
                if (!currentOps || currentOps[OP_PARAMETER.TIMELAPSE_INTERVAL] !== '0') {
                    await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.TIMELAPSE_INTERVAL, value: '0' }))
                }
            } catch (err) {
                // If the error is fatal, we stop.
                const errMsg = err instanceof Error ? err.message : String(err)
                if (errMsg.includes('disconnected') || errMsg.includes('found') || errMsg.includes('cleared')) {
                    throw err
                }
                logWarn(`${logPrefix} Failed to clear params:`, err)
            }
            
            if (!isMounted.current || !device.connected) return
            
            // 3. Optional Enable Camera (Op 10 = 1)
            // If optimizing for End Deployment, skip camera enable since we are disconnecting soon
            if (options?.isEndDeployment) {
                log(`${logPrefix} 3. Skipping Camera Enable due to end deployment...`)
            } else {
                log(`${logPrefix} 3. Enabling camera (Op 10=1)...`)
                try {
                    if (!isMounted.current || !device.connected) return
                    
                    if (!currentOps || currentOps[OP_PARAMETER.CAMERA_ENABLED] !== '1') {
                        await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.CAMERA_ENABLED, value: '1' }))
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
                     await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.CAMERA_ENABLED, value: '1' }))
                }
            }
            log(`${logPrefix} Device quiesced successfully.`)
        } catch (error) {
            logError(`${logPrefix} Error quiescing device:`, error)
            throw error
        }
    }, [])

    /**
     * Full factory reset: reads current OPs, writes only those that differ
     * from FACTORY_DEFAULTS, erases any loaded AI model, clears the
     * deployment ID, and zeroes GPS.
     *
     * Each setop/setgps command receives a confirmation response from the
     * firmware, so no verification pass is needed.
     *
     * @param device The connected BLE device
     * @param onProgress Optional callback for progress updates (step description, 0-1 progress)
     */
    const resetToDefaults = useCallback(async (device: ExtendedPeripheral, onProgress?: (step: string, progress: number) => void) => {
        if (!device || !device.connected) {
            throw new Error('Device not connected')
        }

        try {
            setIsUpdating(true)
            const session = createBleSession(device)

            // Step 1: Read current OPs (this also wakes the device from DPD)
            onProgress?.('Reading current parameters...', 0.1)
            log('[ResetDefaults] Reading current operational parameters...')
            let currentOps: string[] | null = null
            try {
                currentOps = await session.execute(commandRegistry.getops)
                log(`[ResetDefaults] Current OPs: ${currentOps?.join(' ')}`)
            } catch (err) {
                logWarn('[ResetDefaults] Could not read current OPs, will write all defaults', err)
            }

            // Step 2: Diff against FACTORY_DEFAULTS — only write what differs
            const opsToWrite: { index: number; value: number }[] = []
            for (const [indexStr, defaultValue] of Object.entries(FACTORY_DEFAULTS)) {
                const index = parseInt(indexStr, 10)

                // 1) Do not reset sequence number if it is higher than 0
                if (index === OP_PARAMETER.SEQUENCE_NUMBER && currentOps && currentOps.length > index) {
                    if (parseInt(currentOps[index], 10) > 0) continue
                }

                // 2) Do not reset tracking parameters and counters
                if (
                    index === OP_PARAMETER.NUM_NN_ANALYSES ||
                    index === OP_PARAMETER.NUM_POSITIVE_NN_ANALYSES ||
                    index === OP_PARAMETER.NUM_COLD_BOOTS ||
                    index === OP_PARAMETER.NUM_WARM_BOOTS ||
                    index === OP_PARAMETER.NUM_PICTURES ||
                    index === OP_PARAMETER.IMAGES_COUNT ||
                    index === OP_PARAMETER.IMAGES_FILE_INDEX
                ) {
                    continue
                }

                if (currentOps && currentOps.length > index && currentOps[index] === defaultValue.toString()) continue
                opsToWrite.push({ index, value: defaultValue })
            }

            // Check if model needs erasing
            const hasModel = !currentOps ||
                (currentOps.length > OP_PARAMETER.MODEL_PROJECT && currentOps[OP_PARAMETER.MODEL_PROJECT] !== '0') ||
                (currentOps.length > OP_PARAMETER.MODEL_VERSION && currentOps[OP_PARAMETER.MODEL_VERSION] !== '0')

            log(`[ResetDefaults] ${opsToWrite.length} OPs need writing, model loaded: ${hasModel}`)

            // Step 3: Erase AI model if one is loaded
            if (hasModel) {
                onProgress?.('Erasing AI model...', 0.2)
                log('[ResetDefaults] Erasing AI model...')
                try {
                    await session.execute(() => commandRegistry.erasemodel())
                    log('[ResetDefaults] AI model erased')
                } catch (err) {
                    logWarn('[ResetDefaults] erasemodel failed (may not have a model loaded):', err)
                }
            }

            // Step 4: Write OPs that differ from defaults
            let opsWritten = 0
            for (const { index, value } of opsToWrite) {
                if (!isMounted.current || !device.connected) {
                    throw new Error('Reset cancelled: Device disconnected or component unmounted')
                }

                log(`[ResetDefaults] Setting OP ${index} = ${value}`)
                await session.execute(() => commandRegistry.setop({ index, value }))
                opsWritten++

                // Progress: 0.3 to 0.7 across all OP writes
                const progress = opsToWrite.length > 0
                    ? 0.3 + (opsWritten / opsToWrite.length) * 0.4
                    : 0.7
                onProgress?.(`Resetting parameter ${index}...`, progress)
            }

            // Step 5: Clear deployment ID
            onProgress?.('Clearing deployment ID...', 0.8)
            log('[ResetDefaults] Clearing deployment ID...')
            await session.execute(() => commandRegistry.setdid(null))

            // Step 6: Zero GPS
            onProgress?.('Zeroing GPS...', 0.9)
            log('[ResetDefaults] Zeroing GPS...')
            await session.execute(() => commandRegistry.setgps('0,0,0'))

            onProgress?.('Reset complete', 1.0)
            log(`[ResetDefaults] Factory reset complete. ${opsWritten} OPs written.`)
        } catch (error) {
            logError('[ResetDefaults] Error during factory reset:', error)
            throw error
        } finally {
            setIsUpdating(false)
        }
    }, [])

    return {
        updateSettings,
        applyPreset,
        quiesceDevice,
        resetToDefaults,
        isUpdating
    }
}
