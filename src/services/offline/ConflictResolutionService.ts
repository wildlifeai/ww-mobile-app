import { DatabaseService } from "./DatabaseService"
import {
	ConflictResolution,
	ConflictType,
	OfflineOperation,
	User,
} from "../../types/offline"

/**
 * ConflictResolutionService - Advanced conflict resolution for offline-first data synchronization
 *
 * Features:
 * - Multiple resolution strategies (server wins, local wins, merge, user choice)
 * - Field-level conflict detection and resolution
 * - Organisation-aware conflict handling
 * - Automated resolution for common conflict types
 * - User intervention for complex conflicts
 */
export class ConflictResolutionService {
	private databaseService: DatabaseService

	constructor(databaseService: DatabaseService) {
		this.databaseService = databaseService
	}

	/**
	 * Detect conflicts between server data and local data
	 */
	async detectConflicts(
		serverData: any,
		localData: any,
		operationType: string,
		user: User,
	): Promise<ConflictResolution[]> {
		const conflicts: ConflictResolution[] = []

		// Check for data modification conflicts
		if (this.hasDataModificationConflict(serverData, localData)) {
			conflicts.push(
				this.createConflictResolution(
					serverData,
					localData,
					"data_modification",
				),
			)
		}

		// Check for deletion conflicts
		if (this.hasDeletionConflict(serverData, localData, operationType)) {
			conflicts.push(
				this.createConflictResolution(
					serverData,
					localData,
					"deletion_conflict",
				),
			)
		}

		// Check for permission conflicts
		if (await this.hasPermissionConflict(serverData, localData, user)) {
			conflicts.push(
				this.createConflictResolution(
					serverData,
					localData,
					"permission_conflict",
				),
			)
		}

		// Check for organisation boundary conflicts
		if (this.hasOrganisationBoundaryConflict(serverData, localData, user)) {
			conflicts.push(
				this.createConflictResolution(
					serverData,
					localData,
					"organisation_boundary_conflict",
				),
			)
		}

		return conflicts
	}

	/**
	 * Resolve conflicts using appropriate strategies
	 */
	async resolveConflicts(
		conflicts: ConflictResolution[],
		strategy?: "server_wins" | "local_wins" | "merge" | "user_choice",
	): Promise<any[]> {
		const resolvedData: any[] = []

		for (const conflict of conflicts) {
			let resolvedConflict: ConflictResolution

			// Use provided strategy or determine best strategy
			const resolutionStrategy =
				strategy || this.determineOptimalStrategy(conflict)

			switch (resolutionStrategy) {
				case "server_wins":
					resolvedConflict = await this.resolveServerWins(conflict)
					break
				case "local_wins":
					resolvedConflict = await this.resolveLocalWins(conflict)
					break
				case "merge":
					resolvedConflict = await this.resolveMerge(conflict)
					break
				case "user_choice":
					resolvedConflict = await this.resolveUserChoice(conflict)
					break
				default:
					// Fallback to server wins for unknown strategies
					resolvedConflict = await this.resolveServerWins(conflict)
			}

			resolvedData.push(resolvedConflict.server_version)

			// Store resolution for audit trail
			await this.storeConflictResolution(resolvedConflict)
		}

		return resolvedData
	}

	/**
	 * Check if there's a data modification conflict
	 */
	private hasDataModificationConflict(
		serverData: any,
		localData: any,
	): boolean {
		if (!serverData?.updated_at || !localData?.updated_at) {
			return false
		}

		const serverTime = new Date(serverData.updated_at)
		const localTime = new Date(localData.updated_at)

		// Conflict if both have been modified and times differ
		return Math.abs(serverTime.getTime() - localTime.getTime()) > 1000 // 1 second tolerance
	}

	/**
	 * Check if there's a deletion conflict
	 */
	private hasDeletionConflict(
		serverData: any,
		localData: any,
		operationType: string,
	): boolean {
		// Server data exists but local operation is delete
		if (serverData && operationType.includes("DELETE")) {
			return true
		}

		// Local data exists but server indicates deletion (status or null)
		if (localData && (!serverData || serverData.status === "deleted")) {
			return true
		}

		return false
	}

	/**
	 * Check if there's a permission conflict
	 */
	private async hasPermissionConflict(
		serverData: any,
		localData: any,
		user: User,
	): Promise<boolean> {
		// Check if user has permission to modify this data
		if (
			serverData?.organisation_id &&
			serverData.organisation_id !== user.organisation_id
		) {
			// WW Admin can access all organisations
			if (user.role !== "ww_admin") {
				return true
			}
		}

		// Check role-based permissions
		if (user.role === "project_member") {
			// Project members cannot delete or modify certain data
			if (localData?.created_by && localData.created_by !== user.id) {
				return true
			}
		}

		return false
	}

	/**
	 * Check if there's an organisation boundary conflict
	 */
	private hasOrganisationBoundaryConflict(
		serverData: any,
		localData: any,
		user: User,
	): boolean {
		// Data moved between organisations
		if (serverData?.organisation_id && localData?.organisation_id) {
			if (serverData.organisation_id !== localData.organisation_id) {
				// Only WW Admin can handle cross-organisation conflicts
				return user.role !== "ww_admin"
			}
		}

		return false
	}

	/**
	 * Create a conflict resolution object
	 */
	private createConflictResolution(
		serverData: any,
		localData: any,
		conflictType: ConflictType,
	): ConflictResolution {
		return {
			id: serverData?.id || localData?.id || `conflict-${Date.now()}`,
			server_version: serverData,
			local_version: localData,
			conflict_type: conflictType,
			needs_user_resolution: this.needsUserResolution(
				conflictType,
				serverData,
				localData,
			),
		}
	}

	/**
	 * Determine if user intervention is needed
	 */
	private needsUserResolution(
		conflictType: ConflictType,
		serverData: any,
		localData: any,
	): boolean {
		switch (conflictType) {
			case "permission_conflict":
			case "organisation_boundary_conflict":
				return true
			case "deletion_conflict":
				return true // User should decide on deletions
			case "data_modification":
				// Need user resolution if critical fields differ significantly
				return this.hasCriticalFieldConflicts(serverData, localData)
			default:
				return false
		}
	}

	/**
	 * Check if there are critical field conflicts requiring user attention
	 */
	private hasCriticalFieldConflicts(serverData: any, localData: any): boolean {
		const criticalFields = ["name", "status", "organisation_id", "location"]

		for (const field of criticalFields) {
			if (serverData[field] !== localData[field]) {
				return true
			}
		}

		return false
	}

	/**
	 * Determine optimal resolution strategy based on conflict type
	 */
	private determineOptimalStrategy(
		conflict: ConflictResolution,
	): "server_wins" | "local_wins" | "merge" | "user_choice" {
		switch (conflict.conflict_type) {
			case "permission_conflict":
			case "organisation_boundary_conflict":
				return "server_wins" // Security-first approach
			case "deletion_conflict":
				return "user_choice" // Let user decide on deletions
			case "data_modification":
				if (conflict.needs_user_resolution) {
					return "user_choice"
				}
				return "merge" // Try to merge non-critical changes
			default:
				return "server_wins" // Safe default
		}
	}

	/**
	 * Resolve conflict with server wins strategy
	 */
	private async resolveServerWins(
		conflict: ConflictResolution,
	): Promise<ConflictResolution> {
		return {
			...conflict,
			resolution_strategy: "server_wins",
			resolved_at: new Date(),
		}
	}

	/**
	 * Resolve conflict with local wins strategy
	 */
	private async resolveLocalWins(
		conflict: ConflictResolution,
	): Promise<ConflictResolution> {
		return {
			...conflict,
			server_version: conflict.local_version, // Use local data as result
			resolution_strategy: "local_wins",
			resolved_at: new Date(),
		}
	}

	/**
	 * Resolve conflict with merge strategy
	 */
	private async resolveMerge(
		conflict: ConflictResolution,
	): Promise<ConflictResolution> {
		const mergedData = this.mergeData(
			conflict.server_version,
			conflict.local_version,
		)

		return {
			...conflict,
			server_version: mergedData,
			resolution_strategy: "merge",
			resolved_at: new Date(),
		}
	}

	/**
	 * Resolve conflict with user choice (for now, defaults to server wins)
	 * In production, this would trigger UI for user selection
	 */
	private async resolveUserChoice(
		conflict: ConflictResolution,
	): Promise<ConflictResolution> {
		// TODO: In production, this would show a UI component for user to choose
		// For now, we default to server wins but mark it as needing user resolution

		console.warn(
			`Conflict needs user resolution: ${conflict.id} (${conflict.conflict_type})`,
		)

		return {
			...conflict,
			resolution_strategy: "user_choice",
			resolved_at: new Date(),
			needs_user_resolution: true,
		}
	}

	/**
	 * Merge server and local data intelligently
	 */
	private mergeData(serverData: any, localData: any): any {
		const merged = { ...serverData } // Start with server data as base

		// Preserve local changes for non-critical fields
		const mergeableFields = ["description", "notes", "metadata"]

		for (const field of mergeableFields) {
			if (
				localData[field] &&
				(!serverData[field] || localData[field] !== serverData[field])
			) {
				// Use local version if it's more recent or server doesn't have it
				if (this.isLocalDataNewer(localData, serverData)) {
					merged[field] = localData[field]
				}
			}
		}

		// Always use server data for critical fields
		const criticalFields = ["id", "organisation_id", "created_at", "created_by"]
		for (const field of criticalFields) {
			if (serverData[field]) {
				merged[field] = serverData[field]
			}
		}

		// Use most recent timestamp
		merged.updated_at = this.getMostRecentTimestamp(serverData, localData)

		return merged
	}

	/**
	 * Check if local data is newer than server data
	 */
	private isLocalDataNewer(localData: any, serverData: any): boolean {
		if (!localData?.updated_at || !serverData?.updated_at) {
			return false
		}

		const localTime = new Date(localData.updated_at)
		const serverTime = new Date(serverData.updated_at)

		return localTime > serverTime
	}

	/**
	 * Get the most recent timestamp between server and local data
	 */
	private getMostRecentTimestamp(serverData: any, localData: any): string {
		const serverTime = serverData?.updated_at
			? new Date(serverData.updated_at)
			: new Date(0)
		const localTime = localData?.updated_at
			? new Date(localData.updated_at)
			: new Date(0)

		return serverTime > localTime ? serverData.updated_at : localData.updated_at
	}

	/**
	 * Store conflict resolution for audit trail
	 */
	private async storeConflictResolution(
		resolution: ConflictResolution,
	): Promise<void> {
		try {
			// Store in a conflict resolutions table for audit purposes
			await this.databaseService.storeConflictResolution({
				id: resolution.id,
				conflict_type: resolution.conflict_type,
				resolution_strategy: resolution.resolution_strategy,
				resolved_at: resolution.resolved_at,
				server_data: JSON.stringify(resolution.server_version),
				local_data: JSON.stringify(resolution.local_version),
				needs_user_resolution: resolution.needs_user_resolution,
			})
		} catch (error) {
			console.error("Failed to store conflict resolution:", error)
			// Non-blocking error - conflict is still resolved
		}
	}

	/**
	 * Get conflict resolution history for debugging
	 */
	async getConflictHistory(entityId?: string): Promise<any[]> {
		try {
			return await this.databaseService.getConflictHistory(entityId)
		} catch (error) {
			console.error("Failed to get conflict history:", error)
			return []
		}
	}

	/**
	 * Clear old conflict resolutions for cleanup
	 */
	async cleanupOldConflicts(daysOld: number = 30): Promise<void> {
		try {
			const cutoffDate = new Date()
			cutoffDate.setDate(cutoffDate.getDate() - daysOld)

			await this.databaseService.cleanupOldConflicts(cutoffDate)
		} catch (error) {
			console.error("Failed to cleanup old conflicts:", error)
		}
	}
}

// Singleton instance
let conflictResolutionService: ConflictResolutionService | null = null

export const getConflictResolutionService = (
	databaseService: DatabaseService,
): ConflictResolutionService => {
	if (!conflictResolutionService) {
		conflictResolutionService = new ConflictResolutionService(databaseService)
	}
	return conflictResolutionService
}
