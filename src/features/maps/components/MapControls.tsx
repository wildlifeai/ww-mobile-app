/**
 * MapControls Component
 *
 * Floating controls for map interactions (zoom, center, map type)
 * Zero dependencies on other MVP2 features
 */

import React from "react"
import { StyleSheet, View, TouchableOpacity, Text } from "react-native"
import { MapType } from "../types"

interface MapControlsProps {
	onZoomIn: () => void
	onZoomOut: () => void
	onCenterUser: () => void
	onMapTypeChange: (type: MapType) => void
	currentMapType: MapType
	showMapTypeSelector?: boolean
}

export const MapControls: React.FC<MapControlsProps> = ({
	onZoomIn,
	onZoomOut,
	onCenterUser,
	onMapTypeChange,
	currentMapType,
	showMapTypeSelector = true,
}) => {
	const mapTypes: MapType[] = ["standard", "satellite", "hybrid"]

	return (
		<>
			{/* Zoom Controls - Right Side */}
			<View style={styles.zoomControls}>
				<TouchableOpacity
					style={styles.controlButton}
					onPress={onZoomIn}
					activeOpacity={0.7}
				>
					<Text style={styles.controlIcon}>+</Text>
				</TouchableOpacity>
				<View style={styles.controlDivider} />
				<TouchableOpacity
					style={styles.controlButton}
					onPress={onZoomOut}
					activeOpacity={0.7}
				>
					<Text style={styles.controlIcon}>−</Text>
				</TouchableOpacity>
			</View>

			{/* Center on User - Bottom Right */}
			<TouchableOpacity
				style={styles.centerButton}
				onPress={onCenterUser}
				activeOpacity={0.7}
			>
				<Text style={styles.centerIcon}>⊙</Text>
			</TouchableOpacity>

			{/* Map Type Selector - Top Right */}
			{showMapTypeSelector && (
				<View style={styles.mapTypeSelector}>
					{mapTypes.map((type) => (
						<TouchableOpacity
							key={type}
							style={[
								styles.mapTypeButton,
								currentMapType === type && styles.mapTypeButtonActive,
							]}
							onPress={() => onMapTypeChange(type)}
							activeOpacity={0.7}
						>
							<Text
								style={[
									styles.mapTypeText,
									currentMapType === type && styles.mapTypeTextActive,
								]}
							>
								{type.charAt(0).toUpperCase()}
							</Text>
						</TouchableOpacity>
					))}
				</View>
			)}
		</>
	)
}

const styles = StyleSheet.create({
	// Zoom Controls
	zoomControls: {
		position: "absolute",
		right: 16,
		top: "50%",
		marginTop: -50, // Half of total height
		backgroundColor: "white",
		borderRadius: 8,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 5,
		overflow: "hidden",
	},
	controlButton: {
		width: 44,
		height: 44,
		justifyContent: "center",
		alignItems: "center",
	},
	controlDivider: {
		height: 1,
		backgroundColor: "#E5E5E5",
	},
	controlIcon: {
		fontSize: 24,
		fontWeight: "600",
		color: "#007AFF",
	},

	// Center Button
	centerButton: {
		position: "absolute",
		right: 16,
		bottom: 100,
		width: 44,
		height: 44,
		backgroundColor: "white",
		borderRadius: 22,
		justifyContent: "center",
		alignItems: "center",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 5,
	},
	centerIcon: {
		fontSize: 24,
		color: "#007AFF",
	},

	// Map Type Selector
	mapTypeSelector: {
		position: "absolute",
		top: 16,
		right: 16,
		flexDirection: "row",
		backgroundColor: "white",
		borderRadius: 8,
		padding: 4,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 5,
	},
	mapTypeButton: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 6,
	},
	mapTypeButtonActive: {
		backgroundColor: "#007AFF",
	},
	mapTypeText: {
		fontSize: 14,
		fontWeight: "600",
		color: "#666",
	},
	mapTypeTextActive: {
		color: "white",
	},
})
