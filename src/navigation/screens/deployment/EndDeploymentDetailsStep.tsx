
import React, { useState, useEffect, useMemo } from 'react'
import { View, StyleSheet, ScrollView, Alert } from 'react-native'
import { useAppSelector } from '../../../redux'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { Appbar, TextInput, Card, ActivityIndicator } from 'react-native-paper'
import { WWScreenView } from '../../../components/ui/WWScreenView'
import { WWText } from '../../../components/ui/WWText'
import { WWButton } from '../../../components/ui/WWButton'
import { RootStackParamList } from '../../../navigation'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { DeploymentService } from '../../../services/DeploymentService'
import { useBleCommands } from '../../../hooks/useBleCommands'
import { useBleActions } from '../../../providers/BleEngineProvider'
import { withObservables } from '@nozbe/watermelondb/react'
import { selectCurrentUser } from '../../../redux/slices/authSlice'
import type Deployment from '../../../database/models/Deployment'

type EndDeploymentDetailsStepRouteProp = RouteProp<RootStackParamList, 'EndDeploymentDetailsStep'>

interface InnerProps {
    deployment: Deployment
    deviceId: string
    bleDeviceId: string
}

const EndDeploymentDetailsStepComponent: React.FC<InnerProps> = ({ deployment }) => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
    const route = useRoute<EndDeploymentDetailsStepRouteProp>()
    const { deviceId = '', bleDeviceId = '' } = route.params || {}
    const { disconnectDevice } = useBleActions()
    const { getBatteryLevel, setOperationalParam, disableCamera, runDisconnect, setDeploymentIdAsOps, clearGpsLocation, flashLed } = useBleCommands()

    // Get current user
    const user = useAppSelector(selectCurrentUser)

    // Get full device object for BLE commands
    const devices = useAppSelector(state => state.devices)

    console.log(`[EndDeployment] Rendering (Fixed). Params from route:: bleDeviceId=${bleDeviceId}, deviceId=${deviceId}`);

    // Robust lookup: Try direct match, then case-insensitive, then fallback
    const bleDevice = useMemo(() => {
        let device: any = devices[bleDeviceId];

        if (!device) {
            device = Object.values(devices).find(d => d.id?.toLowerCase() === bleDeviceId?.toLowerCase());
        }

        console.log(`[EndDeployment] Validating device from store. bleDeviceId=${bleDeviceId}, Found=${!!device}, ID=${device?.id}, Connected=${device?.connected}`);

        if (device) {
            // Use actual device state from store
            return device;
        }

        // Fallback: Construct a minimal defined object
        console.warn(`[EndDeployment] Device ${bleDeviceId} not found in store. Using fallback (disconnected).`);
        return {
            id: bleDeviceId,
            connected: false, // Default to false if not found in store
            name: 'Fallback Device',
        };
    }, [devices, bleDeviceId]);

    // Local state
    const [retrievalNotes, setRetrievalNotes] = useState('')
    const [isEnding, setIsEnding] = useState(false)
    const [bleStatus, setBleStatus] = useState<string>('Connected')

    // Initial BLE interaction just to ensure connection is alive?
    // We assume connection is passed from previous step.

    const handleEndDeployment = async () => {
        // Sanity Check: Ensure BLE is still connected (unless it's a forced cleanup)
        // If bleDevice is a fallback/disconnected object, we should warn.
        // We forced connected=true in the useMemo above if found in store, so check the REAL store object or just proceed with caution?
        // Actually, bleDevice from useMemo might be a fallback.
        // Let's check the real store device if possible, or trust the bleDevice.connected prop which we might have forced.
        // Better: Check if the device exists in the 'devices' store AND is connected.
        const realDevice = devices[bleDeviceId]
        if (!realDevice || !realDevice.connected) {
            Alert.alert(
                'Connection Lost',
                'The device appears to be disconnected. You cannot end the deployment on the device without a connection.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Force End (Database Only)',
                        style: 'destructive',
                        onPress: async () => {
                            // Allow forcing end if device is lost/damaged, but warn heavily
                            setIsEnding(true)
                            try {
                                const userId = user?.id || null
                                await DeploymentService.endDeployment(deployment.id, userId, retrievalNotes)
                                navigation.reset({ index: 0, routes: [{ name: 'Home' }] })
                            } catch (e) { Alert.alert('Error', 'Failed to force end') }
                            finally { setIsEnding(false) }
                        }
                    }
                ]
            )
            // Ideally we return here unless user chose Force End. But Alert is non-blocking in logic flow if not promised.
            // So we return immediately and let the Alert callbacks handle logic.
            return
        }

        setIsEnding(true)
        try {
            // 1. Send BLE command to stop camera
            if (bleDevice) {
                setBleStatus('Disabling Camera...')
                try {
                    await disableCamera(bleDevice)
                    console.log('[EndDeployment] Camera disabled, waiting for device wake/stabilize...')
                    // Vital delay: disableCamera wakes the device, we must wait before flooding it with OPs
                    await new Promise(r => setTimeout(r, 1000))
                } catch (e) {
                    console.warn('[EndDeployment] Failed to disable camera:', e)
                }
            }

            // 1.5 Clear Deployment ID
            if (bleDevice) {
                setBleStatus('Clearing Config...')
                console.log('[EndDeployment] Clearing Deployment ID on device...')
                let idCleared = false
                let attempts = 0
                while (!idCleared && attempts < 3) {
                    try {
                        attempts++
                        await setDeploymentIdAsOps(bleDevice, null)
                        console.log('[EndDeployment] Deployment ID cleared successfully')
                        idCleared = true
                    } catch (e) {
                        console.warn(`[EndDeployment] Failed to clear Deployment ID (attempt ${attempts}):`, e)
                        if (attempts < 3) await new Promise(r => setTimeout(r, 1000))
                    }
                }
                
                // Warn user if clearing failed after all retries
                if (!idCleared) {
                    Alert.alert(
                        'Warning',
                        'Failed to clear Deployment ID on the device. The deployment has been ended in the database, but you may need to manually reset the device configuration before redeploying it.',
                        [{ text: 'OK' }]
                    )
                }

                // Clear GPS (Legacy/Safety)
                try {
                    await clearGpsLocation(bleDevice)
                } catch (e) {
                    console.warn('[EndDeployment] Failed to clear GPS:', e)
                }
            }

            // 2. Update DB
            setBleStatus('Updating Record...')
            const userId = user?.id || null
            await DeploymentService.endDeployment(deployment.id, userId, retrievalNotes)

            // 2.5 Visual Confirmation Sequence (LED Flashes)
            if (bleDevice) {
                setBleStatus('Confirming...')
                console.log('[EndDeployment] Starting LED confirmation sequence...')
                try {
                    // Sequence with delays matching duration
                    // Green (1s)
                    await flashLed(bleDevice, 'green', 1000, 1)
                    await new Promise(r => setTimeout(r, 1000))

                    // Blue (1s)
                    await flashLed(bleDevice, 'blue', 1000, 1)
                    await new Promise(r => setTimeout(r, 1000))

                    // Red (1s)
                    await flashLed(bleDevice, 'red', 1000, 1)
                    await new Promise(r => setTimeout(r, 1000))

                    // Green (4s) - Final confirmation
                    await flashLed(bleDevice, 'green', 4000, 1)
                    await new Promise(r => setTimeout(r, 4000))

                    console.log('[EndDeployment] LED confirmation sequence complete')
                } catch (e) {
                    console.warn('[EndDeployment] Failed to complete LED sequence:', e)
                }
            }

            // 3. Disconnect
            setBleStatus('Disconnecting...')
            if (bleDevice) {
                try {
                    await runDisconnect(bleDevice)
                } catch (e) {
                    console.warn('[EndDeployment] Failed to disconnect:', e)
                }
            }

            // 4. Navigate to Home (Deployments Tab)
            Alert.alert(
                "Deployment Ended",
                "The deployment has been successfully ended.",
                [{
                    text: "Done",
                    onPress: () => {
                        // Reset navigation stack to Home
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Home' }],
                        })
                    }
                }]
            )

        } catch (error) {
            console.error(error)
            Alert.alert("Error", "Failed to end deployment. Please try again.")
        } finally {
            setIsEnding(false)
        }
    }

    if (!deployment) {
        return (
            <WWScreenView>
                <WWText>Loading deployment details...</WWText>
            </WWScreenView>
        )
    }

    return (
        <WWScreenView scrollable>


            <View style={styles.container}>
                {/* Deployment Info Card */}
                <Card style={styles.card}>
                    <Card.Title
                        title="Deployment Info"
                        left={(props) => <Appbar.Action {...props} icon="information" />}
                    />
                    <Card.Content>
                        <View style={styles.infoRow}>
                            <WWText variant="labelMedium">Deployment Name:</WWText>
                            <WWText variant="bodyLarge">{deployment.name}</WWText>
                        </View>
                        <View style={styles.infoRow}>
                            <WWText variant="labelMedium">Started:</WWText>
                            <WWText variant="bodyLarge">{new Date(deployment.deploymentStart).toLocaleDateString()}</WWText>
                        </View>
                    </Card.Content>
                </Card>

                {/* Retrieval Notes Input */}
                <View>
                    <WWText variant="titleMedium" style={{ marginBottom: 8 }}>Retrieval Notes</WWText>
                    <TextInput
                        mode="outlined"
                        placeholder="e.g. SD card full, Battery low, Device damaged..."
                        multiline
                        numberOfLines={8}
                        value={retrievalNotes}
                        onChangeText={setRetrievalNotes}
                        style={styles.input}
                        textColor="#000"
                    />
                </View>

                {/* Action Buttons */}
                <View style={styles.footer}>
                    <WWButton
                        mode="contained"
                        style={styles.endButton}
                        onPress={handleEndDeployment}
                        loading={isEnding}
                        disabled={isEnding}
                    >
                        {isEnding ? bleStatus : "End Deployment"}
                    </WWButton>

                    <WWButton
                        mode="outlined"
                        onPress={() => navigation.goBack()}
                        disabled={isEnding}
                        style={styles.cancelButton}
                    >
                        Cancel
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
    card: { marginBottom: 16 },
    infoRow: { marginBottom: 8 },
    footer: {
        marginTop: 24,
        marginBottom: 32
    },
    endButton: {
        backgroundColor: '#D32F2F',
        paddingVertical: 8
    },
    cancelButton: {
        borderColor: '#666',
        marginTop: 12
    },
    input: {
        backgroundColor: '#fff',
        minHeight: 120,
    },
})

// Wrapper to fetch deployment
const enhance = withObservables(['route'], ({ route }: { route: EndDeploymentDetailsStepRouteProp }) => ({
    deployment: DeploymentService.observeDeploymentById(route.params?.deploymentId || '')
}))

export const EndDeploymentDetailsStep = enhance(EndDeploymentDetailsStepComponent)
