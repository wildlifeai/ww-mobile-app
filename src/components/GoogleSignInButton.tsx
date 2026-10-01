import { Alert, Keyboard, StyleSheet } from "react-native"
import { Button, Text } from "react-native-paper"
import { useGoogleSignInMutation } from "../redux/api/auth"
import { useAppDispatch } from "../redux"
import { setCredentials, triggerTutorial } from "../redux/slices/authSlice"
import { isGoogleSignInConfigured } from "../config/googleSignIn"

type Props = {
	/** The screen's own submit is running */
	disabled?: boolean
}

/**
 * "Continue with Google" for Login and Register (#350). Shown only when this
 * build has the Google client IDs.
 */
export const GoogleSignInButton = (props: Props) =>
	isGoogleSignInConfigured() ? <ContinueWithGoogle {...props} /> : null

/** On success it does what the email Login does: the tutorial, then the credentials. */
const ContinueWithGoogle = ({ disabled }: Props) => {
	const dispatch = useAppDispatch()
	const [googleSignIn, { isLoading }] = useGoogleSignInMutation()

	const onPress = async () => {
		Keyboard.dismiss()
		try {
			const response = await googleSignIn().unwrap()
			// The user closed Google's sheet: nothing to say
			if (!response) return

			// Tutorial before credentials, as in LoginScreen
			dispatch(triggerTutorial())
			dispatch(setCredentials(response))
		} catch (err) {
			const failure = err as { error?: string; data?: { reason?: string } }
			Alert.alert(
				failure?.data?.reason === "offline" ? "No connection" : "Google sign-in failed",
				failure?.error || "Google sign-in did not complete. Try again.",
				[{ text: "OK" }],
			)
		}
	}

	return (
		<Button
			mode="outlined"
			icon="google"
			testID="google-signin-button"
			onPress={onPress}
			loading={isLoading}
			disabled={disabled || isLoading}
			style={styles.button}
		>
			<Text>Continue with Google</Text>
		</Button>
	)
}

const styles = StyleSheet.create({
	button: {
		marginTop: 5,
	},
})
