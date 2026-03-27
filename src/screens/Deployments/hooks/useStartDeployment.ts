import { useState, useEffect, useCallback, useRef } from 'react'
import { Alert } from 'react-native'
import { useAppSelector } from '../../../redux'
import { useFocusEffect } from '@react-navigation/native'
import { DevicePreparationService } from '../../../services/DevicePreparationService'
import { DeploymentService } from '../../../services/DeploymentService'
import ProjectService from '../../../services/ProjectService'
import ReferenceDataService from '../../../services/ReferenceDataService'
import Device from '../../../database/models/Device'
import { DeviceService } from '../../../services/DeviceService'
import { useBleCommands } from '../../../hooks/useBleCommands'
import { useBleInitialization } from '../../../hooks/useBleInitialization'
import { useBleActions } from '../../../providers/BleEngineProvider'
import { useDeploymentConfiguration } from '../../../hooks/useDeploymentConfiguration'
import { useBle } from '../../../hooks/useBle'
import BleManager, { Peripheral } from 'react-native-ble-manager'
import { PermissionsAndroid, Platform } from 'react-native'
import { DfuService } from '../../../services/DfuService'
import FirmwareService from '../../../services/FirmwareService'
import Firmware from '../../../database/models/Firmware'
import { extractErrorBits } from '../../../ble/messageClassifier'
import { COMMANDS, CommandNames } from '../../../ble/types'
import { log, logError, logWarn } from '../../../utils/logger'

const INITIALIZATION_GUARD_TIMEOUT = 2000

/**
 * Scans for the Nordic DFU booth loader which advertises as "DfuTarg"
 */
const scanForBootloader = (timeoutMs: number = 10000): Promise<string | null> => {
    return new Promise((resolve, reject) => {
        let timeoutHandle: NodeJS.Timeout

        const eventEmitter = BleManager.addListener('BleManagerDiscoverPeripheral', (peripheral: Peripheral) => {
            log('[scanForBootloader] Discovered:', peripheral.name, peripheral.id)
            if (peripheral.name === 'WW500_DFU' || peripheral.name === 'DfuTarg') {
                log('[scanForBootloader] Found bootloader at:', peripheral.id)
                BleManager.stopScan().catch(err => logWarn('Failed to stop scan:', err))
                clearTimeout(timeoutHandle)
                eventEmitter.remove()
                resolve(peripheral.id)
            }
        })

        BleManager.scan([], timeoutMs / 1000)
            .then(() => log('[scanForBootloader] Scan started for DfuTarg'))
            .catch(err => {
                logError('[scanForBootloader] Scan failed:', err)
                clearTimeout(timeoutHandle)
                eventEmitter.remove()
                reject(err)
            })

        timeoutHandle = setTimeout(() => {
            log('[scanForBootloader] Scan timeout, bootloader not found')
            BleManager.stopScan().catch(err => logWarn('Failed to stop scan:', err))
            eventEmitter.remove()
            resolve(null)
        }, timeoutMs)

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

        const eventEmitter = BleManager.addListener('BleManagerDiscoverPeripheral', (peripheral: Peripheral) => {
            if (peripheral.id === deviceId) {
                 log('[scanForOriginalDevice] Found original device:', peripheral.id)
                 BleManager.stopScan().catch(err => logWarn('Failed to stop scan:', err))
                 clearTimeout(timeoutHandle)
                 eventEmitter.remove()
                 resolve(peripheral.id)
            }
        })

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

interface UseStartDeploymentParams {
    deviceId?: string
    bleDeviceId?: string
    devicePreparationId?: string
    navigation: any
}

export const useStartDeployment = ({
    deviceId,
    bleDeviceId,
    devicePreparationId,
    navigation
}: UseStartDeploymentParams) => {
    // Selectors
    const devices = useAppSelector(state => state.devices)
    const bleDevice = devices[bleDeviceId || '']
    const user = useAppSelector(state => state.authentication.user)

    // BLE Hooks
    const { connectDevice } = useBle()
    const { setUtc, runDisconnect, flashLed, getBatteryLevel, checkSdCard, getDeviceVer, runSelfTest, runDfu } = useBleCommands()
    const { initialize: runBleStandardInit } = useBleInitialization()
    const { configure: startConfigure } = useDeploymentConfiguration()
    useBleActions()

    // Advanced Settings State
    const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
    const [sdCardStatus, setSdCardStatus] = useState<{ total: number; free: number } | null>(null)
    const [latestBleFirmware, setLatestBleFirmware] = useState<Firmware | null>(null)
    const [deviceFirmwareVersion, setDeviceFirmwareVersion] = useState<string | null>(null)
    const [bleFirmwareUpdateAvailable, setBleFirmwareUpdateAvailable] = useState(false)
    const [firmwareUpdateProgress, setFirmwareUpdateProgress] = useState<number>(0)
    const [isUpdatingFirmware, setIsUpdatingFirmware] = useState(false)
    const [isCheckingFirmware, setIsCheckingFirmware] = useState(false)
    const [isVerifyingUpdate, setIsVerifyingUpdate] = useState(false)
    const [firmwareUpdateStatus, setFirmwareUpdateStatus] = useState<string>('')
    
    // Refs for DFU
    const isDfuInProgress = useRef(false)
    const isReconnectingAfterDfu = useRef(false)

    const [formState, setFormState] = useState({
        name: '',
        notes: '',
        cameraHeight: '',
        testImagePath: undefined as string | undefined
    })

    const [submitting, setSubmitting] = useState(false)
    const [project, setProject] = useState<any>(null)
    const [captureMethodName, setCaptureMethodName] = useState<string>('')
    const [sensitivityLabel, setSensitivityLabel] = useState<string>('')
    
    // UI State for Initialization Header
    const [device, setDevice] = useState<Device | undefined>()
    const [isInitializing, setIsInitializing] = useState(true)
    const [initProgress, setInitProgress] = useState(0)
    const [initStep, setInitStep] = useState('')
    const [initErrors, setInitErrors] = useState<{ selftest?: string; setUtc?: string; deviceHealth?: string[] }>({})

    // UI State for Deployment Progress Dialog
    const [finishProgress, setFinishProgress] = useState(0)
    const [finishStep, setFinishStep] = useState('')
    const [finishLogs, setFinishLogs] = useState<string[]>([])
    const [isFinishing, setIsFinishing] = useState(false)
    const [isStartSuccess, setIsStartSuccess] = useState(false)

    const addFinishLog = useCallback((message: string) => {
        setFinishLogs(prev => [...prev, message])
    }, [])

    // Connection Guard Refs
    const isNavigatingAway = useRef(false)
    const isStartDeploymentInProgress = useRef(false)

    // Standard BLE initialization plus initialization guard
    const hasRunInitialization = useRef(false)
    const bleDeviceRef = useRef(bleDevice)

    
    // Memoized handlers to prevent infinite loops in child components
    const handleImageCaptured = useCallback((path: string) => {
        setFormState(prev => ({ ...prev, testImagePath: path }))
    }, [])

    const handleNameChange = useCallback((name: string) => {
        setFormState(prev => ({ ...prev, name }))
    }, [])

    const handleNotesChange = useCallback((notes: string) => {
        setFormState(prev => ({ ...prev, notes }))
    }, [])

    const handleCameraHeightChange = useCallback((text: string) => {
        setFormState(prev => ({ ...prev, cameraHeight: text }))
    }, [])

    useEffect(() => {
        bleDeviceRef.current = bleDevice
    }, [bleDevice])

    useEffect(() => {
        const initializeDevice = async () => {
            if (!bleDevice?.connected || hasRunInitialization.current) return
            hasRunInitialization.current = true
            setIsInitializing(true)
            
            setInitStep('Initializing...')
            setInitProgress(0.2)
            log('[Deployment] Step 2: Running standard BLE initialization...')
            
            const result = await runBleStandardInit(bleDevice, {
                onProgress: (step: string, progress: number) => {
                    setInitStep(step)
                    setInitProgress(0.1 + (progress * 0.4)) // Scale standard init to 50%
                }
            })

            const newErrors: { selftest?: string; setUtc?: string; deviceHealth: string[] } = {
                setUtc: result.errors?.setUtc,
                deviceHealth: result.errors?.deviceHealth || []
            }

            // 1. Battery Check
            try {
                setInitStep('Checking battery...')
                setInitProgress(0.6)
                const batteryResponse = await getBatteryLevel(bleDevice)
                const batteryMatch = batteryResponse.match(COMMANDS[CommandNames.battery].readRegex!)
                if (batteryMatch) {
                    const level = parseInt(batteryMatch[1], 10)
                    setBatteryLevel(level)
                    if (level < 20) {
                        newErrors.deviceHealth.push(`Battery is low (${level}%)`)
                    }
                }
            } catch (e) {
                logWarn('[Deployment] Battery check failed:', e)
            }

            // 2. SD Card Check
            try {
                setInitStep('Checking SD card...')
                setInitProgress(0.7)
                const sdStatus = await checkSdCard(bleDevice)
                if (sdStatus && sdStatus.total > 0) {
                    setSdCardStatus(sdStatus)
                    const percentFull = ((sdStatus.total - sdStatus.free) / sdStatus.total) * 100
                    if (percentFull > 90) {
                        newErrors.deviceHealth.push(`SD Card is almost full (${percentFull.toFixed(1)}% used)`)
                    }
                } else {
                    const statusMsg = await runSelfTest(bleDevice)
                    const hexBits = extractErrorBits(statusMsg)
                    if (hexBits && (parseInt(hexBits, 16) & 0x0800)) {
                        newErrors.deviceHealth.push('No SD Card detected')
                    }
                }
            } catch (e) {
                logWarn('[Deployment] SD Card check failed:', e)
            }

            // 3. Firmware Check
            try {
                setInitStep('Checking firmware...')
                setInitProgress(0.8)
                const firmwareResponse = await getDeviceVer(bleDevice)
                const fwMatch = firmwareResponse.match(COMMANDS[CommandNames.ver].readRegex!)
                if (fwMatch) {
                    const version = fwMatch[1]
                    setDeviceFirmwareVersion(version)
                    const latest = await ReferenceDataService.getLatestFirmware('ble')
                    setLatestBleFirmware(latest)
                    // Simple string comparison. For stricter checks, use versionUtils.
                    if (latest && version !== latest.version) {
                        setBleFirmwareUpdateAvailable(true)
                        newErrors.deviceHealth.push(`Newer firmware available: ${latest.version}`)
                    } else {
                        setBleFirmwareUpdateAvailable(false)
                    }
                }
            } catch (e) {
                logWarn('[Deployment] Firmware check failed:', e)
            }

            setInitStep('Finalizing...')
            setInitProgress(0.9)

            if (!result.success || newErrors.deviceHealth.length > 0) {
                logWarn('[Deployment] Device has initialization warnings:', newErrors)
                setInitErrors(newErrors)
            } else {
                 log('[Deployment] Initialization complete. Hardware verified.')
            }

            setTimeout(() => {
                setInitProgress(1.0)
                setIsInitializing(false)
            }, INITIALIZATION_GUARD_TIMEOUT)
        }

        initializeDevice()
    }, [bleDevice, runBleStandardInit, getBatteryLevel, checkSdCard, runSelfTest, getDeviceVer])

    const loadPreparationAndProject = useCallback(async () => {
        try {
            log('[DeploymentDetails] Loading preparation:', devicePreparationId);
            
            const [prep, deviceData] = await Promise.all([
                DevicePreparationService.getPreparationById(devicePreparationId as string),
                DeviceService.getDeviceById(deviceId as string)
            ])
            
            setDevice(deviceData)
            log('[DeploymentDetails] Prep loaded:', prep?.id, 'projectId:', prep?.projectId);

            if (prep && prep.projectId) {
                log('[DeploymentDetails] Loading project:', prep.projectId);
                const proj = await ProjectService.getProjectById(prep.projectId)
                log('[DeploymentDetails] Project loaded:', proj?.name, 'capture_method_id:', proj?.capture_method_id);
                setProject(proj)

                if (proj && proj.capture_method_id) {
                    log('[DeploymentDetails] Resolving capture method name for ID:', proj.capture_method_id);
                    const methods = await ReferenceDataService.getCaptureMethods()
                    const method = methods.find((m: any) => m.id === proj.capture_method_id)
                    log('[DeploymentDetails] Method resolved:', method?.value);
                    setCaptureMethodName(method ? method.value : 'Unknown')

                    if (proj.activity_detection_sensitivity_id) {
                        const sensitivities = await ReferenceDataService.getActivitySensitivity()
                        const sensitivity = sensitivities.find((s: any) => s.id === proj.activity_detection_sensitivity_id)
                        setSensitivityLabel(sensitivity ? sensitivity.value : 'Unknown')
                    }
                } else {
                    log('[DeploymentDetails] No capture method ID on project');
                    setCaptureMethodName('Not Set')
                }
            } else {
                logWarn('[DeploymentDetails] Prep found but missing projectId');
            }
        } catch (error) {
            logError('[DeploymentDetails] Error in loadPreparationAndProject:', error)
        }
    }, [devicePreparationId, deviceId])

    useFocusEffect(
        useCallback(() => {
            if (devicePreparationId) {
                loadPreparationAndProject()
            }
        }, [devicePreparationId, loadPreparationAndProject])
    )

    // Navigation Interceptor
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
            if (isNavigatingAway.current) {
                return
            }

            const actionType = e.data.action.type;
            if (actionType === 'GO_BACK' || actionType === 'POP') {
                e.preventDefault()

                log('[Deployment] Intercepting back navigation. Disconnecting and redirecting to Deployments.')
                isNavigatingAway.current = true

                if (bleDevice) {
                    runDisconnect(bleDevice).catch((err: any) => logWarn('[Deployment] Auto-disconnect failed:', err))
                }

                navigation.navigate('Home', { initialTab: 'deployment' })
            }
        })

        return unsubscribe
    }, [navigation, bleDevice, runDisconnect])

    // Robust Connection Lost Alert
    useEffect(() => {
        if (!isInitializing && !submitting && bleDevice && !bleDevice.connected && !isNavigatingAway.current && !isStartDeploymentInProgress.current && !isDfuInProgress.current && !isReconnectingAfterDfu.current) {
            Alert.alert(
                'Connection Lost',
                'Device disconnected unexpectedly during deployment setup.',
                [{
                    text: 'OK', onPress: () => {
                        isNavigatingAway.current = true
                        navigation.goBack()
                    }
                }]
            )
        }
    }, [bleDevice, submitting, navigation, isInitializing])

    const handleStartDeployment = useCallback(async () => {
        if (!formState.name) {
            Alert.alert('Missing Information', 'Please enter a deployment name')
            return
        }

        if (!bleDevice?.connected) {
            Alert.alert(
                'Device Disconnected',
                'Please ensure the device is connected before starting the deployment.',
                [{ text: 'OK' }]
            )
            return
        }

        if (!project || !user) {
            Alert.alert('Error', 'Missing project or user information. Please wait for data to load.')
            return
        }

        setIsFinishing(true)
        setSubmitting(true)
        setFinishProgress(0)
        setFinishStep('Starting deployment...')
        setFinishLogs([])
        setIsStartSuccess(false)
        isStartDeploymentInProgress.current = true

        try {
            addFinishLog('Performing final time check...')
            setFinishStep('Checking time...')
            setFinishProgress(0.1)
            
            if (bleDevice) await setUtc(bleDevice)
            addFinishLog('Time check complete')

            addFinishLog('Creating deployment record...')
            setFinishStep('Creating record...')
            setFinishProgress(0.3)

            const newDeployment = await DeploymentService.createDeployment({
                name: formState.name,
                projectId: project.id,
                deviceId: deviceId || '',
                devicePreparationId: devicePreparationId || '',
                setupBy: user.id,

                locationName: 'Automated Deployment',
                cameraHeight: formState.cameraHeight ? parseFloat(formState.cameraHeight) : undefined,

                captureMethodId: project.capture_method_id,

                startComments: formState.notes,
                cameraImagePaths: [],
            })
            addFinishLog(`Deployment created: ${newDeployment.id.substring(0, 8)}...`)

            addFinishLog('Configuring device settings...')
            setFinishStep('Configuring device...')
            setFinishProgress(0.5)
            
            log('[Deployment] Configuring device via standardized hook...')
            try {
                let method: 'activity' | 'timelapse' | 'mixed' | 'unknown' = 'unknown'
                
                if (project.capture_method_id === 1) {
                    method = 'activity'
                } else if (project.capture_method_id === 2) {
                    method = 'timelapse'
                } else if (project.capture_method_id === 3) {
                    method = 'mixed'
                }

                await startConfigure(bleDevice, {
                    deploymentId: newDeployment.id,
                    captureMethod: method,
                    motionInterval: 1000,
                    timelapseInterval: project.timelapse_interval_seconds || 300,
                    recordGpsInImages: project.recordGpsInImages || false
                })
                
                addFinishLog('Device configuration successful')
                log('[Deployment] Device configuration successful')

            } catch (configError) {
                logError('[Deployment] Configuration failed:', configError)
                addFinishLog('Configuration warning: Verify settings in console')
            }

            if (bleDevice?.connected) {
                addFinishLog('Flashing confirmation LED...')
                setFinishStep('Signaling success...')
                setFinishProgress(0.9)
                
                try {
                    await flashLed(bleDevice, 'green', 3, 300)
                    addFinishLog('LED signal sent')
                } catch (e) {
                    logWarn('[Deployment] LED flash failed:', e)
                    addFinishLog('Warning: LED signal failed')
                }
            }

            addFinishLog('Disconnecting...')
            setFinishStep('Disconnecting...')
            setFinishProgress(0.95)
            log('[Deployment] Disconnecting device...')
            
            try {
                await runDisconnect(bleDevice)
                addFinishLog('Device disconnected')
                log('[Deployment] Device disconnected')
            } catch (e) {
                logError('[Deployment] Failed to disconnect:', e)
                addFinishLog('Warning: Clean disconnect failed')
            }

            setFinishStep('Complete')
            setFinishProgress(1.0)
            setIsStartSuccess(true)
            addFinishLog('Deployment started successfully')

        } catch (error) {
            logError('Deployment failed:', error)
            setIsFinishing(false)
            Alert.alert('Error', 'Failed to start deployment: ' + (error as any).message)
            isStartDeploymentInProgress.current = false
        }
    }, [formState.name, formState.cameraHeight, formState.notes, bleDevice, project, user, deviceId, devicePreparationId, runDisconnect, startConfigure, addFinishLog, flashLed, setUtc])

    const handleFinishDismiss = useCallback(() => {
        setIsFinishing(false)
        if (isStartSuccess) {
             isNavigatingAway.current = true
             navigation.navigate('Home', { initialTab: 'deployment' })
        }
    }, [isStartSuccess, navigation])

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

    const handleBatteryCheck = useCallback(async () => {
        if (!bleDevice || !bleDevice.connected) return
        try {
            const response = await getBatteryLevel(bleDevice)
            const match = response.match(COMMANDS[CommandNames.battery].readRegex!)
            if (match) {
                const level = parseInt(match[1], 10)
                setBatteryLevel(level)
            }
        } catch (error) {
            logError('Battery check failed:', error)
            Alert.alert('Error', 'Failed to check battery level')
        }
    }, [bleDevice, getBatteryLevel])

    const handleSdCardCheck = useCallback(async () => {
        if (!bleDevice || !bleDevice.connected) return
        try {
            const sdStatus = await checkSdCard(bleDevice)
            if (sdStatus && sdStatus.total > 0) {
                 setSdCardStatus(sdStatus)
                 return
            }
            const statusMsg = await runSelfTest(bleDevice)
            const hexBits = extractErrorBits(statusMsg)
            if (hexBits && (parseInt(hexBits, 16) & 0x0800)) {
                Alert.alert('No SD Card Detected', 'The device reports no SD card is inserted.', [{ text: 'OK' }])
                setSdCardStatus(null)
                return
            }
            setSdCardStatus(null)
        } catch (error) {
            logError('SD card check failed:', error)
            Alert.alert('Error', 'Failed to check SD card status')
        }
    }, [bleDevice, checkSdCard, runSelfTest])

    const handleFirmwareCheck = useCallback(async () => {
        if (!bleDevice || !bleDevice.connected) return
        try {
            setIsCheckingFirmware(true)
            setDeviceFirmwareVersion(null)
            const response = await getDeviceVer(bleDevice)
            const match = response.match(COMMANDS[CommandNames.ver].readRegex!)
            if (match) setDeviceFirmwareVersion(match[1])
            setIsCheckingFirmware(false)
        } catch (error) {
            setIsCheckingFirmware(false)
            Alert.alert('Error', 'Failed to check firmware version')
        }
    }, [bleDevice, getDeviceVer])

    const handleBleFirmwareUpdate = useCallback(async () => {
        if (!latestBleFirmware || !device || !bleDevice) return
        const isLowBattery = batteryLevel !== null && batteryLevel < 30
        const batteryWarning = isLowBattery
            ? "\n\n⚠️ WARNING: Battery is low. Updating with low battery increases the risk of device failure."
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
                            isDfuInProgress.current = true
                            setFirmwareUpdateProgress(0)

                            const localUri = await FirmwareService.ensureFirmwareDownloaded(latestBleFirmware)

                            if (bleDevice.connected) {
                                setFirmwareUpdateStatus('Switching to DFU mode...')
                                try {
                                    await runDfu(bleDevice)
                                    await new Promise(r => setTimeout(r, 500))
                                    await runDisconnect(bleDevice)
                                    await new Promise(r => setTimeout(r, 5000))
                                } catch (e) {
                                    logWarn('[Deployment DFU] Failed DFU command:', e)
                                }
                            }

                            if (Platform.OS === 'android' && Platform.Version >= 33) {
                                try {
                                    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
                                    if (granted !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Notification permission required')
                                } catch (permErr) {}
                            }

                            setFirmwareUpdateStatus('Searching for bootloader...')
                            const bootloaderAddress = await scanForBootloader(10000)
                            if (!bootloaderAddress) throw new Error('Bootloader not found.')

                            setFirmwareUpdateStatus('Updating firmware...')
                            await DfuService.startDFU(bootloaderAddress, localUri, (progress) => {
                                setFirmwareUpdateProgress(progress)
                                if (progress > 95) setFirmwareUpdateStatus('Finalizing update...')
                            })

                            setFirmwareUpdateProgress(100)
                            setFirmwareUpdateStatus('Rebooting device...')
                            setDeviceFirmwareVersion(null)
                            setIsCheckingFirmware(true)
                            setIsVerifyingUpdate(true)
                            setBleFirmwareUpdateAvailable(false)

                            isReconnectingAfterDfu.current = true
                            isDfuInProgress.current = false
                            
                            await new Promise(r => setTimeout(r, 6000))

                            setFirmwareUpdateStatus('Reconnecting...')
                            
                            try {
                                const foundId = await scanForOriginalDevice(bleDeviceId!, 20000)
                                if (foundId && bleDevice) {
                                    setFirmwareUpdateStatus('Connecting...')
                                    await connectDevice(bleDevice, 20000)
                                    await new Promise(r => setTimeout(r, 2000))
                                    setFirmwareUpdateStatus('Verifying version...')
                                    handleFirmwareCheck()
                                } else {
                                    throw new Error('Device not found after DFU reboot')
                                }
                            } catch (reconnectErr) {
                                setIsVerifyingUpdate(false)
                                setDeviceFirmwareVersion(null)
                                Alert.alert('Reconnect Failed', 'Failed to auto reconnect. Please reconnect manually.', [{ text: 'OK' }])
                            }
                        } catch (error) {
                            Alert.alert('Update Failed', error instanceof Error ? error.message : 'Unknown error')
                        } finally {
                            isReconnectingAfterDfu.current = false
                            setIsUpdatingFirmware(false)
                            isDfuInProgress.current = false
                            setFirmwareUpdateStatus('')
                        }
                    }
                }
            ]
        )
    }, [latestBleFirmware, device, bleDevice, bleDeviceId, batteryLevel, handleFirmwareCheck, runDisconnect, runDfu, connectDevice])

    return {
        formState, submitting, project, captureMethodName, sensitivityLabel,
        device, bleDevice, isInitializing, initProgress, initStep, initErrors,
        finishProgress, finishStep, finishLogs, isFinishing, isStartSuccess,
        isNavigatingAway, handleImageCaptured, handleNameChange, handleNotesChange,
        handleCameraHeightChange, handleStartDeployment, handleFinishDismiss,
        helpVisible, helpTitle, helpContent, showHelp, handleDismissHelp,
        // Advanced Settings Exports
        batteryLevel, sdCardStatus, latestBleFirmware, deviceFirmwareVersion,
        bleFirmwareUpdateAvailable, firmwareUpdateProgress, isUpdatingFirmware,
        isCheckingFirmware, isVerifyingUpdate, firmwareUpdateStatus,
        handleBatteryCheck, handleSdCardCheck, handleFirmwareCheck, handleBleFirmwareUpdate
    }
}
