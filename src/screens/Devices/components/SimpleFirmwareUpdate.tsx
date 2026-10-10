import { View, StyleSheet, ScrollView } from 'react-native'
import { Button, Checkbox, ProgressBar } from 'react-native-paper'

import { useExtendedTheme } from '../../../theme'
import { WWText } from '../../../components/ui/WWText'
import type { FirmwareTarget, UpdatePhase } from '../hooks/useFirmwareUpdate'
import { missingFirmware, transferLine, updateResult, updateStep, updateSummary } from '../../../utils/firmwareWords'

export interface SimpleFirmwareUpdateProps {
    target: FirmwareTarget
    currentVersion: string | null
    latestVersion: string | null
    upToDate: boolean
    isPreflightDone: boolean
    /** Whether there is an image to install, on the SD card, the phone or in the cloud */
    canStart: boolean
    /** AI only: the camera whose build the catalogue lacks, which stops the pair update (#437) */
    missingVariant?: 'RP3' | 'HM0360' | null
    batteryLevel: number | null
    isBatteryLow: boolean
    externalPowerConfirmed: boolean
    onExternalPowerChange: (confirmed: boolean) => void
    isUpdating: boolean
    isComplete: boolean
    isFailed: boolean
    phase: UpdatePhase
    progress: number
    pairProgress: { total: number; done: number } | null
    errorMsg: string | null
    newVersion: string | null
    /** The update's last steps, as the hook logs them: shown under the bar so the operator sees what it is doing */
    logs: string[]
    /** An image on its way to the camera: a smaller bar and line under the log */
    transfer?: { percentage: number; bytesSent: number; totalBytes: number; elapsedMs: number; estimatedRemainingMs: number } | null
    onStart: () => void
    onDone: () => void
}

/**
 * The firmware update an operator sees (#344): which version to which, one
 * button, one bar and one status line while it runs with its last few steps
 * under it, one line at the end. The build picker and the SD-card source are
 * the Engineer Console's view of the same screen.
 */
export const SimpleFirmwareUpdate = ({
    target,
    currentVersion,
    latestVersion,
    upToDate,
    isPreflightDone,
    canStart,
    missingVariant,
    batteryLevel,
    isBatteryLow,
    externalPowerConfirmed,
    onExternalPowerChange,
    isUpdating,
    isComplete,
    isFailed,
    phase,
    progress,
    pairProgress,
    errorMsg,
    newVersion,
    logs,
    transfer,
    onStart,
    onDone,
}: SimpleFirmwareUpdateProps) => {
    const { colors, spacing } = useExtendedTheme()
    const ready = !isUpdating && !isComplete && !isFailed
    const batteryBlocks = isBatteryLow && !externalPowerConfirmed
    const partial = isFailed && pairProgress && pairProgress.done > 0 && pairProgress.done < pairProgress.total

    return (
        <ScrollView contentContainerStyle={[styles.content, { padding: spacing, gap: spacing }]}>
            {ready && (
                <>
                    <WWText variant="bodyLarge">
                        {isPreflightDone ? updateSummary(currentVersion, latestVersion, upToDate) : 'Checking the camera…'}
                    </WWText>

                    {isPreflightDone && !upToDate && !canStart && (
                        <WWText style={{ color: colors.error }}>
                            {missingVariant
                                ? `${missingFirmware(missingVariant)}. Try again later.`
                                : 'The new firmware is not on this phone yet. Connect to the internet, then open this screen again.'}
                        </WWText>
                    )}

                    {isBatteryLow && (
                        <View>
                            <WWText style={{ color: colors.error }}>
                                Battery at {batteryLevel ?? '?'}%. Charge the camera before updating.
                            </WWText>
                            <View style={styles.checkRow}>
                                <Checkbox.Android
                                    status={externalPowerConfirmed ? 'checked' : 'unchecked'}
                                    onPress={() => onExternalPowerChange(!externalPowerConfirmed)}
                                />
                                <WWText style={styles.flex1} onPress={() => onExternalPowerChange(!externalPowerConfirmed)}>
                                    It's on USB power, update anyway
                                </WWText>
                            </View>
                        </View>
                    )}

                    {!upToDate && (
                        <Button
                            mode="contained"
                            onPress={onStart}
                            loading={!isPreflightDone}
                            disabled={!isPreflightDone || !canStart || batteryBlocks}
                        >
                            Update
                        </Button>
                    )}
                </>
            )}

            {isUpdating && (
                <View style={{ gap: spacing / 2 }}>
                    <WWText>{updateStep(target, phase, pairProgress)}</WWText>
                    <ProgressBar progress={progress} color={colors.primary} style={styles.bar} />
                </View>
            )}

            {isFailed && !isUpdating && (
                <>
                    <WWText style={{ color: colors.error }}>
                        {partial
                            ? `${pairProgress!.done} of ${pairProgress!.total} images installed. Try again to finish.`
                            : (errorMsg || 'The update did not finish.')}
                    </WWText>
                    <Button mode="contained" onPress={onStart} disabled={batteryBlocks}>
                        Try again
                    </Button>
                </>
            )}

            {isComplete && !isUpdating && (
                <>
                    <WWText variant="bodyLarge">{updateResult(newVersion)}</WWText>
                    <Button mode="contained" onPress={onDone}>
                        Done
                    </Button>
                </>
            )}

            {/* What the update is doing, so a long wait is not just a bar;
                kept after it ends, when it is what a report needs */}
            {!ready && logs.length > 0 && (
                <View style={{ gap: spacing / 4 }}>
                    {logs.map((line, idx) => (
                        <WWText key={line + idx.toString()} variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                            {line}
                        </WWText>
                    ))}
                    {/* Under "Transferring firmware...": how much is across, how fast, how long */}
                    {isUpdating && transfer && transfer.totalBytes > 0 && (
                        <View style={styles.transfer}>
                            <ProgressBar progress={transfer.percentage / 100} color={colors.primary} style={styles.smallBar} />
                            <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                                {transferLine(transfer.bytesSent, transfer.totalBytes, transfer.elapsedMs, transfer.estimatedRemainingMs)}
                            </WWText>
                        </View>
                    )}
                </View>
            )}
        </ScrollView>
    )
}

const styles = StyleSheet.create({
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
