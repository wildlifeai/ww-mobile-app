import { useState, useEffect, useCallback, useRef } from 'react'
import { Alert, PermissionsAndroid, Platform } from 'react-native'
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import BleManager, { Peripheral } from 'react-native-ble-manager'

import { AppParams } from '../../../navigation/types'
import { DeviceService } from '../../../services/DeviceService'
import { DevicePreparationService } from '../../../services/DevicePreparationService'
import ReferenceDataService from '../../../services/ReferenceDataService'
import { DfuService } from '../../../services/DfuService'
import FirmwareService from '../../../services/FirmwareService'
import { useBleCommands } from '../../../hooks/useBleCommands'
import { useBle } from '../../../hooks/useBle'
import { useBleInitialization } from '../../../hooks/useBleInitialization'
import { useCapturePreview } from '../../../hooks/useCapturePreview'
import { useDeviceSettings } from '../../../hooks/useDeviceSettings'
import { useGetProjectsQuery } from '../../../redux/api/projectsApi'
import { useAppSelector } from '../../../redux'
import Device from '../../../database/models/Device'
import DevicePreparation from '../../../database/models/DevicePreparation'
import Firmware from '../../../database/models/Firmware'
import database from '../../../database'
import { extractErrorBits } from '../../../ble/messageClassifier'
import { CommandNames, COMMANDS } from '../../../ble/types'
import { log, logError, logWarn } from '../../../utils/logger'
import { convertBleToSemanticVersion, stripBuildNumber, compareSemanticVersions } from '../../../utils/versionUtils'

/**
 * Scans for the Nordic DFU booth loader which advertises as "DfuTarg"
 * after the device reboots into bootloader mode
 * @param timeoutMs How long to scan before giving up
 * @returns MAC address of the bootloader, or null if not found
 */
const scanForBootloader = (timeoutMs: number = 10000): Promise<string | null> => {
    return new Promise((resolve, reject) => {
        let timeoutHandle: NodeJS.Timeout

        const eventEmitter = BleManager.addListener(
            'BleManagerDiscoverPeripheral',
            (peripheral: Peripheral) => {
                log('[scanForBootloader] Discovered:', peripheral.name, peripheral.id)

                // Check if this is the bootloader (WW500_DFU or DfuTarg)
                if (peripheral.name === 'WW500_DFU' || peripheral.name === 'DfuTarg') {
                    log('[scanForBootloader] Found bootloader at:', peripheral.id)
                    // Stop scanning
                    BleManager.stopScan().catch(err => logWarn('Failed to stop scan:', err))
                    clearTimeout(timeoutHandle)
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
                clearTimeout(timeoutHandle)
                eventEmitter.remove()
                reject(err)
            })

        // Timeout if not found
        timeoutHandle = setTimeout(() => {
            log('[scanForBootloader] Scan timeout, bootloader not found')
            BleManager.stopScan().catch(err => logWarn('Failed to stop scan:', err))
            eventEmitter.remove()
            resolve(null)
        }, timeoutMs)

        // Store handle to clear later
        eventEmitter.remove = ((originalRemove) => () => {
             clearTimeout(timeoutHandle)
             originalRemove()
        })(eventEmitter.remove)
    })
}

/**
 * Scans for the original device after DFU reboot
 */
const scanForOriginalDevice = (deviceId: string, timeoutMs: number = 10000): Promise<string | null> => {
    return new Promise((resolve, reject) => {
        let timeoutHandle: NodeJS.Timeout

        const eventEmitter = BleManager.addListener(
            'BleManagerDiscoverPeripheral',
            (peripheral: Peripheral) => {
                if (peripheral.id === deviceId) {
                     log('[scanForOriginalDevice] Found original device:', peripheral.id)
                     BleManager.stopScan().catch(err => logWarn('Failed to stop scan:', err))
                     clearTimeout(timeoutHandle)
                     eventEmitter.remove()
                     resolve(peripheral.id)
                }
            }
        )

        BleManager.scan([], timeoutMs / 1000)
            .then(() => log('[scanForOriginalDevice] Scan started for:', deviceId))
            .catch(err => {
                logError('[scanForOriginalDevice] Scan failed:', err)
                clearTimeout(timeoutHandle)
                eventEmitter.remove()
                reject(err)
            })

        timeoutHandle = setTimeout(() => {
            log('[scanForOriginalDevice] Scan timeout')
            BleManager.stopScan().catch(err => logWarn('Failed to stop scan:', err))
            eventEmitter.remove()
            resolve(null)
        }, timeoutMs)
    })
}

export const usePrepareAndTest = () => {
    const route = useRoute<AppParams<'PrepareAndTest'>>()
    const navigation = useNavigation<NativeStackNavigationProp<any>>()
    const { deviceId: initialDeviceId, bleDeviceId, selftestError, setUtcError } = route.params
    const user = useAppSelector((state) => state.authentication.user)

    const [activeDeviceId, setActiveDeviceId] = useState<string | undefined>(initialDeviceId)
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

    const addFinishLog = useCallback((message: string) => {
        setFinishLogs(prev => [...prev, message])
    }, [])

    // BLE firmware state
    const [latestBleFirmware, setLatestBleFirmware] = useState<Firmware | null>(null)
    const [deviceFirmwareVersion, setDeviceFirmwareVersion] = useState<string | null>(null)
    const [bleFirmwareUpdateAvailable, setBleFirmwareUpdateAvailable] = useState(false)
    const [firmwareUpdateProgress, setFirmwareUpdateProgress] = useState<number>(0)
    const [isUpdatingFirmware, setIsUpdatingFirmware] = useState(false)
    const [isCheckingFirmware, setIsCheckingFirmware] = useState(false)
    const [isVerifyingUpdate, setIsVerifyingUpdate] = useState(false)
    const [firmwareUpdateStatus, setFirmwareUpdateStatus] = useState<string>('')
    
    // Ref to track DFU in progress (prevents Connection Lost alert during expected disconnection)
    const isDfuInProgress = useRef(false)
    // Ref to track reconnection phase after DFU
    const isReconnectingAfterDfu = useRef(false)
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
        getDeviceVer, 
        runDisconnect, 
        runDfu, 
        setDeploymentIdAsOps, 
        clearGpsLocation, 
        flashLed,
        runSelfTest,
        getAllOperationalParams
    } = useBleCommands()

    const { initialize: runBleStandardInit } = useBleInitialization()
    const { write, connectDevice } = useBle()
    const bleDevice = useAppSelector((state) => state.devices[bleDeviceId])
    // Use ref to track bleDevice for intervals without resetting them on every update
    const bleDeviceRef = useRef(bleDevice)
    useEffect(() => {
        bleDeviceRef.current = bleDevice
    }, [bleDevice])
    const logs = useAppSelector(state => state.logs[bleDeviceId || ''] || [])

    // Camera capture hook
    const { capturedImageUri, isCapturing: isCapturingImage, startCapture, captureProgress, captureStage } = useCapturePreview({
        device: bleDevice,
        write: write,
        onImageReceived: (imageUri) => {
            log('[PrepareTest] Image received:', imageUri)
            setCameraTestPassed(true)
            if (preparation) {
                DevicePreparationService.updatePreparation(preparation.id, {
                    cameraViewTestPassed: true,
                    cameraModel: cameraModelName || 'WW500' // Use fetched name or default
                }).catch((error: any) => logError('Failed to update preparation:', error))
            }
        }
    })

    // Device settings hook
    const { quiesceDevice } = useDeviceSettings({
        device: bleDevice,
        onError: (error) => {
            logError('[PrepareTest] Settings update failed:', error)
            Alert.alert('Settings Error', error.message)
        }
    })

    // Consolidated Initialization State
    const [initState, setInitState] = useState({
        errors: {} as { selftest?: string; setUtc?: string; deviceHealth?: string[]; cameraDisable?: string },
        isInitializing: false,
        progress: 0,
        step: ''
    })

    const updateInitState = useCallback((updates: Partial<typeof initState>) => {
        setInitState(prev => ({ ...prev, ...updates }))
    }, [])
    const hasInitialized = useRef(false)

    // Load user projects using RTK Query (consistent with Projects screen)
    const currentOrganisation = useAppSelector((state) => state.authentication.currentOrganisation)
    // Using ref to track latest logs for the robust initialization sequence
    const logsRef = useRef(logs)
    useEffect(() => {
        logsRef.current = logs
    }, [logs])

    // Track if preparation has been initiated to prevent duplicates
    const hasStartedPreparation = useRef(false)
    const activeDeviceIdRef = useRef<string | null>(null)

    // Reset started flag if activeDeviceId changes
    useEffect(() => {
        if (activeDeviceId && activeDeviceIdRef.current !== activeDeviceId) {
            hasStartedPreparation.current = false
            activeDeviceIdRef.current = activeDeviceId
        }
    }, [activeDeviceId])

    // Resolve activeDeviceId if only bleDeviceId is provided (Immediate Navigation Support)
    useEffect(() => {
        const resolveDevice = async () => {
            if (activeDeviceId || !bleDeviceId || !user?.id || !currentOrganisation?.id) return

            log(`[PrepareTest] Resolving DB ID for BLE Device: ${bleDeviceId}`)
            try {
                // 1. Check if device exists in DB
                let dbDevice = await DeviceService.getDeviceByBluetoothId(bleDeviceId)
                
                // 2. If not found, create it (same logic as Discovery screen)
                if (!dbDevice) {
                    log(`[PrepareTest] Device not found in DB, creating new record...`)
                    // We need the BLE name, try getting from Redux state or default
                    const bleName = bleDeviceRef.current?.name || 'Unknown Device'
                    
                    try {
                        dbDevice = await DeviceService.createDevice(
                            bleDeviceId,
                            bleName,
                            currentOrganisation.id,
                            user.id
                        )
                        log(`[PrepareTest] Created new device: ${dbDevice.id}`)
                    } catch (createError) {
                        logError('[PrepareTest] Failed to create device:', createError)
                        Alert.alert(
                            'Device Creation Failed',
                            'Could not create a database record for this device. Please try again.',
                            [{ text: 'OK', onPress: () => navigation.goBack() }]
                        )
                        return
                    }
                }

                if (dbDevice) {
                    log(`[PrepareTest] Resolved/Created Device ID: ${dbDevice.id}`)
                    setActiveDeviceId(dbDevice.id)
                }
            } catch (error) {
                logError('[PrepareTest] Error resolving device:', error)
                Alert.alert(
                    'Device Check Failed', 
                    'An error occurred while verifying the device record.',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                )
            }
        }

        resolveDevice()
    }, [activeDeviceId, bleDeviceId, user?.id, currentOrganisation?.id, navigation])

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
        
        // Wait for device ID to be resolved
        if (!activeDeviceId) {
            return
        }

        hasStartedPreparation.current = true
        log('[PrepareTest] Loading data for device:', activeDeviceId)

        try {
            const deviceData = await DeviceService.getDeviceById(activeDeviceId)
            if (!deviceData) {
                logError('[PrepareTest] Device not found in record for ID:', activeDeviceId)
                // Don't set hasStarted true here so we can retry if needed? 
                // Actually, if it's not in DB, it won't appear magically without a re-pair.
                setLoading(false)
                return
            }
            setDevice(deviceData)

            // Determine initial project ID
            let initialProjectId = ''
            
            // 1. Try to use last used project from previous preparation
            const lastPrep = await DevicePreparationService.getLastCompletedPreparation(activeDeviceId)
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
                activeDeviceId,
                initialProjectId,
                user.id
            )
            setPreparation(newPrep)

            // Populate ai_model_id from project if available
            const selectedProj = projects.find((p: any) => p.id === initialProjectId)
            if (selectedProj?.model_id && newPrep) {
                DevicePreparationService.updatePreparation(newPrep.id, {
                    aiModelId: selectedProj.model_id
                }).catch((err: any) => logError('[PrepareTest] Failed to set ai_model_id:', err))
            }

            log('[PrepareTest] Data loading complete.')
        } catch (error) {
            logError('[PrepareTest] Error loading device data:', error)
            Alert.alert('Loading Error', 'Failed to initialize the preparation session.')
            hasStartedPreparation.current = false // Allow retry on re-render
        } finally {
            setLoading(false)
        }
    }, [activeDeviceId, projects, user?.id, isLoadingProjects])

    const handleProjectChange = useCallback(async (projectId: string) => {
        if (projectId === 'create_new') {
            // Navigate to NewProjectScreen
            navigation.navigate('NewProjectScreen')
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
            // Update ai_model_id from the newly selected project
            const proj = projects.find((p: any) => p.id === projectId)
            if (proj?.model_id) {
                DevicePreparationService.updatePreparation(preparation.id, {
                    aiModelId: proj.model_id
                }).catch((err: any) => logError('[PrepareTest] Failed to update ai_model_id:', err))
            }
        }
    }, [navigation, preparation, projects])

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
    }, [selectedProject, sdCardStatus, bleDevice, preparation, route.params, runDisconnect, setDeploymentIdAsOps, flashLed, addFinishLog])

    const handleFinishComplete = useCallback(() => {
        setIsFinishing(false)
        const { nextRoute } = route.params || {}
        if (nextRoute && preparation) {
            (navigation as any).navigate(nextRoute, {
                devicePreparationId: preparation.id,
                deviceId: activeDeviceId,
                bleDeviceId: bleDeviceId
            })
        } else {
            // Redirect to Devices tab instead of just going back
            navigation.navigate('Home', { initialTab: 'devices' })
        }
    }, [navigation, route.params, preparation, activeDeviceId, bleDeviceId])

    const handleBatteryCheck = useCallback(async () => {
        if (!bleDevice || !bleDevice.connected) {
            logWarn('[PrepareTest] No connected BLE device available for battery check')
            return
        }
        try {
            const response = await getBatteryLevel(bleDevice)
            const match = response.match(COMMANDS[CommandNames.battery].readRegex!)
            if (match) {
                const level = parseInt(match[1], 10)
                setBatteryLevel(level)
                log('[PrepareTest] Battery level parsed:', level, '%')
                if (preparation) {
                    DevicePreparationService.updatePreparation(preparation.id, {
                        batteryCheckPassed: level > 30,
                        batteryLevelAtCheck: level
                    })
                }
            } else {
                logWarn('[PrepareTest] Failed to parse battery level from response:', response)
            }
        } catch (error) {
            logError('Battery check failed:', error)
            Alert.alert('Error', 'Failed to check battery level')
        }
    }, [bleDevice, getBatteryLevel, preparation])

    const handleSdCardCheck = useCallback(async () => {
        if (!bleDevice || !bleDevice.connected) {
            logWarn('[PrepareTest] No connected BLE device available for SD card check')
            return
        }
        try {
            // 1. Check SD card space directly (AI info) - PRIMARY SOURCE OF TRUTH
            const sdStatus = await checkSdCard(bleDevice)

            if (sdStatus && sdStatus.total > 0) {
                 log('[PrepareTest] SD Card confirmed via AI Info')
                 setSdCardStatus(sdStatus)
                 if (preparation) {
                     DevicePreparationService.updatePreparation(preparation.id, {
                         sdCardCheckPassed: sdStatus.free > (sdStatus.total * 0.1),
                         sdCardTotalKbAtCheck: sdStatus.total,
                         sdCardAvailableKbAtCheck: sdStatus.free
                     })
                 }
                 return
            }

            // 2. If AI Info failed or returned 0, check Self Test as confirmation
            const statusMsg = await runSelfTest(bleDevice)
            const hexBits = extractErrorBits(statusMsg)
            
            if (hexBits) {
                const errorBits = parseInt(hexBits, 16)
                // Bit 11 (0x0800): Device has no SD card detected
                const NO_SD_CARD_MASK = 0x0800
                // eslint-disable-next-line no-bitwise
                if ((errorBits & NO_SD_CARD_MASK) !== 0) {
                    logWarn('[PrepareTest] SD Card Missing (Confirmed by Error Bit 11)')
                    Alert.alert(
                        'No SD Card Detected',
                        'The device reports that no SD card is inserted. Please insert a valid SD card and try again.',
                        [{ text: 'OK' }]
                    )
                    setSdCardStatus(null)
                    return
                }
            }

            // 3. Ambiguous case: AI Info failed/empty but Bit 11 NOT set
            if (!sdStatus) {
                logWarn('[PrepareTest] SD Check ambiguous: AI Info failed but Bit 11 is 0')
                Alert.alert(
                    'SD Card Check Failed', 
                    'Could not verify SD card storage. Please check if the card is formatted correctly.',
                    [{ text: 'OK' }]
                )
                setSdCardStatus(null)
            }

        } catch (error) {
            logError('SD card check failed:', error)
            Alert.alert('Error', 'Failed to check SD card status')
        }
    }, [bleDevice, checkSdCard, runSelfTest, preparation])

    const handleFirmwareCheck = useCallback(async () => {
        if (!bleDevice || !bleDevice.connected) {
            logWarn('[PrepareTest] No connected BLE device available for firmware check')
            return
        }
        try {
            setIsCheckingFirmware(true)
            setDeviceFirmwareVersion(null) // Reset to allow re-parsing
            const response = await getDeviceVer(bleDevice)
            
            // Expected format: "WW500-A00 V 00.20.07 22:30:18 Jan 28 2026"
            const match = response.match(COMMANDS[CommandNames.ver].readRegex!)
            if (match) {
                const version = match[1]
                setDeviceFirmwareVersion(version)
                log('[PrepareTest] Firmware version parsed:', version)
            } else {
                logWarn('[PrepareTest] Failed to parse firmware version from response:', response)
            }
            
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
                            setFirmwareUpdateStatus('Preparing update...')
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
                                setFirmwareUpdateStatus('Switching to DFU mode...')
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
                            setFirmwareUpdateStatus('Searching for bootloader...')
                            const bootloaderAddress = await scanForBootloader(10000)
                            if (!bootloaderAddress) {
                                throw new Error('Bootloader not found. Ensure device is in DFU mode (flashing red).')
                            }
                            log('[PrepareTest] Found bootloader at:', bootloaderAddress)

                            // Start DFU process
                            setFirmwareUpdateStatus('Updating firmware...')
                            await DfuService.startDFU(
                                bootloaderAddress,
                                localUri,
                                (progress) => {
                                    setFirmwareUpdateProgress(progress)
                                    if (progress > 95) setFirmwareUpdateStatus('Finalizing update...')
                                }
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
                            setFirmwareUpdateStatus('Rebooting device...')
                            
                            // Reset state for verification
                            setDeviceFirmwareVersion(null)
                            setIsCheckingFirmware(true)
                            setIsVerifyingUpdate(true)
                            setBleFirmwareUpdateAvailable(false) // Optimistically hide until verified

                            // Wait for reboot (approx 5-8s) - Reduced to 6s per user request for faster UX
                            log('[PrepareTest] Waiting for device reboot...')
                            isReconnectingAfterDfu.current = true
                            isDfuInProgress.current = false // Hand off suppression to isReconnectingAfterDfu
                            
                            await new Promise(r => setTimeout(r, 6000))

                            // Reconnect and check
                            log('[PrepareTest] Attempting to reconnect for verification...')
                            setFirmwareUpdateStatus('Reconnecting...')
                            
                            try {
                                // Scan for original device ID
                                const foundId = await scanForOriginalDevice(bleDeviceId!, 20000)
                                
                                if (foundId && bleDevice) {
                                    log('[PrepareTest] Found device, connecting...')
                                    setFirmwareUpdateStatus('Connecting...')
                                    
                                    // Use standard connect flow (discovery + notifications)
                                    // Increased timeout to 20s to handle busy device
                                    await connectDevice(bleDevice, 20000)
                                    log('[PrepareTest] Reconnected successfully')
                                    
                                    // Give a moment for services to stabilize
                                    await new Promise(r => setTimeout(r, 2000))

                                    // Trigger the firmware check automatically
                                    setFirmwareUpdateStatus('Verifying version...')
                                    handleFirmwareCheck()
                                } else {
                                    throw new Error('Device not found after DFU reboot')
                                }
                            } catch (reconnectErr) {
                                logWarn('[PrepareTest] Reconnect failed:', reconnectErr)
                                setIsVerifyingUpdate(false)
                                setDeviceFirmwareVersion(null)
                                Alert.alert(
                                    'Reconnect Failed', 
                                    'Failed to automatically reconnect to the device. Please select the device again from the list to verify the update.',
                                    [{ 
                                        text: 'OK',
                                        onPress: () => (navigation as any).navigate('Home', { initialTab: 'devices' })
                                    }],
                                    { cancelable: false }
                                )
                            }

                        } catch (error) {
                            logError('[PrepareTest] Firmware update failed:', error)
                            Alert.alert('Update Failed', error instanceof Error ? error.message : 'Unknown error')
                            // setFirmwareUpToDate(false) - Removed undefined function
                        } finally {
                            isReconnectingAfterDfu.current = false
                             // Only hide progress if we're not verifying
                             setIsUpdatingFirmware(false)
                             isDfuInProgress.current = false
                             setFirmwareUpdateStatus('')
                        }
                    }
                }
            ]
        )
    }, [latestBleFirmware, device, bleDevice, bleDeviceId, batteryLevel, preparation, handleFirmwareCheck, runDisconnect, runDfu, connectDevice, navigation])


    useEffect(() => {
        loadDeviceAndPreparation()
    }, [loadDeviceAndPreparation])

    // Check BLE firmware version on mount
    useEffect(() => {
        const checkBleFirmware = async () => {
            try {
                const latest = await ReferenceDataService.getLatestFirmware('ble')
                setLatestBleFirmware(latest)

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
            // Use ref to check if navigating away AND to access device state without triggering re-run
            const currentDevice = bleDeviceRef.current
            if (currentDevice && currentDevice.connected && !isNavigatingAway.current) {
                log('[PrepareTest] Unmounting and NOT navigating away - Disconnecting device...')
                runDisconnect(currentDevice).catch(err => logError('[PrepareTest] Failed to disconnect on unmount:', err))
            } else {
                log('[PrepareTest] Unmounting but navigation is active (or device disconnected) - Skipping disconnect')
            }
        }
    }, [runDisconnect]) // Removed bleDevice to prevent disconnect on every state update


    // BLE Initialization on mount: wake, stabilization, utc, quiesce, latch, clear id/gps
    useEffect(() => {
        const runBleInitialization = async () => {
            if (!bleDevice || !bleDevice.connected || hasInitialized.current) return

            hasInitialized.current = true
            updateInitState({ isInitializing: true, progress: 0.05 })
            log('[PrepareTest] Running BLE initialization sequence...')

            const errors: { setUtc?: string; deviceHealth?: string[]; cameraDisable?: string } = {}

            // Step 1-2: Standard BLE initialization (wake -> stabilize -> setutc)
            const initResult = await runBleStandardInit(bleDevice, {
                onProgress: (step, progress) => {
                    updateInitState({ step, progress: progress * 0.5 }) // Use first 50% for standard init
                },
                onError: (errorsResult) => {
                    if (errorsResult.setUtc) errors.setUtc = errorsResult.setUtc
                    if (errorsResult.deviceHealth) errors.deviceHealth = errorsResult.deviceHealth
                }
            })

            if (!initResult.success) {
                logError('[PrepareTest] Standard initialization failed')
            }

            // Pre-fetch all operational params once for the entire init sequence
            let cachedOps: string[] | null = null
            try {
                if (bleDevice.connected) {
                    cachedOps = await getAllOperationalParams(bleDevice)
                    log('[PrepareTest] Pre-fetched bulk ops for init sequence')
                }
            } catch (err) {
                logWarn('[PrepareTest] Bulk ops fetch failed, proceeding without cache', err)
            }

            // Step 3. Disable Camera (AI setop 10 0)
            try {
                updateInitState({ step: 'Disabling camera...', progress: 0.6 })
                log('[PrepareTest] Stopping camera for preparation flow...')
                await quiesceDevice('[PrepareTest]', false, cachedOps)
                // Confirmation handled by Command Manager regex
            } catch (err) {
                logError('[PrepareTest] Failed to disable camera:', err)
                errors.cameraDisable = 'Failed to disable camera (Op 10=0)'
            }

            // Step 4. Reset GPS location to default
            try {
                updateInitState({ step: 'Resetting location...', progress: 0.8 })
                log('[PrepareTest] Resetting GPS location to default...')
                await clearGpsLocation(bleDevice)
                // Confirmation handled by Command Manager regex
            } catch (err) {
                logError('[PrepareTest] Failed to reset GPS:', err)
            }

            // Step 5. Clear Deployment ID (Op 20-27)
            try {
                updateInitState({ step: 'Clearing old IDs...', progress: 0.85 })
                log('[PrepareTest] Clearing any existing deployment IDs...')
                await setDeploymentIdAsOps(bleDevice, null, cachedOps)
            } catch (err) {
                logError('[PrepareTest] Failed to clear deployment ID:', err)
            }

            // Step 6. Automated Hardware Checks
            try {
                // 6a. Battery Check
                updateInitState({ step: 'Checking battery...', progress: 0.9 })
                log('[PrepareTest] Auto-triggering battery check...')
                await handleBatteryCheck()

                // 6b. SD Card Check
                updateInitState({ step: 'Checking SD card...', progress: 0.94 })
                log('[PrepareTest] Auto-triggering SD card check...')
                await handleSdCardCheck()

                // 6c. Firmware Check
                updateInitState({ step: 'Verifying firmware...', progress: 0.98 })
                log('[PrepareTest] Auto-triggering firmware check...')
                await handleFirmwareCheck()
            } catch (err) {
                logError('[PrepareTest] One or more automated checks failed:', err)
            }

            updateInitState({
                errors,
                progress: 1,
                step: 'Ready',
                isInitializing: false
            })
            log('[PrepareTest] BLE initialization complete')
        }

        runBleInitialization()
    }, [bleDevice, setDeploymentIdAsOps, clearGpsLocation, handleBatteryCheck, handleSdCardCheck, handleFirmwareCheck, runBleStandardInit, quiesceDevice, updateInitState, getAllOperationalParams])

    // Parse BLE logs for firmware version (post-DFU verification) and device name
    useEffect(() => {
        if (!logs || logs.length === 0) return

        // Construct string from recent logs (last 50 entries) to ensure we catch split packets
        const recentLogsString = logs.slice(-50).map(e => e.content).join('')

        // Parse firmware version response.
        // Accepts standard "V 0.21.43", "BLE: v1.0", and loose matches like "Ver: ..0.4" to debug bad versions.
        const versionMatch = recentLogsString.match(/(?:^|[\s:])(?:V|Ver|Version|BLE)[:\s]+v?([.\d]+)/i)
        
        if (versionMatch && deviceFirmwareVersion === null && isCheckingFirmware) {
             let version = versionMatch[1]
             // Clean up ".." or similar artifacts if present
             version = version.replace(/\.\./g, '.0.').replace(/^\./, '0.')
             
            log('[PrepareTest] Parsed device firmware version:', version)
            setDeviceFirmwareVersion(version)
            setIsCheckingFirmware(false)
            
            // Compare with latest firmware checks...

            if (latestBleFirmware) {
                // Normalize versions for comparison:
                // - Device reports MM.mm.bb (e.g., "00.21.23") - convert to semantic
                // - Database stores M.m.p-build (e.g., "0.21.4-23") - strip to semantic base
                
                const normalizedDeviceVersion = convertBleToSemanticVersion(version)
                const normalizedLatestVersion = stripBuildNumber(latestBleFirmware.version)
                
                // Use semantic comparison instead of strict string equality
                // Returns 0 if equal, -1 if v1 < v2, 1 if v1 > v2
                const comparison = compareSemanticVersions(normalizedDeviceVersion, normalizedLatestVersion)
                const updateAvailable = comparison < 0 // Only update if device version is LOWER

                setBleFirmwareUpdateAvailable(updateAvailable)
                // setFirmwareUpToDate(!updateAvailable) - Removed undefined function
                log('[PrepareTest] Firmware comparison:', {
                    deviceVersionRaw: version,
                    deviceVersionNormalized: normalizedDeviceVersion,
                    latestVersionRaw: latestBleFirmware.version,
                    latestVersionNormalized: normalizedLatestVersion,
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
            // Persist camera_model to the preparation record immediately
            if (preparation) {
                DevicePreparationService.updatePreparation(preparation.id, {
                    cameraModel: name
                }).catch((err: any) => logError('[PrepareTest] Failed to save camera model:', err))
            }
        }
    }, [logs, deviceFirmwareVersion, isCheckingFirmware, latestBleFirmware, cameraModelName, preparation, isVerifyingUpdate])

    // Store initialization errors from route params
    useEffect(() => {
        if (selftestError || setUtcError) {
            updateInitState({
                errors: {
                    selftest: selftestError,
                    setUtc: setUtcError
                }
            })
        }
    }, [selftestError, setUtcError, updateInitState])

    // Check BLE connection status when screen regains focus
    useFocusEffect(
        useCallback(() => {
            // Only check if we've already started preparation (not loading)
            // Skip check if DFU is in progress (device disconnects during DFU)
            // Skip check if navigating away (user completed preparation)
            // Skip check if initializing (BLE commands in progress)
            // Skip check if reconnecting after DFU (device is rebooting)
            const isConnected = bleDevice?.connected
            if (!loading && bleDevice && !isDfuInProgress.current && !isNavigatingAway.current && !initState.isInitializing && !isReconnectingAfterDfu.current) {
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
        }, [bleDevice, loading, navigation, initState.isInitializing])
    )

    return {
        device,
        preparation,
        selectedProject,
        loading,
        batteryLevel,
        sdCardStatus,
        cameraTestPassed,
        cameraModelName,
        isFinishing,
        finishProgress,
        finishStep,
        finishLogs,
        latestBleFirmware,
        deviceFirmwareVersion,
        bleFirmwareUpdateAvailable,
        firmwareUpdateProgress,
        isUpdatingFirmware,
        isCheckingFirmware,
        isVerifyingUpdate,
        firmwareUpdateStatus,
        helpVisible,
        helpTitle,
        helpContent,
        showHelp,
        handleDismissHelp,
        initState,
        handleProjectChange,
        handleFinish,
        handleFinishComplete,
        handleBatteryCheck,
        handleSdCardCheck,
        handleFirmwareCheck,
        handleCameraTest,
        handleBleFirmwareUpdate,
        projects,
        bleDevice,
        capturedImageUri,
        isCapturingImage,
        captureProgress,
        captureStage,
        navigation
    }
}
