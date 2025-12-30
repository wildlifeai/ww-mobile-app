import React, { useState, useEffect, useCallback, useRef } from 'react'
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

    // Ref to track DFU in progress (prevents Connection Lost alert during expected disconnection)
    const isDfuInProgress = useRef(false)
    // Ref to track intentional navigation (prevents Connection Lost alert when finishing preparation)
    const isNavigatingAway = useRef(false)

    // BLE command hooks
    const { getBatteryLevel, checkSdCard, captureTestImage, setUtc, setOperationalParam, getDeviceVer, disableCamera, runDisconnect, runDfu, runSelfTest, flashLed, clearGpsLocation, setDeploymentIdAsOps } = useBleCommands()
    const { write } = useBle()
    const bleDevice = useAppSelector((state) => state.devices[bleDeviceId])
    const logs = useAppSelector(state => state.logs[bleDeviceId || ''] || [])

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
    // Track whether BLE initialization has run
    const [isInitializing, setIsInitializing] = useState(false)
    const hasInitialized = useRef(false)

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

                if (device && latest && device.bleFirmwareId) {
                    // Check based on DB record first if available (fallback)
                    const updateAvailable = device.bleFirmwareId !== latest.id
                    // ... logic continues ...
                }
            } catch (error) {
                console.error('[PrepareTest] Failed to check BLE firmware:', error)
            }
        }

        checkBleFirmware()
    }, [device, bleDevice?.connected]) // Re-run when device connects

    // Cleanup: Disconnect on unmount ONLY if we are not intentionally navigating to another flow
    useEffect(() => {
        return () => {
            // Use ref to check if navigating away
            if (bleDevice && bleDevice.connected && !isNavigatingAway.current) {
                console.log('[PrepareTest] Unmounting and NOT navigating away - Disconnecting device...')
                runDisconnect(bleDevice).catch(err => console.error('[PrepareTest] Failed to disconnect on unmount:', err))
            } else {
                console.log('[PrepareTest] Unmounting but navigation is active (or device disconnected) - Skipping disconnect')
            }
        }
    }, [])

    // Use ref to track latest logs for the robust initialization sequence
    const logsRef = useRef(logs)
    useEffect(() => {
        logsRef.current = logs
    }, [logs])

    /**
     * Helper to wait for a specific log response since a given offset (or start of call)
     * This is much more robust than arbitrary timeouts and avoids missing bursts.
     */
    const waitForLogMatch = useCallback(async (regex: RegExp, timeoutMs: number = 5000, customOffset?: number): Promise<RegExpMatchArray> => {
        console.log(`[PrepareTest] Waiting for log match: ${regex} (timeout ${timeoutMs}ms)`)
        const startTime = Date.now()
        // Capture initial log length to only look at NEW logs (unless offset provided)
        const startOffset = customOffset !== undefined ? customOffset : logsRef.current.length

        return new Promise((resolve, reject) => {
            const check = () => {
                // Reconstruct string from entries since startOffset
                const sectionLogs = logsRef.current.slice(startOffset).map(e => e.content).join('')
                const match = sectionLogs.match(regex)
                if (match) {
                    console.log(`[PrepareTest] Found log match for: ${regex}`)
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

    // BLE Initialization on mount: selftest, setUtc, clear deployment ID
    useEffect(() => {
        const runBleInitialization = async () => {
            if (!bleDevice || !bleDevice.connected || hasInitialized.current) return

            hasInitialized.current = true
            setIsInitializing(true)
            console.log('[PrepareTest] Running BLE initialization sequence...')

            const errors: { setUtc?: string } = {}

            // 0. Wait for HiMAX processor to boot + verify BLE communication
            try {
                console.log('[PrepareTest] Waiting for HiMAX processor to boot after connection...')
                await new Promise(r => setTimeout(r, 2000))  // 2s for HiMAX boot

                console.log('[PrepareTest] Verifying BLE communication with version check...')
                await getDeviceVer(bleDevice)  // Non-AI command to verify Nordic BLE is responsive
                await new Promise(r => setTimeout(r, 500))  // Let it process
            } catch (err) {
                console.warn('[PrepareTest] Initial BLE verification had issues:', err)
            }

            // 1. Set UTC time (FIRST ACTION)
            let utcSuccess = false
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    const preUtcOffset = logsRef.current.length
                    console.log(`[PrepareTest] Setting UTC time (Attempt ${attempt})...`)
                    await setUtc(bleDevice)
                    // Firmware can take ~1600ms to process. We use 6000ms timeout for safety.
                    await waitForLogMatch(/RTC set to|UTC is:/, 6000, preUtcOffset)
                    console.log('[PrepareTest] UTC time set')
                    utcSuccess = true
                    // Vital delay: Wait 500ms after time sync log match (bus is free)
                    await new Promise(r => setTimeout(r, 500))
                    break // Success, exit loop
                } catch (err) {
                    console.warn(`[PrepareTest] SET_UTC attempt ${attempt} failed:`, err)
                    if (attempt === 1) {
                        console.log('[PrepareTest] Retrying SET_UTC - attempting to proceed...')
                        await new Promise(r => setTimeout(r, 1000))
                    } else {
                        console.error('[PrepareTest] Failed to set UTC:', err)
                        errors.setUtc = err instanceof Error ? err.message : 'Unknown error'
                    }
                }
            }

            // 2. Quiesce Device (Ensure Force Stop)
            // Explicitly disable camera and motion/timelapse intervals to stop the "MD" loops
            try {
                console.log('[PrepareTest] Enforcing quiet state (Disabling Camera & Motion)...')
                await updateDeviceSettings({
                    cameraEnabled: false,
                    motionDetectInterval: 0,
                    timelapseInterval: 0
                })
                // Wait for settings to apply
                await new Promise(r => setTimeout(r, 500))
                console.log('[PrepareTest] Device stabilized.')
            } catch (err) {
                console.warn('[PrepareTest] Failed to quiesce device:', err)
            }

            // 3. Clear deployment ID
            try {
                console.log('[PrepareTest] Clearing deployment ID...')
                await setDeploymentIdAsOps(bleDevice, null)
                console.log('[PrepareTest] Deployment ID cleared')
            } catch (err) {
                console.error('[PrepareTest] Failed to clear deployment ID:', err)
            }

            // 4. Clear GPS location (Always run this, independent of ID clear success)
            try {
                console.log('[PrepareTest] Clearing GPS location...')
                await clearGpsLocation(bleDevice)
                // Wait for confirmation if possible (setgps usually echo's)
                await waitForLogMatch(/Location is:|setgps/i, 1000).catch(() => {
                    // Ignore timeout for GPS clear as it's non-critical if echo is missing
                    console.log('[PrepareTest] GPS clear confirmation missing, but command sent.')
                })
                console.log('[PrepareTest] GPS location clear command sequence finished')
            } catch (err) {
                console.error('[PrepareTest] Failed to clear GPS location:', err)
            }

            // Set any errors to trigger warning display
            if (errors.setUtc) {
                setInitErrors(errors)
            }

            setIsInitializing(false)
            console.log('[PrepareTest] BLE initialization complete')
        }

        runBleInitialization()
    }, [bleDevice?.connected])

    // Parse BLE logs for command responses

    // Helper to compare version strings: "00.13.00" vs "0.13.0"
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
        const totalMatch = recentLogsString.match(/(\d+)\s*[Kk]\s*total\s*drive\s*space/i)
        const availMatch = recentLogsString.match(/(\d+)\s*[Kk]\s*available/i)

        if (recentLogsString.length > 0 && !sdCardStatus && (recentLogsString.toLowerCase().includes('total') || recentLogsString.toLowerCase().includes('available'))) {
            // console.log('[PrepareTest] SD keywords found?')
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
        const versionMatch = recentLogsString.match(/(?:V|Ver|Version|BLE)[:\s]+v?(\d+\.\d+\.\d+)/i)
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
            // Skip check if DFU is in progress (device disconnects during DFU)
            // Skip check if navigating away (user completed preparation)
            // Skip check if initializing (BLE commands in progress)
            if (!loading && bleDevice && !isDfuInProgress.current && !isNavigatingAway.current && !isInitializing) {
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
                                    d.bleFirmwareId = latestBleFirmware.id
                                })
                            })

                            setFirmwareUpdateProgress(100)
                            Alert.alert('Update Complete', 'Device is rebooting. Verifying new version...')

                            // Reset state for verification
                            setDeviceFirmwareVersion(null)
                            setIsCheckingFirmware(true)
                            setBleFirmwareUpdateAvailable(false) // Optimistically hide until verified

                            // Wait for reboot (approx 5-8s)
                            console.log('[PrepareTest] Waiting for device reboot...')
                            await new Promise(r => setTimeout(r, 8000))

                            // Reconnect and check
                            // We need to trigger the hook's scan/connect logic
                            // But since we are likely disconnected, we can try to "nudge" it or manually connect
                            console.log('[PrepareTest] Attempting to reconnect for verification...')
                            if (bleDevice) {
                                // Manual connect attempt
                                try {
                                    // Make sure we're disconnected first to clean up
                                    await runDisconnect(bleDevice).catch(() => { })

                                    // Reconnect
                                    // The main useBle hook needs to handle this, but we can try invoking connectDevice from here 
                                    // if we had access to it. Since we only have 'write', we rely on the screen's focus effect or manual trigger.
                                    // For now, let's trigger the handleFirmwareCheck which has safety checks

                                    // We need to actually perform the connection here since we are in a function
                                    // Using a helper or just letting the user press "Test Again" if auto-reconnect fails
                                    // But let's try to simulate the flow:

                                    Alert.alert(
                                        'Verification Required',
                                        'Please ensure the device has restarted (green LED flashing). If it is not connected, tap "Test Again" or go back and reconnect.',
                                        [
                                            {
                                                text: 'Verify Now',
                                                onPress: () => handleFirmwareCheck()
                                            }
                                        ]
                                    )
                                } catch (reconnectErr) {
                                    console.warn('[PrepareTest] Reconnect failed:', reconnectErr)
                                }
                            }

                        } catch (error) {
                            console.error('[PrepareTest] Firmware update failed:', error)
                            Alert.alert('Update Failed', error instanceof Error ? error.message : 'Unknown error')
                            setFirmwareUpToDate(false) // Assume failed
                        } finally {
                            setIsUpdatingFirmware(false)
                            isDfuInProgress.current = false // Re-enable connection monitoring
                        }
                    }
                }
            ]
        )
    }

    // Separate effect for comparison to ensure it runs whenever either value changes
    useEffect(() => {
        if (deviceFirmwareVersion && latestBleFirmware) {
            console.log('[PrepareTest] Comparing versions:', { device: deviceFirmwareVersion, latest: latestBleFirmware.version })

            // Use semantic comparison
            const comparison = compareVersions(deviceFirmwareVersion, latestBleFirmware.version)
            // If device (-1) < latest (0) -> update available
            const updateAvailable = comparison < 0

            console.log('[PrepareTest] Firmware status:', { updateAvailable, comparison })

            setBleFirmwareUpdateAvailable(updateAvailable)
            setFirmwareUpToDate(!updateAvailable)
        }
    }, [deviceFirmwareVersion, latestBleFirmware])

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
            setLoading(true)
            const errors: string[] = []

            // 1. Set UTC time (FIRST ACTION)
            let utcSuccess = false
            // Retry loop: The first attempt might be corrupted by a delayed "selfTest" packet
            // from the previous step. If that happens, the second attempt will succeed.
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    const preUtcOffset = logsRef.current.length
                    console.log(`[PrepareTest] Setting UTC time (Attempt ${attempt})...`)
                    await setUtc(bleDevice)
                    // Robust wait: 6000ms timeout
                    await waitForLogMatch(/RTC set to|UTC is:/, 6000, preUtcOffset)
                    console.log('[PrepareTest] SET_UTC completed')
                    utcSuccess = true

                    // Wait 500ms to clear I2C bus buffer
                    await new Promise(r => setTimeout(r, 500))
                    break
                } catch (error) {
                    console.warn(`[PrepareTest] SET_UTC attempt ${attempt} failed:`, error)
                    if (attempt === 1) {
                        console.log('[PrepareTest] Retrying SET_UTC to clear potential buffer corruption...')
                        await new Promise(r => setTimeout(r, 1000))
                    } else {
                        console.error('[PrepareTest] SET_UTC finally failed:', error)
                        errors.push('Failed to sync device time')
                    }
                }
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
                    // Redundant disableCamera removed - updateDeviceSettings handles cameraEnabled state

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

                await DevicePreparationService.completePreparation(preparation.id, isReady, selectedProject)

                Alert.alert(
                    'Preparation Complete',
                    'Device ready to be deployed',

                    [{
                        text: 'OK',
                        onPress: async () => {
                            // Check for nextRoute (start deployment flow)
                            const { nextRoute } = route.params || {}

                            // Mark as navigating away to suppress Connection Lost alert AND cleanup disconnect
                            isNavigatingAway.current = true

                            // Flash green LED 2x to confirm preparation complete
                            if (bleDevice) {
                                console.log('[PrepareTest] Flashing green LED to confirm preparation...')
                                try {
                                    await flashLed(bleDevice, 'green', 500, 2)
                                    await new Promise(r => setTimeout(r, 1200)) // Wait for flashes to complete
                                } catch (e) {
                                    console.warn('[PrepareTest] Failed to flash LED:', e)
                                }

                                // Disconnect BLE ONLY if we are NOT proceeding to deployment
                                if (!nextRoute) {
                                    console.log('[PrepareTest] Finishing (No next route) - Disconnecting device...')
                                    await runDisconnect(bleDevice).catch(e => console.error('Failed to disconnect:', e))
                                } else {
                                    console.log('[PrepareTest] Finishing with next route - KEEPING connection alive for:', nextRoute)
                                }
                            }

                            if (nextRoute) {
                                (navigation as any).navigate(nextRoute, {
                                    devicePreparationId: preparation.id,
                                    deviceId: deviceId,
                                    bleDeviceId: bleDeviceId
                                })
                            } else {
                                // Default: Navigate to Devices tab
                                (navigation as any).navigate("Home", { initialTab: "devices" })
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
                        <View>
                            <View style={styles.statusDisplay}>
                                <WWText variant="bodyLarge">🔋 {batteryLevel}%</WWText>
                                <WWText variant="bodySmall" style={styles.statusHint}>
                                    {batteryLevel > 30 ? 'Battery level sufficient' : 'Battery level low - charge before deployment'}
                                </WWText>
                            </View>
                            <WWButton mode="outlined" onPress={handleBatteryCheck} style={{ marginTop: 8 }}>
                                Check Again
                            </WWButton>
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
                        <View>
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
                            <WWButton mode="outlined" onPress={handleSdCardCheck} style={{ marginTop: 8 }}>
                                Check Again
                            </WWButton>
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
                            >
                                Update BLE Firmware
                            </WWButton>
                            {batteryLevel !== null && batteryLevel < 30 && (
                                <Text variant="bodySmall" style={[styles.warningText, { color: theme.colors.error }]}>
                                    ⚠️ Battery level low - update at your own risk
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
