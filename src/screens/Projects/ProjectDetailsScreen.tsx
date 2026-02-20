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

import { useState, useCallback, useMemo } from "react"
import { StyleSheet, View, ScrollView, Alert } from "react-native"
import { useForm } from "react-hook-form"
import {
	Text,
	useTheme,
	ActivityIndicator,
	Portal,
	Dialog,
	Button,
} from "react-native-paper"
import { useRoute } from "@react-navigation/native"
import {
	useGetProjectByIdQuery,
	useUpdateProjectMutation,
	useDeleteProjectMutation,
	useGetProjectMembersQuery,
	useRemoveProjectMemberMutation,
	useGetCaptureMethodsQuery,
	useGetActivitySensitivityQuery,
	useGetAiModelsQuery,
	useGetSamplingDesignsQuery,
} from "../../redux/api/projectsApi"
import { OfflineIndicator } from "../../components/ui/OfflineIndicator"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWButton } from "../../components/ui/WWButton"
import { useAppNavigation } from "../../hooks/useAppNavigation"
import { useAppSelector } from "../../redux"
import { AppParams } from "../../navigation/types"
import { logError } from '../../utils/logger'
import { ProjectHeaderCard } from './components/ProjectHeaderCard'
import { ProjectStatsCard } from './components/ProjectStatsCard'
import { ProjectSettingsCard } from './components/ProjectSettingsCard'
import { ProjectMembersCard } from './components/ProjectMembersCard'



interface ProjectFormData {
	name: string
	description: string
	sampling_design_id: string
	website: string
	is_baited: boolean
	is_monitoring_marked_individuals: boolean
	capture_method_id: string
	activity_detection_sensitivity_id: string
	timelapse_interval_seconds: string
	model_id: string
}

export const ProjectDetailsScreen = () => {
	const navigation = useAppNavigation()
	const theme = useTheme()
	const route = useRoute<AppParams<"ProjectDetailsScreen">>()
	const { projectId } = route.params

	// State
	const [isEditMode, setIsEditMode] = useState(false)
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)


	// Redux
	const currentUser = useAppSelector((state) => state.authentication.user)

	// Queries
	const {
		data: project,
		isLoading,
		error,
		refetch,
	} = useGetProjectByIdQuery(projectId)
	const { data: members, isLoading: membersLoading } =
		useGetProjectMembersQuery(projectId)

	// Reference Data Queries
	const { data: captureMethods } = useGetCaptureMethodsQuery()
	const { data: activitySensitivities } = useGetActivitySensitivityQuery()
	const { data: aiModels } = useGetAiModelsQuery()
	const { data: samplingDesigns } = useGetSamplingDesignsQuery()

	// Mutations
	const [updateProject, { isLoading: isUpdating }] = useUpdateProjectMutation()
	const [deleteProject, { isLoading: isDeleting }] = useDeleteProjectMutation()
	const [removeMember] = useRemoveProjectMemberMutation()

	// Form
	const {
		control,
		handleSubmit,
		reset,
		watch,
		formState: { errors, isDirty },
	} = useForm<ProjectFormData>({
		defaultValues: {
			name: "",
			description: "",
			sampling_design_id: "",
			website: "",
			is_baited: false,
			is_monitoring_marked_individuals: false,
			capture_method_id: "",
			activity_detection_sensitivity_id: "",
			timelapse_interval_seconds: "",
			model_id: "",
		},
		values: project ? {
			name: project.name,
			description: project.description || "",
			sampling_design_id: project.sampling_design_id?.toString() || "",
			website: project.website || "",
			is_baited: project.is_baited || false,
			is_monitoring_marked_individuals: project.is_monitoring_marked_individuals || false,
			capture_method_id: project.capture_method_id?.toString() || "",
			activity_detection_sensitivity_id: project.activity_detection_sensitivity_id?.toString() || "",
			timelapse_interval_seconds: project.timelapse_interval_seconds?.toString() || "",
			model_id: project.model_id || "",
		} : undefined,
	})

	// Watch fields for conditional rendering
	const selectedCaptureMethodId = watch("capture_method_id")

	// Options for Select components
	const captureMethodOptions = useMemo(() =>
		captureMethods?.map(cm => ({ label: cm.value, value: cm.id.toString() })) || [],
		[captureMethods]
	)

	const sensitivityOptions = useMemo(() =>
		activitySensitivities?.map(as => ({ label: as.value, value: as.id.toString() })) || [],
		[activitySensitivities]
	)

	const aiModelOptions = useMemo(() =>
		aiModels?.map(m => ({ label: `${m.name} (${m.version})`, value: m.id })) || [],
		[aiModels]
	)

	const samplingDesignOptions = useMemo(() =>
		samplingDesigns?.map(sd => ({ label: sd.value, value: sd.id.toString() })) || [],
		[samplingDesigns]
	)

	// Determine if Motion Detection or Time-lapse is selected
	const selectedMethod = useMemo(() => {
		const methodId = isEditMode ? selectedCaptureMethodId : project?.capture_method_id?.toString()
		return captureMethods?.find(cm => cm.id.toString() === methodId)
	}, [captureMethods, selectedCaptureMethodId, isEditMode, project?.capture_method_id])

	const isMotionDetection = useMemo(() => {
		return selectedMethod?.value === "Motion Detection" || selectedMethod?.value === "activityDetection"
	}, [selectedMethod])

	const isTimeLapse = useMemo(() => {
		return selectedMethod?.value === "Time-lapse" || selectedMethod?.value === "timeLapse"
	}, [selectedMethod])

	// Handlers
	const handleEdit = useCallback(() => {
		setIsEditMode(true)
	}, [])

	const handleCancelEdit = useCallback(() => {
		reset()
		setIsEditMode(false)
	}, [reset])

	const handleSave = useCallback(
		async (data: ProjectFormData) => {
			try {
				await updateProject({
					id: projectId,
					updates: {
						name: data.name.trim(),
						description: data.description.trim() || null,
						sampling_design_id: data.sampling_design_id ? Number(data.sampling_design_id) : null,
						website: data.website.trim() || null,
						is_baited: data.is_baited,
						is_monitoring_marked_individuals: data.is_monitoring_marked_individuals,
						capture_method_id: data.capture_method_id ? Number(data.capture_method_id) : null,
						activity_detection_sensitivity_id: data.activity_detection_sensitivity_id ? Number(data.activity_detection_sensitivity_id) : null,
						timelapse_interval_seconds: data.timelapse_interval_seconds ? Number(data.timelapse_interval_seconds) : null,
						model_id: data.model_id || null,
					},
				}).unwrap()

				setIsEditMode(false)
				refetch()
			} catch (err) {
				logError("Failed to update project:", err)
				Alert.alert(
					"Update Failed",
					"Failed to update project. Please try again.",
					[{ text: "OK" }],
				)
			}
		},
		[projectId, updateProject, refetch],
	)

	const handleDelete = useCallback(async () => {
		try {
			await deleteProject(projectId).unwrap()
			setShowDeleteDialog(false)
			navigation.goBack()
		} catch (err) {
			logError("Failed to delete project:", err)
			Alert.alert(
				"Delete Failed",
				"Failed to delete project. Please try again.",
				[{ text: "OK" }],
			)
		}
	}, [projectId, deleteProject, navigation])

	const handleRemoveMember = useCallback(
		async (userId: string) => {
			Alert.alert(
				"Remove Member",
				"Are you sure you want to remove this member from the project?",
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Remove",
						style: "destructive",
						onPress: async () => {
							try {
								await removeMember({ projectId, userId }).unwrap()
							} catch (err) {
								logError("Failed to remove member:", err)
								Alert.alert("Error", "Failed to remove member")
							}
						},
					},
				],
			)
		},
		[projectId, removeMember],
	)



	// Helper to get label for ID
	const getLabel = useCallback((options: { label: string; value: string }[], value?: string | number | null) => {
		if (!value) return null
		return options.find(o => o.value === value.toString())?.label || value
	}, [])

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
						Retry
					</Button>
				</View>
			</WWScreenView>
		)
	}

	const isProjectAdmin = project.role === 'project_admin'

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
					<ProjectStatsCard project={project} />
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
							Cancel
						</WWButton>
						<WWButton
							mode="contained"
							onPress={handleSubmit(handleSave)}
							loading={isUpdating}
							disabled={isUpdating || !isDirty}
							style={styles.actionButton}
							testID="save-button"
						>
							Save Changes
						</WWButton>
					</View>
				)}
			</View>

			{/* Delete Confirmation Dialog */}
			<Portal>
				<Dialog
					visible={showDeleteDialog}
					onDismiss={() => setShowDeleteDialog(false)}
				>
					<Dialog.Title>Delete Project</Dialog.Title>
					<Dialog.Content>
						<Text variant="bodyMedium">
							Are you sure you want to delete "{project.name}"? This action
							cannot be undone.
						</Text>
					</Dialog.Content>
					<Dialog.Actions>
						<Button
							onPress={() => setShowDeleteDialog(false)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							onPress={handleDelete}
							loading={isDeleting}
							disabled={isDeleting}
							textColor={theme.colors.error}
							testID="confirm-delete-button"
						>
							Delete
						</Button>
					</Dialog.Actions>
				</Dialog>
			</Portal>
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
	card: {
		marginBottom: 16,
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		justifyContent: "space-between",
		marginBottom: 8,
	},
	flex1: {
		flex: 1,
	},
	actionButtons: {
		flexDirection: "row",
		marginLeft: 8,
	},
	description: {
		marginTop: 8,
		lineHeight: 20,
	},
	statsContainer: {
		flexDirection: "row",
		gap: 12,
		marginBottom: 16,
	},
	statCard: {
		flex: 1,
	},
	statContent: {
		alignItems: "center",
		paddingVertical: 16,
	},
	sectionTitle: {
		fontWeight: "600",
		marginBottom: 16,
	},
	sectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 8,
	},
	settingRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 12,
	},
	privacyGroup: {
		marginBottom: 16,
	},
	label: {
		marginBottom: 8,
		fontWeight: "500",
	},
	radioOptions: {
		gap: 8,
	},
	divider: {
		marginVertical: 12,
	},
	membersList: {
		gap: 12,
	},
	memberListItem: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 12,
	},
	memberInfo: {
		flexDirection: "row",
		alignItems: "center",
		flex: 1,
	},
	memberDetails: {
		marginLeft: 12,
	},
	memberRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
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
