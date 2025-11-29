import { memo } from "react"
import { StyleSheet, TouchableOpacity, View } from "react-native"
import { WWText } from "./ui/WWText"
import { Deployment } from "../types/api.types"

type Props = {
	deployment: Deployment & { device_id?: string }
	onPress?: (deploymentId: string) => void
}

export const DeploymentCard = memo<Props>(({ deployment, onPress }) => {
	const getStatusColor = () => {
		// Not started = white, Active = green, Ended = red
		if (!deployment.deployment_start) return "#FFFFFF"
		const now = new Date()
		const start = new Date(deployment.deployment_start)
		const end = deployment.deployment_end
			? new Date(deployment.deployment_end)
			: null

		if (now < start) return "#FFFFFF" // Not started
		if (!end || now < end) return "#4CAF50" // Active/Green
		return "#F44336" // Ended/Red
	}

	const getStatusText = () => {
		if (!deployment.deployment_start) return "Not started"
		const now = new Date()
		const start = new Date(deployment.deployment_start)
		const end = deployment.deployment_end
			? new Date(deployment.deployment_end)
			: null

		if (now < start) return "Not started"
		if (!end || now < end) {
			// If active, show start date
			return `Started ${start.toLocaleDateString()}`
		}
		return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
	}

	return (
		<TouchableOpacity
			style={styles.container}
			onPress={() => onPress?.(deployment.id)}
		>
			<View style={styles.content}>
				<View style={styles.header}>
					<WWText variant="titleMedium">
						{deployment.location_name ||
							`Deployment #${deployment.id.slice(-4)}`}
					</WWText>
					<View
						style={[styles.statusDot, { backgroundColor: getStatusColor() }]}
					/>
				</View>
				<WWText variant="bodyMedium" style={styles.date}>
					{getStatusText()}
				</WWText>
				{deployment.device_id && (
					<View style={styles.stats}>
						<View style={styles.stat}>
							<WWText variant="bodySmall">512 mb</WWText>
						</View>
						<View style={styles.stat}>
							<WWText variant="bodySmall">50%</WWText>
						</View>
					</View>
				)}
			</View>
		</TouchableOpacity>
	)
})

const styles = StyleSheet.create({
	container: {
		backgroundColor: "#424242",
		borderRadius: 12,
		marginBottom: 12,
		overflow: "hidden",
	},
	content: {
		padding: 16,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 4,
	},
	statusDot: {
		width: 12,
		height: 12,
		borderRadius: 6,
	},
	date: {
		opacity: 0.7,
	},
	stats: {
		flexDirection: "row",
		marginTop: 8,
		gap: 16,
	},
	stat: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
	},
})
