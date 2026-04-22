import { useState, useCallback, useRef, useEffect } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Button, Appbar, ProgressBar, Chip, Divider, Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation } from '@react-navigation/native'

import { useExtendedTheme } from '../../theme'
import { useAppSelector } from '../../redux'
import { WWText } from '../../components/ui/WWText'
import { logError } from '../../utils/logger'
import { runFileTransferPipeline } from '../../ble/protocol/fileTransfer'
import { crc16ccitt } from '../../ble/protocol/fileTransfer/crc16ccitt'
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

    // 1. Tiny text — 5 bytes (single packet, well under 241)
    const tinyContent = 'Hello'
    const tiny: TestFile = {
        name: 'Tiny Text (5 bytes)',
        filename: 'TINY.TXT',
        data: enc.encode(tinyContent),
        description: `"${tinyContent}" — single packet, verifies basic transfer`,
    }

    // 2. Medium text — 300 bytes (crosses 241-byte packet boundary = 2 packets)
    const medLines: string[] = []
    for (let i = 1; medLines.join('\n').length < 290; i++) {
        medLines.push(`Line ${i}: The quick brown fox jumps over the lazy dog.`)
    }
    const medContent = medLines.join('\n').slice(0, 300)
    const medium: TestFile = {
        name: 'Medium Text (300 bytes)',
        filename: 'MED.TXT',
        data: enc.encode(medContent),
        description: '300 bytes — crosses 241-byte packet boundary (2 packets)',
    }

    // 3. Larger text — 1000 bytes (~5 packets)
    const bigLines: string[] = []
    for (let i = 1; bigLines.join('\n').length < 990; i++) {
        bigLines.push(`[${String(i).padStart(3, '0')}] Testing file transfer: packet ${Math.ceil(bigLines.join('\n').length / 241) + 1}`)
    }
    const bigContent = bigLines.join('\n').slice(0, 1000)
    const big: TestFile = {
        name: 'Large Text (1000 bytes)',
        filename: 'BIG.TXT',
        data: enc.encode(bigContent),
        description: '1000 bytes — ~5 packets, verifies multi-packet flow',
    }

    // 4. Binary — 500 bytes of deterministic pattern (not random, so Steve can verify)
    const binData = new Uint8Array(500)
    for (let i = 0; i < binData.length; i++) {
        binData[i] = i & 0xFF  // 0x00, 0x01, ..., 0xFF, 0x00, ...
    }
    const binary: TestFile = {
        name: 'Binary Pattern (500 bytes)',
        filename: 'BIN.DAT',
        data: binData,
        description: '500 bytes — repeating 0x00–0xFF pattern, verifies binary integrity',
    }

    return [tiny, medium, big, binary]
}

// ─── Component ───────────────────────────────────────────────────────

export const FileTransferTestScreen = () => {
    const route = useRoute<any>()
    const navigation = useNavigation<any>()
    const { colors, spacing } = useExtendedTheme()

    const deviceId = route.params?.deviceId
    const device = useAppSelector(state => state.devices[deviceId || ''])

    const [testFiles] = useState(() => generateTestFiles())
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
    const [isTransferring, setIsTransferring] = useState(false)
    const [progress, setProgress] = useState<FileTransferProgress | null>(null)
    const [result, setResult] = useState<{ success: boolean; message: string; details?: string } | null>(null)
    const [transferLog, setTransferLog] = useState<{ id: string; text: string }[]>([])
    const abortRef = useRef<AbortController | null>(null)
    const unmountedRef = useRef(false)

    useEffect(() => {
        return () => { unmountedRef.current = true }
    }, [])

    const addLog = useCallback((msg: string) => {
        const timestamp = new Date().toLocaleTimeString()
        setTransferLog(prev => [
            ...prev,
            { id: Math.random().toString(36).substr(2, 9), text: `[${timestamp}] ${msg}` }
        ])
    }, [])

    const startTransfer = useCallback(async (index: number) => {
        if (!device?.connected) {
            setResult({ success: false, message: 'Device disconnected.' })
            return
        }

        const file = testFiles[index]
        const fileCrc = crc16ccitt(file.data)

        setSelectedIndex(index)
        setIsTransferring(true)
        setResult(null)
        setProgress(null)
        setTransferLog([])

        addLog(`Selected: ${file.filename} (${file.data.length} bytes)`)
        addLog(`CRC: 0x${fileCrc.toString(16).toUpperCase().padStart(4, '0')}`)
        addLog(`Packets: ${Math.ceil(file.data.length / 241)}`)
        addLog('Starting transfer...')

        abortRef.current = new AbortController()

        try {
            const transferResult = await runFileTransferPipeline(device, {
                filename: file.filename,
                data: file.data,
                onProgress: (p) => {
                    if (!unmountedRef.current) setProgress(p)
                },
                abortSignal: abortRef.current.signal,
            })

            if (unmountedRef.current) return

            addLog(`✅ Transfer complete in ${(transferResult.durationMs / 1000).toFixed(1)}s`)
            addLog(`File "${transferResult.filename}" is now on the SD card at /MANIFEST/`)
            setResult({
                success: true,
                message: `${file.filename} transferred successfully!`,
                details: `${transferResult.sizeBytes} bytes in ${(transferResult.durationMs / 1000).toFixed(1)}s · CRC verified`,
            })
        } catch (err: any) {
            if (unmountedRef.current) return

            const errorCode = err.errorCode
            const friendlyMsg = errorCode ? getErrorMessage(errorCode) : err.message
            addLog(`❌ Failed: ${friendlyMsg}`)
            logError('[FileTransferTest]', err)

            setResult({
                success: false,
                message: `Transfer failed: ${friendlyMsg}`,
                details: errorCode ? `Error code ${errorCode} — ${err.reason}` : err.reason || undefined,
            })
        } finally {
            if (!unmountedRef.current) {
                setIsTransferring(false)
                abortRef.current = null
            }
        }
    }, [device, testFiles, addLog])

    const cancelTransfer = useCallback(() => {
        abortRef.current?.abort()
        addLog('⏹ User cancelled transfer')
    }, [addLog])

    const selectedFile = selectedIndex !== null ? testFiles[selectedIndex] : null
    const pct = progress ? progress.percentage / 100 : 0

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <Appbar.Header style={{ backgroundColor: colors.surface }}>
                <Appbar.BackAction onPress={() => navigation.goBack()} disabled={isTransferring} />
                <Appbar.Content title="File Transfer Test" />
            </Appbar.Header>

            <ScrollView contentContainerStyle={[styles.content, { padding: spacing }]}>

                <WWText variant="titleMedium" style={{ marginBottom: spacing / 2 }}>
                    Test Files
                </WWText>
                <WWText variant="bodySmall" style={{ marginBottom: spacing, opacity: 0.7 }}>
                    Select a file to send to the device's SD card via BLE.
                    Steve can compare these on the SD card to verify integrity.
                </WWText>

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
                                <Chip compact textStyle={{ fontSize: 10 }}>
                                    <Text>CRC: 0x{fileCrc.toString(16).toUpperCase().padStart(4, '0')}</Text>
                                </Chip>
                            </View>
                            <WWText variant="bodySmall" style={{ opacity: 0.7, marginBottom: 8 }}>
                                {file.description}
                            </WWText>
                            <Button
                                mode={selectedIndex === i && isTransferring ? 'outlined' : 'contained'}
                                compact
                                disabled={isTransferring && selectedIndex !== i}
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
                            style={{ height: 8, borderRadius: 4, marginBottom: spacing / 2 }}
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
                            <WWText variant="bodySmall" style={{ textTransform: 'uppercase' }}>
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
                                style={{ opacity: 0.7, color: result.success ? colors.onPrimaryContainer : colors.onErrorContainer }}
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
})
