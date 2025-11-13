/**
 * Test data fixtures for authentication flows
 */

// Valid login credentials (service layer expects identifier, not email)
export const validLoginCredentials = {
	identifier: "test@wildlifeai.org",
	password: "password123",
}

// Invalid login credentials
export const invalidLoginCredentials = {
	identifier: "invalid@email.com",
	password: "wrongpassword",
}

// Valid registration credentials (service layer expects username and organization)
export const validRegisterCredentials = {
	email: "newuser@wildlifeai.org",
	password: "password123",
	username: "testuser",
	organization: "Wildlife AI Org",
}

// Invalid registration credentials
export const invalidRegisterCredentials = {
	email: "invalid-email",
	password: "123",
	username: "",
	organization: "",
}

// Existing user registration credentials
export const existingUserRegisterCredentials = {
	email: "existing@wildlifeai.org",
	password: "password123",
	username: "existinguser",
	organization: "Wildlife AI Org",
}

// Form validation test cases - array format
export const formValidationTestCases = [
	{
		name: "empty email",
		input: { email: "", password: "password123" },
		expectedError: "Email is required",
	},
	{
		name: "invalid email format",
		input: { email: "invalid-email", password: "password123" },
		expectedError: "Please enter a valid email address",
	},
	{
		name: "empty password",
		input: { email: "test@example.com", password: "" },
		expectedError: "Password is required",
	},
	{
		name: "short password",
		input: { email: "test@example.com", password: "123" },
		expectedError: "Password must be at least 6 characters",
	},
]

// Form validation test cases
export const formValidationCases = {
	email: {
		valid: ["test@wildlifeai.org", "user@example.com", "valid@domain.co.uk"],
		invalid: ["", "invalid-email", "test@", "@domain.com", "test@domain"],
	},
	password: {
		valid: ["password123", "ValidPass1!", "secure-password"],
		invalid: ["", "123", "short"],
	},
	username: {
		valid: ["testuser", "validusername", "user123"],
		invalid: ["", "ab", "x"],
	},
	organization: {
		valid: ["WildlifeAI", "Test Organization", "Conservation Society"],
		invalid: ["A".repeat(101)], // Over 100 characters
	},
}

// Auth error messages
export const authErrorMessages = {
	invalidCredentials: "Invalid email or password",
	userAlreadyExists: "User already registered",
	networkError: "Network connection error",
	serverError: "Server error occurred",
	validationError: "Validation error occurred",
	emailAlreadyExists: "Email already exists",
	tokenExpired: "Token has expired",
	userNotFound: "User not found",
	passwordTooWeak: "Password is too weak",
	tokenInvalid: "Token is invalid",
}

// Pending confirmation auth response
export const pendingConfirmationAuthResponse = {
	data: { user: null, session: null },
	error: { message: "Signup requires email confirmation" },
}

// Mock deep link data
export const mockDeepLinks = {
	passwordReset:
		"wildlifewatcher://reset-password?token_hash=test-token&type=recovery",
	passwordResetInvalid:
		"wildlifewatcher://reset-password?token_hash=&type=recovery",
	emailConfirmation:
		"wildlifewatcher://auth/callback?token_hash=test-token&type=signup",
	emailConfirmationInvalid:
		"wildlifewatcher://auth/callback?token_hash=&type=signup",
	generalCallback:
		"wildlifewatcher://callback?token_hash=test-token&type=signup",
	invitation: "wildlifewatcher://invite?token=ghi789",
	magicLink: "wildlifewatcher://auth?token=jkl012",
	invalidUrl: "wildlifewatcher://unknown/path",
}
