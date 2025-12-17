/**
 * useSupabaseEnvironment React Hook
 *
 * React hook for managing Supabase environment with proper state handling.
 * Provides loading states, error handling, and automatic re-rendering on changes.
 *
 * Usage:
 * ```tsx
 * const { environment, config, isLoading, error, setEnvironment, canSwitch } = useSupabaseEnvironment();
 * ```
 */

import { useState, useEffect, useCallback } from "react"
import { SupabaseEnvironment, EnvironmentConfig } from "../environments"
import {
	getEnvironment,
	setEnvironment as setEnvironmentPersist,
	getEnvironmentConfig,
	canSwitchEnvironment,
} from "../EnvironmentManager"

export interface UseSupabaseEnvironmentResult {
	/** Current environment identifier */
	environment: SupabaseEnvironment | null
	/** Full configuration for current environment */
	config: EnvironmentConfig | null
	/** Loading state during async operations */
	isLoading: boolean
	/** Error from failed operations */
	error: Error | null
	/** Function to change environment (only works in dev builds) */
	setEnvironment: (env: SupabaseEnvironment) => Promise<void>
	/** Whether environment switching is allowed in current build */
	canSwitch: boolean
}

/**
 * React hook for Supabase environment management.
 *
 * Features:
 * - Loads environment and config on mount
 * - Provides loading states during async operations
 * - Handles errors gracefully with user-friendly messages
 * - Re-renders component when environment changes
 * - Stable function references to prevent unnecessary re-renders
 *
 * @returns Hook state and setter function
 */
export function useSupabaseEnvironment(): UseSupabaseEnvironmentResult {
	const [environment, setEnvironmentState] =
		useState<SupabaseEnvironment | null>(null)
	const [config, setConfig] = useState<EnvironmentConfig | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)

	// Load environment on mount
	useEffect(() => {
		let isMounted = true

		const loadEnvironment = async () => {
			setIsLoading(true)
			try {
				const env = await getEnvironment()
				const envConfig = await getEnvironmentConfig()

				if (isMounted) {
					setEnvironmentState(env)
					setConfig(envConfig)
					setError(null)
				}
			} catch (err) {
				if (isMounted) {
					setError(
						err instanceof Error
							? err
							: new Error("Failed to load environment"),
					)
				}
			} finally {
				if (isMounted) {
					setIsLoading(false)
				}
			}
		}

		loadEnvironment()

		return () => {
			isMounted = false
		}
	}, [])

	/**
	 * Sets new environment and updates state.
	 *
	 * This function is memoized with useCallback to provide stable reference
	 * and prevent unnecessary re-renders in consuming components.
	 */
	const setEnvironment = useCallback(async (env: SupabaseEnvironment) => {
		setIsLoading(true)
		setError(null)

		try {
			// Persist to AsyncStorage
			await setEnvironmentPersist(env)

			// Reload config for new environment
			const newConfig = await getEnvironmentConfig()

			// Update state
			setEnvironmentState(env)
			setConfig(newConfig)
		} catch (err) {
			setError(
				err instanceof Error ? err : new Error("Failed to set environment"),
			)
		} finally {
			setIsLoading(false)
		}
	}, [])

	return {
		environment,
		config,
		isLoading,
		error,
		setEnvironment,
		canSwitch: canSwitchEnvironment(),
	}
}
