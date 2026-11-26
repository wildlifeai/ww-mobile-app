
import React, { useRef, useLayoutEffect, useState, memo } from 'react'
import { View, StyleSheet } from 'react-native'
import { Marker } from 'react-native-maps'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import type Deployment from '../../../database/models/Deployment'

interface Props {
    deployment: Deployment
    onPress: (id: string) => void
    /** Colour of a ring round the marker for a camera that needs attention (#518), none when null */
    ring?: string | null
}

const DeploymentMarkerComponent: React.FC<Props> = ({ deployment, onPress, ring = null }) => {
    const markerRef = useRef<any>(null)

    // Optimization: Only track view changes for the first render
    // This prevents constant bitmap regeneration which crashes Android
    const [tracksViewChanges, setTracksViewChanges] = useState(true)

    useLayoutEffect(() => {
        // Track again while a ring arrives or goes: the check-ins are read after the first
        // render, and an untracked marker keeps its old bitmap on Android
        setTracksViewChanges(true)
        // Stop tracking after the render (allow time for icon to load)
        const timer = setTimeout(() => {
            setTracksViewChanges(false)
        }, 500) // 500ms is usually safe for vector icons to render

        return () => clearTimeout(timer)
    }, [ring])

    // Marker Color Logic
    const getMarkerColor = (statusId?: number | null) => {
        switch (statusId) {
            case 1: return '#2196F3' // Planned (Blue)
            case 2: return '#4CAF50' // Active (Green)
            case 3: return '#616161' // Ended (Grey)
            default: return '#757575'
        }
    }

    // Safety: skip rendering if coordinates are null/undefined
    // (prevents native ReadableNativeMap.getDouble crash on Android)
    if (deployment.latitude == null || deployment.longitude == null) {
        return null
    }

    const color = getMarkerColor(deployment.deploymentStatusId)

    return (
        <Marker
            ref={markerRef}
            coordinate={{
                latitude: deployment.latitude,
                longitude: deployment.longitude,
            }}
            onPress={(e) => {
                // Stop bubbling to prevent map press
                e.stopPropagation()
                onPress(deployment.id)
            }}
            tracksViewChanges={tracksViewChanges}
            tracksInfoWindowChanges={false} // We don't use InfoWindow/Callout
        >
            <View style={ring ? [styles.ring, { borderColor: ring }] : styles.noRing} testID={ring ? 'marker-ring' : undefined}>
                <View style={[styles.markerBody, { borderColor: color }]}>
                    <MaterialCommunityIcons name="camera" size={20} color={color} />
                </View>
            </View>
        </Marker>
    )
}

const styles = StyleSheet.create({
    // The ring and its absence take the same room, so a marker does not shift when one arrives
    ring: {
        borderRadius: 21,
        borderWidth: 3,
        padding: 1,
    },
    noRing: {
        padding: 4,
    },
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
// Only re-render if deployment props (like ID or coords/status) or the ring change
export const DeploymentMarker = memo(DeploymentMarkerComponent, (prev, next) => {
    return (
        prev.deployment.id === next.deployment.id &&
        prev.deployment.latitude === next.deployment.latitude &&
        prev.deployment.longitude === next.deployment.longitude &&
        prev.deployment.deploymentStatusId === next.deployment.deploymentStatusId &&
        prev.ring === next.ring
    )
})
