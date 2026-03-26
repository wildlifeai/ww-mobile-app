import { PropsWithChildren, useEffect, useRef } from "react"
import { useAppDispatch } from "../redux"
import {
	setCredentials,
	logout,
	setInitialState,
	setOrganisationsAndRole,
	setProfileLoading,
} from "../redux/slices/authSlice"
import { setupAuthListener } from "../services/auth"
import { logError } from '../utils/logger'


export const AuthProvider = ({ children }: PropsWithChildren<unknown>) => {
	const dispatch = useAppDispatch()
	const authListenerRef = useRef<(() => void) | null>(null)

	useEffect(() => {
		const init = () => {
			try {
				// Set up auth state listener
				// Supabase's onAuthStateChange immediately fires with the current session
				authListenerRef.current = setupAuthListener((authResponse) => {
					if (authResponse) {
						dispatch(setProfileLoading(true))
						dispatch(setCredentials(authResponse))
					} else {
						dispatch(logout())
					}
				}, (orgData) => {
					dispatch(setOrganisationsAndRole(orgData))
				})
			} catch (error) {
				logError("Auth initialization error:", error)
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
