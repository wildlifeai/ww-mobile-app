import { api } from ".."
import { AuthResponse, LoginRequest, RegisterRequest } from "./types"
import { GoogleSignInError, login, register, signInWithGoogle } from "../../../services/auth"
import { log } from '../../../utils/logger'


export const authApi = api.injectEndpoints({
	endpoints: (builder) => ({
		login: builder.mutation<AuthResponse, LoginRequest>({
			queryFn: async (credentials) => {
				try {
					log(
						"🔐 RTK Query: Attempting login for:",
						credentials.identifier,
					)
					const result = await login(credentials)
					log("✅ RTK Query: Login successful")
					return { data: result }
				} catch (error) {
					// Error will be displayed in UI, no need for verbose console logs
					return {
						error: {
							status: "CUSTOM_ERROR",
							error: error instanceof Error ? error.message : "Login failed",
							data: error instanceof Error ? { message: error.message, stack: error.stack } : error,
						},
					}
				}
			},
		}),
		// null when the user closed Google's sheet; data.reason says why it failed
		googleSignIn: builder.mutation<AuthResponse | null, void>({
			queryFn: async () => {
				try {
					return { data: await signInWithGoogle() }
				} catch (error) {
					return {
						error: {
							status: "CUSTOM_ERROR",
							error: error instanceof Error ? error.message : "Google sign-in failed",
							data: { reason: error instanceof GoogleSignInError ? error.reason : "google" },
						},
					}
				}
			},
		}),
		register: builder.mutation<AuthResponse, RegisterRequest>({
			queryFn: async (credentials) => {
				try {
					const result = await register(credentials)
					return { data: result }
				} catch (error) {
					return {
						error: {
							status: "CUSTOM_ERROR",
							error:
								error instanceof Error ? error.message : "Registration failed",
						},
					}
				}
			},
		}),
	}),
	overrideExisting: false,
})

export const { useLoginMutation, useGoogleSignInMutation, useRegisterMutation } = authApi
