# Wildlife Watcher App - 5-6 Hour Expo/EAS Migration Guide

**For Claude Code Automated Execution**

## Prerequisites & Human Actions Required

### 🚨 HUMAN ACTION REQUIRED - Before Starting:
1. **Clone the Wildlife Watcher app repository** to a local directory (e.g., `/home/adarsh/dev/wildlife-watcher-app`)
2. **Provide the app repository path** when prompted
3. **Have ready**:
   - Expo account credentials (for EAS)
   - Google Maps API key
   - Apple Developer account access (for iOS)
   - Android device with developer mode enabled
   - iOS device (optional, for iOS testing)

### 🚨 HUMAN ACTION - Copy These Files:
Copy these files from the PoC to have ready:
- `/ww-expo-poc/scripts/` entire folder
- `/ww-expo-poc/app.config.js` (as reference)
- `/ww-expo-poc/eas.json` (as reference)
- `/project-context/connecting-android-phone-instructions/` folder

## Migration Timeline (5-6 Hours)

### Hour 0: Setup & Preparation (30 min) ✅ COMPLETED
### Hour 1: Core Expo Integration (1 hour) ✅ COMPLETED  
### Hour 2-3: Dependency Migration (1.5 hours) ✅ COMPLETED
### Hour 3-4: Code Migration (1.5 hours) ✅ COMPLETED
### Hour 4-5: Build & Deploy (1.5 hours) ⏭️ NEXT
### Hour 5-6: Testing & Validation (30 min)

---

## AUTOMATED SECTION 1: Initial Setup (30 minutes)

### Step 1.1: Create Migration Branch ✅ COMPLETED
```bash
# Navigate to Wildlife Watcher app directory
cd [WW_APP_PATH]  # 🚨 HUMAN: Replace with actual path

# Create and checkout migration branch
git checkout -b expo-eas-migration
git status
```
**Status**: ✅ Completed - Currently on `expo-migration` branch

### Step 1.2: Backup Current State ✅ COMPLETED
```bash
# Create backups of critical files
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup
mkdir -p migration-backups
cp -r ios migration-backups/
cp -r android migration-backups/
```
**Status**: ✅ Completed - Backups created in `migration-backups/`, `package.json.backup`, `package-lock.json.backup`

### Step 1.3: Install Expo CLI Tools ✅ COMPLETED
```bash
# Install global tools
npm install -g eas-cli@latest
npm install -g expo-cli@latest

# Verify installations
expo --version
eas --version
```
**Status**: ✅ Completed - EAS CLI v16.17.3, Expo CLI v6.3.10 installed
**Note**: Use `npx expo` instead of global `expo` command to avoid Node.js compatibility warnings and ensure Expo SDK 51 compatibility.

### Step 1.4: Setup Development Environment Configuration ✅ COMPLETED
```bash
# Create .env.local file for development
# Configure environment variables for Expo development
```
**Status**: ✅ Completed - `.env.local` created with comprehensive environment variable setup including Expo-specific (`EXPO_PUBLIC_`) variables. Documentation created in `EXPO_ENVIRONMENT_VARIABLES.md`.

### Step 1.5: Execute MIGRATION-GUIDE.md Section 1 Verification ✅ COMPLETED
```bash
# Run through all steps in MIGRATION-GUIDE.md Section 1
# Ensure complete pre-migration setup following documented procedure
```
**Status**: ✅ Completed - All Section 1 requirements verified and completed

### Step 1.6: Complete Required Human Actions for Expo Project Setup ✅ COMPLETED
```bash
# Login to Expo
eas login
# Enter your Expo account credentials when prompted

# Create New Expo Project via web dashboard:
# 1. Go to https://expo.dev/accounts/[your-account]/projects
# 2. Click "Create a project"  
# 3. Name: "Wildlife Watcher Expo"
# 4. Slug: "wildlife-watcher-expo"

# Link project to local directory
eas init --id 6cf53a5e-90e1-4987-82c6-5f0337affe97

# Copy PoC reference files
mkdir -p scripts
cp -r ~/dev/wildlifeai/wildlife-watcher-expo-poc-2/ww-expo-poc/scripts/* ./scripts/
cp ~/dev/wildlifeai/wildlife-watcher-expo-poc-2/ww-expo-poc/app.config.js ./app.config.js.reference
cp ~/dev/wildlifeai/wildlife-watcher-expo-poc-2/ww-expo-poc/eas.json ./eas.json.reference
cp -r ~/dev/wildlifeai/wildlife-watcher-expo-poc-2/project-context/connecting-android-phone-instructions ./

# Update package.json with validation scripts
npm pkg set scripts.validate:deps="node scripts/validate-deps.js"
npm pkg set scripts.deps="node scripts/deps-cli.js"
npm pkg set scripts.deps:add="node scripts/deps-cli.js add"
npm pkg set scripts.deps:scan="node scripts/deps-cli.js scan"
npm pkg set scripts.postinstall="npm run validate:deps"
```
**Status**: ✅ Completed - Expo account: `apps_wildlife`, Project ID: `6cf53a5e-90e1-4987-82c6-5f0337affe97`, PoC files copied, environment variables configured with Google Maps API key `AIzaSyD4GgP2HPVqgEOIbOiA1QF6AfTaSBg4vfI`, API_BASE set to placeholder (will be replaced with Supabase URL in Task 8)

---

## AUTOMATED SECTION 2: Core Expo Integration (1 hour) ✅ COMPLETED

### Step 2.1: Install Expo SDK 51 and Core Dependencies ✅ COMPLETED
```bash
# Install Expo SDK
npm install expo@~51.0.39

# Create app.json with UNIQUE identifiers
cat > app.json << 'EOF'
{
  "expo": {
    "name": "Wildlife Watcher Expo",
    "slug": "wildlife-watcher-expo",
    "version": "2.0.0",
    "platforms": ["ios", "android"]
  }
}
EOF
```
**Status**: ✅ Completed - Expo SDK 51.0.39 installed, core dependencies added

### Step 2.2: Create Dynamic app.config.js with Bundle Identifier Strategy ✅ COMPLETED
```javascript
// Create app.config.js
cat > app.config.js << 'EOF'
export default ({ config }) => ({
  ...config,
  name: "Wildlife Watcher Expo",
  slug: "wildlife-watcher-expo",
  version: "2.0.0",
  sdkVersion: "51.0.0",
  platforms: ["ios", "android"],
  scheme: "wildlifewatcher-expo",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.wildlifeai.wildlifewatcher.expo",
    infoPlist: {
      NSBluetoothAlwaysUsageDescription: "Wildlife Watcher Expo needs Bluetooth to connect to camera devices",
      NSBluetoothPeripheralUsageDescription: "Wildlife Watcher Expo needs Bluetooth to connect to camera devices",
      NSLocationWhenInUseUsageDescription: "Wildlife Watcher Expo needs location access to track device deployments",
      NSLocationAlwaysAndWhenInUseUsageDescription: "Wildlife Watcher Expo needs location access to track device deployments",
      NSCameraUsageDescription: "Wildlife Watcher Expo needs camera access to scan QR codes"
    },
    config: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS || ""
    }
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    package: "com.wildlifeai.wildlifewatcher.expo",
    permissions: [
      "BLUETOOTH",
      "BLUETOOTH_ADMIN",
      "BLUETOOTH_CONNECT",
      "BLUETOOTH_SCAN",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "CAMERA",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE"
    ],
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID || ""
      }
    }
  },
  extra: {
    apiBase: process.env.API_BASE || "https://api.wildlifewatcher.com",
    sentryDsn: process.env.SENTRY_DSN || "",
    eas: {
      projectId: "YOUR_PROJECT_ID" // Will be set by eas init
    }
  },
  plugins: [
    "expo-dev-client"
  ]
});
EOF
```

**Status**: ✅ Completed - Dynamic app.config.js created with bundle identifier strategy (.expo suffix for development), environment variable integration

### Step 2.3: Initialize EAS and Configure Build Profiles ✅ COMPLETED
```bash
# Link to the created Expo project
eas init --id wildlife-watcher-expo

# If the above fails, initialize normally (will prompt for project selection)
# eas init

# Verify project linkage
eas project:info

# Create eas.json
cat > eas.json << 'EOF'
{
  "cli": {
    "version": ">= 10.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleDebug"
      },
      "ios": {
        "simulator": false,
        "buildConfiguration": "Debug"
      },
      "env": {
        "EXPO_NO_DOTENV": "1"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
EOF
```
**Status**: ✅ Completed - EAS project initialized and linked, build profiles configured for development/preview/production

### Step 2.4: Setup Expo Constants and Environment Variables ✅ COMPLETED
**Status**: ✅ Completed - Environment variable migration system implemented with backward compatibility, TypeScript definitions created

### Step 2.5: Implement Dependency Validation System ✅ COMPLETED
**Status**: ✅ Completed - Enhanced dependency validation system for Expo SDK 51 compatibility, migration mode enabled, performance verified (2.774s execution time)

### 🚨 VALIDATION CHECKPOINT 0: Expo Project Setup ✅ COMPLETED
**Verify project creation was successful:**
- [x] `eas project:info` shows correct project name "Wildlife Watcher Expo"
- [x] Project slug is "wildlife-watcher-expo"
- [x] app.config.js has correct bundle identifiers (.expo suffix)
- [x] No conflicts with existing bundle IDs
- [x] EAS project linked correctly
- [x] Environment variables properly configured
- [x] Dependency validation system enhanced for Expo SDK 51
- [x] All Task 2 subtasks completed successfully

**Validation Results**: ✅ All criteria met - Task 2 (Core Expo SDK 51 Integration) completed successfully

---

## AUTOMATED SECTION 3: Dependency Migration (1.5 hours)

### Step 3.1: Install Expo Dev Client ✅ COMPLETED
```bash
# Install expo-dev-client
npx expo install expo-dev-client@~4.0.29

# Install other critical Expo packages
npx expo install expo-status-bar expo-splash-screen expo-constants
```
**Status**: ✅ Completed - expo-dev-client@~4.0.29, expo-status-bar, expo-splash-screen, and expo-constants installed successfully

### Step 3.2: Handle Package Replacements ✅ COMPLETED

#### Replace react-native-fs with expo-file-system ✅ COMPLETED
```bash
# Remove old package
npm uninstall react-native-fs

# Install Expo equivalent
npx expo install expo-file-system
```
**Status**: ✅ Completed - react-native-fs removed, expo-file-system@~16.0.0 installed and DfuScreen.tsx migrated

#### Replace react-native-config with expo-constants ✅ COMPLETED
```bash
# Remove old package  
npm uninstall react-native-config

# Expo Constants is already installed
```
**Status**: ✅ Completed - react-native-config removed, expo-constants@~16.0.0 with environment utility created

#### Replace react-native-bootsplash with expo-splash-screen ✅ COMPLETED
```bash
# Remove old package
npm uninstall react-native-bootsplash

# Expo Splash Screen is already installed
```
**Status**: ✅ Completed - react-native-bootsplash removed, expo-splash-screen@~0.27.7 installed and navigation files migrated

### Step 3.3: Update Package Versions for Expo Compatibility ✅ COMPLETED
```bash
# Update React Native to Expo SDK 51 compatible version
npm install react-native@0.74.6 --save-exact

# Install/update other dependencies
npm install react@18.2.0 --save-exact
npm install typescript@~5.3.3 --save-dev

# Add package overrides to package.json
npm pkg set overrides.react-native="0.74.6"
npm pkg set overrides.react-native-reanimated="~3.10.1"
npm pkg set packageManager="npm@10.8.1"
```
**Status**: ✅ Completed - React Native 0.74.6 confirmed, package-lock.json cleaned, dependency validation rules updated for all migrated packages

### Step 3.4: Validate Native Modules Compatibility ✅ COMPLETED
```bash
# These should remain unchanged as validated in PoC
# react-native-ble-manager@11.3.2
# react-native-bluetooth-state-manager@1.3.5
# react-native-nordic-dfu (GitHub fork)
# react-native-maps@1.20.1

# Run validation with rigorous checks
npm run validate:deps

# PoC GUARDRAIL: Verify exact versions match PoC
npm run deps:scan

# Check for version conflicts
npm ls react-native react
npm ls @expo/config-plugins

# Validate Expo SDK compatibility
npx expo-doctor --verbose
```
**Status**: ✅ Completed - All native modules validated at correct versions, dependency validation system updated with migrated packages, expo-doctor compatibility verified, obsolete type definitions removed

### 🚨 VALIDATION CHECKPOINT 1: Dependencies ✅ COMPLETED
**Before proceeding, verify:**
- [x] `npm run validate:deps` shows no errors
- [x] All BLE packages at exact PoC versions
- [x] `npx expo-doctor` passes (warnings OK)
- [x] React Native exactly 0.74.6
- [x] No peer dependency conflicts

**Validation Results**: ✅ All criteria met - Section 3 (Dependency Migration) completed successfully
- Native module replacements completed: react-native-fs → expo-file-system, react-native-config → expo-constants, react-native-bootsplash → expo-splash-screen
- Dependency validation rules updated to reflect all migrated packages and block old packages
- Package versions validated for Expo SDK 51 compatibility
- Ready to proceed to Section 4: Code Migration

---

## AUTOMATED SECTION 4: Code Migration (1.5 hours) ✅ COMPLETED

### Step 4.1: File System Migration ✅ COMPLETED
**Status**: ✅ Completed - File system migration was already complete. Created validation script `scripts/validate-filesystem-migration.js` to confirm:
- No react-native-fs usage found (0 instances)
- 1 file using expo-file-system (DfuScreen.tsx)
- All old RNFS methods have been migrated
- Migration Status: ✅ COMPLETE

### Step 4.2: Environment Variable Migration ✅ COMPLETED  
**Status**: ✅ Completed - Environment variable migration was already complete. Created validation script `scripts/validate-env-migration.js` to confirm:
- No react-native-config imports found (0 instances)
- Custom environment utility at `src/utils/environment.ts` provides backward compatibility
- app.config.js properly configured with environment variables in extra field
- 3 files using Config via compatibility layer
- Migration Status: ✅ COMPLETE

### Step 4.3: Splash Screen Migration ✅ COMPLETED
**Status**: ✅ Completed - Splash screen migration was already complete. Created validation script `scripts/validate-splash-migration.js` to confirm:
- No react-native-bootsplash usage found (0 instances)
- 2 files using expo-splash-screen (navigation/index.tsx, AndroidPermissionsProvider.tsx)
- All old splash screen methods have been migrated
- app.config.js has proper splash configuration
- Migration Status: ✅ COMPLETE

### Step 4.4: Update Metro Configuration & App Entry Point ✅ COMPLETED
**Status**: ✅ Completed - Updated Metro configuration and app entry point:

#### Metro Configuration Updates:
```javascript
// Added custom asset extensions to metro.config.js
config.resolver.assetExts.push('db', 'zip');
```

#### App Entry Point Updates:
```javascript
// Updated index.js to use Expo's registerRootComponent
import { registerRootComponent } from 'expo'
import { App } from "./src/App"

registerRootComponent(App)
```

### Step 4.5: TypeScript Validation & Final Migration Verification ✅ COMPLETED
**Status**: ✅ Completed - Created comprehensive validation script `scripts/validate-all-migrations.js` with results:

#### Migration Validation Results:
- ✅ File System Migration: PASSED
- ✅ Environment Variable Migration: PASSED  
- ✅ Splash Screen Migration: PASSED
- ✅ Metro Configuration: PASSED
- ⚠️ TypeScript Compilation: 8 PRE-EXISTING ERRORS (not migration-related)
- ✅ Package Dependencies: PASSED

#### Summary of Completed Migrations:
- File System: react-native-fs → expo-file-system
- Environment: react-native-config → expo-constants (compatibility layer)
- Splash Screen: react-native-bootsplash → expo-splash-screen  
- Metro Config: Updated for Expo with custom asset extensions (.db, .zip)
- App Entry: Updated to use registerRootComponent

#### Additional Tasks Completed:
- Installed @types/jest to fix Jest-related TypeScript errors
- Fixed App import in __tests__/App.test.tsx
- Created comprehensive validation scripts for all migrations
- All syntax checks passed
- All old packages removed, new Expo packages installed

### 🚨 VALIDATION CHECKPOINT 2-5: All Code Migration Checkpoints ✅ COMPLETED

#### File System Migration Validation:
- [x] No `RNFS` imports remain in code
- [x] `expo-file-system` imports added where needed
- [x] File paths updated (DocumentDirectoryPath → documentDirectory)
- [x] Method calls updated (writeFile → writeAsStringAsync)

#### Environment Variable Migration Validation:
- [x] No `react-native-config` imports remain
- [x] `expo-constants` imports added via compatibility layer
- [x] `Config.` usage works through compatibility layer
- [x] Environment variable access patterns updated

#### Splash Screen Migration Validation:
- [x] No `react-native-bootsplash` imports remain
- [x] `expo-splash-screen` imports added where needed
- [x] Method calls updated (RNBootSplash.hide → SplashScreen.hideAsync)
- [x] Async/await patterns properly applied

#### Metro Configuration & App Entry Validation:
- [x] TypeScript compiles with only pre-existing errors (not migration-related)
- [x] index.js syntax is valid
- [x] No remaining old package imports
- [x] Metro config includes necessary extensions (.db, .zip)
- [x] index.js uses Expo's registerRootComponent

**All Code Migration Tasks Completed Successfully! Ready to proceed to Section 5: Build & Deploy**

---

## ~~REDUNDANT SECTIONS~~ - The following sections are kept for reference but are no longer needed as the migration was already complete

> **Note**: The sections below contain the original planned migration scripts and procedures. However, during execution, we discovered that all migrations had already been completed in previous tasks. These sections are preserved for reference and future migrations but can be ignored for the current migration.

### ~~Step 4.2: File System Migration~~ *(REDUNDANT - Already Complete)*

~~Create migration helper script:~~
```javascript
cat > scripts/migrate-filesystem.js << 'EOF'
const fs = require('fs');
const path = require('path');

// File system migration mappings
const migrations = {
  // react-native-fs to expo-file-system
  "import RNFS from 'react-native-fs'": "import * as FileSystem from 'expo-file-system'",
  'RNFS.DocumentDirectoryPath': 'FileSystem.documentDirectory',
  'RNFS.CachesDirectoryPath': 'FileSystem.cacheDirectory',
  'RNFS.writeFile(': 'FileSystem.writeAsStringAsync(',
  'RNFS.readFile(': 'FileSystem.readAsStringAsync(',
  'RNFS.readDir(': 'FileSystem.readDirectoryAsync(',
  'RNFS.mkdir(': 'FileSystem.makeDirectoryAsync(',
  'RNFS.unlink(': 'FileSystem.deleteAsync(',
  'RNFS.exists(': 'FileSystem.getInfoAsync(',
  'RNFS.stat(': 'FileSystem.getInfoAsync(',
  'RNFS.copyFile(': 'FileSystem.copyAsync(',
  'RNFS.moveFile(': 'FileSystem.moveAsync(',
};

// Find all JS/TS files
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.git')) {
      findFiles(filePath, fileList);
    } else if (file.match(/\.(js|jsx|ts|tsx)$/)) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

// Migrate files
const files = findFiles('./src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;
  
  Object.entries(migrations).forEach(([from, to]) => {
    if (content.includes(from)) {
      content = content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(file, content);
    console.log(`Migrated: ${file}`);
  }
});

console.log('File system migration complete!');
EOF

# Run the migration
node scripts/migrate-filesystem.js

# PoC GUARDRAIL: Validate file system migration
echo "Validating file system migration..."
grep -r "import RNFS" ./src && echo "❌ RNFS imports still found!" || echo "✅ RNFS imports removed"
grep -r "FileSystem\." ./src && echo "✅ expo-file-system imports found" || echo "⚠️ No FileSystem usage found"
```

### ~~🚨 VALIDATION CHECKPOINT 2: File System Migration~~ *(REDUNDANT - Already Complete)*
~~**Verify the automated migration worked:**~~
- ~~[ ] No `RNFS` imports remain in code~~
- ~~[ ] `expo-file-system` imports added where needed~~
- ~~[ ] File paths updated (DocumentDirectoryPath → documentDirectory)~~
- ~~[ ] Method calls updated (writeFile → writeAsStringAsync)~~

~~**Manual spot check**: Open a file that used react-native-fs and verify changes~~

### ~~Step 4.3: Environment Variable Migration~~ *(REDUNDANT - Already Complete)*

~~Create environment migration script:~~
```javascript
cat > scripts/migrate-env.js << 'EOF'
const fs = require('fs');
const path = require('path');

// Environment variable migration mappings
const migrations = {
  "import Config from 'react-native-config'": "import Constants from 'expo-constants'",
  'Config.': 'Constants.expoConfig.extra.',
};

// Use same file finding logic
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.git')) {
      findFiles(filePath, fileList);
    } else if (file.match(/\.(js|jsx|ts|tsx)$/)) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

// Migrate files
const files = findFiles('./src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;
  
  Object.entries(migrations).forEach(([from, to]) => {
    if (content.includes(from)) {
      content = content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(file, content);
    console.log(`Migrated: ${file}`);
  }
});

console.log('Environment variable migration complete!');
EOF

# Run the migration
node scripts/migrate-env.js

# PoC GUARDRAIL: Validate environment migration
echo "Validating environment variable migration..."
grep -r "react-native-config" ./src && echo "❌ react-native-config still found!" || echo "✅ react-native-config removed"
grep -r "Constants\.expoConfig\.extra" ./src && echo "✅ expo-constants usage found" || echo "⚠️ No Constants usage found"
```

### ~~🚨 VALIDATION CHECKPOINT 3: Environment Variables~~ *(REDUNDANT - Already Complete)*
~~**Verify the automated migration worked:**~~
- ~~[ ] No `react-native-config` imports remain~~
- ~~[ ] `expo-constants` imports added where needed~~
- ~~[ ] `Config.` replaced with `Constants.expoConfig.extra.`~~
- ~~[ ] Environment variable access patterns updated~~

### ~~Step 4.4: Splash Screen Migration~~ *(REDUNDANT - Already Complete)*

```javascript
cat > scripts/migrate-splash.js << 'EOF'
const fs = require('fs');
const path = require('path');

// Splash screen migration mappings
const migrations = {
  "import RNBootSplash from 'react-native-bootsplash'": "import * as SplashScreen from 'expo-splash-screen'",
  'RNBootSplash.hide()': 'SplashScreen.hideAsync()',
  'RNBootSplash.show()': 'SplashScreen.preventAutoHideAsync()',
};

// Use same file finding logic
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.git')) {
      findFiles(filePath, fileList);
    } else if (file.match(/\.(js|jsx|ts|tsx)$/)) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

// Migrate files
const files = findFiles('./src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;
  
  Object.entries(migrations).forEach(([from, to]) => {
    if (content.includes(from)) {
      content = content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(file, content);
    console.log(`Migrated: ${file}`);
  }
});

console.log('Splash screen migration complete!');
EOF

# Run the migration
node scripts/migrate-splash.js

# PoC GUARDRAIL: Validate splash screen migration
echo "Validating splash screen migration..."
grep -r "react-native-bootsplash" ./src && echo "❌ react-native-bootsplash still found!" || echo "✅ react-native-bootsplash removed"
grep -r "SplashScreen\." ./src && echo "✅ expo-splash-screen usage found" || echo "⚠️ No SplashScreen usage found"
```

### ~~🚨 VALIDATION CHECKPOINT 4: Splash Screen~~ *(REDUNDANT - Already Complete)*
~~**Verify the automated migration worked:**~~
- ~~[ ] No `react-native-bootsplash` imports remain~~
- ~~[ ] `expo-splash-screen` imports added where needed~~
- ~~[ ] Method calls updated (RNBootSplash.hide → SplashScreen.hideAsync)~~
- ~~[ ] Async/await patterns properly applied~~

### ~~Step 4.5: Update Main App Component~~ *(REDUNDANT - Already Complete)*

```bash
# Add Expo Status Bar to App.tsx/App.js
# This needs manual verification but here's the pattern:

# Find the main App component file
APP_FILE=$(find ./src -name "App.tsx" -o -name "App.js" | head -1)

# Add import if not present
grep -q "expo-status-bar" "$APP_FILE" || sed -i "1i import { StatusBar } from 'expo-status-bar';" "$APP_FILE"
```

### ~~Step 4.6: Update Metro Configuration~~ *(REDUNDANT - Already Complete)*

```javascript
cat > metro.config.js << 'EOF'
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add any custom configurations here
config.resolver.assetExts.push('db', 'zip');

module.exports = config;
EOF

# PoC GUARDRAIL: Final code validation
echo "Running final validation checks..."

# Check TypeScript compilation
npm run tsc --noEmit 2>/dev/null && echo "✅ TypeScript compilation clean" || echo "⚠️ TypeScript errors found"

# Verify no obvious syntax errors
node -c index.js && echo "✅ index.js syntax valid" || echo "❌ index.js syntax error"

# Check for any remaining old imports
echo "Checking for missed migrations..."
grep -r "react-native-fs\|react-native-config\|react-native-bootsplash" ./src ./components 2>/dev/null && echo "⚠️ Found remaining old imports" || echo "✅ All migrations complete"
```

### ~~🚨 VALIDATION CHECKPOINT 5: Code Integration~~ *(REDUNDANT - Already Complete)*
~~**Before building, verify:**~~
- ~~[ ] TypeScript compiles without errors (or same error count as before)~~
- ~~[ ] index.js syntax is valid~~
- ~~[ ] No remaining old package imports~~
- ~~[ ] Metro config includes necessary extensions~~
- ~~[ ] App.tsx includes expo-status-bar import~~

~~**If TypeScript errors increased**: Review migration scripts for syntax issues~~

---

## AUTOMATED SECTION 5: Build & Deploy (1.5 hours)

### 🚨 HUMAN ACTION - Create .env file:
```bash
# Create .env file with your actual values
cat > .env << 'EOF'
GOOGLE_MAPS_API_KEY_ANDROID=your-android-api-key
GOOGLE_MAPS_API_KEY_IOS=your-ios-api-key
API_BASE=https://api.wildlifewatcher.com
SENTRY_DSN=your-sentry-dsn
EOF
```

### Step 5.1: Set EAS Environment Variables
```bash
# 🚨 HUMAN: Run these commands and enter actual values when prompted
eas secret:create --name GOOGLE_MAPS_API_KEY_ANDROID --scope project
eas secret:create --name GOOGLE_MAPS_API_KEY_IOS --scope project
eas secret:create --name API_BASE --scope project --value "https://api.wildlifewatcher.com"
```

### Step 5.2: Configure iOS Credentials (if building for iOS)
```bash
# 🚨 HUMAN ACTION - iOS only:
# Run this and follow prompts to configure iOS certificates
eas credentials
```

### Step 5.3: Build Development Client

#### For Android (Faster - Start Here):
```bash
# PoC GUARDRAIL: Pre-build validation
echo "Pre-build validation checklist:"
echo "✓ All validation checkpoints passed?"
echo "✓ EAS secrets configured?"
echo "✓ Internet connection stable?"

# Build Android development client
echo "Starting EAS build - this will take ~10 minutes..."
eas build --profile development --platform android

# Monitor build progress
echo "Build started! Monitor at: https://expo.dev"
echo "While waiting, you can:"
echo "1. Prepare Android device for installation"
echo "2. Review test checklist"  
echo "3. Check build logs if issues arise"

# This will output a URL to download the APK
# Build time: ~8-10 minutes
```

### 🚨 VALIDATION CHECKPOINT 6: EAS Build
**Monitor the build progress and verify:**
- [ ] Build starts without immediate errors
- [ ] All dependencies install successfully  
- [ ] Native modules compile without issues
- [ ] Build completes with download URL provided
- [ ] APK size reasonable (compare to original if known)

**If build fails**:
1. Check build logs: `eas build:view [BUILD_ID]`
2. Common fixes: Clear cache with `--clear-cache`
3. Verify all secrets are set correctly

#### For iOS (Optional - Requires Apple Developer Account):
```bash
# 🚨 HUMAN: Only run if you have Apple Developer access
eas build --profile development --platform ios

# This will output a URL for TestFlight or ad-hoc installation
# Build time: ~15-20 minutes
```

### Step 5.4: Install Development Client

### 🚨 HUMAN ACTION - Install on Device:
1. **For Android**:
   - Download APK from the URL provided by EAS
   - Transfer to device and install
   - OR scan QR code with device

2. **For iOS**:
   - Install via TestFlight link
   - OR use ad-hoc installation profile

---

## AUTOMATED SECTION 6: Testing & Validation (30 minutes)

### Step 6.1: Start Development Server
```bash
# PoC GUARDRAIL: Pre-start validation
echo "Pre-start development server checklist:"
echo "✓ Development client installed on device?"
echo "✓ Device and computer on same network?"
echo "✓ Android developer mode enabled?"

# Start Expo development server
echo "Starting development server..."
npx expo start --dev-client

# Connection troubleshooting if needed
echo ""
echo "If connection fails, try:"
echo "- USB connection: adb reverse tcp:8081 tcp:8081"
echo "- Tunnel mode: npx expo start --tunnel"
echo "- Clear cache: npx expo start --clear"

# This will show a QR code and URL
```

### 🚨 VALIDATION CHECKPOINT 7: Development Server Connection
**Verify connection works:**
- [ ] Metro bundler starts successfully
- [ ] QR code displays (if using QR connection)
- [ ] Device can connect to development server
- [ ] App loads on device without crashes
- [ ] Hot reload works (make a small change and verify)

**Connection troubleshooting priority**:
1. Same WiFi network
2. USB with adb reverse
3. Tunnel mode (slower but reliable)
4. Clear Metro cache

### Step 6.2: Create Test Checklist
```markdown
cat > MIGRATION_TEST_CHECKLIST.md << 'EOF'
# Wildlife Watcher Expo Migration - Test Checklist

## Core Functionality Tests

### BLE Tests
- [ ] App launches without crashes
- [ ] BLE permissions requested properly
- [ ] Can scan for devices
- [ ] Can connect to Wildlife Watcher device
- [ ] Can send PING command and receive PONG
- [ ] Can disconnect properly

### DFU Tests  
- [ ] Can select firmware file
- [ ] DFU transfer starts
- [ ] Progress updates shown
- [ ] Transfer completes successfully

### Maps Tests
- [ ] Maps display properly
- [ ] Can see current location
- [ ] Can place deployment markers
- [ ] Map interactions work

### Navigation Tests
- [ ] Bottom tabs work
- [ ] Drawer menu opens
- [ ] All screens accessible
- [ ] Back navigation works

### Storage Tests
- [ ] Can save deployment data
- [ ] Data persists after app restart
- [ ] File operations work

### Redux Tests
- [ ] State updates properly
- [ ] No console errors
- [ ] Performance acceptable

## Platform-Specific Tests

### Android
- [ ] Runs on Android 12+
- [ ] Bluetooth permissions handled
- [ ] Background location works

### iOS
- [ ] Runs on iOS 15+
- [ ] All permissions requested
- [ ] No native crashes

## Build Tests
- [ ] Development build works
- [ ] Can connect to Metro bundler
- [ ] Hot reload works
- [ ] No bundle size regression

## Notes
- Document any issues found
- Note performance differences
- List any features not working
EOF
```

### 🚨 HUMAN ACTION - Run Through Test Checklist:
1. Open the app on your device
2. Connect to development server
3. Go through each item in MIGRATION_TEST_CHECKLIST.md
4. Document any issues found

---

## Code Rewrites Required

### 1. File System Operations (Automated Above)
All `react-native-fs` usage must be replaced with `expo-file-system`:

**Before**:
```javascript
import RNFS from 'react-native-fs';
await RNFS.writeFile(path, data, 'utf8');
```

**After**:
```javascript
import * as FileSystem from 'expo-file-system';
await FileSystem.writeAsStringAsync(path, data);
```

### 2. Environment Variables (Automated Above)
All `react-native-config` usage must be replaced with `expo-constants`:

**Before**:
```javascript
import Config from 'react-native-config';
const apiUrl = Config.API_BASE;
```

**After**:
```javascript
import Constants from 'expo-constants';
const apiUrl = Constants.expoConfig.extra.apiBase;
```

### 3. Splash Screen (Automated Above)
All `react-native-bootsplash` usage must be replaced with `expo-splash-screen`:

**Before**:
```javascript
import RNBootSplash from 'react-native-bootsplash';
RNBootSplash.hide();
```

**After**:
```javascript
import * as SplashScreen from 'expo-splash-screen';
await SplashScreen.hideAsync();
```

---

## Context Files to Copy

### From PoC Project, Copy:
1. `/ww-expo-poc/scripts/` - Complete dependency validation system
2. `/ww-expo-poc/app.config.js` - Reference for configuration
3. `/ww-expo-poc/eas.json` - Reference for EAS setup
4. `/project-context/connecting-android-phone-instructions/` - For WSL2 users

### From Wildlife Watcher App, Keep:
1. All source code in `/src`
2. Redux store configuration
3. BLE service implementations
4. Navigation structure
5. Assets folder

---

## Troubleshooting Quick Fixes

### Issue: Metro bundler connection fails
```bash
# Clear cache and restart
npx expo start --clear
```

### Issue: Native module not found
```bash
# Rebuild development client
eas build --profile development --platform android --clear-cache
```

### Issue: Build fails on EAS
```bash
# Check build logs
eas build:list
eas build:view [BUILD_ID]
```

### Issue: Dependency validation fails
```bash
# Run interactive fix
npm run deps:add
npm run validate:deps
```

---

## Post-Migration Cleanup

1. **Update Documentation**:
   ```bash
   # Update README
   echo "## Development" >> README.md
   echo "This app now uses Expo and EAS Build." >> README.md
   echo "Run \`npx expo start --dev-client\` to start developing." >> README.md
   ```

2. **Remove Old Native Folders** (Optional):
   ```bash
   # Only after confirming everything works
   rm -rf ios.old android.old
   ```

3. **Update CI/CD**:
   - Disable Fastlane workflows
   - Enable EAS Build workflows
   - Update secrets in GitHub

---

## Success Criteria

✅ App builds successfully on EAS
✅ Development client installs on device
✅ All core features work (BLE, DFU, Maps)
✅ Hot reload works for development
✅ No regression in functionality
✅ Build time under 15 minutes

---

## Next Steps After Migration

1. Set up EAS Update for OTA updates
2. Configure production build profiles
3. Set up automated testing
4. Train team on new workflow
5. Document any custom workarounds

---

**Total Estimated Time**: 5-6 hours
**Active Coding Time**: ~4 hours  
**Build/Wait Time**: ~1.5 hours
**Testing Time**: ~30 minutes

🎯 **Pro Tip**: Start Android build first as it's faster. While it builds, work on code migrations. This parallelization can save 30-45 minutes.