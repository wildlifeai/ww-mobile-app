import { useCallback, useRef, useEffect, useMemo, useReducer } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Button, ProgressBar, Chip, Divider, Text, RadioButton } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute } from '@react-navigation/native'

import { useExtendedTheme } from '../../theme'
import { useAppSelector } from '../../redux'
import { WWText } from '../../components/ui/WWText'
import { logError } from '../../utils/logger'
import { runFileTransferPipeline } from '../../ble/protocol/fileTransfer'
import { crc16ccitt } from '../../ble/protocol/fileTransfer/crc16ccitt'
import { buildFileLoopbackPacket } from '../../ble/protocol/fileTransfer/fileTransferPackets'
import { writeBinaryToDevice } from '../../ble/transport'
import { bleEventBus, BleEvent } from '../../ble/protocol/eventBus'
import {
    FileTransferProgress,
    getErrorMessage,
} from '../../ble/protocol/fileTransfer/fileTransferTypes'

// ─── Test file generators ────────────────────────────────────────────

interface TestFile {
    name: string
    filename: string  // 8.3 format
    data: Uint8Array
    description: string
}

function generateTestFiles(): TestFile[] {
    const enc = new TextEncoder()

    // 1. Tiny text: 5 bytes (single packet, well under 241)
    const tinyContent = 'Hello'
    const tiny: TestFile = {
        name: 'Tiny Text (5 bytes)',
        filename: 'TINY.TXT',
        data: enc.encode(tinyContent),
        description: `"${tinyContent}": single packet, verifies basic transfer`,
    }

    // 2. Medium text: 300 bytes (crosses 241-byte packet boundary = 2 packets)
    const medLines: string[] = []
    for (let i = 1; medLines.join('\n').length < 290; i++) {
        medLines.push(`Line ${i}: The quick brown fox jumps over the lazy dog.`)
    }
    const medContent = medLines.join('\n').slice(0, 300)
    const medium: TestFile = {
        name: 'Medium Text (300 bytes)',
        filename: 'MED.TXT',
        data: enc.encode(medContent),
        description: '300 bytes: crosses 241-byte packet boundary (2 packets)',
    }

    // 3. Larger text: 1000 bytes (~5 packets)
    const bigLines: string[] = []
    for (let i = 1; bigLines.join('\n').length < 990; i++) {
        bigLines.push(`[${String(i).padStart(3, '0')}] Testing file transfer: packet ${Math.ceil(bigLines.join('\n').length / 241) + 1}`)
    }
    const bigContent = bigLines.join('\n').slice(0, 1000)
    const big: TestFile = {
        name: 'Large Text (1000 bytes)',
        filename: 'BIG.TXT',
        data: enc.encode(bigContent),
        description: '1000 bytes: ~5 packets, verifies multi-packet flow',
    }

    // 4. Binary: 500 bytes of deterministic pattern (not random, so Steve can verify)
    const binData = new Uint8Array(500)
    for (let i = 0; i < binData.length; i++) {
        // eslint-disable-next-line no-bitwise
        binData[i] = i & 0xFF  // 0x00, 0x01, ..., 0xFF, 0x00, ...
    }
    const binary: TestFile = {
        name: 'Binary Pattern (500 bytes)',
        filename: 'BIN.DAT',
        data: binData,
        description: '500 bytes: repeating 0x00–0xFF pattern, verifies binary integrity',
    }

    // 5. Large Binary: ~500KB
    const veryLargeData = new Uint8Array(500 * 1024)
    for (let i = 0; i < veryLargeData.length; i++) {
        // eslint-disable-next-line no-bitwise
        veryLargeData[i] = i & 0xFF
    }
    const veryLarge: TestFile = {
        name: 'Large Binary (~500KB)',
        filename: 'LARGE.BIN',
        data: veryLargeData,
        description: '500KB: verifies stability for firmware-sized transfers (firmware is ~440KB)',
    }

    return [tiny, medium, big, binary, veryLarge]
}

// ─── Benchmark ───────────────────────────────────────────────────────

const BENCHMARK_ROUNDS = 10
const LOOPBACK_TIMEOUT_MS = 5000
const LOOPBACK_PAYLOAD_SIZES = [5, 100, 241] // test small, medium, max

interface BenchmarkResult {
    round: number
    durationMs: number
    success: boolean
    error?: string
    payloadSize?: number
}

// ─── State Management ──────────────────────────────────────────────────

interface TransferState {
    selectedIndex: number | null
    isTransferring: boolean
    progress: FileTransferProgress | null
    result: { success: boolean; message: string; details?: string } | null
    transferLog: { id: string; text: string }[]
    isBenchmarking: boolean
    benchmarkResults: BenchmarkResult[]
    transferMode: 'stop-and-wait' | 'sliding-window'
}

const initialState: TransferState = {
    selectedIndex: null,
    isTransferring: false,
    progress: null,
    result: null,
    transferLog: [],
    isBenchmarking: false,
    benchmarkResults: [],
    transferMode: 'stop-and-wait',
}

type TransferAction =
    | { type: 'START'; payload: { index: number; logs: { id: string; text: string }[] } }
    | { type: 'ADD_LOG'; payload: { id: string; text: string } }
    | { type: 'SET_PROGRESS'; payload: FileTransferProgress }
    | { type: 'COMPLETE'; payload: { result: TransferState['result']; logs: { id: string; text: string }[] } }
    | { type: 'ERROR'; payload: { result: TransferState['result']; logs: { id: string; text: string }[] } }
    | { type: 'END' }
    | { type: 'BENCHMARK_START' }
    | { type: 'BENCHMARK_ROUND'; payload: BenchmarkResult }
    | { type: 'BENCHMARK_END' }
    | { type: 'SET_MODE'; payload: 'stop-and-wait' | 'sliding-window' }

function transferReducer(state: TransferState, action: TransferAction): TransferState {
    switch (action.type) {
        case 'START':
            return { ...initialState, selectedIndex: action.payload.index, isTransferring: true, transferLog: action.payload.logs }
        case 'ADD_LOG':
            return { ...state, transferLog: [...state.transferLog, action.payload] }
        case 'SET_PROGRESS':
            return { ...state, progress: action.payload }
        case 'COMPLETE':
        case 'ERROR':
            return { ...state, result: action.payload.result, transferLog: [...state.transferLog, ...action.payload.logs] }
        case 'END':
            return { ...state, isTransferring: false }
        case 'BENCHMARK_START':
            return { ...state, isBenchmarking: true, benchmarkResults: [] }
        case 'BENCHMARK_ROUND':
            return { ...state, benchmarkResults: [...state.benchmarkResults, action.payload] }
        case 'BENCHMARK_END':
            return { ...state, isBenchmarking: false }
        case 'SET_MODE':
            return { ...state, transferMode: action.payload }
        default:
            return state
    }
}

// ─── Component ───────────────────────────────────────────────────────

export const FileTransferTestScreen = () => {
    const route = useRoute<any>()
    const { colors, spacing } = useExtendedTheme()

    const deviceId = route.params?.deviceId
    const device = useAppSelector(state => state.devices[deviceId || ''])

    const testFiles = useMemo(() => generateTestFiles(), [])
    const [state, dispatch] = useReducer(transferReducer, initialState)
    const { selectedIndex, isTransferring, progress, result, transferLog, isBenchmarking, benchmarkResults, transferMode } = state

    const abortRef = useRef<AbortController | null>(null)
    const unmountedRef = useRef(false)

    useEffect(() => {
        return () => { unmountedRef.current = true }
    }, [])

    const addLog = useCallback((msg: string) => {
        const timestamp = new Date().toLocaleTimeString()
        dispatch({ type: 'ADD_LOG', payload: { id: Math.random().toString(36).substr(2, 9), text: `[${timestamp}] ${msg}` } })
    }, [])

    const startTransfer = useCallback(async (index: number) => {
        if (!device?.connected) {
            dispatch({
                type: 'ERROR',
                payload: { result: { success: false, message: 'Device disconnected.' }, logs: [] }
            })
            return
        }

        const file = testFiles[index]
        const fileCrc = crc16ccitt(file.data)
        const timestamp = new Date().toLocaleTimeString()

        const modeLabel = state.transferMode === 'sliding-window' ? 'Sliding Window (12-pkt)' : 'Stop-and-Wait'

        const initialLogs = [
            { id: Math.random().toString(36).substr(2, 9), text: `[${timestamp}] Mode: ${modeLabel}` },
            { id: Math.random().toString(36).substr(2, 9), text: `[${timestamp}] Selected: ${file.filename} (${file.data.length} bytes)` },
            { id: Math.random().toString(36).substr(2, 9), text: `[${timestamp}] CRC: 0x${fileCrc.toString(16).toUpperCase().padStart(4, '0')}` },
            { id: Math.random().toString(36).substr(2, 9), text: `[${timestamp}] Packets: ${Math.ceil(file.data.length / 241)}` },
            { id: Math.random().toString(36).substr(2, 9), text: `[${timestamp}] Starting transfer...` }
        ]

        dispatch({ type: 'START', payload: { index, logs: initialLogs } })
        abortRef.current = new AbortController()

        try {
            // Phase 3: a deep window (12) streams packets ahead so the device is
            // never idle waiting on the ~250ms app<->phone round-trip; throughput
            // then becomes device-bound (~45ms/packet). Must stay <= the nRF's
            // FILETX_FIFO_SLOTS (16) so the firmware FIFO never overflows.
            const transferWindowSize = state.transferMode === 'sliding-window' ? 12 : 1

            const transferResult = await runFileTransferPipeline(device, {
                filename: file.filename,
                data: file.data,
                windowSize: transferWindowSize,
                onProgress: (p) => {
                    if (!unmountedRef.current) dispatch({ type: 'SET_PROGRESS', payload: p })
                },
                abortSignal: abortRef.current.signal,
            })

            if (unmountedRef.current) return

            const ts = new Date().toLocaleTimeString()
            dispatch({
                type: 'COMPLETE',
                payload: {
                    result: {
                        success: true,
                        message: `${file.filename} transferred successfully!`,
                        details: `${transferResult.sizeBytes} bytes in ${(transferResult.durationMs / 1000).toFixed(1)}s · CRC verified`,
                    },
                    logs: [
                        { id: Math.random().toString(36).substr(2, 9), text: `[${ts}] ✅ Transfer complete in ${(transferResult.durationMs / 1000).toFixed(1)}s` },
                        { id: Math.random().toString(36).substr(2, 9), text: `[${ts}] File "${transferResult.filename}" is now on the SD card at /MANIFEST/` }
                    ]
                }
            })
        } catch (err: any) {
            if (unmountedRef.current) return

            const errorCode = err.errorCode
            const friendlyMsg = errorCode ? getErrorMessage(errorCode) : err.message
            const ts = new Date().toLocaleTimeString()
            
            logError('[FileTransferTest]', err)

            dispatch({
                type: 'ERROR',
                payload: {
                    result: {
                        success: false,
                        message: `Transfer failed: ${friendlyMsg}`,
                        details: errorCode ? `Error code ${errorCode}: ${err.reason}` : err.reason || undefined,
                    },
                    logs: [{ id: Math.random().toString(36).substr(2, 9), text: `[${ts}] ❌ Failed: ${friendlyMsg}` }]
                }
            })
        } finally {
            if (!unmountedRef.current) {
                dispatch({ type: 'END' })
                abortRef.current = null
            }
        }
    }, [device, testFiles, state.transferMode])  

    const cancelTransfer = useCallback(() => {
        abortRef.current?.abort()
        addLog('⏹ User cancelled transfer')
    }, [addLog])

    // ─── FILE_LOOPBACK Latency Benchmark ─────────────────────────────
    // Uses packet type 10: device echoes binary packet immediately
    // without I2C or SD card involvement. Measures pure BLE round-trip.

    const runBenchmark = useCallback(async () => {
        if (!device?.connected) return

        dispatch({ type: 'BENCHMARK_START' })
        addLog(`🏁 Starting FILE_LOOPBACK benchmark (${BENCHMARK_ROUNDS} rounds × ${LOOPBACK_PAYLOAD_SIZES.length} sizes)...`)

        let round = 0
        for (const payloadSize of LOOPBACK_PAYLOAD_SIZES) {
            addLog(`  📏 Payload size: ${payloadSize} bytes`)
            for (let i = 0; i < BENCHMARK_ROUNDS; i++) {
                if (unmountedRef.current) return
                round++
                const seqNum = round % 256
                const payload = new Uint8Array(payloadSize).fill(seqNum)
                const packet = buildFileLoopbackPacket(seqNum, payload)

                const roundStart = Date.now()
                try {
                    // Wait for binary echo with matching seq number
                    const echoPromise = new Promise<void>((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            bleEventBus.off('binaryPacket', handler)
                            reject(new Error(`Loopback timeout (${LOOPBACK_TIMEOUT_MS}ms)`))
                        }, LOOPBACK_TIMEOUT_MS)

                        const handler = (evt: BleEvent & { type: 'BINARY_PACKET' }) => {
                            if (evt.deviceId !== device.id) return
                            // The device echoes via 0x06 binary framing:
                            // [0x06, packetNum, length, ...echoed payload]
                            // Match on packetNum which carries our seqNum
                            if (evt.packetNum === seqNum) {
                                clearTimeout(timeout)
                                bleEventBus.off('binaryPacket', handler)
                                resolve()
                            }
                        }
                        bleEventBus.on('binaryPacket', handler)
                    })

                    await writeBinaryToDevice(device, packet, false)
                    await echoPromise

                    const duration = Date.now() - roundStart
                    dispatch({ type: 'BENCHMARK_ROUND', payload: { round, durationMs: duration, success: true, payloadSize } })
                    addLog(`    R${i + 1}: ${duration}ms ✅`)
                } catch (err: any) {
                    const duration = Date.now() - roundStart
                    dispatch({ type: 'BENCHMARK_ROUND', payload: { round, durationMs: duration, success: false, error: err.message, payloadSize } })
                    addLog(`    R${i + 1}: ${duration}ms ❌ ${err.message}`)
                }

                // Brief pause between rounds
                if (i < BENCHMARK_ROUNDS - 1) {
                    await new Promise(r => setTimeout(r, 100))
                }
            }
        }

        if (!unmountedRef.current) {
            dispatch({ type: 'BENCHMARK_END' })
            addLog('🏁 Loopback benchmark complete')
        }
    }, [device, addLog])

    const selectedFile = selectedIndex !== null ? testFiles[selectedIndex] : null
    const pct = progress ? progress.percentage / 100 : 0

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <ScrollView contentContainerStyle={[styles.content, { padding: spacing }]}>

                <WWText variant="titleMedium" style={{ marginBottom: spacing / 2 }}>
                    Test Files
                </WWText>
                <WWText variant="bodySmall" style={styles.descriptionText}>
                    Select a file to send to the device's SD card via BLE.
                    Steve can compare these on the SD card to verify integrity.
                </WWText>

                {/* Transfer Mode Selector */}
                <View style={[styles.fileCard, { backgroundColor: colors.surfaceVariant, marginBottom: spacing }]}>
                    <WWText variant="titleSmall" style={{ marginBottom: 4 }}>Transfer Mode</WWText>
                    <RadioButton.Group
                        value={transferMode}
                        onValueChange={(v) => dispatch({ type: 'SET_MODE', payload: v as 'stop-and-wait' | 'sliding-window' })}
                    >
                        <View style={styles.radioRow}>
                            <RadioButton.Item
                                label="Stop-and-Wait (current)"
                                value="stop-and-wait"
                                disabled={isTransferring || isBenchmarking}
                                style={styles.radioItem}
                                labelStyle={styles.radioLabel}
                            />
                        </View>
                        <View style={styles.radioRow}>
                            <RadioButton.Item
                                label="Sliding Window (12-packet)"
                                value="sliding-window"
                                disabled={isTransferring || isBenchmarking}
                                style={styles.radioItem}
                                labelStyle={styles.radioLabel}
                            />
                        </View>
                    </RadioButton.Group>
                    {transferMode === 'sliding-window' && (
                        <WWText variant="bodySmall" style={{ opacity: 0.7, marginTop: 4 }}>
                            ⚠️ Requires firmware with 2-slot packet buffer. Falls back gracefully on older firmware.
                        </WWText>
                    )}
                </View>

                {testFiles.map((file, i) => {
                    const fileCrc = crc16ccitt(file.data)
                    return (
                        <View
                            key={file.filename}
                            style={[
                                styles.fileCard,
                                {
                                    backgroundColor: selectedIndex === i ? colors.primaryContainer : colors.surfaceVariant,
                                    marginBottom: spacing / 2,
                                },
                            ]}
                        >
                            <View style={styles.fileCardHeader}>
                                <WWText variant="titleSmall">{file.name}</WWText>
                                <Chip compact textStyle={styles.chipText}>
                                    <Text>CRC: 0x{fileCrc.toString(16).toUpperCase().padStart(4, '0')}</Text>
                                </Chip>
                            </View>
                            <WWText variant="bodySmall" style={styles.fileDescText}>
                                {file.description}
                            </WWText>
                            <Button
                                mode={selectedIndex === i && isTransferring ? 'outlined' : 'contained'}
                                compact
                                disabled={(isTransferring || isBenchmarking) && selectedIndex !== i}
                                loading={isTransferring && selectedIndex === i}
                                onPress={() => {
                                    if (isTransferring && selectedIndex === i) {
                                        cancelTransfer()
                                    } else {
                                        startTransfer(i)
                                    }
                                }}
                            >
                                {isTransferring && selectedIndex === i ? 'Cancel' : `Send ${file.filename}`}
                            </Button>
                        </View>
                    )
                })}

                {/* Latency Benchmark Section */}
                <Divider style={{ marginVertical: spacing }} />
                <WWText variant="titleMedium" style={{ marginBottom: spacing / 2 }}>
                    BLE Loopback Benchmark
                </WWText>
                <WWText variant="bodySmall" style={styles.descriptionText}>
                    Sends FILE_LOOPBACK packets (type 10) at 3 payload sizes ({LOOPBACK_PAYLOAD_SIZES.join(', ')} bytes).
                    Device echoes immediately: no I2C/SD card. Measures pure BLE round-trip.
                </WWText>
                <Button
                    mode="contained"
                    compact
                    disabled={isTransferring || isBenchmarking}
                    loading={isBenchmarking}
                    onPress={runBenchmark}
                    style={{ marginBottom: spacing / 2 }}
                >
                    {isBenchmarking ? 'Running…' : 'Run Benchmark'}
                </Button>

                {benchmarkResults.length > 0 && (
                    <View style={[styles.fileCard, { backgroundColor: colors.surfaceVariant, marginBottom: spacing / 2 }]}>
                        {(() => {
                            // Group results by payload size for cleaner display
                            const sizes = [...new Set(benchmarkResults.map(r => r.payloadSize ?? 0))]
                            return sizes.map(size => {
                                const sizeResults = benchmarkResults.filter(r => (r.payloadSize ?? 0) === size)
                                const successful = sizeResults.filter(r => r.success)
                                const times = successful.map(r => r.durationMs)
                                const avg = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0
                                const min = times.length > 0 ? Math.min(...times) : 0
                                const max = times.length > 0 ? Math.max(...times) : 0
                                return (
                                    <View key={size}>
                                        <WWText variant="labelSmall" style={{ marginTop: 4, fontWeight: 'bold' }}>
                                            {size}B payload: {successful.length}/{sizeResults.length} ok
                                        </WWText>
                                        {times.length > 0 && (
                                            <View style={styles.progressRow}>
                                                <WWText variant="bodySmall">Avg: {avg}ms</WWText>
                                                <WWText variant="bodySmall">Min: {min}ms</WWText>
                                                <WWText variant="bodySmall">Max: {max}ms</WWText>
                                            </View>
                                        )}
                                    </View>
                                )
                            })
                        })()}
                    </View>
                )}

                {/* Progress Section */}
                {progress && selectedFile && (
                    <>
                        <Divider style={{ marginVertical: spacing }} />
                        <WWText variant="titleMedium" style={{ marginBottom: spacing / 2 }}>
                            Transfer Progress
                        </WWText>

                        <ProgressBar
                            progress={pct}
                            color={progress.phase === 'failed' ? colors.error : colors.primary}
                            style={styles.progressBar}
                        />

                        <View style={styles.progressRow}>
                            <WWText variant="bodySmall">{progress.percentage}%</WWText>
                            <WWText variant="bodySmall">
                                {progress.bytesSent} / {progress.totalBytes} bytes
                            </WWText>
                            <WWText variant="bodySmall">{progress.currentSpeed}</WWText>
                        </View>
                        <View style={styles.progressRow}>
                            <WWText variant="bodySmall">
                                Packet {progress.currentPacket}/{progress.totalPackets}
                            </WWText>
                            <WWText variant="bodySmall" style={styles.phaseText}>
                                {progress.phase}
                            </WWText>
                            {progress.estimatedRemainingMs > 0 && (
                                <WWText variant="bodySmall">
                                    ~{(progress.estimatedRemainingMs / 1000).toFixed(0)}s left
                                </WWText>
                            )}
                        </View>
                    </>
                )}

                {/* Result */}
                {result && (
                    <View
                        style={[
                            styles.resultBox,
                            {
                                backgroundColor: result.success ? colors.primaryContainer : colors.errorContainer,
                                marginTop: spacing,
                            },
                        ]}
                    >
                        <WWText
                            variant="titleSmall"
                            style={{ color: result.success ? colors.onPrimaryContainer : colors.onErrorContainer }}
                        >
                            {result.success ? '✅ Success' : '❌ Error'}
                        </WWText>
                        <WWText style={{ color: result.success ? colors.onPrimaryContainer : colors.onErrorContainer }}>
                            {result.message}
                        </WWText>
                        {result.details && (
                            <WWText
                                variant="bodySmall"
                                style={[styles.resultDetails, { color: result.success ? colors.onPrimaryContainer : colors.onErrorContainer }]}
                            >
                                {result.details}
                            </WWText>
                        )}
                    </View>
                )}

                {/* Transfer Log */}
                {transferLog.length > 0 && (
                    <>
                        <Divider style={{ marginVertical: spacing }} />
                        <WWText variant="titleMedium" style={{ marginBottom: spacing / 2 }}>
                            Transfer Log
                        </WWText>
                        <View style={[styles.logBox, { backgroundColor: colors.surfaceVariant }]}>
                            {transferLog.map((logItem) => (
                                <WWText key={logItem.id} variant="bodySmall" style={[styles.logLine, { color: colors.onSurfaceVariant }]}>
                                    {logItem.text}
                                </WWText>
                            ))}
                        </View>
                    </>
                )}

            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flexGrow: 1 },
    fileCard: {
        padding: 12,
        borderRadius: 8,
    },
    fileCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    progressRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    resultBox: {
        padding: 16,
        borderRadius: 8,
        gap: 4,
    },
    logBox: {
        padding: 12,
        borderRadius: 8,
    },
    logLine: {
        fontFamily: 'monospace',
        fontSize: 11,
        lineHeight: 16,
    },
    descriptionText: {
        marginBottom: 16,
        opacity: 0.7,
    },
    chipText: {
        fontSize: 10,
    },
    fileDescText: {
        opacity: 0.7,
        marginBottom: 8,
    },
    progressBar: {
        height: 8,
        borderRadius: 4,
        marginBottom: 8,
    },
    phaseText: {
        textTransform: 'uppercase',
    },
    resultDetails: {
        opacity: 0.7,
    },
    radioRow: {
        marginVertical: -4,
    },
    radioItem: {
        paddingVertical: 2,
    },
    radioLabel: {
        fontSize: 13,
    },
})
