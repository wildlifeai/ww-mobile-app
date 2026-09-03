import { View, StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from 'react-native'
import { Surface, Divider, Button } from 'react-native-paper'
import { CameraModeSelector } from '../../../components/device/CameraModeSelector'
import { CaptureSteps } from './CaptureSteps'
import { FlashSelector } from '../../../components/device/FlashSelector'
import { FLASH_LED_LABELS } from '../../../hooks/useDeviceSettings'
import { WWText } from '../../../components/ui/WWText'
import { useExtendedTheme } from '../../../theme'
import { useCapturePicture, CapturedImageInfo } from '../hooks/useCapturePicture'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { ImagePreviewModal } from '../../../components/ImagePreviewModal'
import { WWBleDisconnectedBanner } from '../../../components/ui/WWBleDisconnectedBanner'
import { DeviceHealthBanner } from '../../../components/DeviceHealthBanner'
import { useDeviceSelfTest } from '../../../hooks/useDeviceSelfTest'
import { useState, useCallback } from 'react'

interface Props {
    device: ExtendedPeripheral
}

export const CapturePictureSection = ({ device }: Props) => {
    const { colors, spacing } = useExtendedTheme()
    
    const {
        cameraParams,
        updateCameraParam,
        applyAndCapture,
        isApplying,
        applyStage,
        // aeData (the live value) is deliberately not read: the standing AE panel
        // was replaced by the picture itself. The per-image copy is still shown,
        // as `selectedImage.aeData` in the preview modal below, where the numbers
        // sit beside the shot they describe rather than beside the next one.
        capturedImages,
        capturePreview,
        captureSteps
    } = useCapturePicture({ device })

    const { issues: healthIssues, isChecking: isCheckingHealth, refresh: recheckHealth } = useDeviceSelfTest({ device })

    /** Newest capture first, so index 0 is what the preview shows. */
    const latestImage = capturedImages[0] ?? null

    const handleShowHelp = useCallback((title: string, content: string) => {
        Alert.alert(title, content)
    }, [])

    const [modalVisible, setModalVisible] = useState(false)
    const [selectedImage, setSelectedImage] = useState<CapturedImageInfo | null>(null)

    const handleViewImage = (info: CapturedImageInfo) => {
        setSelectedImage(info)
        setModalVisible(true)
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={[styles.content, { gap: spacing }]} keyboardShouldPersistTaps="handled">
            

            <WWBleDisconnectedBanner connected={!!device?.connected} dfuInProgress={!!device?.dfuInProgress} />

            <DeviceHealthBanner issues={healthIssues} onRecheck={recheckHealth} isChecking={isCheckingHealth} />

            {/* Capture mode and flash share one container: they are the settings
                that change what the next picture looks like, and splitting them
                across two panels made the screen read as two unrelated tools.
                The mode control moved here when Capture Preview was folded into
                this screen, since it was the only thing that flow added. */}
            <Surface style={[styles.card, styles.settingsCard, { backgroundColor: colors.surface }]} elevation={1}>

                <View style={styles.inputGroup}>
                    <CameraModeSelector device={device} onShowHelp={handleShowHelp} />
                </View>

                <Divider style={styles.groupDivider} />

                <View style={styles.inputGroup}>
                    <FlashSelector
                        flashLed={cameraParams.flashLed}
                        onFlashLedChange={(v) => updateCameraParam('flashLed', v)}
                        ledBrightness={cameraParams.ledBrightness}
                        onLedBrightnessChange={(v) => updateCameraParam('ledBrightness', v)}
                        disabled={!device?.connected || isApplying || capturePreview.isCapturing}
                    />
                </View>
            </Surface>

            <View style={styles.actionRow}>
                <Button 
                    mode="contained" 
                    onPress={applyAndCapture}
                    loading={isApplying || capturePreview.isCapturing}
                    disabled={!device?.connected || isApplying || capturePreview.isCapturing}
                    style={styles.captureButton}
                >
                    <WWText style={styles.captureButtonText}>{!device?.connected ? 'Disconnected' : 'Capture Image'}</WWText>
                </Button>
            </View>


            {/* What the camera is doing, step by step, ticked on its own messages.
                The app's stage text sits underneath for the waits the device is
                silent through (sleeping before the capture, mostly). */}
            {(isApplying || capturePreview.isCapturing) && (
                <View style={styles.progressContainer}>
                    <CaptureSteps
                        state={captureSteps.state}
                        now={captureSteps.now}
                        stage={applyStage || capturePreview.captureStage}
                    />
                </View>
            )}

            {/* The latest capture, full width. This is what the operator came to
                look at, so it sits directly under the button that produced it
                rather than as one more thumbnail in the strip below. */}
            {latestImage && (
                <TouchableOpacity onPress={() => handleViewImage(latestImage)} activeOpacity={0.85}>
                    <Image source={{ uri: latestImage.uri }} style={styles.latestPreview} resizeMode="contain" />
                </TouchableOpacity>
            )}

            {capturedImages.length > 0 && (
                <>
                    <WWText variant="titleMedium" style={{ marginTop: spacing }}>Gallery</WWText>
                    <View style={styles.gallery}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {capturedImages.map((info) => (
                                <TouchableOpacity
                                    key={info.uri} 
                                    style={styles.thumbnailContainer} 
                                    onPress={() => handleViewImage(info)}
                                    activeOpacity={0.7}
                                >
                                    <Image source={{ uri: info.uri }} style={styles.thumbnail} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </>
            )}

            <ImagePreviewModal
                visible={modalVisible}
                imageUri={selectedImage?.uri || null}
                onDismiss={() => setModalVisible(false)}
            >
                {selectedImage && (
                    <View style={styles.modalCaption}>
                        <WWText variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>
                            Flash: {FLASH_LED_LABELS[selectedImage.params.flashLed]} ({selectedImage.params.ledBrightness}%)
                        </WWText>
                        {selectedImage.aeData && (
                            <WWText variant="labelMedium" style={[styles.modalAe, { color: colors.primary }]}>
                                AE Mean: {selectedImage.aeData.aeMean} | Conv: {selectedImage.aeData.aeConverged}
                            </WWText>
                        )}
                    </View>
                )}
            </ImagePreviewModal>
            
            <View style={styles.bottomSpacer} />
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 16,
    },
    card: {
        padding: 16,
        borderRadius: 12,
    },
    inputGroup: {
        marginBottom: 16,
    },
    latestPreview: {
        width: '100%',
        aspectRatio: 4 / 3,
        borderRadius: 12,
        backgroundColor: '#00000022',
    },
    groupDivider: {
        marginVertical: 4,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    progressContainer: {
        marginTop: 16,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    settingsCard: {
        marginTop: 8,
    },
    captureButton: {
        flex: 1,
    },
    captureButtonText: {
        color: 'white',
    },
    modalCaption: {
        marginTop: 8,
        paddingHorizontal: 4,
        width: '100%',
    },
    modalAe: {
        marginTop: 2,
    },
    bottomSpacer: {
        height: 40,
    },
    gallery: {
        flexDirection: 'row',
        paddingVertical: 8,
    },
    thumbnailContainer: {
        width: 100,
        height: 100,
        marginRight: 12,
        borderRadius: 8,
        overflow: 'hidden',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    }
})
