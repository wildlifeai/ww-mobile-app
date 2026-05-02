/**
 * EditProjectScreen
 * Dedicated screen for editing project settings.
 * Navigated to from ProjectDetailsScreen via the gear icon.
 * 
 * Design: Matches the StartDeployment screen pattern with Card-based sections,
 * consistent gap spacing, and WWScreenView for keyboard-aware scrolling.
 */

import { useMemo, useEffect, useCallback, useRef } from "react"
import { StyleSheet, View, Alert } from "react-native"
import { Text, useTheme, ActivityIndicator } from "react-native-paper"
import { useRoute, useNavigation } from "@react-navigation/native"

import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWButton } from "../../components/ui/WWButton"
import { AppParams } from "../../navigation/types"

import { NewProjectBasicInfoSection } from './components/NewProjectBasicInfoSection'
import { NewProjectSettingsSection } from './components/NewProjectSettingsSection'
import { useProjectDetails } from './hooks/useProjectDetails'
import { useGetAiModelsQuery } from "../../redux/api/projectsApi"

export const EditProjectScreen = () => {
	const theme = useTheme()
	const route = useRoute<AppParams<"EditProjectScreen">>()
	const navigation = useNavigation()
	const { projectId } = route.params
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
	} = useGetAiModelsQuery()

	const dynamicStyles = useMemo(() => ({
		loadingLabel: { color: theme.colors.onSurfaceVariant },
		errorHeader: { color: theme.colors.error },
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
		<WWScreenView style={styles.screenView}>
			<View style={styles.container}>
				{/* Project Details Card (shared with NewProject) */}
				<NewProjectBasicInfoSection
					control={control as any}
					errors={errors as any}
				/>

				{/* Settings Section (shared with NewProject) */}
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
					showArchiveToggle={true}
				/>

				{/* Save Button */}
				<View style={styles.footer}>
					<WWButton
						mode="contained"
						onPress={handleSubmit(onSave)}
						loading={isUpdating}
						disabled={isUpdating || !isDirty}
						style={styles.saveButton}
						testID="save-button"
					>
						<Text>Save Changes</Text>
					</WWButton>
				</View>
			</View>
		</WWScreenView>
	)
}

const styles = StyleSheet.create({
	screenView: {
		paddingTop: 0,
	},
	container: {
		flex: 1,
		gap: 16,
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
	footer: {
		marginTop: 24,
		marginBottom: 32,
	},
	saveButton: {
		paddingVertical: 8,
	},
})
