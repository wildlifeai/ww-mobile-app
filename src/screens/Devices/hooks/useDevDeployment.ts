/**
 * useDevDeployment — Developer deployment hook
 *
 * Simplified version of useStartDeployment for the Engineer Console.
 * Key differences:
 * - Accepts explicit flash params (flashLed, ledBrightness)
 * - Allows capture method override (not locked to project)
 * - Persists project setting changes to DB
 * - Sends flash OPs after standard configure()
 * - Skips firmware update warnings
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Alert } from 'react-native'
import { useAppSelector } from '../../../redux'
import { DeploymentService } from '../../../services/DeploymentService'
import ProjectService from '../../../services/ProjectService'
import ReferenceDataService from '../../../services/ReferenceDataService'
import Device from '../../../database/models/Device'
import { DeviceService } from '../../../services/DeviceService'
import { useBleSession } from '../../../hooks/useBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import { useBleActions } from '../../../providers/BleEngineProvider'
import { useDeploymentConfiguration } from '../../../hooks/useDeploymentConfiguration'
import { useBle } from '../../../hooks/useBle'
import { useGPSLocation } from '../../../hooks/useGPSLocation'
import { useDeviceSettings, OP_PARAMETER } from '../../../hooks/useDeviceSettings'
import { createBleSession } from '../../../ble/session/createBleSession'
import { useDeploymentProgress } from '../../../hooks/useDeploymentProgress'
import { useMonitoringActions } from '../../../hooks/useMonitoringActions'
import * as pipeline from '../../../ble/workflows/deploymentPipeline'

import { log, logError, logWarn } from '../../../utils/logger'
import { selectCurrentOrganisation } from '../../../redux/slices/authSlice'
import { ProjectWithDetails } from '../../../types/project'

export interface FlashParams {
    flashLed: number      // 0=Off, 1=Visible, 2=IR
    ledBrightness: number // 0-100%
}

interface UseDevDeploymentParams {
    deviceId?: string
    bleDeviceId?: string
    navigation: any
}

export const useDevDeployment = ({
    deviceId,
    bleDeviceId,
    navigation,
}: UseDevDeploymentParams) => {
    // Selectors
    const devices = useAppSelector(state => state.devices)
    const bleDevice = devices[bleDeviceId || '']
    const user = useAppSelector(state => state.authentication.user)
    const currentOrganisation = useAppSelector(selectCurrentOrganisation)

    // BLE Hooks
    const { disconnectDevice } = useBle()
    const { quiesceDevice } = useDeviceSettings()
    const bleSession = useBleSession(bleDevice)
    const { configure: startConfigure } = useDeploymentConfiguration()
    useBleActions()

    // GPS
    const { location: gpsLocation } = useGPSLocation()

    // Device health
    const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
    const [sdCardStatus, setSdCardStatus] = useState<{ total: number; free: number } | null>(null)

    // Form state
    const [notes, setNotes] = useState('')
    const [locationName, setLocationName] = useState('')
    const [cameraHeight, setCameraHeight] = useState('')

    // Flash params
    const [flashParams, setFlashParams] = useState<FlashParams>({
        flashLed: 0,
        ledBrightness: 5,
    })

    // Project state
    const [project, setProject] = useState<ProjectWithDetails | null>(null)
    const [availableProjects, setAvailableProjects] = useState<ProjectWithDetails[]>([])
    const [captureMethodOverride, setCaptureMethodOverride] = useState<number | null>(null)
    const [timelapseIntervalOverride, setTimelapseIntervalOverride] = useState<number | null>(null)

    // New overridable project fields
    const [motionSensitivityOverride, setMotionSensitivityOverride] = useState<number | null>(null)
    const [aiModelIdOverride, setAiModelIdOverride] = useState<string | null>(null)
    const [lorawanOverride, setLorawanOverride] = useState(false)
    const [recordGpsOverride, setRecordGpsOverride] = useState(false)

    // Reference data
    const [sensitivityOptions, setSensitivityOptions] = useState<Array<{ id: number; value: string; description: string }>>([])
    const [aiModelOptions, setAiModelOptions] = useState<Array<{ id: string; name: string; version: string }>>([])

    // Submission
    const [submitting, setSubmitting] = useState(false)
    const [device, setDevice] = useState<Device | undefined>()

    const isNavigatingAway = useRef(false)
    const isStartDeploymentInProgress = useRef(false)
    const deploymentIdRef = useRef<string | null>(null)

    // Shared progress dialog
    const progress = useDeploymentProgress()

    // Shared monitoring actions
    const monitoring = useMonitoringActions({
        bleDevice,
        disconnectDevice,
        quiesceDevice,
        userId: user?.id,
        navigation,
        deploymentIdRef,
        isNavigatingAway,
        progress,
    })

    // Effective values (override > project)
    const effectiveCaptureMethod = captureMethodOverride ?? project?.capture_method_id ?? 1
    const effectiveTimelapseInterval = timelapseIntervalOverride ?? project?.timelapse_interval_seconds ?? 300

    // --- Load device from DB ---
    useEffect(() => {
        if (!deviceId) return
        DeviceService.getDeviceByBluetoothId(deviceId).then(d => {
            if (d) setDevice(d)
        }).catch(e => logWarn('[DevDeploy] Device lookup failed:', e))
    }, [deviceId])

    // --- Load projects ---
    useEffect(() => {
        const loadProjects = async () => {
            if (!user?.id || !currentOrganisation?.id) return
            try {
                const projects = await ProjectService.getProjectsForUserInOrganisation(
                    user.id, currentOrganisation.id
                )
                setAvailableProjects(projects)
                if (projects.length > 0 && !project) {
                    setProject(projects[0])
                    setCaptureMethodOverride(projects[0].capture_method_id)
                    setTimelapseIntervalOverride(projects[0].timelapse_interval_seconds)
                    setMotionSensitivityOverride(projects[0].activity_detection_sensitivity_id ?? null)
                    setAiModelIdOverride(projects[0].model_id ?? null)
                    setLorawanOverride(projects[0].lorawan_required ?? false)
                    setRecordGpsOverride(projects[0].record_gps_in_images ?? false)
                }
            } catch (e) {
                logError('[DevDeploy] Failed to load projects:', e)
            }
        }
        loadProjects()
    }, [user?.id, currentOrganisation?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    // --- Load reference data (sensitivities + AI models) ---
    useEffect(() => {
        const loadRefData = async () => {
            try {
                const [sens, models] = await Promise.all([
                    ReferenceDataService.getActivitySensitivity(),
                    ReferenceDataService.getAiModels(),
                ])
                setSensitivityOptions(sens)
                setAiModelOptions(models)
            } catch (e) {
                logWarn('[DevDeploy] Failed to load reference data:', e)
            }
        }
        loadRefData()
    }, [])

    // --- Battery check ---
    const handleBatteryCheck = useCallback(async () => {
        if (!bleDevice?.connected || !bleSession) return
        try {
            const resp = await bleSession.execute(commandRegistry.battery)
            if (resp !== null && resp !== undefined) {
                const respStr = String(resp)
                const match = respStr.match(/(\d+)%/)
                if (match) setBatteryLevel(parseInt(match[1], 10))
            }
        } catch (e) {
            logWarn('[DevDeploy] Battery check failed:', e)
        }
    }, [bleDevice, bleSession])

    // --- SD card check ---
    const handleSdCardCheck = useCallback(async () => {
        if (!bleDevice?.connected || !bleSession) return
        try {
            const resp = await bleSession.execute(commandRegistry.aiinfo)
            if (resp !== null && resp !== undefined) {
                const respStr = String(resp)
                const match = respStr.match(/(\d+)\s*[Kk]\s*total.*?(\d+)\s*[Kk]\s*available/s)
                if (match) {
                    setSdCardStatus({
                        total: parseInt(match[1], 10),
                        free: parseInt(match[2], 10),
                    })
                }
            }
        } catch (e) {
            logWarn('[DevDeploy] SD card check failed:', e)
        }
    }, [bleDevice, bleSession])

    // Auto-check on connect
    useEffect(() => {
        if (bleDevice?.connected) {
            handleBatteryCheck()
            handleSdCardCheck()
        }
    }, [bleDevice?.connected]) // eslint-disable-line react-hooks/exhaustive-deps

    // --- Project change handler ---
    const handleProjectChange = useCallback(async (projectId: string) => {
        const selected = availableProjects.find(p => p.id === projectId)
        if (selected) {
            setProject(selected)
            setCaptureMethodOverride(selected.capture_method_id)
            setTimelapseIntervalOverride(selected.timelapse_interval_seconds)
            setMotionSensitivityOverride(selected.activity_detection_sensitivity_id ?? null)
            setAiModelIdOverride(selected.model_id ?? null)
            setLorawanOverride(selected.lorawan_required ?? false)
            setRecordGpsOverride(selected.record_gps_in_images ?? false)
        }
    }, [availableProjects])

    // --- Persist project settings to DB ---
    const persistProjectSettings = useCallback(async () => {
        if (!project) return
        const updates: any = {}
        if (captureMethodOverride !== null && captureMethodOverride !== project.capture_method_id) {
            updates.capture_method_id = captureMethodOverride
        }
        if (timelapseIntervalOverride !== null && timelapseIntervalOverride !== project.timelapse_interval_seconds) {
            updates.timelapse_interval_seconds = timelapseIntervalOverride
        }
        if (motionSensitivityOverride !== null && motionSensitivityOverride !== project.activity_detection_sensitivity_id) {
            updates.activity_detection_sensitivity_id = motionSensitivityOverride
        }
        if (aiModelIdOverride !== project.model_id) {
            updates.model_id = aiModelIdOverride
        }
        if (lorawanOverride !== project.lorawan_required) {
            updates.lorawan_required = lorawanOverride
        }
        if (recordGpsOverride !== project.record_gps_in_images) {
            updates.record_gps_in_images = recordGpsOverride
        }
        if (Object.keys(updates).length > 0) {
            try {
                await ProjectService.updateProject(project.id, updates)
                log('[DevDeploy] Project settings persisted to DB:', updates)
            } catch (e) {
                logWarn('[DevDeploy] Failed to persist project settings:', e)
            }
        }
    }, [project, captureMethodOverride, timelapseIntervalOverride, motionSensitivityOverride, aiModelIdOverride, lorawanOverride, recordGpsOverride])

    // --- Start deployment ---
    const handleStartDeployment = useCallback(async () => {
        if (!bleDevice?.connected) {
            Alert.alert('Device Disconnected', 'Please ensure the device is connected.')
            return
        }
        if (!project || !user) {
            Alert.alert('Error', 'Missing project or user information.')
            return
        }
        if (!bleSession) {
            Alert.alert('Error', 'BLE session not available.')
            return
        }

        progress.reset('Starting dev deployment...')
        setSubmitting(true)
        isStartDeploymentInProgress.current = true

        const cb = {
            addLog: progress.addLog,
            setStep: progress.setFinishStep,
            setProgress: progress.setFinishProgress,
        }

        try {
            // 1-3. Shared pipeline steps
            await pipeline.syncTime(bleSession, cb)
            await pipeline.pushConfig(bleDevice, bleSession, cb)
            await pipeline.syncAiModel(bleDevice, bleSession, project.model_id, cb)

            // 4. Persist project settings (dev-specific)
            progress.addLog('Saving project settings...')
            progress.setFinishStep('Saving settings...')
            progress.setFinishProgress(0.25)
            await persistProjectSettings()
            progress.addLog('Project settings saved')

            // 5. Create deployment record
            progress.addLog('Creating deployment record...')
            progress.setFinishStep('Creating record...')
            progress.setFinishProgress(0.3)

            const newDeployment = await DeploymentService.createDeployment({
                name: locationName || 'Dev Deployment Test',
                projectId: project.id,
                deviceId: device?.id || '',
                setupBy: user.id,
                locationName: locationName || 'Dev Deployment Test',
                cameraHeight: cameraHeight ? parseFloat(cameraHeight) : undefined,
                latitude: gpsLocation?.latitude,
                longitude: gpsLocation?.longitude,
                altitude: gpsLocation?.altitude,
                accuracy: gpsLocation?.accuracy === null ? undefined : gpsLocation?.accuracy,
                captureMethodId: effectiveCaptureMethod,
                aiModelId: project.model_id || undefined,
                deviceEui: device?.deviceEui,
                batteryLevelAtStart: batteryLevel ?? undefined,
                sdCardTotalKbAtStart: sdCardStatus?.total,
                sdCardAvailableKbAtStart: sdCardStatus?.free,
                startComments: notes,
                cameraImagePaths: [],
            })
            deploymentIdRef.current = newDeployment.id
            progress.addLog(`Deployment created: ${newDeployment.id.substring(0, 8)}...`)

            // 6. Configure device OPs (shared pipeline)
            await pipeline.configureDevice(bleDevice, startConfigure, {
                deploymentId: newDeployment.id,
                captureMethodId: effectiveCaptureMethod,
                timelapseInterval: effectiveTimelapseInterval,
                recordGpsInImages: project.record_gps_in_images || false,
                gpsLocation,
            }, cb)

            // 7. Flash OPs (dev-specific)
            progress.addLog('Setting flash parameters...')
            progress.setFinishStep('Flash settings...')
            progress.setFinishProgress(0.7)
            const session = createBleSession(bleDevice)
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.LED_BRIGHTNESS, value: flashParams.ledBrightness }))
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.FLASH_LED, value: flashParams.flashLed }))
            progress.addLog(`Flash: ${['Off', 'Visible', 'IR'][flashParams.flashLed]} @ ${flashParams.ledBrightness}%`)

            // 8. Done
            progress.setFinishStep('Complete')
            progress.setFinishProgress(1.0)
            progress.setIsSuccess(true)
            progress.addLog('Dev deployment started successfully')

            setTimeout(() => {
                progress.setIsFinishing(false)
                monitoring.setIsMonitoring(true)
                isStartDeploymentInProgress.current = false
            }, 1500)

        } catch (error) {
            logError('Dev deployment failed:', error)
            progress.setIsFinishing(false)
            Alert.alert('Error', 'Failed to start dev deployment: ' + (error as any).message)
            isStartDeploymentInProgress.current = false
        }
    }, [
        bleDevice, bleSession, project, user, device,
        startConfigure, progress, persistProjectSettings,
        batteryLevel, gpsLocation, locationName, cameraHeight, notes,
        sdCardStatus, flashParams, effectiveCaptureMethod, effectiveTimelapseInterval,
        monitoring
    ])

    const handleFinishDismiss = useCallback(() => {
        progress.setIsFinishing(false)
        if (progress.isSuccess) {
            monitoring.setIsMonitoring(true)
        }
    }, [progress, monitoring])

    return {
        // Device
        bleDevice,
        device,
        // Project
        project,
        availableProjects,
        handleProjectChange,
        // Form
        notes, setNotes,
        locationName, setLocationName,
        cameraHeight, setCameraHeight,
        // Capture method overrides
        captureMethodOverride: effectiveCaptureMethod,
        setCaptureMethodOverride,
        timelapseIntervalOverride: effectiveTimelapseInterval,
        setTimelapseIntervalOverride,
        // New project field overrides
        motionSensitivityOverride, setMotionSensitivityOverride,
        aiModelIdOverride, setAiModelIdOverride,
        lorawanOverride, setLorawanOverride,
        recordGpsOverride, setRecordGpsOverride,
        // Reference data
        sensitivityOptions, aiModelOptions,
        // Flash
        flashParams, setFlashParams,
        // Device health
        batteryLevel, sdCardStatus,
        handleBatteryCheck, handleSdCardCheck,
        // Deployment
        submitting,
        handleStartDeployment,
        // Monitoring (from shared hook)
        isMonitoring: monitoring.isMonitoring,
        handleMonitorDisconnect: monitoring.handleMonitorDisconnect,
        handleStopMonitoring: monitoring.handleStopMonitoring,
        isStoppingMonitoring: monitoring.isStoppingMonitoring,
        // Progress (from shared hook)
        isFinishing: progress.isFinishing,
        finishProgress: progress.finishProgress,
        finishStep: progress.finishStep,
        finishLogs: progress.finishLogs,
        isStartSuccess: progress.isSuccess,
        handleFinishDismiss,
    }
}
