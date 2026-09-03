import { View, StyleSheet } from 'react-native'
import { ActivityIndicator, Icon, ProgressBar } from 'react-native-paper'

import { WWText } from '../../../components/ui/WWText'
import { useExtendedTheme } from '../../../theme'
import { CaptureStepsState, Step, describeTransfer } from '../../../utils/captureSteps'

interface Props {
    state: CaptureStepsState
    /** Clock for the countdown, from useCaptureSteps */
    now: number
    /** The app's own stage text, shown under the list: it explains the waits the device is silent through */
    stage?: string
}

const StepIcon = ({ status, color }: { status: Step['status']; color: string }) => {
    if (status === 'active') return <ActivityIndicator size={18} />
    const source = status === 'done' ? 'check-circle' : status === 'failed' ? 'alert-circle' : 'circle-outline'
    return <Icon source={source} size={20} color={color} />
}

/**
 * The step list for a Capture Picture run: what has happened, what is
 * happening, and how long the transfer has to go.
 *
 * A capture is 13 s or more of a camera the operator cannot see doing
 * anything, and most of that is the transfer. The list ticks on the device's
 * own messages, so it reports the camera, not the app's hopes for it.
 */
export const CaptureSteps = ({ state, now, stage }: Props) => {
    const { colors } = useExtendedTheme()

    const iconColor = (status: Step['status']) =>
        status === 'done' ? colors.primary
            : status === 'failed' ? colors.error
                : colors.onSurfaceVariant

    const transfer = state.transfer
    const fraction = transfer && transfer.totalBytes > 0 ? transfer.receivedBytes / transfer.totalBytes : 0

    return (
        <View style={styles.container}>
            {state.steps.map(step => (
                <View key={step.key} style={styles.row}>
                    <View style={styles.iconCell}>
                        <StepIcon status={step.status} color={iconColor(step.status)} />
                    </View>
                    <View style={styles.textCell}>
                        <WWText
                            variant="bodyMedium"
                            style={step.status === 'pending' ? { color: colors.onSurfaceVariant } : undefined}
                        >
                            {step.label}
                        </WWText>
                        {step.key === 'transfer' && transfer && step.status !== 'pending' ? (
                            <>
                                <ProgressBar progress={fraction} color={colors.primary} style={styles.bar} />
                                <WWText variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>
                                    {step.status === 'done' && step.detail ? step.detail : describeTransfer(transfer, now)}
                                </WWText>
                            </>
                        ) : step.detail ? (
                            <WWText
                                variant="labelSmall"
                                style={{ color: step.status === 'failed' ? colors.error : colors.onSurfaceVariant }}
                            >
                                {step.detail}
                            </WWText>
                        ) : null}
                    </View>
                </View>
            ))}
            {stage ? (
                <WWText variant="labelSmall" style={[styles.stage, { color: colors.onSurfaceVariant }]}>
                    {stage}
                </WWText>
            ) : null}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        gap: 10,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    iconCell: {
        width: 24,
        alignItems: 'center',
        paddingTop: 1,
    },
    textCell: {
        flex: 1,
        gap: 2,
    },
    bar: {
        marginTop: 4,
        marginBottom: 2,
    },
    stage: {
        marginTop: 4,
        textAlign: 'center',
    },
})
