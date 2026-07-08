import { View, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native'
import { Surface, Divider, Button, SegmentedButtons, ActivityIndicator, ProgressBar } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { WWTextInput } from '../../../components/ui/WWTextInput'
import { useExtendedTheme } from '../../../theme'
import { useCameraSettingsTest, CapturedImageInfo } from '../hooks/useCameraSettingsTest'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { ImagePreviewModal } from '../../../components/ImagePreviewModal'
import { WWBleDisconnectedBanner } from '../../../components/ui/WWBleDisconnectedBanner'
import { DeviceHealthBanner } from '../../../components/DeviceHealthBanner'
import { useDeviceSelfTest } from '../../../hooks/useDeviceSelfTest'
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

    const { issues: healthIssues, isChecking: isCheckingHealth, refresh: recheckHealth } = useDeviceSelfTest({ device })

    const busy = !device?.connected || isApplying || capturePreview.isCapturing

    // Q8.8 white-balance presets (op27/op28): red gain, blue gain
    const WB_PRESETS: Array<{ label: string; red: number; blue: number }> = [
        { label: 'Off', red: 0, blue: 0 },           // correction disabled - raw hardware JPEG
        { label: 'Unity', red: 256, blue: 256 },     // software encode, no WB (encoder A/B test)
        { label: 'Dim', red: 286, blue: 326 },       // bench default for dim scenes
        { label: 'Bright', red: 407, blue: 358 },    // bench-tuned for bright scenes
    ]
    const applyWbPreset = (red: number, blue: number) => {
        updateCameraParam('wbRedGain', red)
        updateCameraParam('wbBlueGain', blue)
    }

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

            <Surface style={[styles.card, { backgroundColor: colors.surface }]} elevation={1}>
                <WWText variant="labelLarge">White Balance (RP3 colour camera)</WWText>
                <WWText variant="labelSmall" style={{ color: colors.onSurfaceVariant, marginTop: 2, marginBottom: 8 }}>
                    Q8.8 gains: 256 = 1.0×, 0 = correction off (raw hardware JPEG). Applied on the next capture.
                </WWText>
                <View style={styles.presetRow}>
                    {WB_PRESETS.map(p => {
                        const active = cameraParams.wbRedGain === p.red && cameraParams.wbBlueGain === p.blue
                        return (
                            <Button
                                key={p.label}
                                compact
                                mode={active ? 'contained' : 'outlined'}
                                onPress={() => applyWbPreset(p.red, p.blue)}
                                disabled={busy}
                            >
                                {p.label}
                            </Button>
                        )
                    })}
                </View>
                <NumericInput
                    label="Red gain (op27, 0-1024)"
                    value={cameraParams.wbRedGain}
                    onChange={(v: number) => updateCameraParam('wbRedGain', v)}
                    min={0}
                    max={1024}
                    disabled={busy}
                />
                <NumericInput
                    label="Blue gain (op28, 0-1024)"
                    value={cameraParams.wbBlueGain}
                    onChange={(v: number) => updateCameraParam('wbBlueGain', v)}
                    min={0}
                    max={1024}
                    disabled={busy}
                />
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
    presetRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
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
