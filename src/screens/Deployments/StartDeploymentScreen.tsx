import { useState, useEffect, useCallback, useRef } from 'react'
import { StyleSheet, View, Alert } from 'react-native'
import { useAppSelector } from '../../redux'
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWButton } from '../../components/ui/WWButton'
import { RootStackParamList } from '../../navigation/types'
import { DevicePreparationService } from '../../services/DevicePreparationService'
import { DeploymentService } from '../../services/DeploymentService'
import ProjectService from '../../services/ProjectService'
import ReferenceDataService from '../../services/ReferenceDataService'
import { Card, Text, Button, useTheme } from 'react-native-paper'
import { WWIcon } from '../../components/ui/WWIcon'
import { InitializationHeader } from '../Devices/components/InitializationHeader'
import Device from '../../database/models/Device'
import { DeviceService } from '../../services/DeviceService'

import { useBleCommands } from '../../hooks/useBleCommands'
import { useBleInitialization } from '../../hooks/useBleInitialization'
import { useBleActions } from '../../providers/BleEngineProvider'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { LoRaWANSection } from './components/LoRaWANSection'
import { CameraViewSection } from './components/CameraViewSection'
import { LocationSection } from './components/LocationSection'
import { MetadataSection } from './components/MetadataSection'
import { HelpDialog } from '../../components/ui/HelpDialog'
import { FinishProgressDialog } from '../Devices/components/FinishProgressDialog'

import { useDeploymentConfiguration } from '../../hooks/useDeploymentConfiguration'
import { log, logError, logWarn } from '../../utils/logger'


type DeploymentDetailsRouteProp = RouteProp<RootStackParamList, 'DeploymentDetailsStep'>;

const INITIALIZATION_GUARD_TIMEOUT = 2000;

export const DeploymentDetailsStep = () => {
    const theme = useTheme()
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
    const route = useRoute<DeploymentDetailsRouteProp>()

    const { devicePreparationId, deviceId, bleDeviceId } = route.params || {}

    // Selectors
    const devices = useAppSelector(state => state.devices)
    const bleDevice = devices[bleDeviceId]
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
            // Optimization: Prevent re-render if location hasn't meaningfully changed
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
            
            // Step 2: Standard Initialization (Set UTC, Check Hardware)
            // This reuses the shared hook for consistency
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

            // Mark initialization as done
            setTimeout(() => {
                setIsInitializing(false)
            }, INITIALIZATION_GUARD_TIMEOUT)
        }

        initializeDevice()
    }, [bleDevice, runBleStandardInit, navigation])






    const loadPreparationAndProject = useCallback(async () => {
        try {
            log('[DeploymentDetails] Loading preparation:', devicePreparationId);
            
            // Parallel load
            const [prep, deviceData] = await Promise.all([
                DevicePreparationService.getPreparationById(devicePreparationId as string),
                DeviceService.getDeviceById(deviceId)
            ])
            
            // setPreparation(prep) - Unused state removed
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
                    const method = methods.find(m => m.id === proj.capture_method_id)
                    log('[DeploymentDetails] Method resolved:', method?.value);
                    setCaptureMethodName(method ? method.value : 'Unknown')

                    if (proj.activity_detection_sensitivity_id) {
                        const sensitivities = await ReferenceDataService.getActivitySensitivity()
                        const sensitivity = sensitivities.find(s => s.id === proj.activity_detection_sensitivity_id)
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



    // Navigation Interceptor: Handle Back Button / Gesture
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            // If already navigating away intentionally (e.g. to Edit, or via our own redirect), allow it.
            if (isNavigatingAway.current) {
                return
            }

            // Only intercept exiting actions (GO_BACK, POP)
            // Note: In some navigators, 'POP' is the action type.
            const actionType = e.data.action.type;
            if (actionType === 'GO_BACK' || actionType === 'POP') {
                // Prevent default behavior (which would just pop to DeviceDiscovery)
                e.preventDefault()

                log('[Deployment] Intercepting back navigation. Disconnecting and redirecting to Deployments.')
                
                // Mark as properly navigating away to suppress connection lost alerts
                isNavigatingAway.current = true

                // 1. Disconnect Device
                if (bleDevice) {
                    runDisconnect(bleDevice).catch(err => logWarn('[Deployment] Auto-disconnect failed:', err))
                }

                // 2. Redirect to Deployments Screen/Tab
                // We use a small timeout or immediate navigation? Immediate is fine.
                // Cast to any to avoid strict type checking on route names if needed
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

        // Connection Sanity Check
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

        // Reset and Show Progress Dialog
        setIsFinishing(true)
        setSubmitting(true) // Pause heartbeat
        setFinishProgress(0)
        setFinishStep('Starting deployment...')
        setFinishLogs([])
        setIsStartSuccess(false)
        isStartDeploymentInProgress.current = true // Suppress disconnect alerts

        try {
            addFinishLog('Performing final time check...')
            setFinishStep('Checking time...')
            setFinishProgress(0.1)
            
            if (bleDevice) await setUtc(bleDevice)
            addFinishLog('Time check complete')

            // 2. Call DeploymentService.createDeployment
            addFinishLog('Creating deployment record...')
            setFinishStep('Creating record...')
            setFinishProgress(0.3)

            const newDeployment = await DeploymentService.createDeployment({
                name: formState.name,
                projectId: project.id,
                deviceId: deviceId as string,
                devicePreparationId: devicePreparationId,
                setupBy: user.id,

                // Location & Metadata
                locationName: formState.locationName || 'User Location',
                locationDescription: formState.locationDescription,
                cameraHeight: formState.cameraHeight ? parseFloat(formState.cameraHeight) : undefined,

                latitude: formState.location.latitude,
                longitude: formState.location.longitude,
                altitude: formState.location.altitude,
                accuracy: formState.location.accuracy,

                // Pass capture method ID from project
                captureMethodId: project.capture_method_id,

                startComments: formState.notes,
                cameraImagePaths: [], // Photos deferred
            })
            addFinishLog(`Deployment created: ${newDeployment.id.substring(0, 8)}...`)

            // 3. Configure Device (Deployment ID + Capture Settings)
            addFinishLog('Configuring device settings...')
            setFinishStep('Configuring device...')
            setFinishProgress(0.5)
            
            log('[Deployment] Configuring device via standardized hook...')
            try {
                // Determine capture method
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
                // We continue to enable camera/disconnect as best effort
            }





            // 6. Flash Green LED (Success Confirmation)
            // Re-enabled by user request (3 flashes, 300ms each = ~1s total)
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

            // 7. Disconnect
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

            // 8. Success State
            setFinishStep('Complete')
            setFinishProgress(1.0)
            setIsStartSuccess(true)
            addFinishLog('Deployment started successfully')

        } catch (error) {
            logError('Deployment failed:', error)
            setIsFinishing(false) // Hide dialog on error to show alert
            Alert.alert('Error', 'Failed to start deployment: ' + (error as any).message)
            isStartDeploymentInProgress.current = false // Re-enable alerts on failure
        }
    }, [formState.name, formState.locationName, formState.locationDescription, formState.cameraHeight, formState.location, formState.notes, bleDevice, project, user, deviceId, devicePreparationId, captureMethodName, runDisconnect, startConfigure, addFinishLog, flashLed])

    const handleFinishDismiss = useCallback(() => {
        setIsFinishing(false)
        if (isStartSuccess) {
             isNavigatingAway.current = true
            // Properly typed navigation
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

    const renderProjectSettingsLeft = useCallback((props: any) => <WWIcon {...props} source="tune" />, [])
    const renderProjectSettingsRight = useCallback((props: any) => (
        <Button {...props} icon="help-circle-outline" onPress={() => showHelp('Project settings', 'Project and Capture Method are set during Project Creation and Device Preparation. To change these, you must restart the preparation.')}>
            Help
        </Button>
    ), [showHelp])


    // Sanity Check: Ensure required params are present
    if (!devicePreparationId) {
        return (
            <WWScreenView>
                <View style={styles.errorContainer}>
                    <Text variant="headlineMedium" style={styles.errorTitle}>Error</Text>
                    <Text variant="bodyLarge" style={styles.errorMessage}>
                        Missing Device Preparation ID. Unable to proceed with deployment.
                    </Text>
                    <Button mode="contained" onPress={() => navigation.goBack()}>
                        Go Back
                    </Button>
                </View>
            </WWScreenView>
        )
    }




    return (
        <WWScreenView style={styles.screenView}>
            <View style={styles.container}>
                {/* Device Synchronization Header */}
                {(device || bleDevice) && (
                    <InitializationHeader
                        device={device || { name: bleDevice?.name || 'Device', bluetoothId: bleDeviceId } as any}
                        isInitializing={isInitializing}
                        initProgress={initProgress}
                        initStep={initStep}
                        initErrors={initErrors}
                        theme={theme}
                    />
                )}

                {/* Project & Configuration Header */}
                <Card style={styles.card}>
                    <Card.Title
                        title="Project settings"
                        left={renderProjectSettingsLeft}
                        right={renderProjectSettingsRight}
                    />
                    <Card.Content>
                        <View style={styles.infoRow}>
                            <Text variant="labelMedium">Project:</Text>
                            <Text variant="bodyLarge">{project ? project.name : 'Loading...'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text variant="labelMedium">Capture Method:</Text>
                            <Text variant="bodyLarge">{captureMethodName || 'Loading...'}</Text>
                        </View>
                        {project?.capture_method_id === 1 && sensitivityLabel ? (
                            <View style={styles.infoRow}>
                                <Text variant="labelMedium">Motion Sensitivity:</Text>
                                <Text variant="bodyLarge">{sensitivityLabel}</Text>
                            </View>
                        ) : project?.capture_method_id === 2 && project?.timelapse_interval_seconds ? (
                            <View style={styles.infoRow}>
                                <Text variant="labelMedium">Time-lapse Interval:</Text>
                                <Text variant="bodyLarge">{project.timelapse_interval_seconds}s</Text>
                            </View>
                        ) : null}

                        <Button
                            mode="outlined"
                            onPress={() => {
                                isNavigatingAway.current = true
                                    ; navigation.navigate('PrepareAndTest', {
                                        deviceId,
                                        bleDeviceId,
                                        nextRoute: 'DeploymentDetailsStep'
                                    })
                            }}
                            style={styles.editButton}
                            icon="cog"
                        >
                            Edit Device Preparation
                        </Button>
                    </Card.Content>
                </Card>

                <LoRaWANSection
                    device={bleDevice}
                    onShowHelp={showHelp}
                />

                <CameraViewSection
                    device={bleDevice}
                    onImageCaptured={handleImageCaptured}
                    onShowHelp={showHelp}
                />

                <LocationSection
                    onLocationChange={handleLocationChange}
                    onShowHelp={showHelp}
                />

                <MetadataSection
                    name={formState.name}
                    notes={formState.notes}
                    locationDescription={formState.locationDescription}
                    cameraHeight={formState.cameraHeight}
                    onNameChange={handleNameChange}
                    onNotesChange={handleNotesChange}
                    onLocationDescriptionChange={handleLocationDescriptionChange}
                    onCameraHeightChange={handleCameraHeightChange}
                    onShowHelp={showHelp}
                />

                <View style={styles.footer}>
                    <WWButton
                        mode="contained"
                        onPress={handleStartDeployment}
                        loading={submitting}
                        style={styles.deployButton}
                    >
                        Start Deployment
                    </WWButton>
                </View>
            </View>

            <HelpDialog
                visible={helpVisible}
                title={helpTitle}
                content={helpContent}
                onDismiss={handleDismissHelp}
            />

            <FinishProgressDialog
                visible={isFinishing}
                progress={finishProgress}
                step={finishStep}
                logs={finishLogs}
                isComplete={isStartSuccess}
                onDismiss={handleFinishDismiss}
                loadingTitle="Starting Deployment"
                successTitle="Deployment Complete"
            />
        </WWScreenView>
    )
}

const styles = StyleSheet.create({
    screenView: {
        paddingTop: 0
    },
    container: {
        flex: 1,
        gap: 16,
        // padding: 16 // Removed to avoid double padding with WWScreenView
    },
    footer: {
        marginTop: 24,
        marginBottom: 32
    },
    deployButton: {
        paddingVertical: 8
    },
    card: {
        // marginBottom: 16 // Removed to avoid double spacing with container gap
    },
    infoRow: {
        marginBottom: 4
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16
    },
    errorTitle: {
        marginBottom: 16
    },
    errorMessage: {
        marginBottom: 24,
        textAlign: 'center'
    },
    editButton: {
        marginTop: 12
    }
})
