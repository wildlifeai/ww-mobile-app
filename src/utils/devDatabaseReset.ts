/**
 * Development Database Reset Utility
 *
 * Provides convenient methods to reset WatermelonDB during development/testing.
 * Only available when connected to local or cloud dev Supabase instances.
 *
 * Usage:
 * import { resetDatabaseForDev } from '@/utils/devDatabaseReset';
 * await resetDatabaseForDev();
 */

import database from "../database"

/**
 * Reset the WatermelonDB database completely
 * Only available in development mode
 *
 * @returns Promise that resolves when reset is complete
 * @throws Error if not in development mode
 */
export async function resetDatabaseForDev(): Promise<void> {
	if (!__DEV__) {
		throw new Error("Database reset is only available in development mode")
	}

	try {
		console.log("🔄 Starting WatermelonDB reset...")
		await database.write(async () => {
			await database.unsafeResetDatabase()
		})
		console.log("✅ WatermelonDB reset complete")
		console.log("ℹ️  You may need to restart the app or re-authenticate")
	} catch (error) {
		console.error("❌ WatermelonDB reset failed:", error)
		throw error
	}
}

/**
 * Clear all data from the database
 * Alias for resetDatabaseForDev in WatermelonDB context
 */
export async function clearDatabaseDataForDev(): Promise<void> {
	return resetDatabaseForDev()
}

/**
 * Get database status information (for debugging)
 * Safe to use in all modes
 */
export async function getDatabaseStatus(): Promise<{
	isDevelopment: boolean
	supabaseUrl: string
	adapter: string
}> {
	return {
		isDevelopment: __DEV__,
		supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "not set",
		adapter: "WatermelonDB",
	}
}
