import { View, StyleSheet, ScrollView } from 'react-native'
import { Button, ActivityIndicator, ProgressBar, IconButton } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation } from '@react-navigation/native'

import { useExtendedTheme } from '../../theme'
import { useAppSelector } from '../../redux'
import { WWText } from '../../components/ui/WWText'
import { useFirmwareUpdate, FirmwareTarget } from './hooks/useFirmwareUpdate'

const TARGET_TITLES: Record<FirmwareTarget, string> = {
    ble: 'BLE Firmware Update',
    himax: 'AI Processor Firmware Update',
}

const TARGET_DESCRIPTIONS: Record<FirmwareTarget, string> = {
    ble: 'Downloads the latest BLE firmware from the cloud and flashes it via Nordic DFU. The device will reboot into a bootloader, apply the update, then reconnect.',
    himax: 'Flashes the Himax AI processor using output.img from the SD card (/MANIFEST/ directory). Ensure the correct firmware file is on the SD card before starting.',
}

export const FirmwareUpdateScreen = () => {
    const route = useRoute<any>()
    const navigation = useNavigation<any>()
    const { colors, spacing } = useExtendedTheme()

    const deviceId = route.params?.deviceId
    const target: FirmwareTarget = route.params?.target || 'himax'
    const device = useAppSelector(state => state.devices[deviceId || ''])

    const {
        progress,
        statusLabel,
        isUpdating,
        isComplete,
        isFailed,
        progressLogs,
        errorMsg,
        batteryLevel,
        isBatteryLow,
        previousVersion,
        newVersion,
        latestFirmware,
        isPreflightDone,
        startUpdate,
    } = useFirmwareUpdate({ target, device })

    const title = TARGET_TITLES[target]
    const description = TARGET_DESCRIPTIONS[target]

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <ScrollView contentContainerStyle={[styles.content, { padding: spacing }]}>

                <WWText variant="titleLarge" style={{ marginBottom: spacing }}>
                    {title}
                </WWText>

                <WWText style={{ marginBottom: spacing }}>
                    {description}
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

                        {/* Current version */}
                        <View style={styles.preflightRow}>
                            <WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                                Current Version
                            </WWText>
                            <WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                                {previousVersion || (isPreflightDone ? 'Unknown' : '...')}
                            </WWText>
                        </View>

                        {/* Latest available */}
                        {latestFirmware && (
                            <View style={styles.preflightRow}>
                                <WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                                    Latest Available
                                </WWText>
                                <WWText variant="bodyMedium" style={{ color: colors.primary }}>
                                    {latestFirmware.version}
                                </WWText>
                            </View>
                        )}
                    </View>
                )}

                {/* ── Battery Warning ── */}
                {isBatteryLow && !isComplete && (
                    <View style={[styles.warningBanner, { marginBottom: spacing }]}>
                        <WWText style={styles.warningText}>
                            ⚠️ Battery is below 30%. Updating with low battery risks bricking the device. Charge before continuing.
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
                    {(isUpdating || isComplete) && (
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
                    {isUpdating && !isComplete && (
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
                {isComplete && !isUpdating && (
                    <View style={[styles.successBox, { marginBottom: spacing * 2 }]}>
                        <View style={styles.successHeader}>
                            <IconButton icon="check-circle" iconColor="#A5D6A7" size={28} style={styles.margin0} />
                            <WWText variant="titleMedium" style={styles.successTitle}>
                                Firmware Updated Successfully
                            </WWText>
                        </View>

                        {previousVersion && (
                            <WWText variant="bodyMedium" style={styles.successText}>
                                Previous: {previousVersion}
                            </WWText>
                        )}
                        {newVersion && (
                            <WWText variant="bodyMedium" style={styles.successTextNoMargin}>
                                New: {newVersion}
                            </WWText>
                        )}
                        {previousVersion && newVersion && previousVersion === newVersion && (
                            <WWText variant="bodySmall" style={styles.warningInfoText}>
                                ⓘ Versions match — the firmware image may be the same build.
                            </WWText>
                        )}
                        {!newVersion && (
                            <WWText variant="bodySmall" style={styles.successSubText}>
                                Device was sent the reset command. The new firmware will be active on the next boot.
                            </WWText>
                        )}
                    </View>
                )}

                {/* ── Action Buttons ── */}
                {!isComplete && !isUpdating && (
                    <Button
                        mode="contained"
                        onPress={startUpdate}
                        disabled={!device?.connected || !isPreflightDone}
                        loading={!isPreflightDone}
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
    successTextNoMargin: {
        color: '#E8F5E9',
    },
    warningInfoText: {
        color: '#FFCC80',
        marginTop: 4,
    },
    successSubText: {
        color: '#E8F5E9',
        marginTop: 4,
    },
})
