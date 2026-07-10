import { useCallback } from 'react'
import { StyleSheet, View, Alert } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Card, Button, Text, ActivityIndicator } from 'react-native-paper'

import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useCameraSwitch, CameraVariant } from '../../../hooks/useCameraSwitch'


interface Props {
    device?: ExtendedPeripheral
    /** Disable interaction (e.g. while a capture is running) */
    disabled?: boolean
    onShowHelp: (title: string, content: string) => void
}

const CAMERA_LABELS: Record<CameraVariant, string> = {
    RP3: 'Colour (RPi)',
    HM0360: 'Infrared (HM0360)',
    unknown: 'Unknown',
}

// Short, glanceable labels for the two camera options
const CAMERA_META: Record<Extract<CameraVariant, 'RP3' | 'HM0360'>, { emoji: string; label: string }> = {
    RP3: { emoji: '🎨', label: 'Colour (day)' },
    HM0360: { emoji: '🌙', label: 'Night-IR' },
}

/**
 * Manual camera selection for the dual-image WW500: choose between the colour
 * Raspberry Pi camera and the IR-capable HM0360 before taking a test photo.
 * Switching boots the firmware image in the other flash slot and takes ~30s.
 */
export const CameraSelector = ({ device, disabled, onShowHelp }: Props) => {
    const {
        activeCamera,
        otherSlotCamera,
        autoSwitchOn,
        isBusy,
        stage,
        refresh,
        switchTo,
    } = useCameraSwitch({
        device,
        onError: (err) => Alert.alert('Camera Switch Failed', err.message),
    })

    // Learn what is running when the device connects AND every time the screen
    // regains focus - slot labels change after firmware updates and switches
    // made elsewhere, and a stale/failed read left the buttons dead with no
    // retry before.
    useFocusEffect(
        useCallback(() => {
            if (device?.connected) {
                refresh()
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [device?.connected])
    )

    const handleSelect = useCallback((target: CameraVariant) => {
        if (target === activeCamera || isBusy) return

        const autoNote = autoSwitchOn
            ? '\n\n⚠️ Auto camera switch is ON, so the device may switch back on its own at its next light check. Turn it off in the Light Sensor flow to stay on this camera.'
            : ''

        // The other slot may hold a valid image that simply never labelled
        // itself (the label is written the first time an image boots, and that
        // write can be missed after a firmware update). The firmware refuses
        // to switch to a slot without valid firmware, so offering the switch
        // is safe - and it self-heals the label on boot.
        const unlabelledNote = otherSlotCamera === 'unknown'
            ? '\n\nℹ️ The other slot has not announced its camera yet. If it holds different firmware, the device may boot the other camera type - switch back if so.'
            : ''

        Alert.alert(
            `Switch to ${CAMERA_LABELS[target]}?`,
            `The device will restart with the other camera. This takes about 30 seconds.${unlabelledNote}${autoNote}`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Switch', onPress: () => { switchTo(target) } },
            ]
        )
    }, [activeCamera, isBusy, switchTo, autoSwitchOn, otherSlotCamera])

    const renderHelp = useCallback((props: any) => (
        <Button
            {...props}
            icon="help-circle-outline"
            onPress={() => onShowHelp(
                'Camera Selection',
                'The device carries two firmware images: one using the colour Raspberry Pi camera (best in daylight) and one using the HM0360 infrared camera (for use in the dark, with the IR flash).\n\nSelecting the other camera restarts the device with the other image — allow about 30 seconds before taking a test photo.'
            )}
        >
            <Text>Help</Text>
        </Button>
    ), [onShowHelp])

    // NOTE: paper <Button> is used directly (not WWButton) — WWButton wraps the
    // button in a width:auto View, which swallows flex sizing in a row and
    // collapsed these buttons into unlabelled slivers.
    const cameraButton = (variant: Extract<CameraVariant, 'RP3' | 'HM0360'>) => {
        const isActive = activeCamera === variant
        // A variant is selectable when it is running, recorded in the other
        // slot, or the other slot is unlabelled (blind switch with confirm -
        // the firmware validates the slot actually holds bootable firmware).
        // Requires knowing what is active, so both buttons aren't live blind.
        const isAvailable = isActive
            || otherSlotCamera === variant
            || (otherSlotCamera === 'unknown' && activeCamera !== 'unknown')

        return (
            <Button
                mode={isActive ? 'contained' : 'outlined'}
                icon={isActive ? 'check-circle' : 'camera-switch-outline'}
                style={styles.cameraButton}
                disabled={disabled || isBusy || !device?.connected || !isAvailable}
                onPress={() => handleSelect(variant)}
            >
                {`${CAMERA_META[variant].emoji} ${CAMERA_META[variant].label}`}
            </Button>
        )
    }

    // One glanceable line saying what the device is doing right now
    const statusLine = !device?.connected
        ? 'Connect to the device to see its cameras.'
        : isBusy
            ? (stage || 'Working…')
            : activeCamera === 'unknown'
                ? 'Reading which camera is active…'
                : `Active camera: ${CAMERA_META[activeCamera as 'RP3' | 'HM0360'].emoji} ${CAMERA_META[activeCamera as 'RP3' | 'HM0360'].label}. Tap the other to switch (~30 s restart).`

    return (
        <Card style={styles.card}>
            <Card.Title title="Camera" right={renderHelp} />
            <Card.Content>
                <Text variant="bodySmall" style={styles.statusLine}>
                    {statusLine}
                </Text>

                <View style={styles.buttonRow}>
                    {cameraButton('RP3')}
                    {cameraButton('HM0360')}
                </View>

                {isBusy && (
                    <View style={styles.busyRow}>
                        <ActivityIndicator size="small" />
                        <Text variant="labelSmall" style={styles.busyText}>{stage || 'Working…'}</Text>
                    </View>
                )}

                {!isBusy && activeCamera === 'unknown' && device?.connected && (
                    <Text variant="labelSmall" style={styles.hintText}>
                        Camera not reported yet — the device firmware may not support switching.
                    </Text>
                )}

                {!isBusy && activeCamera !== 'unknown' && otherSlotCamera === 'unknown' && (
                    <Text variant="labelSmall" style={styles.hintText}>
                        The other camera image hasn't announced itself yet (it does so the first
                        time it boots). You can still switch - the device checks the slot holds
                        valid firmware, and the image labels itself when it starts.
                    </Text>
                )}

                {!isBusy && autoSwitchOn === true && (
                    <Text variant="labelSmall" style={styles.hintText}>
                        💡 Auto camera switch is ON — the device also picks its camera from the
                        light level (see the Light Sensor flow), so it may override a manual choice.
                    </Text>
                )}
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 8,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 8,
    },
    statusLine: {
        marginBottom: 12,
        opacity: 0.8,
    },
    cameraButton: {
        flex: 1,
    },
    busyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
    },
    busyText: {
        opacity: 0.7,
    },
    hintText: {
        marginTop: 12,
        opacity: 0.6,
    },
})
