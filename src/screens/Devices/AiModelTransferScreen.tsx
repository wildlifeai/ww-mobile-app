import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { Button, ActivityIndicator, ProgressBar, IconButton, RadioButton } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation } from '@react-navigation/native'

import { useExtendedTheme } from '../../theme'
import { useAppSelector } from '../../redux'
import { WWText } from '../../components/ui/WWText'
import { useAiModelTransfer } from './hooks/useAiModelTransfer'

export const AiModelTransferScreen = () => {
    const route = useRoute<any>()
    const navigation = useNavigation<any>()
    const { colors, spacing } = useExtendedTheme()

    const deviceId = route.params?.deviceId
    const initialModelId = route.params?.modelId
    const device = useAppSelector(state => state.devices[deviceId || ''])

    const {
        batteryLevel,
        availableModels,
        selectedModelId,
        setSelectedModelId,
        isPreflightDone,
        progress,
        statusLabel,
        isTransferring,
        isComplete,
        isFailed,
        errorMsg,
        progressLogs,
        startTransfer,
    } = useAiModelTransfer({ device, initialModelId })

    const isBatteryLow = batteryLevel !== null && batteryLevel < 30

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <ScrollView contentContainerStyle={[styles.content, { padding: spacing }]}>

                <WWText variant="titleLarge" style={{ marginBottom: spacing }}>
                    AI Model Transfer
                </WWText>

                <WWText style={{ marginBottom: spacing }}>
                    Downloads the selected AI model, transfers it to the SD card, and then
                    instructs the AI processor to erase the old model and load the new one.
                    This process can take several minutes.
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
                    </View>
                )}

                {/* ── Model Selection ── */}
                {!isComplete && !isTransferring && (
                    <View style={[styles.card, { backgroundColor: colors.surfaceVariant, marginBottom: spacing }]}>
                        <WWText variant="titleSmall" style={[styles.marginBottom8, { color: colors.onSurfaceVariant }]}>
                            Select Model
                        </WWText>

                        {!isPreflightDone ? (
                            <ActivityIndicator animating size="small" color={colors.primary} style={styles.spinnerLeft} />
                        ) : availableModels.length === 0 ? (
                            <WWText style={{ color: colors.error }}>No AI models found in the database.</WWText>
                        ) : (
                            <RadioButton.Group onValueChange={newValue => setSelectedModelId(newValue)} value={selectedModelId || ''}>
                                {availableModels.map(model => (
                                    <TouchableOpacity 
                                        key={model.id}
                                        style={styles.modelRow}
                                        onPress={() => setSelectedModelId(model.id)}
                                    >
                                        <RadioButton.Android value={model.id} color={colors.primary} />
                                        <View style={styles.modelRowText}>
                                            <WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                                                {model.name} (v{model.version})
                                            </WWText>
                                            <WWText variant="bodySmall" style={[styles.modelSizeText, { color: colors.onSurfaceVariant }]}>
                                                {model.fileSizeBytes ? `${(model.fileSizeBytes / 1024 / 1024).toFixed(2)} MB` : 'Size unknown'}
                                            </WWText>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </RadioButton.Group>
                        )}
                    </View>
                )}

                {/* ── Battery Warning ── */}
                {isBatteryLow && !isComplete && (
                    <View style={[styles.warningBanner, { marginBottom: spacing }]}>
                        <WWText style={styles.warningText}>
                            ⚠️ Battery is below 30%. Transfer takes significant power. Please charge if possible.
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
                                Model Transferred & Loaded
                            </WWText>
                        </View>
                        <WWText variant="bodyMedium" style={styles.successText}>
                            The AI model has been successfully written to the SD card and loaded into 
                            the AI processor's flash memory.
                        </WWText>
                    </View>
                )}

                {/* ── Action Buttons ── */}
                {!isComplete && !isTransferring && (
                    <Button
                        mode="contained"
                        onPress={startTransfer}
                        disabled={!device?.connected || !isPreflightDone || !selectedModelId}
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
    modelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    spinnerLeft: {
        alignSelf: 'flex-start',
    },
    modelRowText: {
        flex: 1,
        paddingLeft: 8,
    },
    modelSizeText: {
        opacity: 0.7,
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
