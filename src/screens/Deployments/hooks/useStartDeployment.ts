import { useState, useEffect, useCallback, useRef } from 'react'
import { Alert } from 'react-native'
import { useAppSelector } from '../../../redux'
import { useFocusEffect } from '@react-navigation/native'
import { DevicePreparationService } from '../../../services/DevicePreparationService'
import { DeploymentService } from '../../../services/DeploymentService'
import ProjectService from '../../../services/ProjectService'
import ReferenceDataService from '../../../services/ReferenceDataService'
import Device from '../../../database/models/Device'
import { DeviceService } from '../../../services/DeviceService'
import { useBleCommands } from '../../../hooks/useBleCommands'
import { useBleInitialization } from '../../../hooks/useBleInitialization'
import { useBleActions } from '../../../providers/BleEngineProvider'
import { useDeploymentConfiguration } from '../../../hooks/useDeploymentConfiguration'
import { log, logError, logWarn } from '../../../utils/logger'

const INITIALIZATION_GUARD_TIMEOUT = 2000

interface UseStartDeploymentParams {
    deviceId?: string
    bleDeviceId?: string
    devicePreparationId?: string
    navigation: any
}

export const useStartDeployment = ({
    deviceId,
    bleDeviceId,
    devicePreparationId,
    navigation
}: UseStartDeploymentParams) => {
    // Selectors
    const devices = useAppSelector(state => state.devices)
    const bleDevice = devices[bleDeviceId || '']
    const user = useAppSelector(state => state.authentication.user)

    // BLE Hooks
    const { setUtc, runDisconnect, flashLed } = useBleCommands()
    const { initialize: runBleStandardInit } = useBleInitialization()
    const { configure: startConfigure } = useDeploymentConfiguration()
    useBleActions()

    const [formState, setFormState] = useState({
        name: '',
        notes: '',
        locationDescription: '',
        cameraHeight: '',
        locationName: 'User Location',
        location: {
            latitude: 0,
            longitude: 0,
            altitude: 0,
            accuracy: 0
        },
        testImagePath: undefined as string | undefined
    })

    const [submitting, setSubmitting] = useState(false)
    const [project, setProject] = useState<any>(null)
    const [captureMethodName, setCaptureMethodName] = useState<string>('')
    const [sensitivityLabel, setSensitivityLabel] = useState<string>('')
    
    // UI State for Initialization Header
    const [device, setDevice] = useState<Device | undefined>()
    const [isInitializing, setIsInitializing] = useState(true)
    const [initProgress, setInitProgress] = useState(0)
    const [initStep, setInitStep] = useState('')
    const [initErrors, setInitErrors] = useState<{ selftest?: string; setUtc?: string; deviceHealth?: string[] }>({})

    // UI State for Deployment Progress Dialog
    const [finishProgress, setFinishProgress] = useState(0)
    const [finishStep, setFinishStep] = useState('')
    const [finishLogs, setFinishLogs] = useState<string[]>([])
    const [isFinishing, setIsFinishing] = useState(false)
    const [isStartSuccess, setIsStartSuccess] = useState(false)

    const addFinishLog = useCallback((message: string) => {
        setFinishLogs(prev => [...prev, message])
    }, [])

    // Connection Guard Refs
    const isNavigatingAway = useRef(false)
    const isStartDeploymentInProgress = useRef(false)

    // Standard BLE initialization plus initialization guard
    const hasRunInitialization = useRef(false)
    const bleDeviceRef = useRef(bleDevice)

    
    // Memoized handlers to prevent infinite loops in child components
    const handleLocationChange = useCallback((loc: any) => {
        setFormState(prev => {
            if (
                prev.location.latitude === loc.latitude &&
                prev.location.longitude === loc.longitude &&
                prev.location.altitude === loc.altitude &&
                prev.location.accuracy === loc.accuracy
            ) {
                return prev
            }
            return { ...prev, location: loc }
        })
    }, [])

    const handleImageCaptured = useCallback((path: string) => {
        setFormState(prev => ({ ...prev, testImagePath: path }))
    }, [])

    const handleNameChange = useCallback((name: string) => {
        setFormState(prev => ({ ...prev, name }))
    }, [])

    const handleNotesChange = useCallback((notes: string) => {
        setFormState(prev => ({ ...prev, notes }))
    }, [])

    const handleLocationDescriptionChange = useCallback((text: string) => {
        setFormState(prev => ({ ...prev, locationDescription: text }))
    }, [])

    const handleCameraHeightChange = useCallback((text: string) => {
        setFormState(prev => ({ ...prev, cameraHeight: text }))
    }, [])

    useEffect(() => {
        bleDeviceRef.current = bleDevice
    }, [bleDevice])

    useEffect(() => {
        const initializeDevice = async () => {
            if (!bleDevice?.connected || hasRunInitialization.current) return
            hasRunInitialization.current = true
            setIsInitializing(true)
            
            setInitStep('Initializing...')
            setInitProgress(0.2)
            log('[Deployment] Step 2: Running standard BLE initialization...')
            
            const result = await runBleStandardInit(bleDevice, {
                onProgress: (step: string, progress: number) => {
                    setInitStep(step)
                    setInitProgress(0.2 + (progress * 0.8)) // Scale progress
                }
            })

            if (!result.success) {
                logWarn('[Deployment] BLE initialization had errors:', result.errors)
                setInitErrors({
                    setUtc: result.errors.setUtc,
                    deviceHealth: result.errors.deviceHealth
                })
            } else {
                 log('[Deployment] Initialization complete. Time set and hardware verified.')
            }

            setTimeout(() => {
                setIsInitializing(false)
            }, INITIALIZATION_GUARD_TIMEOUT)
        }

        initializeDevice()
    }, [bleDevice, runBleStandardInit])

    const loadPreparationAndProject = useCallback(async () => {
        try {
            log('[DeploymentDetails] Loading preparation:', devicePreparationId);
            
            const [prep, deviceData] = await Promise.all([
                DevicePreparationService.getPreparationById(devicePreparationId as string),
                DeviceService.getDeviceById(deviceId as string)
            ])
            
            setDevice(deviceData)
            log('[DeploymentDetails] Prep loaded:', prep?.id, 'projectId:', prep?.projectId);

            if (prep && prep.projectId) {
                log('[DeploymentDetails] Loading project:', prep.projectId);
                const proj = await ProjectService.getProjectById(prep.projectId)
                log('[DeploymentDetails] Project loaded:', proj?.name, 'capture_method_id:', proj?.capture_method_id);
                setProject(proj)

                if (proj && proj.capture_method_id) {
                    log('[DeploymentDetails] Resolving capture method name for ID:', proj.capture_method_id);
                    const methods = await ReferenceDataService.getCaptureMethods()
                    const method = methods.find((m: any) => m.id === proj.capture_method_id)
                    log('[DeploymentDetails] Method resolved:', method?.value);
                    setCaptureMethodName(method ? method.value : 'Unknown')

                    if (proj.activity_detection_sensitivity_id) {
                        const sensitivities = await ReferenceDataService.getActivitySensitivity()
                        const sensitivity = sensitivities.find((s: any) => s.id === proj.activity_detection_sensitivity_id)
                        setSensitivityLabel(sensitivity ? sensitivity.value : 'Unknown')
                    }
                } else {
                    log('[DeploymentDetails] No capture method ID on project');
                    setCaptureMethodName('Not Set')
                }
            } else {
                logWarn('[DeploymentDetails] Prep found but missing projectId');
            }
        } catch (error) {
            logError('[DeploymentDetails] Error in loadPreparationAndProject:', error)
        }
    }, [devicePreparationId, deviceId])

    useFocusEffect(
        useCallback(() => {
            if (devicePreparationId) {
                loadPreparationAndProject()
            }
        }, [devicePreparationId, loadPreparationAndProject])
    )

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
                    runDisconnect(bleDevice).catch((err: any) => logWarn('[Deployment] Auto-disconnect failed:', err))
                }

                navigation.navigate('Home', { initialTab: 'deployment' })
            }
        })

        return unsubscribe
    }, [navigation, bleDevice, runDisconnect])

    // Robust Connection Lost Alert
    useEffect(() => {
        if (!isInitializing && !submitting && bleDevice && !bleDevice.connected && !isNavigatingAway.current && !isStartDeploymentInProgress.current) {
            Alert.alert(
                'Connection Lost',
                'Device disconnected unexpectedly during deployment setup.',
                [{
                    text: 'OK', onPress: () => {
                        isNavigatingAway.current = true
                        navigation.goBack()
                    }
                }]
            )
        }
    }, [bleDevice, submitting, navigation, isInitializing])

    const handleStartDeployment = useCallback(async () => {
        if (!formState.name) {
            Alert.alert('Missing Information', 'Please enter a deployment name')
            return
        }

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
            
            if (bleDevice) await setUtc(bleDevice)
            addFinishLog('Time check complete')

            addFinishLog('Creating deployment record...')
            setFinishStep('Creating record...')
            setFinishProgress(0.3)

            const newDeployment = await DeploymentService.createDeployment({
                name: formState.name,
                projectId: project.id,
                deviceId: deviceId || '',
                devicePreparationId: devicePreparationId || '',
                setupBy: user.id,

                locationName: formState.locationName || 'User Location',
                locationDescription: formState.locationDescription,
                cameraHeight: formState.cameraHeight ? parseFloat(formState.cameraHeight) : undefined,

                latitude: formState.location.latitude,
                longitude: formState.location.longitude,
                altitude: formState.location.altitude,
                accuracy: formState.location.accuracy,

                captureMethodId: project.capture_method_id,

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
                    location: {
                        latitude: formState.location.latitude || 0,
                        longitude: formState.location.longitude || 0,
                        altitude: formState.location.altitude || 0
                    }
                })
                
                addFinishLog('Device configuration successful')
                log('[Deployment] Device configuration successful')

            } catch (configError) {
                logError('[Deployment] Configuration failed:', configError)
                addFinishLog('Configuration warning: Verify settings in console')
            }

            if (bleDevice?.connected) {
                addFinishLog('Flashing confirmation LED...')
                setFinishStep('Signaling success...')
                setFinishProgress(0.9)
                
                try {
                    await flashLed(bleDevice, 'green', 3, 300)
                    addFinishLog('LED signal sent')
                } catch (e) {
                    logWarn('[Deployment] LED flash failed:', e)
                    addFinishLog('Warning: LED signal failed')
                }
            }

            addFinishLog('Disconnecting...')
            setFinishStep('Disconnecting...')
            setFinishProgress(0.95)
            log('[Deployment] Disconnecting device...')
            
            try {
                await runDisconnect(bleDevice)
                addFinishLog('Device disconnected')
                log('[Deployment] Device disconnected')
            } catch (e) {
                logError('[Deployment] Failed to disconnect:', e)
                addFinishLog('Warning: Clean disconnect failed')
            }

            setFinishStep('Complete')
            setFinishProgress(1.0)
            setIsStartSuccess(true)
            addFinishLog('Deployment started successfully')

        } catch (error) {
            logError('Deployment failed:', error)
            setIsFinishing(false)
            Alert.alert('Error', 'Failed to start deployment: ' + (error as any).message)
            isStartDeploymentInProgress.current = false
        }
    }, [formState.name, formState.locationName, formState.locationDescription, formState.cameraHeight, formState.location, formState.notes, bleDevice, project, user, deviceId, devicePreparationId, runDisconnect, startConfigure, addFinishLog, flashLed, setUtc])

    const handleFinishDismiss = useCallback(() => {
        setIsFinishing(false)
        if (isStartSuccess) {
             isNavigatingAway.current = true
             navigation.navigate('Home', { initialTab: 'deployment' })
        }
    }, [isStartSuccess, navigation])

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

    return {
        formState, submitting, project, captureMethodName, sensitivityLabel,
        device, bleDevice, isInitializing, initProgress, initStep, initErrors,
        finishProgress, finishStep, finishLogs, isFinishing, isStartSuccess,
        isNavigatingAway, handleLocationChange, handleImageCaptured,
        handleNameChange, handleNotesChange, handleLocationDescriptionChange,
        handleCameraHeightChange, handleStartDeployment, handleFinishDismiss,
        helpVisible, helpTitle, helpContent, showHelp, handleDismissHelp
    }
}
