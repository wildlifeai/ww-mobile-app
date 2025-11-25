/**
 * Offline Slice - Manages offline operation queue and processing
 *
 * Refactored for WatermelonDB Native Sync:
 * - Legacy queue management is disabled.
 * - State structure preserved for UI compatibility.
 * - Operations are now handled by WatermelonDB and SupabaseSyncService.
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import { OfflineOperation, OfflineOperationType } from "../../types/offline"
import { RootState } from "../index"

// Operation priority levels (kept for compatibility)
export const OPERATION_PRIORITY = {
	CRITICAL: 1000,
	HIGH: 900,
	MEDIUM: 800,
	LOW: 500,
}

export interface OfflineState {
	queue: {
		operations: OfflineOperation[]
		processing: boolean
		lastProcessed: string | null
	}
	stats: {
		totalQueued: number
		totalProcessed: number
		totalFailed: number
	}
}

const initialState: OfflineState = {
	queue: {
		operations: [],
		processing: false,
		lastProcessed: null,
	},
	stats: {
		totalQueued: 0,
		totalProcessed: 0,
		totalFailed: 0,
	},
}

/**
 * Queue an offline operation for later sync
 * @deprecated Legacy queue is disabled. WatermelonDB handles sync automatically.
 */
export const queueOfflineOperation = createAsyncThunk(
	"offline/queueOperation",
	async (
		operation: {
			type: OfflineOperationType
			entityType: string
			entityId: string
			data: any
			userId: string
			organisationId: string
			priority?: number
		},
		{ rejectWithValue },
	) => {
		console.warn("⚠️ queueOfflineOperation is deprecated. WatermelonDB handles sync automatically.")
		return rejectWithValue({ error: "Legacy queue is disabled" })
	},
)

/**
 * Process pending operations in the queue
 * @deprecated Legacy queue is disabled.
 */
export const processOfflineQueue = createAsyncThunk(
	"offline/processQueue",
	async (_, { rejectWithValue }) => {
		console.warn("⚠️ processOfflineQueue is deprecated.")
		return {
			processed: 0,
			failed: 0,
			remaining: 0,
		}
	},
)

/**
 * Load queue status from database
 * @deprecated Legacy queue is disabled.
 */
export const loadQueueStatus = createAsyncThunk(
	"offline/loadQueueStatus",
	async (_, { rejectWithValue }) => {
		return {
			operations: [],
			count: 0,
		}
	},
)

const offlineSlice = createSlice({
	name: "offline",
	initialState,
	reducers: {
		// Clear processed operations
		clearProcessedOperations: (state) => {
			state.queue.operations = []
		},

		// Reset offline state
		resetOfflineState: (state) => {
			return initialState
		},
	},
	extraReducers: (builder) => {
		builder
			// Queue operation
			.addCase(queueOfflineOperation.fulfilled, (state, action) => {
				// No-op
			})
			.addCase(queueOfflineOperation.rejected, (state, action) => {
				// No-op
			})

			// Process queue
			.addCase(processOfflineQueue.pending, (state) => {
				state.queue.processing = true
			})
			.addCase(processOfflineQueue.fulfilled, (state, action) => {
				state.queue.processing = false
				state.queue.lastProcessed = new Date().toISOString()
			})
			.addCase(processOfflineQueue.rejected, (state, action) => {
				state.queue.processing = false
			})

			// Load queue status
			.addCase(loadQueueStatus.fulfilled, (state, action) => {
				state.queue.operations = []
			})
	},
})

// Export actions
export const { clearProcessedOperations, resetOfflineState } =
	offlineSlice.actions

// Selectors
export const selectQueueOperations = (state: RootState) =>
	state.offline.queue.operations
export const selectIsProcessing = (state: RootState) =>
	state.offline.queue.processing
export const selectQueueStats = (state: RootState) => state.offline.stats
export const selectPendingCount = (state: RootState) => 0

export default offlineSlice.reducer
