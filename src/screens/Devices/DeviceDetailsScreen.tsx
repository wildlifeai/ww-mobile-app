import { useState, useEffect, useCallback } from 'react'
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { Card, useTheme, Text } from 'react-native-paper'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWText } from '../../components/ui/WWText'
import { DeviceStatusBadge } from '../../components/DeviceStatusBadge'
import { DeviceService } from '../../services/DeviceService'
import { DeviceWithStatus } from '../../types/device'
import { useRoute, useNavigation } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import Deployment from '../../database/models/Deployment'
import { WWIcon } from '../../components/ui/WWIcon'
import { WWButton } from '../../components/ui/WWButton'

type DeviceDetailsRouteProp = RouteProp<{ params: { deviceId: string } }, 'params'>

import { RootStackParamList } from '../../navigation/types'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { logError } from '../../utils/logger'


export const DeviceDetailsScreen = () => {
    const route = useRoute<DeviceDetailsRouteProp>()
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
    const theme = useTheme()
    const { deviceId } = route.params

    const [deviceWithStatus, setDeviceWithStatus] = useState<DeviceWithStatus | undefined>()
    const [deploymentHistory, setDeploymentHistory] = useState<Deployment[]>([])
    const [loading, setLoading] = useState(true)

    const loadDeviceDetails = useCallback(async () => {
        try {
            const [details, history] = await Promise.all([
                DeviceService.getDeviceWithStatus(deviceId),
                DeviceService.getDeviceDeploymentHistory(deviceId)
            ])
            setDeviceWithStatus(details)
            setDeploymentHistory(history)
        } catch (error) {
            logError('Error loading device details:', error)
            Alert.alert('Error', 'Failed to load device details')
        } finally {
            setLoading(false)
        }
    }, [deviceId])

    useEffect(() => {
        loadDeviceDetails()
    }, [loadDeviceDetails])

    const handleConnectToDevice = () => {
        (navigation as any).navigate('Home', { initialTab: 'devices' })
    }

    const handleViewDeployment = (deploymentId: string) => {
        // Navigate to deployment details
        navigation.navigate('DeploymentDetails', { deploymentId })
    }

    if (loading) {
        return (
            <WWScreenView>
                <View style={styles.loadingContainer}>
                    <WWText variant="bodyMedium"><Text>Loading device details...</Text></WWText>
                </View>
            </WWScreenView>
        )
    }

    if (!deviceWithStatus) {
        return (
            <WWScreenView>
                <View style={styles.errorContainer}>
                    <WWText variant="titleMedium"><Text>Device Not Found</Text></WWText>
                    <WWText variant="bodyMedium" style={styles.errorText}>
                        <Text>The requested device could not be found.</Text>
                    </WWText>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <WWText variant="labelMedium" style={styles.backButtonText}>
                            <Text>Go Back</Text>
                        </WWText>
                    </TouchableOpacity>
                </View>
            </WWScreenView>
        )
    }


    const { device, status, activeDeployment } = deviceWithStatus

    const isValidDate = (date: any) => {
        if (!date) return false
        const d = new Date(date)
        return !isNaN(d.getTime()) && d.getTime() > 946684800000 // > Year 2000
    }

    const getDurationString = (start: any, end: any) => {
        if (!isValidDate(start)) return ''
        const startDate = new Date(start)
        const endDate = isValidDate(end) ? new Date(end) : new Date()
        const diffMs = endDate.getTime() - startDate.getTime()
        if (diffMs < 0) return ''

        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

        if (days > 0) return `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`
        if (hours > 0) return `${hours} hr ${minutes} min${minutes !== 1 ? 's' : ''}`
        return `${minutes} min${minutes !== 1 ? 's' : ''}`
    }

    return (
        <WWScreenView style={styles.screenView}>
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Device Overview Card */}
                <Card mode="outlined" style={styles.card}>
                    <Card.Content style={styles.deviceHeaderCard}>
                        <View style={styles.headerInfo}>
                            <WWText variant="titleLarge" style={styles.deviceName}>
                                {device.name}
                            </WWText>
                            <DeviceStatusBadge status={status} />
                        </View>
                        
                        <View style={styles.headerSeparator} />

                        <View style={styles.infoRow}>
                            <WWText variant="bodySmall" style={styles.label}><Text>Bluetooth ID:</Text></WWText>
                            <WWText variant="bodyMedium" style={styles.headerValue}>
                                {device.bluetoothId ? device.bluetoothId : 'N/A'}
                            </WWText>
                        </View>
                    </Card.Content>
                </Card>


                {/* Current Status Section */}
                {status === 'deployed' && activeDeployment && (
                    <Card mode="outlined" style={styles.card} onPress={() => handleViewDeployment(activeDeployment.id)}>
                        <Card.Content>
                            <WWText variant="titleSmall" style={styles.sectionTitle}>
                                <Text>Current Deployment</Text>
                            </WWText>
                            <View style={styles.deploymentCardContent}>
                                <WWText variant="titleMedium"><Text>{activeDeployment.name || 'Unnamed Deployment'}</Text></WWText>
                                <WWText variant="bodySmall" style={styles.deploymentDate}>
                                    <Text>Started: {isValidDate(activeDeployment.deploymentStart) ? new Date(activeDeployment.deploymentStart).toLocaleDateString() : 'Unknown'}</Text>
                                </WWText>
                                <WWText variant="bodySmall" style={styles.deploymentDate}>
                                    <Text>Duration: {getDurationString(activeDeployment.deploymentStart, activeDeployment.deploymentEnd)}</Text>
                                </WWText>
                                <WWText variant="bodySmall" style={styles.viewDetailsLink}>
                                    <Text>View Details →</Text>
                                </WWText>
                            </View>
                        </Card.Content>
                    </Card>
                )}

                {/* Deployment History Section */}
                <Card mode="outlined" style={styles.card}>
                    <Card.Content>
                        <WWText variant="titleSmall" style={styles.sectionTitle}>
                            <Text>Deployment History</Text>
                        </WWText>

                        {deploymentHistory.length === 0 ? (
                            <WWText variant="bodySmall" style={styles.comingSoon}>
                                <Text>No previous deployments found.</Text>
                            </WWText>
                        ) : (
                            deploymentHistory.map((deployment, index) => (
                                <TouchableOpacity
                                    key={deployment.id}
                                    style={[styles.historyItem, index === deploymentHistory.length - 1 && styles.lastHistoryItem]}
                                    onPress={() => handleViewDeployment(deployment.id)}
                                >
                                    <View style={styles.historyItemContent}>
                                        <WWText variant="titleSmall">{deployment.name || 'Unnamed Deployment'}</WWText>
                                        <View style={styles.historyDetailsRow}>
                                            <WWText variant="labelSmall" style={styles.historyDate}>
                                                {isValidDate(deployment.deploymentStart) ? new Date(deployment.deploymentStart).toLocaleDateString() : 'Unknown Date'}
                                            </WWText>
                                            <WWText variant="labelSmall" style={styles.historyDuration}>
                                                <Text>• {getDurationString(deployment.deploymentStart, deployment.deploymentEnd)}</Text>
                                            </WWText>
                                        </View>
                                    </View>
                                    <WWIcon source="chevron-right" size={20} color={theme.colors.onSurfaceDisabled} />
                                </TouchableOpacity>
                            ))
                        )}
                    </Card.Content>
                </Card>

                {/* Actions */}
                {status !== 'deployed' && (
                    <View style={styles.actionsSection}>
                        <WWButton
                            mode="contained"
                            onPress={handleConnectToDevice}
                            style={styles.prepareButton}
                        >
                            Scan for Device
                        </WWButton>
                    </View>
                )}
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
    deviceName: {
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    headerInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerSeparator: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginVertical: 12,
    },
    deviceHeaderCard: {
        paddingVertical: 16,
    },
    headerValue: {
        color: '#FFFFFF',
        fontWeight: '500',
    },
    section: {
        marginBottom: 8,
    },
    card: {
        marginBottom: 16,
        backgroundColor: 'transparent', // Make card transparent to blend with dark mode if needed, or theme surface
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
        borderBottomColor: 'rgba(255, 255, 255, 0.1)', // Subtle border
    },
    label: {
        color: '#9CA3AF',
        flex: 1,
    },
    value: {
        flex: 1,
        textAlign: 'right',
        color: '#FFFFFF',
    },
    deploymentCardContent: {
        marginTop: 8,
    },
    deploymentDate: {
        color: '#9CA3AF',
        marginTop: 4,
    },
    viewDetailsLink: {
        color: '#3B82F6',
        marginTop: 8,
        fontWeight: '500',
    },
    comingSoon: {
        color: '#9CA3AF',
        fontStyle: 'italic',
    },
    actionsSection: {
        marginTop: 8,
    },
    prepareButton: {
        backgroundColor: '#4CAF50', // Success Green
        borderRadius: 12,
        paddingVertical: 8,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    lastHistoryItem: {
        borderBottomWidth: 0,
    },
    historyItemContent: {
        flex: 1,
    },
    historyDate: {
        color: '#9CA3AF',
        marginTop: 2,
    },
    historyDetailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    historyDuration: {
        color: '#9CA3AF',
        marginLeft: 8,
    },
})
