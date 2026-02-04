import React from "react"
import { View, Button, Alert } from "react-native"
import * as Linking from "expo-linking"
import { useAppNavigation } from "../hooks/useAppNavigation"

export const TestDeepLink = () => {
	const navigation = useAppNavigation()

	const testDeepLink = async () => {
		try {
			// Test navigating directly
			console.log("Testing direct navigation to ForgotPassword with reset mode")
			navigation.navigate("ForgotPassword", {
				token: "test-token-123",
				mode: "reset",
			})
			Alert.alert("Success", "Navigated to ForgotPassword in reset mode")
		} catch (error) {
			console.error("Navigation error:", error)
			Alert.alert("Error", "Failed to navigate")
		}
	}

	const testOpenURL = async () => {
		// For Expo Go, we need to use the exp:// URL format
		const expoUrl = Linking.createURL("auth/reset-password", {
			queryParams: {
				token_hash: "test123",
				type: "recovery",
			},
		})

		console.log("Testing Expo URL:", expoUrl)

		// This should work in Expo Go
		const canOpen = await Linking.canOpenURL(expoUrl)
		console.log("Can open Expo URL:", canOpen)

		// Also test the scheme URL
		const schemeUrl =
			"wildlifewatcher://auth/reset-password?token_hash=test123&type=recovery"
		const canOpenScheme = await Linking.canOpenURL(schemeUrl)
		console.log("Can open scheme URL:", canOpenScheme)

		Alert.alert(
			"URL Test Results",
			`Expo URL: ${expoUrl}\nCan open: ${canOpen}\n\nScheme URL: ${schemeUrl}\nCan open: ${canOpenScheme}`,
		)
	}

	return (
		<View style={{ padding: 20 }}>
			<Button title="Test Direct Navigation" onPress={testDeepLink} />
			<View style={{ height: 10 }} />
			<Button title="Test Deep Link URL" onPress={testOpenURL} />
		</View>
	)
}
