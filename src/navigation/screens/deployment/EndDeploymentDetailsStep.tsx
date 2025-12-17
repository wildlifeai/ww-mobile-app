
import React, { useState, useEffect, useMemo } from 'react'
import { View, StyleSheet, ScrollView, Alert } from 'react-native'
import { useAppSelector } from '../../../redux'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { Appbar, TextInput, Card, ActivityIndicator } from 'react-native-paper'
import { WWScreenView } from '../../../components/ui/WWScreenView'
import { WWText } from '../../../components/ui/WWText'
import { WWButton } from '../../../components/ui/WWButton'
import { RootStackParamList } from '../../../navigation'
import { DeploymentService } from '../../../services/DeploymentService'
import { useBleCommands } from '../../../hooks/useBleCommands'
import { useBleActions } from '../../../providers/BleEngineProvider'
import { withObservables } from '@nozbe/watermelondb/react'
import { selectCurrentUser } from '../../../redux/slices/authSlice'
import type Deployment from '../../../database/models/Deployment'

// ... existing imports ...

type EndDeploymentDetailsStepRouteProp = RouteProp<RootStackParamList, 'EndDeploymentDetailsStep'>

interface InnerProps {
    deployment: Deployment
    deviceId: string
    bleDeviceId: string
}

const EndDeploymentDetailsStepComponent: React.FC<InnerProps> = ({ deployment, deviceId, bleDeviceId }) => {
    const navigation = useNavigation()
    const { disconnectDevice } = useBleActions()
    const { getBatteryLevel, setOperationalParam, disableCamera, runDisconnect, setDeploymentIdAsOps } = useBleCommands()

    // Get current user
    const user = useAppSelector(selectCurrentUser)

    // Get full device object for BLE commands
    const devices = useAppSelector(state => state.devices)

    // Robust lookup: Try direct match, then case-insensitive, then fallback
    const bleDevice = useMemo(() => {
        if (devices[bleDeviceId]) return devices[bleDeviceId];

        const match = Object.values(devices).find(d => d.id?.toLowerCase() === bleDeviceId?.toLowerCase());
        if (match) return match;

        // Fallback: If we assume it is connected but missing from store (edge case),
        // we construct a minimal object so commands can still be attempted.
        console.warn(`[EndDeployment] Device ${bleDeviceId} not found in store. Using fallback. Available keys: ${Object.keys(devices).join(', ')}`);
        return { id: bleDeviceId, connected: true } as any;
    }, [devices, bleDeviceId]);

    // Local state
    const [retrievalNotes, setRetrievalNotes] = useState('')
    const [isEnding, setIsEnding] = useState(false)
    const [bleStatus, setBleStatus] = useState<string>('Connected')

    // Initial BLE interaction just to ensure connection is alive?
    // We assume connection is passed from previous step.

    const handleEndDeployment = async () => {
        setIsEnding(true)
        try {
            // 1. Send BLE command to stop camera
            if (bleDevice) {
                setBleStatus('Disabling Camera...')
                try {
                    await disableCamera(bleDevice)
                    console.log('[EndDeployment] Camera disabled')
                } catch (e) {
                    console.warn('[EndDeployment] Failed to disable camera:', e)
                    // Continue anyway to ensure DB update happens
                }
            } else {
                console.warn('[EndDeployment] No BLE device found in store, skipping camera disable')
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
                        // Pass null to clear the ID (sends zeros to OPs)
                        await setDeploymentIdAsOps(bleDevice, null)
                        console.log('[EndDeployment] Deployment ID cleared successfully')
                        idCleared = true
                    } catch (e) {
                        console.warn(`[EndDeployment] Failed to clear Deployment ID (attempt ${attempts}):`, e)
                        if (attempts < 3) await new Promise(r => setTimeout(r, 1000))
                    }
                }
                if (!idCleared) {
                    Alert.alert(
                        'Warning',
                        'Failed to clear Deployment ID on the device. Please manually reset the device configuration if you plan to redeploy it immediately.'
                    )
                }
            }

            // 2. Update DB
            setBleStatus('Updating Record...')
            const userId = user?.id || null
            await DeploymentService.endDeployment(deployment.id, userId, retrievalNotes)

            // 3. Disconnect
            setBleStatus('Disconnecting...')
            if (bleDevice) {
                try {
                    await runDisconnect(bleDevice)
                    console.log('[EndDeployment] Device disconnected')
                } catch (e) {
                    console.warn('[EndDeployment] Failed to disconnect:', e)
                }
            }

            Alert.alert(
                "Deployment Ended",
                "The deployment has been successfully ended.",
                [{
                    text: "View Details",
                    onPress: () => {
                        // Navigate to details (and replace history so they can't go back to wizard)
                        navigation.reset({
                            index: 1,
                            routes: [
                                { name: 'Home' },
                                { name: 'DeploymentDetails', params: { deploymentId: deployment.id } },
                            ],
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
            <Appbar.Header>
                <Appbar.BackAction onPress={() => navigation.goBack()} />
                <Appbar.Content title="End Deployment" />
            </Appbar.Header>

            <View style={styles.container}>
                <View style={styles.headerSection}>
                    <WWText variant="headlineMedium" style={styles.title}>End Deployment</WWText>
                    <WWText variant="bodyMedium" style={styles.subtitle}>
                        Confirm you are ending the correct deployment.
                    </WWText>
                </View>

                <Card style={styles.card}>
                    <Card.Content>
                        <View style={styles.column}>
                            <WWText variant="labelLarge" style={styles.label}>Deployment Name</WWText>
                            <WWText variant="headlineSmall">{deployment.name}</WWText>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.row}>
                            <WWText variant="labelLarge">Started:</WWText>
                            <WWText variant="bodyLarge">{new Date(deployment.deploymentStart).toLocaleDateString()}</WWText>
                        </View>
                    </Card.Content>
                </Card>

                <View style={styles.inputSection}>
                    <WWText variant="titleMedium" style={styles.sectionTitle}>Retrieval Notes</WWText>
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

                <View style={styles.actionSection}>
                    <WWButton
                        mode="contained"
                        color="#D32F2F" // Red for destructive action
                        onPress={handleEndDeployment}
                        loading={isEnding}
                        disabled={isEnding}
                        style={styles.endButton}
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
        padding: 16,
    },
    headerSection: {
        marginBottom: 24,
    },
    title: {
        marginBottom: 8,
    },
    subtitle: {
        color: '#666',
    },
    card: {
        marginBottom: 24,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    column: {
        marginBottom: 8,
    },
    label: {
        marginBottom: 4,
        color: '#666',
    },
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 8,
    },
    inputSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#fff',
        minHeight: 120,
    },
    actionSection: {
        gap: 12,
    },
    endButton: {
        backgroundColor: '#D32F2F',
    },
    cancelButton: {
        borderColor: '#666',
    }
})

// Wrapper to fetch deployment
const enhance = withObservables(['route'], ({ route }: { route: EndDeploymentDetailsStepRouteProp }) => ({
    deployment: DeploymentService.observeDeploymentById(route.params?.deploymentId || '')
}))

export const EndDeploymentDetailsStep = enhance(EndDeploymentDetailsStepComponent)
