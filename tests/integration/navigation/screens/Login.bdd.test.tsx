/**
 * BDD-style tests for Login screen
 * These tests are written in Given-When-Then format for better readability
 * and alignment with user stories
 */


import { Login } from "../../../../src/navigation/screens/auth/LoginScreen"
import {
	renderWithProviders,
	createTestStore,
} from "../../../setup/utils/testUtils"
import {
	mockAuthSuccess,
	resetSupabaseMocks,
} from "../../../__mocks__/supabase"
import {
	createUserStory,
	AuthActions,
	TestData,
	ValidationMessages,
} from "../../../setup/helpers/bdd"
import { screen, waitFor } from "@testing-library/react-native"
import * as SecureStore from 'expo-secure-store'

// Mock SecureStore locally to ensure identity consistency
// Note: We use the manual mock defined in tests/__mocks__/expo-secure-store.ts
// mapped in jest.config.js
jest.mock("expo-secure-store")

// Mock Supabase Service to use our mock client
jest.mock("../../../../src/services/supabase", () => {
	const { mockSupabaseClient } = require("../../../__mocks__/supabase")
	return {
		getSupabaseClient: jest.fn(() => mockSupabaseClient),
		initializeSupabaseClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
		reconnectSupabase: jest.fn(() => Promise.resolve(mockSupabaseClient)),
		getCurrentEnvironment: jest.fn(() => ({ supabaseUrl: "mock", supabaseAnonKey: "mock" })),
		resetSupabaseClient: jest.fn(),
		supabase: mockSupabaseClient,
	}
})

// Mock useLoginMutation to control loading state and response
jest.mock("../../../../src/redux/api/auth", () => ({
	useLoginMutation: jest.fn(),
}))

// Mock the logo image
// Logo image is automatically mocked by Jest moduleNameMapper

describe("Login Screen - User Stories", () => {
	beforeEach(() => {
		resetSupabaseMocks()
		jest.clearAllMocks()
		
		// Setup default useLoginMutation behavior (Success)
		const { useLoginMutation } = require("../../../../src/redux/api/auth")
		useLoginMutation.mockReturnValue([
			jest.fn().mockReturnValue({
				unwrap: jest.fn().mockResolvedValue({
					user: TestData.validUser,
					jwt: "mock-token",
				}),
			}),
			{ isLoading: false, error: null },
		])
	})

	test("User Story: Login Validation", async () => {
		const store = createTestStore()
		renderWithProviders(<Login />, { store })

		await createUserStory("Login Form Validation")
			.as("a user")
			.iWant("to see helpful validation messages")
			.soThat("I can correct my input and successfully log in")
			.scenario("Empty form submission")
			.given("I am on the login screen", AuthActions.userIsOnLoginScreen)
			.when(
				"I submit the form without entering any information",
				AuthActions.userSubmitsLoginForm,
			)
			.then(
				"I should see an email required error",
				AuthActions.systemShowsValidationError(
					ValidationMessages.EMAIL_REQUIRED,
				),
			)
			.and(
				"I should see a password required error",
				AuthActions.systemShowsValidationError(
					ValidationMessages.PASSWORD_REQUIRED,
				),
			)
			.executeAll()
	})

	test("User Story: Email Format Validation", async () => {
		const store = createTestStore()
		renderWithProviders(<Login />, { store })

		await createUserStory("Email Format Validation")
			.as("a user")
			.iWant("to be notified when my email format is invalid")
			.soThat("I can enter a correctly formatted email address")
			.scenario("Invalid email format")
			.given("I am on the login screen", AuthActions.userIsOnLoginScreen)
			.when("I enter an invalid email format", AuthActions.userEntersEmail(TestData.invalidUser.email))
			.and("I enter a valid password", AuthActions.userEntersPassword(TestData.validUser.password))
			.and("I submit the form", AuthActions.userSubmitsLoginForm)
			.then(
				"I should see an invalid email error",
				AuthActions.systemShowsValidationError(ValidationMessages.INVALID_EMAIL),
			)
			.executeAll()
	})

	test("User Story: Password Length Validation", async () => {
		const store = createTestStore()
		renderWithProviders(<Login />, { store })

		await createUserStory("Password Length Validation")
			.as("a user")
			.iWant("to be notified when my password is too short")
			.soThat("I can enter a password that meets the security requirements")
			.scenario("Password too short")
			.given("I am on the login screen", AuthActions.userIsOnLoginScreen)
			.when("I enter a valid email", AuthActions.userEntersEmail(TestData.validUser.email))
			.and("I enter a password that is too short", AuthActions.userEntersPassword(TestData.invalidUser.password))
			.and("I submit the form", AuthActions.userSubmitsLoginForm)
			.then(
				"I should see a password too short error",
				AuthActions.systemShowsValidationError(
					ValidationMessages.PASSWORD_TOO_SHORT,
				),
			)
			.executeAll()
	})

	test("User Story: Navigation to Registration", async () => {
		const store = createTestStore()
		renderWithProviders(<Login />, { store })

		await createUserStory("Navigate to Registration")
			.as("a new user")
			.iWant("to navigate to the registration screen from the login screen")
			.soThat("I can create a new account")
			.scenario("Click registration link")
			.given("I am on the login screen", AuthActions.userIsOnLoginScreen)
			.when(
				"I click on the registration link",
				AuthActions.userTapsGoToRegisterLink,
			)
			.then(
				"I should be navigated to the registration screen",
				AuthActions.systemNavigatesToScreen("Register"),
			)
			.executeAll()
	})

	test("User Story: Navigation to Forgot Password", async () => {
		const store = createTestStore()
		renderWithProviders(<Login />, { store })

		await createUserStory("Navigate to Forgot Password")
			.as("a user who has forgotten their password")
			.iWant("to navigate to the forgot password screen")
			.soThat("I can reset my password")
			.scenario("Click forgot password link")
			.given("I am on the login screen", AuthActions.userIsOnLoginScreen)
			.when(
				"I click on the forgot password link",
				AuthActions.userTapsForgotPasswordLink,
			)
			.then(
				"I should be navigated to the forgot password screen",
				AuthActions.systemNavigatesToScreen("ForgotPassword"),
			)
			.executeAll()
	})


	test("User Story: Remember Me Functionality", async () => {
		const store = createTestStore()
		mockAuthSuccess()
		renderWithProviders(<Login />, { store })

		await createUserStory("Remember Me Feature")
			.as("a frequent user")
			.iWant("to have my email remembered for future logins")
			.soThat("I can log in more quickly")
			.scenario("Login with remember me checked")
			.given("I am on the login screen", AuthActions.userIsOnLoginScreen)
			.when("I enter valid credentials", () => {
				AuthActions.userEntersEmail(TestData.validUser.email)()
				AuthActions.userEntersPassword(TestData.validUser.password)()
			})
			.and("I check the remember me option", AuthActions.userChecksRememberMe)
			.and("I submit the form", AuthActions.userSubmitsLoginForm)
			.then("My credentials should be saved for next time", async () => {
				await waitFor(() => {
					expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
						"rememberedEmail",
						TestData.validUser.email,
					)
					expect(SecureStore.setItemAsync).toHaveBeenCalledWith("rememberMe", "true")
				})
			})
			.executeAll()
	})

	test("User Story: Form Field Focus and Keyboard Behavior", async () => {
		const store = createTestStore()
		renderWithProviders(<Login />, { store })

		await createUserStory("Form Interaction")
			.as("a mobile user")
			.iWant("the form fields to have proper keyboard types and behavior")
			.soThat("I can efficiently enter my login information")
			.scenario("Field properties and behavior")
			.given("I am on the login screen", AuthActions.userIsOnLoginScreen)
			.when("I look at the email field", () => {
				const emailInput =
					require("@testing-library/react-native").screen.getByTestId(
						"email-input",
					)
				expect(emailInput.props.keyboardType).toBe("email-address")
				expect(emailInput.props.autoCapitalize).toBe("none")
				expect(emailInput.props.textContentType).toBe("emailAddress")
			})
			.and("I look at the password field", () => {
				const passwordInput =
					require("@testing-library/react-native").screen.getByTestId(
						"password-input",
					)
				expect(passwordInput.props.secureTextEntry).toBe(true)
			})
			.then(
				"the fields should have appropriate keyboard and input settings",
				() => {
					expect(true).toBe(true) // Already tested in when/and clauses
				},
			)
			.executeAll()
	})

	test("User Story: Loading State During Login", async () => {
		// Override mock to return loading state
		const { useLoginMutation } = require("../../../../src/redux/api/auth")
		// The hook must return isLoading: true INITIALY if we want to test "during login"?
		// Wait, useLoginMutation returns [login, result].
		// The component re-renders with result.isLoading.
		// If we set isLoading: true, the component will render loading state immediately.
		// This simulates the state "during" the request.
		
		useLoginMutation.mockReturnValue([
			jest.fn().mockReturnValue({ unwrap: jest.fn().mockReturnValue(new Promise(() => {})) }),
			{ isLoading: true, error: null },
		])

		const store = createTestStore()
		renderWithProviders(<Login />, { store })

		await createUserStory("Login Loading State")
			.as("a user")
			.iWant("to see visual feedback while my login is being processed")
			.soThat("I know the app is working and I should wait")
			.scenario("Form submission with loading state")
			.given("I am on the login screen", async () => {
				// Since we mocked isLoading=true globally for this test, it starts loading.
				// But strict BDD says "When I submit".
				// To simulate transition, we might need a mock implementation that changes state?
				// But straightforward UI test: Just render with loading=true works to verify UI.
			})
			.when("I enter valid credentials and submit", async () => {
				// No need to press, just checking render state
			})
			.then("the login button should show loading state", async () => {
				const loginButton = screen.getByTestId("login-button")
				expect(loginButton.props.loading).toBe(true)
				expect(loginButton.props.disabled).toBe(true)
			})
			.and("other interactive elements should be disabled", async () => {
				const forgotButton = screen.getByTestId("forgot-password-button")
				const registerButton = screen.getByTestId("register-button")
				
				expect(forgotButton.props.disabled).toBe(true)
				expect(registerButton.props.disabled).toBe(true)
			})
			.executeAll()
	})
})
