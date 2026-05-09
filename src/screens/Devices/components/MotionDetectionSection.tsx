import React, { useCallback, useState, useEffect } from 'react'
import { View, StyleSheet, FlatList } from 'react-native'
import { Card, SegmentedButtons, TextInput, ProgressBar, Banner, useTheme } from 'react-native-paper'

import { WWText } from '../../../components/ui/WWText'
import { WWButton } from '../../../components/ui/WWButton'
import { WWIcon } from '../../../components/ui/WWIcon'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useMotionDetectionStream, FrameSnapshot } from '../hooks/useMotionDetectionStream'
import { log } from '../../../utils/logger'
import { MotionGrid, MiniGrid } from './MotionGrid'

const MIN_INTERVAL_SEC = 0.3
const MAX_INTERVAL_SEC = 20
const DEFAULT_INTERVAL_SEC = '1.0'
const MIN_PHOTOS = 1
const MAX_PHOTOS = 60
const DEFAULT_PHOTOS = '20'

interface MotionDetectionSectionProps {
    bleDevice: ExtendedPeripheral | undefined
    isInitializing: boolean
    bleDeviceConnected: boolean
    onShowHelp?: (title: string, content: string) => void
}

export const MotionDetectionSection: React.FC<MotionDetectionSectionProps> = ({
    bleDevice,
    isInitializing,
    bleDeviceConnected,
}) => {
    const theme = useTheme()
    const [sensitivity, setSensitivity] = useState<string>('1')
    const [intervalText, setIntervalText] = useState(DEFAULT_INTERVAL_SEC)
    const [intervalError, setIntervalError] = useState<string | undefined>(undefined)
    const [photosText, setPhotosText] = useState(DEFAULT_PHOTOS)
    const [photosError, setPhotosError] = useState<string | undefined>(undefined)
    const [selectedFrame, setSelectedFrame] = useState<number | null>(null)

    // Flash parameters
    const [flashLed, setFlashLed] = useState<string>('0')
    const [ledBrightness, setLedBrightness] = useState<string>('5')

    const {
        mdGrid,
        isTesting,
        startTest,
        mdBlocksCount,
        motionDetected,
        frameCount,
        frameHistory,
        statusMessage,
        errorMessage,
        clearError,
    } = useMotionDetectionStream({ device: bleDevice })

    // Sensitivity is only changed while test is stopped.
    const handleSensitivityChange = useCallback((val: string) => {
        setSensitivity(val)
    }, [])

    // Validate and clamp interval input
    const validateInterval = useCallback((text: string): number | null => {
        const val = parseFloat(text)
        if (isNaN(val)) {
            setIntervalError('Enter a number')
            return null
        }
        if (val < MIN_INTERVAL_SEC) {
            setIntervalError(`Min ${MIN_INTERVAL_SEC}s`)
            return null
        }
        if (val > MAX_INTERVAL_SEC) {
            setIntervalError(`Max ${MAX_INTERVAL_SEC}s`)
            return null
        }
        setIntervalError(undefined)
        return val
    }, [])

    const handleIntervalChange = useCallback((text: string) => {
        setIntervalText(text)
        validateInterval(text)
    }, [validateInterval])

    // Validate photo count input
    const validatePhotos = useCallback((text: string): number | null => {
        const val = parseInt(text, 10)
        if (isNaN(val)) {
            setPhotosError('Enter a number')
            return null
        }
        if (val < MIN_PHOTOS) {
            setPhotosError(`Min ${MIN_PHOTOS}`)
            return null
        }
        if (val > MAX_PHOTOS) {
            setPhotosError(`Max ${MAX_PHOTOS}`)
            return null
        }
        setPhotosError(undefined)
        return val
    }, [])

    const handlePhotosChange = useCallback((text: string) => {
        setPhotosText(text)
        validatePhotos(text)
    }, [validatePhotos])

    // Compute total test duration for display
    const totalDurationSec = (() => {
        const interval = parseFloat(intervalText)
        const photos = parseInt(photosText, 10)
        if (isNaN(interval) || isNaN(photos)) return null
        return Math.round(interval * photos)
    })()

    // Start the test with the currently selected sensitivity, interval and photo count
    const handleStartTest = useCallback(() => {
        const level = parseInt(sensitivity, 10)
        const intervalSec = validateInterval(intervalText)
        const photoCount = validatePhotos(photosText)
        if (intervalSec === null || photoCount === null) return

        const intervalMs = Math.round(intervalSec * 1000)
        const flashLedVal = parseInt(flashLed, 10)
        const ledBrightnessVal = Math.min(100, Math.max(0, parseInt(ledBrightness, 10) || 0))
        log(`[MotionDetectionSection] Starting test: sensitivity=${level}, interval=${intervalMs}ms, photos=${photoCount}, flash=${flashLedVal}, brightness=${ledBrightnessVal}`)
        setSelectedFrame(null)
        startTest(level, intervalMs, photoCount, flashLedVal, ledBrightnessVal)
    }, [sensitivity, intervalText, photosText, flashLed, ledBrightness, validateInterval, validatePhotos, startTest])

    // Cleanup on unmount only — no auto-start
    useEffect(() => {
        return () => {
            log('[MotionDetectionSection] Unmounting')
        }
    }, [])

    const disabled = isInitializing || !bleDeviceConnected
    const hasInputError = !!intervalError || !!photosError

    // Pre-compute cell styles to avoid inline object allocation (256 cells × every render)
    // Note: gridCellStyles removed — TextGrid uses colored text spans instead of View styles


    // The currently displayed detail frame (selected from history, or live grid)
    const selectedSnapshot: FrameSnapshot | null =
        selectedFrame !== null
            ? frameHistory.find(f => f.frameIndex === selectedFrame) ?? null
            : null

    return (
        <Card style={styles.card}>
            <Card.Content>

                {/* ───────── Controls: hidden during test ───────── */}
                {!isTesting && (
                    <>
                        {/* Sensitivity level */}
                        <WWText variant="bodyMedium" style={styles.label}>Sensitivity</WWText>
                        <SegmentedButtons
                            value={sensitivity}
                            onValueChange={handleSensitivityChange}
                            buttons={[
                                { value: '1', label: 'Low', disabled },
                                { value: '2', label: 'Med', disabled },
                                { value: '3', label: 'High', disabled }
                            ]}
                            style={styles.segmented}
                        />

                        {/* Detection interval and photo count side by side */}
                        <View style={styles.inputsRow}>
                            <View style={styles.inputWrapper}>
                                <WWText variant="bodyMedium" style={styles.label}>Interval</WWText>
                                <TextInput
                                    mode="outlined"
                                    value={intervalText}
                                    onChangeText={handleIntervalChange}
                                    keyboardType="decimal-pad"
                                    right={<TextInput.Affix text="sec" />}
                                    disabled={disabled}
                                    error={!!intervalError}
                                    dense
                                />
                                {intervalError ? (
                                    <WWText variant="bodySmall" style={styles.errorText}>
                                        {intervalError}
                                    </WWText>
                                ) : (
                                    <WWText variant="bodySmall" style={styles.hintText}>
                                        {MIN_INTERVAL_SEC}s – {MAX_INTERVAL_SEC}s
                                    </WWText>
                                )}
                            </View>

                            <View style={styles.inputWrapper}>
                                <WWText variant="bodyMedium" style={styles.label}>Photos</WWText>
                                <TextInput
                                    mode="outlined"
                                    value={photosText}
                                    onChangeText={handlePhotosChange}
                                    keyboardType="number-pad"
                                    right={<TextInput.Affix text="pics" />}
                                    disabled={disabled}
                                    error={!!photosError}
                                    dense
                                />
                                {photosError ? (
                                    <WWText variant="bodySmall" style={styles.errorText}>
                                        {photosError}
                                    </WWText>
                                ) : (
                                    <WWText variant="bodySmall" style={styles.hintText}>
                                        {MIN_PHOTOS} – {MAX_PHOTOS}
                                    </WWText>
                                )}
                            </View>
                        </View>

                        {/* Estimated duration */}
                        {totalDurationSec !== null && !hasInputError && (
                            <WWText variant="bodySmall" style={styles.durationText}>
                                Estimated duration: ~{totalDurationSec}s
                            </WWText>
                        )}

                        {/* Flash LED controls */}
                        <WWText variant="bodyMedium" style={styles.label}>Flash LED Type</WWText>
                        <SegmentedButtons
                            value={flashLed}
                            onValueChange={setFlashLed}
                            buttons={[
                                { value: '0', label: 'Off', disabled },
                                { value: '1', label: 'Visible', disabled },
                                { value: '2', label: 'IR', disabled },
                            ]}
                            style={styles.segmented}
                        />

                        {flashLed !== '0' && (
                            <View style={styles.brightnessRow}>
                                <WWText variant="bodyMedium" style={styles.label}>LED Brightness</WWText>
                                <TextInput
                                    mode="outlined"
                                    value={ledBrightness}
                                    onChangeText={(t) => {
                                        const cleaned = t.replace(/[^0-9]/g, '')
                                        const val = Math.min(100, Math.max(0, parseInt(cleaned, 10) || 0))
                                        setLedBrightness(val.toString())
                                    }}
                                    keyboardType="numeric"
                                    right={<TextInput.Affix text="%" />}
                                    disabled={disabled}
                                    style={styles.brightnessInput}
                                    dense
                                />
                                <WWText variant="bodySmall" style={styles.hintText}>0 – 100</WWText>
                            </View>
                        )}

                        {/* Start button */}
                        <WWButton
                            mode="contained"
                            onPress={handleStartTest}
                            disabled={disabled || hasInputError}
                            icon="play-circle-outline"
                            style={styles.startButton}
                        >
                            Start Test
                        </WWButton>
                    </>
                )}

                {/* ───────── Error banner ───────── */}
                {!!errorMessage && !isTesting && (
                    <Banner
                        visible
                        icon="alert-circle-outline"
                        actions={[{
                            label: 'Dismiss',
                            onPress: clearError,
                        }]}
                        style={[styles.errorBanner, { backgroundColor: theme.colors.errorContainer }]}
                    >
                        {errorMessage}
                    </Banner>
                )}

                {/* ───────── Live test view ───────── */}
                {isTesting && (
                    <>
                        {/* Dynamic status progress */}
                        <View style={styles.statusContainer}>
                            <View style={styles.statusRow}>
                                <WWIcon source="pulse" size={16} color={theme.colors.primary} />
                                <WWText variant="bodySmall" style={[styles.statusText, { color: theme.colors.primary }]}>
                                    {statusMessage || 'Initializing…'}
                                </WWText>
                            </View>
                            <ProgressBar
                                progress={frameCount / Math.max(parseInt(photosText, 10) || 1, 1)}
                                color={theme.colors.primary}
                                style={styles.progressBar}
                            />
                        </View>

                        {/* Frame count + blocks info */}
                        <WWText variant="bodySmall" style={styles.blocksText}>
                            Frame {frameCount}/{photosText} · Motion in {mdBlocksCount} blocks
                        </WWText>

                        {/* Live Motion Grid */}
                        <View style={styles.gridContainer}>
                            <WWText variant="labelSmall" style={styles.gridLabel}>Live — Motion Detection Grid (16×16)</WWText>
                            {parseFloat(intervalText) < 1.0 && (
                                <WWText variant="labelSmall" style={styles.throttleNote}>
                                    ⚡ Live grid refreshes at 5fps for stability
                                </WWText>
                            )}
                            <View style={styles.gridBox}>
                                <MotionGrid gridString={mdGrid} />
                            </View>
                        </View>

                        {/* Motion threshold indicator */}
                        <View style={[
                            styles.motionIndicator,
                            motionDetected && styles.motionIndicatorActive
                        ]}>
                            <WWIcon
                                source={motionDetected ? 'motion-sensor' : 'motion-sensor-off'}
                                size={18}
                                color={motionDetected ? '#4CAF50' : theme.colors.onSurfaceVariant}
                            />
                            <WWText
                                variant="bodySmall"
                                style={[
                                    styles.motionText,
                                    motionDetected && styles.motionTextActive
                                ]}
                            >
                                {motionDetected ? 'Motion threshold exceeded!' : 'No motion'}
                            </WWText>
                        </View>
                    </>
                )}

                {/* ───────── Frame history (after test or while testing) ───────── */}
                {frameHistory.length > 0 && (
                    <View style={styles.historySection}>
                        <WWText variant="labelMedium" style={styles.historyTitle}>
                            Frame History ({frameHistory.length})
                        </WWText>

                        {/* Virtualized horizontal mini-grid thumbnails */}
                        <FlatList
                            data={frameHistory}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.historyScroll}
                            initialNumToRender={5}
                            windowSize={3}
                            maxToRenderPerBatch={5}
                            removeClippedSubviews
                            keyExtractor={(item) => `hist-${item.frameIndex}`}
                            renderItem={({ item: snap }) => {
                                const isSelected = selectedFrame === snap.frameIndex
                                const hasMotion = snap.blockCount > 0
                                return (
                                    <View
                                        style={[
                                            styles.historyItem,
                                            isSelected && { borderColor: theme.colors.primary, borderWidth: 2 },
                                        ]}
                                        onTouchEnd={() => setSelectedFrame(
                                            isSelected ? null : snap.frameIndex
                                        )}
                                    >
                                        <MiniGrid gridString={snap.gridString} />
                                        <WWText variant="labelSmall" style={styles.historyFrameLabel}>
                                            #{snap.frameIndex}
                                        </WWText>
                                        <WWText
                                            variant="labelSmall"
                                            style={[
                                                styles.historyBlockLabel,
                                                hasMotion && { color: '#4CAF50' },
                                            ]}
                                        >
                                            {snap.blockCount} blk
                                        </WWText>
                                    </View>
                                )
                            }}
                        />

                        {/* Selected frame detail view */}
                        {selectedSnapshot && (
                            <View style={styles.detailSection}>
                                <WWText variant="labelSmall" style={styles.gridLabel}>
                                    Frame #{selectedSnapshot.frameIndex} — {selectedSnapshot.blockCount} motion blocks
                                </WWText>
                                <View style={styles.gridBox}>
                                    <MotionGrid gridString={selectedSnapshot.gridString} />
                                </View>
                            </View>
                        )}
                    </View>
                )}
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 16,
    },
    label: {
        marginBottom: 8,
    },
    segmented: {
        marginBottom: 16,
    },
    inputsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 4,
    },
    inputWrapper: {
        flex: 1,
    },
    errorText: {
        color: '#D32F2F',
        marginTop: 2,
        marginBottom: 8,
    },
    hintText: {
        opacity: 0.5,
        marginTop: 2,
        marginBottom: 8,
    },
    durationText: {
        opacity: 0.6,
        fontStyle: 'italic',
        textAlign: 'center',
        marginBottom: 8,
    },
    brightnessRow: {
        marginBottom: 12,
    },
    brightnessInput: {
        marginBottom: 4,
    },
    startButton: {
        marginBottom: 12,
    },
    statusContainer: {
        marginBottom: 12,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    statusText: {
        flex: 1,
        fontStyle: 'italic',
    },
    progressBar: {
        borderRadius: 4,
        height: 4,
    },
    errorBanner: {
        marginBottom: 12,
        borderRadius: 8,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 12,
        gap: 8,
    },
    infoText: {
        flex: 1,
    },
    blocksText: {
        fontStyle: 'italic',
        marginBottom: 12,
        textAlign: 'center',
    },
    gridContainer: {
        alignItems: 'center',
        marginBottom: 8,
    },
    gridLabel: {
        marginBottom: 6,
        opacity: 0.7,
        fontWeight: '700',
        textAlign: 'center',
    },
    throttleNote: {
        opacity: 0.5,
        textAlign: 'center',
        marginBottom: 4,
        fontSize: 10,
    },
    gridBox: {
        borderRadius: 8,
        padding: 8,
        alignItems: 'center',
        backgroundColor: '#00000010',
    },
    motionIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        marginTop: 8,
        borderRadius: 6,
        backgroundColor: '#00000008',
    },
    motionIndicatorActive: {
        backgroundColor: '#4CAF5018',
    },
    motionText: {
        marginLeft: 6,
        color: '#888',
    },
    motionTextActive: {
        color: '#4CAF50',
        fontWeight: '600',
    },
    // ── Frame history ──
    historySection: {
        marginTop: 16,
    },
    historyTitle: {
        marginBottom: 8,
        fontWeight: '700',
    },
    historyScroll: {
        paddingVertical: 4,
        gap: 8,
    },
    historyItem: {
        alignItems: 'center',
        borderRadius: 8,
        padding: 4,
        backgroundColor: '#00000008',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    historyFrameLabel: {
        marginTop: 2,
        opacity: 0.6,
        fontSize: 10,
    },
    historyBlockLabel: {
        fontSize: 10,
        opacity: 0.5,
    },
    detailSection: {
        marginTop: 12,
        alignItems: 'center',
    },
})
