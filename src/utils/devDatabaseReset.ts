/**
 * Development Database Reset Utility
 *
 * Provides convenient methods to reset SQLite database during development/testing.
 * Only available when connected to local or cloud dev Supabase instances.
 *
 * Usage:
 * import { resetDatabaseForDev } from '@/utils/devDatabaseReset';
 * await resetDatabaseForDev();
 */

import { getDatabaseService } from "../services/offline/DatabaseService"

/**
 * Reset the SQLite database completely (drops and recreates all tables)
 * Only available in development mode
 *
 * @returns Promise that resolves when reset is complete
 * @throws Error if not in development mode or if database is not initialized
 */
export async function resetDatabaseForDev(): Promise<void> {
	if (!__DEV__) {
		throw new Error("Database reset is only available in development mode")
	}

	try {
		const dbService = getDatabaseService()

		console.log("🔄 Starting database reset...")
		await dbService.resetDatabase()
		console.log("✅ Database reset complete")
		console.log("ℹ️  You may need to restart the app or re-authenticate")
	} catch (error) {
		console.error("❌ Database reset failed:", error)
		throw error
	}
}

/**
 * Clear all data from the database without dropping tables
 * Preserves schema and indexes
 * Only available in development mode
 *
 * @returns Promise that resolves when clear is complete
 * @throws Error if not in development mode or if database is not initialized
 */
export async function clearDatabaseDataForDev(): Promise<void> {
	if (!__DEV__) {
		throw new Error("Database clear is only available in development mode")
	}

	try {
		const dbService = getDatabaseService()

		console.log("🔄 Starting database clear...")
		await dbService.clearAllData()
		console.log("✅ Database cleared complete")
		console.log("ℹ️  You may need to restart the app or re-authenticate")
	} catch (error) {
		console.error("❌ Database clear failed:", error)
		throw error
	}
}

/**
 * Get database status information (for debugging)
 * Safe to use in all modes
 */
export async function getDatabaseStatus(): Promise<{
	isDevelopment: boolean
	supabaseUrl: string
	version: number
}> {
	const dbService = getDatabaseService()

	return {
		isDevelopment: __DEV__,
		supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "not set",
		version: await dbService.getDatabaseVersion(),
	}
}
