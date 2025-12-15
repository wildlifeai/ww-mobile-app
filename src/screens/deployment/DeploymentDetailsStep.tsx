import React, { useState, useEffect } from 'react'
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
import { useBleActions } from '../../providers/BleEngineProvider'

import { LoRaWANSection } from './sections/LoRaWANSection'
import { CameraViewSection } from './sections/CameraViewSection'
import { LocationSection } from './sections/LocationSection'
// import { PhotosSection } from './sections/PhotosSection'
import { MetadataSection } from './sections/MetadataSection'

type DeploymentDetailsRouteProp = RouteProp<RootStackParamList, 'DeploymentDetailsStep'>;

export const DeploymentDetailsStep = () => {
    const navigation = useNavigation()
    const route = useRoute<DeploymentDetailsRouteProp>()

    // Params passed from DeviceDiscoveryScreen
    const { devicePreparationId, deviceId, bleDeviceId } = route.params || {}

    // BLE Hooks
    const { getUtc, setUtc, setDeploymentId, disconnectDevice, enableCamera, runDisconnect, getStatus, setMotionDetectInterval, disableMotionDetect, setTimelapseInterval, disableTimelapse } = useBleCommands()
    const { isBleConnecting } = useBleActions()

    const devices = useAppSelector(state => state.devices)
    const bleDevice = devices[bleDeviceId]
    const deviceConfig = useAppSelector(state => state.configuration[bleDeviceId])
    const user = useAppSelector(state => state.authentication.user)

    const [formState, setFormState] = useState({
        name: '',
        notes: '',
        locationDescription: '',
        cameraHeight: '',
        locationName: 'User Location',
        location: {
            latitude: 0,
            longitude: 0,
            altitude: 0
        },
        testImagePath: undefined as string | undefined
    })

    const [submitting, setSubmitting] = useState(false)
    const [preparation, setPreparation] = useState<any>(null)
    const [project, setProject] = useState<any>(null)
    const [captureMethodName, setCaptureMethodName] = useState<string>('')
    const [timeCheckStatus, setTimeCheckStatus] = useState<'pending' | 'ok' | 'correcting' | 'failed'>('pending')

    useEffect(() => {
        if (devicePreparationId) {
            loadPreparationAndProject()
        }
    }, [devicePreparationId])

    // Initial Time Check on Mount
    useEffect(() => {
        if (bleDevice && bleDevice.connected) {
            checkAndCorrectTime()
        }
    }, [bleDevice?.connected])

    // Check Device Status (Prevent Double Deployment)
    const hasCheckedStatus = React.useRef(false)
    useEffect(() => {
        if (bleDevice?.connected && !hasCheckedStatus.current) {
            console.log('[Deployment] Checking device status...')
            getStatus(bleDevice)
            hasCheckedStatus.current = true
        }
    }, [bleDevice?.connected])

    // Monitor Status Response
    useEffect(() => {
        const statusValue = deviceConfig?.[CommandNames.status]?.value
        if (statusValue === 'enabled') {
            console.log('[Deployment] Device reported active sensor!')
            Alert.alert(
                'Device Already Active',
                'This device appears to be already deployed (Sensor Enabled).\n\nStarting a new deployment will overwrite the current configuration.',
                [
                    {
                        text: 'Cancel',
                        onPress: () => navigation.goBack(),
                        style: 'cancel'
                    },
                    {
                        text: 'Continue Anyway',
                        onPress: () => console.log('[Deployment] User chose to continue despite active status'),
                        style: 'destructive'
                    }
                ]
            )
        }
    }, [deviceConfig?.[CommandNames.status]?.value])

    // Time Check Logic
    useEffect(() => {
        const timeValue = deviceConfig?.[CommandNames.getutc]?.value
        if (timeValue) {
            validateAndCorrectTime(timeValue)
        }
    }, [deviceConfig?.[CommandNames.getutc]?.value])

    const validateAndCorrectTime = async (timeString: string) => {
        try {
            // value comes from regex group: "2024-01-01T12:00:00Z"
            const deviceTime = new Date(timeString).getTime()
            const phoneTime = new Date().getTime()
            const diff = Math.abs(phoneTime - deviceTime)

            console.log(`[TimeCheck] Device: ${timeString}, Phone: ${new Date().toISOString()}, Diff: ${diff}ms`)

            if (diff > 5000) { // 5 seconds tolerance
                console.log('[TimeCheck] Time mismatch. Setting UTC...')
                setTimeCheckStatus('correcting')
                await setUtc(bleDevice)
                // Optionally request verify again?
                setTimeCheckStatus('ok') // Assume success for now
            } else {
                console.log('[TimeCheck] Time is correct.')
                setTimeCheckStatus('ok')
            }
        } catch (e) {
            console.error('[TimeCheck] Parse error:', e)
            setTimeCheckStatus('failed')
        }
    }

    const checkAndCorrectTime = async () => {
        if (!bleDevice) return
        console.log('[Deployment] Checking device time...')
        try {
            setTimeCheckStatus('pending')
            await getUtc(bleDevice)
        } catch (e) {
            console.error('Failed to get UTC:', e)
        }
    }

    const loadPreparationAndProject = async () => {
        try {
            const prep = await DevicePreparationService.getPreparationById(devicePreparationId as string)
            setPreparation(prep)

            if (prep && prep.projectId) {
                const proj = await ProjectService.getProjectById(prep.projectId)
                setProject(proj)

                if (proj && proj.capture_method_id) {
                    const methods = await ReferenceDataService.getCaptureMethods()
                    const method = methods.find(m => m.id === proj.capture_method_id)
                    setCaptureMethodName(method ? method.value : 'Unknown')
                } else {
                    setCaptureMethodName('Not Set')
                }
            }
        } catch (error) {
            console.error(error)
        }
    }

    const handleStartDeployment = async () => {
        if (!formState.name) {
            Alert.alert('Missing Information', 'Please enter a deployment name')
            return
        }

        if (!project || !user) {
            Alert.alert('Error', 'Missing project or user information. Please wait for data to load.')
            return
        }

        setSubmitting(true)

        // 1. Final Time Check
        console.log('[Deployment] Performing final time check...')
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
                cameraLocationDescription: formState.locationDescription,
                cameraHeight: formState.cameraHeight ? parseFloat(formState.cameraHeight) : undefined,

                latitude: formState.location.latitude,
                longitude: formState.location.longitude,

                // Pass capture method ID from project
                captureMethodId: project.capture_method_id,

                startComments: formState.notes,
                cameraImagePaths: [], // Photos deferred
            })

            // 3. Send Deployment ID to Device via BLE
            console.log('[Deployment] Sending Deployment ID to device:', newDeployment.id)
            let deploymentIdSet = false
            let attempts = 0
            while (!deploymentIdSet && attempts < 3) {
                try {
                    attempts++
                    await setDeploymentId(bleDevice, newDeployment.id)
                    console.log('[Deployment] Deployment ID set successfully on attempt', attempts)
                    deploymentIdSet = true
                } catch (bleError) {
                    console.error(`[Deployment] Failed to set Deployment ID (attempt ${attempts}):`, bleError)
                    if (attempts < 3) await new Promise(r => setTimeout(r, 1000)) // Wait 1s between retries
                }
            }

            if (!deploymentIdSet) {
                Alert.alert(
                    'Warning',
                    'Deployment created locally, but failed to send Deployment ID to the device. The device may not tag images correctly.\n\nPlease verify connection and try "Engineer Device" > "Set Deployment ID" manually if needed.'
                )
            }

            // 3.5 Configure Capture Method
            console.log('[Deployment] Configuring Capture Method:', captureMethodName)
            try {
                const method = captureMethodName.toLowerCase().replace(/[^a-z]/g, '') // "activitydetection", "timelapse"

                if (method.includes('activity') || method.includes('motion')) {
                    console.log('[Deployment] Mode: Activity Detection. Setting motion interval to 1000ms & disabling timelapse.')
                    await setMotionDetectInterval(bleDevice, 1000)
                    await disableTimelapse(bleDevice)
                } else if (method.includes('time') || method.includes('lapse')) {
                    const interval = project.timelapse_interval_seconds || 900 // Default 15min if missing
                    console.log(`[Deployment] Mode: Timelapse. Setting interval to ${interval}s & disabling motion.`)
                    await setTimelapseInterval(bleDevice, interval)
                    await disableMotionDetect(bleDevice)
                } else {
                    console.warn('[Deployment] Unknown capture method:', captureMethodName, '- No specific BLE config sent.')
                }
            } catch (e) {
                console.error('[Deployment] Failed to configure capture settings:', e)
                Alert.alert('Warning', 'Failed to configure device capture settings (Motion/Timelapse). Device may use previous defaults.')
            }

            // 4. Enable Camera
            console.log('[Deployment] Enabling Camera...')
            try {
                await enableCamera(bleDevice)
                console.log('[Deployment] Camera enabled successfully')
            } catch (e) {
                console.error('[Deployment] Failed to enable camera:', e)
            }

            // 5. Disconnect
            console.log('[Deployment] Disconnecting device...')
            try {
                // Use runDisconnect to send 'dis' command and clean up
                await runDisconnect(bleDevice)
                console.log('[Deployment] Device disconnected')
            } catch (e) {
                console.error('[Deployment] Failed to disconnect:', e)
            }

            // 4. Navigate back to Deployments list
            // @ts-ignore - navigation types need to be strict but for now this works
            navigation.navigate('Home', { screen: 'Deployments' })

        } catch (error) {
            console.error('Deployment failed:', error)
            Alert.alert('Error', 'Failed to start deployment: ' + (error as any).message)
        } finally {
            setSubmitting(false)
        }
    }

    if (!devicePreparationId) {
        return <View><WWButton onPress={() => navigation.goBack()}>Go Back</WWButton></View>
    }

    return (
        <WWScreenView>
            <View style={styles.container}>
                {/* Project & Configuration Header */}
                <Card style={styles.card}>
                    <Card.Title title="Configuration" left={(props) => <WWIcon {...props} source="tune" />} />
                    <Card.Content>
                        <View style={styles.infoRow}>
                            <Text variant="labelMedium">Project:</Text>
                            <Text variant="bodyLarge">{project ? project.name : 'Loading...'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text variant="labelMedium">Capture Method:</Text>
                            <Text variant="bodyLarge">{captureMethodName || 'Loading...'}</Text>
                        </View>

                        <Button
                            mode="outlined"
                            onPress={() => (navigation as any).navigate('PrepareAndTest', {
                                deviceId,
                                bleDeviceId,
                                nextRoute: 'DeploymentDetailsStep'
                            })}
                            style={{ marginTop: 12 }}
                            icon="cog"
                        >
                            Prepare Device Settings
                        </Button>
                    </Card.Content>
                </Card>

                <LoRaWANSection
                    device={bleDevice}
                />

                <CameraViewSection
                    device={bleDevice}
                    onImageCaptured={(path: string) => setFormState(prev => ({ ...prev, testImagePath: path }))}
                />

                <LocationSection
                    onLocationChange={(loc) => setFormState(prev => ({ ...prev, location: loc }))}
                />

                {/* 
                   Photos Feature Deferred:
                   Uploading photos taken by the user with their mobile and syncing in supabase and locally
                   is going to require lots of engineering time so we will implement this feature in the future.
                   
                   <PhotosSection 
                       photos={formState.photos}
                       onPhotosChange={(photos) => setFormState(prev => ({...prev, photos}))}
                   />
                */}

                <MetadataSection
                    name={formState.name}
                    notes={formState.notes}
                    locationDescription={formState.locationDescription}
                    cameraHeight={formState.cameraHeight}
                    onNameChange={(name: string) => setFormState(prev => ({ ...prev, name }))}
                    onNotesChange={(notes: string) => setFormState(prev => ({ ...prev, notes }))}
                    onLocationDescriptionChange={(text: string) => setFormState(prev => ({ ...prev, locationDescription: text }))}
                    onCameraHeightChange={(text: string) => setFormState(prev => ({ ...prev, cameraHeight: text }))}
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
    card: { marginBottom: 16 },
    infoRow: { marginBottom: 4 }
})
