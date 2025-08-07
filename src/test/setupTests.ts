/**
 * Jest test setup file
 * This file is automatically loaded before every test file
 */

import 'react-native-gesture-handler/jestSetup';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock React Native modules
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');

// Mock Expo modules
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiBase: 'https://test-api.wildlife.com',
      googleMapsApiKeyAndroid: 'test-android-key',
      googleMapsApiKeyIos: 'test-ios-key',
      bundleIdentifier: 'com.wildlife.wildlifewatcher.expo',
      isDevelopment: true,
      eas: {
        projectId: '6cf53a5e-90e1-4987-82c6-5f0337affe97'
      }
    }
  }
}));

jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  parse: jest.fn((url: string) => ({
    hostname: 'localhost',
    path: url.split('://')[1]?.split('?')[0] || '',
    queryParams: {}
  })),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  createURL: jest.fn((path: string) => `wildlifewatcher://${path}`),
}));

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(),
  preventAutoHideAsync: jest.fn(),
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      reset: jest.fn(),
      setOptions: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
    useFocusEffect: jest.fn(),
  };
});

// Mock React Native Paper
jest.mock('react-native-paper', () => ({
  ...jest.requireActual('react-native-paper'),
  MD3LightTheme: {
    colors: {
      primary: '#6200EE',
      onPrimary: '#FFFFFF',
      background: '#FFFFFF',
      surface: '#FFFFFF',
    },
  },
}));

// Mock React Native Vector Icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'MaterialIcon');
jest.mock('react-native-vector-icons/FontAwesome', () => 'FontAwesome');

// Mock BLE Manager
jest.mock('react-native-ble-manager', () => ({
  start: jest.fn(() => Promise.resolve()),
  scan: jest.fn(() => Promise.resolve()),
  stopScan: jest.fn(() => Promise.resolve()),
  connect: jest.fn(() => Promise.resolve()),
  disconnect: jest.fn(() => Promise.resolve()),
  isPeripheralConnected: jest.fn(() => Promise.resolve(false)),
  getConnectedPeripherals: jest.fn(() => Promise.resolve([])),
  addListener: jest.fn(),
  removeAllListeners: jest.fn(),
}));

// Mock React Native Toast Message
jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
  hide: jest.fn(),
}));

// Mock React Native Device Info
jest.mock('react-native-device-info', () => ({
  getVersion: jest.fn(() => Promise.resolve('1.0.0')),
  getBuildNumber: jest.fn(() => Promise.resolve('1')),
  getSystemVersion: jest.fn(() => Promise.resolve('14.0')),
  getModel: jest.fn(() => Promise.resolve('iPhone')),
}));

// Mock Geolocation
jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
  stopObserving: jest.fn(),
}));

// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// Setup fake timers
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.clearAllMocks();
});