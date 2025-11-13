// Jest setup for React Native testing

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
	require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
)

// Mock Expo modules
jest.mock("expo-constants", () => ({
	expoConfig: {
		extra: {
			supabaseUrl: "https://test.supabase.co",
			supabaseAnonKey: "test-anon-key",
		},
	},
}))

// Silence console warnings in tests
global.console = {
	...console,
	warn: jest.fn(),
	error: jest.fn(),
}

// Setup test environment
global.__DEV__ = true
