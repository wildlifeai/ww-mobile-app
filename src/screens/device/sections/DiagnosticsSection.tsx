import React from 'react'
import { View, StyleSheet, Image } from 'react-native'
import { Text } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { WWButton } from '../../../components/ui/WWButton'

interface DiagnosticsSectionProps {
    batteryLevel: number | null
    handleBatteryCheck: () => void
    sdCardStatus: { total: number; free: number } | null
    handleSdCardCheck: () => void
    capturedImageUri: string | null
    handleCameraTest: () => void
    isCapturingImage: boolean
    cameraTestPassed: boolean
    isInitializing: boolean
    bleDeviceConnected: boolean
    theme: any
}

export const DiagnosticsSection: React.FC<DiagnosticsSectionProps> = ({
    batteryLevel,
    handleBatteryCheck,
    sdCardStatus,
    handleSdCardCheck,
    capturedImageUri,
    handleCameraTest,
    isCapturingImage,
    cameraTestPassed,
    isInitializing,
    bleDeviceConnected,
    theme
}) => {
    return (
        <>
            {/* Battery Check */}
            <View style={styles.section}>
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                    Battery Level
                </Text>
                {batteryLevel !== null ? (
                    <View>
                        <View style={styles.statusDisplay}>
                            <WWText variant="bodyLarge">🔋 {batteryLevel}%</WWText>
                            <WWText variant="bodySmall" style={styles.statusHint}>
                                {batteryLevel > 30 ? 'Battery level sufficient' : 'Battery level low - charge before deployment'}
                            </WWText>
                        </View>
                        <WWButton mode="outlined" onPress={handleBatteryCheck} style={styles.statusButton} disabled={isInitializing || !bleDeviceConnected}>
                            Check Again
                        </WWButton>
                    </View>
                ) : (
                    <WWButton mode="outlined" onPress={handleBatteryCheck} disabled={isInitializing || !bleDeviceConnected}>
                        Check Battery Level
                    </WWButton>
                )}
            </View>

            {/* SD Card Check */}
            <View style={styles.section}>
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                    SD Card Status
                </Text>
                {sdCardStatus !== null ? (
                    <View>
                        <View style={styles.statusDisplay}>
                            <WWText variant="bodyLarge">
                                💾 {Math.round((sdCardStatus.free / sdCardStatus.total) * 100)}% available of {Math.round(sdCardStatus.total / 1024 / 1024)}GB
                            </WWText>
                            <WWText variant="bodySmall" style={styles.statusHint}>
                                {(sdCardStatus.free / sdCardStatus.total) > 0.1
                                    ? 'SD card has sufficient space'
                                    : 'SD card is nearly full - free up space'}
                            </WWText>
                        </View>
                        <WWButton mode="outlined" onPress={handleSdCardCheck} style={styles.statusButton} disabled={isInitializing || !bleDeviceConnected}>
                            Check Again
                        </WWButton>
                    </View>
                ) : (
                    <WWButton mode="outlined" onPress={handleSdCardCheck} disabled={isInitializing || !bleDeviceConnected}>
                        Check SD Card
                    </WWButton>
                )}
            </View>

            {/* Camera View Test */}
            <View style={styles.section}>
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                    Camera View Test
                </Text>
                <WWText variant="bodySmall" style={styles.sectionDescription}>
                    Capture a test photo to verify camera positioning
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

                <WWButton
                    mode="outlined"
                    onPress={handleCameraTest}
                    disabled={sdCardStatus === null || isCapturingImage || isInitializing || !bleDeviceConnected}
                    loading={isCapturingImage}
                >
                    {isCapturingImage ? 'Capturing & Downloading...' : (cameraTestPassed ? 'Test Again' : 'Test Camera View')}
                </WWButton>
                {sdCardStatus === null && (
                    <Text variant="bodySmall" style={[styles.warningText, { color: theme.colors.error }]}>
                        Check SD card first
                    </Text>
                )}
            </View>
        </>
    )
}

const styles = StyleSheet.create({
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontWeight: '600',
        marginBottom: 16,
    },
    sectionDescription: {
        opacity: 0.6,
        marginBottom: 12,
    },
    statusDisplay: {
        gap: 4,
        marginTop: 8,
    },
    statusHint: {
        opacity: 0.6,
        marginTop: 4,
        fontSize: 12,
    },
    statusButton: {
        marginTop: 8,
    },
    warningText: {
        marginTop: 8,
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
})
