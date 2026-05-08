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
import FirmwareService from '../../../services/FirmwareService'
import AiModelService from '../../../services/AiModelService'
import { useBleSession } from '../../../hooks/useBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import { runFileTransferPipeline } from '../../../ble/protocol/fileTransfer'
import { useBleActions } from '../../../providers/BleEngineProvider'
import { useDeploymentConfiguration } from '../../../hooks/useDeploymentConfiguration'
import { useBle } from '../../../hooks/useBle'
import { useGPSLocation } from '../../../hooks/useGPSLocation'
import { useDeviceSettings, OP_PARAMETER } from '../../../hooks/useDeviceSettings'
import { createBleSession } from '../../../ble/session/createBleSession'

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
    const [isMonitoring, setIsMonitoring] = useState(false)
    const [isStoppingMonitoring, setIsStoppingMonitoring] = useState(false)

    // Progress dialog
    const [isFinishing, setIsFinishing] = useState(false)
    const [finishProgress, setFinishProgress] = useState(0)
    const [finishStep, setFinishStep] = useState('')
    const [finishLogs, setFinishLogs] = useState<string[]>([])
    const [isStartSuccess, setIsStartSuccess] = useState(false)

    const isNavigatingAway = useRef(false)
    const isStartDeploymentInProgress = useRef(false)
    const deploymentIdRef = useRef<string | null>(null)

    const addFinishLog = useCallback((msg: string) => {
        setFinishLogs(prev => [...prev, msg])
    }, [])

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

        setIsFinishing(true)
        setSubmitting(true)
        setFinishProgress(0)
        setFinishStep('Starting dev deployment...')
        setFinishLogs([])
        setIsStartSuccess(false)
        isStartDeploymentInProgress.current = true

        try {
            // 1. Time sync
            addFinishLog('Syncing time...')
            setFinishStep('Time sync...')
            setFinishProgress(0.1)
            if (bleDevice) await bleSession?.execute(commandRegistry.setutc)
            addFinishLog('Time synced')

            // 2. Config push
            addFinishLog('Pushing config...')
            setFinishStep('Config push...')
            setFinishProgress(0.12)
            try {
                const latestConfig = await ReferenceDataService.getLatestFirmware('config')
                if (latestConfig?.locationPath && bleDevice && bleSession) {
                    const configBytes = await FirmwareService.readFirmwareAsBytes(latestConfig.locationPath)
                    if (configBytes) {
                        await runFileTransferPipeline(bleDevice, {
                            filename: 'CONFIG.TXT',
                            data: configBytes,
                            onProgress: (p) => setFinishProgress(0.12 + (p.percentage / 100) * 0.03)
                        })
                        addFinishLog('Config pushed')
                    }
                }
            } catch (e) {
                logWarn('Config push failed:', e)
                addFinishLog('Config push failed, continuing...')
            }

            // 3. AI Model
            addFinishLog('Checking AI model...')
            setFinishStep('AI Model...')
            setFinishProgress(0.15)
            if (project.model_id && bleSession && bleDevice) {
                try {
                    await bleSession.execute(() => commandRegistry.aiver())
                    const ops = await bleSession.execute(() => commandRegistry.getops())
                    if (!ops) throw new Error('Failed to get ops')
                    const currentId = parseInt(ops[14], 10)
                    const currentVer = parseInt(ops[15], 10)
                    const targetModel = await AiModelService.getModelById(project.model_id)

                    if (targetModel) {
                        const { firmwareModelId: numericId, versionNumber: numericVer } = await ReferenceDataService.getFirmwareIds(targetModel)
                        if (currentId !== numericId || currentVer !== numericVer) {
                            addFinishLog(`Model mismatch — transferring...`)
                            const localFiles = await AiModelService.ensureFilesDownloaded(targetModel)
                            const modelBytes = await AiModelService.readModelAsBytes(localFiles.modelUri)
                            if (modelBytes) {
                                const { modelExt: tflExt } = AiModelService.getModelFileExtensions(targetModel)
                                await runFileTransferPipeline(bleDevice, {
                                    filename: `${numericId}V${numericVer}.${tflExt}`,
                                    data: modelBytes,
                                    onProgress: (p) => setFinishProgress(0.15 + (p.percentage / 100) * 0.05)
                                })
                                const labelsBytes = localFiles.labelsUri ? await AiModelService.readModelAsBytes(localFiles.labelsUri) : null
                                if (labelsBytes) {
                                    const { labelsExt } = AiModelService.getModelFileExtensions(targetModel)
                                    await runFileTransferPipeline(bleDevice, {
                                        filename: `${numericId}V${numericVer}.${labelsExt}`,
                                        data: labelsBytes,
                                        onProgress: () => {}
                                    })
                                }
                                await bleSession.execute(() => commandRegistry.erasemodel())
                                await bleSession.execute(() => commandRegistry.loadmodel(numericId, numericVer))
                                addFinishLog('AI model updated')
                            }
                        } else {
                            addFinishLog('AI model up to date')
                        }
                    }
                } catch (e) {
                    logWarn('AI model update failed:', e)
                    addFinishLog('AI model update failed, continuing...')
                }
            } else {
                addFinishLog('No AI model required')
            }

            // 4. Persist project settings
            addFinishLog('Saving project settings...')
            setFinishStep('Saving settings...')
            setFinishProgress(0.25)
            await persistProjectSettings()
            addFinishLog('Project settings saved')

            // 5. Create deployment record
            addFinishLog('Creating deployment record...')
            setFinishStep('Creating record...')
            setFinishProgress(0.3)

            const newDeployment = await DeploymentService.createDeployment({
                name: locationName || 'Dev Deployment Test',
                projectId: project.id,
                deviceId: deviceId || '',
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
            addFinishLog(`Deployment created: ${newDeployment.id.substring(0, 8)}...`)

            // 6. Configure device OPs
            addFinishLog('Configuring device...')
            setFinishStep('Configuring device...')
            setFinishProgress(0.5)

            let method: 'activity' | 'timelapse' | 'mixed' | 'unknown' = 'unknown'
            if (effectiveCaptureMethod === 1) method = 'activity'
            else if (effectiveCaptureMethod === 2) method = 'timelapse'
            else if (effectiveCaptureMethod === 3) method = 'mixed'

            await startConfigure(bleDevice, {
                deploymentId: newDeployment.id,
                captureMethod: method,
                motionInterval: 1000,
                timelapseInterval: effectiveTimelapseInterval || 300,
                recordGpsInImages: project.record_gps_in_images || false,
                location: gpsLocation && gpsLocation.latitude !== undefined && gpsLocation.longitude !== undefined ? {
                    latitude: gpsLocation.latitude,
                    longitude: gpsLocation.longitude,
                    altitude: gpsLocation.altitude || 0
                } : undefined
            })
            addFinishLog('Device OPs configured')

            // 7. Flash OPs (dev-specific)
            addFinishLog('Setting flash parameters...')
            setFinishStep('Flash settings...')
            setFinishProgress(0.7)
            const session = createBleSession(bleDevice)
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.LED_BRIGHTNESS, value: flashParams.ledBrightness }))
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.FLASH_LED, value: flashParams.flashLed }))
            addFinishLog(`Flash: ${['Off', 'Visible', 'IR'][flashParams.flashLed]} @ ${flashParams.ledBrightness}%`)

            // 8. Done
            setFinishStep('Complete')
            setFinishProgress(1.0)
            setIsStartSuccess(true)
            addFinishLog('Dev deployment started successfully')

            setTimeout(() => {
                setIsFinishing(false)
                setIsMonitoring(true)
                isStartDeploymentInProgress.current = false
            }, 1500)

        } catch (error) {
            logError('Dev deployment failed:', error)
            setIsFinishing(false)
            Alert.alert('Error', 'Failed to start dev deployment: ' + (error as any).message)
            isStartDeploymentInProgress.current = false
        }
    }, [
        bleDevice, bleSession, project, user, deviceId, device,
        startConfigure, addFinishLog, persistProjectSettings,
        batteryLevel, gpsLocation, locationName, cameraHeight, notes,
        sdCardStatus, flashParams, effectiveCaptureMethod, effectiveTimelapseInterval
    ])

    // --- Monitor disconnect ---
    const handleMonitorDisconnect = useCallback(async () => {
        Alert.alert(
            'Wildlife Watcher Monitoring',
            'The bluetooth will be disconnected but the camera will continue monitoring for animals.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect',
                    style: 'default',
                    onPress: async () => {
                        try {
                            if (bleDevice) {
                                try { await bleSession?.execute(commandRegistry.disconnect) } catch {} finally { await disconnectDevice(bleDevice) }
                            }
                            setIsMonitoring(false)
                        } catch (error) {
                            logError('Monitor disconnect failed:', error)
                        } finally {
                            isNavigatingAway.current = true
                            navigation.navigate('Home', { initialTab: 'deployment' })
                        }
                    }
                }
            ]
        )
    }, [bleDevice, bleSession, disconnectDevice, navigation])

    // --- Stop monitoring ---
    const handleStopMonitoring = useCallback(async (notes?: string) => {
        if (!deploymentIdRef.current || !bleDevice) return
        setIsStoppingMonitoring(true)
        setIsFinishing(true)
        setFinishProgress(0)
        setFinishStep('Stopping monitoring...')
        setFinishLogs([])

        try {
            addFinishLog('Quiescing device...')
            await quiesceDevice(bleDevice, { isEndDeployment: true })
            addFinishLog('Ending deployment...')
            setFinishProgress(0.5)

            await DeploymentService.endDeployment(
                deploymentIdRef.current,
                user?.id || null,
                notes || 'Stopped from Dev Deployment Test'
            )

            setFinishProgress(1.0)
            setFinishStep('Complete')
            addFinishLog('Monitoring stopped')

            setTimeout(() => {
                setIsFinishing(false)
                setIsStoppingMonitoring(false)
                if (bleDevice) {
                    disconnectDevice(bleDevice)
                }
                isNavigatingAway.current = true
                navigation.navigate('Home', { initialTab: 'deployment' })
            }, 1500)
        } catch (error) {
            logError('Stop monitoring failed:', error)
            setIsFinishing(false)
            setIsStoppingMonitoring(false)
            Alert.alert('Error', 'Failed to stop monitoring: ' + (error as any).message)
        }
    }, [bleDevice, quiesceDevice, disconnectDevice, navigation, addFinishLog, user?.id])

    const handleFinishDismiss = useCallback(() => {
        setIsFinishing(false)
        if (isStartSuccess) {
            setIsMonitoring(true)
        }
    }, [isStartSuccess])

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
        // Monitoring
        isMonitoring,
        handleMonitorDisconnect,
        handleStopMonitoring,
        isStoppingMonitoring,
        // Progress
        isFinishing, finishProgress, finishStep, finishLogs,
        isStartSuccess, handleFinishDismiss,
    }
}
