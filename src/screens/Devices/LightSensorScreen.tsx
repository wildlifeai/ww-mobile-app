import { useState, useRef, useEffect, useCallback } from 'react'
import { View, StyleSheet, Image, Alert } from 'react-native'
import { Button, Checkbox, Divider, IconButton, List, ProgressBar, SegmentedButtons, Surface } from 'react-native-paper'
import { useRoute } from '@react-navigation/native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAppSelector } from '../../redux'
import { useExtendedTheme } from '../../theme'
import { WWText } from '../../components/ui/WWText'
import { WWTextInput } from '../../components/ui/WWTextInput'
import { WWBleDisconnectedBanner } from '../../components/ui/WWBleDisconnectedBanner'
import { DeviceHealthBanner } from '../../components/DeviceHealthBanner'
import { useLightSensor } from '../../hooks/useLightSensor'
import { useCameraReadiness } from '../../hooks/useCameraReadiness'
import { useCameraSwitch, CAMERA_VARIANT_LABELS, type CameraVariant } from '../../hooks/useCameraSwitch'
import { useCapturePreview } from '../../hooks/useCapturePreview'
import { useLightSensorLog } from '../../hooks/useLightSensorLog'
import { toRegisterReading, scoreByMean, scoreByGain } from '../../utils/lightSensorRules'

const formatDuration = (ms: number): string => {
    const s = Math.max(0, Math.round(ms / 1000))
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

/**
 * Time remaining for the image transfer, estimated from how fast progress is
 * actually moving rather than an assumed rate, since throughput varies
 * several-fold with the BLE connection interval and a fixed KB/s figure would
 * mislead.
 *
 * Held back until the transfer is 3% in and 2s old: the first few chunks arrive
 * in a burst and would otherwise predict an absurdly short time.
 */
const useTransferEta = (isCapturing: boolean, progress: number): string | null => {
    const active = isCapturing && progress > 0

    // Only the transfer's start time is state; the ETA itself is derived during
    // render. Computing it in an effect instead would commit one render showing
    // the previous estimate before the new one lands.
    const [startedAt, setStartedAt] = useState<number | null>(null)
    const [wasActive, setWasActive] = useState(false)

    // React's "adjust state during render" pattern: it re-runs the component
    // immediately without committing, so no stale frame reaches the screen.
    if (active !== wasActive) {
        setWasActive(active)
        setStartedAt(active ? Date.now() : null)
    }

    if (!active || startedAt === null) return null

    const elapsed = Date.now() - startedAt
    if (progress < 0.03 || elapsed < 2000) return null

    return formatDuration((elapsed * (1 - progress)) / progress)
}

/** Shortest interval a stream will run at. The light check itself takes about a second. */
const MIN_STREAM_INTERVAL_S = 2
const MAX_STREAM_INTERVAL_S = 60
const DEFAULT_STREAM_INTERVAL_S = 5

/** Consecutive empty measurements before a stream gives up rather than looping on silence. */
const STREAM_MISS_LIMIT = 3

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Get the light-sensor registers off the device and log them.
 *
 * The measurement is the HM0360's AE register block, and that is all the
 * screen shows: the level and the registers. Each logged row also carries the
 * app's verdict by both rules the firmware has used, the mean-based one
 * against the device's own op23 and the gain-based one, beside the device's
 * verdict when it sent one. Which rule the *firmware* runs is a compile-time
 * choice the app cannot see, so the log is how the two are compared on
 * identical inputs without a reflash. The verdicts were on screen for a day
 * and came off at Victor's request: they are for the spreadsheet, not the
 * bench.
 *
 * Single shot, or streamed every few seconds from Settings, so a dusk run
 * yields a series. Every completed measurement is logged with both verdicts.
 *
 * On entry, automatic day/night camera switching (op26) is turned off if it
 * was on, and not turned back on. A capture in the dark, or the periodic light
 * check, would otherwise reboot the device into the other camera image in the
 * middle of a session.
 *
 * The photo is opt-in and off by default. Measuring without one uses `AI light`,
 * which takes about a second and transfers nothing, against roughly a minute
 * for a capture plus its BLE file transfer. It also works on HM0360 devices,
 * whose photo download is currently broken (issue #252).
 *
 * The light level shown is the AE mean from this measurement, NOT the device's
 * stored decision (op25). op25 only updates when the firmware has a consumer for
 * it (flash on, or auto camera switch), so it reads stale.
 */
export const LightSensorScreen = () => {
    const route = useRoute<any>()
    const { colors, spacing } = useExtendedTheme()
    const { bottom } = useSafeAreaInsets()

    const deviceId = route.params?.deviceId
    const device = useAppSelector(state => state.devices[deviceId || ''])

    const { state, aeData, lightCheck, isBusy, stage, measureNow, resetReadings } = useLightSensor({ device })
    // Whether the camera can work at all belongs to the device, not to this
    // feature, so it is asked once on entry rather than discovered when a
    // measurement fails. Enabled here because reaching this screen means the user
    // chose a camera flow; the Engineer Console itself must stay silent.
    const { status: readiness, issues: healthIssues, isFixing, check: recheckHealth, fix: enableCamera } =
        useCameraReadiness({ device, enabled: !!device?.connected })
    const { readings, addReading, annotateLast, clear, exportCsv } = useLightSensorLog()
    const {
        activeCamera, isBusy: cameraBusy, stage: cameraStage,
        refresh: refreshCameras, switchTo,
    } = useCameraSwitch({ device })
    const { capturedImageUri, isCapturing, captureStage, captureProgress, startCapture, clearImage } = useCapturePreview({ device })

    const eta = useTransferEta(isCapturing, captureProgress)

    const [withPhoto, setWithPhoto] = useState(false)
    const [note, setNote] = useState('')
    const [settingsOpen, setSettingsOpen] = useState(false)

    // A stepper rather than a text field: a keyboard over the bottom of the
    // page is the wrong tool for a number between 2 and 60.
    const [intervalS, setIntervalS] = useState(DEFAULT_STREAM_INTERVAL_S)
    const [streaming, setStreaming] = useState(false)
    const [streamCount, setStreamCount] = useState(0)
    const streamRef = useRef(false)

    // Counts measurements rather than images, so the light-only path (which
    // produces no image to key on) still logs exactly one row per press.
    const [measurementId, setMeasurementId] = useState(0)
    const loggedIdRef = useRef(0)

    const connected = !!device?.connected
    const busy = isBusy || isCapturing

    // Refs for the stream loop, which runs across many renders from one closure.
    const connectedRef = useRef(connected)
    connectedRef.current = connected
    const measureRef = useRef(measureNow)
    measureRef.current = measureNow

    // The reading and both rules' verdicts on it. Computed during render so the
    // screen and the log row are built from the same numbers. The mean rule
    // uses the device's own op23, read on entry.
    const threshold = state.darkThreshold
    const reading = aeData ? toRegisterReading(aeData) : null
    const meanDark = reading ? scoreByMean(reading, threshold) : null
    const gainDark = reading ? scoreByGain(reading) : null

    const measureOnce = useCallback(async () => {
        resetReadings()
        // Cleared for every measurement, not only photo ones. The final run on
        // 2 September logged three light-only rows carrying the path of the
        // photo taken before them, because the preview kept it and the log row
        // attaches whatever image is current.
        clearImage()
        setMeasurementId(id => id + 1)

        if (withPhoto) {
            startCapture(1, 500)
            return
        }

        const result = await measureNow()
        if (result === 'unsupported') {
            // Older firmware has no `AI light`. Fall back to the capture this
            // screen has always used, so the measurement still happens; the
            // photo simply appears when the user did not ask for one.
            startCapture(1, 500)
        } else if (result === 'timeout') {
            // Silence can mean the camera stopped working since we arrived. A wake
            // where the sensor fails to initialise leaves op10 reading 1 but sets
            // self-test bit 8, so re-checking turns "nothing happened" into the
            // actual reason, shown in the banner above.
            await recheckHealth()
            Alert.alert(
                'No reading arrived',
                'The device acknowledged the request but sent no AE registers within 15 seconds. Check the banner at the top for a hardware problem, or try again.',
            )
        }
    }, [withPhoto, resetReadings, clearImage, startCapture, measureNow, recheckHealth])

    /**
     * Measure on a timer until stopped. Light-only: a photo per tick would be a
     * minute each. One empty tick is a missed row, not a dialog, because a dropped
     * request (Seeed#202) is exactly what a long run will hit now and then; three
     * in a row means something is actually wrong.
     */
    const startStream = useCallback(async () => {
        const seconds = intervalS
        streamRef.current = true
        setStreaming(true)
        setStreamCount(0)
        let misses = 0

        while (streamRef.current && connectedRef.current) {
            resetReadings()
            clearImage()
            setMeasurementId(id => id + 1)
            const result = await measureRef.current()

            if (result === 'unsupported') {
                Alert.alert(
                    'Cannot stream on this firmware',
                    'This device has no AI light command, so readings cannot be streamed. Measure with a photo instead.',
                )
                break
            }
            if (result === 'timeout') {
                misses += 1
                if (misses >= STREAM_MISS_LIMIT) {
                    await recheckHealth()
                    Alert.alert(
                        'Stream stopped',
                        `${STREAM_MISS_LIMIT} requests in a row got no reading. Check the banner at the top, then start again.`,
                    )
                    break
                }
            } else {
                misses = 0
                setStreamCount(n => n + 1)
            }

            // Wait out the interval, checking for a stop every quarter second.
            const until = Date.now() + seconds * 1000
            while (streamRef.current && Date.now() < until) await sleep(250)
        }

        streamRef.current = false
        setStreaming(false)
    }, [intervalS, resetReadings, clearImage, recheckHealth])

    const stopStream = useCallback(() => { streamRef.current = false }, [])

    // Leaving the screen stops the stream; nothing should keep talking to the
    // device from a screen that is gone.
    useEffect(() => () => { streamRef.current = false }, [])

    /**
     * Ask the device which camera it is running, but only on the first open.
     * Keeping the query here rather than on mount is what makes the collapsed
     * accordion free: a user who never opens Settings never pays for it.
     */
    const askedCamerasRef = useRef(false)
    const onToggleSettings = useCallback(() => {
        setSettingsOpen(open => {
            if (!open && !askedCamerasRef.current && connected) {
                askedCamerasRef.current = true
                refreshCameras()
            }
            return !open
        })
    }, [connected, refreshCameras])

    /**
     * Switching camera boots the other firmware slot, so the device reboots and
     * is unusable for about twenty seconds. Worth confirming rather than doing
     * on a stray tap on a segmented control.
     */
    const onPickCamera = useCallback((value: string) => {
        const target = value as CameraVariant
        if (target === activeCamera || cameraBusy) return
        Alert.alert(
            `Switch to ${CAMERA_VARIANT_LABELS[target as 'RP3' | 'HM0360']}?`,
            'The device reboots into the other camera image. It will be unavailable for about 20 seconds.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Switch',
                    onPress: async () => {
                        const ok = await switchTo(target)
                        // The other slot is a different firmware image booting a
                        // different sensor, so the health verdict from before the
                        // switch no longer describes this device.
                        if (ok) await recheckHealth()
                    },
                },
            ],
        )
    }, [activeCamera, cameraBusy, switchTo, recheckHealth])

    // Log one row per completed measurement, carrying both rules' verdicts.
    //
    // `resetReadings()` clears both readings when the measurement starts, so a
    // non-null value here can only have arrived during *this* measurement.
    // Without that reset the previous measurement's registers would satisfy the
    // guard below and be logged against the new one, a wrong row that looks
    // entirely correct and is permanent once written.
    //
    // If no block arrives, nothing is logged, which is the honest outcome. A
    // reading with a failed photo IS logged: the measurement is real even when
    // the transfer breaks, which is the situation on HM0360 devices today.
    useEffect(() => {
        if (busy || measurementId === 0) return
        if (loggedIdRef.current === measurementId) return
        if (!reading) return

        loggedIdRef.current = measurementId
        addReading({
            timestamp: new Date().toISOString(),
            aeMean: reading.aeMean,
            integration: aeData?.integration ?? '',
            analogGain: aeData?.analogGain ?? '',
            digitalGain: aeData?.digitalGain ?? '',
            aeConverged: aeData?.aeConverged ?? '',
            darkThreshold: threshold,
            deviceName: device?.name ?? deviceId ?? 'unknown',
            approach: 'compare',
            meanRuleDark: meanDark ?? undefined,
            gainRuleDark: gainDark ?? undefined,
            dark: lightCheck?.dark,
            deviceLine: lightCheck?.raw,
            gainRailed: lightCheck?.gainRailed ?? undefined,
            imageUri: capturedImageUri ?? undefined,
            note: note.trim() || undefined,
        })
    }, [busy, measurementId, reading, aeData, lightCheck, threshold, meanDark, gainDark, device?.name, deviceId, capturedImageUri, note, addReading])

    const registerLine = reading
        ? [
            reading.analogGain !== null ? `gain ${reading.analogGain}` : null,
            reading.digitalGain !== null ? `digital ${reading.digitalGain}` : null,
            reading.integration !== null ? `integration ${reading.integration} lines` : null,
            reading.converged === null ? null : reading.converged ? 'converged' : 'not converged',
        ].filter(Boolean).join(' · ')
        : ''

    const measureLabel = streaming
        ? `Streaming… ${streamCount} logged`
        : busy
            ? (captureStage || stage || 'Measuring…')
            : 'Measure light now'

    return (
        // The keyboard-aware scroll view the rest of the app uses (see
        // WWScreenView). The app declares adjustPan on Android, so a plain
        // ScrollView cannot reach anything under an open keyboard: the window
        // shifts instead of the content resizing. This one keeps the focused
        // field visible and leaves the rest scrollable.
        <KeyboardAwareScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { padding: spacing, gap: spacing }]}
            keyboardShouldPersistTaps="handled"
            bottomOffset={bottom + spacing}
        >
            <WWBleDisconnectedBanner connected={connected} dfuInProgress={!!device?.dfuInProgress} />

            {/* A fault needs a physical fix, so it only explains itself. Being
                switched off is a state the app can undo, so it offers the fix.
                Neither blocks the screen: an engineer diagnosing a broken camera
                is exactly the person who needs to get in here. */}
            <DeviceHealthBanner
                issues={healthIssues}
                // Wrapped so the press event is not passed through as the `force`
                // argument, which would work only by accident.
                onRecheck={() => { recheckHealth() }}
                isChecking={readiness === 'checking'}
            />

            {readiness === 'cameraOff' && (
                <Surface style={[styles.notice, { backgroundColor: colors.surfaceVariant }]} elevation={1}>
                    <WWText variant="titleSmall">Camera is switched off</WWText>
                    <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                        Measuring will not work until it is on. Ending a deployment leaves it this way.
                    </WWText>
                    <Button mode="contained" onPress={enableCamera} loading={isFixing} disabled={isFixing}>
                        <WWText style={styles.buttonLabel}>Turn the camera on</WWText>
                    </Button>
                </Surface>
            )}

            {/* Hidden entirely when no photo was asked for: with the tick off the
                screen is just the reading, the button and the log. */}
            {withPhoto && (
                <View style={[styles.preview, { backgroundColor: colors.surfaceVariant }]}>
                    {capturedImageUri && !isCapturing ? (
                        <Image source={{ uri: capturedImageUri }} style={styles.image} resizeMode="contain" />
                    ) : (
                        <View style={styles.previewBusy}>
                            <WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                                {isCapturing ? (captureStage || 'Capturing…') : 'No image yet'}
                            </WWText>
                            {isCapturing && (
                                <>
                                    {/* Indeterminate until bytes start arriving: the capture and
                                        sleep phases before the transfer have no measurable progress. */}
                                    <ProgressBar
                                        indeterminate={captureProgress <= 0}
                                        progress={captureProgress}
                                        style={styles.progressBar}
                                    />
                                    {captureProgress > 0 && (
                                        <WWText variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>
                                            {Math.round(captureProgress * 100)}%
                                            {eta ? ` · about ${eta} left` : ''}
                                        </WWText>
                                    )}
                                </>
                            )}
                        </View>
                    )}
                </View>
            )}

            <Surface style={[styles.card, { backgroundColor: colors.surface }]} elevation={1}>
                <View style={styles.result}>
                    <WWText variant="headlineMedium">
                        {reading ? `Light level ${reading.aeMean} of 255` : 'Light level — of 255'}
                    </WWText>
                    {reading && registerLine !== '' && (
                        <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{registerLine}</WWText>
                    )}
                </View>
            </Surface>

            <Button
                mode="contained"
                onPress={measureOnce}
                loading={busy && !streaming}
                disabled={!connected || busy || streaming}
            >
                <WWText style={styles.buttonLabel}>{measureLabel}</WWText>
            </Button>

            <WWTextInput
                label="Note for the next reading (optional)"
                value={note}
                onChange={(t: string) => setNote(t)}
                onBlur={() => { if (note.trim() && readings.length > 0) annotateLast(note.trim()) }}
            />

            {/* The log is its own card, with the two things you do to a log
                beside its count. Export moved here from Settings for that reason. */}
            <Surface style={[styles.card, { backgroundColor: colors.surface }]} elevation={1}>
                <View style={styles.row}>
                    <WWText variant="titleSmall">Logged readings: {readings.length}</WWText>
                    <View style={styles.rowActions}>
                        <Button compact mode="text" onPress={exportCsv} disabled={readings.length === 0}>Export</Button>
                        {readings.length > 0 && (
                            <Button compact mode="text" onPress={clear} textColor={colors.error}>Clear</Button>
                        )}
                    </View>
                </View>
            </Surface>

            {/* Collapsed by default, which also means the camera state costs
                nothing until someone asks for it: the slots query only fires the
                first time this is opened. */}
            <List.Accordion
                title="Settings"
                expanded={settingsOpen}
                onPress={onToggleSettings}
                style={{ backgroundColor: colors.surfaceVariant }}
            >
                <View style={styles.settings}>
                    <View style={styles.setting}>
                        <WWText variant="titleSmall">Photo</WWText>
                        <Checkbox.Item
                            label="Take photos and measure light"
                            position="leading"
                            status={withPhoto ? 'checked' : 'unchecked'}
                            onPress={() => setWithPhoto(v => !v)}
                            disabled={busy || streaming}
                            style={styles.checkbox}
                            labelStyle={styles.checkboxLabel}
                        />
                    </View>

                    <Divider />

                    <View style={styles.setting}>
                        <WWText variant="titleSmall">Stream</WWText>
                        {/* Each half wrapped in its own View so the split is the
                            row's decision: a Paper input given a width takes the
                            whole row and squeezes the button to an ellipsis. */}
                        <View style={styles.streamRow}>
                            <View style={styles.grow}>
                                {streaming ? (
                                    <Button mode="outlined" onPress={stopStream}>
                                        <WWText>{`Stop stream (${streamCount})`}</WWText>
                                    </Button>
                                ) : (
                                    <Button
                                        mode="outlined"
                                        onPress={startStream}
                                        disabled={!connected || busy || withPhoto}
                                    >
                                        <WWText>Start stream</WWText>
                                    </Button>
                                )}
                            </View>
                            <View style={styles.stepper}>
                                <IconButton
                                    icon="minus"
                                    size={18}
                                    onPress={() => setIntervalS(s => Math.max(MIN_STREAM_INTERVAL_S, s - 1))}
                                    disabled={streaming || intervalS <= MIN_STREAM_INTERVAL_S}
                                />
                                <WWText variant="bodyMedium" style={styles.stepperValue}>{`${intervalS} s`}</WWText>
                                <IconButton
                                    icon="plus"
                                    size={18}
                                    onPress={() => setIntervalS(s => Math.min(MAX_STREAM_INTERVAL_S, s + 1))}
                                    disabled={streaming || intervalS >= MAX_STREAM_INTERVAL_S}
                                />
                            </View>
                        </View>
                        <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                            Seconds between readings.
                        </WWText>
                        {withPhoto && !streaming && (
                            <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                                Streaming is light-only. Untick the photo option to stream.
                            </WWText>
                        )}
                    </View>

                    <Divider />

                    <View style={styles.setting}>
                        <WWText variant="titleSmall">Camera</WWText>
                        <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                            {cameraBusy
                                ? (cameraStage || 'Switching…')
                                : activeCamera === 'unknown'
                                    ? 'Reading the device…'
                                    : `Running ${activeCamera}. Switching reboots the device and takes about 20 seconds.`}
                        </WWText>
                        <SegmentedButtons
                            value={activeCamera === 'unknown' ? '' : activeCamera}
                            onValueChange={onPickCamera}
                            buttons={[
                                { value: 'RP3', label: CAMERA_VARIANT_LABELS.RP3, disabled: cameraBusy || busy || streaming },
                                { value: 'HM0360', label: CAMERA_VARIANT_LABELS.HM0360, disabled: cameraBusy || busy || streaming },
                            ]}
                        />
                    </View>
                </View>
            </List.Accordion>

            <View style={styles.spacer} />
        </KeyboardAwareScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
    },
    preview: {
        height: 260,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    previewBusy: {
        alignItems: 'center',
        alignSelf: 'stretch',
        paddingHorizontal: 24,
        gap: 10,
    },
    progressBar: {
        alignSelf: 'stretch',
        height: 6,
        borderRadius: 3,
    },
    notice: {
        borderRadius: 12,
        padding: 16,
        gap: 8,
    },
    card: {
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
    result: {
        alignItems: 'center',
        gap: 4,
    },
    rowActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    streamRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepperValue: {
        minWidth: 36,
        textAlign: 'center',
    },
    grow: {
        flex: 1,
    },
    checkbox: {
        paddingHorizontal: 0,
    },
    checkboxLabel: {
        textAlign: 'left',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    settings: {
        paddingHorizontal: 8,
        // Top padding specifically: the accordion header sits directly above and
        // the first control read as attached to the title without it.
        paddingTop: 16,
        paddingBottom: 8,
        gap: 16,
    },
    setting: {
        gap: 8,
    },
    buttonLabel: {
        color: 'white',
    },
    spacer: {
        height: 32,
    },
})
