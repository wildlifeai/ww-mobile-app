
import React, { useLayoutEffect, useMemo } from 'react'
import { View, StyleSheet, ScrollView, Linking, Platform } from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { Appbar, Card, Chip, IconButton, Menu, Divider } from 'react-native-paper'
import { withObservables } from '@nozbe/watermelondb/react'
import { WWScreenView } from '../../../components/ui/WWScreenView'
import { WWText } from '../../../components/ui/WWText'
import { WWButton } from '../../../components/ui/WWButton'
import { WWIcon } from '../../../components/ui/WWIcon'
import { RootStackParamList } from '../../../navigation'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { DeploymentService } from '../../../services/DeploymentService'
import type Deployment from '../../../database/models/Deployment'
import { BasicMapView } from '../../../features/maps/components/BasicMapView'
import { Marker } from 'react-native-maps'
import { useGetCaptureMethodsQuery, useGetActivitySensitivityQuery } from '../../../redux/api/projectsApi'

type DeploymentDetailsRouteProp = RouteProp<RootStackParamList, 'DeploymentDetails'>

interface Props {
    deployment: Deployment
}

const DeploymentDetailsScreenComponent: React.FC<Props> = ({ deployment }) => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
    const [menuVisible, setMenuVisible] = React.useState(false)

    // Queries for lookup data
    const { data: captureMethods } = useGetCaptureMethodsQuery()
    const { data: activitySensitivities } = useGetActivitySensitivityQuery()

    // Status helpers
    const isActive = deployment.deploymentStatusId === 1
    const statusLabel = isActive ? 'Active' : (deployment.deploymentStatusId === 2 ? 'Ended' : 'Failed')
    const statusColor = isActive ? '#4CAF50' : '#FF9800'

    // Lookup names
    const captureMethodName = useMemo(() => {
        if (!deployment.captureMethodId) return 'N/A'
        const cm = captureMethods?.find(c => c.id === deployment.captureMethodId)
        return cm?.value || cm?.description || `Unknown (ID: ${deployment.captureMethodId})`
    }, [deployment.captureMethodId, captureMethods])

    const sensitivityName = useMemo(() => {
        if (!deployment.activityDetectionSensitivityId) return 'N/A'
        const ads = activitySensitivities?.find(a => a.id === deployment.activityDetectionSensitivityId)
        return ads?.value || ads?.description || `Unknown (ID: ${deployment.activityDetectionSensitivityId})`
    }, [deployment.activityDetectionSensitivityId, activitySensitivities])

    // Date helper
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

    // Calculate duration
    const duration = useMemo(() => {
        return getDurationString(deployment.deploymentStart, deployment.deploymentEnd)
    }, [deployment.deploymentStart, deployment.deploymentEnd])

    // Configure header menu
    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                isActive ? (
                    <Menu
                        visible={menuVisible}
                        onDismiss={() => setMenuVisible(false)}
                        anchor={<IconButton icon="dots-vertical" onPress={() => setMenuVisible(true)} />}
                    >
                        <Menu.Item
                            onPress={() => {
                                setMenuVisible(false)
                                navigation.navigate('EndDeploymentWizard', { mode: 'end_deployment' } as any)
                            }}
                            title="End Deployment"
                            leadingIcon="stop"
                        />
                    </Menu>
                ) : null
            ),
        })
    }, [navigation, isActive, menuVisible])

    const openInMaps = () => {
        if (!deployment.latitude || !deployment.longitude) return
        const scheme = Platform.select({ ios: 'maps:', android: 'geo:' })
        const latLng = `${deployment.latitude},${deployment.longitude}`
        const label = deployment.locationName || 'Deployment Location'
        const url = Platform.select({
            ios: `${scheme}?q=${label}&ll=${latLng}`,
            android: `${scheme}${latLng}?q=${label}`
        })
        if (url) Linking.openURL(url)
    }

    if (!deployment) {
        return (
            <WWScreenView>
                <WWText>Deployment not found.</WWText>
            </WWScreenView>
        )
    }

    return (
        <WWScreenView scrollable>
            <View style={styles.container}>
                {/* Hero Card - Status & Overview */}
                <Card mode="outlined" style={styles.heroCard}>
                    <Card.Content>
                        {/* Status Badge */}
                        <View style={styles.statusBadgeContainer}>
                            <Chip
                                icon={isActive ? "circle" : "check-circle"}
                                style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}
                                textStyle={{ color: statusColor, fontWeight: 'bold' }}
                            >
                                {statusLabel}
                            </Chip>
                        </View>

                        {/* Deployment Name */}
                        <WWText variant="headlineMedium" style={styles.deploymentName}>
                            {deployment.name || 'Unnamed Deployment'}
                        </WWText>

                        {/* Project Info */}
                        {deployment.projectId && (
                            <View style={styles.infoRow}>
                                <WWIcon source="folder" size={16} color="#9CA3AF" />
                                <WWText variant="bodyMedium" style={styles.infoText}>
                                    Project ID: {deployment.projectId.slice(0, 8)}...
                                </WWText>
                            </View>
                        )}

                        <Divider style={styles.divider} />

                        {/* Dates & Duration */}
                        <View style={styles.datesGrid}>
                            <View style={styles.dateItem}>
                                <WWText variant="labelMedium" style={styles.label}>Started</WWText>
                                <WWText variant="bodyLarge" style={styles.dateValue}>
                                    {isValidDate(deployment.deploymentStart) ? new Date(deployment.deploymentStart).toLocaleDateString() : 'N/A'}
                                </WWText>
                            </View>
                            {deployment.deploymentEnd && isValidDate(deployment.deploymentEnd) && (
                                <View style={styles.dateItem}>
                                    <WWText variant="labelMedium" style={styles.label}>Ended</WWText>
                                    <WWText variant="bodyLarge" style={styles.dateValue}>
                                        {new Date(deployment.deploymentEnd).toLocaleDateString()}
                                    </WWText>
                                </View>
                            )}
                            <View style={styles.dateItem}>
                                <WWText variant="labelMedium" style={styles.label}>Duration</WWText>
                                <WWText variant="bodyLarge" style={styles.dateValue}>
                                    {duration || '--'}
                                </WWText>
                            </View>
                        </View>
                    </Card.Content>
                </Card>

                {/* Device & Configuration Card */}
                <Card mode="outlined" style={styles.card}>
                    <Card.Title
                        title="Project details"
                        titleStyle={styles.cardTitle}
                        left={(props) => <WWIcon {...props} source="cog" size={24} color="#FFFFFF" />}
                    />
                    <Card.Content>
                        <View style={styles.deviceInfo}>
                            <View style={styles.infoRow}>
                                <WWText variant="labelMedium" style={styles.infoLabel}>Device ID:</WWText>
                                <WWText variant="bodyMedium" style={styles.valueText}>
                                    {deployment.deviceId ? `${deployment.deviceId.slice(0, 18)}...` : 'Unknown'}
                                </WWText>
                            </View>

                            <View style={styles.infoRow}>
                                <WWText variant="labelMedium" style={styles.infoLabel}>Capture Method:</WWText>
                                <WWText variant="bodyMedium" style={styles.valueText}>
                                    {captureMethodName}
                                </WWText>
                            </View>

                            {deployment.captureMethodId === 1 && (
                                <View style={styles.infoRow}>
                                    <WWText variant="labelMedium" style={styles.infoLabel}>Sensitivity:</WWText>
                                    <WWText variant="bodyMedium" style={styles.valueText}>
                                        {sensitivityName}
                                    </WWText>
                                </View>
                            )}
                            {deployment.captureMethodId === 2 && deployment.timelapseIntervalSeconds && (
                                <View style={styles.infoRow}>
                                    <WWText variant="labelMedium" style={styles.infoLabel}>Interval:</WWText>
                                    <WWText variant="bodyMedium" style={styles.valueText}>
                                        {deployment.timelapseIntervalSeconds}s
                                    </WWText>
                                </View>
                            )}
                        </View>

                        <Divider style={styles.smallDivider} />
                        <View style={styles.statusPlaceholder}>
                            <WWIcon source="access-point" size={20} color="#9CA3AF" />
                            <WWText variant="bodySmall" style={styles.placeholderText}>
                                Device status via LoRaWAN
                            </WWText>
                        </View>
                    </Card.Content>
                </Card>

                {/* Location Card */}
                <Card mode="outlined" style={styles.card}>
                    <Card.Title
                        title="Location"
                        titleStyle={styles.cardTitle}
                        left={(props) => <WWIcon {...props} source="map-marker" size={24} color="#FFFFFF" />}
                    />
                    <Card.Content>
                        {deployment.locationName ? (
                            <WWText variant="titleMedium" style={styles.locationName}>
                                {deployment.locationName}
                            </WWText>
                        ) : null}
                        {deployment.latitude && deployment.longitude && (
                            <WWText variant="bodySmall" style={styles.coordinates}>
                                {deployment.latitude.toFixed(6)}, {deployment.longitude.toFixed(6)}
                            </WWText>
                        )}
                    </Card.Content>

                    <View style={styles.mapContainer}>
                        {deployment.latitude && deployment.longitude ? (
                            <View style={styles.map}>
                                <BasicMapView
                                    region={{
                                        latitude: deployment.latitude,
                                        longitude: deployment.longitude,
                                        latitudeDelta: 0.005,
                                        longitudeDelta: 0.005,
                                    }}
                                    config={{ scrollEnabled: false, zoomEnabled: false }}
                                >
                                    <Marker coordinate={{ latitude: deployment.latitude, longitude: deployment.longitude }}>
                                        <View style={styles.customMarker}>
                                            <WWIcon source="camera" size={24} color="#fff" />
                                        </View>
                                    </Marker>
                                </BasicMapView>
                            </View>
                        ) : (
                            <View style={styles.noLocation}>
                                <WWIcon source="map-marker-off" size={48} color="#666" />
                                <WWText style={styles.noLocationText}>No location data available</WWText>
                            </View>
                        )}
                    </View>

                    {deployment.latitude && deployment.longitude && (
                        <Card.Actions>
                            <WWButton mode="text" onPress={openInMaps} icon="directions">
                                Open in Maps
                            </WWButton>
                        </Card.Actions>
                    )}
                </Card>

                {/* Notes & Comments Card */}
                {(deployment.startDeploymentComments || deployment.endDeploymentComments) && (
                    <Card mode="outlined" style={styles.card}>
                        <Card.Title
                            title="Notes & Comments"
                            titleStyle={styles.cardTitle}
                            left={(props) => <WWIcon {...props} source="note-text" size={24} color="#FFFFFF" />}
                        />
                        <Card.Content>
                            {deployment.startDeploymentComments && (
                                <View style={styles.noteSection}>
                                    <WWText variant="labelLarge" style={styles.noteLabel}>
                                        Start Comments
                                    </WWText>
                                    <WWText variant="bodyMedium" style={styles.noteText}>
                                        {deployment.startDeploymentComments}
                                    </WWText>
                                </View>
                            )}
                            {deployment.endDeploymentComments && (
                                <View style={styles.noteSection}>
                                    <WWText variant="labelLarge" style={styles.noteLabel}>
                                        Retrieval Notes
                                    </WWText>
                                    <WWText variant="bodyMedium" style={styles.noteText}>
                                        {deployment.endDeploymentComments}
                                    </WWText>
                                </View>
                            )}
                        </Card.Content>
                    </Card>
                )}

                {/* Action Buttons */}
                <View style={styles.actionSection}>
                    <WWButton
                        mode="outlined"
                        icon="map"
                        onPress={() => navigation.navigate('Home' as any)}
                        style={styles.actionButton}
                    >
                        View on Map
                    </WWButton>

                    {isActive && (
                        <WWButton
                            mode="contained"
                            icon="stop"
                            onPress={() => navigation.navigate('EndDeploymentWizard', { mode: 'end_deployment' } as any)}
                            style={[styles.actionButton, styles.endButton]}
                            color="#D32F2F"
                        >
                            End Deployment
                        </WWButton>
                    )}
                </View>
            </View>
        </WWScreenView>
    )
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    heroCard: {
        marginBottom: 16,
        backgroundColor: 'transparent',
    },
    card: {
        marginBottom: 16,
        backgroundColor: 'transparent',
    },
    cardTitle: {
        color: '#FFFFFF',
    },
    statusBadgeContainer: {
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    statusBadge: {
        paddingHorizontal: 0,
        height: 32,
    },
    deploymentName: {
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#FFFFFF',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    infoText: {
        marginLeft: 8,
        color: '#9CA3AF',
    },
    divider: {
        marginVertical: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    smallDivider: {
        marginVertical: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    datesGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
    },
    dateItem: {
        minWidth: '30%',
    },
    label: {
        color: '#9CA3AF',
        marginBottom: 4,
    },
    dateValue: {
        fontWeight: '600',
        color: '#FFFFFF',
    },
    deviceInfo: {
        gap: 8,
    },
    infoLabel: {
        color: '#9CA3AF',
        width: 140,
    },
    valueText: {
        color: '#FFFFFF',
        flex: 1,
    },
    statusPlaceholder: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    placeholderText: {
        color: '#9CA3AF',
        flex: 1,
    },
    locationName: {
        marginBottom: 4,
        color: '#FFFFFF',
    },
    coordinates: {
        color: '#9CA3AF',
        marginBottom: 12,
    },
    mapContainer: {
        height: 200,
        overflow: 'hidden',
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
    },
    map: {
        width: '100%',
        height: '100%',
    },
    customMarker: {
        backgroundColor: '#D32F2F',
        padding: 8,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    noLocation: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    noLocationText: {
        marginTop: 8,
        color: '#666',
    },
    noteSection: {
        marginBottom: 16,
    },
    noteLabel: {
        color: '#9CA3AF',
        marginBottom: 6,
    },
    noteText: {
        lineHeight: 20,
        color: '#FFFFFF',
    },
    actionSection: {
        gap: 12,
        marginTop: 8,
        marginBottom: 24,
    },
    actionButton: {
        borderRadius: 8,
    },
    endButton: {
        backgroundColor: '#D32F2F',
    },
})

// Enhance
const enhance = withObservables(['route'], ({ route }: { route: DeploymentDetailsRouteProp }) => ({
    deployment: DeploymentService.observeDeploymentById(route.params?.deploymentId || '')
}))

export const DeploymentDetailsScreen = enhance(DeploymentDetailsScreenComponent)
