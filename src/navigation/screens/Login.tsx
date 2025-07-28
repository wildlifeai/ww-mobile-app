import { useForm } from "react-hook-form"
import { StyleSheet, View, Image } from "react-native"
import { Button } from "react-native-paper"
import { CustomKeyboardAvoidingView } from "../../components/CustomKeyboardAvoidingView"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWTextInput } from "../../components/ui/WWTextInput"
import { Field } from "../../components/form/Field"
import { useLoginMutation } from "../../redux/api/auth"
import { useAppDispatch } from "../../redux"
import { setCredentials } from "../../redux/slices/authSlice"
import { useAppNavigation } from "../../hooks/useAppNavigation"
import { WWText } from "../../components/ui/WWText"
import Config from "../../utils/environment"

type FormData = {
	identifier: string
	password: string
}

export const Login = () => {
	const dispatch = useAppDispatch()
	const navigation = useAppNavigation()
	const [login, { isLoading, error }] = useLoginMutation()

	const { control, handleSubmit } = useForm<FormData>({
		defaultValues: {
			identifier: "",
			password: "",
		},
	})

	const onSubmit = async (data: FormData) => {
		try {
			const response = await login(data).unwrap()
			dispatch(setCredentials(response))
		} catch (err) {
			console.error("Login failed:", err)
		}
	}

	return (
		<CustomKeyboardAvoidingView>
			<WWScreenView style={styles.view}>
				<View style={styles.container}>
					<View style={styles.logoContainer}>
						<Image
							source={require("../../assets/ww-logo-1.png")}
							style={styles.logo}
							resizeMode="contain"
						/>
					</View>
					<View style={styles.form}>
						<Field
							control={control}
							name="identifier"
							label="Email or Username"
							required
							rules={{
								required: "Email or username is required",
							}}
						>
							{(field) => (
								<WWTextInput
									{...field}
									mode="outlined"
									textContentType="emailAddress"
									keyboardType="email-address"
								/>
							)}
						</Field>

						<Field
							control={control}
							name="password"
							label="Password"
							required
							rules={{
								required: "Password is required",
							}}
						>
							{(field) => (
								<WWTextInput {...field} mode="outlined" secureTextEntry />
							)}
						</Field>

						{error && (
							<WWText style={styles.error}>
								{(error as any)?.data?.error?.message || JSON.stringify(error)}
							</WWText>
						)}

						<Button
							mode="contained"
							onPress={handleSubmit(onSubmit)}
							loading={isLoading}
							style={styles.button}
						>
							Login
						</Button>

						<Button
							mode="text"
							onPress={() => navigation.navigate("Register")}
							style={styles.button}
						>
							Don't have an account? Register
						</Button>

						<WWText style={styles.apiBase}>API: {Config.API_BASE}</WWText>
					</View>
				</View>
			</WWScreenView>
		</CustomKeyboardAvoidingView>
	)
}

const styles = StyleSheet.create({
	view: {
		flex: 1,
	},
	container: {
		flex: 1,
		justifyContent: "center",
	},
	logoContainer: {
		alignItems: "center",
		marginBottom: 40,
	},
	logo: {
		width: 150,
		height: 150,
	},
	form: {
		padding: 20,
		gap: 10,
	},
	button: {
		marginTop: 10,
	},
	error: {
		color: "red",
		textAlign: "center",
	},
	apiBase: {
		fontSize: 10,
		textAlign: "center",
		opacity: 0.5,
	},
})
