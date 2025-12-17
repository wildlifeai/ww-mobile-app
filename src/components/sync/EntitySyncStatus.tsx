/**
 * Entity Sync Status Component
 *
 * Shows sync status for individual entities (projects, deployments, devices)
 * Provides per-entity sync indicators
 */

import React from "react"
import { View, Text, StyleSheet, ActivityIndicator } from "react-native"
import { useAppSelector } from "../../redux"
import { selectEntitySyncStatus } from "../../redux/slices/syncSlice"

interface EntitySyncStatusProps {
	entityType: "projects" | "deployments" | "devices" | "organisations"
	entityId: string
	variant?: "icon" | "text" | "full"
}

export const EntitySyncStatus: React.FC<EntitySyncStatusProps> = ({
	entityType,
	entityId,
	variant = "icon",
}) => {
	const syncStatus = useAppSelector((state) =>
		selectEntitySyncStatus(state, entityType, entityId),
	)

	const getStatusDisplay = () => {
		switch (syncStatus.status) {
			case "syncing":
				return {
					icon: <ActivityIndicator size="small" color="#2196F3" />,
					text: "Syncing...",
					color: "#2196F3",
				}
			case "pending":
				return {
					icon: "⏳",
					text: "Pending",
					color: "#FF9800",
				}
			case "error":
				return {
					icon: "❌",
					text: syncStatus.error || "Error",
					color: "#F44336",
				}
			case "synced":
			default:
				return {
					icon: "✅",
					text: "Synced",
					color: "#4CAF50",
				}
		}
	}

	const display = getStatusDisplay()

	if (variant === "icon") {
		return (
			<View style={styles.iconContainer}>
				{typeof display.icon === "string" ? (
					<Text style={styles.iconText}>{display.icon}</Text>
				) : (
					display.icon
				)}
			</View>
		)
	}

	if (variant === "text") {
		return (
			<Text style={[styles.statusText, { color: display.color }]}>
				{display.text}
			</Text>
		)
	}

	// Full variant
	return (
		<View style={styles.fullContainer}>
			{typeof display.icon === "string" ? (
				<Text style={styles.iconText}>{display.icon}</Text>
			) : (
				display.icon
			)}
			<Text style={[styles.statusText, { color: display.color }]}>
				{display.text}
			</Text>
			{syncStatus.lastSync && (
				<Text style={styles.timestampText}>
					{new Date(syncStatus.lastSync).toLocaleTimeString()}
				</Text>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	iconContainer: {
		padding: 4,
	},
	fullContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	iconText: {
		fontSize: 14,
	},
	statusText: {
		fontSize: 13,
		fontWeight: "500",
	},
	timestampText: {
		fontSize: 11,
		color: "#757575",
		marginLeft: 4,
	},
})

export default EntitySyncStatus
