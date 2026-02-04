import { useCallback, useMemo } from 'react'
import { StyleSheet, View, Image } from 'react-native'
import { Card, Button, Text, useTheme } from 'react-native-paper'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useCapturePreview } from '../../../hooks/useCapturePreview'
import { useBle } from '../../../hooks/useBle'
import { useAppSelector } from '../../../redux'
import { WWIcon } from '../../../components/ui/WWIcon'
import { logError } from '../../../utils/logger'


interface Props {
    device?: ExtendedPeripheral
    onImageCaptured: (path: string) => void
    onShowHelp: (title: string, content: string) => void
}

export const CameraViewSection = ({ device, onImageCaptured, onShowHelp }: Props) => {
    const theme = useTheme()
    const { write } = useBle()
    // Need full logs for capture logic
    const logs = useAppSelector(state => state.logs[device?.id || ''] || [])

    const {
        startCapture,
        isCapturing,
        capturedImageUri,
        clearImage
    } = useCapturePreview({
        device: device || undefined,
        logs,
        write,
        onImageReceived: onImageCaptured,
        onError: (err) => {
            logError('Capture error:', err)
            // Error handling UI could be added here
        }
    })

    const dynamicStyles = useMemo(() => ({
        placeholderText: { textAlign: 'center' as const, marginBottom: 8, color: theme.colors.outline },
        previewImage: { ...styles.previewImage, backgroundColor: theme.colors.surfaceVariant },
        placeholderContainer: { ...styles.placeholderContainer, backgroundColor: theme.colors.surfaceVariant }
    }), [theme])

    const renderLeft = useCallback((props: any) => <WWIcon {...props} source="camera" />, [])
    const renderRight = useCallback((props: any) => (
        <Button
            {...props}
            icon="help-circle-outline"
            onPress={() => onShowHelp('Camera Preview', 'Take a test photo to ensure the camera is pointing at the desired target and the view is unobstructed.')}
        >
            Help
        </Button>
    ), [onShowHelp])

    return (
        <Card style={styles.card}>
            <Card.Title
                title="Camera Preview"
                left={renderLeft}
                right={renderRight}
            />
            <Card.Content style={styles.content}>
                {capturedImageUri ? (
                    <View style={styles.imageContainer}>
                        <Image source={{ uri: capturedImageUri }} style={styles.previewImage} resizeMode="contain" />
                        <Button mode="text" onPress={clearImage} icon="refresh">Retake</Button>
                    </View>
                ) : (
                    <View style={dynamicStyles.placeholderContainer}>
                        <Text variant="bodySmall" style={dynamicStyles.placeholderText}>
                            Capture a test image to verify camera angle and FOV.
                        </Text>
                        <Button
                            mode="contained"
                            onPress={startCapture}
                            loading={isCapturing}
                            disabled={!device || isCapturing}
                            icon="camera"
                        >
                            {isCapturing ? 'Capturing...' : 'Capture Preview'}
                        </Button>
                    </View>
                )}
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: { marginBottom: 16 },
    content: { gap: 12 },
    imageContainer: { alignItems: 'center', gap: 8 },
    previewImage: { width: '100%', height: 200, borderRadius: 8 },
    placeholderContainer: { alignItems: 'center', padding: 16, borderRadius: 8 }
})
