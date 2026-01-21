import React, { useState, useEffect, useCallback } from "react"
import { View, ScrollView, Alert, StyleSheet } from "react-native"
import {
	Button,
	Card,
	Text,
	TextInput,
	Chip,
} from "react-native-paper"
import { useSupabaseAuth } from "../hooks/useSupabaseAuth"
import * as apiTestSuite from "../services/tests/apiTest"

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

	const clearTestResults = useCallback(() => {
		setTestResults([])
	}, [])

	const renderCardTitleRight = useCallback((props: any) => (
		<Button {...props} onPress={clearTestResults} compact>
			Clear
		</Button>
	), [clearTestResults])

	// Form state
	const [email, setEmail] = useState("test@example.com")
	const [password, setPassword] = useState("testpassword123")
	const [username, setUsername] = useState("testuser")
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [testResults, setTestResults] = useState<string[]>([])

	// Add test result
	const addTestResult = useCallback((result: string) => {
		setTestResults((prev: string[]) => [
			...prev,
			`${new Date().toLocaleTimeString()}: ${result}`,
		])
	}, [])

	const handleRegister = useCallback(async () => {
		setIsSubmitting(true)
		try {
			const authResponse = await register({ email, password, name: username })

			// Check if this is a pending confirmation response
			if ((authResponse as any).isPendingConfirmation) {
				addTestResult(
					`✉️ Registration successful! Please check your email to confirm your account.`,
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
	}, [email, password, register, username, addTestResult])

	const handleLogin = useCallback(async () => {
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
	}, [email, password, login, addTestResult])

	const handleLogout = useCallback(async () => {
		try {
			await logout()
			addTestResult("✅ Logout successful")
			Alert.alert("Success", "Logged out successfully!")
		} catch (error) {
			const message = error instanceof Error ? error.message : "Logout failed"
			addTestResult(`❌ Logout failed: ${message}`)
			Alert.alert("Logout Failed", message)
		}
	}, [logout, addTestResult])

	const handleCheckAuthStatus = useCallback(async () => {
		try {
			const isAuth = await checkAuthStatus()
			addTestResult(
				`✅ Auth status check: ${isAuth ? "Authenticated" : "Not authenticated"
				}`,
			)
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Auth check failed"
			addTestResult(`❌ Auth check failed: ${message}`)
		}
	}, [checkAuthStatus, addTestResult])

	const handleRefreshSession = useCallback(async () => {
		try {
			await refreshSession()
			addTestResult("✅ Session refresh successful")
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Session refresh failed"
			addTestResult(`❌ Session refresh failed: ${message}`)
		}
	}, [refreshSession, addTestResult])

	const handleResetPassword = useCallback(async () => {
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
	}, [email, resetPassword, addTestResult])

	const runConnectivityTests = useCallback(async () => {
		addTestResult("🚀 Starting API connectivity tests...")

		try {
			// Test basic connection
			const basicConnection = await apiTestSuite.testBasicConnection()
			addTestResult(`${basicConnection ? "✅" : "❌"} Basic connection test`)

			// Test database access
			const databaseAccess = await apiTestSuite.testDatabaseAccess()
			addTestResult(`${databaseAccess ? "✅" : "❌"} Database access test`)

			// Test reference data
			const referenceData = await apiTestSuite.testReferenceDataSync()
			addTestResult(`${referenceData ? "✅" : "❌"} Reference data test`)

			// Test authenticated operations (only if logged in)
			if (isLoggedIn) {
				const authOps = await apiTestSuite.testBusinessLogic()
				addTestResult(`${authOps ? "✅" : "❌"} Authenticated operations test`)
			} else {
				addTestResult("⚠️ Skipped authenticated operations (not logged in)")
			}

			// Test real-time subscription
			// const realtime = await apiTestSuite.testRealTimeSubscription()
			// addTestResult(`${realtime ? "✅" : "❌"} Real-time subscription test`)
			addTestResult("⚠️ Real-time subscription test skipped (not implemented)")

			addTestResult("🎉 API connectivity tests completed")
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "API tests failed"
			addTestResult(`❌ API tests failed: ${message}`)
		}
	}, [isLoggedIn, addTestResult])

	// Test auth state on mount
	useEffect(() => {
		addTestResult("📱 AuthTestScreen mounted")
		if (isLoggedIn) {
			addTestResult(`✅ User already authenticated: ${user?.email}`)
		} else {
			addTestResult("ℹ️ No active authentication session")
		}
	}, [addTestResult, isLoggedIn, user?.email])

	return (
		<ScrollView style={styles.container}>
			<Text
				variant="headlineMedium"
				style={styles.title}
			>
				🔍 Supabase Auth Test
			</Text>

			{/* Auth Status Card */}
			<Card style={styles.card}>
				<Card.Title title="Authentication Status" />
				<Card.Content>
					<View
						style={styles.chipContainer}
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
								<Text style={styles.boldText}>Email:</Text> {user.email}
							</Text>
							<Text>
								<Text style={styles.boldText}>ID:</Text> {user.id}
							</Text>
							<Text>
								<Text style={styles.boldText}>Role:</Text> {user.role}
							</Text>
						</View>
					)}
				</Card.Content>
			</Card>

			{/* Registration/Login Form */}
			<Card style={styles.card}>
				<Card.Title title="Authentication Actions" />
				<Card.Content>
					<TextInput
						label="Email"
						value={email}
						onChangeText={setEmail}
						keyboardType="email-address"
						autoCapitalize="none"
						style={styles.input}
					/>

					<TextInput
						label="Password"
						value={password}
						onChangeText={setPassword}
						secureTextEntry
						style={styles.input}
					/>

					<TextInput
						label="Username (for registration)"
						value={username}
						onChangeText={setUsername}
						autoCapitalize="none"
						style={styles.inputLargeMargin}
					/>

					<View style={styles.buttonRow}>
						<Button
							mode="contained"
							onPress={handleRegister}
							disabled={isSubmitting || loading}
							style={styles.flex1}
						>
							{isSubmitting ? "Registering..." : "Register"}
						</Button>

						<Button
							mode="outlined"
							onPress={handleLogin}
							disabled={isSubmitting || loading}
							style={styles.flex1}
						>
							{isSubmitting ? "Logging in..." : "Login"}
						</Button>
					</View>

					{isLoggedIn && (
						<Button
							mode="contained-tonal"
							onPress={handleLogout}
							style={styles.input}
						>
							Logout
						</Button>
					)}

					<View style={styles.gapRow}>
						<Button
							mode="outlined"
							onPress={handleCheckAuthStatus}
							style={styles.flex1}
							compact
						>
							Check Status
						</Button>

						<Button
							mode="outlined"
							onPress={handleRefreshSession}
							style={styles.flex1}
							compact
						>
							Refresh Session
						</Button>
					</View>

					<Button
						mode="text"
						onPress={handleResetPassword}
						style={styles.textButton}
					>
						Reset Password
					</Button>
				</Card.Content>
			</Card>

			{/* API Tests */}
			<Card style={styles.card}>
				<Card.Title title="API Connectivity Tests" />
				<Card.Content>
					<Button
						mode="contained"
						onPress={runConnectivityTests}
						style={styles.input}
					>
						Run All API Tests
					</Button>

					<Text variant="bodySmall" style={styles.mutedText}>
						Tests database connection, authentication, and real-time features
					</Text>
				</Card.Content>
			</Card>

			{/* Test Results */}
			<Card style={styles.resultsCard}>
				<Card.Title
					title="Test Results"
					right={renderCardTitleRight}
				/>
				<Card.Content>
					{testResults.length === 0 ? (
						<Text style={styles.resultsPlaceholder}>
							No test results yet. Run some tests above!
						</Text>
					) : (
						<View>
							{testResults.map((result, index) => (
								<Text
									key={index}
									style={[
										styles.resultItem,
										result.includes("❌")
											? styles.resultError
											: result.includes("✅")
												? styles.resultSuccess
												: styles.resultNormal,
									]}
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

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 16,
	},
	title: {
		marginBottom: 16,
		textAlign: "center",
	},
	card: {
		marginBottom: 16,
	},
	chipContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		marginBottom: 8,
	},
	boldText: {
		fontWeight: "bold",
	},
	input: {
		marginBottom: 8,
	},
	inputLargeMargin: {
		marginBottom: 16,
	},
	buttonRow: {
		flexDirection: "row",
		gap: 8,
		marginBottom: 16,
	},
	gapRow: {
		flexDirection: "row",
		gap: 8,
	},
	flex1: {
		flex: 1,
	},
	textButton: {
		marginTop: 8,
	},
	mutedText: {
		color: "#666",
	},
	resultsCard: {
		marginBottom: 32,
	},
	resultsPlaceholder: {
		fontStyle: "italic",
		color: "#666",
	},
	resultItem: {
		fontSize: 12,
		fontFamily: "monospace",
		marginBottom: 4,
	},
	resultError: {
		color: "#F44336",
	},
	resultSuccess: {
		color: "#4CAF50",
	},
	resultNormal: {
		color: "#333",
	},
})
