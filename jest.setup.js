// Jest setup for React Native testing

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
	require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
)

// Mock Reanimated
// require("react-native-reanimated/lib/reanimated2/jestUtils").setUpTests()
jest.mock("react-native-reanimated", () =>
	require("react-native-reanimated/mock"),
)

// Mock Gesture Handler
require("react-native-gesture-handler/jestSetup")

// Mock Expo modules
jest.mock("expo-constants", () => ({
	expoConfig: {
		extra: {
			supabaseUrl: "https://test.supabase.co",
			supabaseAnonKey: "test-anon-key",
		},
	},
}))

jest.mock("expo-crypto", () => ({
	randomUUID: jest.fn(() => "test-uuid"),
}))

jest.mock("expo-file-system", () => ({
	cacheDirectory: "file:///test/cache/",
	documentDirectory: "file:///test/documents/",
	writeAsStringAsync: jest.fn(),
	deleteAsync: jest.fn(),
	readAsStringAsync: jest.fn(),
	getInfoAsync: jest.fn(() => Promise.resolve({ exists: true, isDirectory: false })),
	makeDirectoryAsync: jest.fn(),
	EncodingType: { Base64: "base64", UTF8: "utf8" },
    createDownloadResumable: jest.fn(() => ({
        downloadAsync: jest.fn(() => Promise.resolve({ uri: "file:///test.jpg" }))
    })),
}))

// Silence console warnings in tests
global.console = {
	...console,
	warn: jest.fn(),
	error: jest.fn(),
}

// Setup test environment
global.__DEV__ = true

// Mock Database to prevent SQLiteAdapter crash
const mockDatabase = {
	collections: {
		get: jest.fn(() => ({
			query: jest.fn(() => ({ fetch: jest.fn(() => []) })),
			create: jest.fn(),
			prepareCreate: jest.fn(),
		})),
	},
	write: jest.fn((cb) => cb()),
	batch: jest.fn(),
}

jest.mock("./src/database", () => mockDatabase)
jest.mock("./src/database/index", () => mockDatabase)
