import { supabase } from "./supabase"
import {
	userOperations,
	deviceOperations,
	projectOperations,
	referenceData,
} from "./database"
import type {
	RealtimePostgresChangesPayload,
	REALTIME_SUBSCRIBE_STATES,
} from "@supabase/supabase-js"
import type { Tables } from "../types/supabase"

/**
 * API Test Functions
 *
 * Simple functions to test Supabase API connectivity and operations.
 * Can be called from components or used for debugging.
 */

export const testBasicConnection = async (): Promise<boolean> => {
	try {
		const { error } = await supabase.from("users").select("count").limit(1)
		if (error) {
			console.error("Basic connection test failed:", error)
			return false
		}
		console.log("✅ Basic connection test passed")
		return true
	} catch (error) {
		console.error("Basic connection test error:", error)
		return false
	}
}

export const testDatabaseAccess = async (): Promise<boolean> => {
	try {
		const tables = [
			"users",
			"devices",
			"projects",
			"deployments",
			"roles",
		] as const

		for (const table of tables) {
			const { error } = await supabase.from(table).select("*").limit(1)
			if (error) {
				console.error(`Table ${table} access failed:`, error)
				return false
			}
		}

		console.log("✅ Database access test passed")
		return true
	} catch (error) {
		console.error("Database access test error:", error)
		return false
	}
}

export const testReferenceData = async (): Promise<boolean> => {
	try {
		const roles = await referenceData.getRoles()
		const captureMethods = await referenceData.getCaptureMethods()
		const deploymentStatuses = await referenceData.getDeploymentStatuses()

		console.log("✅ Reference data test passed:", {
			roles: roles.length,
			captureMethods: captureMethods.length,
			deploymentStatuses: deploymentStatuses.length,
		})

		return true
	} catch (error) {
		console.error("Reference data test failed:", error)
		return false
	}
}

export const testAuthenticatedOperations = async (): Promise<boolean> => {
	try {
		// Test user profile operations
		const profile = await userOperations.getCurrentProfile()
		if (profile) {
			console.log(
				"✅ User profile test passed:",
				profile.name || profile.email || "Profile found",
			)
		} else {
			console.log("ℹ️ No user profile in database yet (normal for new users)")
		}

		// Test device operations
		const devices = await deviceOperations.getDevices()
		console.log("✅ Device query test passed:", devices.length, "devices found")

		// Test project operations
		const projects = await projectOperations.getProjects()
		console.log(
			"✅ Project query test passed:",
			projects.length,
			"projects found",
		)

		return true
	} catch (error) {
		console.error("Authenticated operations test failed:", error)
		return false
	}
}

export const testRealTimeSubscription = async (): Promise<boolean> => {
	return new Promise((resolve) => {
		try {
			let subscriptionEstablished = false

			const channel = supabase
				.channel("api-test-channel")
				.on(
					"postgres_changes",
					{ event: "*", schema: "public", table: "devices" },
					(payload: RealtimePostgresChangesPayload<Tables<"devices">>) => {
						console.log("Real-time update received:", payload)
					},
				)
				.subscribe((status: `${REALTIME_SUBSCRIBE_STATES}`) => {
					if (status === "SUBSCRIBED") {
						subscriptionEstablished = true
						console.log("✅ Real-time subscription test passed")
						// Close after successful establishment
						setTimeout(() => {
							channel.unsubscribe()
						}, 100)
						resolve(true)
					} else if (status === "CLOSED" && !subscriptionEstablished) {
						console.error("Real-time subscription closed before establishing")
						resolve(false)
					}
				})

			// Timeout after 5 seconds
			setTimeout(() => {
				if (!subscriptionEstablished) {
					console.error("Real-time subscription timeout")
					channel.unsubscribe()
					resolve(false)
				}
			}, 5000)
		} catch (error) {
			console.error("Real-time subscription test error:", error)
			resolve(false)
		}
	})
}

export const runAllAPITests = async (): Promise<void> => {
	console.log("🚀 Starting Supabase API tests...\n")

	const tests = [
		{ name: "Basic Connection", fn: testBasicConnection },
		{ name: "Database Access", fn: testDatabaseAccess },
		{ name: "Reference Data", fn: testReferenceData },
		{ name: "Authenticated Operations", fn: testAuthenticatedOperations },
		{ name: "Real-time Subscription", fn: testRealTimeSubscription },
	]

	const results = []

	for (const test of tests) {
		console.log(`Running ${test.name}...`)
		const startTime = Date.now()

		try {
			const success = await test.fn()
			const duration = Date.now() - startTime

			results.push({
				name: test.name,
				success,
				duration,
			})

			console.log(`${success ? "✅" : "❌"} ${test.name} (${duration}ms)\n`)
		} catch (error) {
			const duration = Date.now() - startTime
			results.push({
				name: test.name,
				success: false,
				duration,
				error: error instanceof Error ? error.message : "Unknown error",
			})

			console.log(`❌ ${test.name} failed (${duration}ms):`, error, "\n")
		}
	}

	// Summary
	const passed = results.filter((r) => r.success).length
	const total = results.length

	console.log("📊 Test Results Summary:")
	console.log(`Passed: ${passed}/${total}`)
	console.log("Results:", results)

	return
}

// Individual test exports for manual testing
export const apiTestSuite = {
	testBasicConnection,
	testDatabaseAccess,
	testReferenceData,
	testAuthenticatedOperations,
	testRealTimeSubscription,
	runAllAPITests,
}
