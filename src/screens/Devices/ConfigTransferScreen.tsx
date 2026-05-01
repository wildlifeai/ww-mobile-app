import { View, StyleSheet, ScrollView } from 'react-native'
import { Button, ActivityIndicator, ProgressBar, IconButton } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation } from '@react-navigation/native'

import { useExtendedTheme } from '../../theme'
import { useAppSelector } from '../../redux'
import { WWText } from '../../components/ui/WWText'
import { useConfigTransfer } from './hooks/useConfigTransfer'

export const ConfigTransferScreen = () => {
    const route = useRoute<any>()
    const navigation = useNavigation<any>()
    const { colors, spacing } = useExtendedTheme()

    const deviceId = route.params?.deviceId
    const device = useAppSelector(state => state.devices[deviceId || ''])

    const {
        batteryLevel,
        latestConfig,
        isPreflightDone,
        progress,
        statusLabel,
        isTransferring,
        isComplete,
        isFailed,
        errorMsg,
        progressLogs,
        startTransfer,
    } = useConfigTransfer({ device })

    const isBatteryLow = batteryLevel !== null && batteryLevel < 30

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <ScrollView contentContainerStyle={[styles.content, { padding: spacing }]}>

                <WWText variant="titleLarge" style={{ marginBottom: spacing }}>
                    Config Transfer
                </WWText>

                <WWText style={{ marginBottom: spacing }}>
                    Downloads the latest configuration file from the cloud and transfers it to the
                    device SD card as CONFIG.TXT. No reboot is required — the device reads the
                    new config on the next wake cycle.
                </WWText>

                {/* ── Pre-flight Info ── */}
                {!isComplete && (
                    <View style={[styles.card, styles.marginBottom8, { backgroundColor: colors.surfaceVariant }]}>
                        <WWText variant="titleSmall" style={[styles.marginBottom8, { color: colors.onSurfaceVariant }]}>
                            Pre-flight
                        </WWText>

                        {/* Battery */}
                        <View style={styles.preflightRow}>
                            <WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                                Battery
                            </WWText>
                            <WWText variant="bodyMedium" style={{ color: isBatteryLow ? colors.error : colors.onSurfaceVariant }}>
                                {batteryLevel !== null ? `${batteryLevel}%` : '—'}
                                {isBatteryLow ? ' ⚠️ Low' : batteryLevel !== null ? ' ✓' : ''}
                            </WWText>
                        </View>

                        {/* Latest config version */}
                        <View style={styles.preflightRow}>
                            <WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                                Latest Config Version
                            </WWText>
                            <WWText variant="bodyMedium" style={{ color: colors.primary }}>
                                {latestConfig?.version ?? (isPreflightDone ? 'None available' : '...')}
                            </WWText>
                        </View>

                        {/* File size */}
                        {latestConfig && (
                            <View style={styles.preflightRow}>
                                <WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                                    File Size
                                </WWText>
                                <WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                                    {latestConfig.fileSizeBytes > 0
                                        ? `${(latestConfig.fileSizeBytes / 1024).toFixed(1)} KB`
                                        : 'Unknown'}
                                </WWText>
                            </View>
                        )}
                    </View>
                )}

                {/* ── Battery Warning ── */}
                {isBatteryLow && !isComplete && (
                    <View style={[styles.warningBanner, { marginBottom: spacing }]}>
                        <WWText style={styles.warningText}>
                            ⚠️ Battery is below 30%. Transfer should still work but charge soon.
                        </WWText>
                    </View>
                )}

                {/* ── Status Panel ── */}
                <View style={[styles.card, { backgroundColor: colors.surfaceVariant, marginBottom: spacing * 2 }]}>
                    <WWText variant="titleSmall" style={[styles.marginBottom8, { color: colors.onSurfaceVariant }]}>
                        Status
                    </WWText>
                    <WWText style={{ color: colors.onSurfaceVariant }}>
                        {statusLabel}
                    </WWText>

                    {/* Progress bar */}
                    {(isTransferring || isComplete) && (
                        <View style={styles.marginTop12}>
                            <ProgressBar
                                progress={progress}
                                color={isComplete ? '#4CAF50' : colors.primary}
                                style={styles.progressBar}
                            />
                            <WWText variant="bodySmall" style={[styles.progressText, { color: colors.onSurfaceVariant }]}>
                                {Math.round(progress * 100)}%
                            </WWText>
                        </View>
                    )}

                    {/* Spinner */}
                    {isTransferring && !isComplete && (
                        <View style={styles.marginTop12}>
                            <ActivityIndicator animating color={colors.primary} size="large" />
                        </View>
                    )}

                    {/* Live logs */}
                    {progressLogs.length > 0 && (
                        <View style={styles.marginTop12}>
                            {progressLogs.map((line, idx) => (
                                <WWText key={line + idx.toString()} variant="bodySmall" style={[styles.logText, { color: colors.onSurfaceVariant }]}>
                                    → {line}
                                </WWText>
                            ))}
                        </View>
                    )}

                    {/* Error */}
                    {errorMsg && (
                        <WWText style={[styles.marginTop12, { color: colors.error }]}>
                            Error: {errorMsg}
                        </WWText>
                    )}
                </View>

                {/* ── Success Panel ── */}
                {isComplete && !isTransferring && (
                    <View style={[styles.successBox, { marginBottom: spacing * 2 }]}>
                        <View style={styles.successHeader}>
                            <IconButton icon="check-circle" iconColor="#A5D6A7" size={28} style={styles.margin0} />
                            <WWText variant="titleMedium" style={styles.successTitle}>
                                Config Transferred Successfully
                            </WWText>
                        </View>
                        <WWText variant="bodyMedium" style={styles.successText}>
                            CONFIG.TXT has been written to the device SD card. The device will use the
                            new configuration on the next wake cycle.
                        </WWText>
                    </View>
                )}

                {/* ── Action Buttons ── */}
                {!isComplete && !isTransferring && (
                    <Button
                        mode="contained"
                        onPress={startTransfer}
                        disabled={!device?.connected || !isPreflightDone || !latestConfig}
                        loading={!isPreflightDone}
                    >
                        <WWText>{isFailed ? 'Retry Transfer' : 'Start Transfer'}</WWText>
                    </Button>
                )}

                {isComplete && !isTransferring && (
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
    card: {
        padding: 16,
        borderRadius: 8,
    },
    preflightRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    warningBanner: {
        backgroundColor: '#BF360C',
        padding: 12,
        borderRadius: 8,
    },
    marginTop12: {
        marginTop: 12,
    },
    progressBar: {
        height: 8,
        borderRadius: 4,
    },
    logText: {
        opacity: 0.7,
    },
    successBox: {
        backgroundColor: '#1B5E20',
        padding: 16,
        borderRadius: 8,
    },
    successHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    marginBottom8: {
        marginBottom: 8,
    },
    warningText: {
        color: '#FFF3E0',
    },
    progressText: {
        textAlign: 'right',
        marginTop: 4,
    },
    margin0: {
        margin: 0,
    },
    successTitle: {
        color: '#A5D6A7',
        flex: 1,
    },
    successText: {
        color: '#E8F5E9',
        marginTop: 8,
    },
})
