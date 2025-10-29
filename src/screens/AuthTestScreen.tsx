import React, { useState, useEffect } from "react"
import { View, ScrollView, Alert } from "react-native"
import {
	Button,
	Card,
	Text,
	TextInput,
	Chip,
	ActivityIndicator,
	Divider,
} from "react-native-paper"
import { useSupabaseAuth } from "../hooks/useSupabaseAuth"
import { supabase } from "../services/supabase"
import { apiTestSuite } from "../services/apiTest"

/**
 * Authentication Test Screen
 *
 * Comprehensive testing interface for Supabase authentication:
 * - User registration and login
 * - Auth state management
 * - API connectivity tests
 * - Session persistence validation
 */
export const AuthTestScreen: React.FC = () => {
	const {
		user,
		token,
		loading,
		isLoggedIn,
		login,
		register,
		logout,
		checkAuthStatus,
		refreshSession,
		resetPassword,
	} = useSupabaseAuth()

	// Form state
	const [email, setEmail] = useState("test@example.com")
	const [password, setPassword] = useState("testpassword123")
	const [username, setUsername] = useState("testuser")
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [testResults, setTestResults] = useState<string[]>([])

	// Add test result
	const addTestResult = (result: string) => {
		setTestResults((prev) => [
			...prev,
			`${new Date().toLocaleTimeString()}: ${result}`,
		])
	}

	const handleRegister = async () => {
		setIsSubmitting(true)
		try {
			const authResponse = await register({ email, password, username })

			// Check if this is a pending confirmation response
			if ((authResponse as any).isPendingConfirmation) {
				addTestResult(
					`📧 Registration successful! Please check your email to confirm your account.`,
				)
				Alert.alert(
					"Check Your Email",
					"Registration successful! Please check your email to confirm your account before logging in.",
				)
			} else {
				addTestResult(`✅ Registration and login successful for ${email}`)
				Alert.alert("Success", "Registration and login successful!")
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Registration failed"
			addTestResult(`❌ Registration failed: ${message}`)
			Alert.alert("Registration Failed", message)
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleLogin = async () => {
		setIsSubmitting(true)
		try {
			await login({ identifier: email, password })
			addTestResult(`✅ Login successful for ${email}`)
			Alert.alert("Success", "Login successful!")
		} catch (error) {
			const message = error instanceof Error ? error.message : "Login failed"
			addTestResult(`❌ Login failed: ${message}`)
			Alert.alert("Login Failed", message)
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleLogout = async () => {
		try {
			await logout()
			addTestResult("✅ Logout successful")
			Alert.alert("Success", "Logged out successfully!")
		} catch (error) {
			const message = error instanceof Error ? error.message : "Logout failed"
			addTestResult(`❌ Logout failed: ${message}`)
			Alert.alert("Logout Failed", message)
		}
	}

	const handleCheckAuthStatus = async () => {
		try {
			const isAuth = await checkAuthStatus()
			addTestResult(
				`✅ Auth status check: ${
					isAuth ? "Authenticated" : "Not authenticated"
				}`,
			)
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Auth check failed"
			addTestResult(`❌ Auth check failed: ${message}`)
		}
	}

	const handleRefreshSession = async () => {
		try {
			await refreshSession()
			addTestResult("✅ Session refresh successful")
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Session refresh failed"
			addTestResult(`❌ Session refresh failed: ${message}`)
		}
	}

	const handleResetPassword = async () => {
		try {
			await resetPassword(email)
			addTestResult(`✅ Password reset email sent to ${email}`)
			Alert.alert("Success", "Password reset email sent!")
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Password reset failed"
			addTestResult(`❌ Password reset failed: ${message}`)
			Alert.alert("Reset Failed", message)
		}
	}

	const runConnectivityTests = async () => {
		addTestResult("🚀 Starting API connectivity tests...")

		try {
			// Test basic connection
			const basicConnection = await apiTestSuite.testBasicConnection()
			addTestResult(`${basicConnection ? "✅" : "❌"} Basic connection test`)

			// Test database access
			const databaseAccess = await apiTestSuite.testDatabaseAccess()
			addTestResult(`${databaseAccess ? "✅" : "❌"} Database access test`)

			// Test reference data
			const referenceData = await apiTestSuite.testReferenceData()
			addTestResult(`${referenceData ? "✅" : "❌"} Reference data test`)

			// Test authenticated operations (only if logged in)
			if (isLoggedIn) {
				const authOps = await apiTestSuite.testAuthenticatedOperations()
				addTestResult(`${authOps ? "✅" : "❌"} Authenticated operations test`)
			} else {
				addTestResult("⚠️ Skipped authenticated operations (not logged in)")
			}

			// Test real-time subscription
			const realtime = await apiTestSuite.testRealTimeSubscription()
			addTestResult(`${realtime ? "✅" : "❌"} Real-time subscription test`)

			addTestResult("🎉 API connectivity tests completed")
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "API tests failed"
			addTestResult(`❌ API tests failed: ${message}`)
		}
	}

	const clearTestResults = () => {
		setTestResults([])
	}

	// Test auth state on mount
	useEffect(() => {
		addTestResult("📱 AuthTestScreen mounted")
		if (isLoggedIn) {
			addTestResult(`✅ User already authenticated: ${user?.email}`)
		} else {
			addTestResult("ℹ️ No active authentication session")
		}
	}, [])

	return (
		<ScrollView style={{ flex: 1, padding: 16 }}>
			<Text
				variant="headlineMedium"
				style={{ marginBottom: 16, textAlign: "center" }}
			>
				🔐 Supabase Auth Test
			</Text>

			{/* Auth Status Card */}
			<Card style={{ marginBottom: 16 }}>
				<Card.Title title="Authentication Status" />
				<Card.Content>
					<View
						style={{
							flexDirection: "row",
							flexWrap: "wrap",
							gap: 8,
							marginBottom: 8,
						}}
					>
						<Chip
							icon={isLoggedIn ? "check" : "close"}
							mode={isLoggedIn ? "flat" : "outlined"}
						>
							{isLoggedIn ? "Logged In" : "Not Logged In"}
						</Chip>
						<Chip icon={loading ? "loading" : "check"} mode="outlined">
							{loading ? "Loading" : "Ready"}
						</Chip>
						<Chip icon={token ? "key" : "key-outline"} mode="outlined">
							{token ? "Has Token" : "No Token"}
						</Chip>
					</View>

					{user && (
						<View>
							<Text>
								<Text style={{ fontWeight: "bold" }}>Email:</Text> {user.email}
							</Text>
							<Text>
								<Text style={{ fontWeight: "bold" }}>Username:</Text>{" "}
								{user.username}
							</Text>
							<Text>
								<Text style={{ fontWeight: "bold" }}>ID:</Text> {user.id}
							</Text>
							<Text>
								<Text style={{ fontWeight: "bold" }}>Confirmed:</Text>{" "}
								{user.confirmed ? "Yes" : "No"}
							</Text>
						</View>
					)}
				</Card.Content>
			</Card>

			{/* Registration/Login Form */}
			<Card style={{ marginBottom: 16 }}>
				<Card.Title title="Authentication Actions" />
				<Card.Content>
					<TextInput
						label="Email"
						value={email}
						onChangeText={setEmail}
						keyboardType="email-address"
						autoCapitalize="none"
						style={{ marginBottom: 8 }}
					/>

					<TextInput
						label="Password"
						value={password}
						onChangeText={setPassword}
						secureTextEntry
						style={{ marginBottom: 8 }}
					/>

					<TextInput
						label="Username (for registration)"
						value={username}
						onChangeText={setUsername}
						autoCapitalize="none"
						style={{ marginBottom: 16 }}
					/>

					<View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
						<Button
							mode="contained"
							onPress={handleRegister}
							disabled={isSubmitting || loading}
							style={{ flex: 1 }}
						>
							{isSubmitting ? "Registering..." : "Register"}
						</Button>

						<Button
							mode="outlined"
							onPress={handleLogin}
							disabled={isSubmitting || loading}
							style={{ flex: 1 }}
						>
							{isSubmitting ? "Logging in..." : "Login"}
						</Button>
					</View>

					{isLoggedIn && (
						<Button
							mode="contained-tonal"
							onPress={handleLogout}
							style={{ marginBottom: 8 }}
						>
							Logout
						</Button>
					)}

					<View style={{ flexDirection: "row", gap: 8 }}>
						<Button
							mode="outlined"
							onPress={handleCheckAuthStatus}
							style={{ flex: 1 }}
							compact
						>
							Check Status
						</Button>

						<Button
							mode="outlined"
							onPress={handleRefreshSession}
							style={{ flex: 1 }}
							compact
						>
							Refresh Session
						</Button>
					</View>

					<Button
						mode="text"
						onPress={handleResetPassword}
						style={{ marginTop: 8 }}
					>
						Reset Password
					</Button>
				</Card.Content>
			</Card>

			{/* API Tests */}
			<Card style={{ marginBottom: 16 }}>
				<Card.Title title="API Connectivity Tests" />
				<Card.Content>
					<Button
						mode="contained"
						onPress={runConnectivityTests}
						style={{ marginBottom: 8 }}
					>
						Run All API Tests
					</Button>

					<Text variant="bodySmall" style={{ color: "#666" }}>
						Tests database connection, authentication, and real-time features
					</Text>
				</Card.Content>
			</Card>

			{/* Test Results */}
			<Card style={{ marginBottom: 32 }}>
				<Card.Title
					title="Test Results"
					right={(props) => (
						<Button {...props} onPress={clearTestResults} compact>
							Clear
						</Button>
					)}
				/>
				<Card.Content>
					{testResults.length === 0 ? (
						<Text style={{ fontStyle: "italic", color: "#666" }}>
							No test results yet. Run some tests above!
						</Text>
					) : (
						<View>
							{testResults.map((result, index) => (
								<Text
									key={index}
									style={{
										fontSize: 12,
										fontFamily: "monospace",
										marginBottom: 4,
										color: result.includes("❌")
											? "#F44336"
											: result.includes("✅")
											? "#4CAF50"
											: "#333",
									}}
								>
									{result}
								</Text>
							))}
						</View>
					)}
				</Card.Content>
			</Card>
		</ScrollView>
	)
}
