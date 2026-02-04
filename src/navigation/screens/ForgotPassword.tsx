import { useForm } from "react-hook-form"
import { StyleSheet, View, Image, Alert, ScrollView } from "react-native"
import { Button } from "react-native-paper"
// import { CustomKeyboardAvoidingView } from "../../components/CustomKeyboardAvoidingView"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWTextInput } from "../../components/ui/WWTextInput"
import { Field } from "../../components/form/Field"
import { useAppNavigation } from "../../hooks/useAppNavigation"
import { WWText } from "../../components/ui/WWText"
import { KEYBOARD_AVOID_PADDING } from "../../constants/layout"
import { resetPassword, updatePasswordWithToken, getCurrentSession } from "../../services/auth"
import { useState, useEffect } from "react"
import { useRoute } from "@react-navigation/native"
import { useAppDispatch } from "../../redux"
import { setCredentials } from "../../redux/slices/authSlice"
import { log } from '../../utils/logger'


type FormData = {
	email: string
}

type ResetFormData = {
	password: string
	confirmPassword: string
}

export const ForgotPassword = () => {
	const navigation = useAppNavigation()
	const route = useRoute<any>()
	const dispatch = useAppDispatch()
	const [isLoading, setIsLoading] = useState(false)
	const [isEmailSent, setIsEmailSent] = useState(false)
	// Initialize reset mode based on route params - check once
	const [isResetMode, setIsResetMode] = useState(() => {
		log("ForgotPassword: Initial route.params:", route.params)
		return !!(route.params?.token || route.params?.mode === "reset")
	})

	// Only update reset mode if it changes from false to true (not back and forth)
	useEffect(() => {
		log("ForgotPassword: route.params changed:", route.params)
		if (
			!isResetMode &&
			(route.params?.token || route.params?.mode === "reset")
		) {
			log("ForgotPassword: Setting reset mode to true")
			setIsResetMode(true)
		}
	}, [route.params?.token, route.params?.mode, isResetMode])

	const { control, handleSubmit } = useForm<FormData>({
		defaultValues: {
			email: "",
		},
	})

	const resetForm = useForm<ResetFormData>({
		defaultValues: {
			password: "",
			confirmPassword: "",
		},
		// Prevent form from resetting when component re-renders
		mode: "onChange",
	})

	const { control: resetControl, handleSubmit: handleResetSubmit } = resetForm

	const onSubmit = async (data: FormData) => {
		setIsLoading(true)
		try {
			await resetPassword(data.email)
			setIsEmailSent(true)
			Alert.alert(
				"Reset Email Sent",
				"Please check your email for instructions to reset your password.",
				[
					{
						text: "Back to Login",
						onPress: () => navigation.navigate("Login"),
					},
				],
			)
		} catch (error) {
			logError("Password reset failed:", error)
			Alert.alert(
				"Reset Failed",
				"There was an error sending the reset email. Please check your email address and try again.",
				[{ text: "OK" }],
			)
		} finally {
			setIsLoading(false)
		}
	}

	const onResetSubmit = async (data: ResetFormData) => {
		if (data.password !== data.confirmPassword) {
			Alert.alert("Error", "Passwords do not match")
			return
		}

		const token = route.params?.token
		const refreshToken = route.params?.refreshToken
		if (!token) {
			Alert.alert(
				"Error",
				"Reset token is missing. Please request a new password reset.",
			)
			return
		}

		setIsLoading(true)
		try {
			await updatePasswordWithToken(token, data.password, refreshToken)

			// Get the current session after password update
			const session = await getCurrentSession()

			if (session) {
				// Update Redux state with the new session
				dispatch(setCredentials(session))
			}

			Alert.alert(
				"Password Updated",
				"Your password has been successfully updated. You're now logged in!",
				[
					{
						text: "Continue",
						onPress: () => {
							// User is now authenticated and Redux state is updated
							// MainNavigation will automatically show the home screen
						},
					},
				],
			)
		} catch (error) {
			logError("Password update failed:", error)
			Alert.alert(
				"Update Failed",
				"There was an error updating your password. The reset link may have expired. Please request a new password reset.",
				[{ text: "OK" }],
			)
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<WWScreenView style={styles.view} scrollable={true}>
			<View style={styles.container}>
				<View style={styles.logoContainer}>
					<Image
						source={require("../../assets/ww-logo-1.png")}
						style={styles.logo}
						resizeMode="contain"
					/>
				</View>
				<View style={styles.form}>
					{isResetMode ? (
						<>
							<WWText style={styles.title}>Set New Password</WWText>
							<WWText style={styles.subtitle}>
								Enter your new password below.
							</WWText>

							<Field
								control={resetControl}
								name="password"
								label="New Password"
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
									<WWTextInput {...field} mode="outlined" secureTextEntry />
								)}
							</Field>

							<Field
								control={resetControl}
								name="confirmPassword"
								label="Confirm Password"
								required
								rules={{
									required: "Please confirm your password",
								}}
							>
								{(field) => (
									<WWTextInput {...field} mode="outlined" secureTextEntry />
								)}
							</Field>

							<Button
								mode="contained"
								onPress={handleResetSubmit(onResetSubmit)}
								loading={isLoading}
								style={styles.button}
								disabled={isLoading}
							>
								Update Password
							</Button>
						</>
					) : (
						<>
							<WWText style={styles.title}>Reset Your Password</WWText>
							<WWText style={styles.subtitle}>
								Enter your email address and we'll send you instructions to
								reset your password.
							</WWText>

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
										mode="outlined"
										textContentType="emailAddress"
										keyboardType="email-address"
										autoCapitalize="none"
									/>
								)}
							</Field>

							<Button
								mode="contained"
								onPress={handleSubmit(onSubmit)}
								loading={isLoading}
								style={styles.button}
								disabled={isLoading || isEmailSent}
							>
								{isEmailSent ? "Email Sent" : "Send Reset Email"}
							</Button>
						</>
					)}

					<Button
						mode="text"
						onPress={() => navigation.navigate("Login")}
						style={styles.textButton}
						disabled={isLoading}
					>
						Back to Login
					</Button>
				</View>
			</View>
		</WWScreenView>
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
		paddingBottom: KEYBOARD_AVOID_PADDING,
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
	title: {
		fontSize: 24,
		fontWeight: "bold",
		textAlign: "center",
		marginBottom: 10,
	},
	subtitle: {
		fontSize: 16,
		textAlign: "center",
		marginBottom: 20,
		opacity: 0.7,
	},
	button: {
		marginTop: 15,
	},
	textButton: {
		marginTop: 10,
	},
})
