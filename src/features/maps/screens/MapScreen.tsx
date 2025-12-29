/**
 * MapScreen Component
 *
 * Main map screen with deployment markers, FABs, and interactive controls
 */

import React, { useState, useEffect, useMemo } from "react"
import { StyleSheet, View, Text, ActivityIndicator } from "react-native"
import { FAB, IconButton, Menu, Divider } from "react-native-paper"
import { Marker, Callout } from "react-native-maps"
import { withObservables } from '@nozbe/watermelondb/react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BasicMapView } from "../components/BasicMapView"
import { MapControls } from "../components/MapControls"
import { LocationPermissionPrompt } from "../components/LocationPermissionPrompt"
import { useLocation } from "../hooks/useLocation"
import { useMapRegion } from "../hooks/useMapRegion"
import { MapType } from "../types"
import { useAppNavigation } from "../../../hooks/useAppNavigation"
import { useAppDrawer } from "../../../components/AppDrawer"
import { useExtendedTheme } from "../../../theme"
import { DeploymentService } from "../../../services/DeploymentService"
import type Deployment from "../../../database/models/Deployment"

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

	// Default to hybrid, no selector shown
	const [mapType, setMapType] = useState<MapType>("hybrid")
	const [initialLoad, setInitialLoad] = useState(true)
	const [showActive, setShowActive] = useState(true)
	const [showEnded, setShowEnded] = useState(false)
	const [filterMenuVisible, setFilterMenuVisible] = useState(false)

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

	// Navigation Drawer Control
	const { setIsOpen } = useAppDrawer()
	const { colors } = useExtendedTheme()

	/**
	 * Debug logging
	 */
	useEffect(() => {
		console.log("[MapScreen] Permission status:", permissions.foreground)
		console.log("[MapScreen] Location loading:", locationLoading)
		console.log("[MapScreen] Has location:", !!location)
		console.log("[MapScreen] Error:", locationError)
		console.log("[MapScreen] Deployments count:", filteredDeployments.length)
	}, [permissions.foreground, locationLoading, location, locationError, filteredDeployments.length])

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
	 * 1 = Active, 2 = Ended/Recovery, 3 = Failed
	 * Request: Green (#4CAF50) for active, Grey for ended.
	 */
	const getMarkerColor = (statusId?: number | null) => {
		switch (statusId) {
			case 1: // active
				return '#4CAF50' // Green
			case 2: // ended
				return '#616161' // Grey 700
			case 3: // failed
				return '#F44336' // Red
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
				return 'Active'
			case 2:
				return 'Ended'
			case 3:
				return 'Failed'
			default:
				return 'Unknown'
		}
	}

	/**
	 * Helper to render custom marker icon
	 */
	const renderMarkerIcon = (statusId?: number | null) => {
		const color = getMarkerColor(statusId)
		// Use 'camera' for both as requested
		const iconName = 'camera'

		// Ended status transparency logic
		// "10% transparent" requested - interpreted as slightly transparent (0.9 opacity)
		// or potentially "10% opacity" (0.1). 
		// Using 0.6 as a reasonable visual indication for "ended/inactive".
		const opacity = statusId === 2 ? 0.6 : 1.0

		return (
			<View style={{
				backgroundColor: 'white',
				borderRadius: 15,
				padding: 4,
				borderWidth: 2,
				borderColor: color,
				elevation: 4,
				shadowColor: '#000',
				shadowOffset: { width: 0, height: 2 },
				shadowOpacity: 0.25,
				shadowRadius: 2,
				opacity: opacity
			}}>
				<MaterialCommunityIcons name={iconName} size={20} color={color} />
			</View>
		)
	}

	/**
	 * Handle deployment marker/callout press
	 */
	const handleMarkerPress = (deploymentId: string) => {
		console.log('[MapScreen] Deployment marker pressed:', deploymentId)
		// Navigate to deployment details
		navigation.navigate('DeploymentDetails', { deploymentId })
	}

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
						// Do NOT attach onPress to Marker if we want Callout to show on tap.
						// Usually default behavior is toggle callout.
						// If we want to navigate on "icon tap", we use onPress here.
						// Request: "pop up message should have a link". 
						// So we let default behavior happen (show callout), and put link in callout.
						>
							{renderMarkerIcon(deployment.deploymentStatusId)}
							<Callout tooltip onPress={() => handleMarkerPress(deployment.id)}>
								<View style={styles.callout}>
									<Text style={styles.calloutTitle}>{deployment.name || 'Unnamed Deployment'}</Text>
									<Text style={styles.calloutText}>Status: {getStatusLabel(deployment.deploymentStatusId)}</Text>
									<Text style={styles.calloutText}>Location: {deployment.locationName}</Text>
									<View style={styles.linkContainer}>
										<Text style={styles.linkText}>View Details</Text>
										<MaterialCommunityIcons name="chevron-right" size={14} color="#2196F3" />
									</View>
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

			{/* Map Controls - Center button only, no zoom */}
			<MapControls
				onZoomIn={zoomIn}
				onZoomOut={zoomOut}
				onCenterUser={handleCenterUser}
				onMapTypeChange={setMapType}
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
					onDismiss={() => setFilterMenuVisible(false)}
					anchor={
						<FAB
							icon="filter"
							label="Filter"
							style={{ backgroundColor: (showActive || showEnded) ? colors.primary : colors.surface }}
							color={(showActive || showEnded) ? colors.onPrimary : colors.onSurface}
							onPress={() => setFilterMenuVisible(true)}
							small
						/>
					}
				>
					<Menu.Item title="Deployments" disabled />
					<Divider />
					<Menu.Item
						onPress={() => setShowActive(!showActive)}
						title="Active"
						leadingIcon={showActive ? "check" : undefined}
					/>
					<Menu.Item
						onPress={() => setShowEnded(!showEnded)}
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
					style={[styles.actionFab, { backgroundColor: '#FFAB00', bottom: 80 }]} // Stacked above New Deployment
					color="#000"
					small // Make it smaller to distinguish importance? Or keep regular. Let's keep regular but stacked.
					onPress={() => {
						console.log('[MapScreen] End Deployment pressed')
						navigation.navigate('EndDeploymentWizard', { mode: 'end_deployment' } as any)
					}}
				/>
			)}

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
	// Deployment Callout
	callout: {
		padding: 10,
		minWidth: 150,
		backgroundColor: 'white', // Ensure background for tooltip
		borderRadius: 8,
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
	linkContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 6,
		paddingTop: 4,
		borderTopWidth: 1,
		borderTopColor: '#EEE'
	},
	linkText: {
		color: '#2196F3',
		fontSize: 12,
		fontWeight: 'bold',
		marginRight: 2
	},
	// Overlay Buttons
	menuFab: {
		position: "absolute",
		left: 16,
		backgroundColor: "rgba(255, 255, 255, 0.9)",
		elevation: 4,
	},
	filterFab: {
		position: "absolute",
		right: 16, // Move to right to balance with Menu button
		elevation: 4,
	},
	centerFab: {
		position: "absolute",
		bottom: 16,
		left: 16,
		backgroundColor: "rgba(255, 255, 255, 0.9)",
		elevation: 4,
	},
	actionFab: {
		position: "absolute",
		bottom: 16,
		right: 16,
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
