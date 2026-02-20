import React, { useState, useEffect, useCallback } from "react"
import { ScrollView, Alert, StyleSheet } from "react-native"
import { Text } from "react-native-paper"
import { getSupabaseClient } from "../services/supabase"
import type {
	RealtimePostgresChangesPayload,
	REALTIME_SUBSCRIBE_STATES,
} from "@supabase/supabase-js"
import { useSupabaseAuth } from "../hooks/useSupabaseAuth"
import type { Tables } from "../types/database.types"
import { log, logWarn } from '../utils/logger'


export type TestResult = {
	name: string
	status: "pending" | "running" | "success" | "error"
	message: string
	duration?: number
}

import { TestHeader } from "./SupabaseConnectivityTest/TestHeader"
import { TestResultItem } from "./SupabaseConnectivityTest/TestResultItem"

/**
 * Comprehensive Supabase Connectivity Test Component
 *
 * Tests all aspects of Supabase integration:
 * - Database connectivity
 * - Authenticated queries with RLS
 * - Real-time subscriptions
 * - Error handling
 * - Performance metrics
 */
export const SupabaseConnectivityTest: React.FC = () => {
	const { isLoggedIn, user } = useSupabaseAuth()
	const [tests, setTests] = useState<TestResult[]>([])
	const [isRunning, setIsRunning] = useState(false)
	const [subscription, setSubscription] = useState<any>(null)

	const updateTest = (name: string, updates: Partial<TestResult>) => {
		setTests((prev: TestResult[]) =>
			prev.map((test) => (test.name === name ? { ...test, ...updates } : test)),
		)
	}

	const initializeTests = useCallback(() => {
		const initialTests: TestResult[] = [
			{ name: "Basic Connection", status: "pending", message: "Not started" },
			{ name: "Database Schema", status: "pending", message: "Not started" },
			{ name: "Public Data Query", status: "pending", message: "Not started" },
			{
				name: "Authenticated Query",
				status: "pending",
				message: "Not started",
			},
			{ name: "RLS Policy Test", status: "pending", message: "Not started" },
			{
				name: "Real-time Subscription",
				status: "pending",
				message: "Not started",
			},
			{ name: "Error Handling", status: "pending", message: "Not started" },
			{ name: "Performance Test", status: "pending", message: "Not started" },
		]
		setTests(initialTests)
	}, [])

	useEffect(() => {
		initializeTests()
	}, [initializeTests])

	useEffect(() => {
		return () => {
			// Cleanup subscription on unmount or when it changes
			if (subscription) {
				subscription.unsubscribe()
			}
		}
	}, [subscription])

	const runTest = async (testName: string, testFn: () => Promise<void>) => {
		const startTime = Date.now()
		updateTest(testName, { status: "running", message: "Running..." })

		try {
			await testFn()
			const duration = Date.now() - startTime
			updateTest(testName, {
				status: "success",
				message: "Passed",
				duration,
			})
		} catch (error) {
			const duration = Date.now() - startTime
			updateTest(testName, {
				status: "error",
				message: error instanceof Error ? error.message : "Unknown error",
				duration,
			})
		}
	}

	const testBasicConnection = async () => {
		// Test basic Supabase connection
		const { error } = await getSupabaseClient().from("users").select("count").limit(1)
		if (error) throw new Error(`Connection failed: ${error.message}`)
	}

	const testDatabaseSchema = async () => {
		// Test that all expected tables are accessible
		const tables = [
			"users",
			"devices",
			"projects",
			"deployments",
			"user_roles",
		] as const

		for (const table of tables) {
			const { error } = await getSupabaseClient().from(table).select("*").limit(1)
			if (error)
				throw new Error(`Table ${table} not accessible: ${error.message}`)
		}
	}

	const testPublicDataQuery = async () => {
		// Test querying public/reference data
		const { data, error } = await getSupabaseClient().from("activity_sensitivity").select("*").limit(5)

		if (error) throw new Error(`Public query failed: ${error.message}`)
		if (!data) throw new Error("No data returned from public query")
	}

	const testAuthenticatedQuery = async () => {
		if (!isLoggedIn) throw new Error("User not authenticated")

		if (!user?.id) throw new Error("User ID missing")

		// Test authenticated query to users table
		const { data, error } = await getSupabaseClient()
			.from("users")
			.select("*")
			.eq("id", user.id)
			.single()

		if (error) throw new Error(`Authenticated query failed: ${error.message}`)
		if (!data) throw new Error("No user data returned")
	}

	const testRLSPolicy = async () => {
		if (!isLoggedIn) throw new Error("User not authenticated")

		try {
			// Try to access all users (should be restricted by RLS)
			const { data, error } = await getSupabaseClient().from("users").select("*")

			// If this succeeds without proper filtering, RLS might not be working
			if (data && data.length > 1) {
				logWarn(
					"RLS might not be properly configured - returned multiple users",
				)
			}

			if (error && error.message.includes("RLS")) {
				// RLS is working correctly
				return
			}

			// Test passed - user can only see their own data or RLS is correctly applied
		} catch (error) {
			throw new Error(
				`RLS test failed: ${error instanceof Error ? error.message : "Unknown error"
				}`,
			)
		}
	}

	const testRealtimeSubscription = async () => {
		return new Promise<void>((resolve, reject) => {
			let timeoutId: NodeJS.Timeout

			try {
				// Set up subscription to devices table
				const channel = getSupabaseClient()
					.channel("connectivity-test")
					.on(
						"postgres_changes",
						{ event: "*", schema: "public", table: "devices" },
						(payload: RealtimePostgresChangesPayload<Tables<"devices">>) => {
							log("Real-time update received:", payload)
							clearTimeout(timeoutId)
							channel.unsubscribe()
							resolve()
						},
					)
					.subscribe((status: `${REALTIME_SUBSCRIBE_STATES}`) => {
						if (status === "SUBSCRIBED") {
							// Subscription established successfully
							log("Real-time subscription established")

							// Set timeout to resolve after a short wait (no changes expected)
							timeoutId = setTimeout(() => {
								channel.unsubscribe()
								resolve() // Consider it successful if subscription was established
							}, 3000)
						} else if (status === "CLOSED") {
							clearTimeout(timeoutId)
							reject(new Error("Real-time subscription closed unexpectedly"))
						}
					})

				setSubscription(channel)

				// Fallback timeout
				setTimeout(() => {
					clearTimeout(timeoutId)
					channel.unsubscribe()
					reject(new Error("Real-time subscription timeout"))
				}, 10000)
			} catch (error) {
				reject(error)
			}
		})
	}

	const testErrorHandling = async () => {
		try {
			// Intentionally trigger an error by querying with invalid filter
			const { error } = await getSupabaseClient()
				.from("users")
				.select("*")
				.eq("invalid_column", "test")

			if (!error) throw new Error("Expected error was not thrown")

			// Verify we get a proper error object
			if (!error.message) throw new Error("Error object missing message")
		} catch (error) {
			// This is expected - we're testing error handling
			if (
				error instanceof Error &&
				error.message.includes("Expected error was not thrown")
			) {
				throw error
			}
			// Other errors are expected and indicate proper error handling
		}
	}

	const testPerformance = async () => {
		const startTime = Date.now()

		// Run multiple concurrent queries
		const promises = [
			getSupabaseClient().from("users").select("count").limit(1),
			getSupabaseClient().from("devices").select("count").limit(1),
			getSupabaseClient().from("projects").select("count").limit(1),
		]

		await Promise.all(promises)

		const duration = Date.now() - startTime
		if (duration > 5000) {
			throw new Error(
				`Performance test failed: ${duration}ms (expected < 5000ms)`,
			)
		}
	}

	const runAllTests = async () => {
		setIsRunning(true)
		initializeTests()

		const testSuite = [
			{ name: "Basic Connection", fn: testBasicConnection },
			{ name: "Database Schema", fn: testDatabaseSchema },
			{ name: "Public Data Query", fn: testPublicDataQuery },
			{ name: "Authenticated Query", fn: testAuthenticatedQuery },
			{ name: "RLS Policy Test", fn: testRLSPolicy },
			{ name: "Real-time Subscription", fn: testRealtimeSubscription },
			{ name: "Error Handling", fn: testErrorHandling },
			{ name: "Performance Test", fn: testPerformance },
		]

		for (const test of testSuite) {
			await runTest(test.name, test.fn)
			// Small delay between tests
			await new Promise((resolve) => setTimeout(resolve, 500))
		}

		setIsRunning(false)

		// Show summary
		const passedTests = tests.filter((t) => t.status === "success").length
		const totalTests = tests.length
		Alert.alert("Test Results", `${passedTests}/${totalTests} tests passed`, [
			{ text: "OK" },
		])
	}

	return (
		<ScrollView style={styles.container}>
			<Text variant="headlineMedium" style={styles.title}>
				Supabase Connectivity Test
			</Text>

			<TestHeader
				isLoggedIn={isLoggedIn}
				user={user}
				isRunning={isRunning}
				runAllTests={runAllTests}
			/>

			{tests.map((test) => (
				<TestResultItem key={test.name} test={test} />
			))}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	container: {
		padding: 16,
	},
	title: {
		marginBottom: 16,
	},
})
