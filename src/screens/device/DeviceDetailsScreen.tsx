import React, { useState, useEffect } from 'react'
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWText } from '../../components/ui/WWText'
import { DeviceStatusBadge } from '../../components/DeviceStatusBadge'
import { DeviceService } from '../../services/DeviceService'
import { DeviceWithStatus } from '../../types/device'
import { useRoute, useNavigation } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'

type DeviceDetailsRouteProp = RouteProp<{ params: { deviceId: string } }, 'params'>

export const DeviceDetailsScreen = () => {
    const route = useRoute<DeviceDetailsRouteProp>()
    const navigation = useNavigation()
    const { deviceId } = route.params

    const [deviceWithStatus, setDeviceWithStatus] = useState<DeviceWithStatus | undefined>()
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadDeviceDetails()
    }, [deviceId])

    const loadDeviceDetails = async () => {
        try {
            const details = await DeviceService.getDeviceWithStatus(deviceId)
            setDeviceWithStatus(details)
        } catch (error) {
            console.error('Error loading device details:', error)
            Alert.alert('Error', 'Failed to load device details')
        } finally {
            setLoading(false)
        }
    }

    const handlePrepareAndTest = () => {
        Alert.alert(
            'Coming Soon',
            'Prepare & Test workflow will be available in the next update.',
            [{ text: 'OK' }]
        )
    }

    const handleViewDeployment = () => {
        if (deviceWithStatus?.activeDeployment) {
            // Navigate to deployment details
            Alert.alert('Navigate', `Would navigate to deployment: ${deviceWithStatus.activeDeployment.id}`)
        }
    }

    if (loading) {
        return (
            <WWScreenView>
                <View style={styles.loadingContainer}>
                    <WWText variant="bodyMedium">Loading device details...</WWText>
                </View>
            </WWScreenView>
        )
    }

    if (!deviceWithStatus) {
        return (
            <WWScreenView>
                <View style={styles.errorContainer}>
                    <WWText variant="titleMedium">Device Not Found</WWText>
                    <WWText variant="bodyMedium" style={styles.errorText}>
                        The requested device could not be found.
                    </WWText>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <WWText variant="labelMedium" style={styles.backButtonText}>
                            Go Back
                        </WWText>
                    </TouchableOpacity>
                </View>
            </WWScreenView>
        )
    }

    const { device, status, activeDeployment, preparedDate } = deviceWithStatus

    return (
        <WWScreenView>
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Header Section */}
                <View style={styles.section}>
                    <WWText variant="titleLarge" style={styles.deviceName}>
                        {device.name}
                    </WWText>
                    <DeviceStatusBadge status={status} />
                </View>

                {/* Device Info Section */}
                <View style={styles.infoSection}>
                    <WWText variant="titleSmall" style={styles.sectionTitle}>
                        Device Information
                    </WWText>

                    <View style={styles.infoRow}>
                        <WWText variant="bodySmall" style={styles.label}>Bluetooth ID:</WWText>
                        <WWText variant="bodyMedium" style={styles.value}>{device.bluetoothId}</WWText>
                    </View>

                    {device.firmwareId && (
                        <View style={styles.infoRow}>
                            <WWText variant="bodySmall" style={styles.label}>Firmware:</WWText>
                            <WWText variant="bodyMedium" style={styles.value}>{device.firmwareId}</WWText>
                        </View>
                    )}

                    {device.batteryLevel && (
                        <View style={styles.infoRow}>
                            <WWText variant="bodySmall" style={styles.label}>Battery Level:</WWText>
                            <WWText variant="bodyMedium" style={styles.value}>🔋 {device.batteryLevel}%</WWText>
                        </View>
                    )}

                    {preparedDate && (
                        <View style={styles.infoRow}>
                            <WWText variant="bodySmall" style={styles.label}>Last Prepared:</WWText>
                            <WWText variant="bodyMedium" style={styles.value}>
                                {new Date(preparedDate).toLocaleDateString()} at {new Date(preparedDate).toLocaleTimeString()}
                            </WWText>
                        </View>
                    )}
                </View>

                {/* Current Status Section */}
                {status === 'deployed' && activeDeployment && (
                    <View style={styles.statusSection}>
                        <WWText variant="titleSmall" style={styles.sectionTitle}>
                            Current Deployment
                        </WWText>
                        <TouchableOpacity
                            style={styles.deploymentCard}
                            onPress={handleViewDeployment}
                            activeOpacity={0.7}
                        >
                            <WWText variant="titleMedium">{activeDeployment.name || 'Unnamed Deployment'}</WWText>
                            <WWText variant="bodySmall" style={styles.deploymentDate}>
                                Started: {new Date(activeDeployment.deploymentStart).toLocaleDateString()}
                            </WWText>
                            <WWText variant="bodySmall" style={styles.viewDetailsLink}>
                                View Details →
                            </WWText>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Deployment History Section */}
                <View style={styles.historySection}>
                    <WWText variant="titleSmall" style={styles.sectionTitle}>
                        Deployment History
                    </WWText>
                    <WWText variant="bodySmall" style={styles.comingSoon}>
                        Deployment history will be displayed here
                    </WWText>
                </View>

                {/* Actions */}
                {status !== 'deployed' && (
                    <View style={styles.actionsSection}>
                        <TouchableOpacity
                            style={styles.prepareButton}
                            onPress={handlePrepareAndTest}
                            activeOpacity={0.8}
                        >
                            <WWText variant="labelLarge" style={styles.prepareButtonText}>
                                {status === 'prepared' ? '🔄 Re-prepare Device' : '⚙️ Prepare and Test Device'}
                            </WWText>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </WWScreenView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    errorText: {
        marginTop: 12,
        marginBottom: 24,
        textAlign: 'center',
        color: '#6B7280',
    },
    backButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 8,
        paddingHorizontal: 24,
        paddingVertical: 12,
    },
    backButtonText: {
        color: '#FFFFFF',
    },
    section: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    deviceName: {
        flex: 1,
        marginRight: 12,
    },
    infoSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    sectionTitle: {
        marginBottom: 12,
        fontWeight: '600',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    label: {
        color: '#6B7280',
        flex: 1,
    },
    value: {
        flex: 2,
        textAlign: 'right',
    },
    statusSection: {
        marginBottom: 16,
    },
    deploymentCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    deploymentDate: {
        color: '#6B7280',
        marginTop: 4,
    },
    viewDetailsLink: {
        color: '#3B82F6',
        marginTop: 8,
        fontWeight: '500',
    },
    historySection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    comingSoon: {
        color: '#9CA3AF',
        fontStyle: 'italic',
    },
    actionsSection: {
        marginTop: 8,
    },
    prepareButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    prepareButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
})
