import { useCallback } from 'react'
import { StyleSheet, View, Alert } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Button, Text, ActivityIndicator, SegmentedButtons } from 'react-native-paper'

import { ExtendedPeripheral } from '../../redux/slices/devicesSlice'
import { useCameraSwitch, CAMERA_VARIANT_LABELS } from '../../hooks/useCameraSwitch'

interface Props {
    device?: ExtendedPeripheral
    /** Disable interaction (e.g. while a capture is running) */
    disabled?: boolean
    onShowHelp: (title: string, content: string) => void
    /** Heading above the control. Defaults to "Capture Mode". */
    label?: string
}

type CaptureMode = 'day' | 'night'

const HELP_TEXT =
    'Colour: 640x480 from the colour camera. This is what deployments use by day.\n\n' +
    'Black & White: 640x480 from the infrared camera, used at night.\n\n' +
    'Switching cameras boots the other firmware slot (about 30 s). The chosen ' +
    'camera sticks until changed, or until automatic day/night switching moves it.'

/**
 * The camera-mode control for the Capture Picture flow: Colour / Black & White,
 * one per firmware slot. All explanation lives in the Help dialog. (A hi-res
 * colour mode sat here until September 2026; the firmware dropped op32.)
 *
 * Renders bare, without a Card, so the caller can group it with the other
 * camera settings in one container.
 */
export const CameraModeSelector = ({
    device,
    disabled,
    onShowHelp,
    label = 'Capture Mode',
}: Props) => {
    const camera = useCameraSwitch({
        device,
        onError: (err) => Alert.alert('Camera Switch Failed', err.message),
    })

    useFocusEffect(
        useCallback(() => {
            if (device?.connected) {
                camera.refresh()
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [device?.connected])
    )

    const currentMode: CaptureMode | '' =
        camera.activeCamera === 'HM0360' ? 'night'
            : camera.activeCamera === 'RP3' ? 'day'
                : ''

    const isBusy = camera.isBusy
    const stage = camera.stage

    const selectMode = useCallback(async (mode: CaptureMode) => {
        if (isBusy || mode === currentMode) return
        await camera.switchTo(mode === 'night' ? 'HM0360' : 'RP3')
    }, [isBusy, currentMode, camera])

    const handleHelp = useCallback(() => {
        onShowHelp(label, HELP_TEXT)
    }, [onShowHelp, label])

    const controlsDisabled = disabled || isBusy || !device?.connected

    // Labelled by what the operator gets in the picture rather than by the
    // sensor that took it: "Colour" is the RP3 day camera, "Black & White" the
    // HM0360 infrared one.
    const modeButtons = [
        { value: 'day', label: CAMERA_VARIANT_LABELS.RP3, disabled: controlsDisabled },
        { value: 'night', label: CAMERA_VARIANT_LABELS.HM0360, disabled: controlsDisabled },
    ]

    // No Card of its own: this renders inside the caller's container so Capture
    // Mode and Flash read as one group of camera settings rather than two
    // competing panels.
    return (
        <View>
            <View style={styles.headerRow}>
                <Text variant="labelLarge">{label}</Text>
                <Button compact icon="help-circle-outline" onPress={handleHelp}>
                    Help
                </Button>
            </View>
            <SegmentedButtons
                value={currentMode}
                onValueChange={(v) => selectMode(v as CaptureMode)}
                buttons={modeButtons}
            />
            {isBusy && (
                <View style={styles.stageRow}>
                    <ActivityIndicator size={14} />
                    <Text style={styles.stageText}>{stage || 'Working…'}</Text>
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    stageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
    },
    stageText: {
        opacity: 0.7,
        fontSize: 12,
        flex: 1,
    },
})
