import { useState, useCallback, useEffect, useRef } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Button, ActivityIndicator, ProgressBar, IconButton } from 'react-native-paper'
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
    waking:    0.10,
    erasing:   0.25,
    writing:   0.60,
    verifying: 0.85,
    complete:  1.0,
    failed:    0,
}

const PHASE_LABEL: Record<UpdatePhase, string> = {
    idle:      'Ready to update.',
    sending:   'Sending firmware update command...',
    waking:    'Waking AI processor & running selftest...',
    erasing:   'Erasing flash slot...',
    writing:   'Writing firmware to flash...',
    verifying: 'Verifying written firmware...',
    complete:  'Update complete!',
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

    // Version tracking
    const [previousVersion, setPreviousVersion] = useState<string | null>(null)
    const [newVersion, setNewVersion] = useState<string | null>(null)
    const [isQueryingVersion, setIsQueryingVersion] = useState(false)

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

    // Query AI processor version on mount so we have a "before" value
    useEffect(() => {
        if (!device?.connected) return
        let cancelled = false

        const queryVersion = async () => {
            setIsQueryingVersion(true)
            try {
                const session = createBleSession(device)
                const ver = await session.execute(() => commandRegistry.aiver())
                if (!cancelled) {
                    setPreviousVersion(ver)
                    log(`[HimaxFirmwareUpdate] Current AI version: ${ver}`)
                }
            } catch (e) {
                log(`[HimaxFirmwareUpdate] Could not query AI version: ${e}`)
                // Non-fatal — just means we can't show "from version X"
            } finally {
                if (!cancelled) setIsQueryingVersion(false)
            }
        }

        queryVersion()
        return () => { cancelled = true }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                } else if (/Firmware update OK/i.test(line)) {
                    // nRF52 may not relay intermediate lines, so jump directly
                    // to complete when we see the final OK over UART
                    advancePhase('complete')
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

    // Query the new AI version after update + reset
    const queryNewVersion = useCallback(async () => {
        if (!device?.connected) return
        try {
            const session = createBleSession(device)
            const ver = await session.execute(() => commandRegistry.aiver())
            if (!unmountedRef.current) {
                setNewVersion(ver)
                log(`[HimaxFirmwareUpdate] New AI version after update: ${ver}`)
            }
        } catch (e) {
            log(`[HimaxFirmwareUpdate] Could not query new AI version: ${e}`)
        }
    }, [device])

    const startUpdate = useCallback(async () => {
        if (!device?.connected) {
            setErrorMsg('Device disconnected.')
            return
        }

        setIsUpdating(true)
        setErrorMsg(null)
        setNewVersion(null)
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

            // Stay on this screen and query the new version if still connected
            if (!unmountedRef.current) {
                // Give the device a moment to reboot and the BLE stack to stabilize
                await new Promise(resolve => setTimeout(resolve, 3000))
                await queryNewVersion()
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
    }, [device, advancePhase, waitForDeviceReady, queryNewVersion])

    const progress = PHASE_PROGRESS[phase]
    const statusLabel = PHASE_LABEL[phase]
    const isComplete = phase === 'complete'
    const isFailed = phase === 'failed'

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <ScrollView contentContainerStyle={[styles.content, { padding: spacing }]}>
                
                <WWText variant="titleLarge" style={{ marginBottom: spacing }}>
                    AI Processor Firmware Update
                </WWText>
                
                <WWText style={{ marginBottom: spacing }}>
                    Updates the Himax AI processor using {"`output.img`"} from the device's SD card.
                </WWText>

                {/* Current version display */}
                {previousVersion && !isComplete && (
                    <View style={[styles.versionBox, { backgroundColor: colors.surfaceVariant, marginBottom: spacing }]}>
                        <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                            Current AI version
                        </WWText>
                        <WWText variant="titleSmall" style={{ color: colors.onSurfaceVariant }}>
                            {previousVersion}
                        </WWText>
                    </View>
                )}

                {!isComplete && (
                    <WWText style={{ marginBottom: spacing * 2, color: colors.error }}>
                        Do not close the app or disconnect the device during this process. It takes approximately 20-60 seconds.
                    </WWText>
                )}

                <View style={[styles.statusBox, { backgroundColor: colors.surfaceVariant, marginBottom: spacing * 2 }]}>
                    <WWText variant="titleMedium" style={[styles.statusTitle, { color: colors.onSurfaceVariant }]}>
                        Status
                    </WWText>
                    <WWText style={{ color: colors.onSurfaceVariant }}>{statusLabel}</WWText>
                    
                    {/* Deterministic progress bar based on detected phase */}
                    {(isUpdating || isComplete) && (
                        <View style={styles.marginTop16}>
                            <ProgressBar 
                                progress={progress} 
                                color={isComplete ? colors.primary : colors.primary} 
                                style={styles.progressBar} 
                            />
                            <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant, textAlign: 'right', marginTop: 4 }}>
                                {Math.round(progress * 100)}%
                            </WWText>
                        </View>
                    )}

                    {isUpdating && !isComplete && (
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

                {/* Success: show version comparison */}
                {isComplete && !isUpdating && (
                    <View style={[styles.successBox, { backgroundColor: '#1B5E20', marginBottom: spacing * 2 }]}>
                        <View style={styles.successHeader}>
                            <IconButton icon="check-circle" iconColor="#A5D6A7" size={28} style={{ margin: 0 }} />
                            <WWText variant="titleMedium" style={{ color: '#A5D6A7', flex: 1 }}>
                                Firmware Updated Successfully
                            </WWText>
                        </View>

                        {previousVersion && (
                            <WWText variant="bodyMedium" style={{ color: '#E8F5E9', marginTop: 8 }}>
                                Previous version: {previousVersion}
                            </WWText>
                        )}
                        {newVersion && (
                            <WWText variant="bodyMedium" style={{ color: '#E8F5E9' }}>
                                New version: {newVersion}
                            </WWText>
                        )}
                        {previousVersion && newVersion && previousVersion === newVersion && (
                            <WWText variant="bodySmall" style={{ color: '#FFCC80', marginTop: 4 }}>
                                ⓘ Versions match — the firmware image may be the same build.
                            </WWText>
                        )}
                        {!newVersion && (
                            <WWText variant="bodySmall" style={{ color: '#E8F5E9', marginTop: 4 }}>
                                Device has been sent the reset command. The new firmware will be active on the next boot.
                            </WWText>
                        )}
                    </View>
                )}

                {/* Action buttons */}
                {!isComplete && !isUpdating && (
                    <Button 
                        mode="contained" 
                        onPress={startUpdate} 
                        disabled={!device?.connected || isQueryingVersion}
                        loading={isQueryingVersion}
                    >
                        <WWText>{isFailed ? 'Retry Update' : 'Start Update'}</WWText>
                    </Button>
                )}

                {isComplete && !isUpdating && (
                    <Button 
                        mode="contained" 
                        onPress={() => navigation.goBack()}
                    >
                        <WWText>Back to Engineer Console</WWText>
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
    versionBox: {
        padding: 12,
        borderRadius: 8,
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
    },
    successBox: {
        padding: 16,
        borderRadius: 8,
    },
    successHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
})
