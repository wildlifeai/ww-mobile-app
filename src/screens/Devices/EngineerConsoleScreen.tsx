import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Platform, PermissionsAndroid } from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { Modal, Portal, Button, useTheme, Appbar } from 'react-native-paper'
import { useAppSelector } from '../../redux'
import { useExtendedTheme } from '../../theme'
import { BackHandler } from 'react-native'
import { useBle } from '../../hooks/useBle'
import { useBleCommands } from '../../hooks/useBleCommands'
import { KeyboardStickyView } from "react-native-keyboard-controller"
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGPSLocation } from '../../hooks/useGPSLocation'
import { formatGPSString } from '../../utils/gpsUtils'
import { useCapturePreview } from '../../hooks/useCapturePreview'
import { BleConsoleOutput, ConsoleEntry } from '../../components/BleConsoleOutput'
import { CommandControlTypes, CommandNames, COMMANDS } from '../../ble/types'
import { CommandReferenceModal } from '../../components/CommandReferenceModal'
import { ImagePreviewModal } from '../../components/ImagePreviewModal'
import * as FileSystem from 'expo-file-system/legacy'
import { DfuService } from '../../services/DfuService'
import ReferenceDataService from '../../services/ReferenceDataService'
import { getSupabaseClient } from '../../services/supabase'
import { Alert } from 'react-native'
import BleManager, { Peripheral } from 'react-native-ble-manager'
import { log, logError, logWarn } from '../../utils/logger'


/**
 * Scans for the Nordic DFU booth loader which advertises as "DfuTarg"
 * after the device reboots into bootloader mode
 * @param timeoutMs How long to scan before giving up
 * @returns MAC address of the bootloader, or null if not found
 */
const scanForBootloader = (timeoutMs: number = 10000): Promise<string | null> => {
    return new Promise((resolve, reject) => {
        let timeout: ReturnType<typeof setTimeout>

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
                    // Clear timeout
                    if (timeout) clearTimeout(timeout)
                    // Return the address
                    resolve(peripheral.id)
                }
            }
        )

        // Start scanning
        BleManager.scan([], 5, true).catch(err => {
            logError('[scanForBootloader] Scan failed:', err)
            reject(err)
        })

        // Set timeout
        timeout = setTimeout(() => {
            log('[scanForBootloader] Scan timed out')
            BleManager.stopScan().catch(() => { })
            eventEmitter.remove()
            resolve(null)
        }, timeoutMs)


    })
}

export const EngineerConsoleScreen = () => {
    const route = useRoute<any>()
    const navigation = useNavigation<any>()
    const theme = useTheme()
    const { colors } = useExtendedTheme()
    const deviceId = route.params?.deviceId

    const device = useAppSelector(state => state.devices[deviceId || ''])
    const logs = useAppSelector(state => state.logs[deviceId || ''] || [])
    // ... (rest of hooks) ...
    const { write, disconnectDevice, connectDevice } = useBle()
    // Destructure all the new commands
    const {
        getBatteryLevel, checkSdCard, pingNetwork, runSelfTest,
        getDeviceVer, getDeviceName, getDeviceId, getStatus,
        runDfu, runReset, runErase, runDisconnect, setUtc,
        getDevEui, getAppEui, getAppKey, flashLed,
    } = useBleCommands()


    const [inputText, setInputText] = useState('')
    const [consoleHistory, setConsoleHistory] = useState<ConsoleEntry[]>([])
    const [isConnecting, setIsConnecting] = useState(false)
    const [isHelpVisible, setIsHelpVisible] = useState(false)

    // Use capture preview hook
    const { capturedImageUri: previewImageUri, isCapturing: isWaitingForCapture, startCapture } = useCapturePreview({
        device: device,
        write: write,
        onImageReceived: (imageUri) => {
            log('[EngineerConsole] Image received:', imageUri)
            setShowPreviewModal(true)
        }
    })

    const handleBack = useCallback(async () => {
        if (device && device.connected) {
            log('Disconnecting device on back press...')
            try {
                // Determine if we need to call disconnectDevice or if removing from redundancy is enough
                // But disconnectDevice is safe
                await disconnectDevice(device)
            } catch (e) {
                logWarn('Disconnect error:', e)
            }
        }
        // Return to Devices tab
        navigation.navigate('Home', { initialTab: 'devices' })
    }, [device, disconnectDevice, navigation])

    // Handle Hardware Back Button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                handleBack()
                return true
            }
        )
        return () => backHandler.remove()
    }, [handleBack])

    const headerLeft = useCallback(() => (
        <Appbar.BackAction
            iconColor={colors.onBackground}
            onPress={handleBack}
        />
    ), [colors.onBackground, handleBack])

    // Handle Header Back Button
    useLayoutEffect(() => {
        navigation.setOptions({
            headerLeft: headerLeft,
        })
    }, [navigation, headerLeft])

    // GPS location hook for SET_GPS command
    const { getLocation } = useGPSLocation()

    const lastProcessedLogLength = useRef<number>(0)

    // Image preview state
    const [showPreviewModal, setShowPreviewModal] = useState(false)

    // Monitor logs and update console history
    useEffect(() => {
        if (!logs || logs.length === lastProcessedLogLength.current) return

        // Find only the new entries
        const newEntries = logs.slice(lastProcessedLogLength.current)

        // Update the last processed log reference
        lastProcessedLogLength.current = logs.length

        // Only process if there are actually new lines
        if (newEntries.length === 0) return

        // Add new lines to console history
        const historyEntries: ConsoleEntry[] = newEntries.map(entry => {
            let type: 'command' | 'response' | 'error' | 'info' = 'response'
            
            // Map redux log types to console types
            if (entry.type === 'tx') type = 'command'
            else if (entry.type === 'rx') type = 'response'
            else if (entry.type === 'error') type = 'error'
            else if (entry.type === 'info') type = 'info'
            
            return {
                id: Date.now().toString() + Math.random(),
                timestamp: new Date(entry.timestamp),
                type,
                content: entry.content
            }
        })

        setConsoleHistory((prev: ConsoleEntry[]) => [...prev, ...historyEntries])

        // Check for automation triggers in the new lines
        const combinedNewLogs = newEntries.map(e => e.content).join('\n')

        // Automation: Handle Firmware Wakeup Logic
        if (isWaitingForCapture) {
            if (combinedNewLogs.includes("Waking it")) {
                const infoEntry: ConsoleEntry = {
                    id: Date.now().toString(),
                    timestamp: new Date(),
                    type: 'info',
                    content: 'Device waking up... Waiting for firmware to auto-send.'
                }
                setConsoleHistory((prev: ConsoleEntry[]) => {
                    const last = prev[prev.length - 1]
                    if (last && last.content === infoEntry.content) return prev
                    return [...prev, infoEntry]
                })
            }

            if (combinedNewLogs.includes("Discarding message")) {
                const infoEntry: ConsoleEntry = {
                    id: Date.now().toString(),
                    timestamp: new Date(),
                    type: 'info',
                    content: 'Command queued. Waiting...'
                }
                setConsoleHistory((prev: ConsoleEntry[]) => {
                    const last = prev[prev.length - 1]
                    if (last && last.content === infoEntry.content) return prev
                    return [...prev, infoEntry]
                })
            }
        }

    }, [logs, isWaitingForCapture, device, write])

    const handleSend = async (cmd?: string) => {
        const commandToSend = cmd || inputText.trim()
        if (!commandToSend || !device) return

        if (!cmd) setInputText('')

        // Add to history
        const newEntry: ConsoleEntry = {
            id: Date.now().toString(),
            timestamp: new Date(),
            type: 'command',
            content: commandToSend
        }
        setConsoleHistory((prev: ConsoleEntry[]) => [...prev, newEntry])

        try {
            await write(device, [commandToSend])
        } catch (error) {
            const errorEntry: ConsoleEntry = {
                id: Date.now().toString(),
                timestamp: new Date(),
                type: 'error',
                content: `Error sending command: ${error}`
            }
            setConsoleHistory((prev: ConsoleEntry[]) => [...prev, errorEntry])
        }
    }

    const handleQuickAction = async (action: string) => {
        log('[EngineerConsole] handleQuickAction called with:', action)
        if (!device) return

        let commandDisplay = action
        try {
            switch (action) {
                // --- Top Priority ---
                case 'Capture & Download':
                    commandDisplay = 'AI capture 1 1 (Auto-download)'
                    try {
                        log('[EngineerConsole] About to call startCapture()')
                        await startCapture()
                        log('[EngineerConsole] startCapture() completed')
                    } catch (error) {
                        logError('[EngineerConsole] startCapture() threw error:', error)
                    }
                    break
                case 'Get Last Image':
                    commandDisplay = 'AI txfile .'
                    await write(device, ['AI txfile .'])
                    break
                case 'Clear':
                    setConsoleHistory((_prev: ConsoleEntry[]) => [])
                    return

                // --- System ---
                case 'Sync Time': await setUtc(device); break;
                case 'DFU': await runDfu(device); break;
                case 'Reset': await runReset(device); break;
                case 'Erase': await runErase(device); break;
                case 'Disconnect': await runDisconnect(device); break;

                // --- Device ---
                case 'ID': await getDeviceId(device); break;
                case 'Ver': await getDeviceVer(device); break;
                case 'Name': await getDeviceName(device); break;
                case 'Battery': await getBatteryLevel(device); break;
                case 'Status': await getStatus(device); break;

                // --- LoRaWAN ---
                case 'Ping': await pingNetwork(device); break;
                case 'Get DevEUI': await getDevEui(device); break;
                case 'Get AppEUI': await getAppEui(device); break;
                case 'Get AppKey': await getAppKey(device); break;

                // --- AI ---
                case 'AI Info': await checkSdCard(device); break;

                // --- Debug ---
                case 'Self Test': await runSelfTest(device); break;
                case 'Flash Red': await flashLed(device, 'red', 1000, 3); break;
                case 'Flash Green': await flashLed(device, 'green', 1000, 3); break;
                case 'Flash Blue': await flashLed(device, 'blue', 1000, 3); break;



                default:
                    return
            }

            const newEntry: ConsoleEntry = {
                id: Date.now().toString(),
                timestamp: new Date(),
                type: 'command',
                content: `[Action] ${commandDisplay}`
            }
            setConsoleHistory((prev: ConsoleEntry[]) => [...prev, newEntry])

        } catch (error) {
            const errorEntry: ConsoleEntry = {
                id: Date.now().toString(),
                timestamp: new Date(),
                type: 'error',
                content: `Error executing ${action}: ${error}`
            }
            setConsoleHistory((prev: ConsoleEntry[]) => [...prev, errorEntry])
        }
    }



    const handleConnect = async () => {
        if (!device) return
        setIsConnecting(true)
        try {
            await connectDevice(device)
            const entry: ConsoleEntry = {
                id: Date.now().toString(),
                timestamp: new Date(),
                type: 'info',
                content: 'Connected to device'
            }
            setConsoleHistory((prev: ConsoleEntry[]) => [...prev, entry])
        } catch (error) {
            const entry: ConsoleEntry = {
                id: Date.now().toString(),
                timestamp: new Date(),
                type: 'error',
                content: `Connection failed: ${error}`
            }
            setConsoleHistory((prev: ConsoleEntry[]) => [...prev, entry])
        } finally {
            setIsConnecting(false)
        }
    }

    const onRunHelpCommand = async (cmdName: CommandNames) => { // Added async here
        setIsHelpVisible(false)

        // Handle special command types
        if (cmdName === CommandNames.CAPTURE_PREVIEW) {
            log('[EngineerConsole] CAPTURE_PREVIEW clicked, calling startCapture via hook')
            startCapture()
            return
        }

        if (cmdName === CommandNames.SET_GPS) {
            log('[EngineerConsole] SET_GPS clicked, getting phone location')
            try {
                // Add timeout to prevent hanging
                const locationPromise = getLocation()
                const timeoutPromise = new Promise<null>((_, reject) =>
                    setTimeout(() => reject(new Error('Location request timed out after 30 seconds')), 30000)
                )

                const loc = await Promise.race([locationPromise, timeoutPromise])

                if (!loc) {
                    logError('[EngineerConsole] Failed to get GPS location (returned null)')
                    return
                }

                log('[EngineerConsole] Location received, formatting GPS string...')
                const gpsString = formatGPSString(loc.latitude, loc.longitude, loc.altitude)
                log('[EngineerConsole] GPS string formatted:', gpsString)

                await write(device, [[CommandNames.setgps, { control: CommandControlTypes.WRITE, value: gpsString }]])
                log('[EngineerConsole] GPS command sent successfully:', { lat: loc.latitude, lon: loc.longitude, alt: loc.altitude })
            } catch (error) {
                logError('[EngineerConsole] GPS error:', error)
                Alert.alert('GPS Error', error instanceof Error ? error.message : 'Failed to set GPS location')
            }
            return
        }

        if (cmdName === CommandNames.UPDATE_BLE_FIRMWARE) {
            Alert.alert(
                'Update BLE Firmware',
                'This will download the latest firmware and flash it to the device. Ensure battery > 30%. Continue?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Update',
                        onPress: async () => {
                            try {
                                const entry: ConsoleEntry = {
                                    id: Date.now().toString(),
                                    timestamp: new Date(),
                                    type: 'info',
                                    content: 'Starting Firmware Update...'
                                }
                                setConsoleHistory((prev: ConsoleEntry[]) => [...prev, entry])

                                // 1. Get latest firmware info
                                const latestBleFirmware = await ReferenceDataService.getLatestFirmware('ble')
                                if (!latestBleFirmware) throw new Error("No firmware found on server")

                                // 2. Download
                                const supabase = getSupabaseClient()
                                const { data, error } = await supabase.storage
                                    .from('firmware')
                                    .download(latestBleFirmware.locationPath)



                                if (error || !data) throw new Error(`Download failed: ${error?.message}`)

                                // 3. Save to file
                                const localPath = FileSystem.cacheDirectory + 'last_image.jpg_' + Date.now() + '.zip'
                                const reader = new FileReader()
                                reader.readAsDataURL(data)
                                reader.onloadend = async () => {
                                    const base64data = reader.result as string
                                    const base64Content = base64data.split(',')[1]

                                    await FileSystem.writeAsStringAsync(
                                        localPath,
                                        base64Content,
                                        { encoding: FileSystem.EncodingType.Base64, }
                                    )



                                    // 4. Trigger DFU Mode on device
                                    setConsoleHistory((prev: ConsoleEntry[]) => [...prev, {
                                        id: Date.now().toString(),
                                        timestamp: new Date(),
                                        type: 'info',
                                        content: `Sending 'dfu' command to switch mode...`
                                    }])

                                    // Send DFU command and wait for disconnect
                                    try {
                                        await write(device, ["dfu"])
                                        log('[EngineerConsole] DFU command sent, waiting for firmware to process...')

                                        // CRITICAL: Wait for firmware to receive and process the 'dfu' command
                                        // The firmware needs to set the dfuRequest flag before we disconnect
                                        await new Promise(resolve => setTimeout(resolve, 500))

                                        log('[EngineerConsole] Disconnecting to trigger DFU mode switch...')
                                        // CRITICAL: Device waits for disconnect to enter DFU mode
                                        await disconnectDevice(device)

                                        // Wait enough time for device to reboot into bootloader
                                        await new Promise(resolve => setTimeout(resolve, 5000))
                                    } catch (err) {
                                        logWarn("Failed to send DFU command or disconnect, attempting update anyway", err)
                                    }

                                    // 5. Request notification permission (required for foreground service on Android 14+)
                                    if (Platform.OS === 'android' && Platform.Version >= 33) {
                                        try {
                                            const granted = await PermissionsAndroid.request(
                                                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
                                            )
                                            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                                                throw new Error('Notification permission required for firmware update')
                                            }
                                            log('[EngineerConsole] Notification permission granted')
                                        } catch (permErr) {
                                            throw new Error(`Permission error: ${permErr}`)
                                        }
                                    }

                                    // 6. Scan for bootloader ("DfuTarg")
                                    setConsoleHistory((prev: ConsoleEntry[]) => [...prev, {
                                        id: Date.now().toString(),
                                        timestamp: new Date(),
                                        type: 'info',
                                        content: `Scanning for bootloader...`
                                    }])

                                    let bootloaderAddress: string | null = null
                                    try {
                                        bootloaderAddress = await scanForBootloader(10000) // 10s scan
                                        if (bootloaderAddress) {
                                            log(`[EngineerConsole] Found bootloader at: ${bootloaderAddress}`)
                                            setConsoleHistory((prev: ConsoleEntry[]) => [...prev, {
                                                id: Date.now().toString(),
                                                timestamp: new Date(),
                                                type: 'info',
                                                content: `Found bootloader: ${bootloaderAddress}`
                                            }])
                                        } else {
                                            throw new Error('Bootloader not found after scanning')
                                        }
                                    } catch (scanErr) {
                                        throw new Error(`Failed to find bootloader: ${scanErr}`)
                                    }

                                    // 7. Start DFU with bootloader address
                                    setConsoleHistory((prev: ConsoleEntry[]) => [...prev, {
                                        id: Date.now().toString(),
                                        timestamp: new Date(),
                                        type: 'info',
                                        content: `Starting DFU transfer to ${bootloaderAddress}...`
                                    }])

                                    await DfuService.startDFU(
                                        bootloaderAddress,
                                        localPath,
                                        (progress) => {
                                            if (progress % 10 === 0) { // Log every 10%
                                                setConsoleHistory((prev: ConsoleEntry[]) => [...prev, {
                                                    id: Date.now().toString(),
                                                    timestamp: new Date(),
                                                    type: 'info',
                                                    content: `DFU Progress: ${progress}%`
                                                }])
                                            }
                                        }
                                    )

                                    // 6. Update DB
                                    // Use watermelonDB directly since we have the ID but need the record
                                    // Actually we can't easily update the Redux device in DB without fetching the Model first.
                                    // But we can trigger a sync or just rely on next connect.
                                    setConsoleHistory((prev: ConsoleEntry[]) => [...prev, {
                                        id: Date.now().toString(),
                                        timestamp: new Date(),
                                        type: 'info',
                                        content: `Firmware Update Complete!`
                                    }])

                                    await FileSystem.deleteAsync(localPath, { idempotent: true })
                                    Alert.alert('Success', 'Firmware updated successfully')
                                }


                            } catch (e) {
                                const errorEntry: ConsoleEntry = {
                                    id: Date.now().toString(),
                                    timestamp: new Date(),
                                    type: 'error',
                                    content: `DFU Failed: ${e}`
                                }
                                setConsoleHistory((prev: ConsoleEntry[]) => [...prev, errorEntry])
                                Alert.alert('Error', `Update failed: ${e}`)
                            }
                        }
                    }
                ]
            )
            return
        }

        if (cmdName === CommandNames.CLEAR_CONSOLE) {
            handleQuickAction('Clear')
            return
        }


        // Default: execute the command normally
        const cmd = COMMANDS[cmdName]
        if (!cmd) return

        if (cmd.writeCommand) {
            handleSend(cmd.writeCommand())
        } else if (cmd.readCommand) {
            handleSend(cmd.readCommand)
        }
    }


    if (!device) {
        return (
            <SafeAreaView style={styles.centerContainer} edges={['top', 'bottom']}>
                <Text style={styles.errorText}>Device not found</Text>
            </SafeAreaView>
        )
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.deviceName}>{device.name || 'Unknown Device'}</Text>
                    <Text style={styles.deviceId}>{device.id}</Text>
                </View>
                <View style={styles.statusContainer}>
                    <View style={[styles.statusDot, device.connected ? styles.statusDotConnected : styles.statusDotDisconnected]} />
                    <Text style={styles.statusText}>{device.connected ? 'Connected' : 'Disconnected'}</Text>
                    <Button
                        mode="outlined"
                        compact
                        onPress={() => setIsHelpVisible(true)}
                        style={styles.helpButton}
                    >
                        Command Reference
                    </Button>
                </View>
            </View>

            {!device.connected && (
                <Button
                    mode="contained"
                    onPress={handleConnect}
                    disabled={isConnecting}
                    style={styles.connectButton}
                    buttonColor={theme.colors.primary}
                    textColor="#FFFFFF"
                    loading={isConnecting}
                >
                    Connect to Console
                </Button>
            )}

            <View style={styles.consoleContainer}>
                <BleConsoleOutput entries={consoleHistory} />
            </View>

            {/* Input Container - Sticky to Keyboard */}
            <KeyboardStickyView offset={{ closed: 0, opened: 0 }}> 
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Enter command..."
                        placeholderTextColor="#666"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={device.connected}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, (!inputText.trim() || !device.connected) && styles.sendButtonDisabled]}
                        onPress={() => handleSend()}
                        disabled={!inputText.trim() || !device.connected}
                    >
                        <Ionicons name="send" size={20} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </KeyboardStickyView>

            <Portal>
                <CommandReferenceModal
                    visible={isHelpVisible}
                    onDismiss={() => setIsHelpVisible(false)}
                    onRunCommand={onRunHelpCommand}
                />

            </Portal>

            <ImagePreviewModal
                visible={showPreviewModal}
                imageUri={previewImageUri}
                onDismiss={() => setShowPreviewModal(false)}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    deviceName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    deviceId: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusDotConnected: {
        backgroundColor: '#4CAF50',
    },
    statusDotDisconnected: {
        backgroundColor: '#F44336',
    },
    statusText: {
        fontSize: 14,
        color: '#666',
    },
    connectButton: {
        backgroundColor: '#2196F3',
        padding: 12,
        margin: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    connectButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    consoleContainer: {
        flex: 1,
        padding: 16,
    },
    quickActions: {
        paddingHorizontal: 16,
        paddingBottom: 8,
        height: 48,
        flexGrow: 0,
    },
    actionChip: {
        backgroundColor: '#E0E0E0',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginRight: 8,
    },
    actionText: {
        fontSize: 12,
        color: '#333',
        fontWeight: '500',
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#FFF',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        fontSize: 16,
        color: '#333',
        marginRight: 12,
        height: 40,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2196F3',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#BDBDBD',
    },
    helpButton: {
        marginLeft: 8,
    },
    imageModalContainer: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    imageModalContent: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 8,
        alignItems: 'center'
    },
    imageModalTitle: {
        fontSize: 18,
        marginBottom: 10,
        fontWeight: 'bold'
    },
    imageModalCloseButton: {
        marginTop: 20,
        padding: 10,
        backgroundColor: '#2196F3',
        borderRadius: 5
    },
    imageModalCloseText: {
        color: 'white'
    },
    errorText: {
        color: '#F44336',
        fontSize: 16,
    }
})
