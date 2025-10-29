/**
 * Sync Slice Unit Tests
 * Tests for sync status management Redux slice
 */

import syncReducer, {
	markEntityPending,
	markEntitySyncing,
	markEntitySynced,
	markEntityError,
	clearEntityError,
	resetSyncStatus,
	updateQueueCounts,
	selectEntitySyncStatus,
	selectOverallSyncStatus,
	selectQueueStatus,
	SyncState,
} from "../../../../src/redux/slices/syncSlice"

describe("syncSlice", () => {
	let initialState: SyncState

	beforeEach(() => {
		initialState = {
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
	})

	describe("markEntityPending", () => {
		it("should mark entity as pending and update queue", () => {
			const action = markEntityPending({
				entityType: "projects",
				entityId: "project-1",
			})

			const state = syncReducer(initialState, action)

			expect(state.entities.projects["project-1"]).toEqual({
				status: "pending",
				lastSync: null,
			})
			expect(state.queue.pending).toBe(1)
			expect(state.overall).toBe("pending")
		})

		it("should handle multiple pending entities", () => {
			let state = initialState

			state = syncReducer(
				state,
				markEntityPending({ entityType: "projects", entityId: "project-1" }),
			)
			state = syncReducer(
				state,
				markEntityPending({ entityType: "deployments", entityId: "deploy-1" }),
			)

			expect(state.queue.pending).toBe(2)
			expect(state.entities.projects["project-1"].status).toBe("pending")
			expect(state.entities.deployments["deploy-1"].status).toBe("pending")
		})
	})

	describe("markEntitySyncing", () => {
		it("should mark entity as syncing and set processing", () => {
			let state = syncReducer(
				initialState,
				markEntityPending({ entityType: "projects", entityId: "project-1" }),
			)

			state = syncReducer(
				state,
				markEntitySyncing({ entityType: "projects", entityId: "project-1" }),
			)

			expect(state.entities.projects["project-1"].status).toBe("syncing")
			expect(state.queue.processing).toBe("project-1")
			expect(state.overall).toBe("syncing")
		})
	})

	describe("markEntitySynced", () => {
		it("should mark entity as synced and update queue", () => {
			let state = syncReducer(
				initialState,
				markEntityPending({ entityType: "projects", entityId: "project-1" }),
			)

			state = syncReducer(
				state,
				markEntitySynced({ entityType: "projects", entityId: "project-1" }),
			)

			expect(state.entities.projects["project-1"].status).toBe("synced")
			expect(state.entities.projects["project-1"].lastSync).toBeTruthy()
			expect(state.queue.pending).toBe(0)
			expect(state.queue.processing).toBeNull()
			expect(state.overall).toBe("synced")
			expect(state.lastSync).toBeTruthy()
		})

		it("should not change overall status if other pending items exist", () => {
			let state = syncReducer(
				initialState,
				markEntityPending({ entityType: "projects", entityId: "project-1" }),
			)
			state = syncReducer(
				state,
				markEntityPending({ entityType: "projects", entityId: "project-2" }),
			)

			state = syncReducer(
				state,
				markEntitySynced({ entityType: "projects", entityId: "project-1" }),
			)

			expect(state.queue.pending).toBe(1)
			expect(state.overall).toBe("pending")
		})
	})

	describe("markEntityError", () => {
		it("should mark entity as error and track error details", () => {
			let state = syncReducer(
				initialState,
				markEntityPending({ entityType: "projects", entityId: "project-1" }),
			)

			state = syncReducer(
				state,
				markEntityError({
					entityType: "projects",
					entityId: "project-1",
					error: "Network timeout",
				}),
			)

			expect(state.entities.projects["project-1"].status).toBe("error")
			expect(state.entities.projects["project-1"].error).toBe("Network timeout")
			expect(state.queue.failed).toBe(1)
			expect(state.overall).toBe("error")
			expect(state.errors.length).toBe(1)
			expect(state.errors[0]).toMatchObject({
				entityType: "projects",
				entityId: "project-1",
				error: "Network timeout",
			})
		})

		it("should maintain last 10 errors only", () => {
			let state = initialState

			// Add 15 errors
			for (let i = 0; i < 15; i++) {
				state = syncReducer(
					state,
					markEntityPending({
						entityType: "projects",
						entityId: `project-${i}`,
					}),
				)
				state = syncReducer(
					state,
					markEntityError({
						entityType: "projects",
						entityId: `project-${i}`,
						error: `Error ${i}`,
					}),
				)
			}

			expect(state.errors.length).toBe(10)
			expect(state.errors[0].entityId).toBe("project-5") // First 5 removed
		})
	})

	describe("clearEntityError", () => {
		it("should clear error and reset to pending", () => {
			let state = syncReducer(
				initialState,
				markEntityPending({ entityType: "projects", entityId: "project-1" }),
			)
			state = syncReducer(
				state,
				markEntityError({
					entityType: "projects",
					entityId: "project-1",
					error: "Network timeout",
				}),
			)

			state = syncReducer(
				state,
				clearEntityError({ entityType: "projects", entityId: "project-1" }),
			)

			expect(state.entities.projects["project-1"].status).toBe("pending")
			expect(state.entities.projects["project-1"].error).toBeUndefined()
			expect(state.queue.failed).toBe(0)
		})
	})

	describe("updateQueueCounts", () => {
		it("should update queue counts and overall status", () => {
			const state = syncReducer(
				initialState,
				updateQueueCounts({ pending: 5, failed: 2 }),
			)

			expect(state.queue.pending).toBe(5)
			expect(state.queue.failed).toBe(2)
			expect(state.overall).toBe("pending")
		})

		it("should set overall to synced when no pending or failed", () => {
			const state = syncReducer(
				initialState,
				updateQueueCounts({ pending: 0, failed: 0 }),
			)

			expect(state.overall).toBe("synced")
		})
	})

	describe("resetSyncStatus", () => {
		it("should reset to initial state", () => {
			let state = syncReducer(
				initialState,
				markEntityPending({ entityType: "projects", entityId: "project-1" }),
			)

			state = syncReducer(state, resetSyncStatus())

			expect(state).toEqual(initialState)
		})
	})

	describe("selectors", () => {
		it("selectOverallSyncStatus should return overall status", () => {
			const state = { sync: initialState } as any
			expect(selectOverallSyncStatus(state)).toBe("synced")
		})

		it("selectQueueStatus should return queue status", () => {
			const state = { sync: initialState } as any
			expect(selectQueueStatus(state)).toEqual({
				pending: 0,
				failed: 0,
				processing: null,
			})
		})

		it("selectEntitySyncStatus should return entity status", () => {
			const modifiedState = {
				...initialState,
				entities: {
					...initialState.entities,
					projects: {
						"project-1": {
							status: "synced" as const,
							lastSync: "2025-09-30T00:00:00Z",
						},
					},
				},
			}

			const state = { sync: modifiedState } as any
			const entityStatus = selectEntitySyncStatus(
				state,
				"projects",
				"project-1",
			)

			expect(entityStatus).toEqual({
				status: "synced",
				lastSync: "2025-09-30T00:00:00Z",
			})
		})

		it("selectEntitySyncStatus should return default for non-existent entity", () => {
			const state = { sync: initialState } as any
			const entityStatus = selectEntitySyncStatus(
				state,
				"projects",
				"non-existent",
			)

			expect(entityStatus).toEqual({
				status: "synced",
				lastSync: null,
			})
		})
	})
})
