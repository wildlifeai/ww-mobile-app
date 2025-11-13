import { PropsWithChildren, useEffect, useRef } from "react"
import { useAppDispatch } from "../redux"
import {
	setCredentials,
	logout,
	setInitialState,
} from "../redux/slices/authSlice"
import { getCurrentSession, setupAuthListener } from "../services/auth"
import { AuthResponse } from "../redux/api/auth/types"

export const AuthProvider = ({ children }: PropsWithChildren<unknown>) => {
	const dispatch = useAppDispatch()
	const authListenerRef = useRef<(() => void) | null>(null)

	useEffect(() => {
		const init = async () => {
			try {
				// Check for existing Supabase session
				const sessionData = await getCurrentSession()
				dispatch(setInitialState(sessionData))

				// Set up auth state listener
				authListenerRef.current = setupAuthListener((authResponse) => {
					if (authResponse) {
						dispatch(setCredentials(authResponse))
					} else {
						dispatch(logout())
					}
				})
			} catch (error) {
				console.error("Auth initialization error:", error)
				dispatch(setInitialState(null))
			}
		}

		init()

		// Cleanup function
		return () => {
			if (authListenerRef.current) {
				authListenerRef.current()
				authListenerRef.current = null
			}
		}
	}, [dispatch])

	return children
}
