import { useForm } from "react-hook-form"
import { StyleSheet, View } from "react-native"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWTextInput } from "../../components/ui/WWTextInput"
import { Field } from "../../components/form/Field"
import { WWButton } from "../../components/ui/WWButton"
import { useCreateProjectMutation } from "../../redux/api/projects"
import { useAppNavigation } from "../../hooks/useAppNavigation"
import { ProjectCreate } from "../../types/api.types"

type FormData = ProjectCreate

export const AddProject = () => {
	const navigation = useAppNavigation()
	const [createProject, { isLoading }] = useCreateProjectMutation()
	const { control, handleSubmit } = useForm<FormData>({
		defaultValues: {
			title: "",
			acronym: "",
			description: "",
			samplingDesign: "",
			captureMethod: "",
			individualAnimals: 0,
			observationLevel: "",
			projectTeam: "{}",
			projectPrivacy: "",
		},
	})

	const onSubmit = async (data: FormData) => {
		try {
			const project = await createProject({ data }).unwrap()
			navigation.navigate("AddDeployment", {
				selectedProject: {
					label: project.title,
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
						name="title"
						label="Project title"
						required
						rules={{
							required: "Project title is required",
						}}
					>
						{(field) => (
							<WWTextInput
								{...field}
								mode="outlined"
								placeholder="Enter project title"
							/>
						)}
					</Field>

					<Field
						control={control}
						name="acronym"
						label="Acronym"
						required
						rules={{
							required: "Acronym is required",
						}}
					>
						{(field) => (
							<WWTextInput
								{...field}
								mode="outlined"
								placeholder="Enter acronym"
							/>
						)}
					</Field>

					<Field
						control={control}
						name="samplingDesign"
						label="Sampling design"
						required
						rules={{
							required: "Sampling design is required",
						}}
					>
						{(field) => (
							<WWTextInput
								{...field}
								mode="outlined"
								placeholder="Enter sampling design"
							/>
						)}
					</Field>

					<Field
						control={control}
						name="description"
						label="Description"
						required
						rules={{
							required: "Description is required",
						}}
					>
						{(field) => (
							<WWTextInput
								{...field}
								mode="outlined"
								placeholder="Enter description"
								multiline
								numberOfLines={4}
							/>
						)}
					</Field>

					<Field
						control={control}
						name="captureMethod"
						label="Capture method"
						required
						rules={{
							required: "Capture method is required",
						}}
					>
						{(field) => (
							<WWTextInput
								{...field}
								mode="outlined"
								placeholder="Enter capture method"
							/>
						)}
					</Field>

					<Field
						control={control}
						name="individualAnimals"
						label="Number of individual animals"
						required
						rules={{
							required: "Number of individual animals is required",
							min: {
								value: 0,
								message: "Must be 0 or greater",
							},
						}}
					>
						{(field) => (
							<WWTextInput
								{...field}
								mode="outlined"
								placeholder="Enter number of individual animals"
								keyboardType="numeric"
								value={field.value.toString()}
								onChangeText={(value) => field.onChange(parseInt(value) || 0)}
							/>
						)}
					</Field>

					<Field
						control={control}
						name="observationLevel"
						label="Observation level"
						required
						rules={{
							required: "Observation level is required",
						}}
					>
						{(field) => (
							<WWTextInput
								{...field}
								mode="outlined"
								placeholder="Enter observation level"
							/>
						)}
					</Field>

					<Field
						control={control}
						name="projectPrivacy"
						label="Project privacy"
						required
						rules={{
							required: "Project privacy is required",
						}}
					>
						{(field) => (
							<WWTextInput
								{...field}
								mode="outlined"
								placeholder="Enter project privacy"
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
