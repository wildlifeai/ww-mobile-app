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
import { getStoredUserId } from "./auth"
import OutboxService from './OutboxService'
import SupabaseSyncService from './SupabaseSyncService'
import type {
	Project as ProjectType,
	ProjectWithDetails,
	ProjectMemberWithProfile,
	CreateProjectInput,
} from "../types/project"
import UserRoleService from './UserRoleService'
import InvitationService from './InvitationService'
import UserRole from '../database/models/UserRole'
import { managedOrganisationIds, projectRoleIds, seesEverything, seesOrganisation } from './roleAccess'
import { log, logError } from '../utils/logger'
import { DEFAULT_FLASH_LED, DEFAULT_FLASH_MODE } from '../utils/projectFlash'
import { DEFAULT_PHOTO_INTERVAL_MS, DEFAULT_PHOTOS_PER_TRIGGER, resolveProjectBurst } from '../utils/projectBurst'
import { DEFAULT_DETECTION_THRESHOLD_PCT, resolveDetectionThresholdPct } from '../utils/projectDetectionThreshold'


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

			// 2. Build set of accessible project IDs, by the backend's role
			// rules (services/roleAccess.ts, #351)
			if (seesEverything(userRoles)) {
				const allProjects = await this.projectsCollection.query().fetch()
				return await Promise.all(allProjects.map(p => this.enrichProjectWithDetails(p)))
			}

			const projectIds = projectRoleIds(userRoles)
			// An organisation manager sees every project of the organisation,
			// with or without a role on it
			for (const organisationId of managedOrganisationIds(userRoles)) {
				const orgProjects = await this.projectsCollection.query(
					Q.where('organisation_id', organisationId),
					Q.where('is_active', true)
				).fetch()
				orgProjects.forEach(p => projectIds.add(p.id))
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

			// 2. Every project of the organisation for its manager or a ww_admin,
			// by the backend's role rules (services/roleAccess.ts, #351)
			const hasFullAccess = seesOrganisation(userRoles, organisationId)

			if (hasFullAccess) {
				log("✅ User sees the whole organisation, fetching all its projects")
				const allProjects = await this.projectsCollection.query(
					Q.where('organisation_id', organisationId)
				).fetch()
				return await Promise.all(allProjects.map(p => this.enrichProjectWithDetails(p)))
			}

			// 3. Filter specific projects: the project-scope roles
			const accessibleProjectIds = projectRoleIds(userRoles)

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
					project.lorawanRequired = input.lorawan_required || false
					project.isArchived = false
					// Same defaults as the projects table, so a project created
					// offline deploys with a lit capture and night IR (#282).
					project.flashMode = input.flash_mode ?? DEFAULT_FLASH_MODE
					project.flashLed = input.flash_led ?? DEFAULT_FLASH_LED
					project.flashWindowStartMinutesUtc = input.flash_window_start_minutes_utc ?? null
					project.flashWindowMinutes = input.flash_window_minutes ?? null
					// The table defaults too: the app has no control for these,
					// the website owns them (#317). Sent on this insert only;
					// updates leave them out.
					project.photosPerTrigger = DEFAULT_PHOTOS_PER_TRIGGER
					project.photoIntervalMilliseconds = DEFAULT_PHOTO_INTERVAL_MS
					// The detection threshold likewise (#342): 57%, op16 18
					project.detectionThresholdPct = DEFAULT_DETECTION_THRESHOLD_PCT
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

					// The creator is this project's admin from the start. On the server
					// the on_project_created trigger grants it, but offline nothing did,
					// so every role check treated the creator as a stranger to their own
					// project until a sync. This row is local only and never queued:
					// the server makes its own, and syncUserRoles later updates this
					// row in place, since it matches roles by user and scope, not id.
					const creatorRole = database.collections.get<UserRole>('user_roles').prepareCreate(role => {
						role.userId = currentUserId
						role.role = 'project_admin'
						role.scopeType = 'project'
						role.scopeId = newProject!.id
						role.grantedBy = currentUserId
						role.grantedAt = new Date()
						role.isActive = true
						role.modifiedBy = currentUserId
					})

					// 3. Execute batch
					await database.batch(newProject, outboxOp, creatorRole)

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
			const before = this.mapModelToType(project)

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
					if (updates.lorawan_required !== undefined) p.lorawanRequired = updates.lorawan_required ?? false
					if (updates.is_archived !== undefined) p.isArchived = updates.is_archived ?? false
					if (updates.flash_mode !== undefined) p.flashMode = updates.flash_mode ?? DEFAULT_FLASH_MODE
					if (updates.flash_led !== undefined) p.flashLed = updates.flash_led ?? DEFAULT_FLASH_LED
					if (updates.flash_window_start_minutes_utc !== undefined) p.flashWindowStartMinutesUtc = updates.flash_window_start_minutes_utc ?? null
					if (updates.flash_window_minutes !== undefined) p.flashWindowMinutes = updates.flash_window_minutes ?? null

					if (currentUserId) p.modifiedBy = currentUserId
				})

				// 2. Prepare outbox record, carrying only what this edit changed.
				// push_changes keeps any column the payload leaves out, so a stale
				// copy on the phone no longer overwrites a newer value set on the
				// website: on 29 September a Sinbad edit sent the whole record and
				// put back model_id null and GPS off over the website's change (#330).
				const after = this.mapModelToType(project)
				const changed = Object.fromEntries(
					Object.entries(after).filter(([key, value]) => value !== (before as Record<string, unknown>)[key])
				)
				// The burst columns (#317) and the detection threshold (#342) never
				// go out on an update: the website is their only editor
				delete changed.photos_per_trigger
				delete changed.photo_interval_milliseconds
				delete changed.detection_threshold_pct
				const outboxOp = OutboxService.recordOperation({
					operation: 'UPDATE',
					tableName: 'projects',
					recordId: project.id,
					payload: { ...changed, id: project.id, modified_by: after.modified_by, updated_at: after.updated_at },
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
	 * Add member to project, by inviting their email address
	 * Goes through the send_project_invitation RPC, which never looks the
	 * invitee up (#308). Looking them up in public.users told the caller
	 * whether an account existed, and could not invite anyone who had not
	 * signed up yet. The invitation waits until that email signs in.
	 */
	async addProjectMember(
		projectId: string,
		email: string,
		role: 'project_admin' | 'project_member'
	): Promise<void> {
		try {
			const currentUserId = await this.getCurrentUserId()
			if (!currentUserId) throw new Error("User not authenticated")

			await InvitationService.sendInvitation(projectId, email, role)
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
		// Straight from the stored session. getSession() refreshes an expired
		// token first, which offline costs about 26 s of retries and then answers
		// null, so every local project read waited and lost the user (#310).
		// getUser() is worse: it always asks the server.
		return getStoredUserId()
	}

	private async enrichProjectWithDetails(model: Project): Promise<ProjectWithDetails> {
		try {
			log(`[ProjectService] Enriching project: ${model.name} (${model.id})`)

			// Fetch related counts in parallel for performance
			const [memberCount, deploymentCount, activeDeploymentCount] = await Promise.all([
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
				).fetch(),
			])

			// Calculate distinct device count from deployments
			const allDeployments = await database.collections.get('deployments').query(
				Q.where('project_id', model.id)
			).fetch()
			const deploymentDeviceIds = allDeployments.map((d: any) => d.deviceId)
			
			const uniqueDeviceIds = new Set(deploymentDeviceIds)
            
            // Get active devices from ongoing deployments
            const activeDeploymentDeviceIds = new Set(activeDeploymentCount.map((d: any) => d.deviceId))
			
            const lorawanDeviceCount = uniqueDeviceIds.size // keeping this var name for legacy lorawan compatibility if used
            const deviceCount = uniqueDeviceIds.size
            const activeDeviceCount = activeDeploymentDeviceIds.size
            const activeDeployments = activeDeploymentCount.length

			log(`[ProjectService] Enrichment complete for ${model.id}: ${activeDeployments} active out of ${deploymentCount} deployments, ${memberCount} members`)

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
				lorawan_required: model.lorawanRequired || false,
				is_archived: model.isArchived || false,
				flash_mode: model.flashMode || DEFAULT_FLASH_MODE,
				flash_led: model.flashLed || DEFAULT_FLASH_LED,
				flash_window_start_minutes_utc: model.flashWindowStartMinutesUtc ?? null,
				flash_window_minutes: model.flashWindowMinutes ?? null,
				...burstColumns(model),
				detection_threshold_pct: detectionThresholdColumn(model),
				// Computed fields
				member_count: memberCount,
				deployment_count: deploymentCount,
				active_deployment_count: activeDeployments,
				lorawan_device_count: lorawanDeviceCount,
				device_count: deviceCount,
				active_device_count: activeDeviceCount,
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
			lorawan_required: model.lorawanRequired || false,
			is_archived: model.isArchived || false,
			flash_mode: model.flashMode || DEFAULT_FLASH_MODE,
			flash_led: model.flashLed || DEFAULT_FLASH_LED,
			flash_window_start_minutes_utc: model.flashWindowStartMinutesUtc ?? null,
			flash_window_minutes: model.flashWindowMinutes ?? null,
			...burstColumns(model),
			detection_threshold_pct: detectionThresholdColumn(model),
		}
	}
}

/**
 * The two burst columns off a local record, always inside the backend's CHECK
 * ranges: this is also the create push payload, and a value outside them (0 is
 * what WatermelonDB keeps in a number column nobody wrote) would fail the push.
 */
const burstColumns = (model: Project): { photos_per_trigger: number, photo_interval_milliseconds: number } => {
	const { photosPerTrigger, intervalMs } = resolveProjectBurst({
		photos_per_trigger: model.photosPerTrigger,
		photo_interval_milliseconds: model.photoIntervalMilliseconds,
	})
	return { photos_per_trigger: photosPerTrigger, photo_interval_milliseconds: intervalMs }
}

/** The detection threshold off a local record, inside the CHECK range for the same reason (#342). */
const detectionThresholdColumn = (model: Project): number =>
	resolveDetectionThresholdPct({ detection_threshold_pct: model.detectionThresholdPct })

export default new ProjectService()
