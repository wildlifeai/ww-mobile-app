import { useCallback } from 'react'
import { StyleSheet, View, Alert } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Card, Button, Text, ActivityIndicator } from 'react-native-paper'

import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useCameraSwitch } from '../../../hooks/useCameraSwitch'
import { useResolutionSwitch, ModelLoadedError } from '../../../hooks/useResolutionSwitch'

interface Props {
    device?: ExtendedPeripheral
    /** Disable interaction (e.g. while a capture is running) */
    disabled?: boolean
    onShowHelp: (title: string, content: string) => void
}

/**
 * Dev/test resolution picker for the Capture Preview flow: standard 640x480
 * vs hi-res 1216x960 (colour camera only - the Night-IR firmware has no
 * hi-res pipeline). Switching writes op32 and reboots the AI processor.
 */
export const ResolutionSelector = ({ device, disabled, onShowHelp }: Props) => {
    // Own instance: only used to know which camera image is running
    const { activeCamera } = useCameraSwitch({ device })

    const {
        resolution,
        isBusy,
        stage,
        refresh,
        switchTo,
    } = useResolutionSwitch({
        device,
        onError: (err) => {
            if (err instanceof ModelLoadedError) {
                Alert.alert(
                    'AI Model Loaded',
                    `${err.message}\n\nErase the model from the device to continue? ` +
                    '(A deployment will re-transfer it automatically.)',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Erase & continue', style: 'destructive', onPress: () => switchTo('hires', { eraseModel: true }) },
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
                refresh()
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [device?.connected])
    )

    const isNightCamera = activeCamera === 'HM0360'
    const controlsDisabled = disabled || isBusy || !device?.connected || isNightCamera

    const handleHelp = useCallback(() => {
        onShowHelp(
            'Capture Resolution',
            'Standard: 640x480 via the hardware pipeline.\n\n' +
            'High-res: one 1216x960 JPEG via the CPU pipeline (~2 s per capture, ' +
            'larger transfer over Bluetooth). Colour camera only - the Night-IR ' +
            'firmware has no hi-res pipeline - and it needs the on-device AI ' +
            'model erased (hi-res uses the memory the model occupies).\n\n' +
            'Switching reboots the camera processor (~10 s); the setting sticks ' +
            'until switched back, so restore Standard before deploying with AI.'
        )
    }, [onShowHelp])

    return (
        <Card style={styles.card}>
            <Card.Title
                title="Resolution"
                right={(props) => (
                    <Button {...props} icon="help-circle-outline" onPress={handleHelp}>
                        <Text>Help</Text>
                    </Button>
                )}
            />
            <Card.Content>
                {isNightCamera && (
                    <Text style={styles.hint}>
                        Hi-res is only available on the Colour (day) camera — switch cameras above first.
                    </Text>
                )}
                <View style={styles.row}>
                    <Button
                        mode={resolution === 'standard' ? 'contained' : 'outlined'}
                        onPress={() => switchTo('standard')}
                        disabled={controlsDisabled || resolution === 'standard'}
                        style={styles.button}
                    >
                        <Text>Standard 640×480</Text>
                    </Button>
                    <Button
                        mode={resolution === 'hires' ? 'contained' : 'outlined'}
                        onPress={() => switchTo('hires')}
                        disabled={controlsDisabled || resolution === 'hires'}
                        style={styles.button}
                    >
                        <Text>High-res 1216×960</Text>
                    </Button>
                </View>
                {isBusy && (
                    <View style={styles.stageRow}>
                        <ActivityIndicator size={14} />
                        <Text style={styles.stageText}>{stage || 'Working…'}</Text>
                    </View>
                )}
                {!isBusy && resolution === 'unknown' && device?.connected && (
                    <Text style={styles.hint}>
                        Resolution not read yet — older firmware without op32 always captures 640×480.
                    </Text>
                )}
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        gap: 8,
    },
    button: {
        flex: 1,
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
    hint: {
        opacity: 0.6,
        fontSize: 12,
        marginBottom: 8,
    },
})
