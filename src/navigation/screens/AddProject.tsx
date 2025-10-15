import { useForm } from "react-hook-form"
import { StyleSheet, View } from "react-native"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWTextInput } from "../../components/ui/WWTextInput"
import { Field } from "../../components/form/Field"
import { WWButton } from "../../components/ui/WWButton"
import { useCreateProjectMutation } from "../../store/api/projectsApi"
import { useAppNavigation } from "../../hooks/useAppNavigation"
import { CreateProjectInput } from "../../types/project"

type FormData = CreateProjectInput

export const AddProject = () => {
	const navigation = useAppNavigation()
	const [createProject, { isLoading }] = useCreateProjectMutation()
	const { control, handleSubmit } = useForm<FormData>({
		defaultValues: {
			name: "",
			description: "",
			organisation_id: "", // Will need to be set from auth context
			privacy_level: "private",
			is_baited: false,
		},
	})

	const onSubmit = async (data: FormData) => {
		try {
			const project = await createProject(data).unwrap()
			navigation.navigate("AddDeployment", {
				selectedProject: {
					label: project.name,
					value: project.id,
				},
			})
		} catch (error) {
			console.error("Failed to create project:", error)
		}
	}

	return (
		<WWScreenView scrollable>
			<View style={styles.container}>
				<View style={styles.form}>
					<Field
						control={control}
						name="name"
						label="Project name"
						required
						rules={{
							required: "Project name is required",
						}}
					>
						{(field) => (
							<WWTextInput
								{...field}
								mode="outlined"
								placeholder="Enter project name"
							/>
						)}
					</Field>

					<Field
						control={control}
						name="description"
						label="Description"
					>
						{(field) => (
							<WWTextInput
								{...field}
								mode="outlined"
								placeholder="Enter description (optional)"
								multiline
								numberOfLines={4}
							/>
						)}
					</Field>

					<WWButton
						mode="contained"
						onPress={handleSubmit(onSubmit)}
						style={styles.button}
						loading={isLoading}
						disabled={isLoading}
					>
						Create Project
					</WWButton>
				</View>
			</View>
		</WWScreenView>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	form: {
		padding: 20,
		gap: 16,
	},
	button: {
		marginTop: 24,
	},
})
