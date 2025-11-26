/**
 * ProjectService - Project management service layer
 *
 * Refactored for WatermelonDB Native Sync:
 * - Uses WatermelonDB models for all operations
 * - Sync is handled by SupabaseSyncService
 * - Removed DatabaseService and OfflineService dependencies
 */

import { Q } from '@nozbe/watermelondb'
import database from '../database'
import Project from '../database/models/Project'
import { supabase } from "./supabase"
import type {
	Project as ProjectType,
	ProjectWithDetails,
	ProjectMemberWithProfile,
	CreateProjectInput,
} from "../types/project"

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
			console.log("≡ƒôé Reading projects from WatermelonDB for org:", organisationId)

			const projects = await this.projectsCollection
				.query(
					Q.where('organisation_id', organisationId),
					// Q.where('deleted_at', null) // WatermelonDB filters deleted records by default
				)
				.fetch()

			console.log(`Γ£à Found ${projects.length} projects in WatermelonDB`)

			return projects.map(p => this.mapModelToDetails(p))
		} catch (error) {
			console.error("Γ¥î Failed to fetch projects from WatermelonDB:", error)
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
			console.log("≡ƒôé Reading project from WatermelonDB:", projectId)

			const project = await this.projectsCollection.find(projectId)

			if (!project) {
				console.log("Γ¥î Project not found in WatermelonDB:", projectId)
				return null
			}

			console.log("Γ£à Found project in WatermelonDB:", project.name)

			return this.mapModelToDetails(project)
		} catch (error) {
			console.error("Γ¥î Failed to fetch project from WatermelonDB:", error)
			// WatermelonDB throws if record not found
			return null
		}
	}

	/**
	 * Create new project
	 * Saves to local WatermelonDB. Sync engine handles pushing to server.
	 */
	async createProject(input: CreateProjectInput): Promise<ProjectType> {
		const currentUserId = await this.getCurrentUserId()
		if (!currentUserId) throw new Error("User not authenticated")

		try {
			console.log("≡ƒÆ╛ Creating project in WatermelonDB:", input.name)

			let newProject: Project | undefined

			await database.write(async () => {
				newProject = await this.projectsCollection.create(project => {
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
			})

			if (!newProject) throw new Error("Failed to create project instance")

			console.log("Γ£à Project created locally:", newProject.id)

			return this.mapModelToType(newProject)
		} catch (error) {
			console.error("Γ¥î Failed to create project:", error)
			throw new Error(
				`Failed to create project: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Update existing project
	 * Updates local WatermelonDB. Sync engine handles pushing to server.
	 */
	async updateProject(
		projectId: string,
		updates: Partial<ProjectType>,
	): Promise<ProjectType> {
		try {
			console.log("≡ƒÆ╛ Updating project in WatermelonDB:", projectId)

			const project = await this.projectsCollection.find(projectId)
			const currentUserId = await this.getCurrentUserId()

			await database.write(async () => {
				await project.update(p => {
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
			})

			console.log("Γ£à Project updated locally:", projectId)

			return this.mapModelToType(project)
		} catch (error) {
			console.error("Γ¥î Failed to update project:", error)
			throw new Error(
				`Failed to update project: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Delete project (Soft Delete)
	 * Marks as deleted in WatermelonDB. Sync engine handles pushing to server.
	 */
	async deleteProject(projectId: string): Promise<void> {
		try {
			console.log("≡ƒùæ∩╕Å Deleting project in WatermelonDB:", projectId)

			const project = await this.projectsCollection.find(projectId)

			await database.write(async () => {
				await project.markAsDeleted()
			})

			console.log("Γ£à Project marked as deleted locally:", projectId)
		} catch (error) {
			console.error("Γ¥î Failed to delete project:", error)
			throw new Error(
				`Failed to delete project: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Get project members
	 * Note: Project Members are not yet in WatermelonDB, so we fetch from Supabase via RPC
	 */
	async getProjectMembers(projectId: string): Promise<ProjectMemberWithProfile[]> {
		try {
			const { data, error } = await (supabase as any).rpc('get_project_members', {
				p_project_id: projectId,
			})

			if (error) throw error

			return data as ProjectMemberWithProfile[]
		} catch (error) {
			console.error("Failed to fetch project members:", error)
			return []
		}
	}

	/**
	 * Add member to project
	 * Note: Uses Supabase RPC directly
	 */
	async addProjectMember(
		projectId: string,
		email: string,
		role: 'project_admin' | 'project_member'
	): Promise<void> {
		try {
			const { error } = await (supabase as any).rpc('add_project_member', {
				p_project_id: projectId,
				p_email: email,
				p_role: role,
			})

			if (error) throw error
		} catch (error) {
			console.error("Failed to add project member:", error)
			throw error
		}
	}

	/**
	 * Remove member from project
	 * Note: Uses Supabase RPC directly
	 */
	async removeProjectMember(projectId: string, userId: string): Promise<void> {
		try {
			const { error } = await (supabase as any).rpc('remove_project_member', {
				p_project_id: projectId,
				p_user_id: userId,
			})

			if (error) throw error
		} catch (error) {
			console.error("Failed to remove project member:", error)
			throw error
		}
	}

	// --- Private Helpers ---

	private async getCurrentUserId(): Promise<string | null> {
		const { data: { user } } = await supabase.auth.getUser()
		return user?.id || null
	}

	private mapModelToDetails(model: Project): ProjectWithDetails {
		return {
			id: model.id,
			name: model.name,
			description: model.description,
			organisation_id: model.organisationId,
			created_at: new Date(model.createdAt).toISOString(),
			updated_at: new Date(model.updatedAt).toISOString(),
			sampling_design_id: model.samplingDesignId || null,
			website: model.website || null,
			created_by: model.createdBy,
			modified_by: model.modifiedBy,
			is_active: model.isActive,
			timelapse_interval_seconds: model.timelapseIntervalSeconds || null,
			activity_detection_sensitivity_id: model.activityDetectionSensitivityId || null,
			capture_method_id: model.captureMethodId || null,
			model_id: model.modelId || null,
			is_baited: model.isBaited,
			role: 'project_admin', // Default role, should be enriched if needed
			members: [], // Members are fetched separately
			deployments_count: 0, // Deployments are fetched separately
		}
	}

	private mapModelToType(model: Project): ProjectType {
		return {
			id: model.id,
			name: model.name,
			description: model.description,
			organisation_id: model.organisationId,
			created_at: new Date(model.createdAt).toISOString(),
			updated_at: new Date(model.updatedAt).toISOString(),
			sampling_design_id: model.samplingDesignId || null,
			website: model.website || null,
			created_by: model.createdBy,
			modified_by: model.modifiedBy,
			is_active: model.isActive,
			timelapse_interval_seconds: model.timelapseIntervalSeconds || null,
			activity_detection_sensitivity_id: model.activityDetectionSensitivityId || null,
			capture_method_id: model.captureMethodId || null,
			model_id: model.modelId || null,
			is_baited: model.isBaited,
		}
	}
}

export default new ProjectService()
