# Expo Fundamentals Guide

## Overview

This guide explains core Expo SDK concepts that every Wildlife Watcher developer should understand. It bridges the gap between basic React Native knowledge and the EAS Build system, helping you understand what changes when migrating from bare React Native to Expo-powered development.

## What is Expo?

### Expo vs Traditional React Native

| **Framework** | Expo SDK 54 | React Native 0.81.5 |
| **Setup** | Complex native tooling (Xcode, Android Studio) | Single CLI tool |
| **Development** | Platform-specific commands | Unified `expo start` command |
| **Native Modules** | Manual linking, platform code | Pre-built expo-* modules |
| **Building** | Local Xcode/Gradle builds | Cloud builds (EAS) or local |
| **Updates** | Full app store releases | Over-the-air (OTA) updates |
| **Configuration** | Platform-specific config files | Single app.config.js |

### Expo Workflows

**Managed Workflow:**
- Expo controls all native code
- Limited to Expo SDK modules
- Simplest setup, most restrictions

**Bare Workflow:**
- Full access to native code
- Can use any React Native library
- More complex but more flexible

**Wildlife Watcher Uses: Hybrid Approach**
- Started as bare React Native
- Added Expo SDK while keeping native modules
- Best of both worlds: Expo tooling + native flexibility

## Core Expo SDK Concepts

### 1. App Configuration (app.config.js)

The `app.config.js` file is the heart of Expo configuration:

```javascript
// app.config.js - Wildlife Watcher example
export default {
  expo: {
    name: "Wildlife Watcher",
    slug: "wildlife-watcher-expo",
    version: "1.0.0",
    orientation: "portrait",
    
    // Platform-specific settings
    android: {
      package: "com.wildlifeai.wildlifewatcher.expo",
      versionCode: 1,
      permissions: [
        "ACCESS_FINE_LOCATION",
        "BLUETOOTH",
        "BLUETOOTH_ADMIN"
      ]
    },
    
    ios: {
      bundleIdentifier: "com.wildlifeai.wildlifewatcher.expo",
      buildNumber: "1"
    },
    
    // Custom configuration
    extra: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
      apiBase: process.env.API_BASE_URL
    }
  }
};
```

**Key Sections:**
- **Basic Info**: App name, version, orientation
- **Platform Settings**: Bundle IDs, permissions, platform-specific config
- **Extra Config**: Custom environment variables and settings
- **Plugins**: Expo plugins for additional functionality

### 2. Expo Modules vs Native Modules

**What's the Difference?**
- **Expo Modules**: Pre-built by the Expo team, work everywhere, easier to use
- **Native Modules**: Built by the React Native community or companies, more powerful but require compilation

**Think of it like:**
- **Expo Modules**: Like buying furniture from IKEA - standardized, works everywhere, easy setup
- **Native Modules**: Like custom carpentry - more flexible and powerful, but needs special tools and skills

**Expo Modules (expo-*):**
```javascript
// Expo modules - consistent API across platforms
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';

// Universal APIs that work everywhere
const documentDirectory = FileSystem.documentDirectory;
const deviceName = Constants.deviceName;
```

**Native Modules (react-native-*):**
```javascript
// Native modules - Wildlife Watcher still uses these
import BleManager from 'react-native-ble-manager';
import MapView from 'react-native-maps';

// Platform-specific implementations
// Require native code compilation
```

**Wildlife Watcher Module Mix:**
- **Expo modules**: File system, constants, splash screen
- **Native modules**: BLE, Nordic DFU, Maps (specialized hardware needs)

### 3. Environment Variables and Constants

**What are Environment Variables?**
Environment variables are like settings that can change depending on where your app is running. For example:
- **Development**: Use test API servers, enable debug logging
- **Production**: Use real API servers, disable debug logging
- **Different developers**: Each person might have different API keys

Instead of hardcoding these values, you store them as "variables" that can be different in each "environment."

**Setting Variables:**
```bash
# EAS environment variables (build-time)
eas env:create --name GOOGLE_MAPS_API_KEY_ANDROID --value "your-key" --environment development

# Or in .env file (local development)
GOOGLE_MAPS_API_KEY_ANDROID=your-key-here
```

**Accessing in Code:**
```javascript
// app.config.js - Make available to app
export default {
  expo: {
    extra: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
      // Available at build time
    }
  }
};

// In your app code
import Constants from 'expo-constants';

const config = {
  mapsApiKey: Constants.expoConfig.extra.googleMapsApiKey,
  // Runtime access to build-time variables
};
```

## Development Workflows

### Expo Go vs Development Client

**What are Expo Go and Development Client?**
These are two different apps you can install on your phone to test your Wildlife Watcher app:

- **Expo Go**: A generic app from the Expo team that can run any Expo app, but with limitations
- **Development Client**: A custom-built version of YOUR specific app that includes all your native modules

#### Expo Go (Limited Testing)
```bash
# Start with Expo Go
npx expo start

# Scan QR code with Expo Go app
# Limitations: No native modules (BLE won't work)
```

**Use Expo Go for:**
- ✅ UI/UX testing
- ✅ Navigation flow testing  
- ✅ Redux state management testing
- ❌ BLE functionality (uses native modules)
- ❌ Maps with API keys
- ❌ Custom native code

#### Development Client (Full Functionality)
```bash
# Build development client (one-time, 10-15 minutes)
eas build --profile development --platform android

# Daily development (instant)
npx expo start --dev-client
```

**Use Development Client for:**
- ✅ Full BLE testing with Wildlife Watcher devices
- ✅ Maps with API keys
- ✅ All native modules
- ✅ Production-like testing
- ✅ Team sharing (share APK file)

### Development Server Modes

**What is a Development Server?**
A development server is a local web server that runs on your computer and serves your app's JavaScript code to your phone in real-time. Instead of building a complete app every time you make a change, the development server sends just the updated code to your already-installed app, making development much faster.

**Standard Mode:**
```bash
npx expo start
# Metro bundler serves JavaScript
# Hot reload for JS/TS changes
# No native code changes
```

**Development Client Mode:**
```bash
npx expo start --dev-client
# Connects to development build on device
# Full app functionality
# Hot reload + native modules
```

**Tunnel Mode (Network Issues):**
```bash
npx expo start --tunnel
# Routes through Expo servers
# Slower but works through firewalls
# Useful for WSL2 or complex networks
```

### Hot Reload vs Fast Refresh

**What are Hot Reload and Fast Refresh?**
These are two different ways your app can update when you change code:

**Hot Reload (Expo default):**
- **What it does**: Updates your app's code while keeping the current screen and data exactly as they were
- **Example**: If you're on page 3 of a form with data filled in, Hot Reload will update the code but keep you on page 3 with your data intact
- Preserves component state during updates
- Faster development iteration
- Works with Redux state

**Fast Refresh (React Native default):**
- **What it does**: Updates your app's code but resets everything back to the starting state
- **Example**: If you're on page 3 of a form, Fast Refresh will update the code but send you back to page 1 with empty forms
- Resets component state on updates
- More reliable but slower (need to navigate back to where you were)
- Better error recovery

```bash
# Enable/disable in development server
# Press 'r' in terminal to manually reload
# Press 'd' to open debug menu on device
```

## Metro Configuration

**What is Metro?**
Metro is the JavaScript bundler that takes all your app's code (JavaScript, TypeScript, images, etc.) and packages it together so it can run on your phone. Think of it like a smart packaging system that:
- Combines all your separate code files into one bundle
- Converts TypeScript to JavaScript
- Optimizes images and other assets
- Handles importing/exporting between files
- Sends the packaged code to your development server

### Expo's Metro Setup

Expo automatically configures Metro bundler, but you can customize:

```javascript
// metro.config.js - Wildlife Watcher customizations
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Custom transformers
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

// Custom resolvers
config.resolver = {
  ...config.resolver,
  assetExts: config.resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...config.resolver.sourceExts, 'svg'],
};

module.exports = config;
```

### Platform-Specific Files

**What are Platform-Specific Files?**
Sometimes you need different code for Android vs iOS because they handle things differently (like permissions, UI behavior, or native features). Instead of writing if/else statements everywhere, you can create separate files for each platform.

Expo supports React Native's platform extensions:

```
src/
├── components/
│   ├── MapView.js           # Shared implementation
│   ├── MapView.android.js   # Android-specific
│   └── MapView.ios.js       # iOS-specific
└── config/
    ├── permissions.js       # Shared
    ├── permissions.android.js # Android permissions
    └── permissions.ios.js   # iOS permissions
```

**Usage:**
```javascript
// Automatic platform selection
import MapView from './components/MapView';
import permissions from './config/permissions';

// Platform object for runtime checks
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  // Android-specific code
}
```

## Asset Management

**What is Asset Management?**
Assets are all the non-code files your app needs: images, fonts, videos, sounds, etc. Asset management is how you organize, load, and use these files in your app. Mobile apps need special handling for assets because:
- They get bundled into the app during build
- Different screen sizes need different image resolutions
- Assets need to be cached efficiently
- Some assets can be downloaded dynamically

### Static Assets

```javascript
// Traditional React Native
const image = require('./assets/wildlife-logo.png');

// Expo asset system
import { Asset } from 'expo-asset';

// Pre-load assets
const asset = Asset.fromModule(require('./assets/wildlife-logo.png'));
await asset.downloadAsync();
```

### Dynamic Assets

```javascript
// File system operations (migrated from react-native-fs)
import * as FileSystem from 'expo-file-system';

// Download and cache
const downloadPath = `${FileSystem.documentDirectory}firmware.zip`;
const download = FileSystem.createDownloadResumable(
  'https://api.example.com/firmware.zip',
  downloadPath
);

const { uri } = await download.downloadAsync();
```

## Build-Time vs Runtime Configuration

**What's the Difference?**
- **Build-time**: Configuration that gets "baked into" your app when it's built. Like ingredients mixed into a cake - once it's baked, you can't change them.
- **Runtime**: Configuration that can change while your app is running. Like toppings you can add to a cake after it's made.

**Examples:**
- **Build-time**: API server URLs, app name, permissions, Google Maps API keys
- **Runtime**: User preferences, authentication tokens, cached data

### Build-Time Configuration

**Set during EAS build:**
```bash
# Environment variables baked into the app
eas env:create --name API_BASE_URL --value "https://api.wildlife.com" --environment production
```

**Access pattern:**
```javascript
// app.config.js (build-time)
export default {
  expo: {
    extra: {
      apiBaseUrl: process.env.API_BASE_URL, // Available at build time
    }
  }
};

// App code (runtime)
import Constants from 'expo-constants';
const apiUrl = Constants.expoConfig.extra.apiBaseUrl; // Fixed at build time
```

### Runtime Configuration

**For values that can change:**
```javascript
// Dynamic configuration
import AsyncStorage from '@react-native-async-storage/async-storage';

// User preferences, authentication tokens, feature flags
const userSettings = await AsyncStorage.getItem('userSettings');
```

## Development vs Production Differences

### Development Mode

```javascript
// __DEV__ flag available
if (__DEV__) {
  console.log('Development mode - extra logging enabled');
  // Enable debugging tools
  // Use development API endpoints
}

// Expo Constants
import Constants from 'expo-constants';

if (Constants.manifest?.packagerOpts?.dev === true) {
  // Development build
}
```

### Production Mode

```javascript
// Optimizations enabled
// - JavaScript minification
// - Dead code elimination  
// - Asset optimization
// - Source map generation for crash reporting

// Production-only features
if (!__DEV__) {
  // Crash reporting
  // Analytics
  // Performance monitoring
}
```

## Debugging Tools

**What are Debugging Tools?**
Debugging tools help you find and fix problems in your app. They let you:
- See error messages and console logs
- Inspect what your app is doing step-by-step
- Monitor network requests to APIs
- Check how your app is performing
- Examine the current state of your app's data

### Expo Debug Menu

**Access methods:**
- Shake device
- Three-finger tap (iOS)
- Cmd+D (iOS simulator)
- Ctrl+M (Android emulator)

**Debug options:**
- Reload app
- Open developer menu
- Toggle performance monitor
- Toggle element inspector

### Development Tools

```bash
# Start with debugging
npx expo start --dev-client

# Network debugging
npx expo start --dev-client --tunnel

# Clear cache
npx expo start --clear

# Reset bundler cache
npx expo start --reset-cache
```

### Remote Debugging

```javascript
// Console.log appears in browser console
console.log('Debug message from device');

// Network requests visible in Network tab
fetch('https://api.wildlife.com/devices')
  .then(response => console.log('API response:', response));

// Redux DevTools (if configured)
// Component inspection
// Performance profiling
```

## Platform-Specific Considerations

### Android Development

**Permissions in app.config.js:**
```javascript
export default {
  expo: {
    android: {
      permissions: [
        "ACCESS_FINE_LOCATION",      // For BLE scanning
        "ACCESS_COARSE_LOCATION",    // For BLE scanning  
        "BLUETOOTH",                 // For BLE connections
        "BLUETOOTH_ADMIN",           // For BLE management
        "CAMERA",                    // For QR code scanning
        "WRITE_EXTERNAL_STORAGE"     // For file downloads
      ]
    }
  }
};
```

**Build configuration:**
```javascript
// eas.json - Android specific
{
  "development": {
    "android": {
      "buildType": "apk",           // APK for easy installation
      "gradleCommand": ":app:assembleDebug"
    }
  },
  "production": {
    "android": {
      "buildType": "app-bundle"     // AAB for Play Store
    }
  }
}
```

### iOS Development

**Info.plist via app.config.js:**
```javascript
export default {
  expo: {
    ios: {
      infoPlist: {
        NSBluetoothAlwaysUsageDescription: "This app uses Bluetooth to connect to wildlife monitoring devices.",
        NSLocationWhenInUseUsageDescription: "This app uses location to track device deployments."
      }
    }
  }
};
```

**Capabilities and entitlements:**
- Handled automatically by Expo
- Custom entitlements in app.config.js if needed
- Apple Developer account required for device builds

## Migration from Bare React Native

### What Changed (Wildlife Watcher Experience)

**Before (Bare React Native):**
```bash
npx react-native run-android    # Local build (5+ minutes)
npx react-native run-ios        # Requires Xcode setup
```

**After (Expo + EAS):**
```bash
eas build --profile development  # Cloud build (10-15 minutes, one-time)
npx expo start --dev-client     # Instant development server
```

### Configuration Migration

**react-native-config → expo-constants:**
```javascript
// Before
import Config from 'react-native-config';
const apiKey = Config.GOOGLE_MAPS_API_KEY;

// After  
import Constants from 'expo-constants';
const apiKey = Constants.expoConfig.extra.googleMapsApiKey;
```

**react-native-fs → expo-file-system:**
```javascript
// Before
import RNFS from 'react-native-fs';
const path = RNFS.DocumentDirectoryPath;

// After
import * as FileSystem from 'expo-file-system';
const path = FileSystem.documentDirectory;
```

**react-native-bootsplash → expo-splash-screen:**
```javascript
// Before
import RNBootSplash from 'react-native-bootsplash';
RNBootSplash.hide();

// After
import * as SplashScreen from 'expo-splash-screen';
SplashScreen.hideAsync();
```

## Bridge to EAS Build

**What is EAS Build?**
EAS (Expo Application Services) Build is Expo's cloud service that compiles your app into APK/IPA files that can be installed on phones. Instead of needing Xcode or Android Studio on your computer, EAS Build does the heavy compilation work in the cloud and gives you a download link to the finished app.

### When You Need EAS

**Local Development (expo start):**
- ✅ JavaScript/TypeScript changes
- ✅ UI component updates
- ✅ Redux state changes
- ✅ Navigation modifications
- ❌ Native module changes
- ❌ New dependencies with native code
- ❌ app.config.js changes affecting native code

**EAS Build Required:**
- ✅ Adding new native modules
- ✅ Updating app.config.js native settings
- ✅ Changing permissions
- ✅ Environment variable updates
- ✅ Production releases
- ✅ Testing on fresh devices

### EAS Integration

**Development workflow:**
```bash
# 1. Make JavaScript changes - test with expo start
npx expo start --dev-client

# 2. Need native changes? Build with EAS
eas build --profile development --platform android

# 3. Install new build, continue development
npx expo start --dev-client
```

**Production workflow:**
```bash
# Test locally first
npx expo start --dev-client

# Build for production
eas build --profile production --platform android

# Submit to app store  
eas submit --platform android
```

## Best Practices

### Development Workflow

1. **Start with Expo Go** for UI/layout work
2. **Use Development Client** for full feature testing
3. **Test on real devices** regularly (BLE requires hardware)
4. **Keep builds current** (rebuild development client weekly)

### Configuration Management

1. **Use app.config.js** for all app configuration
2. **Environment variables** for secrets and API keys
3. **Platform-specific code** only when necessary
4. **Test both platforms** if using platform-specific features

### Performance Optimization

1. **Minimize bundle size** by removing unused imports
2. **Use development builds** for accurate performance testing
3. **Monitor build times** and optimize dependencies
4. **Profile JavaScript performance** with development tools

## Common Gotchas

### Environment Variables

❌ **Wrong:**
```javascript
// Direct process.env access in app code
const apiKey = process.env.GOOGLE_MAPS_API_KEY; // undefined in production
```

✅ **Correct:**
```javascript
// Via app.config.js and Constants
import Constants from 'expo-constants';
const apiKey = Constants.expoConfig.extra.googleMapsApiKey;
```

### Platform Differences

❌ **Wrong:**
```javascript
// Assuming all features work on all platforms
import * as Notifications from 'expo-notifications';
// iOS and Android have different notification behaviors
```

✅ **Correct:**
```javascript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

if (Platform.OS === 'ios') {
  // iOS-specific notification setup
} else {
  // Android-specific notification setup
}
```

### Development vs Production

❌ **Wrong:**
```javascript
// Hard-coding development URLs
const API_BASE = 'http://localhost:3000';
```

✅ **Correct:**
```javascript
// Environment-based configuration
import Constants from 'expo-constants';
const API_BASE = Constants.expoConfig.extra.apiBaseUrl;
```

## Next Steps

Now that you understand Expo fundamentals, you're ready to dive deeper:

### 📚 Continue Learning:
- **[EAS Concepts and Keystores](./EAS-Concepts-and-Keystores.md)** - Deep dive into EAS Build system
- **[EAS Development Guide](./EAS-Development-Guide.md)** - Daily workflow commands and build management
- **[Developer Onboarding Guide](./Developer-Onboarding-Guide.md)** - Complete setup instructions

### 🛠️ Practical Next Steps:
1. **Try Expo Go** with simple UI changes
2. **Build a development client** for full functionality testing  
3. **Set up environment variables** for your development environment
4. **Test BLE functionality** with Wildlife Watcher devices
5. **Explore EAS Build** for cloud-based compilation

### 🎯 Wildlife Watcher Specific:
- All BLE functionality requires **Development Client** (not Expo Go)
- Maps require API keys set via **EAS environment variables**
- DFU (firmware updates) needs **real Wildlife Watcher hardware** for testing
- Redux state management works the same as in bare React Native

---

*This guide covers the essential Expo concepts you need to understand before diving into EAS Build workflows. Master these fundamentals and you'll have a solid foundation for Wildlife Watcher development.*