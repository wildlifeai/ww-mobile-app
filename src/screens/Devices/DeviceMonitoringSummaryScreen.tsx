/**
 * DeviceMonitoringSummaryScreen
 * 
 * Consolidated screen replacing DeviceDetailsScreen + DeploymentDetailsScreen.
 * Shows device info + active deployment summary OR last deployment summary
 * OR "no monitoring information" text. Includes "Connect to Device" button.
 * 
 * Accepts either deviceId or deploymentId (resolves device from deployment).
 */

import { useState, useEffect, useCallback, useMemo, useLayoutEffect } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Card, useTheme, Text } from 'react-native-paper'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWText } from '../../components/ui/WWText'
import { WWButton } from '../../components/ui/WWButton'
import { WWIcon } from '../../components/ui/WWIcon'
import { DeviceService } from '../../services/DeviceService'
import { DeviceWithStatus } from '../../types/device'
import { useRoute, useNavigation } from '@react-navigation/native'
import database from '../../database'
import Deployment from '../../database/models/Deployment'
import { logError, log } from '../../utils/logger'

import { RootStackParamList } from '../../navigation/types'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'

type ScreenRouteProp = RouteProp<RootStackParamList, 'DeviceMonitoringSummary'>

export const DeviceMonitoringSummaryScreen = () => {
    const route = useRoute<ScreenRouteProp>()
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
    const theme = useTheme()
    const { deviceId: paramDeviceId, deploymentId: paramDeploymentId } = route.params || {}

    const [deviceWithStatus, setDeviceWithStatus] = useState<DeviceWithStatus | undefined>()
    const [loading, setLoading] = useState(true)

    const loadDeviceData = useCallback(async () => {
        let targetId = paramDeviceId

        if (!targetId && paramDeploymentId) {
            try {
                const deployment = await database.get<Deployment>('deployments').find(paramDeploymentId)
                targetId = deployment.deviceId
            } catch (err) {
                logError('Failed to resolve device from deployment:', err)
                setLoading(false)
                return
            }
        }

        if (!targetId) {
            setLoading(false)
            return
        }

        try {
            const details = await DeviceService.getDeviceWithStatus(targetId)
            setDeviceWithStatus(details)
        } catch (error) {
            logError('Error loading device details:', error)
        } finally {
            setLoading(false)
        }
    }, [paramDeviceId, paramDeploymentId])

    useEffect(() => {
        loadDeviceData()
    }, [loadDeviceData])

    // Set title
    useLayoutEffect(() => {
        const deviceName = deviceWithStatus?.device?.name || 'Device'
        navigation.setOptions({ title: deviceName })
    }, [navigation, deviceWithStatus?.device?.name])

    const handleConnectToDevice = useCallback(() => {
        log('[DeviceMonitoringSummary] Navigating to scanner')
        navigation.navigate('DeviceDiscovery', { mode: 'auto' })
        // Hide the stack header so only the scanner's internal header shows
        navigation.setOptions({ headerShown: false })
    }, [navigation])

    // Date/duration helpers
    const isValidDate = (date: any) => {
        if (!date) return false
        const d = new Date(date)
        return !isNaN(d.getTime()) && d.getTime() > 946684800000
    }

    const formatDuration = (start: any, end: any) => {
        if (!isValidDate(start)) return '--'
        const startDate = new Date(start)
        const endDate = isValidDate(end) ? new Date(end) : new Date()
        const diffMs = endDate.getTime() - startDate.getTime()
        if (diffMs < 0) return '--'

        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

        if (days > 0) return `${days} day${days !== 1 ? 's' : ''} and ${hours} hour${hours !== 1 ? 's' : ''}`
        return `${hours} hour${hours !== 1 ? 's' : ''}`
    }

    const formatDate = (date: any) => {
        if (!isValidDate(date)) return 'Unknown'
        return new Date(date).toLocaleDateString()
    }

    // Dynamic styles
    const dynamicStyles = useMemo(() => ({
        label: { color: theme.colors.onSurfaceVariant },
        value: { color: theme.colors.onSurface, fontWeight: '600' as const },
        emptyText: { color: theme.colors.onSurfaceVariant },
        statusActive: { color: '#4CAF50', fontWeight: '600' as const },
        statusEnded: { color: theme.colors.onSurfaceVariant, fontWeight: '600' as const },
    }), [theme])

    // Loading
    if (loading) {
        return (
            <WWScreenView>
                <View style={styles.centerContainer}>
                    <WWText variant="bodyMedium"><Text>Loading device details…</Text></WWText>
                </View>
            </WWScreenView>
        )
    }

    // Not found
    if (!deviceWithStatus) {
        return (
            <WWScreenView>
                <View style={styles.centerContainer}>
                    <WWIcon source="alert-circle-outline" size={48} color={theme.colors.onSurfaceVariant} />
                    <WWText variant="titleMedium" style={styles.emptyTitle}><Text>Device Not Found</Text></WWText>
                    <WWText variant="bodyMedium" style={[styles.emptyMessage, dynamicStyles.emptyText]}>
                        <Text>The requested device could not be found.</Text>
                    </WWText>
                    <WWButton mode="contained" onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text>Go Back</Text>
                    </WWButton>
                </View>
            </WWScreenView>
        )
    }

    const { device, status, activeDeployment, lastDeployment } = deviceWithStatus
    const isActive = status === 'deployed' && !!activeDeployment
    const displayDeployment = isActive ? activeDeployment : lastDeployment

    return (
        <WWScreenView style={styles.screenView}>
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>

                {/* Deployment Info */}
                {displayDeployment ? (
                    <Card mode="outlined" style={styles.card}>
                        <Card.Content>
                            {/* Status label */}
                            <View style={styles.statusLabelRow}>
                                <WWIcon
                                    source={isActive ? 'camera' : 'history'}
                                    size={20}
                                    color={isActive ? '#4CAF50' : theme.colors.onSurfaceVariant}
                                />
                                <Text
                                    variant="titleSmall"
                                    style={[
                                        styles.statusLabel,
                                        isActive ? dynamicStyles.statusActive : dynamicStyles.statusEnded
                                    ]}
                                >
                                    {isActive ? 'Currently Monitoring' : 'Last Monitoring Session'}
                                </Text>
                            </View>

                            {/* Location */}
                            <View style={styles.infoRow}>
                                <Text variant="bodyMedium" style={dynamicStyles.label}>Location</Text>
                                <Text variant="bodyMedium" style={dynamicStyles.value}>
                                    {displayDeployment.locationName || 'Unknown'}
                                </Text>
                            </View>

                            {/* Duration */}
                            <View style={styles.infoRow}>
                                <Text variant="bodyMedium" style={dynamicStyles.label}>
                                    {isActive ? 'Active for' : 'Duration'}
                                </Text>
                                <Text variant="bodyMedium" style={dynamicStyles.value}>
                                    {formatDuration(displayDeployment.deploymentStart, displayDeployment.deploymentEnd)}
                                </Text>
                            </View>

                            {/* Start date */}
                            <View style={styles.infoRow}>
                                <Text variant="bodyMedium" style={dynamicStyles.label}>Started</Text>
                                <Text variant="bodyMedium" style={dynamicStyles.value}>
                                    {formatDate(displayDeployment.deploymentStart)}
                                </Text>
                            </View>

                            {/* End date (only for ended deployments) */}
                            {!isActive && displayDeployment.deploymentEnd && (
                                <View style={styles.infoRow}>
                                    <Text variant="bodyMedium" style={dynamicStyles.label}>Ended</Text>
                                    <Text variant="bodyMedium" style={dynamicStyles.value}>
                                        {formatDate(displayDeployment.deploymentEnd)}
                                    </Text>
                                </View>
                            )}
                        </Card.Content>
                    </Card>
                ) : (
                    <Card mode="outlined" style={styles.card}>
                        <Card.Content style={styles.emptyContent}>
                            <WWIcon source="camera-off" size={40} color={theme.colors.onSurfaceVariant} />
                            <Text variant="bodyMedium" style={[styles.emptyDeploymentText, dynamicStyles.emptyText]}>
                                No monitoring information associated with this device.
                            </Text>
                        </Card.Content>
                    </Card>
                )}

                {/* Connect to Device button */}
                <View style={styles.footer}>
                    <WWButton
                        mode="contained"
                        onPress={handleConnectToDevice}
                        style={styles.connectButton}
                        icon="bluetooth-connect"
                    >
                        <Text>Connect to {device.name || 'Device'}</Text>
                    </WWButton>
                </View>
            </ScrollView>
        </WWScreenView>
    )
}

const styles = StyleSheet.create({
    screenView: {
        paddingTop: 0,
    },
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
        paddingBottom: 32,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyTitle: {
        marginTop: 16,
        marginBottom: 8,
        fontWeight: '600',
    },
    emptyMessage: {
        marginBottom: 24,
        textAlign: 'center',
    },
    backButton: {
        marginTop: 8,
    },
    card: {
        marginBottom: 16,
    },
    statusLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    statusLabel: {
        fontWeight: '600',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    emptyContent: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 12,
    },
    emptyDeploymentText: {
        textAlign: 'center',
        maxWidth: 280,
    },
    footer: {
        marginTop: 8,
    },
    connectButton: {
        borderRadius: 12,
        paddingVertical: 6,
    },
})
