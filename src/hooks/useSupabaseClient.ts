/**
 * useSupabaseClient Hook
 *
 * React hook for accessing the Supabase client with automatic updates
 * when the environment switches.
 *
 * This hook:
 * - Ensures client is initialized before first use
 * - Automatically updates when environment changes
 * - Provides type-safe access to Supabase client
 * - Handles cleanup on unmount
 *
 * @example
 * ```typescript
 * function ProjectsScreen() {
 *   const client = useSupabaseClient();
 *
 *   const fetchProjects = async () => {
 *     const { data } = await client.from('projects').select();
 *     return data;
 *   };
 *
 *   // ...
 * }
 * ```
 */

import { useState, useEffect } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../types/database.types"
import {
	getSupabaseClient,
	initializeSupabaseClient,
	onSupabaseClientChange,
} from "../services/supabase"
import { logError } from '../utils/logger'


/**
 * Hook to access the Supabase client with automatic environment switching support.
 *
 * Features:
 * - Lazy initialization on first mount
 * - Automatic re-render when environment changes
 * - Type-safe client access
 * - Proper cleanup on unmount
 *
 * @returns Supabase client instance
 * @throws Error if client initialization fails
 */
export function useSupabaseClient(): SupabaseClient<Database> {
	// Initialize state with current client (or null if not initialized)
	const [client, setClient] = useState<SupabaseClient<Database> | null>(() => {
		try {
			return getSupabaseClient()
		} catch {
			// Client not initialized yet, will be initialized in useEffect
			return null
		}
	})

	useEffect(() => {
		// Initialize client if not already initialized
		if (!client) {
			initializeSupabaseClient()
				.then((initializedClient) => {
					setClient(initializedClient)
				})
				.catch((error) => {
					logError("Failed to initialize Supabase client:", error)
					// Rethrow to let error boundary handle it
					throw error
				})
		}

		// Subscribe to client changes
		const unsubscribe = onSupabaseClientChange(() => {
			try {
				const newClient = getSupabaseClient()
				setClient(newClient)
			} catch (error) {
				logError("Failed to update Supabase client:", error)
			}
		})

		// Cleanup subscription on unmount
		return () => unsubscribe()
	}, [client])

	// Return current client (throw if still not initialized)
	if (!client) {
		throw new Error(
			"Supabase client is initializing. Wrap component in Suspense or check client !== null.",
		)
	}

	return client
}

/**
 * Hook variant that returns null during initialization instead of throwing.
 *
 * Use this when you need to handle the loading state explicitly without Suspense.
 *
 * @returns Supabase client instance or null if initializing
 *
 * @example
 * ```typescript
 * function ProjectsScreen() {
 *   const client = useSupabaseClientOptional();
 *
 *   if (!client) {
 *     return <LoadingSpinner />;
 *   }
 *
 *   // Use client safely
 * }
 * ```
 */
export function useSupabaseClientOptional(): SupabaseClient<Database> | null {
	const [client, setClient] = useState<SupabaseClient<Database> | null>(() => {
		try {
			return getSupabaseClient()
		} catch {
			return null
		}
	})

	useEffect(() => {
		// Initialize client if not already initialized
		if (!client) {
			initializeSupabaseClient()
				.then((initializedClient) => {
					setClient(initializedClient)
				})
				.catch((error) => {
					logError("Failed to initialize Supabase client:", error)
				})
		}

		// Subscribe to client changes
		const unsubscribe = onSupabaseClientChange(() => {
			try {
				const newClient = getSupabaseClient()
				setClient(newClient)
			} catch (error) {
				logError("Failed to update Supabase client:", error)
				setClient(null)
			}
		})

		// Cleanup subscription on unmount
		return () => unsubscribe()
	}, [client])

	return client
}
