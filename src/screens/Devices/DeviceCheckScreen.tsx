import { View, StyleSheet, Image, ScrollView } from 'react-native'
import { ActivityIndicator, Button, Card, Icon, Text } from 'react-native-paper'
import { useRoute } from '@react-navigation/native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAppSelector } from '../../redux'
import { useExtendedTheme } from '../../theme'
import { WWBleDisconnectedBanner } from '../../components/ui/WWBleDisconnectedBanner'
import { CHECK_STEPS, CheckPhoto, CheckStatus } from '../../ble/workflows/deviceCheck'
import { CAMERA_VARIANT_LABELS } from '../../utils/cameraVariant'
import { useDeviceCheck } from './hooks/useDeviceCheck'

/** Readable on both themes; the theme has no warning colour of its own. */
const WARN_COLOUR = '#B26A00'

/** Each photo with the name under it. The IR one is the black & white camera with the IR flash on. */
const PHOTO_LABELS: Record<CheckPhoto, string> = {
    RP3: CAMERA_VARIANT_LABELS.RP3,
    HM0360: CAMERA_VARIANT_LABELS.HM0360,
    IR: 'IR flash',
}

const VERDICT_TEXT = {
    pass: 'Ready to ship',
    warn: 'Ready to ship, with warnings',
    fail: 'Not ready to ship',
    incomplete: 'Check not finished',
} as const

/**
 * Device Check: the manufacturer's ship check for a finished WW500, from the
 * Engineer Console. The steps and their rules are in `ble/workflows/deviceCheck.ts`;
 * how to set the unit up is in documentation/resources/Device-Check.md.
 */
export const DeviceCheckScreen = () => {
    const route = useRoute<any>()
    const deviceId: string | undefined = route.params?.deviceId
    const device = useAppSelector(state => state.devices[deviceId || ''])
    const connected = !!device?.connected
    const { colors } = useExtendedTheme()
    const check = useDeviceCheck({ device })

    const statusIcon = (status: CheckStatus) => {
        switch (status) {
            case 'running': return <ActivityIndicator size={18} />
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
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right', 'bottom']}>
            <WWBleDisconnectedBanner connected={connected} dfuInProgress={!!device?.dfuInProgress} />
            <ScrollView contentContainerStyle={styles.content}>
                {!check.running && (
                    <Text variant="bodyMedium">
                        Put the test card in front of the camera and keep both still. The check takes about five minutes.
                    </Text>
                )}

                {check.running ? (
                    <Button mode="outlined" onPress={check.stop} testID="device-check-stop">
                        Stop
                    </Button>
                ) : (
                    <Button mode="contained" onPress={check.start} disabled={!connected} testID="device-check-start">
                        {check.finished ? 'Run again' : 'Start check'}
                    </Button>
                )}

                {check.verdict && (
                    <Text variant="titleMedium" style={{ color: verdictColour }} testID="device-check-verdict">
                        {VERDICT_TEXT[check.verdict]}
                    </Text>
                )}

                {check.question && (
                    <Card mode="contained" style={{ backgroundColor: colors.secondaryContainer }}>
                        <Card.Content style={styles.gap}>
                            <Text variant="titleSmall">{check.question}</Text>
                            <View style={styles.answers}>
                                <Button mode="contained" onPress={() => check.answer(true)} testID="device-check-yes">Yes</Button>
                                <Button mode="outlined" onPress={() => check.answer(false)} testID="device-check-no">No</Button>
                            </View>
                        </Card.Content>
                    </Card>
                )}

                {(check.instruction || check.cameraStage) && !check.question && (
                    <Card mode="contained" style={{ backgroundColor: colors.secondaryContainer }}>
                        <Card.Content>
                            <Text variant="bodyMedium">{check.instruction || check.cameraStage}</Text>
                        </Card.Content>
                    </Card>
                )}

                {(check.photos.RP3 || check.photos.HM0360) && (
                    <View style={styles.photos}>
                        {(['RP3', 'HM0360', 'IR'] as const)
                            .filter(photo => photo !== 'IR' || check.photos.IR)
                            .map(photo => (
                                <View key={photo} style={styles.photo}>
                                    {check.photos[photo] ? (
                                        <Image source={{ uri: check.photos[photo] }} style={styles.image} resizeMode="contain" />
                                    ) : (
                                        <View style={[styles.image, { backgroundColor: colors.surfaceVariant }]} />
                                    )}
                                    <Text variant="bodySmall">{PHOTO_LABELS[photo]}</Text>
                                </View>
                            ))}
                    </View>
                )}

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
                    {check.finished && check.lens?.movesFreely && check.lens.verdict.peakUp !== check.reference?.lensPeak && (
                        <Button mode="outlined" onPress={check.saveAsReference} testID="device-check-reference">
                            {`Use this unit as the lens reference (${check.lens.verdict.peakUp})`}
                        </Button>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
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
    photos: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        rowGap: 12,
        justifyContent: 'space-between',
    },
    // Two to a row: colour and black & white side by side for the framing question, the IR photo below.
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
