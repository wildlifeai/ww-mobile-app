import React, { useState, useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { Card, Button, Text, ActivityIndicator } from 'react-native-paper'
import { useGPSLocation } from '../../../hooks/useGPSLocation'
import { WWIcon } from '../../../components/ui/WWIcon'

interface Props {
    onLocationChange: (loc: any) => void
    onShowHelp: (title: string, content: string) => void
}

export const LocationSection = ({ onLocationChange, onShowHelp }: Props) => {
    const { location, isGettingLocation, getLocation } = useGPSLocation()

    useEffect(() => {
        // Auto-fetch on mount
        getLocation()
    }, [])

    useEffect(() => {
        if (location) {
            onLocationChange(location)
        }
    }, [location])

    return (
        <Card style={styles.card}>
            <Card.Title
                title="Location"
                left={(props) => <WWIcon {...props} source="map-marker" />}
                right={(props) => <Button {...props} icon="help-circle-outline" onPress={() => onShowHelp('GPS Location', 'Location provided by your device GPS. Ensure you have a clear view of the sky for best accuracy.')}>Help</Button>}
            />
            <Card.Content style={styles.content}>
                {isGettingLocation ? (
                    <ActivityIndicator />
                ) : location ? (
                    <View>
                        <Text>Lat: {location.latitude}</Text>
                        <Text>Lon: {location.longitude}</Text>
                        <Text>Alt: {location.altitude}m</Text>
                    </View>
                ) : (
                    <Text>Location not available.</Text>
                )}
                <Button onPress={getLocation} icon="refresh">Update Location</Button>
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: { marginBottom: 16 },
    content: { gap: 12 }
})
