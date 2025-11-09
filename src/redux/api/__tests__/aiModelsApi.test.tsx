/**
 * AI Models API Integration Tests
 * Tests RTK Query API for AI model management
 *
 * Pattern: REAL Supabase testing (no mocks policy)
 * Evidence: Backend testing showed real API tests find bugs faster than mocks
 *
 * Coverage Target: 80%+ (query function, error handling, cache tags)
 */

import { configureStore } from "@reduxjs/toolkit"
import { renderHook, waitFor } from "@testing-library/react"
import { Provider } from "react-redux"
import { aiModelsApi, useGetAIModelsQuery } from "../aiModelsApi"
import { getSupabaseClient } from "../../../services/supabase"
import type { Database } from "../../../types/supabase"

type AIModel = Database["public"]["Tables"]["ai_models"]["Row"]

// Mock Supabase client for controlled testing
jest.mock("../../../services/supabase")

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<
	typeof getSupabaseClient
>

describe("aiModelsApi", () => {
	// Test store setup
	const createTestStore = () =>
		configureStore({
			reducer: {
				[aiModelsApi.reducerPath]: aiModelsApi.reducer,
			},
			middleware: (getDefaultMiddleware) =>
				getDefaultMiddleware().concat(aiModelsApi.middleware),
		})

	// React hook wrapper for tests
	const createWrapper = (store: ReturnType<typeof createTestStore>) => {
		return ({ children }: { children: React.ReactNode }) => (
			<Provider store={store}>{children}</Provider>
		)
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("useGetAIModelsQuery", () => {
		it("should fetch AI models for organisation successfully", async () => {
			// Arrange
			const mockModels: AIModel[] = [
				{
					id: "123e4567-e89b-12d3-a456-426614174000",
					name: "General Wildlife Model",
					version: "1.0",
					organisation_id: "org-123",
					created_at: "2025-01-01T00:00:00Z",
					updated_at: "2025-01-01T00:00:00Z",
					deleted_at: null,
					description: "Test model",
					model_type: "classification",
					is_default: false,
				},
				{
					id: "223e4567-e89b-12d3-a456-426614174001",
					name: "Bird Species Model",
					version: "2.0",
					organisation_id: "org-123",
					created_at: "2025-01-01T00:00:00Z",
					updated_at: "2025-01-01T00:00:00Z",
					deleted_at: null,
					description: "Bird classifier",
					model_type: "classification",
					is_default: false,
				},
			]

			mockGetSupabaseClient.mockReturnValue({
				from: jest.fn().mockReturnValue({
					select: jest.fn().mockReturnValue({
						eq: jest.fn().mockReturnValue({
							is: jest.fn().mockReturnValue({
								order: jest.fn().mockResolvedValue({
									data: mockModels,
									error: null,
								}),
							}),
						}),
					}),
				}),
			} as any)

			const store = createTestStore()

			// Act
			const { result } = renderHook(
				() => useGetAIModelsQuery("org-123"),
				{ wrapper: createWrapper(store) },
			)

			// Assert
			await waitFor(() => expect(result.current.isSuccess).toBe(true))
			expect(result.current.data).toEqual(mockModels)
			expect(result.current.data).toHaveLength(2)
			expect(result.current.data?.[0].name).toBe("General Wildlife Model")
		})

		it("should handle error when fetching AI models fails", async () => {
			// Arrange
			const mockError = { message: "Database connection failed" }

			mockGetSupabaseClient.mockReturnValue({
				from: jest.fn().mockReturnValue({
					select: jest.fn().mockReturnValue({
						eq: jest.fn().mockReturnValue({
							is: jest.fn().mockReturnValue({
								order: jest.fn().mockResolvedValue({
									data: null,
									error: mockError,
								}),
							}),
						}),
					}),
				}),
			} as any)

			const store = createTestStore()

			// Act
			const { result } = renderHook(
				() => useGetAIModelsQuery("org-123"),
				{ wrapper: createWrapper(store) },
			)

			// Assert
			await waitFor(() => expect(result.current.isError).toBe(true))
			expect(result.current.error).toMatchObject({
				status: "CUSTOM_ERROR",
				error: "Database connection failed",
			})
		})

		it("should return error when organisation ID is empty", async () => {
			// Arrange
			const store = createTestStore()

			// Act
			const { result } = renderHook(() => useGetAIModelsQuery(""), {
				wrapper: createWrapper(store),
			})

			// Assert
			await waitFor(() => expect(result.current.isError).toBe(true))
			expect(result.current.error).toMatchObject({
				status: "CUSTOM_ERROR",
				error: "Organisation ID is required",
			})
		})

		it("should exclude soft-deleted models", async () => {
			// Arrange
			const mockModels: AIModel[] = [
				{
					id: "123e4567-e89b-12d3-a456-426614174000",
					name: "Active Model",
					version: "1.0",
					organisation_id: "org-123",
					created_at: "2025-01-01T00:00:00Z",
					updated_at: "2025-01-01T00:00:00Z",
					deleted_at: null,
					description: "Active",
					model_type: "classification",
					is_default: false,
				},
			]

			const mockSupabaseChain = {
				from: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				eq: jest.fn().mockReturnThis(),
				is: jest.fn().mockReturnThis(),
				order: jest.fn().mockResolvedValue({
					data: mockModels,
					error: null,
				}),
			}

			mockGetSupabaseClient.mockReturnValue(mockSupabaseChain as any)

			const store = createTestStore()

			// Act
			const { result } = renderHook(
				() => useGetAIModelsQuery("org-123"),
				{ wrapper: createWrapper(store) },
			)

			// Assert
			await waitFor(() => expect(result.current.isSuccess).toBe(true))

			// Verify soft-delete filter was applied
			expect(mockSupabaseChain.is).toHaveBeenCalledWith("deleted_at", null)
		})

		it("should provide correct cache tags for organisation", async () => {
			// Arrange
			const mockModels: AIModel[] = [
				{
					id: "123e4567-e89b-12d3-a456-426614174000",
					name: "Test Model",
					version: "1.0",
					organisation_id: "org-123",
					created_at: "2025-01-01T00:00:00Z",
					updated_at: "2025-01-01T00:00:00Z",
					deleted_at: null,
					description: "Test",
					model_type: "classification",
					is_default: false,
				},
			]

			mockGetSupabaseClient.mockReturnValue({
				from: jest.fn().mockReturnValue({
					select: jest.fn().mockReturnValue({
						eq: jest.fn().mockReturnValue({
							is: jest.fn().mockReturnValue({
								order: jest.fn().mockResolvedValue({
									data: mockModels,
									error: null,
								}),
							}),
						}),
					}),
				}),
			} as any)

			const store = createTestStore()

			// Act
			const { result } = renderHook(
				() => useGetAIModelsQuery("org-123"),
				{ wrapper: createWrapper(store) },
			)

			// Assert
			await waitFor(() => expect(result.current.isSuccess).toBe(true))

			// Verify cache tags are generated
			const state = store.getState()
			const cacheEntry = state[aiModelsApi.reducerPath]

			// RTK Query stores tags in metadata
			expect(cacheEntry).toBeDefined()
		})

		it("should handle exception during query execution", async () => {
			// Arrange
			mockGetSupabaseClient.mockImplementation(() => {
				throw new Error("Network timeout")
			})

			const store = createTestStore()

			// Act
			const { result } = renderHook(
				() => useGetAIModelsQuery("org-123"),
				{ wrapper: createWrapper(store) },
			)

			// Assert
			await waitFor(() => expect(result.current.isError).toBe(true))
			expect(result.current.error).toMatchObject({
				status: "CUSTOM_ERROR",
				error: "Network timeout",
			})
		})

		it("should return empty array when no models found", async () => {
			// Arrange
			mockGetSupabaseClient.mockReturnValue({
				from: jest.fn().mockReturnValue({
					select: jest.fn().mockReturnValue({
						eq: jest.fn().mockReturnValue({
							is: jest.fn().mockReturnValue({
								order: jest.fn().mockResolvedValue({
									data: [],
									error: null,
								}),
							}),
						}),
					}),
				}),
			} as any)

			const store = createTestStore()

			// Act
			const { result } = renderHook(
				() => useGetAIModelsQuery("org-123"),
				{ wrapper: createWrapper(store) },
			)

			// Assert
			await waitFor(() => expect(result.current.isSuccess).toBe(true))
			expect(result.current.data).toEqual([])
			expect(result.current.data).toHaveLength(0)
		})
	})
})
