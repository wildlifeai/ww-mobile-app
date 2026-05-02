/**
 * Test utilities for rendering components with providers
 */

import React, { ReactElement } from "react"
import { render, RenderOptions } from "@testing-library/react-native"
import { Provider } from "react-redux"
import { NavigationContainer } from "@react-navigation/native"
import { PaperProvider } from "react-native-paper"
import { configureStore } from "@reduxjs/toolkit"
import authSlice from "../../../src/redux/slices/authSlice"
import deploymentsSlice from "../../../src/redux/slices/deploymentsSlice"
import syncSlice from "../../../src/redux/slices/syncSlice"
import wwAdminSlice from "../../../src/redux/slices/wwAdminSlice"
import { api } from "../../../src/redux/api"

// Mock navigation object
export const mockNavigation = {
	navigate: jest.fn(),
	goBack: jest.fn(),
	reset: jest.fn(),
	setOptions: jest.fn(),
	isFocused: jest.fn(() => true),
	addListener: jest.fn(),
	removeListener: jest.fn(),
}

// Export navigate function directly for backward compatibility
export const mockNavigate = mockNavigation.navigate

// Create test store
export function createTestStore(preloadedState = {}) {
	return configureStore({
		reducer: {
			authentication: authSlice,
			deployments: deploymentsSlice,
			sync: syncSlice,
			wwAdmin: wwAdminSlice,
			api: api.reducer,
		},
		preloadedState,
		middleware: (getDefaultMiddleware) =>
			getDefaultMiddleware({
				serializableCheck: {
					ignoredActions: ["persist/PERSIST"],
				},
			}).concat(api.middleware),
	})
}

// Custom render with providers
interface ExtendedRenderOptions extends Omit<RenderOptions, "wrapper"> {
	preloadedState?: any
	store?: any
}

export function renderWithProviders(
	ui: ReactElement,
	{
		preloadedState = {},
		store = createTestStore(preloadedState),
		...renderOptions
	}: ExtendedRenderOptions = {},
) {
	console.log("DEBUG: Checking components in renderWithProviders:", {
		ProviderType: typeof Provider,
		PaperProviderType: typeof PaperProvider,
		NavigationContainerType: typeof NavigationContainer,
		ProviderVal: Provider,
		PaperProviderVal: PaperProvider,
		NavigationContainerVal: NavigationContainer,
	})
	function Wrapper({ children }: { children: React.ReactNode }) {
		return (
			<Provider store={store}>
				<PaperProvider>
					<NavigationContainer>{children}</NavigationContainer>
				</PaperProvider>
			</Provider>
		)
	}

	return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) }
}

// Async wait utility
export const waitForAsync = () =>
	new Promise((resolve) => setTimeout(resolve, 0))

// Reset all mocks utility
export const resetAllMocks = () => {
	jest.clearAllMocks()
	mockNavigation.navigate.mockClear()
	mockNavigation.goBack.mockClear()
	mockNavigation.reset.mockClear()
	mockNavigation.setOptions.mockClear()
}
