import { memo } from "react"
import { StyleSheet, View } from "react-native"
import { Card, Text, useTheme } from "react-native-paper"
import { Deployment } from "../types/api.types"
import { WWIcon } from "./ui/WWIcon"



// Helper to safely access fields from either API type (snake_case) or Model (camelCase)
const getField = (obj: any, snake: string, camel: string) => obj[snake] ?? obj[camel]

export const DeploymentCard = memo<{ deployment: any, onPress?: (id: string) => void }>(({ deployment, onPress }) => {
	const theme = useTheme()

	const deploymentStart = getField(deployment, 'deployment_start', 'deploymentStart')
	const deploymentEnd = getField(deployment, 'deployment_end', 'deploymentEnd')
	const deploymentName = deployment.name || getField(deployment, 'name', 'name')
	const locationName = getField(deployment, 'location_name', 'locationName')

	const getStatusColor = () => {
		if (!deploymentStart) return theme.colors.onSurfaceDisabled
		const now = new Date()
		const start = new Date(deploymentStart)
		const end = deploymentEnd
			? new Date(deploymentEnd)
			: null

		if (now < start) return theme.colors.onSurfaceDisabled // Not started
		if (!end || now < end) return "#4CAF50" // Active/Green
		return theme.colors.error // Ended/Red
	}

	const getStatusText = () => {
		if (!deploymentStart) return "Not started"
		const now = new Date()
		const start = new Date(deploymentStart)
		const end = deploymentEnd
			? new Date(deploymentEnd)
			: null

		if (now < start) return "Not started"
		if (!end || end.getTime() === 0 || now < end) {
			return `Started ${start.toLocaleDateString()}`
		}
		return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
	}

	return (
		<Card
			mode="outlined"
			style={styles.card}
			onPress={() => onPress?.(deployment.id)}
		>
			<Card.Content style={styles.content}>
				{/* Header: Name and Status Dot */}
				<View style={styles.header}>
					<Text
						variant="headlineSmall"
						style={[styles.title, { color: theme.colors.onSurface }]}
						numberOfLines={1}
					>
						{deploymentName ||
							locationName ||
							`Deployment #${deployment.id.slice(-4)}`}
					</Text>
					<View
						style={[styles.statusDot, { backgroundColor: getStatusColor() }]}
					/>
				</View>

				{/* Date / Status Text */}
				<View style={styles.row}>
					<WWIcon
						source="calendar"
						size={16}
						color={theme.colors.onSurfaceVariant}
						containerStyle={styles.icon}
					/>
					<Text
						variant="bodyMedium"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{getStatusText()}
					</Text>
				</View>

				{/* Stats - Hidden until we have real data from LoRaWAN */}
			</Card.Content>
		</Card>
	)
})

const styles = StyleSheet.create({
	card: {
		marginBottom: 12,
		elevation: 0,
	},
	content: {
		paddingVertical: 12,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 8,
	},
	title: {
		fontWeight: "600",
		flex: 1,
		marginRight: 8,
	},
	statusDot: {
		width: 12,
		height: 12,
		borderRadius: 6,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 4,
	},
	icon: {
		marginRight: 6,
	},
	statsRow: {
		flexDirection: "row",
		marginTop: 8,
		gap: 16,
		paddingTop: 8,
		borderTopWidth: 1,
		borderTopColor: "rgba(0, 0, 0, 0.08)",
	},
	statItem: {
		flexDirection: "row",
		alignItems: "center",
	},
})
