/**
 * BDD (Behavior Driven Development) test helpers
 * Provides Given-When-Then pattern helpers for more readable tests
 */

import { fireEvent, screen, waitFor } from "@testing-library/react-native"

// Test data for common scenarios
export const TestData = {
	validUser: {
		email: "test@wildlifeai.org",
		password: "password123",
		firstName: "Test",
		lastName: "User",
	},
	invalidUser: {
		email: "invalid@email.com",
		password: "wrongpassword",
	},
}

// Validation messages
export const ValidationMessages = {
	EMAIL_REQUIRED: "Email is required",
	INVALID_EMAIL: "Please enter a valid email address",
	PASSWORD_REQUIRED: "Password is required",
	PASSWORD_TOO_SHORT: "Password must be at least 6 characters",
	PASSWORDS_DONT_MATCH: "Passwords do not match",
}

// User story builder for BDD-style tests
export class UserStory {
	private _role = ""
	private _want = ""
	private _so = ""
	private _title = ""

	constructor(title: string) {
		this._title = title
	}

	as(role: string): UserStory {
		this._role = role
		return this
	}

	iWant(want: string): UserStory {
		this._want = want
		return this
	}

	soThat(so: string): UserStory {
		this._so = so
		return this
	}

	scenario(scenarioName: string): ScenarioBuilder {
		return new ScenarioBuilder(scenarioName, this)
	}

	toString(): string {
		return `User Story: ${this._title}
As ${this._role}
I want ${this._want}
So that ${this._so}`
	}
}

export class ScenarioBuilder {
	private _scenarioName: string
	private _userStory: UserStory
	private _steps: Array<{
		type: "given" | "when" | "then" | "and"
		description: string
		action: () => void | Promise<void>
	}> = []

	constructor(scenarioName: string, userStory: UserStory) {
		this._scenarioName = scenarioName
		this._userStory = userStory
	}

	given(
		description: string,
		action: () => void | Promise<void> = () => { },
	): ScenarioBuilder {
		this._steps.push({ type: "given", description, action })
		return this
	}

	when(
		description: string,
		action: () => void | Promise<void> = () => { },
	): ScenarioBuilder {
		this._steps.push({ type: "when", description, action })
		return this
	}

	then(
		description: string,
		action: () => void | Promise<void> = () => { },
	): ScenarioBuilder {
		this._steps.push({ type: "then", description, action })
		return this
	}

	and(
		description: string,
		action: () => void | Promise<void> = () => { },
	): ScenarioBuilder {
		this._steps.push({ type: "and", description, action })
		return this
	}

	async execute(): Promise<void> {
		console.log(`\n${this._userStory.toString()}\n`)
		console.log(`Scenario: ${this._scenarioName}`)

		for (const step of this._steps) {
			console.log(`  ${step.type.toUpperCase()}: ${step.description}`)
			await step.action()
		}
	}

	async executeAll(): Promise<void> {
		return this.execute()
	}
}

// Helper function to create user stories
export function createUserStory(title: string): UserStory {
	return new UserStory(title)
}

// Common authentication actions for BDD tests
export const AuthActions = {
	userIsOnLoginScreen: () => {
		expect(screen.getByText("Login")).toBeTruthy()
	},

	userIsOnRegisterScreen: () => {
		expect(screen.getByText("Create Account")).toBeTruthy()
	},

	userEntersEmail: (email: string) => () => {
		const emailInput = screen.getByTestId("email-input")
		fireEvent.changeText(emailInput, email)
	},

	userChecksRememberMe: () => {
		const checkbox = screen.getByText("Remember me")
		fireEvent.press(checkbox)
	},

	userEntersPassword: (password: string) => () => {
		const passwordInput = screen.getByTestId("password-input")
		fireEvent.changeText(passwordInput, password)
	},

	userEntersFirstName: (firstName: string) => () => {
		const firstNameInput = screen.getByPlaceholderText("First Name")
		fireEvent.changeText(firstNameInput, firstName)
	},

	userEntersLastName: (lastName: string) => () => {
		const lastNameInput = screen.getByPlaceholderText("Last Name")
		fireEvent.changeText(lastNameInput, lastName)
	},

	userEntersConfirmPassword: (confirmPassword: string) => () => {
		const confirmPasswordInput = screen.getByPlaceholderText("Confirm Password")
		fireEvent.changeText(confirmPasswordInput, confirmPassword)
	},

	userTapsSignInButton: () => {
		const signInButton = screen.getByText("Sign In")
		fireEvent.press(signInButton)
	},

	userTapsCreateAccountButton: () => {
		const createAccountButton = screen.getByText("Create Account")
		fireEvent.press(createAccountButton)
	},

	userSubmitsLoginForm: () => {
		const submitButton = screen.getByText("Login")
		fireEvent.press(submitButton)
	},

	systemAuthenticatesUser: () => async () => {
		await waitFor(() => {
			expect(screen.queryByText("Login")).toBeNull()
		})
	},

	userTapsGoToRegisterLink: () => {
		const registerLink = screen.getByText("Don't have an account? Register")
		fireEvent.press(registerLink)
	},

	userTapsGoToLoginLink: () => {
		const loginLink = screen.getByText("Already have an account? Login")
		fireEvent.press(loginLink)
	},

	systemNavigatesToHomeScreen: async () => {
		await waitFor(
			() => {
				expect(screen.queryByTestId("login-screen-title")).toBeNull()
			},
			{ timeout: 3000 },
		)
	},

	userNavigatesToForgotPassword: () => {
		const link = screen.getByTestId("forgot-password-link")
		fireEvent.press(link)
	},

	systemNavigatesToScreen: (screenName: string) => async () => {
		// Generic placeholder for screen navigation checks
		console.log(`Checking for navigation to ${screenName}`)
	},

	systemShowsValidationError: (message: string) => async () => {
		await waitFor(() => {
			expect(screen.getByText(message)).toBeTruthy()
		})
	},

	systemShowsSuccessMessage: (message: string) => async () => {
		await waitFor(() => {
			expect(screen.getByText(message)).toBeTruthy()
		})
	},

	systemShowsLoadingState: () => {
		expect(screen.getByTestId("loading-indicator")).toBeTruthy()
	},

	systemHidesLoadingState: async () => {
		await waitFor(() => {
			expect(screen.queryByTestId("loading-indicator")).toBeNull()
		})
	},
}
