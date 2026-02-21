import React, { useMemo } from 'react'
import { StyleSheet, View, TouchableOpacity } from 'react-native'
import { Card, Text, useTheme } from 'react-native-paper'
import { DeviceListItem } from '../types/device'
import { WWIcon } from './ui/WWIcon'
import { useNavigation } from '@react-navigation/native'

interface DeviceCardProps {
    device: DeviceListItem
    onPress: () => void
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, onPress }) => {
    const theme = useTheme()
    const navigation = useNavigation()

    // Calculate status message based on user's logic
    const statusInfo = useMemo(() => {
        const prepDate = device.preparedDate ? new Date(device.preparedDate) : null
        const deployEndDate = device.deploymentEndDate ? new Date(device.deploymentEndDate) : null
        const lastDeployDate = device.lastDeploymentDate ? new Date(device.lastDeploymentDate) : null

        // Logic 1: Device preparation after latest deployment
        if (prepDate && device.lastDeploymentDate) {
            const lastDeploy = deployEndDate || lastDeployDate
            if (lastDeploy && prepDate > lastDeploy) {
                return {
                    text: `Prepared on ${prepDate.toLocaleDateString()} at ${prepDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                    color: theme.colors.primary,
                    icon: 'check-circle' as const,
                    hasLink: false
                }
            }
        }

        // Logic 2: Active deployment (no end date)
        // If there is a last deployment date (start) but NO end date, it is active.
        if (!deployEndDate && device.lastDeploymentDate && device.deploymentName) {
            return {
                text: `Device is deployed: ${device.deploymentName}`,
                color: '#4CAF50',
                icon: 'map-marker' as const,
                hasLink: true,
                deploymentId: device.deploymentId
            }
        }

        // Logic 3: Last deployment ended
        if (device.deploymentName && device.lastDeploymentDate && deployEndDate) {
            return {
                text: `Last deployment ${device.deploymentName}`,
                color: theme.colors.onSurfaceVariant,
                icon: 'history' as const,
                hasLink: true,
                deploymentId: device.deploymentId
            }
        }

        // Logic 1 (alternate): Prepared without any deployment
        if (prepDate) {
            return {
                text: `Prepared on ${prepDate.toLocaleDateString()} at ${prepDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                color: theme.colors.primary,
                icon: 'check-circle' as const,
                hasLink: false
            }
        }

        // Default: Needs preparation
        return null
    }, [device, theme])

    const handleStatusPress = () => {
        if (statusInfo?.hasLink && statusInfo.deploymentId) {
            (navigation as any).navigate('DeploymentDetails', { deploymentId: statusInfo.deploymentId })
        }
    }

    return (
        <Card
            mode="outlined"
            style={styles.card}
            onPress={onPress}
            testID={`device-card-${device.id}`}
        >
            <Card.Content style={styles.content}>
                {/* Header: Name only */}
                <View style={styles.header}>
                    <Text
                        variant="headlineSmall"
                        style={[styles.title, { color: theme.colors.onSurface }]}
                        numberOfLines={1}
                    >
                        {device.name || 'Unknown Device'}
                    </Text>
                </View>

                {/* Status Info - Side layout */}
                {statusInfo && (
                    <TouchableOpacity
                        onPress={statusInfo.hasLink ? handleStatusPress : undefined}
                        activeOpacity={statusInfo.hasLink ? 0.7 : 1}
                        disabled={!statusInfo.hasLink}
                    >
                        <View style={styles.statusRow}>
                            <WWIcon
                                source={statusInfo.icon}
                                size={16}
                                color={statusInfo.color}
                                containerStyle={styles.icon}
                            />
                            <Text
                                variant="bodyMedium"
                                style={[
                                    styles.statusText,
                                    { color: statusInfo.color },
                                    statusInfo.hasLink && styles.linkText
                                ]}
                            >
                                {statusInfo.text}
                            </Text>
                            {statusInfo.hasLink && (
                                <WWIcon
                                    source="chevron-right"
                                    size={16}
                                    color={statusInfo.color}
                                />
                            )}
                        </View>
                    </TouchableOpacity>
                )}
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 12,
        marginHorizontal: 16,
    },
    content: {
        paddingVertical: 12,
    },
    header: {
        marginBottom: 4,
    },
    title: {
        fontWeight: '600',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    icon: {
        marginRight: 6,
    },
    statusText: {
        flex: 1,
    },
    linkText: {
        textDecorationLine: 'underline',
    },
})
