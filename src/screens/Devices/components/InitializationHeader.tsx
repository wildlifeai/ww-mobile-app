import React from 'react'
import { View, StyleSheet } from 'react-native'
import { ActivityIndicator, Text, Card } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { WWProgressBar } from '../../../components/ui/WWProgressBar'
import { WWIcon } from '../../../components/ui/WWIcon'
import Device from '../../../database/models/Device'

interface InitializationHeaderProps {
    device: Device
    isInitializing: boolean
    initProgress: number
    initStep: string
    initErrors: {
        selftest?: string
        setUtc?: string
        deviceHealth?: string[]
    }
    theme: any
    warningHintText?: string
    hideDeviceDetails?: boolean
}

export const InitializationHeader: React.FC<InitializationHeaderProps> = ({
    device,
    isInitializing,
    initProgress,
    initStep,
    initErrors,
    theme,
    warningHintText = "You can still proceed with preparation, but address these issues before deployment.",
    hideDeviceDetails = false
}) => {
    return (
        <>
            {/* Header */}
            {(!hideDeviceDetails || isInitializing) && (
                <Card style={styles.card}>
                    <Card.Content>
                        <View style={[styles.header, isInitializing && styles.headerInitializing]}>
                            <View style={styles.headerTitleRow}>
                                {!hideDeviceDetails ? (
                                    <View style={styles.headerTitleColumn}>
                                        <WWText variant="titleMedium" style={styles.headerLabel}><Text>Device ID</Text></WWText>
                                        <WWText variant="bodyMedium" style={styles.deviceName}>
                                            {device.name}
                                        </WWText>
                                        <WWText variant="bodySmall" style={styles.deviceId}>
                                            {device.bluetoothId}
                                        </WWText>
                                    </View>
                                ) : (
                                    <View style={styles.headerTitleColumn}>
                                        <WWText variant="titleMedium" style={styles.headerLabel}><Text>Initialization Status</Text></WWText>
                                    </View>
                                )}
                                {isInitializing ? (
                                    <ActivityIndicator size="small" color={theme.colors.primary} />
                                ) : (
                                    <WWIcon source="check-circle" color="#4CAF50" size={28} />
                                )}
                            </View>

                            {isInitializing && (
                                <View style={styles.initializationProgressContainer}>
                                    <WWProgressBar progress={initProgress} style={styles.initProgressBar} />
                                    <WWText variant="bodySmall" style={styles.initStepText}>
                                        <Text>{initStep || 'Preparing device...'}</Text>
                                    </WWText>
                                </View>
                            )}
                        </View>
                    </Card.Content>
                </Card>
            )}

            {/* Initialization Errors */}
            {(initErrors.selftest || initErrors.setUtc || (initErrors.deviceHealth && initErrors.deviceHealth.length > 0)) && (
                <View style={[styles.errorSection, { backgroundColor: theme.colors.errorContainer, borderLeftColor: theme.colors.error }]}>
                    <Text variant="titleMedium" style={[styles.errorTitle, { color: theme.colors.onErrorContainer }]}>
                        ⚠️ Initialization Warnings
                    </Text>
                    {initErrors.selftest && (
                        <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.onErrorContainer }]}>
                            • Selftest: {initErrors.selftest}
                        </Text>
                    )}
                    {initErrors.setUtc && (
                        <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.onErrorContainer }]}>
                            • Time Sync: {initErrors.setUtc}
                        </Text>
                    )}
                    {initErrors.deviceHealth && initErrors.deviceHealth.map((warning) => (
                        <Text key={warning} variant="bodySmall" style={[styles.errorText, { color: theme.colors.onErrorContainer }]}>
                            • Hardware: {warning}
                        </Text>
                    ))}
                    <Text variant="bodySmall" style={[styles.errorHint, { color: theme.colors.onErrorContainer }]}>
                        {warningHintText}
                    </Text>
                </View>
            )}
        </>
    )
}

const styles = StyleSheet.create({
    card: {
        // marginBottom: 16, // Removed to use gap in parent container
    },
    header: {
        // marginBottom: 24, // Handled by Card margin
    },
    headerInitializing: {
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        paddingBottom: 24,
    },
    headerTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitleColumn: {
        flex: 1,
    },
    headerLabel: {
        marginBottom: 4,
    },
    deviceName: {
        marginTop: 8,
        fontWeight: '600',
    },
    deviceId: {
        marginTop: 4,
        opacity: 0.6,
    },
    initializationProgressContainer: {
        marginTop: 16,
        gap: 8,
    },
    initProgressBar: {
        height: 8,
        borderRadius: 4,
    },
    initStepText: {
        color: '#6B7280',
        fontStyle: 'italic',
        marginBottom: 4,
    },
    logsContainer: {
        backgroundColor: 'rgba(0,0,0,0.05)',
        padding: 8,
        borderRadius: 4,
        marginTop: 4,
    },
    logLine: {
        color: '#4B5563',
        fontSize: 11,
        lineHeight: 16,
    },
    errorSection: {
        marginBottom: 16,
        padding: 16,
        borderRadius: 8,
        borderLeftWidth: 4,
    },
    errorTitle: {
        marginBottom: 8,
        fontWeight: '600',
    },
    errorText: {
        marginBottom: 4,
    },
    errorHint: {
        marginTop: 8,
        fontStyle: 'italic',
        fontSize: 12,
    },
})
