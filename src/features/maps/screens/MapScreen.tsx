/**
 * MapScreen Component
 *
 * Main map screen with deployment markers, FABs, and interactive controls
 */

import React, { useEffect, useMemo, useReducer } from "react"
import { StyleSheet, View, Text, ActivityIndicator } from "react-native"
import { FAB, IconButton } from "react-native-paper"
import { withObservables } from '@nozbe/watermelondb/react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { BasicMapView } from "../components/BasicMapView"
import { MapControls } from "../components/MapControls"
import { LocationPermissionPrompt } from "../components/LocationPermissionPrompt"
import { DeploymentCard } from "../components/DeploymentCard"
import { DeploymentMarker } from "../components/DeploymentMarker"
import { useLocation } from "../hooks/useLocation"
import { useMapRegion } from "../hooks/useMapRegion"
import { MapType } from "../types"
import { useAppNavigation } from "../../../hooks/useAppNavigation"
import { useAppDrawer } from "../../../components/AppDrawer"
import { useExtendedTheme } from "../../../theme"
import { DeploymentService, DEPLOYMENT_STATUS } from "../../../services/DeploymentService"
import type Deployment from "../../../database/models/Deployment"
import { log } from '../../../utils/logger'
import { OfflineIndicator } from '../../../components/ui/OfflineIndicator'


interface MapState {
	mapType: MapType
	initialLoad: boolean
	showActive: boolean
	showEnded: boolean
	selectedDeploymentId: string | null
}

const mapReducer = (state: MapState, action: Partial<MapState>): MapState => ({ ...state, ...action })

interface Props {
	deployments: Deployment[]
	selectedDeploymentId?: string
}

const MapScreenComponent: React.FC<Props> = ({ deployments, selectedDeploymentId: initialDeploymentId }) => {
	const {
		location,
		permissions,
		loading: locationLoading,
		error: locationError,
		requestPermissions,
		getCurrentLocation,
		startTracking,
		stopTracking,
	} = useLocation()

	const { region, setRegion, zoomIn, zoomOut, resetToUserLocation, mapRef } =
		useMapRegion()

	const insets = useSafeAreaInsets()

	const [state, dispatch] = useReducer(mapReducer, {
		mapType: "hybrid",
		initialLoad: true,
		showActive: true,
		showEnded: false,
		selectedDeploymentId: null
	})

	const { mapType, initialLoad, selectedDeploymentId } = state

	const navigation = useAppNavigation()

	// Filter deployments to only show active ones
	const filteredDeployments = useMemo(() => {
		return deployments.filter(d =>
			d.deploymentStatusId === DEPLOYMENT_STATUS.STARTED &&
			d.latitude != null &&
			d.longitude != null
		)
	}, [deployments])

	// Get selected deployment object for the card
	const selectedDeployment = useMemo(() => {
		if (!selectedDeploymentId) return null
		return deployments.find(d => d.id === selectedDeploymentId) || null
	}, [deployments, selectedDeploymentId])

	// Handle external selectedDeploymentId navigation target
	useEffect(() => {
		if (initialDeploymentId && initialDeploymentId !== selectedDeploymentId) {
			dispatch({ selectedDeploymentId: initialDeploymentId })
			const deployment = deployments.find(d => d.id === initialDeploymentId)
			if (deployment && deployment.latitude && deployment.longitude) {
				const loc = { 
					latitude: deployment.latitude, 
					longitude: deployment.longitude,
					altitude: null,
					accuracy: null,
					heading: null,
					speed: null,
					timestamp: Date.now()
				}
				resetToUserLocation(loc as any)
			}
		}
	}, [initialDeploymentId, deployments, selectedDeploymentId, resetToUserLocation])

	// Navigation Drawer Control
	const { setIsOpen } = useAppDrawer()
	const { colors } = useExtendedTheme()

	/**
	 * Debug logging
	 */
	useEffect(() => {
		log("[MapScreen] Permission status:", permissions.foreground)
		log("[MapScreen] Location loading:", locationLoading)
		log("[MapScreen] Has location:", !!location)
		log("[MapScreen] Error:", locationError)
		log("[MapScreen] Deployments count:", filteredDeployments.length)
	}, [permissions.foreground, locationLoading, location, locationError, filteredDeployments.length])

	/**
	 * Center map on user location when available
	 */
	useEffect(() => {
		if (location && initialLoad) {
			log("[MapScreen] Centering on user location:", location)
			resetToUserLocation(location)
			dispatch({ initialLoad: false })
		}
	}, [location, initialLoad, resetToUserLocation])

	/**
	 * Start and stop location tracking based on screen focus
	 */
	useFocusEffect(
		React.useCallback(() => {
			if (permissions.foreground === "granted") {
				log('[MapScreen] Focused - Starting precise tracking')
				startTracking({ accuracy: "high", timeInterval: 5000, distanceInterval: 5 })
			}
			return () => {
				log('[MapScreen] Blurred - Stopping precise tracking')
				stopTracking()
			}
		}, [permissions.foreground, startTracking, stopTracking])
	)

	/**
	 * Request permission on mount if not determined
	 */
	useEffect(() => {
		if (permissions.foreground === "undetermined") {
			log(
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
	 * Handle deployment marker selection
	 */
	const handleMarkerPress = React.useCallback((deploymentId: string) => {
		log('[MapScreen] Deployment marker selected:', deploymentId)
		dispatch({ selectedDeploymentId: deploymentId })
	}, [])

	/**
	 * Handle tapping on map (deselect)
	 */
	const handleMapPress = React.useCallback(() => {
		if (selectedDeploymentId) {
			log('[MapScreen] Map tapped, deselecting')
			dispatch({ selectedDeploymentId: null })
		}
	}, [selectedDeploymentId])/* selectedDeploymentId dependency is fine here as it only runs when map is pressed, not passed to markers */

	/**
	 * Handle view details from card
	 */
	const handleViewDetails = React.useCallback(() => {
		if (selectedDeploymentId) {
			log('[MapScreen] Navigating to details:', selectedDeploymentId)
			navigation.navigate('DeviceMonitoringSummary', { deploymentId: selectedDeploymentId })
			dispatch({ selectedDeploymentId: null })
		}
	}, [selectedDeploymentId, navigation])

	/**
	 * Show map with permission prompt overlay if needed
	 */
	const showPermissionPrompt = permissions.foreground !== "granted"
	const showMapUserLocation = permissions.foreground === "granted"

	return (
		<View style={styles.container}>
			{/* Map View - ALWAYS SHOWN */}
			<BasicMapView
				region={region}
				onRegionChangeComplete={setRegion}
				mapType={mapType}
				mapRef={mapRef}
				config={{ showsUserLocation: showMapUserLocation }}
				onPress={handleMapPress}
			>
				{/* Deployment Markers */}
				{filteredDeployments.map((deployment) => (
					<DeploymentMarker
						key={deployment.id}
						deployment={deployment}
						onPress={handleMarkerPress}
					/>
				))}
			</BasicMapView>

			{/* Permission Prompt Overlay */}
			{showPermissionPrompt && (
				<LocationPermissionPrompt
					status={permissions.foreground}
					onRequestPermission={requestPermissions}
					canAskAgain={permissions.canAskAgain}
				/>
			)}

			{/* Map Controls - Center button only, no zoom */}
			<MapControls
				onZoomIn={zoomIn}
				onZoomOut={zoomOut}
				onCenterUser={handleCenterUser}
				onMapTypeChange={(type) => dispatch({ mapType: type })}
				currentMapType={mapType}
				showMapTypeSelector={false}
				showZoomControls={false}
			/>

			{/* Header Background Gradient/Overlay - Status Bar Only */}
			<View style={[styles.headerBackground, { height: insets.top, backgroundColor: colors.surface }]} />

			{/* Offline Indicator - overlays top of map */}
			<View style={[styles.offlineOverlay, { top: insets.top }]}>
				<OfflineIndicator />
			</View>

			{/* Custom Header with Hamburger Button - Top Left */}
			<IconButton
				icon="menu"
				iconColor={colors.onSurface}
				size={28}
				style={[styles.menuFab, { top: insets.top + 8, backgroundColor: colors.surface }]}
				onPress={() => setIsOpen(true)}
			/>



			{/* Center on User Location - Bottom Left */}
			<FAB
				icon="crosshairs-gps"
				style={[styles.centerFab, { backgroundColor: colors.surface }]}
				onPress={handleCenterUser}
				color={colors.onSurface}
				small
			/>

			{/* Custom Deployment Details Card Overlay */}
			<DeploymentCard
				deployment={selectedDeployment}
				isVisible={!!selectedDeploymentId}
				onClose={() => dispatch({ selectedDeploymentId: null })}
				onPress={handleViewDetails}
			/>

			{/* Loading Indicator */}
			{locationLoading && (
				<View style={styles.loadingOverlay}>
					<View style={styles.loadingContainer}>
						<ActivityIndicator size="large" color={colors.primary} />
						<Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>Getting your location…</Text>
					</View>
				</View>
			)}

			{/* Error Message */}
			{locationError && (
				<View style={[styles.errorContainer, { backgroundColor: colors.error }]}>
					<Text style={[styles.errorText, { color: colors.onError }]}>⚠️ {locationError}</Text>
				</View>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	loadingOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0, 0, 0, 0.3)",
		justifyContent: "center",
		alignItems: "center",
	},
	loadingContainer: {
		borderRadius: 12,
		padding: 24,
		boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.25)",
	},
	loadingText: {
		marginTop: 12,
		fontSize: 16,
		fontWeight: "500",
	},
	errorContainer: {
		position: "absolute",
		top: 16,
		left: 16,
		right: 16,
		borderRadius: 12,
		boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.25)",
	},
	errorText: {
		fontSize: 14,
		fontWeight: "600",
		textAlign: "center",
	},
	// Overlay Buttons
	menuFab: {
		position: "absolute",
		left: 16,
	},
	centerFab: {
		position: "absolute",
		bottom: 16,
		left: 16,
	},
	headerBackground: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		zIndex: 1,
	},
	offlineOverlay: {
		position: "absolute",
		left: 0,
		right: 0,
		zIndex: 2,
	},
})

// Enhance with WatermelonDB observables
const enhance = withObservables([], () => ({
	deployments: DeploymentService.observeDeployments()
}))

export const MapScreen = enhance(MapScreenComponent)
