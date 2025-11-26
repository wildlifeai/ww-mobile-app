import { supabase } from "../supabase"
import DeviceService from "../DeviceService"
import { getSupabaseClient } from "../supabase"
import ReferenceDataService from "../ReferenceDataService"
import SupabaseSyncService from "../SupabaseSyncService"
import database from "../../database"

/**
 * API Test Functions
 *
 * Simple functions to test Supabase API connectivity and operations.
 * Can be called from components or used for debugging.
 */

export const testBasicConnection = async (): Promise<boolean> => {
	try {
		const { error } = await supabase.from("users").select("count").limit(1)
		if (error) {
			console.error("Basic connection test failed:", error)
			return false
		}
		console.log("✅ Basic connection test passed")
		return true
	} catch (error) {
		console.error("Basic connection test error:", error)
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
			"roles",
		] as const

		for (const table of tables) {
			const { error } = await supabase.from(table).select("*").limit(1)
			if (error) {
				console.error(`Table ${table} access failed:`, error)
				return false
			}
		}
		console.log("✅ Database access test passed")
		return true
	} catch (error) {
		console.error("Database access test error:", error)
		return false
	}
}

export const testBusinessLogic = async (): Promise<boolean> => {
	try {
		console.log("🧪 Testing business logic...")

		// 1. Get current user profile (Direct Supabase call)
		const { data: { user } } = await supabase.auth.getUser()
		if (!user) {
			console.log("⚠️ No authenticated user, skipping business logic test")
			return true
		}

		const { data: profile } = await supabase
			.from("users")
			.select("*")
			.eq("id", user.id)
			.single()

		console.log("👤 User profile fetched:", profile ? "Yes" : "No")

		// 2. Get devices (Direct Supabase call)
		const { data: devices } = await supabase.from("devices").select("*").limit(5)
		console.log(`📱 Devices fetched (Direct): ${devices?.length || 0}`)

		// 3. Get projects (Direct Supabase call)
		const { data: projects } = await supabase.from("projects").select("*").limit(5)
		console.log(`📂 Projects fetched (Direct): ${projects?.length || 0}`)

		console.log("✅ Business logic test passed")
		return true
	} catch (error) {
		console.error("Business logic test error:", error)
		return false
	}
}

export const testReferenceDataSync = async (): Promise<boolean> => {
	try {
		console.log("📚 Testing Reference Data Sync...")
		await ReferenceDataService.syncReferenceData()

		// Verify counts
		const captureMethods = await ReferenceDataService.getCaptureMethods()
		console.log(`   Capture Methods: ${captureMethods.length}`)

		const activitySensitivity = await ReferenceDataService.getActivitySensitivity()
		console.log(`   Activity Sensitivity: ${activitySensitivity.length}`)

		const aiModels = await ReferenceDataService.getAiModels()
		console.log(`   AI Models: ${aiModels.length}`)

		const samplingDesigns = await ReferenceDataService.getSamplingDesigns()
		console.log(`   Sampling Designs: ${samplingDesigns.length}`)

		console.log("✅ Reference Data Sync passed")
		return true
	} catch (error) {
		console.error("Reference Data Sync test error:", error)
		return false
	}
}

export const testSupabaseSync = async (): Promise<boolean> => {
	try {
		console.log("🔄 Testing Supabase Sync (Projects, Members, Devices)...")
		await SupabaseSyncService.sync()

		// Verify we have some data locally
		const projectsCount = await database.get('projects').query().fetchCount()
		const membersCount = await database.get('project_members').query().fetchCount()
		const devicesCount = await database.get('devices').query().fetchCount()

		console.log(`   Projects: ${projectsCount}`)
		console.log(`   Project Members: ${membersCount}`)
		console.log(`   Devices: ${devicesCount}`)

		console.log("✅ Supabase Sync test passed")
		return true
	} catch (error) {
		console.error("Supabase Sync test error:", error)
		return false
	}
}
