/**
 * Supabase Client Environment Switching Tests
 *
 * Tests the factory pattern implementation for dynamic Supabase client
 * initialization and recreation when environments change.
 *
 * Coverage:
 * - Client initialization with environment config
 * - Client getter with validation
 * - Client recreation and cleanup
 * - Event emission on client changes
 * - Error handling (no environment, invalid config)
 * - Backward compatibility
 */

import {
	initializeSupabaseClient,
	getSupabaseClient,
	reconnectSupabase,
	onSupabaseClientChange,
	getCurrentEnvironment,
	resetSupabaseClient,
} from "../supabase"
import {
	getEnvironmentConfig,
	setEnvironment,
} from "../../config/EnvironmentManager"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Mock dependencies
jest.unmock("../supabase")
jest.unmock("../../services/supabase")
jest.mock("@react-native-async-storage/async-storage")
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
jest.mock("../../config/EnvironmentManager")

// Don't mock the entire supabase module, just the EnvironmentManager it depends on
// This allows us to test the actual implementation

// Import createClient after mocking
import { createClient } from "@supabase/supabase-js"

describe("Supabase Client Environment Switching", () => {
	const mockCreateClient = createClient as jest.MockedFunction<
		typeof createClient
	>
	const mockGetEnvironmentConfig =
		getEnvironmentConfig as jest.MockedFunction<typeof getEnvironmentConfig>
	const mockSetEnvironment = setEnvironment as jest.MockedFunction<
		typeof setEnvironment
	>

	beforeEach(() => {
		jest.clearAllMocks()

		// Default mock: cloud-dev environment
		mockGetEnvironmentConfig.mockResolvedValue({
			supabaseUrl: "https://test.supabase.co",
			supabaseAnonKey: "test-anon-key",
			displayName: "Test Environment",
			description: "Test description",
			isProduction: false,
		})

		// Reset client state
		resetSupabaseClient()
	})

	describe("initializeSupabaseClient", () => {
		it("should initialize client with current environment config", async () => {
			const client = await initializeSupabaseClient()

			expect(mockGetEnvironmentConfig).toHaveBeenCalledTimes(1)
			expect(mockCreateClient).toHaveBeenCalledWith(
				"https://test.supabase.co",
				"test-anon-key",
				expect.objectContaining({
					auth: expect.objectContaining({
						storage: AsyncStorage,
						autoRefreshToken: true,
						persistSession: true,
						detectSessionInUrl: false,
					}),
				}),
			)
			expect(client).toBeDefined()
			expect(client._isTestClient).toBe(true)
		})

		it("should store client instance for later retrieval", async () => {
			const client1 = await initializeSupabaseClient()
			const client2 = getSupabaseClient()

			expect(client1).toBe(client2)
		})

		it("should replace existing client when called multiple times", async () => {
			const client1 = await initializeSupabaseClient()
			const client2 = await initializeSupabaseClient()

			expect(client1).not.toBe(client2)
			expect(mockCreateClient).toHaveBeenCalledTimes(2)
		})

		it("should handle environment config retrieval errors", async () => {
			mockGetEnvironmentConfig.mockRejectedValueOnce(
				new Error("Config error"),
			)

			await expect(initializeSupabaseClient()).rejects.toThrow("Config error")
		})

		it("should use custom auth options when provided", async () => {
			await initializeSupabaseClient({
				auth: {
					autoRefreshToken: false,
					persistSession: false,
				},
			})

			expect(mockCreateClient).toHaveBeenCalledWith(
				"https://test.supabase.co",
				"test-anon-key",
				expect.objectContaining({
					auth: expect.objectContaining({
						autoRefreshToken: false,
						persistSession: false,
					}),
				}),
			)
		})
	})

	describe("getSupabaseClient", () => {
		it("should throw error if client not initialized", () => {
			expect(() => getSupabaseClient()).toThrow(
				"Supabase client not initialized",
			)
		})

		it("should return initialized client", async () => {
			await initializeSupabaseClient()
			const client = getSupabaseClient()

			expect(client).toBeDefined()
			expect(client._isTestClient).toBe(true)
		})

		it("should return same instance on multiple calls", async () => {
			await initializeSupabaseClient()
			const client1 = getSupabaseClient()
			const client2 = getSupabaseClient()

			expect(client1).toBe(client2)
		})
	})

	describe("reconnectSupabase", () => {
		it("should cleanup old client before creating new one", async () => {
			const client1 = await initializeSupabaseClient()
			const mockRemoveSubscriptions = client1.removeAllSubscriptions as jest.Mock

			await reconnectSupabase()

			expect(mockRemoveSubscriptions).toHaveBeenCalledTimes(1)
		})

		it("should create new client with current environment", async () => {
			await initializeSupabaseClient()

			// Change environment
			mockGetEnvironmentConfig.mockResolvedValueOnce({
				supabaseUrl: "https://new.supabase.co",
				supabaseAnonKey: "new-anon-key",
				displayName: "New Environment",
				description: "New description",
				isProduction: false,
			})

			await reconnectSupabase()

			expect(mockCreateClient).toHaveBeenCalledWith(
				"https://new.supabase.co",
				"new-anon-key",
				expect.any(Object),
			)
		})

		it("should emit client-changed event after reconnection", async () => {
			await initializeSupabaseClient()

			const mockCallback = jest.fn()
			onSupabaseClientChange(mockCallback)

			await reconnectSupabase()

			expect(mockCallback).toHaveBeenCalledTimes(1)
		})

		it("should handle errors during cleanup gracefully", async () => {
			const client1 = await initializeSupabaseClient()
			const mockRemoveSubscriptions = client1.removeAllSubscriptions as jest.Mock
			mockRemoveSubscriptions.mockRejectedValueOnce(new Error("Cleanup error"))

			// Should not throw, but should log error
			const consoleErrorSpy = jest
				.spyOn(console, "error")
				.mockImplementation(() => { })

			await reconnectSupabase()

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"⚠️ Error cleaning up old Supabase client:",
				expect.any(Error),
			)

			consoleErrorSpy.mockRestore()
		})

		it("should create client even if no previous client exists", async () => {
			const client = await reconnectSupabase()

			expect(client).toBeDefined()
			expect(mockCreateClient).toHaveBeenCalledTimes(1)
		})
	})

	describe("onSupabaseClientChange", () => {
		it("should register callback for client changes", async () => {
			await initializeSupabaseClient()

			const mockCallback = jest.fn()
			const unsubscribe = onSupabaseClientChange(mockCallback)

			await reconnectSupabase()

			expect(mockCallback).toHaveBeenCalledTimes(1)
			expect(typeof unsubscribe).toBe("function")
		})

		it("should unsubscribe callback when unsubscribe function is called", async () => {
			await initializeSupabaseClient()

			const mockCallback = jest.fn()
			const unsubscribe = onSupabaseClientChange(mockCallback)

			unsubscribe()

			await reconnectSupabase()

			expect(mockCallback).not.toHaveBeenCalled()
		})

		it("should support multiple subscribers", async () => {
			await initializeSupabaseClient()

			const callback1 = jest.fn()
			const callback2 = jest.fn()

			onSupabaseClientChange(callback1)
			onSupabaseClientChange(callback2)

			await reconnectSupabase()

			expect(callback1).toHaveBeenCalledTimes(1)
			expect(callback2).toHaveBeenCalledTimes(1)
		})

		it("should handle callback errors gracefully", async () => {
			await initializeSupabaseClient()

			const errorCallback = jest.fn(() => {
				throw new Error("Callback error")
			})
			const validCallback = jest.fn()

			onSupabaseClientChange(errorCallback)
			onSupabaseClientChange(validCallback)

			const consoleErrorSpy = jest
				.spyOn(console, "error")
				.mockImplementation(() => { })

			await reconnectSupabase()

			expect(errorCallback).toHaveBeenCalledTimes(1)
			expect(validCallback).toHaveBeenCalledTimes(1)
			expect(consoleErrorSpy).toHaveBeenCalled()

			consoleErrorSpy.mockRestore()
		})
	})

	describe("getCurrentEnvironment", () => {
		it("should return current environment from last initialization", async () => {
			mockGetEnvironmentConfig.mockResolvedValueOnce({
				supabaseUrl: "https://test.supabase.co",
				supabaseAnonKey: "test-key",
				displayName: "Test Env",
				description: "Test",
				isProduction: false,
			})

			await initializeSupabaseClient()
			const env = getCurrentEnvironment()

			expect(env).toEqual({
				supabaseUrl: "https://test.supabase.co",
				supabaseAnonKey: "test-key",
				displayName: "Test Env",
				description: "Test",
				isProduction: false,
			})
		})

		it("should return null if client not initialized", () => {
			const env = getCurrentEnvironment()
			expect(env).toBeNull()
		})

		it("should update after reconnection", async () => {
			await initializeSupabaseClient()

			mockGetEnvironmentConfig.mockResolvedValueOnce({
				supabaseUrl: "https://new.supabase.co",
				supabaseAnonKey: "new-key",
				displayName: "New Env",
				description: "New",
				isProduction: true,
			})

			await reconnectSupabase()
			const env = getCurrentEnvironment()

			expect(env?.supabaseUrl).toBe("https://new.supabase.co")
			expect(env?.isProduction).toBe(true)
		})
	})

	describe("Integration: Full environment switch workflow", () => {
		it("should handle complete environment switch from local to cloud-dev", async () => {
			// Step 1: Initialize with local environment
			mockGetEnvironmentConfig.mockResolvedValueOnce({
				supabaseUrl: "http://localhost:54321",
				supabaseAnonKey: "local-key",
				displayName: "Local",
				description: "Local Supabase",
				isProduction: false,
			})

			const client1 = await initializeSupabaseClient()
			expect((client1 as any)._url).toBe("http://localhost:54321")

			// Step 2: Change environment
			mockGetEnvironmentConfig.mockResolvedValueOnce({
				supabaseUrl: "https://cloud.supabase.co",
				supabaseAnonKey: "cloud-key",
				displayName: "Cloud Dev",
				description: "Cloud Development",
				isProduction: false,
			})

			// Step 3: Reconnect
			const callback = jest.fn()
			onSupabaseClientChange(callback)

			const client2 = await reconnectSupabase()

			// Verify cleanup and recreation
			expect(client1.removeAllSubscriptions).toHaveBeenCalled()
			expect((client2 as any)._url).toBe("https://cloud.supabase.co")
			expect(callback).toHaveBeenCalled()

			// Step 4: Verify new client is active
			const activeClient = getSupabaseClient()
			expect(activeClient).toBe(client2)
		})
	})

	describe("Backward compatibility", () => {
		it("should maintain supabase export for legacy code", async () => {
			// This test verifies the deprecated export still works
			// In actual implementation, this will log a warning
			const { supabase } = require("../supabase")

			expect(supabase).toBeDefined()
			// Legacy export should return function that gets current client
		})
	})

	describe("Error scenarios", () => {
		it("should handle missing environment config gracefully", async () => {
			mockGetEnvironmentConfig.mockResolvedValueOnce({
				supabaseUrl: "",
				supabaseAnonKey: "",
				displayName: "Invalid",
				description: "Invalid config",
				isProduction: false,
			})

			await expect(initializeSupabaseClient()).rejects.toThrow()
		})

		it("should handle createClient failures", async () => {
			mockCreateClient.mockImplementationOnce(() => {
				throw new Error("Client creation failed")
			})

			await expect(initializeSupabaseClient()).rejects.toThrow(
				"Client creation failed",
			)
		})
	})

	describe("Memory management", () => {
		it("should not leak event listeners on multiple reconnects", async () => {
			await initializeSupabaseClient()

			const callback = jest.fn()
			const unsubscribe = onSupabaseClientChange(callback)

			// Multiple reconnects
			await reconnectSupabase()
			await reconnectSupabase()
			await reconnectSupabase()

			// Should be called 3 times (once per reconnect)
			expect(callback).toHaveBeenCalledTimes(3)

			// Cleanup
			unsubscribe()

			await reconnectSupabase()

			// Should still be 3 (not called after unsubscribe)
			expect(callback).toHaveBeenCalledTimes(3)
		})

		it("should cleanup subscriptions on each reconnect", async () => {
			const client1 = await initializeSupabaseClient()
			await reconnectSupabase()
			const client2 = getSupabaseClient()
			await reconnectSupabase()

			expect(client1.removeAllSubscriptions).toHaveBeenCalledTimes(1)
			expect(client2.removeAllSubscriptions).toHaveBeenCalledTimes(1)
		})
	})
})
