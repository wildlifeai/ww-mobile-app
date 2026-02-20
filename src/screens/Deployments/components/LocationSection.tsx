import { useCallback, useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { Card, Button, Text, ActivityIndicator } from 'react-native-paper'
import { useGPSLocation } from '../../../hooks/useGPSLocation'
import { WWIcon } from '../../../components/ui/WWIcon'

interface Props {
    onLocationChange: (loc: any) => void
    onShowHelp: (title: string, content: string) => void
}

const HelpButton = ({ onShowHelp, ...props }: any) => (
    <Button {...props} icon="help-circle-outline" onPress={() => onShowHelp('GPS Location', 'Location provided by your device GPS. Ensure you have a clear view of the sky for best accuracy.')}>
        Help
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
                    <View>
                        <Text>Lat: {location.latitude}</Text>
                        <Text>Lon: {location.longitude}</Text>
                        <Text>Alt: {location.altitude}m</Text>
                        {location.accuracy && <Text>Accuracy: +/- {location.accuracy?.toFixed(1)}m</Text>}
                    </View>
                ) : (
                    <Text>Location not available.</Text>
                )}
                <Button onPress={handleGetLocation} icon="refresh">Update Location</Button>
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: { marginBottom: 16 },
    content: { gap: 12 }
})
