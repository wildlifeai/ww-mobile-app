/**
 * Integration tests for Register screen
 * These tests verify the complete registration flow including form validation,
 * API integration, navigation, and state management
 */

import React from "react"
import { Alert } from "react-native"
import { fireEvent, waitFor, screen } from "@testing-library/react-native"
import { Register } from "../../../../src/navigation/screens/Register"
import {
	renderWithProviders,
	createTestStore,
	waitForAsync,
} from "../../../setup/utils/testUtils"
import {
	mockAuthSuccess,
	mockAuthError,
	mockUser,
	resetSupabaseMocks,
} from "../../../__mocks__/supabase"
import {
	validRegisterCredentials,
	invalidRegisterCredentials,
	existingUserRegisterCredentials,
	formValidationCases,
	authErrorMessages,
	pendingConfirmationAuthResponse,
} from "../../../setup/fixtures/auth"

// Mock Alert
jest.mock("react-native/Libraries/Alert/Alert", () => ({
	alert: jest.fn(),
}))
const mockAlert = Alert.alert as jest.Mock

// Mock the logo image
// Logo image is automatically mocked by Jest moduleNameMapper

describe("Register Screen Integration Tests", () => {
	let store: ReturnType<typeof createTestStore>

	beforeEach(() => {
		store = createTestStore()
		resetSupabaseMocks()
		jest.clearAllMocks()
	})

	test("should render registration form correctly", () => {
		renderWithProviders(<Register />, { store })

		expect(screen.getByText("Full Name", { exact: false })).toBeTruthy()
		expect(screen.getByText("Email", { exact: false })).toBeTruthy()
		expect(screen.getByText("Organization (Optional)")).toBeTruthy()
		// Multiple Password labels exist (Password and Confirm Password)
		const passwordLabels = screen.getAllByText("Password", { exact: false })
		expect(passwordLabels.length).toBeGreaterThanOrEqual(2)
		expect(screen.getByTestId("register-button")).toBeTruthy()
		expect(screen.getByTestId("login-navigation-button")).toBeTruthy()
	})

	test("should validate all required fields", async () => {
		renderWithProviders(<Register />, { store })

		const registerButton = screen.getByTestId("register-button")

		// Submit empty form
		fireEvent.press(registerButton)

		await waitFor(() => {
			expect(screen.getByText("Name is required")).toBeTruthy()
			expect(screen.getByText("Email is required")).toBeTruthy()
			expect(screen.getByText("Password is required")).toBeTruthy()
			expect(screen.getByText("Please confirm your password")).toBeTruthy()
		})
	})

	test("should validate name field correctly", async () => {
		renderWithProviders(<Register />, { store })

		const nameInput = screen.getByTestId("name-input")
		const registerButton = screen.getByTestId("register-button")

		// Test too short name
		fireEvent.changeText(nameInput, "ab")
		fireEvent.press(registerButton)

		await waitFor(() => {
			expect(
				screen.getByText("Name must be at least 3 characters"),
			).toBeTruthy()
		})

		// Test valid name
		fireEvent.changeText(nameInput, formValidationCases.name.valid[0])

		// Clear the error by submitting again with valid input
		fireEvent.press(registerButton)

		await waitFor(() => {
			// Name validation error should be gone
			expect(
				screen.queryByText("Name must be at least 3 characters"),
			).toBeFalsy()
		})
	})

	test("should validate email field correctly", async () => {
		renderWithProviders(<Register />, { store })

		const emailInput = screen.getByTestId("email-input")
		const registerButton = screen.getByTestId("register-button")

		// Test invalid email formats
		for (const invalidEmail of formValidationCases.email.invalid.slice(1)) {
			// Skip empty string
			fireEvent.changeText(emailInput, invalidEmail)
			fireEvent.press(registerButton)

			await waitFor(() => {
				expect(screen.getByText("Invalid email address")).toBeTruthy()
			})
		}

		// Test valid email
		fireEvent.changeText(emailInput, formValidationCases.email.valid[0])

		// Clear the error by submitting again with valid input
		fireEvent.press(registerButton)

		await waitFor(() => {
			// Email validation error should be gone
			expect(screen.queryByText("Invalid email address")).toBeFalsy()
		})
	})

	test("should validate organization field length", async () => {
		renderWithProviders(<Register />, { store })

		const organizationInput = screen.getByTestId("organization-input")
		const registerButton = screen.getByTestId("register-button")

		// Test too long organization name
		const longOrganization = "A".repeat(101)
		fireEvent.changeText(organizationInput, longOrganization)
		fireEvent.press(registerButton)

		await waitFor(() => {
			expect(
				screen.getByText("Organization name must be less than 100 characters"),
			).toBeTruthy()
		})

		// Test valid organization
		fireEvent.changeText(
			organizationInput,
			formValidationCases.organization.valid[0],
		)

		// Clear the error by submitting again with valid input
		fireEvent.press(registerButton)

		await waitFor(() => {
			// Organization validation error should be gone
			expect(
				screen.queryByText(
					"Organization name must be less than 100 characters",
				),
			).toBeFalsy()
		})
	})

	test("should validate password field correctly", async () => {
		renderWithProviders(<Register />, { store })

		const passwordInput = screen.getByTestId("password-input")
		const registerButton = screen.getByTestId("register-button")

		// Fill other required fields to focus on password validation
		fireEvent.changeText(
			screen.getByTestId("username-input"),
			validRegisterCredentials.username,
		)
		fireEvent.changeText(
			screen.getByTestId("email-input"),
			validRegisterCredentials.email,
		)

		// Test password too short
		fireEvent.changeText(passwordInput, "123")
		fireEvent.press(registerButton)

		await waitFor(() => {
			expect(
				screen.getByText("Password must be at least 6 characters"),
			).toBeTruthy()
		})

		// Test valid password
		fireEvent.changeText(passwordInput, formValidationCases.password.valid[0])

		// Clear the error by submitting again with valid input
		fireEvent.press(registerButton)

		await waitFor(() => {
			// Password validation error should be gone
			expect(
				screen.queryByText("Password must be at least 6 characters"),
			).toBeFalsy()
		})
	})

	test("should validate password confirmation matching", async () => {
		renderWithProviders(<Register />, { store })

		const passwordInput = screen.getByTestId("password-input")
		const confirmPasswordInput = screen.getByTestId("confirm-password-input")
		const registerButton = screen.getByTestId("register-button")

		// Fill valid form data except password confirmation
		fireEvent.changeText(
			screen.getByTestId("username-input"),
			validRegisterCredentials.username,
		)
		fireEvent.changeText(
			screen.getByTestId("email-input"),
			validRegisterCredentials.email,
		)
		fireEvent.changeText(passwordInput, validRegisterCredentials.password)
		fireEvent.changeText(confirmPasswordInput, "differentpassword")

		// Submit form
		fireEvent.press(registerButton)

		await waitFor(() => {
			expect(screen.getByText("Passwords do not match")).toBeTruthy()
		})

		// Fix password confirmation
		fireEvent.changeText(
			confirmPasswordInput,
			validRegisterCredentials.password,
		)

		// Clear the error by submitting again with matching passwords
		fireEvent.press(registerButton)

		await waitFor(() => {
			// Password match error should be gone
			expect(screen.queryByText("Passwords do not match")).toBeFalsy()
		})
	})

	test("should handle successful registration with immediate login", async () => {
		mockAuthSuccess()

		renderWithProviders(<Register />, { store })

		// Fill form
		fireEvent.changeText(
			screen.getByTestId("name-input"),
			validRegisterCredentials.name,
		)
		fireEvent.changeText(
			screen.getByTestId("email-input"),
			validRegisterCredentials.email,
		)
		fireEvent.changeText(
			screen.getByTestId("organization-input"),
			validRegisterCredentials.organization,
		)
		fireEvent.changeText(
			screen.getByTestId("password-input"),
			validRegisterCredentials.password,
		)
		fireEvent.changeText(
			screen.getByTestId("confirm-password-input"),
			validRegisterCredentials.password,
		)

		// Submit form
		const registerButton = screen.getByTestId("register-button")
		fireEvent.press(registerButton)

		await waitFor(() => {
			// Check that user was registered and logged in
			const user = store.getState().authentication.user
			expect(user).toBeTruthy()
			expect(user?.email).toBeTruthy() // User should be logged in after registration
		})
	})

	test("should handle registration with email confirmation required", async () => {
		const { mockSupabaseClient } = require("../../../__mocks__/supabase")

		renderWithProviders(<Register />, { store })

		// Clear the default mock and set up specific email confirmation response
		mockSupabaseClient.auth.signUp.mockClear()
		mockSupabaseClient.auth.signUp.mockResolvedValue({
			data: {
				user: mockUser,
				session: null, // No session means email confirmation required
			},
			error: null,
		})

		// Fill form
		fireEvent.changeText(
			screen.getByTestId("name-input"),
			validRegisterCredentials.name,
		)
		fireEvent.changeText(
			screen.getByTestId("email-input"),
			validRegisterCredentials.email,
		)
		fireEvent.changeText(
			screen.getByTestId("password-input"),
			validRegisterCredentials.password,
		)
		fireEvent.changeText(
			screen.getByTestId("confirm-password-input"),
			validRegisterCredentials.password,
		)

		// Submit form
		fireEvent.press(screen.getByTestId("register-button"))

		await waitFor(
			() => {
				expect(mockAlert).toHaveBeenCalledWith(
					"Registration Successful",
					"Please check your email and click the confirmation link to activate your account.",
					[{ text: "OK", onPress: expect.any(Function) }],
				)
			},
			{ timeout: 5000 },
		)

		// Should not log user in automatically
		expect(store.getState().authentication.user).toBeUndefined()
	}, 10000)

	test("should handle registration failure with existing email", async () => {
		const { mockSupabaseClient } = require("../../../__mocks__/supabase")

		renderWithProviders(<Register />, { store })

		// Clear the default mock and set up error response
		mockSupabaseClient.auth.signUp.mockClear()
		const errorMessage = authErrorMessages.emailAlreadyExists
		mockAuthError(errorMessage)

		// Fill form with existing user data
		fireEvent.changeText(
			screen.getByTestId("name-input"),
			existingUserRegisterCredentials.name,
		)
		fireEvent.changeText(
			screen.getByTestId("email-input"),
			existingUserRegisterCredentials.email,
		)
		fireEvent.changeText(
			screen.getByTestId("password-input"),
			existingUserRegisterCredentials.password,
		)
		fireEvent.changeText(
			screen.getByTestId("confirm-password-input"),
			existingUserRegisterCredentials.password,
		)

		// Submit form
		fireEvent.press(screen.getByTestId("register-button"))

		await waitFor(
			() => {
				expect(mockAlert).toHaveBeenCalledWith(
					"Registration Failed",
					"Please check your information and try again.",
					[{ text: "OK" }],
				)
			},
			{ timeout: 3000 },
		)
	})

	test("should navigate to login screen", () => {
		renderWithProviders(<Register />, { store })

		const loginButton = screen.getByTestId("login-navigation-button")
		fireEvent.press(loginButton)

		// Check navigation was called
		expect(
			require("../../../setup/utils/testUtils").mockNavigate,
		).toHaveBeenCalledWith("Login")
	})

	test("should disable form elements during loading", async () => {
		// Mock a delayed auth response
		const { mockSupabaseClient } = require("../../../__mocks__/supabase")
		mockSupabaseClient.auth.signUp.mockImplementation(
			() =>
				new Promise((resolve) =>
					setTimeout(() => resolve(mockAuthSuccess()), 1000),
				),
		)

		renderWithProviders(<Register />, { store })

		// Fill form
		fireEvent.changeText(
			screen.getByTestId("name-input"),
			validRegisterCredentials.name,
		)
		fireEvent.changeText(
			screen.getByTestId("email-input"),
			validRegisterCredentials.email,
		)
		fireEvent.changeText(
			screen.getByTestId("password-input"),
			validRegisterCredentials.password,
		)
		fireEvent.changeText(
			screen.getByTestId("confirm-password-input"),
			validRegisterCredentials.password,
		)

		// Submit form
		const registerButton = screen.getByTestId("register-button")
		const loginButton = screen.getByTestId("login-navigation-button")

		fireEvent.press(registerButton)

		// All buttons should be disabled during loading
		await waitFor(() => {
			expect(registerButton).toBeDisabled()
			expect(loginButton).toBeDisabled()
		})
	})

	test("should handle optional organization field correctly", async () => {
		mockAuthSuccess()

		renderWithProviders(<Register />, { store })

		// Fill form without organization
		fireEvent.changeText(
			screen.getByTestId("name-input"),
			validRegisterCredentials.name,
		)
		fireEvent.changeText(
			screen.getByTestId("email-input"),
			validRegisterCredentials.email,
		)
		fireEvent.changeText(
			screen.getByTestId("password-input"),
			validRegisterCredentials.password,
		)
		fireEvent.changeText(
			screen.getByTestId("confirm-password-input"),
			validRegisterCredentials.password,
		)

		// Submit form
		fireEvent.press(screen.getByTestId("register-button"))

		await waitFor(() => {
			// Should succeed without organization
			expect(store.getState().authentication.user).not.toBeNull()
		})
	})

	test("should trim empty organization field before submission", async () => {
		const { mockSupabaseClient } = require("../../../__mocks__/supabase")
		mockAuthSuccess()

		renderWithProviders(<Register />, { store })

		// Fill form with empty organization
		fireEvent.changeText(
			screen.getByTestId("name-input"),
			validRegisterCredentials.name,
		)
		fireEvent.changeText(
			screen.getByTestId("email-input"),
			validRegisterCredentials.email,
		)
		fireEvent.changeText(screen.getByTestId("organization-input"), "   ") // Only spaces
		fireEvent.changeText(
			screen.getByTestId("password-input"),
			validRegisterCredentials.password,
		)
		fireEvent.changeText(
			screen.getByTestId("confirm-password-input"),
			validRegisterCredentials.password,
		)

		// Submit form
		fireEvent.press(screen.getByTestId("register-button"))

		await waitFor(() => {
			// Check that organization was sent as undefined, not empty string
			expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
				email: validRegisterCredentials.email,
				password: validRegisterCredentials.password,
				options: {
					data: {
						name: validRegisterCredentials.name,
						organization: undefined, // Should be undefined, not empty string
					},
					emailRedirectTo: "wildlifewatcher://auth/callback",
				},
			})
		})
	})

	test("should handle form input properties correctly", () => {
		renderWithProviders(<Register />, { store })

		const emailInput = screen.getByTestId("email-input")
		const organizationInput = screen.getByTestId("organization-input")
		const passwordInput = screen.getByTestId("password-input")
		const confirmPasswordInput = screen.getByTestId("confirm-password-input")

		// Test email input properties
		expect(emailInput.props.textContentType).toBe("emailAddress")
		expect(emailInput.props.keyboardType).toBe("email-address")
		expect(emailInput.props.autoCapitalize).toBe("none")

		// Test organization input properties
		expect(organizationInput.props.textContentType).toBe("organizationName")

		// Test password input properties
		expect(passwordInput.props.secureTextEntry).toBe(true)
		expect(confirmPasswordInput.props.secureTextEntry).toBe(true)
	})

	test("should handle API error messages in UI", async () => {
		const { mockSupabaseClient } = require("../../../__mocks__/supabase")

		renderWithProviders(<Register />, { store })

		// Clear the default mock and set up rejected promise
		mockSupabaseClient.auth.signUp.mockClear()
		mockSupabaseClient.auth.signUp.mockRejectedValue(
			new Error("Custom API error message"),
		)

		// Fill valid form
		fireEvent.changeText(
			screen.getByTestId("name-input"),
			validRegisterCredentials.name,
		)
		fireEvent.changeText(
			screen.getByTestId("email-input"),
			validRegisterCredentials.email,
		)
		fireEvent.changeText(
			screen.getByTestId("password-input"),
			validRegisterCredentials.password,
		)
		fireEvent.changeText(
			screen.getByTestId("confirm-password-input"),
			validRegisterCredentials.password,
		)

		// Submit form
		fireEvent.press(screen.getByTestId("register-button"))

		await waitFor(
			() => {
				expect(mockAlert).toHaveBeenCalledWith(
					"Registration Failed",
					"Please check your information and try again.",
					[{ text: "OK" }],
				)
			},
			{ timeout: 3000 },
		)
	})

	test("should clear form validation errors when input is corrected", async () => {
		renderWithProviders(<Register />, { store })

		const nameInput = screen.getByTestId("name-input")
		const registerButton = screen.getByTestId("register-button")

		// Trigger validation error
		fireEvent.changeText(nameInput, "a")
		fireEvent.press(registerButton)

		await waitFor(() => {
			expect(
				screen.getByText("Name must be at least 3 characters"),
			).toBeTruthy()
		})

		// Fix the input
		fireEvent.changeText(nameInput, "validname")

		await waitFor(() => {
			expect(
				screen.queryByText("Name must be at least 3 characters"),
			).toBeFalsy()
		})
	})
})
