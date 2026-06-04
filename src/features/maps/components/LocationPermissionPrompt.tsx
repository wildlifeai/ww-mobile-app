/**
 * LocationPermissionPrompt Component
 *
 * Prompt user for location permissions with explanation
 * Zero dependencies on other MVP2 features
 */

import React from "react"
import {
	StyleSheet,
	View,
	Text,
	TouchableOpacity,
	Linking,
	Platform,
} from "react-native"
import { LocationPermissionStatus } from "../types"

interface LocationPermissionPromptProps {
	status: LocationPermissionStatus
	onRequestPermission: () => void
	canAskAgain: boolean
}

export const LocationPermissionPrompt: React.FC<
	LocationPermissionPromptProps
> = ({ status, onRequestPermission, canAskAgain }) => {
	const openSettings = () => {
		if (Platform.OS === "ios") {
			Linking.openURL("app-settings:")
		} else {
			Linking.openSettings()
		}
	}

	if (status === "granted") {
		return null // Don't show if permission granted
	}

	return (
		<View style={styles.container}>
			<View style={styles.content}>
				<Text style={styles.icon}>📍</Text>
				<Text style={styles.title}>Location Access Required</Text>
				<Text style={styles.message}>
					{status === "undetermined"
						? "Wildlife Watcher needs access to your location to show your current position on the map and help you navigate to deployment sites."
						: "Location permission is required to use maps. Please enable location access in your device settings."}
				</Text>

				{canAskAgain && status === "undetermined" ? (
					<TouchableOpacity
						style={styles.primaryButton}
						onPress={onRequestPermission}
						activeOpacity={0.7}
					>
						<Text style={styles.primaryButtonText}>Continue</Text>
					</TouchableOpacity>
				) : (
					<TouchableOpacity
						style={styles.primaryButton}
						onPress={openSettings}
						activeOpacity={0.7}
					>
						<Text style={styles.primaryButtonText}>Open Settings</Text>
					</TouchableOpacity>
				)}

				<Text style={styles.helpText}>
					Your location data is only used within the app and is not shared with
					third parties.
				</Text>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
		padding: 20,
	},
	content: {
		backgroundColor: "white",
		borderRadius: 16,
		padding: 24,
		maxWidth: 400,
		width: "100%",
		alignItems: "center",
	},
	icon: {
		fontSize: 48,
		marginBottom: 16,
	},
	title: {
		fontSize: 20,
		fontWeight: "700",
		color: "#1A1A1A",
		marginBottom: 12,
		textAlign: "center",
	},
	message: {
		fontSize: 16,
		color: "#666",
		lineHeight: 24,
		textAlign: "center",
		marginBottom: 24,
	},
	primaryButton: {
		backgroundColor: "#007AFF",
		paddingHorizontal: 32,
		paddingVertical: 14,
		borderRadius: 12,
		width: "100%",
		alignItems: "center",
		marginBottom: 12,
	},
	primaryButtonText: {
		color: "white",
		fontSize: 16,
		fontWeight: "600",
	},
	helpText: {
		fontSize: 13,
		color: "#999",
		textAlign: "center",
		lineHeight: 18,
	},
})
