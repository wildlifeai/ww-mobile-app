import { useCallback } from 'react'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { useBleCommands } from './useBleCommands'
import { OP_PARAMETER } from './useDeviceSettings'
import { log, logError, logWarn } from '../utils/logger'


export interface DeploymentConfig {
    deploymentId: string
    captureMethod: 'activity' | 'timelapse' | 'mixed' | 'unknown'
    motionInterval?: number
    timelapseInterval?: number
    location?: {
        latitude: number
        longitude: number
        altitude: number
    }
    recordGpsInImages?: boolean
}

export const useDeploymentConfiguration = () => {
    const { setDeploymentIdAsString, setGpsLocation, setOperationalParam, getOrFetchOperationalParams } = useBleCommands()

    /**
     * Sets deployment ID on device using the modern single-line approach (AI setdid)
     * 
     * Note: The legacy OP-based approach (writing UUID chunks to OP indices 20-27) 
     * has been removed as firmware no longer supports those parameters.
     */
    const setDeploymentId = useCallback(async (
        device: ExtendedPeripheral,
        deploymentId: string,
        location?: { latitude: number; longitude: number; altitude: number },
        recordGpsInImages?: boolean,
        _cachedOps?: string[] | null
    ): Promise<void> => {
        log('[DeployConfig] Setting deployment ID:', deploymentId)

        await setDeploymentIdAsString(device, deploymentId)
        log('[DeployConfig] Deployment ID set successfully via AI setdid')

        // Always enforce GPS writing based on privacy setting
        if (recordGpsInImages && location) {
            const { latitude, longitude, altitude } = location
            await setGpsLocation(device, latitude, longitude, altitude)
            log('[DeployConfig] Real GPS location set as EXIF fallback')
        } else {
            // Use 0,0,0 if privacy enabled or no location provided
            await setGpsLocation(device, 0, 0, 0)
            log('[DeployConfig] GPS zeroed out (Privacy mode or missing location)')
        }
    }, [setDeploymentIdAsString, setGpsLocation])

    /**
     * Helper to apply updates sequentially
     */
    const applyUpdates = useCallback(async (device: ExtendedPeripheral, updates: { index: number, value: number }[], cachedOps?: string[] | null) => {
        const currentOps = await getOrFetchOperationalParams(device, cachedOps, '[DeployConfig]')

        for (const { index, value } of updates) {
            if (currentOps && currentOps.length > index) {
                if (currentOps[index] === value.toString()) {
                    log(`[DeployConfig] Skipping parameter ${index} (already ${value})`)
                    continue
                }
            }

            log(`[DeployConfig] Setting parameter ${index} to ${value}`)
            await setOperationalParam(device, index, value.toString())
        }
    }, [setOperationalParam, getOrFetchOperationalParams])

    /**
     * Configures capture method settings (motion detection or timelapse)
     */
    const configureCaptureMethod = useCallback(async (
        device: ExtendedPeripheral,
        config: DeploymentConfig,
        cachedOps?: string[] | null
    ): Promise<void> => {
        log('[DeployConfig] Configuring capture method:', config.captureMethod)

        const updates: { index: number, value: number }[] = []

        if (config.captureMethod === 'activity') {
            // Motion detection mode
            log('[DeployConfig] Motion detection mode - interval 1000ms, timeout 30s')
            updates.push({ index: OP_PARAMETER.MD_SENSITIVITY, value: 1 }) // Ensure MD is on (low sensitivity)
            updates.push({ index: OP_PARAMETER.MD_INTERVAL, value: config.motionInterval || 1000 })
            updates.push({ index: OP_PARAMETER.TIMELAPSE_INTERVAL, value: 0 })
            updates.push({ index: OP_PARAMETER.INTERVAL_BEFORE_DPD, value: 1000 })
            updates.push({ index: OP_PARAMETER.CAMERA_ENABLED, value: 1 }) // Enable last
            
        } else if (config.captureMethod === 'timelapse') {
            // Timelapse mode
            const interval = config.timelapseInterval || 300
            log(`[DeployConfig] Timelapse mode - interval ${interval}s, timeout 30s`)
            updates.push({ index: OP_PARAMETER.MD_SENSITIVITY, value: 0 }) // MD off in timelapse-only
            updates.push({ index: OP_PARAMETER.MD_INTERVAL, value: 0 })
            updates.push({ index: OP_PARAMETER.TIMELAPSE_INTERVAL, value: interval })
            updates.push({ index: OP_PARAMETER.INTERVAL_BEFORE_DPD, value: 1000 })
            updates.push({ index: OP_PARAMETER.CAMERA_ENABLED, value: 1 }) // Enable last
        } else if (config.captureMethod === 'mixed') {
             // Mixed mode (Activity + Timelapse)
             const interval = config.timelapseInterval || 300
             log(`[DeployConfig] Mixed mode - Motion 1000ms + Timelapse ${interval}s`)
             updates.push({ index: OP_PARAMETER.MD_SENSITIVITY, value: 1 }) // Ensure MD is on (low sensitivity)
             updates.push({ index: OP_PARAMETER.MD_INTERVAL, value: config.motionInterval || 1000 })
             updates.push({ index: OP_PARAMETER.TIMELAPSE_INTERVAL, value: interval })
             updates.push({ index: OP_PARAMETER.INTERVAL_BEFORE_DPD, value: 1000 })
             updates.push({ index: OP_PARAMETER.CAMERA_ENABLED, value: 1 }) // Enable last
        } else {
            logWarn('[DeployConfig] Unknown capture method:', config.captureMethod)
            return
        }

        await applyUpdates(device, updates, cachedOps)
    }, [applyUpdates])

    /**
     * Complete deployment configuration in one atomic operation
     */
    const configure = useCallback(async (
        device: ExtendedPeripheral,
        config: DeploymentConfig
    ): Promise<void> => {
        log('[DeployConfig] Starting deployment configuration...')

        try {
            // Pre-fetch all ops once for the entire configuration sequence
            const cachedOps = await getOrFetchOperationalParams(device, null, '[DeployConfig] Configuration sequence:')

            // 1. Set deployment ID (with auto-fallback and GPS enforce)
            await setDeploymentId(device, config.deploymentId, config.location, config.recordGpsInImages, cachedOps)

            // 2. Configure capture settings
            await configureCaptureMethod(device, config, cachedOps)

            log('[DeployConfig] Deployment configuration complete')
        } catch (error) {
            logError('[DeployConfig] Configuration failed:', error)
            throw new Error(`Failed to configure deployment: ${error}`)
        }
    }, [setDeploymentId, configureCaptureMethod, getOrFetchOperationalParams])

    return {
        configure,
        setDeploymentId,
        configureCaptureMethod
    }
}
