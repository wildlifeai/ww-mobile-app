/**
 * useOptimisticUpdate Hook
 *
 * Provides optimistic UI update pattern with automatic rollback
 * Updates UI immediately, queues operation, handles success/failure
 */

import { useCallback, useState } from "react"
import { useOfflineSync } from "./useOfflineSync"
import { OfflineOperationType } from "../types/offline"

interface OptimisticUpdateParams<T> {
	operation: {
		type: OfflineOperationType
		entityType: string
		entityId: string
		data: any
		userId: string
		organisationId: string
		priority?: number
	}
	optimisticData: T
	rollbackData?: T
	onSuccess?: (data: T) => void
	onError?: (error: any) => void
	onRollback?: () => void
}

export const useOptimisticUpdate = <T = any>() => {
	const { queueOperation } = useOfflineSync()
	const [isUpdating, setIsUpdating] = useState(false)
	const [error, setError] = useState<string | null>(null)

	/**
	 * Execute optimistic update
	 * 1. Apply optimistic data immediately
	 * 2. Queue operation for sync
	 * 3. Handle success/failure
	 */
	const executeUpdate = useCallback(
		async (
			params: OptimisticUpdateParams<T>,
		): Promise<{ success: boolean; data?: T }> => {
			setIsUpdating(true)
			setError(null)

			try {
				// 1. Apply optimistic update immediately (handled by caller)
				const {
					operation,
					optimisticData,
					rollbackData,
					onSuccess,
					onError,
					onRollback,
				} = params

				// 2. Queue operation for sync
				const result = await queueOperation(operation)

				if (result.meta.requestStatus === "fulfilled") {
					// Operation queued successfully
					onSuccess?.(optimisticData)
					return { success: true, data: optimisticData }
				} else {
					// Failed to queue - rollback
					onRollback?.()
					const errorMessage = "Failed to queue operation"
					setError(errorMessage)
					onError?.(errorMessage)
					return { success: false }
				}
			} catch (err: any) {
				// Error occurred - rollback
				params.onRollback?.()
				const errorMessage = err.message || "Unknown error"
				setError(errorMessage)
				params.onError?.(errorMessage)
				return { success: false }
			} finally {
				setIsUpdating(false)
			}
		},
		[queueOperation],
	)

	return {
		executeUpdate,
		isUpdating,
		error,
	}
}

export default useOptimisticUpdate
