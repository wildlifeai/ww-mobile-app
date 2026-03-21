/**
 * ProjectService - Project management service layer
 *
 * Refactored for WatermelonDB Native Sync:
 * - Uses WatermelonDB models for all operations
 * - Sync is handled by SupabaseSyncService
 * - OutboxService integration for automatic sync queueing
 */

import { Q } from '@nozbe/watermelondb'
import database from '../database'
import Project from '../database/models/Project'
import { getSupabaseClient } from "./supabase"
import OutboxService from './OutboxService'
import SupabaseSyncService from './SupabaseSyncService'
import type {
	Project as ProjectType,
	ProjectWithDetails,
	ProjectMemberWithProfile,
	CreateProjectInput,
} from "../types/project"
import UserRoleService from './UserRoleService'
import UserRole from '../database/models/UserRole'
import { log, logError } from '../utils/logger'


class ProjectService {
	private readonly projectsCollection = database.collections.get<Project>('projects')

	/**
	 * Initialize service
	 * No explicit initialization needed for WatermelonDB
	 */
	async initialize(): Promise<void> {
		// No-op
	}

	/**
	 * Get projects that current user has access to
	 * Logic mirrors DeviceService.getDevicesForUser
	 */
	async getProjectsForUser(userId: string): Promise<ProjectWithDetails[]> {
		try {
			// 1. Get user's accessible project IDs via user_roles
			const userRolesCollection = database.collections.get<UserRole>('user_roles')
			const userRoles = await userRolesCollection.query(
				Q.where('user_id', userId),
				Q.where('is_active', true)
			).fetch()

			// 2. Build set of accessible project IDs
			const projectIds = new Set<string>()

			// Check for global admin
			const isGlobalAdmin = userRoles.some(r => r.scopeType === 'global')
			if (isGlobalAdmin) {
				// Return all projects
				const allProjects = await this.projectsCollection.query().fetch()
				return await Promise.all(allProjects.map(p => this.enrichProjectWithDetails(p)))
			}

			// Process other roles
			for (const role of userRoles) {
				if (role.scopeType === 'project' && role.scopeId) {
					projectIds.add(role.scopeId)
				} else if (role.scopeType === 'organisation' && role.scopeId) {
					// Only fetch all projects if user is an Admin in this organisation
					// 'project_admin' at organisation scope = Organisation Admin
					// 'ww_admin' = System Admin (already handled by global check, but safely included here)
					if (role.role === 'project_admin' || role.role === 'ww_admin') {
						const orgProjects = await this.projectsCollection.query(
							Q.where('organisation_id', role.scopeId),
							Q.where('is_active', true)
						).fetch()
						orgProjects.forEach(p => projectIds.add(p.id))
					}
					// If they are just 'organisation_member' (or similar), they get NO projects from this role.
					// They must rely on specific 'project' scoped roles.
				}
			}

			// 3. Optimistic UI: Also fetch projects created by the user locally
			// This ensures immediate visibility even before role sync
			const createdProjects = await this.projectsCollection.query(
				Q.where('created_by', userId),
				Q.where('is_active', true)
			).fetch()
			createdProjects.forEach(p => projectIds.add(p.id))

			if (projectIds.size === 0) {
				return []
			}

			// 4. Fetch all projects by ID
			const projects = await this.projectsCollection.query(
				Q.where('id', Q.oneOf(Array.from(projectIds)))
			).fetch()

			return await Promise.all(projects.map(p => this.enrichProjectWithDetails(p)))

		} catch (error) {
			logError("❌ Failed to fetch user projects:", error)
			return []
		}
	}

	/**
	 * Get projects for user in a specific organisation
	 * Restricts based on user roles:
	 * - Global/Org Admin: Sees all projects in org
	 * - Project Member: Sees only assigned projects
	 * - Organisation Member: Sees only assigned projects (unless specific project roles exist)
	 */
	async getProjectsForUserInOrganisation(userId: string, organisationId: string): Promise<ProjectWithDetails[]> {
		try {
			log(`📂 Fetching projects for user ${userId} in org ${organisationId}`)

			// 1. Get user's roles
			const userRolesCollection = database.collections.get<UserRole>('user_roles')
			const userRoles = await userRolesCollection.query(
				Q.where('user_id', userId),
				Q.where('is_active', true)
			).fetch()

			// 2. Check for Admin privileges


			// Checking UserRole definition: role is 'ww_admin' | 'project_admin' | 'project_member'
			// Typically admin is handled via specific checks.
			// Let's assume 'ww_admin' is global.
			// 'project_admin' at organisation scope might be the "Org Admin".
			// Let's verify what 'organisation_member' maps to.
			// The log says: "role": "organisation_member" in the fetch output, but that might be from a different view.
			// In UserRole.ts, roles are 'ww_admin' | 'project_admin' | 'project_member'.
			// If scopeType is 'organisation', 'project_admin' likely means Organisation Admin.

			// Let's be safe: if they have 'project_admin' (which seems to be the highest non-global role) at ORG scope, they see all.
			// If they are 'ww_admin', they see all.

			const hasFullAccess = userRoles.some(r =>
				r.scopeType === 'global' ||
				(r.scopeType === 'organisation' && r.scopeId === organisationId && r.role === 'project_admin') ||
				(r.scopeType === 'organisation' && r.scopeId === organisationId && r.role === 'ww_admin')
			)

			if (hasFullAccess) {
				log("✅ User has full access (Admin), fetching all projects in org")
				const allProjects = await this.projectsCollection.query(
					Q.where('organisation_id', organisationId)
				).fetch()
				return await Promise.all(allProjects.map(p => this.enrichProjectWithDetails(p)))
			}

			// 3. Filter specific projects
			// Find all roles with scope_type='project'
			const accessibleProjectIds = new Set<string>()

			userRoles.forEach(r => {
				if (r.scopeType === 'project' && r.scopeId) {
					accessibleProjectIds.add(r.scopeId)
				}
			})

			// 4. Also always include projects created by the user in this organisation (Optimistic UI)
			// This covers the case where the user just created a project but the 'admin' role hasn't synced back from server yet.
			const createdProjects = await this.projectsCollection.query(
				Q.where('created_by', userId),
				Q.where('organisation_id', organisationId),
				Q.where('is_active', true)
			).fetch()

			log(`✅ Found ${createdProjects.length} locally created projects`)

			// 5. Fetch role-accessible projects
			let roleProjects: Project[] = []
			if (accessibleProjectIds.size > 0) {
				const projects = await this.projectsCollection.query(
					Q.where('id', Q.oneOf(Array.from(accessibleProjectIds)))
				).fetch()
				roleProjects = projects.filter(p => p.organisationId === organisationId)
			}

			// 6. Merge and Deduplicate
			// Use a Map to deduplicate by ID
			const projectMap = new Map<string, Project>()

			// Add role projects first
			roleProjects.forEach(p => projectMap.set(p.id, p))

			// Add created projects (will overwrite duplicates, which is fine as they are the same record)
			createdProjects.forEach(p => projectMap.set(p.id, p))

			const uniqueProjects = Array.from(projectMap.values())

			log(`✅ Total accessible projects (Roles + Created): ${uniqueProjects.length}`)

			return await Promise.all(uniqueProjects.map(p => this.enrichProjectWithDetails(p)))

		} catch (error) {
			logError("❌ Failed to fetch user projects:", error)
			return []
		}
	}

	/**
	 * Get single project by ID with full details
	 * Reads from local WatermelonDB
	 */
	async getProjectById(projectId: string): Promise<ProjectWithDetails | null> {
		try {
			log("📂 Reading project from WatermelonDB:", projectId)

			const project = await this.projectsCollection.find(projectId)

			if (!project) {
				log("❌ Project not found in WatermelonDB:", projectId)
				return null
			}

			log("✅ Found project in WatermelonDB:", project.name)

			const details = await this.enrichProjectWithDetails(project)

			// Populate user role
			const currentUserId = await this.getCurrentUserId()
			if (currentUserId) {
				const role = await UserRoleService.getUserProjectRole(projectId, currentUserId)
				if (role) {
					details.role = role
					log(`✅ User role for project ${projectId}: ${role}`)
				}
			}

			return details
		} catch (error) {
			logError("❌ Failed to fetch project from WatermelonDB:", error)
			// WatermelonDB throws if record not found
			return null
		}
	}

	/**
	 * Create new project
	 * Saves to local WatermelonDB, queues for sync, and triggers background sync.
	 */
	async createProject(input: CreateProjectInput): Promise<ProjectType> {
		const currentUserId = await this.getCurrentUserId()
		if (!currentUserId) throw new Error("User not authenticated")

		try {
			log("🛠️ Creating project in WatermelonDB:", input.name)

			let newProject: Project | undefined

			await database.write(async () => {

				// 1. Prepare project creation

				newProject = this.projectsCollection.prepareCreate(project => {
					project.name = input.name
					project.description = input.description || ''
					project.organisationId = input.organisation_id
					project.samplingDesignId = input.sampling_design_id ?? null
					project.website = input.website ?? null
					project.createdBy = currentUserId
					project.modifiedBy = currentUserId
					project.isActive = true
					project.timelapseIntervalSeconds = input.timelapse_interval_seconds ?? null
					project.activityDetectionSensitivityId = input.activity_detection_sensitivity_id ?? null
					project.captureMethodId = input.capture_method_id ?? null
					project.modelId = input.model_id ?? null
					project.isBaited = input.is_baited || false
					project.recordGpsInImages = input.record_gps_in_images || false
				})


				// 2. Prepare outbox record
				log("📦 Preparing outbox record for project:", newProject.id)

				try {
					const outboxOp = OutboxService.recordOperation({
						operation: 'CREATE',
						tableName: 'projects',
						recordId: newProject.id,
						payload: this.mapModelToType(newProject),
						userId: currentUserId,
					})

					log("✅ Outbox record prepared, executing batch...")

					// 3. Execute batch
					await database.batch(newProject, outboxOp)

					log("✅ Batch executed successfully - project and outbox record created")
				} catch (outboxError) {
					logError("❌ Failed to create outbox record:", outboxError)
					throw new Error(`Outbox creation failed: ${outboxError instanceof Error ? outboxError.message : String(outboxError)}`)
				}

			})

			if (!newProject) throw new Error("Failed to create project instance")

			log("✅ Project created locally:", newProject.id)

			// Trigger background sync (debounced to batch operations)
			SupabaseSyncService.debouncedSync()

			return this.mapModelToType(newProject)
		} catch (error) {
			logError("❌ Failed to create project:", error)
			throw new Error(
				`Failed to create project: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Update existing project
	 * Updates local WatermelonDB, queues for sync, and triggers background sync.
	 */
	async updateProject(
		projectId: string,
		updates: Partial<ProjectType>,
	): Promise<ProjectType> {
		try {
			log("🛠️ Updating project in WatermelonDB:", projectId)

			const project = await this.projectsCollection.find(projectId)
			const currentUserId = await this.getCurrentUserId()

			await database.write(async () => {
				// 1. Prepare project update
				const projectUpdate = project.prepareUpdate(p => {
					if (updates.name !== undefined) p.name = updates.name
					if (updates.description !== undefined) p.description = updates.description || ''
					if (updates.sampling_design_id !== undefined) p.samplingDesignId = updates.sampling_design_id ?? null
					if (updates.website !== undefined) p.website = updates.website ?? null
					if (updates.is_active !== undefined) p.isActive = updates.is_active ?? true
					if (updates.timelapse_interval_seconds !== undefined) p.timelapseIntervalSeconds = updates.timelapse_interval_seconds ?? null
					if (updates.activity_detection_sensitivity_id !== undefined) p.activityDetectionSensitivityId = updates.activity_detection_sensitivity_id ?? null
					if (updates.capture_method_id !== undefined) p.captureMethodId = updates.capture_method_id ?? null
					if (updates.model_id !== undefined) p.modelId = updates.model_id ?? null
					if (updates.is_baited !== undefined) p.isBaited = updates.is_baited ?? false
					if (updates.record_gps_in_images !== undefined) p.recordGpsInImages = updates.record_gps_in_images ?? false

					if (currentUserId) p.modifiedBy = currentUserId
				})

				// 2. Prepare outbox record
				const outboxOp = OutboxService.recordOperation({
					operation: 'UPDATE',
					tableName: 'projects',
					recordId: project.id,
					payload: this.mapModelToType(project),
					userId: currentUserId || undefined,
				})

				// 3. Execute batch
				await database.batch(projectUpdate, outboxOp)
			})

			log("✅ Project updated locally:", projectId)

			// Trigger background sync
			SupabaseSyncService.debouncedSync()

			return this.mapModelToType(project)
		} catch (error) {
			logError("❌ Failed to update project:", error)
			throw new Error(
				`Failed to update project: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Delete project (Soft Delete)
	 * Marks as deleted in WatermelonDB, queues for sync, and triggers background sync.
	 */
	async deleteProject(projectId: string): Promise<void> {
		try {
			log("🗑️ Deleting project in WatermelonDB:", projectId)

			const project = await this.projectsCollection.find(projectId)
			const currentUserId = await this.getCurrentUserId()

			await database.write(async () => {
				// 1. Prepare project deletion
				const projectDelete = project.prepareMarkAsDeleted()

				// 2. Prepare outbox record
				const outboxOp = OutboxService.recordOperation({
					operation: 'DELETE',
					tableName: 'projects',
					recordId: project.id,
					payload: { id: project.id },
					userId: currentUserId || undefined,
				})

				// 3. Execute batch
				await database.batch(projectDelete, outboxOp)
			})

			log("✅ Project marked as deleted locally:", projectId)

			// Trigger background sync
			SupabaseSyncService.debouncedSync()
		} catch (error) {
			logError("❌ Failed to delete project:", error)
			throw new Error(
				`Failed to delete project: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Get project members
	 * Delegates to UserRoleService
	 */
	async getProjectMembers(projectId: string): Promise<ProjectMemberWithProfile[]> {
		try {
			const currentUserId = await this.getCurrentUserId()
			if (!currentUserId) return []

			const members = await UserRoleService.getProjectMembers(projectId, currentUserId)

			// Map to ProjectMemberWithProfile to maintain compatibility
			return members.map(m => ({
				id: m.id, // Using user_id as ID for now, or we could fetch the user_role ID if needed
				project_id: projectId,
				user_id: m.id,
				email: m.email,
				role: m.role,
				created_at: m.granted_at,
				updated_at: m.granted_at,
				user_profile: { 
					name: m.name,
					firstname: m.firstname,
					surname: m.surname,
					email: m.email 
				},
				role_details: {
					value: m.role,
					description: m.role === 'project_admin' ? 'Project Admin' : 'Project Member'
				}
			})) as ProjectMemberWithProfile[]
		} catch (error) {
			logError("Failed to fetch project members:", error)
			return []
		}
	}

	/**
	 * Add member to project
	 * Delegates to UserRoleService
	 */
	async addProjectMember(
		projectId: string,
		email: string,
		role: 'project_admin' | 'project_member'
	): Promise<void> {
		try {
			const currentUserId = await this.getCurrentUserId()
			if (!currentUserId) throw new Error("User not authenticated")

			// 1. Find user by email
			const { data: user, error: userError } = await getSupabaseClient()
				.from('users')
				.select('id')
				.eq('email', email)
				.single()

			if (userError || !user) {
				throw new Error(`User with email ${email} not found`)
			}

			// 2. Add member via UserRoleService
			const result = await UserRoleService.addProjectMember({
				project_id: projectId,
				user_id: user.id,
				role,
				granted_by: currentUserId
			})

			if (!result.success) {
				throw new Error(result.error || "Failed to add project member")
			}
		} catch (error) {
			logError("Failed to add project member:", error)
			throw error
		}
	}

	/**
	 * Remove member from project
	 * Delegates to UserRoleService
	 */
	async removeProjectMember(projectId: string, userId: string): Promise<void> {
		try {
			const currentUserId = await this.getCurrentUserId()
			if (!currentUserId) throw new Error("User not authenticated")

			const result = await UserRoleService.removeProjectMember({
				project_id: projectId,
				user_id: userId,
				removed_by: currentUserId
			})

			if (!result.success) {
				throw new Error(result.error || "Failed to remove project member")
			}
		} catch (error) {
			logError("Failed to remove project member:", error)
			throw error
		}
	}

	// --- Private Helpers ---

	private async getCurrentUserId(): Promise<string | null> {
		// Use getSession() instead of getUser() - works offline by reading from AsyncStorage
		// getUser() tries to verify with server, which fails when offline
		const { data: { session } } = await getSupabaseClient().auth.getSession()
		return session?.user?.id || null
	}

	private async enrichProjectWithDetails(model: Project): Promise<ProjectWithDetails> {
		try {
			log(`[ProjectService] Enriching project: ${model.name} (${model.id})`)

			// Fetch related counts in parallel for performance
			const [memberCount, deploymentCount, activeDeploymentCount, devicePreparations] = await Promise.all([
				database.collections.get('user_roles').query(
					Q.where('scope_type', 'project'),
					Q.where('scope_id', model.id),
					Q.where('is_active', true)
				).fetchCount(),

				database.collections.get('deployments').query(
					Q.where('project_id', model.id)
				).fetchCount(),

				database.collections.get('deployments').query(
					Q.where('project_id', model.id),
					Q.where('deployment_end', null)
				).fetchCount(),

				database.collections.get('device_preparation').query(
					Q.where('project_id', model.id)
					// Note: Q.where('deleted_at', null) is intentionally omitted.
					// WatermelonDB natively filters out soft-deleted records via its internal `_status` column.
				).fetch()
			])

			// Calculate distinct device count
			const uniqueDeviceIds = new Set(devicePreparations.map((dp: any) => dp.deviceId))
			const lorawanDeviceCount = uniqueDeviceIds.size

			log(`[ProjectService] Enrichment complete for ${model.id}: ${deploymentCount} deployments, ${memberCount} members`)

			return {
				id: model.id,
				name: model.name,
				description: model.description || '',
				organisation_id: model.organisationId,
				created_at: new Date(model.createdAt).toISOString(),
				updated_at: new Date(model.updatedAt).toISOString(),
				deleted_at: model.deletedAt ? new Date(model.deletedAt).toISOString() : null,
				sampling_design_id: model.samplingDesignId || null,
				website: model.website || null,
				created_by: model.createdBy || '',
				modified_by: model.modifiedBy || '',
				is_active: model.isActive,
				timelapse_interval_seconds: model.timelapseIntervalSeconds || null,
				activity_detection_sensitivity_id: model.activityDetectionSensitivityId || null,
				capture_method_id: model.captureMethodId || null,
				model_id: model.modelId || null,
				is_baited: model.isBaited || false,
				is_monitoring_marked_individuals: model.isMonitoringMarkedIndividuals || false,
				project_image: model.projectImage || null,
				record_gps_in_images: model.recordGpsInImages || false,
				// Computed fields
				member_count: memberCount,
				deployment_count: deploymentCount,
				active_deployment_count: activeDeploymentCount,
				lorawan_device_count: lorawanDeviceCount,
			}
		} catch (error) {
			logError(`[ProjectService] Error enriching project ${model.id}:`, error)
			// Return basic info as fallback
			return this.mapModelToType(model) as ProjectWithDetails
		}
	}

	private mapModelToType(model: Project): ProjectType {
		return {
			id: model.id,
			name: model.name,
			description: model.description || '',
			organisation_id: model.organisationId,
			created_at: new Date(model.createdAt).toISOString(),
			updated_at: new Date(model.updatedAt).toISOString(),
			deleted_at: model.deletedAt ? new Date(model.deletedAt).toISOString() : null,
			sampling_design_id: model.samplingDesignId || null,
			website: model.website || null,
			created_by: model.createdBy || '',
			modified_by: model.modifiedBy || '',
			is_active: model.isActive,
			timelapse_interval_seconds: model.timelapseIntervalSeconds || null,
			activity_detection_sensitivity_id: model.activityDetectionSensitivityId || null,
			capture_method_id: model.captureMethodId || null,
			model_id: model.modelId || null,
			is_baited: model.isBaited || false,
			is_monitoring_marked_individuals: model.isMonitoringMarkedIndividuals || false,
			project_image: model.projectImage || null,
			record_gps_in_images: model.recordGpsInImages || false,
		}
	}
}

export default new ProjectService()
