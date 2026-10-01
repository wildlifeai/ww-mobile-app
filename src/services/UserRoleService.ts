/**
 * User Role Management Service
 *
 * Handles role management including:
 * - Getting the project member list, and caching it for offline use
 * - Changing member roles and removing members, through the server's RPCs
 * - The current user's own role checks
 *
 * Roles live in the `user_roles` table with `scope_type` and `scope_id`. Its
 * row level security is own-row-only, so another person's role can only be
 * read or changed through the SECURITY DEFINER member RPCs (#335). Adding a
 * member is an invitation, `InvitationService.sendInvitation`.
 */

import { getSupabaseClient } from "./supabase"
import { isKnownOffline } from "./connectivityWatch"
import { log, logError } from "../utils/logger"
import { isNetworkOrRetryable, logCloudFailure } from "../utils/networkErrors"

import database from '../database'
import Project from '../database/models/Project'
import UserRole from '../database/models/UserRole'
import User from '../database/models/User'
import ProjectInvitation from '../database/models/ProjectInvitation'
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
	firstname?: string
	surname?: string
	email: string
	role: string // ProjectRole
	granted_at: string
	granted_by: string
	granted_by_name?: string
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

/**
 * Why a member change was not made (#335). `offline` means nothing was sent;
 * every other reason is the server's answer, or the lack of one.
 */
export type MemberChangeFailure =
	| "offline"
	| "unreachable"
	| "not_allowed"
	| "wrong_account"
	| "last_admin"
	| "not_a_member"
	| "same_role"
	| "unknown"

export interface MemberOperationResponse {
	success: boolean
	user_id: string
	project_id: string
	role?: ProjectRole
	old_role?: ProjectRole
	new_role?: ProjectRole
	removed_role?: ProjectRole
	/** A message for the operator, set whenever success is false */
	error?: string
	reason?: MemberChangeFailure
}

/**
 * Get all members of a project
 * Uses a Network-First strategy to bypass local RLS restrictions for non-admins,
 * falling back to local WatermelonDB for offline support.
 */
export const getProjectMembers = async (
	projectId: string,
	requestingUserId: string,
): Promise<ProjectMember[]> => {
	try {
		// 1. Try cloud first (Network-First strategy)
		// This guarantees that non-admins (bound by RLS offline) can see the full member list natively.
		// Not when there is no connection at all: two requests that cannot
		// answer, and error lines for each, before the local list (#310).
		if (!(await isKnownOffline())) {
			try {
				const cloudMembers = await fetchMembersFromCloud(projectId, requestingUserId)
				if (cloudMembers && cloudMembers.length > 0) {
					return cloudMembers
				}
			} catch (cloudError) {
				log("⚠️ Cloud fetch for project members failed or offline, securely falling back to local DB...")
			}
		}

		// 2. Try local database (Offline Fallback)
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
				log(`⚠️ Missing ${missingUserIds.length} users locally: ${missingUserIds.join(', ')}`)
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

			// NEW: Fetch invitations to resolve email addresses for local users
			let invitationMap = new Map<string, string>();
			
			try {
				// Check local invitations
				const invitations = await database.get<ProjectInvitation>('project_invitations')
					.query(
						Q.where('project_id', projectId)
					).fetch();
				invitations.forEach(inv => {
					if (inv.inviteeId) invitationMap.set(inv.inviteeId, inv.inviteeEmail);
				});
			} catch (invError) {
				log("Failed to enrich member data from invitations");
			}

			const members = localRoles.map(role => {
				const user = userMap.get(role.userId)
				// users.email is filled by the member cache (cacheProjectMembers)
				let email = user?.email || invitationMap.get(role.userId) || ""
				const isMe = String(role.userId).toLowerCase() === String(requestingUserId).toLowerCase()
				let name = isMe ? "Me" : "Unknown User"

				if (user) {
					const fullName = `${user.firstname || ""} ${user.surname || ""}`.trim()
					if (fullName) {
						name = isMe ? `${fullName} (You)` : fullName
					} else if (email) {
						name = isMe ? `${email} (You)` : email
					}
				} else if (email) {
					name = isMe ? `${email} (You)` : email // Use invitation email as name if profile is missing
				}

				// If we still have "Unknown User" but it's me, make sure it says Me
				if (name === "Unknown User" && isMe) {
					name = "Me (You)"
				}

				// We might not have email locally if it's not in public.users or not synced
				// But for basic display, name is most important.
				return {
					id: role.userId,
					name: name,
					firstname: user?.firstname || "",
					surname: user?.surname || "",
					email: email, // Enriched from invitations if available
					role: role.role,
					granted_at: (role.grantedAt && !isNaN(role.grantedAt.getTime())) ? role.grantedAt.toISOString() : new Date().toISOString(),
					granted_by: role.grantedBy,
					granted_by_name: "Unknown" // We could fetch this too but let's keep it simple
				}
			})

			log(`✅ Fetched ${members.length} members from local DB for project ${projectId}`)

			// If any member is still "Unknown User", try to fetch from cloud to get better data
			// (Note: This cloud call will fail until backend migration is pushed, but we handle the error gracefully)
			const hasUnknown = members.some(m => m.name === "Unknown User")
			if (hasUnknown) {
				log(`⚠️ Found unknown members in local DB, attempting cloud fallback...`)
				try {
					const cloudMembers = await fetchMembersFromCloud(projectId, requestingUserId)
					if (cloudMembers && cloudMembers.length > 0) {
						return cloudMembers
					}
				} catch (e) {
					log("Failed to fetch from cloud during fallback, returning local members")
				}
			}

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
			// Project not found or error, return empty
		}

		return []
	} catch (error) {
		logError("❌ Exception fetching project members: " + (error instanceof Error ? error.message : String(error)))
		throw error
	}
}

export const fetchMembersFromCloud = async (
	projectId: string,
	requestingUserId: string
): Promise<ProjectMember[]> => {
	try {
		// This bypasses RLS issues and provides proper data joins
		const { data, error } = await getSupabaseClient()
			.rpc("get_project_members", {
				p_project_id: projectId
			})

		if (error) {
		// Log the actual error to understand why RPC is failing
		log("🔍 DIAGNOSTIC: RPC get_project_members failed with error:", {
			message: error.message,
			code: error.code,
			details: error.details,
			hint: error.hint
		})
		
		// If backend is old and doesn't have the fixed RPC, we'll get "column u.name does not exist"
		// Handle this gracefully by falling back to manual queries
		if (error.message.includes("u.name") || error.message.includes("does not exist")) {
			log("⚠️ Backend RPC is outdated, falling back to manual cloud fetch...")
			return await fetchMembersFromCloudManual(projectId, requestingUserId)
		}
		throw new Error(error.message)
	}

	// Keep the answer for when this phone is offline (#307). A failure here
	// must not cost the online list.
	try {
		await cacheProjectMembers(projectId, requestingUserId, data || [])
	} catch (cacheError) {
		logError("Failed to cache project members: " + (cacheError instanceof Error ? cacheError.message : String(cacheError)))
	}

	// Map RPC response to ProjectMember format
	const members = (data || []).map((m: any) => {
		const firstName = m.firstname || ""
		const surname = m.surname || ""
		const fullName = m.name || (firstName || surname ? `${firstName} ${surname}`.trim() : (m.email || "Unknown"))
		const isMe = String(m.id).toLowerCase() === String(requestingUserId).toLowerCase()

		return {
			id: m.id,  // RPC returns 'id' not 'user_id'
			name: isMe ? (fullName && fullName !== "Unknown" ? `${fullName} (You)` : "Me (You)") : fullName,
			firstname: m.firstname,
			surname: m.surname,
			email: m.email || "",
			role: m.role,
			granted_at: m.granted_at,
			granted_by: m.granted_by,
			granted_by_name: m.granted_by_name || "Unknown"
		}
	})
	log(`✅ Fetched ${members.length} members from cloud for project ${projectId}`)
	return members
	} catch (error) {
		log("❌ Cloud RPC failed: " + (error instanceof Error ? error.message : String(error)))
		// Final fallback: try manual fetch even if it wasn't a specific column error
		return await fetchMembersFromCloudManual(projectId, requestingUserId)
	}
}

/**
 * Write a get_project_members answer into the local tables the offline
 * fallback in getProjectMembers reads (#307): each member's name and email
 * into `users`, and each member's role in this project into `user_roles`.
 *
 * Sync cannot fill these for anyone but the caller. public.users has no read
 * policy for other people (ww-backend #189) and user_roles is own-row-only,
 * because its policies cannot call the role helpers without a 42P17 cycle.
 * The RPC is the authorised route to project mates, so its answer is the
 * cache. The caller's own rows are left to the sync, and roles the server no
 * longer lists for this project are removed, so the cache is only ever as
 * stale as the last time the list was seen online.
 */
const cacheProjectMembers = async (
	projectId: string,
	requestingUserId: string,
	rows: any[],
): Promise<void> => {
	const isMe = (id: string) => String(id).toLowerCase() === String(requestingUserId).toLowerCase()
	const others = rows.filter((row) => row?.id && !isMe(row.id))
	const usersCollection = database.get<User>('users')
	const rolesCollection = database.get<UserRole>('user_roles')

	await database.write(async () => {
		const operations: any[] = []

		// Profiles. The RPC returns the name as one string, firstname and
		// surname joined, so it is kept whole in firstname.
		const ids = Array.from(new Set(others.map((row) => row.id as string)))
		const knownUsers = ids.length > 0
			? await usersCollection.query(Q.where('id', Q.oneOf(ids))).fetch()
			: []
		const userById = new Map(knownUsers.map((u) => [u.id, u]))
		const seenUsers = new Set<string>()
		for (const row of others) {
			if (seenUsers.has(row.id)) continue // one row per role held
			seenUsers.add(row.id)

			const name: string = row.name || ''
			const email: string | undefined = row.email || undefined
			const existing = userById.get(row.id)
			if (!existing) {
				operations.push(usersCollection.prepareCreate((u) => {
					u._raw.id = row.id
					u.firstname = name
					u.surname = ''
					u.email = email
					u.modifiedBy = 'system';
					// Bypass @readonly decorator by assigning to _raw
					(u._raw as any).created_at = Date.now();
					(u._raw as any).updated_at = Date.now()
				}))
			} else if (
				// Only overwrite with what the server actually sent
				(name && `${existing.firstname || ''} ${existing.surname || ''}`.trim() !== name) ||
				(email && existing.email !== email)
			) {
				operations.push(existing.prepareUpdate((u) => {
					if (name) {
						u.firstname = name
						u.surname = ''
					}
					if (email) u.email = email
				}))
			}
		}

		// Roles in this project, keyed by person and role
		const key = (userId: string, role: string) => `${userId}|${role}`
		const listed = new Set(others.map((row) => key(row.id, row.role)))
		const localRoles = await rolesCollection.query(
			Q.where('scope_type', 'project'),
			Q.where('scope_id', projectId),
		).fetch()
		const localByKey = new Map(localRoles.map((r) => [key(r.userId, r.role), r]))

		for (const local of localRoles) {
			if (!isMe(local.userId) && !listed.has(key(local.userId, local.role))) {
				operations.push(local.prepareDestroyPermanently())
			}
		}
		const seenRoles = new Set<string>()
		for (const row of others) {
			const rowKey = key(row.id, row.role)
			if (seenRoles.has(rowKey)) continue
			seenRoles.add(rowKey)

			const existing = localByKey.get(rowKey)
			if (existing) {
				if (!existing.isActive || (row.granted_by && existing.grantedBy !== row.granted_by)) {
					operations.push(existing.prepareUpdate((r) => {
						r.isActive = true
						if (row.granted_by) r.grantedBy = row.granted_by
					}))
				}
				continue
			}
			operations.push(rolesCollection.prepareCreate((r) => {
				r.userId = row.id
				r.role = row.role
				r.scopeType = 'project'
				r.scopeId = projectId
				r.grantedBy = row.granted_by || ''
				r.grantedAt = new Date(row.granted_at ?? Date.now())
				r.isActive = true
				r.modifiedBy = row.granted_by || '';
				// Use _raw to bypass @readonly check
				(r._raw as any).created_at = Date.now()
				r.updatedAt = new Date()
			}))
		}

		if (operations.length > 0) {
			await database.batch(...operations)
		}
	})
	log(`💾 Cached ${others.length} other member(s) of project ${projectId} for offline use`)
}

/**
 * Manual fallback to fetch project members when RPC is broken
 * Queries tables individually and joins in memory
 */
/**
 * Manual fallback to fetch project members when RPC is broken
 * Queries tables individually and joins in memory
 * 
 * SECURITY NOTE: This fallback does NOT fetch emails from auth.users
 * to avoid granting direct access to the auth schema.
 * Emails will only be available if the RPC functions are used.
 */
const fetchMembersFromCloudManual = async (projectId: string, requestingUserId: string): Promise<ProjectMember[]> => {
	try {
		log(`🔍 Manually fetching members for project ${projectId} (requestingUser: ${requestingUserId})...`)
		const supabase = getSupabaseClient()

		// 1. Fetch roles
		const { data: roles, error: rolesError } = await supabase
			.from('user_roles')
			.select('*')
			.eq('scope_type', 'project')
			.eq('scope_id', projectId)
			.eq('is_active', true)

		if (rolesError || !roles) {
			logCloudFailure("Failed to fetch roles manually: " + rolesError?.message, rolesError)
			return []
		}

		const userIds = roles.map(r => r.user_id)
		log(`   Found ${userIds.length} user IDs in project`)

		// 2. Fetch user profiles (firstname and surname only)
		const { data: profiles } = await supabase
			.from('users')
			.select('id, firstname, surname')
			.in('id', userIds)

		const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

		// 3. (Removed) Fetching emails from auth.users is NOT PERMITTED for security reasons.
        // Use the RPC function get_project_members to retrieve emails securely.

		log(`🔍 DIAGNOSTIC: Manual fetch - profiles: ${profiles?.length || 0} (Emails unavailable in manual mode)`)

		// 4. Join and map
		const members: ProjectMember[] = roles.map(role => {
			const profile = profileMap.get(role.user_id)
			const isMe = String(role.user_id).toLowerCase() === String(requestingUserId).toLowerCase()
			
			let name = isMe ? "Me" : "Unknown User"
            let email = "" // Cannot fetch email manually securely
			
			if (profile) {
				const profileName = `${profile.firstname || ""} ${profile.surname || ""}`.trim()
				if (profileName) {
					name = isMe ? `${profileName} (You)` : profileName
				}
			} else if (isMe) {
				name = "Me (You)"
			}

			return {
				id: role.user_id,
				name: name,
				firstname: profile?.firstname,
				surname: profile?.surname,
				email: email,
				role: role.role,
				granted_at: role.granted_at,
				granted_by: role.granted_by || "",
				granted_by_name: "Unknown"
			}
		})

		log(`✅ Manually fetched ${members.length} members from cloud (Note: emails hidden in fallback mode)`)
		return members
	} catch (error) {
		logError("Manual cloud fetch failed: " + (error instanceof Error ? error.message : String(error)))
		return []
	}
}

/*
 * Changing someone's role or removing them (#335).
 *
 * Both go through ww-backend's SECURITY DEFINER RPCs, which check the caller
 * themselves: `update_project_member_role` and `remove_project_member`. The
 * app used to write `user_roles` directly, and RLS on that table is
 * own-row-only, so the role change and the removal of anyone else were
 * refused. The removal was worse than refused: RLS turns an unauthorised
 * DELETE into "0 rows" rather than an error, so the admin was told the person
 * was gone while they kept full access. ww-backend #219 has since revoked
 * every write grant on user_roles from `authenticated`.
 *
 * The RPCs raise on anything they do not do (not an admin, not the calling
 * user, not a member, the last admin, the same role), so a success here is a
 * change the server made. The caller refetches `get_project_members` rather
 * than editing its own list, to show what the database now holds.
 *
 * Both are server-only actions: offline they send nothing and say they need
 * a connection, the same as Invite, and nothing is queued.
 */

const OFFLINE_MESSAGE = {
	role: "Changing a role needs a connection. Try again when you are online.",
	remove: "Removing a member needs a connection. Try again when you are online.",
}

const FAILURE_MESSAGES: Record<Exclude<MemberChangeFailure, "offline" | "unknown">, string> = {
	unreachable: "Could not reach the server, so the change may not have been made. Refresh the member list when you are online to check.",
	not_allowed: "Only project admins can change members. Nothing was changed.",
	wrong_account: "The account signed in on this phone does not match this screen. Sign out and in again, then retry. Nothing was changed.",
	last_admin: "A project needs at least one admin. Make someone else an admin first.",
	not_a_member: "This person is no longer a member of this project. Refresh the member list.",
	same_role: "They already have this role.",
}

/**
 * Turn a member RPC's error into what the operator can act on, by the
 * SQLSTATE the functions raise (ww-backend migration
 * 20260929031657_bind_member_rpc_actor_to_caller.sql). 22023 covers several
 * cases, so its message decides which.
 */
export const describeMemberChangeError = (
	error: { code?: string; message?: string; name?: string } | null | undefined,
	status?: number | null,
): { reason: MemberChangeFailure; message: string } => {
	if (isNetworkOrRetryable(error, status)) {
		return { reason: "unreachable", message: FAILURE_MESSAGES.unreachable }
	}
	const text = error?.message ?? ""
	const known = (reason: Exclude<MemberChangeFailure, "offline" | "unknown">) => ({ reason, message: FAILURE_MESSAGES[reason] })
	switch (error?.code) {
		case "42501":
			return known(/must be the calling user/i.test(text) ? "wrong_account" : "not_allowed")
		case "23514":
			return known("last_admin")
		case "22023":
			if (/last project admin/i.test(text)) return known("last_admin")
			if (/not a member/i.test(text)) return known("not_a_member")
			if (/already has this role/i.test(text)) return known("same_role")
			break
	}
	return {
		reason: "unknown",
		message: text ? `The server did not make the change: ${text}` : "The server did not make the change.",
	}
}

/** A reply that is not the RPC's `{ success: true }` is not a change. */
const NOT_CONFIRMED = "The server did not confirm the change. Refresh the member list to check."

const memberChangeFailure = (
	request: { project_id: string; user_id: string },
	failure: { reason: MemberChangeFailure; message: string },
): MemberOperationResponse => ({
	success: false,
	user_id: request.user_id,
	project_id: request.project_id,
	reason: failure.reason,
	error: failure.message,
})

/**
 * Log a member change the server did not make. A refusal is an answer, not a
 * fault, so only an unexpected error reaches logError (a red LogBox bar in a
 * dev build), and a network failure is logged as one.
 */
const refused = (
	what: string,
	request: { project_id: string; user_id: string },
	error: unknown,
	status?: number | null,
): MemberOperationResponse => {
	const failure = describeMemberChangeError(error as { code?: string; message?: string; name?: string }, status)
	if (failure.reason === "unknown") {
		logError(`❌ ${what} failed:`, error)
	} else if (failure.reason === "unreachable") {
		logCloudFailure(`❌ ${what} failed:`, error, status)
	} else {
		log(`⛔ ${what} refused (${failure.reason}): ${(error as { message?: string })?.message ?? String(error)}`)
	}
	return memberChangeFailure(request, failure)
}

/**
 * Change a project member's role, through `update_project_member_role`.
 * `updated_by` must be the signed-in user; the RPC refuses anyone else.
 */
export const updateProjectMemberRole = async (
	request: UpdateRoleRequest,
): Promise<MemberOperationResponse> => {
	if (await isKnownOffline()) {
		return memberChangeFailure(request, { reason: "offline", message: OFFLINE_MESSAGE.role })
	}
	try {
		log("🔄 Updating project member role: " + JSON.stringify(request))

		const { data, error, status } = await getSupabaseClient().rpc("update_project_member_role", {
			p_project_id: request.project_id,
			p_user_id: request.user_id,
			p_new_role: request.new_role,
			p_updated_by: request.updated_by,
		})

		if (error) return refused("Role change", request, error, status)
		const reply = data as { success?: boolean; old_role?: ProjectRole; new_role?: ProjectRole } | null
		if (reply?.success !== true) {
			logError("❌ Role change not confirmed: " + JSON.stringify(data))
			return memberChangeFailure(request, { reason: "unknown", message: NOT_CONFIRMED })
		}

		log("✅ Project member role updated: " + JSON.stringify(data))
		return {
			success: true,
			user_id: request.user_id,
			project_id: request.project_id,
			old_role: reply.old_role,
			new_role: reply.new_role ?? request.new_role,
		}
	} catch (error) {
		return refused("Role change", request, error)
	}
}

/**
 * Remove a user from a project, through `remove_project_member`, which
 * soft-deletes their role. `removed_by` must be the signed-in user; the RPC
 * refuses anyone else.
 */
export const removeProjectMember = async (
	request: RemoveMemberRequest,
): Promise<MemberOperationResponse> => {
	if (await isKnownOffline()) {
		return memberChangeFailure(request, { reason: "offline", message: OFFLINE_MESSAGE.remove })
	}
	try {
		log("➖ Removing project member: " + JSON.stringify(request))

		const { data, error, status } = await getSupabaseClient().rpc("remove_project_member", {
			p_project_id: request.project_id,
			p_user_id: request.user_id,
			p_removed_by: request.removed_by,
		})

		if (error) return refused("Member removal", request, error, status)
		const reply = data as { success?: boolean; removed_role?: ProjectRole } | null
		if (reply?.success !== true) {
			logError("❌ Member removal not confirmed: " + JSON.stringify(data))
			return memberChangeFailure(request, { reason: "unknown", message: NOT_CONFIRMED })
		}

		log("✅ Project member removed: " + JSON.stringify(data))
		return {
			success: true,
			user_id: request.user_id,
			project_id: request.project_id,
			removed_role: reply.removed_role,
		}
	} catch (error) {
		return refused("Member removal", request, error)
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

		// 3. Fallback to Supabase, only with a network. Offline the call cannot
		// answer, and with an expired token it first sits out auth-js's refresh
		// retries, about 26 s, while the project details screen waits (#310).
		if (await isKnownOffline()) {
			return null
		}
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
	getProjectMembers,
	updateProjectMemberRole,
	removeProjectMember,
	isProjectAdmin,
	isWWAdmin,
	canAddUserToProject,
	getUserProjectRole,
}
