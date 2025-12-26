import React, { useEffect, useMemo, useCallback } from 'react'
import { View, FlatList, StyleSheet, Alert } from 'react-native'
import { useIsFocused, useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWText } from '../../components/ui/WWText'
import { WWButton } from '../../components/ui/WWButton'
import { useBleActions } from '../../providers/BleEngineProvider'
import { useBleCommands } from '../../hooks/useBleCommands'
import { useAppSelector } from '../../redux'
import { ExtendedPeripheral } from '../../redux/slices/devicesSlice'
import { ActivityIndicator } from 'react-native-paper'

import { DeviceItem } from '../../components/DeviceItem'
import { DeviceService } from '../../services/DeviceService'
import { selectCurrentOrganisation } from '../../redux/slices/authSlice'
import { RootStackParamList } from '../../navigation'
import { DevicePreparationService } from '../../services/DevicePreparationService'
import { DeploymentService } from '../../services/DeploymentService'

type DeviceDiscoveryScreenRouteProp = RouteProp<RootStackParamList, 'DeviceDiscovery'>

export const DeviceDiscoveryScreen = () => {
    const navigation = useNavigation()
    const route = useRoute<DeviceDiscoveryScreenRouteProp>()
    const isFocused = useIsFocused()
    const { isBleConnecting, startScan, connectDevice, disconnectDevice } = useBleActions()
    const { runSelfTest, setUtc } = useBleCommands()
    const devices = useAppSelector((state) => state.devices)
    const logs = useAppSelector((state) => state.logs)
    const { isScanning } = useAppSelector((state) => state.scanning)
    const currentOrganisation = useAppSelector(selectCurrentOrganisation)
    const user = useAppSelector((state) => state.authentication.user)

    const mode = route.params?.mode || 'prepare' // Default to 'prepare' if not specified

    const isBleBusy = isBleConnecting || isScanning

    // Sort devices by signal strength (RSSI)
    const devicesToDisplay = useMemo(() => {
        return Object.values(devices)
            .sort((a, b) => {
                if (a.rssi && b.rssi) {
                    if (b.rssi === 127 || a.rssi === 127) return -1
                    return b.rssi - a.rssi
                }
                return -1
            })
            .filter((device) => !device.signalLost)
    }, [devices])

    const isAnyDeviceConnecting = useMemo(() => {
        return !!Object.values(devices).find((device) => device.loading)
    }, [devices])

    // Start scanning when screen is focused
    useEffect(() => {
        if (isFocused) {
            startScan(10)
        }
    }, [isFocused, startScan])

    // Auto-scan every 15 seconds
    useEffect(() => {
        if (!isFocused) return

        const interval = setInterval(() => {
            if (!isBleBusy && isFocused) {
                startScan(10)
            } else {
                console.log('Scanning already taking place, skipping.')
            }
        }, 30 * 1000)

        return () => {
            console.log('Clearing scan interval.')
            clearInterval(interval)
        }
    }, [isScanning, isBleConnecting, isBleBusy, startScan, isFocused])

    const handleScan = () => {
        if (!isBleBusy && !isScanning) {
            startScan()
        } else {
            console.log('Scanning already taking place, skipping.')
        }
    }

    const [processing, setProcessing] = React.useState(false)

    const handleDeviceSelect = useCallback(
        async (device: ExtendedPeripheral) => {
            if (processing) return
            console.log(`Device selected: ${device.id}, mode: ${mode}`)
            setProcessing(true)
            try {
                // 1. Connect to the device
                console.log(`Connecting to device ${device.id}...`)
                const connectedDevice = await connectDevice(device)
                console.log(`Connect result: ${connectedDevice.connected}`)

                if (connectedDevice.connected) {
                    // 4. Mode-specific logic
                    console.log(`Proceeding with mode: ${mode}`)

                    if (mode === 'engineer') {
                        // Navigate to Engineer Console (Terminal) directly - NO DB interaction
                        // log(`Navigating to DeviceNavigator with ID ${device.id}`)
                        (navigation as any).navigate('EngineerConsoleScreen', { deviceId: device.id })
                        setProcessing(false)
                        return
                    }

                    // For 'prepare' and 'end_deployment', we need the device in the DB
                    // 2. Check if device exists in DB
                    console.log(`Checking DB for device ${device.id}...`)
                    let dbDevice = await DeviceService.getDeviceByBluetoothId(device.id)
                    console.log(`DB Device found: ${!!dbDevice}`)

                    // 3. If not found, create it
                    if (!dbDevice) {
                        if (currentOrganisation?.id && user?.id) {
                            console.log(`Creating device in DB for org ${currentOrganisation.id}...`)
                            try {
                                dbDevice = await DeviceService.createDevice(
                                    device.id,
                                    device.name || 'Unknown Device',
                                    currentOrganisation.id,
                                    user.id
                                )
                                console.log(`Device created: ${dbDevice?.id}`)
                            } catch (error) {
                                console.error('Error creating device in DB:', error)
                                // If creation fails, it might be because it was just created. Try fetching again.
                                dbDevice = await DeviceService.getDeviceByBluetoothId(device.id)
                            }
                        } else {
                            console.log('No organisation or user selected')
                            Alert.alert('Error', 'No organisation selected or user not logged in. Cannot create device.')
                            await disconnectDevice(device)
                            setProcessing(false)
                            return
                        }
                    }

                    if ((mode as string) === 'end_deployment') {
                        if (dbDevice) {
                            const activeDeployment = await DeploymentService.getActiveDeploymentForDeviceId(dbDevice.id)

                            if (!activeDeployment) {
                                console.log(`Device ${dbDevice.id} has no active deployment.`)
                                Alert.alert(
                                    'No Active Deployment',
                                    'This device is not part of an active deployment.',
                                    [{ text: 'OK', onPress: () => disconnectDevice(device) }]
                                )
                                setProcessing(false)
                                return
                            }

                            // Proceed to End Deployment Step 2
                            console.log(`activeDeployment found: ${activeDeployment.id}. Proceeding to End Deployment details.`);
                            (navigation as any).navigate('EndDeploymentDetailsStep', {
                                deploymentId: activeDeployment.id,
                                deviceId: dbDevice.id,
                                bleDeviceId: connectedDevice.id
                            })
                            return // Done
                        }
                    }

                    if (mode === 'prepare') {
                        // Check deployment status
                        if (dbDevice) {
                            const status = await DeviceService.calculateDeviceStatus(dbDevice.id)
                            if (status === 'deployed') {
                                Alert.alert(
                                    'Device Deployed',
                                    'This device is currently deployed. Please end the deployment before preparing it.',
                                    [{ text: 'OK', onPress: () => disconnectDevice(device) }]
                                )
                                setProcessing(false)
                                return
                            }
                        }

                        // Navigate directly to Prepare and Test without initialization
                        if (dbDevice) {
                            (navigation as any).navigate('PrepareAndTest', {
                                deviceId: dbDevice.id,
                                bleDeviceId: connectedDevice.id,
                            })
                        }
                    } else if (mode === 'deployment') {

                        // Smart Routing: Check if device is prepared
                        if (dbDevice) {
                            // Check for active deployment first
                            const status = await DeviceService.calculateDeviceStatus(dbDevice.id)

                            if (status === 'deployed') {
                                // Already deployed? Maybe user wants to update/check it? Or mistake?
                                // For now, let's warn.
                                Alert.alert(
                                    'Device Already Deployed',
                                    'This device is currently deployed. Do you want to end the current deployment?',
                                    [
                                        { text: 'Cancel', onPress: () => disconnectDevice(device), style: 'cancel' },
                                        {
                                            text: 'End Deployment', onPress: () => {
                                                // Navigate to end deployment flow
                                                (navigation as any).navigate('EndDeploymentWizard', { mode: 'end_deployment' })
                                                disconnectDevice(device)
                                            }
                                        }
                                    ]
                                )
                                setProcessing(false)
                                return
                            }

                            // Check preparation status
                            const lastPrep = await DevicePreparationService.getLastCompletedPreparation(dbDevice.id)

                            // Better logic: Is there a preparation that is completed AND marked is_deployment_ready?
                            if (lastPrep && lastPrep.isDeploymentReady) {
                                // Go to Step 2: Deployment Details
                                console.log(`Device ${dbDevice.id} is prepared. Proceeding to details.`);

                                // We need to pass the preparation ID to the next step
                                (navigation as any).navigate('DeploymentDetailsStep', {
                                    devicePreparationId: lastPrep.id,
                                    deviceId: dbDevice.id,
                                    bleDeviceId: connectedDevice.id
                                })
                            } else {
                                // Not prepared -> Validated Preparation Step
                                console.log(`Device ${dbDevice.id} not fully prepared. Redirecting to preparation.`)
                                Alert.alert(
                                    "Device Not Prepared",
                                    "You cannot deploy a device that has not been prepared/verified.\n\nPlease prepare the device first.",
                                    [
                                        {
                                            text: "Go to Preparation", onPress: () => {
                                                (navigation as any).navigate('PrepareAndTest', {
                                                    deviceId: dbDevice.id,
                                                    bleDeviceId: connectedDevice.id,
                                                    nextRoute: 'DeploymentDetailsStep' // Pass next route to auto-navigate after prep
                                                })
                                            }
                                        },
                                        {
                                            text: "Cancel",
                                            onPress: () => disconnectDevice(device),
                                            style: "cancel"
                                        }
                                    ]
                                )
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error connecting to device:', error)
                Alert.alert('Connection Failed', 'Could not connect to device. It might be in DFU mode or out of range.')
            } finally {
                setProcessing(false)
            }
        },
        [connectDevice, disconnectDevice, navigation, currentOrganisation, mode, processing]
    )

    const handleDisconnect = useCallback(async (device: ExtendedPeripheral) => {
        console.log(`Disconnecting from ${device.id}`)
        await disconnectDevice(device)
    }, [disconnectDevice])

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            {isScanning ? (
                <>
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <WWText variant="bodyLarge" style={styles.emptyText}>
                        Scanning for nearby devices...
                    </WWText>
                </>
            ) : (
                <>
                    <WWText variant="titleMedium" style={styles.emptyTitle}>
                        No Devices Found
                    </WWText>
                    <WWText variant="bodyMedium" style={styles.emptyText}>
                        To make your camera discoverable, press the button on the Wildlife Watcher until the blue Bluetooth icon lights up.
                    </WWText>
                </>
            )}
        </View>
    )

    return (
        <WWScreenView scrollable={false}>
            <View style={styles.container}>
                {/* Header Title based on mode */}
                <View style={styles.header}>
                    <WWText variant="titleLarge" style={styles.title}>
                        {mode === 'prepare' ? 'Select Device to Prepare' : 'Engineer Console: Select Device'}
                    </WWText>
                </View>

                {/* Scan Button */}
                <View style={styles.headerView}>
                    <View style={styles.buttonRow}>
                        <WWButton
                            mode="contained"
                            onPress={handleScan}
                            loading={isScanning}
                            style={styles.scanButton}
                        >
                            {isScanning ? 'Scanning' : 'Scan'}
                        </WWButton>
                    </View>
                </View>

                {/* Devices List */}
                <FlatList
                    data={devicesToDisplay}
                    renderItem={({ item }) => (
                        <DeviceItem
                            disabled={isAnyDeviceConnecting}
                            item={item}
                            disconnect={handleDisconnect}
                            go={handleDeviceSelect}
                            upgrade={() => { }} // No-op for selection screen
                        />
                    )}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={renderEmptyState}
                />
            </View>
        </WWScreenView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
        alignItems: 'center',
    },
    title: {
        textAlign: 'center',
    },
    headerView: {
        marginBottom: 16,
        alignItems: 'center',
    },
    buttonRow: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    scanButton: {
        flex: 1,
        backgroundColor: '#4CAF50',
    },
    listContent: {
        flexGrow: 1,
        paddingHorizontal: 16,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyTitle: {
        marginBottom: 12,
        textAlign: 'center',
    },
    emptyText: {
        textAlign: 'center',
        color: '#6B7280',
        marginBottom: 16,
    },
})
