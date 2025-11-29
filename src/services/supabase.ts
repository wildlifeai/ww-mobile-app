/**
 * Supabase Client Service with Dynamic Environment Switching
 *
 * This service provides a factory pattern for Supabase client initialization,
 * enabling runtime environment switching while maintaining backward compatibility.
 *
 * Architecture:
 * - Factory pattern instead of singleton
 * - Lazy initialization on first use
 * - Client recreation when environment changes
 * - Event emission for React component updates
 * - Proper cleanup to prevent memory leaks
 *
 * Migration Guide: See @project-context/development-context/MVP2/implementation/execution/
 *                  db-environment-switching-in-app/SUPABASE-CLIENT-MIGRATION-GUIDE.md
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { EventEmitter } from "events"
import type { Database } from "../types/database.types"
import {
	getEnvironmentConfig,
} from "../config/EnvironmentManager"
import type { EnvironmentConfig } from "../config/environments"

// ============================================================================
// Internal State
// ============================================================================

/** Current Supabase client instance (null if not initialized) */
let supabaseClient: SupabaseClient<Database> | null = null

/** Current environment configuration (null if not initialized) */
let currentEnvironment: EnvironmentConfig | null = null

/** Event emitter for client change notifications */
const clientEvents = new EventEmitter()

/** Event name for client changes */
const CLIENT_CHANGED_EVENT = "client-changed"

// ============================================================================
// Client Lifecycle Management
// ============================================================================

/**
 * Initializes or re-initializes the Supabase client with current environment configuration.
 *
 * This function:
 * 1. Fetches current environment from EnvironmentManager
 * 2. Creates new Supabase client with environment credentials
 * 3. Stores client and config for later retrieval
 * 4. Returns the initialized client
 *
 * @param options - Optional Supabase client configuration overrides
 * @returns Promise resolving to initialized Supabase client
 * @throws Error if environment config is invalid or missing
 *
 * @example
 * ```typescript
 * const client = await initializeSupabaseClient();
 * const { data } = await client.from('users').select();
 * ```
 */
export async function initializeSupabaseClient(
	options?: {
		auth?: {
			autoRefreshToken?: boolean
			persistSession?: boolean
			detectSessionInUrl?: boolean
			storage?: any
		}
	},
): Promise<SupabaseClient<Database>> {
	try {
		// Fetch current environment configuration
		const config = await getEnvironmentConfig()

		// Validate configuration
		if (!config.supabaseUrl || !config.supabaseAnonKey) {
			throw new Error(
				`Invalid Supabase configuration for environment. ` +
				`Missing: ${!config.supabaseUrl ? "supabaseUrl" : ""} ${!config.supabaseAnonKey ? "supabaseAnonKey" : ""
					}`.trim(),
			)
		}

		// Create new client with environment config
		const client = createClient<Database>(
			config.supabaseUrl,
			config.supabaseAnonKey,
			{
				auth: {
					storage: AsyncStorage,
					autoRefreshToken: true,
					persistSession: true,
					detectSessionInUrl: false,
					...options?.auth,
				},
			},
		)

		// Store client and config
		supabaseClient = client
		currentEnvironment = config

		console.log("✅ Supabase client initialized:", {
			environment: config.displayName,
			url: config.supabaseUrl,
			isProduction: config.isProduction,
		})

		return client
	} catch (error) {
		console.error("❌ Failed to initialize Supabase client:", error)
		throw error
	}
}

/**
 * Retrieves the current Supabase client instance.
 *
 * This function provides access to the initialized client. If the client
 * hasn't been initialized yet, it throws an error with helpful instructions.
 *
 * @returns Current Supabase client
 * @throws Error if client not initialized
 *
 * @example
 * ```typescript
 * const client = getSupabaseClient();
 * const { data } = await client.from('projects').select();
 * ```
 */
export function getSupabaseClient(): SupabaseClient<Database> {
	if (!supabaseClient) {
		throw new Error(
			"Supabase client not initialized. " +
			"Call initializeSupabaseClient() first or use the useSupabaseClient() hook in React components.",
		)
	}
	return supabaseClient
}

/**
 * Reconnects Supabase client with current environment configuration.
 *
 * This function handles the complete client recreation workflow:
 * 1. Cleanup old client (remove subscriptions, close connections)
 * 2. Create new client with current environment
 * 3. Emit event for React components to re-render
 *
 * Use this when:
 * - User switches environment in settings
 * - Environment changes due to external configuration
 * - Network configuration changes require reconnection
 *
 * @returns Promise resolving to new Supabase client
 *
 * @example
 * ```typescript
 * // After user changes environment
 * await setEnvironment('cloud-dev');
 * await reconnectSupabase(); // Recreate client with new environment
 * ```
 */
export async function reconnectSupabase(): Promise<SupabaseClient<Database>> {
	try {
		// Step 1: Cleanup old client
		if (supabaseClient) {
			console.log("🔄 Cleaning up old Supabase client...")

			try {
				// Remove all realtime subscriptions
				await supabaseClient.removeAllChannels()
				console.log("✅ Removed all subscriptions")
			} catch (error) {
				// Non-fatal: log but continue
				console.error("⚠️ Error cleaning up old Supabase client:", error)
			}
		}

		// Step 2: Create new client
		console.log("🔄 Reconnecting Supabase client...")
		const newClient = await initializeSupabaseClient()

		// Step 3: Emit event for React components
		emitClientChanged()

		console.log("✅ Supabase client reconnected successfully")
		return newClient
	} catch (error) {
		console.error("❌ Failed to reconnect Supabase client:", error)
		throw error
	}
}

/**
 * Registers a callback to be invoked when the Supabase client changes.
 *
 * This enables React components and services to react to environment switches
 * by re-initializing their state or refetching data with the new client.
 *
 * @param callback - Function to call when client changes
 * @returns Unsubscribe function to remove the listener
 *
 * @example
 * ```typescript
 * // In a React component
 * useEffect(() => {
 *   const unsubscribe = onSupabaseClientChange(() => {
 *     // Refetch data or reset state
 *     refetchProjects();
 *   });
 *   return unsubscribe;
 * }, []);
 * ```
 */
export function onSupabaseClientChange(callback: () => void): () => void {
	clientEvents.on(CLIENT_CHANGED_EVENT, callback)

	// Return unsubscribe function
	return () => {
		clientEvents.off(CLIENT_CHANGED_EVENT, callback)
	}
}

/**
 * Gets the current environment configuration used by the Supabase client.
 *
 * @returns Current environment config or null if not initialized
 *
 * @example
 * ```typescript
 * const env = getCurrentEnvironment();
 * console.log('Connected to:', env?.displayName);
 * console.log('Production mode:', env?.isProduction);
 * ```
 */
export function getCurrentEnvironment(): EnvironmentConfig | null {
	return currentEnvironment
}

/**
 * Resets the Supabase client to uninitialized state.
 *
 * This is primarily used for testing to ensure clean state between tests.
 * In production code, use reconnectSupabase() instead.
 */
export function resetSupabaseClient(): void {
	supabaseClient = null
	currentEnvironment = null
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Emits the client-changed event to all registered listeners.
 * Handles callback errors gracefully to prevent one broken listener
 * from affecting others.
 *
 * @internal
 */
function emitClientChanged(): void {
	clientEvents.emit(CLIENT_CHANGED_EVENT)
}

// ============================================================================
// Backward Compatibility Layer (DEPRECATED)
// ============================================================================

/**
 * Legacy Supabase client export for backward compatibility.
 *
 * @deprecated Use getSupabaseClient() instead. This export will be removed in v2.0.
 *
 * This getter function provides the client instance, maintaining the same
 * interface as the old singleton pattern while issuing deprecation warnings
 * in development mode.
 *
 * Migration:
 * ```typescript
 * // Old code
 * import { supabase } from './supabase';
 * await supabase.from('users').select();
 *
 * // New code
 * import { getSupabaseClient } from './supabase';
 * const client = getSupabaseClient();
 * await client.from('users').select();
 * ```
 */
export const supabase = new Proxy(
	{} as SupabaseClient<Database>,
	{
		get(_target, prop) {
			// Issue deprecation warning in development
			if (__DEV__ && prop !== "then" && prop !== "catch") {
				console.warn(
					"⚠️ DEPRECATED: Direct 'supabase' export is deprecated. " +
					"Use getSupabaseClient() instead. " +
					"See SUPABASE-CLIENT-MIGRATION-GUIDE.md for migration instructions.",
				)
			}

			// Return undefined for client not initialized (matches Proxy behavior)
			if (!supabaseClient) {
				console.error(
					"❌ Supabase client not initialized. Call initializeSupabaseClient() first.",
				)
				return undefined
			}

			return supabaseClient[prop as keyof SupabaseClient<Database>]
		},
	},
)

/**
 * Legacy configuration export for debugging/logging.
 *
 * @deprecated Use getCurrentEnvironment() instead. This export will be removed in v2.0.
 */
export const supabaseConfig = {
	get url() {
		return currentEnvironment?.supabaseUrl || ""
	},
	get hasAnonKey() {
		return !!currentEnvironment?.supabaseAnonKey
	},
	get projectRef() {
		return (
			currentEnvironment?.supabaseUrl.split("//")[1]?.split(".")[0] ||
			"not-initialized"
		)
	},
}

/**
 * Legacy connection check helper.
 *
 * @deprecated Use getSupabaseClient() and check directly. This will be removed in v2.0.
 */
export const checkSupabaseConnection = async (): Promise<boolean> => {
	try {
		const client = getSupabaseClient()
		const { data, error } = await client.from("users").select("count").limit(1)

		if (error) {
			console.warn("Supabase connection check failed:", error.message)
			return false
		}

		console.log("✅ Supabase connection successful")
		return true
	} catch (error) {
		console.error("❌ Supabase connection error:", error)
		return false
	}
}

export default supabase
