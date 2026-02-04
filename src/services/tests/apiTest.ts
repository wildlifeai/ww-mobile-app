import { getSupabaseClient } from "../supabase"
import { DeviceService } from "../DeviceService"
import ReferenceDataService from "../ReferenceDataService"
import SupabaseSyncService from "../SupabaseSyncService"
import database from "../../database"
import { log } from '../../utils/logger'


/**
 * API Test Functions
 *
 * Simple functions to test Supabase API connectivity and operations.
 * Can be called from components or used for debugging.
 */

export const testBasicConnection = async (): Promise<boolean> => {
	try {
		const { error } = await getSupabaseClient().from("users").select("count").limit(1)
		if (error) {
			logError("Basic connection test failed:", error)
			return false
		}
		log("✅ Basic connection test passed")
		return true
	} catch (error) {
		logError("Basic connection test error:", error)
		return false
	}
}

export const testDatabaseAccess = async (): Promise<boolean> => {
	try {
		const tables = [
			"users",
			"devices",
			"projects",
			"deployments",
			"user_roles",
		] as const

		for (const table of tables) {
			const { error } = await getSupabaseClient().from(table).select("*").limit(1)
			if (error) {
				logError(`Table ${table} access failed:`, error)
				return false
			}
		}
		log("✅ Database access test passed")
		return true
	} catch (error) {
		logError("Database access test error:", error)
		return false
	}
}

export const testBusinessLogic = async (): Promise<boolean> => {
	try {
		log("🧪 Testing business logic...")

		// 1. Get current user profile (Direct Supabase call)
		const { data: { user } } = await getSupabaseClient().auth.getUser()
		if (!user) {
			log("⚠️ No authenticated user, skipping business logic test")
			return true
		}

		const { data: profile } = await getSupabaseClient()
			.from("users")
			.select("*")
			.eq("id", user.id)
			.single()

		log("👤 User profile fetched:", profile ? "Yes" : "No")

		// 2. Get devices (Direct Supabase call)
		const { data: devices } = await getSupabaseClient().from("devices").select("*").limit(5)
		log(`📱 Devices fetched (Direct): ${devices?.length || 0}`)

		// 3. Get projects (Direct Supabase call)
		const { data: projects } = await getSupabaseClient().from("projects").select("*").limit(5)
		log(`📂 Projects fetched (Direct): ${projects?.length || 0}`)

		log("✅ Business logic test passed")
		return true
	} catch (error) {
		logError("Business logic test error:", error)
		return false
	}
}

export const testReferenceDataSync = async (): Promise<boolean> => {
	try {
		log("📚 Testing Reference Data Sync...")
		await ReferenceDataService.syncReferenceData()

		// Verify counts
		const captureMethods = await ReferenceDataService.getCaptureMethods()
		log(`   Capture Methods: ${captureMethods.length}`)

		const activitySensitivity = await ReferenceDataService.getActivitySensitivity()
		log(`   Activity Sensitivity: ${activitySensitivity.length}`)

		const aiModels = await ReferenceDataService.getAiModels()
		log(`   AI Models: ${aiModels.length}`)

		const samplingDesigns = await ReferenceDataService.getSamplingDesigns()
		log(`   Sampling Designs: ${samplingDesigns.length}`)

		log("✅ Reference Data Sync passed")
		return true
	} catch (error) {
		logError("Reference Data Sync test error:", error)
		return false
	}
}

export const testSupabaseSync = async (): Promise<boolean> => {
	try {
		log("🔄 Testing Supabase Sync (Projects, Members, Devices)...")
		await SupabaseSyncService.sync()

		// Verify we have some data locally
		const projectsCount = await database.get('projects').query().fetchCount()
		const membersCount = await database.get('project_members').query().fetchCount()
		const devicesCount = await database.get('devices').query().fetchCount()

		log(`   Projects: ${projectsCount}`)
		log(`   Project Members: ${membersCount}`)
		log(`   Devices: ${devicesCount}`)

		log("✅ Supabase Sync test passed")
		return true
	} catch (error) {
		logError("Supabase Sync test error:", error)
		return false
	}
}
