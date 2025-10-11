import { api } from ".."
import { AuthResponse, LoginRequest, RegisterRequest } from "./types"
import { login, register } from "../../../services/auth"

export const authApi = api.injectEndpoints({
	endpoints: (builder) => ({
		login: builder.mutation<AuthResponse, LoginRequest>({
			queryFn: async (credentials) => {
				try {
					console.log('🔐 RTK Query: Attempting login for:', credentials.identifier)
					const result = await login(credentials)
					console.log('✅ RTK Query: Login successful')
					return { data: result }
				} catch (error) {
					console.error('❌ RTK Query: Login failed:', {
						message: error instanceof Error ? error.message : 'Unknown error',
						error: error,
						stack: error instanceof Error ? error.stack : undefined
					})
					return {
						error: {
							status: 'CUSTOM_ERROR',
							error: error instanceof Error ? error.message : 'Login failed',
							data: error // Pass through full error object
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
