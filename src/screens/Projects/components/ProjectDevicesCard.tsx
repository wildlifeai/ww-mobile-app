import React, { useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Text, IconButton, Divider, ActivityIndicator, useTheme, TouchableRipple } from 'react-native-paper'
import { Q } from '@nozbe/watermelondb'
import database from '../../../database'
import Deployment from '../../../database/models/Deployment'
import Device from '../../../database/models/Device'
import { useAppNavigation } from '../../../hooks/useAppNavigation'
import { WWIcon } from '../../../components/ui/WWIcon'

interface Props {
    projectId: string
    projectName: string
}

interface DeviceItem {
    id: string
    name: string
    bluetoothId: string
    isActive: boolean
    activeDeploymentId?: string
    lastDeploymentId?: string
}

export const ProjectDevicesCard: React.FC<Props> = ({ projectId, projectName }) => {
    const navigation = useAppNavigation()
    const theme = useTheme()

    const [{ devices, isLoading }, setState] = useState<{
        devices: DeviceItem[]
        isLoading: boolean
    }>({ devices: [], isLoading: true })

    const dynamicStyles = {
        title: { color: theme.colors.onSurface },
        deviceName: { color: theme.colors.onSurface, fontWeight: 'bold' as const },
        deviceMac: { color: theme.colors.onSurfaceVariant },
        emptyText: { color: theme.colors.onSurfaceVariant },
    }

    useEffect(() => {
        let isMounted = true

        const fetchDevices = async () => {
            let nextDevices: DeviceItem[] = []
            try {
                // Find all deployments for this project to get device IDs
                const deployments = await database.get<Deployment>('deployments')
                    .query(Q.where('project_id', projectId))
                    .fetch()

                const deviceIds = new Set([
                    ...deployments.map(d => d.deviceId)
                ])

                if (deviceIds.size > 0) {
                    const uniqueDevices = await database.get<Device>('devices')
                        .query(Q.where('id', Q.oneOf(Array.from(deviceIds))))
                        .fetch()
                        
                    if (isMounted) {
                        const devicesWithStatus: DeviceItem[] = uniqueDevices.map(device => {
                            const deviceDeployments = deployments.filter(d => d.deviceId === device.id)
                            const activeDeployment = deviceDeployments.find(d => !d.deploymentEnd)
                            
                            // Find most recent ended deployment
                            const endedDeployments = deviceDeployments
                                .filter(d => d.deploymentEnd)
                                .sort((a, b) => {
                                    const aEnd = a.deploymentEnd ? new Date(a.deploymentEnd).getTime() : 0
                                    const bEnd = b.deploymentEnd ? new Date(b.deploymentEnd).getTime() : 0
                                    return bEnd - aEnd
                                })

                            return {
                                id: device.id,
                                name: device.name || device.bluetoothId || 'Unknown Device',
                                bluetoothId: device.bluetoothId,
                                isActive: !!activeDeployment,
                                activeDeploymentId: activeDeployment?.id,
                                lastDeploymentId: endedDeployments[0]?.id,
                            }
                        })
                        
                        // Sort so active devices appear first
                        devicesWithStatus.sort((a, b) => {
                            if (a.isActive && !b.isActive) return -1
                            if (!a.isActive && b.isActive) return 1
                            return a.name.localeCompare(b.name)
                        })

                        nextDevices = devicesWithStatus
                    }
                }
            } catch (error) {
                console.error("Failed to fetch project devices:", error)
            } finally {
                if (isMounted) {
                    setState({ devices: nextDevices, isLoading: false })
                }
            }
        }

        fetchDevices()

        return () => {
            isMounted = false
        }
    }, [projectId])

    const handleDevicePress = (device: DeviceItem) => {
        navigation.navigate('DeviceMonitoringSummary', { deviceId: device.id })
    }

    const handleCameraIconPress = (device: DeviceItem) => {
        if (device.isActive && device.activeDeploymentId) {
            navigation.navigate('DeviceMonitoringSummary', { deploymentId: device.activeDeploymentId })
        } else if (device.lastDeploymentId) {
            navigation.navigate('DeviceMonitoringSummary', { deploymentId: device.lastDeploymentId })
        } else {
            navigation.navigate('DeviceMonitoringSummary', { deviceId: device.id })
        }
    }

    const handleSectionPress = () => {
        navigation.navigate('ProjectDevicesScreen', { projectId, projectName })
    }

    return (
        <Card mode="outlined" style={styles.card}>
            <Card.Content>
                <TouchableRipple onPress={handleSectionPress} borderless style={styles.headerTouchable}>
                    <View style={styles.sectionHeader}>
                        <Text
                            variant="titleMedium"
                            style={dynamicStyles.title}
                        >
                            Wildlife Watchers ({devices.length})
                        </Text>
                        <IconButton
                            icon="eye"
                            size={24}
                            onPress={handleSectionPress}
                            testID="view-devices-button"
                        />
                    </View>
                </TouchableRipple>

                <Divider style={styles.divider} />

                {isLoading ? (
                    <ActivityIndicator size="small" />
                ) : devices.length > 0 ? (
                    <View style={styles.devicesList}>
                        {devices.slice(0, 5).map((device) => (
                            <TouchableRipple
                                key={device.id}
                                onPress={() => handleDevicePress(device)}
                                borderless
                                style={styles.deviceTouchable}
                            >
                                <View style={styles.deviceListItem}>
                                    <View style={styles.deviceInfo}>
                                        <TouchableRipple
                                            onPress={() => handleCameraIconPress(device)}
                                            borderless
                                            style={styles.iconTouchable}
                                        >
                                            <View style={styles.iconContainer}>
                                                <WWIcon source="camera" size={24} color={device.isActive ? '#4CAF50' : '#9E9E9E'} />
                                            </View>
                                        </TouchableRipple>
                                        <View style={styles.deviceDetails}>
                                            <Text variant="bodyMedium" style={dynamicStyles.deviceName}>
                                                {device.name}
                                            </Text>
                                        </View>
                                    </View>
                                    <WWIcon source="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
                                </View>
                            </TouchableRipple>
                        ))}
                    </View>
                ) : (
                    <Text variant="bodyMedium" style={dynamicStyles.emptyText}>
                        No devices associated with this project.
                    </Text>
                )}
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 16,
    },
    headerTouchable: {
        borderRadius: 8,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        minHeight: 40,
    },
    divider: {
        marginBottom: 16,
    },
    devicesList: {
        gap: 4,
    },
    deviceTouchable: {
        borderRadius: 8,
    },
    deviceListItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    deviceInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
    },
    deviceDetails: {
        flex: 1,
    },
    iconTouchable: {
        borderRadius: 20,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
})
