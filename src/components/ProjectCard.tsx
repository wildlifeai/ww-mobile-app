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
import { useGetProjectMembersQuery } from "../redux/api/projectsApi"

export interface ProjectCardProps {
	project: ProjectWithDetails
	onPress: () => void
}

export const ProjectCard = React.memo(
	({ project, onPress }: ProjectCardProps) => {
		const theme = useTheme()

		// Fetch true cloud member count since local DB only syncs the current user's role 
		// due to RLS policies. It's safe here because RTK Query caches and deduplicates.
		const { data: members } = useGetProjectMembersQuery(project.id)
		const displayMemberCount = members ? members.length : (project.member_count || 0)

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



		return (
			<Card
				mode="outlined"
				style={styles.card}
				onPress={onPress}
				testID={`project-card-${project.id}`}
				accessible
				accessibilityLabel={`Project ${project.name}, ${displayMemberCount
					} members, ${project.deployment_count || 0} sessions`}
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
								{displayMemberCount}{" "}
								{displayMemberCount === 1 ? "member" : "members"}
							</Text>
						</View>

						{/* Device Count */}
						<View style={styles.metadataItem} testID="device-count">
							<WWIcon
								source="camera-wireless"
								size={16}
								color={theme.colors.onSurfaceVariant}
								containerStyle={styles.icon}
							/>
							<Text
								variant="bodySmall"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{project.device_count || 0}{" "}
								{(project.device_count || 0) === 1
									? "Wildlife Watcher"
									: "Wildlife Watchers"}
								{` (${project.active_device_count || 0} active)`}
							</Text>
						</View>
					</View>



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
	lastUpdated: {
		marginTop: 4,
	},
})
