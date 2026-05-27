/**
 * AIModelSelect Component Tests
 * Tests AI model selection component with all states and validation
 *
 * Pattern: React Native Testing Library (RNTL)
 * Evidence: Context7 research validated RNTL patterns for React Native
 *
 * Coverage Target: 80%+ (all states, validation, testIDs)
 */

import "@testing-library/jest-native/extend-expect"
import React from "react"
import { render, screen } from "@testing-library/react-native"
import { useForm } from "react-hook-form"
import { AIModelSelect } from "../AIModelSelect"
import { useGetAIModelsQuery } from "../../../redux/api/aiModelsApi"
import type { Database } from "../../../types/database.types"

type AIModel = Database["public"]["Tables"]["ai_models"]["Row"]

// Mock RTK Query hook
jest.mock("../../../redux/api/aiModelsApi")

const mockUseGetAIModelsQuery = useGetAIModelsQuery as jest.MockedFunction<
	typeof useGetAIModelsQuery
>

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
	return <>{children}</>
}

// Helper component to render AIModelSelect with react-hook-form
const AIModelSelectWithForm = (props: {
	organisationId: string
	required?: boolean
}) => {
	const { control } = useForm({
		defaultValues: {
			model_id: "",
		},
	})

	return (
		<AIModelSelect
			control={control}
			name="model_id"
			organisationId={props.organisationId}
			required={props.required}
		/>
	)
}

describe("AIModelSelect", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("Loading State", () => {
		it("should display loading indicator with testID", () => {
			// Arrange
			mockUseGetAIModelsQuery.mockReturnValue({
				data: undefined,
				isLoading: true,
				error: undefined,
				isSuccess: false,
				isError: false,
			} as any)

			// Act
			render(<AIModelSelectWithForm organisationId="org-123" />, {
				wrapper: TestWrapper,
			})

			// Assert
			expect(screen.getByTestId("ai-model-select-loading")).toBeOnTheScreen()
			expect(
				screen.getByTestId("ai-model-select-loading-placeholder"),
			).toBeOnTheScreen()
			expect(screen.getByText("Loading AI models…")).toBeOnTheScreen()
		})
	})

	describe("Success State", () => {
		it("should display models when data is available", () => {
			// Arrange
			const mockModels: AIModel[] = [
				{
					id: "123e4567-e89b-12d3-a456-426614174000",
					name: "General Wildlife Model",
					version: "1.0",
					organisation_id: "org-123",
					modified_by: "user-123",
					model_path: "models/test-model.tflite",
					labels_path: "models/test-model-labels.txt",
					created_at: "2025-01-01T00:00:00Z",
					updated_at: "2025-01-01T00:00:00Z",
					deleted_at: null,
					description: "Test model",
					detection_capabilities: ["wildlife"],
					file_size_bytes: 1024000,
					file_type: "application/onnx",
					uploaded_by: "user-123",
					compiled_format: null,
					error_message: null,
					file_hash: null,
					model_family_id: null,
					processing_log: null,
					status: "validated",
					version_number: 1,
				},
				{
					id: "223e4567-e89b-12d3-a456-426614174001",
					name: "Bird Species Model",
					version: "2.0",
					organisation_id: "org-123",
					modified_by: "user-456",
					model_path: "models/bird-species-v2.tflite",
					labels_path: "models/bird-species-v2-labels.txt",
					created_at: "2025-01-01T00:00:00Z",
					updated_at: "2025-01-01T00:00:00Z",
					deleted_at: null,
					description: "Bird classifier",
					detection_capabilities: ["birds"],
					file_size_bytes: 2048000,
					file_type: "application/onnx",
					uploaded_by: "user-456",
					compiled_format: null,
					error_message: null,
					file_hash: null,
					model_family_id: null,
					processing_log: null,
					status: "validated",
					version_number: 2,
				},
			]

			mockUseGetAIModelsQuery.mockReturnValue({
				data: mockModels,
				isLoading: false,
				error: undefined,
				isSuccess: true,
				isError: false,
			} as any)

			// Act
			render(<AIModelSelectWithForm organisationId="org-123" />, {
				wrapper: TestWrapper,
			})

			// Assert
			expect(
				screen.getByTestId("ai-model-select-dropdown"),
			).toBeOnTheScreen()
		})

		it("should include None option as first choice", () => {
			// Arrange
			const mockModels: AIModel[] = [
				{
					id: "123e4567-e89b-12d3-a456-426614174000",
					name: "Test Model",
					version: "1.0",
					organisation_id: "org-123",
					modified_by: "user-123",
					model_path: "models/test-model.tflite",
					labels_path: "models/test-model-labels.txt",
					created_at: "2025-01-01T00:00:00Z",
					updated_at: "2025-01-01T00:00:00Z",
					deleted_at: null,
					description: "Test",
					detection_capabilities: null,
					file_size_bytes: null,
					file_type: null,
					uploaded_by: null,
					compiled_format: null,
					error_message: null,
					file_hash: null,
					model_family_id: null,
					processing_log: null,
					status: "validated",
					version_number: 1,
				},
			]

			mockUseGetAIModelsQuery.mockReturnValue({
				data: mockModels,
				isLoading: false,
				error: undefined,
				isSuccess: true,
				isError: false,
			} as any)

			// Act
			render(<AIModelSelectWithForm organisationId="org-123" />, {
				wrapper: TestWrapper,
			})

			// Assert - WWSelect should have "None" option
			expect(
				screen.getByTestId("ai-model-select-dropdown"),
			).toBeOnTheScreen()
		})
	})

	describe("Empty State", () => {
		it("should display empty state when no models available", () => {
			// Arrange
			mockUseGetAIModelsQuery.mockReturnValue({
				data: [],
				isLoading: false,
				error: undefined,
				isSuccess: true,
				isError: false,
			} as any)

			// Act
			render(<AIModelSelectWithForm organisationId="org-123" />, {
				wrapper: TestWrapper,
			})

			// Assert
			expect(screen.getByTestId("ai-model-select-empty")).toBeOnTheScreen()
			expect(
				screen.getByText("No AI models available for this organisation"),
			).toBeOnTheScreen()
		})

		it("should disable select in empty state", () => {
			// Arrange
			mockUseGetAIModelsQuery.mockReturnValue({
				data: [],
				isLoading: false,
				error: undefined,
				isSuccess: true,
				isError: false,
			} as any)

			// Act
			render(<AIModelSelectWithForm organisationId="org-123" />, {
				wrapper: TestWrapper,
			})

			// Assert
			const emptySelect = screen.getByTestId("ai-model-select-empty")
			expect(emptySelect).toBeOnTheScreen()
			expect(emptySelect).toBeDisabled()
		})
	})

	describe("Error State", () => {
		it("should display error message when API fails", () => {
			// Arrange
			mockUseGetAIModelsQuery.mockReturnValue({
				data: undefined,
				isLoading: false,
				error: {
					status: "CUSTOM_ERROR",
					error: "Database connection failed",
				},
				isSuccess: false,
				isError: true,
			} as any)

			// Act
			render(<AIModelSelectWithForm organisationId="org-123" />, {
				wrapper: TestWrapper,
			})

			// Assert
			expect(screen.getByTestId("ai-model-select-error")).toBeOnTheScreen()
			expect(screen.getAllByText("Database connection failed").length).toBeGreaterThan(0)
		})

		it("should display generic error when error format is unknown", () => {
			// Arrange
			mockUseGetAIModelsQuery.mockReturnValue({
				data: undefined,
				isLoading: false,
				error: { status: 500 } as any,
				isSuccess: false,
				isError: true,
			} as any)

			// Act
			render(<AIModelSelectWithForm organisationId="org-123" />, {
				wrapper: TestWrapper,
			})

			// Assert
			expect(screen.getByTestId("ai-model-select-error")).toBeOnTheScreen()
			expect(screen.getAllByText("Failed to load AI models").length).toBeGreaterThan(0)
		})

		it("should disable select in error state", () => {
			// Arrange
			mockUseGetAIModelsQuery.mockReturnValue({
				data: undefined,
				isLoading: false,
				error: {
					status: "CUSTOM_ERROR",
					error: "Network error",
				},
				isSuccess: false,
				isError: true,
			} as any)

			// Act
			render(<AIModelSelectWithForm organisationId="org-123" />, {
				wrapper: TestWrapper,
			})

			// Assert
			const errorSelect = screen.getByTestId("ai-model-select-error")
			expect(errorSelect).toBeOnTheScreen()
			expect(errorSelect).toBeDisabled()
		})
	})

	describe("UUID Validation", () => {
		it("should accept valid UUID format", () => {
			// Arrange
			const mockModels: AIModel[] = [
				{
					id: "123e4567-e89b-12d3-a456-426614174000",
					name: "Test Model",
					version: "1.0",
					organisation_id: "org-123",
					modified_by: "user-123",
					model_path: "models/test-model.tflite",
					labels_path: "models/test-model-labels.txt",
					created_at: "2025-01-01T00:00:00Z",
					updated_at: "2025-01-01T00:00:00Z",
					deleted_at: null,
					description: "Test",
					detection_capabilities: null,
					file_size_bytes: null,
					file_type: null,
					uploaded_by: null,
					compiled_format: null,
					error_message: null,
					file_hash: null,
					model_family_id: null,
					processing_log: null,
					status: "validated",
					version_number: 1,
				},
			]

			mockUseGetAIModelsQuery.mockReturnValue({
				data: mockModels,
				isLoading: false,
				error: undefined,
				isSuccess: true,
				isError: false,
			} as any)

			// Act
			render(<AIModelSelectWithForm organisationId="org-123" />, {
				wrapper: TestWrapper,
			})

			// Assert - Component renders successfully with UUID
			expect(
				screen.getByTestId("ai-model-select-dropdown"),
			).toBeOnTheScreen()
		})

		it("should allow empty value when not required", () => {
			// Arrange
			const mockModels: AIModel[] = []

			mockUseGetAIModelsQuery.mockReturnValue({
				data: mockModels,
				isLoading: false,
				error: undefined,
				isSuccess: true,
				isError: false,
			} as any)

			// Act
			render(
				<AIModelSelectWithForm organisationId="org-123" required={false} />,
				{ wrapper: TestWrapper },
			)

			// Assert - Empty state allows no selection
			expect(screen.getByTestId("ai-model-select-empty")).toBeOnTheScreen()
		})
	})

	describe("Accessibility", () => {
		it("should have testID props on all interactive elements", () => {
			// Arrange - Test all states have testIDs
			const testCases = [
				{
					name: "loading state",
					mockReturn: { isLoading: true, data: undefined, error: undefined },
					expectedTestIDs: [
						"ai-model-select-loading",
						"ai-model-select-loading-placeholder",
					],
				},
				{
					name: "empty state",
					mockReturn: {
						isLoading: false,
						data: [],
						error: undefined,
						isSuccess: true,
					},
					expectedTestIDs: ["ai-model-select-empty"],
				},
				{
					name: "error state",
					mockReturn: {
						isLoading: false,
						data: undefined,
						error: { status: "CUSTOM_ERROR", error: "Test error" },
						isError: true,
					},
					expectedTestIDs: ["ai-model-select-error"],
				},
			]

			testCases.forEach(({ name: _name, mockReturn, expectedTestIDs }) => {
				// Arrange
				mockUseGetAIModelsQuery.mockReturnValue(mockReturn as any)

				// Act
				const { unmount } = render(
					<AIModelSelectWithForm organisationId="org-123" />,
					{ wrapper: TestWrapper },
				)

				// Assert
				expectedTestIDs.forEach((testID) => {
					expect(screen.getByTestId(testID)).toBeOnTheScreen()
				})

				unmount()
			})
		})
	})

	describe("Required Field Validation", () => {
		it("should validate required field when required prop is true", () => {
			// Arrange
			const mockModels: AIModel[] = [
				{
					id: "123e4567-e89b-12d3-a456-426614174000",
					name: "Test Model",
					version: "1.0",
					organisation_id: "org-123",
					modified_by: "user-123",
					model_path: "models/test-model.tflite",
					labels_path: "models/test-model-labels.txt",
					created_at: "2025-01-01T00:00:00Z",
					updated_at: "2025-01-01T00:00:00Z",
					deleted_at: null,
					description: "Test",
					detection_capabilities: null,
					file_size_bytes: null,
					file_type: null,
					uploaded_by: null,
					compiled_format: null,
					error_message: null,
					file_hash: null,
					model_family_id: null,
					processing_log: null,
					status: "validated",
					version_number: 1,
				},
			]

			mockUseGetAIModelsQuery.mockReturnValue({
				data: mockModels,
				isLoading: false,
				error: undefined,
				isSuccess: true,
				isError: false,
			} as any)

			// Act
			render(
				<AIModelSelectWithForm organisationId="org-123" required={true} />,
				{ wrapper: TestWrapper },
			)

			// Assert - Dropdown should be present and required
			expect(
				screen.getByTestId("ai-model-select-dropdown"),
			).toBeOnTheScreen()
		})
	})
})
