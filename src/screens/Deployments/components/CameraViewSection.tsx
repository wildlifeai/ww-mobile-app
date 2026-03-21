import { useCallback } from 'react'
import { StyleSheet, View, Image } from 'react-native'
import { Card, Button, Text, ProgressBar, useTheme } from 'react-native-paper'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useCapturePreview } from '../../../hooks/useCapturePreview'
import { useBle } from '../../../hooks/useBle'
import { WWIcon } from '../../../components/ui/WWIcon'
import { WWText } from '../../../components/ui/WWText'
import { WWButton } from '../../../components/ui/WWButton'
import { logError } from '../../../utils/logger'


interface Props {
    device?: ExtendedPeripheral
    onImageCaptured: (path: string) => void
    onShowHelp: (title: string, content: string) => void
}

export const CameraViewSection = ({ device, onImageCaptured, onShowHelp }: Props) => {
    const theme = useTheme()
    const { write } = useBle()

    const {
        startCapture,
        isCapturing,
        capturedImageUri,
        captureProgress,
        captureStage,
    } = useCapturePreview({
        device: device || undefined,
        write,
        onImageReceived: onImageCaptured,
        onError: (err) => {
            logError('Capture error:', err)
        }
    })

    const renderLeft = useCallback((props: any) => <WWIcon {...props} source="camera" />, [])
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
        <Card style={styles.card}>
            <Card.Title
                title="Camera View Test"
                left={renderLeft}
                right={renderRight}
            />
            <Card.Content>
                <WWText variant="bodySmall" style={styles.sectionDescription}>
                    <Text>Capture a test photo to verify camera positioning</Text>
                </WWText>

                {capturedImageUri && (
                    <View style={styles.imagePreviewContainer}>
                        <Image
                            source={{ uri: capturedImageUri }}
                            style={styles.imagePreview}
                            resizeMode="contain"
                        />
                    </View>
                )}

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
                    onPress={startCapture}
                    disabled={!device || isCapturing}
                    loading={isCapturing}
                >
                    <Text>{isCapturing
                        ? (captureProgress > 0 ? `${captureStage} ${Math.round(captureProgress * 100)}%` : (captureStage || 'Capturing...'))
                        : (capturedImageUri ? 'Test Again' : 'Test Camera View')}</Text>
                </WWButton>
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {},
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
    }
})
