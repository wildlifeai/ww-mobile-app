
import React, { useRef, useLayoutEffect, useState, memo } from 'react'
import { View, StyleSheet } from 'react-native'
import { Marker } from 'react-native-maps'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import type Deployment from '../../../database/models/Deployment'

interface Props {
    deployment: Deployment
    onPress: (id: string) => void
}

const DeploymentMarkerComponent: React.FC<Props> = ({ deployment, onPress }) => {
    const markerRef = useRef<any>(null)

    // Optimization: Only track view changes for the first render
    // This prevents constant bitmap regeneration which crashes Android
    const [tracksViewChanges, setTracksViewChanges] = useState(true)

    useLayoutEffect(() => {
        // Stop tracking after initial render (allow time for icon to load)
        const timer = setTimeout(() => {
            setTracksViewChanges(false)
        }, 500) // 500ms is usually safe for vector icons to render

        return () => clearTimeout(timer)
    }, []) // Only run on mount

    // Marker Color Logic
    const getMarkerColor = (statusId?: number | null) => {
        switch (statusId) {
            case 1: return '#4CAF50' // Active (Green)
            case 2: return '#616161' // Ended (Grey)
            case 3: return '#F44336' // Failed (Red)
            default: return '#757575'
        }
    }

    const color = getMarkerColor(deployment.deploymentStatusId)

    return (
        <Marker
            ref={markerRef}
            coordinate={{
                latitude: deployment.latitude!,
                longitude: deployment.longitude!,
            }}
            onPress={(e) => {
                // Stop bubbling to prevent map press
                e.stopPropagation()
                onPress(deployment.id)
            }}
            tracksViewChanges={tracksViewChanges}
            tracksInfoWindowChanges={false} // We don't use InfoWindow/Callout
        >
            <View style={[styles.markerBody, { borderColor: color }]}>
                <MaterialCommunityIcons name="camera" size={20} color={color} />
            </View>
        </Marker>
    )
}

const styles = StyleSheet.create({
    markerBody: {
        backgroundColor: 'white',
        borderRadius: 15, // Circular
        padding: 4,
        borderWidth: 2,
        opacity: 1
    },
    icon: {
        width: 20,
        height: 20,
    }
})

// Memoize to prevent re-renders when parent state (like selectedDeploymentId) changes
// Only re-render if deployment props (like ID or coords/status) change
export const DeploymentMarker = memo(DeploymentMarkerComponent, (prev, next) => {
    return (
        prev.deployment.id === next.deployment.id &&
        prev.deployment.latitude === next.deployment.latitude &&
        prev.deployment.longitude === next.deployment.longitude &&
        prev.deployment.deploymentStatusId === next.deployment.deploymentStatusId
    )
})
