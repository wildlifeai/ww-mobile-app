import { useState, useEffect, useCallback, useRef } from 'react'
import { View, StyleSheet, Alert, PermissionsAndroid, Platform } from 'react-native'
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWText } from '../../components/ui/WWText'
import { WWButton } from '../../components/ui/WWButton'
import { WWIcon } from '../../components/ui/WWIcon'
import { InitializationHeader } from './components/InitializationHeader'
import { ProjectSelectionSection } from './components/ProjectSelectionSection'
import { DiagnosticsSection } from './components/DiagnosticsSection'
import { FirmwareSection } from './components/FirmwareSection'
import { HardwareBetaSection } from './components/HardwareBetaSection'
import { AppParams } from '../../navigation/index'
import { FinishProgressDialog } from './components/FinishProgressDialog'
import { HelpDialog } from '../../components/ui/HelpDialog'
import { DeviceService } from '../../services/DeviceService'
import { DevicePreparationService } from '../../services/DevicePreparationService'
import ReferenceDataService from '../../services/ReferenceDataService'
import { DfuService } from '../../services/DfuService'
import FirmwareService from '../../services/FirmwareService'
import { useBleCommands } from '../../hooks/useBleCommands'
import { useBle } from '../../hooks/useBle'
import { useBleInitialization } from '../../hooks/useBleInitialization'
import { useCapturePreview } from '../../hooks/useCapturePreview'
import { useDeviceSettings, OP_PARAMETER } from '../../hooks/useDeviceSettings'

import { useGetProjectsQuery } from '../../redux/api/projectsApi'
import { useAppSelector } from '../../redux'
import Device from '../../database/models/Device'
import DevicePreparation from '../../database/models/DevicePreparation'
import Firmware from '../../database/models/Firmware'
import database from '../../database'
import { ActivityIndicator, Text, useTheme } from 'react-native-paper'
import BleManager, { Peripheral } from 'react-native-ble-manager'
import { extractErrorBits } from '../../ble/messageClassifier'
import { log, logError, logWarn } from '../../utils/logger'


/**
 * Scans for the Nordic DFU booth loader which advertises as "DfuTarg"
 * after the device reboots into bootloader mode
 * @param timeoutMs How long to scan before giving up
 * @returns MAC address of the bootloader, or null if not found
 */
const scanForBootloader = (timeoutMs: number = 10000): Promise<string | null> => {
    return new Promise((resolve, reject) => {
        const eventEmitter = BleManager.addListener(
            'BleManagerDiscoverPeripheral',
            (peripheral: Peripheral) => {
                log('[scanForBootloader] Discovered:', peripheral.name, peripheral.id)

                // Check if this is the bootloader (WW500_DFU or DfuTarg)
                if (peripheral.name === 'WW500_DFU' || peripheral.name === 'DfuTarg') {
                    log('[scanForBootloader] Found bootloader at:', peripheral.id)
                    // Stop scanning
                    BleManager.stopScan().catch(err => logWarn('Failed to stop scan:', err))
                    // Remove listener
                    eventEmitter.remove()
                    // Return the address
                    resolve(peripheral.id)
                }
            }
        )

        // Start scanning
        BleManager.scan([], timeoutMs / 1000) // Convert to seconds
            .then(() => {
                log('[scanForBootloader] Scan started for DfuTarg')
            })
            .catch(err => {
                logError('[scanForBootloader] Scan failed:', err)
                eventEmitter.remove()
                reject(err)
            })

        // Timeout if not found
        setTimeout(() => {
            log('[scanForBootloader] Scan timeout, bootloader not found')
            BleManager.stopScan().catch(err => logWarn('Failed to stop scan:', err))
            eventEmitter.remove()
            resolve(null)
        }, timeoutMs)
    })
}

// Helper to compare version strings: "00.13.00" vs "0.13.0"
const compareVersions = (v1: string, v2: string) => {
    // Remove build suffixes (anything after -)
    const cleanV1 = v1.split('-')[0]
    const cleanV2 = v2.split('-')[0]

    // Strip non-numeric/dot characters just in case
    const norm1 = cleanV1.replace(/[^0-9.]/g, '').split('.').map(Number)
    const norm2 = cleanV2.replace(/[^0-9.]/g, '').split('.').map(Number)

    const len = Math.max(norm1.length, norm2.length)
    for (let i = 0; i < len; i++) {
        const num1 = norm1[i] || 0
        const num2 = norm2[i] || 0
        if (num1 > num2) return 1
        if (num1 < num2) return -1
    }
    return 0
}


export const PrepareAndTestScreen = () => {
    const route = useRoute<AppParams<'PrepareAndTest'>>()
    const navigation = useNavigation()
    const theme = useTheme()
    const { deviceId, bleDeviceId, selftestError, setUtcError } = route.params
    const user = useAppSelector((state) => state.authentication.user)

    const [device, setDevice] = useState<Device | undefined>()
    const [preparation, setPreparation] = useState<DevicePreparation | undefined>()
    const [selectedProject, setSelectedProject] = useState<string>('')
    const [loading, setLoading] = useState(true)

    // States for device checks
    const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
    const [sdCardStatus, setSdCardStatus] = useState<{ total: number; free: number } | null>(null)
    // Camera test state
    const [cameraTestPassed, setCameraTestPassed] = useState(false)
    const [cameraModelName, setCameraModelName] = useState<string | null>(null)
    const [isFinishing, setIsFinishing] = useState(false)
    const [finishProgress, setFinishProgress] = useState(0)
    const [finishStep, setFinishStep] = useState('')
    const [finishLogs, setFinishLogs] = useState<string[]>([])

    const addFinishLog = useCallback((log: string) => {
        setFinishLogs(prev => [...prev, log])
    }, [])

    // BLE firmware state
    const [latestBleFirmware, setLatestBleFirmware] = useState<Firmware | null>(null)
    const [deviceFirmwareVersion, setDeviceFirmwareVersion] = useState<string | null>(null)
    const [bleFirmwareUpdateAvailable, setBleFirmwareUpdateAvailable] = useState(false)
    const [firmwareUpdateProgress, setFirmwareUpdateProgress] = useState<number>(0)
    const [isUpdatingFirmware, setIsUpdatingFirmware] = useState(false)
    const [isCheckingFirmware, setIsCheckingFirmware] = useState(false)
    const [isVerifyingUpdate, setIsVerifyingUpdate] = useState(false)

    // Ref to track DFU in progress (prevents Connection Lost alert during expected disconnection)
    const isDfuInProgress = useRef(false)
    // Ref to track intentional navigation (prevents Connection Lost alert when finishing preparation)
    const isNavigatingAway = useRef(false)

    // Help Dialog State
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

    // BLE command hooks
    const { 
        getBatteryLevel, 
        checkSdCard, 
        setUtc, 
        getDeviceVer, 
        getDeviceName, 
        runDisconnect, 
        runDfu, 
        setDeploymentIdAsOps, 
        clearGpsLocation, 
        setOperationalParam, 
        getHeartbeat, 
        disableCamera, 
        flashLed,
        runSelfTest 
    } = useBleCommands()
    const { initialize: runBleStandardInit } = useBleInitialization()
    const { write } = useBle()
    const bleDevice = useAppSelector((state) => state.devices[bleDeviceId])
    // Use ref to track bleDevice for intervals without resetting them on every update
    const bleDeviceRef = useRef(bleDevice)
    useEffect(() => {
        bleDeviceRef.current = bleDevice
    }, [bleDevice])
    const logs = useAppSelector(state => state.logs[bleDeviceId || ''] || [])

    // Camera capture hook
    const { capturedImageUri, isCapturing: isCapturingImage, startCapture } = useCapturePreview({
        device: bleDevice,
        logs: logs,
        write: write,
        onImageReceived: (imageUri) => {
            log('[PrepareTest] Image received:', imageUri)
            setCameraTestPassed(true)
            if (preparation) {
                DevicePreparationService.updatePreparation(preparation.id, {
                    cameraViewTestPassed: true,
                    cameraModel: cameraModelName || 'WW500' // Use fetched name or default
                }).catch(error => logError('Failed to update preparation:', error))
            }
        }
    })

    // Device settings hook
    const { updateSettings: updateDeviceSettings, quiesceDevice } = useDeviceSettings({
        device: bleDevice,
        onError: (error) => {
            logError('[PrepareTest] Settings update failed:', error)
            Alert.alert('Settings Error', error.message)
        }
    })


    // Initialization errors from connection
    const [initErrors, setInitErrors] = useState<{ selftest?: string; setUtc?: string; deviceHealth?: string[] }>({})
    // Track whether BLE initialization has run
    const [isInitializing, setIsInitializing] = useState(false)
    const [initStep, setInitStep] = useState<string>('')
    const [initProgress, setInitProgress] = useState(0)
    const hasInitialized = useRef(false)

    // Load user projects using RTK Query (consistent with Projects screen)
    const currentOrganisation = useAppSelector((state) => state.authentication.currentOrganisation)
    // Using ref to track latest logs for the robust initialization sequence
    const logsRef = useRef(logs)
    useEffect(() => {
        logsRef.current = logs
    }, [logs])

    /**
     * Helper to wait for a specific log response since a given offset (or start of call)
     * This is much more robust than arbitrary timeouts and avoids missing bursts.
     */
    const waitForLogMatch = useCallback(async (regex: RegExp, timeoutMs: number = 5000, customOffset?: number): Promise<RegExpMatchArray> => {
        log(`[PrepareTest] Waiting for log match: ${regex} (timeout ${timeoutMs}ms)`)
        const startTime = Date.now()
        // Capture initial log length to only look at NEW logs (unless offset provided)
        const startOffset = customOffset !== undefined ? customOffset : logsRef.current.length

        return new Promise((resolve, reject) => {
            const check = () => {
                // Reconstruct string from entries since startOffset
                const sectionLogs = logsRef.current.slice(startOffset).map(e => e.content).join('')
                const match = sectionLogs.match(regex)
                if (match) {
                    log(`[PrepareTest] Found log match for: ${regex}`)
                    resolve(match)
                    return true
                }
                if (Date.now() - startTime > timeoutMs) {
                    reject(new Error(`Timeout waiting for log response: ${regex}`))
                    return true
                }
                return false
            }

            const interval = setInterval(() => {
                if (check()) clearInterval(interval)
            }, 100)
        })
    }, [])

    // Track if preparation has been initiated to prevent duplicates
    const hasStartedPreparation = useRef(false)
    const activeDeviceId = useRef<string | null>(null)

    // Reset started flag if deviceId changes
    useEffect(() => {
        if (activeDeviceId.current !== deviceId) {
            hasStartedPreparation.current = false
            activeDeviceId.current = deviceId
        }
    }, [deviceId])

    // Get loading state from projects query
    const { data: projects = [], isLoading: isLoadingProjects } = useGetProjectsQuery(
        { userId: user?.id!, organisationId: currentOrganisation?.id! },
        { skip: !user?.id || !currentOrganisation?.id }
    )

    const loadDeviceAndPreparation = useCallback(async () => {
        // Wait for user and projects to be ready
        if (!user?.id || isLoadingProjects) {
            log('[PrepareTest] Waiting for data dependencies (user/projects)...')
            return
        }

        // Only skip if we have ALREADY started for this flow
        if (hasStartedPreparation.current) {
            log('[PrepareTest] Preparation already started/loaded, skipping duplicate init.')
            return
        }
        
        hasStartedPreparation.current = true
        log('[PrepareTest] Loading data for device:', deviceId)

        try {
            const deviceData = await DeviceService.getDeviceById(deviceId)
            if (!deviceData) {
                logError('[PrepareTest] Device not found in record for ID:', deviceId)
                // Don't set hasStarted true here so we can retry if needed? 
                // Actually, if it's not in DB, it won't appear magically without a re-pair.
                setLoading(false)
                return
            }
            setDevice(deviceData)

            // Determine initial project ID
            let initialProjectId = ''
            
            // 1. Try to use last used project from previous preparation
            const lastPrep = await DevicePreparationService.getLastCompletedPreparation(deviceId)
            if (lastPrep && lastPrep.projectId) {
                initialProjectId = lastPrep.projectId
                log('[PrepareTest] Using last used project ID:', initialProjectId)
            }

            // 2. Fallback to first available project if no last prep or last prep project invalid
            if (!initialProjectId && projects && projects.length > 0) {
                initialProjectId = projects[0].id
                log('[PrepareTest] Defaulting to first available project:', projects[0].name)
            }

            // Update state (this won't re-trigger this function now)
            if (initialProjectId) {
                setSelectedProject(initialProjectId)
            }

            // Create new preparation record (startPreparation handles cleanup)
            log('[PrepareTest] Starting preparation record...')
            const newPrep = await DevicePreparationService.startPreparation(
                deviceId,
                initialProjectId,
                user.id
            )
            setPreparation(newPrep)
            log('[PrepareTest] Data loading complete.')
        } catch (error) {
            logError('[PrepareTest] Error loading device data:', error)
            Alert.alert('Loading Error', 'Failed to initialize the preparation session.')
            hasStartedPreparation.current = false // Allow retry on re-render
        } finally {
            setLoading(false)
        }
    }, [deviceId, projects, user?.id, isLoadingProjects])

    const handleProjectChange = useCallback(async (projectId: string) => {
        if (projectId === 'create_new') {
            // Navigate to NewProjectScreen
            // We use 'as any' because the route type might not be strictly defined in this file's context
            (navigation as any).navigate('NewProjectScreen')
            // Reset selection to allow selecting it again if needed (visual feel)
            // But we don't want to actually select 'create_new' as usage value
            return
        }

        setSelectedProject(projectId)
        if (preparation) {
            await database.write(async () => {
                await preparation.update((prep) => {
                    prep.projectId = projectId
                })
            })
        }
    }, [navigation, preparation])

    const handleFinish = useCallback(async () => {
        if (!selectedProject) {
            Alert.alert('Project Required', 'Please select a project before finishing preparation.')
            return
        }

        // Set navigation flag immediately to suppress connection-lost alerts
        // during intentional disconnect/navigation
        isNavigatingAway.current = true

        // Check if SD card check has passed
        const isSdCardOk = sdCardStatus?.total && sdCardStatus.total > 0
        if (!isSdCardOk) {
            Alert.alert(
                'SD Card Check Failed',
                'The SD card check has not passed. Please ensure a valid SD card is inserted and the device recognizes it.',
                [{ text: 'OK' }]
            )
            return
        }

        // Sanity Check: Ensure BLE is still connected
        if (!bleDevice || !bleDevice.connected) {
            Alert.alert(
                'Connection Lost',
                'The device is not connected. Please reconnect to finish preparation.',
                [{ text: 'OK' }]
            )
            return
        }

        try {
            // Use finishing states instead of generic loading
            setIsFinishing(true)
            setFinishProgress(0.1)
            setFinishStep('Finalizing configuration...')
            setFinishLogs([])
            addFinishLog('Initiating secure finalization...')

            const errors: string[] = []

            // 2. SAFE QUIESCE SEQUENCE
            try {
                if (preparation && bleDevice) {
                    // Step 1: Set Deployment ID (Op 20-27)
                    log('[PrepareTest] [Safe Quiesce] 1. Setting Deployment ID:', preparation.id)
                    setFinishStep('Saving Deployment ID...')
                    addFinishLog(`Sending Preparation ID: ${preparation.id.slice(0, 8)}...`)
                    await setDeploymentIdAsOps(bleDevice, preparation.id)
                    setFinishProgress(0.4)
                    addFinishLog('Success: ID saved to hardware')

                    // Step 2: Confirm (Green LED flash)
                    log('[PrepareTest] [Safe Quiesce] 2. Flashing confirmation LED...')
                    setFinishStep('LED Confirmation...')
                    addFinishLog('Triggering confirmation flash...')
                    await flashLed(bleDevice, 'green', 2, 500) // 2 flashes, 500ms each
                    
                    // Small delay to ensure LED command is received before potentially disconnecting
                    await new Promise(r => setTimeout(r, 1200))
                    setFinishProgress(0.7)
                    addFinishLog('Success: Device confirmed via LED')

                    // Step 3: Disconnect (if not proceeding to start deployment immediately)
                    const { nextRoute } = route.params || {}
                    if (!nextRoute) {
                        log('[PrepareTest] [Safe Quiesce] 3. Disconnecting device...')
                        setFinishStep('Disconnecting...')
                        addFinishLog('Closing BLE connection...')
                        await runDisconnect(bleDevice).catch(e => {
                            logError('Disconnect failed:', e)
                            addFinishLog('Warning: Cleanup disconnect failed')
                        })
                        setFinishProgress(0.9)
                        addFinishLog('Device disconnected')
                    } else {
                        log('[PrepareTest] [Safe Quiesce] 3. Skipping disconnect, proceeding to:', nextRoute)
                        addFinishLog(`Ready for: ${nextRoute}`)
                    }
                }
            } catch (error) {
                logError('[PrepareTest] Safe Quiesce Sequence failed:', error)
                errors.push('Final hardware configuration failed')
                addFinishLog('Error: Hardware communication failure')
            }

            // 3. Check for errors
            if (errors.length > 0) {
                setIsFinishing(false)
                Alert.alert(
                    'Preparation Incomplete',
                    `The following commands failed:\n\n${errors.map(e => `• ${e}`).join('\n')}\n\nPlease retry or contact support.`,
                    [{ text: 'OK' }]
                )
                return
            }

            // 4. Mark preparation as complete in database
            if (preparation) {
                setFinishStep('Finishing...')
                addFinishLog('Updating local database record...')
                const isReady = true
                await DevicePreparationService.completePreparation(preparation.id, isReady, selectedProject)
                setFinishProgress(1.0)
                addFinishLog('Session finalized successfully')

                // We stay in isFinishing=true state so the dialog stays visible at 100%
                // with the new 'Preparation Complete' style and 'OK' button.
                return 
            }
        } catch (error) {
            logError('Error completing preparation:', error)
            Alert.alert('Error', 'Failed to complete preparation')
            setIsFinishing(false) // Only reset on error
        }
    }, [selectedProject, sdCardStatus, bleDevice, setUtc, waitForLogMatch, projects, updateDeviceSettings, preparation, route.params, navigation, deviceId, bleDeviceId, runDisconnect])

    const handleFinishComplete = useCallback(() => {
        setIsFinishing(false)
        const { nextRoute } = route.params || {}
        if (nextRoute && preparation) {
            (navigation as any).navigate(nextRoute, {
                devicePreparationId: preparation.id,
                deviceId: deviceId,
                bleDeviceId: bleDeviceId
            })
        } else {
            // Redirect to Devices tab instead of just going back
            (navigation as any).navigate('Home', { initialTab: 'devices' })
        }
    }, [navigation, route.params, preparation, deviceId, bleDeviceId])

    const handleBatteryCheck = useCallback(async () => {
        log('[PrepareTest] Battery check requested, bleDevice:', bleDevice?.id, 'connected:', bleDevice?.connected)
        if (!bleDevice) {
            logWarn('[PrepareTest] No BLE device available for battery check')
            return
        }
        try {
            log('[PrepareTest] Sending battery level command...')
            await getBatteryLevel(bleDevice)
            log('[PrepareTest] Battery level command sent, waiting for response in logs')
            // Response will be parsed from logs in useEffect
        } catch (error) {
            logError('Battery check failed:', error)
            Alert.alert('Error', 'Failed to check battery level')
        }
    }, [bleDevice, getBatteryLevel])

    const handleSdCardCheck = useCallback(async () => {
        log('[PrepareTest] SD card check requested, bleDevice:', bleDevice?.id, 'connected:', bleDevice?.connected)
        if (!bleDevice) {
            logWarn('[PrepareTest] No BLE device available for SD card check')
            return
        }
        try {
            // 1. Run Self Test to check for hardware errors (Bit 11 = No SD Card)
            log('[PrepareTest] Step 1: Checking SD card presence (selftest)...')
            const statusMsg = await runSelfTest(bleDevice)
            log('[PrepareTest] Self-test result:', statusMsg)
            
            const hexBits = extractErrorBits(statusMsg)
            if (hexBits) {
                const errorBits = parseInt(hexBits, 16)
                // Bit 11 (0x0800): Device has no SD card detected
                const NO_SD_CARD_MASK = 0x0800
                
                if ((errorBits & NO_SD_CARD_MASK) !== 0) {
                    logWarn('[PrepareTest] SD Card Missing (Error bits set)')
                    Alert.alert(
                        'No SD Card Detected',
                        'The device reports that no SD card is inserted. Please insert a valid SD card and try again.',
                        [{ text: 'OK' }]
                    )
                    setSdCardStatus(null) // Ensure status is cleared
                    return // Stop here
                }
            }

            // 2. If present, try to get space info (AI info)
            log('[PrepareTest] Step 2: Checking SD card space (AI info)...')
            await checkSdCard(bleDevice)
            log('[PrepareTest] Space check command sent. Waiting for logs...')

            // Response will be parsed from logs in useEffect  
        } catch (error) {
            logError('SD card check failed:', error)
            Alert.alert('Error', 'Failed to check SD card status')
        }
    }, [bleDevice, checkSdCard, runSelfTest])

    const handleFirmwareCheck = useCallback(async () => {
        log('[PrepareTest] Firmware check requested, bleDevice:', bleDevice?.id, 'connected:', bleDevice?.connected)
        if (!bleDevice) {
            logWarn('[PrepareTest] No BLE device available for firmware check')
            return
        }
        try {
            setIsCheckingFirmware(true)
            setDeviceFirmwareVersion(null) // Reset to allow re-parsing
            log('[PrepareTest] Sending firmware version command...')
            await getDeviceVer(bleDevice)
            log('[PrepareTest] Firmware version command sent and resolved.')
            setIsCheckingFirmware(false)
        } catch (error) {
            logError('Firmware check failed:', error)
            setIsCheckingFirmware(false)
            Alert.alert('Error', 'Failed to check firmware version')
        }
    }, [bleDevice, getDeviceVer])

    const handleCameraTest = useCallback(async () => {
        await startCapture()
    }, [startCapture])

    const handleBleFirmwareUpdate = useCallback(async () => {
        if (!latestBleFirmware || !device || !bleDevice) {
            Alert.alert('Error', 'Firmware information not available')
            return
        }

        const isLowBattery = batteryLevel !== null && batteryLevel < 30
        const batteryWarning = isLowBattery
            ? "\n\n⚠️ WARNING: Battery is low. Updating with low battery increases the risk of device failure if power is lost during the process. Proceed with caution."
            : "\n\nMake sure the device battery is above 30%."

        Alert.alert(
            'Update BLE Firmware',
            `This will update the BLE firmware to version ${latestBleFirmware.version}. The process takes 2-3 minutes.${batteryWarning}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Update',
                    onPress: async () => {
                        try {
                            setIsUpdatingFirmware(true)
                            isDfuInProgress.current = true // Suppress Connection Lost alert during DFU
                            setFirmwareUpdateProgress(0)

                            // Use FirmwareService to handle download and caching (supports offline updates)
                            log('[PrepareTest] Ensuring firmware is available locally...')
                            const localUri = await FirmwareService.ensureFirmwareDownloaded(latestBleFirmware)
                            log('[PrepareTest] Firmware ready at:', localUri)

                            // Trigger DFU mode switch if connected
                            // This sends the "dfu" command, causing the device to reboot into DFU (Bootloader) mode
                            if (bleDevice.connected) {
                                log('[PrepareTest] Sending DFU command to reset device into bootloader mode...')
                                try {
                                    await runDfu(bleDevice)
                                    log('[PrepareTest] DFU command sent. Waiting 500ms for firmware processing...')

                                    // CRITICAL: Wait for firmware to receive and process the 'dfu' command
                                    await new Promise(r => setTimeout(r, 500))

                                    log('[PrepareTest] Disconnecting to trigger DFU mode switch...')
                                    await runDisconnect(bleDevice)

                                    // Give device time to reboot and advertise as DfuTarg
                                    log('[PrepareTest] Waiting 5s for reboot...')
                                    await new Promise(r => setTimeout(r, 5000))
                                } catch (e) {
                                    logWarn('[PrepareTest] Failed to send DFU command (device might already be in DFU mode?):', e)
                                }
                            }

                            // Request notification permission (Android 13+)
                            if (Platform.OS === 'android' && Platform.Version >= 33) {
                                try {
                                    const granted = await PermissionsAndroid.request(
                                        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
                                    )
                                    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                                        throw new Error('Notification permission required for firmware update')
                                    }
                                } catch (permErr) {
                                    logWarn('[PrepareTest] Notification permission warning:', permErr)
                                }
                            }

                            // Scan for bootloader
                            log('[PrepareTest] Scanning for bootloader...')
                            const bootloaderAddress = await scanForBootloader(10000)
                            if (!bootloaderAddress) {
                                throw new Error('Bootloader not found. Ensure device is in DFU mode (flashing red).')
                            }
                            log('[PrepareTest] Found bootloader at:', bootloaderAddress)

                            // Start DFU process
                            await DfuService.startDFU(
                                bootloaderAddress,
                                localUri,
                                (progress) => setFirmwareUpdateProgress(progress)
                            )

                            // Update preparation firmware_id in database
                            if (preparation) {
                                await database.write(async () => {
                                    await preparation.update(p => {
                                        p.bleFirmwareId = latestBleFirmware.id
                                    })
                                })
                            }

                            setFirmwareUpdateProgress(100)
                            
                            // Reset state for verification
                            setDeviceFirmwareVersion(null)
                            setIsCheckingFirmware(true)
                            setIsVerifyingUpdate(true)
                            setBleFirmwareUpdateAvailable(false) // Optimistically hide until verified

                            // Wait for reboot (approx 5-8s)
                            log('[PrepareTest] Waiting for device reboot...')
                            await new Promise(r => setTimeout(r, 8000))

                            // Reconnect and check
                            log('[PrepareTest] Attempting to reconnect for verification...')
                            if (bleDevice) {
                                // Manual connect attempt
                                try {
                                    // Make sure we're disconnected first to clean up
                                    await runDisconnect(bleDevice).catch(() => { })

                                    // Trigger the firmware check automatically
                                    handleFirmwareCheck()
                                } catch (reconnectErr) {
                                    logWarn('[PrepareTest] Reconnect failed:', reconnectErr)
                                    setIsVerifyingUpdate(false)
                                }
                            }

                        } catch (error) {
                            logError('[PrepareTest] Firmware update failed:', error)
                            Alert.alert('Update Failed', error instanceof Error ? error.message : 'Unknown error')
                            // setFirmwareUpToDate(false) - Removed undefined function
                        } finally {
                            setIsUpdatingFirmware(false)
                            isDfuInProgress.current = false // Re-enable connection monitoring
                        }
                    }
                }
            ]
        )
    }, [latestBleFirmware, device, bleDevice, batteryLevel, preparation, handleFirmwareCheck, runDisconnect, runDfu])


    // Check if user has any projects
    useEffect(() => {
        if (projects.length === 0 && !loading) {
            // Only show alert if we've attempted to load (checking length 0 might happen initially)
            // Ideally we'd have a separate loading state for projects, but for now this is ok
            // or just rely on the empty dropdown
        }
    }, [projects, loading])



    useEffect(() => {
        loadDeviceAndPreparation()
    }, [loadDeviceAndPreparation])

    // Check BLE firmware version on mount
    useEffect(() => {
        const checkBleFirmware = async () => {
            try {
                const latest = await ReferenceDataService.getLatestFirmware('ble')
                setLatestBleFirmware(latest)

                // Auto-triggering of firmware check on mount removed to simplify sequence.
                // Re-enable only if explicitly requested as part of init.
                /*
                if (bleDevice && bleDevice.connected && !deviceFirmwareVersion && !isCheckingFirmware) {
                    log('[PrepareTest] Auto-triggering firmware check on mount...')
                    handleFirmwareCheck()
                }
                */

                if (preparation && latest && preparation.bleFirmwareId) {
                    // Check based on preparation record first if available (fallback)
                    // const updateAvailable = preparation.bleFirmwareId !== latest.id
                    // ... logic continues ...
                }
            } catch (error) {
                logError('[PrepareTest] Failed to check BLE firmware:', error)
            }
        }

        checkBleFirmware()
    }, [bleDevice, deviceFirmwareVersion, isCheckingFirmware, handleFirmwareCheck, preparation]) // Re-run when device connects

    // Cleanup: Disconnect on unmount ONLY if we are not intentionally navigating to another flow
    useEffect(() => {
        return () => {
            // Use ref to check if navigating away
            if (bleDevice && bleDevice.connected && !isNavigatingAway.current) {
                log('[PrepareTest] Unmounting and NOT navigating away - Disconnecting device...')
                runDisconnect(bleDevice).catch(err => logError('[PrepareTest] Failed to disconnect on unmount:', err))
            } else {
                log('[PrepareTest] Unmounting but navigation is active (or device disconnected) - Skipping disconnect')
            }
        }
    }, [bleDevice, runDisconnect])

    // Heartbeat: Ping device every 20 seconds to keep it awake during preparation
    useEffect(() => {
        // Use boolean primitive to avoid re-running on every object reference change (RSSI updates etc)
        const isConnected = !!bleDevice?.connected
        if (!isConnected || isInitializing || loading) return

        log('[PrepareTest] Starting keep-alive heartbeat (20s interval)')
        const interval = setInterval(async () => {
            // Use ref to access latest device state without resetting the interval
            const currentDevice = bleDeviceRef.current
            if (currentDevice && currentDevice.connected && !isNavigatingAway.current) {
                log('[PrepareTest] Heartbeat ping...')
                try {
                    await getHeartbeat(currentDevice)
                } catch (e) {
                    logWarn('[PrepareTest] Heartbeat failed:', e)
                }
            }
        }, 20000)

        return () => {
            log('[PrepareTest] Stopping heartbeat')
            clearInterval(interval)
        }
    }, [!!bleDevice?.connected, isInitializing, loading, getHeartbeat])



    // BLE Initialization on mount: wake, stabilization, utc, quiesce, latch, clear id/gps
    useEffect(() => {
        const runBleInitialization = async () => {
            if (!bleDevice || !bleDevice.connected || hasInitialized.current) return

            hasInitialized.current = true
            setIsInitializing(true)
            setInitProgress(0.05)
            log('[PrepareTest] Running BLE initialization sequence...')

            const errors: { setUtc?: string; deviceHealth?: string[]; cameraDisable?: string } = {}

            // Step 1-2: Standard BLE initialization (wake -> stabilize -> setutc)
            const initResult = await runBleStandardInit(bleDevice, {
                onProgress: (step, progress) => {
                    setInitStep(step)
                    setInitProgress(progress * 0.5) // Use first 50% for standard init
                },
                onError: (initErrors) => {
                    if (initErrors.setUtc) errors.setUtc = initErrors.setUtc
                    if (initErrors.deviceHealth) errors.deviceHealth = initErrors.deviceHealth
                }
            })

            if (!initResult.success) {
                logError('[PrepareTest] Standard initialization failed')
            }

            // Step 3. Disable Camera (AI setop 10 0)
            try {
                setInitStep('Disabling camera...')
                setInitProgress(0.6)
                log('[PrepareTest] Stopping camera for preparation flow...')
                await quiesceDevice('[PrepareTest]', false)
                // Confirmation handled by Command Manager regex
            } catch (err) {
                logError('[PrepareTest] Failed to disable camera:', err)
                errors.cameraDisable = 'Failed to disable camera (Op 10=0)'
            }

            // Step 4. Reset GPS location to default
            try {
                setInitStep('Resetting location...')
                setInitProgress(0.8)
                log('[PrepareTest] Resetting GPS location to default...')
                await clearGpsLocation(bleDevice)
                // Confirmation handled by Command Manager regex
            } catch (err) {
                logError('[PrepareTest] Failed to reset GPS:', err)
            }

            // Step 5. Clear Deployment ID (Op 20-27)
            try {
                setInitStep('Clearing old IDs...')
                setInitProgress(0.85)
                log('[PrepareTest] Clearing any existing deployment IDs...')
                await setDeploymentIdAsOps(bleDevice, null)
            } catch (err) {
                logError('[PrepareTest] Failed to clear deployment ID:', err)
            }

            // Step 6. Automated Hardware Checks
            try {
                // 6a. Battery Check
                setInitStep('Checking battery...')
                setInitProgress(0.9)
                log('[PrepareTest] Auto-triggering battery check...')
                await handleBatteryCheck()

                // 6b. SD Card Check
                setInitStep('Checking SD card...')
                setInitProgress(0.94)
                log('[PrepareTest] Auto-triggering SD card check...')
                await handleSdCardCheck()

                // 6c. Firmware Check
                setInitStep('Verifying firmware...')
                setInitProgress(0.98)
                log('[PrepareTest] Auto-triggering firmware check...')
                await handleFirmwareCheck()
            } catch (err) {
                logError('[PrepareTest] One or more automated checks failed:', err)
            }

            setInitErrors(errors)
            
            // If critical steps failed, alert the user
            if (errors.setUtc || errors.cameraDisable) {
                Alert.alert(
                    'Initialization Warning',
                    `Some setup steps failed:\n${errors.setUtc ? `• ${errors.setUtc}\n` : ''}${errors.cameraDisable ? `• ${errors.cameraDisable}` : ''}\n\nYou may need to retry initialization.`,
                    [{ text: 'OK' }]
                )
            }

            setInitProgress(1)
            setInitStep('Ready')
            setIsInitializing(false)
            log('[PrepareTest] BLE initialization complete')
        }

        runBleInitialization()
    }, [bleDevice, setUtc, waitForLogMatch, setDeploymentIdAsOps, clearGpsLocation, handleBatteryCheck, handleSdCardCheck])

    // Parse BLE logs for command responses



    // Parse BLE logs for command responses
    useEffect(() => {
        if (!logs || logs.length === 0) return

        // Construct string from recent logs (last 50 entries) to ensure we catch split packets
        // but avoid scanning massive history.
        const recentLogsString = logs.slice(-50).map(e => e.content).join('')

        // Parse battery response: "Battery = 5482mV 73%"
        const batteryMatch = recentLogsString.match(/Battery\s*=\s*\d+mV\s+(\d+)%/)
        if (batteryMatch && batteryLevel === null) {
            const percent = parseInt(batteryMatch[1], 10)
            log('[PrepareTest] Parsed battery level:', percent + '%')
            setBatteryLevel(percent)
            if (preparation) {
                DevicePreparationService.updatePreparation(preparation.id, {
                    batteryCheckPassed: percent > 30,
                    batteryLevelAtCheck: percent
                })
            }
        }

        // Parse SD card response: "30515200 K total drive space." and "30512400 K available."
        // Also handling: "K total", "k total", possible extra spaces
        const totalMatch = recentLogsString.match(/(\d+)\s*[Kk]\s*total\s*drive\s*space/i)
        const availMatch = recentLogsString.match(/(\d+)\s*[Kk]\s*available/i)

        if (recentLogsString.length > 0 && !sdCardStatus && (recentLogsString.toLowerCase().includes('total') || recentLogsString.toLowerCase().includes('available'))) {
            // log('[PrepareTest] SD keywords found?')
        }

        if (totalMatch && availMatch && sdCardStatus === null) {
            const totalKB = parseInt(totalMatch[1], 10)
            const availableKB = parseInt(availMatch[1], 10)
            log('[PrepareTest] Parsed SD card:', { totalKB, availableKB })
            setSdCardStatus({ total: totalKB, free: availableKB })
            if (preparation) {
                DevicePreparationService.updatePreparation(preparation.id, {
                    sdCardCheckPassed: availableKB > (totalKB * 0.1),
                    sdCardTotalKbAtCheck: totalKB,
                    sdCardAvailableKbAtCheck: availableKB
                })
            }
        }

        // Parse firmware version response: "BLE: v0.10.0", "WW500-A00 V 00.11.01", "Version: 0.10.0"
        // Matches: "V 00.11.01", "Ver: 1.0", "BLE: v1.0"
        const versionMatch = recentLogsString.match(/(?:V|Ver|Version|BLE)[:\s]+v?(\d+\.\d+\.\d+)/i)
        if (versionMatch && deviceFirmwareVersion === null && isCheckingFirmware) {
            const version = versionMatch[1]
            log('[PrepareTest] Parsed device firmware version:', version)
            setDeviceFirmwareVersion(version)
            setIsCheckingFirmware(false)

            // Compare with latest firmware
            if (latestBleFirmware) {
                // Use semantic comparison instead of strict string equality
                // Returns 0 if equal, -1 if v1 < v2, 1 if v1 > v2
                const comparison = compareVersions(version, latestBleFirmware.version)
                const updateAvailable = comparison < 0 // Only update if device version is LOWER

                setBleFirmwareUpdateAvailable(updateAvailable)
                // setFirmwareUpToDate(!updateAvailable) - Removed undefined function
                log('[PrepareTest] Firmware comparison:', {
                    deviceVersion: version,
                    latestVersion: latestBleFirmware.version,
                    comparisonResult: comparison,
                    updateAvailable
                })

                if (!updateAvailable && preparation) {
                    // If up to date, link the specific firmware version
                    DevicePreparationService.updatePreparation(preparation.id, {
                        firmwareCheckPassed: true,
                        firmwareId: latestBleFirmware.id
                    })

                    // If we just finished an update, show final success notification
                    if (isVerifyingUpdate) {
                        setIsVerifyingUpdate(false)
                        Alert.alert(
                            'Update Successful',
                            `Your device has been updated to version ${version}.`,
                            [{ text: 'OK' }]
                        )
                    }
                } else if (isVerifyingUpdate && updateAvailable) {
                    // Still reporting old version or update failed
                    logWarn('[PrepareTest] Update reported old version after reboot')
                    // We keep isVerifyingUpdate true for a bit longer or let user retry
                }
            }
        }

        // Parse device name response: "Device: WW500-A00"
        // Matches: "Device: WW500", "Device: WW500-A00"
        const deviceNameMatch = recentLogsString.match(/Device:\s*([A-Za-z0-9-]+)/i)
        if (deviceNameMatch && cameraModelName === null) {
            const name = deviceNameMatch[1]
            log('[PrepareTest] Parsed device model name:', name)
            setCameraModelName(name)
        }
    }, [logs, batteryLevel, sdCardStatus, preparation, deviceFirmwareVersion, isCheckingFirmware, latestBleFirmware, cameraModelName, handleFirmwareCheck])

    // Store initialization errors from route params
    useEffect(() => {
        if (selftestError || setUtcError) {
            setInitErrors({
                selftest: selftestError,
                setUtc: setUtcError
            })
        }
    }, [selftestError, setUtcError])

    // Check BLE connection status when screen regains focus
    useFocusEffect(
        useCallback(() => {
            // Only check if we've already started preparation (not loading)
            // Skip check if DFU is in progress (device disconnects during DFU)
            // Skip check if navigating away (user completed preparation)
            // Skip check if initializing (BLE commands in progress)
            const isConnected = bleDevice?.connected
            if (!loading && bleDevice && !isDfuInProgress.current && !isNavigatingAway.current && !isInitializing) {
                if (!isConnected) {
                    log('[PrepareTest] Connection lost detected on focus')
                    Alert.alert(
                        'Connection Lost',
                        'The device connection was lost. Please reconnect to continue preparation.',
                        [
                            {
                                text: 'Reconnect',
                                onPress: () => {
                                    // Navigate back to device connection
                                    navigation.goBack()
                                }
                            }
                        ],
                        { cancelable: false }
                    )
                }
            }
        }, [bleDevice, loading, navigation, isInitializing]) 
    )








    if (loading) {
        return (
            <WWScreenView>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" />
                    <WWText variant="bodyMedium" style={styles.loadingText}>
                        Preparing device...
                    </WWText>
                </View>
            </WWScreenView>
        )
    }

    if (!device) {
        return (
            <WWScreenView>
                <View style={styles.loadingContainer}>
                    <WWIcon source="alert-circle-outline" size={64} color={theme.colors.error} />
                    <WWText variant="headlineSmall" style={[styles.loadingText, { color: theme.colors.error }]}>
                        Device Not Found
                    </WWText>
                    <WWText variant="bodyMedium" style={{ textAlign: 'center', marginTop: 8, paddingHorizontal: 32 }}>
                        Could not find device details in the local database. Please try pairing again.
                    </WWText>
                    <WWButton 
                        mode="contained" 
                        onPress={() => navigation.goBack()} 
                        style={{ marginTop: 24 }}
                    >
                        Go Back
                    </WWButton>
                </View>
            </WWScreenView>
        )
    }

    return (
        <WWScreenView scrollable={true} style={{ paddingTop: 0 }}>
            <View style={styles.container}>
                <InitializationHeader
                    device={device}
                    isInitializing={isInitializing}
                    initProgress={initProgress}
                    initStep={initStep}
                    initErrors={initErrors}
                    theme={theme}
                />

                <ProjectSelectionSection
                    selectedProject={selectedProject}
                    handleProjectChange={handleProjectChange}
                    isInitializing={isInitializing}
                    projects={projects}
                    theme={theme}
                    onShowHelp={showHelp}
                />

                <DiagnosticsSection
                    batteryLevel={batteryLevel}
                    handleBatteryCheck={handleBatteryCheck}
                    sdCardStatus={sdCardStatus}
                    handleSdCardCheck={handleSdCardCheck}
                    capturedImageUri={capturedImageUri}
                    handleCameraTest={handleCameraTest}
                    isCapturingImage={isCapturingImage}
                    cameraTestPassed={cameraTestPassed}
                    isInitializing={isInitializing}
                    bleDeviceConnected={!!bleDevice?.connected}
                    theme={theme}
                    onShowHelp={showHelp}
                />

                <FirmwareSection
                    latestBleFirmware={latestBleFirmware}
                    deviceFirmwareVersion={deviceFirmwareVersion}
                    bleFirmwareUpdateAvailable={bleFirmwareUpdateAvailable}
                    firmwareUpdateProgress={firmwareUpdateProgress}
                    isUpdatingFirmware={isUpdatingFirmware}
                    isCheckingFirmware={isCheckingFirmware}
                    isVerifyingUpdate={isVerifyingUpdate}
                    handleFirmwareCheck={handleFirmwareCheck}
                    handleBleFirmwareUpdate={handleBleFirmwareUpdate}
                    isInitializing={isInitializing}
                    bleDeviceConnected={!!bleDevice?.connected}
                    batteryLevel={batteryLevel}
                    theme={theme}
                    onShowHelp={showHelp}
                />

                <HardwareBetaSection theme={theme} onShowHelp={showHelp} />

                <FinishProgressDialog
                    visible={isFinishing}
                    progress={finishProgress}
                    step={finishStep}
                    logs={finishLogs}
                    isComplete={finishProgress === 1.0}
                    onDismiss={handleFinishComplete}
                />

                {/* Finish Preparation Button */}
                <View style={[styles.footer, isFinishing && { opacity: 0.5 }]}>
                    <WWButton
                        mode="contained"
                        onPress={handleFinish}
                        style={styles.finishButton}
                        disabled={!selectedProject || isInitializing || isFinishing}
                        loading={isFinishing}
                    >
                        {isFinishing ? 'Finishing...' : 'Finish Preparation & Testing'}
                    </WWButton>
                    <WWButton mode="text" onPress={() => navigation.goBack()} disabled={isFinishing}>
                        Cancel
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
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
    },
    footer: {
        marginTop: 16,
        gap: 12,
        marginBottom: 32,
    },
    finishButton: {
        marginTop: 8,
    },
})
