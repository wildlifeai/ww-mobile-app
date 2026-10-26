import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, ProgressBar, Text, useTheme } from 'react-native-paper'
import { ActionRow } from '../../../components/ui/ActionRow'
import { ActionDialog } from '../../../components/ui/ActionDialog'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useMotionDetectionStream } from '../../Devices/hooks/useMotionDetectionStream'
import { MotionGrid } from '../../Devices/components/MotionGrid'
import ReferenceDataService from '../../../services/ReferenceDataService'
import { mdSensitivityLevel } from '../../../utils/mdSensitivity'
import { log, logError, logWarn } from '../../../utils/logger'

/** The deployment's motion test: 20 frames at the 1000 ms a deployment writes to op11 */
const CAPTURE_COUNT = 20
const CAPTURE_INTERVAL_MS = 1000

interface Props {
    device?: ExtendedPeripheral
    project?: {
        activity_detection_sensitivity_id?: number | null
        capture_method_id?: number | null
    }
    onShowHelp: (title: string, content: string) => void
}

/**
 * Test Motion Detection, for motion projects only: opening the popup starts the
 * test at the project's sensitivity, with the live grid; the row then says
 * whether any frame saw motion. Once the firmware runs the capture it cannot be
 * stopped, so Close leaves the test running and the row shows it.
 */
export const MotionTestAction = ({ device, project, onShowHelp }: Props) => {
    const theme = useTheme()
    const [open, setOpen] = useState(false)
    const [isPreparing, setIsPreparing] = useState(false)
    const { mdGrid, isTesting, testFinished, startTest, mdBlocksCount, frameCount, sensitivityNote, frameHistory } =
        useMotionDetectionStream({ device })

    const handleStart = useCallback(async () => {
        if (!device || !project) return
        setIsPreparing(true)
        try {
            // The level is the reference row's value, never its id: ids differ
            // between tiers, and the id used to be sent as the level (#272). No
            // sensitivity, or one this build does not know, tests at medium.
            let sensitivityValue: string | undefined
            if (project.activity_detection_sensitivity_id) {
                try {
                    const sensitivities = await ReferenceDataService.getActivitySensitivity()
                    sensitivityValue = sensitivities.find(s => String(s.id) === String(project.activity_detection_sensitivity_id))?.value
                } catch (e) {
                    logWarn('[MotionTestAction] Could not read the sensitivity reference data, testing at medium:', e)
                }
            }
            const level = mdSensitivityLevel(sensitivityValue)
            log(`[MotionTestAction] Sensitivity ${sensitivityValue ?? 'not set'} -> level ${level}`)
            await startTest(level, CAPTURE_INTERVAL_MS, CAPTURE_COUNT)
        } catch (error) {
            logError('[MotionTestAction] Failed to start the motion test', error)
        } finally {
            setIsPreparing(false)
        }
    }, [device, project, startTest])

    if (!project || project.capture_method_id !== 1) return null

    const running = isPreparing || isTesting
    // With a wake threshold, only a frame that would have woken the camera counts (#500)
    const motionSeen = (frameHistory ?? []).some(f => f.wouldWake ?? f.blockCount > 0)

    const handleOpen = () => {
        setOpen(true)
        if (!running && !testFinished) handleStart()
    }

    return (
        <>
            <ActionRow
                title="Test Motion Detection"
                onPress={handleOpen}
                onHelp={() => onShowHelp(
                    'Test Motion Detection',
                    `Runs a ${CAPTURE_COUNT}-frame test at your project's sensitivity. Move in front of the camera while it runs. ` +
                    'It cannot be stopped once started: the camera runs the capture itself.\n\n' +
                    "The 16×16 grid is the HM0360 motion detector's own output, read once per frame: the zones where it saw change.",
                )}
                result={testFinished && !running ? (motionSeen ? 'Motion seen' : 'No motion') : null}
                busy={running}
                disabled={!device}
            />
            <ActionDialog
                visible={open}
                title="Test Motion Detection"
                onClose={() => setOpen(false)}
                actions={testFinished && !running ? <Button onPress={handleStart}>Run Again</Button> : undefined}
            >
                {/* What became of the project's sensitivity (#272) */}
                {sensitivityNote && <Text variant="bodySmall">{sensitivityNote.message}</Text>}
                {running && (
                    <View style={styles.progress}>
                        <ProgressBar progress={frameCount / CAPTURE_COUNT} color={theme.colors.primary} />
                        <Text variant="labelSmall">Frame {frameCount}/{CAPTURE_COUNT}</Text>
                    </View>
                )}
                <View style={styles.grid}>
                    <Text variant="bodySmall">Motion in {mdBlocksCount} blocks</Text>
                    <MotionGrid gridString={mdGrid} />
                </View>
                {testFinished && !running && (
                    <Text variant="titleMedium" style={{ color: motionSeen ? theme.colors.primary : theme.colors.onSurfaceVariant }}>
                        {motionSeen ? 'Motion seen' : 'No motion'}
                    </Text>
                )}
            </ActionDialog>
        </>
    )
}

const styles = StyleSheet.create({
    progress: {
        gap: 6,
    },
    grid: {
        alignItems: 'center',
        gap: 6,
    },
})
