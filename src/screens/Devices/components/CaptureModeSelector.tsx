import { useCallback, useState } from 'react'
import { StyleSheet, View, Alert } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Card, Button, Text, ActivityIndicator, SegmentedButtons } from 'react-native-paper'

import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useCameraSwitch } from '../../../hooks/useCameraSwitch'
import { useResolutionSwitch, ModelLoadedError } from '../../../hooks/useResolutionSwitch'

interface Props {
    device?: ExtendedPeripheral
    /** Disable interaction (e.g. while a capture is running) */
    disabled?: boolean
    onShowHelp: (title: string, content: string) => void
}

type CaptureMode = 'hires_day' | 'standard_day' | 'night'

const HELP_TEXT =
    'High-res Day — one 1216×960 JPEG per capture from the colour camera. ' +
    'About 2 s per capture and a larger Bluetooth transfer for the preview. ' +
    'Needs the on-device AI model erased (it uses the memory the model ' +
    'occupies) - you will be asked before anything is erased; a deployment ' +
    're-transfers the model automatically.\n\n' +
    'Standard Day — 640×480 from the colour camera via the hardware ' +
    'pipeline. This is what deployments use.\n\n' +
    'Night-IR — 640×480 from the infrared camera. High-res is not ' +
    'available on this camera (its firmware has no hi-res pipeline).\n\n' +
    'Switching resolution reboots the camera processor (~10 s). Switching ' +
    'cameras boots the other firmware slot (~30 s). The chosen mode sticks ' +
    'until changed, so restore Standard Day before deploying with AI.'

/**
 * One selector for the Capture Preview flow: High-res Day / Standard Day /
 * Night-IR. Routes to camera-slot and/or resolution (op32) switches as
 * needed; all explanation lives in the Help dialog.
 */
export const CaptureModeSelector = ({ device, disabled, onShowHelp }: Props) => {
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
        onShowHelp('Capture Mode', HELP_TEXT)
    }, [onShowHelp])

    const controlsDisabled = disabled || isBusy || !device?.connected

    return (
        <Card style={styles.card}>
            <Card.Title
                title="Capture Mode"
                right={(props) => (
                    <Button {...props} icon="help-circle-outline" onPress={handleHelp}>
                        <Text>Help</Text>
                    </Button>
                )}
            />
            <Card.Content>
                <SegmentedButtons
                    value={currentMode}
                    onValueChange={(v) => selectMode(v as CaptureMode)}
                    buttons={[
                        { value: 'hires_day', label: 'High-res Day', disabled: controlsDisabled },
                        { value: 'standard_day', label: 'Standard Day', disabled: controlsDisabled },
                        { value: 'night', label: 'Night-IR', disabled: controlsDisabled },
                    ]}
                />
                {isBusy && (
                    <View style={styles.stageRow}>
                        <ActivityIndicator size={14} />
                        <Text style={styles.stageText}>{stage || 'Working…'}</Text>
                    </View>
                )}
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 12,
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
