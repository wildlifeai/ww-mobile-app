
import React, { useLayoutEffect } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { Appbar, Card, Chip, IconButton, Menu } from 'react-native-paper'
import { withObservables } from '@nozbe/watermelondb/react'
import { WWScreenView } from '../../../components/ui/WWScreenView'
import { WWText } from '../../../components/ui/WWText'
import { RootStackParamList } from '../../../navigation'
import { DeploymentService } from '../../../services/DeploymentService' // Need to export service?
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
                                // Navigate to End Deployment Wizard
                                // We pass mode 'end_deployment' to DeviceDiscoveryScreen
                                // But wait, DeviceDiscoveryScreen needs the USER to select the device.
                                // If we already know the device, can we skip step 1?
                                // The guide says "Step 1: Device Selection...". So yes, we go to wizard.
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
                {/* Header Card */}
                <Card style={styles.card}>
                    <Card.Content>
                        <View style={styles.headerRow}>
                            <View>
                                <WWText variant="headlineSmall" style={styles.title}>{deployment.name}</WWText>
                                <WWText variant="bodyMedium" style={{ color: '#666' }}>{deployment.locationName}</WWText>
                            </View>
                            <Chip style={{ backgroundColor: statusColor + '20' }}>
                                <WWText style={{ color: statusColor, fontWeight: 'bold' }}>{statusLabel}</WWText>
                            </Chip>
                        </View>

                        <View style={styles.datesRow}>
                            <View>
                                <WWText variant="labelMedium">Started</WWText>
                                <WWText variant="bodyLarge">{new Date(deployment.deploymentStart).toLocaleDateString()}</WWText>
                            </View>
                            {deployment.deploymentEnd && (
                                <View>
                                    <WWText variant="labelMedium">Ended</WWText>
                                    <WWText variant="bodyLarge">{new Date(deployment.deploymentEnd).toLocaleDateString()}</WWText>
                                </View>
                            )}
                        </View>
                    </Card.Content>
                </Card>

                {/* Location Map */}
                <Card style={styles.card}>
                    <Card.Title title="Location" />
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
                                    <Marker coordinate={{ latitude: deployment.latitude, longitude: deployment.longitude }} />
                                </BasicMapView>
                            </View>
                        ) : (
                            <View style={styles.noLocation}>
                                <WWText>No location data available</WWText>
                            </View>
                        )}
                    </View>
                </Card>

                {/* Device Info */}
                <Card style={styles.card} mode="outlined" onPress={() => {
                    // Navigate to Device Details (Device Screen not yet fully typed in my assumption, but let's try)
                    // navigation.navigate('DeviceDetails', { deviceId: deployment.deviceId })
                }}>
                    <Card.Title
                        title="Device Information"
                        subtitle={`ID: ${deployment.deviceId}`} // Ideally fetch device name relation
                        right={(props) => <IconButton {...props} icon="chevron-right" />}
                    />
                </Card>

                {/* Comments/Notes */}
                {(deployment.startDeploymentComments || deployment.endDeploymentComments) && (
                    <Card style={styles.card}>
                        <Card.Title title="Notes" />
                        <Card.Content>
                            {deployment.startDeploymentComments && (
                                <View style={{ marginBottom: 12 }}>
                                    <WWText variant="labelMedium">Start Notes:</WWText>
                                    <WWText variant="bodyMedium">{deployment.startDeploymentComments}</WWText>
                                </View>
                            )}
                            {deployment.endDeploymentComments && (
                                <View>
                                    <WWText variant="labelMedium">Retrieval Notes:</WWText>
                                    <WWText variant="bodyMedium">{deployment.endDeploymentComments}</WWText>
                                </View>
                            )}
                        </Card.Content>
                    </Card>
                )}

            </View>
        </WWScreenView>
    )
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    card: {
        marginBottom: 16,
        backgroundColor: '#fff',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    title: {
        fontWeight: 'bold',
    },
    datesRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
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
    noLocation: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    }
})

// Enhance
const enhance = withObservables(['route'], ({ route }: { route: DeploymentDetailsRouteProp }) => ({
    deployment: DeploymentService.observeDeploymentById(route.params.deploymentId)
}))

export const DeploymentDetailsScreen = enhance(DeploymentDetailsScreenComponent)
