/**
 * Mock for expo-updates module
 * Used in tests that involve app restart functionality
 */

export const reloadAsync = jest.fn().mockResolvedValue(undefined)

export default {
	reloadAsync,
}
