import { View, StyleSheet } from 'react-native'
import { Surface, Button } from 'react-native-paper'

import { WWText } from './ui/WWText'
import { SelfTestIssue } from '../utils/deviceSelfTest'

interface Props {
    issues: SelfTestIssue[]
    /** Re-run the self-test (optional - hides the button when omitted) */
    onRecheck?: () => void
    isChecking?: boolean
}

/**
 * Hardware health warnings from the device's self-test bitmask.
 * Renders nothing when the device reports no issues (or none read yet), so it
 * is safe to mount at the top of any device screen.
 */
export const DeviceHealthBanner = ({ issues, onRecheck, isChecking }: Props) => {
    if (!issues.length) return null

    const hasError = issues.some(i => i.severity === 'error')

    return (
        <Surface style={[styles.card, hasError ? styles.errorCard : styles.warnCard]} elevation={1}>
            <WWText variant="titleSmall" style={styles.title}>
                {hasError ? 'Device hardware problem' : 'Device health warning'}
            </WWText>
            {issues.map(issue => (
                <View key={issue.bit} style={styles.issue}>
                    <WWText variant="bodyMedium" style={styles.issueTitle}>{issue.title}</WWText>
                    <WWText variant="bodySmall" style={styles.issueHint}>{issue.hint}</WWText>
                </View>
            ))}
            {onRecheck && (
                <Button
                    compact
                    mode="text"
                    textColor="#FFE0B2"
                    onPress={onRecheck}
                    loading={isChecking}
                    disabled={isChecking}
                    style={styles.recheck}
                >
                    Re-check
                </Button>
            )}
        </Surface>
    )
}

const styles = StyleSheet.create({
    card: {
        padding: 14,
        borderRadius: 12,
        marginBottom: 8,
    },
    errorCard: {
        backgroundColor: '#7F1D1D',
    },
    warnCard: {
        backgroundColor: '#4E342E',
    },
    title: {
        color: '#FFE0B2',
        marginBottom: 6,
    },
    issue: {
        marginBottom: 8,
    },
    issueTitle: {
        color: '#FFFFFF',
    },
    issueHint: {
        color: '#FFE0B2',
        opacity: 0.9,
        marginTop: 2,
    },
    recheck: {
        alignSelf: 'flex-end',
    },
})
