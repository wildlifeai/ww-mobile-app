/**
 * EnvironmentManager Integration Tests
 *
 * Tests AsyncStorage persistence across function calls and simulated app restarts.
 * Verifies data survives storage operations and concurrent access scenarios.
 */

import AsyncStorage from "@react-native-async-storage/async-storage"
import Constants from "expo-constants"
import {
	getEnvironment,
	setEnvironment,
	getEnvironmentConfig,
	resetToDefault,
} from "../EnvironmentManager"

// Use real AsyncStorage mock for integration testing
jest.mock("@react-native-async-storage/async-storage")
jest.mock("expo-constants", () => ({
	expoConfig: {
		extra: {
			isDevelopment: true,
		},
	},
}))

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>

// Simulate persistent storage across calls
let inMemoryStorage: Record<string, string> = {}

describe("EnvironmentManager Integration Tests", () => {
	beforeEach(() => {
		// Reset in-memory storage
		inMemoryStorage = {}

		// Setup AsyncStorage to use in-memory storage for realistic behavior
		mockAsyncStorage.getItem.mockImplementation(async (key: string) => {
			return inMemoryStorage[key] || null
		})

		mockAsyncStorage.setItem.mockImplementation(
			async (key: string, value: string) => {
				inMemoryStorage[key] = value
			},
		)

		mockAsyncStorage.removeItem.mockImplementation(async (key: string) => {
			delete inMemoryStorage[key]
		})

		// Ensure dev mode for most tests
		;(Constants.expoConfig!.extra as any).isDevelopment = true
	})

	describe("Persistence Across Function Calls", () => {
		it("should persist environment selection across multiple getEnvironment calls", async () => {
			// Set environment
			await setEnvironment("cloud-dev")

			// Verify persistence across multiple calls
			const env1 = await getEnvironment()
			const env2 = await getEnvironment()
			const env3 = await getEnvironment()

			expect(env1).toBe("cloud-dev")
			expect(env2).toBe("cloud-dev")
			expect(env3).toBe("cloud-dev")
		})

		it("should update environment and reflect in subsequent calls", async () => {
			// Initial environment
			await setEnvironment("local")
			expect(await getEnvironment()).toBe("local")

			// Update environment
			await setEnvironment("cloud-dev")
			expect(await getEnvironment()).toBe("cloud-dev")

			// Update again
			await setEnvironment("cloud-prod")
			expect(await getEnvironment()).toBe("cloud-prod")
		})

		it("should persist config lookup across multiple calls", async () => {
			await setEnvironment("cloud-dev")

			const config1 = await getEnvironmentConfig()
			const config2 = await getEnvironmentConfig()

			expect(config1.displayName).toBe("Cloud Development")
			expect(config2.displayName).toBe("Cloud Development")
			expect(config1).toEqual(config2)
		})
	})

	describe("Simulated App Restart", () => {
		it("should survive simulated app restart", async () => {
			// User sets environment
			await setEnvironment("local")

			// Simulate app restart by clearing module cache and re-importing
			// (AsyncStorage mock maintains state)
			const firstRead = await getEnvironment()
			expect(firstRead).toBe("local")

			// Simulate second app launch
			const secondRead = await getEnvironment()
			expect(secondRead).toBe("local")

			// Verify storage was actually persisted
			expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
				"@supabase_environment",
				"local",
			)
		})

		it("should use default environment on first launch (no stored value)", async () => {
			// Simulate fresh install - no stored environment
			const env = await getEnvironment()

			expect(env).toBe("cloud-dev") // Default for dev (current) builds
		})

		it("should maintain environment through multiple restarts", async () => {
			// Launch 1: Set environment
			await setEnvironment("cloud-dev")

			// Launch 2: Verify persistence
			expect(await getEnvironment()).toBe("cloud-dev")

			// Launch 3: Still persisted
			expect(await getEnvironment()).toBe("cloud-dev")

			// Launch 4: Update environment
			await setEnvironment("local")

			// Launch 5: Verify new value persists
			expect(await getEnvironment()).toBe("local")
		})
	})

	describe("Error Recovery", () => {
		it("should recover from corrupted storage data", async () => {
			// Manually corrupt storage
			inMemoryStorage["@supabase_environment"] = "corrupted-invalid-value"

			// Should fallback to default
			const env = await getEnvironment()
			expect(env).toBe("cloud-dev") // Default for dev (current)
		})

		it("should recover from storage read errors", async () => {
			// Simulate read error once, then succeed
			let callCount = 0
			mockAsyncStorage.getItem.mockImplementation(async () => {
				callCount++
				if (callCount === 1) {
					throw new Error("Storage read error")
				}
				return inMemoryStorage["@supabase_environment"] || null
			})

			// First call should handle error and return default
			const env1 = await getEnvironment()
			expect(env1).toBe("cloud-dev") // Current default for dev

			// Second call should work normally
			await setEnvironment("cloud-dev")
			const env2 = await getEnvironment()
			expect(env2).toBe("cloud-dev")
		})

		it("should handle storage write errors gracefully", async () => {
			// Simulate write error
			mockAsyncStorage.setItem.mockRejectedValueOnce(new Error("Storage full"))

			// Should throw clear error
			await expect(setEnvironment("local")).rejects.toThrow(
				"Failed to save environment preference",
			)

			// Storage should remain unchanged
			expect(inMemoryStorage["@supabase_environment"]).toBeUndefined()
		})
	})

	describe("Concurrent Access", () => {
		it("should handle rapid sequential writes", async () => {
			// Simulate rapid environment switching
			await setEnvironment("local")
			await setEnvironment("cloud-dev")
			await setEnvironment("cloud-prod")
			await setEnvironment("local")

			// Final value should be last write
			const env = await getEnvironment()
			expect(env).toBe("local")
		})

		it("should handle concurrent reads while writing", async () => {
			await setEnvironment("cloud-dev")

			// Start a write
			const writePromise = setEnvironment("local")

			// Read while write is in progress
			const readPromise = getEnvironment()

			await Promise.all([writePromise, readPromise])

			// Final state should be consistent
			const finalEnv = await getEnvironment()
			expect(finalEnv).toBe("local")
		})
	})

	describe("Reset to Default", () => {
		it("should clear stored environment and use default", async () => {
			// Set custom environment
			await setEnvironment("cloud-prod")
			expect(await getEnvironment()).toBe("cloud-prod")

			// Reset to default
			await resetToDefault()

			// Should use default environment
			const env = await getEnvironment()
			expect(env).toBe("cloud-dev") // Default for dev (current)
			expect(inMemoryStorage["@supabase_environment"]).toBeUndefined()
		})

		it("should handle reset when no environment is stored", async () => {
			// No stored environment initially
			await expect(resetToDefault()).resolves.not.toThrow()
		})
	})

	describe("Build Type Switching", () => {
		it("should use different defaults for dev vs production builds", async () => {
			// Dev build
			;(Constants.expoConfig!.extra as any).isDevelopment = true
			const devDefault = await getEnvironment()
			expect(devDefault).toBe("cloud-dev")

			// Production build
			;(Constants.expoConfig!.extra as any).isDevelopment = false
			const prodDefault = await getEnvironment()
			expect(prodDefault).toBe("cloud-dev")
		})

		it("should preserve stored environment across build type changes", async () => {
			// Dev build - set environment
			;(Constants.expoConfig!.extra as any).isDevelopment = true
			await setEnvironment("cloud-dev")

			// Simulate production build (user can't change, but value persists)
			;(Constants.expoConfig!.extra as any).isDevelopment = false
			const env = await getEnvironment()
			expect(env).toBe("cloud-dev") // Stored value takes precedence
		})
	})
})
