export default ({ config }) => {
  // Determine if we're in development mode
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  // Base bundle identifiers from migration config
  const baseBundleId = 'com.wildlife.wildlifewatcher';
  
  // Use .expo suffix for development builds as per BUNDLE-IDENTIFIER-STRATEGY.md
  const bundleId = isDevelopment ? `${baseBundleId}.expo` : baseBundleId;
  
  return {
    ...config,
    name: 'WildlifeWatcher',
    slug: 'wildlife-watcher-expo',
    version: '0.0.1',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    assetBundlePatterns: [
      '**/*'
    ],
    ios: {
      bundleIdentifier: bundleId,
      config: {
        usesNonExemptEncryption: false
      },
      infoPlist: {
        CFBundleURLTypes: [
          {
            CFBundleURLName: 'wildlife-auth',
            CFBundleURLSchemes: ['com.wildlife.auth']
          },
          {
            CFBundleURLName: 'wildlife-watcher',
            CFBundleURLSchemes: ['com.wildlife.watcher']
          }
        ]
      }
    },
    android: {
      package: bundleId,
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID
        }
      },
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'BLUETOOTH',
        'BLUETOOTH_ADMIN',
        'BLUETOOTH_CONNECT',
        'BLUETOOTH_SCAN',
        'CAMERA',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE'
      ]
    },
    web: {
      favicon: './assets/favicon.png'
    },
    extra: {
      eas: {
        projectId: '6cf53a5e-90e1-4987-82c6-5f0337affe97'
      },
      // Environment variables accessible via Constants.expoConfig.extra
      apiBase: process.env.API_BASE || process.env.EXPO_PUBLIC_API_BASE,
      googleMapsApiKeyAndroid: process.env.GOOGLE_MAPS_API_KEY_ANDROID || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID,
      googleMapsApiKeyIos: process.env.GOOGLE_MAPS_API_KEY_IOS || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS,
      // Bundle identifier info for runtime access
      bundleIdentifier: bundleId,
      isDevelopment
    },
    plugins: [
      'expo-splash-screen',
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 34,
            targetSdkVersion: 34,
            buildToolsVersion: '34.0.0',
            minSdkVersion: 23
          },
          ios: {
            deploymentTarget: '15.1'
          }
        }
      ]
    ]
  };
};