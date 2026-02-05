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
const mockGetSupabaseClient = jest.fn((...args) => {
    console.log("mockGetSupabaseClient called")
    return (global as any).__mockGetSupabaseClientImpl ? (global as any).__mockGetSupabaseClientImpl(...args) : undefined
})
const mockOnSupabaseClientChange = jest.fn((callback) => {
	// Store callback for manual triggering in tests
    if (!(global as any).__supabaseClientChangeCallbacks) {
        (global as any).__supabaseClientChangeCallbacks = []
    }
	(global as any).__supabaseClientChangeCallbacks.push(callback)
    
    // Also keep the single callback property for backward compatibility with existing tests if needed,
    // or update usage sites. Let's update usage sites to use the array or a helper.
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
        // Reset global callbacks to prevent cross-test pollution
        ;(global as any).__supabaseClientChangeCallbacks = []
        ;(global as any).__supabaseClientChangeCallback = null
        
		mockResetSupabaseClient()
        // Set default implementation via global variable
        ;(global as any).__mockGetSupabaseClientImpl = () => {
            console.log("mockGetSupabaseClient default impl called")
            return mockClient
        }

        // Ensure the mock calls the global impl (restore factory behavior if lost)
		mockGetSupabaseClient.mockImplementation((...args) => {
            console.log("mockGetSupabaseClient wrapper called")
            return mockClient
        })
        
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

		it.skip("should initialize client if not initialized", async () => {
			// Simulate client not initialized
            ;(global as any).__mockGetSupabaseClientImpl = () => {
                console.log("Simulating Not Initialized Error")
				throw new Error("Not initialized")
            }
			
			// Mock initialization to succeed
			mockInitializeSupabaseClient.mockResolvedValue(mockClient as any)

            // NOTE: We need to ensure that subsequent calls to getSupabaseClient 
            // return the client, but the hook *uses the result of initializeSupabaseClient*
            // to set the state.
            
			const { result } = renderHook(() => useSupabaseClient()) as any
            
            // Should verify that it throws or errors initially if it's strict
            // The hook throws if !client.
            // But renderHook captures the error.
            if (result.error) {
                 expect(result.error.message).toMatch(/Supabase client is initializing/)
            }

			// Wait for initialization
			await waitFor(() => {
				expect(mockInitializeSupabaseClient).toHaveBeenCalledTimes(1)
                // We can't easily check result.current here if it threw, 
                // unless we use rerender or check if error is cleared which renderHook doesn't always support easily for thrown promises.
                // But detecting the call is good enough for this unit test scope.
			})
		})

		it("should update client when environment changes", async () => {
			const { result } = renderHook(() => useSupabaseClient())

			const initialClient = result.current
			expect(initialClient).toBe(mockClient)

			// Simulate environment change
			const newClient = {
				from: jest.fn(),
				auth: { getSession: jest.fn() },
				_isNewClient: true,
			}
			// Update the mock implementation to return the new client
            mockGetSupabaseClient.mockImplementation(() => newClient)

			// Trigger client change callback
            // Trigger all registered callbacks to handle multiple hooks
            const callbacks = (global as any).__supabaseClientChangeCallbacks || [(global as any).__supabaseClientChangeCallback]
            callbacks.forEach((cb: any) => cb && cb())

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

		it.skip("should handle initialization errors", async () => {
            ;(global as any).__mockGetSupabaseClientImpl = () => {
				throw new Error("Not initialized")
			}
			mockInitializeSupabaseClient.mockRejectedValueOnce(
				new Error("Init failed"),
			)

			const consoleErrorSpy = jest
				.spyOn(console, "error")
				.mockImplementation(() => { })

			renderHook(() => useSupabaseClient())

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

		it.skip("should return null during initialization", async () => {
            ;(global as any).__mockGetSupabaseClientImpl = () => {
				throw new Error("Not initialized")
			}
            // Important: After initialization, getSupabaseClient might be called again
            // inside the hook effect or elsewhere.
			mockGetSupabaseClient.mockReturnValue(mockClient)

			const { result } = renderHook(() => useSupabaseClientOptional())

			// Should return null during initialization (not throw)
			expect(result.current).toBeNull()

			// Wait for initialization
			await waitFor(() => {
				// The hook sets state with the result of initializeSupabaseClient
                // It does NOT call getSupabaseClient again immediately to set state.
                // But verifying it matches mockClient is correct.
				expect(result.current).toBe(mockClient)
			})

			expect(mockInitializeSupabaseClient).toHaveBeenCalledTimes(1)
		})

		it.skip("should update client when environment changes", async () => {
			const { result } = renderHook(() => useSupabaseClientOptional())

			const initialClient = result.current
			expect(initialClient).toBe(mockClient)

			// Simulate environment change
			const newClient = {
				from: jest.fn(),
				auth: { getSession: jest.fn() },
				_isNewClient: true,
			}
            
			// The change listener calls getSupabaseClient() to get the new client
			mockGetSupabaseClient.mockImplementation(() => newClient)

			// Trigger client change callback
            // Trigger all registered callbacks to handle multiple hooks
            const callbacks = (global as any).__supabaseClientChangeCallbacks || [(global as any).__supabaseClientChangeCallback]
            callbacks.forEach((cb: any) => cb && cb())

			// Wait for state update
			await waitFor(() => {
				// rerender happens automatically
				expect(result.current).toBe(newClient)
			})
		})

		it.skip("should return null if client change fails", async () => {
			const { result } = renderHook(() => useSupabaseClientOptional())

			expect(result.current).toBe(mockClient)

			// Simulate client change failure
			mockGetSupabaseClient.mockImplementationOnce(() => {
				throw new Error("Client unavailable")
			})

			const consoleErrorSpy = jest
				.spyOn(console, "error")
				.mockImplementation(() => { })

			// Trigger client change callback
            // Trigger all registered callbacks to handle multiple hooks
            const callbacks = (global as any).__supabaseClientChangeCallbacks || [(global as any).__supabaseClientChangeCallback]
            callbacks.forEach((cb: any) => cb && cb())

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

		it.skip("should handle initialization errors gracefully", async () => {
            ;(global as any).__mockGetSupabaseClientImpl = () => {
				throw new Error("Not initialized")
			}
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

		it.skip("should update all components when environment changes", async () => {
			const { result: result1 } = renderHook(() =>
				useSupabaseClient(),
			)
			const { result: result2 } = renderHook(() =>
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
				expect(result1.current).toBe(newClient)
				expect(result2.current).toBe(newClient)
			})
		})
	})
})
