import { useState, useMemo, useCallback, useEffect } from 'react'
import { Alert } from 'react-native'
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native'

import { useBleActions } from '../../../providers/BleEngineProvider'
import { useAppSelector } from '../../../redux'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { DeviceService } from '../../../services/DeviceService'
import { selectCurrentOrganisation } from '../../../redux/slices/authSlice'
import { DevicePreparationService } from '../../../services/DevicePreparationService'
import { DeploymentService } from '../../../services/DeploymentService'
import { RootStackParamList } from '../../../navigation/types'
import { log, logError } from '../../../utils/logger'

type DeviceDiscoveryScreenRouteProp = RouteProp<RootStackParamList, 'DeviceDiscovery'>

export const useDeviceDiscovery = () => {
    const navigation = useNavigation()
    const route = useRoute<DeviceDiscoveryScreenRouteProp>()

    const { isBleConnecting, startScan, connectDevice, disconnectDevice } = useBleActions()
    const devices = useAppSelector((state) => state.devices)
    const { isScanning } = useAppSelector((state) => state.scanning)
    const currentOrganisation = useAppSelector(selectCurrentOrganisation)
    const user = useAppSelector((state) => state.authentication.user)

    const mode = route.params?.mode || 'auto' // Default to 'auto' for the new UX flow

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

    const [processing, setProcessing] = useState(false)


    // Start scanning when screen is focused
    useFocusEffect(
        useCallback(() => {
            startScan(10)

            const interval = setInterval(() => {
                if (!isBleBusy) {
                    startScan(10)
                } else {
                    log('Scanning already taking place, skipping.')
                }
            }, 30 * 1000)

            return () => {
                clearInterval(interval)
            }
        }, [startScan, isBleBusy])
    )

    const handleScan = useCallback(() => {
        if (!isBleBusy && !isScanning) {
            startScan()
        } else {
            log('Scanning already taking place, skipping.')
        }
    }, [isBleBusy, isScanning, startScan])

    const handleDeviceSelect = useCallback(
        async (device: ExtendedPeripheral) => {
            if (processing) return
            log(`Device selected: ${device.id}, mode: ${mode}`)
            setProcessing(true)
            try {
                // 1. Connect to the device
                log(`Connecting to device ${device.id}...`)
                const connectedDevice = await connectDevice(device)
                log(`Connect result: ${connectedDevice.connected}`)

                if (connectedDevice.connected) {
                    // 4. Mode-specific logic
                    log(`Proceeding with mode: ${mode}`)

                    if (mode === 'engineer') {
                        // Navigate to Engineer Console (Terminal) directly - NO DB interaction
                        (navigation as any).navigate('EngineerConsoleScreen', { deviceId: device.id })
                        setProcessing(false)
                        return
                    }

                    if (mode === 'prepare') {
                        // Navigate directly to Prepare and Test (Immediate Navigation Optimization)
                        log(`[DeviceDiscovery] Immediate navigation to PrepareAndTest for ${device.id}`);
                        (navigation as any).navigate('PrepareAndTest', {
                            bleDeviceId: connectedDevice.id,
                        })
                        setProcessing(false)
                        return
                    }

                    // For 'end_deployment', we need the device in the DB
                    // 2. Check if device exists in DB
                    log(`Checking DB for device ${device.id}...`)
                    let dbDevice = await DeviceService.getDeviceByBluetoothId(device.id)
                    log(`DB Device found: ${!!dbDevice}`)

                    // 3. If not found, create it
                    if (!dbDevice) {
                        if (currentOrganisation?.id && user?.id) {
                            log(`Creating device in DB for org ${currentOrganisation.id}...`)
                            try {
                                dbDevice = await DeviceService.createDevice(
                                    device.id,
                                    device.name || 'Unknown Device',
                                    currentOrganisation.id,
                                    user.id
                                )
                                log(`Device created: ${dbDevice?.id}`)
                            } catch (error) {
                                logError('Error creating device in DB:', error)
                                dbDevice = await DeviceService.getDeviceByBluetoothId(device.id)
                            }
                        } else {
                            log('No organisation or user selected')
                            Alert.alert('Error', 'No organisation selected or user not logged in. Cannot create device.')
                            await disconnectDevice(device)
                            setProcessing(false)
                            return
                        }
                    }

                    if (mode === 'auto') {
                        // Smart Routing: End Deployment, Start Deployment, or Prepare
                        let status = 'unprepared'
                        if (dbDevice) {
                            status = await DeviceService.calculateDeviceStatus(dbDevice.id)
                        }

                        if (status === 'deployed') {
                            // Proceed to End Deployment Step 2 immediately if possible, else Wizard
                            const activeDeployment = dbDevice ? await DeploymentService.getActiveDeploymentForDeviceId(dbDevice.id) : null
                            if (activeDeployment) {
                                log(`activeDeployment found: ${activeDeployment.id}. Proceeding to End Deployment details.`);
                                (navigation as any).navigate('EndDeploymentDetailsStep', {
                                    deploymentId: activeDeployment.id,
                                    deviceId: dbDevice!.id,
                                    bleDeviceId: connectedDevice.id
                                })
                            } else {
                                (navigation as any).navigate('EndDeploymentWizard', { mode: 'end_deployment' })
                                disconnectDevice(device)
                            }
                            setProcessing(false)
                            return
                        }

                        // Check preparation status
                        const lastPrep = dbDevice ? await DevicePreparationService.getLastCompletedPreparation(dbDevice.id) : null
                        const lastEndedDeployment = dbDevice ? await DeploymentService.getLastEndedDeploymentForDeviceId(dbDevice.id) : null

                        const isFreshlyPrepared = lastPrep && (
                            !lastEndedDeployment ||
                            !lastEndedDeployment.deploymentEnd ||
                            lastPrep.createdAt > lastEndedDeployment.deploymentEnd
                        )

                        if (isFreshlyPrepared && lastPrep.isDeploymentReady) {
                            log(`Device ${dbDevice?.id} is prepared. Proceeding to Start deployment.`);
                            (navigation as any).navigate('DeploymentDetailsStep', {
                                devicePreparationId: lastPrep.id,
                                deviceId: dbDevice!.id,
                                bleDeviceId: connectedDevice.id
                            })
                        } else {
                            log(`Device ${dbDevice?.id} not fully prepared. Redirecting to preparation.`);
                            (navigation as any).navigate('PrepareAndTest', {
                                bleDeviceId: connectedDevice.id,
                            })
                        }
                        setProcessing(false)
                        return
                    }

                    if ((mode as string) === 'end_deployment') {
                        if (dbDevice) {
                            const activeDeployment = await DeploymentService.getActiveDeploymentForDeviceId(dbDevice.id)

                            if (!activeDeployment) {
                                log(`Device ${dbDevice.id} has no active deployment.`)
                                Alert.alert(
                                    'No Active Deployment',
                                    'This device is not part of an active deployment.',
                                    [{ text: 'OK', onPress: () => disconnectDevice(device) }]
                                )
                                setProcessing(false)
                                return
                            }

                            // Proceed to End Deployment Step 2
                            log(`activeDeployment found: ${activeDeployment.id}. Proceeding to End Deployment details.`);
                            (navigation as any).navigate('EndDeploymentDetailsStep', {
                                deploymentId: activeDeployment.id,
                                deviceId: dbDevice.id,
                                bleDeviceId: connectedDevice.id
                            })
                            return // Done
                        }
                    }

                    if (mode === 'deployment') {
                        // Smart Routing: Check if device is prepared
                        if (dbDevice) {
                            // Check for active deployment first
                            const status = await DeviceService.calculateDeviceStatus(dbDevice.id)

                            if (status === 'deployed') {
                                Alert.alert(
                                    'Device Already Deployed',
                                    'This device is currently deployed. Do you want to end the current deployment?',
                                    [
                                        { text: 'Cancel', onPress: () => disconnectDevice(device), style: 'cancel' },
                                        {
                                            text: 'End Deployment', onPress: () => {
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
                            const lastEndedDeployment = await DeploymentService.getLastEndedDeploymentForDeviceId(dbDevice.id)

                            log(`[DeviceDiscovery] Prep Check: LastPrep=${lastPrep?.createdAt}, LastEnded=${lastEndedDeployment?.deploymentEnd}`)

                            const isFreshlyPrepared = lastPrep && (
                                !lastEndedDeployment ||
                                !lastEndedDeployment.deploymentEnd ||
                                lastPrep.createdAt > lastEndedDeployment.deploymentEnd
                            )

                            if (isFreshlyPrepared && lastPrep.isDeploymentReady) {
                                log(`Device ${dbDevice.id} is prepared. Proceeding to details.`);
                                (navigation as any).navigate('DeploymentDetailsStep', {
                                    devicePreparationId: lastPrep.id,
                                    deviceId: dbDevice.id,
                                    bleDeviceId: connectedDevice.id
                                })
                            } else {
                                log(`Device ${dbDevice.id} not fully prepared. Redirecting to preparation.`)
                                Alert.alert(
                                    "Device Not Prepared",
                                    "This device has not been prepared since its last deployment.\n\nPlease prepare and test the device before deploying.",
                                    [
                                        {
                                            text: "Go to Preparation", onPress: () => {
                                                (navigation as any).navigate('PrepareAndTest', {
                                                    deviceId: dbDevice!.id,
                                                    bleDeviceId: connectedDevice.id,
                                                    nextRoute: 'DeploymentDetailsStep'
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
                logError('Error connecting to device:', error)
                Alert.alert('Connection Failed', 'Could not connect to device. It might be in DFU mode or out of range.')
            } finally {
                setProcessing(false)
            }
        },
        [connectDevice, disconnectDevice, navigation, currentOrganisation, mode, processing, user?.id]
    )

    // Auto-connect if exactly one device is found and we are in the base tab (auto mode)
    useEffect(() => {
        if (!isScanning && devicesToDisplay.length === 1 && mode === 'auto') {
            const singleDevice = devicesToDisplay[0]
            if (!singleDevice.connected && !singleDevice.loading && !processing) {
                log(`[DeviceDiscovery] Auto-connecting to the only discovered device: ${singleDevice.id}`)
                handleDeviceSelect(singleDevice)
            }
        }
    }, [isScanning, devicesToDisplay, mode, isAnyDeviceConnecting, processing, handleDeviceSelect])

    const handleDisconnect = useCallback(async (device: ExtendedPeripheral) => {
        log(`Disconnecting from ${device.id}`)
        await disconnectDevice(device)
    }, [disconnectDevice])

    return {
        devicesToDisplay,
        isAnyDeviceConnecting,
        isScanning,
        mode,
        handleScan,
        handleDeviceSelect,
        handleDisconnect
    }
}
