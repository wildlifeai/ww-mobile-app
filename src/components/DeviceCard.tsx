import React from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import { WWText } from './ui/WWText'
import { DeviceStatusBadge } from './DeviceStatusBadge'
import { DeviceListItem } from '../types/device'

interface DeviceCardProps {
    device: DeviceListItem
    onPress: () => void
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, onPress }) => {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.header}>
                <WWText variant="titleMedium" style={styles.deviceName}>
                    {device.name}
                </WWText>
                <DeviceStatusBadge status={device.status} />
            </View>

            <WWText variant="bodySmall" style={styles.bluetoothId}>
                ID: {device.bluetoothId}
            </WWText>

            {/* Deployed device info */}
            {device.status === 'deployed' && (
                <View style={styles.deploymentInfo}>
                    {device.deploymentName && (
                        <WWText variant="bodyMedium" style={styles.deploymentName}>
                            📍 {device.deploymentName}
                        </WWText>
                    )}
                    {device.projectName && (
                        <WWText variant="bodySmall" style={styles.projectName}>
                            Project: {device.projectName}
                        </WWText>
                    )}
                    {device.batteryLevel !== undefined && (
                        <View style={styles.batteryInfo}>
                            <WWText variant="bodySmall">
                                🔋 {device.batteryLevel}%
                            </WWText>
                        </View>
                    )}
                </View>
            )}

            {/* Prepared device info */}
            {device.status === 'prepared' && device.preparedDate && (
                <WWText variant="bodySmall" style={styles.preparedDate}>
                    ✓ Prepared on {new Date(device.preparedDate).toLocaleDateString()}
                </WWText>
            )}
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        marginVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    deviceName: {
        flex: 1,
        marginRight: 12,
    },
    bluetoothId: {
        color: '#6B7280',
        marginBottom: 12,
    },
    deploymentInfo: {
        gap: 4,
    },
    deploymentName: {
        fontWeight: '600',
    },
    projectName: {
        color: '#6B7280',
    },
    batteryInfo: {
        marginTop: 4,
    },
    preparedDate: {
        color: '#10B981',
    },
})
