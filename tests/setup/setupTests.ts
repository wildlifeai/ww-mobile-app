/**
 * Jest test setup file
 * This file is automatically loaded before every test file
 */

// Test setup for React Native environment

// import "react-native-gesture-handler/jestSetup"
// Mock AsyncStorage
// Mock AsyncStorage
// Mock AsyncStorage
// Using manual mock in tests/__mocks__/@react-native-async-storage/async-storage.js

// Mock React Native modules
jest.mock("react-native/Libraries/EventEmitter/NativeEventEmitter")

// Mock Expo modules
jest.mock("expo-constants", () => ({
	expoConfig: {
		extra: {
			apiBase: "https://test-api.wildlife.com",
			googleMapsApiKeyAndroid: "test-android-key",
			googleMapsApiKeyIos: "test-ios-key",
			bundleIdentifier: "com.wildlife.wildlifewatcher.expo",
			isDevelopment: true,
			eas: {
				projectId: "6cf53a5e-90e1-4987-82c6-5f0337affe97",
			},
		},
	},
}))

jest.mock("expo-linking", () => ({
	getInitialURL: jest.fn(() => Promise.resolve(null)),
	parse: jest.fn((url: string) => ({
		hostname: "localhost",
		path: url.split("://")[1]?.split("?")[0] || "",
		queryParams: {},
	})),
	addEventListener: jest.fn(() => ({ remove: jest.fn() })),
	createURL: jest.fn((path: string) => `wildlifewatcher://${path}`),
}))

jest.mock("expo-splash-screen", () => ({
	hideAsync: jest.fn(),
	preventAutoHideAsync: jest.fn(),
}))

jest.mock("expo-crypto", () => ({
	randomUUID: jest.fn(() => "test-uuid-1234"),
	digestStringAsync: jest.fn(),
}))

jest.mock("expo-image", () => ({
	Image: "Image",
}))

// Mock Expo File System
jest.mock("expo-file-system", () => ({
	documentDirectory: "/mock/documents/",
	downloadAsync: jest.fn(),
	readAsStringAsync: jest.fn(),
	writeAsStringAsync: jest.fn(),
	deleteAsync: jest.fn(),
	getInfoAsync: jest.fn(),
	makeDirectoryAsync: jest.fn(),
	copyAsync: jest.fn(),
	moveAsync: jest.fn(),
})) as any

// Mock React Navigation
// jest.mock("@react-navigation/native", () => {
// 	const actualNav = jest.requireActual("@react-navigation/native")
// 	const { mockNavigation } = require("../setup/utils/testUtils")
// 	return {
// 		...actualNav,
// 		useNavigation: () => mockNavigation,
// 		useRoute: () => ({
// 			params: {},
// 		}),
// 		useFocusEffect: jest.fn(),
// 	}
// })

// Mock React Native Paper
// jest.mock("react-native-paper", () => ({
// 	...jest.requireActual("react-native-paper"),
// 	MD3LightTheme: {
// 		colors: {
// 			primary: "#6200EE",
// 			onPrimary: "#FFFFFF",
// 			background: "#FFFFFF",
// 			surface: "#FFFFFF",
// 		},
// 	},
// }))

// Mock React Native Vector Icons
// jest.mock("react-native-vector-icons/MaterialIcons", () => "MaterialIcon")
// jest.mock("react-native-vector-icons/FontAwesome", () => "FontAwesome")

// Mock Supabase service with proper mock client
// jest.mock("../../src/services/supabase", () => ({
// 	getSupabaseClient: () => require("../__mocks__/supabase").mockSupabaseClient,
// }))

// Note: Auth service mocks removed to allow integration tests to test real implementation
// Individual test files can mock specific functions as needed

// Mock environment variables for Supabase
(process.env as any).EXPO_PUBLIC_SUPABASE_URL = "https://test-supabase-url.supabase.co";
(process.env as any).EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

// Mock BLE Manager
jest.mock("react-native-ble-manager", () => ({
	start: jest.fn(() => Promise.resolve()),
	scan: jest.fn(() => Promise.resolve()),
	stopScan: jest.fn(() => Promise.resolve()),
	connect: jest.fn(() => Promise.resolve()),
	disconnect: jest.fn(() => Promise.resolve()),
	isPeripheralConnected: jest.fn(() => Promise.resolve(false)),
	getConnectedPeripherals: jest.fn(() => Promise.resolve([])),
	addListener: jest.fn(),
	removeAllListeners: jest.fn(),
}))

// Mock React Native Bluetooth State Manager
jest.mock("react-native-bluetooth-state-manager", () => ({
	default: {
		getState: jest.fn(() => Promise.resolve("PoweredOn")),
		onStateChange: jest.fn(() => ({ remove: jest.fn() })),
		requestToEnable: jest.fn(() => Promise.resolve(true)),
		disable: jest.fn(() => Promise.resolve()),
	},
	BluetoothState: {
		Unknown: "Unknown",
		Resetting: "Resetting",
		Unsupported: "Unsupported",
		Unauthorized: "Unauthorized",
		PoweredOff: "PoweredOff",
		PoweredOn: "PoweredOn",
	},
	EVENT_BLUETOOTH_STATE_CHANGE: "bluetoothStateDidChange",
}))

// Mock React Native Toast Message
jest.mock("react-native-toast-message", () => ({
	show: jest.fn(),
	hide: jest.fn(),
}))

// Mock React Native Document Picker
jest.mock("react-native-document-picker", () => ({
	pick: jest.fn(),
	pickSingle: jest.fn(),
	isCancel: jest.fn(),
	types: {
		allFiles: "*/*",
	},
}))

// Mock Expo Application
jest.mock("expo-application", () => ({
	nativeApplicationVersion: "1.0.0",
	nativeBuildVersion: "1",
	applicationId: "com.wildlifeai.wildlifewatcher",
}))

// Mock Geolocation
jest.mock("@react-native-community/geolocation", () => ({
	getCurrentPosition: jest.fn(),
	watchPosition: jest.fn(),
	clearWatch: jest.fn(),
	stopObserving: jest.fn(),
}))

// Silence console warnings in tests
global.console = {
	...console,
	warn: jest.fn(),
	error: jest.fn(),
}

// Setup fake timers
beforeEach(() => {
	jest.useFakeTimers()
})

afterEach(() => {
	jest.runOnlyPendingTimers()
	jest.useRealTimers()
	jest.clearAllMocks()
})
