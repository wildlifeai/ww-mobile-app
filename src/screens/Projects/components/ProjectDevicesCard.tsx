import React, { useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Text, IconButton, Divider, ActivityIndicator, useTheme } from 'react-native-paper'
import { Q } from '@nozbe/watermelondb'
import database from '../../../database'
import DevicePreparation from '../../../database/models/DevicePreparation'
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

    const [devices, setDevices] = useState<Device[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const dynamicStyles = {
        title: { color: theme.colors.onSurface },
        deviceName: { color: theme.colors.onSurface, fontWeight: 'bold' as const },
        deviceMac: { color: theme.colors.onSurfaceVariant },
        emptyText: { color: theme.colors.onSurfaceVariant },
    }

    useEffect(() => {
        let isMounted = true

        const fetchDevices = async () => {
            try {
                // Find all preparations and deployments for this project
                const preparations = await database.get<DevicePreparation>('device_preparation')
                    .query(Q.where('project_id', projectId))
                    .fetch()
                    
                const deployments = await database.get<Deployment>('deployments')
                    .query(Q.where('project_id', projectId))
                    .fetch()

                const deviceIds = new Set([
                    ...preparations.map(p => p.deviceId),
                    ...deployments.map(d => d.deviceId)
                ])

                if (deviceIds.size > 0) {
                    const uniqueDevices = await database.get<Device>('devices')
                        .query(Q.where('id', Q.oneOf(Array.from(deviceIds))))
                        .fetch()
                        
                    if (isMounted) {
                        setDevices(uniqueDevices)
                    }
                } else {
                    if (isMounted) setDevices([])
                }
            } catch (error) {
                console.error("Failed to fetch project devices:", error)
                if (isMounted) setDevices([])
            } finally {
                if (isMounted) setIsLoading(false)
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
                        Devices ({devices.length})
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
                                        <WWIcon source="camera-wireless" size={24} color={theme.colors.primary} />
                                    </View>
                                    <View style={styles.deviceDetails}>
                                        <Text variant="bodyMedium" style={dynamicStyles.deviceName}>
                                            {device.name}
                                        </Text>
                                        <Text variant="bodySmall" style={dynamicStyles.deviceMac}>
                                            {device.bluetoothId}
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
