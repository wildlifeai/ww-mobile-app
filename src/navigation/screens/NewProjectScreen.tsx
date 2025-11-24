/**
 * NewProjectScreen
 * Form for creating new projects with validation
 *
 * Features:
 * - Multi-section form (Basic Info, Settings, Team Members)
 * - Form validation (name required, 3-100 chars)
 * - Offline support indicator
 * - Loading states
 * - Success navigation to projects list
 * - Error handling with user feedback
 * - Accessible form controls
 */

import React, { useState } from "react"
import { StyleSheet, View, ScrollView } from "react-native"
import { useForm, Controller } from "react-hook-form"
import { Text, useTheme, Snackbar } from "react-native-paper"
import { useCreateProjectMutation } from "../../redux/api/projectsApi"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWTextInput } from "../../components/ui/WWTextInput"
import { WWButton } from "../../components/ui/WWButton"
import { WWCheckbox } from "../../components/ui/WWCheckbox"
import { OfflineIndicator } from "../../components/ui/OfflineIndicator"
import { Field } from "../../components/form/Field"
import { AIModelSelect } from "../../components/form/AIModelSelect"
import { useAppNavigation } from "../../hooks/useAppNavigation"
import { useAppSelector } from "../../redux"
import { selectCurrentOrganisation } from "../../redux/slices/authSlice"
import type { CreateProjectInput } from "../../types/project"

interface ProjectFormData {
	name: string
	description: string
	sampling_design_id: string
	// privacy_level removed
	is_baited: boolean
	is_monitoring_marked_individuals: boolean
	website: string
	model_id?: string
}

export const NewProjectScreen = () => {
	const navigation = useAppNavigation()
	const theme = useTheme()
	const currentOrganisation = useAppSelector(selectCurrentOrganisation)

	const [createProject, { isLoading }] = useCreateProjectMutation()
	const [errorMessage, setErrorMessage] = useState<string>("")
	const [showError, setShowError] = useState(false)

	const {
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<ProjectFormData>({
		defaultValues: {
			name: "",
			description: "",
			sampling_design_id: "",
			// privacy_level: "private",
			is_baited: false,
			is_monitoring_marked_individuals: false,
			website: "",
			model_id: "",
		},
	})

	const onSubmit = async (data: ProjectFormData) => {
		console.log("🔍 NewProjectScreen - onSubmit called")
		console.log("  currentOrganisation:", currentOrganisation)
		console.log("  currentOrganisation?.id:", currentOrganisation?.id)

		if (!currentOrganisation?.id) {
			console.error("❌ No organisation selected")
			setErrorMessage(
				"No organisation selected. Please select an organisation first.",
			)
			setShowError(true)
			return
		}

		console.log("✅ Organisation check passed, creating project...")
		try {
			const input: CreateProjectInput = {
				name: data.name.trim(),
				description: data.description.trim() || undefined,
				organisation_id: currentOrganisation.id,
				// privacy_level: data.privacy_level,
				is_baited: data.is_baited,
				is_monitoring_marked_individuals: data.is_monitoring_marked_individuals,
				sampling_design_id: data.sampling_design_id ? Number(data.sampling_design_id) : undefined,
				website: data.website.trim() || undefined,
				model_id: data.model_id || undefined,
			}

			await createProject(input).unwrap()

			// Navigate back to projects list
			navigation.goBack()
		} catch (error) {
			console.error("Failed to create project:", error)
			setErrorMessage(
				error && typeof error === "object" && "error" in error
					? String(error.error)
					: "Failed to create project. Please try again.",
			)
			setShowError(true)
		}
	}

	return (
		<WWScreenView scrollable={true}>
			<OfflineIndicator />

			<View style={styles.container}>
				{/* Section: Basic Information */}
				<View style={styles.section}>
					<Text
						variant="titleMedium"
						style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
					>
						Basic Information
					</Text>

					<Field
						control={control}
						name="name"
						label="Project Name"
						required
						rules={{
							required: "Project name is required",
							minLength: {
								value: 3,
								message: "Project name must be at least 3 characters",
							},
							maxLength: {
								value: 100,
								message: "Project name must not exceed 100 characters",
							},
						}}
					>
						{(field) => (
							<WWTextInput
								{...field}
								mode="outlined"
								placeholder="Enter project name"
								error={!!errors.name}
								testID="project-name-input"
							/>
						)}
					</Field>

					<Field
						control={control}
						name="description"
						label="Description"
						rules={{
							maxLength: {
								value: 500,
								message: "Description must not exceed 500 characters",
							},
						}}
					>
						{(field) => (
							<WWTextInput
								{...field}
								mode="outlined"
								placeholder="Enter project description"
								multiline
								numberOfLines={4}
								error={!!errors.description}
								testID="project-description-input"
							/>
						)}
					</Field>

					<Field
						control={control}
						name="sampling_design_id"
						label="Sampling Design ID"
					>
						{(field) => (
							<WWTextInput
								{...field}
								mode="outlined"
								placeholder="e.g., 1"
								keyboardType="numeric"
								error={!!errors.sampling_design_id}
								testID="sampling-design-input"
							/>
						)}
					</Field>

					<Field control={control} name="website" label="Website (Optional)">
						{(field) => (
							<WWTextInput
								{...field}
								mode="outlined"
								placeholder="https://example.com"
								keyboardType="url"
								autoCapitalize="none"
								error={!!errors.website}
								testID="website-input"
							/>
						)}
					</Field>
				</View>

				{/* Section: Project Settings */}
				<View style={styles.section}>
					<Text
						variant="titleMedium"
						style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
					>
						Project Settings
					</Text>

					{/* AI Model Selection */}
					<AIModelSelect
						control={control}
						name="model_id"
						organisationId={currentOrganisation?.id || ""}
						label="AI Model (Optional)"
						required={false}
					/>

					{/* Privacy Level Removed */}

					{/* Checkboxes */}
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

				{/* Future: Team Members Section */}
				<View style={styles.section}>
					<Text
						variant="titleMedium"
						style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
					>
						Team Members
					</Text>
					<Text
						variant="bodyMedium"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						You can add team members after creating the project
					</Text>
				</View>

				{/* Submit Button */}
				<WWButton
					mode="contained"
					onPress={handleSubmit(onSubmit)}
					loading={isLoading}
					disabled={isLoading}
					style={styles.submitButton}
					testID="create-project-button"
				>
					Create Project
				</WWButton>

				{/* Error Snackbar */}
				<Snackbar
					visible={showError}
					onDismiss={() => setShowError(false)}
					duration={4000}
					action={{
						label: "Dismiss",
						onPress: () => setShowError(false),
					}}
				>
					{errorMessage}
				</Snackbar>
			</View>
		</WWScreenView>
	)
}

const styles = StyleSheet.create({
	container: {
		padding: 16,
	},
	section: {
		marginBottom: 24,
	},
	sectionTitle: {
		fontWeight: "600",
		marginBottom: 16,
	},
	radioGroup: {
		marginBottom: 16,
	},
	label: {
		marginBottom: 8,
		fontWeight: "500",
	},
	radioOptions: {
		gap: 8,
	},
	submitButton: {
		marginTop: 8,
		marginBottom: 32,
	},
})
