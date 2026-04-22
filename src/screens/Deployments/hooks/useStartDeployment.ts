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
import { useBleSession } from '../../../hooks/useBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import { checkSdCard as newCheckSdCardWorkflow } from '../../../ble/workflows/checkSdCard'
import { useBleActions } from '../../../providers/BleEngineProvider'
import { useDeploymentConfiguration } from '../../../hooks/useDeploymentConfiguration'
import { useBle } from '../../../hooks/useBle'
import { useGPSLocation } from '../../../hooks/useGPSLocation'
import BleManager, { Peripheral } from 'react-native-ble-manager'
import { PermissionsAndroid, Platform } from 'react-native'
import { DfuService } from '../../../services/DfuService'
import FirmwareService from '../../../services/FirmwareService'
import Firmware from '../../../database/models/Firmware'
import { extractErrorBits } from '../../../ble/messageClassifier'
// unused import
import { log, logError, logWarn } from '../../../utils/logger'
import { selectCurrentOrganisation } from '../../../redux/slices/authSlice'
import { ProjectWithDetails } from '../../../types/project'
import { InitPayload } from '../../../navigation/types'
import { calculateDistance } from '../../../utils/gpsUtils'

// const INITIALIZATION_GUARD_TIMEOUT = 2000

/**
 * Scans for the Nordic DFU booth loader which advertises as "DfuTarg"
 */
const scanForBootloader = (timeoutMs: number = 10000): Promise<string | null> => {
    return new Promise((resolve, reject) => {
        let timeoutHandle: NodeJS.Timeout

        const eventEmitter = BleManager.addListener('BleManagerDiscoverPeripheral', (peripheral: Peripheral) => {
            log('[scanForBootloader] Discovered:', peripheral.name, peripheral.id)
            if (peripheral.name === 'WW500_DFU' || peripheral.name === 'DfuTarg') {
                log('[scanForBootloader] Found bootloader at:', peripheral.id)
                BleManager.stopScan().catch(err => logWarn('Failed to stop scan:', err))
                clearTimeout(timeoutHandle)
                eventEmitter.remove()
                resolve(peripheral.id)
            }
        })

        BleManager.scan([], timeoutMs / 1000)
            .then(() => log('[scanForBootloader] Scan started for DfuTarg'))
            .catch(err => {
                logError('[scanForBootloader] Scan failed:', err)
                clearTimeout(timeoutHandle)
                eventEmitter.remove()
                reject(err)
            })

        timeoutHandle = setTimeout(() => {
            log('[scanForBootloader] Scan timeout, bootloader not found')
            BleManager.stopScan().catch(err => logWarn('Failed to stop scan:', err))
            eventEmitter.remove()
            resolve(null)
        }, timeoutMs)

        eventEmitter.remove = ((originalRemove) => () => {
             clearTimeout(timeoutHandle)
             originalRemove()
        })(eventEmitter.remove)
    })
}

/**
 * Scans for the original device after DFU reboot
 */
const scanForOriginalDevice = (deviceId: string, timeoutMs: number = 10000): Promise<string | null> => {
    return new Promise((resolve, reject) => {
        let timeoutHandle: NodeJS.Timeout

        const eventEmitter = BleManager.addListener('BleManagerDiscoverPeripheral', (peripheral: Peripheral) => {
            if (peripheral.id === deviceId) {
                 log('[scanForOriginalDevice] Found original device:', peripheral.id)
                 BleManager.stopScan().catch(err => logWarn('Failed to stop scan:', err))
                 clearTimeout(timeoutHandle)
                 eventEmitter.remove()
                 resolve(peripheral.id)
            }
        })

        BleManager.scan([], timeoutMs / 1000)
            .then(() => log('[scanForOriginalDevice] Scan started for:', deviceId))
            .catch(err => {
                logError('[scanForOriginalDevice] Scan failed:', err)
                clearTimeout(timeoutHandle)
                eventEmitter.remove()
                reject(err)
            })

        timeoutHandle = setTimeout(() => {
            log('[scanForOriginalDevice] Scan timeout')
            BleManager.stopScan().catch(err => logWarn('Failed to stop scan:', err))
            eventEmitter.remove()
            resolve(null)
        }, timeoutMs)
    })
}

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
    const { connectDevice, disconnectDevice } = useBle()
    
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
    const [latestBleFirmware, setLatestBleFirmware] = useState<Firmware | null>(null)
    const [latestHimaxFirmware, setLatestHimaxFirmware] = useState<Firmware | null>(null)
    const [deviceFirmwareVersion, setDeviceFirmwareVersion] = useState<string | null>(initPayload?.deviceFirmwareVersion || null)
    const [bleFirmwareUpdateAvailable, setBleFirmwareUpdateAvailable] = useState(initPayload?.bleFirmwareUpdateAvailable || false)
    const [firmwareUpdateProgress, setFirmwareUpdateProgress] = useState<number>(0)
    const [isUpdatingFirmware, setIsUpdatingFirmware] = useState(false)
    const [isCheckingFirmware, setIsCheckingFirmware] = useState(false)
    const [isVerifyingUpdate, setIsVerifyingUpdate] = useState(false)
    const [firmwareUpdateStatus, setFirmwareUpdateStatus] = useState<string>('')
    
    // Refs for DFU
    const isDfuInProgress = useRef(false)
    const isReconnectingAfterDfu = useRef(false)

    // Himax Firmware State
    const [himaxFirmwareVersion, setHimaxFirmwareVersion] = useState<string | null>(initPayload?.himaxFirmwareVersion || null)
    const [isHimaxUpdating, setIsHimaxUpdating] = useState(false)
    const [himaxUpdateProgress, setHimaxUpdateProgress] = useState('')
    const [isCheckingHimaxVersion, setIsCheckingHimaxVersion] = useState(false)

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

    // Fetch latest firmwares from the local database
    useEffect(() => {
        const fetchLatestFirmwares = async () => {
            try {
                const latestBle = await ReferenceDataService.getLatestFirmware('ble')
                setLatestBleFirmware(latestBle)
                log('[Deployment] Latest BLE firmware loaded:', latestBle?.version || 'none found')

                const latestHimax = await ReferenceDataService.getLatestFirmware('himax')
                setLatestHimaxFirmware(latestHimax)
                log('[Deployment] Latest Himax firmware loaded:', latestHimax?.version || 'none found')
            } catch (e) {
                logWarn('[Deployment] Failed to load latest firmwares:', e)
            }
        }
        fetchLatestFirmwares()
    }, [])

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

            if (deviceFirmwareVersion) {
                addFinishLog('Resolving firmware ID...')
                const resolvedId = await FirmwareService.getFirmwareIdByVersion('ble', deviceFirmwareVersion)
                if (resolvedId) {
                    bleFirmwareId = resolvedId
                }
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
    }, [formState.cameraHeight, formState.notes, bleDevice, project, user, deviceId, startConfigure, addFinishLog, batteryLevel, device?.deviceEui, deviceFirmwareVersion, gpsLocation, locationName, sdCardStatus?.free, sdCardStatus?.total]) // eslint-disable-line react-hooks/exhaustive-deps

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
                    const sdStatus = await newCheckSdCardWorkflow(bleSession)
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

    const handleFirmwareCheck = useCallback(async () => {
        if (!bleDevice || !bleDevice.connected) return
        try {
            setIsCheckingFirmware(true)
            setDeviceFirmwareVersion(null)
            const response = await bleSession?.execute(commandRegistry.version)
            if (response) setDeviceFirmwareVersion(response)
            setIsCheckingFirmware(false)
        } catch (error) {
            setIsCheckingFirmware(false)
            Alert.alert('Error', 'Failed to check firmware version')
        }
    }, [bleDevice]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleBleFirmwareUpdate = useCallback(async () => {
        if (!latestBleFirmware || !device || !bleDevice) return
        const isLowBattery = batteryLevel !== null && batteryLevel < 30
        const batteryWarning = isLowBattery
            ? "\n\n⚠️ WARNING: Battery is low. Updating with low battery increases the risk of device failure."
            : "\n\nMake sure the device battery is above 30%."

        Alert.alert(
            'Update BLE Firmware',
            `This will update the BLE firmware to version ${latestBleFirmware.version}. The process takes 2-3 minutes.${batteryWarning}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Update',
                    onPress: async () => {
                        try {
                            setIsUpdatingFirmware(true)
                            setFirmwareUpdateStatus('Preparing update...')
                            isDfuInProgress.current = true
                            setFirmwareUpdateProgress(0)

                            const localUri = await FirmwareService.ensureFirmwareDownloaded(latestBleFirmware)

                            if (bleDevice.connected) {
                                setFirmwareUpdateStatus('Switching to DFU mode...')
                                try {
                                    await bleSession?.execute(commandRegistry.dfu)
                                    await new Promise(r => setTimeout(r, 500))
                                    try { await bleSession?.execute(commandRegistry.disconnect) } catch(e) {} finally { await disconnectDevice(bleDevice) }
                                    await new Promise(r => setTimeout(r, 5000))
                                } catch (e) {
                                    logWarn('[Deployment DFU] Failed DFU command:', e)
                                }
                            }

                            if (Platform.OS === 'android' && Platform.Version >= 33) {
                                try {
                                    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
                                    if (granted !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Notification permission required')
                                } catch (permErr) {}
                            }

                            setFirmwareUpdateStatus('Searching for bootloader...')
                            const bootloaderAddress = await scanForBootloader(10000)
                            if (!bootloaderAddress) throw new Error('Bootloader not found.')

                            setFirmwareUpdateStatus('Updating firmware...')
                            await DfuService.startDFU(bootloaderAddress, localUri, (progress) => {
                                setFirmwareUpdateProgress(progress)
                                if (progress > 95) setFirmwareUpdateStatus('Finalizing update...')
                            })

                            setFirmwareUpdateProgress(100)
                            setFirmwareUpdateStatus('Rebooting device...')
                            setDeviceFirmwareVersion(null)
                            setIsCheckingFirmware(true)
                            setIsVerifyingUpdate(true)
                            setBleFirmwareUpdateAvailable(false)

                            isReconnectingAfterDfu.current = true
                            isDfuInProgress.current = false
                            
                            await new Promise(r => setTimeout(r, 6000))

                            setFirmwareUpdateStatus('Reconnecting...')
                            
                            try {
                                const foundId = await scanForOriginalDevice(bleDeviceId!, 20000)
                                if (foundId && bleDevice) {
                                    setFirmwareUpdateStatus('Connecting...')
                                    await connectDevice(bleDevice, 20000)
                                    await new Promise(r => setTimeout(r, 2000))
                                    setFirmwareUpdateStatus('Verifying version...')
                                    handleFirmwareCheck()
                                } else {
                                    throw new Error('Device not found after DFU reboot')
                                }
                            } catch (reconnectErr) {
                                setIsVerifyingUpdate(false)
                                setDeviceFirmwareVersion(null)
                                Alert.alert(
                                    'Reconnect Failed', 
                                    'Failed to auto reconnect. Please reconnect manually.', 
                                    [{ 
                                        text: 'OK',
                                        onPress: () => {
                                            isNavigatingAway.current = true
                                            navigation.navigate('DeviceDiscovery')
                                        }
                                    }]
                                )
                            }
                        } catch (error) {
                            Alert.alert('Update Failed', error instanceof Error ? error.message : 'Unknown error')
                        } finally {
                            isReconnectingAfterDfu.current = false
                            setIsUpdatingFirmware(false)
                            isDfuInProgress.current = false
                            setFirmwareUpdateStatus('')
                        }
                    }
                }
            ]
        )
    }, [latestBleFirmware, device, bleDevice, bleDeviceId, batteryLevel, handleFirmwareCheck, connectDevice, navigation]) // eslint-disable-line react-hooks/exhaustive-deps

    // --- Himax Firmware Handlers ---

    const handleHimaxFirmwareCheck = useCallback(async () => {
        if (!bleDevice || !bleDevice.connected) return
        try {
            setIsCheckingHimaxVersion(true)
            const response = await bleSession?.execute(commandRegistry.aiver)
            if (response) {
                setHimaxFirmwareVersion(response)
                log('[Deployment] Himax firmware version:', response)
            }
        } catch (error) {
            logError('[Deployment] Himax version check failed:', error)
            Alert.alert('Error', 'Failed to check Himax firmware version')
        } finally {
            setIsCheckingHimaxVersion(false)
        }
    }, [bleDevice]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleHimaxFirmwareUpdate = useCallback(async () => {
        if (!bleDevice || !bleDevice.connected) return

        const isLowBattery = batteryLevel !== null && batteryLevel < 30
        const batteryWarning = isLowBattery
            ? "\n\n⚠️ WARNING: Battery is low. Updating with low battery increases the risk of device failure."
            : ""

        Alert.alert(
            'Update Himax Firmware',
            `This will flash the firmware image from the SD card (output.img in /MANIFEST/).\n\nEnsure the correct firmware file is on the SD card before proceeding.\n\nThe process takes 20-30 seconds.${batteryWarning}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Update',
                    onPress: async () => {
                        try {
                            setIsHimaxUpdating(true)
                            setHimaxUpdateProgress('Sending firmware flash command...')

                            const success = await bleSession!.execute(() => commandRegistry.aifirmware('output.img'))

                            if (success) {
                                setHimaxUpdateProgress('Firmware flashed! Sending reset...')

                                try {
                                    await bleSession?.execute(commandRegistry.reset)
                                    await new Promise(r => setTimeout(r, 500))
                                    try { await bleSession?.execute(commandRegistry.disconnect) } catch(e) {} finally { await disconnectDevice(bleDevice) }
                                } catch (resetErr) {
                                    logWarn('[Deployment] Reset/disconnect after Himax update:', resetErr)
                                }

                                setHimaxUpdateProgress('Rebooting device...')
                                isReconnectingAfterDfu.current = true
                                await new Promise(r => setTimeout(r, 8000))

                                setHimaxUpdateProgress('Reconnecting...')
                                try {
                                    const foundId = await scanForOriginalDevice(bleDeviceId!, 20000)
                                    if (foundId && bleDevice) {
                                        setHimaxUpdateProgress('Connecting...')
                                        await connectDevice(bleDevice, 20000)
                                        await new Promise(r => setTimeout(r, 2000))
                                        setHimaxUpdateProgress('Verifying new version...')
                                        await handleHimaxFirmwareCheck()
                                        Alert.alert('Success', 'Himax firmware updated successfully!')
                                    } else {
                                        throw new Error('Device not found after reboot')
                                    }
                                } catch (reconnectErr) {
                                    Alert.alert(
                                        'Reconnect Failed',
                                        'Firmware was flashed but failed to reconnect. Please reconnect manually.',
                                        [{
                                            text: 'OK',
                                            onPress: () => {
                                                isNavigatingAway.current = true
                                                navigation.navigate('DeviceDiscovery')
                                            }
                                        }]
                                    )
                                }
                            } else {
                                throw new Error('Unexpected response from device during firmware update')
                            }
                        } catch (error) {
                            logError('[Deployment] Himax firmware update failed:', error)
                            Alert.alert('Update Failed', error instanceof Error ? error.message : 'Unknown error')
                        } finally {
                            isReconnectingAfterDfu.current = false
                            setIsHimaxUpdating(false)
                            setHimaxUpdateProgress('')
                        }
                    }
                }
            ]
        )
    }, [bleDevice, bleDeviceId, batteryLevel, connectDevice, navigation, handleHimaxFirmwareCheck, bleSession]) // eslint-disable-line react-hooks/exhaustive-deps

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
        batteryLevel, sdCardStatus, latestBleFirmware, deviceFirmwareVersion,
        bleFirmwareUpdateAvailable, firmwareUpdateProgress, isUpdatingFirmware,
        isCheckingFirmware, isVerifyingUpdate, firmwareUpdateStatus,
        handleBatteryCheck, handleSdCardCheck, handleFirmwareCheck, handleBleFirmwareUpdate,
        // Himax Firmware Exports
        latestHimaxFirmware, himaxFirmwareVersion, isHimaxUpdating, himaxUpdateProgress, isCheckingHimaxVersion,
        handleHimaxFirmwareCheck, handleHimaxFirmwareUpdate
    }
}
