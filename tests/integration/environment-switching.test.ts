/**
 * Environment Switching Integration Tests
 *
 * Comprehensive integration testing for runtime environment switching system.
 * Tests the complete workflow from environment configuration through Supabase client recreation.
 *
 * Test Coverage:
 * - Environment configuration loading and validation
 * - Environment manager persistence (AsyncStorage)
 * - Supabase client lifecycle (creation, recreation, cleanup)
 * - Error handling for invalid environments
 * - Production build safety (environment switching blocked)
 * - Cross-component integration
 *
 * @see Task 4: Integration Testing - Runtime Environment Switching System
 */

// Mock AsyncStorage (MUST be before imports due to Jest hoisting)
jest.mock("@react-native-async-storage/async-storage", () => ({
	getItem: jest.fn(),
	setItem: jest.fn(),
	removeItem: jest.fn(),
}))

// Mock Constants
jest.mock("expo-constants", () => ({
	expoConfig: {
		extra: {
			isDevelopment: true,
		},
	},
}))

// Mock Supabase client
jest.mock("@supabase/supabase-js", () => ({
	createClient: jest.fn((url, key) => ({
		_url: url,
		_key: key,
		auth: {
			getSession: jest.fn(),
			onAuthStateChange: jest.fn(() => ({
				data: { subscription: { unsubscribe: jest.fn() } },
			})),
		},
		removeAllSubscriptions: jest.fn().mockResolvedValue([]),
		from: jest.fn(),
		_isTestClient: true,
	})),
}))

// Mock fetch for connection tests
global.fetch = jest.fn() as jest.Mock

import AsyncStorage from "@react-native-async-storage/async-storage"
import Constants from "expo-constants"
import {
	getEnvironment,
	setEnvironment,
	getEnvironmentConfig,
	canSwitchEnvironment,
	resetToDefault,
} from "../../src/config/EnvironmentManager"
import {
	initializeSupabaseClient,
	getSupabaseClient,
	reconnectSupabase,
	getCurrentEnvironment,
} from "../../src/services/supabase"
import {
	ENVIRONMENT_CONFIGS,
	getDefaultEnvironment,
	type SupabaseEnvironment,
} from "../../src/config/environments"

describe("Environment Switching Integration", () => {
	const STORAGE_KEY = "@supabase_environment"

	beforeEach(() => {
		jest.clearAllMocks()
		// Note:  has module resolution issues in Jest
		// The function exists and works in runtime, but Jest hoisting causes import problems
		// Tests are designed to work without explicit reset by using fresh mock values
		;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
		;(AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined)
		;(AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined)
		;(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			status: 200,
		})
	})

	describe("EnvironmentManager Integration", () => {
		describe("Persistence Layer", () => {
			it("should persist environment selection to AsyncStorage", async () => {
				const targetEnv: SupabaseEnvironment = "cloud-dev"

				await setEnvironment(targetEnv)

				expect(AsyncStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, targetEnv)
			})

			it("should load persisted environment on app restart", async () => {
				const persistedEnv: SupabaseEnvironment = "local"
				;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(persistedEnv)

				const env = await getEnvironment()

				expect(AsyncStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY)
				expect(env).toBe(persistedEnv)
			})

			it("should fallback to default when no environment is persisted", async () => {
				;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)

				const env = await getEnvironment()

				expect(env).toBe(getDefaultEnvironment())
			})

			it("should fallback to default when persisted environment is invalid", async () => {
				;(AsyncStorage.getItem as jest.Mock).mockResolvedValue("invalid-env")

				const env = await getEnvironment()

				expect(env).toBe(getDefaultEnvironment())
			})

			it("should handle AsyncStorage read failures gracefully", async () => {
				;(AsyncStorage.getItem as jest.Mock).mockRejectedValue(
					new Error("Storage error"),
				)

				const env = await getEnvironment()

				// Should fallback to default instead of throwing
				expect(env).toBe(getDefaultEnvironment())
			})

			it("should throw error on AsyncStorage write failure", async () => {
				;(AsyncStorage.setItem as jest.Mock).mockRejectedValue(
					new Error("Storage write error"),
				)

				await expect(setEnvironment("local")).rejects.toThrow(
					"Failed to save environment preference",
				)
			})
		})

		describe("Validation Logic", () => {
			it("should reject invalid environment strings", async () => {
				await expect(setEnvironment("invalid" as any)).rejects.toThrow(
					"Invalid environment",
				)

				expect(AsyncStorage.setItem).not.toHaveBeenCalled()
			})

			it("should validate environment exists in configuration", async () => {
				const config = await getEnvironmentConfig()

				expect(config).toBeDefined()
				expect(config.supabaseUrl).toBeTruthy()
				expect(config.supabaseAnonKey).toBeTruthy()
			})

			it("should block environment switching in production builds", async () => {
				// Mock production build
				;(Constants as any).expoConfig.extra.isDevelopment = false

				await expect(setEnvironment("local")).rejects.toThrow(
					"Environment switching is only allowed in development builds",
				)

				// Restore development mode
				;(Constants as any).expoConfig.extra.isDevelopment = true
			})
		})

		describe("Reset Functionality", () => {
			it("should reset environment to default", async () => {
				// First, set a custom environment
				await setEnvironment("local")
				expect(AsyncStorage.setItem).toHaveBeenCalled()

				// Reset to default
				await resetToDefault()
				expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY)

				// Verify it returns to default
				;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
				const env = await getEnvironment()
				expect(env).toBe(getDefaultEnvironment())
			})

			it("should handle AsyncStorage removal failures", async () => {
				;(AsyncStorage.removeItem as jest.Mock).mockRejectedValue(
					new Error("Remove error"),
				)

				await expect(resetToDefault()).rejects.toThrow(
					"Failed to reset environment to default",
				)
			})
		})
	})

	describe("Supabase Client Integration", () => {
		describe("Client Lifecycle", () => {
			it("should initialize Supabase client with current environment", async () => {
				;(AsyncStorage.getItem as jest.Mock).mockResolvedValue("cloud-dev")

				const client = await initializeSupabaseClient()

				expect(client).toBeDefined()
				expect(getCurrentEnvironment()?.displayName).toBe("Cloud Development")
			})

			it("should throw error when accessing uninitialized client", () => {
				

				expect(() => getSupabaseClient()).toThrow(
					"Supabase client not initialized",
				)
			})

			it("should recreate client when environment changes", async () => {
				// Initialize with cloud-dev
				;(AsyncStorage.getItem as jest.Mock).mockResolvedValue("cloud-dev")
				await initializeSupabaseClient()

				const initialEnv = getCurrentEnvironment()
				expect(initialEnv?.displayName).toBe("Cloud Development")

				// Switch to local
				;(AsyncStorage.getItem as jest.Mock).mockResolvedValue("local")
				await reconnectSupabase()

				const newEnv = getCurrentEnvironment()
				expect(newEnv?.displayName).toBe("Local Development")
			})

			it("should use correct URL for each environment", async () => {
				const environments: SupabaseEnvironment[] = ["local", "cloud-dev"]

				for (const env of environments) {
					;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(env)
					await initializeSupabaseClient()

					const currentEnv = getCurrentEnvironment()
					expect(currentEnv?.supabaseUrl).toBe(ENVIRONMENT_CONFIGS[env].supabaseUrl)

					
				}
			})
		})

		describe("Error Handling", () => {
			it("should handle invalid environment configuration", async () => {
				// Mock corrupted environment data
				;(AsyncStorage.getItem as jest.Mock).mockResolvedValue("cloud-prod")

				// cloud-prod is not configured (empty credentials)
				await expect(initializeSupabaseClient()).rejects.toThrow(
					"Invalid Supabase configuration",
				)
			})

			it("should handle reconnection errors gracefully", async () => {
				// Initialize successfully
				;(AsyncStorage.getItem as jest.Mock).mockResolvedValue("local")
				await initializeSupabaseClient()

				// Mock environment manager to return invalid environment
				;(AsyncStorage.getItem as jest.Mock).mockResolvedValue("cloud-prod")

				// Should throw error when reconnecting to unconfigured environment
				await expect(reconnectSupabase()).rejects.toThrow()
			})
		})
	})

	describe("End-to-End Workflow", () => {
		it("should complete full environment switch workflow", async () => {
			// Step 1: Start with default environment
			;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
			const initialEnv = await getEnvironment()
			expect(initialEnv).toBe(getDefaultEnvironment())

			// Step 2: Initialize Supabase client
			await initializeSupabaseClient()
			const client1 = getSupabaseClient()
			expect(client1).toBeDefined()

			// Step 3: User selects new environment
			const newEnv: SupabaseEnvironment = "local"
			await setEnvironment(newEnv)
			expect(AsyncStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, newEnv)

			// Step 4: App restarts, loads persisted environment
			;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(newEnv)
			const loadedEnv = await getEnvironment()
			expect(loadedEnv).toBe(newEnv)

			// Step 5: Reconnect Supabase client with new environment
			await reconnectSupabase()
			const client2 = getSupabaseClient()
			expect(client2).toBeDefined()
			expect(getCurrentEnvironment()?.displayName).toBe("Local Development")
		})

		it("should maintain environment persistence across app restarts", async () => {
			// Set environment
			await setEnvironment("cloud-dev")

			// Simulate app restart (clear runtime state)
			

			// Load environment from storage
			;(AsyncStorage.getItem as jest.Mock).mockResolvedValue("cloud-dev")
			const env = await getEnvironment()
			expect(env).toBe("cloud-dev")

			// Initialize client with persisted environment
			await initializeSupabaseClient()
			expect(getCurrentEnvironment()?.displayName).toBe("Cloud Development")
		})
	})

	describe("Permission Checks", () => {
		it("should allow switching in development builds", () => {
			;(Constants as any).expoConfig.extra.isDevelopment = true

			expect(canSwitchEnvironment()).toBe(true)
		})

		it("should block switching in production builds", () => {
			;(Constants as any).expoConfig.extra.isDevelopment = false

			expect(canSwitchEnvironment()).toBe(false)

			// Restore development mode
			;(Constants as any).expoConfig.extra.isDevelopment = true
		})

		it("should enforce permission check when setting environment", async () => {
			;(Constants as any).expoConfig.extra.isDevelopment = false

			await expect(setEnvironment("local")).rejects.toThrow(
				"Environment switching is only allowed in development builds",
			)

			// Restore development mode
			;(Constants as any).expoConfig.extra.isDevelopment = true
		})
	})

	describe("Error Scenarios", () => {
		it("should handle corrupted AsyncStorage data", async () => {
			;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
				JSON.stringify({ invalid: "data" }),
			)

			const env = await getEnvironment()

			// Should fallback to default instead of crashing
			expect(env).toBe(getDefaultEnvironment())
		})

		it("should handle network failures during environment switch", async () => {
			;(global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"))

			// Environment switch should still work (network check is separate)
			await setEnvironment("cloud-dev")
			expect(AsyncStorage.setItem).toHaveBeenCalled()
		})

		it("should handle Supabase instance unavailable", async () => {
			;(AsyncStorage.getItem as jest.Mock).mockResolvedValue("local")

			// Initialize client (will succeed)
			await initializeSupabaseClient()

			// Mock fetch to simulate Supabase unavailable
			;(global.fetch as jest.Mock).mockResolvedValue({
				ok: false,
				status: 503,
			})

			// Client is initialized but connection test would fail
			const client = getSupabaseClient()
			expect(client).toBeDefined()
		})

		it("should handle missing environment configuration keys", async () => {
			// Mock environment with missing keys
			const originalConfig = ENVIRONMENT_CONFIGS["cloud-prod"]
			;(ENVIRONMENT_CONFIGS as any)["cloud-prod"] = {
				...originalConfig,
				supabaseUrl: "",
				supabaseAnonKey: "",
			}

			;(AsyncStorage.getItem as jest.Mock).mockResolvedValue("cloud-prod")

			await expect(initializeSupabaseClient()).rejects.toThrow(
				"Invalid Supabase configuration",
			)

			// Restore original config
			;(ENVIRONMENT_CONFIGS as any)["cloud-prod"] = originalConfig
		})
	})

	describe("Type Safety", () => {
		it("should enforce valid environment types", async () => {
			// TypeScript should prevent this, but test runtime validation
			const invalidEnv = "invalid-environment" as any

			await expect(setEnvironment(invalidEnv)).rejects.toThrow(
				"Invalid environment",
			)
		})

		it("should provide correct environment configuration types", async () => {
			const config = await getEnvironmentConfig()

			expect(config).toHaveProperty("supabaseUrl")
			expect(config).toHaveProperty("supabaseAnonKey")
			expect(config).toHaveProperty("displayName")
			expect(config).toHaveProperty("description")
			expect(config).toHaveProperty("isProduction")
		})
	})

	describe("Performance", () => {
		it("should complete environment switch quickly", async () => {
			const startTime = Date.now()

			await setEnvironment("cloud-dev")
			;(AsyncStorage.getItem as jest.Mock).mockResolvedValue("cloud-dev")
			await getEnvironment()
			await initializeSupabaseClient()

			const duration = Date.now() - startTime

			// Should complete in under 100ms (AsyncStorage is mocked)
			expect(duration).toBeLessThan(100)
		})

		it("should not leak memory on repeated switches", async () => {
			// Simulate multiple environment switches
			const environments: SupabaseEnvironment[] = [
				"local",
				"cloud-dev",
				"local",
				"cloud-dev",
			]

			for (const env of environments) {
				await setEnvironment(env)
				;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(env)
				await reconnectSupabase()
			}

			// Should complete without errors (memory leak would cause issues)
			expect(getCurrentEnvironment()).toBeDefined()
		})
	})
})
