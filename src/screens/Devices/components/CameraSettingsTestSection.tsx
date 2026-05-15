import { View, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native'
import { Surface, Divider, Button, SegmentedButtons, ActivityIndicator, ProgressBar } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { WWTextInput } from '../../../components/ui/WWTextInput'
import { useExtendedTheme } from '../../../theme'
import { useCameraSettingsTest, CapturedImageInfo } from '../hooks/useCameraSettingsTest'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { ImagePreviewModal } from '../../../components/ImagePreviewModal'
import { useState } from 'react'

interface Props {
    device: ExtendedPeripheral
}

const NumericInput = ({ label, value, onChange, min, max, disabled }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; disabled?: boolean }) => {
    const { spacing } = useExtendedTheme()
    const [localValue, setLocalValue] = useState(() => value.toString())

    const [prevValue, setPrevValue] = useState(value)

    // Sync external changes (e.g. preset or reset) during render
    if (value !== prevValue) {
        setPrevValue(value)
        setLocalValue(value.toString())
    }

    return (
        <View style={{ marginBottom: spacing }}>
            <WWTextInput
                label={label}
                value={localValue}
                keyboardType="numeric"
                disabled={disabled}
                onChange={(t: string) => {
                    setLocalValue(t)
                }}
                onBlur={() => {
                    // Final clamp + format on blur
                    let v = parseInt(localValue.replace(/[^0-9]/g, ''), 10)
                    if (isNaN(v)) v = min
                    if (v < min) v = min
                    if (v > max) v = max
                    setLocalValue(v.toString())
                    onChange(v)
                }}
            />
        </View>
    )
}


export const CameraSettingsTestSection = ({ device }: Props) => {
    const { colors, spacing } = useExtendedTheme()
    
    const {
        cameraParams,
        updateCameraParam,
        applyAndCapture,
        isApplying,
        applyStage,
        aeData,
        capturedImages,
        capturePreview
    } = useCameraSettingsTest({ device })

    const [modalVisible, setModalVisible] = useState(false)
    const [selectedImage, setSelectedImage] = useState<CapturedImageInfo | null>(null)

    const handleViewImage = (info: CapturedImageInfo) => {
        setSelectedImage(info)
        setModalVisible(true)
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={[styles.content, { gap: spacing }]} keyboardShouldPersistTaps="handled">
            

            {!device?.connected && (
                <View style={{
                    padding: 12,
                    backgroundColor: 'rgba(176, 0, 32, 0.1)',
                    borderRadius: 8,
                    marginTop: 8
                }}>
                    <WWText style={{ color: colors.error, textAlign: 'center' }}>
                        ⚠️ Bluetooth connection lost. Actions are disabled until the device reconnects.
                    </WWText>
                </View>
            )}

            <Surface style={[styles.card, { backgroundColor: colors.surface, marginTop: 8 }]} elevation={1}>
                
                
                <View style={styles.inputGroup}>
                    <WWText variant="labelLarge">Flash LED Type</WWText>
                    <SegmentedButtons
                        value={cameraParams.flashLed.toString()}
                        onValueChange={(val) => updateCameraParam('flashLed', parseInt(val, 10))}
                        buttons={[
                            { value: '0', label: 'Off', disabled: !device?.connected },
                            { value: '1', label: 'Visible', disabled: !device?.connected },
                            { value: '2', label: 'IR', disabled: !device?.connected },
                        ]}
                        style={{ marginTop: 8 }}
                    />
                </View>

                {cameraParams.flashLed !== 0 && (
                    <NumericInput
                        label="LED Brightness (0-100%)"
                        value={cameraParams.ledBrightness}
                        onChange={(v: number) => updateCameraParam('ledBrightness', v)}
                        min={0}
                        max={100}
                        disabled={!device?.connected || isApplying || capturePreview.isCapturing}
                    />
                )}
            </Surface>



            <View style={styles.actionRow}>
                <Button 
                    mode="contained" 
                    onPress={applyAndCapture}
                    loading={isApplying || capturePreview.isCapturing}
                    disabled={!device?.connected || isApplying || capturePreview.isCapturing}
                    style={{ flex: 1 }}
                >
                    <WWText style={{ color: 'white' }}>{!device?.connected ? 'Disconnected' : 'Capture Image'}</WWText>
                </Button>
            </View>

            {(isApplying || capturePreview.isCapturing) && (
                <View style={styles.progressContainer}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                        <ActivityIndicator size="small" />
                        <WWText>{applyStage || capturePreview.captureStage || 'Processing…'}</WWText>
                    </View>
                    {capturePreview.captureProgress > 0 && (
                        <View style={{ width: '100%', marginTop: 16 }}>
                            <ProgressBar progress={capturePreview.captureProgress} color={colors.primary} />
                            <WWText variant="labelSmall" style={{ textAlign: 'center', marginTop: 4 }}>
                                {Math.round(capturePreview.captureProgress * 100)}%
                            </WWText>
                        </View>
                    )}
                </View>
            )}

            {aeData && (
                <>
                    <WWText variant="titleMedium" style={{ marginTop: spacing }}>AE Data</WWText>
                    <Surface style={[styles.card, { backgroundColor: colors.surface }]} elevation={1}>
                        <View style={styles.aeRow}>
                            <WWText variant="labelMedium">Integration:</WWText>
                            <WWText>{aeData.integration} lines</WWText>
                        </View>
                        <Divider style={styles.divider} />
                        <View style={styles.aeRow}>
                            <WWText variant="labelMedium">Analog Gain:</WWText>
                            <WWText>{aeData.analogGain}</WWText>
                        </View>
                        <Divider style={styles.divider} />
                        <View style={styles.aeRow}>
                            <WWText variant="labelMedium">Digital Gain:</WWText>
                            <WWText>{aeData.digitalGain}</WWText>
                        </View>
                        <Divider style={styles.divider} />
                        
                        <View style={styles.aeRow}>
                            <WWText variant="labelMedium">AE Mean:</WWText>
                            <WWText>{aeData.aeMean}</WWText>
                        </View>
                        <View style={{ height: 10, width: '100%', backgroundColor: colors.surfaceVariant, borderRadius: 5, marginTop: 4 }}>
                            <View style={{ 
                                height: '100%', 
                                width: `${(parseInt(aeData.aeMean, 10) / 255) * 100}%`, 
                                backgroundColor: colors.primary, 
                                borderRadius: 5 
                            }} />
                        </View>
                        
                        <Divider style={styles.divider} />
                        <View style={styles.aeRow}>
                            <WWText variant="labelMedium">Converged:</WWText>
                            <WWText>{aeData.aeConverged.toUpperCase() === 'Y' ? '✅ Yes' : '⏳ No'}</WWText>
                        </View>
                    </Surface>
                </>
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
                    <View style={{ marginTop: 8, paddingHorizontal: 4, width: '100%' }}>
                        <WWText variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>
                            Flash: {['Off', 'Visible', 'IR'][selectedImage.params.flashLed]} ({selectedImage.params.ledBrightness}%)
                        </WWText>
                        {selectedImage.aeData && (
                            <WWText variant="labelMedium" style={{ color: colors.primary, marginTop: 2 }}>
                                AE Mean: {selectedImage.aeData.aeMean} | Conv: {selectedImage.aeData.aeConverged}
                            </WWText>
                        )}
                    </View>
                )}
            </ImagePreviewModal>
            
            <View style={{ height: 40 }} />
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
    aeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    divider: {
        marginVertical: 4,
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
