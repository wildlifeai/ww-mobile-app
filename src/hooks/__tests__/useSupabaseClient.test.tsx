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
		mockGetSupabaseClient.mockImplementation((..._args) => {
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
	})

	describe("useSupabaseClientOptional", () => {
		it("should return existing client if already initialized", () => {
			const { result } = renderHook(() => useSupabaseClientOptional())

			expect(result.current).toBe(mockClient)
			expect(mockInitializeSupabaseClient).not.toHaveBeenCalled()
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
	})
})
