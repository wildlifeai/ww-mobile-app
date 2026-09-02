import { useState, useRef, useEffect, useCallback } from 'react'
import { View, StyleSheet, ScrollView, Image, Alert } from 'react-native'
import { Button, Checkbox, Divider, List, ProgressBar, SegmentedButtons, Surface } from 'react-native-paper'
import { useRoute } from '@react-navigation/native'

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
import { lightMargin, type LightCheck } from '../../ble/protocol/lightCheck'

const formatDuration = (ms: number): string => {
    const s = Math.max(0, Math.round(ms / 1000))
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

/**
 * Time remaining for the image transfer, estimated from how fast progress is
 * actually moving rather than an assumed rate — throughput varies several-fold
 * with the BLE connection interval, so a fixed KB/s figure would mislead.
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

/**
 * Explain the verdict in one line.
 *
 * The interesting case is a railed sensor: both gains are at their ceiling, which
 * forces DARK regardless of the mean, so the screen can otherwise show a reading
 * comfortably above the threshold and call it dark with no visible reason.
 */
const explainDecision = (check: LightCheck): string => {
    const verdict = check.dark ? 'Dark' : 'Bright'
    const margin = lightMargin(check)

    const reason = check.gainRailed
        ? `sensor at maximum gain, so dark whatever the level reads`
        : `${Math.abs(margin)} ${margin >= 0 ? 'above' : 'below'} the threshold of ${check.threshold}`

    return check.converged === false
        ? `${verdict} — ${reason}, exposure still settling`
        : `${verdict} — ${reason}`
}

/**
 * Deliberately minimal: measure the light level, optionally alongside a photo,
 * and log the pair for later analysis. The tuning controls, auto camera switch
 * and AE explainer were stripped on 2026-08-21 — add them back one at a time as
 * bench testing shows they are needed.
 *
 * The photo is opt-in and off by default. Measuring without one uses `AI light`,
 * which takes about two seconds and transfers nothing, against roughly a minute
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
        activeCamera, autoSwitchOn, isBusy: cameraBusy, stage: cameraStage,
        refresh: refreshCameras, switchTo,
    } = useCameraSwitch({ device })
    const { capturedImageUri, isCapturing, captureStage, captureProgress, startCapture, clearImage } = useCapturePreview({ device })

    const eta = useTransferEta(isCapturing, captureProgress)

    const [withPhoto, setWithPhoto] = useState(false)
    const [note, setNote] = useState('')
    const [settingsOpen, setSettingsOpen] = useState(false)

    // Counts measurements rather than images, so the light-only path (which
    // produces no image to key on) still logs exactly one row per press.
    const [measurementId, setMeasurementId] = useState(0)
    const loggedIdRef = useRef(0)

    const connected = !!device?.connected
    const busy = isBusy || isCapturing

    // The decision line is the better source when the firmware sends one: it
    // carries the threshold and the reasoning, not just the number. A plain
    // capture with the flash and auto-switch both off runs no light check, so
    // the raw AE registers remain the fallback.
    const aeMean = lightCheck?.meanAE ?? (aeData ? parseInt(aeData.aeMean, 10) : NaN)
    const hasReading = !isNaN(aeMean)

    const onMeasure = useCallback(async () => {
        resetReadings()
        setMeasurementId(id => id + 1)

        if (withPhoto) {
            clearImage()
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
                'The device acknowledged the request but sent no measurement. Check the banner at the top for a hardware problem, or try again.',
            )
        }
    }, [withPhoto, resetReadings, clearImage, startCapture, measureNow, recheckHealth])

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

    // Log one row per completed measurement.
    //
    // `resetReadings()` clears both readings when the measurement starts, so a
    // non-null value here can only have arrived during *this* measurement.
    // Without that reset the previous measurement's values would satisfy the
    // guard below and be logged against the new one — a wrong row that looks
    // entirely correct, and permanent once written.
    //
    // If no reading arrives, nothing is logged, which is the honest outcome. A
    // reading with a failed photo IS logged: the light measurement is real even
    // when the transfer breaks, which is the situation on HM0360 devices today.
    useEffect(() => {
        if (busy || measurementId === 0) return
        if (loggedIdRef.current === measurementId) return
        if (isNaN(aeMean)) return

        loggedIdRef.current = measurementId
        addReading({
            timestamp: new Date().toISOString(),
            aeMean,
            integration: aeData?.integration ?? '',
            analogGain: aeData?.analogGain ?? (lightCheck?.analogGain != null ? String(lightCheck.analogGain) : ''),
            digitalGain: aeData?.digitalGain ?? '',
            aeConverged: aeData?.aeConverged ?? (lightCheck?.converged == null ? '' : lightCheck.converged ? 'Y' : 'N'),
            darkThreshold: lightCheck?.threshold ?? state.darkThreshold,
            dark: lightCheck?.dark,
            gainRailed: lightCheck?.gainRailed ?? undefined,
            deviceName: device?.name ?? deviceId ?? 'unknown',
            imageUri: capturedImageUri ?? undefined,
            note: note.trim() || undefined,
        })
    }, [busy, measurementId, aeMean, aeData, lightCheck, state.darkThreshold, device?.name, deviceId, capturedImageUri, note, addReading])

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { padding: spacing, gap: spacing }]}
            keyboardShouldPersistTaps="handled"
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
                                    {/* Indeterminate until bytes start arriving — the capture and
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

            <View style={styles.result}>
                <WWText variant="headlineMedium">
                    {hasReading ? `Light level ${aeMean} of 255` : 'Light level — of 255'}
                </WWText>
                {lightCheck && (
                    <WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                        {explainDecision(lightCheck)}
                    </WWText>
                )}
            </View>

            <Button
                mode="contained"
                onPress={onMeasure}
                loading={busy}
                disabled={!connected || busy}
            >
                <WWText style={styles.buttonLabel}>
                    {busy ? (captureStage || stage || 'Measuring…') : 'Measure light now'}
                </WWText>
            </Button>

            <WWTextInput
                label="Note for the next reading (optional)"
                value={note}
                onChange={(t: string) => setNote(t)}
                onBlur={() => { if (note.trim() && readings.length > 0) annotateLast(note.trim()) }}
            />

            <Divider />

            <View style={styles.row}>
                <WWText variant="titleSmall">Logged readings: {readings.length}</WWText>
                {readings.length > 0 && (
                    <Button compact mode="text" onPress={clear} textColor={colors.error}>Clear</Button>
                )}
            </View>

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
                    <Button mode="contained" onPress={exportCsv} disabled={readings.length === 0}>
                        <WWText style={styles.buttonLabel}>Export logged readings</WWText>
                    </Button>

                    <Checkbox.Item
                        label="Take photos and measure light"
                        position="leading"
                        status={withPhoto ? 'checked' : 'unchecked'}
                        onPress={() => setWithPhoto(v => !v)}
                        disabled={busy}
                        style={styles.checkbox}
                        labelStyle={styles.checkboxLabel}
                    />

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
                                { value: 'RP3', label: CAMERA_VARIANT_LABELS.RP3, disabled: cameraBusy || busy },
                                { value: 'HM0360', label: CAMERA_VARIANT_LABELS.HM0360, disabled: cameraBusy || busy },
                            ]}
                        />
                        {autoSwitchOn && (
                            <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                                Automatic day/night switching is on, so the device may switch back by itself.
                            </WWText>
                        )}
                    </View>
                </View>
            </List.Accordion>

            <View style={styles.spacer} />
        </ScrollView>
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
    result: {
        alignItems: 'center',
        gap: 4,
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
