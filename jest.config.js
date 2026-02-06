module.exports = {
	preset: "react-native",
	setupFiles: ["<rootDir>/jest.setup.js"],
	setupFilesAfterEnv: [
		"<rootDir>/tests/setup/sanitySetup.ts",
		"@testing-library/jest-native/extend-expect",
	],
	testEnvironment: "node",
	transform: {
		"^.+\\.(ts|tsx)$": "babel-jest",
	},
	transformIgnorePatterns: [
		"node_modules/(?!(react-native|@react-native|@supabase|expo|@expo|react-redux|@reduxjs|@react-native-community|@getquip|react-native-drawer-layout|react-native-paper))",
	],
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/src/$1",
		"^@test/(.*)$": "<rootDir>/tests/setup/$1",
		"expo-sqlite": "<rootDir>/tests/__mocks__/expo-sqlite.ts",
		"expo-updates": "<rootDir>/tests/__mocks__/expo-updates.ts",
		"@react-native-community/netinfo":
			"<rootDir>/tests/__mocks__/@react-native-community/netinfo.ts",
		"\\.(png|jpg|jpeg|gif|svg|ttf|otf)$": "<rootDir>/tests/__mocks__/fileMock.js",
	},
	testMatch: [
		// Co-located unit tests (following React Native conventions)
		"<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}",
		"<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}",
		// Centralized integration and E2E tests
		"<rootDir>/tests/unit/**/*.{test,spec}.{js,jsx,ts,tsx}",
		"<rootDir>/tests/integration/**/*.{test,spec}.{js,jsx,ts,tsx}",
		// Root level tests
		"<rootDir>/__tests__/**/*.{js,jsx,ts,tsx}",
	],
	testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/e2e/", "<rootDir>/project-context/", "<rootDir>/archive/"],
	modulePathIgnorePatterns: ["<rootDir>/project-context/", "<rootDir>/archive/"],
	collectCoverageFrom: [
		"src/**/*.{ts,tsx}",
		"!src/**/*.d.ts",
		"!src/**/__tests__/**",
		"!src/**/*.test.{ts,tsx}",
		"!src/**/*.spec.{ts,tsx}",
		"!src/types/**",
		"!src/**/*.stories.{ts,tsx}",
		"!src/**/*.mock.{ts,tsx}",
	],
	coverageReporters: ["text", "lcov", "html"],
	coverageDirectory: "<rootDir>/coverage",
	clearMocks: true,
	resetMocks: false,
	restoreMocks: true,
	verbose: true,
}
