import { useState, useRef, useEffect } from 'react'
import { View, StyleSheet, ScrollView, Image } from 'react-native'
import { Button, Divider, ProgressBar } from 'react-native-paper'
import { useRoute } from '@react-navigation/native'

import { useAppSelector } from '../../redux'
import { useExtendedTheme } from '../../theme'
import { WWText } from '../../components/ui/WWText'
import { WWTextInput } from '../../components/ui/WWTextInput'
import { WWBleDisconnectedBanner } from '../../components/ui/WWBleDisconnectedBanner'
import { useLightSensor } from '../../hooks/useLightSensor'
import { useCapturePreview } from '../../hooks/useCapturePreview'
import { useLightSensorLog } from '../../hooks/useLightSensorLog'

const formatDuration = (ms: number): string => {
    const s = Math.max(0, Math.round(ms / 1000))
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

/**
 * Time remaining for the image download, estimated from how fast progress is
 * actually moving rather than an assumed rate — throughput varies several-fold
 * with the BLE connection interval, so a fixed KB/s figure would mislead.
 *
 * Held back until the transfer is 3% in and 2s old: the first few chunks arrive
 * in a burst and would otherwise predict an absurdly short time.
 */
const useTransferEta = (isCapturing: boolean, progress: number): string | null => {
    const [eta, setEta] = useState<string | null>(null)
    const startRef = useRef<number | null>(null)

    useEffect(() => {
        if (!isCapturing || progress <= 0) {
            startRef.current = null
            setEta(null)
            return
        }
        if (startRef.current === null) startRef.current = Date.now()

        const elapsed = Date.now() - startRef.current
        if (progress < 0.03 || elapsed < 2000) return

        setEta(formatDuration((elapsed * (1 - progress)) / progress))
    }, [isCapturing, progress])

    return eta
}

/**
 * Deliberately minimal: capture a frame, show it next to its light level, log the
 * pair for later analysis. The tuning controls, auto camera switch and AE explainer
 * were stripped on 2026-08-21 — add them back one at a time as bench testing shows
 * they are needed.
 *
 * The light level is the AE mean sampled during the capture this screen triggers,
 * NOT the device's stored decision (op25). op25 only updates when the firmware has
 * a consumer for it (flash on, or auto camera switch), so it reads stale — which is
 * why this screen never shows it.
 */
export const LightSensorScreen = () => {
    const route = useRoute<any>()
    const { colors, spacing } = useExtendedTheme()

    const deviceId = route.params?.deviceId
    const device = useAppSelector(state => state.devices[deviceId || ''])

    const { state, aeData } = useLightSensor({ device })
    const { readings, addReading, annotateLast, clear, exportCsv, copyCsv } = useLightSensorLog()
    const { capturedImageUri, isCapturing, captureStage, captureProgress, startCapture } = useCapturePreview({ device })

    const eta = useTransferEta(isCapturing, captureProgress)

    const [note, setNote] = useState('')
    const connected = !!device?.connected
    const aeMean = aeData ? parseInt(aeData.aeMean, 10) : NaN
    const hasReading = !isNaN(aeMean)

    // Log one row per completed capture. Keyed on the image URI so a re-render
    // never double-logs, and so the row always carries the frame it belongs to.
    const loggedUriRef = useRef<string | null>(null)
    useEffect(() => {
        if (!capturedImageUri || isCapturing) return
        if (loggedUriRef.current === capturedImageUri) return
        if (!aeData || isNaN(parseInt(aeData.aeMean, 10))) return

        loggedUriRef.current = capturedImageUri
        addReading({
            timestamp: new Date().toISOString(),
            aeMean: parseInt(aeData.aeMean, 10),
            integration: aeData.integration,
            analogGain: aeData.analogGain,
            digitalGain: aeData.digitalGain,
            aeConverged: aeData.aeConverged,
            darkThreshold: state.darkThreshold,
            deviceName: device?.name ?? deviceId ?? 'unknown',
            imageUri: capturedImageUri,
            note: note.trim() || undefined,
        })
    }, [capturedImageUri, isCapturing, aeData, state.darkThreshold, device?.name, deviceId, note, addReading])

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { padding: spacing, gap: spacing }]}
            keyboardShouldPersistTaps="handled"
        >
            <WWBleDisconnectedBanner connected={connected} dfuInProgress={!!device?.dfuInProgress} />

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
                                    sleep phases before the download have no measurable progress. */}
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

            <View style={styles.result}>
                <WWText variant="headlineMedium">
                    {hasReading ? `Light level ${aeMean} of 255` : 'Light level — of 255'}
                </WWText>
            </View>

            <Button
                mode="contained"
                onPress={() => startCapture(1, 500)}
                loading={isCapturing}
                disabled={!connected || isCapturing}
            >
                <WWText style={styles.buttonLabel}>
                    {isCapturing ? (captureStage || 'Measuring…') : 'Measure light now'}
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

            <View style={styles.exportRow}>
                <Button mode="outlined" onPress={exportCsv} disabled={readings.length === 0} style={styles.exportButton}>
                    Export CSV
                </Button>
                <Button mode="outlined" onPress={copyCsv} disabled={readings.length === 0} style={styles.exportButton}>
                    Copy CSV
                </Button>
            </View>

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
    result: {
        alignItems: 'center',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    exportRow: {
        flexDirection: 'row',
        gap: 12,
    },
    exportButton: {
        flex: 1,
    },
    buttonLabel: {
        color: 'white',
    },
    spacer: {
        height: 32,
    },
})
