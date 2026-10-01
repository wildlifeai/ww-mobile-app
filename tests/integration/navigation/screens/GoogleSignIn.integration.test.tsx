/**
 * "Continue with Google" on Login and Register (#350): shown only when the
 * build has the client IDs, and a sign-in lands in the same Redux state as an
 * email login.
 */

import { Alert } from "react-native"
import { fireEvent, waitFor, screen } from "@testing-library/react-native"
import { Login } from "../../../../src/navigation/screens/auth/LoginScreen"
import { Register } from "../../../../src/navigation/screens/auth/RegisterScreen"
import {
	renderWithProviders,
	createTestStore,
} from "../../../setup/utils/testUtils"
import {
	mockSupabaseClient,
	mockSession,
	mockUser,
	resetSupabaseMocks,
} from "../../../__mocks__/supabase"
import * as SecureStore from "expo-secure-store"

jest.mock("expo-secure-store")

jest.mock("@react-navigation/native", () => ({
	...jest.requireActual("@react-navigation/native"),
	useNavigation: () => ({
		navigate: jest.fn(),
		goBack: jest.fn(),
		addListener: jest.fn(),
		setOptions: jest.fn(),
	}),
	useRoute: () => ({ params: {} }),
}))

jest.mock("../../../../src/services/supabase", () => ({
	getSupabaseClient: () => mockSupabaseClient,
	initializeSupabaseClient: () => Promise.resolve(mockSupabaseClient),
	reconnectSupabase: () => Promise.resolve(mockSupabaseClient),
	onSupabaseClientChange: jest.fn(() => jest.fn()),
	resetSupabaseClient: jest.fn(),
	getCurrentEnvironment: jest.fn(() => null),
}))

// The native module is not in Jest; this stands in for the library's JS API
const mockGoogleSignin = {
	configure: jest.fn(),
	hasPlayServices: jest.fn(),
	signIn: jest.fn(),
	signOut: jest.fn(),
}
jest.mock("@react-native-google-signin/google-signin", () => ({
	GoogleSignin: mockGoogleSignin,
	statusCodes: {
		SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
		IN_PROGRESS: "IN_PROGRESS",
		PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
		SIGN_IN_REQUIRED: "SIGN_IN_REQUIRED",
	},
	isErrorWithCode: (error: unknown) =>
		!!error && typeof error === "object" && "code" in error,
}))

const configure = () => {
	// Set on process.env itself: babel-preset-expo reads EXPO_PUBLIC_ vars from that object
	process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = "test-web-client-id"
	// Jest's react-native preset runs as iOS, which also needs the iOS client
	process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "test-ios-client-id"
}

const unconfigure = () => {
	delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
	delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
}

describe("Continue with Google", () => {
	let store: ReturnType<typeof createTestStore>
	let alertSpy: jest.SpyInstance

	beforeEach(() => {
		store = createTestStore()
		resetSupabaseMocks()
		unconfigure()
		alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {})
		;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null)

		mockGoogleSignin.hasPlayServices.mockResolvedValue(true)
		mockGoogleSignin.signIn.mockResolvedValue({
			type: "success",
			data: { idToken: "google-id-token", user: { email: mockUser.email } },
		})
		mockGoogleSignin.signOut.mockResolvedValue(null)
	})

	// Unmount while the fake timers are still on. The root afterEach switches to
	// real timers before RNTL's cleanup, and RTK's auto-batched notification for
	// the mutation's removal would then fire after the environment is gone.
	afterEach(() => {
		screen.unmount()
		jest.runOnlyPendingTimers()
	})

	afterAll(unconfigure)

	describe("shown only when configured", () => {
		test("Login hides it without the web client ID", () => {
			renderWithProviders(<Login />, { store })
			expect(screen.queryByTestId("google-signin-button")).toBeNull()
			// The email login is untouched
			expect(screen.getByTestId("login-button")).toBeTruthy()
		})

		test("Login shows it with the client IDs", () => {
			configure()
			renderWithProviders(<Login />, { store })
			expect(screen.getByTestId("google-signin-button")).toBeTruthy()
			expect(screen.getByText("Continue with Google")).toBeTruthy()
		})

		test("Register hides it without the web client ID", () => {
			renderWithProviders(<Register />, { store })
			expect(screen.queryByTestId("google-signin-button")).toBeNull()
		})

		test("Register shows it with the client IDs", () => {
			configure()
			renderWithProviders(<Register />, { store })
			expect(screen.getByTestId("google-signin-button")).toBeTruthy()
		})
	})

	test("a sign-in signs in to Supabase with the ID token and sets the same state as an email login", async () => {
		configure()
		renderWithProviders(<Login />, { store })

		fireEvent.press(screen.getByTestId("google-signin-button"))

		await waitFor(() => {
			expect(store.getState().authentication.token).toBe(mockSession.access_token)
		})
		expect(mockSupabaseClient.auth.signInWithIdToken).toHaveBeenCalledWith({
			provider: "google",
			token: "google-id-token",
		})
		const auth = store.getState().authentication
		expect(auth.user).toEqual(expect.objectContaining({ id: mockUser.id, email: mockUser.email }))
		expect(auth.pendingTutorial).toBe(true)
		expect(alertSpy).not.toHaveBeenCalled()
	})

	test("closing Google's sheet shows nothing and signs nothing in", async () => {
		configure()
		mockGoogleSignin.signIn.mockResolvedValue({ type: "cancelled", data: null })
		renderWithProviders(<Login />, { store })

		fireEvent.press(screen.getByTestId("google-signin-button"))

		await waitFor(() => expect(mockGoogleSignin.signIn).toHaveBeenCalled())
		// Let the mutation settle before checking nothing happened
		await waitFor(() => {
			expect(screen.getByTestId("google-signin-button").props.accessibilityState?.disabled).toBe(false)
		})
		expect(mockSupabaseClient.auth.signInWithIdToken).not.toHaveBeenCalled()
		expect(store.getState().authentication.token).toBeUndefined()
		expect(store.getState().authentication.pendingTutorial).toBe(false)
		expect(alertSpy).not.toHaveBeenCalled()
	})

	test("a Supabase refusal is shown, and nothing is signed in", async () => {
		configure()
		mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
			data: { user: null, session: null },
			error: { name: "AuthApiError", message: "Unacceptable audience in id_token", status: 400 },
		})
		renderWithProviders(<Login />, { store })

		fireEvent.press(screen.getByTestId("google-signin-button"))

		await waitFor(() => {
			expect(alertSpy).toHaveBeenCalledWith(
				"Google sign-in failed",
				"The server did not accept the Google sign-in (Unacceptable audience in id_token).",
				[{ text: "OK" }],
			)
		})
		expect(store.getState().authentication.token).toBeUndefined()
	})
})
