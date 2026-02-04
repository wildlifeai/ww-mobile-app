/**
 * Environment Manager for Runtime Supabase Switching
 *
 * Provides persistent environment selection with AsyncStorage.
 * Supports runtime switching in development builds only.
 *
 * Security: Environment switching is restricted to development builds to prevent
 * accidental production data access during testing.
 */

import AsyncStorage from "@react-native-async-storage/async-storage"
import Constants from "expo-constants"
import {
	SupabaseEnvironment,
	EnvironmentConfig,
	ENVIRONMENT_CONFIGS,
	getDefaultEnvironment,
	isValidEnvironment,
} from "./environments"

/** AsyncStorage key for persisting environment preference */
const STORAGE_KEY = "@supabase_environment"

/**
 * Retrieves the current Supabase environment from AsyncStorage.
 *
 * Fallback Logic:
 * 1. Check AsyncStorage for user preference
 * 2. Validate stored value
 * 3. Fallback to default environment if invalid/missing
 * 4. Handle storage errors gracefully
 *
 * @returns Promise resolving to current environment
 */
export async function getEnvironment(): Promise<SupabaseEnvironment> {
	try {
		const stored = await AsyncStorage.getItem(STORAGE_KEY)

		// Validate stored value
		if (stored && isValidEnvironment(stored)) {
			return stored
		}

		// Fallback to default if invalid or missing
		return getDefaultEnvironment()
	} catch (error) {
		// On storage error, fallback to default
		console.error("Failed to read environment from storage:", error)
		return getDefaultEnvironment()
	}
}

/**
 * Sets the current Supabase environment and persists to AsyncStorage.
 *
 * Security: Only allowed in development builds to prevent accidental
 * production environment access during testing.
 *
 * @param env - Target environment to switch to
 * @throws Error if switching is not allowed or environment is invalid
 */
export async function setEnvironment(env: SupabaseEnvironment): Promise<void> {
	// Check permission
	if (!canSwitchEnvironment()) {
		throw new Error(
			"Environment switching is only allowed in development builds. " +
				"Production and preview builds use fixed environment configurations.",
		)
	}

	// Validate environment
	if (!isValidEnvironment(env)) {
		throw new Error(
			`Invalid environment: '${env}'. ` +
				`Must be one of: 'local', 'cloud-dev', 'cloud-prod'`,
		)
	}

	// Persist to storage
	try {
		await AsyncStorage.setItem(STORAGE_KEY, env)
	} catch (error) {
		throw new Error(
			`Failed to save environment preference: ${
				error instanceof Error ? error.message : "Unknown error"
			}`,
		)
	}
}

/**
 * Retrieves the full configuration for the current environment.
 *
 * Combines getEnvironment() with ENVIRONMENT_CONFIGS lookup to provide
 * all necessary credentials and metadata for Supabase initialization.
 *
 * @returns Promise resolving to environment configuration
 */
export async function getEnvironmentConfig(): Promise<EnvironmentConfig> {
	const env = await getEnvironment()
	return ENVIRONMENT_CONFIGS[env]
}

/**
 * Checks if environment switching is allowed in the current build.
 *
 * Permission Logic:
 * - Development builds: true (allows testing different environments)
 * - Production/preview builds: false (fixed environment for safety)
 *
 * @returns true if switching is allowed, false otherwise
 */
export function canSwitchEnvironment(): boolean {
	const isDevelopment = Constants.expoConfig?.extra?.isDevelopment
	return !!isDevelopment
}

/**
 * Resets environment to default by clearing AsyncStorage.
 *
 * This will cause getEnvironment() to return the default environment
 * based on build type (local for dev, cloud-dev for production).
 *
 * Note: Unlike setEnvironment(), this is allowed in all builds as it's
 * a reset operation, not a switch to a specific environment.
 *
 * @throws Error if storage operation fails
 */
export async function resetToDefault(): Promise<void> {
	try {
		await AsyncStorage.removeItem(STORAGE_KEY)
	} catch (error) {
		throw new Error(
			`Failed to reset environment to default: ${
				error instanceof Error ? error.message : "Unknown error"
			}`,
		)
	}
}
