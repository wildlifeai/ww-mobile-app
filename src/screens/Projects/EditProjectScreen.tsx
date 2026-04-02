/**
 * EditProjectScreen
 * Dedicated screen for editing project settings.
 * Navigated to from ProjectDetailsScreen via the gear icon.
 */

import { useMemo, useEffect, useCallback, useRef } from "react"
import { StyleSheet, View, ScrollView, Alert } from "react-native"
import { Text, useTheme, ActivityIndicator, Divider } from "react-native-paper"
import { useRoute, useNavigation } from "@react-navigation/native"
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWButton } from "../../components/ui/WWButton"
import { AppParams } from "../../navigation/types"

import { Field } from '../../components/form/Field'
import { WWTextInput } from '../../components/ui/WWTextInput'
import { NewProjectSettingsSection } from './components/NewProjectSettingsSection'
import { useProjectDetails } from './hooks/useProjectDetails'
import { useGetAiModelsQuery } from "../../redux/api/projectsApi"

export const EditProjectScreen = () => {
	const theme = useTheme()
	const route = useRoute<AppParams<"EditProjectScreen">>()
	const navigation = useNavigation()
	const { projectId } = route.params
	const insets = useSafeAreaInsets()
	const isSavingRef = useRef(false)

	const {
		project,
		isLoading,
		error,
		refetch,
		control,
		handleSubmit,
		errors,
		isDirty,
		isUpdating,
		samplingDesignOptions,
		captureMethodOptions,
		sensitivityOptions,
		aiModelOptions,
		isMotionDetection,
		isTimeLapse,
		handleSave,
	} = useProjectDetails(projectId)

	const {
		isLoading: isLoadingModels,
		error: modelsError,
		data: aiModels
	} = useGetAiModelsQuery()
	const hasAiModels = !!(aiModels && aiModels.length > 0)

	const dynamicStyles = useMemo(() => ({
		loadingLabel: { color: theme.colors.onSurfaceVariant },
		errorHeader: { color: theme.colors.error },
		errorMessage: { color: theme.colors.onSurfaceVariant },
	}), [theme])

	// Set header title
	useEffect(() => {
		navigation.setOptions({ title: 'Edit Project' })
	}, [navigation])

	// Intercept back navigation when there are unsaved changes
	useEffect(() => {
		const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
			if (!isDirty || isSavingRef.current) return

			e.preventDefault()
			Alert.alert(
				'Unsaved Changes',
				'You have unsaved changes. Are you sure you want to discard them?',
				[
					{ text: 'Keep Editing', style: 'cancel' },
					{
						text: 'Discard',
						style: 'destructive',
						onPress: () => navigation.dispatch(e.data.action),
					},
				]
			)
		})

		return unsubscribe
	}, [navigation, isDirty])

	// Save and go back
	const onSave = useCallback(async (data: any) => {
		try {
			await handleSave(data)
			// Bypass the beforeRemove guard — save succeeded, safe to leave
			isSavingRef.current = true
			if (navigation.canGoBack()) {
				navigation.goBack()
			}
		} catch {
			// handleSave already shows an Alert on failure
			isSavingRef.current = false
		}
	}, [handleSave, navigation])

	// Loading state
	if (isLoading) {
		return (
			<WWScreenView scrollable={false}>
				<View style={styles.centerContainer}>
					<ActivityIndicator size="large" />
					<Text
						variant="bodyMedium"
						style={[styles.loadingText, dynamicStyles.loadingLabel]}
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
					<WWButton mode="contained" onPress={() => refetch()} style={styles.retryButton}>
						<Text>Retry</Text>
					</WWButton>
				</View>
			</WWScreenView>
		)
	}

	return (
		<ScrollView style={styles.container}>
			<View style={[styles.content, { paddingBottom: 32 + insets.bottom }]}>
				{/* Project Name */}
				<Field
					control={control as any}
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

				{/* Description */}
				<Field
					control={control as any}
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

				<Divider style={styles.divider} />

				{/* Settings Section (reused from NewProject) */}
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
					hasAiModels={hasAiModels}
					showArchiveToggle={true}
				/>

				{/* Action Buttons */}
				<View style={styles.editActions}>
					<WWButton
						mode="outlined"
						onPress={() => navigation.goBack()}
						disabled={isUpdating}
						style={styles.actionButton}
						testID="cancel-button"
					>
						<Text>Cancel</Text>
					</WWButton>
					<WWButton
						mode="contained"
						onPress={handleSubmit(onSave)}
						loading={isUpdating}
						disabled={isUpdating || !isDirty}
						style={styles.actionButton}
						testID="save-button"
					>
						<Text>Save Changes</Text>
					</WWButton>
				</View>
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
	retryButton: {
		marginTop: 8,
	},
	divider: {
		marginVertical: 16,
	},
	editActions: {
		flexDirection: "row",
		gap: 12,
		marginTop: 24,
	},
	actionButton: {
		flex: 1,
	},
})
