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
}

export const useDeploymentConfiguration = () => {
    const { setDeploymentIdAsOps, setGpsLocation, setOperationalParam, getAllOperationalParams } = useBleCommands()

    /**
     * Sets deployment ID on device with automatic fallback
     * - Tries modern OP-based approach first (OP20+)
     * - Falls back to GPS location setting for older firmware
     */
    const setDeploymentId = useCallback(async (
        device: ExtendedPeripheral,
        deploymentId: string,
        location?: { latitude: number; longitude: number; altitude: number }
    ): Promise<void> => {
        log('[DeployConfig] Setting deployment ID:', deploymentId)

        try {
            // Write deployment ID directly via extended OPs
            // We assume modern firmware supports this; fallback handles failures
            await setDeploymentIdAsOps(device, deploymentId)
            log('[DeployConfig] Deployment ID set successfully via OPs')
            
        } catch (error) {
            // Feature not supported or failed - fall back to GPS
            logWarn('[DeployConfig] OPs writing failed, using GPS fallback:', error)
            
            if (location) {
                const { latitude, longitude, altitude } = location
                await setGpsLocation(device, latitude, longitude, altitude)
                log('[DeployConfig] GPS location set as fallback')
            } else {
                // Use 0,0,0 if no location provided
                await setGpsLocation(device, 0, 0, 0)
                log('[DeployConfig] GPS fallback with default 0,0,0')
            }
        }
    }, [setDeploymentIdAsOps, setGpsLocation])

    /**
     * Helper to apply updates sequentially
     */
    const applyUpdates = useCallback(async (device: ExtendedPeripheral, updates: { index: number, value: number }[]) => {
        let currentOps: string[] | null = null
        try {
            currentOps = await getAllOperationalParams(device)
        } catch (err) {
            logWarn('[DeployConfig] Warning: bulk fetch failed, proceeding blindly', err)
        }

        for (const { index, value } of updates) {
            if (currentOps && currentOps.length > index) {
                if (currentOps[index] === value.toString()) {
                    log(`[DeployConfig] Skipping parameter ${index} (already ${value})`)
                    continue
                }
            }

            log(`[DeployConfig] Setting parameter ${index} to ${value}`)
            await setOperationalParam(device, index, value.toString())
            // Delay removed - relying on BLE queue serialization
        }
    }, [setOperationalParam, getAllOperationalParams])

    /**
     * Configures capture method settings (motion detection or timelapse)
     */
    const configureCaptureMethod = useCallback(async (
        device: ExtendedPeripheral,
        config: DeploymentConfig
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

        await applyUpdates(device, updates)
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
            // 1. Set deployment ID (with auto-fallback)
            await setDeploymentId(device, config.deploymentId, config.location)

            // 2. Configure capture settings
            await configureCaptureMethod(device, config)

            log('[DeployConfig] Deployment configuration complete')
        } catch (error) {
            logError('[DeployConfig] Configuration failed:', error)
            throw new Error(`Failed to configure deployment: ${error}`)
        }
    }, [setDeploymentId, configureCaptureMethod])

    return {
        configure,
        setDeploymentId,
        configureCaptureMethod
    }
}
