import { useCallback } from 'react'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
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

    /**
     * Sets deployment ID on device using the modern single-line approach (AI setdid)
     * 
     * Note: The legacy OP-based approach (writing UUID chunks to OP indices 20-27) 
     * has been removed as firmware no longer supports those parameters.
     */
    const setDeploymentId = useCallback(async (
        session: any,
        deploymentId: string,
        location?: { latitude: number; longitude: number; altitude: number },
        recordGpsInImages?: boolean,
        currentOps?: string[]
    ): Promise<void> => {
        log('[DeployConfig] Setting deployment ID:', deploymentId)

        await session.execute(() => commandRegistry.setdid(deploymentId))
        log('[DeployConfig] Deployment ID set successfully via AI setdid')

        // Reset image directory counters so the new deployment starts at IMAGES.000
        // Firmware creates /MEDIA/<id>/IMAGES.<NNN>/ subdirectories but does not
        // auto-reset the index when setdid is called.
        if (!currentOps || currentOps.length <= OP_PARAMETER.IMAGES_FILE_INDEX || currentOps[OP_PARAMETER.IMAGES_FILE_INDEX] !== '0') {
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.IMAGES_FILE_INDEX, value: 0 }))
        } else {
            log('[DeployConfig] Skipping reset of Op 20 (already 0)')
        }

        if (!currentOps || currentOps.length <= OP_PARAMETER.IMAGES_COUNT || currentOps[OP_PARAMETER.IMAGES_COUNT] !== '0') {
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.IMAGES_COUNT, value: 0 }))
        } else {
            log('[DeployConfig] Skipping reset of Op 19 (already 0)')
        }
        
        log('[DeployConfig] Image directory counters handled (Op 19+20)')

        // Always enforce GPS writing based on privacy setting
        if (recordGpsInImages && location) {
            const { latitude, longitude, altitude } = location
            const gpsStr = `${latitude.toFixed(6)},${longitude.toFixed(6)},${altitude.toFixed(1)}`
            await session.execute(() => commandRegistry.setgps(gpsStr))
            log('[DeployConfig] Real GPS location set as EXIF fallback')
        } else {
            // Use 0,0,0 if privacy enabled or no location provided
            await session.execute(() => commandRegistry.setgps('0,0,0'))
            log('[DeployConfig] GPS zeroed out (Privacy mode or missing location)')
        }
    }, [])

    /**
     * Helper to apply updates sequentially
     */
    const applyUpdates = useCallback(async (session: any, updates: { index: number, value: number }[], currentOps: string[]) => {
        for (const { index, value } of updates) {
            if (currentOps && currentOps.length > index) {
                if (currentOps[index] === value.toString()) {
                    log(`[DeployConfig] Skipping parameter ${index} (already ${value})`)
                    continue
                }
            }

            log(`[DeployConfig] Setting parameter ${index} to ${value}`)
            await session.execute(() => commandRegistry.setop({ index, value: value.toString() }))
        }
    }, [])

    /**
     * Configures capture method settings (motion detection or timelapse)
     */
    const configureCaptureMethod = useCallback(async (
        session: any,
        config: DeploymentConfig,
        currentOps: string[]
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

        await applyUpdates(session, updates, currentOps)
    }, [applyUpdates])

    /**
     * Complete deployment configuration in one atomic operation
     */
    const configure = useCallback(async (
        device: ExtendedPeripheral,
        config: DeploymentConfig,
        providedOps?: string[]
    ): Promise<void> => {
        log('[DeployConfig] Starting deployment configuration sequence...')
        const session = createBleSession(device)

        try {
            // Transaction pre-flight: fetch ops
            const currentOps = providedOps || await session.execute(commandRegistry.getops)

            // 1. Set deployment ID (with auto-fallback and GPS enforce)
            await setDeploymentId(session, config.deploymentId, config.location, config.recordGpsInImages, currentOps)

            // 2. Configure capture settings
            await configureCaptureMethod(session, config, currentOps)

            log('[DeployConfig] Deployment configuration complete (Atomic)')
        } catch (error) {
            logError('[DeployConfig] Configuration transaction failed:', error)
            throw new Error(`Failed to configure deployment: ${error}`)
        }
    }, [setDeploymentId, configureCaptureMethod])

    return {
        configure,
        setDeploymentId,
        configureCaptureMethod
    }
}
