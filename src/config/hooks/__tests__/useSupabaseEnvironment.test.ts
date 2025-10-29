/**
 * useSupabaseEnvironment Hook Unit Tests
 *
 * Tests React hook for environment management with proper state handling.
 * Following TDD: Tests written BEFORE implementation.
 */

import { renderHook, act, waitFor } from "@testing-library/react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import Constants from "expo-constants"
import { useSupabaseEnvironment } from "../useSupabaseEnvironment"

// Mock dependencies
jest.mock("@react-native-async-storage/async-storage")
jest.mock("expo-constants", () => ({
	expoConfig: {
		extra: {
			isDevelopment: true,
		},
	},
}))

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>

// Simulate persistent storage
let inMemoryStorage: Record<string, string> = {}

describe("useSupabaseEnvironment Hook", () => {
	beforeEach(() => {
		// Reset storage
		inMemoryStorage = {}

		// Setup AsyncStorage mock
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

		// Set dev mode
		;(Constants.expoConfig!.extra as any).isDevelopment = true

		jest.clearAllMocks()
	})

	describe("Initial State", () => {
		it("should start with loading state", () => {
			const { result } = renderHook(() => useSupabaseEnvironment())

			expect(result.current.isLoading).toBe(true)
			expect(result.current.environment).toBeNull()
			expect(result.current.config).toBeNull()
			expect(result.current.error).toBeNull()
		})

		it("should load environment on mount", async () => {
			const { result } = renderHook(() => useSupabaseEnvironment())

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false)
			})

			expect(result.current.environment).toBe("cloud-dev") // Default for dev (current)
			expect(result.current.config).not.toBeNull()
			expect(result.current.config?.displayName).toBe("Cloud Development")
		})

		it("should load stored environment from AsyncStorage", async () => {
			inMemoryStorage["@supabase_environment"] = "cloud-dev"

			const { result } = renderHook(() => useSupabaseEnvironment())

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false)
			})

			expect(result.current.environment).toBe("cloud-dev")
			expect(result.current.config?.displayName).toBe("Cloud Development")
		})
	})

	describe("Loading States", () => {
		it("should set loading false after successful load", async () => {
			const { result } = renderHook(() => useSupabaseEnvironment())

			expect(result.current.isLoading).toBe(true)

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false)
			})
		})

		it("should set loading true during setEnvironment", async () => {
			const { result } = renderHook(() => useSupabaseEnvironment())

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false)
			})

			// Start environment change
			act(() => {
				result.current.setEnvironment("cloud-dev")
			})

			// Should be loading during change
			expect(result.current.isLoading).toBe(true)

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false)
			})
		})
	})

	describe("Setting Environment", () => {
		it("should update environment and re-render", async () => {
			const { result } = renderHook(() => useSupabaseEnvironment())

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false)
			})

			// Initial environment
			expect(result.current.environment).toBe("cloud-dev")

			// Change environment
			await act(async () => {
				await result.current.setEnvironment("local")
			})

			// Should update
			await waitFor(() => {
				expect(result.current.environment).toBe("local")
				expect(result.current.config?.displayName).toBe("Local Development")
			})
		})

		it("should persist environment change to AsyncStorage", async () => {
			const { result } = renderHook(() => useSupabaseEnvironment())

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false)
			})

			await act(async () => {
				await result.current.setEnvironment("cloud-prod")
			})

			expect(inMemoryStorage["@supabase_environment"]).toBe("cloud-prod")
		})

		it("should handle setEnvironment errors", async () => {
			;(Constants.expoConfig!.extra as any).isDevelopment = false

			const { result } = renderHook(() => useSupabaseEnvironment())

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false)
			})

			// Try to set environment in non-dev build
			await act(async () => {
				await result.current.setEnvironment("local")
			})

			// Should set error
			await waitFor(() => {
				expect(result.current.error).not.toBeNull()
				expect(result.current.error?.message).toContain(
					"only allowed in development builds",
				)
			})
		})
	})

	describe("Error Handling", () => {
		it("should set error on AsyncStorage read failure", async () => {
			mockAsyncStorage.getItem.mockRejectedValueOnce(new Error("Storage error"))

			const { result } = renderHook(() => useSupabaseEnvironment())

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false)
			})

			// Should fallback to default but not crash
			expect(result.current.environment).toBe("cloud-dev")
			expect(result.current.error).toBeNull() // Read errors are handled silently
		})

		it("should clear previous error on successful setEnvironment", async () => {
			const { result } = renderHook(() => useSupabaseEnvironment())

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false)
			})

			// Cause an error
			;(Constants.expoConfig!.extra as any).isDevelopment = false
			await act(async () => {
				await result.current.setEnvironment("local")
			})

			await waitFor(() => {
				expect(result.current.error).not.toBeNull()
			})

			// Fix permission and retry
			;(Constants.expoConfig!.extra as any).isDevelopment = true
			await act(async () => {
				await result.current.setEnvironment("cloud-dev")
			})

			// Error should be cleared
			await waitFor(() => {
				expect(result.current.error).toBeNull()
			})
		})
	})

	describe("canSwitch Permission", () => {
		it("should return true in development builds", async () => {
			;(Constants.expoConfig!.extra as any).isDevelopment = true

			const { result } = renderHook(() => useSupabaseEnvironment())

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false)
			})

			expect(result.current.canSwitch).toBe(true)
		})

		it("should return false in production builds", async () => {
			;(Constants.expoConfig!.extra as any).isDevelopment = false

			const { result } = renderHook(() => useSupabaseEnvironment())

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false)
			})

			expect(result.current.canSwitch).toBe(false)
		})
	})

	describe("Re-rendering Behavior", () => {
		it("should only re-render when state changes", async () => {
			let renderCount = 0

			const { result } = renderHook(() => {
				renderCount++
				return useSupabaseEnvironment()
			})

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false)
			})

			const initialRenderCount = renderCount

			// Change environment
			await act(async () => {
				await result.current.setEnvironment("cloud-dev")
			})

			await waitFor(() => {
				expect(result.current.environment).toBe("cloud-dev")
			})

			// Should have re-rendered (loading true → loading false → updated environment)
			expect(renderCount).toBeGreaterThan(initialRenderCount)
		})

		it.skip("should not re-render unnecessarily", async () => {
			let renderCount = 0

			const { result } = renderHook(() => {
				renderCount++
				return useSupabaseEnvironment()
			})

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false)
			})

			const stableRenderCount = renderCount

			// Wait a bit to ensure no extra renders
			await new Promise((resolve) => setTimeout(resolve, 100))

			expect(renderCount).toBe(stableRenderCount)
		}, 10000) // Increase timeout for this test
	})

	describe("Return Value Structure", () => {
		it("should return all required properties", async () => {
			const { result } = renderHook(() => useSupabaseEnvironment())

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false)
			})

			expect(result.current).toHaveProperty("environment")
			expect(result.current).toHaveProperty("config")
			expect(result.current).toHaveProperty("isLoading")
			expect(result.current).toHaveProperty("error")
			expect(result.current).toHaveProperty("setEnvironment")
			expect(result.current).toHaveProperty("canSwitch")
		})

		it("should have setEnvironment as a stable function reference", async () => {
			const { result } = renderHook(() => useSupabaseEnvironment())

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false)
			})

			const setEnvFn1 = result.current.setEnvironment

			// Trigger re-render
			await act(async () => {
				await result.current.setEnvironment("cloud-dev")
			})

			const setEnvFn2 = result.current.setEnvironment

			// Function reference should be stable
			expect(setEnvFn1).toBe(setEnvFn2)
		})
	})
})
