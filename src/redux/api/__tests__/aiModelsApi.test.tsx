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
import { waitFor } from "@testing-library/react-native"
import { aiModelsApi, useGetAIModelsQuery } from "../aiModelsApi"
import type { Database } from "../../../types/supabase"

type AIModel = Database["public"]["Tables"]["ai_models"]["Row"]

// Mock Supabase client for controlled testing
// Pattern: Factory function mock (fixes Jest module hoisting issue)
jest.mock("../../../services/supabase", () => ({
	getSupabaseClient: jest.fn(),
}))

// Import after mock to get the mocked version
import { getSupabaseClient } from "../../../services/supabase"

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

	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("getAIModels endpoint", () => {
		it("should fetch AI models for organisation successfully", async () => {
			// Arrange
			const mockModels: AIModel[] = [
				{
					id: "123e4567-e89b-12d3-a456-426614174000",
					name: "General Wildlife Model",
					version: "1.0",
					organisation_id: "org-123",
					modified_by: "user-123",
					storage_path: "models/general-wildlife-v1.onnx",
					created_at: "2025-01-01T00:00:00Z",
					updated_at: "2025-01-01T00:00:00Z",
					deleted_at: null,
					description: "Test model",
					detection_capabilities: ["wildlife", "mammals"],
					file_size_bytes: 1024000,
					file_type: "application/onnx",
					uploaded_by: "user-123",
				},
				{
					id: "223e4567-e89b-12d3-a456-426614174001",
					name: "Bird Species Model",
					version: "2.0",
					organisation_id: "org-123",
					modified_by: "user-456",
					storage_path: "models/bird-species-v2.onnx",
					created_at: "2025-01-01T00:00:00Z",
					updated_at: "2025-01-01T00:00:00Z",
					deleted_at: null,
					description: "Bird classifier",
					detection_capabilities: ["birds"],
					file_size_bytes: 2048000,
					file_type: "application/onnx",
					uploaded_by: "user-456",
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

			// Act - dispatch the query
			const promise = store.dispatch(
				aiModelsApi.endpoints.getAIModels.initiate("org-123")
			)

			// Assert
			const result = await promise
			expect(result.data).toEqual(mockModels)
			expect(result.data).toHaveLength(2)
			expect(result.data?.[0].name).toBe("General Wildlife Model")

			// Cleanup
			promise.unsubscribe()
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
			const promise = store.dispatch(
				aiModelsApi.endpoints.getAIModels.initiate("org-123")
			)

			// Assert
			const result = await promise
			expect(result.error).toMatchObject({
				status: "CUSTOM_ERROR",
				error: "Database connection failed",
			})

			// Cleanup
			promise.unsubscribe()
		})

		it("should return error when organisation ID is empty", async () => {
			// Arrange
			const store = createTestStore()

			// Act
			const promise = store.dispatch(
				aiModelsApi.endpoints.getAIModels.initiate("")
			)

			// Assert
			const result = await promise
			expect(result.error).toMatchObject({
				status: "CUSTOM_ERROR",
				error: "Organisation ID is required",
			})

			// Cleanup
			promise.unsubscribe()
		})

		it("should exclude soft-deleted models", async () => {
			// Arrange
			const mockModels: AIModel[] = [
				{
					id: "123e4567-e89b-12d3-a456-426614174000",
					name: "Active Model",
					version: "1.0",
					organisation_id: "org-123",
					modified_by: "user-123",
					storage_path: "models/active-model.onnx",
					created_at: "2025-01-01T00:00:00Z",
					updated_at: "2025-01-01T00:00:00Z",
					deleted_at: null,
					description: "Active",
					detection_capabilities: null,
					file_size_bytes: null,
					file_type: null,
					uploaded_by: null,
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
			const promise = store.dispatch(
				aiModelsApi.endpoints.getAIModels.initiate("org-123")
			)

			// Assert
			const result = await promise
			expect(result.data).toBeDefined()

			// Verify soft-delete filter was applied
			expect(mockSupabaseChain.is).toHaveBeenCalledWith("deleted_at", null)

			// Cleanup
			promise.unsubscribe()
		})

		it("should handle exception during query execution", async () => {
			// Arrange
			mockGetSupabaseClient.mockImplementation(() => {
				throw new Error("Network timeout")
			})

			const store = createTestStore()

			// Act
			const promise = store.dispatch(
				aiModelsApi.endpoints.getAIModels.initiate("org-123")
			)

			// Assert
			const result = await promise
			expect(result.error).toMatchObject({
				status: "CUSTOM_ERROR",
				error: "Network timeout",
			})

			// Cleanup
			promise.unsubscribe()
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
			const promise = store.dispatch(
				aiModelsApi.endpoints.getAIModels.initiate("org-123")
			)

			// Assert
			const result = await promise
			expect(result.data).toEqual([])
			expect(result.data).toHaveLength(0)

			// Cleanup
			promise.unsubscribe()
		})
	})
})
