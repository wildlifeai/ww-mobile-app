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

import React, { useState, useCallback, useMemo } from "react"
import { StyleSheet, View, ScrollView, Alert } from "react-native"
import { useForm, Controller } from "react-hook-form"
import {
	Text,
	useTheme,
	ActivityIndicator,
	Card,
	Divider,
	IconButton,
	Portal,
	Dialog,
	Button,
	Avatar,
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
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWTextInput } from "../../components/ui/WWTextInput"
import { WWButton } from "../../components/ui/WWButton"
import { WWCheckbox } from "../../components/ui/WWCheckbox"
import { WWIcon } from "../../components/ui/WWIcon"
import { WWSelect } from "../../components/ui/WWSelect"
import { OfflineIndicator } from "../../components/ui/OfflineIndicator"
import { Field } from "../../components/form/Field"
import { useAppNavigation } from "../../hooks/useAppNavigation"
import { useAppSelector } from "../../redux"
import type { AppParams } from "../index"


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
	const isMotionDetection = useMemo(() => {
		const method = captureMethods?.find(cm => cm.id.toString() === selectedCaptureMethodId)
		return method?.value === "Motion Detection" || method?.value === "activityDetection"
	}, [captureMethods, selectedCaptureMethodId])

	const isTimeLapse = useMemo(() => {
		const method = captureMethods?.find(cm => cm.id.toString() === selectedCaptureMethodId)
		return method?.value === "Time-lapse" || method?.value === "timeLapse"
	}, [captureMethods, selectedCaptureMethodId])

	// Reset form when project data loads
	React.useEffect(() => {
		if (project) {
			reset({
				name: project.name,
				description: project.description || "",
				sampling_design_id: project.sampling_design_id?.toString() || "",
				website: project.website || "",
				is_baited: project.is_baited || false,
				is_monitoring_marked_individuals:
					project.is_monitoring_marked_individuals || false,
				capture_method_id: project.capture_method_id?.toString() || "",
				activity_detection_sensitivity_id: project.activity_detection_sensitivity_id?.toString() || "",
				timelapse_interval_seconds: project.timelapse_interval_seconds?.toString() || "",
				model_id: project.model_id || "",
			})
		}
	}, [project, reset])

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
			} catch (error) {
				console.error("Failed to update project:", error)
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
		} catch (error) {
			console.error("Failed to delete project:", error)
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
							} catch (error) {
								console.error("Failed to remove member:", error)
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
	const getLabel = (options: { label: string; value: string }[], value?: string | number | null) => {
		if (!value) return null
		return options.find(o => o.value === value.toString())?.label || value
	}

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
							{ color: theme.colors.onSurfaceVariant },
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
						style={[styles.errorTitle, { color: theme.colors.error }]}
					>
						Failed to load project
					</Text>
					<Text
						variant="bodyMedium"
						style={[
							styles.errorMessage,
							{ color: theme.colors.onSurfaceVariant },
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
				<Card mode="outlined" style={styles.card}>
					<Card.Content>
						<View style={styles.headerRow}>
							{isEditMode ? (
								<View style={styles.flex1}>
									<Field
										control={control}
										name="name"
										label="Project Name"
										required
										rules={{
											required: "Project name is required",
											minLength: { value: 3, message: "At least 3 characters" },
											maxLength: { value: 100, message: "Max 100 characters" },
										}}
									>
										{(field) => (
											<WWTextInput
												{...field}
												mode="outlined"
												error={!!errors.name}
												testID="project-name-input"
											/>
										)}
									</Field>
								</View>
							) : (
								<View style={styles.flex1}>
									<Text
										variant="headlineMedium"
										style={{ color: theme.colors.onSurface }}
									>
										{project.name}
									</Text>
									{project.organisation?.name && (
										<Text
											variant="bodyMedium"
											style={{
												color: theme.colors.onSurfaceVariant,
												marginTop: 4,
											}}
										>
											{project.organisation.name}
										</Text>
									)}
								</View>
							)}

							{!isEditMode && isProjectAdmin && (
								<View style={styles.actionButtons}>
									<IconButton
										icon="pencil"
										size={24}
										onPress={handleEdit}
										testID="edit-button"
									/>
									<IconButton
										icon="delete"
										size={24}
										iconColor={theme.colors.error}
										onPress={() => setShowDeleteDialog(true)}
										testID="delete-button"
									/>
								</View>
							)}
						</View>

						{/* Description */}
						{isEditMode ? (
							<Field
								control={control}
								name="description"
								label="Description"
								rules={{
									maxLength: { value: 500, message: "Max 500 characters" },
								}}
							>
								{(field) => (
									<WWTextInput
										{...field}
										mode="outlined"
										multiline
										numberOfLines={4}
										error={!!errors.description}
										testID="project-description-input"
									/>
								)}
							</Field>
						) : project.description ? (
							<Text
								variant="bodyMedium"
								style={[
									styles.description,
									{ color: theme.colors.onSurfaceVariant },
								]}
							>
								{project.description}
							</Text>
						) : (
							<Text
								variant="bodyMedium"
								style={[
									styles.description,
									{ color: theme.colors.onSurfaceDisabled },
								]}
							>
								No description
							</Text>
						)}
					</Card.Content>
				</Card>

				{/* Stats Cards */}
				{!isEditMode && (
					<View style={styles.statsContainer}>
						<Card mode="outlined" style={styles.statCard}>
							<Card.Content style={styles.statContent}>
								<WWIcon
									source="account-group"
									size={32}
									color={theme.colors.primary}
								/>
								<Text
									variant="headlineSmall"
									style={{ color: theme.colors.onSurface }}
								>
									{project.member_count || 0}
								</Text>
								<Text
									variant="bodySmall"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									Members
								</Text>
							</Card.Content>
						</Card>

						<Card mode="outlined" style={styles.statCard}>
							<Card.Content style={styles.statContent}>
								<WWIcon
									source="map-marker-multiple"
									size={32}
									color={theme.colors.primary}
								/>
								<Text
									variant="headlineSmall"
									style={{ color: theme.colors.onSurface }}
								>
									{project.deployment_count || 0}
								</Text>
								<Text
									variant="bodySmall"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									Deployments
								</Text>
							</Card.Content>
						</Card>

						<Card mode="outlined" style={styles.statCard}>
							<Card.Content style={styles.statContent}>
								<WWIcon
									source="access-point"
									size={32}
									color={theme.colors.primary}
								/>
								<Text
									variant="headlineSmall"
									style={{ color: theme.colors.onSurface }}
								>
									{project.lorawan_device_count || 0}
								</Text>
								<Text
									variant="bodySmall"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									Devices
								</Text>
							</Card.Content>
						</Card>
					</View>
				)}

				{/* Settings Section */}
				<Card mode="outlined" style={styles.card}>
					<Card.Content>
						<Text
							variant="titleMedium"
							style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
						>
							Settings
						</Text>

						{isEditMode ? (
							<View>
								<Field
									control={control}
									name="sampling_design_id"
									label="Sampling Design"
								>
									{(field) => (
										<WWSelect
											{...field}
											options={samplingDesignOptions}
											label="Sampling Design"
										/>
									)}
								</Field>

								<Field
									control={control}
									name="capture_method_id"
									label="Capture Method"
								>
									{(field) => (
										<WWSelect
											{...field}
											options={captureMethodOptions}
											label="Capture Method"
										/>
									)}
								</Field>

								{isMotionDetection && (
									<Field
										control={control}
										name="activity_detection_sensitivity_id"
										label="Motion Sensitivity"
									>
										{(field) => (
											<WWSelect
												{...field}
												options={sensitivityOptions}
												label="Motion Sensitivity"
											/>
										)}
									</Field>
								)}

								{isTimeLapse && (
									<Field
										control={control}
										name="timelapse_interval_seconds"
										label="Time-lapse Interval (seconds)"
									>
										{(field) => (
											<WWTextInput
												{...field}
												mode="outlined"
												keyboardType="numeric"
												placeholder="e.g., 60"
											/>
										)}
									</Field>
								)}

								{isProjectAdmin && (
									<Field
										control={control}
										name="model_id"
										label="Default AI Model"
									>
										{(field) => (
											<WWSelect
												{...field}
												options={aiModelOptions}
												label="Default AI Model"
											/>
										)}
									</Field>
								)}

								<Field control={control} name="website" label="Website">
									{(field) => (
										<WWTextInput
											{...field}
											mode="outlined"
											placeholder="https://example.com"
											keyboardType="url"
											autoCapitalize="none"
											testID="website-input"
										/>
									)}
								</Field>

								<Controller
									control={control}
									name="is_baited"
									render={({ field: { value, onChange } }) => (
										<WWCheckbox
											label="Using Bait"
											value={value}
											onChange={onChange}
											testID="is-baited-checkbox"
										/>
									)}
								/>

								<Controller
									control={control}
									name="is_monitoring_marked_individuals"
									render={({ field: { value, onChange } }) => (
										<WWCheckbox
											label="Monitoring Marked Individuals"
											value={value}
											onChange={onChange}
											testID="is-monitoring-marked-checkbox"
										/>
									)}
								/>
							</View>
						) : (
							<View>
								{project.sampling_design_id && (
									<View style={styles.settingRow}>
										<Text
											variant="bodyMedium"
											style={{ color: theme.colors.onSurfaceVariant }}
										>
											Sampling Design:
										</Text>
										<Text
											variant="bodyMedium"
											style={{ color: theme.colors.onSurface }}
										>
											{getLabel(samplingDesignOptions, project.sampling_design_id)}
										</Text>
									</View>
								)}

								{project.capture_method_id && (
									<View style={styles.settingRow}>
										<Text
											variant="bodyMedium"
											style={{ color: theme.colors.onSurfaceVariant }}
										>
											Capture Method:
										</Text>
										<Text
											variant="bodyMedium"
											style={{ color: theme.colors.onSurface }}
										>
											{getLabel(captureMethodOptions, project.capture_method_id)}
										</Text>
									</View>
								)}

								{project.activity_detection_sensitivity_id && (
									<View style={styles.settingRow}>
										<Text
											variant="bodyMedium"
											style={{ color: theme.colors.onSurfaceVariant }}
										>
											Motion Sensitivity:
										</Text>
										<Text
											variant="bodyMedium"
											style={{ color: theme.colors.onSurface }}
										>
											{getLabel(sensitivityOptions, project.activity_detection_sensitivity_id)}
										</Text>
									</View>
								)}

								{project.timelapse_interval_seconds && (
									<View style={styles.settingRow}>
										<Text
											variant="bodyMedium"
											style={{ color: theme.colors.onSurfaceVariant }}
										>
											Time-lapse Interval:
										</Text>
										<Text
											variant="bodyMedium"
											style={{ color: theme.colors.onSurface }}
										>
											{project.timelapse_interval_seconds}s
										</Text>
									</View>
								)}

								{project.model_id && (
									<View style={styles.settingRow}>
										<Text
											variant="bodyMedium"
											style={{ color: theme.colors.onSurfaceVariant }}
										>
											AI Model:
										</Text>
										<Text
											variant="bodyMedium"
											style={{ color: theme.colors.onSurface }}
										>
											{getLabel(aiModelOptions, project.model_id)}
										</Text>
									</View>
								)}

								{project.website && (
									<View style={styles.settingRow}>
										<Text
											variant="bodyMedium"
											style={{ color: theme.colors.onSurfaceVariant }}
										>
											Website:
										</Text>
										<Text
											variant="bodyMedium"
											style={{ color: theme.colors.primary }}
										>
											{project.website}
										</Text>
									</View>
								)}

								{project.is_baited && (
									<View style={styles.settingRow}>
										<WWIcon
											source="checkbox-marked"
											size={20}
											color={theme.colors.primary}
										/>
										<Text
											variant="bodyMedium"
											style={{ color: theme.colors.onSurface }}
										>
											Using Bait
										</Text>
									</View>
								)}

								{project.is_monitoring_marked_individuals && (
									<View style={styles.settingRow}>
										<WWIcon
											source="checkbox-marked"
											size={20}
											color={theme.colors.primary}
										/>
										<Text
											variant="bodyMedium"
											style={{ color: theme.colors.onSurface }}
										>
											Monitoring Marked Individuals
										</Text>
									</View>
								)}
							</View>
						)}
					</Card.Content>
				</Card>

				{/* Members Section */}
				{!isEditMode && (
					<Card mode="outlined" style={styles.card}>
						<Card.Content>
							<View style={styles.sectionHeader}>
								<Text
									variant="titleMedium"
									style={{ color: theme.colors.onSurface }}
								>
									Members
								</Text>
								{isProjectAdmin && (
									<Button
										mode="text"
										icon="account-multiple"
										onPress={() => {
											navigation.navigate("ProjectMembersScreen", {
												projectId: project.id,
												projectName: project.name,
											})
										}}
										testID="manage-members-button"
									>
										Manage
									</Button>
								)}

							</View>

							<Divider style={styles.divider} />

							{membersLoading ? (
								<ActivityIndicator size="small" />
							) : members && members.length > 0 ? (
								<View style={styles.membersList}>
									{members.map((member, index) => {
										const isMe = member.user_id === currentUser?.id
										const displayName = isMe
											? (currentUser.profile?.first_name
												? `${currentUser.profile.first_name} ${currentUser.profile.last_name || ""}`.trim()
												: "Me")
											: (member.user_profile?.name || "Unknown User")

										const initials = displayName
											.split(" ")
											.map(n => n[0])
											.join("")
											.toUpperCase()
											.substring(0, 2)

										return (
											<View
												key={member.user_id || `member-${index}`}
												style={styles.memberListItem}
											>
												<View style={styles.memberInfo}>
													<Avatar.Text
														size={32}
														label={initials}
														style={{ backgroundColor: theme.colors.primaryContainer }}
														labelStyle={{ color: theme.colors.onPrimaryContainer, fontSize: 12 }}
													/>
													<View style={styles.memberDetails}>
														<Text
															variant="bodyMedium"
															style={{ color: theme.colors.onSurface, fontWeight: isMe ? 'bold' : 'normal' }}
														>
															{displayName} {isMe && "(You)"}
														</Text>
														{member.role && (
															<Text
																variant="bodySmall"
																style={{ color: theme.colors.onSurfaceVariant }}
															>
																{member.role === 'project_admin' ? 'Admin' : 'Member'}
															</Text>
														)}
													</View>
												</View>
												{isProjectAdmin && !isMe && (
													<IconButton
														icon="close"
														size={20}
														iconColor={theme.colors.error}
														onPress={() => handleRemoveMember(member.user_id)}
														testID={`remove-member-${member.user_id}`}
													/>
												)}
											</View>
										)
									})}
								</View>
							) : (
								<Text
									variant="bodyMedium"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									No members yet
								</Text>
							)}
						</Card.Content>
					</Card>
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
