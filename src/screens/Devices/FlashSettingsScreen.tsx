import { useMemo, useState } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { ActivityIndicator, Button, Card, HelperText, SegmentedButtons, useTheme } from 'react-native-paper'
import { RouteProp, useRoute } from '@react-navigation/native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { RootStackParamList } from '../../navigation/types'
import { WWText } from '../../components/ui/WWText'
import { WWTextInput } from '../../components/ui/WWTextInput'
import { FlashSelector } from '../../components/device/FlashSelector'
import { FLASH_MODE_OP_LABELS } from '../../hooks/useDeviceSettings'
import { FlashSettings, FLASH_MODE_TIME_OF_DAY, flashSettingsWrites, parsePercent } from '../../utils/flashSettings'
import { flashWindowFromLocal, flashWindowToLocal, formatUtcMinutes, localUtcOffsetMinutes } from '../../utils/projectFlash'
import { useFlashSettings } from './hooks/useFlashSettings'

type RouteType = RouteProp<RootStackParamList, 'FlashSettingsScreen'>

/** "UTC+13:00" for an offset in minutes east. */
const offsetLabel = (minutes: number): string => {
    const sign = minutes < 0 ? '-' : '+'
    return `UTC${sign}${formatUtcMinutes(Math.abs(minutes))}`
}

/**
 * Flash settings: the capture flash's mode and time-of-day window, which LED it
 * uses and how bright, and the brightness of the motion-detection light. The
 * window is typed in the phone's local time; the camera keeps it in UTC.
 */
export const FlashSettingsScreen = () => {
    const route = useRoute<RouteType>()
    const { colors } = useTheme()
    const { connected, onDevice, status, error, save, testing, testWhiteLed } = useFlashSettings(route.params?.deviceId)
    const offset = useMemo(() => localUtcOffsetMinutes(), [])

    const [form, setForm] = useState<FlashSettings | null>(null)
    const [startText, setStartText] = useState('')
    const [endText, setEndText] = useState('')
    const [mdText, setMdText] = useState('')

    // Fill the form from each fresh read of the device, on entry and after Save.
    const [seededFrom, setSeededFrom] = useState<FlashSettings | null>(null)
    if (onDevice !== seededFrom) {
        setSeededFrom(onDevice)
        if (onDevice) {
            const window = flashWindowToLocal(onDevice.windowStartUtc, onDevice.windowMinutes, offset)
            setForm(onDevice)
            setStartText(window.start)
            setEndText(window.end)
            setMdText(String(onDevice.mdBrightness))
        }
    }

    const timeOfDay = form?.mode === FLASH_MODE_TIME_OF_DAY
    const window = timeOfDay ? flashWindowFromLocal(startText, endText, offset) : null
    const mdBrightness = parsePercent(mdText)

    const next: FlashSettings | null = form && mdBrightness !== null && (!timeOfDay || window)
        ? {
            ...form,
            mdBrightness,
            ...(window ? { windowStartUtc: window.startUtc, windowMinutes: window.minutes } : {}),
        }
        : null
    const changes = onDevice && next ? flashSettingsWrites(onDevice, next).length : 0
    const busy = status === 'saving'

    const update = (patch: Partial<FlashSettings>) => setForm(prev => (prev ? { ...prev, ...patch } : prev))

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <ScrollView contentContainerStyle={styles.content}>
                {!connected && (
                    <View style={[styles.banner, { backgroundColor: colors.errorContainer }]}>
                        <WWText style={{ color: colors.onErrorContainer }}>
                            The camera is not connected. Connect from the Engineer Console first.
                        </WWText>
                    </View>
                )}

                {connected && status === 'loading' && (
                    <View style={styles.loading}>
                        <ActivityIndicator />
                        <WWText>Reading the camera's settings</WWText>
                    </View>
                )}

                {status === 'error' && !form && (
                    <View style={[styles.banner, { backgroundColor: colors.errorContainer }]}>
                        <WWText style={{ color: colors.onErrorContainer }}>
                            Could not read the camera's settings: {error}
                        </WWText>
                    </View>
                )}

                {status === 'unsupported' && (
                    <View style={[styles.banner, { backgroundColor: colors.errorContainer }]}>
                        <WWText style={{ color: colors.onErrorContainer }}>
                            This AI processor firmware has no flash mode. Update it first.
                        </WWText>
                    </View>
                )}

                {form && (
                    <>
                        <Card style={styles.card}>
                            <Card.Content style={styles.cardContent}>
                                <WWText variant="labelLarge">Capture flash mode</WWText>
                                <SegmentedButtons
                                    value={String(form.mode)}
                                    onValueChange={(value) => update({ mode: parseInt(value, 10) })}
                                    buttons={FLASH_MODE_OP_LABELS.map((label, value) => ({
                                        value: String(value),
                                        label,
                                        disabled: busy,
                                    }))}
                                    density="small"
                                />

                                {timeOfDay && (
                                    <View>
                                        <View style={styles.row}>
                                            <View style={styles.half}>
                                                <WWTextInput
                                                    label="On at"
                                                    placeholder="hh:mm"
                                                    value={startText}
                                                    onChange={setStartText}
                                                    disabled={busy}
                                                    testID="flash-window-start"
                                                />
                                            </View>
                                            <View style={styles.half}>
                                                <WWTextInput
                                                    label="Off at"
                                                    placeholder="hh:mm"
                                                    value={endText}
                                                    onChange={setEndText}
                                                    disabled={busy}
                                                    testID="flash-window-end"
                                                />
                                            </View>
                                        </View>
                                        <HelperText type={window ? 'info' : 'error'} visible>
                                            {window
                                                ? `Phone time, ${offsetLabel(offset)}. The camera keeps ${formatUtcMinutes(window.startUtc)} UTC for ${window.minutes} min.`
                                                : 'Two different times, as hh:mm.'}
                                        </HelperText>
                                    </View>
                                )}

                                <FlashSelector
                                    flashLed={form.led}
                                    onFlashLedChange={(led) => update({ led })}
                                    ledBrightness={form.ledBrightness}
                                    onLedBrightnessChange={(ledBrightness) => update({ ledBrightness })}
                                    disabled={busy}
                                />

                                {/* The firmware's `flash` lights the white LED only, at a
                                    brightness it is given, so it tests the brightness typed
                                    above before it is saved. */}
                                <Button
                                    mode="outlined"
                                    icon="flash"
                                    onPress={() => testWhiteLed(form.ledBrightness)}
                                    disabled={!connected || busy || testing === 'sending'}
                                    loading={testing === 'sending'}
                                    testID="flash-test-white"
                                >
                                    {`Test the white LED at ${form.ledBrightness}%`}
                                </Button>
                                {testing === 'failed' && (
                                    <HelperText type="error" visible>The camera did not take the test flash.</HelperText>
                                )}
                            </Card.Content>
                        </Card>

                        <Card style={styles.card}>
                            <Card.Content style={styles.cardContent}>
                                <WWText variant="labelLarge">Motion-detection light</WWText>
                                <WWTextInput
                                    label="Brightness (0-100%)"
                                    value={mdText}
                                    keyboardType="numeric"
                                    onChange={setMdText}
                                    disabled={busy}
                                    hasError={mdBrightness === null}
                                    errorText="A whole number from 0 to 100."
                                    testID="md-brightness"
                                />
                            </Card.Content>
                        </Card>

                        <Button
                            mode="contained"
                            onPress={() => next && save(next)}
                            disabled={!connected || busy || !next || changes === 0}
                            loading={busy}
                            testID="flash-settings-save"
                        >
                            {changes > 1 ? `Save ${changes} changes` : 'Save'}
                        </Button>

                        {status === 'saved' && changes === 0 && (
                            <WWText style={styles.status}>Saved. The camera uses these from its next wake.</WWText>
                        )}
                        {status === 'error' && (
                            <WWText style={[styles.status, { color: colors.error }]}>Not saved: {error}</WWText>
                        )}
                    </>
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
        padding: 16,
        paddingBottom: 32,
        gap: 16,
    },
    card: {},
    cardContent: {
        gap: 12,
    },
    banner: {
        padding: 12,
        borderRadius: 8,
    },
    loading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    half: {
        flex: 1,
    },
    status: {
        textAlign: 'center',
    },
})
