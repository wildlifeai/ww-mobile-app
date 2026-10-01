import { useState, useCallback, useMemo } from "react"
import { Alert } from "react-native"
import { useForm } from "react-hook-form"
import { useAppSelector } from "../../../redux"
import { logError } from '../../../utils/logger'
import {
	useGetProjectByIdQuery,
	useUpdateProjectMutation,
	useGetProjectMembersQuery,
	useRemoveProjectMemberMutation,
	useGetCaptureMethodsQuery,
	useGetActivitySensitivityQuery,
	useGetAiModelsQuery,
	useGetSamplingDesignsQuery,
} from "../../../redux/api/projectsApi"
import { formatUtcMinutes, parseUtcMinutes, resolveProjectFlash } from "../../../utils/projectFlash"

export interface ProjectFormData {
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
	flash_mode: string
	flash_led: string
	flash_window_start_minutes_utc: string
	flash_window_minutes: string
}

/**
 * Asks before archiving and resolves with the answer, so the save can wait for
 * it. Dismissing the alert counts as Cancel.
 */
const confirmArchive = (): Promise<boolean> =>
	new Promise((resolve) => {
		Alert.alert(
			"Archive Project",
			"Are you sure you want to archive this project? To unarchive projects you will need to contact the Wildlife Watcher team.",
			[
				{ text: "Cancel", style: "cancel", onPress: () => resolve(false) },
				{ text: "Continue", style: "destructive", onPress: () => resolve(true) },
			],
			{ cancelable: true, onDismiss: () => resolve(false) },
		)
	})

export const useProjectDetails = (projectId: string, initialEditMode = false) => {
	// State
	const [isEditMode, setIsEditMode] = useState(initialEditMode)
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
	const { data: captureMethods } = useGetCaptureMethodsQuery(undefined, { refetchOnMountOrArgChange: true })
	const { data: activitySensitivities } = useGetActivitySensitivityQuery(undefined, { refetchOnMountOrArgChange: true })
	const { data: aiModels } = useGetAiModelsQuery(undefined, { refetchOnMountOrArgChange: true })
	const { data: samplingDesigns } = useGetSamplingDesignsQuery(undefined, { refetchOnMountOrArgChange: true })

	// Mutations
	const [updateProject, { isLoading: isUpdating }] = useUpdateProjectMutation()
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
			record_gps_in_images: false,
			lorawan_required: false,
			flash_mode: "off",
			flash_led: "ir",
			flash_window_start_minutes_utc: "",
			flash_window_minutes: "",
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
			model_id: project.model_id || "__none__",
			// Missing until September 2026: Edit Project showed the box unticked
			// whatever the project held, and saving dropped any change to it
			record_gps_in_images: project.record_gps_in_images || false,
			lorawan_required: project.lorawan_required || false,
			// Whatever the row holds, normalised: a value outside the check
			// constraint resolves to the app's fallback rather than showing an
			// option the camera would not accept.
			flash_mode: resolveProjectFlash(project).mode,
			flash_led: resolveProjectFlash(project).led,
			flash_window_start_minutes_utc: typeof project.flash_window_start_minutes_utc === 'number'
				? formatUtcMinutes(project.flash_window_start_minutes_utc)
				: "",
			flash_window_minutes: project.flash_window_minutes?.toString() || "",
		} : undefined,
	})

	// Watch fields for conditional rendering
	const selectedCaptureMethodId = watch("capture_method_id")
	const selectedFlashMode = watch("flash_mode")

	// Options for Select components
	const captureMethodOptions = useMemo(() =>
		captureMethods?.map(cm => ({ label: cm.value, value: cm.id.toString() })) || [],
		[captureMethods]
	)

	const sensitivityOptions = useMemo(() =>
		activitySensitivities?.map(as => ({ label: as.value, value: as.id.toString() })) || [],
		[activitySensitivities]
	)

	const aiModelOptions = useMemo(() => [
		...(aiModels?.map(m => ({ label: `${m.name} (${m.version})`, value: m.id })) || []),
	], [aiModels])

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

	/**
	 * Resolves true once the project is written, false when the write failed
	 * (which has already been shown). The caller leaves the screen only on true.
	 *
	 * There is no refetch: updateProject invalidates this project's tag, which
	 * refreshes getProjectById for every screen still showing it. A refetch here
	 * threw once the Edit screen had gone and turned a written project into
	 * "Update Failed" (#191).
	 */
	const handleSave = useCallback(
		async (data: ProjectFormData): Promise<boolean> => {
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
						model_id: (data.model_id && data.model_id !== '__none__') ? data.model_id : null,
						record_gps_in_images: data.record_gps_in_images,
						lorawan_required: data.lorawan_required,
						flash_mode: data.flash_mode,
						flash_led: data.flash_led,
						flash_window_start_minutes_utc: data.flash_mode === 'time_of_day'
							? parseUtcMinutes(data.flash_window_start_minutes_utc)
							: null,
						flash_window_minutes: data.flash_mode === 'time_of_day' && data.flash_window_minutes
							? Number(data.flash_window_minutes)
							: null,
					},
				}).unwrap()
			} catch (err) {
				logError("Failed to update project:", err)
				Alert.alert(
					"Update Failed",
					"Failed to update project. Please try again.",
					[{ text: "OK" }],
				)
				return false
			}

			setIsEditMode(false)
			return true
		},
		[projectId, updateProject],
	)

	/**
	 * Archiving takes a project out of the app, so it is its own action rather
	 * than one of the project's settings (#191). Asks first, and resolves true
	 * only once the project is written; the caller then leaves the screen.
	 */
	const handleArchive = useCallback(async (): Promise<boolean> => {
		const confirmed = await confirmArchive()
		if (!confirmed) return false
		try {
			await updateProject({
				id: projectId,
				updates: { is_active: false, is_archived: true },
			}).unwrap()
		} catch (err) {
			logError("Failed to archive project:", err)
			Alert.alert("Archive Failed", "The project was not archived. Please try again.", [{ text: "OK" }])
			return false
		}
		return true
	}, [projectId, updateProject])

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

	return {
		// State
		isEditMode,
		showDeleteDialog,
		setShowDeleteDialog,
		currentUser,

		// Data
		project,
		isLoading,
		error,
		refetch,
		members,
		membersLoading,
		isProjectAdmin: project?.role === 'project_admin',

		// Form / Computed
		control,
		handleSubmit,
		errors,
		isDirty,
		isUpdating,

		// Options
		samplingDesignOptions,
		captureMethodOptions,
		sensitivityOptions,
		aiModelOptions,
		isMotionDetection,
		isTimeLapse,
		selectedFlashMode,

		// Handlers
		handleEdit,
		handleCancelEdit,
		handleSave,
		handleArchive,
		handleRemoveMember,
		getLabel,
	}
}
