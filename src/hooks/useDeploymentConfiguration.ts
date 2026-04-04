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
    const { setDeploymentIdAsOps, setDeploymentIdAsString, setGpsLocation, setOperationalParam, getOrFetchOperationalParams } = useBleCommands()

    /**
     * Sets deployment ID on device with automatic fallback
     * - Tries modern single-line approach first (setdid)
     * - Falls back to OP-based approach (OP20+) for older firmware
     */
    const setDeploymentId = useCallback(async (
        device: ExtendedPeripheral,
        deploymentId: string,
        location?: { latitude: number; longitude: number; altitude: number },
        recordGpsInImages?: boolean,
        cachedOps?: string[] | null
    ): Promise<void> => {
        log('[DeployConfig] Setting deployment ID:', deploymentId)

        let success = false

        try {
            // Write deployment ID directly via single-line command (newest firmware)
            await setDeploymentIdAsString(device, deploymentId)
            log('[DeployConfig] Deployment ID set successfully via single-line command')
            success = true
        } catch (error) {
            logWarn('[DeployConfig] Single-line setdid failed, falling back to OPs:', error)
        }

        if (!success) {
            try {
                // Write deployment ID directly via extended OPs
                // We assume modern firmware supports this; fallback handles failures
                await setDeploymentIdAsOps(device, deploymentId, cachedOps)
                log('[DeployConfig] Deployment ID set successfully via OPs')
            } catch (opsError) {
                // Feature not supported or failed
                logWarn('[DeployConfig] OPs writing failed:', opsError)
            }
        }

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
    }, [setDeploymentIdAsOps, setDeploymentIdAsString, setGpsLocation])

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
            updates.push({ index: OP_PARAMETER.MD_INTERVAL, value: config.motionInterval || 1000 })
            updates.push({ index: OP_PARAMETER.TIMELAPSE_INTERVAL, value: 0 })
            updates.push({ index: OP_PARAMETER.INTERVAL_BEFORE_DPD, value: 1000 })
            updates.push({ index: OP_PARAMETER.CAMERA_ENABLED, value: 1 }) // Enable last
            
        } else if (config.captureMethod === 'timelapse') {
            // Timelapse mode
            const interval = config.timelapseInterval || 300
            log(`[DeployConfig] Timelapse mode - interval ${interval}s, timeout 30s`)
            updates.push({ index: OP_PARAMETER.MD_INTERVAL, value: 0 })
            updates.push({ index: OP_PARAMETER.TIMELAPSE_INTERVAL, value: interval })
            updates.push({ index: OP_PARAMETER.INTERVAL_BEFORE_DPD, value: 1000 })
            updates.push({ index: OP_PARAMETER.CAMERA_ENABLED, value: 1 }) // Enable last
        } else if (config.captureMethod === 'mixed') {
             // Mixed mode (Activity + Timelapse)
             const interval = config.timelapseInterval || 300
             log(`[DeployConfig] Mixed mode - Motion 1000ms + Timelapse ${interval}s`)
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
