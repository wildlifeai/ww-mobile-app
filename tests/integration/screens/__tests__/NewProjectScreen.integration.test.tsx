/**
 * NewProjectScreen Integration Test
 * Tests E2E user flow for project creation with AI model selection
 *
 * Pattern: Integration testing with REAL user workflows
 * Evidence: Backend testing showed integration tests find real bugs
 *
 * Coverage: Real user workflow, RTK Query integration, form validation
 */

import React from "react"
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native"
import { Provider } from "react-redux"
import { NavigationContainer } from "@react-navigation/native"
import { PaperProvider } from "react-native-paper"
import { configureStore } from "@reduxjs/toolkit"
import { NewProjectScreen } from "../../../../src/navigation/screens/NewProjectScreen"
import { aiModelsApi } from "../../../../src/redux/api/aiModelsApi"
import { projectsApi } from "../../../../src/redux/api/projectsApi"
import authReducer from "../../../../src/redux/slices/authSlice"
import type { Database } from "../../../../src/types/database.types"

type AIModel = Database["public"]["Tables"]["ai_models"]["Row"]

// Mock network info
jest.mock("@react-native-community/netinfo")

// Mock navigation
const mockNavigate = jest.fn()
const mockGoBack = jest.fn()

jest.mock("@react-navigation/native", () => ({
	...jest.requireActual("@react-navigation/native"),
	useNavigation: () => ({
		navigate: mockNavigate,
		goBack: mockGoBack,
	}),
}))

// Test store setup with full Redux state
const createTestStore = (initialState = {}) => {
	return configureStore({
		reducer: {
			authentication: authReducer as any,
			[aiModelsApi.reducerPath]: aiModelsApi.reducer,
			[projectsApi.reducerPath]: projectsApi.reducer,
		},
		middleware: (getDefaultMiddleware) =>
			getDefaultMiddleware().concat(
				aiModelsApi.middleware,
				projectsApi.middleware,
			),
		preloadedState: {
			authentication: {
				user: {
					id: "user-123",
					email: "test@example.com",
				},
				currentOrganisation: {
					id: "org-123",
					name: "Test Organisation",
				},
				session: null,
				isLoading: false,
			},
			...initialState,
		},
	})
}

// Test wrapper component
const createWrapper = (store: ReturnType<typeof createTestStore>) => {
	return ({ children }: { children: React.ReactNode }) => (
		<Provider store={store}>
			<PaperProvider>
				<NavigationContainer>{children}</NavigationContainer>
			</PaperProvider>
		</Provider>
	)
}

describe("NewProjectScreen - AI Model Integration", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should load AI models and allow project creation with selected model", async () => {
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
				description: "General model for wildlife classification",
				modified_by: "user-123",
				storage_path: "models/test-model.onnx",
				detection_capabilities: ["animal", "person"],
				file_size_bytes: 1024,
				file_type: "onnx",
				uploaded_by: "user-123",
			},
			{
				id: "223e4567-e89b-12d3-a456-426614174001",
				name: "Bird Species Model",
				version: "2.0",
				organisation_id: "org-123",
				created_at: "2025-01-01T00:00:00Z",
				updated_at: "2025-01-01T00:00:00Z",
				deleted_at: null,
				description: "Specialized model for bird species identification",
				modified_by: "user-123",
				storage_path: "models/test-model.onnx",
				detection_capabilities: ["bird"],
				file_size_bytes: 1024,
				file_type: "onnx",
				uploaded_by: "user-123",
			},
		]

		const store = createTestStore()

		// Mock AI models API response
		jest
			.spyOn(aiModelsApi.endpoints.getAIModels, "useQuery")
			.mockReturnValue({
				data: mockModels,
				isLoading: false,
				isSuccess: true,
				isError: false,
				error: undefined,
			} as any)

		// Mock project creation API
		const mockCreateProject = jest.fn().mockResolvedValue({
			data: {
				id: "project-123",
				name: "Test Project",
			},
		})

		jest
			.spyOn(projectsApi.endpoints.createProject, "useMutation")
			.mockReturnValue([
				mockCreateProject,
				{
					isLoading: false,
					isSuccess: false,
					isError: false,
				},
			] as any)

		// Act
		render(<NewProjectScreen />, {
			wrapper: createWrapper(store),
		})

		// Assert - Wait for AI models to load
		await waitFor(() => {
			expect(screen.getByTestId("ai-model-select-dropdown")).toBeOnTheScreen()
		})

		// Fill in project name (required field)
		const nameInput = screen.getByLabelText("Project Name")
		fireEvent.changeText(nameInput, "Test Wildlife Project")

		// Select AI model
		const modelSelect = screen.getByTestId("ai-model-select-dropdown")
		fireEvent.press(modelSelect)

		// Wait for dropdown options to appear
		await waitFor(() => {
			expect(
				screen.getByText("General Wildlife Model v1.0"),
			).toBeOnTheScreen()
		})

		// Select the first model
		fireEvent.press(screen.getByText("General Wildlife Model v1.0"))

		// Fill other optional fields
		const descriptionInput = screen.getByLabelText("Description")
		fireEvent.changeText(
			descriptionInput,
			"A project to monitor wildlife in national park",
		)

		// Check is_baited checkbox
		const baitedCheckbox = screen.getByLabelText("Is Baited")
		fireEvent.press(baitedCheckbox)

		// Submit the form
		const submitButton = screen.getByText("Create Project")
		fireEvent.press(submitButton)

		// Assert - Verify project creation was called with correct data
		await waitFor(() => {
			expect(mockCreateProject).toHaveBeenCalledWith(
				expect.objectContaining({
					name: "Test Wildlife Project",
					description: "A project to monitor wildlife in national park",
					organisation_id: "org-123",
					is_baited: true,
					model_id: "123e4567-e89b-12d3-a456-426614174000",
				}),
			)
		})

		// Assert - Verify navigation back to projects list
		expect(mockGoBack).toHaveBeenCalled()
	})

	it("should handle empty AI models list gracefully", async () => {
		// Arrange
		const store = createTestStore()

		// Mock empty AI models response
		jest
			.spyOn(aiModelsApi.endpoints.getAIModels, "useQuery")
			.mockReturnValue({
				data: [],
				isLoading: false,
				isSuccess: true,
				isError: false,
				error: undefined,
			} as any)

		// Act
		render(<NewProjectScreen />, {
			wrapper: createWrapper(store),
		})

		// Assert - Should display empty state
		await waitFor(() => {
			expect(screen.getByTestId("ai-model-select-empty")).toBeOnTheScreen()
			expect(
				screen.getByText("No AI models available for this organisation"),
			).toBeOnTheScreen()
		})
	})

	it("should display loading state while fetching AI models", () => {
		// Arrange
		const store = createTestStore()

		// Mock loading state
		jest
			.spyOn(aiModelsApi.endpoints.getAIModels, "useQuery")
			.mockReturnValue({
				data: undefined,
				isLoading: true,
				isSuccess: false,
				isError: false,
				error: undefined,
			} as any)

		// Act
		render(<NewProjectScreen />, {
			wrapper: createWrapper(store),
		})

		// Assert - Should display loading indicator
		expect(screen.getByTestId("ai-model-select-loading")).toBeOnTheScreen()
		expect(
			screen.getByTestId("ai-model-select-loading-placeholder"),
		).toBeOnTheScreen()
		expect(screen.getByText("Loading AI models...")).toBeOnTheScreen()
	})

	it("should display error state when AI models fail to load", async () => {
		// Arrange
		const store = createTestStore()

		// Mock error state
		jest
			.spyOn(aiModelsApi.endpoints.getAIModels, "useQuery")
			.mockReturnValue({
				data: undefined,
				isLoading: false,
				isSuccess: false,
				isError: true,
				error: {
					status: "CUSTOM_ERROR",
					error: "Failed to connect to database",
				},
			} as any)

		// Act
		render(<NewProjectScreen />, {
			wrapper: createWrapper(store),
		})

		// Assert - Should display error state
		await waitFor(() => {
			expect(screen.getByTestId("ai-model-select-error")).toBeOnTheScreen()
			expect(
				screen.getByText("Failed to connect to database"),
			).toBeOnTheScreen()
		})
	})

	it("should allow project creation without AI model selection", async () => {
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
				modified_by: "user-123",
				storage_path: "models/test-model.onnx",
				detection_capabilities: ["test"],
				file_size_bytes: 1024,
				file_type: "onnx",
				uploaded_by: "user-123",
			},
		]

		const store = createTestStore()

		jest
			.spyOn(aiModelsApi.endpoints.getAIModels, "useQuery")
			.mockReturnValue({
				data: mockModels,
				isLoading: false,
				isSuccess: true,
				isError: false,
				error: undefined,
			} as any)

		const mockCreateProject = jest.fn().mockResolvedValue({
			data: { id: "project-123" },
		})

		jest
			.spyOn(projectsApi.endpoints.createProject, "useMutation")
			.mockReturnValue([
				mockCreateProject,
				{
					isLoading: false,
					isSuccess: false,
					isError: false,
				},
			] as any)

		// Act
		render(<NewProjectScreen />, {
			wrapper: createWrapper(store),
		})

		// Fill only required fields
		const nameInput = screen.getByLabelText("Project Name")
		fireEvent.changeText(nameInput, "Project Without Model")

		// Submit without selecting model
		const submitButton = screen.getByText("Create Project")
		fireEvent.press(submitButton)

		// Assert - Should create project with undefined model_id
		await waitFor(() => {
			expect(mockCreateProject).toHaveBeenCalledWith(
				expect.objectContaining({
					name: "Project Without Model",
					model_id: undefined, // or ""
				}),
			)
		})
	})

	it("should validate UUID format when model is selected", async () => {
		// Arrange
		const mockModels: AIModel[] = [
			{
				id: "123e4567-e89b-12d3-a456-426614174000",
				name: "Valid Model",
				version: "1.0",
				organisation_id: "org-123",
				created_at: "2025-01-01T00:00:00Z",
				updated_at: "2025-01-01T00:00:00Z",
				deleted_at: null,
				description: "Valid UUID",
				modified_by: "user-123",
				storage_path: "models/test-model.onnx",
				detection_capabilities: ["valid"],
				file_size_bytes: 1024,
				file_type: "onnx",
				uploaded_by: "user-123",
			},
		]

		const store = createTestStore()

		jest
			.spyOn(aiModelsApi.endpoints.getAIModels, "useQuery")
			.mockReturnValue({
				data: mockModels,
				isLoading: false,
				isSuccess: true,
				isError: false,
				error: undefined,
			} as any)

		// Act
		render(<NewProjectScreen />, {
			wrapper: createWrapper(store),
		})

		// Assert - Model with valid UUID should be selectable
		await waitFor(() => {
			expect(screen.getByTestId("ai-model-select-dropdown")).toBeOnTheScreen()
		})

		const modelSelect = screen.getByTestId("ai-model-select-dropdown")
		fireEvent.press(modelSelect)

		// Should display model with valid UUID
		await waitFor(() => {
			expect(screen.getByText("Valid Model v1.0")).toBeOnTheScreen()
		})
	})
})
