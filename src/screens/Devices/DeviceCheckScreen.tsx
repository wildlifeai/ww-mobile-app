import { View, StyleSheet, Image, ScrollView } from 'react-native'
import { ActivityIndicator, Button, Card, Icon, ProgressBar, Text } from 'react-native-paper'
import { useRoute } from '@react-navigation/native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAppSelector } from '../../redux'
import { useExtendedTheme } from '../../theme'
import { WWBleDisconnectedBanner } from '../../components/ui/WWBleDisconnectedBanner'
import { CHECK_STEPS, CheckPhoto, CheckStatus } from '../../ble/workflows/deviceCheck'
import { CAMERA_VARIANT_LABELS } from '../../utils/cameraVariant'
import { useDeviceCheck } from './hooks/useDeviceCheck'

type Check = ReturnType<typeof useDeviceCheck>

/** Readable on both themes; the theme has no warning colour of its own. */
const WARN_COLOUR = '#B26A00'

/** Each photo with the name under it. The flash ones are each camera with its LED on. */
const PHOTO_LABELS: Record<CheckPhoto, string> = {
    RP3: CAMERA_VARIANT_LABELS.RP3,
    WHITE: 'White flash',
    HM0360: CAMERA_VARIANT_LABELS.HM0360,
    IR: 'IR flash',
}

/** Two to a row in the results: each camera beside its flash photo. */
const PHOTO_ORDER: CheckPhoto[] = ['RP3', 'WHITE', 'HM0360', 'IR']

const VERDICT_TEXT = {
    pass: 'Ready to ship',
    warn: 'Ready to ship, with warnings',
    fail: 'Not ready to ship',
    incomplete: 'Check not finished',
} as const

/**
 * The step on screen: the one running, or between two steps the next one.
 * Past the last step the check is putting the unit back.
 */
const currentStep = (steps: Check['steps']) => {
    const running = CHECK_STEPS.findIndex(s => steps[s.id].status === 'running')
    return running >= 0 ? running : CHECK_STEPS.filter(s => steps[s.id].status !== 'pending').length
}

const Photos = ({ uris, which }: { uris: Check['photos']; which: CheckPhoto[] }) => {
    const shown = which.filter(photo => uris[photo])
    if (shown.length === 0) return null
    return (
        <View style={styles.photos}>
            {shown.map(photo => (
                <View key={photo} style={styles.photo}>
                    <Image source={{ uri: uris[photo] }} style={styles.image} resizeMode="contain" />
                    <Text variant="bodySmall">{PHOTO_LABELS[photo]}</Text>
                </View>
            ))}
        </View>
    )
}

/**
 * One step at a time, full screen: what it is doing, or the question it asks.
 * A notice (stop waving) sits above it until dismissed; the check carries on.
 */
const RunningView = ({ check }: { check: Check }) => {
    const { colors } = useExtendedTheme()
    const total = CHECK_STEPS.length
    const index = currentStep(check.steps)
    const title = index < total ? CHECK_STEPS[index].doing : 'Putting the camera back as it was'
    const detail = check.instruction || check.cameraStage

    return (
        <View style={styles.fill}>
            {check.notice ? (
                <Card mode="contained" style={{ backgroundColor: colors.secondaryContainer }} testID="device-check-notice">
                    <Card.Content style={styles.notice}>
                        <Text variant="titleMedium" style={styles.noticeText}>{check.notice}</Text>
                        <Button mode="contained" onPress={check.dismissNotice} testID="device-check-notice-ok">OK</Button>
                    </Card.Content>
                </Card>
            ) : null}
            <ScrollView contentContainerStyle={styles.stage}>
                <View style={styles.gap}>
                    <Text variant="labelLarge" testID="device-check-progress">
                        {`Step ${Math.min(index + 1, total)} of ${total}`}
                    </Text>
                    <ProgressBar progress={index / total} />
                </View>
                <Text variant="headlineSmall" testID="device-check-current">{title}</Text>
                {check.question ? (
                    <View style={styles.gap}>
                        <Text variant="titleMedium">{check.question.text}</Text>
                        <Photos uris={check.photos} which={check.question.photos} />
                        {check.question.button ? (
                            <Button
                                mode="contained" contentStyle={styles.tall}
                                onPress={() => check.answer(true)} testID="device-check-tap"
                            >
                                {check.question.button}
                            </Button>
                        ) : (
                            <View style={styles.answers}>
                                <Button
                                    mode="contained" style={styles.answer} contentStyle={styles.tall}
                                    onPress={() => check.answer(true)} testID="device-check-yes"
                                >
                                    Yes
                                </Button>
                                <Button
                                    mode="outlined" style={styles.answer} contentStyle={styles.tall}
                                    onPress={() => check.answer(false)} testID="device-check-no"
                                >
                                    No
                                </Button>
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={styles.working}>
                        <ActivityIndicator size="large" />
                        {detail ? <Text variant="bodyLarge" style={styles.centred}>{detail}</Text> : null}
                    </View>
                )}
            </ScrollView>
            <Button mode="outlined" onPress={check.stop} testID="device-check-stop">
                Stop
            </Button>
        </View>
    )
}

/** Every step's result, with the photos the check took. */
const ResultsView = ({ check, connected }: { check: Check; connected: boolean }) => {
    const { colors } = useExtendedTheme()

    const statusIcon = (status: CheckStatus) => {
        switch (status) {
            case 'pass': return <Icon source="check-circle" size={20} color={colors.primary} />
            case 'warn': return <Icon source="alert" size={20} color={WARN_COLOUR} />
            case 'fail': return <Icon source="close-circle" size={20} color={colors.error} />
            case 'skipped': return <Icon source="minus-circle-outline" size={20} color={colors.onSurfaceVariant} />
            default: return <Icon source="circle-outline" size={20} color={colors.outline} />
        }
    }

    const verdictColour = check.verdict === 'fail'
        ? colors.error
        : check.verdict === 'warn' || check.verdict === 'incomplete' ? WARN_COLOUR : colors.primary

    return (
        <ScrollView contentContainerStyle={styles.content}>
            {check.verdict && (
                <Text variant="headlineSmall" style={{ color: verdictColour }} testID="device-check-verdict">
                    {VERDICT_TEXT[check.verdict]}
                </Text>
            )}
            <Button mode="contained" onPress={check.start} disabled={!connected} testID="device-check-start">
                Run again
            </Button>

            <Photos uris={check.photos} which={PHOTO_ORDER} />

            <View>
                {CHECK_STEPS.map(({ id, title }) => {
                    const state = check.steps[id]
                    return (
                        <View key={id} style={[styles.step, { borderBottomColor: colors.outlineVariant }]} testID={`device-check-step-${id}`}>
                            <View style={styles.icon}>{statusIcon(state.status)}</View>
                            <View style={styles.stepText}>
                                <Text variant="bodyMedium">{title}</Text>
                                {state.summary ? (
                                    <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{state.summary}</Text>
                                ) : null}
                            </View>
                        </View>
                    )
                })}
            </View>

            <View style={styles.gap}>
                <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                    {check.reference
                        ? `Lens reference: sharpest at ${check.reference.lensPeak}, from ${check.reference.deviceName} on ${check.reference.recordedAt.slice(0, 10)}.`
                        : 'No lens reference on this phone yet. Run the check on a known good unit and keep its result as the reference.'}
                </Text>
                {check.lens?.movesFreely && check.lens.verdict.peakUp !== check.reference?.lensPeak && (
                    <Button mode="outlined" onPress={check.saveAsReference} testID="device-check-reference">
                        {`Use this unit as the lens reference (${check.lens.verdict.peakUp})`}
                    </Button>
                )}
            </View>
        </ScrollView>
    )
}

/**
 * Device Check: the manufacturer's ship check for a finished WW500, from the
 * Engineer Console. A start button, then each step full screen as it runs,
 * then every step's result. The steps and their rules are in
 * `ble/workflows/deviceCheck.ts`; how to set the unit up is in
 * documentation/resources/Device-Check.md.
 */
export const DeviceCheckScreen = () => {
    const route = useRoute<any>()
    const deviceId: string | undefined = route.params?.deviceId
    const device = useAppSelector(state => state.devices[deviceId || ''])
    const connected = !!device?.connected
    const { colors } = useExtendedTheme()
    const check = useDeviceCheck({ device })

    let body = (
        <View style={styles.centre}>
            <Button mode="contained" onPress={check.start} disabled={!connected} contentStyle={styles.tall} testID="device-check-start">
                Start check
            </Button>
        </View>
    )
    if (check.running) body = <RunningView check={check} />
    else if (check.finished) body = <ResultsView check={check} connected={connected} />

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right', 'bottom']}>
            <WWBleDisconnectedBanner connected={connected} dfuInProgress={!!device?.dfuInProgress} />
            {body}
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    fill: {
        flex: 1,
        padding: 16,
    },
    centre: {
        flex: 1,
        justifyContent: 'center',
        padding: 16,
    },
    stage: {
        flexGrow: 1,
        justifyContent: 'center',
        gap: 24,
        paddingBottom: 16,
    },
    working: {
        alignItems: 'center',
        gap: 16,
    },
    centred: {
        textAlign: 'center',
    },
    notice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    noticeText: {
        flex: 1,
    },
    content: {
        padding: 16,
        gap: 12,
    },
    gap: {
        gap: 8,
    },
    answers: {
        flexDirection: 'row',
        gap: 12,
    },
    answer: {
        flex: 1,
    },
    tall: {
        paddingVertical: 8,
    },
    photos: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        rowGap: 12,
        justifyContent: 'space-between',
    },
    // Two to a row: a camera beside its flash photo, or the two cameras for the framing question.
    photo: {
        width: '48%',
        alignItems: 'center',
        gap: 4,
    },
    image: {
        width: '100%',
        aspectRatio: 4 / 3,
        borderRadius: 4,
    },
    step: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 10,
    },
    icon: {
        width: 22,
        paddingTop: 2,
        alignItems: 'center',
    },
    stepText: {
        flex: 1,
    },
})
