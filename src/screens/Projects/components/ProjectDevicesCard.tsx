import React, { useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Text, IconButton, Divider, ActivityIndicator, useTheme } from 'react-native-paper'
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

export const ProjectDevicesCard: React.FC<Props> = ({ projectId, projectName }) => {
    const navigation = useAppNavigation()
    const theme = useTheme()

    const [{ devices, isLoading }, setState] = useState<{
        devices: (Device & { isActive?: boolean })[]
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
            let nextDevices: any[] = []
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
                        const devicesWithStatus = uniqueDevices.map(device => {
                            const isActive = deployments.some(d => d.deviceId === device.id && !d.deploymentEnd)
                            return {
                                id: device.id,
                                name: device.name,
                                bluetoothId: device.bluetoothId,
                                isActive,
                            }
                        })
                        
                        // Sort so active devices appear first
                        devicesWithStatus.sort((a, b) => {
                            if (a.isActive && !b.isActive) return -1
                            if (!a.isActive && b.isActive) return 1
                            const nameA = a.name || a.bluetoothId || 'Unknown Device'
                            const nameB = b.name || b.bluetoothId || 'Unknown Device'
                            return nameA.localeCompare(nameB)
                        })

                        nextDevices = devicesWithStatus
                    }
                }
            } catch (error) {
                console.error("Failed to fetch project devices:", error)
            } finally {
                if (isMounted) {
                    setState({ devices: nextDevices as any, isLoading: false })
                }
            }
        }

        fetchDevices()

        return () => {
            isMounted = false
        }
    }, [projectId])

    return (
        <Card mode="outlined" style={styles.card}>
            <Card.Content>
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
                        onPress={() => {
                            navigation.navigate("ProjectDevicesScreen", {
                                projectId,
                                projectName,
                            })
                        }}
                        testID="view-devices-button"
                    />
                </View>

                <Divider style={styles.divider} />

                {isLoading ? (
                    <ActivityIndicator size="small" />
                ) : devices.length > 0 ? (
                    <View style={styles.devicesList}>
                        {devices.slice(0, 5).map((device) => (
                            <View key={device.id} style={styles.deviceListItem}>
                                <View style={styles.deviceInfo}>
                                    <View style={styles.iconContainer}>
                                        <WWIcon source="camera" size={24} color={device.isActive ? '#4CAF50' : '#9E9E9E'} />
                                    </View>
                                    <View style={styles.deviceDetails}>
                                        <Text variant="bodyMedium" style={dynamicStyles.deviceName}>
                                            {device.name}
                                        </Text>
                                    </View>
                                </View>
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
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        minHeight: 40,
        marginBottom: 8,
    },
    divider: {
        marginBottom: 16,
    },
    devicesList: {
        gap: 16,
    },
    deviceListItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
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
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
})
