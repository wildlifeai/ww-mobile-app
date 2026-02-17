import React, { useCallback } from 'react'
import { convertBleToSemanticVersion } from '../../../utils/versionUtils'
import { View, StyleSheet } from 'react-native'
import { Card, Button, Text } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { WWButton } from '../../../components/ui/WWButton'
import { WWProgressBar } from '../../../components/ui/WWProgressBar'
import { WWIcon } from '../../../components/ui/WWIcon'
import Firmware from '../../../database/models/Firmware'

interface FirmwareSectionProps {
    latestBleFirmware: Firmware | null
    deviceFirmwareVersion: string | null
    bleFirmwareUpdateAvailable: boolean
    firmwareUpdateProgress: number
    isUpdatingFirmware: boolean
    isCheckingFirmware: boolean
    isVerifyingUpdate: boolean
    handleFirmwareCheck: () => void
    handleBleFirmwareUpdate: () => void
    isInitializing: boolean
    bleDeviceConnected: boolean
    batteryLevel: number | null
    theme: any
    onShowHelp: (title: string, content: string) => void
    firmwareUpdateStatus?: string
}

export const FirmwareSection: React.FC<FirmwareSectionProps> = ({
    latestBleFirmware,
    deviceFirmwareVersion,
    bleFirmwareUpdateAvailable,
    firmwareUpdateProgress,
    isUpdatingFirmware,
    isCheckingFirmware,
    isVerifyingUpdate,
    handleFirmwareCheck,
    handleBleFirmwareUpdate,
    isInitializing,
    bleDeviceConnected,
    batteryLevel,
    theme,
    onShowHelp,
    firmwareUpdateStatus
}) => {
    const renderIcon = useCallback((props: any) => <WWIcon {...props} source="bluetooth" />, [])
    const renderHelp = useCallback((props: any) => (
        <Button 
            {...props} 
            icon="help-circle-outline" 
            onPress={() => onShowHelp('BLE Firmware', 'Manage device firmware. Ensure the device is running the latest version for best performance.')}
        >
            Help
        </Button>
    ), [onShowHelp])

    return (
        <Card style={styles.card}>
            <Card.Title
                title="BLE Firmware"
                left={renderIcon}
                right={renderHelp}
            />
            <Card.Content>
                {latestBleFirmware && (
                    <WWText variant="bodyMedium" style={styles.firmwareVersionText}>
                        Latest Available: {latestBleFirmware.version}
                    </WWText>
                )}

                {deviceFirmwareVersion && (
                    <WWText style={styles.firmwareVersionText}>
                        Device Version: {convertBleToSemanticVersion(deviceFirmwareVersion)}
                    </WWText>
                )}

                {!deviceFirmwareVersion && !isCheckingFirmware && (
                    <WWButton
                        mode="outlined"
                        onPress={handleFirmwareCheck}
                        disabled={isInitializing || !bleDeviceConnected}
                        style={styles.checkFirmwareButton}
                    >
                        Check Firmware Version
                    </WWButton>
                )}

                {isCheckingFirmware && (
                    <WWText variant="bodySmall" style={styles.statusHint}>
                        Checking firmware version...
                    </WWText>
                )}

                {isUpdatingFirmware ? (
                    <>
                        <WWProgressBar
                            progress={isVerifyingUpdate ? 1 : firmwareUpdateProgress / 100}
                            showLabel
                            label={firmwareUpdateStatus || (isVerifyingUpdate ? 'Rebooting & Verifying...' : `Updating: ${firmwareUpdateProgress}%`)}
                        />
                        <WWText variant="bodySmall" style={styles.statusHint}>
                            {firmwareUpdateStatus || (isVerifyingUpdate ? 'Waiting for device to finish restart...' : 'Do not disconnect the device...')}
                        </WWText>
                    </>
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
                            Update BLE Firmware
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
                            Refresh Version
                        </WWButton>
                    </View>
                ) : null}
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {
        // marginBottom: 16, // Removed to use gap in parent container
    },
    firmwareVersionText: {
        marginBottom: 8,
    },
    checkFirmwareButton: {
        marginTop: 8,
    },
    actionButton: {
        marginTop: 8,
    },
    statusHint: {
        opacity: 0.6,
        marginTop: 4,
        fontSize: 12,
    },
    warningText: {
        marginTop: 8,
    },
    successText: {
        marginBottom: 12,
    },
})
