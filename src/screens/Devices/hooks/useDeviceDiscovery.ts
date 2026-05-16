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
import { useAutoConnectStateMachine } from './useAutoConnectStateMachine'
import { useScanLoop } from '../../../hooks/useScanLoop'
import { waitForInitialSync } from '../../../services/SyncBarrier'


type DeviceDiscoveryScreenRouteProp = RouteProp<RootStackParamList, 'DeviceDiscovery'>

type UseDeviceDiscoveryOptions = {
    isDrawerOpen?: boolean
    isActiveTab?: boolean
}

/**
 * Scan session lifecycle:
 *   idle → active → suspended → active  (navigation round-trip)
 *                              → expired (60s timeout)
 *   idle → active → expired              (no device found)
 *
 * 'suspended' preserves discovered devices and RSSI — no cache flush on resume.
 * 'idle' and 'expired' require a fresh start with cache flush.
 */
export type ScanSessionState = 'idle' | 'active' | 'suspended' | 'expired'

export const useDeviceDiscovery = (options?: UseDeviceDiscoveryOptions) => {
    const isDrawerOpen = options?.isDrawerOpen ?? false
    const isActiveTab = options?.isActiveTab ?? true
    const navigation = useNavigation()
    const route = useRoute<DeviceDiscoveryScreenRouteProp>()

    const { isBleConnecting, stopScan, connectDevice, disconnectDevice } = useBleActions()
    const { runChecks: runPreDeploymentChecks } = useDevicePreDeploymentChecks()
    const { initialize: runBleStandardInit } = useBleInitialization()
    const devices = useAppSelector((state) => state.devices)
    const { isEngineerConsoleActive } = useAppSelector((state) => state.scanning)
    const currentOrganisation = useAppSelector(selectCurrentOrganisation)
    const user = useAppSelector((state) => state.authentication.user)

    // Sync readiness — needed for project query gate
    const syncState = useAppSelector((state) => state.sync)
    const isOnline = useAppSelector((state) => state.network.isOnline)

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

    // ── Scan session state machine ──
    // Replaces boolean scanSessionActive + scanSessionExpired
    const [scanSessionState, setScanSessionState] = useState<ScanSessionState>('idle')
    const scanSessionStateRef = useRef<ScanSessionState>('idle')
    const updateScanSessionState = useCallback((state: ScanSessionState) => {
        scanSessionStateRef.current = state
        setScanSessionState(state)
    }, [])

    const [scanSecondsRemaining, setScanSecondsRemaining] = useState(60)

    // ── Operation token for connection cleanup ──
    // Prevents stale async completions from corrupting state after navigation
    const operationIdRef = useRef(0)

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

    // We use a ref so effects can read the latest values without re-running
    const isReadyToScanRef = useRef(!isBleConnecting && !processing && !connectingDevice)
    isReadyToScanRef.current = !isBleConnecting && !processing && !connectingDevice

    const isFocused = useIsFocused()

    // True when screen is visible AND scan session is active
    const isActuallyFocused = isFocused && !isDrawerOpen && isActiveTab
    const scanLoopActive = isActuallyFocused
        && isReadyToScanRef.current
        && scanSessionStateRef.current === 'active'
        && !isEngineerConsoleActive

    // ── Shared scan loop ──
    const { isScanning, flushBleCache } = useScanLoop({ active: scanLoopActive })

    // Auto-connect state machine — declared early because startScanSession and handleDeviceSelect use it
    const autoConnect = useAutoConnectStateMachine()

    // Start a NEW 60-second scan session (from idle or expired)
    const startScanSession = useCallback(async () => {
        autoConnect.resetAll()

        // Flush stale Redux devices and native BLE cache
        await flushBleCache()

        updateScanSessionState('active')
        setScanSecondsRemaining(60)
        log('[Scanner] New scan session started (60s)')
    }, [autoConnect, flushBleCache, updateScanSessionState])

    // ── Suspend/Resume on focus changes ──
    useEffect(() => {
        if (scanSessionStateRef.current === 'active' && !isActuallyFocused) {
            // Suspend: preserve devices, pause countdown, halt BLE transport
            updateScanSessionState('suspended')
            autoConnect.suspend()
            stopScan()
            log('[Scanner] Scan session suspended — screen lost focus')
        } else if (scanSessionStateRef.current === 'suspended' && isActuallyFocused) {
            // Resume: restart scan loop without flushing cache or wiping devices
            updateScanSessionState('active')
            autoConnect.resume()
            log('[Scanner] Scan session resumed')
        }
    }, [isActuallyFocused, autoConnect, stopScan, updateScanSessionState])

    // Countdown timer — only ticks during 'active' state
    useEffect(() => {
        if (scanSessionStateRef.current !== 'active' || !isActuallyFocused || processing) {
            return
        }

        const interval = setInterval(() => {
            setScanSecondsRemaining(prev => {
                if (prev <= 1) {
                    // Session expired
                    clearInterval(interval)
                    updateScanSessionState('expired')
                    stopScan()
                    log('[Scanner] Scan session expired — no device found')
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [scanSessionState, isActuallyFocused, processing, stopScan, updateScanSessionState])

    const handleScan = useCallback(() => {
        startScanSession()
    }, [startScanSession])

    const addLog = useCallback(async (message: string) => {
        setConnectionLogs(prev => [...prev, message])
        await sleep(400)
    }, [])


    const handleDeviceSelect = useCallback(
        async (device: ExtendedPeripheral) => {
            if (processing) return
            const currentOp = ++operationIdRef.current

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
                                            himaxFirmwareVersion: null,
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
                                    return
                                }
                            }

                            // Step 2 & 3: Not Deployed -> Check user projects & Auto-route to Start Deployment
                            await addLog('Checking available projects...')
                            if (user?.id && currentOrganisation?.id) {

                                // ── Sync readiness barrier ──
                                // If the initial sync hasn't completed yet, wait for it before
                                // concluding "no projects". This prevents the false-negative
                                // that occurs when the user connects faster than the post-login
                                // WatermelonDB hydration.
                                if (!syncState.hasCompletedInitialSync && syncState.isGlobalSyncing) {
                                    await addLog('Syncing project data…')
                                    await waitForInitialSync()
                                }

                                let projects: any[] = []
                                try {
                                    projects = await ProjectService.getProjectsForUserInOrganisation(user.id, currentOrganisation.id)
                                } catch (fetchErr: any) {
                                    logError('[DeviceDiscovery] Project fetch failed:', fetchErr)
                                    if (fetchErr.message?.toLowerCase().includes('timeout') || fetchErr.message?.toLowerCase().includes('aborted')) {
                                        updateRoutingState('loading_timeout')
                                    } else {
                                        updateRoutingState('network_error')
                                    }
                                    return
                                }

                                if (projects.length === 0) {
                                    // Distinguish "genuinely no projects" from "can't know"
                                    if (!syncState.hasCompletedInitialSync && !isOnline) {
                                        updateRoutingState('projects_unavailable_offline')
                                    } else {
                                        updateRoutingState('no_projects')
                                    }
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
                                himaxFirmwareVersion: null,
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
                            autoConnect.resetDevice(device.id)
                        } 
                    }
                ])
            } finally {
                // Operation token: only clean up if THIS operation is still current.
                // If operationIdRef has moved on, a newer operation owns cleanup.
                if (operationIdRef.current === currentOp) {
                    if (routingStateRef.current === 'idle') {
                        setProcessing(false)
                    }
                    setConnectingDevice(null)
                    setConnectionLogs([])
                }
            }
        },
        [connectDevice, disconnectDevice, navigation, currentOrganisation, mode, processing, user?.id, stopScan, addLog, updateRoutingState, runBleStandardInit, runPreDeploymentChecks, autoConnect, syncState.hasCompletedInitialSync, syncState.isGlobalSyncing, isOnline]
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
        
        // Transition to IGNORED_FOR_SESSION — device stays ignored
        // until screen re-focus or manual retry. No 2-second cool-off.
        if (connectingDevice) {
            autoConnect.transition(connectingDevice.id, 'IGNORED_FOR_SESSION')
        }
    }, [disconnectDevice, devices, updateRoutingState, connectingDevice, autoConnect])

    // Auto-connect logic
    useEffect(() => {
        // Treat an open drawer the same as not being focused (pause background operations)
        // Also ensure that if we are a tab, we are the active tab
        const isFocusedForAutoConnect = isFocused && !isDrawerOpen && isActiveTab

        // Prevent auto-connect if we're not focused, processing a connection, ANY device is currently connecting,
        // OR the Engineer Console is actively scanning for a device,
        // OR no scan session is active (user hasn't pressed Search yet or session is suspended/expired)
        if (isFocusedForAutoConnect && !isAnyDeviceConnecting && !isEngineerConsoleActive && scanSessionStateRef.current === 'active' && devicesToDisplay.length >= 1) {
            const deviceToConnect = devicesToDisplay.find(d =>
                !d.signalLost && !d.connected && !d.loading && !processing && autoConnect.canAutoConnect(d.id)
            )

            if (deviceToConnect) {
                log(`[DeviceDiscovery] Auto-connecting to discovered device: ${deviceToConnect.id}`)
                autoConnect.transition(deviceToConnect.id, 'ROUTING_PENDING')
                handleDeviceSelect(deviceToConnect)
            }

            devicesToDisplay.forEach(d => {
                if (d.signalLost && !autoConnect.canAutoConnect(d.id)) {
                    autoConnect.resetDevice(d.id)
                }
            })
        }
    }, [isFocused, isDrawerOpen, isActiveTab, isAnyDeviceConnecting, isEngineerConsoleActive, devicesToDisplay, mode, processing, handleDeviceSelect, autoConnect, scanSessionState])

    const handleDisconnect = useCallback(async (device: ExtendedPeripheral) => {
        log(`Disconnecting from ${device.id}`)

        setConnectingDevice(null)
        setConnectionLogs([])
        setProcessing(false)

        await disconnectDevice(device)

        // Mark device as IGNORED_FOR_SESSION after explicit disconnect
        autoConnect.transition(device.id, 'IGNORED_FOR_SESSION')
    }, [disconnectDevice, autoConnect])

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
        // Scan session
        scanSessionState,
        scanSecondsRemaining,
        startScanSession,
        // Scanner Routing Dialog
        routingState,
        routingParams,
        routingIsProcessing,
        handleRoutingCreateProject,
        handleRoutingDismiss,
    }
}
