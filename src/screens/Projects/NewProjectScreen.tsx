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
import { StyleSheet, View } from "react-native"
import { useForm } from "react-hook-form"
import {
	Snackbar,
	Text,
} from "react-native-paper"
import { projectsApi } from "../../redux/api/projectsApi"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWButton } from "../../components/ui/WWButton"
import { OfflineIndicator } from "../../components/ui/OfflineIndicator"
import { useAppNavigation } from "../../hooks/useAppNavigation"
import { useAppDispatch, useAppSelector } from "../../redux"
import { selectCurrentOrganisation, selectCurrentUser, setCurrentOrganisation } from "../../redux/slices/authSlice"
import type { CreateProjectInput } from "../../types/project"
import { log, logError } from '../../utils/logger'
import { NewProjectBasicInfoSection } from './components/NewProjectBasicInfoSection'
import { NewProjectSettingsSection } from './components/NewProjectSettingsSection'


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
	record_gps_in_images: boolean
	lorawan_required: boolean
}

export const NewProjectScreen = () => {
	const navigation = useAppNavigation()
	const dispatch = useAppDispatch()
	const currentOrganisation = useAppSelector(selectCurrentOrganisation)
	const user = useAppSelector(selectCurrentUser)

	// Auto-select organisation if missing but user has access to one
	useEffect(() => {
		if (!currentOrganisation && user?.organisations?.length) {
			log('🔄 NewProjectScreen: Auto-selecting default organisation')
			const defaultOrg = user.organisations[0]
			dispatch(setCurrentOrganisation(defaultOrg.id))
		}
	}, [currentOrganisation, user, dispatch])
	const [createProject, { isLoading }] = projectsApi.useCreateProjectMutation()
	const [errorMessage, setErrorMessage] = useState<string>("")
	const [showError, setShowError] = useState(false)
	const { data: captureMethods } = projectsApi.useGetCaptureMethodsQuery(undefined, { refetchOnMountOrArgChange: true })
	const { data: activitySensitivities } = projectsApi.useGetActivitySensitivityQuery(undefined, { refetchOnMountOrArgChange: true })
	const { data: aiModels, isLoading: isLoadingModels, error: modelsError } = projectsApi.useGetAiModelsQuery(undefined, { refetchOnMountOrArgChange: true })
	const { data: samplingDesigns } = projectsApi.useGetSamplingDesignsQuery(undefined, { refetchOnMountOrArgChange: true })

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
			record_gps_in_images: false,
			lorawan_required: false,
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
				label: `${m.name} v${m.version}`,
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
		log("🔍 NewProjectScreen - onSubmit called")
		log("  currentOrganisation:", currentOrganisation)
		log("  currentOrganisation?.id:", currentOrganisation?.id)

		if (!currentOrganisation?.id) {
			logError("❌ No organisation selected")
			setErrorMessage(
				"No organisation selected. Please select an organisation first.",
			)
			setShowError(true)
			return
		}

		log("✅ Organisation check passed, creating project...")
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
				record_gps_in_images: data.record_gps_in_images,
				lorawan_required: data.lorawan_required,
			}

			await createProject(input).unwrap()

			// Navigate back to projects list
			navigation.goBack()
		} catch (error) {
			logError("Failed to create project:", error)
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
				<NewProjectBasicInfoSection control={control as any} errors={errors as any} />

				{/* Section: Project Settings */}
				<NewProjectSettingsSection 
					control={control as any}
					samplingDesignOptions={samplingDesignOptions}
					captureMethodOptions={captureMethodOptions}
					sensitivityOptions={sensitivityOptions}
					aiModelOptions={aiModelOptions}
					isMotionDetection={isMotionDetection}
					isTimeLapse={isTimeLapse}
					isLoadingModels={isLoadingModels}
					modelsError={modelsError}
					hasAiModels={!!aiModels?.length}
				/>

				{/* Submit Button */}
				<WWButton
					mode="contained"
					onPress={handleSubmit(onSubmit)}
					loading={isLoading}
					disabled={isLoading}
					style={styles.submitButton}
					testID="create-project-button"
				>
					<Text>Create Project</Text>
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

	submitButton: {
		marginTop: 8,
		marginBottom: 32,
	},
})
