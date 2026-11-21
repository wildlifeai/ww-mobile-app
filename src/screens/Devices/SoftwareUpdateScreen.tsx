import { useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Button, Checkbox, ProgressBar } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'

import { useExtendedTheme } from '../../theme'
import { useAppSelector } from '../../redux'
import { WWText } from '../../components/ui/WWText'
import { transferLine, updateStep } from '../../utils/firmwareWords'
import { useSoftwareUpdate } from './hooks/useSoftwareUpdate'

export const SOFTWARE_UP_TO_DATE = "The camera's software is up to date."
export const SOFTWARE_STOPPED = 'The update stopped. Tap Update software to finish.'

/**
 * Update software (#529): the camera's whole update from Start Monitoring, one
 * bar and the update's own log lines under it. No processors and no versions:
 * those are the Engineer Console's (FirmwareUpdateScreen with engineer).
 */
export const SoftwareUpdateScreen = () => {
    const route = useRoute<any>()
    const navigation = useNavigation<any>()
    const { colors, spacing } = useExtendedTheme()
    const device = useAppSelector(state => state.devices[route.params?.deviceId || ''])

    const update = useSoftwareUpdate({ device })
    const { isPreflightDone, plan, state, isBatteryLow } = update

    // One battery question, before the first step, covering all of them
    const [externalPowerConfirmed, setExternalPowerConfirmed] = useState(false)
    const batteryBlocks = isBatteryLow && !externalPowerConfirmed

    // The person asked for the update on Start Monitoring: it starts once the
    // camera is read, unless the battery needs an answer first
    const started = useRef(false)
    useEffect(() => {
        if (started.current || state !== 'idle' || !isPreflightDone || plan.length === 0 || isBatteryLow) return
        started.current = true
        update.start()
    }, [state, isPreflightDone, plan.length, isBatteryLow, update])

    const ready = state === 'idle'
    const running = state === 'running'

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <ScrollView contentContainerStyle={[styles.content, { padding: spacing, gap: spacing }]}>
                {ready && !isPreflightDone && <WWText variant="bodyLarge">Checking the camera…</WWText>}

                {ready && isPreflightDone && plan.length === 0 && (
                    <>
                        <WWText variant="bodyLarge">{SOFTWARE_UP_TO_DATE}</WWText>
                        <Button mode="contained" onPress={() => navigation.goBack()}>Done</Button>
                    </>
                )}

                {ready && isPreflightDone && plan.length > 0 && isBatteryLow && (
                    <>
                        <View>
                            <WWText style={{ color: colors.error }}>
                                Battery at {update.batteryLevel ?? '?'}%. Charge the camera before updating.
                            </WWText>
                            <View style={styles.checkRow}>
                                <Checkbox.Android
                                    status={externalPowerConfirmed ? 'checked' : 'unchecked'}
                                    onPress={() => setExternalPowerConfirmed(confirmed => !confirmed)}
                                />
                                <WWText style={styles.flex1} onPress={() => setExternalPowerConfirmed(confirmed => !confirmed)}>
                                    It's on USB power, update anyway
                                </WWText>
                            </View>
                        </View>
                        <Button mode="contained" onPress={update.start} disabled={batteryBlocks}>
                            Update software
                        </Button>
                    </>
                )}

                {running && (
                    <View style={{ gap: spacing / 2 }}>
                        <WWText>{update.logs.length > 0 || update.phase !== 'idle'
                            ? updateStep(update.target, update.phase, update.pairProgress)
                            : 'Checking the camera'}</WWText>
                        <ProgressBar progress={update.progress} color={colors.primary} style={styles.bar} />
                    </View>
                )}

                {state === 'failed' && (
                    <>
                        <WWText style={{ color: colors.error }}>{SOFTWARE_STOPPED}</WWText>
                        <Button mode="contained" onPress={update.start} disabled={batteryBlocks}>
                            Update software
                        </Button>
                    </>
                )}

                {state === 'complete' && (
                    <>
                        <WWText variant="bodyLarge">{SOFTWARE_UP_TO_DATE}</WWText>
                        <Button mode="contained" onPress={() => navigation.goBack()}>Done</Button>
                    </>
                )}

                {/* What the update is doing, as the update screen shows it; kept
                    after it ends, when it is what a report needs */}
                {!ready && (update.logs.length > 0 || update.errorMsg) && (
                    <View style={{ gap: spacing / 4 }}>
                        {update.logs.map((line, idx) => (
                            <WWText key={line + idx.toString()} variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                                {line}
                            </WWText>
                        ))}
                        {state === 'failed' && update.errorMsg && (
                            <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{update.errorMsg}</WWText>
                        )}
                        {running && update.transfer && update.transfer.totalBytes > 0 && (
                            <View style={styles.transfer}>
                                <ProgressBar progress={update.transfer.percentage / 100} color={colors.primary} style={styles.smallBar} />
                                <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                                    {transferLine(update.transfer.bytesSent, update.transfer.totalBytes,
                                        update.transfer.elapsedMs, update.transfer.estimatedRemainingMs)}
                                </WWText>
                            </View>
                        )}
                    </View>
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
    checkRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    flex1: {
        flex: 1,
    },
    bar: {
        height: 8,
        borderRadius: 4,
    },
    transfer: {
        gap: 4,
        paddingLeft: 12,
    },
    smallBar: {
        height: 4,
        borderRadius: 2,
    },
})
