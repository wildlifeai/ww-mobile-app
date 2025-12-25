import { useForm } from "react-hook-form"
import { StyleSheet, View, Image, Alert, ScrollView } from "react-native"
import { Button } from "react-native-paper"
import { CustomKeyboardAvoidingView } from "../../components/CustomKeyboardAvoidingView"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWTextInput } from "../../components/ui/WWTextInput"
import { Field } from "../../components/form/Field"
import { useRegisterMutation } from "../../redux/api/auth"
import { useAppDispatch } from "../../redux"
import { setCredentials } from "../../redux/slices/authSlice"
import { useAppNavigation } from "../../hooks/useAppNavigation"
import { WWText } from "../../components/ui/WWText"

type FormData = {
	name: string
	email: string
	password: string
	confirmPassword: string
	organization: string
}

export const Register = () => {
	const dispatch = useAppDispatch()
	const navigation = useAppNavigation()
	const [register, { isLoading, error: apiError }] = useRegisterMutation()

	const { control, handleSubmit, setError } = useForm<FormData>({
		defaultValues: {
			name: "",
			email: "",
			password: "",
			confirmPassword: "",
			organization: "",
		},
	})

	const onSubmit = async (data: FormData) => {
		if (data.password !== data.confirmPassword) {
			setError("confirmPassword", {
				type: "manual",
				message: "Passwords do not match",
			})
			return
		}

		try {
			const response = await register({
				name: data.name,
				email: data.email,
				password: data.password,
				organization: data.organization?.trim() || undefined,
			}).unwrap()

			// Handle pending confirmation state
			if (response.isPendingConfirmation) {
				Alert.alert(
					"Registration Successful",
					"Please check your email and click the confirmation link to activate your account.",
					[{ text: "OK", onPress: () => navigation.navigate("Login") }],
				)
				return
			}

			dispatch(setCredentials(response))
		} catch (err) {
			console.error("Registration failed:", JSON.stringify(err))
			Alert.alert(
				"Registration Failed",
				"Please check your information and try again.",
				[{ text: "OK" }],
			)
		}
	}

	return (
		<CustomKeyboardAvoidingView>
<WWScreenView style={styles.view} scrollable={false}>
				<ScrollView
					style={styles.scrollView}
					contentContainerStyle={styles.scrollContent}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
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
								name="name"
								label="Full Name"
								required
								rules={{
									required: "Name is required",
									minLength: {
										value: 3,
										message: "Name must be at least 3 characters",
									},
								}}
							>
								{(field) => (
									<WWTextInput
										{...field}
										testID="name-input"
										mode="outlined"
									/>
								)}
							</Field>

							<Field
								control={control}
								name="email"
								label="Email"
								required
								rules={{
									required: "Email is required",
									pattern: {
										value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
										message: "Invalid email address",
									},
								}}
							>
								{(field) => (
									<WWTextInput
										{...field}
										testID="email-input"
										mode="outlined"
										textContentType="emailAddress"
										keyboardType="email-address"
										autoCapitalize="none"
									/>
								)}
							</Field>

							<Field
								control={control}
								name="organization"
								label="Organization (Optional)"
								rules={{
									maxLength: {
										value: 100,
										message: "Organization name must be less than 100 characters",
									},
								}}
							>
								{(field) => (
									<WWTextInput
										{...field}
										testID="organization-input"
										mode="outlined"
										textContentType="organizationName"
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
									minLength: {
										value: 6,
										message: "Password must be at least 6 characters",
									},
								}}
							>
								{(field) => (
									<WWTextInput
										{...field}
										testID="password-input"
										mode="outlined"
										secureTextEntry
									/>
								)}
							</Field>

							<Field
								control={control}
								name="confirmPassword"
								label="Confirm Password"
								required
								rules={{
									required: "Please confirm your password",
								}}
							>
								{(field) => (
									<WWTextInput
										{...field}
										testID="confirm-password-input"
										mode="outlined"
										secureTextEntry
									/>
								)}
							</Field>

							{apiError && (
								<WWText style={styles.error}>
									{(apiError as any)?.data?.error?.message ||
										JSON.stringify(apiError)}
								</WWText>
							)}

							<Button
								mode="contained"
								testID="register-button"
								onPress={handleSubmit(onSubmit)}
								loading={isLoading}
								style={styles.button}
								disabled={isLoading}
							>
								Register
							</Button>

							<Button
								mode="text"
								testID="login-navigation-button"
								onPress={() => navigation.navigate("Login")}
								style={styles.textButton}
								disabled={isLoading}
							>
								Already have an account? Login
							</Button>
						</View>
					</View>
				</ScrollView>
			</WWScreenView>
		</CustomKeyboardAvoidingView>
	)
}


const styles = StyleSheet.create({
	view: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
		paddingBottom: 300,
	},
	container: {
		flex: 1,
		justifyContent: "center",
	},
	logoContainer: {
		alignItems: "center",
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
		marginTop: 15,
	},
	textButton: {
		marginTop: 5,
	},
	error: {
		color: "red",
		textAlign: "center",
		marginTop: 10,
	},
})

