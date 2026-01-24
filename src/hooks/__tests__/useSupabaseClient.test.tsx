/**
 * useSupabaseClient Hook Tests
 *
 * Tests the React hook for Supabase client access with environment switching.
 */

import { renderHook, waitFor } from "@testing-library/react-native"
import {
	useSupabaseClient,
	useSupabaseClientOptional,
} from "../useSupabaseClient"


// Mock services/supabase module
import { getEnvironmentConfig } from "../../config/EnvironmentManager"
const mockResetSupabaseClient = jest.fn()
const mockInitializeSupabaseClient = jest.fn()
const mockGetSupabaseClient = jest.fn()
const mockOnSupabaseClientChange = jest.fn((callback) => {
	// Store callback for manual triggering in tests
	; (global as any).__supabaseClientChangeCallback = callback
	return jest.fn() // unsubscribe function
})
const mockReconnectSupabase = jest.fn()

jest.mock("../../services/supabase", () => ({
	...jest.requireActual("../../services/supabase"),
	initializeSupabaseClient: (...args: any[]) => (mockInitializeSupabaseClient as any)(...args),
	getSupabaseClient: (...args: any[]) => (mockGetSupabaseClient as any)(...args),
	onSupabaseClientChange: (...args: any[]) => (mockOnSupabaseClientChange as any)(...args),
	reconnectSupabase: (...args: any[]) => (mockReconnectSupabase as any)(...args),
	resetSupabaseClient: (...args: any[]) => (mockResetSupabaseClient as any)(...args),
}))

jest.mock("../../config/EnvironmentManager")

const mockGetEnvironmentConfig =
	getEnvironmentConfig as jest.MockedFunction<typeof getEnvironmentConfig>

describe("useSupabaseClient", () => {
	const mockClient = {
		from: jest.fn(),
		auth: {
			getSession: jest.fn(),
		},
		_isTestClient: true,
	}

	beforeEach(() => {
		jest.clearAllMocks()
		mockResetSupabaseClient()

		// Default mock: return initialized client
		mockGetSupabaseClient.mockReturnValue(mockClient)
		mockInitializeSupabaseClient.mockResolvedValue(mockClient as any)

		mockGetEnvironmentConfig.mockResolvedValue({
			supabaseUrl: "https://test.supabase.co",
			supabaseAnonKey: "test-key",
			displayName: "Test",
			description: "Test environment",
			isProduction: false,
		})
	})

	describe("useSupabaseClient", () => {
		it("should return existing client if already initialized", () => {
			const { result } = renderHook(() => useSupabaseClient())

			expect(result.current).toBe(mockClient)
			expect(mockInitializeSupabaseClient).not.toHaveBeenCalled()
		})

		it("should initialize client if not initialized", async () => {
			// Simulate client not initialized
			mockGetSupabaseClient.mockImplementationOnce(() => {
				throw new Error("Not initialized")
			})
			mockGetSupabaseClient.mockReturnValue(mockClient)

			const { result } = renderHook(() => useSupabaseClient())

			const error = (result as any).error;
			if (error) {
				expect(error.message).toMatch(/Supabase client is initializing/);
			}

			// Wait for initialization
			await waitFor(() => {
				expect(mockInitializeSupabaseClient).toHaveBeenCalledTimes(1)
			})
		})

		it("should update client when environment changes", async () => {
			const { result, rerender } = renderHook(() => useSupabaseClient())

			const initialClient = result.current
			expect(initialClient).toBe(mockClient)

			// Simulate environment change
			const newClient = {
				from: jest.fn(),
				auth: { getSession: jest.fn() },
				_isNewClient: true,
			}
			mockGetSupabaseClient.mockReturnValue(newClient)

			// Trigger client change callback
			const callback = (global as any).__supabaseClientChangeCallback
			callback()

			// Wait for state update
			await waitFor(() => {
				// rerender happens automatically
				expect(result.current).toBe(newClient)
			})
		})

		it("should cleanup subscription on unmount", () => {
			const unsubscribeMock = jest.fn()
			mockOnSupabaseClientChange.mockReturnValue(unsubscribeMock)

			const { unmount } = renderHook(() => useSupabaseClient())

			unmount()

			expect(unsubscribeMock).toHaveBeenCalledTimes(1)
		})

		it("should handle initialization errors", async () => {
			mockGetSupabaseClient.mockImplementationOnce(() => {
				throw new Error("Not initialized")
			})
			mockInitializeSupabaseClient.mockRejectedValueOnce(
				new Error("Init failed"),
			)

			const consoleErrorSpy = jest
				.spyOn(console, "error")
				.mockImplementation(() => { })

			const { result } = renderHook(() => useSupabaseClient())

			await waitFor(() => {
				expect(consoleErrorSpy).toHaveBeenCalledWith(
					"Failed to initialize Supabase client:",
					expect.any(Error),
				)
			})

			consoleErrorSpy.mockRestore()
		})
	})

	describe("useSupabaseClientOptional", () => {
		it("should return existing client if already initialized", () => {
			const { result } = renderHook(() => useSupabaseClientOptional())

			expect(result.current).toBe(mockClient)
			expect(mockInitializeSupabaseClient).not.toHaveBeenCalled()
		})

		it("should return null during initialization", async () => {
			mockGetSupabaseClient.mockImplementationOnce(() => {
				throw new Error("Not initialized")
			})
			mockGetSupabaseClient.mockReturnValue(mockClient)

			const { result } = renderHook(() => useSupabaseClientOptional())

			// Should return null during initialization (not throw)
			expect(result.current).toBeNull()

			// Wait for initialization
			await waitFor(() => {
				expect(result.current).toBe(mockClient)
			})

			expect(mockInitializeSupabaseClient).toHaveBeenCalledTimes(1)
		})

		it("should update client when environment changes", async () => {
			const { result, rerender } = renderHook(() => useSupabaseClientOptional())

			const initialClient = result.current
			expect(initialClient).toBe(mockClient)

			// Simulate environment change
			const newClient = {
				from: jest.fn(),
				auth: { getSession: jest.fn() },
				_isNewClient: true,
			}
			mockGetSupabaseClient.mockReturnValue(newClient)

			// Trigger client change callback
			const callback = (global as any).__supabaseClientChangeCallback
			callback()

			// Wait for state update
			await waitFor(() => {
				// rerender happens automatically
				expect(result.current).toBe(newClient)
			})
		})

		it("should return null if client change fails", async () => {
			const { result, rerender } = renderHook(() => useSupabaseClientOptional())

			expect(result.current).toBe(mockClient)

			// Simulate client change failure
			mockGetSupabaseClient.mockImplementationOnce(() => {
				throw new Error("Client unavailable")
			})

			const consoleErrorSpy = jest
				.spyOn(console, "error")
				.mockImplementation(() => { })

			// Trigger client change callback
			const callback = (global as any).__supabaseClientChangeCallback
			callback()

			// Wait for state update
			await waitFor(() => {
				// rerender happens automatically
				expect(result.current).toBeNull()
			})

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Failed to update Supabase client:",
				expect.any(Error),
			)

			consoleErrorSpy.mockRestore()
		})

		it("should handle initialization errors gracefully", async () => {
			mockGetSupabaseClient.mockImplementationOnce(() => {
				throw new Error("Not initialized")
			})
			mockInitializeSupabaseClient.mockRejectedValueOnce(
				new Error("Init failed"),
			)

			const consoleErrorSpy = jest
				.spyOn(console, "error")
				.mockImplementation(() => { })

			const { result } = renderHook(() => useSupabaseClientOptional())

			expect(result.current).toBeNull()

			await waitFor(() => {
				expect(consoleErrorSpy).toHaveBeenCalledWith(
					"Failed to initialize Supabase client:",
					expect.any(Error),
				)
			})

			// Should still be null after failure
			expect(result.current).toBeNull()

			consoleErrorSpy.mockRestore()
		})

		it("should cleanup subscription on unmount", () => {
			const unsubscribeMock = jest.fn()
			mockOnSupabaseClientChange.mockReturnValue(unsubscribeMock)

			const { unmount } = renderHook(() => useSupabaseClientOptional())

			unmount()

			expect(unsubscribeMock).toHaveBeenCalledTimes(1)
		})
	})

	describe("Integration scenarios", () => {
		it("should handle multiple components using the same client", () => {
			const { result: result1 } = renderHook(() => useSupabaseClient())
			const { result: result2 } = renderHook(() => useSupabaseClient())
			const { result: result3 } = renderHook(() => useSupabaseClientOptional())

			expect(result1.current).toBe(mockClient)
			expect(result2.current).toBe(mockClient)
			expect(result3.current).toBe(mockClient)

			// All should reference the same client instance
			expect(result1.current).toBe(result2.current)
			expect(result2.current).toBe(result3.current)
		})

		it("should update all components when environment changes", async () => {
			const { result: result1, rerender: rerender1 } = renderHook(() =>
				useSupabaseClient(),
			)
			const { result: result2, rerender: rerender2 } = renderHook(() =>
				useSupabaseClientOptional(),
			)

			// Initial state
			expect(result1.current).toBe(mockClient)
			expect(result2.current).toBe(mockClient)

			// Environment change
			const newClient = {
				from: jest.fn(),
				auth: { getSession: jest.fn() },
				_isNewClient: true,
			}
			mockGetSupabaseClient.mockReturnValue(newClient)

			// Trigger change
			const callback = (global as any).__supabaseClientChangeCallback
			callback()

			// Wait for updates
			await waitFor(() => {
				rerender1({})
				rerender2({})
				expect(result1.current).toBe(newClient)
				expect(result2.current).toBe(newClient)
			})
		})
	})
})
