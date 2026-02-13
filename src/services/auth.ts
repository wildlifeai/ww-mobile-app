import {
	Session,
	User,
	AuthChangeEvent,
} from "@supabase/supabase-js"
import { getSupabaseClient } from "./supabase"
import {
	AuthResponse,
	LoginRequest,
	RegisterRequest,
	UserRole,
} from "../redux/api/auth/types"

import { log, logError, logWarn } from '../utils/logger'


/**
 * Supabase Authentication Service
 *
 * This service provides authentication functionality using Supabase Auth
 * and integrates with the existing Redux auth slice structure.
 */

/** Helper to get Supabase client */
const supabase = () => getSupabaseClient()

/**
 * Sync user's organisations to local SQLite database
 * This ensures foreign key constraints are satisfied for offline operations
 */


/**
 * Fetch user's organisations and role information from database
 * This queries the user_organisations table to get all organisations the user belongs to
 */
const fetchUserOrganisations = async (userId: string) => {
	try {
		// 🔍 DEBUG: Verify JWT session first (as suggested by backend team)
		const {
			data: { session },
			error: sessionError,
		} = await supabase().auth.getSession()
		log("🔍 JWT DEBUG:", {
			hasSession: !!session,
			userId: session?.user?.id,
			email: session?.user?.email,
			hasToken: !!session?.access_token,
			tokenLength: session?.access_token?.length,
			sessionError: sessionError?.message,
			paramUserId: userId,
			userIdMatch: session?.user?.id === userId,
		})

		if (!session || !session.user) {
			logError("❌ No active session - JWT token missing or expired")
			return {
				organisations: [],
				role: "project_member" as const,
				organisationId: null,
			}
		}

		if (session.user.id !== userId) {
			logError("⚠️ User ID mismatch:", {
				tokenUserId: session.user.id,
				paramUserId: userId,
			})
		}

		// Step 1: Get user roles (replaces user_organisations)
		log("📋 Querying user_roles for userId:", userId)
		const { data: userRoles, error: rolesError } = await supabase()
			.from("user_roles")
			.select("role, scope_type, scope_id")
			.eq("user_id", userId)
			.eq("is_active", true)

		if (rolesError) {
			logError("❌ Error fetching user_roles:", {
				message: rolesError.message,
				details: rolesError.details,
				hint: rolesError.hint,
				code: rolesError.code,
			})
			return {
				organisations: [],
				role: "project_member" as const,
				organisationId: null,
			}
		}

		if (!userRoles || userRoles.length === 0) {
			logWarn("⚠️ No roles found for user:", userId)
			return {
				organisations: [],
				role: "project_member" as const,
				organisationId: null,
			}
		}

		log("✅ Found", userRoles.length, "user roles")

		// Step 2: Get organisation details
		// Extract unique organisation IDs from roles
		const orgIds = [...new Set(userRoles
			.filter(r => r.scope_type === 'organisation' && r.scope_id)
			.map(r => r.scope_id as string))]
		log("📋 Querying organisations table for IDs:", orgIds)
		const { data: orgs, error: orgsError } = await supabase()
			.from("organisations")
			.select("id, name, slug")
			.in("id", orgIds)

		if (orgsError) {
			logError("❌ Error fetching organisations:", {
				message: orgsError.message,
				details: orgsError.details,
				hint: orgsError.hint,
				code: orgsError.code,
			})
			return {
				organisations: [],
				role: "project_member" as const,
				organisationId: null,
			}
		}

		log("✅ Found", orgs?.length || 0, "organisations")

		// Step 3: Combine the data
		const organisations = orgIds.map((orgId) => {
			const org = orgs?.find((o) => o.id === orgId)

			// Find role for this organisation
			const orgRole = userRoles.find(
				(r) => r.scope_type === "organisation" && r.scope_id === orgId,
			)
			const systemRole = userRoles.find(
				(r) => r.scope_type === "system" || r.scope_type === "global",
			)

			// System ww_admin role takes precedence over org-specific roles
			const role = systemRole?.role || orgRole?.role || "project_member"

			return {
				id: org?.id || "",
				name: org?.name || "",
				role: role as "ww_admin" | "project_admin" | "project_member",
			}
		})

		// Get highest privilege role (ww_admin > project_admin > project_member)
		const allRoles = organisations.map(
			(o: {
				id: string
				name: string
				role: "ww_admin" | "project_admin" | "project_member"
			}) => o.role,
		)
		const role = allRoles.includes("ww_admin")
			? "ww_admin"
			: allRoles.includes("project_admin")
				? "project_admin"
				: "project_member"

		// Get default organisation (first one for now)
		// Get default organisation (first one for now)
		const organisationId = orgIds.length > 0 ? orgIds[0] : null

		log("✅ Fetched user organisations:", {
			organisations,
			role,
			organisationId,
		})



		return { organisations, role, organisationId }
	} catch (error) {
		logError("❌ Exception in fetchUserOrganisations:", {
			message: error instanceof Error ? error.message : "Unknown error",
			error: error,
			stack: error instanceof Error ? error.stack : undefined,
			userId: userId,
		})
		return {
			organisations: [],
			role: "project_member" as const,
			organisationId: null,
		}
	}
}

// Transform Supabase User to match existing app AuthResponse format
// Now includes organisation data from database
const transformSupabaseUser = async (
	user: User,
	session: Session,
): Promise<AuthResponse> => {
	// Fetch user's organisations from database
	const { organisations, role, organisationId } = await fetchUserOrganisations(
		user.id,
	)

	return {
		jwt: session.access_token,
		user: {
			id: user.id, // Keep UUID as string
			email: user.email || "",
			role: role as UserRole, // User's highest privilege role
			organisation_id: organisationId, // Default organisation
			organisations, // All organisations user belongs to
		},
	}
}

/**
 * Login with email and password
 */
export const login = async (
	credentials: LoginRequest,
): Promise<AuthResponse> => {
	try {
		log("🔐 Auth Service: Starting login for:", credentials.identifier)

		const { data, error } = await supabase().auth.signInWithPassword({
			email: credentials.identifier, // Assume identifier is email
			password: credentials.password,
		})

		if (error) {
			logError("❌ Supabase Auth Error:", {
				message: error.message,
				status: error.status,
				name: error.name,
				code: (error as any).code,
				details: error,
			})
			throw new Error(error.message)
		}

		if (!data.user || !data.session) {
			logError("❌ No user or session returned from Supabase")
			throw new Error("Login failed: No user or session data returned")
		}

		log("✅ Supabase auth successful, transforming user data...")
		const authResponse = await transformSupabaseUser(data.user, data.session)
		log("✅ Login complete for:", data.user.email)

		return authResponse
	} catch (error) {
		logError("❌ Login error (final catch):", {
			message: error instanceof Error ? error.message : "Unknown error",
			error: error,
			stack: error instanceof Error ? error.stack : undefined,
		})
		throw error
	}
}

/**
 * Register new user
 */
export const register = async (
	credentials: RegisterRequest,
): Promise<AuthResponse> => {
	try {
		const { data, error } = await supabase().auth.signUp({
			email: credentials.email,
			password: credentials.password,
			options: {
				data: {
					name: credentials.name,
					organization: credentials.organization,
				},
				emailRedirectTo: "wildlifewatcher://auth/callback",
			},
		})

		if (error) {
			throw new Error(error.message)
		}

		if (!data.user) {
			throw new Error("Registration failed: No user data returned")
		}

		// If no session, user needs to confirm email first
		if (!data.session) {
			log("Registration successful - email confirmation required")
			// Don't throw an error - this is a success case that requires email confirmation
			// Instead, return a special response indicating email confirmation is needed
			const pendingAuthResponse: AuthResponse = {
				jwt: "", // No JWT until confirmed
				user: {
					id: data.user.id, // Keep UUID as string
					email: credentials.email,
					role: "project_member" as UserRole,
					organisation_id: null,
					organisations: [],
				},
			}

			// Add a special flag to indicate this is pending confirmation
			pendingAuthResponse.isPendingConfirmation = true
			return pendingAuthResponse
		}

		return await transformSupabaseUser(data.user, data.session)
	} catch (error) {
		logError("Registration error:", error)
		throw error
	}
}

/**
 * Logout current user
 */
export const logout = async (): Promise<void> => {
	try {
		const { error } = await supabase().auth.signOut()
		if (error) {
			throw new Error(error.message)
		}
	} catch (error) {
		logError("Logout error:", error)
		throw error
	}
}

/**
 * Get current session
 */
export const getCurrentSession = async (): Promise<AuthResponse | null> => {
	try {
		const {
			data: { session },
			error,
		} = await supabase().auth.getSession()

		if (error) {
			logError("Get session error:", error)
			return null
		}

		if (!session || !session.user) {
			return null
		}

		return transformSupabaseUser(session.user, session)
	} catch (error) {
		logError("Get current session error:", error)
		return null
	}
}

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async (): Promise<boolean> => {
	const session = await getCurrentSession()
	return session !== null
}

/**
 * Refresh current session
 */
export const refreshSession = async (): Promise<AuthResponse | null> => {
	try {
		const {
			data: { session },
			error,
		} = await supabase().auth.refreshSession()

		if (error) {
			logError("Refresh session error:", error)
			return null
		}

		if (!session || !session.user) {
			return null
		}

		return transformSupabaseUser(session.user, session)
	} catch (error) {
		logError("Refresh session error:", error)
		return null
	}
}

/**
 * Setup auth state change listener
 * This function returns an unsubscribe function
 */
export const setupAuthListener = (
	onAuthStateChange: (authResponse: AuthResponse | null) => void,
): (() => void) => {
	const {
		data: { subscription },
	} = supabase().auth.onAuthStateChange(
		async (event: AuthChangeEvent, session: Session | null) => {
			log("Auth state changed:", event, session?.user?.email)

			if (session && session.user) {
				const authResponse = await transformSupabaseUser(session.user, session)
				onAuthStateChange(authResponse)

				// Trigger sync after successful sign-in to pull projects and other data
				if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
					// Use a safe import or event trigger to avoid circular dependencies
					// For now, we use a custom event that various services can listen to
					log("Triggering post-auth sync event...");
					// @ts-ignore - dynamic require to break cycle without dynamic import ESM issues
					const { triggerPostAuthSync } = require('./SyncTriggerService');
					triggerPostAuthSync();
				}
			} else {
				onAuthStateChange(null)
			}
		},
	)

	// Return unsubscribe function
	return () => {
		subscription.unsubscribe()
	}
}

/**
 * Password reset functionality
 */
export const resetPassword = async (email: string): Promise<void> => {
	try {
		const { error } = await supabase().auth.resetPasswordForEmail(email, {
			redirectTo: "wildlifewatcher://auth/reset-password",
		})

		if (error) {
			throw new Error(error.message)
		}
	} catch (error) {
		logError("Reset password error:", error)
		throw error
	}
}

/**
 * Update user password (requires active session)
 */
export const updatePassword = async (newPassword: string): Promise<void> => {
	try {
		const { error } = await supabase().auth.updateUser({
			password: newPassword,
		})

		if (error) {
			throw new Error(error.message)
		}
	} catch (error) {
		logError("Update password error:", error)
		throw error
	}
}

/**
 * Reset password using token from email
 * @param token - Can be either token_hash (from email query param) or access_token (from URL fragment)
 * @param newPassword - The new password to set
 * @param refreshToken - Optional refresh token from URL fragment
 */
import { createClient } from "@supabase/supabase-js"
import { getEnvironmentConfig } from "../config/EnvironmentManager"


export const updatePasswordWithToken = async (
	token: string,
	newPassword: string,
	refreshToken?: string,
): Promise<void> => {
	try {
        // 1. Get Config
        const config = await getEnvironmentConfig()
        
        // 2. Create a TEMPORARY client with NO storage (memory only)
        // This avoids AsyncStorage deadlocks which are causing the hang
        const tempClient = createClient(
            config.supabaseUrl, 
            config.supabaseAnonKey,
            {
                auth: {
                    persistSession: false, // CRITICAL: Do not lock AsyncStorage
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            }
        )

		// If we have both access_token and refresh_token from URL fragment
		if (refreshToken) {
			const { error: sessionError } = await tempClient.auth.setSession({
				access_token: token,
				refresh_token: refreshToken,
			})

			if (sessionError) {
				throw new Error(sessionError.message)
			}
		} else {
            // Legacy OTP
			const { error: verifyError } = await tempClient.auth.verifyOtp({
				token_hash: token,
				type: "recovery",
			})

			if (verifyError) {
				throw new Error(verifyError.message)
			}
		}

		// Now update the password using this temporary authenticated client
		const { error: updateError } = await tempClient.auth.updateUser({
			password: newPassword,
		})

		if (updateError) {
			throw new Error(updateError.message)
		}
        
		log("Password updated successfully via temp client")
	} catch (error) {
		logError("Update password with token error:", error)
		throw error
	}
}

/**
 * Get current user
 */
export const getCurrentUser = async (): Promise<User | null> => {
	try {
		const {
			data: { user },
			error,
		} = await supabase().auth.getUser()

		if (error) {
			logError("Get user error:", error)
			return null
		}

		return user
	} catch (error) {
		logError("Get current user error:", error)
		return null
	}
}
