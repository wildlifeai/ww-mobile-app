import React, { useState, useEffect } from 'react'
import { StyleSheet, View, Image } from 'react-native'
import { Card, Button, Text, useTheme } from 'react-native-paper'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useCapturePreview } from '../../../hooks/useCapturePreview'
import { useBle } from '../../../hooks/useBle'
import { useAppSelector } from '../../../redux'
import { WWIcon } from '../../../components/ui/WWIcon'

interface Props {
    device?: ExtendedPeripheral
    onImageCaptured: (path: string) => void
}

export const CameraViewSection = ({ device, onImageCaptured }: Props) => {
    const theme = useTheme()
    const { write } = useBle()
    // Need full logs for capture logic
    const logs = useAppSelector(state => state.logs[device?.id || ''] || '')

    const {
        startCapture,
        isCapturing,
        capturedImageUri,
        clearImage
    } = useCapturePreview({
        device: device || undefined,
        logs,
        write,
        onImageReceived: (uri) => {
            onImageCaptured(uri)
        },
        onError: (err) => {
            console.error('Capture error:', err)
            // Error handling UI could be added here
        }
    })

    return (
        <Card style={styles.card}>
            <Card.Title title="Camera Preview" left={(props) => <WWIcon {...props} source="camera" />} />
            <Card.Content style={styles.content}>
                {capturedImageUri ? (
                    <View style={styles.imageContainer}>
                        <Image source={{ uri: capturedImageUri }} style={styles.previewImage} resizeMode="contain" />
                        <Button mode="text" onPress={clearImage} icon="refresh">Retake</Button>
                    </View>
                ) : (
                    <View style={styles.placeholderContainer}>
                        <Text variant="bodySmall" style={{ textAlign: 'center', marginBottom: 8, color: theme.colors.outline }}>
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
    previewImage: { width: '100%', height: 200, backgroundColor: '#f0f0f0', borderRadius: 8 },
    placeholderContainer: { alignItems: 'center', padding: 16, backgroundColor: '#f9f9f9', borderRadius: 8 }
})
