import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureStore, Store } from '@reduxjs/toolkit';

// Import slices
import authSlice from '../../redux/slices/auth';
import bleStatusSlice from '../../redux/slices/bleStatus';
import devicesSlice from '../../redux/slices/devices';
import locationSlice from '../../redux/slices/location';
import deploymentsSlice from '../../redux/slices/deployments';
import projectsSlice from '../../redux/slices/projects';

// Default test state
const defaultTestState = {
  auth: {
    isAuthenticated: false,
    user: null,
    token: null,
    loading: false,
    error: null,
  },
  bleStatus: {
    isEnabled: false,
    isScanning: false,
    permission: 'unknown' as const,
  },
  devices: {
    discoveredDevices: [],
    connectedDevices: [],
    isScanning: false,
  },
  location: {
    currentLocation: null,
    locationHistory: [],
    isTracking: false,
    error: null,
  },
  deployments: {
    activeDeployments: [],
    completedDeployments: [],
    currentDeployment: null,
    loading: false,
    error: null,
  },
  projects: {
    projects: [],
    currentProject: null,
    loading: false,
    error: null,
  },
};

// Create test store
export function createTestStore(preloadedState = {}) {
  return configureStore({
    reducer: {
      auth: authSlice,
      bleStatus: bleStatusSlice,
      devices: devicesSlice,
      location: locationSlice,
      deployments: deploymentsSlice,
      projects: projectsSlice,
    },
    preloadedState: {
      ...defaultTestState,
      ...preloadedState,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
  });
}

const Stack = createNativeStackNavigator();

// Test wrapper component
type TestWrapperProps = {
  children: React.ReactNode;
  store?: Store;
  initialRoute?: string;
  initialParams?: any;
};

function TestWrapper({ 
  children, 
  store = createTestStore(),
  initialRoute = 'TestScreen',
  initialParams = {}
}: TestWrapperProps) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 375, height: 812 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <Provider store={store}>
        <PaperProvider>
          <NavigationContainer>
            <Stack.Navigator>
              <Stack.Screen 
                name="TestScreen" 
                component={() => <>{children}</>}
                initialParams={initialParams}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </PaperProvider>
      </Provider>
    </SafeAreaProvider>
  );
}

// Custom render function
type CustomRenderOptions = Omit<RenderOptions, 'wrapper'> & {
  store?: Store;
  initialRoute?: string;
  initialParams?: any;
};

export function renderWithProviders(
  ui: ReactElement,
  {
    store = createTestStore(),
    initialRoute = 'TestScreen',
    initialParams = {},
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <TestWrapper 
        store={store} 
        initialRoute={initialRoute}
        initialParams={initialParams}
      >
        {children}
      </TestWrapper>
    );
  }

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions })
  };
}

// Create authenticated test store
export function createAuthenticatedTestStore(userOverrides = {}) {
  const authenticatedState = {
    auth: {
      isAuthenticated: true,
      user: {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        confirmed: true,
        blocked: false,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        ...userOverrides,
      },
      token: 'mock-jwt-token',
      loading: false,
      error: null,
    },
  };

  return createTestStore(authenticatedState);
}

// Mock navigation helper
export const mockNavigate = jest.fn();
export const mockGoBack = jest.fn();
export const mockReset = jest.fn();

export const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  reset: mockReset,
  setOptions: jest.fn(),
  addListener: jest.fn(() => () => {}),
  removeListener: jest.fn(),
  canGoBack: jest.fn(() => false),
  dispatch: jest.fn(),
  getId: jest.fn(),
  getParent: jest.fn(),
  getState: jest.fn(),
  isFocused: jest.fn(() => true),
  setParams: jest.fn(),
};

// Reset all mocks
export const resetAllMocks = () => {
  jest.clearAllMocks();
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockReset.mockClear();
};

// Wait for async operations
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Export everything from testing-library-react-native
export * from '@testing-library/react-native';