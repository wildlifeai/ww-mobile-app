/**
 * ProjectDetailsScreen
 * View and edit project details with member management
 *
 * Features:
 * - View mode: Display project details, stats, and members
 * - Edit mode: Toggle to edit project information
 * - Delete: Confirmation dialog before deletion
 * - Member management: Add/remove project members
 * - Offline-first: All operations work offline with background sync
 * - Loading states: Proper skeleton/spinner for data fetching
 */

import { useMemo } from "react"
import { StyleSheet, View, ScrollView } from "react-native"
import { Text, useTheme, ActivityIndicator, Button } from "react-native-paper"
import { useRoute } from "@react-navigation/native"

import { OfflineIndicator } from "../../components/ui/OfflineIndicator"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWButton } from "../../components/ui/WWButton"
import { AppParams } from "../../navigation/types"

import { ProjectHeaderCard } from './components/ProjectHeaderCard'
import { ProjectStatsCard } from './components/ProjectStatsCard'
import { ProjectSettingsCard } from './components/ProjectSettingsCard'
import { ProjectMembersCard } from './components/ProjectMembersCard'
import { ProjectDeleteDialog } from './components/ProjectDeleteDialog'
import { useProjectDetails } from './hooks/useProjectDetails'

export const ProjectDetailsScreen = () => {
	const theme = useTheme()
	const route = useRoute<AppParams<"ProjectDetailsScreen">>()
	const { projectId } = route.params

	const {
		isEditMode,
		showDeleteDialog,
		setShowDeleteDialog,
		currentUser,
		project,
		isLoading,
		error,
		refetch,
		members,
		membersLoading,
		isProjectAdmin,
		control,
		handleSubmit,
		errors,
		isDirty,
		isUpdating,
		isDeleting,
		samplingDesignOptions,
		captureMethodOptions,
		sensitivityOptions,
		aiModelOptions,
		isMotionDetection,
		isTimeLapse,
		handleEdit,
		handleCancelEdit,
		handleSave,
		handleDelete,
		handleRemoveMember,
		getLabel,
	} = useProjectDetails(projectId)

	const dynamicStyles = useMemo(() => ({
		loadingLabel: { color: theme.colors.onSurfaceVariant },
		errorHeader: { color: theme.colors.error },
		errorMessage: { color: theme.colors.onSurfaceVariant },
	}), [theme])

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

			<View style={styles.content}>
				{/* Header Card */}
				<ProjectHeaderCard
					project={project}
					isEditMode={isEditMode}
					isProjectAdmin={isProjectAdmin}
					control={control as any}
					errors={errors as any}
					onEdit={handleEdit}
					onDelete={() => setShowDeleteDialog(true)}
				/>

				{/* Stats Cards */}
				{!isEditMode && (
					<ProjectStatsCard project={project} cloudMemberCount={members?.length} />
				)}

				{/* Settings Section */}
				<ProjectSettingsCard
					project={project}
					isEditMode={isEditMode}
					isProjectAdmin={isProjectAdmin}
					control={control as any}
					samplingDesignOptions={samplingDesignOptions}
					captureMethodOptions={captureMethodOptions}
					sensitivityOptions={sensitivityOptions}
					aiModelOptions={aiModelOptions}
					isMotionDetection={!!isMotionDetection}
					isTimeLapse={!!isTimeLapse}
					getLabel={getLabel}
				/>

				{/* Members Section */}
				{!isEditMode && (
					<ProjectMembersCard
						project={project}
						members={members}
						membersLoading={membersLoading}
						isProjectAdmin={isProjectAdmin}
						currentUser={currentUser}
						handleRemoveMember={handleRemoveMember}
					/>
				)}

				{/* Edit Mode Actions */}
				{isEditMode && (
					<View style={styles.editActions}>
						<WWButton
							mode="outlined"
							onPress={handleCancelEdit}
							disabled={isUpdating}
							style={styles.actionButton}
							testID="cancel-button"
						>
							<Text>Cancel</Text>
						</WWButton>
						<WWButton
							mode="contained"
							onPress={handleSubmit(handleSave)}
							loading={isUpdating}
							disabled={isUpdating || !isDirty}
							style={styles.actionButton}
							testID="save-button"
						>
							<Text>Save Changes</Text>
						</WWButton>
					</View>
				)}
			</View>

			<ProjectDeleteDialog
				visible={showDeleteDialog}
				projectName={project.name}
				isDeleting={isDeleting}
				onDismiss={() => setShowDeleteDialog(false)}
				onDelete={handleDelete}
			/>
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
	editActions: {
		flexDirection: "row",
		gap: 12,
		marginTop: 8,
	},
	actionButton: {
		flex: 1,
	},
})
