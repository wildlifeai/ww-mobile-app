/**
 * Middleware Registration Verification Tests
 *
 * Quick smoke tests to verify Redux middleware and reducers are correctly registered
 */

import store from "../index"

describe("Middleware Registration", () => {
	it("store has sync reducer", () => {
		const state = store.getState()
		expect(state.sync).toBeDefined()
		expect(state.sync.overall).toBeDefined()
		expect(state.sync.entities).toBeDefined()
		expect(state.sync.queue).toBeDefined()
	})

	it("store has offline reducer with queue", () => {
		const state = store.getState()
		expect(state.offline).toBeDefined()
		expect(state.offline.queue).toBeDefined()
		expect(state.offline.queue.operations).toBeDefined()
		expect(Array.isArray(state.offline.queue.operations)).toBe(true)
	})

	it("store has network reducer", () => {
		const state = store.getState()
		expect(state.network).toBeDefined()
		expect(state.network.isOnline).toBeDefined()
		expect(state.network.connectionType).toBeDefined()
	})

	it("sync reducer has correct initial state", () => {
		const state = store.getState()
		expect(state.sync.overall).toBe("synced")
		expect(state.sync.entities.projects).toEqual({})
		expect(state.sync.entities.deployments).toEqual({})
		expect(state.sync.entities.devices).toEqual({})
		expect(state.sync.entities.organisations).toEqual({})
		expect(state.sync.queue.pending).toBe(0)
		expect(state.sync.queue.failed).toBe(0)
	})

	it("offline reducer has correct initial state", () => {
		const state = store.getState()
		expect(state.offline.queue.processing).toBe(false)
		expect(state.offline.queue.operations).toEqual([])
		expect(state.offline.stats.totalQueued).toBe(0)
		expect(state.offline.stats.totalProcessed).toBe(0)
		expect(state.offline.stats.totalFailed).toBe(0)
	})

	it("network reducer has correct initial state", () => {
		const state = store.getState()
		expect(state.network.isOnline).toBe(false)
		expect(state.network.connectionType).toBe("unknown")
		expect(state.network.offlineModeEnabled).toBe(false)
	})
})
