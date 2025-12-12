import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Image } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { Modal, Portal, IconButton, Button, useTheme } from 'react-native-paper'
import { useAppSelector } from '../../redux'
import { useBle } from '../../hooks/useBle'
import { useBleCommands } from '../../hooks/useBleCommands'
import { useGPSLocation } from '../../hooks/useGPSLocation'
import { formatGPSString } from '../../utils/gpsUtils'
import { useCapturePreview } from '../../hooks/useCapturePreview'
import { BleConsoleOutput, ConsoleEntry } from '../../components/BleConsoleOutput'
import { AppParams } from '../types'
import { CommandControlTypes, CommandNames, COMMANDS } from '../../ble/types'
import { ExtendedPeripheral } from '../../redux/slices/devicesSlice'
import { imageReassemblerEmitter } from '../../ble/emitters'
import { CommandReferenceModal } from '../../components/CommandReferenceModal'
import { ImagePreviewModal } from '../../components/ImagePreviewModal'


export const EngineerConsoleScreen = () => {
    const navigation = useNavigation()
    const route = useRoute<any>()
    const theme = useTheme()
    const deviceId = route.params?.deviceId

    const device = useAppSelector(state => state.devices[deviceId || ''])
    const logs = useAppSelector(state => state.logs[deviceId || ''] || "")

    const { write, disconnectDevice, connectDevice } = useBle()
    // Destructure all the new commands
    const {
        getBatteryLevel, checkSdCard, pingNetwork, runSelfTest,
        getDeviceVer, getDeviceName, getDeviceId, getStatus,
        runDfu, runReset, runErase, runDisconnect, setUtc,
        getDevEui, getAppEui, getAppKey, getHeartbeat, flashLed,
        captureTestImage
    } = useBleCommands()

    const [inputText, setInputText] = useState('')
    const [consoleHistory, setConsoleHistory] = useState<ConsoleEntry[]>([])
    const [isConnecting, setIsConnecting] = useState(false)
    const [isHelpVisible, setIsHelpVisible] = useState(false)

    // Use capture preview hook
    const { capturedImageUri: previewImageUri, isCapturing: isWaitingForCapture, startCapture } = useCapturePreview({
        device: device,
        logs: logs,
        write: write,
        onImageReceived: (imageUri) => {
            console.log('[EngineerConsole] Image received:', imageUri)
            setShowPreviewModal(true)
        }
    })

    // GPS location hook for SET_GPS command
    const { location, isGettingLocation, getLocation } = useGPSLocation()

    const lastProcessedLog = React.useRef<string>("")

    // Image preview state
    const [showPreviewModal, setShowPreviewModal] = useState(false)

    // Monitor logs and update console history
    useEffect(() => {
        if (!logs || logs === lastProcessedLog.current) return

        // Split current and previous logs into lines
        const currentLines = logs.split('\n').filter(line => line.trim())
        const previousLines = lastProcessedLog.current.split('\n').filter(line => line.trim())

        // Find only the new lines that weren't in the previous log
        const newLines = currentLines.slice(previousLines.length)

        // Update the last processed log reference
        lastProcessedLog.current = logs

        // Only process if there are actually new lines
        if (newLines.length === 0) return

        // Add new lines to console history
        const newEntries: ConsoleEntry[] = newLines.map(line => ({
            id: Date.now().toString() + Math.random(),
            timestamp: new Date(),
            type: 'response',
            content: line
        }))

        setConsoleHistory(prev => [...prev, ...newEntries])

        // Check for automation triggers in the new lines
        const combinedNewLogs = newLines.join('\n')

        // Automation: Handle Firmware Wakeup Logic
        if (isWaitingForCapture) {
            if (combinedNewLogs.includes("Waking it")) {
                const infoEntry: ConsoleEntry = {
                    id: Date.now().toString(),
                    timestamp: new Date(),
                    type: 'info',
                    content: 'Device waking up... Waiting for firmware to auto-send.'
                }
                setConsoleHistory(prev => {
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
                setConsoleHistory(prev => {
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
        setConsoleHistory(prev => [...prev, newEntry])

        try {
            await write(device, [commandToSend])
        } catch (error) {
            const errorEntry: ConsoleEntry = {
                id: Date.now().toString(),
                timestamp: new Date(),
                type: 'error',
                content: `Error sending command: ${error}`
            }
            setConsoleHistory(prev => [...prev, errorEntry])
        }
    }

    const handleQuickAction = async (action: string) => {
        console.log('[EngineerConsole] handleQuickAction called with:', action)
        if (!device) return

        let commandDisplay = action
        try {
            switch (action) {
                // --- Top Priority ---
                case 'Capture & Download':
                    commandDisplay = 'AI capture 1 1 (Auto-download)'
                    try {
                        console.log('[EngineerConsole] About to call startCapture()')
                        await startCapture()
                        console.log('[EngineerConsole] startCapture() completed')
                    } catch (error) {
                        console.error('[EngineerConsole] startCapture() threw error:', error)
                    }
                    break
                case 'Get Last Image':
                    commandDisplay = 'AI txfile .'
                    await write(device, ['AI txfile .'])
                    break
                case 'Clear':
                    setConsoleHistory([])
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
                case 'Heartbeat': await getHeartbeat(device); break;
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
            setConsoleHistory(prev => [...prev, newEntry])

        } catch (error) {
            const errorEntry: ConsoleEntry = {
                id: Date.now().toString(),
                timestamp: new Date(),
                type: 'error',
                content: `Error executing ${action}: ${error}`
            }
            setConsoleHistory(prev => [...prev, errorEntry])
        }
    }

    const [lastImage, setLastImage] = useState<string | null>(null)
    const [isImageModalVisible, setIsImageModalVisible] = useState(false)


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
            setConsoleHistory(prev => [...prev, entry])
        } catch (error) {
            const entry: ConsoleEntry = {
                id: Date.now().toString(),
                timestamp: new Date(),
                type: 'error',
                content: `Connection failed: ${error}`
            }
            setConsoleHistory(prev => [...prev, entry])
        } finally {
            setIsConnecting(false)
        }
    }

    const onRunHelpCommand = async (cmdName: CommandNames) => { // Added async here
        setIsHelpVisible(false)

        // Handle special command types
        if (cmdName === CommandNames.CAPTURE_PREVIEW) {
            console.log('[EngineerConsole] CAPTURE_PREVIEW clicked, calling startCapture via hook')
            startCapture()
            return
        }

        if (cmdName === CommandNames.SET_GPS) {
            console.log('[EngineerConsole] SET_GPS clicked, getting phone location')
            try {
                // Add timeout to prevent hanging
                const locationPromise = getLocation()
                const timeoutPromise = new Promise<null>((_, reject) =>
                    setTimeout(() => reject(new Error('Location request timed out after 30 seconds')), 30000)
                )

                const loc = await Promise.race([locationPromise, timeoutPromise])

                if (!loc) {
                    console.error('[EngineerConsole] Failed to get GPS location (returned null)')
                    return
                }

                console.log('[EngineerConsole] Location received, formatting GPS string...')
                const gpsString = formatGPSString(loc.latitude, loc.longitude, loc.altitude)
                console.log('[EngineerConsole] GPS string formatted:', gpsString)

                await write(device, [[CommandNames.setgps, { control: CommandControlTypes.WRITE, value: gpsString }]])
                console.log('[EngineerConsole] GPS command sent successfully:', { lat: loc.latitude, lon: loc.longitude, alt: loc.altitude })
            } catch (error) {
                console.error('[EngineerConsole] GPS error:', error)
                Alert.alert('GPS Error', error instanceof Error ? error.message : 'Failed to set GPS location')
            }
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
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Device not found</Text>
            </View>
        )
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
            <View style={styles.header}>
                <View>
                    <Text style={styles.deviceName}>{device.name || 'Unknown Device'}</Text>
                    <Text style={styles.deviceId}>{device.id}</Text>
                </View>
                <View style={styles.statusContainer}>
                    <View style={[styles.statusDot, { backgroundColor: device.connected ? '#4CAF50' : '#F44336' }]} />
                    <Text style={styles.statusText}>{device.connected ? 'Connected' : 'Disconnected'}</Text>
                    <Button
                        mode="outlined"
                        compact
                        onPress={() => setIsHelpVisible(true)}
                        style={{ marginLeft: 8 }}
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

            <Portal>
                <CommandReferenceModal
                    visible={isHelpVisible}
                    onDismiss={() => setIsHelpVisible(false)}
                    onRunCommand={onRunHelpCommand}
                />

                <Modal visible={isImageModalVisible} onDismiss={() => setIsImageModalVisible(false)} contentContainerStyle={styles.modalContent}>
                    <View style={{ backgroundColor: 'white', padding: 20, borderRadius: 8, alignItems: 'center' }}>
                        <Text style={{ fontSize: 18, marginBottom: 10, fontWeight: 'bold' }}>Received Image</Text>
                        {lastImage && (
                            <Image
                                source={{ uri: `data:image/jpeg;base64,${lastImage}` }}
                                style={{ width: 300, height: 300, resizeMode: 'contain', backgroundColor: '#eee' }}
                            />
                        )}
                        <TouchableOpacity
                            style={{ marginTop: 20, padding: 10, backgroundColor: '#2196F3', borderRadius: 5 }}
                            onPress={() => setIsImageModalVisible(false)}
                        >
                            <Text style={{ color: 'white' }}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </Modal>
            </Portal>

            {/* Image Preview Modal */}
            <ImagePreviewModal
                visible={showPreviewModal}
                imageUri={previewImageUri}
                onDismiss={() => setShowPreviewModal(false)}
            />

        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    modalContent: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
    errorText: {
        color: '#F44336',
        fontSize: 16,
    }
})
