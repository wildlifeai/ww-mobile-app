import React, { useEffect, useCallback, useReducer } from "react"
import { ScrollView, Alert, StyleSheet } from "react-native"
import { Text } from "react-native-paper"
import { useSupabaseAuth } from "../../../hooks/useSupabaseAuth"
import * as apiTestSuite from "../../../services/tests/apiTest"

import { AuthStatusCard } from "./components/AuthStatusCard"
import { AuthActionsCard } from "./components/AuthActionsCard"
import { ApiTestsCard } from "./components/ApiTestsCard"
import { TestResultsCard } from "./components/TestResultsCard"

/**
 * Authentication Test Screen
 *
 * Comprehensive testing interface for Supabase authentication:
 * - User registration and login
 * - Auth state management
 * - API connectivity tests
 * - Session persistence validation
 */

interface AuthTestState {
	email: string
	password: string
	username: string
	isSubmitting: boolean
	testResults: string[]
}

type AuthTestAction =
	| Partial<AuthTestState>
	| { type: 'ADD_RESULT'; result: string }

const authTestReducer = (state: AuthTestState, action: AuthTestAction): AuthTestState => {
	if ('type' in action && action.type === 'ADD_RESULT') {
		return { ...state, testResults: [...state.testResults, action.result] }
	}
	return { ...state, ...(action as Partial<AuthTestState>) }
}

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
		dispatch({ testResults: [] })
	}, [])

	// Form state
	const [state, dispatch] = useReducer(authTestReducer, {
		email: "test@example.com",
		password: "testpassword123",
		username: "testuser",
		isSubmitting: false,
		testResults: [],
	})
	const { email, password, username, isSubmitting, testResults } = state

	// Add test result
	const addTestResult = useCallback((result: string) => {
		dispatch({
			type: 'ADD_RESULT',
			result: `${new Date().toLocaleTimeString()}: ${result}`,
		})
	}, [])

	const handleRegister = useCallback(async () => {
		dispatch({ isSubmitting: true })
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
			dispatch({ isSubmitting: false })
		}
	}, [email, password, register, username, addTestResult])

	const handleLogin = useCallback(async () => {
		dispatch({ isSubmitting: true })
		try {
			await login({ identifier: email, password })
			addTestResult(`✅ Login successful for ${email}`)
			Alert.alert("Success", "Login successful!")
		} catch (error) {
			const message = error instanceof Error ? error.message : "Login failed"
			addTestResult(`❌ Login failed: ${message}`)
			Alert.alert("Login Failed", message)
		} finally {
			dispatch({ isSubmitting: false })
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

			<AuthStatusCard
				isLoggedIn={isLoggedIn}
				loading={loading}
				token={token}
				user={user}
			/>

			<AuthActionsCard
				email={email}
				setEmail={(val) => dispatch({ email: val })}
				password={password}
				setPassword={(val) => dispatch({ password: val })}
				username={username}
				setUsername={(val) => dispatch({ username: val })}
				isSubmitting={isSubmitting}
				isLoggedIn={isLoggedIn}
				loading={loading}
				onRegister={handleRegister}
				onLogin={handleLogin}
				onLogout={handleLogout}
				onCheckAuthStatus={handleCheckAuthStatus}
				onRefreshSession={handleRefreshSession}
				onResetPassword={handleResetPassword}
			/>

			<ApiTestsCard
				onRunTests={runConnectivityTests}
			/>

			<TestResultsCard
				testResults={testResults}
				onClearResults={clearTestResults}
			/>
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
})
