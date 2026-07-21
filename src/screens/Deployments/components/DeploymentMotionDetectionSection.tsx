import React, { useCallback, useState, useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Button, Text, ProgressBar, useTheme } from 'react-native-paper'

import { WWText } from '../../../components/ui/WWText'
import { WWButton } from '../../../components/ui/WWButton'
import { WWIcon } from '../../../components/ui/WWIcon'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useMotionDetectionStream } from '../../Devices/hooks/useMotionDetectionStream'
import { MotionGrid } from '../../Devices/components/MotionGrid'
import { useTimer } from '../../../hooks/useTimer'
import { logError } from '../../../utils/logger'

/** Default capture settings for deployment MD test */
const CAPTURE_COUNT = 20
const CAPTURE_INTERVAL_MS = 1000

interface DeploymentMotionDetectionSectionProps {
    device?: ExtendedPeripheral
    project?: {
        activity_detection_sensitivity_id?: number | null;
        capture_method_id?: number | null;
    }
    onShowHelp: (title: string, content: string) => void
}

export const DeploymentMotionDetectionSection: React.FC<DeploymentMotionDetectionSectionProps> = ({
    device,
    project,
    onShowHelp
}) => {
    const theme = useTheme()
    const [isPreparing, setIsPreparing] = useState(false)

    const {
        mdGrid,
        isTesting,
        testFinished,
        startTest,
        mdBlocksCount,
        motionDetected,
        frameCount,
        statusMessage,
    } = useMotionDetectionStream({ device })

    // Elapsed time counter: ticks every second while testing
    const { elapsedSec } = useTimer(isTesting)

    // Reset elapsed time when test finishes
    useEffect(() => {
        if (testFinished && !isTesting) {
            // Keep the final elapsed time
        }
    }, [testFinished, isTesting])

    // Estimated total duration (capture count × interval + setup overhead)
    const estimatedTotalSec = Math.ceil(
        (CAPTURE_COUNT * CAPTURE_INTERVAL_MS) / 1000 + 5 // 5s setup overhead
    )

    const handleStartTest = useCallback(async () => {
        if (!device || !project?.activity_detection_sensitivity_id) return

        setIsPreparing(true)
        try {
            await startTest(
                project.activity_detection_sensitivity_id ?? 3,
                CAPTURE_INTERVAL_MS,
                CAPTURE_COUNT,
            )
        } catch (error) {
            logError('[DeploymentMD] Failed to start motion detection test', error)
        } finally {
            setIsPreparing(false)
        }
    }, [device, project, startTest])

    const renderHelp = useCallback((props: any) => (
        <Button
            {...props}
            icon="help-circle-outline"
            onPress={() => onShowHelp(
                'Motion Detection Test',
                `Starts a ${CAPTURE_COUNT}-frame motion detection test using your project's sensitivity settings.\n\n` +
                `Once started, the test runs for approximately ${estimatedTotalSec} seconds and cannot be stopped early: ` +
                'the firmware controls the capture sequence internally.\n\n' +
                'The 16×16 grid shows which zones detected movement between frames.'
            )}
        >
            <Text>Help</Text>
        </Button>
    ), [onShowHelp, estimatedTotalSec])

    // Only render for Activity Detection projects
    if (!project || project.capture_method_id !== 1) {
        return null
    }

    const disabled = !device || isPreparing || isTesting
    const progress = CAPTURE_COUNT > 0 ? frameCount / CAPTURE_COUNT : 0

    /** Format seconds as m:ss */
    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60)
        const s = sec % 60
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    return (
        <View>
            <Card style={styles.card}>
                <Card.Title
                    title="Motion Detection"
                    right={renderHelp}
                />
                <Card.Content>
                    {/* Start button: disabled once test is running */}
                    <WWButton
                        mode="outlined"
                        onPress={handleStartTest}
                        disabled={disabled}
                        loading={isPreparing}
                    >
                        <Text>
                            {isPreparing
                                ? 'Preparing…'
                                : isTesting
                                    ? 'Test Running…'
                                    : testFinished
                                        ? 'Run Again'
                                        : 'Test Motion Detection'}
                        </Text>
                    </WWButton>

                    {/* Duration info: shown before and during test */}
                    {!isTesting && !testFinished && (
                        <WWText variant="bodySmall" style={styles.durationHint}>
                            ⏱ Test captures {CAPTURE_COUNT} frames (~{estimatedTotalSec}s).
                            Once started, it cannot be stopped early.
                        </WWText>
                    )}

                    {/* ───────── Active test view ───────── */}
                    {isTesting && (
                        <>
                            {/* Progress bar + timing log */}
                            <View style={styles.progressSection}>
                                <ProgressBar
                                    progress={progress}
                                    color={theme.colors.primary}
                                    style={styles.progressBar}
                                />
                                <View style={styles.timingRow}>
                                    <WWText variant="labelSmall" style={styles.timingText}>
                                        Frame {frameCount}/{CAPTURE_COUNT}
                                    </WWText>
                                    <WWText variant="labelSmall" style={styles.timingText}>
                                        {formatTime(elapsedSec)} / ~{formatTime(estimatedTotalSec)}
                                    </WWText>
                                </View>
                                {statusMessage ? (
                                    <WWText variant="bodySmall" style={styles.statusText}>
                                        {statusMessage}
                                    </WWText>
                                ) : null}
                            </View>

                            {/* Cannot-stop notice */}
                            <View style={[styles.noticeBanner, { backgroundColor: theme.colors.secondaryContainer }]}>
                                <WWIcon source="information-outline" size={16} color={theme.colors.onSecondaryContainer} />
                                <WWText variant="bodySmall" style={[styles.noticeText, { color: theme.colors.onSecondaryContainer }]}>
                                Test in progress. The device controls the capture sequence and cannot be stopped from the app.
                                </WWText>
                            </View>

                            {/* 16x16 Grid */}
                            <View style={styles.gridContainer}>
                                <WWText variant="bodySmall" style={styles.blocksText}>
                                    Motion in {mdBlocksCount} blocks
                                </WWText>
                                <MotionGrid gridString={mdGrid} />
                            </View>

                            {/* Motion threshold indicator */}
                            <View style={[
                                styles.motionIndicator,
                                motionDetected && styles.motionIndicatorActive
                            ]}>
                                <WWIcon
                                    source={motionDetected ? 'paw' : 'paw-off'}
                                    size={18}
                                    color={motionDetected ? theme.colors.primary : theme.colors.onSurfaceVariant}
                                />
                                <WWText
                                    variant="bodySmall"
                                    style={[
                                        styles.motionText,
                                        motionDetected && styles.motionTextActive,
                                        motionDetected && { color: theme.colors.primary }
                                    ]}
                                >
                                    {motionDetected ? 'Motion threshold exceeded!' : 'No motion'}
                                </WWText>
                            </View>
                        </>
                    )}

                    {/* ───────── Test complete view ───────── */}
                    {testFinished && !isTesting && (
                        <View style={[styles.noticeBanner, { backgroundColor: '#4CAF5018' }]}>
                            <WWIcon source="check-circle-outline" size={16} color="#4CAF50" />
                            <WWText variant="bodySmall" style={[styles.noticeText, { color: '#4CAF50' }]}>
                                Test completed: {frameCount} frames captured in {formatTime(elapsedSec)}.
                            </WWText>
                        </View>
                    )}
                </Card.Content>
            </Card>
        </View>
    )
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 8
    },
    durationHint: {
        opacity: 0.6,
        marginTop: 8,
        textAlign: 'center',
    },
    progressSection: {
        marginTop: 12,
    },
    progressBar: {
        height: 4,
        borderRadius: 2,
    },
    timingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    timingText: {
        opacity: 0.6,
    },
    statusText: {
        opacity: 0.5,
        marginTop: 2,
    },
    noticeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginTop: 12,
        borderRadius: 8,
        gap: 8,
    },
    noticeText: {
        flex: 1,
    },
    blocksText: {
        opacity: 0.7,
        marginBottom: 8,
        textAlign: 'center',
    },
    gridContainer: {
        marginTop: 12,
        alignItems: 'center',
        padding: 4,
        backgroundColor: '#00000008',
        borderRadius: 8,
    },
    motionIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        marginTop: 12,
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
        fontWeight: '600',
    }
})
