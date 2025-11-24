/**
 * Project Member Management Service
 *
 * Handles project-level member management including:
 * - Fetching organization user pool
 * - Adding members to projects
 * - Changing member roles
 * - Removing members from projects
 * - Getting project member list
 *
 * Implements Tier 2 user management (Project Admin scope only):
 * - Can only add existing org users (created by WW Admin via web portal)
 * - Can only assign project roles (project_admin, project_member)
 * - Cannot create new users or assign system roles
 */

import { supabase } from "./supabase"

export type ProjectRole = "project_admin" | "project_member" | "viewer"

export interface OrganizationUser {
	id: string
	name: string
	email: string
	roles: any // JSON from RPC
	is_in_project: boolean
}

export interface ProjectMember {
	id: string // User ID
	name: string
	email: string
	role: string // ProjectRole
	granted_at: string
	granted_by: string
	granted_by_name: string
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
 *
 * @param organisationId - Organization UUID
 * @param requestingUserId - Current user's UUID (must be project admin)
 */
export const getOrganizationUsers = async (
	organisationId: string,
	requestingUserId: string,
): Promise<OrganizationUser[]> => {
	try {
		// Call backend function to get org users
		const { data, error } = await supabase.rpc("get_organisation_users", {
			p_organisation_id: organisationId,
			p_requesting_user_id: requestingUserId,
		})

		if (error) {
			console.error("❌ Error fetching organization users:", error)
			throw new Error(error.message)
		}

		console.log(
			`✅ Fetched ${data?.length || 0
			} users from organization ${organisationId}`,
		)
		return (data as any[]) || []
	} catch (error) {
		console.error("❌ Exception fetching organization users:", error)
		throw error
	}
}

/**
 * Get all members of a project
 *
 * Security: Only project members can view member list
 *
 * @param projectId - Project UUID
 * @param requestingUserId - Current user's UUID
 */
export const getProjectMembers = async (
	projectId: string,
	requestingUserId: string,
): Promise<ProjectMember[]> => {
	try {
		// Call backend function to get project members
		const { data, error } = await supabase.rpc("get_project_members", {
			p_project_id: projectId,
			p_requesting_user_id: requestingUserId,
		})

		if (error) {
			console.error("❌ Error fetching project members:", error)
			throw new Error(error.message)
		}

		console.log(
			`✅ Fetched ${data?.length || 0} members from project ${projectId}`,
		)
		return (data as any[]) || []
	} catch (error) {
		console.error("❌ Exception fetching project members:", error)
		throw error
	}
}

/**
 * Add a user to a project with specified role
 *
 * Security: Only project admins can add members
 * Validation: User must be from same organization as project
 *
 * @param request - Add member request
 */
export const addProjectMember = async (
	request: AddMemberRequest,
): Promise<MemberOperationResponse> => {
	try {
		console.log("➕ Adding project member:", {
			project_id: request.project_id,
			user_id: request.user_id,
			role: request.role,
		})

		// Call backend function to add project member
		const { data, error } = await supabase.rpc("add_project_member", {
			p_project_id: request.project_id,
			p_user_id: request.user_id,
			p_role: request.role,
			p_granted_by: request.granted_by,
		})

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
		return data as unknown as MemberOperationResponse
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
 *
 * Security: Only project admins can change roles
 * Protection: Cannot demote self if last admin
 *
 * @param request - Update role request
 */
export const updateProjectMemberRole = async (
	request: UpdateRoleRequest,
): Promise<MemberOperationResponse> => {
	try {
		console.log("🔄 Updating project member role:", {
			project_id: request.project_id,
			user_id: request.user_id,
			new_role: request.new_role,
		})

		// Call backend function to update member role
		const { data, error } = await supabase.rpc("update_project_member_role", {
			p_project_id: request.project_id,
			p_user_id: request.user_id,
			p_new_role: request.new_role,
			p_updated_by: request.updated_by,
		})

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
		return data as unknown as MemberOperationResponse
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
 *
 * Security: Only project admins can remove members
 * Protection: Cannot remove last project admin
 *
 * @param request - Remove member request
 */
export const removeProjectMember = async (
	request: RemoveMemberRequest,
): Promise<MemberOperationResponse> => {
	try {
		console.log("➖ Removing project member:", {
			project_id: request.project_id,
			user_id: request.user_id,
		})

		// Call backend function to remove project member
		const { data, error } = await supabase.rpc("remove_project_member", {
			p_project_id: request.project_id,
			p_user_id: request.user_id,
			p_removed_by: request.removed_by,
		})

		if (error) {
			console.error("❌ Error removing project member:", error)
			return {
				success: false,
				user_id: request.user_id,
				project_id: request.project_id,
				error: error.message,
			}
		}

		console.log("✅ Successfully removed project member:", data)
		return data as unknown as MemberOperationResponse
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
 *
 * Helper function for UI to determine if member management features should be shown
 *
 * @param projectId - Project UUID
 * @param userId - Current user's UUID
 */
export const isProjectAdmin = async (
	projectId: string,
	userId: string,
): Promise<boolean> => {
	try {
		// Call backend function to check project role
		const { data, error } = await supabase.rpc("has_project_role", {
			project_id: projectId,
			required_role: "project_admin",
			user_id: userId,
		})

		if (error) {
			console.error("❌ Error checking project admin role:", error)
			return false
		}

		return data === true
	} catch (error) {
		console.error("❌ Exception checking project admin role:", error)
		return false
	}
}

/**
 * Check if current user has WW Admin role (system-wide)
 *
 * Helper function for UI to determine if global admin features should be shown
 *
 * @param userId - Current user's UUID
 */
export const isWWAdmin = async (userId: string): Promise<boolean> => {
	try {
		// Call backend function to check system role
		const { data, error } = await supabase.rpc("has_system_role", {
			required_role: "ww_admin",
			user_id: userId,
		})

		if (error) {
			console.error("❌ Error checking WW admin role:", error)
			return false
		}

		return data === true
	} catch (error) {
		console.error("❌ Exception checking WW admin role:", error)
		return false
	}
}

/**
 * Validate if a user can be added to a project
 *
 * Client-side validation before calling backend
 * - User must exist
 * - User must be from same organization
 * - User must not already be a member
 *
 * @param userId - User to add
 * @param projectId - Target project
 * @param organizationId - Project's organization
 * @param existingMembers - Current project members
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

	// Additional validation happens on backend (org membership, etc.)
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
