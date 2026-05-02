/**
 * Detox setup file for end-to-end tests
 * This file is loaded before each test suite
 */

const { reloadApp } = require("detox/src/utils/argparse")

beforeAll(async () => {
	await device.launchApp()
})

beforeEach(async () => {
	await device.reloadReactNative()
})

afterAll(async () => {
	await device.terminateApp()
})
