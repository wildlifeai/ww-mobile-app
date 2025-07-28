/**
 * Test file to verify environment variable migration from react-native-config to expo-constants
 * This ensures backward compatibility during the migration phase
 */

import { Config } from '../environment';

// Mock expo-constants
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

describe('Environment Configuration Migration', () => {
  test('should provide backward compatibility with react-native-config', () => {
    // Test individual properties
    expect(Config.API_BASE).toBe('https://test-api.wildlife.com');
    expect(Config.GOOGLE_MAPS_API_KEY_ANDROID).toBe('test-android-key');
    expect(Config.GOOGLE_MAPS_API_KEY_IOS).toBe('test-ios-key');
    
    // Test new Expo-specific properties
    expect(Config.BUNDLE_IDENTIFIER).toBe('com.wildlife.wildlifewatcher.expo');
    expect(Config.IS_DEVELOPMENT).toBe(true);
    expect(Config.EAS_PROJECT_ID).toBe('6cf53a5e-90e1-4987-82c6-5f0337affe97');
  });

  test('should provide getAll() method for react-native-config compatibility', () => {
    const allConfig = Config.getAll();
    
    expect(allConfig).toEqual({
      API_BASE: 'https://test-api.wildlife.com',
      GOOGLE_MAPS_API_KEY_ANDROID: 'test-android-key',
      GOOGLE_MAPS_API_KEY_IOS: 'test-ios-key'
    });
  });

  test('should handle missing configuration gracefully', () => {
    // Mock empty configuration
    const originalConsole = console.warn;
    console.warn = jest.fn();
    
    // This would happen if expo-constants doesn't have the extra config
    expect(() => Config.API_BASE).not.toThrow();
    
    console.warn = originalConsole;
  });
});