import React, { useState, useEffect, useCallback } from 'react'
import { View, ScrollView, StyleSheet, Alert, Image, PermissionsAndroid, Platform } from 'react-native'
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import * as FileSystem from 'expo-file-system'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWText } from '../../components/ui/WWText'
import { WWButton } from '../../components/ui/WWButton'
import { WWSelect } from '../../components/ui/WWSelect'
import { WWProgressBar } from '../../components/ui/WWProgressBar'
import { DeviceService } from '../../services/DeviceService'
import { DevicePreparationService } from '../../services/DevicePreparationService'
import ProjectService from '../../services/ProjectService'
import ReferenceDataService from '../../services/ReferenceDataService'
import { DfuService } from '../../services/DfuService'
import FirmwareService from '../../services/FirmwareService'
import { useBleCommands } from '../../hooks/useBleCommands'
import { useBle } from '../../hooks/useBle'
import { useCapturePreview } from '../../hooks/useCapturePreview'
import { useDeviceSettings } from '../../hooks/useDeviceSettings'
import { useGetProjectsQuery } from '../../redux/api/projectsApi'
import { useAppSelector } from '../../redux'
import Device from '../../database/models/Device'
import DevicePreparation from '../../database/models/DevicePreparation'
import Firmware from '../../database/models/Firmware'
import database from '../../database'
import { ActivityIndicator, Text, useTheme } from 'react-native-paper'
import { getSupabaseClient } from '../../services/supabase'
import BleManager, { Peripheral } from 'react-native-ble-manager'

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
                console.log('[scanForBootloader] Discovered:', peripheral.name, peripheral.id)

                // Check if this is the bootloader (WW500_DFU or DfuTarg)
                if (peripheral.name === 'WW500_DFU' || peripheral.name === 'DfuTarg') {
                    console.log('[scanForBootloader] Found bootloader at:', peripheral.id)
                    // Stop scanning
                    BleManager.stopScan().catch(err => console.warn('Failed to stop scan:', err))
                    // Remove listener
                    eventEmitter.remove()
                    // Clear timeout
                    if (timeout) clearTimeout(timeout)
                    // Return the address
                    resolve(peripheral.id)
                }
            }
        )

        // Start scanning
        BleManager.scan([], timeoutMs / 1000) // Convert to seconds
            .then(() => {
                console.log('[scanForBootloader] Scan started for DfuTarg')
            })
            .catch(err => {
                console.error('[scanForBootloader] Scan failed:', err)
                eventEmitter.remove()
                reject(err)
            })

        // Timeout if not found
        const timeout = setTimeout(() => {
            console.log('[scanForBootloader] Scan timeout, bootloader not found')
            BleManager.stopScan().catch(err => console.warn('Failed to stop scan:', err))
            eventEmitter.remove()
            resolve(null)
        }, timeoutMs)
    })
}

type PrepareAndTestRouteProp = RouteProp<{ params: { deviceId: string; bleDeviceId: string; selftestError?: string; setUtcError?: string, nextRoute?: string } }, 'params'>

export const PrepareAndTestScreen = () => {
    const route = useRoute<PrepareAndTestRouteProp>()
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
    const [firmwareUpToDate, setFirmwareUpToDate] = useState(true)
    const [aiModelMatches, setAiModelMatches] = useState(true)

    // BLE firmware state
    const [latestBleFirmware, setLatestBleFirmware] = useState<Firmware | null>(null)
    const [deviceFirmwareVersion, setDeviceFirmwareVersion] = useState<string | null>(null)
    const [bleFirmwareUpdateAvailable, setBleFirmwareUpdateAvailable] = useState(false)
    const [firmwareUpdateProgress, setFirmwareUpdateProgress] = useState<number>(0)
    const [isUpdatingFirmware, setIsUpdatingFirmware] = useState(false)
    const [isCheckingFirmware, setIsCheckingFirmware] = useState(false)

    // BLE command hooks
    const { getBatteryLevel, checkSdCard, captureTestImage, setUtc, setOperationalParam, getDeviceVer, disableCamera, runDisconnect, runDfu } = useBleCommands()
    const { write } = useBle()
    const bleDevice = useAppSelector((state) => state.devices[bleDeviceId])
    const logs = useAppSelector(state => state.logs[bleDeviceId || ''] || "")

    // Camera capture hook
    const { capturedImageUri, isCapturing: isCapturingImage, startCapture } = useCapturePreview({
        device: bleDevice,
        logs: logs,
        write: write,
        onImageReceived: (imageUri) => {
            console.log('[PrepareTest] Image received:', imageUri)
            setCameraTestPassed(true)
            if (preparation) {
                DevicePreparationService.updatePreparation(preparation.id, {
                    cameraViewTestPassed: true,
                }).catch(error => console.error('Failed to update preparation:', error))
            }
        }
    })

    // Device settings hook
    const { updateSettings: updateDeviceSettings } = useDeviceSettings({
        device: bleDevice,
        onError: (error) => {
            console.error('[PrepareTest] Settings update failed:', error)
            Alert.alert('Settings Error', error.message)
        }
    })

    // Initialization errors from connection
    const [initErrors, setInitErrors] = useState<{ selftest?: string; setUtc?: string }>({})

    // Load user projects using RTK Query (consistent with Projects screen)
    const currentOrganisation = useAppSelector((state) => state.authentication.currentOrganisation)
    const { data: projects = [] } = useGetProjectsQuery(
        { userId: user?.id!, organisationId: currentOrganisation?.id! },
        { skip: !user?.id || !currentOrganisation?.id }
    )

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
    }, [deviceId])

    // Check BLE firmware version on mount
    useEffect(() => {
        const checkBleFirmware = async () => {
            try {
                const latest = await ReferenceDataService.getLatestFirmware('ble')
                setLatestBleFirmware(latest)

                // Auto-trigger device check if connected and not yet checked
                if (bleDevice && bleDevice.connected && !deviceFirmwareVersion && !isCheckingFirmware) {
                    console.log('[PrepareTest] Auto-triggering firmware check on mount...')
                    handleFirmwareCheck()
                }

                if (device && latest && device.firmwareId) {
                    // Check based on DB record first if available (fallback)
                    const updateAvailable = device.firmwareId !== latest.id
                    // ... logic continues ...
                }
            } catch (error) {
                console.error('[PrepareTest] Failed to check BLE firmware:', error)
            }
        }

        checkBleFirmware()
    }, [device, bleDevice?.connected]) // Re-run when device connects

    // Disable camera on mount to ensure clean state
    useEffect(() => {
        if (bleDevice) {
            console.log('[PrepareTest] Disabling camera on mount to ensure clean state')
            disableCamera(bleDevice).catch(err => console.error('[PrepareTest] Failed to disable camera on mount:', err))
        }

        // Cleanup: Disconnect on unmount
        return () => {
            if (bleDevice && bleDevice.connected) {
                console.log('[PrepareTest] Unmounting - Disconnecting device...')
                runDisconnect(bleDevice).catch(err => console.error('[PrepareTest] Failed to disconnect on unmount:', err))
            }
        }
    }, [])

    // Parse BLE logs for command responses

    // Helper to compare version strings: "00.13.00" vs "0.13.0"
    const compareVersions = (v1: string, v2: string) => {
        // Strip non-numeric/dot characters just in case
        const norm1 = v1.replace(/[^0-9.]/g, '').split('.').map(Number)
        const norm2 = v2.replace(/[^0-9.]/g, '').split('.').map(Number)

        const len = Math.max(norm1.length, norm2.length)
        for (let i = 0; i < len; i++) {
            const num1 = norm1[i] || 0
            const num2 = norm2[i] || 0
            if (num1 > num2) return 1
            if (num1 < num2) return -1
        }
        return 0
    }

    // Parse BLE logs for command responses
    useEffect(() => {
        if (!logs) return

        // Log incoming data for debugging
        if (logs.length > 0) {
            // console.log('[PrepareTest] BLE logs updated, length:', logs.length)
        }

        // Parse battery response: "Battery = 5482mV 73%"
        const batteryMatch = logs.match(/Battery\s*=\s*\d+mV\s+(\d+)%/)
        if (batteryMatch && batteryLevel === null) {
            const percent = parseInt(batteryMatch[1])
            console.log('[PrepareTest] Parsed battery level:', percent + '%')
            setBatteryLevel(percent)
            if (preparation) {
                DevicePreparationService.updatePreparation(preparation.id, {
                    batteryCheckPassed: percent > 30
                })
            }
        }

        // Parse SD card response: "30515200 K total drive space." and "30512400 K available."
        // Also handling: "K total", "k total", possible extra spaces
        const totalMatch = logs.match(/(\d+)\s*[Kk]\s*total\s*drive\s*space/i)
        const availMatch = logs.match(/(\d+)\s*[Kk]\s*available/i)

        if (logs.length > 0 && !sdCardStatus && (logs.toLowerCase().includes('total') || logs.toLowerCase().includes('available'))) {
            console.log('[PrepareTest] SD keywords found but match failed? Logs snippet:', logs.substring(Math.max(0, logs.length - 300)))
        }

        if (logs.includes('K total') || logs.includes('K available')) {
            // console.log('[PrepareTest] SD card keywords detected')
        }

        if (totalMatch && availMatch && sdCardStatus === null) {
            const totalKB = parseInt(totalMatch[1])
            const availableKB = parseInt(availMatch[1])
            console.log('[PrepareTest] Parsed SD card:', { totalKB, availableKB })
            setSdCardStatus({ total: totalKB, free: availableKB })
            if (preparation) {
                DevicePreparationService.updatePreparation(preparation.id, {
                    sdCardCheckPassed: availableKB > (totalKB * 0.1)
                })
            }
        }

        // Parse firmware version response: "BLE: v0.10.0", "WW500-A00 V 00.11.01", "Version: 0.10.0"
        // Matches: "V 00.11.01", "Ver: 1.0", "BLE: v1.0"
        const versionMatch = logs.match(/(?:V|Ver|Version|BLE)[:\s]+v?(\d+\.\d+\.\d+)/i)
        if (versionMatch && deviceFirmwareVersion === null && isCheckingFirmware) {
            const version = versionMatch[1]
            console.log('[PrepareTest] Parsed device firmware version:', version)
            setDeviceFirmwareVersion(version)
            setIsCheckingFirmware(false)

            // Compare with latest firmware
            if (latestBleFirmware) {
                // Use semantic comparison instead of strict string equality
                // Returns 0 if equal, -1 if v1 < v2, 1 if v1 > v2
                const comparison = compareVersions(version, latestBleFirmware.version)
                const updateAvailable = comparison < 0 // Only update if device version is LOWER

                setBleFirmwareUpdateAvailable(updateAvailable)
                setFirmwareUpToDate(!updateAvailable)
                console.log('[PrepareTest] Firmware comparison:', {
                    deviceVersion: version,
                    latestVersion: latestBleFirmware.version,
                    comparisonResult: comparison,
                    updateAvailable
                })
            }
        }
    }, [logs, batteryLevel, sdCardStatus, preparation, deviceFirmwareVersion, isCheckingFirmware, latestBleFirmware])

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
            if (!loading && bleDevice) {
                if (!bleDevice.connected) {
                    console.log('[PrepareTest] Connection lost detected on focus')
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
        }, [bleDevice, loading, navigation])
    )

    const loadDeviceAndPreparation = async () => {
        try {
            const deviceData = await DeviceService.getDeviceById(deviceId)
            setDevice(deviceData)

            // Get last prep to pre-fill project
            if (deviceData) {
                const lastPrep = await DevicePreparationService.getLastCompletedPreparation(deviceId)
                if (lastPrep) {
                    setSelectedProject(lastPrep.projectId)
                }
            }

            // Create new preparation record (startPreparation handles cleanup)
            if (user?.id) {
                const newPrep = await DevicePreparationService.startPreparation(
                    deviceId,
                    selectedProject || (projects && projects.length > 0 ? projects[0].id : ''),
                    user.id
                )
                setPreparation(newPrep)
            }
        } catch (error) {
            console.error('Error loading device:', error)
            Alert.alert('Error', 'Failed to load device information')
        } finally {
            setLoading(false)
        }
    }

    const handleBatteryCheck = async () => {
        console.log('[PrepareTest] Battery check requested, bleDevice:', bleDevice?.id, 'connected:', bleDevice?.connected)
        if (!bleDevice) {
            console.warn('[PrepareTest] No BLE device available for battery check')
            return
        }
        try {
            console.log('[PrepareTest] Sending battery level command...')
            await getBatteryLevel(bleDevice)
            console.log('[PrepareTest] Battery level command sent, waiting for response in logs')
            // Response will be parsed from logs in useEffect
        } catch (error) {
            console.error('Battery check failed:', error)
            Alert.alert('Error', 'Failed to check battery level')
        }
    }

    const handleSdCardCheck = async () => {
        console.log('[PrepareTest] SD card check requested, bleDevice:', bleDevice?.id, 'connected:', bleDevice?.connected)
        if (!bleDevice) {
            console.warn('[PrepareTest] No BLE device available for SD card check')
            return
        }
        try {
            console.log('[PrepareTest] Sending SD card check command (AI info)...')
            await checkSdCard(bleDevice)

            // The AI processor is in Deep Power Down (DPD) mode to save battery.
            // First command wakes it and it processes the request automatically.
            // Based on working firmware logs, wake + response takes ~3-4 seconds total.
            console.log('[PrepareTest] Waiting 4s for AI processor to wake and respond...')
            await new Promise(resolve => setTimeout(resolve, 4000))

            console.log('[PrepareTest] Response should be in logs now')

            // Response will be parsed from logs in useEffect  
        } catch (error) {
            console.error('SD card check failed:', error)
            Alert.alert('Error', 'Failed to check SD card status')
        }
    }

    const handleFirmwareCheck = async () => {
        console.log('[PrepareTest] Firmware check requested, bleDevice:', bleDevice?.id, 'connected:', bleDevice?.connected)
        if (!bleDevice) {
            console.warn('[PrepareTest] No BLE device available for firmware check')
            return
        }
        try {
            setIsCheckingFirmware(true)
            setDeviceFirmwareVersion(null) // Reset to allow re-parsing
            console.log('[PrepareTest] Sending firmware version command...')
            await getDeviceVer(bleDevice)
            console.log('[PrepareTest] Firmware version command sent, waiting for response in logs')

            // Wait for device to respond
            await new Promise(resolve => setTimeout(resolve, 2500))

            // If still checking after timeout, assume failure or parse from existing logs if missed
            console.log('[PrepareTest] Wait period complete.')
            setIsCheckingFirmware(false)
        } catch (error) {
            console.error('Firmware check failed:', error)
            setIsCheckingFirmware(false)
            Alert.alert('Error', 'Failed to check firmware version')
        }
    }

    const handleCameraTest = async () => {
        await startCapture()
    }

    const handleBleFirmwareUpdate = async () => {
        if (!latestBleFirmware || !device || !bleDevice) {
            Alert.alert('Error', 'Firmware information not available')
            return
        }

        Alert.alert(
            'Update BLE Firmware',
            `This will update the BLE firmware to version ${latestBleFirmware.version}. The process takes 2-3 minutes. Make sure the device battery is above 30%.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Update',
                    onPress: async () => {
                        try {
                            setIsUpdatingFirmware(true)
                            setFirmwareUpdateProgress(0)

                            // Use FirmwareService to handle download and caching (supports offline updates)
                            console.log('[PrepareTest] Ensuring firmware is available locally...')
                            const localUri = await FirmwareService.ensureFirmwareDownloaded(latestBleFirmware)
                            console.log('[PrepareTest] Firmware ready at:', localUri)

                            // Trigger DFU mode switch if connected
                            // This sends the "dfu" command, causing the device to reboot into DFU (Bootloader) mode
                            if (bleDevice.connected) {
                                console.log('[PrepareTest] Sending DFU command to reset device into bootloader mode...')
                                try {
                                    await runDfu(bleDevice)
                                    console.log('[PrepareTest] DFU command sent. Waiting 500ms for firmware processing...')

                                    // CRITICAL: Wait for firmware to receive and process the 'dfu' command
                                    await new Promise(r => setTimeout(r, 500))

                                    console.log('[PrepareTest] Disconnecting to trigger DFU mode switch...')
                                    await runDisconnect(bleDevice)

                                    // Give device time to reboot and advertise as DfuTarg
                                    console.log('[PrepareTest] Waiting 5s for reboot...')
                                    await new Promise(r => setTimeout(r, 5000))
                                } catch (e) {
                                    console.warn('[PrepareTest] Failed to send DFU command (device might already be in DFU mode?):', e)
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
                                    console.warn('[PrepareTest] Notification permission warning:', permErr)
                                }
                            }

                            // Scan for bootloader
                            console.log('[PrepareTest] Scanning for bootloader...')
                            const bootloaderAddress = await scanForBootloader(10000)
                            if (!bootloaderAddress) {
                                throw new Error('Bootloader not found. Ensure device is in DFU mode (flashing red).')
                            }
                            console.log('[PrepareTest] Found bootloader at:', bootloaderAddress)

                            // Start DFU process
                            await DfuService.startDFU(
                                bootloaderAddress,
                                localUri,
                                (progress) => setFirmwareUpdateProgress(progress)
                            )

                            // Update device firmware_id in database
                            await database.write(async () => {
                                await device.update(d => {
                                    d.firmwareId = latestBleFirmware.id
                                })
                            })

                            setBleFirmwareUpdateAvailable(false)
                            setFirmwareUpToDate(true)
                            setFirmwareUpdateProgress(100)

                            Alert.alert('Success', 'BLE firmware updated successfully!')

                            if (preparation) {
                                await DevicePreparationService.updatePreparation(preparation.id, {
                                    firmwareUpdated: true,
                                    firmwareCheckPassed: true,
                                })
                            }


                        } catch (error) {
                            console.error('[PrepareTest] Firmware update failed:', error)
                            Alert.alert('Update Failed', error instanceof Error ? error.message : 'Unknown error')
                        } finally {
                            setIsUpdatingFirmware(false)
                        }
                    }
                }
            ]
        )
    }

    const handleProjectChange = async (projectId: string) => {
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
    }

    const handleFinish = async () => {
        if (!selectedProject) {
            Alert.alert('Project Required', 'Please select a project before finishing preparation.')
            return
        }

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

        if (!bleDevice) {
            Alert.alert('Error', 'Device connection lost')
            return
        }

        try {
            setLoading(true)
            const errors: string[] = []

            // 1. Set UTC time
            try {
                await setUtc(bleDevice)
                await new Promise(resolve => setTimeout(resolve, 1000))
                console.log('[PrepareTest] SET_UTC completed')
            } catch (error) {
                console.error('[PrepareTest] SET_UTC failed:', error)
                errors.push('Failed to sync device time')
            }

            // 2. Configure device settings based on selected project
            try {
                // Find the selected project
                const selectedProjectData = projects?.find(p => p.id === selectedProject)

                if (selectedProjectData) {
                    console.log('[PrepareTest] Configuring device settings for project:', selectedProjectData.name)

                    // Determine capture method from project
                    const isMotionDetect = selectedProjectData.capture_method_id === 1 // activityDetection
                    const isTimelapse = selectedProjectData.capture_method_id === 2 // timeLapse

                    await updateDeviceSettings({
                        // Configure capture method
                        motionDetectInterval: isMotionDetect ? 1000 : 0,  // 1s if motion, disabled if timelapse
                        timelapseInterval: isTimelapse ? (selectedProjectData.timelapse_interval_seconds || 900) : 0,
                        // ALWAYS disable camera after preparation
                        // Camera will be enabled during "Start Deployment"
                        cameraEnabled: false
                    })

                    console.log('[PrepareTest] Device settings configured successfully')

                    // Explicitly disable camera again just to be safe
                    await disableCamera(bleDevice)

                } else {
                    console.log('[PrepareTest] No project selected or found, skipping settings configuration')
                }
            } catch (error) {
                console.error('[PrepareTest] Failed to configure device settings:', error)
                errors.push('Failed to configure device settings')
            }

            // 3. Check for errors
            if (errors.length > 0) {
                Alert.alert(
                    'Preparation Incomplete',
                    `The following commands failed:\n\n${errors.map(e => `• ${e}`).join('\n')}\n\nPlease retry or contact support.`,
                    [{ text: 'OK' }]
                )
                return
            }

            // 4. Mark preparation as complete
            if (preparation) {
                // Checks enforced above, so isReady is effectively true if we get here
                // But keeping the variable for clarity in case we add non-blocking checks later
                const isReady = true

                await DevicePreparationService.completePreparation(preparation.id, isReady)

                Alert.alert(
                    'Preparation Complete',
                    'Device ready to be deployed',

                    [{
                        text: 'OK',
                        onPress: async () => {
                            // Disconnect BLE before navigating away
                            if (bleDevice) {
                                console.log('[PrepareTest] Finishing - Disconnecting device...')
                                await runDisconnect(bleDevice).catch(e => console.error('Failed to disconnect:', e))
                            }

                            // Check for nextRoute (start deployment flow)
                            const { nextRoute } = route.params || {}
                            if (nextRoute) {
                                (navigation as any).navigate(nextRoute, {
                                    devicePreparationId: preparation.id,
                                    deviceId: deviceId,
                                    bleDeviceId: bleDeviceId
                                })
                            } else {
                                // Default: Navigate to Devices tab
                                navigation.navigate("Home", { initialTab: "devices" })
                            }
                        },
                    }]
                )
            }
        } catch (error) {
            console.error('Error completing preparation:', error)
            Alert.alert('Error', 'Failed to complete preparation')
        } finally {
            setLoading(false)
        }
    }

    if (loading || !device) {
        return (
            <WWScreenView>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" />
                    <WWText variant="bodyMedium" style={styles.loadingText}>
                        Loading device...
                    </WWText>
                </View>
            </WWScreenView>
        )
    }

    return (
        <WWScreenView>
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <WWText variant="titleLarge">Prepare & Test</WWText>
                    <WWText variant="bodyMedium" style={styles.deviceName}>
                        {device.name}
                    </WWText>
                    <WWText variant="bodySmall" style={styles.deviceId}>
                        {device.bluetoothId}
                    </WWText>
                </View>

                {/* Initialization Errors */}
                {(initErrors.selftest || initErrors.setUtc) && (
                    <View style={[styles.errorSection, { backgroundColor: theme.colors.errorContainer, borderLeftColor: theme.colors.error }]}>
                        <Text variant="titleMedium" style={[styles.errorTitle, { color: theme.colors.onErrorContainer }]}>
                            ⚠️ Initialization Warnings
                        </Text>
                        {initErrors.selftest && (
                            <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.onErrorContainer }]}>
                                • Selftest: {initErrors.selftest}
                            </Text>
                        )}
                        {initErrors.setUtc && (
                            <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.onErrorContainer }]}>
                                • Time Sync: {initErrors.setUtc}
                            </Text>
                        )}
                        <Text variant="bodySmall" style={[styles.errorHint, { color: theme.colors.onErrorContainer }]}>
                            You can still proceed with preparation, but address these issues before deployment.
                        </Text>
                    </View>
                )}

                {/* Project Association */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                        Project Association
                    </Text>
                    <WWSelect
                        label="Project"
                        value={selectedProject}
                        onChange={handleProjectChange}
                        options={[
                            { label: 'Select a project...', value: '' },
                            // Only show "Create New Project" if there are NO existing projects
                            // OR if the user explicitly needs it (but user said it's not required if others exist)
                            ...((!projects || projects.length === 0) ? [{ label: '➕ Create New Project', value: 'create_new' }] : []),
                            ...(projects?.map((p) => ({ label: p.name, value: p.id })) || []),
                        ]}

                    />
                    {!selectedProject && (
                        <Text variant="bodySmall" style={[styles.warningText, { color: theme.colors.error }]}>
                            ⚠️ Project selection required
                        </Text>
                    )}
                </View>

                {/* Battery Check */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                        Battery Level
                    </Text>
                    {batteryLevel !== null ? (
                        <View style={styles.statusDisplay}>
                            <WWText variant="bodyLarge">🔋 {batteryLevel}%</WWText>
                            <WWText variant="bodySmall" style={styles.statusHint}>
                                {batteryLevel > 30 ? 'Battery level sufficient' : 'Battery level low - charge before deployment'}
                            </WWText>
                        </View>
                    ) : (
                        <WWButton mode="outlined" onPress={handleBatteryCheck}>
                            Check Battery Level
                        </WWButton>
                    )}
                </View>

                {/* SD Card Check */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                        SD Card Status
                    </Text>
                    {sdCardStatus !== null ? (
                        <View style={styles.statusDisplay}>
                            <WWText variant="bodyLarge">
                                💾 {Math.round((sdCardStatus.free / sdCardStatus.total) * 100)}% available of {Math.round(sdCardStatus.total / 1024 / 1024)}GB
                            </WWText>
                            <WWText variant="bodySmall" style={styles.statusHint}>
                                {(sdCardStatus.free / sdCardStatus.total) > 0.1
                                    ? 'SD card has sufficient space'
                                    : 'SD card is nearly full - free up space'}
                            </WWText>
                        </View>
                    ) : (
                        <WWButton mode="outlined" onPress={handleSdCardCheck}>
                            Check SD Card
                        </WWButton>
                    )}
                </View>

                {/* Camera View Test */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                        Camera View Test
                    </Text>
                    <WWText variant="bodySmall" style={styles.sectionDescription}>
                        Capture a test photo to verify camera positioning
                    </WWText>

                    {capturedImageUri && (
                        <View style={styles.imagePreviewContainer}>
                            <Image
                                source={{ uri: capturedImageUri }}
                                style={styles.imagePreview}
                                resizeMode="contain"
                            />
                        </View>
                    )}

                    <WWButton
                        mode="outlined"
                        onPress={handleCameraTest}
                        disabled={sdCardStatus === null || isCapturingImage}
                        loading={isCapturingImage}
                    >
                        {isCapturingImage ? 'Capturing & Downloading...' : (cameraTestPassed ? 'Test Again' : 'Test Camera View')}
                    </WWButton>
                    {sdCardStatus === null && (
                        <Text variant="bodySmall" style={[styles.warningText, { color: theme.colors.error }]}>
                            Check SD card first
                        </Text>
                    )}
                </View>

                {/* BLE Firmware Status */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                        BLE Firmware
                    </Text>

                    {latestBleFirmware && (
                        <WWText variant="bodyMedium" style={{ marginBottom: 8 }}>
                            Latest Available: {latestBleFirmware.version}
                        </WWText>
                    )}

                    {deviceFirmwareVersion && (
                        <WWText variant="bodyMedium" style={{ marginBottom: 8 }}>
                            Device Version: {deviceFirmwareVersion}
                        </WWText>
                    )}

                    {!deviceFirmwareVersion && !isCheckingFirmware && (
                        <WWButton
                            mode="outlined"
                            onPress={handleFirmwareCheck}
                            style={{ marginBottom: 12 }}
                        >
                            Check Firmware Version
                        </WWButton>
                    )}

                    {isCheckingFirmware && (
                        <WWText variant="bodySmall" style={styles.statusHint}>
                            Checking firmware version...
                        </WWText>
                    )}

                    {isUpdatingFirmware ? (
                        <>
                            <WWProgressBar
                                progress={firmwareUpdateProgress / 100}
                                showLabel
                                label={`Updating: ${firmwareUpdateProgress}%`}
                            />
                            <WWText variant="bodySmall" style={styles.statusHint}>
                                Do not disconnect the device...
                            </WWText>
                        </>
                    ) : deviceFirmwareVersion && bleFirmwareUpdateAvailable ? (
                        <>
                            <Text variant="bodySmall" style={[styles.warningText, { color: theme.colors.error }]}>
                                ⚠️ Update available
                            </Text>
                            <WWButton
                                mode="outlined"
                                onPress={handleBleFirmwareUpdate}
                                disabled={batteryLevel !== null && batteryLevel < 30}
                            >
                                Update BLE Firmware
                            </WWButton>
                            {batteryLevel !== null && batteryLevel < 30 && (
                                <Text variant="bodySmall" style={[styles.warningText, { color: theme.colors.error }]}>
                                    Battery must be above 30% to update
                                </Text>
                            )}
                        </>
                    ) : deviceFirmwareVersion && !bleFirmwareUpdateAvailable ? (
                        <Text variant="bodyMedium" style={{ color: theme.colors.primary }}>
                            ✓ Firmware is up to date
                        </Text>
                    ) : null}
                </View>

                {/* AI Model */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                        AI Model
                    </Text>
                    <WWText variant="bodySmall" style={styles.infoText}>
                        🚧 AI Model verification coming soon
                    </WWText>
                    <WWText variant="bodySmall" style={styles.sectionDescription}>
                        For Beta: Manually update AI model via SD card, then use "Verify Model" button to confirm installation.
                    </WWText>
                    <WWButton mode="outlined" disabled>
                        Verify Model (In Progress)
                    </WWButton>
                </View>

                {/* LoRaWAN Verification */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                        LoRaWAN Network
                    </Text>
                    <WWText variant="bodySmall" style={styles.infoText}>
                        🚧 LoRaWAN ping test coming soon
                    </WWText>
                    <WWText variant="bodySmall" style={styles.sectionDescription}>
                        Will use "ping" BLE command to verify network connectivity and display RSSI/SNR signal strength.
                    </WWText>
                    <WWButton mode="outlined" disabled>
                        Ping Network (In Progress)
                    </WWButton>
                </View>

                {/* Finish Preparation Button */}
                <View style={styles.footer}>
                    <WWButton
                        mode="contained"
                        onPress={handleFinish}
                        style={styles.finishButton}
                        disabled={!selectedProject}
                    >
                        Finish Preparation & Testing
                    </WWButton>
                    <WWButton mode="text" onPress={() => navigation.goBack()}>
                        Cancel
                    </WWButton>
                </View>
            </ScrollView>
        </WWScreenView >
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
    },
    header: {
        marginBottom: 24,
    },
    deviceName: {
        marginTop: 8,
        fontWeight: '600',
    },
    deviceId: {
        marginTop: 4,
        opacity: 0.6,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontWeight: '600',
        marginBottom: 16,
    },
    sectionDescription: {
        opacity: 0.6,
        marginBottom: 12,
    },
    statusCheck: {
        fontSize: 24,
    },
    statusDisplay: {
        gap: 4,
        marginTop: 8,
    },
    statusHint: {
        opacity: 0.6,
        marginTop: 4,
        fontSize: 12,
    },
    warningText: {
        marginTop: 8,
    },
    successText: {
        marginTop: 8,
    },
    infoText: {
        marginBottom: 8,
    },
    errorSection: {
        marginBottom: 16,
        padding: 16,
        borderRadius: 8,
        borderLeftWidth: 4,
    },
    errorTitle: {
        marginBottom: 8,
        fontWeight: '600',
    },
    errorText: {
        marginBottom: 4,
    },
    errorHint: {
        marginTop: 8,
        fontStyle: 'italic',
        fontSize: 12,
    },
    footer: {
        marginTop: 16,
        gap: 12,
        marginBottom: 32,
    },
    finishButton: {
        marginTop: 8,
    },
    imagePreviewContainer: {
        marginVertical: 12,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    imagePreview: {
        width: '100%',
        height: 300,
    },
})
