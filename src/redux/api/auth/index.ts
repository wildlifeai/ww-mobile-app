import { api } from ".."
import { AuthResponse, LoginRequest, RegisterRequest } from "./types"
import { login, register } from "../../../services/auth"

export const authApi = api.injectEndpoints({
	endpoints: (builder) => ({
		login: builder.mutation<AuthResponse, LoginRequest>({
			queryFn: async (credentials) => {
				try {
					const result = await login(credentials)
					return { data: result }
				} catch (error) {
					return { 
						error: { 
							status: 'CUSTOM_ERROR', 
							error: error instanceof Error ? error.message : 'Login failed' 
						} 
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
							status: 'CUSTOM_ERROR', 
							error: error instanceof Error ? error.message : 'Registration failed' 
						} 
					}
				}
			},
		}),
	}),
	overrideExisting: false,
})

export const { useLoginMutation, useRegisterMutation } = authApi
