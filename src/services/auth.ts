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
	UserOrganisation,
} from "../redux/api/auth/types"

import { log, logError, logWarn } from '../utils/logger'
import { logCloudFailure } from '../utils/networkErrors'
import { WEBSITE_URL } from "../config/environments"
import { getGoogleSignInConfig } from "../config/googleSignIn"
import { isKnownOffline } from "./connectivityWatch"
import {
	OrganisationMembership,
	buildMembership,
	isNetworkOrRetryable,
	readLocalMembership,
	recallCurrentOrganisation,
	rememberCurrentOrganisation,
	saveOrganisationsLocallyQuietly,
} from "./organisationMembership"


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


/** Record the organisation a membership opens, so the next start reopens it. */
const rememberAndReturn = async (userId: string, membership: OrganisationMembership): Promise<OrganisationMembership> => {
	await rememberCurrentOrganisation(userId, membership.organisationId)
	return membership
}

/**
 * Fetch user's organisations and role information.
 *
 * Asks the cloud's `user_roles` and `organisations`. When either query cannot
 * reach the server (#332), the answer is built from the local tables the last
 * sync left instead; an answer with no rows is the server's truth and is kept.
 * The current organisation is the one the user last had open, while the roles
 * still allow it.
 */
let orgFetchPromise: Promise<{ organisations: UserOrganisation[], role: UserRole, organisationId: string | null }> | null = null;
let lastFetchedUserId: string | null = null;
let lastFetchTime: number = 0;
const CACHE_TTL = 30_000; // 30 seconds
let cachedResult: { organisations: UserOrganisation[], role: UserRole, organisationId: string | null } | null = null;

export const fetchUserOrganisations = async (userId: string, session?: Session): Promise<{ organisations: UserOrganisation[], role: UserRole, organisationId: string | null }> => {
	// Return in-flight promise if one exists for the same user
	if (orgFetchPromise && lastFetchedUserId === userId) return orgFetchPromise;
	
	// Return cached result if within TTL
	if (cachedResult && lastFetchedUserId === userId && (Date.now() - lastFetchTime < CACHE_TTL)) {
		log("🔄 Using cached organisation data (within TTL)");
		return cachedResult;
	}

	const currentPromise = (async () => {
		lastFetchedUserId = userId;
		try {
		// 🔍 DEBUG: Verify JWT session first (as suggested by backend team)
		// Use passed session if available to avoid AsyncStorage deadlocks during onAuthStateChange
		if (session) {
			log("🔍 JWT DEBUG (using passed session):", {
				hasSession: !!session,
				userId: session?.user?.id,
				email: session?.user?.email,
				hasToken: !!session?.access_token,
				tokenLength: session?.access_token?.length,
				paramUserId: userId,
				userIdMatch: session?.user?.id === userId,
			})
		} else {
			logWarn("⚠️ fetchUserOrganisations called without explicitly passed session - relying on getSession fallback")
			const {
				data: { session: fetchedSession },
				error: sessionError,
			} = await supabase().auth.getSession()
			
			log("🔍 JWT DEBUG (fetched session):", {
				hasSession: !!fetchedSession,
				userId: fetchedSession?.user?.id,
				email: fetchedSession?.user?.email,
				hasToken: !!fetchedSession?.access_token,
				tokenLength: fetchedSession?.access_token?.length,
				sessionError: sessionError?.message,
				paramUserId: userId,
				userIdMatch: fetchedSession?.user?.id === userId,
			})

			if (!fetchedSession || !fetchedSession.user) {
				logError("❌ No active session - JWT token missing or expired")
				return {
					organisations: [],
					role: "project_member" as const,
					organisationId: null,
				}
			}
			session = fetchedSession; // Assign to session for subsequent checks
		}

		if (session.user.id !== userId) {
			logError("⚠️ User ID mismatch:", {
				tokenUserId: session.user.id,
				paramUserId: userId,
			})
		}

		// The organisation this user last had open, reopened if the roles still allow it
		const preferredOrgId = await recallCurrentOrganisation(userId)

		// Step 1: Get user roles (replaces user_organisations)
		log("📋 Querying user_roles for userId:", userId)
		const { data: userRoles, error: rolesError, status: rolesStatus } = await supabase()
			.from("user_roles")
			.select("role, scope_type, scope_id")
			.eq("user_id", userId)
			.eq("is_active", true)

		if (rolesError) {
			// Could not ask, as opposed to an answer: use what the last sync left (#332)
			if (isNetworkOrRetryable(rolesError, rolesStatus)) {
				log(`🔌 user_roles unreachable (${rolesError.message}); organisations from the local database`)
				return await rememberAndReturn(userId, await readLocalMembership(userId, { preferredOrgId }))
			}
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
		const { data: orgs, error: orgsError, status: orgsStatus } = await supabase()
			.from("organisations")
			.select("id, name, slug")
			.in("id", orgIds)

		if (orgsError) {
			// The roles came back, only the names did not: keep the fresher roles
			if (isNetworkOrRetryable(orgsError, orgsStatus)) {
				log(`🔌 organisations unreachable (${orgsError.message}); names from the local database`)
				return await rememberAndReturn(userId, await readLocalMembership(userId, { cloudRoles: userRoles, preferredOrgId }))
			}
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

		// Keep the names for the next offline start; nothing else fills that table
		saveOrganisationsLocallyQuietly(orgs ?? [])

		// Step 3: Combine the data
		const result = buildMembership(userRoles, orgs ?? [], preferredOrgId)

		log("✅ Fetched user organisations:", result)

		// Update Cache
		cachedResult = result;
		lastFetchTime = Date.now();

		return await rememberAndReturn(userId, result)
	} catch (error) {
		if (isNetworkOrRetryable(error instanceof Error ? error : null)) {
			log(`🔌 Organisations unreachable (${(error as Error).message}); from the local database`)
			try {
				const preferredOrgId = await recallCurrentOrganisation(userId)
				return await rememberAndReturn(userId, await readLocalMembership(userId, { preferredOrgId }))
			} catch (localError) {
				logError("❌ Local organisations fallback failed:", localError)
			}
		} else {
			logError("❌ Exception in fetchUserOrganisations:", {
				message: error instanceof Error ? error.message : "Unknown error",
				error: error,
				stack: error instanceof Error ? error.stack : undefined,
				userId: userId,
			})
		}
		return {
			organisations: [],
			role: "project_member" as const,
			organisationId: null,
		}
	} finally {
		orgFetchPromise = null;
	}
	})()
	
	orgFetchPromise = currentPromise;
	return currentPromise;
}

// Transform Supabase User to match existing app AuthResponse format
// Fast path: leaves organisations undefined so the redux slice preserves cached ones
const transformSupabaseUser = async (
	user: User,
	session: Session,
): Promise<AuthResponse> => {
	return {
		jwt: session.access_token,
		user: {
			id: user.id, // Keep UUID as string
			email: user.email || "",
			role: "project_member", // Default fallback. Note: Redux authSlice preserves the cached role!
			organisation_id: null,
			created_at: user.created_at,
			// organisations intentionally omitted to preserve offline cache
		},
	}
}

/**
 * The session auth-js keeps in storage, read directly (#310).
 *
 * Asking auth-js instead (`getSession`, `getUser`) refreshes an expired token
 * first, and without a network that means about 26 s of retries before it
 * answers "no session". What is on disk answers two questions at once, offline:
 * who the user is, and whether the server has rejected them. auth-js removes
 * the stored session only when the server rejects the refresh; a refresh that
 * could not reach the server leaves it in place.
 *
 * Reads the client's own storage under its own key, so it can never disagree
 * with auth-js about where the session lives.
 */
export const readStoredSession = async (): Promise<Session | null> => {
	try {
		const auth = supabase().auth as unknown as {
			storageKey?: string
			storage?: { getItem: (key: string) => Promise<string | null> | string | null }
		}
		if (!auth.storageKey || !auth.storage) return null
		const raw = await auth.storage.getItem(auth.storageKey)
		if (!raw) return null
		const stored = typeof raw === "string" ? JSON.parse(raw) : raw
		return stored?.refresh_token && stored?.user?.id ? (stored as Session) : null
	} catch (error) {
		logWarn("⚠️ Could not read the stored session:", error)
		return null
	}
}

/**
 * Whether auth-js will refresh this session before handing it out, using the
 * same 90 s margin it does (EXPIRY_MARGIN_MS).
 */
const needsRefresh = (session: Session): boolean =>
	!session.expires_at || session.expires_at * 1000 - Date.now() < 90_000

/**
 * The signed-in user's id, from the stored session: instant, and right offline
 * whether or not the token is still valid. For local reads that only need to
 * know who is asking. Never use it to decide whether a write may go to the
 * cloud; the sync asks the server (`getUser`) for that.
 */
export const getStoredUserId = async (): Promise<string | null> =>
	(await readStoredSession())?.user?.id ?? null

/**
 * Whether the session is fit to send to the server: auth-js refreshes it first
 * if it has expired (which needs the network), and a refresh that fails leaves
 * no session. For the reconnect sync, which must not start on a token the
 * server would refuse (#310).
 */
export const ensureValidSession = async (): Promise<boolean> => {
	try {
		const { data: { session } } = await supabase().auth.getSession()
		return !!session && !needsRefresh(session)
	} catch {
		return false
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

/** Why a Google sign-in did not go through, so the screen can word it. */
export type GoogleSignInFailure =
	| "not_configured"
	| "offline"
	| "play_services"
	| "in_progress"
	| "google"
	| "supabase"

export class GoogleSignInError extends Error {
	reason: GoogleSignInFailure

	constructor(reason: GoogleSignInFailure, message: string) {
		super(message)
		this.name = "GoogleSignInError"
		this.reason = reason
	}
}

type GoogleSigninModule = typeof import("@react-native-google-signin/google-signin")

/**
 * The Google sign-in library, or null when this binary was built without it.
 * The library looks up its native module as it loads and throws when that is
 * missing, so it is required here, at the tap, rather than imported: a dev
 * client built before it was added would otherwise crash at launch.
 */
const loadGoogleSignin = (): GoogleSigninModule | null => {
	try {
		return require("@react-native-google-signin/google-signin") as GoogleSigninModule
	} catch (error) {
		logWarn("Google sign-in is not in this build:", error instanceof Error ? error.message : error)
		return null
	}
}

/**
 * Sign in with Google (#350): Google's native sign-in gives an ID token, and
 * Supabase signs in with it. From there it is the same as `login`: the same
 * `AuthResponse`, and the auth listener fetches organisations and the sync
 * starts as for a password sign-in. A Google sign-up becomes a normal user on
 * the server (users row, General organisation), and an email that already has
 * an account signs in to that account.
 *
 * Resolves null when the user closes Google's sheet, which is not an error.
 * Throws a `GoogleSignInError` otherwise.
 */
export const signInWithGoogle = async (): Promise<AuthResponse | null> => {
	const config = getGoogleSignInConfig()
	const google = config ? loadGoogleSignin() : null
	if (!config || !google) {
		throw new GoogleSignInError(
			"not_configured",
			"Google sign-in is not set up in this version of the app. Sign in with your email and password.",
		)
	}

	// Made on the server, so offline it says so rather than fail (as Invite does)
	if (await isKnownOffline()) {
		throw new GoogleSignInError(
			"offline",
			"Signing in with Google needs a connection. Try again when you are online.",
		)
	}

	const { GoogleSignin, isErrorWithCode, statusCodes } = google
	let idToken: string | null
	try {
		GoogleSignin.configure({ webClientId: config.webClientId, iosClientId: config.iosClientId })
		// Answers true on iOS; on Android, offers the Play Services update when it can
		await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
		const response = await GoogleSignin.signIn()
		if (response.type === "cancelled") {
			log("Google sign-in closed by the user")
			return null
		}
		idToken = response.data.idToken
	} catch (error) {
		if (isErrorWithCode(error)) {
			if (error.code === statusCodes.SIGN_IN_CANCELLED) return null
			if (error.code === statusCodes.IN_PROGRESS) {
				throw new GoogleSignInError("in_progress", "Google sign-in is already open.")
			}
			if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
				throw new GoogleSignInError(
					"play_services",
					"Google sign-in needs Google Play services, which is missing or out of date on this phone. Update it, or sign in with your email and password.",
				)
			}
		}
		logError("❌ Google sign-in failed:", error)
		throw new GoogleSignInError(
			"google",
			`Google sign-in did not complete${error instanceof Error && error.message ? `: ${error.message}` : "."}`,
		)
	}

	try {
		if (!idToken) {
			logError("❌ Google sign-in returned no ID token")
			throw new GoogleSignInError("google", "Google did not return an ID token, so the app could not sign you in.")
		}

		// iOS nonce: Supabase checks the ID token's nonce on iOS unless "Skip nonce
		// checks" is on for its Google provider. This library's free API (16.1.5)
		// takes no nonce, so iOS needs that switch, or a nonce passed through both
		// calls with a different sign-in API. Not decided yet (#350).
		const { data, error } = await supabase().auth.signInWithIdToken({
			provider: "google",
			token: idToken,
		})

		if (error) {
			logCloudFailure("❌ Supabase rejected the Google ID token:", error, error.status)
			if (isNetworkOrRetryable(error, error.status)) {
				throw new GoogleSignInError(
					"offline",
					"Could not reach the server. Signing in with Google needs a connection. Try again when you are online.",
				)
			}
			throw new GoogleSignInError("supabase", `The server did not accept the Google sign-in (${error.message}).`)
		}

		if (!data.user || !data.session) {
			logError("❌ No user or session returned from Supabase for the Google sign-in")
			throw new GoogleSignInError("supabase", "The server did not return a session for the Google sign-in.")
		}

		const authResponse = await transformSupabaseUser(data.user, data.session)
		log("✅ Login complete for:", data.user.email, "(Google)")
		return authResponse
	} finally {
		// The Supabase session is the one that counts. Forgetting Google's own makes
		// the next "Continue with Google" offer the account picker again.
		GoogleSignin.signOut().catch((err) => logWarn("Google sign-out after sign-in failed:", err))
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
			logCloudFailure("Get session error:", error)
		}

		if (session && session.user) {
			return transformSupabaseUser(session.user, session)
		}

		// Offline, an expired token cannot be refreshed and getSession answers
		// null; the stored session stands until the server rejects it (#310)
		const stored = await readStoredSession()
		return stored ? transformSupabaseUser(stored.user, stored) : null
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
 *
 * Offline (#310): a signed-in user stays signed in until the server rejects
 * the session. auth-js refreshes an expired token before announcing anything,
 * about 26 s of retries per attempt without a network, and then announces
 * INITIAL_SESSION with no session although the stored one is intact. The app
 * waited on a spinner for that and then took it as a sign-out, which left a
 * field phone signed in the evening before on a Login screen it could not use.
 * Now a stored session opens the app at once, a missing session with the
 * stored one still on disk is kept, and auth-js's auto-refresh renews the
 * token when the network returns (TOKEN_REFRESHED). SIGNED_OUT, and a missing
 * session with nothing stored, still sign the user out.
 */
export const setupAuthListener = (
	onAuthStateChange: (authResponse: AuthResponse | null) => void,
	onProfileData?: (orgData: { organisations: UserOrganisation[], role: UserRole, organisationId: string | null }) => void
): (() => void) => {
	let currentUserId: string | null = null;
	let unsubscribed = false;

	const signIn = async (event: string, session: Session) => {
		const isNewSession = currentUserId !== session.user.id;
		const isAuthEvent = event === 'INITIAL_SESSION' || event === 'SIGNED_IN';

		currentUserId = session.user.id;
		const authResponse = await transformSupabaseUser(session.user, session)
		onAuthStateChange(authResponse)

		// Fetch organisations asynchronously to avoid blocking auth success
		if (onProfileData && (isNewSession || isAuthEvent)) {
			const fetchForUserId = session.user.id;
			// Guard against race conditions: only trigger if user hasn't changed during fetch
			const stillCurrent = () => currentUserId === fetchForUserId
			let cloudAnswered = false

			// What the last sync left, at once: the cloud's answer can wait
			// behind a token refresh for half a minute or more offline (#332)
			if (isNewSession) {
				recallCurrentOrganisation(fetchForUserId)
					.then(preferredOrgId => readLocalMembership(fetchForUserId, { preferredOrgId }))
					.then(local => {
						if (!cloudAnswered && stillCurrent() && local.organisations.length > 0) {
							onProfileData(local)
						}
					})
					.catch(err => logWarn("Local organisations read failed", err))
			}

			fetchUserOrganisations(fetchForUserId, session)
				.then(orgData => {
					cloudAnswered = true
					if (stillCurrent()) {
						onProfileData(orgData)
					}
				})
				.catch(err => logError("Async org fetch failed", err))
		}

		// Syncing is exclusively handled by AppSetupProvider reacting to Redux user changes
	}

	const {
		data: { subscription },
	} = supabase().auth.onAuthStateChange(
		async (event: AuthChangeEvent, session: Session | null) => {
			log("Auth state changed:", event, session?.user?.email)

			if (session && session.user) {
				await signIn(event, session)
				return
			}

			// No session. Unless this is a sign-out, check whether auth-js still
			// holds one: if so the refresh could not reach the server, which is
			// not the server saying no.
			if (event !== 'SIGNED_OUT') {
				const stored = await readStoredSession()
				if (stored) {
					log(`🔌 ${event} without a session, but the stored one is intact: the token refresh could not reach the server. Staying signed in offline; it refreshes when the network returns.`)
					if (currentUserId !== stored.user.id) {
						await signIn('STORED_SESSION', stored)
					}
					return
				}
			}

			currentUserId = null;
			onAuthStateChange(null)
		},
	)

	// Open from the stored session now rather than when INITIAL_SESSION comes.
	// That waits for auth-js's lock, which a token refresh or a `getUser` from
	// elsewhere can hold for as long as the network takes to fail. Whichever
	// arrives first signs in; the other finds the same user and changes nothing.
	readStoredSession()
		.then(async (stored) => {
			if (!stored || unsubscribed || currentUserId !== null) return
			log(`🔌 Opening from the stored session${needsRefresh(stored) ? "; auth-js refreshes its token in the background" : ""}`)
			await signIn('STORED_SESSION', stored)
		})
		.catch(err => logWarn("Stored session check failed", err))

	// Return unsubscribe function
	return () => {
		unsubscribed = true
		subscription.unsubscribe()
	}
}

/**
 * Password reset functionality
 */
export const resetPassword = async (email: string): Promise<void> => {
	try {
		const { error } = await supabase().auth.resetPasswordForEmail(email, {
			redirectTo: `${WEBSITE_URL}/reset-password`,
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
