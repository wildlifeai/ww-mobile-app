import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Alert } from 'react-native'
import { useIsFocused, useNavigation, useRoute, RouteProp } from '@react-navigation/native'

import { useBleActions } from '../../../providers/BleEngineProvider'
import { useBleCommands } from "../../../hooks/useBleCommands"
import { useAppDispatch, useAppSelector } from '../../../redux'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { DeviceService } from '../../../services/DeviceService'
import { selectCurrentOrganisation } from '../../../redux/slices/authSlice'
import { DevicePreparationService } from '../../../services/DevicePreparationService'
import { DeploymentService } from '../../../services/DeploymentService'
import ProjectService from '../../../services/ProjectService'
import { RootStackParamList } from '../../../navigation/types'
import { log, logError } from '../../../utils/logger'
import { sleep } from '../../../utils/helpers'
import { ScannerRoutingState } from '../components/ScannerRoutingDialog'
import { ProjectWithDetails } from '../../../types/project'
import Device from '../../../database/models/Device'
import Deployment from '../../../database/models/Deployment'

type DeviceDiscoveryScreenRouteProp = RouteProp<RootStackParamList, 'DeviceDiscovery'>

type UseDeviceDiscoveryOptions = {
    isDrawerOpen?: boolean
}

export const useDeviceDiscovery = (options?: UseDeviceDiscoveryOptions) => {
    const isDrawerOpen = options?.isDrawerOpen ?? false
    const navigation = useNavigation()
    const dispatch = useAppDispatch()
    const route = useRoute<DeviceDiscoveryScreenRouteProp>()

    const { isBleConnecting, startScan, stopScan, connectDevice, disconnectDevice } = useBleActions()
    const { setGpsLocation } = useBleCommands()
    const devices = useAppSelector((state) => state.devices)
    const { isScanning } = useAppSelector((state) => state.scanning)
    const currentOrganisation = useAppSelector(selectCurrentOrganisation)
    const user = useAppSelector((state) => state.authentication.user)
    const { currentLocation } = useAppSelector(state => state.location)

    const mode = route.params?.mode || 'auto'

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
    const [connectingDevice, setConnectingDevice] = useState<ExtendedPeripheral | null>(null)
    const [connectionLogs, setConnectionLogs] = useState<string[]>([])

    // Scanner Routing Dialog state
    const [routingState, setRoutingState] = useState<ScannerRoutingState>('idle')
    const [routingProjects, setRoutingProjects] = useState<ProjectWithDetails[]>([])
    const [routingDeviceName, setRoutingDeviceName] = useState<string | null>(null)
    const [routingIsProcessing, setRoutingIsProcessing] = useState(false)

    // Refs to hold device context for dialog callbacks
    const connectedDeviceRef = useRef<ExtendedPeripheral | null>(null)
    const dbDeviceRef = useRef<Device | null>(null)
    const activeDeploymentRef = useRef<Deployment | null>(null)
    const lastPrepRef = useRef<any>(null)

    // We use a ref so the effect doesn't constantly re-run and interrupt scans
    const isReadyToScanRef = useRef(!isBleConnecting && !isScanning && !processing && !connectingDevice)
    isReadyToScanRef.current = !isBleConnecting && !isScanning && !processing && !connectingDevice

    const isFocused = useIsFocused()
    const scanCommandLockRef = useRef(false)

    // Continuous state-driven scan loop
    useEffect(() => {
        isReadyToScanRef.current = !isBleConnecting && !isScanning && !processing && !connectingDevice

        const isReadyForNewScan = !isBleConnecting && !processing && !connectingDevice

        // Treat an open drawer the same as not being focused (pause background operations)
        const isActuallyFocused = isFocused && !isDrawerOpen

        if (isActuallyFocused && isReadyForNewScan) {
            if (!isScanning && !scanCommandLockRef.current) {
                scanCommandLockRef.current = true
                startScan(5)
                setTimeout(() => {
                    scanCommandLockRef.current = false
                }, 500)
            }
        } else if (!isActuallyFocused && isScanning && !scanCommandLockRef.current) {
            scanCommandLockRef.current = true
            stopScan().then(() => {
                setTimeout(() => {
                    scanCommandLockRef.current = false
                }, 500)
            }).catch(() => {
                scanCommandLockRef.current = false
            })
        }
    }, [isFocused, isDrawerOpen, isScanning, isBleConnecting, processing, connectingDevice, startScan, stopScan])

    const handleScan = useCallback(() => {
        if (!isBleConnecting && !processing && !connectingDevice && !isScanning) {
            startScan(5)
        } else {
            log('Scanning already taking place or blocked, skipping.')
        }
    }, [isBleConnecting, processing, connectingDevice, isScanning, startScan])

    const addLog = useCallback(async (message: string) => {
        setConnectionLogs(prev => [...prev, message])
        await sleep(400)
    }, [])

    const handleDeviceSelect = useCallback(
        async (device: ExtendedPeripheral) => {
            if (processing) return
            log(`Device selected: ${device.id}, mode: ${mode}`)
            setProcessing(true)
            setConnectingDevice(device)
            setConnectionLogs(['Found Wildlife Watcher'])
            await sleep(400)

            try {
                await stopScan()

                log(`Connecting to device ${device.id}...`)
                await addLog('Pairing via Bluetooth...')
                const connectedDevice = await connectDevice(device)
                log(`Connect result: ${connectedDevice.connected}`)

                if (connectedDevice.connected) {
                    log(`Proceeding with mode: ${mode}`)

                    log(`Checking DB for device ${device.id}...`)
                    await addLog('Retrieving device profile...')
                    let dbDevice = await DeviceService.getDeviceByBluetoothId(device.id)
                    log(`DB Device found: ${!!dbDevice}`)

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
                            setConnectingDevice(null)
                            return
                        }
                    }

                    // Store refs for dialog callbacks
                    connectedDeviceRef.current = connectedDevice
                    dbDeviceRef.current = dbDevice || null

                    if (mode === 'auto') {
                        await addLog('Finding the state of the device...')

                        // Step 1: Check for active deployment
                        if (dbDevice) {
                            const status = await DeviceService.calculateDeviceStatus(dbDevice.id)

                            if (status === 'deployed') {
                                const activeDeployment = await DeploymentService.getActiveDeploymentForDeviceId(dbDevice.id)
                                if (activeDeployment) {
                                    activeDeploymentRef.current = activeDeployment
                                    setRoutingDeviceName(device.name || device.id)
                                    setRoutingState('active_deployment')
                                    setProcessing(false)
                                    setConnectingDevice(null)
                                    return
                                }
                            }

                            // Step 2: Check if device has been prepared before (associated)
                            const lastPrep = await DevicePreparationService.getLastCompletedPreparation(dbDevice.id)
                            const lastEndedDeployment = await DeploymentService.getLastEndedDeploymentForDeviceId(dbDevice.id)

                            const isFreshlyPrepared = lastPrep && (
                                !lastEndedDeployment ||
                                !lastEndedDeployment.deploymentEnd ||
                                lastPrep.createdAt > lastEndedDeployment.deploymentEnd
                            )

                            if (isFreshlyPrepared && lastPrep.isDeploymentReady) {
                                lastPrepRef.current = lastPrep
                                setRoutingDeviceName(device.name || device.id)
                                setRoutingState('start_deployment')
                                setProcessing(false)
                                setConnectingDevice(null)
                                return
                            }
                        }

                        // Step 3: Device is unassociated — fetch user projects
                        await addLog('Checking available projects...')
                        if (user?.id && currentOrganisation?.id) {
                            const projects = await ProjectService.getProjectsForUserInOrganisation(user.id, currentOrganisation.id)

                            if (projects.length === 0) {
                                setRoutingDeviceName(device.name || device.id)
                                setRoutingState('no_projects')
                            } else {
                                setRoutingProjects(projects)
                                setRoutingDeviceName(device.name || device.id)
                                setRoutingState('unassociated')
                            }
                        } else {
                            setRoutingDeviceName(device.name || device.id)
                            setRoutingState('no_projects')
                        }

                        setProcessing(false)
                        setConnectingDevice(null)
                        return
                    }

                    if ((mode as string) === 'end_deployment') {
                        if (dbDevice) {
                            await addLog('Checking active deployments...')
                            const activeDeployment = await DeploymentService.getActiveDeploymentForDeviceId(dbDevice.id)

                            if (!activeDeployment) {
                                log(`Device ${dbDevice.id} has no active deployment.`)
                                Alert.alert(
                                    'No Active Deployment',
                                    'This device is not part of an active deployment.',
                                    [{ text: 'OK', onPress: () => disconnectDevice(device) }]
                                )
                                setProcessing(false)
                                setConnectingDevice(null)
                                return
                            }

                            log(`activeDeployment found: ${activeDeployment.id}. Proceeding to End Deployment details.`);
                            (navigation as any).navigate('EndDeploymentDetailsStep', {
                                deploymentId: activeDeployment.id,
                                deviceId: dbDevice.id,
                                bleDeviceId: connectedDevice.id
                            })
                            setProcessing(false)
                            setConnectingDevice(null)
                            return
                        }
                    }
                }
            } catch (error) {
                logError('Error connecting to device:', error)
                Alert.alert('Connection Failed', 'Could not connect to device. It might be in DFU mode or out of range.')
            } finally {
                if (!navigation.isFocused()) {
                    setConnectingDevice(null)
                    setConnectionLogs([])
                }
                setProcessing(false)
            }
        },
        [connectDevice, disconnectDevice, navigation, currentOrganisation, mode, processing, user?.id, stopScan, addLog]
    )

    // --- Scanner Routing Dialog Callbacks ---

    const handleRoutingStartDeployment = useCallback(async () => {
        const dbDevice = dbDeviceRef.current
        const connDevice = connectedDeviceRef.current
        const lastPrep = lastPrepRef.current

        if (!dbDevice || !connDevice || !lastPrep) return

        setRoutingIsProcessing(true)
        try {
            // Check if the prep is tied to a project with GPS recording enabled
            if (lastPrep.project) {
                const project = await lastPrep.project.fetch()
                if (project && project.record_gps_in_images && currentLocation) {
                    log(`[Scanner] Auto-syncing GPS to device ${connDevice.id} for project ${project.id}`)
                    await setGpsLocation(connDevice, currentLocation.latitude, currentLocation.longitude, currentLocation.altitude)
                }
            }
        } catch (error) {
            logError('[Scanner] Optional GPS sync failed during start_deployment routing:', error)
        } finally {
            setRoutingIsProcessing(false)
            setRoutingState('idle');
            (navigation as any).navigate('DeploymentDetailsStep', {
                devicePreparationId: lastPrep.id,
                deviceId: dbDevice.id,
                bleDeviceId: connDevice.id
            })
        }
    }, [navigation, currentLocation, setGpsLocation])

    const handleRoutingStopDeployment = useCallback(() => {
        const dbDevice = dbDeviceRef.current
        const connDevice = connectedDeviceRef.current
        const activeDeployment = activeDeploymentRef.current

        if (!dbDevice || !connDevice || !activeDeployment) return

        setRoutingState('idle');
        (navigation as any).navigate('EndDeploymentDetailsStep', {
            deploymentId: activeDeployment.id,
            deviceId: dbDevice.id,
            bleDeviceId: connDevice.id
        })
    }, [navigation])

    const handleRoutingCreateProject = useCallback(() => {
        setRoutingState('idle');
        (navigation as any).navigate('NewProjectScreen')
    }, [navigation])

    const handleRoutingAssociateDevice = useCallback(async (projectId: string) => {
        const dbDevice = dbDeviceRef.current
        const connDevice = connectedDeviceRef.current

        if (!dbDevice || !connDevice || !user?.id) return

        setRoutingIsProcessing(true)
        try {
            // Check project GPS preferences
            const project = await ProjectService.getProjectById(projectId)
            if (project && project.record_gps_in_images && currentLocation) {
                log(`[Scanner] Auto-syncing GPS to device ${connDevice.id} for newly associated project ${projectId}`)
                await setGpsLocation(connDevice, currentLocation.latitude, currentLocation.longitude, currentLocation.altitude)
            }

            const dummyPrep = await DevicePreparationService.createDummyPreparationRecord(
                dbDevice.id,
                projectId,
                user.id
            )
            log(`[Scanner] Created dummy prep ${dummyPrep.id} for device ${dbDevice.id} -> project ${projectId}`)

            setRoutingState('idle');
            (navigation as any).navigate('DeploymentDetailsStep', {
                devicePreparationId: dummyPrep.id,
                deviceId: dbDevice.id,
                bleDeviceId: connDevice.id
            })
        } catch (error) {
            logError('[Scanner] Failed to associate device with project:', error)
            Alert.alert('Error', 'Failed to associate device with project. Please try again.')
        } finally {
            setRoutingIsProcessing(false)
        }
    }, [navigation, user?.id, currentLocation, setGpsLocation])

    const handleRoutingDismiss = useCallback(() => {
        setRoutingState('idle')
        setRoutingProjects([])
        setRoutingDeviceName(null)
        const connDevice = connectedDeviceRef.current
        if (connDevice) {
            disconnectDevice(connDevice)
        }
    }, [disconnectDevice])

    // Auto-connect logic
    const autoConnectIgnoredDevicesRef = useRef<Set<string>>(new Set())
    const { isEngineerConsoleActive } = useAppSelector((state) => state.scanning)

    useEffect(() => {
        // Treat an open drawer the same as not being focused (pause background operations)
        const isActuallyFocused = isFocused && !isDrawerOpen

        // Prevent auto-connect if we're not focused, processing a connection, ANY device is currently connecting,
        // OR the Engineer Console is actively scanning for a device
        if (isActuallyFocused && !isAnyDeviceConnecting && !isEngineerConsoleActive && devicesToDisplay.length >= 1 && mode === 'auto') {
            const deviceToConnect = devicesToDisplay.find(d =>
                !d.signalLost && !d.connected && !d.loading && !processing && !autoConnectIgnoredDevicesRef.current.has(d.id)
            )

            if (deviceToConnect) {
                log(`[DeviceDiscovery] Auto-connecting to discovered device: ${deviceToConnect.id}`)
                autoConnectIgnoredDevicesRef.current.add(deviceToConnect.id)
                handleDeviceSelect(deviceToConnect)
            }

            devicesToDisplay.forEach(d => {
                if (d.signalLost && autoConnectIgnoredDevicesRef.current.has(d.id)) {
                    autoConnectIgnoredDevicesRef.current.delete(d.id)
                }
            })
        }
    }, [isFocused, isDrawerOpen, isAnyDeviceConnecting, isEngineerConsoleActive, devicesToDisplay, mode, processing, handleDeviceSelect])

    const handleDisconnect = useCallback(async (device: ExtendedPeripheral) => {
        log(`Disconnecting from ${device.id}`)

        setConnectingDevice(null)
        setConnectionLogs([])
        setProcessing(false)

        await disconnectDevice(device)
    }, [disconnectDevice])

    return {
        devicesToDisplay,
        isAnyDeviceConnecting,
        isScanning,
        mode,
        handleScan,
        handleDeviceSelect,
        handleDisconnect,
        connectingDevice,
        connectionLogs,
        processing,
        // Scanner Routing Dialog
        routingState,
        routingProjects,
        routingDeviceName,
        routingIsProcessing,
        handleRoutingStartDeployment,
        handleRoutingStopDeployment,
        handleRoutingCreateProject,
        handleRoutingAssociateDevice,
        handleRoutingDismiss,
    }
}
