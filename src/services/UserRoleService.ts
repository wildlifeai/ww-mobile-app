/**
 * User Role Management Service
 *
 * Handles role management including:
 * - Fetching organization user pool
 * - Adding members to projects (assigning project roles)
 * - Changing member roles
 * - Removing members from projects (revoking roles)
 * - Getting project member list
 *
 * Uses the `user_roles` table with `scope_type` and `scope_id`.
 */

import { getSupabaseClient } from "./supabase"
import type { Database } from "../types/database.types"

type UserRoleRow = Database["public"]["Tables"]["user_roles"]["Row"]

export type ProjectRole = "project_admin" | "project_member" | "viewer"

export interface OrganizationUser {
	id: string
	name: string
	email: string
	roles: any
	is_in_project: boolean
}

export interface ProjectMember {
	id: string // User ID
	name: string
	email: string
	role: string // ProjectRole
	granted_at: string
	granted_by: string
	granted_by_name?: string
}

export interface AddMemberRequest {
	project_id: string
	user_id: string
	role: ProjectRole
	granted_by: string
}

export interface UpdateRoleRequest {
	project_id: string
	user_id: string
	new_role: ProjectRole
	updated_by: string
}

export interface RemoveMemberRequest {
	project_id: string
	user_id: string
	removed_by: string
}

export interface MemberOperationResponse {
	success: boolean
	user_id: string
	project_id: string
	role?: ProjectRole
	old_role?: ProjectRole
	new_role?: ProjectRole
	removed_role?: ProjectRole
	error?: string
}

/**
 * Fetch all users in an organization (user pool)
 *
 * Security: Only project admins can view organization user pool
 * Returns: All users in the org with their roles
 */
export const getOrganizationUsers = async (
	organisationId: string,
	requestingUserId: string,
): Promise<OrganizationUser[]> => {
	try {
		// Use the secure RPC to fetch organization users
		// This bypasses RLS on user_roles/users tables which are restricted to own-data only
		const { data: users, error } = await getSupabaseClient()
			.rpc("get_organisation_users", {
				p_organisation_id: organisationId,
				p_requesting_user_id: requestingUserId
			})

		if (error) {
			console.error("❌ Error fetching organization users:", error)
			throw new Error(error.message)
		}

		// Transform to OrganizationUser format
		// The RPC returns { id, name, email, roles: [...], is_in_project }
		const transformedUsers = (users as any[]).map((u) => ({
			id: u.id,
			name: u.name,
			email: u.email,
			roles: u.roles.map((r: any) => r.role), // Extract role names
			is_in_project: u.is_in_project
		}))

		console.log(`✅ Fetched ${transformedUsers.length} users from organization ${organisationId}`)
		return transformedUsers as OrganizationUser[]
	} catch (error) {
		console.error("❌ Exception fetching organization users:", error)
		throw error
	}
}

/**
 * Get all members of a project
 */
export const getProjectMembers = async (
	projectId: string,
	requestingUserId: string,
): Promise<ProjectMember[]> => {
	try {
		// Query user_roles directly
		const { data: roles, error } = await getSupabaseClient()
			.from("user_roles")
			.select(`
				user_id,
				role,
				granted_at,
				granted_by,
				users:user_id (
					id,
					email,
					firstname,
					surname
				)
			`)
			.eq("scope_type", "project")
			.eq("scope_id", projectId)
			.eq("is_active", true)

		if (error) {
			console.error("❌ Error fetching project members:", error)
			throw new Error(error.message)
		}

		const members = roles.map((r: any) => ({
			id: r.users.id,
			name: `${r.users.firstname} ${r.users.surname}`.trim(),
			email: r.users.email,
			role: r.role,
			granted_at: r.granted_at,
			granted_by: r.granted_by,
			granted_by_name: "Unknown" // We'd need another join or lookup to get this
		}))

		console.log(`✅ Fetched ${members.length} members from project ${projectId}`)
		return members
	} catch (error) {
		console.error("❌ Exception fetching project members:", error)
		throw error
	}
}

/**
 * Add a user to a project with specified role
 */
export const addProjectMember = async (
	request: AddMemberRequest,
): Promise<MemberOperationResponse> => {
	try {
		console.log("➕ Adding project member:", request)

		// Insert into user_roles
		const { data, error } = await getSupabaseClient()
			.from("user_roles")
			.insert({
				user_id: request.user_id,
				role: request.role,
				scope_type: "project",
				scope_id: request.project_id,
				granted_by: request.granted_by,
				modified_by: request.granted_by,
				is_active: true
			})
			.select()
			.single()

		if (error) {
			console.error("❌ Error adding project member:", error)
			return {
				success: false,
				user_id: request.user_id,
				project_id: request.project_id,
				error: error.message,
			}
		}

		console.log("✅ Successfully added project member:", data)
		return {
			success: true,
			user_id: request.user_id,
			project_id: request.project_id,
			role: request.role,
			new_role: request.role
		}
	} catch (error: any) {
		console.error("❌ Exception adding project member:", error)
		return {
			success: false,
			user_id: request.user_id,
			project_id: request.project_id,
			error: error.message || "Unknown error occurred",
		}
	}
}

/**
 * Update a project member's role
 */
export const updateProjectMemberRole = async (
	request: UpdateRoleRequest,
): Promise<MemberOperationResponse> => {
	try {
		console.log("🔄 Updating project member role:", request)

		// Update user_roles
		// We need to find the active role for this user in this project
		const { data, error } = await getSupabaseClient()
			.from("user_roles")
			.update({
				role: request.new_role,
				modified_by: request.updated_by
			})
			.eq("user_id", request.user_id)
			.eq("scope_type", "project")
			.eq("scope_id", request.project_id)
			.eq("is_active", true)
			.select()
			.single()

		if (error) {
			console.error("❌ Error updating project member role:", error)
			return {
				success: false,
				user_id: request.user_id,
				project_id: request.project_id,
				error: error.message,
			}
		}

		console.log("✅ Successfully updated project member role:", data)
		return {
			success: true,
			user_id: request.user_id,
			project_id: request.project_id,
			new_role: request.new_role
		}
	} catch (error: any) {
		console.error("❌ Exception updating project member role:", error)
		return {
			success: false,
			user_id: request.user_id,
			project_id: request.project_id,
			error: error.message || "Unknown error occurred",
		}
	}
}

/**
 * Remove a user from a project
 */
export const removeProjectMember = async (
	request: RemoveMemberRequest,
): Promise<MemberOperationResponse> => {
	try {
		console.log("➖ Removing project member:", request)

		// Soft delete or hard delete from user_roles?
		// Usually we set is_active = false or delete. Let's assume delete for now to match previous behavior, 
		// or update is_active if we want history.
		// Let's use DELETE for now as per previous implementation, but user_roles might prefer soft delete.
		// Actually, let's use DELETE to keep it simple and consistent with "removing".

		const { error } = await getSupabaseClient()
			.from("user_roles")
			.delete()
			.eq("user_id", request.user_id)
			.eq("scope_type", "project")
			.eq("scope_id", request.project_id)

		if (error) {
			console.error("❌ Error removing project member:", error)
			return {
				success: false,
				user_id: request.user_id,
				project_id: request.project_id,
				error: error.message,
			}
		}

		console.log("✅ Successfully removed project member")
		return {
			success: true,
			user_id: request.user_id,
			project_id: request.project_id
		}
	} catch (error: any) {
		console.error("❌ Exception removing project member:", error)
		return {
			success: false,
			user_id: request.user_id,
			project_id: request.project_id,
			error: error.message || "Unknown error occurred",
		}
	}
}

/**
 * Check if current user has project admin role
 */
export const isProjectAdmin = async (
	projectId: string,
	userId: string,
): Promise<boolean> => {
	try {
		const { data, error } = await getSupabaseClient()
			.from("user_roles")
			.select("role")
			.eq("user_id", userId)
			.eq("scope_type", "project")
			.eq("scope_id", projectId)
			.eq("role", "project_admin")
			.eq("is_active", true)
			.single()

		if (error && error.code !== 'PGRST116') { // PGRST116 is "The result contains 0 rows"
			console.error("❌ Error checking project admin role:", error)
			return false
		}

		return !!data
	} catch (error) {
		console.error("❌ Exception checking project admin role:", error)
		return false
	}
}

/**
 * Check if current user has WW Admin role (system-wide)
 */
export const isWWAdmin = async (userId: string): Promise<boolean> => {
	try {
		const { data, error } = await getSupabaseClient()
			.from("user_roles")
			.select("role")
			.eq("user_id", userId)
			.eq("scope_type", "system")
			.eq("role", "ww_admin")
			.eq("is_active", true)
			.single()

		if (error && error.code !== 'PGRST116') {
			console.error("❌ Error checking WW admin role:", error)
			return false
		}

		return !!data
	} catch (error) {
		console.error("❌ Exception checking WW admin role:", error)
		return false
	}
}

/**
 * Validate if a user can be added to a project
 */
export const canAddUserToProject = (
	userId: string,
	projectId: string,
	organizationId: string,
	existingMembers: ProjectMember[],
): { valid: boolean; reason?: string } => {
	// Check if user is already a member
	const isAlreadyMember = existingMembers.some((member) => member.id === userId)

	if (isAlreadyMember) {
		return {
			valid: false,
			reason: "User is already a member of this project",
		}
	}

	return { valid: true }
}

/**
 * Export service functions as default for easier importing
 */
export default {
	getOrganizationUsers,
	getProjectMembers,
	addProjectMember,
	updateProjectMemberRole,
	removeProjectMember,
	isProjectAdmin,
	isWWAdmin,
	canAddUserToProject,
}
