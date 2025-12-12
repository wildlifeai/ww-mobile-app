import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Card, Text, useTheme } from 'react-native-paper'
import { DeviceStatusBadge } from './DeviceStatusBadge'
import { DeviceListItem } from '../types/device'
import { WWIcon } from './ui/WWIcon'

interface DeviceCardProps {
    device: DeviceListItem
    onPress: () => void
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, onPress }) => {
    const theme = useTheme()

    return (
        <Card
            mode="outlined"
            style={styles.card}
            onPress={onPress}
            testID={`device-card-${device.id}`}
        >
            <Card.Content style={styles.content}>
                {/* Header: Name and Badge */}
                <View style={styles.header}>
                    <Text
                        variant="headlineSmall"
                        style={[styles.title, { color: theme.colors.onSurface }]}
                        numberOfLines={1}
                    >
                        {device.name || 'Unknown Device'}
                    </Text>
                    <DeviceStatusBadge status={device.status} />
                </View>

                {/* Bluetooth ID */}
                <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}
                >
                    ID: {device.bluetoothId}
                </Text>

                {/* Deployed Info */}
                {device.status === 'deployed' && (
                    <View style={styles.infoSection}>
                        {device.deploymentName && (
                            <View style={styles.row}>
                                <WWIcon
                                    source="map-marker"
                                    size={16}
                                    color={theme.colors.primary}
                                    containerStyle={styles.icon}
                                />
                                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                                    {device.deploymentName}
                                </Text>
                            </View>
                        )}
                        {device.projectName && (
                            <View style={styles.row}>
                                <WWIcon
                                    source="folder"
                                    size={16}
                                    color={theme.colors.onSurfaceVariant}
                                    containerStyle={styles.icon}
                                />
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                    {device.projectName}
                                </Text>
                            </View>
                        )}
                        {device.batteryLevel !== undefined && (
                            <View style={styles.row}>
                                <WWIcon
                                    source={device.batteryLevel > 20 ? 'battery' : 'battery-alert'}
                                    size={16}
                                    color={device.batteryLevel > 20 ? theme.colors.primary : theme.colors.error}
                                    containerStyle={styles.icon}
                                />
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                    {device.batteryLevel}%
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Prepared Info */}
                {device.status === 'prepared' && device.preparedDate && (
                    <View style={styles.row}>
                        <WWIcon
                            source="check-circle"
                            size={16}
                            color={theme.colors.primary}
                            containerStyle={styles.icon}
                        />
                        <Text variant="bodySmall" style={{ color: theme.colors.primary }}>
                            Prepared on {new Date(device.preparedDate).toLocaleDateString()}
                        </Text>
                    </View>
                )}
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 12,
        marginHorizontal: 16,
        elevation: 0,
    },
    content: {
        paddingVertical: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    infoSection: {
        gap: 4,
        marginTop: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    icon: {
        marginRight: 6,
    },
})
