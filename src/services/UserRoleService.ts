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
import { log, logError } from "../utils/logger"

import database from '../database'
import Project from '../database/models/Project'
import UserRole from '../database/models/UserRole'
import { Q } from '@nozbe/watermelondb'



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
			logError(error.message)
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

		log(`✅ Fetched ${transformedUsers.length} users from organization ${organisationId}`)
		return transformedUsers as OrganizationUser[]
	} catch (error) {
		if (error instanceof Error) {
			logError(error)
		} else {
			logError(String(error))
		}
		throw error
	}
}

/**
 * Get all members of a project
 * Checks local WatermelonDB first for offline support
 */
export const getProjectMembers = async (
	projectId: string,
	requestingUserId: string,
): Promise<ProjectMember[]> => {
	try {
		// 1. Try local database first
		const localRoles = await database.get<UserRole>('user_roles')
			.query(
				Q.where('scope_type', 'project'),
				Q.where('scope_id', projectId),
				Q.where('is_active', true)
			)
			.fetch()

		if (localRoles.length > 0) {
			// Fetch user details for these roles
			const userIds = localRoles.map(r => r.userId)
			const users = await database.get<any>('users') // Use any to avoid import issues if User model not exported as value
				.query(Q.where('id', Q.oneOf(userIds)))
				.fetch()

			const userMap = new Map(users.map(u => [u.id, u]))

			// Check for missing users and fetch them
			const missingUserIds = userIds.filter(id => !userMap.has(id))
			if (missingUserIds.length > 0) {
				log(`⚠️ Missing ${missingUserIds.length} users locally, fetching from Cloud...`)
				try {
					const { data: remoteUsers, error } = await getSupabaseClient()
						.from('users')
						.select('*')
						.in('id', missingUserIds)

					if (remoteUsers && !error) {
						await database.write(async () => {
							const usersCollection = database.collections.get<any>('users')
							const operations = remoteUsers.map(u =>
								usersCollection.prepareCreate(localUser => {
									localUser._raw.id = u.id
									localUser.firstname = u.firstname
									localUser.surname = u.surname
									localUser.modifiedBy = u.modified_by || 'system'
									// Bypass @readonly decorator by assigning to _raw
									// Timestamps are numbers (epochs) in _raw, but Dates in model
									localUser._raw.created_at = new Date(u.created_at || Date.now()).getTime()
									localUser._raw.updated_at = new Date(u.updated_at || Date.now()).getTime()
									// Handle deleted_at if needed, though usually active users are null
								})
							)
							await database.batch(operations)
						})

						// Add to map for immediate display
						remoteUsers.forEach(u => userMap.set(u.id, u))
						log(`✅ Synced ${remoteUsers.length} missing users to local DB`)
					}
				} catch (err) {
					logError("Failed to fetch missing users: " + (err instanceof Error ? err.message : String(err)))
				}
			}

			const members = localRoles.map(role => {
				const user = userMap.get(role.userId)
				let name = "Unknown User"
				if (user) {
					name = `${user.firstname} ${user.surname}`.trim() || "Unknown User"
				} else if (role.userId === requestingUserId) {
					name = "Me" // Fallback if local user is missing but it's the current user
				}

				// We might not have email locally if it's not in public.users or not synced
				// But for basic display, name is most important.
				return {
					id: role.userId,
					name: name,
					email: "", // Email might be missing locally
					role: role.role,
					granted_at: (role.grantedAt && !isNaN(role.grantedAt.getTime())) ? role.grantedAt.toISOString() : new Date().toISOString(),
					granted_by: role.grantedBy,
					granted_by_name: "Unknown" // We could fetch this too but let's keep it simple
				}
			})

			log(`✅ Fetched ${members.length} members from local DB for project ${projectId}`)
			return members
		}

		// 1b. Optimistic check: If no roles found, check if I am the creator (project might not be synced yet)
		try {
			const project = await database.get<Project>('projects').find(projectId)
			if (project && project.createdBy === requestingUserId) {
				log(`✅ Optimistic check: Current user is creator of project ${projectId}`)

				// Fetch my user details if available
				let name = "Me"
				try {
					const user = await database.get<any>('users').find(requestingUserId)
					if (user) {
						name = `${user.firstname} ${user.surname}`
					}
				} catch (e) {
					// User not found locally, ignore
				}

				return [{
					id: requestingUserId,
					name: name,
					email: "",
					role: "project_admin",
					granted_at: new Date().toISOString(),
					granted_by: requestingUserId,
					granted_by_name: name
				}]
			}
		} catch (e) {
			// Project not found or error, proceed to RPC fallback
		}

		// 2. Fallback to backend RPC
		// This bypasses RLS issues and provides proper data joins
		const { data, error } = await getSupabaseClient()
			.rpc("get_project_members", {
				p_project_id: projectId,
				p_requesting_user_id: requestingUserId
			})

		if (error) {
			logError("❌ Error fetching project members: " + error.message)
			throw new Error(error.message)
		}

		// Map RPC response to ProjectMember format
		const members = (data || []).map((m: any) => ({
			id: m.id,  // RPC returns 'id' not 'user_id'
			name: m.name || "Unknown",
			email: m.email || "",
			role: m.role,
			granted_at: m.granted_at,
			granted_by: m.granted_by,
			granted_by_name: m.granted_by_name || "Unknown"
		}))

		log(`✅ Fetched ${members.length} members from project ${projectId}`)
		return members
	} catch (error) {
		logError("❌ Exception fetching project members: " + (error instanceof Error ? error.message : String(error)))
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
		log("➕ Adding project member: " + JSON.stringify(request))

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
			logError("❌ Error adding project member: " + JSON.stringify(error))
			return {
				success: false,
				user_id: request.user_id,
				project_id: request.project_id,
				error: error.message,
			}
		}

		log("✅ Successfully added project member: " + JSON.stringify(data))
		return {
			success: true,
			user_id: request.user_id,
			project_id: request.project_id,
			role: request.role,
			new_role: request.role
		}
	} catch (error: any) {
		logError("❌ Exception adding project member: " + (error instanceof Error ? error.message : String(error)))
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
		log("🔄 Updating project member role: " + JSON.stringify(request))

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
			logError("❌ Error updating project member role: " + JSON.stringify(error))
			return {
				success: false,
				user_id: request.user_id,
				project_id: request.project_id,
				error: error.message,
			}
		}

		log("✅ Successfully updated project member role: " + JSON.stringify(data))
		return {
			success: true,
			user_id: request.user_id,
			project_id: request.project_id,
			new_role: request.new_role
		}
	} catch (error: any) {
		logError("❌ Exception updating project member role: " + (error instanceof Error ? error.message : String(error)))
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
		log("➖ Removing project member: " + JSON.stringify(request))

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
			logError("❌ Error removing project member: " + JSON.stringify(error))
			return {
				success: false,
				user_id: request.user_id,
				project_id: request.project_id,
				error: error.message,
			}
		}

		log("✅ Successfully removed project member")
		return {
			success: true,
			user_id: request.user_id,
			project_id: request.project_id
		}
	} catch (error: any) {
		logError("❌ Exception removing project member: " + (error instanceof Error ? error.message : String(error)))
		return {
			success: false,
			user_id: request.user_id,
			project_id: request.project_id,
			error: error.message || "Unknown error occurred",
		}
	}
}

/**
 * Get current user's role in a project
 * Checks local WatermelonDB first, then optimistic check, then Supabase
 */
export const getUserProjectRole = async (
	projectId: string,
	userId: string,
): Promise<ProjectRole | null> => {
	try {
		// 1. Check local database first
		const localRoles = await database.get<UserRole>('user_roles')
			.query(
				Q.where('user_id', userId),
				Q.where('scope_type', 'project'),
				Q.where('scope_id', projectId),
				Q.where('is_active', true)
			)
			.fetch()

		if (localRoles.length > 0) {
			// Return the highest priority role if multiple?
			// For now assume one role per project
			return localRoles[0].role as ProjectRole
		}

		// 2. Optimistic check: If no roles found, check if I am the creator
		try {
			const project = await database.get<Project>('projects').find(projectId)
			if (project && project.createdBy === userId) {
				log(`✅ Optimistic check (getUserProjectRole): Current user is creator of project ${projectId}`)
				return "project_admin"
			}
		} catch (e) {
			// Ignore
		}

		// 3. Fallback to Supabase
		const { data, error } = await getSupabaseClient()
			.from("user_roles")
			.select("role")
			.eq("user_id", userId)
			.eq("scope_type", "project")
			.eq("scope_id", projectId)
			.eq("is_active", true)
			.single()

		if (error) {
			if (error.code !== 'PGRST116') { // Not found
				logError("❌ Error checking user project role: " + JSON.stringify(error))
			}
			return null
		}

		return data?.role as ProjectRole || null
	} catch (error) {
		logError("❌ Exception checking user project role: " + (error instanceof Error ? error.message : String(error)))
		return null
	}
}

/**
 * Check if current user has project admin role
 * Checks local WatermelonDB first for offline support
 */
export const isProjectAdmin = async (
	projectId: string,
	userId: string,
): Promise<boolean> => {
	try {
		// Check local database first
		const localRole = await database.get<UserRole>('user_roles')
			.query(
				Q.where('user_id', userId),
				Q.where('scope_type', 'project'),
				Q.where('scope_id', projectId),
				Q.where('role', 'project_admin'),
				Q.where('is_active', true)
			)
			.fetch()

		if (localRole.length > 0) {
			return true
		}

		// Fallback to Supabase if not found locally (e.g. not synced yet)
		const { data, error } = await getSupabaseClient()
			.from("user_roles")
			.select("role")
			.eq("user_id", userId)
			.eq("scope_type", "project")
			.eq("scope_id", projectId)
			.eq("role", "project_admin")
			.eq("is_active", true)
			.single()

		if (error && error.code !== 'PGRST116') {
			logError("❌ Error checking project admin role: " + JSON.stringify(error))
			return false
		}

		return !!data
	} catch (error) {
		logError("❌ Exception checking project admin role: " + (error instanceof Error ? error.message : String(error)))
		return false
	}
}

/**
 * Check if current user has WW Admin role (system-wide)
 * Checks local WatermelonDB first
 */
export const isWWAdmin = async (userId: string): Promise<boolean> => {
	try {
		// Check local database first
		const localRole = await database.get<UserRole>('user_roles')
			.query(
				Q.where('user_id', userId),
				Q.where('scope_type', 'system'),
				Q.where('role', 'ww_admin'),
				Q.where('is_active', true)
			)
			.fetch()

		if (localRole.length > 0) {
			return true
		}

		// Fallback to Supabase
		const { data, error } = await getSupabaseClient()
			.from("user_roles")
			.select("role")
			.eq("user_id", userId)
			.eq("scope_type", "system")
			.eq("role", "ww_admin")
			.eq("is_active", true)
			.single()

		if (error && error.code !== 'PGRST116') {
			logError("❌ Error checking WW admin role: " + JSON.stringify(error))
			return false
		}

		return !!data
	} catch (error) {
		logError("❌ Exception checking WW admin role: " + (error instanceof Error ? error.message : String(error)))
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
	getUserProjectRole,
}
