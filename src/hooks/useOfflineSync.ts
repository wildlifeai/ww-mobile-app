/**
 * useOfflineSync Hook
 *
 * Provides offline sync functionality for components
 * Handles monitoring sync status
 *
 * Refactored to use WatermelonDB sync status only.
 */

import { useCallback } from "react"
import { useAppSelector } from "../redux"
import {
	selectOverallSyncStatus,
	selectQueueStatus,
	selectEntitySyncStatus,
} from "../redux/slices/syncSlice"
import { selectIsOnline, selectCanSync } from "../redux/slices/networkSlice"

export const useOfflineSync = () => {
	// Network state
	const isOnline = useAppSelector(selectIsOnline)
	const canSync = useAppSelector(selectCanSync)

	// Sync state
	const overallSyncStatus = useAppSelector(selectOverallSyncStatus)
	const queueStatus = useAppSelector(selectQueueStatus)

	/**
	 * Get sync status for a specific entity
	 */
	const getEntitySyncStatus = useCallback(
		(
			entityType: "projects" | "deployments" | "devices" | "organisations",
			entityId: string,
		) => {
			return selectEntitySyncStatus(
				{ sync: { entities: { [entityType]: {} } } } as any,
				entityType,
				entityId,
			)
		},
		[],
	)

	/**
	 * Queue operation (deprecated - kept for compatibility)
	 * @deprecated Use WatermelonDB models directly instead
	 */
	const queueOperation = useCallback(async (operation: any) => {
		console.warn("⚠️ queueOperation is deprecated. Use WatermelonDB models directly.")
		// Return a mock fulfilled result for compatibility
		return {
			meta: {
				requestStatus: "fulfilled" as const
			}
		}
	}, [])

	return {
		// Network state
		isOnline,
		canSync,

		// Sync state
		syncStatus: overallSyncStatus,
		queueStatus,
		pendingCount: queueStatus.pending,
		isProcessing: queueStatus.processing !== null,

		// Actions
		getEntitySyncStatus,
		queueOperation,
	}
}

export default useOfflineSync
