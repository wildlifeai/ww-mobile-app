import { useState, useCallback, useEffect, useMemo, useLayoutEffect } from 'react'
import { View, FlatList, StyleSheet, RefreshControl, Alert } from 'react-native'
import { Text, useTheme, ActivityIndicator, Card, TouchableRipple } from 'react-native-paper'
import { useRoute } from '@react-navigation/native'
import { Q } from '@nozbe/watermelondb'
import database from '../../database'
import Deployment from '../../database/models/Deployment'
import Device from '../../database/models/Device'
import { WWIcon } from '../../components/ui/WWIcon'
import { AppParams } from '../../navigation/types'
import { useAppNavigation } from '../../hooks/useAppNavigation'

interface ProjectDevice {
    id: string
    bluetoothId: string
    name: string
    isActive: boolean
    activeDeploymentId?: string
    activeDeploymentLocationName?: string
    lastDeploymentId?: string
}

export const ProjectDevicesScreen = () => {
    const route = useRoute<AppParams<"ProjectDevicesScreen">>()
    const navigation = useAppNavigation()
    const theme = useTheme()
    const { projectId, projectName } = route.params

    useLayoutEffect(() => {
        navigation.setOptions({
            title: `Project ${projectName}`,
            headerTitleAlign: 'center',
            headerBackTitleVisible: false
        })
    }, [navigation, projectName, theme.colors.onSurface, theme.colors.onSurfaceVariant])

    const dynamicStyles = useMemo(() => ({
        activeText: { color: '#4CAF50' },
        inactiveText: { color: theme.colors.onSurfaceVariant },
        deviceName: { color: theme.colors.onSurface },
        mapButtonText: { color: '#4CAF50', marginLeft: 2 },
        loadingText: { color: theme.colors.onSurfaceVariant },
        emptyTitle: { color: theme.colors.onSurface },
        emptyMessage: { color: theme.colors.onSurfaceVariant },
    }), [theme])

    const [devices, setDevices] = useState<ProjectDevice[]>([])
    const [loading, setLoading] = useState(true)

    const loadDevices = useCallback(async () => {
        try {
            setLoading(true)

            // Find all deployments for this project
            const deployments = await database.get<Deployment>('deployments')
                .query(Q.where('project_id', projectId))
                .fetch()

            const deviceIds = new Set(deployments.map(d => d.deviceId))

            if (deviceIds.size > 0) {
                // Pre-group deployments by deviceId for O(1) lookup per device
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

                const uniqueDevices = await database.get<Device>('devices')
                    .query(Q.where('id', Q.oneOf(Array.from(deviceIds))))
                    .fetch()

                const listItems: ProjectDevice[] = uniqueDevices.map((device) => {
                    const grouped = deploymentsByDeviceId.get(device.id)

                    return {
                        id: device.id,
                        bluetoothId: device.bluetoothId,
                        name: device.name || 'Unknown Device',
                        isActive: !!grouped?.active,
                        activeDeploymentId: grouped?.active?.id,
                        activeDeploymentLocationName: grouped?.active?.locationName || 'Unknown Location',
                        lastDeploymentId: grouped?.lastEnded?.id,
                    }
                })

                // Sort: active devices first, then alphabetically
                listItems.sort((a, b) => {
                    if (a.isActive && !b.isActive) return -1
                    if (!a.isActive && b.isActive) return 1
                    return a.name.localeCompare(b.name)
                })

                setDevices(listItems)
            } else {
                setDevices([])
            }
        } catch (error) {
            console.error('Error loading project devices:', error)
            Alert.alert('Error', 'Failed to load project devices')
            setDevices([])
        } finally {
            setLoading(false)
        }
    }, [projectId])

    useEffect(() => {
        loadDevices()
    }, [loadDevices])

    const handleDevicePress = useCallback((item: ProjectDevice) => {
        navigation.navigate('DeviceMonitoringSummary', { deviceId: item.id })
    }, [navigation])

    const handleCameraIconPress = useCallback((item: ProjectDevice) => {
        if (item.isActive && item.activeDeploymentId) {
            navigation.navigate('DeviceMonitoringSummary', { deploymentId: item.activeDeploymentId })
        } else if (item.lastDeploymentId) {
            navigation.navigate('DeviceMonitoringSummary', { deploymentId: item.lastDeploymentId })
        } else {
            navigation.navigate('DeviceMonitoringSummary', { deviceId: item.id })
        }
    }, [navigation])

    const renderDeviceItem = useCallback(({ item }: { item: ProjectDevice }) => (
        <Card mode="outlined" style={styles.card}>
            <Card.Content style={styles.cardContent}>
                <View style={styles.deviceRow}>
                    {/* Status Icon — navigates to deployment */}
                    <TouchableRipple
                        onPress={() => handleCameraIconPress(item)}
                        borderless
                        style={styles.iconTouchable}
                    >
                        <View>
                            <WWIcon
                                source="camera"
                                size={22}
                                color={item.isActive ? '#4CAF50' : theme.colors.onSurfaceVariant}
                            />
                        </View>
                    </TouchableRipple>

                    {/* Device Info — navigates to device summary */}
                    <TouchableRipple
                        onPress={() => handleDevicePress(item)}
                        borderless
                        style={styles.deviceInfoTouchable}
                    >
                        <View style={styles.deviceInfo}>
                            <Text
                                variant="titleMedium"
                                style={[styles.deviceName, dynamicStyles.deviceName]}
                                numberOfLines={1}
                            >
                                {item.name && item.name !== 'Unknown Device' ? item.name : item.bluetoothId}
                            </Text>
                            {item.isActive && item.activeDeploymentLocationName && (
                                <Text
                                    variant="bodySmall"
                                    style={dynamicStyles.activeText}
                                >
                                    Deployed at {item.activeDeploymentLocationName}
                                </Text>
                            )}
                            {!item.isActive && (
                                <Text
                                    variant="bodySmall"
                                    style={dynamicStyles.inactiveText}
                                >
                                    not deployed
                                </Text>
                            )}
                        </View>
                    </TouchableRipple>

                    {/* View on Map action (active only) */}
                    {item.isActive && (
                        <TouchableRipple
                            onPress={() => navigation.navigate('Home', { initialTab: 'maps', selectedDeploymentId: item.activeDeploymentId })}
                            style={styles.mapButton}
                            borderless
                        >
                            <View style={styles.mapButtonInner}>
                                <WWIcon source="map-marker" size={18} color="#4CAF50" />
                                <Text variant="labelSmall" style={dynamicStyles.mapButtonText}>
                                    Map
                                </Text>
                            </View>
                        </TouchableRipple>
                    )}

                    {/* Chevron */}
                    <WWIcon source="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
                </View>
            </Card.Content>
        </Card>
    ), [theme, navigation, dynamicStyles, handleDevicePress, handleCameraIconPress])

    // Loading
    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" />
                <Text variant="bodyMedium" style={[styles.loadingText, dynamicStyles.loadingText]}>
                    Loading devices...
                </Text>
            </View>
        )
    }

    // Empty state
    if (devices.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <WWIcon source="camera-off" size={48} color={theme.colors.onSurfaceVariant} />
                <Text variant="titleMedium" style={[styles.emptyTitle, dynamicStyles.emptyTitle]}>
                    No devices found
                </Text>
                <Text variant="bodyMedium" style={[styles.emptyMessage, dynamicStyles.emptyMessage]}>
                    There are no devices associated with {projectName}.
                </Text>
            </View>
        )
    }

    return (
        <FlatList
            data={devices}
            renderItem={renderDeviceItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
                <RefreshControl
                    refreshing={false}
                    onRefresh={loadDevices}
                    colors={[theme.colors.primary]}
                    tintColor={theme.colors.primary}
                />
            }
        />
    )
}

const styles = StyleSheet.create({
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
    },
    emptyTitle: {
        marginTop: 16,
        marginBottom: 8,
        fontWeight: '600',
    },
    emptyMessage: {
        textAlign: 'center',
        maxWidth: 280,
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
    },
    card: {
        marginBottom: 12,
    },
    cardContent: {
        paddingVertical: 12,
    },
    deviceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    deviceInfo: {
        flex: 1,
    },
    deviceInfoTouchable: {
        flex: 1,
        borderRadius: 8,
    },
    deviceName: {
        fontWeight: '600',
    },
    iconTouchable: {
        borderRadius: 16,
        padding: 4,
    },
    mapButton: {
        borderRadius: 8,
        padding: 8,
    },
    mapButtonInner: {
        flexDirection: 'row',
        alignItems: 'center',
    },
})
