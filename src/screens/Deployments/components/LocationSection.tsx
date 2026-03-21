import { useCallback, useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { Card, Button, Text, ActivityIndicator } from 'react-native-paper'
import MapView, { Marker } from 'react-native-maps'
import { useGPSLocation } from '../../../hooks/useGPSLocation'
import { WWIcon } from '../../../components/ui/WWIcon'

interface Props {
    onLocationChange: (loc: any) => void
    onShowHelp: (title: string, content: string) => void
}

const HelpButton = ({ onShowHelp, ...props }: any) => (
    <Button {...props} icon="help-circle-outline" onPress={() => onShowHelp('GPS Location', 'Location provided by your device GPS. Ensure you have a clear view of the sky for best accuracy.')}>
        <Text>Help</Text>
    </Button>
)

const LocationIcon = (props: any) => <WWIcon {...props} source="map-marker" />

export const LocationSection = ({ onLocationChange, onShowHelp }: Props) => {
    const { location, isGettingLocation, getLocation } = useGPSLocation()

    const renderHelpButton = useCallback((props: any) => <HelpButton {...props} onShowHelp={onShowHelp} />, [onShowHelp])

    const handleGetLocation = useCallback(async () => {
        const loc = await getLocation()
        if (loc) {
            onLocationChange(loc)
        }
    }, [getLocation, onLocationChange])

    useEffect(() => {
        // Auto-fetch on mount
        handleGetLocation()
    }, [handleGetLocation])

    return (
        <Card style={styles.card}>
            <Card.Title
                title="Location"
                left={LocationIcon}
                right={renderHelpButton}
            />
            <Card.Content style={styles.content}>
                {isGettingLocation ? (
                    <ActivityIndicator />
                ) : location ? (
                    <>
                        <View style={styles.locationTextContainer}>
                            <View style={styles.locationColumn}>
                                <Text variant="labelMedium">Latitude:</Text>
                                <Text>{location.latitude.toFixed(6)}</Text>
                            </View>
                            <View style={styles.locationColumn}>
                                <Text variant="labelMedium">Longitude:</Text>
                                <Text>{location.longitude.toFixed(6)}</Text>
                            </View>
                            <View style={styles.locationColumn}>
                                <Text variant="labelMedium">Altitude:</Text>
                                <Text>{location.altitude ? `${location.altitude.toFixed(1)}m` : 'N/A'}</Text>
                            </View>
                        </View>
                        {!!location.accuracy && (
                            <Text variant="bodySmall" style={styles.accuracyText}>
                                Accuracy: +/- {location.accuracy.toFixed(1)}m
                            </Text>
                        )}
                        <View style={styles.mapContainer}>
                            <MapView
                                style={styles.map}
                                region={{
                                    latitude: location.latitude,
                                    longitude: location.longitude,
                                    latitudeDelta: 0.005,
                                    longitudeDelta: 0.005,
                                }}
                                scrollEnabled={false}
                                zoomEnabled={false}
                                pitchEnabled={false}
                                rotateEnabled={false}
                            >
                                <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} />
                            </MapView>
                        </View>
                    </>
                ) : (
                    <Text>Location not available.</Text>
                )}
                <Button mode="outlined" onPress={handleGetLocation} icon="refresh" style={styles.refreshButton}>
                    <Text>Update Location</Text>
                </Button>
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: { marginBottom: 16 },
    content: { gap: 12 },
    locationTextContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
    },
    locationColumn: {
        minWidth: '30%',
    },
    accuracyText: {
        fontStyle: 'italic',
        color: '#666',
    },
    mapContainer: {
        height: 150,
        borderRadius: 8,
        overflow: 'hidden',
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    map: {
        width: '100%',
        height: '100%',
    },
    refreshButton: {
        marginTop: 8,
    }
})
