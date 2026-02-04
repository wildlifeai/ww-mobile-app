import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RootStackParamList } from '../../navigation'
import { Ionicons } from '@expo/vector-icons'
import { useAppSelector } from '../../redux'
import { useBle } from '../../hooks/useBle'
import { useBleCommands } from '../../hooks/useBleCommands'
import { DeviceStatusCard } from '../../components/DeviceStatusCard'
import { DevicePreparationService } from '../../services/DevicePreparationService'
import { AppParams } from '../../navigation/index'
import { BleConsoleOutput, ConsoleEntry } from '../../components/BleConsoleOutput'

export const DevicePreparationScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
    const route = useRoute<AppParams<'DevicePreparation'>>()
    const params = route.params as { deviceId: string } | undefined
    const deviceId = params?.deviceId as string // Force cast as we check for it or it's dead code

    const device = useAppSelector(state => state.devices[deviceId])
    const logs = useAppSelector(state => state.logs[deviceId] || [])
    const currentUser = useAppSelector(state => state.authentication.user)

    const { connectDevice, disconnectDevice } = useBle()
    const { getBatteryLevel, checkSdCard, pingNetwork, runSelfTest } = useBleCommands()

    const [isConnecting, setIsConnecting] = useState(false)
    const [preparationId, setPreparationId] = useState<string | null>(null)
    const [consoleHistory, setConsoleHistory] = useState<ConsoleEntry[]>([])

    // Status state
    const [batteryInfo, setBatteryInfo] = useState<{ level: number, voltage: number } | undefined>()
    const [sdCardInfo, setSdCardInfo] = useState<{ total: number, available: number } | undefined>()
    const [lorawanInfo, setLorawanInfo] = useState<{ rssi: number, snr: number } | undefined>()
    const [firmwareVersion, setFirmwareVersion] = useState<string | undefined>()

    const lastProcessedLength = React.useRef<number>(0)

    // Monitor logs to parse responses (simplified for now, ideally use parser.ts output)
    useEffect(() => {
        if (!logs || logs.length === lastProcessedLength.current) return

        const newEntries = logs.slice(lastProcessedLength.current)
        lastProcessedLength.current = logs.length

        if (newEntries.length === 0) return

        // Add to console history for visibility
        const historyEntries: ConsoleEntry[] = newEntries.map(e => ({
            id: Date.now().toString() + Math.random(),
            timestamp: new Date(e.timestamp),
            type: e.type === 'tx' ? 'command' : 'response',
            content: e.content
        }))

        setConsoleHistory(prev => [...prev, ...historyEntries])

        // Parse new logs strings
        const combinedLogs = newEntries.map(e => e.content).join('\n')

        // Basic parsing for demo purposes (real parsing should be in parser.ts/useBleCommands)
        if (combinedLogs.includes('Battery =')) {
            const match = combinedLogs.match(/Battery = (\d+)mV (\d+)%/)
            if (match) {
                setBatteryInfo({ voltage: parseInt(match[1], 10), level: parseInt(match[2], 10) })
                if (preparationId) {
                    DevicePreparationService.recordBatteryCheck(preparationId, parseInt(match[2], 10) > 20)
                }
            }
        }

        if (combinedLogs.includes('total drive space')) {
            const match = combinedLogs.match(/(\d+)\s*K\s*total\s*drive\s*space[\s\S]*?(\d+)\s*K\s*available/)
            if (match) {
                setSdCardInfo({ total: parseInt(match[1], 10) * 1024, available: parseInt(match[2], 10) * 1024 })
                if (preparationId) {
                    DevicePreparationService.recordSdCardCheck(preparationId, true)
                }
            }
        }

        if (combinedLogs.includes('RSSI=')) {
            const match = combinedLogs.match(/RSSI=(-?\d+),\s*SNR=(-?\d+(?:\.\d+)?)/)
            if (match) {
                setLorawanInfo({ rssi: parseInt(match[1], 10), snr: parseFloat(match[2]) })
                if (preparationId) {
                    DevicePreparationService.recordLoRaWANCheck(preparationId, true)
                }
            }
        }

    }, [logs, preparationId])

    const handleConnect = async () => {
        if (!device) return
        setIsConnecting(true)
        try {
            await connectDevice(device)
        } catch (error) {
            Alert.alert('Connection Failed', String(error))
        } finally {
            setIsConnecting(false)
        }
    }

    const startWorkflow = async () => {
        if (!currentUser) return
        try {
            // TODO: Select project ID properly. Using placeholder for now.
            const projectId = 'placeholder-project-id'
            const prep = await DevicePreparationService.startPreparation(deviceId, projectId, currentUser.id)
            setPreparationId(prep.id)
            Alert.alert('Started', 'Device preparation workflow started.')
        } catch (error) {
            Alert.alert('Error', 'Failed to start preparation: ' + error)
        }
    }

    const runAllChecks = async () => {
        if (!device || !device.connected) {
            Alert.alert('Not Connected', 'Please connect to the device first.')
            return
        }

        try {
            await getBatteryLevel(device)
            // Small delay between commands
            setTimeout(async () => await checkSdCard(device), 1000)
            setTimeout(async () => await pingNetwork(device), 2000)
        } catch (error) {
            Alert.alert('Error', 'Failed to run checks: ' + error)
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
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.deviceName}>{device.name || 'Unknown Device'}</Text>
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
                        <Text style={styles.connectButtonText}>Connect to Device</Text>
                    )}
                </TouchableOpacity>
            )}

            <DeviceStatusCard
                batteryLevel={batteryInfo?.level}
                batteryVoltage={batteryInfo?.voltage}
                sdCardTotal={sdCardInfo?.total}
                sdCardAvailable={sdCardInfo?.available}
                lorawanStatus={lorawanInfo}
                firmwareVersion={firmwareVersion}
            />

            <View style={styles.actionsContainer}>
                <Text style={styles.sectionTitle}>Preparation Actions</Text>

                {!preparationId ? (
                    <TouchableOpacity style={styles.actionButton} onPress={startWorkflow}>
                        <Ionicons name="play" size={20} color="#FFF" style={styles.actionIcon} />
                        <Text style={styles.actionButtonText}>Start New Preparation</Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        <TouchableOpacity
                            style={[styles.actionButton, !device.connected && styles.disabledButton]}
                            onPress={runAllChecks}
                            disabled={!device.connected}
                        >
                            <Ionicons name="refresh" size={20} color="#FFF" style={styles.actionIcon} />
                            <Text style={styles.actionButtonText}>Run Health Checks</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, styles.secondaryButton]}
                            onPress={() => navigation.navigate('EngineerConsoleScreen', { deviceId })}
                        >
                            <Ionicons name="terminal" size={20} color="#2196F3" style={styles.actionIcon} />
                            <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>Open Engineer Console</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>

            <View style={styles.consolePreview}>
                <Text style={styles.sectionTitle}>Recent Logs</Text>
                <BleConsoleOutput entries={consoleHistory.slice(-5)} />
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        padding: 16,
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
        marginBottom: 16,
    },
    deviceName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
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
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    connectButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    actionsContainer: {
        marginTop: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#333',
    },
    actionButton: {
        backgroundColor: '#4CAF50',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    disabledButton: {
        backgroundColor: '#BDBDBD',
    },
    secondaryButton: {
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#2196F3',
    },
    actionIcon: {
        marginRight: 8,
    },
    actionButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    secondaryButtonText: {
        color: '#2196F3',
    },
    consolePreview: {
        height: 200,
        marginTop: 16,
        marginBottom: 32,
    },
    errorText: {
        color: '#F44336',
        fontSize: 16,
    }
})
