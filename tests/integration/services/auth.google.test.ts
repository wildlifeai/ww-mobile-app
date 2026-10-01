/**
 * signInWithGoogle (#350): Google's native sign-in gives an ID token, Supabase
 * signs in with it, and the result is the same AuthResponse as a password login.
 */

import { GoogleSignInError, signInWithGoogle } from "../../../src/services/auth"
import { isGoogleSignInConfigured } from "../../../src/config/googleSignIn"
import {
	mockSupabaseClient,
	mockUser,
	mockSession,
	resetSupabaseMocks,
} from "../../__mocks__/supabase"
import {
	__setNetworkState,
	__resetNetworkState,
} from "../../__mocks__/@react-native-community/netinfo"

jest.mock("../../../src/services/supabase", () => ({
	getSupabaseClient: () => mockSupabaseClient,
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

const WEB_CLIENT_ID = "test-web-client-id"
const IOS_CLIENT_ID = "test-ios-client-id"

const nativeError = (code: string, message = code) =>
	Object.assign(new Error(message), { code })

const expectFailure = async (reason: string) => {
	const error = await signInWithGoogle().then(
		() => null,
		(e: unknown) => e,
	)
	expect(error).toBeInstanceOf(GoogleSignInError)
	expect((error as GoogleSignInError).reason).toBe(reason)
	return error as GoogleSignInError
}

describe("signInWithGoogle", () => {
	beforeEach(() => {
		resetSupabaseMocks()
		__resetNetworkState()
		// babel-preset-expo reads EXPO_PUBLIC_ vars from the process.env object
		// itself, so set them on it rather than replacing it
		process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = WEB_CLIENT_ID
		process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = IOS_CLIENT_ID

		mockGoogleSignin.hasPlayServices.mockResolvedValue(true)
		mockGoogleSignin.signIn.mockResolvedValue({
			type: "success",
			data: { idToken: "google-id-token", user: { email: mockUser.email } },
		})
		mockGoogleSignin.signOut.mockResolvedValue(null)
	})

	afterAll(() => {
		delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
		delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
	})

	test("signs in to Supabase with Google's ID token and returns the login's AuthResponse", async () => {
		const result = await signInWithGoogle()

		expect(mockGoogleSignin.configure).toHaveBeenCalledWith({
			webClientId: WEB_CLIENT_ID,
			iosClientId: IOS_CLIENT_ID,
		})
		expect(mockGoogleSignin.hasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: true })
		expect(mockSupabaseClient.auth.signInWithIdToken).toHaveBeenCalledWith({
			provider: "google",
			token: "google-id-token",
		})
		// The same shape `login` returns, so the screens and the slice treat it the same
		expect(result).toEqual({
			jwt: mockSession.access_token,
			user: {
				id: mockUser.id,
				email: mockUser.email,
				role: "project_member",
				organisation_id: null,
				created_at: mockUser.created_at,
			},
		})
		// Google's own session is dropped so the next tap offers the account picker
		expect(mockGoogleSignin.signOut).toHaveBeenCalled()
	})

	test("resolves null when the user closes Google's sheet, and signs nothing in", async () => {
		mockGoogleSignin.signIn.mockResolvedValue({ type: "cancelled", data: null })

		await expect(signInWithGoogle()).resolves.toBeNull()
		expect(mockSupabaseClient.auth.signInWithIdToken).not.toHaveBeenCalled()
	})

	test("treats a SIGN_IN_CANCELLED rejection as a cancel too", async () => {
		mockGoogleSignin.signIn.mockRejectedValue(nativeError("SIGN_IN_CANCELLED"))

		await expect(signInWithGoogle()).resolves.toBeNull()
		expect(mockSupabaseClient.auth.signInWithIdToken).not.toHaveBeenCalled()
	})

	test("is not configured without the web client ID, and never touches Google", async () => {
		delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID

		expect(isGoogleSignInConfigured()).toBe(false)
		await expectFailure("not_configured")
		expect(mockGoogleSignin.configure).not.toHaveBeenCalled()
		expect(mockGoogleSignin.signIn).not.toHaveBeenCalled()
		expect(mockSupabaseClient.auth.signInWithIdToken).not.toHaveBeenCalled()
	})

	test("is not configured on iOS without the iOS client ID", () => {
		delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
		// Jest's react-native preset runs as iOS
		expect(isGoogleSignInConfigured()).toBe(false)
	})

	test("offline, says it needs a connection and does not open Google", async () => {
		__setNetworkState({ isConnected: false })

		const error = await expectFailure("offline")
		expect(error.message).toMatch(/needs a connection/)
		expect(mockGoogleSignin.signIn).not.toHaveBeenCalled()
	})

	test("without Play Services, says so", async () => {
		mockGoogleSignin.hasPlayServices.mockRejectedValue(nativeError("PLAY_SERVICES_NOT_AVAILABLE"))

		const error = await expectFailure("play_services")
		expect(error.message).toMatch(/Google Play services/)
		expect(mockGoogleSignin.signIn).not.toHaveBeenCalled()
	})

	test("turns a Supabase refusal into a readable message", async () => {
		mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
			data: { user: null, session: null },
			error: { name: "AuthApiError", message: "Unacceptable audience in id_token", status: 400 },
		})

		const error = await expectFailure("supabase")
		expect(error.message).toBe("The server did not accept the Google sign-in (Unacceptable audience in id_token).")
		expect(mockGoogleSignin.signOut).toHaveBeenCalled()
	})

	// Last: it swaps the module registry
	test("says it is not set up, rather than crash, when the binary lacks the native module", async () => {
		jest.resetModules()
		jest.doMock("@react-native-google-signin/google-signin", () => {
			throw new Error("TurboModuleRegistry.getEnforcing(...): 'RNGoogleSignin' could not be found")
		})
		const auth = require("../../../src/services/auth") as typeof import("../../../src/services/auth")

		const error = await auth.signInWithGoogle().then(
			() => null,
			(e: unknown) => e as { reason?: string },
		)
		expect(error?.reason).toBe("not_configured")
		jest.dontMock("@react-native-google-signin/google-signin")
	})
})
