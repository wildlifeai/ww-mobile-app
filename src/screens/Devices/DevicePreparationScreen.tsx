import React, { useEffect, useReducer } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RootStackParamList } from '../../navigation/types'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useAppSelector } from '../../redux'
import { useBle } from '../../hooks/useBle'
import { useBleCommands } from '../../hooks/useBleCommands'
import { DeviceStatusCard } from '../../components/DeviceStatusCard'
import { DevicePreparationService } from '../../services/DevicePreparationService'
import { AppParams } from '../../navigation/types'
import { BleConsoleOutput, ConsoleEntry } from '../../components/BleConsoleOutput'

interface PrepState {
    isConnecting: boolean
    preparationId: string | null
    consoleHistory: ConsoleEntry[]
    batteryInfo?: { level: number, voltage: number }
    sdCardInfo?: { total: number, available: number }
    lorawanInfo?: { rssi: number, snr: number }
    firmwareVersion?: string
}

const prepReducer = (state: PrepState, action: Partial<PrepState> | { type: 'APPEND_HISTORY', entries: ConsoleEntry[] }): PrepState => {
    if ('type' in action && action.type === 'APPEND_HISTORY') {
        return { ...state, consoleHistory: [...state.consoleHistory, ...action.entries] }
    }
    return { ...state, ...action }
}

export const DevicePreparationScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
    const route = useRoute<AppParams<'DevicePreparation'>>()
    const params = route.params as { deviceId: string } | undefined
    const deviceId = params?.deviceId as string // Force cast as we check for it or it's dead code

    const device = useAppSelector(state => state.devices[deviceId])
    const logs = useAppSelector(state => state.logs[deviceId] || [])
    const currentUser = useAppSelector(state => state.authentication.user)

    const { connectDevice } = useBle()
    const { getBatteryLevel, checkSdCard, pingNetwork } = useBleCommands()

    const [state, dispatch] = useReducer(prepReducer, {
        isConnecting: false,
        preparationId: null,
        consoleHistory: [],
        batteryInfo: undefined,
        sdCardInfo: undefined,
        lorawanInfo: undefined,
        firmwareVersion: undefined
    })

    const { isConnecting, preparationId, consoleHistory, batteryInfo, sdCardInfo, lorawanInfo, firmwareVersion } = state

    const lastProcessedLength = React.useRef<number>(0)

    // Monitor logs ONLY for LoRaWAN ping response (async event)
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

        dispatch({ type: 'APPEND_HISTORY', entries: historyEntries })

        // Parse LoRaWAN response (legitimate async event)
        const combinedLogs = newEntries.map(e => e.content).join('\n')
        if (combinedLogs.includes('RSSI=')) {
            const match = combinedLogs.match(/RSSI=(-?\d+),\s*SNR=(-?\d+(?:\.\d+)?)/)
            if (match) {
                dispatch({ lorawanInfo: { rssi: parseInt(match[1], 10), snr: parseFloat(match[2]) } })
                if (preparationId) {
                    DevicePreparationService.recordLoRaWANCheck(preparationId, true)
                }
            }
        }

    }, [logs, preparationId])

    const handleConnect = async () => {
        if (!device) return
        dispatch({ isConnecting: true })
        try {
            await connectDevice(device)
        } catch (error) {
            Alert.alert('Connection Failed', String(error))
        } finally {
            dispatch({ isConnecting: false })
        }
    }

    const startWorkflow = async () => {
        if (!currentUser) return
        try {
            // TODO: Select project ID properly. Using placeholder for now.
            const projectId = 'placeholder-project-id'
            const prep = await DevicePreparationService.startPreparation(deviceId, projectId, currentUser.id)
            dispatch({ preparationId: prep.id })
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
            // Battery check - use return value
            const batteryResponse = await getBatteryLevel(device)
            const batteryMatch = batteryResponse.match(/Battery = (\d+)mV (\d+)%/)
            if (batteryMatch) {
                const voltage = parseInt(batteryMatch[1], 10)
                const level = parseInt(batteryMatch[2], 10)
                dispatch({ batteryInfo: { voltage, level } })
                if (preparationId) {
                    DevicePreparationService.recordBatteryCheck(preparationId, level > 20)
                }
            }

            // SD card check - use return value
            const sdResult = await checkSdCard(device)
            if (sdResult && sdResult.total > 0) {
                dispatch({ sdCardInfo: { total: sdResult.total * 1024, available: sdResult.free * 1024 } })
                if (preparationId) {
                    DevicePreparationService.recordSdCardCheck(preparationId, true)
                }
            }

            // LoRaWAN check - still async (response comes via logs)
            await pingNetwork(device)
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
                    <View style={[styles.statusDot, device.connected ? styles.statusDotConnected : styles.statusDotDisconnected]} />
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
                        <MaterialCommunityIcons name="play" size={20} color="#FFF" style={styles.actionIcon} />
                        <Text style={styles.actionButtonText}>Start New Preparation</Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        <TouchableOpacity
                            style={[styles.actionButton, !device.connected && styles.disabledButton]}
                            onPress={runAllChecks}
                            disabled={!device.connected}
                        >
                            <MaterialCommunityIcons name="refresh" size={20} color="#FFF" style={styles.actionIcon} />
                            <Text style={styles.actionButtonText}>Run Health Checks</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, styles.secondaryButton]}
                            onPress={() => navigation.navigate('EngineerConsoleScreen', { deviceId })}
                        >
                            <MaterialCommunityIcons name="console" size={20} color="#2196F3" style={styles.actionIcon} />
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
    },
    iconWhite: {
        width: 20,
        height: 20,
        tintColor: '#FFF'
    },
    iconBlue: {
        width: 20,
        height: 20,
        tintColor: '#2196F3'
    }
})
