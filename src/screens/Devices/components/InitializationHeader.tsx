import React, { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { ActivityIndicator, Button, Text, Card } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { WWProgressBar } from '../../../components/ui/WWProgressBar'
import { sortInitWarnings } from '../../../utils/initWarnings'

export interface BaseHeaderProps {
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
}

const InitializationErrorsView: React.FC<BaseHeaderProps & { dismissed: string[]; onDismiss: (lines: string[]) => void }> = ({ initErrors, theme, dismissed, onDismiss, warningHintText = "You can still proceed with preparation, but address these issues before deployment." }) => {
    if (!initErrors.selftest && !initErrors.setUtc && (!initErrors.deviceHealth || initErrors.deviceHealth.length === 0)) {
        return null;
    }
    // Faults ask for a report; minor lines (utils/initWarnings.ts) do not, and a
    // banner of minor lines only can be dismissed. It stays dismissed while its
    // lines are ones already dismissed, and comes back with a new one.
    const lines = initErrors.deviceHealth ?? []
    const { battery, minor, faults } = sortInitWarnings(lines)
    const toReport = !!initErrors.selftest || !!initErrors.setUtc || faults.length > 0
    if (!toReport && lines.every(l => dismissed.includes(l))) {
        return null;
    }
    return (
        <View style={[styles.errorSection, { backgroundColor: theme.colors.errorContainer, borderLeftColor: theme.colors.error }]}>
            <Text variant="titleMedium" style={[styles.errorTitle, { color: theme.colors.onErrorContainer }]}>
                Initialization Warnings
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
            {faults.map((warning) => (
                <Text key={warning} variant="bodySmall" style={[styles.errorText, { color: theme.colors.onErrorContainer }]}>
                    • Hardware: {warning}
                </Text>
            ))}
            {[...minor, ...(battery ? [battery] : [])].map((line) => (
                <Text key={line} variant="bodySmall" style={[styles.errorText, { color: theme.colors.onErrorContainer }]}>
                    • {line}
                </Text>
            ))}
            {toReport ? (
                <Text variant="bodySmall" style={[styles.errorHint, { color: theme.colors.onErrorContainer }]}>
                    {warningHintText}
                </Text>
            ) : (
                <Button
                    compact
                    onPress={() => onDismiss(lines)}
                    style={styles.dismiss}
                    textColor={theme.colors.onErrorContainer}
                >
                    Dismiss
                </Button>
            )}
        </View>
    );
}

export const StatusInitializationHeader: React.FC<BaseHeaderProps> = (props) => {
    // The lines the person dismissed on this screen, kept while it is open
    const [dismissed, setDismissed] = useState<string[]>([])
    return (
        <>
            {props.isInitializing && (
                <Card style={styles.card}>
                    <Card.Content>
                        <View style={[styles.header, styles.headerInitializing]}>
                            <View style={styles.headerTitleRow}>
                                <View style={styles.headerTitleColumn}>
                                    <WWText variant="titleMedium" style={styles.headerLabel}><Text>Initialization Status</Text></WWText>
                                </View>
                                <ActivityIndicator size="small" color={props.theme.colors.primary} />
                            </View>

                            <View style={styles.initializationProgressContainer}>
                                <WWProgressBar progress={props.initProgress} style={styles.initProgressBar} />
                                <WWText variant="bodySmall" style={styles.initStepText}>
                                    <Text>{props.initStep || 'Preparing device…'}</Text>
                                </WWText>
                            </View>
                        </View>
                    </Card.Content>
                </Card>
            )}
            <InitializationErrorsView {...props} dismissed={dismissed} onDismiss={setDismissed} />
        </>
    )
}

const styles = StyleSheet.create({
    card: {},
    header: {},
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
    dismiss: {
        alignSelf: 'flex-end',
        marginTop: 4,
    },
    errorHint: {
        marginTop: 8,
        fontStyle: 'italic',
        fontSize: 12,
    },
})
