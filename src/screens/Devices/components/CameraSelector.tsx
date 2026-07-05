import { useEffect, useCallback } from 'react'
import { StyleSheet, View, Alert } from 'react-native'
import { Card, Button, Text, ActivityIndicator } from 'react-native-paper'

import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useCameraSwitch, CameraVariant } from '../../../hooks/useCameraSwitch'
import { WWButton } from '../../../components/ui/WWButton'

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

/**
 * Manual camera selection for the dual-image WW500: choose between the colour
 * Raspberry Pi camera and the IR-capable HM0360 before taking a test photo.
 * Switching boots the firmware image in the other flash slot and takes ~30s.
 */
export const CameraSelector = ({ device, disabled, onShowHelp }: Props) => {
    const {
        activeCamera,
        otherSlotCamera,
        isBusy,
        stage,
        refresh,
        switchTo,
    } = useCameraSwitch({
        device,
        onError: (err) => Alert.alert('Camera Switch Failed', err.message),
    })

    // Learn what is running when the device connects
    useEffect(() => {
        if (device?.connected) {
            refresh()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [device?.connected])

    const handleSelect = useCallback((target: CameraVariant) => {
        if (target === activeCamera || isBusy) return

        Alert.alert(
            `Switch to ${CAMERA_LABELS[target]}?`,
            'The device will restart with the other camera. This takes about 30 seconds.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Switch', onPress: () => { switchTo(target) } },
            ]
        )
    }, [activeCamera, isBusy, switchTo])

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

    const cameraButton = (variant: Extract<CameraVariant, 'RP3' | 'HM0360'>) => {
        const isActive = activeCamera === variant
        // A variant is selectable when it is running, or recorded in the other slot
        const isAvailable = isActive || otherSlotCamera === variant

        return (
            <WWButton
                mode={isActive ? 'contained' : 'outlined'}
                style={styles.cameraButton}
                disabled={disabled || isBusy || !device?.connected || (!isAvailable && !isActive)}
                onPress={() => handleSelect(variant)}
            >
                <Text>{CAMERA_LABELS[variant]}{isActive ? ' ✓' : ''}</Text>
            </WWButton>
        )
    }

    return (
        <Card style={styles.card}>
            <Card.Title title="Camera" right={renderHelp} />
            <Card.Content>
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
                        The second camera image has not been loaded (or has not booted yet), so switching is unavailable.
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
