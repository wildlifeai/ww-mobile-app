import React, { useState, useEffect, useCallback, useRef } from 'react'
import { StyleSheet, View, Alert } from 'react-native'
import { useAppSelector } from '../../redux'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWButton } from '../../components/ui/WWButton'
import { RootStackParamList } from '../../navigation'
import { DevicePreparationService } from '../../services/DevicePreparationService'
import { DeploymentService } from '../../services/DeploymentService'
import ProjectService from '../../services/ProjectService'
import ReferenceDataService from '../../services/ReferenceDataService'
import { Card, Text, Button } from 'react-native-paper'
import { WWIcon } from '../../components/ui/WWIcon'

import { CommandNames } from '../../ble/types'
import { useBleCommands } from '../../hooks/useBleCommands'
import { useDeviceSettings } from '../../hooks/useDeviceSettings'
import { useBleActions } from '../../providers/BleEngineProvider'

import { LoRaWANSection } from './sections/LoRaWANSection'
import { CameraViewSection } from './sections/CameraViewSection'
import { LocationSection } from './sections/LocationSection'
// import { PhotosSection } from './sections/PhotosSection'
import { MetadataSection } from './sections/MetadataSection'
import { HelpDialog } from '../../components/ui/HelpDialog'
import { useDeviceLatch } from '../../hooks/useDeviceLatch'

type DeploymentDetailsRouteProp = RouteProp<RootStackParamList, 'DeploymentDetailsStep'>;

const INITIALIZATION_GUARD_TIMEOUT = 2000;

export const DeploymentDetailsStep = () => {
    const navigation = useNavigation()
    const route = useRoute<DeploymentDetailsRouteProp>()

    // Params passed from DeviceDiscoveryScreen
    // Params passed from DeviceDiscoveryScreen
    const { devicePreparationId, deviceId, bleDeviceId } = route.params || {}

    // Selectors
    const devices = useAppSelector(state => state.devices)
    const bleDevice = devices[bleDeviceId]
    const logs = useAppSelector(state => state.logs[bleDeviceId] || [])
    const deviceConfig = useAppSelector(state => state.configuration[bleDeviceId])
    const user = useAppSelector(state => state.authentication.user)



    // BLE Hooks
    const { getUtc, setUtc, setDeploymentIdAsOps, enableCamera, runDisconnect, getStatus, setOperationalParam, setGpsLocation } = useBleCommands()
    const { updateSettings } = useDeviceSettings({ device: bleDevice })
    const { triggerDpdLatch } = useDeviceLatch()
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
    const [, setPreparation] = useState<any>(null)
    const [project, setProject] = useState<any>(null)
    const [captureMethodName, setCaptureMethodName] = useState<string>('')
    const [sensitivityLabel, setSensitivityLabel] = useState<string>('')
    const [, setTimeCheckStatus] = useState<'pending' | 'ok' | 'correcting' | 'failed'>('pending')

    // Connection Guard Refs
    const isNavigatingAway = useRef(false)
    const isStartDeploymentInProgress = useRef(false)
    const isInitializing = useRef(true)

    // Mark initialization as done after mount
    useEffect(() => {
        const timer = setTimeout(() => {
            isInitializing.current = false
        }, INITIALIZATION_GUARD_TIMEOUT)
        return () => clearTimeout(timer)
    }, [])

    const validateAndCorrectTime = useCallback(async (timeString: string) => {
        try {
            // value comes from regex group: "2024-01-01T12:00:00Z"
            const deviceTime = new Date(timeString).getTime()
            const phoneTime = new Date().getTime()
            const diff = Math.abs(phoneTime - deviceTime)

            log(`[TimeCheck] Device: ${timeString}, Phone: ${new Date().toISOString()}, Diff: ${diff}ms`)

            if (diff > 5000) { // 5 seconds tolerance
                log('[TimeCheck] Time mismatch. Setting UTC...')
                setTimeCheckStatus('correcting')
                await setUtc(bleDevice)
                // Optionally request verify again?
                setTimeCheckStatus('ok') // Assume success for now
            } else {
                log('[TimeCheck] Time is correct.')
                setTimeCheckStatus('ok')
            }
        } catch (e) {
            logError('[TimeCheck] Parse error:', e)
            setTimeCheckStatus('failed')
        }
    }, [bleDevice, setUtc])

    const checkAndCorrectTime = useCallback(async () => {
        if (!bleDevice) return
        log('[Deployment] Checking device time...')
        try {
            setTimeCheckStatus('pending')
            await getUtc(bleDevice)
        } catch (e) {
            logError('Failed to get UTC:', e)
        }
    }, [bleDevice, getUtc])

    const loadPreparationAndProject = useCallback(async () => {
        try {
            log('[DeploymentDetails] Loading preparation:', devicePreparationId);
            const prep = await DevicePreparationService.getPreparationById(devicePreparationId as string)
            setPreparation(prep)
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
    }, [devicePreparationId])

    useEffect(() => {
        if (devicePreparationId) {
            loadPreparationAndProject()
        }
    }, [devicePreparationId, loadPreparationAndProject])

    // Initial Time Check on Mount
    useEffect(() => {
        if (bleDevice && bleDevice.connected) {
            checkAndCorrectTime()
        }
    }, [bleDevice, checkAndCorrectTime])

    // Check Device Status (Prevent Double Deployment)
    const hasCheckedStatus = React.useRef(false)
    useEffect(() => {
        if (bleDevice?.connected && !hasCheckedStatus.current) {
            log('[Deployment] Checking device status...')
            getStatus(bleDevice)
            hasCheckedStatus.current = true
        }
    }, [bleDevice, getStatus])

    // Monitor Status Response
    const statusValue = deviceConfig?.[CommandNames.status]?.value
    useEffect(() => {
        if (statusValue === 'enabled') {
            log('[Deployment] Device reported active sensor!')
            Alert.alert(
                'Device Already Active',
                'This device appears to be already deployed (Sensor Enabled).\n\nStarting a new deployment will overwrite the current configuration.',
                [
                    {
                        text: 'Cancel',
                        onPress: () => {
                            isNavigatingAway.current = true
                            navigation.goBack()
                        },
                        style: 'cancel'
                    },
                    {
                        text: 'Continue Anyway',
                        onPress: () => log('[Deployment] User chose to continue despite active status'),
                        style: 'destructive'
                    }
                ]
            )
        }
    }, [statusValue, navigation])

    // Time Check Logic
    const utcValue = deviceConfig?.[CommandNames.getutc]?.value
    useEffect(() => {
        if (utcValue) {
            validateAndCorrectTime(utcValue)
        }
    }, [utcValue, validateAndCorrectTime])


    // Robust Connection Lost Alert
    useEffect(() => {
        if (!isInitializing.current && !submitting && bleDevice && !bleDevice.connected && !isNavigatingAway.current && !isStartDeploymentInProgress.current) {
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
    }, [bleDevice, submitting, navigation])

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

        setSubmitting(true)
        isStartDeploymentInProgress.current = true // Suppress disconnect alerts

        // 1. Final Time Check
        log('[Deployment] Performing final time check...')
        await checkAndCorrectTime()
        // Wait 2s to allow BLE round trip / correction
        await new Promise(resolve => setTimeout(resolve, 2000))

        try {
            // 2. Call DeploymentService.createDeployment
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


            // 3. Send Deployment ID to Device via BLE
            log('[Deployment] Sending Deployment ID to device:', newDeployment.id)
            try {
                // Try setting OP20 first to see if device supports it (Feature Detection)
                log('[Deployment] Testing if device supports extended OPs (OP20)...')
                try {
                    const currentLogLength = logs.length
                    await setOperationalParam(bleDevice, 20, '0') // Dummy write

                    // Wait for response to appear in logs
                    await new Promise(r => setTimeout(r, 1500))

                    // Check recent logs for error
                    const recentLogs = logs.slice(currentLogLength)
                    const hasOpError = recentLogs.some(l => l.content.includes('Error: index') || l.content.includes('Error: bits'))

                    if (hasOpError) {
                        log('[Deployment] Device returned error for OP20. Extended OPs likely not supported.')
                        throw new Error('Device rejected OP20')
                    }

                    // If successful, proceed to write actual ID
                    log('[Deployment] Extended OPs supported (no error found). Writing Deployment ID...')

                    let deploymentIdSet = false
                    let attempts = 0
                    while (!deploymentIdSet && attempts < 3) {
                        try {
                            attempts++
                            await setDeploymentIdAsOps(bleDevice, newDeployment.id)
                            log('[Deployment] Deployment ID set successfully on attempt', attempts)
                            deploymentIdSet = true
                        } catch (bleError) {
                            logError(`[Deployment] Failed to set Deployment ID (attempt ${attempts}):`, bleError)
                            if (attempts < 3) await new Promise(r => setTimeout(r, 1000))
                        }
                    }
                    if (!deploymentIdSet) {
                        // Double check logs again just in case valid ops failed
                        const errorCheck = logs.slice(-20).some(l => l.content.includes('Error: index'))
                        if (errorCheck) {
                            throw new Error('Device rejected Extended OPs during write sequence')
                        }
                        logWarn('[Deployment] Failed to set ID despite OP support.')
                        Alert.alert(
                            'Warning',
                            'Deployment created locally, but failed to send Deployment ID to the device. The device may not tag images correctly.\n\nPlease verify connection and try "Engineer Device" > "Set Deployment ID" manually if needed.'
                        );
                    }
                } catch (opError) {
                    log('[Deployment] Device does not support extended OPs or write failed. Falling back to SET_GPS...', opError)

                    // Fallback to SET_GPS command for older firmware
                    try {
                        const { latitude, longitude, altitude } = formState.location
                        // Use 0,0 if location is empty to at least clear it/set valid GPS format
                        const lat = latitude || 0
                        const lng = longitude || 0
                        const alt = altitude || 0

                        await setGpsLocation(bleDevice, lat, lng, alt)
                        log('[Deployment] GPS location set successfully as fallback.')

                    } catch (gpsError) {
                        logError('[Deployment] GPS fallback failed:', gpsError)
                    }
                }
            } catch (e) {
                logError('[Deployment] Error during Deployment ID setup:', e)
            }

            // 4. Configure Capture Method
            log('[Deployment] Configuring Capture Method:', captureMethodName)
            try {
                const method = captureMethodName.toLowerCase().replace(/[^a-z]/g, '') // "activitydetection", "timelapse"
                const isMotionDetect = method.includes('activity') || method.includes('motion')
                const isTimelapse = method.includes('time') || method.includes('lapse')

                if (isMotionDetect) {
                    log('[Deployment] Mode: Activity Detection. Setting motion interval to 1000ms, timeout to 30s & disabling timelapse.')
                    await updateSettings({
                        motionDetectInterval: 1000,
                        timelapseInterval: 0,
                        intervalBeforeDpd: 1000, // Short timeout to force DPD Latch Cycle
                        cameraEnabled: true // Enable camera to ensure motion settings are accepted
                    })
                } else if (isTimelapse) {
                    const interval = project.timelapse_interval_seconds || 300
                    log(`[Deployment] Mode: Time-lapse. Setting interval to ${interval}s, timeout to 30s & disabling motion detect.`)
                    await updateSettings({
                        motionDetectInterval: 0,
                        timelapseInterval: interval,
                        intervalBeforeDpd: 1000,
                        cameraEnabled: true // Enable camera to ensure timelapse settings are accepted
                    })
                } else {
                    logWarn('[Deployment] Unknown capture method:', captureMethodName, '- No specific BLE config sent.')
                }
            } catch (e) {
                logError('[Deployment] Failed to configure capture settings:', e)
                Alert.alert('Warning', 'Failed to configure device capture settings (Motion/Timelapse). Device may use previous defaults.')
            }

            // 5. Enable Camera (Explicit Command - Safety Check)
            // Restore explicit call to ensure the Enable signal is definitively received
            if (bleDevice?.connected) {
                log('[Deployment] Sending explicit Enable Camera command...')
                try {
                    await enableCamera(bleDevice)
                    log('[Deployment] Explicit enable command sent.')
                } catch (e) {
                    logWarn('[Deployment] Failed to send explicit enable command:', e)
                }
            } else {
                logWarn('[Deployment] Device disconnected during explicit enable.')
            }

            // 5.5 DPD Latch Cycle (New Hook)
            if (bleDevice?.connected) {
                await triggerDpdLatch(bleDevice, '[Deployment]')
            }

            // 6. Flash Green LED (Success Confirmation)
            // 6. Flash Green LED (Success Confirmation)
            // REMOVED: The long flash sequence (2.5s) exceeds the strict 1000ms inactivity timeout
            // preventing the device from transitioning to Active Mode if the firmware doesn't apply the 30s override immediately.
            if (bleDevice?.connected) {
                log('[Deployment] Skipping LED flash to prevent inactivity timeout.')
            }

            // 7. Disconnect
            log('[Deployment] Disconnecting device...')
            // Removed 5s delay to allow immediate disconnect after Latch Cycle
            try {
                await runDisconnect(bleDevice)
                log('[Deployment] Device disconnected')
            } catch (e) {
                logError('[Deployment] Failed to disconnect:', e)
            }

            // 8. Navigate back to Deployments list
            isNavigatingAway.current = true
            // @ts-ignore - navigation types need to be strict but for now this works
            navigation.navigate('Home', { screen: 'Deployments' })

        } catch (error) {
            logError('Deployment failed:', error)
            Alert.alert('Error', 'Failed to start deployment: ' + (error as any).message)
            isStartDeploymentInProgress.current = false // Re-enable alerts on failure
        } finally {
            setSubmitting(false)
        }
    }, [formState.name, formState.locationName, formState.locationDescription, formState.cameraHeight, formState.location, formState.notes, bleDevice, project, user, checkAndCorrectTime, deviceId, devicePreparationId, logs, setOperationalParam, setDeploymentIdAsOps, setGpsLocation, captureMethodName, updateSettings, enableCamera, triggerDpdLatch, runDisconnect, navigation])

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
        <WWScreenView>
            <View style={styles.container}>
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
                                    ; (navigation as any).navigate('PrepareAndTest', {
                                        deviceId,
                                        bleDeviceId,
                                        nextRoute: 'DeploymentDetailsStep'
                                    })
                            }}
                            style={styles.editButton}
                            icon="cog"
                        >
                            Edit Project Settings
                        </Button>
                    </Card.Content>
                </Card>

                <LoRaWANSection
                    device={bleDevice}
                    onShowHelp={showHelp}
                />

                <CameraViewSection
                    device={bleDevice}
                    onImageCaptured={(path: string) => setFormState(prev => ({ ...prev, testImagePath: path }))}
                    onShowHelp={showHelp}
                />

                <LocationSection
                    onLocationChange={(loc) => setFormState(prev => ({ ...prev, location: loc }))}
                    onShowHelp={showHelp}
                />

                <MetadataSection
                    name={formState.name}
                    notes={formState.notes}
                    locationDescription={formState.locationDescription}
                    cameraHeight={formState.cameraHeight}
                    onNameChange={(name: string) => setFormState(prev => ({ ...prev, name }))}
                    onNotesChange={(notes: string) => setFormState(prev => ({ ...prev, notes }))}
                    onLocationDescriptionChange={(text: string) => setFormState(prev => ({ ...prev, locationDescription: text }))}
                    onCameraHeightChange={(text: string) => setFormState(prev => ({ ...prev, cameraHeight: text }))}
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
        </WWScreenView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        gap: 16,
        padding: 16
    },
    footer: {
        marginTop: 24,
        marginBottom: 32
    },
    deployButton: {
        paddingVertical: 8
    },
    card: {
        marginBottom: 16
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
