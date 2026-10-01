import { useCallback } from 'react'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { createBleSession } from '../ble/session/createBleSession'
import { mdIntervalHold } from '../ble/session/mdIntervalHold'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import { OP_PARAMETER } from './useDeviceSettings'
import { log, logError, logWarn } from '../utils/logger'
import { describeProjectFlash, ProjectFlashColumns, resolveProjectFlashOps } from '../utils/projectFlash'
import { DEPLOYMENT_INTERVAL_BEFORE_DPD_MS, ProjectBurstColumns, resolveProjectBurstOps } from '../utils/projectBurst'
import { describeDetectionThreshold, ProjectDetectionThresholdColumns, resolveModelThresholdOp } from '../utils/projectDetectionThreshold'
import { formatGPSString } from '../utils/gpsUtils'
import { keepAwake } from '../ble/session/keepAwake'


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
    /**
     * op17 for the activity and mixed methods, from the project's
     * sensitivity via `mdSensitivityLevel`. Omitted means medium (2), the
     * database default. Timelapse writes 0 whatever this says.
     */
    mdSensitivity?: 1 | 2 | 3
    /**
     * The project's capture flash columns. Omitted leaves op13/op34 to op36
     * alone, which after a reset means no flash and no night IR - only the dev
     * deployment screen, which has no project of its own, should do that.
     */
    flash?: ProjectFlashColumns
    /**
     * The project's pictures per trigger and their interval, written as op5
     * and op6, with op8 raised to outlast the interval when there is more than
     * one capture. Omitted leaves op5 and op6 alone and op8 at 1000: the dev
     * deployment screen writes its own op5 and has no project interval.
     */
    burst?: ProjectBurstColumns
    /** The raw BMP is recorded alongside each JPEG, so op5 is doubled (#317). */
    recordRawBmp?: boolean
    /**
     * The project's detection threshold, written as op16 (#342). Omitted
     * leaves op16 at the reset's factory 18, which is 57%, the column default.
     */
    detectionThreshold?: ProjectDetectionThresholdColumns
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

        // Always enforce GPS writing based on privacy setting. formatGPSString
        // owns the wire format: the firmware splits on spaces and needs six
        // fields, so the decimal "lat,lon,alt" sent here before was one token,
        // silently discarded, and privacy mode never cleared anything (#315).
        if (recordGpsInImages && location) {
            const { latitude, longitude, altitude } = location
            await session.execute(() => commandRegistry.setgps(formatGPSString(latitude, longitude, altitude)))
            log('[DeployConfig] Real GPS location set as EXIF fallback')
        } else {
            // Zeroes if privacy enabled or no location provided
            await session.execute(() => commandRegistry.setgps(formatGPSString(0, 0, 0)))
            log('[DeployConfig] GPS zeroed out (Privacy mode or missing location)')
        }
    }, [])

    /**
     * Helper to apply updates sequentially. Each write is recorded in
     * `currentOps`, so a later step that writes the same parameter compares
     * against what this one left: op8 is written by the capture method and
     * then, for a burst, again by configureBurst.
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
            if (currentOps && currentOps.length > index) currentOps[index] = value.toString()
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
        // The project's sensitivity, not a constant: every deployment used to
        // run at 1 whatever the project said (#316).
        const sensitivity = config.mdSensitivity ?? 2

        if (config.captureMethod === 'activity') {
            // Motion detection mode
            log(`[DeployConfig] Motion detection mode - interval 1000ms, sensitivity ${sensitivity}`)
            updates.push({ index: OP_PARAMETER.MD_SENSITIVITY, value: sensitivity })
            updates.push({ index: OP_PARAMETER.MD_INTERVAL, value: config.motionInterval || 1000 })
            updates.push({ index: OP_PARAMETER.TIMELAPSE_INTERVAL, value: 0 })
            updates.push({ index: OP_PARAMETER.INTERVAL_BEFORE_DPD, value: DEPLOYMENT_INTERVAL_BEFORE_DPD_MS })
            updates.push({ index: OP_PARAMETER.CAMERA_ENABLED, value: 1 }) // Enable last
            
        } else if (config.captureMethod === 'timelapse') {
            // Timelapse mode
            const interval = config.timelapseInterval || 300
            log(`[DeployConfig] Timelapse mode - interval ${interval}s, timeout 30s`)
            updates.push({ index: OP_PARAMETER.MD_SENSITIVITY, value: 0 }) // MD off in timelapse-only
            updates.push({ index: OP_PARAMETER.MD_INTERVAL, value: 0 })
            updates.push({ index: OP_PARAMETER.TIMELAPSE_INTERVAL, value: interval })
            updates.push({ index: OP_PARAMETER.INTERVAL_BEFORE_DPD, value: DEPLOYMENT_INTERVAL_BEFORE_DPD_MS })
            updates.push({ index: OP_PARAMETER.CAMERA_ENABLED, value: 1 }) // Enable last
        } else if (config.captureMethod === 'mixed') {
             // Mixed mode (Activity + Timelapse)
             const interval = config.timelapseInterval || 300
             log(`[DeployConfig] Mixed mode - Motion 1000ms, sensitivity ${sensitivity} + Timelapse ${interval}s`)
             updates.push({ index: OP_PARAMETER.MD_SENSITIVITY, value: sensitivity })
             updates.push({ index: OP_PARAMETER.MD_INTERVAL, value: config.motionInterval || 1000 })
             updates.push({ index: OP_PARAMETER.TIMELAPSE_INTERVAL, value: interval })
             updates.push({ index: OP_PARAMETER.INTERVAL_BEFORE_DPD, value: DEPLOYMENT_INTERVAL_BEFORE_DPD_MS })
             updates.push({ index: OP_PARAMETER.CAMERA_ENABLED, value: 1 }) // Enable last
        } else {
            logWarn('[DeployConfig] Unknown capture method:', config.captureMethod)
            return
        }

        await applyUpdates(session, updates, currentOps)
    }, [applyUpdates])

    /**
     * Writes the project's capture flash to the device: op34 FLASH_MODE, op13
     * FLASH_LED and, in time-of-day mode, op35/op36 for the window.
     *
     * The reset before this leaves op13 = 0 and op34 = 0, so without this step
     * a deployment captures unlit and, because the firmware's
     * `ledFlashIsActive()` also gates the STROBE-driven IR for motion frames,
     * sees nothing at night (#282). op21/op22 (which LED and how bright those
     * motion frames are) keep their factory defaults; this only decides
     * whether the gate in front of them is open.
     */
    const configureFlash = useCallback(async (
        session: any,
        flash: ProjectFlashColumns,
        currentOps: string[]
    ): Promise<void> => {
        const { mode, led, windowStart, windowMinutes } = resolveProjectFlashOps(flash)
        log(`[DeployConfig] Configuring capture flash: ${describeProjectFlash(flash)}`)

        const updates: { index: number, value: number }[] = [
            { index: OP_PARAMETER.FLASH_LED, value: led },
            { index: OP_PARAMETER.FLASH_MODE, value: mode },
            { index: OP_PARAMETER.FLASH_TOD_START, value: windowStart },
            { index: OP_PARAMETER.FLASH_TOD_DURATION, value: windowMinutes },
        ]

        // Firmware older than ae_review has no op34 to op36: the setop would
        // bounce off its bounds check. op13 alone still chooses the LED there,
        // and the light verdict in op25 plays the part of the mode.
        const supportsFlashMode = currentOps.length > OP_PARAMETER.FLASH_TOD_DURATION
        if (!supportsFlashMode) {
            logWarn(`[DeployConfig] Firmware reports ${currentOps.length} parameters — writing op13 only, no flash mode`)
        }

        await applyUpdates(
            session,
            supportsFlashMode ? updates : updates.slice(0, 1),
            currentOps
        )
    }, [applyUpdates])

    /**
     * Writes the project's burst to the device: op5 NUM_PICTURES, op6
     * PICTURE_INTERVAL and op8 INTERVAL_BEFORE_DPD, for motion and timelapse
     * alike (#317).
     *
     * The reset before this preserves op5, so without the write a device keeps
     * whatever count the card held, and it sets op6 to the factory 500 ms.
     * With the raw BMP recorded, op5 is twice the project value, because the
     * firmware alternates JPEG and BMP through the same count.
     *
     * op8 is the interval plus a second when there is a next capture to wait
     * for: the firmware sleeps mid-burst once op8 has run out (Seeed #208).
     * This runs after the capture method, so its op8 is the one that stays.
     */
    const configureBurst = useCallback(async (
        session: any,
        burst: ProjectBurstColumns,
        currentOps: string[],
        recordRawBmp = false
    ): Promise<void> => {
        const { numPictures, pictureIntervalMs, intervalBeforeDpdMs } = resolveProjectBurstOps(burst, recordRawBmp)
        log(`[DeployConfig] Configuring burst: op5 ${numPictures}${recordRawBmp ? ' (JPEG + BMP)' : ''}, op6 ${pictureIntervalMs} ms, op8 ${intervalBeforeDpdMs} ms`)

        await applyUpdates(session, [
            { index: OP_PARAMETER.NUM_PICTURES, value: numPictures },
            { index: OP_PARAMETER.PICTURE_INTERVAL, value: pictureIntervalMs },
            { index: OP_PARAMETER.INTERVAL_BEFORE_DPD, value: intervalBeforeDpdMs },
        ], currentOps)
    }, [applyUpdates])

    /**
     * Writes the project's detection threshold to the device as op16
     * MODEL_THRESHOLD, ceil(pct * 2.56) - 128 (#342).
     *
     * The reset before this sets op16 to the factory 18, which is 57%, the
     * column default, so a project on the default writes nothing here. Only a
     * model on the device reads op16; it is written whatever the model, since
     * with none the value is never read.
     */
    const configureDetectionThreshold = useCallback(async (
        session: any,
        threshold: ProjectDetectionThresholdColumns,
        currentOps: string[]
    ): Promise<void> => {
        log(`[DeployConfig] ${describeDetectionThreshold(threshold)}`)

        await applyUpdates(session, [
            { index: OP_PARAMETER.MODEL_THRESHOLD, value: resolveModelThresholdOp(threshold) },
        ], currentOps)
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
            // op11 is the deployment's from here. A motion test holds it at the
            // same 1000 ms this writes, so an op11 restore a dropped test left
            // owed could not tell the two apart and would later put a deployed
            // camera back to 0, and a Start Monitoring card test still running
            // would restore over this write when it ends (#274).
            await mdIntervalHold.forget(device.id)

            // Transaction pre-flight: fetch ops. A copy, because the steps
            // below record their writes in it and the caller's table is theirs.
            const currentOps: string[] = [...(providedOps || await session.execute(commandRegistry.getops))]

            // From here the deployment owns op8 (the capture method writes it,
            // and a burst raises it). A keepAwake hold or owed restore from
            // before must not put an earlier value back over it (#317).
            await keepAwake.forget(device.id)

            // 1. Set deployment ID (with auto-fallback and GPS enforce)
            await setDeploymentId(session, config.deploymentId, config.location, config.recordGpsInImages, currentOps)

            // 2. Configure capture settings
            await configureCaptureMethod(session, config, currentOps)

            // 3. Capture flash from the project, when the caller has one
            if (config.flash) {
                await configureFlash(session, config.flash, currentOps)
            }

            // 4. Pictures per trigger, their interval and the op8 that
            // outlasts it, likewise. Last of the op8 writers on purpose.
            if (config.burst) {
                await configureBurst(session, config.burst, currentOps, config.recordRawBmp)
            }

            // 5. The detection threshold (op16), likewise
            if (config.detectionThreshold) {
                await configureDetectionThreshold(session, config.detectionThreshold, currentOps)
            }

            log('[DeployConfig] Deployment configuration complete (Atomic)')
        } catch (error) {
            logError('[DeployConfig] Configuration transaction failed:', error)
            throw new Error(`Failed to configure deployment: ${error}`)
        }
    }, [setDeploymentId, configureCaptureMethod, configureFlash, configureBurst, configureDetectionThreshold])

    return {
        configure,
        setDeploymentId,
        configureCaptureMethod,
        configureFlash,
        configureBurst,
        configureDetectionThreshold
    }
}
