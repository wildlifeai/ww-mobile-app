import { api } from ".."
import { AuthResponse, LoginRequest, RegisterRequest } from "./types"
import { login, register } from "../../../services/auth"
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

export const { useLoginMutation, useRegisterMutation } = authApi
