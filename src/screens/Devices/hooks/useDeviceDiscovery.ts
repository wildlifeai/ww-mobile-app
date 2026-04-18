import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Alert } from 'react-native'
import { useIsFocused, useNavigation, useRoute, RouteProp } from '@react-navigation/native'

import { useBleActions } from '../../../providers/BleEngineProvider'

import { useDevicePreDeploymentChecks } from '../../../hooks/useDevicePreDeploymentChecks'
import { useAppSelector } from '../../../redux'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { DeviceService } from '../../../services/DeviceService'
import { selectCurrentOrganisation } from '../../../redux/slices/authSlice'
import { DeploymentService } from '../../../services/DeploymentService'
import ProjectService from '../../../services/ProjectService'
import { RootStackParamList } from '../../../navigation/types'
import { useBleInitialization } from '../../../hooks/useBleInitialization'
import { getSupabaseClient } from '../../../services/supabase'
import { log, logError } from '../../../utils/logger'
import { sleep } from '../../../utils/helpers'
import { ScannerRoutingState } from '../components/ScannerRoutingDialog'
import { InitPayload } from '../../../navigation/types'


type DeviceDiscoveryScreenRouteProp = RouteProp<RootStackParamList, 'DeviceDiscovery'>

type UseDeviceDiscoveryOptions = {
    isDrawerOpen?: boolean
    isActiveTab?: boolean
}

export const useDeviceDiscovery = (options?: UseDeviceDiscoveryOptions) => {
    const isDrawerOpen = options?.isDrawerOpen ?? false
    const isActiveTab = options?.isActiveTab ?? true
    const navigation = useNavigation()
    const route = useRoute<DeviceDiscoveryScreenRouteProp>()

    const { isBleConnecting, startScan, stopScan, connectDevice, disconnectDevice } = useBleActions()
    const { runChecks: runPreDeploymentChecks } = useDevicePreDeploymentChecks()
    const { initialize: runBleStandardInit } = useBleInitialization()
    const devices = useAppSelector((state) => state.devices)
    const { isScanning } = useAppSelector((state) => state.scanning)
    const currentOrganisation = useAppSelector(selectCurrentOrganisation)
    const user = useAppSelector((state) => state.authentication.user)

    const mode = route.params?.mode || 'auto'

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
    const [routingParams, setRoutingParams] = useState<any>({})
    const routingStateRef = useRef<ScannerRoutingState>('idle')
    const updateRoutingState = useCallback((state: ScannerRoutingState, params?: any) => {
        routingStateRef.current = state
        if (params) setRoutingParams(params)
        setRoutingState(state)
    }, [])
    const [routingIsProcessing] = useState(false)

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
        // Also ensure that if we are a tab, we are the active tab
        const isActuallyFocused = isFocused && !isDrawerOpen && isActiveTab

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
    }, [isFocused, isDrawerOpen, isActiveTab, isScanning, isBleConnecting, processing, connectingDevice, startScan, stopScan])

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

                    if (mode === 'auto') {
                        await addLog('Finding the state of the device...')

                        // Step 1: Check for active deployment
                        if (dbDevice) {
                            const status = await DeviceService.calculateDeviceStatus(dbDevice.id)

                            if (status === 'deployed') {
                                const activeDeployment = await DeploymentService.getActiveDeploymentForDeviceId(dbDevice.id)
                                if (activeDeployment) {
                                    const projectAccess = await ProjectService.getProjectById(activeDeployment.projectId)

                                    if (!projectAccess) {
                                        // Fetch project name from Supabase directly
                                        let projectName = 'this project'
                                        try {
                                            const { data } = await getSupabaseClient().from('projects').select('name').eq('id', activeDeployment.projectId).single()
                                            if (data?.name) projectName = data.name
                                        } catch (e) {
                                            logError('Failed to fetch project name from supabase', e)
                                        }
                                        updateRoutingState('no_access_active_deployment', { projectName })
                                        return
                                    } else {
                                        // User has access -> Run Checks -> Route to End Deployment
                                        await addLog('Verifying device health...')
                                        const initResult = await runBleStandardInit(connectedDevice, {
                                            onProgress: (step) => addLog(step)
                                        })
                                        
                                        const initPayload: InitPayload = {
                                            batteryLevel: null,
                                            sdCardStatus: null,
                                            deviceFirmwareVersion: null,
                                            bleFirmwareUpdateAvailable: false,
                                            initErrors: {
                                                setUtc: initResult.errors?.setUtc,
                                                deviceHealth: initResult.errors?.deviceHealth || []
                                            }
                                        }

                                        ;(navigation as any).navigate('StopMonitoringDetailsStep', {
                                            deploymentId: activeDeployment.id,
                                            deviceId: dbDevice.id,
                                            bleDeviceId: connectedDevice.id,
                                            initPayload
                                        })
                                    }
                                    setProcessing(false)
                                    setConnectingDevice(null)
                                    return
                                }
                            }

                            // Step 2 & 3: Not Deployed -> Check user projects & Auto-route to Start Deployment
                            await addLog('Checking available projects...')
                            if (user?.id && currentOrganisation?.id) {
                                const projects = await ProjectService.getProjectsForUserInOrganisation(user.id, currentOrganisation.id)

                                if (projects.length === 0) {
                                    updateRoutingState('no_projects')
                                    return
                                } else {
                                    // Found projects! Select the best default
                                    const lastEndedDeployment = await DeploymentService.getLastEndedDeploymentForDeviceId(dbDevice.id)
                                    
                                    let targetProjectId = projects[0].id // Fallback
                                    
                                    if (lastEndedDeployment && projects.some(p => p.id === lastEndedDeployment.projectId)) {
                                        targetProjectId = lastEndedDeployment.projectId
                                    }

                                    // Pre-deployment Health Checks
                                    const initPayload = await runPreDeploymentChecks(connectedDevice, (step) => {
                                        addLog(step)
                                    })
                                    
                                    await addLog('Ready for deployment')

                                    // Route directly to Start Deployment
                                    ;(navigation as any).navigate('StartMonitoringDetailsStep', {
                                        projectId: targetProjectId,
                                        deviceId: dbDevice.id,
                                        bleDeviceId: connectedDevice.id,
                                        initPayload
                                    })
                                }
                            } else {
                                updateRoutingState('no_projects')
                                return
                            }

                            setProcessing(false)
                            setConnectingDevice(null)
                            return
                        }
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
                            
                            await addLog('Verifying device health...')
                            const initResult = await runBleStandardInit(connectedDevice, {
                                onProgress: (step) => addLog(step)
                            })
                            
                            const initPayload: InitPayload = {
                                batteryLevel: null,
                                sdCardStatus: null,
                                deviceFirmwareVersion: null,
                                bleFirmwareUpdateAvailable: false,
                                initErrors: {
                                    setUtc: initResult.errors?.setUtc,
                                    deviceHealth: initResult.errors?.deviceHealth || []
                                }
                            }

                            ;(navigation as any).navigate('StopMonitoringDetailsStep', {
                                deploymentId: activeDeployment.id,
                                deviceId: dbDevice.id,
                                bleDeviceId: connectedDevice.id,
                                initPayload
                            })
                            setProcessing(false)
                            setConnectingDevice(null)
                            return
                        }
                    }
                }
            } catch (error) {
                logError('Error connecting to device:', error)
                Alert.alert('Connection Failed', 'Could not connect to device. It might be in DFU mode or out of range.', [
                    { 
                        text: 'OK', 
                        onPress: () => {
                            autoConnectIgnoredDevicesRef.current.delete(device.id)
                        } 
                    }
                ])
            } finally {
                if (!navigation.isFocused()) {
                    setConnectingDevice(null)
                    setConnectionLogs([])
                }
                if (routingStateRef.current === 'idle') {
                    setProcessing(false)
                }
            }
        },
        [connectDevice, disconnectDevice, navigation, currentOrganisation, mode, processing, user?.id, stopScan, addLog, updateRoutingState, runBleStandardInit, runPreDeploymentChecks]
    )

    // --- Scanner Routing Dialog Callbacks ---

    const handleRoutingCreateProject = useCallback(() => {
        updateRoutingState('idle');
        setProcessing(false);
        setConnectingDevice(null);
        (navigation as any).navigate('NewProjectScreen')
    }, [navigation, updateRoutingState])

    const handleRoutingDismiss = useCallback(() => {
        updateRoutingState('idle')
        setProcessing(false);
        setConnectingDevice(null);
        // Ensure any active connection is thoroughly killed on dismiss
        if (Object.values(devices).find(d => d.connected)) {
            Object.values(devices).filter(d => d.connected).forEach(d => disconnectDevice(d))
        }
        
        // 2-second cool off period before auto-connect can re-trigger
        setTimeout(() => {
            if (autoConnectIgnoredDevicesRef.current) {
                autoConnectIgnoredDevicesRef.current.clear()
            }
        }, 2000)
    }, [disconnectDevice, devices, updateRoutingState])

    // Auto-connect logic
    const autoConnectIgnoredDevicesRef = useRef<Set<string>>(new Set())
    const { isEngineerConsoleActive } = useAppSelector((state) => state.scanning)

    // Clear the ignore list (cool-off period) whenever focus returns to this screen
    // or when the user changes organisation.
    // This allows users to immediately reconnect to devices they just backed out of
    // or if they switched orgs to find a project.
    useEffect(() => {
        if (isFocused) {
            autoConnectIgnoredDevicesRef.current.clear()
        }
    }, [isFocused, currentOrganisation?.id])

    useEffect(() => {
        // Treat an open drawer the same as not being focused (pause background operations)
        // Also ensure that if we are a tab, we are the active tab
        const isActuallyFocused = isFocused && !isDrawerOpen && isActiveTab

        // Prevent auto-connect if we're not focused, processing a connection, ANY device is currently connecting,
        // OR the Engineer Console is actively scanning for a device
        if (isActuallyFocused && !isAnyDeviceConnecting && !isEngineerConsoleActive && devicesToDisplay.length >= 1) {
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
    }, [isFocused, isDrawerOpen, isActiveTab, isAnyDeviceConnecting, isEngineerConsoleActive, devicesToDisplay, mode, processing, handleDeviceSelect])

    const handleDisconnect = useCallback(async (device: ExtendedPeripheral) => {
        log(`Disconnecting from ${device.id}`)

        setConnectingDevice(null)
        setConnectionLogs([])
        setProcessing(false)

        await disconnectDevice(device)

        // 2-second cool off period after explicit disconnect
        setTimeout(() => {
            if (autoConnectIgnoredDevicesRef.current) {
                autoConnectIgnoredDevicesRef.current.delete(device.id)
            }
        }, 2000)
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
        routingParams,
        routingIsProcessing,
        handleRoutingCreateProject,
        handleRoutingDismiss,
    }
}
