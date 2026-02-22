/**
 * MapScreen Component
 *
 * Main map screen with deployment markers, FABs, and interactive controls
 */

import React, { useEffect, useMemo, useReducer } from "react"
import { StyleSheet, View, Text, ActivityIndicator } from "react-native"
import { FAB, IconButton, Menu, Divider } from "react-native-paper"
import { withObservables } from '@nozbe/watermelondb/react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
import { DeploymentService } from "../../../services/DeploymentService"
import type Deployment from "../../../database/models/Deployment"
import { log } from '../../../utils/logger'


interface MapState {
	mapType: MapType
	initialLoad: boolean
	showActive: boolean
	showEnded: boolean
	filterMenuVisible: boolean
	selectedDeploymentId: string | null
}

const mapReducer = (state: MapState, action: Partial<MapState>): MapState => ({ ...state, ...action })

interface Props {
	deployments: Deployment[]
}

const MapScreenComponent: React.FC<Props> = ({ deployments }) => {
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

	const insets = useSafeAreaInsets()

	const [state, dispatch] = useReducer(mapReducer, {
		mapType: "hybrid",
		initialLoad: true,
		showActive: true,
		showEnded: false,
		filterMenuVisible: false,
		selectedDeploymentId: null
	})

	const { mapType, initialLoad, showActive, showEnded, filterMenuVisible, selectedDeploymentId } = state

	const navigation = useAppNavigation()

	// Check if there is ANY active deployment (based on missing end date)
	const hasActiveDeployment = useMemo(() => {
		return deployments.some(d => !d.deploymentEnd)
	}, [deployments])

	// Filter deployments based on filter mode
	const filteredDeployments = useMemo(() => {
		return deployments.filter(d => {
			const isActive = !d.deploymentEnd
			if (isActive) return showActive
			return showEnded
		})
	}, [deployments, showActive, showEnded])

	// Get selected deployment object for the card
	const selectedDeployment = useMemo(() => {
		if (!selectedDeploymentId) return null
		return deployments.find(d => d.id === selectedDeploymentId) || null
	}, [deployments, selectedDeploymentId])

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
			navigation.navigate('DeploymentDetails', { deploymentId: selectedDeploymentId })
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
			<View style={[styles.headerBackground, { height: insets.top }]} />

			{/* Custom Header with Hamburger Button - Top Left */}
			<IconButton
				icon="menu"
				iconColor={colors.onSurface}
				size={28}
				style={[styles.menuFab, { top: insets.top + 8, backgroundColor: colors.surface }]}
				onPress={() => setIsOpen(true)}
			/>

			{/* Layer Filter Toggle - Top Right */}
			<View style={[styles.filterFab, { top: insets.top + 16 }]}>
				<Menu
					visible={filterMenuVisible}
					onDismiss={() => dispatch({ filterMenuVisible: false })}
					anchor={
						<FAB
							icon="filter"
							label="Filter"
							style={{ backgroundColor: (showActive || showEnded) ? colors.primary : colors.surface }}
							color={(showActive || showEnded) ? colors.onPrimary : colors.onSurface}
							onPress={() => dispatch({ filterMenuVisible: true })}
							small
						/>
					}
				>
					<Menu.Item title="Deployments" disabled />
					<Divider />
					<Menu.Item
						onPress={() => dispatch({ showActive: !showActive })}
						title="Active"
						leadingIcon={showActive ? "check" : undefined}
					/>
					<Menu.Item
						onPress={() => dispatch({ showEnded: !showEnded })}
						title="Ended"
						leadingIcon={showEnded ? "check" : undefined}
					/>
				</Menu>
			</View>

			{/* Center on User Location - Bottom Left */}
			<FAB
				icon="crosshairs-gps"
				style={styles.centerFab}
				onPress={handleCenterUser}
				color="#000"
				small
			/>

			{/* Action Buttons - Bottom Right */}

			{/* New Deployment Button - Always Shown */}
			<FAB
				icon="plus"
				label="New Deployment"
				style={[styles.actionFab, { backgroundColor: colors.primary }]}
				color="#fff"
				onPress={() => navigation.navigate('StartDeploymentWizard', { mode: 'deployment' })}
			/>

			{/* End Deployment Button - Shown if active deployment exists */}
			{hasActiveDeployment && (
				<FAB
					icon="stop"
					label="End Deployment"
					style={[styles.actionFab, styles.endDeploymentFab]} // Stacked above New Deployment
					color="#000"
					small // Make it smaller to distinguish importance? Or keep regular. Let's keep regular but stacked.
					onPress={() => {
						log('[MapScreen] End Deployment pressed')
						navigation.navigate('EndDeploymentWizard', { mode: 'end_deployment' } as any)
					}}
				/>
			)}

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
		</View>
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
		boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.25)",
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
		boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.25)",
	},
	errorText: {
		color: "white",
		fontSize: 14,
		fontWeight: "600",
		textAlign: "center",
	},
	// Overlay Buttons
	menuFab: {
		position: "absolute",
		left: 16,
		backgroundColor: "rgba(255, 255, 255, 0.9)",
	},
	filterFab: {
		position: "absolute",
		right: 16, // Move to right to balance with Menu button
	},
	centerFab: {
		position: "absolute",
		bottom: 16,
		left: 16,
		backgroundColor: "rgba(255, 255, 255, 0.9)",
	},
	actionFab: {
		position: "absolute",
		bottom: 16,
		right: 16,
	},
	endDeploymentFab: {
		backgroundColor: '#FFAB00',
		bottom: 80,
	},
	headerBackground: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		backgroundColor: '#121212', // Black background to match bottom nav
		zIndex: 1, // Ensure it sits below buttons but above map
	},
})

// Enhance with WatermelonDB observables
const enhance = withObservables([], () => ({
	deployments: DeploymentService.observeDeployments()
}))

export const MapScreen = enhance(MapScreenComponent)
