import { useState, useCallback, useMemo } from "react"
import { Alert } from "react-native"
import { useForm } from "react-hook-form"
import { useAppNavigation } from "../../../hooks/useAppNavigation"
import { useAppSelector } from "../../../redux"
import { logError } from '../../../utils/logger'
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
} from "../../../redux/api/projectsApi"

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
	is_archived: boolean
	lorawan_required: boolean
}

export const useProjectDetails = (projectId: string) => {
	const navigation = useAppNavigation()

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
			is_archived: false,
			lorawan_required: false,
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
			is_archived: project.is_archived || project.is_active === false,
			lorawan_required: project.lorawan_required || false,
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
			const performSave = async () => {
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
							is_active: !data.is_archived,
							is_archived: data.is_archived,
							lorawan_required: data.lorawan_required,
						},
					}).unwrap()

					setIsEditMode(false)
					refetch()
					if (data.is_archived) {
						navigation.goBack() // Exit to projects list if archived
					}
				} catch (err) {
					logError("Failed to update project:", err)
					Alert.alert(
						"Update Failed",
						"Failed to update project. Please try again.",
						[{ text: "OK" }],
					)
				}
			}

			// Intercept if they are archiving the project
			if (data.is_archived && project?.is_active) {
				Alert.alert(
					"Archive Project",
					"Are you sure you want to archive this project? To unarchive projects you will need to contact the Wildlife Watcher team.",
					[
						{ text: "Cancel", style: "cancel" },
						{
							text: "Continue",
							style: "destructive",
							onPress: performSave,
						},
					]
				)
				return // Early return, saving will happen inside onPress
			}

			// Normal save
			await performSave()
		},
		[projectId, updateProject, refetch, project, navigation],
	)

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

		// Handlers
		handleEdit,
		handleCancelEdit,
		handleSave,
		handleRemoveMember,
		getLabel,
	}
}
