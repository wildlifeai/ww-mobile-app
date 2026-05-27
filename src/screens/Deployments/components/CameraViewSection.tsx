import { useCallback } from 'react'
import { StyleSheet, View, Image, Alert } from 'react-native'
import { Card, Button, Text, ProgressBar, useTheme } from 'react-native-paper'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useCapturePreview } from '../../../hooks/useCapturePreview'

import { WWButton } from '../../../components/ui/WWButton'
import { WWBleDisconnectedBanner } from '../../../components/ui/WWBleDisconnectedBanner'
import { logError } from '../../../utils/logger'


interface Props {
    device?: ExtendedPeripheral
    onImageCaptured: (path: string) => void
    onShowHelp: (title: string, content: string) => void
}

export const CameraViewSection = ({ device, onImageCaptured, onShowHelp }: Props) => {
    const theme = useTheme()

    const {
        startCapture,
        isCapturing,
        capturedImageUri,
        captureProgress,
        captureStage,
    } = useCapturePreview({
        device: device || undefined,
        onImageReceived: onImageCaptured,
        onError: (err) => {
            logError('Capture error:', err)
            Alert.alert('Camera Preview Failed', err.message || 'An error occurred while capturing preview image.')
        }
    })

    const renderRight = useCallback((props: any) => (
        <Button
            {...props}
            icon="help-circle-outline"
            onPress={() => onShowHelp('Camera Preview', 'Take a test photo to ensure the camera is pointing at the desired target and the view is unobstructed.')}
        >
            <Text>Help</Text>
        </Button>
    ), [onShowHelp])

    return (
        <View>
            <Card style={styles.card}>
                    <Card.Title
                        title="Camera View"
                        right={renderRight}
                    />
                    <Card.Content>
                        {capturedImageUri && (
                    <View style={styles.imagePreviewContainer}>
                        <Image
                            source={{ uri: capturedImageUri }}
                            style={styles.imagePreview}
                            resizeMode="contain"
                        />
                    </View>
                )}

                <WWBleDisconnectedBanner connected={!!device?.connected} dfuInProgress={!!device?.dfuInProgress} />

                {isCapturing && (
                    <View style={styles.progressContainer}>
                        <ProgressBar progress={captureProgress} color={theme.colors.primary} />
                        <Text variant="labelSmall" style={styles.progressText}>
                            {Math.round(captureProgress * 100)}%
                        </Text>
                    </View>
                )}

                <WWButton
                    mode="outlined"
                    onPress={() => startCapture()}
                    disabled={!device?.connected || isCapturing}
                    loading={isCapturing}
                >
                    <Text>{!device?.connected 
                        ? 'Device Disconnected' 
                        : isCapturing
                            ? (captureProgress > 0 ? `${captureStage} ${Math.round(captureProgress * 100)}%` : (captureStage || 'Capturing…'))
                            : (capturedImageUri ? 'Test Again' : 'Test Camera View')}</Text>
                </WWButton>
                </Card.Content>
            </Card>
        </View>
    )
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 8
    },
    sectionDescription: {
        opacity: 0.6,
        marginBottom: 12,
    },
    imagePreviewContainer: {
        marginVertical: 12,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    imagePreview: {
        width: '100%',
        height: 300,
    },
    progressContainer: {
        marginBottom: 8,
    },
    progressText: {
        textAlign: 'center',
        marginTop: 4,
    },
    disconnectedBanner: {
        padding: 12,
        backgroundColor: 'rgba(176, 0, 32, 0.1)',
        borderRadius: 8,
        marginBottom: 16,
    }
})
