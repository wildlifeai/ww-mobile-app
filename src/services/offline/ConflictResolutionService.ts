/**
 * ConflictResolutionService - Deprecated
 * 
 * This service was part of the legacy custom offline sync mechanism.
 * With the transition to WatermelonDB native sync, conflict resolution is handled
 * by Supabase's `push_changes` RPC (using ON CONFLICT and last_pulled_at logic)
 * and WatermelonDB's built-in sync capabilities.
 */

import { DatabaseService } from "./DatabaseService"

export class ConflictResolutionService {
	constructor(databaseService: DatabaseService) {
		// No-op
	}

	async detectConflicts(
		serverData: any,
		localData: any,
		operationType: string,
		user: any,
	): Promise<any[]> {
		console.warn("⚠️ ConflictResolutionService is deprecated. WatermelonDB handles sync.")
		return []
	}

	async resolveConflicts(
		conflicts: any[],
		strategy?: string,
	): Promise<any[]> {
		return []
	}
}

// Singleton instance stub
let conflictResolutionService: ConflictResolutionService | null = null

export const getConflictResolutionService = (
	databaseService: DatabaseService,
): ConflictResolutionService => {
	if (!conflictResolutionService) {
		conflictResolutionService = new ConflictResolutionService(databaseService)
	}
	return conflictResolutionService
}
