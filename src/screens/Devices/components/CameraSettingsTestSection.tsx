import { View, StyleSheet, ScrollView, Image } from 'react-native'
import { Surface, Divider, Button, Checkbox, SegmentedButtons, ActivityIndicator, ProgressBar } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { WWTextInput } from '../../../components/ui/WWTextInput'
import { useExtendedTheme } from '../../../theme'
import { useCameraSettingsTest, CapturedImageInfo } from '../hooks/useCameraSettingsTest'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { ImagePreviewModal } from '../../../components/ImagePreviewModal'
import { useState, useEffect } from 'react'

interface Props {
    device: ExtendedPeripheral
}

const NumericInput = ({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) => {
    const { spacing } = useExtendedTheme()
    const [localValue, setLocalValue] = useState(value.toString())

    // Sync external changes (e.g. preset or reset)
    useEffect(() => {
        setLocalValue(value.toString())
    }, [value])

    return (
        <View style={{ marginBottom: spacing }}>
            <WWTextInput
                label={label}
                value={localValue}
                keyboardType="numeric"
                onChange={(t: string) => {
                    setLocalValue(t)
                }}
                onBlur={() => {
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
        testModeBits,
        toggleTestBit,
        cameraParams,
        updateCameraParam,
        applyAndCapture,
        resetTestMode,
        isApplying,
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
        <ScrollView style={styles.container} contentContainerStyle={[styles.content, { gap: spacing }]}>
            
            <WWText variant="titleMedium" style={{ marginTop: spacing }}>Camera Parameters</WWText>
            
            <Surface style={[styles.card, { backgroundColor: colors.surface }]} elevation={1}>
                
                <NumericInput
                    label="Pictures per capture (1-100)"
                    value={cameraParams.numPictures}
                    onChange={(v: number) => updateCameraParam('numPictures', v)}
                    min={1}
                    max={100}
                />
                <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginTop: -8, marginBottom: 8 }}>
                    Only the last photo is transferred to the app. Use multiple pictures for AE convergence testing.
                </WWText>
                
                <NumericInput
                    label="Picture Interval (100-10000 ms)"
                    value={cameraParams.pictureInterval}
                    onChange={(v: number) => updateCameraParam('pictureInterval', v)}
                    min={100}
                    max={10000}
                />
                
                <NumericInput
                    label="Flash Duration (0-2000 ms)"
                    value={cameraParams.flashDuration}
                    onChange={(v: number) => updateCameraParam('flashDuration', v)}
                    min={0}
                    max={2000}
                />
                
                <View style={styles.inputGroup}>
                    <WWText variant="labelLarge">Flash LED Type</WWText>
                    <SegmentedButtons
                        value={cameraParams.flashLed.toString()}
                        onValueChange={(val) => updateCameraParam('flashLed', parseInt(val, 10))}
                        buttons={[
                            { value: '0', label: 'Off' },
                            { value: '1', label: 'Visible' },
                            { value: '2', label: 'IR' },
                        ]}
                        style={{ marginTop: 8 }}
                    />
                </View>

                <NumericInput
                    label="LED Brightness (0-100%)"
                    value={cameraParams.ledBrightness}
                    onChange={(v: number) => updateCameraParam('ledBrightness', v)}
                    min={0}
                    max={100}
                />

                <NumericInput
                    label="NN Threshold (0-127)"
                    value={cameraParams.modelThreshold}
                    onChange={(v: number) => updateCameraParam('modelThreshold', v)}
                    min={0}
                    max={127}
                />

            </Surface>

            <WWText variant="titleMedium">Test Modes</WWText>
            <Surface style={[styles.card, { backgroundColor: colors.surface }]} elevation={1}>
                <View style={styles.checkboxRow}>
                    <Checkbox
                        status={(testModeBits & 1) ? 'checked' : 'unchecked'}
                        onPress={() => toggleTestBit(0)}
                    />
                    <WWText>Tone Mapping (Bit 0)</WWText>
                </View>
                <View style={styles.checkboxRow}>
                    <Checkbox
                        status={(testModeBits & 2) ? 'checked' : 'unchecked'}
                        onPress={() => toggleTestBit(1)}
                    />
                    <WWText>Save BMP (Bit 1)</WWText>
                </View>
                <View style={styles.checkboxRow}>
                    <Checkbox
                        status={(testModeBits & 4) ? 'checked' : 'unchecked'}
                        onPress={() => toggleTestBit(2)}
                    />
                    <WWText>Flash Brightness (Bit 2)</WWText>
                </View>
                <View style={styles.checkboxRow}>
                    <Checkbox
                        status={(testModeBits & 8) ? 'checked' : 'unchecked'}
                        onPress={() => toggleTestBit(3)}
                        color={colors.error}
                    />
                    <WWText style={{ color: colors.error }}>Skip File Creation (Bit 3) ⚠️</WWText>
                </View>
            </Surface>

            <View style={styles.actionRow}>
                <Button 
                    mode="outlined" 
                    onPress={resetTestMode} 
                    disabled={isApplying || capturePreview.isCapturing}
                    style={{ flex: 1 }}
                >
                    Reset
                </Button>
                <Button 
                    mode="contained" 
                    onPress={applyAndCapture}
                    loading={isApplying || capturePreview.isCapturing}
                    disabled={isApplying || capturePreview.isCapturing}
                    style={{ flex: 2 }}
                >
                    Apply & Capture
                </Button>
            </View>

            {capturePreview.isCapturing && (
                <View style={styles.progressContainer}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                        <ActivityIndicator size="small" />
                        <WWText>{capturePreview.captureStage || 'Capturing...'}</WWText>
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
                            {capturedImages.map((info, idx) => (
                                <Surface 
                                    key={`${info.uri}-${idx}`} 
                                    style={styles.thumbnailContainer} 
                                    elevation={2}
                                    onTouchEnd={() => handleViewImage(info)}
                                >
                                    <Image source={{ uri: info.uri }} style={styles.thumbnail} />
                                </Surface>
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
                            Pics: {selectedImage.params.numPictures} | Int: {selectedImage.params.pictureInterval}ms | Thr: {selectedImage.params.modelThreshold}
                        </WWText>
                        <WWText variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>
                            Flash: {['Off', 'Visible', 'IR'][selectedImage.params.flashLed]} ({selectedImage.params.ledBrightness}%, {selectedImage.params.flashDuration}ms)
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
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
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
