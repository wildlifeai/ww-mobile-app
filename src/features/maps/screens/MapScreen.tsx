/**
 * MapScreen Component
 *
 * Main map screen with deployment markers, FABs, and interactive controls
 */

import React, { useState, useEffect, useMemo } from "react"
import { StyleSheet, View, Text, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { FAB, Portal } from "react-native-paper"
import { Marker, Callout } from "react-native-maps"
import { BasicMapView } from "../components/BasicMapView"
import { MapControls } from "../components/MapControls"
import { LocationPermissionPrompt } from "../components/LocationPermissionPrompt"
import { useLocation } from "../hooks/useLocation"
import { useMapRegion } from "../hooks/useMapRegion"
import { MapType } from "../types"
import { useGetDeploymentsQuery } from "../../../redux/api/deployments"
import { useAppNavigation } from "../../../hooks/useAppNavigation"

export const MapScreen: React.FC = () => {
	const {
		location,
		permissions,
		loading: locationLoading,
		error: locationError,
		requestPermissions,
		getCurrentLocation,
	} = useLocation()

	const { region, setRegion, zoomIn, zoomOut, resetToUserLocation, mapRef } =
		useMapRegion()

	const [mapType, setMapType] = useState<MapType>("standard")
	const [initialLoad, setInitialLoad] = useState(true)
	const [showActiveOnly, setShowActiveOnly] = useState(false)
	const navigation = useAppNavigation()

	// Fetch deployments
	const { data: deployments, isLoading: deploymentsLoading } = useGetDeploymentsQuery()

	// Filter deployments based on active/all toggle
	const filteredDeployments = useMemo(() => {
		if (!deployments) return []
		if (showActiveOnly) {
			// Status ID 2 = active deployments
			return deployments.filter(d => d.deployment_status_id === 2)
		}
		return deployments
	}, [deployments, showActiveOnly])

	/**
	 * Debug logging
	 */
	useEffect(() => {
		console.log("[MapScreen] Permission status:", permissions.foreground)
		console.log("[MapScreen] Location loading:", locationLoading)
		console.log("[MapScreen] Has location:", !!location)
		console.log("[MapScreen] Error:", locationError)
		console.log("[MapScreen] Deployments count:", filteredDeployments.length)
	}, [permissions.foreground, locationLoading, location, locationError, filteredDeployments])

	/**
	 * Center map on user location when available
	 */
	useEffect(() => {
		if (location && initialLoad) {
			console.log("[MapScreen] Centering on user location:", location)
			resetToUserLocation(location)
			setInitialLoad(false)
		}
	}, [location, initialLoad, resetToUserLocation])

	/**
	 * Request permission on mount if not determined
	 */
	useEffect(() => {
		if (permissions.foreground === "undetermined") {
			console.log(
				"[MapScreen] Location permission undetermined - showing prompt",
			)
		}
	}, [permissions.foreground])

	/**
	 * Handle center on user button
	 */
	const handleCenterUser = () => {
		if (location) {
			resetToUserLocation(location)
		} else {
			// Request fresh location if not available
			getCurrentLocation()
		}
	}

	/**
	 * Get marker color based on deployment status ID
	 * Status IDs: 1 = pending, 2 = active, 3 = ended (based on backend schema)
	 */
	const getMarkerColor = (statusId?: number | null) => {
		switch (statusId) {
			case 2: // active
				return '#4CAF50' // Green
			case 3: // ended
				return '#FF9800' // Orange  
			case 1: // pending
				return '#2196F3' // Blue
			default:
				return '#757575' // Gray
		}
	}

	/**
	 * Get status label from ID
	 */
	const getStatusLabel = (statusId?: number | null) => {
		switch (statusId) {
			case 1:
				return 'Pending'
			case 2:
				return 'Active'
			case 3:
				return 'Ended'
			default:
				return 'Unknown'
		}
	}

	/**
	 * Handle deployment marker press
	 */
	const handleMarkerPress = (deploymentId: string) => {
		console.log('[MapScreen] Deployment marker pressed:', deploymentId)
		// TODO: Navigate to deployment details when screen is implemented
		// navigation.navigate('DeploymentDetailsScreen', { deploymentId })
	}

	/**
	 * Show map with permission prompt overlay if needed
	 */
	const showPermissionPrompt = permissions.foreground !== "granted"
	const showMapUserLocation = permissions.foreground === "granted"

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			{/* Map View - ALWAYS SHOWN */}
			<BasicMapView
				region={region}
				onRegionChangeComplete={setRegion}
				mapType={mapType}
				mapRef={mapRef}
				config={{ showsUserLocation: showMapUserLocation }}
			>
				{/* Deployment Markers */}
				{filteredDeployments.map((deployment) => {
					if (!deployment.latitude || !deployment.longitude) return null

					return (
						<Marker
							key={deployment.id}
							coordinate={{
								latitude: deployment.latitude,
								longitude: deployment.longitude,
							}}
							pinColor={getMarkerColor(deployment.deployment_status_id)}
							onPress={() => handleMarkerPress(deployment.id)}
						>
							<Callout>
								<View style={styles.callout}>
									<Text style={styles.calloutTitle}>{deployment.name || 'Unnamed Deployment'}</Text>
									<Text style={styles.calloutText}>Status: {getStatusLabel(deployment.deployment_status_id)}</Text>
									<Text style={styles.calloutText}>Location: {deployment.location_name}</Text>
								</View>
							</Callout>
						</Marker>
					)
				})}
			</BasicMapView>

			{/* Permission Prompt Overlay */}
			{showPermissionPrompt && (
				<LocationPermissionPrompt
					status={permissions.foreground}
					onRequestPermission={requestPermissions}
					canAskAgain={permissions.canAskAgain}
				/>
			)}

			{/* Map Controls */}
			<MapControls
				onZoomIn={zoomIn}
				onZoomOut={zoomOut}
				onCenterUser={handleCenterUser}
				onMapTypeChange={setMapType}
				currentMapType={mapType}
			/>

			{/* Layer Filter Toggle - Top Left */}
			<Portal>
				<FAB
					icon={showActiveOnly ? "filter" : "filter-outline"}
					label={showActiveOnly ? "Active" : "All"}
					style={[styles.filterFab, { backgroundColor: showActiveOnly ? '#2196F3' : '#fff' }]}
					color={showActiveOnly ? '#fff' : '#000'}
					onPress={() => setShowActiveOnly(!showActiveOnly)}
					small
				/>

				{/* Start Deployment Button */}
				<FAB
					icon="upload"
					label="Start Deployment"
					style={[styles.startFab, { backgroundColor: '#2196F3' }]}
					color="#fff"
					onPress={() => navigation.navigate('AddDeployment')}
				/>

				{/* End Deployment Button */}
				<FAB
					icon="download"
					label="End Deployment"
					style={[styles.endFab, { backgroundColor: '#FF9800' }]}
					color="#fff"
					onPress={() => {
						// TODO: Implement end deployment flow
						console.log('[MapScreen] End Deployment pressed')
					}}
				/>
			</Portal>

			{/* Loading Indicator */}
			{locationLoading && (
				<View style={styles.loadingOverlay}>
					<View style={styles.loadingContainer}>
						<ActivityIndicator size="large" color="#007AFF" />
						<Text style={styles.loadingText}>Getting your location...</Text>
					</View>
				</View>
			)}

			{/* Error Message */}
			{locationError && (
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>⚠️ {locationError}</Text>
				</View>
			)}

			{/* Location Info (Development) */}
			{__DEV__ && location && (
				<View style={styles.debugInfo}>
					<Text style={styles.debugText}>
						Lat: {location.latitude.toFixed(6)}
					</Text>
					<Text style={styles.debugText}>
						Lng: {location.longitude.toFixed(6)}
					</Text>
					{location.accuracy && (
						<Text style={styles.debugText}>
							Accuracy: ±{location.accuracy.toFixed(0)}m
						</Text>
					)}
					<Text style={styles.debugText}>
						Deployments: {filteredDeployments.length}
					</Text>
				</View>
			)}
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#E5E5E5",
	},
	loadingOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0, 0, 0, 0.3)",
		justifyContent: "center",
		alignItems: "center",
	},
	loadingContainer: {
		backgroundColor: "white",
		borderRadius: 12,
		padding: 24,
		alignItems: "center",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 5,
	},
	loadingText: {
		marginTop: 12,
		fontSize: 16,
		color: "#666",
		fontWeight: "500",
	},
	errorContainer: {
		position: "absolute",
		top: 16,
		left: 16,
		right: 16,
		backgroundColor: "#FF3B30",
		borderRadius: 12,
		padding: 16,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 5,
	},
	errorText: {
		color: "white",
		fontSize: 14,
		fontWeight: "600",
		textAlign: "center",
	},
	debugInfo: {
		position: "absolute",
		bottom: 16,
		left: 16,
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		borderRadius: 8,
		padding: 12,
	},
	debugText: {
		color: "white",
		fontSize: 12,
		fontFamily: "monospace",
	},
	// Deployment Callout
	callout: {
		padding: 10,
		minWidth: 150,
	},
	calloutTitle: {
		fontSize: 14,
		fontWeight: "600",
		marginBottom: 4,
	},
	calloutText: {
		fontSize: 12,
		color: "#666",
		marginBottom: 2,
	},
	// Floating Action Buttons
	startFab: {
		position: "absolute",
		bottom: 80,
		left: 16,
	},
	endFab: {
		position: "absolute",
		bottom: 16,
		left: 16,
	},
	filterFab: {
		position: "absolute",
		top: 80,
		left: 16,
	},
})
