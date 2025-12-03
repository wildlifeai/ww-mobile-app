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
	 * Get all projects for current user's organisation
	 * Reads from local WatermelonDB
	 */
	async getUserProjects(organisationId: string): Promise<ProjectWithDetails[]> {
		try {
			console.log("📂 Reading projects from WatermelonDB for org:", organisationId)

			const projects = await this.projectsCollection
				.query(
					Q.where('organisation_id', organisationId),
					// Q.where('deleted_at', null) // WatermelonDB filters deleted records by default
				)
				.fetch()

			console.log(`✅ Found ${projects.length} projects in WatermelonDB`)

			return projects.map(p => this.mapModelToDetails(p))
		} catch (error) {
			console.error("❌ Failed to fetch projects from WatermelonDB:", error)
			throw new Error(
				`Failed to fetch projects: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Get single project by ID with full details
	 * Reads from local WatermelonDB
	 */
	async getProjectById(projectId: string): Promise<ProjectWithDetails | null> {
		try {
			console.log("📂 Reading project from WatermelonDB:", projectId)

			const project = await this.projectsCollection.find(projectId)

			if (!project) {
				console.log("❌ Project not found in WatermelonDB:", projectId)
				return null
			}

			console.log("✅ Found project in WatermelonDB:", project.name)

			const details = this.mapModelToDetails(project)

			// Populate user role
			const currentUserId = await this.getCurrentUserId()
			if (currentUserId) {
				const role = await UserRoleService.getUserProjectRole(projectId, currentUserId)
				if (role) {
					details.role = role
					console.log(`✅ User role for project ${projectId}: ${role}`)
				}
			}

			return details
		} catch (error) {
			console.error("❌ Failed to fetch project from WatermelonDB:", error)
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
			console.log("🛠️ Creating project in WatermelonDB:", input.name)

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
				})


				// 2. Prepare outbox record




				const outboxOp = OutboxService.recordOperation({
					operation: 'CREATE',
					tableName: 'projects',
					recordId: newProject.id,
					payload: this.mapModelToType(newProject),
					userId: currentUserId,
				})


				// 3. Execute batch

				await database.batch(newProject, outboxOp)

			})

			if (!newProject) throw new Error("Failed to create project instance")

			console.log("✅ Project created locally:", newProject.id)

			// Trigger background sync (debounced to batch operations)
			SupabaseSyncService.debouncedSync()

			return this.mapModelToType(newProject)
		} catch (error) {
			console.error("❌ Failed to create project:", error)
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
			console.log("🛠️ Updating project in WatermelonDB:", projectId)

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

			console.log("✅ Project updated locally:", projectId)

			// Trigger background sync
			SupabaseSyncService.debouncedSync()

			return this.mapModelToType(project)
		} catch (error) {
			console.error("❌ Failed to update project:", error)
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
			console.log("🗑️ Deleting project in WatermelonDB:", projectId)

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

			console.log("✅ Project marked as deleted locally:", projectId)

			// Trigger background sync
			SupabaseSyncService.debouncedSync()
		} catch (error) {
			console.error("❌ Failed to delete project:", error)
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
				role: m.role,
				created_at: m.granted_at,
				updated_at: m.granted_at,
				user_profile: { name: m.name },
				role_details: {
					value: m.role,
					description: m.role === 'project_admin' ? 'Project Admin' : 'Project Member'
				}
			})) as ProjectMemberWithProfile[]
		} catch (error) {
			console.error("Failed to fetch project members:", error)
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
			console.error("Failed to add project member:", error)
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
			console.error("Failed to remove project member:", error)
			throw error
		}
	}

	// --- Private Helpers ---

	private async getCurrentUserId(): Promise<string | null> {
		const { data: { user } } = await getSupabaseClient().auth.getUser()
		return user?.id || null
	}

	private mapModelToDetails(model: Project): ProjectWithDetails {
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
			// Computed fields
			member_count: 0,
			deployment_count: 0,
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
		}
	}
}

export default new ProjectService()
