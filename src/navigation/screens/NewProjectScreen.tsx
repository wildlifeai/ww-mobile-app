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

import React, { useState, useMemo } from "react"
import { StyleSheet, View } from "react-native"
import { useForm, Controller } from "react-hook-form"
import { Text, useTheme, Snackbar } from "react-native-paper"
import {
	useCreateProjectMutation,
	useGetCaptureMethodsQuery,
	useGetActivitySensitivityQuery,
	useGetAiModelsQuery,
	useGetSamplingDesignsQuery,
} from "../../redux/api/projectsApi"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWTextInput } from "../../components/ui/WWTextInput"
import { WWButton } from "../../components/ui/WWButton"
import { WWCheckbox } from "../../components/ui/WWCheckbox"
import { WWSelect } from "../../components/ui/WWSelect"
import { OfflineIndicator } from "../../components/ui/OfflineIndicator"
import { Field } from "../../components/form/Field"
import { useAppNavigation } from "../../hooks/useAppNavigation"
import { useAppSelector } from "../../redux"
import { selectCurrentOrganisation } from "../../redux/slices/authSlice"
import type { CreateProjectInput } from "../../types/project"

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

export const NewProjectScreen = () => {
	const navigation = useAppNavigation()
	const theme = useTheme()
	const currentOrganisation = useAppSelector(selectCurrentOrganisation)

	const [createProject, { isLoading }] = useCreateProjectMutation()
	const [errorMessage, setErrorMessage] = useState<string>("")
	const [showError, setShowError] = useState(false)

	// Reference Data Queries
	const { data: captureMethods } = useGetCaptureMethodsQuery()
	const { data: activitySensitivities } = useGetActivitySensitivityQuery()
	const { data: aiModels } = useGetAiModelsQuery()
	const { data: samplingDesigns } = useGetSamplingDesignsQuery()

	const {
		control,
		handleSubmit,
		watch,
		formState: { errors },
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

	// Watch for capture method selection
	const selectedCaptureMethodId = watch("capture_method_id")

	// Options for Select components
	const captureMethodOptions = useMemo(
		() =>
			captureMethods?.map((cm) => ({
				label: cm.value,
				value: cm.id.toString(),
			})) || [],
		[captureMethods],
	)

	const sensitivityOptions = useMemo(
		() =>
			activitySensitivities?.map((as) => ({
				label: as.value,
				value: as.id.toString(),
			})) || [],
		[activitySensitivities],
	)

	const aiModelOptions = useMemo(
		() =>
			aiModels?.map((m) => ({
				label: `${m.name} (${m.version})`,
				value: m.id,
			})) || [],
		[aiModels],
	)

	const samplingDesignOptions = useMemo(
		() =>
			samplingDesigns?.map((sd) => ({
				label: sd.value,
				value: sd.id.toString(),
			})) || [],
		[samplingDesigns],
	)

	// Determine if Motion Detection or Time-lapse is selected
	const isMotionDetection = useMemo(() => {
		const method = captureMethods?.find(
			(cm) => cm.id.toString() === selectedCaptureMethodId,
		)
		return method?.value === "Motion Detection"
	}, [captureMethods, selectedCaptureMethodId])

	const isTimeLapse = useMemo(() => {
		const method = captureMethods?.find(
			(cm) => cm.id.toString() === selectedCaptureMethodId,
		)
		return method?.value === "Time-lapse"
	}, [captureMethods, selectedCaptureMethodId])

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
				is_baited: data.is_baited,
				is_monitoring_marked_individuals: data.is_monitoring_marked_individuals,
				sampling_design_id: data.sampling_design_id
					? Number(data.sampling_design_id)
					: undefined,
				website: data.website.trim() || undefined,
				model_id: data.model_id || undefined,
				capture_method_id: data.capture_method_id
					? Number(data.capture_method_id)
					: undefined,
				activity_detection_sensitivity_id: data.activity_detection_sensitivity_id
					? Number(data.activity_detection_sensitivity_id)
					: undefined,
				timelapse_interval_seconds: data.timelapse_interval_seconds
					? Number(data.timelapse_interval_seconds)
					: undefined,
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

					<Field control={control} name="sampling_design_id" label="Sampling Design">
						{(field) => (
							<WWSelect
								{...field}
								options={samplingDesignOptions}
								label="Sampling Design"
							/>
						)}
					</Field>

					<Field control={control} name="capture_method_id" label="Capture Method">
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

					<Field control={control} name="model_id" label="Default AI Model (Optional)">
						{(field) => (
							<WWSelect
								{...field}
								options={aiModelOptions}
								label="Default AI Model"
							/>
						)}
					</Field>

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
