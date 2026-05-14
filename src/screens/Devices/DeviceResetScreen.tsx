import { useReducer, useCallback } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { Text, Button, Card, ProgressBar, useTheme } from 'react-native-paper'
import { useRoute } from '@react-navigation/native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RouteProp } from '@react-navigation/native'
import { RootStackParamList } from '../../navigation/types'
import { useAppSelector } from '../../redux'
import { useDeviceSettings, FACTORY_DEFAULTS, OP_PARAMETER } from '../../hooks/useDeviceSettings'
import { WWText } from '../../components/ui/WWText'

type RouteType = RouteProp<RootStackParamList, 'DeviceResetScreen'>

interface ResetState {
    status: 'idle' | 'running' | 'success' | 'error'
    currentStep: string
    progress: number
    logs: string[]
    errorMessage: string | null
}

type ResetAction =
    | { type: 'START' }
    | { type: 'PROGRESS'; step: string; progress: number }
    | { type: 'LOG'; message: string }
    | { type: 'SUCCESS' }
    | { type: 'ERROR'; message: string }
    | { type: 'RESET_STATE' }

const initialState: ResetState = {
    status: 'idle',
    currentStep: '',
    progress: 0,
    logs: [],
    errorMessage: null,
}

const resetReducer = (state: ResetState, action: ResetAction): ResetState => {
    switch (action.type) {
        case 'START':
            return { ...state, status: 'running', currentStep: 'Starting…', progress: 0, logs: [], errorMessage: null }
        case 'PROGRESS':
            return { ...state, currentStep: action.step, progress: action.progress, logs: [...state.logs, action.step] }
        case 'LOG':
            return { ...state, logs: [...state.logs, action.message] }
        case 'SUCCESS':
            return { ...state, status: 'success', currentStep: 'Reset complete', progress: 1 }
        case 'ERROR':
            return { ...state, status: 'error', errorMessage: action.message }
        case 'RESET_STATE':
            return initialState
        default:
            return state
    }
}

/**
 * Default values table data for display
 */
const DEFAULT_VALUES_TABLE: { name: string; index: number; value: number }[] = [
    { name: 'Picture Interval', index: OP_PARAMETER.PICTURE_INTERVAL, value: FACTORY_DEFAULTS[OP_PARAMETER.PICTURE_INTERVAL] },
    { name: 'Timelapse Interval', index: OP_PARAMETER.TIMELAPSE_INTERVAL, value: FACTORY_DEFAULTS[OP_PARAMETER.TIMELAPSE_INTERVAL] },
    { name: 'Inactivity Timeout', index: OP_PARAMETER.INTERVAL_BEFORE_DPD, value: FACTORY_DEFAULTS[OP_PARAMETER.INTERVAL_BEFORE_DPD] },
    { name: 'LED Brightness', index: OP_PARAMETER.LED_BRIGHTNESS, value: FACTORY_DEFAULTS[OP_PARAMETER.LED_BRIGHTNESS] },
    { name: 'Camera Enabled', index: OP_PARAMETER.CAMERA_ENABLED, value: FACTORY_DEFAULTS[OP_PARAMETER.CAMERA_ENABLED] },
    { name: 'MD Interval', index: OP_PARAMETER.MD_INTERVAL, value: FACTORY_DEFAULTS[OP_PARAMETER.MD_INTERVAL] },
    { name: 'Flash Duration', index: OP_PARAMETER.FLASH_DURATION, value: FACTORY_DEFAULTS[OP_PARAMETER.FLASH_DURATION] },
    { name: 'Flash LED', index: OP_PARAMETER.FLASH_LED, value: FACTORY_DEFAULTS[OP_PARAMETER.FLASH_LED] },
    { name: 'Model Project (OP14)', index: OP_PARAMETER.MODEL_PROJECT, value: FACTORY_DEFAULTS[OP_PARAMETER.MODEL_PROJECT] },
    { name: 'Model Version (OP15)', index: OP_PARAMETER.MODEL_VERSION, value: FACTORY_DEFAULTS[OP_PARAMETER.MODEL_VERSION] },
    { name: 'Model Threshold', index: OP_PARAMETER.MODEL_THRESHOLD, value: FACTORY_DEFAULTS[OP_PARAMETER.MODEL_THRESHOLD] },
    { name: 'MD Sensitivity', index: OP_PARAMETER.MD_SENSITIVITY, value: FACTORY_DEFAULTS[OP_PARAMETER.MD_SENSITIVITY] },
    { name: 'Test Mode Bits', index: OP_PARAMETER.TEST_MODE_BITS, value: FACTORY_DEFAULTS[OP_PARAMETER.TEST_MODE_BITS] },
]

interface DefaultValueRowProps {
    name: string
    index: number
    value: number
    colors: { onSurfaceVariant: string; outlineVariant: string }
}

const DefaultValueRow = ({ name, index, value, colors }: DefaultValueRowProps) => (
    <View style={[styles.tableRow, { borderBottomColor: colors.outlineVariant }]}>
        <Text style={[styles.tableCell, styles.tableCellName, { color: colors.onSurfaceVariant }]}>{name}</Text>
        <Text style={[styles.tableCell, styles.tableCellIndex, { color: colors.onSurfaceVariant }]}>OP {index}</Text>
        <Text style={[styles.tableCell, styles.tableCellValue, { color: colors.onSurfaceVariant }]}>{value}</Text>
    </View>
)

export const DeviceResetScreen = () => {
    const route = useRoute<RouteType>()
    const deviceId = route.params?.deviceId
    const theme = useTheme()
    const { colors } = theme

    const connectedDevice = useAppSelector(state => state.devices[deviceId || ''])
    const { resetToDefaults, isUpdating } = useDeviceSettings()

    const [state, dispatch] = useReducer(resetReducer, initialState)

    const handleReset = useCallback(async () => {
        if (!connectedDevice || !connectedDevice.connected) {
            dispatch({ type: 'ERROR', message: 'Device is not connected' })
            return
        }

        dispatch({ type: 'START' })

        try {
            await resetToDefaults(connectedDevice, (step, progress) => {
                dispatch({ type: 'PROGRESS', step, progress })
            })
            dispatch({ type: 'SUCCESS' })
        } catch (error) {
            dispatch({ type: 'ERROR', message: error instanceof Error ? error.message : String(error) })
        }
    }, [connectedDevice, resetToDefaults])

    const isConnected = connectedDevice?.connected === true
    const isRunning = state.status === 'running'

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <ScrollView contentContainerStyle={styles.content}>

                <Card style={styles.card}>
                    <Card.Content>
                        <WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant, marginBottom: 12 }}>
                            This will reset the following parameters to their default values, clear deployment ID and zero the GPS coordinates.
                        </WWText>
                        {!isConnected && (
                            <View style={[styles.banner, { backgroundColor: colors.errorContainer }]}>
                                <WWText style={{ color: colors.onErrorContainer }}>
                                    Device is not connected. Please connect via the Engineer Console first.
                                </WWText>
                            </View>
                        )}

                        <Button
                            mode="contained"
                            onPress={handleReset}
                            disabled={!isConnected || isRunning || isUpdating}
                            loading={isRunning}
                            buttonColor={colors.error}
                            textColor="#FFFFFF"
                            style={styles.resetButton}
                            icon="restore"
                        >
                            <WWText style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Reset to Defaults</WWText>
                        </Button>
                    </Card.Content>
                </Card>

                {/* Progress Section */}
                {state.status !== 'idle' && (
                    <Card style={styles.card}>
                        <Card.Content>
                            <WWText variant="titleSmall" style={{ marginBottom: 8 }}>
                                Progress
                            </WWText>
                            <ProgressBar
                                progress={state.progress}
                                color={state.status === 'error' ? colors.error : state.status === 'success' ? '#4CAF50' : colors.primary}
                                style={styles.progressBar}
                            />
                            <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginTop: 4 }}>
                                {state.currentStep}
                            </WWText>

                            {state.status === 'success' && (
                                <View style={[styles.banner, { backgroundColor: '#E8F5E9', marginTop: 12 }]}>
                                    <WWText style={{ color: '#2E7D32' }}>
                                        ✅ Device has been reset to factory defaults successfully.
                                    </WWText>
                                </View>
                            )}

                            {state.status === 'error' && (
                                <View style={[styles.banner, { backgroundColor: colors.errorContainer, marginTop: 12 }]}>
                                    <WWText style={{ color: colors.onErrorContainer }}>
                                        ❌ Reset failed: {state.errorMessage}
                                    </WWText>
                                </View>
                            )}
                        </Card.Content>
                    </Card>
                )}

                {/* Log Output */}
                {state.logs.length > 0 && (
                    <Card style={styles.card}>
                        <Card.Content>
                            <WWText variant="titleSmall" style={{ marginBottom: 8 }}>
                                Log Output
                            </WWText>
                            <View style={styles.logContainer}>
                                {state.logs.map((logEntry) => (
                                    <Text key={logEntry} style={styles.logText}>{logEntry}</Text>
                                ))}
                            </View>
                        </Card.Content>
                    </Card>
                )}

                {/* Default Values Reference */}
                <Card style={styles.card}>
                    <Card.Content>
                        <WWText variant="titleSmall" style={{ marginBottom: 8 }}>
                            Factory Default Values
                        </WWText>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableCell, styles.tableCellName, styles.tableHeaderText]}>Parameter</Text>
                            <Text style={[styles.tableCell, styles.tableCellIndex, styles.tableHeaderText]}>Index</Text>
                            <Text style={[styles.tableCell, styles.tableCellValue, styles.tableHeaderText]}>Default</Text>
                        </View>
                        {DEFAULT_VALUES_TABLE.map((row) => (
                            <DefaultValueRow
                                key={`op-${row.index}`}
                                name={row.name}
                                index={row.index}
                                value={row.value}
                                colors={{ onSurfaceVariant: colors.onSurfaceVariant, outlineVariant: colors.outlineVariant }}
                            />
                        ))}
                    </Card.Content>
                </Card>

            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
        paddingBottom: 32,
    },
    card: {
        marginBottom: 16,
    },
    cardTitle: {
        fontWeight: 'bold',
        marginBottom: 8,
    },
    banner: {
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    resetButton: {
        borderRadius: 8,
        paddingVertical: 4,
    },
    progressBar: {
        height: 6,
        borderRadius: 3,
    },
    logContainer: {
        backgroundColor: '#1a1a2e',
        borderRadius: 8,
        padding: 12,
        maxHeight: 200,
    },
    logText: {
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#E0E0E0',
        lineHeight: 18,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottomWidth: 2,
        borderBottomColor: '#333',
    },
    tableHeaderText: {
        fontWeight: 'bold',
        fontSize: 12,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 6,
        borderBottomWidth: 1,
    },
    tableCell: {
        fontSize: 12,
    },
    tableCellName: {
        flex: 3,
    },
    tableCellIndex: {
        flex: 1,
        textAlign: 'center',
    },
    tableCellValue: {
        flex: 1,
        textAlign: 'right',
    },
})
