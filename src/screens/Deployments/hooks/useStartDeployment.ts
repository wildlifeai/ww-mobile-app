import { useState, useEffect, useCallback, useRef } from 'react'
import { Alert } from 'react-native'
import { useAppSelector } from '../../../redux'
import { Q } from '@nozbe/watermelondb'
import database from '../../../database'
import { useFocusEffect } from '@react-navigation/native'
import { DeploymentService } from '../../../services/DeploymentService'
import ProjectService from '../../../services/ProjectService'
import ReferenceDataService from '../../../services/ReferenceDataService'
import Device from '../../../database/models/Device'
import Deployment from '../../../database/models/Deployment'
import { DeviceService } from '../../../services/DeviceService'
import FirmwareService from '../../../services/FirmwareService'
import AiModelService from '../../../services/AiModelService'
import { useBleSession } from '../../../hooks/useBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import { runFileTransferPipeline } from '../../../ble/protocol/fileTransfer'
import { checkSdCard } from '../../../ble/workflows/checkSdCard'
import { extractErrorBits } from '../../../ble/messageClassifier'
import { useBleActions } from '../../../providers/BleEngineProvider'
import { useDeploymentConfiguration } from '../../../hooks/useDeploymentConfiguration'
import { useBle } from '../../../hooks/useBle'
import { useGPSLocation } from '../../../hooks/useGPSLocation'

import { log, logError, logWarn } from '../../../utils/logger'
import { selectCurrentOrganisation } from '../../../redux/slices/authSlice'
import { ProjectWithDetails } from '../../../types/project'
import { InitPayload } from '../../../navigation/types'
import { calculateDistance } from '../../../utils/gpsUtils'

// const INITIALIZATION_GUARD_TIMEOUT = 2000

interface UseStartDeploymentParams {
    deviceId?: string
    bleDeviceId?: string
    projectId?: string
    navigation: any
    initPayload?: InitPayload
}

export const useStartDeployment = ({
    deviceId,
    bleDeviceId,
    projectId: initialProjectId,
    navigation,
    initPayload
}: UseStartDeploymentParams) => {
    // Selectors
    const devices = useAppSelector(state => state.devices)
    const bleDevice = devices[bleDeviceId || '']
    const user = useAppSelector(state => state.authentication.user)
    const currentOrganisation = useAppSelector(selectCurrentOrganisation)

    // BLE Hooks
    const { disconnectDevice } = useBle()
    
    // NEW EVENT-FIRST ARCHITECTURE (SHADOW MODE)
    const bleSession = useBleSession(bleDevice)
    // const { initialize } = useBleInitialization()
    const { configure: startConfigure } = useDeploymentConfiguration()
    useBleActions()

    // GPS Location
    const { getLocation, location: gpsLocation } = useGPSLocation()

    // Advanced Settings State
    const [batteryLevel, setBatteryLevel] = useState<number | null>(initPayload?.batteryLevel || null)
    const [sdCardStatus, setSdCardStatus] = useState<{ total: number; free: number } | null>(initPayload?.sdCardStatus || null)

    
    // Refs for DFU
    const isDfuInProgress = useRef(false)
    const isReconnectingAfterDfu = useRef(false)



    const [formState, setFormState] = useState({
        notes: '',
        cameraHeight: '',
        testImagePath: undefined as string | undefined
    })

    const [submitting, setSubmitting] = useState(false)
    const [project, setProject] = useState<any>(null)
    const [availableProjects, setAvailableProjects] = useState<ProjectWithDetails[]>([])
    const [captureMethodName, setCaptureMethodName] = useState<string>('')
    const [sensitivityLabel, setSensitivityLabel] = useState<string>('')
    
    // Site Name (Location Name) States
    const [locationName, setLocationName] = useState<string>('')
    const [availableLocations, setAvailableLocations] = useState<{label: string, value: string}[]>([])
    const [isCustomLocation, setIsCustomLocation] = useState<boolean>(true)
    const lastLocationCalculationRef = useRef<{lat: number, lon: number} | null>(null)
    
    // UI State for Initialization Header
    const [device, setDevice] = useState<Device | undefined>()
    const [isInitializing, _setIsInitializing] = useState(false) // Hardcoded false as initialization now happens upstream
    const [initProgress, _setInitProgress] = useState(1.0)
    const [initStep, _setInitStep] = useState('Complete')
    const [initErrors, setInitErrors] = useState<{ selftest?: string; setUtc?: string; deviceHealth?: string[] }>(initPayload?.initErrors || {})

    // UI State for Deployment Progress Dialog
    const [finishProgress, setFinishProgress] = useState(0)
    const [finishStep, setFinishStep] = useState('')
    const [finishLogs, setFinishLogs] = useState<string[]>([])
    const [isFinishing, setIsFinishing] = useState(false)
    const [isStartSuccess, setIsStartSuccess] = useState(false)
    const [isMonitoring, setIsMonitoring] = useState(false)

    const addFinishLog = useCallback((message: string) => {
        setFinishLogs(prev => [...prev, message])
    }, [])

    // Connection Guard Refs
    const isNavigatingAway = useRef(false)
    const isStartDeploymentInProgress = useRef(false)

    // Standard BLE initialization plus initialization guard
    // const hasRunInitialization = useRef(false)
    const bleDeviceRef = useRef(bleDevice)

    
    // Memoized handlers to prevent infinite loops in child components
    const handleImageCaptured = useCallback((path: string) => {
        setFormState(prev => ({ ...prev, testImagePath: path }))
    }, [])

    const handleNotesChange = useCallback((notes: string) => {
        setFormState(prev => ({ ...prev, notes }))
    }, [])

    const handleCameraHeightChange = useCallback((text: string) => {
        setFormState(prev => ({ ...prev, cameraHeight: text }))
    }, [])

    useEffect(() => {
        bleDeviceRef.current = bleDevice
    }, [bleDevice])  



    const loadProjectAndDevice = useCallback(async () => {
        try {
            log('[DeploymentDetails] Loading project:', initialProjectId);
            
            const [deviceData] = await Promise.all([
                DeviceService.getDeviceById(deviceId as string)
            ])
            
            setDevice(deviceData)

            if (initialProjectId) {
                const proj = await ProjectService.getProjectById(initialProjectId)
                log('[DeploymentDetails] Project loaded:', proj?.name, 'capture_method_id:', proj?.capture_method_id);
                setProject(proj)
                
                if (user?.id && currentOrganisation?.id) {
                    const projs = await ProjectService.getProjectsForUserInOrganisation(user.id, currentOrganisation.id)
                    setAvailableProjects(projs)
                }

                if (proj && proj.capture_method_id) {
                    log('[DeploymentDetails] Resolving capture method name for ID:', proj.capture_method_id);
                    const methods = await ReferenceDataService.getCaptureMethods()
                    const method = methods.find((m: any) => String(m.id) === String(proj.capture_method_id))
                    log('[DeploymentDetails] Method resolved:', method?.value);
                    setCaptureMethodName(method ? method.value : 'Unknown')

                    if (proj.activity_detection_sensitivity_id) {
                        const sensitivities = await ReferenceDataService.getActivitySensitivity()
                        const sensitivity = sensitivities.find((s: any) => String(s.id) === String(proj.activity_detection_sensitivity_id))
                        setSensitivityLabel(sensitivity ? sensitivity.value : 'Unknown')
                    }
                } else {
                    log('[DeploymentDetails] No capture method ID on project');
                    setCaptureMethodName('Not Set')
                }
            } else {
                logWarn('[DeploymentDetails] No projectId provided');
            }
        } catch (error) {
            logError('[DeploymentDetails] Error in loadProjectAndDevice:', error)
        }
    }, [initialProjectId, deviceId, user?.id, currentOrganisation?.id])

    useFocusEffect(
        useCallback(() => {
            if (initialProjectId || deviceId) {
                loadProjectAndDevice()
            }
            getLocation()
        }, [initialProjectId, deviceId, loadProjectAndDevice, getLocation])
    )

    // Location Name logic based on GPS and Project Deployments
    useEffect(() => {
        let isMounted = true
        const updateClosestLocations = async () => {
            if (!project?.id || !gpsLocation) return

            const lat = gpsLocation.latitude
            const lon = gpsLocation.longitude

            // Check if we need to recalculate (moved > 80m)
            if (lastLocationCalculationRef.current) {
                const dist = calculateDistance(
                    lat, lon,
                    lastLocationCalculationRef.current.lat, lastLocationCalculationRef.current.lon
                )
                if (dist < 80) {
                    return // No significant movement
                }
            }

            lastLocationCalculationRef.current = { lat, lon }

            try {
                const deploymentsCollection = database.get<Deployment>('deployments')
                const pastDeployments = await deploymentsCollection.query(
                    Q.where('project_id', project.id),
                    Q.where('latitude', Q.notEq(null)),
                    Q.where('longitude', Q.notEq(null))
                ).fetch()

                if (!isMounted) return

                if (pastDeployments.length === 0) {
                    setAvailableLocations([])
                    setIsCustomLocation(true)
                    return
                }

                // Group by locationName and find distance
                const locationsMap = new Map<string, number>()
                pastDeployments.forEach(d => {
                    if (!d.locationName) return
                    const dist = calculateDistance(lat, lon, d.latitude!, d.longitude!)
                    
                    if (!locationsMap.has(d.locationName) || dist < locationsMap.get(d.locationName)!) {
                        locationsMap.set(d.locationName, dist)
                    }
                })

                if (locationsMap.size === 0) {
                    setAvailableLocations([])
                    setIsCustomLocation(true)
                    return
                }

                // Sort by distance
                const sorted = Array.from(locationsMap.entries())
                    .sort((a, b) => a[1] - b[1])
                    .slice(0, 3) // Top 3

                const ops = sorted.map(([name]) => ({ label: name, value: name }))
                setAvailableLocations(ops)

                // Autofill closest
                if (ops.length > 0) {
                    setLocationName(ops[0].value)
                    setIsCustomLocation(false)
                }
            } catch (err) {
                logError('[Deployment] Failed to calculate closest locations', err)
            }
        }

        updateClosestLocations()

        return () => {
            isMounted = false
        }
    }, [project?.id, gpsLocation])

    const handleProjectChange = useCallback(async (projectId: string) => {
        if (!projectId || projectId === project?.id) return;
        
        const newProject = availableProjects.find(p => p.id === projectId);
        if (!newProject) return;

        log('[DeploymentDetails] Project changed by user:', projectId)
        setProject(newProject);

        if (newProject.capture_method_id) {
            const methods = await ReferenceDataService.getCaptureMethods()
            const method = methods.find((m: any) => String(m.id) === String(newProject.capture_method_id))
            setCaptureMethodName(method ? method.value : 'Unknown')

            if (newProject.activity_detection_sensitivity_id) {
                const sensitivities = await ReferenceDataService.getActivitySensitivity()
                const sensitivity = sensitivities.find((s: any) => String(s.id) === String(newProject.activity_detection_sensitivity_id))
                setSensitivityLabel(sensitivity ? sensitivity.value : 'Unknown')
            } else {
                setSensitivityLabel('')
            }
        } else {
            setCaptureMethodName('Not Set')
            setSensitivityLabel('')
        }
    }, [availableProjects, project?.id]);

    // Validate LoRaWAN connectivity if required
    useEffect(() => {
        let isMounted = true;
        const checkLorawan = async () => {
             if (project?.lorawan_required && bleDevice?.connected) {
                  log('[Deployment] Project requires LoRaWAN. Pinging network...')
                  try {
                      await bleSession?.execute(commandRegistry.ping)
                      log('[Deployment] LoRaWAN ping successful.')
                      if (isMounted) {
                          setInitErrors(prev => ({
                              ...prev,
                              deviceHealth: (prev.deviceHealth || []).filter(msg => !msg.includes('LoRaWAN is required'))
                          }))
                      }
                  } catch (err) {
                      logWarn('[Deployment] LoRaWAN ping failed:', err)
                      if (isMounted) {
                          setInitErrors(prev => {
                              const existing = prev.deviceHealth || []
                              const msg = 'LoRaWAN is required but the test message failed.'
                              if (!existing.includes(msg)) return { ...prev, deviceHealth: [...existing, msg] }
                              return prev
                          })
                      }
                  }
             } else if (!project?.lorawan_required) {
                 if (isMounted) {
                      setInitErrors(prev => ({
                          ...prev,
                          deviceHealth: (prev.deviceHealth || []).filter(msg => !msg.includes('LoRaWAN is required'))
                      }))
                 }
             }
        }
        checkLorawan()
        return () => { isMounted = false }
    }, [project?.lorawan_required, bleDevice?.connected, bleDevice]) // eslint-disable-line react-hooks/exhaustive-deps

    // Navigation Interceptor
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
            if (isNavigatingAway.current) {
                return
            }

            const actionType = e.data.action.type;
            if (actionType === 'GO_BACK' || actionType === 'POP') {
                e.preventDefault()

                log('[Deployment] Intercepting back navigation. Disconnecting and redirecting to Deployments.')
                isNavigatingAway.current = true

                if (bleDevice) {
                    bleSession?.execute(commandRegistry.disconnect).finally(() => disconnectDevice(bleDevice)).catch((err: any) => logWarn('[Deployment] Auto-disconnect failed:', err))
                }

                navigation.navigate('Home', { initialTab: 'deployment' })
            }
        })

        return unsubscribe
    }, [navigation, bleDevice]) // eslint-disable-line react-hooks/exhaustive-deps

    // Robust Connection Lost Alert
    useEffect(() => {
        if (!isInitializing && !submitting && bleDevice && !bleDevice.connected && !isNavigatingAway.current && !isStartDeploymentInProgress.current && !isDfuInProgress.current && !isReconnectingAfterDfu.current) {
            if (isMonitoring) {
                logWarn('[Monitor] Connection lost. Auto-navigating to home.')
                Alert.alert('Connection Lost', 'Connection lost — device continues recording.', [{ text: 'OK' }])
                isNavigatingAway.current = true
                navigation.navigate('Home', { initialTab: 'deployment' })
            } else {
                Alert.alert(
                    'Connection Lost',
                    'Device disconnected unexpectedly during deployment setup.',
                    [{
                        text: 'OK', onPress: () => {
                            isNavigatingAway.current = true
                            if (navigation.canGoBack()) {
                                navigation.goBack()
                            }
                        }
                    }]
                )
            }
        }
    }, [bleDevice, submitting, navigation, isInitializing, isMonitoring])  

    const handleStartDeployment = useCallback(async () => {
        if (!bleDevice?.connected) {
            Alert.alert(
                'Device Disconnected',
                'Please ensure the device is connected before starting the deployment.',
                [{ text: 'OK' }]
            )
            return
        }

        if (!project || !user) {
            Alert.alert('Error', 'Missing project or user information. Please wait for data to load.')
            return
        }

        setIsFinishing(true)
        setSubmitting(true)
        setFinishProgress(0)
        setFinishStep('Starting deployment...')
        setFinishLogs([])
        setIsStartSuccess(false)
        isStartDeploymentInProgress.current = true

        try {
            addFinishLog('Performing final time check...')
            setFinishStep('Checking time...')
            setFinishProgress(0.1)
            
            if (bleDevice) await bleSession?.execute(commandRegistry.setutc)
            addFinishLog('Time check complete')

            // Config push
            addFinishLog('Updating configuration...')
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
                            onProgress: (p) => setFinishProgress(0.12 + (p.percentage / 100) * 0.03) // max 0.15
                        })
                        addFinishLog('Configuration pushed successfully')
                    }
                }
            } catch (e) {
                logWarn('Failed to push config:', e)
                addFinishLog('Configuration push failed, continuing...')
            }

            // AI Model check
            addFinishLog('Checking AI model...')
            setFinishStep('AI Model...')
            setFinishProgress(0.15)

            if (project.model_id && bleSession && bleDevice) {
                try {
                    // Wake up AI
                    await bleSession.execute(() => commandRegistry.aiver())

                    // Check current model
                    const ops = await bleSession.execute(() => commandRegistry.getops())
                    if (!ops) {
                        throw new Error('Failed to get operational parameters from device.')
                    }
                    const currentId = parseInt(ops[14], 10)
                    const currentVer = parseInt(ops[15], 10)

                    const targetModel = await AiModelService.getModelById(project.model_id)

                    if (targetModel) {
                        const { firmwareModelId: numericId, versionNumber: numericVer } = await ReferenceDataService.getFirmwareIds(targetModel)

                        if (currentId !== numericId || currentVer !== numericVer) {
                            addFinishLog(`Model mismatch (Device: ${currentId}v${currentVer}, Target: ${numericId}v${numericVer})`)
                            addFinishLog('Downloading AI model files...')
                            
                            const localFiles = await AiModelService.ensureFilesDownloaded(targetModel)
                            const modelBytes = await AiModelService.readModelAsBytes(localFiles.modelUri)
                            const labelsBytes = localFiles.labelsUri ? await AiModelService.readModelAsBytes(localFiles.labelsUri) : null
                            
                            if (modelBytes) {
                                addFinishLog('Transferring AI model...')
                                const tflExt = targetModel.modelPath ? targetModel.modelPath.split('.').pop() : 'tflite'
                                const tflFilename = `${numericId}V${numericVer}.${tflExt}`
                                await runFileTransferPipeline(bleDevice, {
                                    filename: tflFilename,
                                    data: modelBytes,
                                    onProgress: (p) => setFinishProgress(0.15 + (p.percentage / 100) * 0.05) // max 0.2
                                })

                                if (labelsBytes) {
                                    addFinishLog('Transferring model labels...')
                                    const labelsExt = targetModel.labelsPath ? targetModel.labelsPath.split('.').pop() : 'txt'
                                    const labelsFilename = `${numericId}V${numericVer}.${labelsExt}`
                                    await runFileTransferPipeline(bleDevice, {
                                        filename: labelsFilename,
                                        data: labelsBytes,
                                        onProgress: () => {} // minor progress, skip ui update
                                    })
                                }
                                
                                addFinishLog('Erasing old model...')
                                await bleSession.execute(() => commandRegistry.erasemodel())
                                
                                addFinishLog('Loading new model...')
                                await bleSession.execute(() => commandRegistry.loadmodel(numericId, numericVer))
                                
                                addFinishLog('AI model updated successfully')
                            }
                        } else {
                            addFinishLog('AI model up to date')
                        }
                    } else {
                        addFinishLog('Assigned AI model not found locally')
                    }
                } catch (e) {
                    logWarn('Failed to update AI model:', e)
                    addFinishLog('AI model update failed, continuing...')
                }
            } else {
                // No AI model assigned — check if device has a stale model loaded
                try {
                    await bleSession?.execute(() => commandRegistry.aiver())
                    const ops = await bleSession?.execute(() => commandRegistry.getops())
                    const currentId = ops ? parseInt(ops[14], 10) : 0

                    if (currentId !== 0) {
                        addFinishLog(`Device has stale model (ID: ${currentId}) — erasing...`)
                        await bleSession?.execute(() => commandRegistry.erasemodel())
                        addFinishLog('Stale AI model erased')
                    } else {
                        addFinishLog('No AI model required — device clear')
                    }
                } catch (e) {
                    logWarn('Failed to check/erase device model:', e)
                    addFinishLog('Could not verify device model state, continuing...')
                }
            }

            addFinishLog('Gathering snapshot data...')
            setFinishStep('Reading metrics...')
            setFinishProgress(0.2)
            
            let lorawanRssi: number | undefined
            let lorawanSnr: number | undefined
            let bleFirmwareId: string | undefined

            if (bleDevice && project?.lorawan_required) {
                try {
                    addFinishLog('Reading LoRaWAN metrics...')
                    const networkResp = await bleSession?.execute(commandRegistry.network)
                    if (networkResp && networkResp.joined) {
                        lorawanRssi = networkResp.rssi
                        lorawanSnr = networkResp.snr
                        addFinishLog(`LoRaWAN metrics: RSSI ${lorawanRssi}, SNR ${lorawanSnr}`)
                    }
                } catch (e) {
                    logWarn('Failed to read LoRaWAN metrics:', e)
                    addFinishLog('Skipped LoRaWAN metrics (not available)')
                }
            }

            try {
                const response = await bleSession?.execute(commandRegistry.version)
                if (response) {
                    const resolvedId = await FirmwareService.getFirmwareIdByVersion('ble', response)
                    if (resolvedId) {
                        bleFirmwareId = resolvedId
                    }
                }
            } catch (e) {
                logWarn('Failed to resolve firmware ID:', e)
            }

            addFinishLog('Creating deployment record...')
            setFinishStep('Creating record...')
            setFinishProgress(0.3)

            const newDeployment = await DeploymentService.createDeployment({
                name: locationName || 'Automated Deployment',
                projectId: project.id,
                deviceId: deviceId || '',
                setupBy: user.id,

                locationName: locationName || 'Automated Deployment',
                cameraHeight: formState.cameraHeight ? parseFloat(formState.cameraHeight) : undefined,

                latitude: gpsLocation?.latitude,
                longitude: gpsLocation?.longitude,
                altitude: gpsLocation?.altitude,
                accuracy: gpsLocation?.accuracy === null ? undefined : gpsLocation?.accuracy,

                captureMethodId: project.capture_method_id,

                // Snapshot Fields
                aiModelId: project.model_id,
                deviceEui: device?.deviceEui,
                batteryLevelAtStart: batteryLevel ?? undefined,
                sdCardTotalKbAtStart: sdCardStatus?.total,
                sdCardAvailableKbAtStart: sdCardStatus?.free,
                bleFirmwareId: bleFirmwareId,
                lorawanRssiAtStart: lorawanRssi,
                lorawanSnrAtStart: lorawanSnr,

                startComments: formState.notes,
                cameraImagePaths: [],
            })
            addFinishLog(`Deployment created: ${newDeployment.id.substring(0, 8)}...`)

            addFinishLog('Configuring device settings...')
            setFinishStep('Configuring device...')
            setFinishProgress(0.5)
            
            log('[Deployment] Configuring device via standardized hook...')
            try {
                let method: 'activity' | 'timelapse' | 'mixed' | 'unknown' = 'unknown'
                
                if (project.capture_method_id === 1) {
                    method = 'activity'
                } else if (project.capture_method_id === 2) {
                    method = 'timelapse'
                } else if (project.capture_method_id === 3) {
                    method = 'mixed'
                }

                await startConfigure(bleDevice, {
                    deploymentId: newDeployment.id,
                    captureMethod: method,
                    motionInterval: 1000,
                    timelapseInterval: project.timelapse_interval_seconds || 300,
                    recordGpsInImages: project.record_gps_in_images || false,
                    location: gpsLocation && gpsLocation.latitude !== undefined && gpsLocation.longitude !== undefined ? {
                        latitude: gpsLocation.latitude,
                        longitude: gpsLocation.longitude,
                        altitude: gpsLocation.altitude || 0
                    } : undefined
                })
                
                addFinishLog('Device configuration successful')
                log('[Deployment] Device configuration successful')

            } catch (configError) {
                logError('[Deployment] Configuration failed:', configError)
                addFinishLog('Configuration warning: Verify settings in console')
            }

            setFinishStep('Complete')
            setFinishProgress(1.0)
            setIsStartSuccess(true)
            addFinishLog('Deployment started successfully')
            addFinishLog('Transitioning to live monitor...')

            // Auto-transition to monitoring after a brief delay
            setTimeout(() => {
                setIsFinishing(false)
                setIsMonitoring(true)
                isStartDeploymentInProgress.current = false
            }, 1500)

        } catch (error) {
            logError('Deployment failed:', error)
            setIsFinishing(false)
            Alert.alert('Error', 'Failed to start deployment: ' + (error as any).message)
            isStartDeploymentInProgress.current = false
        }
    }, [formState.cameraHeight, formState.notes, bleDevice, project, user, deviceId, startConfigure, addFinishLog, batteryLevel, device?.deviceEui, gpsLocation, locationName, sdCardStatus?.free, sdCardStatus?.total]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleFinishDismiss = useCallback(() => {
        setIsFinishing(false)
        if (isStartSuccess) {
            setIsMonitoring(true)
        }
    }, [isStartSuccess])

    const handleMonitorDisconnect = useCallback(async () => {
        try {
            if (bleDevice) {
                try { await bleSession?.execute(commandRegistry.disconnect) } catch(e) {} finally { await disconnectDevice(bleDevice) }
            }
            setIsMonitoring(false)
        } catch (error) {
            logError('Monitor disconnect failed:', error)
        } finally {
            isNavigatingAway.current = true
            navigation.navigate('Home', { initialTab: 'deployment' })
        }
    }, [bleDevice, navigation]) // eslint-disable-line react-hooks/exhaustive-deps

    const [helpVisible, setHelpVisible] = useState(false)
    const [helpTitle, setHelpTitle] = useState('')
    const [helpContent, setHelpContent] = useState('')

    const showHelp = useCallback((title: string, content: string) => {
        setHelpTitle(title)
        setHelpContent(content)
        setHelpVisible(true)
    }, [])

    const handleDismissHelp = useCallback(() => {
        setHelpVisible(false)
    }, [])

    const handleBatteryCheck = useCallback(async () => {
        if (!bleDevice || !bleDevice.connected) return
        try {
            const batteryLevelValue = await bleSession?.execute(commandRegistry.battery)
            if (batteryLevelValue) {
                setBatteryLevel(batteryLevelValue)
            }
        } catch (error) {
            logError('Battery check failed:', error)
            Alert.alert('Error', 'Failed to check battery level')
        }
    }, [bleDevice, bleSession])  

    const handleSdCardCheck = useCallback(async () => {
        if (!bleDevice || !bleDevice.connected) return
        try {
            // SHADOW MODE: Try new architecture
            if (bleSession) {
                try {
                    const sdStatus = await checkSdCard(bleSession)
                    setSdCardStatus({ total: sdStatus.totalSpaceMb, free: sdStatus.freeSpaceMb })
                    return
                } catch (err: any) {
                    if (err.message.includes('AI NACK')) {
                         Alert.alert('AI Coprocessor Error', 'The camera module is not responding.', [{ text: 'OK' }])
                         return
                    }
                    // Proceed to selftest fallback block if normal check failed
                    const statusStr = await bleSession?.execute<string>(commandRegistry.selftest)
                    const hexBits = extractErrorBits(statusStr)
                    // eslint-disable-next-line no-bitwise
                    if (hexBits && (parseInt(hexBits, 16) & 0x0800)) {
                        Alert.alert('No SD Card Detected', 'The device reports no SD card is inserted.', [{ text: 'OK' }])
                        setSdCardStatus(null)
                        return
                    }
                    throw err; // Re-throw if it wasn't the SD card bit
                }
            }
        } catch (error) {
            logError('SD card check failed:', error)
            Alert.alert('Error', 'Failed to check SD card status')
        }
    }, [bleSession]) // eslint-disable-line react-hooks/exhaustive-deps



    return {
        formState, submitting, project, availableProjects, captureMethodName, sensitivityLabel,
        device, bleDevice, isInitializing, initProgress, initStep, initErrors,
        finishProgress, finishStep, finishLogs, isFinishing, isStartSuccess,
        isMonitoring, handleMonitorDisconnect,
        isNavigatingAway, handleImageCaptured, handleNotesChange, handleProjectChange,
        handleCameraHeightChange, handleStartDeployment, handleFinishDismiss,
        helpVisible, helpTitle, helpContent, showHelp, handleDismissHelp,
        // Dropdown & Additional Location State
        locationName, setLocationName, availableLocations, isCustomLocation, setIsCustomLocation,
        // Advanced Settings Exports
        batteryLevel, sdCardStatus,
        handleBatteryCheck, handleSdCardCheck,
        // DFU control
        isDfuInProgress,
    }
}
