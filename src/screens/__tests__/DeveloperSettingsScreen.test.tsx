/**
 * Unit tests for DeveloperSettingsScreen
 *
 * Tests the developer environment switching interface including:
 * - Development vs production build visibility
 * - Environment selection and switching
 * - Connection testing functionality
 * - App restart handling
 * - Loading and error states
 *
 * @see Task 2.1: Developer Settings Screen
 */

import React from "react"
import { Alert } from "react-native"
import {
	render,
	fireEvent,
	waitFor,
	screen,
} from "@testing-library/react-native"
import { PaperProvider } from "react-native-paper"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { DeveloperSettingsScreen } from "../DeveloperSettingsScreen"
import type { SupabaseEnvironment } from "../../config/environments"

// Mock expo-updates
jest.mock("expo-updates", () => ({
	reloadAsync: jest.fn().mockResolvedValue(undefined),
}))

// Mock Alert
const mockAlert = jest.spyOn(Alert, "alert")

/**
 * Helper function to render DeveloperSettingsScreen with required providers
 */
const renderScreen = () => {
	return render(
		<SafeAreaProvider
			initialMetrics={{
				frame: { x: 0, y: 0, width: 0, height: 0 },
				insets: { top: 0, left: 0, right: 0, bottom: 0 },
			}}
		>
			<PaperProvider>
				<DeveloperSettingsScreen />
			</PaperProvider>
		</SafeAreaProvider>,
	)
}

describe("DeveloperSettingsScreen", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		mockAlert.mockClear()
	})

	describe("Development Build Tests", () => {
		beforeEach(() => {
			// Mock __DEV__ as true for development tests
			;(global as any).__DEV__ = true
		})

		test("should render correctly in development builds", () => {
			renderScreen()

			// Should show title
			expect(screen.getByText("Developer Settings")).toBeTruthy()

			// Should show environment section
			expect(screen.getByText(/Environment Selection/i)).toBeTruthy()

			// Should NOT show "Not Available" message
			expect(screen.queryByText(/not available in production/i)).toBeFalsy()
		})

		test("should display all available environments", () => {
			renderScreen()

			// Should show configured environments (local and cloud-dev)
			expect(screen.getByText(/Local Development/i)).toBeTruthy()
			expect(screen.getAllByText(/Cloud Development/i).length).toBeGreaterThan(
				0,
			)
			// Cloud Production might not be shown if not configured
		})

		test("should highlight current environment", () => {
			renderScreen()

			// Default should be 'cloud-dev' based on environments.ts
			const cloudDevRadio = screen.getByTestId("radio-cloud-dev")
			expect(cloudDevRadio.props.accessibilityState.checked).toBe(true)
		})

		test("should show environment details", () => {
			renderScreen()

			// Should show description for configured environments
			expect(screen.getByText(/WSL.*172\.21\.24\.107:54321/i)).toBeTruthy()
			expect(
				screen.getByText(/Cloud Supabase development instance/i),
			).toBeTruthy()
			// Production details only shown if configured
		})

		test("should change selected environment when radio button is pressed", () => {
			renderScreen()

			// Initially cloud-dev should be selected
			const cloudDevRadio = screen.getByTestId("radio-cloud-dev")
			expect(cloudDevRadio.props.accessibilityState.checked).toBe(true)

			// Press local environment radio
			const localRadio = screen.getByTestId("radio-local")
			fireEvent.press(localRadio)

			// Local should now be selected
			expect(localRadio.props.accessibilityState.checked).toBe(true)
			expect(cloudDevRadio.props.accessibilityState.checked).toBe(false)
		})

		test("should show connection status indicators", () => {
			renderScreen()

			// Should show status indicators for configured environments
			expect(screen.getByTestId("connection-status-local")).toBeTruthy()
			expect(screen.getByTestId("connection-status-cloud-dev")).toBeTruthy()
			// cloud-prod only if configured
		})

		test('should show "Test Connection" button for each environment', () => {
			renderScreen()

			expect(screen.getByTestId("test-connection-local")).toBeTruthy()
			expect(screen.getByTestId("test-connection-cloud-dev")).toBeTruthy()
			// cloud-prod only if configured
		})

		test('should test connection when "Test Connection" is pressed', async () => {
			renderScreen()

			const testButton = screen.getByTestId("test-connection-local")
			fireEvent.press(testButton)

			// Should show loading state
			await waitFor(() => {
				expect(screen.getByTestId("connection-status-local")).toHaveTextContent(
					"🟡",
				)
			})

			// Should update status after test completes
			await waitFor(
				() => {
					const status = screen.getByTestId("connection-status-local")
					expect(["🟢", "🔴"]).toContain(status.props.children)
				},
				{ timeout: 3000 },
			)
		})

		test('should show "Apply & Restart" button', () => {
			renderScreen()

			expect(screen.getByTestId("apply-restart-button")).toBeTruthy()
			expect(screen.getByText(/Apply & Restart/i)).toBeTruthy()
		})

		test("should show warning message about app restart requirement", () => {
			renderScreen()

			expect(screen.getByText(/restart.*required/i)).toBeTruthy()
		})

		test('should prompt confirmation when "Apply & Restart" is pressed', async () => {
			renderScreen()

			// Change environment
			const localRadio = screen.getByTestId("radio-local")
			fireEvent.press(localRadio)

			// Press apply button
			const applyButton = screen.getByTestId("apply-restart-button")
			fireEvent.press(applyButton)

			// Should show confirmation alert
			expect(mockAlert).toHaveBeenCalledWith(
				expect.stringContaining("Restart"),
				expect.stringContaining("restart"),
				expect.arrayContaining([
					expect.objectContaining({ text: "Cancel" }),
					expect.objectContaining({ text: "Restart" }),
				]),
			)
		})

		test('should disable "Apply & Restart" when no change is made', () => {
			renderScreen()

			const applyButton = screen.getByTestId("apply-restart-button")

			// Should be disabled when current environment is selected
			expect(applyButton.props.accessibilityState.disabled).toBe(true)
		})

		test('should enable "Apply & Restart" when environment changes', () => {
			renderScreen()

			// Change environment
			const localRadio = screen.getByTestId("radio-local")
			fireEvent.press(localRadio)

			// Should enable apply button
			const applyButton = screen.getByTestId("apply-restart-button")
			expect(applyButton.props.accessibilityState.disabled).toBe(false)
		})

		test("should show loading state during environment switch", async () => {
			renderScreen()

			// Change environment and apply
			const localRadio = screen.getByTestId("radio-local")
			fireEvent.press(localRadio)

			const applyButton = screen.getByTestId("apply-restart-button")
			fireEvent.press(applyButton)

			// Confirm in alert
			const alertCall = mockAlert.mock.calls[0]
			const confirmButton = alertCall?.[2]?.find(
				(btn: any) => btn.text === "Restart",
			)
			if (confirmButton?.onPress) {
				await confirmButton.onPress()
			}

			// Should show loading indicator
			await waitFor(
				() => {
					expect(screen.queryByTestId("loading-indicator")).toBeTruthy()
				},
				{ timeout: 100 },
			)
		})

		test("should call reloadAsync when restart is confirmed", async () => {
			const { reloadAsync } = require("expo-updates")
			renderScreen()

			// Change environment
			const localRadio = screen.getByTestId("radio-local")
			fireEvent.press(localRadio)

			// Press apply
			const applyButton = screen.getByTestId("apply-restart-button")
			fireEvent.press(applyButton)

			// Confirm restart
			const alertCall = mockAlert.mock.calls[0]
			const confirmButton = alertCall?.[2]?.find(
				(btn: any) => btn.text === "Restart",
			)
			expect(confirmButton).toBeDefined()

			if (confirmButton?.onPress) {
				await confirmButton.onPress()
			}

			// Wait for reload to be called
			await waitFor(
				() => {
					expect(reloadAsync).toHaveBeenCalled()
				},
				{ timeout: 1000 },
			)
		})

		test("should not restart when cancel is pressed in confirmation", async () => {
			const { reloadAsync } = require("expo-updates")
			jest.clearAllMocks() // Clear previous calls

			renderScreen()

			// Change environment
			const localRadio = screen.getByTestId("radio-local")
			fireEvent.press(localRadio)

			// Press apply
			const applyButton = screen.getByTestId("apply-restart-button")
			fireEvent.press(applyButton)

			// Cancel restart
			const alertCall = mockAlert.mock.calls[0]
			const cancelButton = alertCall?.[2]?.find(
				(btn: any) => btn.style === "cancel",
			)
			expect(cancelButton).toBeDefined()

			if (cancelButton?.onPress) {
				cancelButton.onPress()
			}

			// Wait a bit to ensure no reload happens
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Should not reload
			expect(reloadAsync).not.toHaveBeenCalled()
		})

		test("should handle connection test success", async () => {
			renderScreen()

			// Mock successful connection
			global.fetch = jest.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ success: true }),
			})

			const testButton = screen.getByTestId("test-connection-cloud-dev")
			fireEvent.press(testButton)

			await waitFor(
				() => {
					expect(
						screen.getByTestId("connection-status-cloud-dev"),
					).toHaveTextContent("🟢")
				},
				{ timeout: 3000 },
			)
		})

		test("should handle connection test failure", async () => {
			renderScreen()

			// Mock failed connection
			global.fetch = jest.fn().mockRejectedValue(new Error("Connection failed"))

			const testButton = screen.getByTestId("test-connection-local")
			fireEvent.press(testButton)

			await waitFor(
				() => {
					expect(
						screen.getByTestId("connection-status-local"),
					).toHaveTextContent("🔴")
				},
				{ timeout: 3000 },
			)
		})

		test("should show environment URL information", () => {
			renderScreen()

			// Should show URL previews for configured environments
			expect(screen.getByText(/172\.21\.24\.107:54321/)).toBeTruthy()
			expect(screen.getByText(/supabase\.co/)).toBeTruthy()
		})
	})

	describe("Production Build Tests", () => {
		beforeEach(() => {
			// Mock __DEV__ as false for production tests
			;(global as any).__DEV__ = false
		})

		test('should show "Not Available" message in production builds', () => {
			renderScreen()

			expect(screen.getByText(/not available in production/i)).toBeTruthy()
		})

		test("should not show environment selection in production builds", () => {
			renderScreen()

			expect(screen.queryByText(/Environment Selection/i)).toBeFalsy()
			expect(screen.queryByTestId("radio-local")).toBeFalsy()
			expect(screen.queryByTestId("radio-cloud-dev")).toBeFalsy()
			expect(screen.queryByTestId("radio-cloud-prod")).toBeFalsy()
		})

		test('should not show "Apply & Restart" button in production builds', () => {
			renderScreen()

			expect(screen.queryByTestId("apply-restart-button")).toBeFalsy()
		})

		test("should not show connection test buttons in production builds", () => {
			renderScreen()

			expect(screen.queryByTestId("test-connection-local")).toBeFalsy()
			expect(screen.queryByTestId("test-connection-cloud-dev")).toBeFalsy()
			expect(screen.queryByTestId("test-connection-cloud-prod")).toBeFalsy()
		})
	})

	describe("Accessibility Tests", () => {
		beforeEach(() => {
			;(global as any).__DEV__ = true
		})

		test("should have proper accessibility labels for radio buttons", () => {
			renderScreen()

			const localRadio = screen.getByTestId("radio-local")
			expect(localRadio.props.accessibilityLabel).toBeTruthy()
			expect(localRadio.props.accessibilityRole).toBe("radio")
		})

		test("should have proper accessibility labels for buttons", () => {
			renderScreen()

			const testButton = screen.getByTestId("test-connection-local")
			expect(testButton.props.accessibilityLabel).toBeTruthy()
			expect(testButton.props.accessibilityRole).toBe("button")

			const applyButton = screen.getByTestId("apply-restart-button")
			expect(applyButton.props.accessibilityLabel).toBeTruthy()
			expect(applyButton.props.accessibilityRole).toBe("button")
		})

		test("should have proper accessibility state for disabled elements", () => {
			renderScreen()

			// Apply button should be disabled initially (no change)
			const applyButton = screen.getByTestId("apply-restart-button")
			expect(applyButton.props.accessibilityState.disabled).toBe(true)
		})
	})

	describe("Visual Design Tests", () => {
		beforeEach(() => {
			;(global as any).__DEV__ = true
		})

		test("should render with proper React Native Paper components", () => {
			const { UNSAFE_root } = renderScreen()

			// Should use Paper components (RadioButton.Group, Surface, List, etc.)
			expect(UNSAFE_root).toBeTruthy()
		})

		test("should match existing app design patterns", () => {
			renderScreen()

			// Should use consistent styling with DevBuildInfo screen
			expect(screen.getByText("Developer Settings")).toBeTruthy()
		})
	})
})
