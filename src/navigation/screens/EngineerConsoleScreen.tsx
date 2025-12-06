import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useAppSelector } from '../../redux'
import { useBle } from '../../hooks/useBle'
import { useBleCommands } from '../../hooks/useBleCommands'
import { BleConsoleOutput, ConsoleEntry } from '../../components/BleConsoleOutput'
import { AppParams } from '../types'
import { CommandControlTypes, CommandNames } from '../../ble/types'
import { ExtendedPeripheral } from '../../redux/slices/devicesSlice'

export const EngineerConsoleScreen = () => {
    const navigation = useNavigation()
    const route = useRoute<AppParams<'EngineerConsole'>>()
    const { deviceId } = route.params

    const device = useAppSelector(state => state.devices[deviceId])
    const logs = useAppSelector(state => state.logs[deviceId] || "")

    const { write, disconnectDevice, connectDevice } = useBle()
    const { getBatteryLevel, checkSdCard, pingNetwork, runSelfTest } = useBleCommands()

    const [inputText, setInputText] = useState('')
    const [consoleHistory, setConsoleHistory] = useState<ConsoleEntry[]>([])
    const [isConnecting, setIsConnecting] = useState(false)

    // Monitor logs and update console history
    useEffect(() => {
        if (!logs) return

        // Simple check to avoid duplicate processing would be needed in a real app
        // For now, we'll just append the latest log chunk if it's new
        // This is a simplification - robust log parsing is in src/ble/parser.ts
        // Here we just want to show raw output

        const newEntry: ConsoleEntry = {
            id: Date.now().toString() + Math.random(),
            timestamp: new Date(),
            type: 'response',
            content: logs
        }

        // Only add if content is not empty and different from last response
        // (This logic might need refinement based on how logs slice is updated)
        setConsoleHistory(prev => {
            const last = prev[prev.length - 1]
            if (last && last.type === 'response' && last.content === logs) return prev
            return [...prev, newEntry]
        })

    }, [logs])

    const handleSend = async () => {
        if (!inputText.trim() || !device) return

        const command = inputText.trim()
        setInputText('')

        // Add to history
        const newEntry: ConsoleEntry = {
            id: Date.now().toString(),
            timestamp: new Date(),
            type: 'command',
            content: command
        }
        setConsoleHistory(prev => [...prev, newEntry])

        try {
            // Send raw string command
            await write(device, [command])
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
        if (!device) return

        let commandDisplay = action
        try {
            switch (action) {
                case 'Battery':
                    await getBatteryLevel(device)
                    break
                case 'SD Card':
                    await checkSdCard(device)
                    break
                case 'Ping':
                    await pingNetwork(device)
                    break
                case 'Self Test':
                    await runSelfTest(device)
                    break
                case 'Clear':
                    setConsoleHistory([])
                    return
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

    const handleDisconnect = async () => {
        if (!device) return
        try {
            await disconnectDevice(device)
            const entry: ConsoleEntry = {
                id: Date.now().toString(),
                timestamp: new Date(),
                type: 'info',
                content: 'Disconnected from device'
            }
            setConsoleHistory(prev => [...prev, entry])
        } catch (error) {
            console.error(error)
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
                </View>
            </View>

            {!device.connected && (
                <TouchableOpacity
                    style={styles.connectButton}
                    onPress={handleConnect}
                    disabled={isConnecting}
                >
                    {isConnecting ? (
                        <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                        <Text style={styles.connectButtonText}>Connect to Console</Text>
                    )}
                </TouchableOpacity>
            )}

            <View style={styles.consoleContainer}>
                <BleConsoleOutput entries={consoleHistory} />
            </View>

            <View style={styles.quickActions}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {['Battery', 'SD Card', 'Ping', 'Self Test', 'Clear'].map((action) => (
                        <TouchableOpacity
                            key={action}
                            style={styles.actionChip}
                            onPress={() => handleQuickAction(action)}
                            disabled={!device.connected && action !== 'Clear'}
                        >
                            <Text style={styles.actionText}>{action}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
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
                    onPress={handleSend}
                    disabled={!inputText.trim() || !device.connected}
                >
                    <Ionicons name="send" size={20} color="#FFF" />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
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
        height: 40,
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
