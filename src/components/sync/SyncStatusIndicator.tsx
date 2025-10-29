/**
 * Sync Status Indicator Component
 *
 * Visual indicator for sync status throughout the app
 * Shows overall sync state, pending operations, and errors
 */

import React from "react"
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ActivityIndicator,
} from "react-native"
import { useOfflineSync } from "../../hooks/useOfflineSync"

interface SyncStatusIndicatorProps {
	variant?: "full" | "compact" | "icon-only"
	showCount?: boolean
	onPress?: () => void
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
	variant = "compact",
	showCount = true,
	onPress,
}) => {
	const { syncStatus, pendingCount, isProcessing, isOnline } = useOfflineSync()

	// Determine status icon and color
	const getStatusDisplay = () => {
		if (isProcessing) {
			return {
				icon: <ActivityIndicator size="small" color="#2196F3" />,
				color: "#2196F3",
				text: "Syncing...",
				bgColor: "#E3F2FD",
			}
		}

		if (!isOnline) {
			return {
				icon: "🔴",
				color: "#F44336",
				text: "Offline",
				bgColor: "#FFEBEE",
			}
		}

		if (syncStatus === "error") {
			return {
				icon: "⚠️",
				color: "#FF9800",
				text: "Sync Error",
				bgColor: "#FFF3E0",
			}
		}

		if (syncStatus === "pending" && pendingCount > 0) {
			return {
				icon: "⏳",
				color: "#FF9800",
				text: `${pendingCount} pending`,
				bgColor: "#FFF3E0",
			}
		}

		return {
			icon: "✅",
			color: "#4CAF50",
			text: "Synced",
			bgColor: "#E8F5E9",
		}
	}

	const status = getStatusDisplay()

	if (variant === "icon-only") {
		return (
			<TouchableOpacity onPress={onPress} style={styles.iconOnly}>
				{typeof status.icon === "string" ? (
					<Text style={styles.iconText}>{status.icon}</Text>
				) : (
					status.icon
				)}
			</TouchableOpacity>
		)
	}

	if (variant === "compact") {
		return (
			<TouchableOpacity
				onPress={onPress}
				style={[styles.compactContainer, { backgroundColor: status.bgColor }]}
			>
				{typeof status.icon === "string" ? (
					<Text style={styles.iconText}>{status.icon}</Text>
				) : (
					status.icon
				)}
				{showCount && pendingCount > 0 && (
					<View style={[styles.badge, { backgroundColor: status.color }]}>
						<Text style={styles.badgeText}>{pendingCount}</Text>
					</View>
				)}
			</TouchableOpacity>
		)
	}

	// Full variant
	return (
		<TouchableOpacity
			onPress={onPress}
			style={[styles.fullContainer, { backgroundColor: status.bgColor }]}
		>
			{typeof status.icon === "string" ? (
				<Text style={styles.iconText}>{status.icon}</Text>
			) : (
				status.icon
			)}
			<Text style={[styles.statusText, { color: status.color }]}>
				{status.text}
			</Text>
			{showCount && pendingCount > 0 && (
				<View style={[styles.badge, { backgroundColor: status.color }]}>
					<Text style={styles.badgeText}>{pendingCount}</Text>
				</View>
			)}
		</TouchableOpacity>
	)
}

const styles = StyleSheet.create({
	iconOnly: {
		padding: 8,
	},
	compactContainer: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		gap: 4,
	},
	fullContainer: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 8,
		gap: 8,
	},
	iconText: {
		fontSize: 16,
	},
	statusText: {
		fontSize: 14,
		fontWeight: "600",
	},
	badge: {
		minWidth: 20,
		height: 20,
		borderRadius: 10,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 6,
	},
	badgeText: {
		color: "#FFFFFF",
		fontSize: 12,
		fontWeight: "700",
	},
})

export default SyncStatusIndicator
