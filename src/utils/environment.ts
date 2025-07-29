// Lazy import to avoid NativeModule access during initialization
let Constants: any = null;

/**
 * Environment variables utility that provides backward compatibility 
 * with react-native-config while using expo-constants
 */
class EnvironmentConfig {
  private getConstants() {
    if (!Constants) {
      Constants = require('expo-constants').default;
    }
    return Constants;
  }

  private getExtraConfig() {
    try {
      return this.getConstants().expoConfig?.extra || {};
    } catch (e) {
      console.warn('Could not access expo-constants, using empty config:', e);
      return {};
    }
  }

  /**
   * Get API base URL
   */
  get API_BASE(): string | undefined {
    return this.getExtraConfig().apiBase;
  }

  /**
   * Get Google Maps API key for Android
   */
  get GOOGLE_MAPS_API_KEY_ANDROID(): string | undefined {
    return this.getExtraConfig().googleMapsApiKeyAndroid;
  }

  /**
   * Get Google Maps API key for iOS
   */
  get GOOGLE_MAPS_API_KEY_IOS(): string | undefined {
    return this.getExtraConfig().googleMapsApiKeyIos;
  }

  /**
   * Get bundle identifier (development vs production)
   */
  get BUNDLE_IDENTIFIER(): string | undefined {
    return this.getExtraConfig().bundleIdentifier;
  }

  /**
   * Check if running in development mode
   */
  get IS_DEVELOPMENT(): boolean {
    return this.getExtraConfig().isDevelopment || false;
  }

  /**
   * Get EAS project ID
   */
  get EAS_PROJECT_ID(): string | undefined {
    return this.getExtraConfig().eas?.projectId;
  }

  /**
   * Get all environment variables as an object (react-native-config compatibility)
   */
  getAll(): Record<string, string | undefined> {
    return {
      API_BASE: this.API_BASE,
      GOOGLE_MAPS_API_KEY_ANDROID: this.GOOGLE_MAPS_API_KEY_ANDROID,
      GOOGLE_MAPS_API_KEY_IOS: this.GOOGLE_MAPS_API_KEY_IOS,
    };
  }
}

// Create singleton instance
export const Config = new EnvironmentConfig();

// Default export for backward compatibility with react-native-config
export default Config;

// Named export for direct access
export { Config as ExpoConfig };