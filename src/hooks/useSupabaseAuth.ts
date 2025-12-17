import { useCallback } from "react"
import { useAppDispatch, useAppSelector } from "../redux"
import {
	setCredentials,
	logout as logoutAction,
} from "../redux/slices/authSlice"
import {
	login,
	register,
	logout,
	getCurrentSession,
	isAuthenticated,
	resetPassword,
	updatePassword,
} from "../services/auth"
import {
	LoginRequest,
	RegisterRequest,
	AuthResponse,
} from "../redux/api/auth/types"

/**
 * Custom hook for Supabase authentication
 * Provides authentication methods and state from Redux
 */
export const useSupabaseAuth = () => {
	const dispatch = useAppDispatch()
	const authState = useAppSelector((state) => state.authentication)

	const handleLogin = useCallback(
		async (credentials: LoginRequest): Promise<AuthResponse> => {
			try {
				const authResponse = await login(credentials)
				dispatch(setCredentials(authResponse))
				return authResponse
			} catch (error) {
				throw error
			}
		},
		[dispatch],
	)

	const handleRegister = useCallback(
		async (credentials: RegisterRequest): Promise<AuthResponse> => {
			try {
				const authResponse = await register(credentials)
				dispatch(setCredentials(authResponse))
				return authResponse
			} catch (error) {
				throw error
			}
		},
		[dispatch],
	)

	const handleLogout = useCallback(async (): Promise<void> => {
		try {
			await logout()
			dispatch(logoutAction())
		} catch (error) {
			console.error("Logout error:", error)
			// Even if logout fails, clear local state
			dispatch(logoutAction())
		}
	}, [dispatch])

	const checkAuthStatus = useCallback(async (): Promise<boolean> => {
		try {
			return await isAuthenticated()
		} catch (error) {
			console.error("Auth status check error:", error)
			return false
		}
	}, [])

	const refreshAuthSession = useCallback(async (): Promise<void> => {
		try {
			const session = await getCurrentSession()
			if (session) {
				dispatch(setCredentials(session))
			} else {
				dispatch(logoutAction())
			}
		} catch (error) {
			console.error("Refresh session error:", error)
			dispatch(logoutAction())
		}
	}, [dispatch])

	const handleResetPassword = useCallback(
		async (email: string): Promise<void> => {
			try {
				await resetPassword(email)
			} catch (error) {
				throw error
			}
		},
		[],
	)

	const handleUpdatePassword = useCallback(
		async (newPassword: string): Promise<void> => {
			try {
				await updatePassword(newPassword)
			} catch (error) {
				throw error
			}
		},
		[],
	)

	return {
		// Auth state from Redux
		user: authState.user,
		token: authState.token,
		loading: authState.loading,
		initialLoad: authState.initialLoad,
		error: authState.error,
		isLoggedIn: !!authState.token && !!authState.user,

		// Auth methods
		login: handleLogin,
		register: handleRegister,
		logout: handleLogout,
		checkAuthStatus,
		refreshSession: refreshAuthSession,
		resetPassword: handleResetPassword,
		updatePassword: handleUpdatePassword,
	}
}

export default useSupabaseAuth
