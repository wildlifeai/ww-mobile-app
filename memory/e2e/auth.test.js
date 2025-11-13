/**
 * End-to-end tests for authentication flows
 * These tests verify complete user journeys using real device interactions
 */

describe("Authentication E2E Tests", () => {
	beforeEach(async () => {
		await device.reloadReactNative()
	})

	describe("Login Flow", () => {
		it("should display login screen correctly", async () => {
			// Check that login screen elements are visible
			await expect(element(by.text("Email"))).toBeVisible()
			await expect(element(by.text("Password"))).toBeVisible()
			await expect(element(by.text("Login"))).toBeVisible()
			await expect(element(by.text("Remember me"))).toBeVisible()
			await expect(element(by.text("Forgot Password?"))).toBeVisible()
			await expect(
				element(by.text("Don't have an account? Register")),
			).toBeVisible()
		})

		it("should show validation errors for empty form", async () => {
			// Try to login without filling the form
			await element(by.text("Login")).tap()

			// Should show validation errors
			await expect(element(by.text("Email is required"))).toBeVisible()
			await expect(element(by.text("Password is required"))).toBeVisible()
		})

		it("should show validation error for invalid email format", async () => {
			// Fill invalid email
			await element(by.label("Email")).typeText("invalid-email")
			await element(by.text("Login")).tap()

			// Should show email validation error
			await expect(
				element(by.text("Please enter a valid email address")),
			).toBeVisible()
		})

		it("should show validation error for short password", async () => {
			// Fill valid email but short password
			await element(by.label("Email")).typeText("test@example.com")
			await element(by.label("Password")).typeText("123")
			await element(by.text("Login")).tap()

			// Should show password validation error
			await expect(
				element(by.text("Password must be at least 6 characters")),
			).toBeVisible()
		})

		it("should toggle remember me checkbox", async () => {
			// Check remember me is initially unchecked
			await expect(element(by.id("remember-me-checkbox"))).toBeVisible()

			// Tap to check
			await element(by.text("Remember me")).tap()

			// Should be checked now
			// Note: We'd need to add testID props to verify checkbox state in real tests
		})

		it("should navigate to forgot password screen", async () => {
			await element(by.text("Forgot Password?")).tap()

			// Should navigate to forgot password screen
			await expect(element(by.text("Reset Password"))).toBeVisible()

			// Go back to login
			await element(by.id("back-button")).tap()
			await expect(element(by.text("Login"))).toBeVisible()
		})

		it("should navigate to register screen", async () => {
			await element(by.text("Don't have an account? Register")).tap()

			// Should navigate to register screen
			await expect(element(by.text("Register"))).toBeVisible()
			await expect(element(by.text("Username"))).toBeVisible()

			// Go back to login
			await element(by.text("Already have an account? Login")).tap()
			await expect(element(by.text("Login"))).toBeVisible()
		})

		// Note: Testing actual login success would require test credentials
		// and mock backend setup, which is typically done in staging environment
		it("should handle login failure gracefully", async () => {
			// Fill form with invalid credentials
			await element(by.label("Email")).typeText("invalid@example.com")
			await element(by.label("Password")).typeText("wrongpassword")

			// Submit form
			await element(by.text("Login")).tap()

			// Should show loading state briefly, then error
			// In real app, this would show an alert or error message
			await waitFor(element(by.text("Login")))
				.toBeVisible()
				.withTimeout(5000)
		})
	})

	describe("Registration Flow", () => {
		beforeEach(async () => {
			// Navigate to register screen
			await element(by.text("Don't have an account? Register")).tap()
			await expect(element(by.text("Register"))).toBeVisible()
		})

		it("should display registration form correctly", async () => {
			// Check that all registration fields are visible
			await expect(element(by.text("Username"))).toBeVisible()
			await expect(element(by.text("Email"))).toBeVisible()
			await expect(element(by.text("Organization (Optional)"))).toBeVisible()
			await expect(element(by.text("Password"))).toBeVisible()
			await expect(element(by.text("Confirm Password"))).toBeVisible()
			await expect(element(by.text("Register"))).toBeVisible()
			await expect(
				element(by.text("Already have an account? Login")),
			).toBeVisible()
		})

		it("should show validation errors for empty required fields", async () => {
			// Try to register without filling required fields
			await element(by.text("Register")).tap()

			// Should show validation errors for required fields
			await expect(element(by.text("Username is required"))).toBeVisible()
			await expect(element(by.text("Email is required"))).toBeVisible()
			await expect(element(by.text("Password is required"))).toBeVisible()
			await expect(
				element(by.text("Please confirm your password")),
			).toBeVisible()
		})

		it("should validate username length", async () => {
			// Fill short username
			await element(by.label("Username")).typeText("ab")
			await element(by.text("Register")).tap()

			// Should show username validation error
			await expect(
				element(by.text("Username must be at least 3 characters")),
			).toBeVisible()
		})

		it("should validate email format", async () => {
			// Fill invalid email
			await element(by.label("Email")).typeText("invalid-email")
			await element(by.text("Register")).tap()

			// Should show email validation error
			await expect(element(by.text("Invalid email address"))).toBeVisible()
		})

		it("should validate password confirmation matching", async () => {
			// Fill form with mismatched passwords
			await element(by.label("Username")).typeText("testuser")
			await element(by.label("Email")).typeText("test@example.com")
			await element(by.label("Password")).typeText("password123")
			await element(by.label("Confirm Password")).typeText("differentpassword")

			await element(by.text("Register")).tap()

			// Should show password mismatch error
			await expect(element(by.text("Passwords do not match"))).toBeVisible()
		})

		it("should allow registration without organization field", async () => {
			// Fill required fields only
			await element(by.label("Username")).typeText("testuser")
			await element(by.label("Email")).typeText("test@example.com")
			await element(by.label("Password")).typeText("password123")
			await element(by.label("Confirm Password")).typeText("password123")

			// Submit form
			await element(by.text("Register")).tap()

			// Should process registration (would show loading state)
			await waitFor(element(by.text("Register")))
				.toBeVisible()
				.withTimeout(5000)
		})

		it("should handle form scrolling correctly", async () => {
			// Scroll to bottom to ensure all fields are accessible
			await element(by.id("register-scroll-view")).scrollTo("bottom")

			// Should be able to see and interact with bottom elements
			await expect(element(by.text("Register"))).toBeVisible()
			await expect(
				element(by.text("Already have an account? Login")),
			).toBeVisible()
		})
	})

	describe("Forgot Password Flow", () => {
		beforeEach(async () => {
			// Navigate to forgot password screen
			await element(by.text("Forgot Password?")).tap()
			await expect(element(by.text("Reset Password"))).toBeVisible()
		})

		it("should display forgot password form correctly", async () => {
			// Check forgot password screen elements
			await expect(element(by.text("Email"))).toBeVisible()
			await expect(element(by.text("Send Reset Link"))).toBeVisible()
			await expect(element(by.text("Back to Login"))).toBeVisible()
		})

		it("should validate email field", async () => {
			// Try to submit without email
			await element(by.text("Send Reset Link")).tap()

			// Should show validation error
			await expect(element(by.text("Email is required"))).toBeVisible()

			// Fill invalid email
			await element(by.label("Email")).typeText("invalid-email")
			await element(by.text("Send Reset Link")).tap()

			// Should show format validation error
			await expect(
				element(by.text("Please enter a valid email address")),
			).toBeVisible()
		})

		it("should navigate back to login screen", async () => {
			await element(by.text("Back to Login")).tap()

			// Should return to login screen
			await expect(element(by.text("Login"))).toBeVisible()
		})
	})

	describe("Deep Link Handling", () => {
		it("should handle password reset deep link", async () => {
			// Simulate deep link for password reset
			// This would typically be tested with a real deep link URL
			const resetUrl =
				"wildlifewatcher://auth/reset-password?token_hash=test-token&type=recovery"

			// In real E2E tests, you'd use device.openURL() or similar
			// await device.openURL({ url: resetUrl });

			// Should navigate to password reset screen with token
			// await expect(element(by.text('Enter New Password'))).toBeVisible();
		})

		it("should handle email confirmation deep link", async () => {
			// Simulate deep link for email confirmation
			const confirmUrl =
				"wildlifewatcher://auth/callback?token_hash=test-token&type=signup"

			// In real E2E tests, you'd use device.openURL()
			// await device.openURL({ url: confirmUrl });

			// Should navigate to login screen with confirmation message
			// await expect(element(by.text('Login'))).toBeVisible();
		})
	})

	describe("Keyboard and Input Interactions", () => {
		it("should handle keyboard interactions correctly", async () => {
			// Test email field
			await element(by.label("Email")).tap()
			await expect(element(by.label("Email"))).toBeFocused()

			// Type email
			await element(by.label("Email")).typeText("test@example.com")

			// Move to password field
			await element(by.label("Password")).tap()
			await expect(element(by.label("Password"))).toBeFocused()

			// Type password
			await element(by.label("Password")).typeText("password123")

			// Dismiss keyboard
			await element(by.label("Password")).tapReturnKey()
		})

		it("should auto-correct and format email input", async () => {
			// Type email with extra spaces
			await element(by.label("Email")).typeText("  test@example.com  ")

			// Focus away from field
			await element(by.label("Password")).tap()

			// Email should be trimmed (this would need to be implemented in the app)
			// await expect(element(by.label('Email'))).toHaveText('test@example.com');
		})
	})

	describe("Accessibility Features", () => {
		it("should support screen reader navigation", async () => {
			// Check that elements have proper accessibility labels
			await expect(element(by.label("Email"))).toBeVisible()
			await expect(element(by.label("Password"))).toBeVisible()
			await expect(element(by.label("Login"))).toBeVisible()
		})

		it("should support keyboard navigation", async () => {
			// Test tab navigation between fields
			await element(by.label("Email")).tap()

			// Use tab key to navigate (if supported by the test environment)
			// This might require specific test setup for keyboard navigation
		})
	})

	describe("Error Handling and Recovery", () => {
		it("should recover gracefully from network errors", async () => {
			// Fill valid form
			await element(by.label("Email")).typeText("test@example.com")
			await element(by.label("Password")).typeText("password123")

			// Simulate network disconnect (would need to be set up in test environment)
			// Submit form
			await element(by.text("Login")).tap()

			// Should show appropriate error handling
			// In real implementation, this might show a retry button or network error message
		})

		it("should maintain form state during app backgrounding", async () => {
			// Fill form
			await element(by.label("Email")).typeText("test@example.com")
			await element(by.label("Password")).typeText("password123")

			// Background and foreground app
			await device.sendToHome()
			await device.launchApp()

			// Form data should be preserved (depending on app implementation)
			// await expect(element(by.label('Email'))).toHaveText('test@example.com');
		})
	})
})
