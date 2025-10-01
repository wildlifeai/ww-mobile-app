# Wildlife Watcher MVP2 - Testing Requirements

**Version**: 1.0  
**Date**: August 6, 2024  
**Context**: Comprehensive testing strategy and requirements for Tasks 9-23

---

## 🎯 Testing Overview

This document defines the testing requirements, patterns, and standards for the Wildlife Watcher MVP2 implementation. The testing strategy ensures reliable offline-first functionality, robust BLE communication, and seamless user experience across all features.

**Testing Goals**:
- **Coverage**: >80% code coverage across services and utilities
- **Quality**: Zero critical bugs in production workflows
- **Performance**: <3s startup time, <100MB memory usage
- **Reliability**: 99.5% sync success rate, 90% BLE connection success
- **Security**: Zero high/critical security vulnerabilities

---

## 🏗️ Testing Architecture

### Testing Framework Stack
```json
{
  "unit_testing": {
    "framework": "Jest 29.7.0",
    "assertions": "@testing-library/jest-native",
    "mocking": "jest.mock(), jest-react-native"
  },
  "integration_testing": {
    "framework": "@testing-library/react-native",
    "rendering": "React Native Testing Library",
    "navigation": "@testing-library/react-navigation"
  },
  "e2e_testing": {
    "framework": "Detox",
    "device_simulation": "iOS Simulator, Android Emulator",
    "real_device_testing": "Physical devices for BLE testing"
  },
  "api_testing": {
    "mocking": "MSW (Mock Service Worker)",
    "supabase_testing": "Supabase test client",
    "offline_testing": "Network simulation"
  }
}
```

### Test Configuration
```typescript
// jest.config.js
module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/setup.ts'
  ],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.{js,ts,tsx}',
    '<rootDir>/src/**/?(*.)(test|spec).{js,ts,tsx}'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-paper|@supabase)/)'
  ]
}
```

### Test Setup
```typescript
// src/__tests__/setup.ts
import 'react-native-gesture-handler/jestSetup'
import '@testing-library/jest-native/extend-expect'

// Mock React Native modules
jest.mock('react-native-ble-manager', () => ({
  start: jest.fn(),
  scan: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  writeWithoutResponse: jest.fn(),
}))

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}))

// Mock Supabase
jest.mock('../services/supabase/client', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
    }
  }
}))

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  reset: jest.fn(),
}

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
}))

// Global test utilities
global.mockNavigation = mockNavigation
```

---

## 📋 Task-Specific Testing Requirements

## FOUNDATION LAYER TESTING

### Task 9: Authentication Testing

#### Unit Tests - AuthService
```typescript
// src/services/auth/__tests__/AuthService.test.ts
import { AuthService } from '../AuthService'
import { supabase } from '../../supabase/client'

jest.mock('../../supabase/client')
const mockedSupabase = supabase as jest.Mocked<typeof supabase>

describe('AuthService', () => {
  let authService: AuthService

  beforeEach(() => {
    authService = new AuthService()
    jest.clearAllMocks()
  })

  describe('signIn', () => {
    it('should sign in user successfully', async () => {
      const mockUser = { id: 'user-id', email: 'test@example.com' }
      const mockProfile = { id: 'user-id', email: 'test@example.com', organization: 'Test Org' }

      mockedSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: { access_token: 'token' } },
        error: null
      })

      mockedSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockProfile, error: null })
      } as any)

      const result = await authService.signIn({
        email: 'test@example.com',
        password: 'password123'
      })

      expect(result.user).toEqual(mockUser)
      expect(result.profile).toEqual(mockProfile)
      expect(mockedSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      })
    })

    it('should handle invalid credentials', async () => {
      mockedSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' }
      })

      await expect(authService.signIn({
        email: 'test@example.com',
        password: 'wrongpassword'
      })).rejects.toThrow('Invalid credentials')
    })

    it('should handle network errors gracefully', async () => {
      mockedSupabase.auth.signInWithPassword.mockRejectedValue(
        new Error('Network error')
      )

      await expect(authService.signIn({
        email: 'test@example.com',
        password: 'password123'
      })).rejects.toThrow('Network error')
    })
  })

  describe('signUp', () => {
    it('should create user account with confirmation', async () => {
      const mockUser = { id: 'user-id', email: 'test@example.com' }

      mockedSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: null }, // No session = needs confirmation
        error: null
      })

      const result = await authService.signUp({
        email: 'test@example.com',
        password: 'password123',
        organization: 'Test Org'
      })

      expect(result.needsConfirmation).toBe(true)
      expect(result.user).toEqual(mockUser)
    })
  })

  describe('resetPassword', () => {
    it('should send password reset email', async () => {
      mockedSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null
      })

      await authService.resetPassword('test@example.com')

      expect(mockedSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          redirectTo: 'wildlifewatcher://reset-password'
        })
      )
    })
  })
})
```

#### Integration Tests - LoginScreen
```typescript
// src/navigation/screens/auth/__tests__/LoginScreen.test.tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { Provider } from 'react-redux'
import { NavigationContainer } from '@react-navigation/native'
import { PaperProvider } from 'react-native-paper'

import { LoginScreen } from '../LoginScreen'
import { store } from '../../../store'
import { theme } from '../../../theme'

const renderLoginScreen = () => {
  return render(
    <Provider store={store}>
      <PaperProvider theme={theme}>
        <NavigationContainer>
          <LoginScreen />
        </NavigationContainer>
      </PaperProvider>
    </Provider>
  )
}

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render login form correctly', () => {
    const { getByText, getByPlaceholderText } = renderLoginScreen()

    expect(getByText('Wildlife Watcher')).toBeTruthy()
    expect(getByPlaceholderText('Enter your email')).toBeTruthy()
    expect(getByPlaceholderText('Enter your password')).toBeTruthy()
    expect(getByText('Sign In')).toBeTruthy()
  })

  it('should validate email format', async () => {
    const { getByPlaceholderText, getByText } = renderLoginScreen()

    const emailInput = getByPlaceholderText('Enter your email')
    const signInButton = getByText('Sign In')

    fireEvent.changeText(emailInput, 'invalid-email')
    fireEvent.press(signInButton)

    await waitFor(() => {
      expect(getByText('Invalid email address')).toBeTruthy()
    })
  })

  it('should require password', async () => {
    const { getByPlaceholderText, getByText } = renderLoginScreen()

    const emailInput = getByPlaceholderText('Enter your email')
    const signInButton = getByText('Sign In')

    fireEvent.changeText(emailInput, 'test@example.com')
    fireEvent.press(signInButton)

    await waitFor(() => {
      expect(getByText('Password is required')).toBeTruthy()
    })
  })

  it('should navigate to forgot password screen', () => {
    const { getByText } = renderLoginScreen()

    const forgotPasswordLink = getByText('Forgot Password?')
    fireEvent.press(forgotPasswordLink)

    expect(global.mockNavigation.navigate).toHaveBeenCalledWith('ForgotPassword')
  })

  it('should handle successful login', async () => {
    const { getByPlaceholderText, getByText } = renderLoginScreen()

    const emailInput = getByPlaceholderText('Enter your email')
    const passwordInput = getByPlaceholderText('Enter your password')
    const signInButton = getByText('Sign In')

    fireEvent.changeText(emailInput, 'test@example.com')
    fireEvent.changeText(passwordInput, 'password123')
    fireEvent.press(signInButton)

    await waitFor(() => {
      expect(global.mockNavigation.navigate).toHaveBeenCalledWith('Main')
    })
  })
})
```

---

### Task 10: Redux Integration Testing

#### Redux Slice Tests
```typescript
// src/store/slices/__tests__/authSlice.test.ts
import { configureStore } from '@reduxjs/toolkit'
import authSlice, { signIn, signUp, signOut } from '../authSlice'

const createTestStore = () =>
  configureStore({
    reducer: {
      auth: authSlice.reducer,
    },
  })

describe('authSlice', () => {
  let store: ReturnType<typeof createTestStore>

  beforeEach(() => {
    store = createTestStore()
  })

  it('should handle initial state', () => {
    const state = store.getState().auth
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
    expect(state.isLoading).toBe(false)
  })

  it('should handle signIn pending', () => {
    store.dispatch(signIn.pending('requestId', { email: 'test@example.com', password: 'password' }))
    
    const state = store.getState().auth
    expect(state.isLoading).toBe(true)
    expect(state.error).toBeNull()
  })

  it('should handle signIn fulfilled', () => {
    const mockUser = { id: 'user-id', email: 'test@example.com' }
    const mockProfile = { id: 'user-id', email: 'test@example.com', organization: 'Test' }

    store.dispatch(signIn.fulfilled({ user: mockUser, profile: mockProfile }, 'requestId', {
      email: 'test@example.com',
      password: 'password'
    }))
    
    const state = store.getState().auth
    expect(state.isAuthenticated).toBe(true)
    expect(state.user).toEqual(mockUser)
    expect(state.profile).toEqual(mockProfile)
    expect(state.isLoading).toBe(false)
  })

  it('should handle signIn rejected', () => {
    store.dispatch(signIn.rejected(
      new Error('Invalid credentials'),
      'requestId',
      { email: 'test@example.com', password: 'wrong' }
    ))
    
    const state = store.getState().auth
    expect(state.isAuthenticated).toBe(false)
    expect(state.error).toBe('Invalid credentials')
    expect(state.isLoading).toBe(false)
  })
})
```

---

### Task 11: Offline Service Testing

#### Offline Service Tests
```typescript
// src/services/offline/__tests__/OfflineService.test.ts
import { OfflineService } from '../OfflineService'
import NetInfo from '@react-native-community/netinfo'

jest.mock('@react-native-community/netinfo')
jest.mock('expo-sqlite')

const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>

describe('OfflineService', () => {
  let offlineService: OfflineService

  beforeEach(() => {
    offlineService = new OfflineService()
    jest.clearAllMocks()
  })

  it('should queue operations when offline', async () => {
    mockNetInfo.fetch.mockResolvedValue({ isConnected: false } as any)

    const operationId = await offlineService.queueOperation({
      type: 'CREATE',
      table: 'projects',
      data: { name: 'Test Project', description: 'Test' }
    })

    expect(operationId).toBeDefined()
    expect(typeof operationId).toBe('string')
  })

  it('should sync operations when online', async () => {
    mockNetInfo.fetch.mockResolvedValue({ isConnected: true } as any)

    const syncSpy = jest.spyOn(offlineService, 'syncPendingOperations')
    
    await offlineService.queueOperation({
      type: 'CREATE',
      table: 'projects',
      data: { name: 'Test Project' }
    })

    expect(syncSpy).toHaveBeenCalled()
  })

  it('should handle sync failures gracefully', async () => {
    // Mock database operations to simulate failures
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    await offlineService.syncPendingOperations()

    // Should not throw errors, but log them
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
```

---

## PARALLEL DEVELOPMENT STREAMS TESTING

## STREAM A: PROJECT MANAGEMENT TESTING

### Task 12: Projects CRUD Testing

#### Projects Service Tests
```typescript
// src/services/projects/__tests__/ProjectsService.test.ts
import { ProjectsService } from '../ProjectsService'
import { supabase } from '../../supabase/client'

jest.mock('../../supabase/client')

describe('ProjectsService', () => {
  let projectsService: ProjectsService

  beforeEach(() => {
    projectsService = new ProjectsService()
    jest.clearAllMocks()
  })

  it('should create project successfully', async () => {
    const mockProject = {
      id: 'project-id',
      name: 'Test Project',
      description: 'Test Description',
      owner_id: 'user-id'
    }

    const mockSupabase = supabase as any
    mockSupabase.from.mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockProject, error: null })
    })

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-id' } }
    })

    const result = await projectsService.createProject({
      name: 'Test Project',
      description: 'Test Description'
    })

    expect(result).toEqual(mockProject)
  })

  it('should get user projects with computed fields', async () => {
    const mockProjectsData = [
      {
        id: 'project-1',
        name: 'Project 1',
        project_members: [{ user_id: 'user-1' }, { user_id: 'user-2' }],
        deployments: [
          { id: 'dep-1', status: 'active' },
          { id: 'dep-2', status: 'ended' }
        ]
      }
    ]

    const mockSupabase = supabase as any
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: mockProjectsData, error: null })
    })

    const result = await projectsService.getUserProjects()

    expect(result[0]).toMatchObject({
      id: 'project-1',
      name: 'Project 1',
      memberCount: 2,
      activeDeployments: 1,
      totalDeployments: 2
    })
  })
})
```

#### Projects Screen Integration Tests
```typescript
// src/navigation/screens/__tests__/ProjectsScreen.test.tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { Provider } from 'react-redux'
import { NavigationContainer } from '@react-navigation/native'
import { PaperProvider } from 'react-native-paper'

import { ProjectsScreen } from '../ProjectsScreen'
import { createTestStore } from '../../../__tests__/testUtils'
import { theme } from '../../../theme'

const renderProjectsScreen = (initialState = {}) => {
  const store = createTestStore(initialState)
  
  return render(
    <Provider store={store}>
      <PaperProvider theme={theme}>
        <NavigationContainer>
          <ProjectsScreen />
        </NavigationContainer>
      </PaperProvider>
    </Provider>
  )
}

describe('ProjectsScreen', () => {
  it('should display projects list', async () => {
    const initialState = {
      projects: {
        projects: [
          {
            id: 'project-1',
            name: 'Wildlife Survey 2024',
            description: 'Annual wildlife monitoring project',
            memberCount: 3,
            activeDeployments: 2,
            totalDeployments: 5
          }
        ],
        isLoading: false,
        error: null
      }
    }

    const { getByText } = renderProjectsScreen(initialState)

    expect(getByText('Wildlife Survey 2024')).toBeTruthy()
    expect(getByText('Annual wildlife monitoring project')).toBeTruthy()
    expect(getByText('3 members')).toBeTruthy()
    expect(getByText('2 active')).toBeTruthy()
  })

  it('should show empty state when no projects', () => {
    const initialState = {
      projects: {
        projects: [],
        isLoading: false,
        error: null
      }
    }

    const { getByText } = renderProjectsScreen(initialState)
    expect(getByText('No projects found')).toBeTruthy()
  })

  it('should navigate to new project on FAB press', () => {
    const { getByLabelText } = renderProjectsScreen()

    const fab = getByLabelText('Add new project')
    fireEvent.press(fab)

    expect(global.mockNavigation.navigate).toHaveBeenCalledWith('NewProject')
  })

  it('should filter projects by search query', async () => {
    const initialState = {
      projects: {
        projects: [
          { id: '1', name: 'Wildlife Survey', description: 'Birds and mammals' },
          { id: '2', name: 'Forest Monitoring', description: 'Tree health monitoring' }
        ],
        isLoading: false,
        error: null
      }
    }

    const { getByPlaceholderText, getByText, queryByText } = renderProjectsScreen(initialState)

    const searchBar = getByPlaceholderText('Search projects...')
    fireEvent.changeText(searchBar, 'wildlife')

    await waitFor(() => {
      expect(getByText('Wildlife Survey')).toBeTruthy()
      expect(queryByText('Forest Monitoring')).toBeNull()
    })
  })
})
```

---

## STREAM B: DEPLOYMENT WORKFLOWS TESTING

### Task 15: Deployment Wizard Testing

#### Device Discovery Integration Tests
```typescript
// src/navigation/screens/deployment/__tests__/DeviceDiscoveryScreen.test.tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { DeviceDiscoveryScreen } from '../start/DeviceDiscoveryScreen'
import * as BLEManager from 'react-native-ble-manager'

jest.mock('react-native-ble-manager')
const mockBLEManager = BLEManager as jest.Mocked<typeof BLEManager>

describe('DeviceDiscoveryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should request permissions and start scanning', async () => {
    const initialState = {
      ble: {
        permissionStatus: 'granted',
        isScanning: false,
        devices: [],
        selectedDevice: null
      }
    }

    const { getByText } = render(<DeviceDiscoveryScreen />, { initialState })

    const scanButton = getByText('Start Scanning')
    fireEvent.press(scanButton)

    await waitFor(() => {
      expect(mockBLEManager.scan).toHaveBeenCalled()
    })
  })

  it('should display discovered devices', () => {
    const mockDevices = [
      {
        id: 'device-1',
        name: 'Wildlife Camera 001',
        rssi: -45,
        isConnectable: true
      },
      {
        id: 'device-2',
        name: 'Wildlife Camera 002',
        rssi: -67,
        isConnectable: true
      }
    ]

    const initialState = {
      ble: {
        permissionStatus: 'granted',
        isScanning: false,
        devices: mockDevices,
        selectedDevice: null
      }
    }

    const { getByText } = render(<DeviceDiscoveryScreen />, { initialState })

    expect(getByText('Wildlife Camera 001')).toBeTruthy()
    expect(getByText('Wildlife Camera 002')).toBeTruthy()
    expect(getByText('-45 dBm')).toBeTruthy()
    expect(getByText('-67 dBm')).toBeTruthy()
  })

  it('should handle device selection', async () => {
    const mockDevice = {
      id: 'device-1',
      name: 'Wildlife Camera 001',
      rssi: -45,
      isConnectable: true
    }

    const initialState = {
      ble: {
        permissionStatus: 'granted',
        isScanning: false,
        devices: [mockDevice],
        selectedDevice: null
      }
    }

    const { getByText } = render(<DeviceDiscoveryScreen />, { initialState })

    const deviceCard = getByText('Wildlife Camera 001')
    fireEvent.press(deviceCard)

    await waitFor(() => {
      expect(global.mockNavigation.navigate).toHaveBeenCalledWith('DeploymentConfig')
    })
  })

  it('should show permission denied state', () => {
    const initialState = {
      ble: {
        permissionStatus: 'denied',
        isScanning: false,
        devices: [],
        selectedDevice: null
      }
    }

    const { getByText } = render(<DeviceDiscoveryScreen />, { initialState })

    expect(getByText('Bluetooth Permission Required')).toBeTruthy()
    expect(getByText('Open Settings')).toBeTruthy()
  })
})
```

#### Deployment Creation E2E Tests
```typescript
// e2e/deploymentFlow.e2e.js
describe('Deployment Creation Flow', () => {
  beforeAll(async () => {
    await device.launchApp()
    await device.reloadReactNative()
  })

  beforeEach(async () => {
    await device.reloadReactNative()
  })

  it('should complete full deployment creation', async () => {
    // Login
    await element(by.id('email-input')).typeText('test@example.com')
    await element(by.id('password-input')).typeText('password123')
    await element(by.id('login-button')).tap()

    // Navigate to Maps
    await expect(element(by.id('maps-screen'))).toBeVisible()

    // Start deployment flow
    await element(by.id('start-deployment-fab')).tap()

    // Step 1: Project Selection
    await expect(element(by.text('Project Selection'))).toBeVisible()
    await element(by.id('project-dropdown')).tap()
    await element(by.text('Wildlife Survey 2024')).tap()
    await element(by.id('deployment-name-input')).typeText('Camera Site A1')
    await element(by.id('continue-button')).tap()

    // Step 2: Device Discovery
    await expect(element(by.text('Device Discovery'))).toBeVisible()
    await element(by.id('start-scan-button')).tap()
    
    // Wait for device to appear (mocked in E2E)
    await waitFor(element(by.text('Wildlife Camera 001')))
      .toBeVisible()
      .withTimeout(5000)
    
    await element(by.text('Wildlife Camera 001')).tap()

    // Step 3: Configuration
    await expect(element(by.text('Deployment Configuration'))).toBeVisible()
    await element(by.id('use-my-location-button')).tap()
    await element(by.text('Motion')).tap()
    await element(by.id('continue-button')).tap()

    // Step 4: Camera Preview (mocked)
    await expect(element(by.text('Camera Preview'))).toBeVisible()
    await element(by.id('approve-continue-button')).tap()

    // Step 5: Final Setup
    await expect(element(by.text('Final Setup'))).toBeVisible()
    await element(by.id('description-input')).typeText('Testing deployment creation')
    await element(by.id('start-deployment-button')).tap()

    // Verify success
    await expect(element(by.text('Deployment Created Successfully'))).toBeVisible()
  })

  it('should handle offline deployment creation', async () => {
    // Simulate offline mode
    await device.setNetworkConnection('offline')

    // Complete deployment flow (steps omitted for brevity)
    // ...

    // Verify deployment queued for sync
    await expect(element(by.text('Deployment saved offline'))).toBeVisible()

    // Restore network and verify sync
    await device.setNetworkConnection('online')
    await expect(element(by.text('Deployment synced successfully'))).toBeVisible()
  })
})
```

---

## STREAM C: DEVICE & MAPS TESTING

### Task 18: BLE Integration Testing

#### BLE Service Tests
```typescript
// src/services/ble/__tests__/BLEService.test.ts
import { BLEService } from '../BLEService'
import BLEManager from 'react-native-ble-manager'

jest.mock('react-native-ble-manager')
const mockBLEManager = BLEManager as jest.Mocked<typeof BLEManager>

describe('BLEService', () => {
  let bleService: BLEService

  beforeEach(() => {
    bleService = new BLEService()
    jest.clearAllMocks()
  })

  it('should initialize BLE manager', async () => {
    await bleService.initialize()
    expect(mockBLEManager.start).toHaveBeenCalled()
  })

  it('should scan for devices', async () => {
    mockBLEManager.scan.mockResolvedValue()
    
    await bleService.startScan()
    
    expect(mockBLEManager.scan).toHaveBeenCalledWith(
      [], // service UUIDs
      10, // scan duration
      true // allow duplicates
    )
  })

  it('should connect to device', async () => {
    const deviceId = 'device-123'
    mockBLEManager.connect.mockResolvedValue()
    
    const result = await bleService.connectToDevice(deviceId)
    
    expect(mockBLEManager.connect).toHaveBeenCalledWith(deviceId)
    expect(result).toBe(true)
  })

  it('should handle connection failures', async () => {
    const deviceId = 'device-123'
    mockBLEManager.connect.mockRejectedValue(new Error('Connection failed'))
    
    const result = await bleService.connectToDevice(deviceId)
    
    expect(result).toBe(false)
  })

  it('should send PING command', async () => {
    const deviceId = 'device-123'
    mockBLEManager.writeWithoutResponse.mockResolvedValue()
    
    await bleService.sendPing(deviceId)
    
    expect(mockBLEManager.writeWithoutResponse).toHaveBeenCalledWith(
      deviceId,
      expect.any(String), // service UUID
      expect.any(String), // characteristic UUID
      expect.any(Array)   // PING command bytes
    )
  })

  it('should handle PONG responses', async () => {
    const mockPongData = new Uint8Array([0x50, 0x4F, 0x4E, 0x47]) // "PONG"
    const callback = jest.fn()
    
    bleService.onPongReceived(callback)
    
    // Simulate receiving PONG
    bleService.handleCharacteristicUpdate('device-123', 'char-uuid', mockPongData)
    
    expect(callback).toHaveBeenCalledWith('device-123', mockPongData)
  })
})
```

### Task 19: Maps Integration Testing

#### Maps Service Tests
```typescript
// src/services/maps/__tests__/MapsService.test.ts
import { MapsService } from '../MapsService'
import { supabase } from '../../supabase/client'

jest.mock('../../supabase/client')

describe('MapsService', () => {
  let mapsService: MapsService

  beforeEach(() => {
    mapsService = new MapsService()
    jest.clearAllMocks()
  })

  it('should get deployment markers', async () => {
    const mockDeployments = [
      {
        id: 'deployment-1',
        name: 'Site A',
        latitude: 37.7749,
        longitude: -122.4194,
        status: 'active',
        battery_level: 85,
        sd_card_usage: 45,
        projects: { name: 'Wildlife Survey' },
        devices: { name: 'Camera 001' }
      }
    ]

    const mockSupabase = supabase as any
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis()
    })
    mockSupabase.from().select().not().not.mockResolvedValue({
      data: mockDeployments,
      error: null
    })

    const markers = await mapsService.getDeploymentMarkers()

    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({
      id: 'deployment-1',
      title: 'Site A',
      description: 'Wildlife Survey - Camera 001',
      coordinate: {
        latitude: 37.7749,
        longitude: -122.4194
      },
      status: 'active',
      batteryLevel: 85,
      sdCardUsage: 45
    })
  })

  it('should handle reverse geocoding', async () => {
    const mockResponse = {
      results: [{
        formatted_address: '123 Main St, San Francisco, CA 94102, USA'
      }]
    }

    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockResponse)
    })

    const address = await mapsService.reverseGeocode(37.7749, -122.4194)

    expect(address).toBe('123 Main St, San Francisco, CA 94102, USA')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('maps.googleapis.com/maps/api/geocode/json')
    )
  })

  it('should handle geocoding failures gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const address = await mapsService.reverseGeocode(37.7749, -122.4194)

    expect(address).toBeNull()
  })
})
```

---

## 🧪 Specialized Testing Patterns

### Offline Testing Utilities
```typescript
// src/__tests__/utils/offlineTestUtils.ts
export const mockOfflineMode = () => {
  jest.spyOn(require('@react-native-community/netinfo'), 'fetch')
    .mockResolvedValue({ isConnected: false, isInternetReachable: false })
}

export const mockOnlineMode = () => {
  jest.spyOn(require('@react-native-community/netinfo'), 'fetch')
    .mockResolvedValue({ isConnected: true, isInternetReachable: true })
}

export const mockIntermittentConnection = () => {
  let isOnline = true
  jest.spyOn(require('@react-native-community/netinfo'), 'fetch')
    .mockImplementation(() => {
      isOnline = !isOnline
      return Promise.resolve({ isConnected: isOnline, isInternetReachable: isOnline })
    })
}
```

### Supabase Testing Utilities
```typescript
// src/__tests__/utils/supabaseTestUtils.ts
export const mockSupabaseSuccess = (table: string, data: any) => {
  const mockSupabase = require('../../services/supabase/client').supabase
  mockSupabase.from.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data, error: null })
  })
}

export const mockSupabaseError = (table: string, error: any) => {
  const mockSupabase = require('../../services/supabase/client').supabase
  mockSupabase.from.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error })
  })
}

export const mockSupabaseAuth = (user: any = null, session: any = null) => {
  const mockSupabase = require('../../services/supabase/client').supabase
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : new Error('Not authenticated')
  })
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session },
    error: null
  })
}
```

### Performance Testing Utilities
```typescript
// src/__tests__/utils/performanceTestUtils.ts
export const measureRenderTime = async (component: React.ReactElement) => {
  const startTime = performance.now()
  
  render(component)
  
  const endTime = performance.now()
  return endTime - startTime
}

export const measureAsyncOperation = async (operation: () => Promise<any>) => {
  const startTime = performance.now()
  
  await operation()
  
  const endTime = performance.now()
  return endTime - startTime
}

export const expectPerformanceBenchmark = (actualTime: number, maxTime: number) => {
  expect(actualTime).toBeLessThan(maxTime)
}
```

---

## 🚀 Test Automation & CI/CD

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run type-check
    
    - name: Run unit tests
      run: npm test -- --coverage --watchAll=false
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Build app
      run: npm run build:test

  e2e-android:
    runs-on: ubuntu-latest
    needs: test
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Setup Java
      uses: actions/setup-java@v3
      with:
        java-version: '11'
        distribution: 'temurin'
    
    - name: Setup Android SDK
      uses: android-actions/setup-android@v2
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build Android APK
      run: npx detox build --configuration android.emu.release
    
    - name: Run E2E tests
      run: npx detox test --configuration android.emu.release --headless

  performance:
    runs-on: ubuntu-latest
    needs: test
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run performance tests
      run: npm run test:performance
    
    - name: Bundle size check
      run: npm run bundle-size-check
```

### Test Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:integration": "jest --testMatch='**/*.integration.test.{js,ts,tsx}'",
    "test:e2e": "detox test",
    "test:e2e:build": "detox build",
    "test:performance": "jest --testMatch='**/*.performance.test.{js,ts,tsx}'",
    "bundle-size-check": "npx bundle-analyzer",
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
    "type-check": "tsc --noEmit"
  }
}
```

---

## 📊 Testing Metrics & Quality Gates

### Coverage Requirements
```typescript
// jest.config.js coverage thresholds
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  },
  // Higher requirements for critical services
  'src/services/': {
    branches: 90,
    functions: 90,
    lines: 90,
    statements: 90
  },
  'src/store/': {
    branches: 85,
    functions: 85,
    lines: 85,
    statements: 85
  }
}
```

### Performance Benchmarks
```typescript
// Performance test expectations
const PERFORMANCE_BENCHMARKS = {
  APP_STARTUP: 3000, // 3 seconds
  SCREEN_TRANSITION: 300, // 300ms
  API_RESPONSE: 2000, // 2 seconds
  BLE_CONNECTION: 5000, // 5 seconds
  SYNC_OPERATION: 10000, // 10 seconds
  MEMORY_USAGE: 100 * 1024 * 1024, // 100MB
}
```

### Quality Gates
```typescript
// Quality gates that must pass for deployment
export const QUALITY_GATES = {
  UNIT_TEST_COVERAGE: 80,
  INTEGRATION_TEST_COVERAGE: 70,
  E2E_TEST_PASS_RATE: 95,
  LINTING_ERRORS: 0,
  TYPE_CHECK_ERRORS: 0,
  SECURITY_VULNERABILITIES_HIGH: 0,
  SECURITY_VULNERABILITIES_CRITICAL: 0,
  PERFORMANCE_REGRESSION_THRESHOLD: 10, // 10% slower than baseline
  BUNDLE_SIZE_INCREASE_THRESHOLD: 5, // 5% larger than baseline
}
```

---

## 🎯 Testing Best Practices

### Test Organization
- **Unit Tests**: Test individual functions and components in isolation
- **Integration Tests**: Test interaction between multiple components/services
- **E2E Tests**: Test complete user workflows across the entire app
- **Performance Tests**: Test app performance under various conditions
- **Visual Tests**: Test UI components render correctly (screenshot testing)

### Mocking Strategy
- **External APIs**: Mock all external API calls (Supabase, Google Maps)
- **Native Modules**: Mock React Native and Expo modules
- **Hardware APIs**: Mock BLE, Location, Camera permissions and operations
- **Navigation**: Mock navigation calls but test navigation logic
- **Storage**: Mock AsyncStorage and SQLite operations

### Test Data Management
- **Factories**: Use factory functions to create test data
- **Fixtures**: Store reusable test data in fixture files
- **Cleanup**: Ensure tests don't affect each other (isolate state)
- **Seeding**: Provide consistent test data for integration tests

---

**Document Status**: ✅ **COMPLETE** - Comprehensive testing strategy and requirements  
**Coverage**: 80%+ code coverage target with specialized testing for BLE, offline, and maps  
**Quality Gates**: Performance benchmarks and security requirements defined  
**Ready for**: Implementation with robust testing throughout development process