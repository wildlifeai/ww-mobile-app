/**
 * Supabase Test Client Configuration
 * Creates a Supabase client for integration testing against local backend
 */

import { createClient } from "@supabase/supabase-js"
import type { Database } from "../../src/types/database.types"

// Local Supabase configuration (from .env.local)
const SUPABASE_URL = "http://127.0.0.1:54321"
const SUPABASE_ANON_KEY =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
const SUPABASE_SERVICE_ROLE_KEY =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

/**
 * Test client using anon key (user-level access)
 * Subject to RLS policies
 */
export const testSupabase = createClient<Database>(
	SUPABASE_URL,
	SUPABASE_ANON_KEY,
	{
		auth: {
			autoRefreshToken: false,
			persistSession: false,
			detectSessionInUrl: false,
		},
	},
)

/**
 * Admin client using service role key (bypass RLS)
 * Use ONLY for test setup/teardown
 */
export const adminSupabase = createClient<Database>(
	SUPABASE_URL,
	SUPABASE_SERVICE_ROLE_KEY,
	{
		auth: {
			autoRefreshToken: false,
			persistSession: false,
			detectSessionInUrl: false,
		},
	},
)

/**
 * Helper to sign in test user
 */
export async function signInTestUser(email: string, password: string) {
	const { data, error } = await testSupabase.auth.signInWithPassword({
		email,
		password,
	})

	if (error) {
		throw new Error(`Test user sign in failed: ${error.message}`)
	}

	return data
}

/**
 * Helper to create test user (admin access required)
 */
export async function createTestUser(
	email: string,
	password: string,
	name: string,
) {
	const { data: authData, error: authError } =
		await adminSupabase.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
		})

	if (authError) {
		throw new Error(`Failed to create test user: ${authError.message}`)
	}

	// Create user profile
	const { error: profileError } = await adminSupabase.from("users").insert({
		id: authData.user.id,
		firstname: name.split(" ")[0] || name,
		surname: name.split(" ").slice(1).join(" ") || "User",
		modified_by: authData.user.id,
	})

	if (profileError) {
		throw new Error(`Failed to create user profile: ${profileError.message}`)
	}

	return authData.user
}

/**
 * Helper to create test organisation (admin access required)
 */
export async function createTestOrganisation(
	name: string,
	slug: string,
	createdBy: string,
) {
	const { data, error } = await adminSupabase
		.from("organisations")
		.insert({
			name,
			slug,
			created_by: createdBy,
			is_active: true,
			modified_by: createdBy,
		})
		.select()
		.single()

	if (error) {
		throw new Error(`Failed to create test organisation: ${error.message}`)
	}

	return data
}

/**
 * Helper to assign user to organisation
 */
export async function assignUserToOrganisation(
	userId: string,
	organisationId: string,
) {
	const { error } = await adminSupabase.from("user_roles").insert({
		user_id: userId,
		role: "project_member", // Default role
		scope_type: "organisation",
		scope_id: organisationId,
		is_active: true,
		granted_at: new Date().toISOString(),
		modified_by: userId, // Assuming self-modification or admin
	})

	if (error) {
		throw new Error(`Failed to assign user to organisation: ${error.message}`)
	}
}

/**
 * Helper to grant user role
 */
export async function grantUserRole(
	userId: string,
	role: string,
	scopeType: "global" | "organisation" | "project",
	scopeId?: string,
) {
	const { error } = await adminSupabase.from("user_roles").insert({
		user_id: userId,
		role,
		scope_type: scopeType,
		scope_id: scopeId || null,
		is_active: true,
		granted_at: new Date().toISOString(),
		modified_by: userId, // Assuming self-modification or admin
	})

	if (error) {
		throw new Error(`Failed to grant user role: ${error.message}`)
	}
}

/**
 * Cleanup helper - delete all test data
 */
export async function cleanupTestData() {
	// Order matters due to foreign key constraints
	await adminSupabase
		.from("user_roles")
		.delete()
		.neq("id", "00000000-0000-0000-0000-000000000000")
	await adminSupabase
		.from("organisations")
		.delete()
		.neq("id", "00000000-0000-0000-0000-000000000000")
	await adminSupabase
		.from("users")
		.delete()
		.neq("id", "00000000-0000-0000-0000-000000000000")

	// Clean up auth users
	const { data: authUsers } = await adminSupabase.auth.admin.listUsers()
	if (authUsers?.users) {
		for (const user of authUsers.users) {
			if (user.email?.includes("test-")) {
				await adminSupabase.auth.admin.deleteUser(user.id)
			}
		}
	}
}

/**
 * Check if local Supabase is running
 */
export async function checkLocalSupabase(): Promise<boolean> {
	try {
		const { error } = await testSupabase.from("users").select("count").limit(1)
		return !error
	} catch (error) {
		console.error("❌ Local Supabase not accessible:", error)
		return false
	}
}
