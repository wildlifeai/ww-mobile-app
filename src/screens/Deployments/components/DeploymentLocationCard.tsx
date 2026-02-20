import React, { useMemo, useCallback } from 'react'
import { View, StyleSheet, Linking, Platform } from 'react-native'
import { Card } from 'react-native-paper'
import { Marker } from 'react-native-maps'
import { WWText } from '../../../components/ui/WWText'
import { WWIcon } from '../../../components/ui/WWIcon'
import { WWButton } from '../../../components/ui/WWButton'
import { useExtendedTheme } from '../../../theme'
import { BasicMapView } from '../../../features/maps/components/BasicMapView'
import type Deployment from '../../../database/models/Deployment'

interface Props {
    deployment: Deployment
}

export const DeploymentLocationCard: React.FC<Props> = ({ deployment }) => {
    const theme = useExtendedTheme()
    const { colors } = theme
    const styles = useMemo(() => createStyles(theme), [theme])

    const renderLocationLeft = useCallback((props: any) => (
        <WWIcon {...props} source="map-marker" size={24} color={colors.onSurface} />
    ), [colors.onSurface])

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

    return (
        <Card mode="outlined" style={styles.card}>
            <Card.Title
                title="Location"
                titleStyle={styles.cardTitle}
                left={renderLocationLeft}
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
                        <WWIcon source="map-marker-off" size={48} color={colors.onSurfaceVariant} />
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
    )
}

const createStyles = (theme: any) => StyleSheet.create({
    card: {
        marginBottom: 16,
        backgroundColor: 'transparent',
    },
    cardTitle: {
        color: theme.colors.onSurface,
    },
    locationName: {
        marginBottom: 4,
        color: theme.colors.onSurface,
    },
    coordinates: {
        color: theme.colors.onSurfaceVariant,
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
        backgroundColor: theme.colors.primary,
        padding: 6,
        borderRadius: 20,
        borderWidth: 2,
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
        backgroundColor: theme.colors.elevation.level1,
    },
    noLocationText: {
        marginTop: 8,
        color: theme.colors.onSurfaceVariant,
    },
})
