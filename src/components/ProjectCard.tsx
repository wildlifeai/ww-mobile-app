/**
 * ProjectCard Component
 * Displays project information with Material Design 3 styling
 *
 * Features:
 * - Project metadata (name, description, counts)
 * - LoRaWAN device status with battery/SD card indicators
 * - Memoized for FlatList performance
 * - Accessible with proper testIDs and labels
 */

import React from "react"
import { StyleSheet, View } from "react-native"
import { Card, Text, useTheme } from "react-native-paper"
import { WWIcon } from "./ui/WWIcon"
import type { ProjectWithDetails } from "../types/project"

export interface ProjectCardProps {
	project: ProjectWithDetails
	onPress: () => void
}

export const ProjectCard = React.memo(
	({ project, onPress }: ProjectCardProps) => {
		const theme = useTheme()

		// Format date for display
		const formatDate = (dateString: string | null) => {
			if (!dateString) return "Unknown"
			const date = new Date(dateString)
			const now = new Date()
			const diffInDays = Math.floor(
				(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
			)

			if (diffInDays === 0) return "Today"
			if (diffInDays === 1) return "Yesterday"
			if (diffInDays < 7) return `${diffInDays} days ago`
			if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`
			if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`
			return date.toLocaleDateString()
		}

		// Battery level color based on percentage
		const getBatteryColor = (level?: number) => {
			if (!level) return theme.colors.onSurfaceDisabled
			if (level >= 50) return theme.colors.primary
			if (level >= 20) return "#FFA726" // Warning orange
			return theme.colors.error
		}

		// SD card usage color based on percentage
		const getSDCardColor = (usage?: number) => {
			if (!usage) return theme.colors.onSurfaceDisabled
			if (usage >= 80) return theme.colors.error
			if (usage >= 60) return "#FFA726" // Warning orange
			return theme.colors.primary
		}

		return (
			<Card
				mode="outlined"
				style={styles.card}
				onPress={onPress}
				testID={`project-card-${project.id}`}
				accessible
				accessibilityLabel={`Project ${project.name}, ${project.member_count || 0
					} members, ${project.deployment_count || 0} deployments`}
			>
				<Card.Content style={styles.content}>
					{/* Project Name */}
					<Text
						variant="headlineSmall"
						style={[styles.title, { color: theme.colors.onSurface }]}
						numberOfLines={1}
						testID="project-name"
					>
						{project.name}
					</Text>

					{/* Description */}
					{project.description && (
						<Text
							variant="bodyMedium"
							style={[
								styles.description,
								{ color: theme.colors.onSurfaceVariant },
							]}
							numberOfLines={2}
							testID="project-description"
						>
							{project.description}
						</Text>
					)}

					{/* Metadata Row */}
					<View style={styles.metadataRow}>
						{/* Member Count */}
						<View style={styles.metadataItem} testID="member-count">
							<WWIcon
								source="account-group"
								size={16}
								color={theme.colors.onSurfaceVariant}
								containerStyle={styles.icon}
							/>
							<Text
								variant="bodySmall"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{project.member_count || 0}{" "}
								{(project.member_count || 0) === 1 ? "member" : "members"}
							</Text>
						</View>

						{/* Deployment Count */}
						<View style={styles.metadataItem} testID="deployment-count">
							<WWIcon
								source="map-marker-multiple"
								size={16}
								color={theme.colors.onSurfaceVariant}
								containerStyle={styles.icon}
							/>
							<Text
								variant="bodySmall"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{project.deployment_count || 0}{" "}
								{(project.deployment_count || 0) === 1
									? "deployment"
									: "deployments"}
								{` (${project.active_deployment_count || 0} active)`}
							</Text>
						</View>
					</View>

					{/* LoRaWAN Device Status */}
					{(project.lorawan_device_count || 0) > 0 && (
						<View style={styles.lorawanStatus} testID="lorawan-status">
							<View style={styles.metadataItem}>
								<WWIcon
									source="access-point"
									size={16}
									color={theme.colors.primary}
									containerStyle={styles.icon}
								/>
								<Text
									variant="bodySmall"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{project.lorawan_device_count} {" "}
									{(project.lorawan_device_count || 0) === 1
										? "device"
										: "devices"}
								</Text>
							</View>

							{/* Battery Level */}
							{project.battery_level !== undefined && (
								<View style={styles.metadataItem} testID="battery-level">
									<WWIcon
										source={
											project.battery_level >= 80
												? "battery-high"
												: project.battery_level >= 50
													? "battery-medium"
													: project.battery_level >= 20
														? "battery-low"
														: "battery-alert"
										}
										size={16}
										color={getBatteryColor(project.battery_level)}
										containerStyle={styles.icon}
									/>
									<Text
										variant="bodySmall"
										style={{ color: getBatteryColor(project.battery_level) }}
									>
										{project.battery_level}%
									</Text>
								</View>
							)}

							{/* SD Card Usage */}
							{project.sd_card_usage !== undefined && (
								<View style={styles.metadataItem} testID="sd-card-usage">
									<WWIcon
										source="sd"
										size={16}
										color={getSDCardColor(project.sd_card_usage)}
										containerStyle={styles.icon}
									/>
									<Text
										variant="bodySmall"
										style={{ color: getSDCardColor(project.sd_card_usage) }}
									>
										{project.sd_card_usage}% used
									</Text>
								</View>
							)}
						</View>
					)}

					{/* Last Updated */}
					<Text
						variant="bodySmall"
						style={[
							styles.lastUpdated,
							{ color: theme.colors.onSurfaceDisabled },
						]}
						testID="last-updated"
					>
						Settings Updated: {formatDate(project.updated_at)}
					</Text>
				</Card.Content>
			</Card>
		)
	},
)

ProjectCard.displayName = "ProjectCard"

const styles = StyleSheet.create({
	card: {
		marginBottom: 12,
		elevation: 0,
	},
	content: {
		paddingVertical: 12,
	},
	title: {
		fontWeight: "600",
		marginBottom: 4,
	},
	description: {
		marginBottom: 12,
		lineHeight: 20,
	},
	metadataRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
		marginBottom: 8,
	},
	metadataItem: {
		flexDirection: "row",
		alignItems: "center",
	},
	icon: {
		marginRight: 4,
	},
	lorawanStatus: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginBottom: 8,
		paddingTop: 8,
		borderTopWidth: 1,
		borderTopColor: "rgba(0, 0, 0, 0.08)",
	},
	lastUpdated: {
		marginTop: 4,
	},
})
