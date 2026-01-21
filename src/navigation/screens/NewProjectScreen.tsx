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

import { useState, useMemo, useEffect, useCallback } from "react"
import { StyleSheet, View, ScrollView } from "react-native"
import { useForm, Controller } from "react-hook-form"
import {
	Text,
	useTheme,
	Snackbar,
	IconButton,
	Portal,
	Dialog,
	Button,
	Divider,
} from "react-native-paper"
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
import { useAppDispatch, useAppSelector } from "../../redux"
import { selectCurrentOrganisation, selectCurrentUser, setCurrentOrganisation } from "../../redux/slices/authSlice"
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
	const dispatch = useAppDispatch()
	const theme = useTheme()
	const currentOrganisation = useAppSelector(selectCurrentOrganisation)
	const user = useAppSelector(selectCurrentUser)

	// Auto-select organisation if missing but user has access to one
	useEffect(() => {
		if (!currentOrganisation && user?.organisations?.length) {
			console.log('🔄 NewProjectScreen: Auto-selecting default organisation')
			const defaultOrg = user.organisations[0]
			dispatch(setCurrentOrganisation(defaultOrg.id))
		}
	}, [currentOrganisation, user, dispatch])

	const [createProject, { isLoading }] = useCreateProjectMutation()
	const [errorMessage, setErrorMessage] = useState<string>("")
	const [showError, setShowError] = useState(false)
	const [samplingHelpVisible, setSamplingHelpVisible] = useState(false)
	const [captureHelpVisible, setCaptureHelpVisible] = useState(false)

	// Reference Data Queries
	const { data: captureMethods } = useGetCaptureMethodsQuery()
	const { data: activitySensitivities } = useGetActivitySensitivityQuery()
	const { data: aiModels } = useGetAiModelsQuery()
	const { data: samplingDesigns } = useGetSamplingDesignsQuery()

	const {
		control,
		handleSubmit,
		watch,
		setValue,
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
			timelapse_interval_seconds: "30", // Default timelapse interval
			model_id: "",
		},
	})

	// Watch for capture method selection
	const selectedCaptureMethodId = watch("capture_method_id")

	// Set defaults when reference data loads
	useEffect(() => {
		if (samplingDesigns?.length && !watch("sampling_design_id")) {
			setValue("sampling_design_id", samplingDesigns[0].id.toString())
		}
	}, [samplingDesigns, watch, setValue])

	useEffect(() => {
		if (captureMethods?.length && !watch("capture_method_id")) {
			// Prefer 'Motion Detection' or 'activityDetection'
			const defaultMethod = captureMethods.find(
				(cm) => cm.value === "Motion Detection" || cm.value === "activityDetection"
			) || captureMethods[0]
			setValue("capture_method_id", defaultMethod.id.toString())
		}
	}, [captureMethods, watch, setValue])

	useEffect(() => {
		if (activitySensitivities?.length && !watch("activity_detection_sensitivity_id")) {
			// Prefer 'Medium'
			const defaultSens = activitySensitivities.find(s => s.value === 'Medium') || activitySensitivities[0]
			setValue("activity_detection_sensitivity_id", defaultSens.id.toString())
		}
	}, [activitySensitivities, watch, setValue])

	useEffect(() => {
		if (aiModels?.length && !watch("model_id")) {
			setValue("model_id", aiModels[0].id)
		}
	}, [aiModels, watch, setValue])

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
		return (
			method?.value === "Motion Detection" || method?.value === "activityDetection"
		)
	}, [captureMethods, selectedCaptureMethodId])

	const isTimeLapse = useMemo(() => {
		const method = captureMethods?.find(
			(cm) => cm.id.toString() === selectedCaptureMethodId,
		)
		return method?.value === "Time-lapse" || method?.value === "timeLapse"
	}, [captureMethods, selectedCaptureMethodId])

	const onSubmit = useCallback(async (data: ProjectFormData) => {
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
	}, [currentOrganisation, createProject, navigation])

	return (
		<WWScreenView scrollable={true}>
			<OfflineIndicator />

			<View style={styles.container}>
				{/* Section: Basic Information */}
				<View style={styles.section}>
					<Text
						variant="titleMedium"
						style={styles.sectionTitle}
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
						style={styles.sectionTitle}
					>
						Project Settings
					</Text>

					<View style={styles.fieldRow}>
						<View style={styles.flex1}>
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
						</View>
						<IconButton
							icon="help-circle-outline"
							size={24}
							onPress={() => setSamplingHelpVisible(true)}
							style={styles.helpIcon}
							iconColor={theme.colors.primary}
						/>
					</View>

					<View style={styles.fieldRow}>
						<View style={styles.flex1}>
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
						</View>
						<IconButton
							icon="help-circle-outline"
							size={24}
							onPress={() => setCaptureHelpVisible(true)}
							style={styles.helpIcon}
							iconColor={theme.colors.primary}
						/>
					</View>

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

				{/* Help Dialog */}
				<Portal>
					<Dialog
						visible={samplingHelpVisible}
						onDismiss={() => setSamplingHelpVisible(false)}
						style={styles.dialog}
					>
						<Dialog.Title>Sampling Designs</Dialog.Title>
						<Dialog.ScrollArea>
							<ScrollView contentContainerStyle={styles.dialogScrollContent}>
								<Text style={styles.helpItem}>
									<Text style={styles.bold}>Simple random:</Text> random
									distribution of sampling locations
								</Text>
								<Divider style={styles.divider} />

								<Text style={styles.helpItem}>
									<Text style={styles.bold}>Systematic random:</Text> random
									distribution of sampling locations, but arranged in a regular
									pattern
								</Text>
								<Divider style={styles.divider} />

								<Text style={styles.helpItem}>
									<Text style={styles.bold}>Clustered random:</Text> random
									distribution of sampling locations, but clustered in arrays
								</Text>
								<Divider style={styles.divider} />

								<Text style={styles.helpItem}>
									<Text style={styles.bold}>Experimental:</Text> non-random
									distribution aimed to study an effect, including the
									before-after control-impact (BACI) design
								</Text>
								<Divider style={styles.divider} />

								<Text style={styles.helpItem}>
									<Text style={styles.bold}>Targeted:</Text> non-random
									distribution optimized for capturing specific target species
									(often using various bait types)
								</Text>
								<Divider style={styles.divider} />

								<Text style={styles.helpItem}>
									<Text style={styles.bold}>Opportunistic:</Text> opportunistic
									camera trapping (usually with a small number of cameras).
								</Text>
							</ScrollView>
						</Dialog.ScrollArea>
						<Dialog.Actions>
							<Button onPress={() => setSamplingHelpVisible(false)}>
								Close
							</Button>
						</Dialog.Actions>
					</Dialog>
				</Portal>

				{/* Capture Method Help Dialog */}
				<Portal>
					<Dialog
						visible={captureHelpVisible}
						onDismiss={() => setCaptureHelpVisible(false)}
						style={styles.dialog}
					>
						<Dialog.Title>Capture Methods</Dialog.Title>
						<Dialog.ScrollArea>
							<ScrollView contentContainerStyle={styles.dialogScrollContent}>
								<Text style={styles.helpItem}>
									<Text style={styles.bold}>activityDetection:</Text> The camera
									uses the motion-detection sensor to record photos
								</Text>
								<Divider style={styles.divider} />

								<Text style={styles.helpItem}>
									<Text style={styles.bold}>timeLapse:</Text> Set a timer (e.g.
									every 30 seconds) for the camera to take photos.
								</Text>
							</ScrollView>
						</Dialog.ScrollArea>
						<Dialog.Actions>
							<Button onPress={() => setCaptureHelpVisible(false)}>
								Close
							</Button>
						</Dialog.Actions>
					</Dialog>
				</Portal>
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
	fieldRow: {
		flexDirection: "row",
		alignItems: "flex-start", // Align top to handle different heights
		gap: 8,
	},
	flex1: {
		flex: 1,
	},
	helpIcon: {
		margin: 0,
		marginTop: 8, // Align with input field visually
	},
	helpItem: {
		marginBottom: 8,
		lineHeight: 20,
	},
	bold: {
		fontWeight: "bold",
	},
	divider: {
		marginVertical: 8,
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
	dialog: {
		maxHeight: "80%",
	},
	dialogScrollContent: {
		paddingVertical: 16,
	},
})
