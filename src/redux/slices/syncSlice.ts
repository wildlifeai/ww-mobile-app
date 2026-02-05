/**
 * Sync Slice - Manages synchronization status for entities
 *
 * Features:
 * - Per-entity sync status tracking (projects, deployments, devices)
 * - Overall sync state management
 * - Queue status monitoring
 * - Last sync timestamps
 * - Error tracking
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit"
// import { RootState } from "../index" // Circular dependency

// Define local state type to avoid circular dependency
interface SyncRootState {
	sync: SyncState
}

// Entity sync status interface
export interface EntitySyncStatus {
	status: "synced" | "pending" | "syncing" | "error"
	lastSync: string | null
	error?: string
}

// Map of entity IDs to their sync status
export interface EntitySyncMap {
	[entityId: string]: EntitySyncStatus
}

// Sync state interface
export interface SyncState {
	overall: "synced" | "syncing" | "pending" | "error"
	entities: {
		projects: EntitySyncMap
		deployments: EntitySyncMap
		devices: EntitySyncMap
		organisations: EntitySyncMap
	}
	queue: {
		pending: number
		failed: number
		processing: string | null
	}
	lastSync: string | null
	errors: Array<{
		entityType: string
		entityId: string
		error: string
		timestamp: string
	}>
}

// Initial state
const initialState: SyncState = {
	overall: "synced",
	entities: {
		projects: {},
		deployments: {},
		devices: {},
		organisations: {},
	},
	queue: {
		pending: 0,
		failed: 0,
		processing: null,
	},
	lastSync: null,
	errors: [],
}

/**
 * Sync slice with actions for tracking synchronization status
 */
const syncSlice = createSlice({
	name: "sync",
	initialState,
	reducers: {
		// Mark entity as pending sync
		markEntityPending: (
			state,
			action: PayloadAction<{
				entityType: keyof SyncState["entities"]
				entityId: string
			}>,
		) => {
			const { entityType, entityId } = action.payload
			state.entities[entityType][entityId] = {
				status: "pending",
				lastSync: null,
			}
			state.queue.pending++
			if (state.overall === "synced") {
				state.overall = "pending"
			}
		},

		// Mark entity as currently syncing
		markEntitySyncing: (
			state,
			action: PayloadAction<{
				entityType: keyof SyncState["entities"]
				entityId: string
			}>,
		) => {
			const { entityType, entityId } = action.payload
			const entity = state.entities[entityType][entityId]
			if (entity) {
				entity.status = "syncing"
			}
			state.queue.processing = entityId
			state.overall = "syncing"
		},

		// Mark entity as successfully synced
		markEntitySynced: (
			state,
			action: PayloadAction<{
				entityType: keyof SyncState["entities"]
				entityId: string
			}>,
		) => {
			const { entityType, entityId } = action.payload
			const now = new Date().toISOString()

			state.entities[entityType][entityId] = {
				status: "synced",
				lastSync: now,
			}

			state.queue.pending = Math.max(0, state.queue.pending - 1)
			state.queue.processing = null
			state.lastSync = now

			// Update overall status
			if (state.queue.pending === 0 && state.queue.failed === 0) {
				state.overall = "synced"
			}
		},

		// Mark entity sync as failed
		markEntityError: (
			state,
			action: PayloadAction<{
				entityType: keyof SyncState["entities"]
				entityId: string
				error: string
			}>,
		) => {
			const { entityType, entityId, error } = action.payload

			state.entities[entityType][entityId] = {
				status: "error",
				lastSync: state.entities[entityType][entityId]?.lastSync || null,
				error,
			}

			state.queue.failed++
			state.queue.processing = null
			state.overall = "error"

			// Track error
			state.errors.push({
				entityType,
				entityId,
				error,
				timestamp: new Date().toISOString(),
			})

			// Keep only last 10 errors
			if (state.errors.length > 10) {
				state.errors = state.errors.slice(-10)
			}
		},

		// Clear error for entity
		clearEntityError: (
			state,
			action: PayloadAction<{
				entityType: keyof SyncState["entities"]
				entityId: string
			}>,
		) => {
			const { entityType, entityId } = action.payload
			const entity = state.entities[entityType][entityId]
			if (entity) {
				delete entity.error
				entity.status = "pending"
				state.queue.failed = Math.max(0, state.queue.failed - 1)
			}
		},

		// Reset sync status (useful for logout)
		resetSyncStatus: (_state) => {
			return initialState
		},

		// Update queue counts (called by offline middleware)
		updateQueueCounts: (
			state,
			action: PayloadAction<{ pending: number; failed: number }>,
		) => {
			state.queue.pending = action.payload.pending
			state.queue.failed = action.payload.failed

			// Update overall status based on queue
			if (state.queue.pending === 0 && state.queue.failed === 0) {
				state.overall = "synced"
			} else if (state.queue.pending > 0) {
				state.overall = "pending"
			}
		},
	},
})

// Export actions
export const {
	markEntityPending,
	markEntitySyncing,
	markEntitySynced,
	markEntityError,
	clearEntityError,
	resetSyncStatus,
	updateQueueCounts,
} = syncSlice.actions

// Selectors
export const selectOverallSyncStatus = (state: SyncRootState) => state.sync.overall
export const selectQueueStatus = (state: SyncRootState) => state.sync.queue
export const selectLastSync = (state: SyncRootState) => state.sync.lastSync
export const selectSyncErrors = (state: SyncRootState) => state.sync.errors

// Selector for specific entity sync status
export const selectEntitySyncStatus = (
	state: SyncRootState,
	entityType: keyof SyncState["entities"],
	entityId: string,
): EntitySyncStatus => {
	return (
		state.sync.entities[entityType][entityId] || {
			status: "synced",
			lastSync: null,
		}
	)
}

// Selector for all entities of a type
export const selectEntitiesSyncStatus = (
	state: SyncRootState,
	entityType: keyof SyncState["entities"],
): EntitySyncMap => {
	return state.sync.entities[entityType]
}

export default syncSlice.reducer
