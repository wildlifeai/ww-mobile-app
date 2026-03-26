/**
 * Unit Tests for Environment Configuration System
 *
 * Tests environment detection, validation, and configuration retrieval logic.
 * Covers all public APIs and edge cases.
 */

import {
	SupabaseEnvironment,
	ENVIRONMENT_CONFIGS,
	getDefaultEnvironment,
	isValidEnvironment,
	getEnvironmentConfig,
	isEnvironmentConfigured,
	getAvailableEnvironments,
	getEnvironmentDebugInfo,
} from "../environments"
import Constants from "expo-constants"

// Mock expo-constants
jest.mock("expo-constants", () => ({
	expoConfig: {
		extra: {
			supabaseUrl: "https://test.supabase.co",
			supabaseAnonKey: "test-anon-key",
		},
	},
}))

describe("Environment Configuration System", () => {
	// Store original environment variables and __DEV__ flag
	const originalEnv = process.env
	const originalDev = (global as any).__DEV__
	const originalCloudProdUrl = ENVIRONMENT_CONFIGS["cloud-prod"].supabaseUrl
	const originalCloudProdKey = ENVIRONMENT_CONFIGS["cloud-prod"].supabaseAnonKey

	beforeEach(() => {
		// Reset environment variables before each test
		process.env = { ...originalEnv }
		// Default to development mode
		;(global as any).__DEV__ = true
		// Reset Constants mock
		;(Constants as any).expoConfig = { extra: {} }
		
		// Ensure cloud-prod is unconfigured for tests (simulating default state)
		ENVIRONMENT_CONFIGS["cloud-prod"].supabaseUrl = ""
		ENVIRONMENT_CONFIGS["cloud-prod"].supabaseAnonKey = ""
	})

	afterEach(() => {
		// Restore original environment and __DEV__
		process.env = originalEnv
		;(global as any).__DEV__ = originalDev
		
		// Restore original cloud-prod configuration
		ENVIRONMENT_CONFIGS["cloud-prod"].supabaseUrl = originalCloudProdUrl
		ENVIRONMENT_CONFIGS["cloud-prod"].supabaseAnonKey = originalCloudProdKey
	})

	describe("ENVIRONMENT_CONFIGS", () => {
		it("should have local environment configured with WSL host IP", () => {
			const local = ENVIRONMENT_CONFIGS.local
			expect(local.supabaseUrl).toBe("http://192.168.1.239:54321")
			expect(local.supabaseAnonKey).toBeTruthy()
			expect(local.displayName).toBe("Local Development")
			expect(local.isProduction).toBe(false)
		})

		it("should have cloud-dev environment configured", () => {
			const cloudDev = ENVIRONMENT_CONFIGS["cloud-dev"]
			expect(cloudDev.supabaseUrl).toContain("supabase.co")
			expect(cloudDev.supabaseAnonKey).toBeTruthy()
			expect(cloudDev.displayName).toBe("Cloud Development")
			expect(cloudDev.isProduction).toBe(false)
		})

		it("should have cloud-prod marked as production environment", () => {
			const cloudProd = ENVIRONMENT_CONFIGS["cloud-prod"]
			expect(cloudProd.isProduction).toBe(true)
			expect(cloudProd.displayName).toBe("Cloud Production")
		})

		it("should have all configurations include required fields", () => {
			const environments: SupabaseEnvironment[] = [
				"local",
				"cloud-dev",
				"cloud-prod",
			]

			environments.forEach((env) => {
				const config = ENVIRONMENT_CONFIGS[env]
				expect(config).toHaveProperty("supabaseUrl")
				expect(config).toHaveProperty("supabaseAnonKey")
				expect(config).toHaveProperty("displayName")
				expect(config).toHaveProperty("description")
				expect(config).toHaveProperty("isProduction")
				expect(typeof config.isProduction).toBe("boolean")
			})
		})
	})

	describe("getDefaultEnvironment", () => {
		it("should return cloud-dev in development mode by default", () => {
			; (global as any).__DEV__ = true
			expect(getDefaultEnvironment()).toBe("cloud-dev")
		})

		it("should return cloud-dev when APP_VARIANT is development", () => {
			;(global as any).__DEV__ = false
			;(Constants as any).expoConfig = {
				extra: {
					isDevelopment: true,
				},
			}
			expect(getDefaultEnvironment()).toBe("cloud-dev")
		})

		it("should return cloud-prod in production mode", () => {
			; (global as any).__DEV__ = false
				; (process.env as any).APP_VARIANT = "production"
			expect(getDefaultEnvironment()).toBe("cloud-prod")
		})

		it("should respect EXPO_PUBLIC_SUPABASE_ENV override", () => {
			;(Constants as any).expoConfig = {
				extra: {
					supabaseEnv: "local",
				},
			}
			expect(getDefaultEnvironment()).toBe("local")
		})

		it("should ignore invalid EXPO_PUBLIC_SUPABASE_ENV values", () => {
			; (global as any).__DEV__ = true
				; (process.env as any).EXPO_PUBLIC_SUPABASE_ENV = "invalid-env" as any
			// Should fall back to development default
			expect(getDefaultEnvironment()).toBe("cloud-dev")
		})
	})

	describe("isValidEnvironment", () => {
		it("should return true for valid environment strings", () => {
			expect(isValidEnvironment("local")).toBe(true)
			expect(isValidEnvironment("cloud-dev")).toBe(true)
			expect(isValidEnvironment("cloud-prod")).toBe(true)
		})

		it("should return false for invalid environment strings", () => {
			expect(isValidEnvironment("invalid")).toBe(false)
			expect(isValidEnvironment("production")).toBe(false)
			expect(isValidEnvironment("dev")).toBe(false)
			expect(isValidEnvironment("")).toBe(false)
			expect(isValidEnvironment("CLOUD-DEV")).toBe(false) // Case sensitive
		})

		it("should provide type narrowing for TypeScript", () => {
			const env = "local" as string

			if (isValidEnvironment(env)) {
				// TypeScript should know env is SupabaseEnvironment here
				const config = ENVIRONMENT_CONFIGS[env] // Should not cause TS error
				expect(config).toBeDefined()
			}
		})
	})

	describe("getEnvironmentConfig", () => {
		it("should return correct configuration for local environment", () => {
			const config = getEnvironmentConfig("local")
			expect(config.supabaseUrl).toBe("http://192.168.1.239:54321")
			expect(config.displayName).toBe("Local Development")
			expect(config.isProduction).toBe(false)
		})

		it("should return correct configuration for cloud-dev environment", () => {
			const config = getEnvironmentConfig("cloud-dev")
			expect(config.supabaseUrl).toContain("supabase.co")
			expect(config.displayName).toBe("Cloud Development")
			expect(config.isProduction).toBe(false)
		})

		it("should throw error for unconfigured cloud-prod environment", () => {
			// Cloud-prod is intentionally not configured by default
			expect(() => getEnvironmentConfig("cloud-prod")).toThrow(
				/Incomplete configuration for environment 'cloud-prod'/,
			)
		})

		it("should throw error for incomplete cloud-prod configuration", () => {
			// Cloud-prod intentionally has empty credentials by default
			expect(() => getEnvironmentConfig("cloud-prod")).toThrow(
				/Incomplete configuration for environment 'cloud-prod'/,
			)
		})

		it("should include missing fields in error message", () => {
			expect(() => getEnvironmentConfig("cloud-prod")).toThrow(/supabaseUrl/)
			expect(() => getEnvironmentConfig("cloud-prod")).toThrow(
				/supabaseAnonKey/,
			)
		})
	})

	describe("isEnvironmentConfigured", () => {
		it("should return true for local environment", () => {
			expect(isEnvironmentConfigured("local")).toBe(true)
		})

		it("should return true for cloud-dev environment", () => {
			expect(isEnvironmentConfigured("cloud-dev")).toBe(true)
		})

		it("should return false for cloud-prod environment (not configured)", () => {
			expect(isEnvironmentConfigured("cloud-prod")).toBe(false)
		})

		it("should handle validation errors gracefully", () => {
			// Should not throw, just return false
			expect(isEnvironmentConfigured("cloud-prod")).toBe(false)
		})
	})

	describe("getAvailableEnvironments", () => {
		it("should return only configured environments", () => {
			const available = getAvailableEnvironments()
			expect(available).toContain("local")
			expect(available).toContain("cloud-dev")
			expect(available).not.toContain("cloud-prod") // Not configured
		})

		it("should return array of SupabaseEnvironment types", () => {
			const available = getAvailableEnvironments()
			available.forEach((env) => {
				expect(isValidEnvironment(env)).toBe(true)
			})
		})

		it("should return at least two environments", () => {
			const available = getAvailableEnvironments()
			expect(available.length).toBeGreaterThanOrEqual(2)
		})
	})

	describe("getEnvironmentDebugInfo", () => {
		it("should return formatted debug info for local environment", () => {
			const info = getEnvironmentDebugInfo("local")
			expect(info).toContain("Environment: Local Development")
			expect(info).toContain("URL: http://192.168.1.239:54321")
			// Local URL extracts IP as project ref
			expect(info).toContain("Project: 192")
			expect(info).toContain("Production: false")
			expect(info).toContain("Configured: true")
		})

		it("should return formatted debug info for cloud-dev environment", () => {
			const info = getEnvironmentDebugInfo("cloud-dev")
			expect(info).toContain("Environment: Cloud Development")
			expect(info).toContain("supabase.co")
			expect(info).toContain("Production: false")
			expect(info).toContain("Configured: true")
		})

		it("should extract project reference from URL", () => {
			const info = getEnvironmentDebugInfo("cloud-dev")
			// Should extract subdomain from Supabase URL
			expect(info).toMatch(/Project: \w+/)
			// Verify it contains a project identifier (not just empty)
			const projectMatch = info.match(/Project: (\w+)/)
			expect(projectMatch).toBeTruthy()
			expect(projectMatch![1].length).toBeGreaterThan(0)
		})

		it("should not expose sensitive keys in debug info", () => {
			const info = getEnvironmentDebugInfo("cloud-dev")
			// Should not contain the full anon key
			expect(info).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")
			expect(info).not.toContain("sb_publishable_")
		})

		it("should show configured status for cloud-prod", () => {
			const info = getEnvironmentDebugInfo("cloud-prod")
			expect(info).toContain("Configured: false")
		})
	})

	describe("Integration scenarios", () => {
		it("should support full workflow: validate -> get config -> debug", () => {
			const env = "cloud-dev"

			// Step 1: Validate
			expect(isValidEnvironment(env)).toBe(true)

			// Step 2: Check if configured
			expect(isEnvironmentConfigured(env)).toBe(true)

			// Step 3: Get config
			const config = getEnvironmentConfig(env)
			expect(config).toBeDefined()
			expect(config.supabaseUrl).toBeTruthy()

			// Step 4: Get debug info
			const debugInfo = getEnvironmentDebugInfo(env)
			expect(debugInfo).toContain(config.displayName)
		})

		it("should handle unconfigured environment gracefully", () => {
			const env: SupabaseEnvironment = "cloud-prod"

			// Should pass validation
			expect(isValidEnvironment(env)).toBe(true)

			// Should fail configuration check
			expect(isEnvironmentConfigured(env)).toBe(false)

			// Should throw on config retrieval
			expect(() => getEnvironmentConfig(env)).toThrow()

			// But debug info should still work
			const debugInfo = getEnvironmentDebugInfo(env)
			expect(debugInfo).toContain("Cloud Production")
		})

		it("should correctly identify production environments", () => {
			const environments: SupabaseEnvironment[] = [
				"local",
				"cloud-dev",
				"cloud-prod",
			]

			const productionEnvs = environments.filter((env) => {
				const config = ENVIRONMENT_CONFIGS[env]
				return config.isProduction
			})

			expect(productionEnvs).toEqual(["cloud-prod"])
			expect(productionEnvs.length).toBe(1)
		})
	})
})
