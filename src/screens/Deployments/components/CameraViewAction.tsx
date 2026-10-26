import { useState } from 'react'
import { Alert, Image, StyleSheet, View } from 'react-native'
import { Button, ProgressBar, Text, useTheme } from 'react-native-paper'
import { ActionRow } from '../../../components/ui/ActionRow'
import { ActionDialog } from '../../../components/ui/ActionDialog'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useCapturePreview } from '../../../hooks/useCapturePreview'
import { logError } from '../../../utils/logger'

interface Props {
    device?: ExtendedPeripheral
    onImageCaptured: (path: string) => void
    onShowHelp: (title: string, content: string) => void
}

/**
 * Camera View: the Watcher takes a picture so the person setting it up sees
 * what it will see. Not to be confused with Site Photo, the phone's picture of
 * the Watcher in place. Opening the popup takes the picture at once; the row
 * keeps the last one as a thumbnail.
 */
export const CameraViewAction = ({ device, onImageCaptured, onShowHelp }: Props) => {
    const theme = useTheme()
    const [open, setOpen] = useState(false)
    const { startCapture, isCapturing, capturedImageUri, captureProgress } = useCapturePreview({
        device: device || undefined,
        onImageReceived: onImageCaptured,
        onError: (err) => {
            logError('Capture error:', err)
            Alert.alert('Capture failed', err?.message || 'An error occurred while capturing preview image.')
        },
    })
    const connected = !!device?.connected

    const handleOpen = () => {
        setOpen(true)
        if (connected && !isCapturing) startCapture()
    }

    return (
        <>
            <ActionRow
                title="Camera View"
                onPress={handleOpen}
                onHelp={() => onShowHelp('Camera View', 'The Watcher takes a picture so you can see what it sees. Check it points at the target and nothing blocks the view.')}
                image={capturedImageUri}
                busy={isCapturing}
            />
            <ActionDialog
                visible={open}
                title="Camera View"
                onClose={() => setOpen(false)}
                actions={
                    <Button onPress={() => startCapture()} disabled={!connected || isCapturing}>
                        Take Another
                    </Button>
                }
            >
                {/* Not WWBleDisconnectedBanner: the popup renders in Paper's portal,
                    outside the navigation container, and its Go to Scanner needs navigation */}
                {!connected && (
                    <Text variant="bodyMedium" style={{ color: theme.colors.error }}>Not connected to the camera.</Text>
                )}
                {capturedImageUri && (
                    <Image source={{ uri: capturedImageUri }} style={styles.image} resizeMode="contain" />
                )}
                {/* One line in the words of Capture Picture's step list */}
                {isCapturing && (
                    <View style={styles.progress}>
                        <ProgressBar progress={captureProgress} color={theme.colors.primary} />
                        <Text variant="labelSmall">
                            {captureProgress > 0 ? 'Transferring the picture…' : 'Taking the picture…'}
                        </Text>
                    </View>
                )}
            </ActionDialog>
        </>
    )
}

const styles = StyleSheet.create({
    image: {
        width: '100%',
        aspectRatio: 4 / 3,
    },
    progress: {
        gap: 6,
    },
})
