import React, { useCallback, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { List, Card, Button, Text, TextInput } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { WWButton } from '../../../components/ui/WWButton'
import { WWProgressBar } from '../../../components/ui/WWProgressBar'
import { WWSelect } from '../../../components/ui/WWSelect'
import { WWIcon } from '../../../components/ui/WWIcon'
import Firmware from '../../../database/models/Firmware'
import { convertBleToSemanticVersion } from '../../../utils/versionUtils'

interface AdvancedSettingsSectionProps {
    cameraHeight: string
    onCameraHeightChange: (text: string) => void
    locationName: string
    onLocationNameChange: (text: string) => void
    availableLocations: {label: string, value: string}[]
    isCustomLocation: boolean
    setIsCustomLocation: (val: boolean) => void
    batteryLevel: number | null
    sdCardStatus: { total: number; free: number } | null
    latestBleFirmware: Firmware | null
    deviceFirmwareVersion: string | null
    bleFirmwareUpdateAvailable: boolean
    firmwareUpdateProgress: number
    isUpdatingFirmware: boolean
    isCheckingFirmware: boolean
    isVerifyingUpdate: boolean
    firmwareUpdateStatus: string
    handleBatteryCheck: () => void
    handleSdCardCheck: () => void
    handleFirmwareCheck: () => void
    handleBleFirmwareUpdate: () => void
    isInitializing: boolean
    bleDeviceConnected: boolean
    theme: any
    onShowHelp: (title: string, content: string) => void
}

export const AdvancedSettingsSection: React.FC<AdvancedSettingsSectionProps> = ({
    cameraHeight,
    onCameraHeightChange,
    locationName,
    onLocationNameChange,
    availableLocations,
    isCustomLocation,
    setIsCustomLocation,
    batteryLevel,
    sdCardStatus,
    latestBleFirmware,
    deviceFirmwareVersion,
    bleFirmwareUpdateAvailable,
    firmwareUpdateProgress,
    isUpdatingFirmware,
    isCheckingFirmware,
    isVerifyingUpdate,
    firmwareUpdateStatus,
    handleBatteryCheck,
    handleSdCardCheck,
    handleFirmwareCheck,
    handleBleFirmwareUpdate,
    isInitializing,
    bleDeviceConnected,
    theme,
    onShowHelp
}) => {
    const [expanded, setExpanded] = useState(false)

    // Battery Render Helpers
    const renderBatteryIcon = useCallback((props: any) => <WWIcon {...props} source="battery-charging" />, [])
    const renderBatteryHelp = useCallback((props: any) => (
        <Button 
            {...props} 
            icon="help-circle-outline" 
            onPress={() => onShowHelp('Battery Level', 'Check the device battery level. It must be above 30% for deployment.')}
        >
            <Text>Help</Text>
        </Button>
    ), [onShowHelp])

    // SD Card Render Helpers
    const renderSdCardIcon = useCallback((props: any) => <WWIcon {...props} source="sd" />, [])
    const renderSdCardHelp = useCallback((props: any) => (
        <Button 
            {...props} 
            icon="help-circle-outline" 
            onPress={() => onShowHelp('SD Card Status', 'Verifies SD card space. Ensure sufficient space is available for recordings.')}
        >
            <Text>Help</Text>
        </Button>
    ), [onShowHelp])

    // Firmware Render Helpers
    const renderFirmwareIcon = useCallback((props: any) => <WWIcon {...props} source="bluetooth" />, [])
    const renderFirmwareHelp = useCallback((props: any) => (
        <Button 
            {...props} 
            icon="help-circle-outline" 
            onPress={() => onShowHelp('BLE Firmware', 'Manage device firmware. Ensure the device is running the latest version for best performance.')}
        >
            <Text>Help</Text>
        </Button>
    ), [onShowHelp])

    return (
        <List.Accordion
            title="Advanced Device Settings"
            description="Diagnostics and Firmware Updates"
            left={props => <List.Icon {...props} icon="cog" />}
            expanded={expanded}
            onPress={() => setExpanded(!expanded)}
            style={styles.accordionHeader}
        >
            <View style={styles.accordionContent}>
                
                {/* Location & Camera Settings Card */}
                <Card style={styles.card}>
                    <Card.Title title="Location & Camera Settings" />
                    <Card.Content style={styles.content}>
                        {availableLocations.length > 0 && !isCustomLocation ? (
                            <View style={styles.inputContainer}>
                                <WWSelect
                                    label="Site Name"
                                    value={locationName}
                                    options={[...availableLocations, {label: '- Create New Site Location -', value: 'ADD_NEW'}]}
                                    onChange={(val) => {
                                        if (val === 'ADD_NEW') {
                                            setIsCustomLocation(true)
                                            onLocationNameChange('')
                                        } else {
                                            onLocationNameChange(val)
                                        }
                                    }}
                                />
                            </View>
                        ) : (
                            <View style={styles.inputContainer}>
                                <TextInput
                                    label="Site Name"
                                    value={locationName}
                                    onChangeText={onLocationNameChange}
                                    mode="outlined"
                                    right={<TextInput.Icon icon="help-circle-outline" onPress={() => onShowHelp('Site Name', 'Name of the deployment site')} />}
                                />
                                {availableLocations.length > 0 && (
                                    <WWButton mode="text" onPress={() => { setIsCustomLocation(false); if(availableLocations.length > 0) onLocationNameChange(availableLocations[0].value) }} style={styles.switchButton}>
                                        <Text>Select from nearby locations instead</Text>
                                    </WWButton>
                                )}
                            </View>
                        )}

                        <View style={styles.inputContainer}>
                            <TextInput
                                label="Camera Height (cm)"
                                placeholder="e.g. 50"
                                value={cameraHeight}
                                onChangeText={(text) => {
                                    if (/^\d*$/.test(text)) {
                                        onCameraHeightChange(text)
                                    }
                                }}
                                mode="outlined"
                                keyboardType="numeric"
                                right={<TextInput.Icon icon="help-circle-outline" onPress={() => onShowHelp('Camera Height', 'The height of the camera lens from the ground in centimeters.')} />}
                            />
                        </View>
                    </Card.Content>
                </Card>

                {/* Battery Check Card */}
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
                                    <WWText variant="bodyLarge"><Text>🔋 {batteryLevel}%</Text></WWText>
                                    <WWText variant="bodySmall" style={styles.statusHint}>
                                        <Text>{batteryLevel > 30 ? 'Battery level sufficient' : 'Battery level low - charge before deployment'}</Text>
                                    </WWText>
                                </View>
                                <WWButton mode="outlined" onPress={handleBatteryCheck} style={styles.actionButton} disabled={isInitializing || !bleDeviceConnected}>
                                    <Text>Check Again</Text>
                                </WWButton>
                            </View>
                        ) : (
                            <WWButton mode="outlined" onPress={handleBatteryCheck} disabled={isInitializing || !bleDeviceConnected}>
                                <Text>Check Battery Level</Text>
                            </WWButton>
                        )}
                    </Card.Content>
                </Card>

                {/* SD Card Check Card */}
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
                                        <Text>💾 {Math.round((sdCardStatus.free / sdCardStatus.total) * 100)}% available of {Math.round(sdCardStatus.total / 1024 / 1024)}GB</Text>
                                    </WWText>
                                    <WWText variant="bodySmall" style={styles.statusHint}>
                                        <Text>{(sdCardStatus.free / sdCardStatus.total) > 0.1
                                            ? 'SD card has sufficient space'
                                            : 'SD card is nearly full - free up space'}</Text>
                                    </WWText>
                                </View>
                                <WWButton mode="outlined" onPress={handleSdCardCheck} style={styles.actionButton} disabled={isInitializing || !bleDeviceConnected}>
                                    <Text>Check Again</Text>
                                </WWButton>
                            </View>
                        ) : (
                            <WWButton mode="outlined" onPress={handleSdCardCheck} disabled={isInitializing || !bleDeviceConnected}>
                                <Text>Check SD Card</Text>
                            </WWButton>
                        )}
                    </Card.Content>
                </Card>

                {/* Firmware Card */}
                <Card style={styles.card}>
                    <Card.Title
                        title="BLE Firmware"
                        left={renderFirmwareIcon}
                        right={renderFirmwareHelp}
                    />
                    <Card.Content>
                        {latestBleFirmware && (
                            <WWText variant="bodyMedium" style={styles.firmwareVersionText}>
                                <Text>Latest Available: {latestBleFirmware.version}</Text>
                            </WWText>
                        )}

                        {deviceFirmwareVersion && (
                            <WWText style={styles.firmwareVersionText}>
                                <Text>Device Version: {convertBleToSemanticVersion(deviceFirmwareVersion)}</Text>
                            </WWText>
                        )}

                        {!deviceFirmwareVersion && !isCheckingFirmware && (
                            <WWButton
                                mode="outlined"
                                onPress={handleFirmwareCheck}
                                disabled={isInitializing || !bleDeviceConnected}
                                style={styles.actionButton}
                            >
                                <Text>Check Firmware Version</Text>
                            </WWButton>
                        )}

                        {isCheckingFirmware && (
                            <WWText variant="bodySmall" style={styles.statusHint}>
                                <Text>Checking firmware version...</Text>
                            </WWText>
                        )}

                        {isUpdatingFirmware ? (
                            <View style={styles.updatingContainer}>
                                <WWProgressBar
                                    progress={isVerifyingUpdate ? 1 : firmwareUpdateProgress / 100}
                                    showLabel
                                    label={firmwareUpdateStatus || (isVerifyingUpdate ? 'Rebooting & Verifying...' : `Updating: ${firmwareUpdateProgress}%`)}
                                />
                                <WWText variant="bodySmall" style={styles.statusHint}>
                                    <Text>{firmwareUpdateStatus || (isVerifyingUpdate ? 'Waiting for device to finish restart...' : 'Do not disconnect the device...')}</Text>
                                </WWText>
                            </View>
                        ) : deviceFirmwareVersion && bleFirmwareUpdateAvailable ? (
                            <>
                                <Text variant="bodySmall" style={[styles.warningText, { color: theme.colors.error }]}>
                                    ⚠️ Update available
                                </Text>
                                <WWButton
                                    mode="outlined"
                                    onPress={handleBleFirmwareUpdate}
                                    disabled={isInitializing}
                                    style={styles.actionButton}
                                >
                                    <Text>Update BLE Firmware</Text>
                                </WWButton>
                                {batteryLevel !== null && batteryLevel < 30 && (
                                    <Text variant="bodySmall" style={[styles.warningText, { color: theme.colors.error }]}>
                                        ⚠️ Battery level low - update at your own risk
                                    </Text>
                                )}
                            </>
                        ) : deviceFirmwareVersion && !bleFirmwareUpdateAvailable ? (
                            <View>
                                <Text variant="bodyMedium" style={[styles.successText, { color: theme.colors.primary }]}>
                                    ✓ Firmware is up to date
                                </Text>
                                <WWButton
                                    mode="outlined"
                                    onPress={handleFirmwareCheck}
                                    disabled={isInitializing || !bleDeviceConnected}
                                    style={styles.actionButton}
                                >
                                    <Text>Refresh Version</Text>
                                </WWButton>
                            </View>
                        ) : null}
                    </Card.Content>
                </Card>

            </View>
        </List.Accordion>
    )
}

const styles = StyleSheet.create({
    accordionHeader: {
        backgroundColor: 'transparent',
        paddingHorizontal: 0,
    },
    accordionContent: {
        gap: 16,
        paddingBottom: 16,
    },
    card: {
        width: '100%',
    },
    content: {
        gap: 16,
    },
    inputContainer: {
        marginBottom: 8,
    },
    switchButton: {
        marginTop: 4,
        alignSelf: 'flex-start'
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
    actionButton: {
        marginTop: 8,
    },
    firmwareVersionText: {
        marginBottom: 8,
    },
    warningText: {
        marginTop: 8,
    },
    successText: {
        marginBottom: 12,
    },
    updatingContainer: {
        marginTop: 8,
    }
})
