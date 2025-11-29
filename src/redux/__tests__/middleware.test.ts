/**
 * Middleware Registration Verification Tests
 *
 * SKIPPED: These tests cause Jest worker crashes
 * TODO: Investigate Redux store initialization issues in test environment
 */

describe.skip("Redux Store Initialization", () => {
	it("should create store without errors", () => {
		// Dynamic import to avoid top-level store initialization issues
		const { default: store } = require("../index")
		expect(store).toBeDefined()
	})

	it("should have getState method", () => {
		const { default: store } = require("../index")
		expect(typeof store.getState).toBe("function")
	})

	it("should return initial state object", () => {
		const { default: store } = require("../index")
		const state = store.getState()
		expect(state).toBeDefined()
		expect(typeof state).toBe("object")
	})
})
