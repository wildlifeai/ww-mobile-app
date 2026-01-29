import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Text } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { WWButton } from '../../../components/ui/WWButton'
import { WWProgressBar } from '../../../components/ui/WWProgressBar'
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
    theme
}) => {
    return (
        <View style={styles.section}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                BLE Firmware
            </Text>

            {latestBleFirmware && (
                <WWText variant="bodyMedium" style={styles.firmwareVersionText}>
                    Latest Available: {latestBleFirmware.version}
                </WWText>
            )}

            {deviceFirmwareVersion && (
                <WWText variant="bodyMedium" style={styles.firmwareVersionText}>
                    Device Version: {deviceFirmwareVersion}
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
                        label={isVerifyingUpdate ? 'Rebooting & Verifying...' : `Updating: ${firmwareUpdateProgress}%`}
                    />
                    <WWText variant="bodySmall" style={styles.statusHint}>
                        {isVerifyingUpdate ? 'Waiting for device to finish restart...' : 'Do not disconnect the device...'}
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
                <Text variant="bodyMedium" style={{ color: theme.colors.primary }}>
                    ✓ Firmware is up to date
                </Text>
            ) : null}
        </View>
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
    firmwareVersionText: {
        marginBottom: 8,
    },
    checkFirmwareButton: {
        marginBottom: 12,
    },
    statusHint: {
        opacity: 0.6,
        marginTop: 4,
        fontSize: 12,
    },
    warningText: {
        marginTop: 8,
    },
})
