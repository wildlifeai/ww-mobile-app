
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
import { DeploymentService } from '../../../services/DeploymentService'
import type Deployment from '../../../database/models/Deployment'
import { BasicMapView } from '../../../features/maps/components/BasicMapView'
import { Marker } from 'react-native-maps'

type DeploymentDetailsRouteProp = RouteProp<RootStackParamList, 'DeploymentDetails'>

interface Props {
    deployment: Deployment
}

const DeploymentDetailsScreenComponent: React.FC<Props> = ({ deployment }) => {
    const navigation = useNavigation()
    const [menuVisible, setMenuVisible] = React.useState(false)

    // Status helpers
    const isActive = deployment.deploymentStatusId === 1
    const statusLabel = isActive ? 'Active' : (deployment.deploymentStatusId === 2 ? 'Ended' : 'Failed')
    const statusColor = isActive ? '#4CAF50' : '#FF9800'

    // Calculate duration
    const duration = useMemo(() => {
        if (!deployment.deploymentStart) return null
        const start = new Date(deployment.deploymentStart)
        const end = deployment.deploymentEnd ? new Date(deployment.deploymentEnd) : new Date()
        const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        if (days === 0) return 'Less than 1 day'
        return `${days} day${days !== 1 ? 's' : ''}`
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
                <Card style={styles.heroCard}>
                    <Card.Content>
                        {/* Status Badge */}
                        <View style={styles.statusBadgeContainer}>
                            <Chip
                                icon={isActive ? "circle" : "check-circle"}
                                style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}
                            >
                                <WWText style={{ color: statusColor, fontWeight: 'bold', fontSize: 16 }}>
                                    {statusLabel}
                                </WWText>
                            </Chip>
                        </View>

                        {/* Deployment Name */}
                        <WWText variant="headlineMedium" style={styles.deploymentName}>
                            {deployment.name || 'Unnamed Deployment'}
                        </WWText>

                        {/* Project Info */}
                        {deployment.projectId && (
                            <View style={styles.infoRow}>
                                <WWIcon source="folder" size={16} color="#666" />
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
                                    {new Date(deployment.deploymentStart).toLocaleDateString()}
                                </WWText>
                            </View>
                            {deployment.deploymentEnd && (
                                <View style={styles.dateItem}>
                                    <WWText variant="labelMedium" style={styles.label}>Ended</WWText>
                                    <WWText variant="bodyLarge" style={styles.dateValue}>
                                        {new Date(deployment.deploymentEnd).toLocaleDateString()}
                                    </WWText>
                                </View>
                            )}
                            {duration && (
                                <View style={styles.dateItem}>
                                    <WWText variant="labelMedium" style={styles.label}>Duration</WWText>
                                    <WWText variant="bodyLarge" style={styles.dateValue}>{duration}</WWText>
                                </View>
                            )}
                        </View>
                    </Card.Content>
                </Card>

                {/* Device & Configuration Card */}
                <Card style={styles.card}>
                    <Card.Title
                        title="Device & Configuration"
                        left={(props) => <WWIcon {...props} source="camera" size={24} />}
                    />
                    <Card.Content>
                        <View style={styles.deviceInfo}>
                            <View style={styles.infoRow}>
                                <WWText variant="labelMedium" style={styles.infoLabel}>Device ID:</WWText>
                                <WWText variant="bodyMedium">{deployment.deviceId?.slice(0, 18) || 'Unknown'}...</WWText>
                            </View>
                            {deployment.captureMethodId && (
                                <View style={styles.infoRow}>
                                    <WWText variant="labelMedium" style={styles.infoLabel}>Capture Method:</WWText>
                                    <WWText variant="bodyMedium">
                                        {deployment.captureMethodId === 1 ? 'Motion Detection' : 'Timelapse'}
                                    </WWText>
                                </View>
                            )}
                            {deployment.activityDetectionSensitivityId && (
                                <View style={styles.infoRow}>
                                    <WWText variant="labelMedium" style={styles.infoLabel}>Sensitivity:</WWText>
                                    <WWText variant="bodyMedium">
                                        {deployment.activityDetectionSensitivityId === 1 ? 'Low' :
                                            deployment.activityDetectionSensitivityId === 2 ? 'Medium' : 'High'}
                                    </WWText>
                                </View>
                            )}
                        </View>

                        {/* Placeholder for future LoRaWAN data */}
                        <Divider style={styles.smallDivider} />
                        <View style={styles.statusPlaceholder}>
                            <WWText variant="bodySmall" style={styles.placeholderText}>
                                📡 Device status data will appear here when available via LoRaWAN
                            </WWText>
                        </View>
                    </Card.Content>
                </Card>

                {/* Location Card */}
                <Card style={styles.card}>
                    <Card.Title
                        title="Location"
                        left={(props) => <WWIcon {...props} source="map-marker" size={24} />}
                    />
                    <Card.Content>
                        {deployment.locationName && (
                            <WWText variant="titleMedium" style={styles.locationName}>
                                {deployment.locationName}
                            </WWText>
                        )}
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
                                <WWIcon source="map-marker-off" size={48} color="#ccc" />
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
                    <Card style={styles.card}>
                        <Card.Title
                            title="Notes & Comments"
                            left={(props) => <WWIcon {...props} source="note-text" size={24} />}
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

                {/* Photos Placeholder */}
                {deployment.cameraLocationImagePaths && deployment.cameraLocationImagePaths.length > 0 && (
                    <Card style={styles.card}>
                        <Card.Title
                            title={`Camera Setup Photos (${deployment.cameraLocationImagePaths.length})`}
                            left={(props) => <WWIcon {...props} source="camera-image" size={24} />}
                        />
                        <Card.Content>
                            <WWText variant="bodySmall" style={styles.placeholderText}>
                                📷 Photo viewing functionality coming soon
                            </WWText>
                        </Card.Content>
                    </Card>
                )}

                {/* Action Buttons */}
                <View style={styles.actionSection}>
                    <WWButton
                        mode="outlined"
                        icon="map"
                        onPress={() => navigation.navigate('Map' as any)}
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
        backgroundColor: '#fff',
        elevation: 4,
    },
    card: {
        marginBottom: 16,
        backgroundColor: '#fff',
    },
    statusBadgeContainer: {
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    deploymentName: {
        fontWeight: 'bold',
        marginBottom: 8,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    infoText: {
        marginLeft: 8,
        color: '#666',
    },
    divider: {
        marginVertical: 16,
    },
    smallDivider: {
        marginVertical: 12,
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
        color: '#666',
        marginBottom: 4,
    },
    dateValue: {
        fontWeight: '600',
    },
    deviceInfo: {
        gap: 8,
    },
    infoLabel: {
        color: '#666',
        width: 140,
    },
    statusPlaceholder: {
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 8,
    },
    placeholderText: {
        color: '#666',
        textAlign: 'center',
    },
    locationName: {
        marginBottom: 4,
    },
    coordinates: {
        color: '#666',
        marginBottom: 12,
    },
    mapContainer: {
        height: 200,
        overflow: 'hidden',
        borderRadius: 8,
        marginTop: 8,
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
        backgroundColor: '#f5f5f5',
    },
    noLocationText: {
        marginTop: 8,
        color: '#999',
    },
    noteSection: {
        marginBottom: 16,
    },
    noteLabel: {
        color: '#666',
        marginBottom: 6,
    },
    noteText: {
        lineHeight: 20,
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
    deployment: DeploymentService.observeDeploymentById(route.params.deploymentId)
}))

export const DeploymentDetailsScreen = enhance(DeploymentDetailsScreenComponent)
