import { useCallback, useState } from 'react'
import { StyleSheet, View, Alert } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Button, Text, ActivityIndicator, SegmentedButtons } from 'react-native-paper'

import { ExtendedPeripheral } from '../../redux/slices/devicesSlice'
import { useCameraSwitch, CAMERA_VARIANT_LABELS } from '../../hooks/useCameraSwitch'
import { useResolutionSwitch, ModelLoadedError } from '../../hooks/useResolutionSwitch'

interface Props {
    device?: ExtendedPeripheral
    /** Disable interaction (e.g. while a capture is running) */
    disabled?: boolean
    onShowHelp: (title: string, content: string) => void
    /**
     * Offer the hi-res colour mode (op32) alongside the two cameras. Default
     * true. Flows that only care which camera is running, such as the light
     * sensor, pass false and get a plain two-way camera switch.
     */
    withResolution?: boolean
    /** Heading above the control. Defaults to "Capture Mode". */
    label?: string
}

type CaptureMode = 'hires_day' | 'standard_day' | 'night'

const HELP_TEXT =
    'High-res Colour — one 1216×960 JPEG per capture from the colour camera. ' +
    'About 2 s per capture and a larger Bluetooth transfer for the preview. ' +
    'Needs the on-device AI model erased (it uses the memory the model ' +
    'occupies) - you will be asked before anything is erased; a deployment ' +
    're-transfers the model automatically.\n\n' +
    'Colour — 640×480 from the colour camera via the hardware pipeline. ' +
    'This is what deployments use.\n\n' +
    'Black & White — 640×480 from the infrared camera, used at night. ' +
    'High-res is not available on it (its firmware has no hi-res pipeline).\n\n' +
    'Switching resolution reboots the camera processor (~10 s). Switching ' +
    'cameras boots the other firmware slot (~30 s). The chosen mode sticks ' +
    'until changed, so restore Colour before deploying with AI.'

/**
 * The camera-mode control for the Camera Settings Test flow: High-res Colour /
 * Colour / Black & White. Routes to camera-slot and/or resolution (op32)
 * switches as needed; all explanation lives in the Help dialog.
 *
 * Renders bare, without a Card, so the caller can group it with the other
 * camera settings in one container.
 */
export const CameraModeSelector = ({
    device,
    disabled,
    onShowHelp,
    withResolution = true,
    label = 'Capture Mode',
}: Props) => {
    const [seqBusy, setSeqBusy] = useState(false)
    const [seqStage, setSeqStage] = useState('')

    const camera = useCameraSwitch({
        device,
        onError: (err) => Alert.alert('Camera Switch Failed', err.message),
    })

    const resolution = useResolutionSwitch({
        device,
        onError: (err) => {
            if (err instanceof ModelLoadedError) {
                Alert.alert(
                    'AI Model Loaded',
                    `${err.message}\n\nErase the model from the device to continue? ` +
                    '(A deployment will re-transfer it automatically.)',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Erase & continue', style: 'destructive', onPress: () => resolution.switchTo('hires', { eraseModel: true }) },
                    ]
                )
            } else {
                Alert.alert('Resolution Switch Failed', err.message)
            }
        },
    })

    useFocusEffect(
        useCallback(() => {
            if (device?.connected) {
                camera.refresh()
                resolution.refresh()
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [device?.connected])
    )

    const currentMode: CaptureMode | '' =
        camera.activeCamera === 'HM0360' ? 'night'
            : camera.activeCamera === 'RP3'
                ? (resolution.resolution === 'hires' ? 'hires_day' : 'standard_day')
                : ''

    const isBusy = seqBusy || camera.isBusy || resolution.isBusy
    const stage = seqStage || camera.stage || resolution.stage

    const selectMode = useCallback(async (mode: CaptureMode) => {
        if (isBusy || mode === currentMode) return
        // op32 lives in the shared config, so the value read before a slot
        // switch stays valid after it
        const wasHires = resolution.resolution === 'hires'
        try {
            if (mode === 'night') {
                await camera.switchTo('HM0360')
                return
            }
            if (camera.activeCamera !== 'RP3') {
                setSeqBusy(true)
                setSeqStage('Switching to the colour camera (~30 s)…')
                const ok = await camera.switchTo('RP3')
                setSeqStage('')
                setSeqBusy(false)
                if (!ok) return
            }
            if (mode === 'hires_day' && !wasHires) {
                await resolution.switchTo('hires')
            } else if (mode === 'standard_day' && wasHires) {
                await resolution.switchTo('standard')
            } else {
                await resolution.refresh()
            }
        } finally {
            setSeqStage('')
            setSeqBusy(false)
        }
    }, [isBusy, currentMode, camera, resolution])

    const handleHelp = useCallback(() => {
        onShowHelp(label, HELP_TEXT)
    }, [onShowHelp, label])

    const controlsDisabled = disabled || isBusy || !device?.connected

    // Labelled by what the operator gets in the picture rather than by the
    // sensor that took it: "Colour" is the RP3 day camera, "Black & White" the
    // HM0360 infrared one.
    //
    // Hi-res is op32, which the firmware on the device may not have yet, so its
    // button is omitted rather than disabled. A greyed-out control still asks
    // the operator to work out why, and there is nothing they can do about it
    // from here short of flashing different firmware. `supported` is null until
    // the first read, so the button stays until we actually know, rather than
    // flickering out and back in on every screen entry.
    const showHiRes = withResolution && resolution.supported !== false
    const modeButtons = [
        ...(showHiRes
            ? [{ value: 'hires_day', label: `High-res ${CAMERA_VARIANT_LABELS.RP3}`, disabled: controlsDisabled }]
            : []),
        { value: 'standard_day', label: CAMERA_VARIANT_LABELS.RP3, disabled: controlsDisabled },
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
            {/* Keyed on the button set. `supported` starts null, so this renders
                three buttons and then drops to two once the op array comes back
                short. SegmentedButtons reconciles its children positionally, so
                without a key the surviving buttons inherit the previous slots
                and one renders with no label. Changing the key remounts the row
                instead, which costs nothing and happens at most once per screen. */}
            <SegmentedButtons
                key={modeButtons.map(b => b.value).join('|')}
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
