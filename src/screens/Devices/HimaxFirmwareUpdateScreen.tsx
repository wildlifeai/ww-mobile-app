import { useState, useCallback, useEffect, useRef } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Button, ActivityIndicator, ProgressBar } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation } from '@react-navigation/native'

import { useExtendedTheme } from '../../theme'
import { useAppSelector } from '../../redux'
import { WWText } from '../../components/ui/WWText'
import { logError, log } from '../../utils/logger'
import { createBleSession } from '../../ble/session/createBleSession'
import { commandRegistry } from '../../ble/protocol/commandRegistry'
import { bleEventBus } from '../../ble/protocol/eventBus'

/**
 * Firmware update phases synthesised from UART output.
 * Since the HX6538 doesn't emit structured progress markers,
 * we infer progress from known log lines relayed by the nRF52.
 *
 * Phase weights approximate wall-clock proportions of a typical
 * ~442 KB update (~20-60 seconds total).
 */
type UpdatePhase = 'idle' | 'sending' | 'waking' | 'erasing' | 'writing' | 'verifying' | 'complete' | 'failed'

const PHASE_PROGRESS: Record<UpdatePhase, number> = {
    idle:      0,
    sending:   0.05,
    waking:    0.08,
    erasing:   0.15,
    writing:   0.60,
    verifying: 0.85,
    complete:  1.0,
    failed:    0,
}

const PHASE_LABEL: Record<UpdatePhase, string> = {
    idle:      'Ready to update.',
    sending:   'Sending firmware update command...',
    waking:    'Waking AI processor...',
    erasing:   'Erasing flash slot...',
    writing:   'Writing firmware to flash...',
    verifying: 'Verifying written firmware...',
    complete:  'Update successful! Rebooting device...',
    failed:    'Update failed.',
}

export const HimaxFirmwareUpdateScreen = () => {
    const route = useRoute<any>()
    const navigation = useNavigation<any>()
    const { colors, spacing } = useExtendedTheme()
    
    const deviceId = route.params?.deviceId
    const device = useAppSelector(state => state.devices[deviceId || ''])

    const [isUpdating, setIsUpdating] = useState(false)
    const [phase, setPhase] = useState<UpdatePhase>('idle')
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [progressLogs, setProgressLogs] = useState<string[]>([])

    const unmountedRef = useRef(false)
    const phaseRef = useRef<UpdatePhase>('idle')

    // Keep ref in sync for use inside event listeners
    const advancePhase = useCallback((newPhase: UpdatePhase) => {
        // Only advance forward, never backward (except to failed)
        const ordering: UpdatePhase[] = ['idle', 'sending', 'waking', 'erasing', 'writing', 'verifying', 'complete']
        const currentIdx = ordering.indexOf(phaseRef.current)
        const newIdx = ordering.indexOf(newPhase)
        if (newPhase === 'failed' || newIdx > currentIdx) {
            phaseRef.current = newPhase
            setPhase(newPhase)
        }
    }, [])

    useEffect(() => {
        return () => {
            unmountedRef.current = true
        }
    }, [])

    // Listen for UART lines to synthesise progress phases and capture logs
    useEffect(() => {
        if (!isUpdating) return
        
        const onRx = (event: any) => {
            if (event.type === 'RAW_RX' && event.deviceId === device?.id) {
                const line: string = event.line

                // Phase detection from known nRF52/HX6538 UART output
                if (line.includes('Wake') && !line.includes('Wakeup_event')) {
                    advancePhase('waking')
                } else if (line.includes('Erasing firmware slot') || line.includes('erased OK')) {
                    advancePhase('erasing')
                } else if (line.includes('Writing') && line.includes('bytes to firmware')) {
                    advancePhase('writing')
                } else if (line.includes('chunk-verified OK') || line.includes('full verify OK')) {
                    advancePhase('verifying')
                } else if (line.includes('slot selector') && line.includes('written OK')) {
                    advancePhase('verifying')
                }

                // Capture relevant log lines for display (last 5)
                if (
                    line.includes('Erasing') || 
                    line.toLowerCase().includes('writing') || 
                    line.toLowerCase().includes('firmware update') ||
                    line.toLowerCase().includes('verified') ||
                    line.toLowerCase().includes('verify') ||
                    line.includes('bytes written') ||
                    line.includes('erased OK') ||
                    line.includes('slot selector')
                ) {
                    setProgressLogs(prev => {
                        const newLogs = [...prev, line]
                        return newLogs.slice(-5)
                    })
                }
            }
        }
        bleEventBus.on('rawRx', onRx)
        return () => { bleEventBus.removeListener('rawRx', onRx) }
    }, [isUpdating, device?.id, advancePhase])

    // Wait for the "Sleep" line from the nRF52, indicating the device has finished
    // its state machine and is ready for a reset. Falls back to a 5-second timeout
    // if the Sleep line is never received.
    const waitForDeviceReady = useCallback((): Promise<void> => {
        return new Promise((resolve) => {
            let resolved = false
            const cleanup = () => {
                bleEventBus.removeListener('rawRx', onRx)
                clearTimeout(fallbackTimeout)
            }
            const done = () => {
                if (resolved) return
                resolved = true
                cleanup()
                resolve()
            }

            const onRx = (event: any) => {
                if (event.type === 'RAW_RX' && event.deviceId === device?.id) {
                    if (event.line.startsWith('Sleep')) {
                        log('[HimaxFirmwareUpdate] Device sent Sleep — ready for reset')
                        done()
                    }
                }
            }

            bleEventBus.on('rawRx', onRx)

            // Fallback: if we never receive Sleep, proceed anyway after 5s
            const fallbackTimeout = setTimeout(() => {
                log('[HimaxFirmwareUpdate] Sleep not received within 5s — proceeding with reset')
                done()
            }, 5000)
        })
    }, [device?.id])

    const startUpdate = useCallback(async () => {
        if (!device?.connected) {
            setErrorMsg('Device disconnected.')
            return
        }

        setIsUpdating(true)
        setErrorMsg(null)
        advancePhase('sending')
        setProgressLogs([])

        try {
            const session = createBleSession(device)
            
            // Invoke the aifirmware command which performs ERASE and FLASH.
            // Heartbeat pause and transport lock are handled automatically
            // by the protocol layer (aifirmware has isLongRunning + requiresExclusiveLock).
            await session.execute(() => commandRegistry.aifirmware('output.img'))
            
            if (unmountedRef.current) return

            advancePhase('complete')

            // Wait for the device to finish its AI state machine (Sleep line)
            // before sending reset, instead of an arbitrary fixed delay.
            await waitForDeviceReady()

            if (unmountedRef.current) return

            // Reboot the device to boot into the new firmware slot
            try {
                const postSession = createBleSession(device)
                await postSession.execute(() => commandRegistry.reset())
            } catch (e) {
                // Usually throws because BLE drops exactly when reset happens. This is OK.
            }
            if (!unmountedRef.current) {
                navigation.navigate('Home', { initialTab: 'devices' })
            }

        } catch (err: any) {
            if (!unmountedRef.current) {
                logError('[HimaxFirmwareUpdate] Update failed:', err)
                setErrorMsg(err.message || String(err))
                advancePhase('failed')
            }
        } finally {
            if (!unmountedRef.current) {
                setIsUpdating(false)
            }
        }
    }, [device, navigation, advancePhase, waitForDeviceReady])

    const progress = PHASE_PROGRESS[phase]
    const statusLabel = PHASE_LABEL[phase]
    const isComplete = phase === 'complete'
    const isFailed = phase === 'failed'

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <ScrollView contentContainerStyle={[styles.content, { padding: spacing }]}>
                
                <WWText variant="titleLarge" style={{ marginBottom: spacing }}>
                    SD Card Update
                </WWText>
                
                <WWText style={{ marginBottom: spacing }}>
                    This flow updates the Himax AI processor using an `output.img` file stored in the `/MANIFEST/` directory of the device's SD Card.
                </WWText>
                <WWText style={{ marginBottom: spacing * 2, color: colors.error }}>
                    Do not close the app or disconnect the device during this process. It takes approximately 1-2 minutes.
                </WWText>

                <View style={[styles.statusBox, { backgroundColor: colors.surfaceVariant, marginBottom: spacing * 2 }]}>
                    <WWText variant="titleMedium" style={[styles.statusTitle, { color: colors.onSurfaceVariant }]}>Status</WWText>
                    <WWText style={{ color: colors.onSurfaceVariant }}>{statusLabel}</WWText>
                    
                    {/* Deterministic progress bar based on detected phase */}
                    {isUpdating && (
                        <View style={styles.marginTop16}>
                            <ProgressBar 
                                progress={progress} 
                                color={colors.primary} 
                                style={styles.progressBar} 
                            />
                            <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant, textAlign: 'right', marginTop: 4 }}>
                                {Math.round(progress * 100)}%
                            </WWText>
                        </View>
                    )}

                    {isUpdating && (
                        <View style={styles.marginTop16}>
                            <ActivityIndicator animating={true} color={colors.primary} size="large" />
                        </View>
                    )}

                    {progressLogs.length > 0 && (
                        <View style={styles.marginTop16}>
                            {progressLogs.map((logLine, idx) => (
                                <WWText key={`fwlog-${idx}-${logLine.substring(0, 20)}`} variant="bodySmall" style={[styles.logText, { color: colors.onSurfaceVariant }]}>
                                    → {logLine}
                                </WWText>
                            ))}
                        </View>
                    )}

                    {errorMsg && (
                        <WWText style={[styles.marginTop16, { color: colors.error }]}>Error: {errorMsg}</WWText>
                    )}
                </View>

                {!isComplete && !isUpdating && (
                    <Button 
                        mode="contained" 
                        onPress={startUpdate} 
                        disabled={!device?.connected}
                    >
                        <WWText>{isFailed ? 'Retry Update' : 'Start Update'}</WWText>
                    </Button>
                )}

            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
    },
    statusBox: {
        padding: 16,
        borderRadius: 8,
    },
    statusTitle: {
        marginBottom: 8,
    },
    marginTop16: {
        marginTop: 16,
    },
    progressBar: {
        height: 8,
        borderRadius: 4,
    },
    logText: {
        opacity: 0.7,
    }
})
