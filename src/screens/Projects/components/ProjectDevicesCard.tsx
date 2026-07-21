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
                        // Pre-group deployments by deviceId for O(1) lookup
                        const deploymentsByDeviceId = new Map<string, { active?: Deployment; lastEnded?: Deployment }>()
                        for (const d of deployments) {
                            const entry = deploymentsByDeviceId.get(d.deviceId) || {}
                            if (!d.deploymentEnd) {
                                entry.active = d
                            } else if (
                                !entry.lastEnded ||
                                new Date(d.deploymentEnd).getTime() > new Date(entry.lastEnded.deploymentEnd!).getTime()
                            ) {
                                entry.lastEnded = d
                            }
                            deploymentsByDeviceId.set(d.deviceId, entry)
                        }

                        const devicesWithStatus: DeviceItem[] = uniqueDevices.map(device => {
                            const grouped = deploymentsByDeviceId.get(device.id)

                            return {
                                id: device.id,
                                name: device.name || device.bluetoothId || 'Unknown Device',
                                bluetoothId: device.bluetoothId,
                                isActive: !!grouped?.active,
                                activeDeploymentId: grouped?.active?.id,
                                lastDeploymentId: grouped?.lastEnded?.id,
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
                <View style={styles.sectionHeader}>
                    <TouchableRipple onPress={handleSectionPress} borderless style={styles.headerTitleTouchable}>
                        <Text
                            variant="titleMedium"
                            style={dynamicStyles.title}
                        >
                            Wildlife Watchers ({devices.length})
                        </Text>
                    </TouchableRipple>
                    <IconButton
                        icon="eye"
                        size={24}
                        onPress={handleSectionPress}
                        testID="view-devices-button"
                    />
                </View>

                <Divider style={styles.divider} />

                {isLoading ? (
                    <ActivityIndicator size="small" />
                ) : devices.length > 0 ? (
                    <View style={styles.devicesList}>
                        {devices.slice(0, 5).map((device) => (
                            <View
                                key={device.id}
                                style={styles.deviceListItem}
                            >
                                <TouchableRipple
                                    onPress={() => handleCameraIconPress(device)}
                                    borderless
                                    style={styles.iconTouchable}
                                >
                                    <View style={styles.iconContainer}>
                                        <WWIcon source="camera" size={24} color={device.isActive ? '#4CAF50' : '#9E9E9E'} />
                                    </View>
                                </TouchableRipple>
                                <TouchableRipple
                                    onPress={() => handleDevicePress(device)}
                                    borderless
                                    style={styles.deviceDetailsTouchable}
                                >
                                    <View style={styles.deviceDetails}>
                                        <Text variant="bodyMedium" style={dynamicStyles.deviceName}>
                                            {device.name}
                                        </Text>
                                    </View>
                                </TouchableRipple>
                                <WWIcon source="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
                            </View>
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
    headerTitleTouchable: {
        flex: 1,
        borderRadius: 8,
        justifyContent: 'center',
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
    deviceDetailsTouchable: {
        flex: 1,
        borderRadius: 8,
    },
    deviceListItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 8,
        paddingHorizontal: 4,
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
