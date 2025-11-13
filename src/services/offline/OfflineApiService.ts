import { supabase } from "../supabase"
import {
	Project,
	ProjectCreate,
	ProjectUpdate,
	Deployment,
	DeploymentCreate,
	DeploymentUpdate,
} from "../../types/api.types"

/**
 * Offline API Service - Handles API calls for offline sync operations
 *
 * Architecture Decision (confirmed by system-architect + mobile-dev agents):
 * - Uses Supabase client directly (NOT RTK Query) to avoid circular dependencies
 * - RTK Query is for online operations (UI-driven)
 * - OfflineApiService is for background sync operations (system-driven)
 * - Cache invalidation callback injected to update RTK Query after sync
 */

// Cache invalidation callback type
type CacheInvalidator = (tags: { type: string; id?: string }[]) => void

export class OfflineApiService {
	private static cacheInvalidator?: CacheInvalidator

	/**
	 * Set cache invalidation callback (called from Redux store setup)
	 */
	static setCacheInvalidator(invalidator: CacheInvalidator): void {
		this.cacheInvalidator = invalidator
	}

	/**
	 * Create project via Supabase (sync operation)
	 * Invalidates RTK Query cache after successful creation
	 */
	static async createProject(projectData: ProjectCreate): Promise<Project> {
		const { data, error } = await supabase
			.from("projects")
			.insert([projectData])
			.select()
			.single()

		if (error) {
			throw new Error(`Failed to create project: ${error.message}`)
		}

		// Invalidate RTK Query cache to trigger UI refresh
		this.cacheInvalidator?.([
			{ type: "Project", id: data.id },
			{ type: "Project", id: "LIST" },
		])

		return data
	}

	/**
	 * Update project via Supabase (sync operation)
	 * Invalidates RTK Query cache after successful update
	 */
	static async updateProject(
		id: string,
		updateData: ProjectUpdate,
	): Promise<Project> {
		const { data, error } = await supabase
			.from("projects")
			.update(updateData)
			.eq("id", id)
			.select()
			.single()

		if (error) {
			throw new Error(`Failed to update project: ${error.message}`)
		}

		// Invalidate specific project cache
		this.cacheInvalidator?.([{ type: "Project", id }])

		return data
	}

	/**
	 * Delete project via Supabase (sync operation)
	 * Uses soft delete by setting deleted_at timestamp
	 * Invalidates RTK Query cache after successful deletion
	 */
	static async deleteProject(id: string): Promise<void> {
		// Soft delete: set deleted_at timestamp instead of hard delete
		const { error } = await supabase
			.from("projects")
			.update({ deleted_at: new Date().toISOString() })
			.eq("id", id)

		if (error) {
			throw new Error(`Failed to delete project: ${error.message}`)
		}

		// Invalidate project cache (removed item)
		this.cacheInvalidator?.([
			{ type: "Project", id },
			{ type: "Project", id: "LIST" },
		])
	}

	/**
	 * Create deployment via Supabase (sync operation)
	 * Invalidates RTK Query cache after successful creation
	 */
	static async createDeployment(
		deploymentData: DeploymentCreate,
	): Promise<Deployment> {
		const { data, error } = await supabase
			.from("deployments")
			.insert([deploymentData])
			.select()
			.single()

		if (error) {
			throw new Error(`Failed to create deployment: ${error.message}`)
		}

		// Invalidate deployment cache
		this.cacheInvalidator?.([
			{ type: "Deployment", id: data.id },
			{ type: "Deployment", id: "LIST" },
		])

		return data
	}

	/**
	 * Update deployment via Supabase (sync operation)
	 * Invalidates RTK Query cache after successful update
	 */
	static async updateDeployment(
		id: string,
		updateData: DeploymentUpdate,
	): Promise<Deployment> {
		const { data, error } = await supabase
			.from("deployments")
			.update(updateData)
			.eq("id", id)
			.select()
			.single()

		if (error) {
			throw new Error(`Failed to update deployment: ${error.message}`)
		}

		// Invalidate specific deployment cache
		this.cacheInvalidator?.([{ type: "Deployment", id }])

		return data
	}

	/**
	 * Delete deployment via Supabase (sync operation)
	 * Invalidates RTK Query cache after successful deletion
	 */
	static async deleteDeployment(id: string): Promise<void> {
		const { error } = await supabase.from("deployments").delete().eq("id", id)

		if (error) {
			throw new Error(`Failed to delete deployment: ${error.message}`)
		}

		// Invalidate deployment cache
		this.cacheInvalidator?.([
			{ type: "Deployment", id },
			{ type: "Deployment", id: "LIST" },
		])
	}

	/**
	 * Get project via Supabase (for conflict resolution)
	 */
	static async getProject(id: string): Promise<Project> {
		const { data, error } = await supabase
			.from("projects")
			.select("*")
			.eq("id", id)
			.single()

		if (error) {
			throw new Error(`Failed to get project: ${error.message}`)
		}

		return data
	}

	/**
	 * Get deployment via Supabase (for conflict resolution)
	 */
	static async getDeployment(id: string): Promise<Deployment> {
		const { data, error } = await supabase
			.from("deployments")
			.select("*")
			.eq("id", id)
			.single()

		if (error) {
			throw new Error(`Failed to get deployment: ${error.message}`)
		}

		return data
	}
}
