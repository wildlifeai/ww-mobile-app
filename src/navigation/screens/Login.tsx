import { useForm } from "react-hook-form"
import { StyleSheet, View, Image, Alert, ScrollView } from "react-native"
import { Button, Checkbox } from "react-native-paper"
import { CustomKeyboardAvoidingView } from "../../components/CustomKeyboardAvoidingView"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWTextInput } from "../../components/ui/WWTextInput"
import { Field } from "../../components/form/Field"
import { useLoginMutation } from "../../redux/api/auth"
import { useAppDispatch } from "../../redux"
import { setCredentials } from "../../redux/slices/authSlice"
import { useAppNavigation } from "../../hooks/useAppNavigation"
import { WWText } from "../../components/ui/WWText"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useState, useEffect } from "react"
import { TestDeepLink } from "../../components/TestDeepLink"

type FormData = {
	email: string
	password: string
}

export const Login = () => {
	const dispatch = useAppDispatch()
	const navigation = useAppNavigation()
	const [login, { isLoading, error }] = useLoginMutation()
	const [rememberMe, setRememberMe] = useState(false)

	const { control, handleSubmit, setValue } = useForm<FormData>({
		defaultValues: {
			email: "",
			password: "",
		},
	})

	// Load saved credentials on component mount
	useEffect(() => {
		loadSavedCredentials()
	}, [])

	const loadSavedCredentials = async () => {
		try {
			const savedEmail = await AsyncStorage.getItem("rememberedEmail")
			const savedRememberMe = await AsyncStorage.getItem("rememberMe")

			if (savedEmail && savedRememberMe === "true") {
				setValue("email", savedEmail)
				setRememberMe(true)
			}
		} catch (error) {
			console.error("Failed to load saved credentials:", error)
		}
	}

	const onSubmit = async (data: FormData) => {
		try {
			// Transform email to identifier format for existing API
			const loginData = {
				identifier: data.email,
				password: data.password,
			}

			const response = await login(loginData).unwrap()

			// Save credentials if remember me is checked
			if (rememberMe) {
				await AsyncStorage.setItem("rememberedEmail", data.email)
				await AsyncStorage.setItem("rememberMe", "true")
			} else {
				await AsyncStorage.removeItem("rememberedEmail")
				await AsyncStorage.removeItem("rememberMe")
			}

			dispatch(setCredentials(response))
		} catch (err) {
			console.error("❌ Login failed - Full error details:", {
				message: err instanceof Error ? err.message : "Unknown error",
				errorObject: err,
				stack: err instanceof Error ? err.stack : undefined,
			})

			// Extract detailed error message
			let errorMessage = "Please check your email and password and try again."
			if (err && typeof err === "object") {
				const anyErr = err as any
				if (anyErr.data?.error) {
					errorMessage = anyErr.data.error
				} else if (anyErr.error) {
					errorMessage = anyErr.error
				} else if (err instanceof Error) {
					errorMessage = err.message
				}
			}

			Alert.alert("Login Failed", errorMessage, [{ text: "OK" }])
		}
	}

	return (
		<CustomKeyboardAvoidingView>
			<WWScreenView style={styles.view}>
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
								name="email"
								label="Email"
								required
								rules={{
									required: "Email is required",
									pattern: {
										value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
										message: "Please enter a valid email address",
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

							<View style={styles.checkboxContainer}>
								<Checkbox
									status={rememberMe ? "checked" : "unchecked"}
									onPress={() => setRememberMe(!rememberMe)}
								/>
								<WWText
									style={styles.checkboxLabel}
									onPress={() => setRememberMe(!rememberMe)}
								>
									Remember me
								</WWText>
							</View>

							{error && (
								<WWText style={styles.error}>
									{(error as any)?.data?.error?.message ||
										"Login failed. Please try again."}
								</WWText>
							)}

							<Button
								mode="contained"
								testID="login-button"
								onPress={handleSubmit(onSubmit)}
								loading={isLoading}
								style={styles.button}
								disabled={isLoading}
							>
								Login
							</Button>

							<Button
								mode="text"
								testID="forgot-password-button"
								onPress={() => navigation.navigate("ForgotPassword")}
								style={styles.textButton}
								disabled={isLoading}
							>
								Forgot Password?
							</Button>

							<Button
								mode="text"
								testID="register-button"
								onPress={() => navigation.navigate("Register")}
								style={styles.textButton}
								disabled={isLoading}
							>
								Don't have an account? Register
							</Button>

							{/* Temporary test component for deep linking */}
							{__DEV__ && <TestDeepLink />}
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
	checkboxContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 5,
	},
	checkboxLabel: {
		marginLeft: 8,
		fontSize: 14,
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
