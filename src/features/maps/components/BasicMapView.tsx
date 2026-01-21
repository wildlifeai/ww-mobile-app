/**
 * BasicMapView Component
 *
 * Foundational map component with user location display
 * Zero dependencies on other MVP2 features
 */

import React, { useEffect } from "react"
import { StyleSheet, View, Platform } from "react-native"
import MapView, { PROVIDER_GOOGLE, Region, Details } from "react-native-maps"
import { MapRegion, MapType, MapViewConfig } from "../types"

interface BasicMapViewProps {
	region: MapRegion
	onRegionChange?: (region: MapRegion) => void
	onRegionChangeComplete?: (region: MapRegion) => void
	mapType?: MapType
	config?: Partial<MapViewConfig>
	mapRef?: React.RefObject<MapView | null>
	children?: React.ReactNode
	onPress?: (e: any) => void
}

const DEFAULT_CONFIG: MapViewConfig = {
	showsUserLocation: true,
	showsMyLocationButton: false, // We'll create custom button
	showsCompass: true,
	showsScale: Platform.OS === "ios", // iOS only
	zoomEnabled: true,
	scrollEnabled: true,
	rotateEnabled: true,
	pitchEnabled: true,
}

export const BasicMapView: React.FC<BasicMapViewProps> = ({
	region,
	onRegionChange,
	onRegionChangeComplete,
	mapType = "standard",
	config = {},
	mapRef,
	children,
	onPress,
}) => {
	const finalConfig = React.useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config])

	/**
	 * Debug logging for map initialization
	 */
	useEffect(() => {
		console.log("[BasicMapView] Initializing with region:", region)
		console.log("[BasicMapView] Map type:", mapType)
		console.log("[BasicMapView] Config:", finalConfig)
		console.log("[BasicMapView] Platform:", Platform.OS)
	}, [region, mapType, finalConfig])

	/**
	 * Handle map errors
	 */


	/**
	 * Handle map ready event
	 */
	const handleMapReady = () => {
		console.log("[BasicMapView] Map is ready!")
	}


	/**
	 * Handle region change with gesture detection
	 * Prevents infinite loops from programmatic updates
	 */
	const handleRegionChangeComplete = (newRegion: Region, details: Details) => {
		// Only trigger callback for user gestures (not programmatic changes)
		// This prevents infinite loops when updating the region programmatically
		if (!details.isGesture) return

		console.log("[BasicMapView] Region changed:", newRegion)
		onRegionChangeComplete?.(newRegion as MapRegion)
	}

	return (
		<View style={styles.container}>
			<MapView
				ref={mapRef}
				provider={PROVIDER_GOOGLE} // Use Google Maps on both platforms
				style={styles.map}
				initialRegion={region}
				region={region}
				mapType={mapType}
				onRegionChange={onRegionChange}
				onRegionChangeComplete={handleRegionChangeComplete}
				onPress={onPress}
				// User location
				showsUserLocation={finalConfig.showsUserLocation}
				showsMyLocationButton={finalConfig.showsMyLocationButton}
				userLocationUpdateInterval={5000} // Update every 5 seconds
				userLocationFastestInterval={5000}
				userLocationPriority="balanced" // Balance battery vs accuracy
				// UI controls
				showsCompass={finalConfig.showsCompass}
				showsScale={finalConfig.showsScale}
				// Interactions
				zoomEnabled={finalConfig.zoomEnabled}
				scrollEnabled={finalConfig.scrollEnabled}
				rotateEnabled={finalConfig.rotateEnabled}
				pitchEnabled={finalConfig.pitchEnabled}
				// Performance
				minZoomLevel={0}
				maxZoomLevel={20}
				loadingEnabled={true}
				loadingBackgroundColor="#E5E5E5"
				loadingIndicatorColor="#007AFF"
				// Error handling
				onMapReady={handleMapReady}

				// Android specific
				toolbarEnabled={false} // Disable default Android toolbar
				moveOnMarkerPress={false}
			>
				{children}
			</MapView>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	map: {
		...StyleSheet.absoluteFillObject, // Critical for map rendering
	},
})
