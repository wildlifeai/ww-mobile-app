import React, { useCallback } from 'react'
import { View, StyleSheet, Image } from 'react-native'
import { Card, Button, Text } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { WWButton } from '../../../components/ui/WWButton'
import { WWIcon } from '../../../components/ui/WWIcon'

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
    onShowHelp: (title: string, content: string) => void
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
    theme,
    onShowHelp
}) => {
    const renderBatteryIcon = useCallback((props: any) => <WWIcon {...props} source="battery-charging" />, [])
    const renderBatteryHelp = useCallback((props: any) => (
        <Button 
            {...props} 
            icon="help-circle-outline" 
            onPress={() => onShowHelp('Battery Level', 'Check the device battery level. It must be above 30% for deployment.')}
        >
            Help
        </Button>
    ), [onShowHelp])

    const renderSdCardIcon = useCallback((props: any) => <WWIcon {...props} source="sd" />, [])
    const renderSdCardHelp = useCallback((props: any) => (
        <Button 
            {...props} 
            icon="help-circle-outline" 
            onPress={() => onShowHelp('SD Card Status', 'Verifies SD card space. Ensure sufficient space is available for recordings.')}
        >
            Help
        </Button>
    ), [onShowHelp])

    const renderCameraIcon = useCallback((props: any) => <WWIcon {...props} source="camera" />, [])
    const renderCameraHelp = useCallback((props: any) => (
        <Button 
            {...props} 
            icon="help-circle-outline" 
            onPress={() => onShowHelp('Camera View Test', 'Take a test photo to verify camera positioning and function.')}
        >
            Help
        </Button>
    ), [onShowHelp])

    return (
        <>
            {/* Battery Check */}
            <Card style={styles.card}>
                <Card.Title
                    title="Battery Level"
                    left={renderBatteryIcon}
                    right={renderBatteryHelp}
                />
                <Card.Content>
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
                </Card.Content>
            </Card>

            {/* SD Card Check */}
            <Card style={styles.card}>
                <Card.Title
                    title="SD Card Status"
                    left={renderSdCardIcon}
                    right={renderSdCardHelp}
                />
                <Card.Content>
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
                </Card.Content>
            </Card>

            {/* Camera View Test */}
            <Card style={styles.card}>
                <Card.Title
                    title="Camera View Test"
                    left={renderCameraIcon}
                    right={renderCameraHelp}
                />
                <Card.Content>
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
                </Card.Content>
            </Card>
        </>
    )
}

const styles = StyleSheet.create({
    card: {
        // marginBottom: 16, // Removed to use gap in parent container
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
