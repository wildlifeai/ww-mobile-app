/**
 * ProjectDetailsScreen
 * View project details with member management
 *
 * Features:
 * - View mode: Display project details, stats, and members
 * - Edit: Navigate to EditProjectScreen via gear icon
 * - Member management: Add/remove project members
 * - Offline-first: All operations work offline with background sync
 * - Loading states: Proper skeleton/spinner for data fetching
 */

import { useMemo } from "react"
import { StyleSheet, View, ScrollView } from "react-native"
import { Text, useTheme, ActivityIndicator, Button } from "react-native-paper"
import { useRoute, useNavigation } from "@react-navigation/native"
import { useEffect } from "react"
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { OfflineIndicator } from "../../components/ui/OfflineIndicator"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { AppParams } from "../../navigation/types"

import { ProjectDetailsCard } from './components/ProjectDetailsCard'
import { ProjectDevicesCard } from './components/ProjectDevicesCard'
import { ProjectMembersCard } from './components/ProjectMembersCard'
import { useProjectDetails } from './hooks/useProjectDetails'

export const ProjectDetailsScreen = () => {
	const theme = useTheme()
	const route = useRoute<AppParams<"ProjectDetailsScreen">>()
	const navigation = useNavigation()
	const { projectId } = route.params
	const insets = useSafeAreaInsets()

	const {
		currentUser,
		project,
		isLoading,
		error,
		refetch,
		members,
		membersLoading,
		isProjectAdmin,
		samplingDesignOptions,
		captureMethodOptions,
		sensitivityOptions,
		aiModelOptions,
		isMotionDetection,
		isTimeLapse,
		getLabel,
	} = useProjectDetails(projectId)

	const dynamicStyles = useMemo(() => ({
		loadingLabel: { color: theme.colors.onSurfaceVariant },
		errorHeader: { color: theme.colors.error },
		errorMessage: { color: theme.colors.onSurfaceVariant },
	}), [theme])

	// Dynamic Title Update
	useEffect(() => {
		if (project?.name) {
			navigation.setOptions({ title: project.name })
		}
	}, [project?.name, navigation])

	// Loading state
	if (isLoading) {
		return (
			<WWScreenView scrollable={false}>
				<View style={styles.centerContainer}>
					<ActivityIndicator size="large" testID="loading-indicator" />
					<Text
						variant="bodyMedium"
						style={[
							styles.loadingText,
							dynamicStyles.loadingLabel,
						]}
					>
						Loading project...
					</Text>
				</View>
			</WWScreenView>
		)
	}

	// Error state
	if (error || !project) {
		return (
			<WWScreenView scrollable={false}>
				<View style={styles.centerContainer}>
					<Text
						variant="headlineSmall"
						style={[styles.errorTitle, dynamicStyles.errorHeader]}
					>
						Failed to load project
					</Text>
					<Text
						variant="bodyMedium"
						style={[
							styles.errorMessage,
							dynamicStyles.errorMessage,
						]}
					>
						{error && typeof error === "object" && "error" in error
							? String(error.error)
							: "Project not found"}
					</Text>
					<Button
						mode="contained"
						onPress={() => refetch()}
						style={styles.retryButton}
					>
						<Text>Retry</Text>
					</Button>
				</View>
			</WWScreenView>
		)
	}

	return (
		<ScrollView style={styles.container}>
			<OfflineIndicator />

			<View style={[styles.content, { paddingBottom: 32 + insets.bottom }]}>
				{/* Details Card */}
				<ProjectDetailsCard
					project={project}
					isProjectAdmin={isProjectAdmin}
					samplingDesignOptions={samplingDesignOptions}
					captureMethodOptions={captureMethodOptions}
					sensitivityOptions={sensitivityOptions}
					aiModelOptions={aiModelOptions}
					isMotionDetection={!!isMotionDetection}
					isTimeLapse={!!isTimeLapse}
					getLabel={getLabel}
				/>

				{/* Devices Section */}
				<ProjectDevicesCard
					projectId={projectId}
					projectName={project.name}
				/>

				{/* Members Section */}
				<ProjectMembersCard
					project={project}
					members={members}
					membersLoading={membersLoading}
					isProjectAdmin={isProjectAdmin}
					currentUser={currentUser}
				/>
			</View>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	content: {
		padding: 16,
		paddingBottom: 32,
	},
	centerContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 32,
	},
	loadingText: {
		marginTop: 16,
	},
	errorTitle: {
		marginBottom: 8,
		textAlign: "center",
	},
	errorMessage: {
		marginBottom: 24,
		textAlign: "center",
	},
	retryButton: {
		marginTop: 8,
	},
})

