import { PropsWithChildren, useEffect, useRef } from "react"
import { batch } from "react-redux"
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


const initAuthProvider = (
    dispatch: any,
    authListenerRef: React.MutableRefObject<(() => void) | null>
) => {
    try {
        // Set up auth state listener
        // Supabase's onAuthStateChange immediately fires with the current session
        authListenerRef.current = setupAuthListener((authResponse) => {
            if (authResponse) {
                batch(() => {
                    dispatch(setProfileLoading(true))
                    dispatch(setCredentials(authResponse))
                })
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

export const AuthProvider = ({ children }: PropsWithChildren<unknown>) => {
	const dispatch = useAppDispatch()
	const authListenerRef = useRef<(() => void) | null>(null)

	useEffect(() => {
		initAuthProvider(dispatch, authListenerRef)

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
