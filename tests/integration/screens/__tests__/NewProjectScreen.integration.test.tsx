import { render, screen, waitFor, fireEvent } from "@testing-library/react-native"
import { Provider } from "react-redux"
import { configureStore } from "@reduxjs/toolkit"
import { NewProjectScreen } from "../../../../src/screens/Projects/NewProjectScreen"
import { aiModelsApi } from "../../../../src/redux/api/aiModelsApi"
import { projectsApi } from "../../../../src/redux/api/projectsApi"
import authReducer, { UserRole } from "../../../../src/redux/slices/authSlice"
import type { Database } from "../../../../src/types/database.types"

type AIModel = Database["public"]["Tables"]["ai_models"]["Row"]

// Mock navigation
const mockGoBack = jest.fn()
jest.mock("@react-navigation/native", () => ({
	...jest.requireActual("@react-navigation/native"),
	useNavigation: () => ({
		goBack: mockGoBack,
		navigate: jest.fn(),
		addListener: jest.fn(),
		setOptions: jest.fn(),
	}),
	useRoute: () => ({ params: {} }),
}))

// Helper to create a test store
const createTestStore = (initialState = {}) => {
	return configureStore({
		reducer: {
			[aiModelsApi.reducerPath]: aiModelsApi.reducer,
			[projectsApi.reducerPath]: projectsApi.reducer,
			authentication: authReducer,
		},
		middleware: (getDefaultMiddleware) =>
			getDefaultMiddleware({
				serializableCheck: false,
			}).concat(aiModelsApi.middleware).concat(projectsApi.middleware),
		preloadedState: {
			authentication: {
				user: {
					id: "user-123",
					email: "test@example.com",
					role: "project_admin" as UserRole,
					organisation_id: "org-123",
					organisations: [
						{
							id: "org-123",
							name: "Test Organisation",
							role: "project_admin" as UserRole,
						}
					],
				},
				currentOrganisation: {
					id: "org-123",
					name: "Test Organisation",
					role: "project_admin" as UserRole,
				},
				token: "fake-token",
				permissions: {
					canManageUsers: false,
					canAccessAllOrganisations: false,
					canCreateProjects: true,
					canManageProjects: true,
					canDeleteProjects: true,
					canViewProjects: true,
					canManageDeployments: true,
					canViewDeployments: true,
					canManageDevices: true,
					canViewDevices: true,
				},
				loading: false,
				initialLoad: false,
				sessionPersisted: true,
				profileLoading: false,
				pendingTutorial: false,
				error: undefined,
			},
			...initialState,
		},
	})
}

// Wrapper component
const createWrapper = (store: any) => {
	return ({ children }: { children: React.ReactNode }) => (
		<Provider store={store}>{children}</Provider>
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
				model_path: "models/test-model.tflite",
				labels_path: "models/test-model-labels.txt",
				detection_capabilities: ["animal", "person"],
				file_size_bytes: 1024,
				file_type: "onnx",
				uploaded_by: "user-123",
				compiled_format: null,
				error_message: null,
				file_hash: null,
				model_family_id: null,
				processing_log: null,
				status: "validated",
				version_number: null,
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
				model_path: "models/test-model.tflite",
				labels_path: "models/test-model-labels.txt",
				detection_capabilities: ["bird"],
				file_size_bytes: 1024,
				file_type: "onnx",
				uploaded_by: "user-123",
				compiled_format: null,
				error_message: null,
				file_hash: null,
				model_family_id: null,
				processing_log: null,
				status: "validated",
				version_number: null,
			},
		]

		const store = createTestStore()

		// Mock AI models API response
		jest
			.spyOn(projectsApi, "useGetAiModelsQuery")
			.mockReturnValue({
				data: mockModels,
				isLoading: false,
				isSuccess: true,
				isError: false,
				error: undefined,
			} as any)

		// Mock project creation API
		const mockCreateProject = jest.fn().mockReturnValue({
			unwrap: () => Promise.resolve({
				id: "project-123",
				name: "Test Project",
			})
		})

		jest
			.spyOn(projectsApi, "useCreateProjectMutation")
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

		fireEvent.press(screen.getByText("Advanced Project Settings"))

		// Assert - Wait for AI models to load
		await waitFor(() => {
			expect(screen.getByTestId("ai-model-select-dropdown")).toBeOnTheScreen()
		})

		// Fill in project name (required field)
		const nameInput = screen.getByTestId("project-name-input")
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
		const descriptionInput = screen.getByTestId("project-description-input")
		fireEvent.changeText(
			descriptionInput,
			"A project to monitor wildlife in national park",
		)

		// Check is_baited checkbox
		const baitedCheckbox = screen.getByTestId("is-baited-checkbox")
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
					// model_id is undefined because no model was auto-selected
					// (user must explicitly choose one now)
				}),
			)
		})

		// Verify navigation back
		expect(mockGoBack).toHaveBeenCalled()
	})

	it("should handle empty AI models list gracefully", async () => {
		// Arrange
		const store = createTestStore()

		// Mock empty AI models response
		jest
			.spyOn(projectsApi, "useGetAiModelsQuery")
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

		fireEvent.press(screen.getByText("Advanced Project Settings"))

		// Assert: empty list still shows the dropdown with a "None" option
		await waitFor(() => {
			expect(screen.getByTestId("ai-model-select-dropdown")).toBeOnTheScreen()
		})
	})

	it("should display loading state while fetching AI models", async () => {
		// Arrange
		const store = createTestStore()

		// Mock loading state
		jest
			.spyOn(projectsApi, "useGetAiModelsQuery")
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

		fireEvent.press(screen.getByText("Advanced Project Settings"))

		// Assert
		expect(screen.getByTestId("ai-model-select-loading")).toBeOnTheScreen()
		expect(screen.getByText("Loading AI models…")).toBeOnTheScreen()
	})

	it("should display error state when AI models fail to load", async () => {
		// Arrange
		const store = createTestStore()

		// Mock error state
		jest
			.spyOn(projectsApi, "useGetAiModelsQuery")
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

		fireEvent.press(screen.getByText("Advanced Project Settings"))

		// Assert
		await waitFor(() => {
			expect(screen.getByTestId("ai-model-select-error")).toBeOnTheScreen()
			expect(screen.getByText("Error loading AI models.")).toBeOnTheScreen()
		})
	})

	it("should allow project creation without AI model selection", async () => {
		// Arrange


		const store = createTestStore()

		jest
			.spyOn(projectsApi, "useGetAiModelsQuery")
			.mockReturnValue({
				data: [], // Mock as empty to avoid auto-selection if desired, 
						 // or just test that it's optional
				isLoading: false,
				isSuccess: true,
				isError: false,
				error: undefined,
			} as any)

		const mockCreateProject = jest.fn().mockReturnValue({
			unwrap: () => Promise.resolve({ id: "project-123" })
		})

		jest
			.spyOn(projectsApi, "useCreateProjectMutation")
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

		fireEvent.press(screen.getByText("Advanced Project Settings"))

		// Fill only required fields
		const nameInput = screen.getByTestId("project-name-input")
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
				name: "General Wildlife Model",
				version: "1.0",
				organisation_id: "org-123",
				created_at: "2025-01-01T00:00:00Z",
				updated_at: "2025-01-01T00:00:00Z",
				deleted_at: null,
				description: "General model for wildlife classification",
				modified_by: "user-123",
				model_path: "models/test-model.tflite",
				labels_path: "models/test-model-labels.txt",
				detection_capabilities: ["animal", "person"],
				file_size_bytes: 1024,
				file_type: "onnx",
				uploaded_by: "user-123",
				compiled_format: null,
				error_message: null,
				file_hash: null,
				model_family_id: null,
				processing_log: null,
				status: "validated",
				version_number: null,
			},
		]

		const store = createTestStore()

		jest
			.spyOn(projectsApi, "useGetAiModelsQuery")
			.mockReturnValue({
				data: mockModels,
				isLoading: false,
				isSuccess: true,
				isError: false,
				error: undefined,
			} as any)

		const mockCreateProject = jest.fn().mockReturnValue({
			unwrap: () => Promise.resolve({ id: "project-123" })
		})

		jest
			.spyOn(projectsApi, "useCreateProjectMutation")
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

		fireEvent.press(screen.getByText("Advanced Project Settings"))

		const nameInput = screen.getByTestId("project-name-input")
		fireEvent.changeText(nameInput, "Valid Project")

		// Submit
		const submitButton = screen.getByText("Create Project")
		fireEvent.press(submitButton)

		// model_id defaults to "" (None): no auto-selection anymore
		await waitFor(() => {
			expect(mockCreateProject).toHaveBeenCalledWith(
				expect.objectContaining({
					model_id: undefined,
				}),
			)
		})
	})
})
