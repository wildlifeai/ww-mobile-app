import { useForm } from "react-hook-form"
import { StyleSheet, View } from "react-native"
import { Text } from "react-native-paper"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWSelect } from "../../components/ui/WWSelect"
import { WWTextInput } from "../../components/ui/WWTextInput"
import { Field } from "../../components/form/Field"
import { WWButton } from "../../components/ui/WWButton"
import { useAppNavigation } from "../../hooks/useAppNavigation"
import { useRoute, useFocusEffect } from "@react-navigation/native"
import { AppParams } from "../../navigation/types"
import { useGetProjectsQuery } from "../../redux/api/projectsApi"
import { useCallback } from "react"
import { useAppSelector } from "../../redux"
import { log } from '../../utils/logger'


type FormData = {
	project: string
	deploymentName: string
}

export const AddDeployment = () => {
	const navigation = useAppNavigation()
	const route = useRoute<AppParams<"AddDeployment">>()
	const userId = useAppSelector((state) => state.authentication.user?.id)
	const currentOrganisation = useAppSelector((state) => state.authentication.currentOrganisation)

	// Fetch projects for selection
	const { data: projects, refetch } = useGetProjectsQuery(
		{ userId: userId!, organisationId: currentOrganisation?.id! },
		{ skip: !userId || !currentOrganisation?.id }
	)
	const { control, handleSubmit, setValue } = useForm<FormData>({
		defaultValues: {
			project: "",
			deploymentName: "",
		},
	})

	useFocusEffect(
		useCallback(() => {
			// Refresh projects when screen comes into focus
			refetch()

			// Set selected project from route params if available
			if (route.params?.selectedProject) {
				setValue("project", route.params.selectedProject.value)
			}
		}, [refetch, route.params?.selectedProject, setValue]),
	)

	const onSubmit = async (data: FormData) => {
		log("Form data:", data)
		// TODO: Handle form submission
	}

	return (
		<WWScreenView>
			<View style={styles.container}>
				<View style={styles.form}>
					<Field
						control={control}
						name="project"
						label="Project"
						required
						rules={{
							required: "Project is required",
						}}
					>
						{(field) => (
							<WWSelect
								{...field}
								label="Project"
								options={[
									{ label: "Add project", value: "add" },
									...(projects?.map((project) => ({
										label: project.name,
										value: project.id,
									})) || []),
								]}
								onSelectEffect={(value) => {
									if (value === "add") {
										navigation.navigate("NewProjectScreen")
									}
								}}
							/>
						)}
					</Field>

					<Field
						control={control}
						name="deploymentName"
						label="Deployment name"
						required
						rules={{
							required: "Deployment name is required",
						}}
					>
						{(field) => (
							<WWTextInput
								{...field}
								mode="outlined"
								placeholder="Enter deployment name"
							/>
						)}
					</Field>

					<WWButton
						mode="contained"
						onPress={handleSubmit(onSubmit)}
						style={styles.button}
					>
						<Text>Confirm & Search for Device</Text>
					</WWButton>
				</View>
			</View>
		</WWScreenView>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
	},
	form: {
		padding: 20,
		gap: 16,
	},
	button: {
		marginTop: 24,
	},
})
