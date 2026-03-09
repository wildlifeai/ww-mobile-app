/**
 * Environment Configuration System for Runtime Supabase Switching
 *
 * Provides type-safe configuration for local/cloud-dev/cloud-prod Supabase environments.
 * Supports runtime switching for development and testing workflows.
 *
 * WSL Note: Local Supabase URL uses WSL host IP (172.21.24.107) for physical device testing.
 * When running on emulator, localhost works fine. On physical device, use host IP.
 */

import Constants from "expo-constants"

export type SupabaseEnvironment = "local" | "cloud-dev" | "cloud-staging" | "cloud-prod"

export interface EnvironmentConfig {
	supabaseUrl: string
	supabaseAnonKey: string
	displayName: string
	description: string
	isProduction: boolean
}

/**
 * Environment-specific Supabase configurations
 *
 * Security Note: Local keys are non-sensitive development credentials.
 * Cloud-dev and cloud-prod keys are loaded from EAS secrets at build time
 * via Constants.expoConfig.extra (set in app.config.ts from process.env).
 * For local development, keys come from the .env file.
 */
export const ENVIRONMENT_CONFIGS: Record<
	SupabaseEnvironment,
	EnvironmentConfig
> = {
	local: {
		supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "http://192.168.1.239:54321",
		supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "YOUR_LOCAL_ANON_KEY",
		displayName: "Local Development",
		description: "WSL Supabase (LAN: 192.168.1.239:54321)",
		isProduction: false,
	},
	"cloud-dev": {
		supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl || "",
		supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey || "",
		displayName: "Cloud Development",
		description: "Dev Supabase instance (active development, may break)",
		isProduction: false,
	},
	"cloud-staging": {
		supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_STAGING_URL || Constants.expoConfig?.extra?.supabaseStagingUrl || "",
		supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_STAGING_ANON_KEY || Constants.expoConfig?.extra?.supabaseStagingAnonKey || "",
		displayName: "Cloud Staging",
		description: "Staging Supabase instance (pre-production validation)",
		isProduction: false,
	},
	"cloud-prod": {
		supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_PROD_URL || Constants.expoConfig?.extra?.supabaseProdUrl || "",
		supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_PROD_ANON_KEY || Constants.expoConfig?.extra?.supabaseProdAnonKey || "",
		displayName: "Cloud Production",
		description:
			"Production Supabase instance (requires production credentials)",
		isProduction: true,
	},
}

/**
 * Determines the default Supabase environment based on build configuration.
 *
 * Logic:
 * - Development builds (__DEV__ or APP_VARIANT=development): defaults to 'local'
 * - Production/preview builds: defaults to 'cloud-prod'
 * - Can be overridden at runtime via EnvironmentManager
 *
 * @returns Default environment for current build type
 */
export function getDefaultEnvironment(): SupabaseEnvironment {
	// Check for explicit environment override from direct env var or app config
	const envOverride = process.env.EXPO_PUBLIC_SUPABASE_ENV || Constants.expoConfig?.extra?.supabaseEnv
	if (envOverride && isValidEnvironment(envOverride)) {
		return envOverride
	}

	// Development builds default to cloud-dev
	const isDevelopment = __DEV__ || Constants.expoConfig?.extra?.isDevelopment

	// Default to cloud-dev for DEV builds, otherwise cloud-prod
	return isDevelopment ? "cloud-dev" : "cloud-prod"
}

/**
 * Type guard to validate environment string values
 *
 * @param env - String value to validate
 * @returns true if env is a valid SupabaseEnvironment
 */
export function isValidEnvironment(env: string): env is SupabaseEnvironment {
	return env === "local" || env === "cloud-dev" || env === "cloud-staging" || env === "cloud-prod"
}

/**
 * Retrieves configuration for specified environment with validation
 *
 * @param env - Target Supabase environment
 * @returns Environment configuration object
 * @throws Error if environment is invalid or configuration is incomplete
 */
export function getEnvironmentConfig(
	env: SupabaseEnvironment,
): EnvironmentConfig {
	const config = ENVIRONMENT_CONFIGS[env]

	// Validate required fields are present
	if (!config.supabaseUrl || !config.supabaseAnonKey) {
		throw new Error(
			`Incomplete configuration for environment '${env}'. ` +
			`Missing: ${!config.supabaseUrl ? "supabaseUrl" : ""} ${!config.supabaseAnonKey ? "supabaseAnonKey" : ""
				}`.trim(),
		)
	}

	return config
}

/**
 * Validates that an environment's configuration is complete and usable
 *
 * @param env - Environment to validate
 * @returns true if configuration is complete, false otherwise
 */
export function isEnvironmentConfigured(env: SupabaseEnvironment): boolean {
	try {
		const config = ENVIRONMENT_CONFIGS[env]
		return !!(config.supabaseUrl && config.supabaseAnonKey)
	} catch {
		return false
	}
}

/**
 * Gets list of all available (configured) environments
 *
 * @returns Array of configured environment identifiers
 */
export function getAvailableEnvironments(): SupabaseEnvironment[] {
	return (Object.keys(ENVIRONMENT_CONFIGS) as SupabaseEnvironment[]).filter(
		(env) => isEnvironmentConfigured(env),
	)
}

/**
 * Development utility: Get human-readable environment info for debugging
 *
 * @param env - Environment to describe
 * @returns Formatted string with environment details (safe for logging)
 */
export function getEnvironmentDebugInfo(env: SupabaseEnvironment): string {
	const config = ENVIRONMENT_CONFIGS[env]
	const projectRef =
		config.supabaseUrl.split("//")[1]?.split(".")[0] || "localhost"

	return [
		`Environment: ${config.displayName}`,
		`Description: ${config.description}`,
		`URL: ${config.supabaseUrl}`,
		`Project: ${projectRef}`,
		`Production: ${config.isProduction}`,
		`Configured: ${isEnvironmentConfigured(env)}`,
	].join("\n")
}
