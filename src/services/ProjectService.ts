})

if (!newProject) throw new Error("Failed to create project instance")

console.log("✅ Project created in WatermelonDB and recorded in outbox:", newProject.id)

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
	 * Updates local WatermelonDB and records in outbox for sync.
	 */
	async updateProject(
	projectId: string,
	updates: Partial<Project>,
): Promise < Project > {
	try {
		console.log("💾 Updating project in WatermelonDB:", projectId)

			const project = await this.projectsCollection.find(projectId)
			const currentUserId = await this.getCurrentUserId()

			await database.write(async () => {
			// 1. Update local database and increment version
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

				// Increment version and mark as pending sync
				p.version = project.version + 1
				p.customSyncStatus = 'pending'
			})

			// 2. Record operation in outbox for sync
			await OutboxService.recordOperation({
				operation: 'UPDATE',
				tableName: 'projects',
				recordId: project.id,
				payload: {
					id: project.id,
					name: project.name,
					description: project.description,
					organisation_id: project.organisationId,
					sampling_design_id: project.samplingDesignId,
					website: project.website,
					modified_by: project.modifiedBy,
					is_active: project.isActive,
					timelapse_interval_seconds: project.timelapseIntervalSeconds,
					activity_detection_sensitivity_id: project.activityDetectionSensitivityId,
					capture_method_id: project.captureMethodId,
					model_id: project.modelId,
					is_baited: project.isBaited,
					updated_at: Date.now(),
					_version: project.version
				},
				version: project.version,
				userId: currentUserId || undefined
			})
		})

			console.log("✅ Project updated in WatermelonDB and recorded in outbox:", projectId)

			return this.mapModelToType(project)
	} catch(error) {
		console.error("❌ Failed to update project:", error)
		throw new Error(
			`Failed to update project: ${error instanceof Error ? error.message : String(error)}`
		)
	}
}

	/**
	 * Delete project (Soft Delete)
	 * Marks as deleted in WatermelonDB and records in outbox for sync.
	 */
	async deleteProject(projectId: string): Promise < void> {
	try {
		console.log("🗑️ Deleting project in WatermelonDB:", projectId)

			const project = await this.projectsCollection.find(projectId)
			const currentUserId = await this.getCurrentUserId()

			await database.write(async () => {
			// 1. Record operation in outbox BEFORE deleting
			// (so we can still access project data)
			await OutboxService.recordOperation({
				operation: 'DELETE',
				tableName: 'projects',
				recordId: project.id,
				payload: {
					id: project.id,
					_version: project.version
				},
				version: project.version,
				userId: currentUserId || undefined
			})

			// 2. Soft delete locally
			await project.markAsDeleted()
		})

			console.log("✅ Project deleted in WatermelonDB and recorded in outbox:", projectId)
	} catch(error) {
		console.error("❌ Failed to delete project:", error)
		throw new Error(
			`Failed to delete project: ${error instanceof Error ? error.message : String(error)}`
		)
	}
}

	/**
	 * Get project members
	 * 
	 * NOTE: Project member management is not yet in WatermelonDB schema.
	 * This currently requires online connectivity and uses Supabase RPC.
	 * 
	 * TODO for full offline support:
	 * 1. Add project_members table to WatermelonDB schema
	 * 2. Add member CRUD to OutboxService
	 * 3. Update sync to handle member operations
	 */
	async getProjectMembers(projectId: string): Promise < ProjectMemberWithProfile[] > {
	try {
		const supabase = getSupabaseClient()
			const { data, error } = await (supabase as any).rpc('get_project_members', {
			p_project_id: projectId,
		})

			if(error) throw error

			return data as ProjectMemberWithProfile[]
	} catch(error) {
		console.error("Failed to fetch project members:", error)
		return []
	}
}

	/**
	 * Add member to project
	 * 
	 * NOTE: Requires online connectivity. For full offline support,
	 * project_members table needs to be added to WatermelonDB schema.
	 */
	async addProjectMember(
	projectId: string,
	email: string,
	role: 'project_admin' | 'project_member'
): Promise < void> {
	try {
		const supabase = getSupabaseClient()
			const { error } = await (supabase as any).rpc('add_project_member', {
			p_project_id: projectId,
			p_email: email,
			p_role: role,
		})

			if(error) throw error
	} catch(error) {
		console.error("Failed to add project member:", error)
		throw error
	}
}

	/**
	 * Remove member from project
	 * 
	 * NOTE: Requires online connectivity. For full offline support,
	 * project_members table needs to be added to WatermelonDB schema.
	 */
	async removeProjectMember(projectId: string, userId: string): Promise < void> {
	try {
		const supabase = getSupabaseClient()
			const { error } = await (supabase as any).rpc('remove_project_member', {
			p_project_id: projectId,
			p_user_id: userId,
		})

			if(error) throw error
	} catch(error) {
		console.error("Failed to remove project member:", error)
		throw error
	}
}

	// --- Private Helpers ---

	private async getCurrentUserId(): Promise < string | null > {
	const supabase = getSupabaseClient()
		const { data: { user } } = await supabase.auth.getUser()
		return user?.id || null
}

	private mapModelToDetails(model: ProjectModel): ProjectWithDetails {
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

	private mapModelToType(model: ProjectModel): Project {
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
