# Wildlife Watcher Mobile App - Pre-Migration Analysis

**Date**: 2025-07-27  
**Purpose**: Detailed analysis of Wildlife Watcher app for Expo/EAS migration  
**App Location**: `/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/`

## 📱 App Identity & Configuration

### Current Bundle Identifiers
- **Android Package**: `com.wildlife.wildlifewatcher`
- **iOS Bundle ID**: `com.wildlife.wildlifewatcher`
- **Display Name**: "WildlifeWatcher"
- **Version**: "0.0.1"

### Migration Recommendation
For safe migration testing, use different identifiers:
- **New Android Package**: `com.wildlife.wildlifewatcher.expo`
- **New iOS Bundle ID**: `com.wildlife.wildlifewatcher.expo`
- **This allows**: Side-by-side installation for testing

## 📦 Dependencies Analysis

### Core Dependencies (Already in PoC)
✅ **Validated in PoC**:
- `react-native`: 0.74.6 (exact match!)
- `react-native-ble-manager`: ^11.3.2 
- `react-native-bluetooth-state-manager`: ^1.3.5
- `react-native-nordic-dfu`: GitHub fork (same)
- `react-native-maps`: ^1.20.1
- `@reduxjs/toolkit`: ^2.2.1
- `react-redux`: ^9.1.0
- `react-native-paper`: ^5.12.3

### Dependencies Requiring Migration
🔄 **Need Replacement**:
1. `react-native-fs`: ^2.20.0 → `expo-file-system`
2. `react-native-config`: ^1.5.3 → `expo-constants`
3. `react-native-bootsplash`: ^5.4.1 → `expo-splash-screen`

### New Dependencies Not in PoC
⚠️ **Additional Libraries**:
1. **Firebase**: 
   - `@react-native-firebase/app`: ^18.7.3
   - `@react-native-firebase/app-distribution`: ^18.7.3
   - **Migration**: Works with Expo dev client

2. **Navigation** (More complex than PoC):
   - `@react-navigation/native`: ^6.1.12
   - `@react-navigation/native-stack`: ^6.9.20
   - `react-native-drawer-layout`: ^3.3.0
   - **Note**: Drawer navigation not tested in PoC

3. **Additional Native Modules**:
   - `react-native-device-info`: ^10.13.1 → Can use `expo-device`
   - `react-native-document-picker`: ^9.3.1 → Use `expo-document-picker`
   - `@react-native-community/geolocation`: ^3.4.0 → Use `expo-location`
   - `react-native-app-auth`: ^8.0.0 → May need custom config plugin

4. **UI Libraries**:
   - `react-native-toast-message`: ^2.2.0
   - `react-native-paper-dropdown`: ^2.3.1
   - `react-native-vector-icons`: ^10.0.3

### TypeScript Configuration
- **Current**: TypeScript 5.0.4
- **Expo SDK 51 expects**: ~5.3.3
- **Action**: Will need to update

## 🏗️ Architecture Analysis

### Provider Hierarchy (Complex!)
```tsx
<SafeAreaProvider>
  <ReduxProvider>
    <PaperProvider>
      <NavigationContainer>
        <AndroidPermissionsProvider>
          <AppSetupProvider>
            <BleEngineProvider>
              <ListenToBleEngineProvider>
                <AuthProvider>
                  <MainNavigation />
```

**Note**: 9 levels of providers - more complex than PoC tested

### Navigation Structure
- **Bottom Tabs**: Not fully visible in navigation/index.tsx
- **Drawer Navigation**: Uses react-native-drawer-layout
- **Stack Navigation**: Multiple stacks
- **Screens**: 18+ screens identified

### Redux Store Structure
**Slices** (9 total):
- androidPermissionsSlice
- authSlice
- bleLibrarySlice
- bluetoothStatusSlice
- configurationSlice
- devicesSlice
- locationStatusSlice
- logsSlice
- scanningSlice

**RTK Query APIs**:
- auth, deployments, devices, media, observations, projects, sensorRecords, users

## 🚨 Migration Challenges Identified

### 1. Firebase Integration
- Uses native Firebase modules
- Requires Firebase config files (`google-services.json`, `GoogleService-Info.plist`)
- **Solution**: Copy config files, Firebase works with expo-dev-client

### 2. Custom Native Code
**Android**:
- `IgnoreSSLFactory.java` - Custom SSL handling
- `MainActivity.kt` - Kotlin customizations
- **Solution**: May need config plugin or prebuild modifications

**iOS**:
- Custom URL schemes: `com.wildlife.auth`
- **Solution**: Configure in app.config.js

### 3. Assets & Icons
- Custom app icons in multiple resolutions
- Boot splash images with specific naming
- **Solution**: Reorganize to match Expo structure

### 4. Environment Variables
- Uses `.env` file with react-native-config
- Fastlane expects various ENV vars
- **Solution**: Migrate to expo-constants extra fields

### 5. Build Configuration
**Fastlane**:
- Complex iOS provisioning
- Certificate management
- Version management
- **Solution**: EAS handles most of this automatically

## 📂 File Structure Observations

### Assets Organization
```
Current:
- android/app/src/main/res/ (Android icons)
- ios/WildlifeWatcher/Images.xcassets/ (iOS icons)
- assets/ (bootsplash images)
- src/assets/ (app assets)

Expo expects:
- assets/icon.png
- assets/splash.png
- assets/adaptive-icon.png
```

### Configuration Files
- No `app.config.js` (will create)
- No `eas.json` (will create)
- Has `metro.config.js` (minimal, can enhance)
- Has `babel.config.js` (needs update for Expo)

## 🔧 Build System Analysis

### Current Fastlane Setup
- **iOS**: Certificate import, provisioning profiles, version management
- **Android**: Appears to use standard gradle build
- **Deployment**: Firebase App Distribution

### GitHub Actions
- No `.github` folder found
- CI/CD might be in separate repo or using different service

## ✅ Migration Readiness Assessment

### Green Flags (Easy)
- ✅ React Native 0.74.6 (perfect match!)
- ✅ All critical BLE modules already validated
- ✅ Redux architecture proven in PoC
- ✅ TypeScript throughout
- ✅ Clean separation of concerns

### Yellow Flags (Moderate Effort)
- ⚠️ Firebase integration (works but needs setup)
- ⚠️ Navigation complexity (drawer not tested)
- ⚠️ 9 provider levels (performance concern)
- ⚠️ Additional native modules to replace

### Red Flags (High Effort)
- 🔴 Custom native Android SSL code
- 🔴 OAuth integration (react-native-app-auth)
- 🔴 Complex Fastlane setup to migrate

## 📋 Pre-Migration Checklist

Before starting migration:

1. **Backup Strategy**
   - Current icons/splash screens location identified
   - Environment variables documented
   - Native customizations noted

2. **Dependencies Prepared**
   - File system replacement patterns ready
   - Config replacement patterns ready
   - Splash screen replacement patterns ready

3. **New Dependencies Strategy**
   - Firebase: Keep as-is with expo-dev-client
   - Device Info: Replace with expo-device
   - Document Picker: Replace with expo-document-picker
   - Geolocation: Replace with expo-location

4. **Configuration Files Needed**
   - Create app.config.js with proper structure
   - Create eas.json with build profiles
   - Update babel.config.js for Expo

## 🚀 Recommended Migration Adjustments

### 1. Extended Timeline
- Original: 5-6 hours
- Recommended: 8-10 hours (due to additional complexity)

### 2. Additional Migration Steps
- Firebase configuration migration
- OAuth setup verification
- Asset reorganization phase
- Provider performance testing

### 3. Validation Enhancements
- Test drawer navigation specifically
- Verify Firebase functionality
- Check OAuth flows
- Performance profiling with 9 providers

### 4. Rollback Considerations
- Keep native folders until fully validated
- Document custom native code behavior
- Maintain Fastlane setup in parallel longer

## 🎯 Action Items for Migration Plan

1. **Update MIGRATION-GUIDE.md** to include:
   - Firebase configuration steps
   - Additional dependency replacements
   - Asset reorganization instructions
   - Extended validation checklist

2. **Add new validation checkpoints** for:
   - Firebase functionality
   - OAuth authentication
   - Drawer navigation
   - Provider performance

3. **Create supplementary guides** for:
   - Firebase migration
   - Asset migration
   - Custom native code handling

---

**Conclusion**: The Wildlife Watcher app is more complex than initially assumed but still highly suitable for Expo migration. The core risky components (BLE/DFU) are already validated. The main additional work involves Firebase setup, OAuth configuration, and handling the deeper navigation structure.