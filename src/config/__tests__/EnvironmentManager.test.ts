/**
 * EnvironmentManager Unit Tests
 *
 * Tests for environment manager with AsyncStorage persistence.
 * Following TDD methodology: Tests written BEFORE implementation.
 */

import AsyncStorage from "@react-native-async-storage/async-storage"
import Constants from "expo-constants"
import {
	getEnvironment,
	setEnvironment,
	getEnvironmentConfig,
	canSwitchEnvironment,
	resetToDefault,
} from "../EnvironmentManager"
import { SupabaseEnvironment } from "../environments"

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage")

// Mock expo-constants
jest.mock("expo-constants", () => ({
	expoConfig: {
		extra: {
			isDevelopment: true,
		},
	},
}))

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>

describe("EnvironmentManager", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("getEnvironment", () => {
		it("should return stored environment from AsyncStorage", async () => {
			mockAsyncStorage.getItem.mockResolvedValue("local")

			const env = await getEnvironment()

			expect(env).toBe("local")
			expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(
				"@supabase_environment",
			)
		})

		it("should return cloud-dev as default for development builds when no storage value", async () => {
			mockAsyncStorage.getItem.mockResolvedValue(null)
				; (Constants.expoConfig!.extra as any).isDevelopment = true

			const env = await getEnvironment()

			// Per Task 1.1: Default is cloud-dev until local networking is stable
			expect(env).toBe("cloud-dev")
		})

		it("should return cloud-dev as default for non-development builds when no storage value", async () => {
			mockAsyncStorage.getItem.mockResolvedValue(null)
				; (Constants.expoConfig!.extra as any).isDevelopment = false

			const env = await getEnvironment()

			expect(env).toBe("cloud-dev")
		})

		it("should validate and fallback to default on invalid stored value", async () => {
			mockAsyncStorage.getItem.mockResolvedValue("invalid-env")
				; (Constants.expoConfig!.extra as any).isDevelopment = true

			const env = await getEnvironment()

			// Should fallback to cloud-dev (current default for dev)
			expect(env).toBe("cloud-dev")
		})

		it("should fallback to default on AsyncStorage error", async () => {
			mockAsyncStorage.getItem.mockRejectedValue(new Error("Storage error"))
				; (Constants.expoConfig!.extra as any).isDevelopment = true

			const env = await getEnvironment()

			// Should fallback to cloud-dev (current default for dev)
			expect(env).toBe("cloud-dev")
		})
	})

	describe("setEnvironment", () => {
		beforeEach(() => {
			; (Constants.expoConfig!.extra as any).isDevelopment = true
		})

		it("should persist environment to AsyncStorage in dev builds", async () => {
			mockAsyncStorage.setItem.mockResolvedValue()

			await setEnvironment("cloud-dev")

			expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
				"@supabase_environment",
				"cloud-dev",
			)
		})

		it("should throw error when attempting to switch in non-dev builds", async () => {
			; (Constants.expoConfig!.extra as any).isDevelopment = false

			await expect(setEnvironment("local")).rejects.toThrow(
				"Environment switching is only allowed in development builds",
			)
		})

		it("should throw error for invalid environment string", async () => {
			await expect(
				setEnvironment("invalid" as SupabaseEnvironment),
			).rejects.toThrow("Invalid environment")
		})

		it("should handle AsyncStorage setItem errors gracefully", async () => {
			mockAsyncStorage.setItem.mockRejectedValue(new Error("Storage full"))

			await expect(setEnvironment("local")).rejects.toThrow(
				"Failed to save environment preference",
			)
		})
	})

	describe("getEnvironmentConfig", () => {
		it("should return config for currently stored environment", async () => {
			mockAsyncStorage.getItem.mockResolvedValue("local")

			const config = await getEnvironmentConfig()

			expect(config.displayName).toBe("Local Development")
			expect(config.isProduction).toBe(false)
			expect(config.supabaseUrl).toContain("192.168.1.239")
		})

		it("should return config for default environment when no storage", async () => {
			mockAsyncStorage.getItem.mockResolvedValue(null)
				; (Constants.expoConfig!.extra as any).isDevelopment = true

			const config = await getEnvironmentConfig()

			// Current default is cloud-dev for dev builds
			expect(config.displayName).toBe("Cloud Development")
		})

		it("should include all required config fields", async () => {
			mockAsyncStorage.getItem.mockResolvedValue("cloud-dev")

			const config = await getEnvironmentConfig()

			expect(config).toHaveProperty("supabaseUrl")
			expect(config).toHaveProperty("supabaseAnonKey")
			expect(config).toHaveProperty("displayName")
			expect(config).toHaveProperty("description")
			expect(config).toHaveProperty("isProduction")
		})
	})

	describe("canSwitchEnvironment", () => {
		it("should return true in development builds", () => {
			; (Constants.expoConfig!.extra as any).isDevelopment = true

			expect(canSwitchEnvironment()).toBe(true)
		})

		it("should return false in non-development builds", () => {
			; (Constants.expoConfig!.extra as any).isDevelopment = false

			expect(canSwitchEnvironment()).toBe(false)
		})

		it("should return false when isDevelopment is undefined", () => {
			; (Constants.expoConfig!.extra as any).isDevelopment = undefined

			expect(canSwitchEnvironment()).toBe(false)
		})
	})

	describe("resetToDefault", () => {
		it("should clear AsyncStorage key", async () => {
			mockAsyncStorage.removeItem.mockResolvedValue()

			await resetToDefault()

			expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
				"@supabase_environment",
			)
		})

		it("should handle AsyncStorage errors gracefully", async () => {
			mockAsyncStorage.removeItem.mockRejectedValue(new Error("Storage error"))

			await expect(resetToDefault()).rejects.toThrow(
				"Failed to reset environment to default",
			)
		})

		it("should allow resetting even in non-dev builds", async () => {
			; (Constants.expoConfig!.extra as any).isDevelopment = false
			mockAsyncStorage.removeItem.mockResolvedValue()

			await expect(resetToDefault()).resolves.not.toThrow()
		})
	})

	describe("Error Messages", () => {
		beforeEach(() => {
			; (Constants.expoConfig!.extra as any).isDevelopment = true
		})

		it("should provide actionable error message for permission denied", async () => {
			; (Constants.expoConfig!.extra as any).isDevelopment = false

			try {
				await setEnvironment("local")
				fail("Should have thrown error")
			} catch (error: any) {
				expect(error.message).toContain("only allowed in development builds")
			}
		})

		it("should provide clear error for invalid environment", async () => {
			try {
				await setEnvironment("bad-env" as SupabaseEnvironment)
				fail("Should have thrown error")
			} catch (error: any) {
				expect(error.message).toContain("Invalid environment")
				expect(error.message).toContain("bad-env")
			}
		})
	})
})
