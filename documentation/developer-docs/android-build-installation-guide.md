# Android Build & Installation Guide for Wildlife Watcher Mobile App

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites Check](#prerequisites-check)
3. [CLI Tools Documentation](#cli-tools-documentation)
4. [Build Types & Profiles](#build-types--profiles)
5. [Build Methods](#build-methods)
6. [Installation Process](#installation-process)
7. [Troubleshooting](#troubleshooting)
8. [Quick Reference](#quick-reference)
9. [Sources & References](#sources--references)

---

## Overview

This guide provides comprehensive instructions for building and installing the Wildlife Watcher mobile app on Android devices. It covers both local and cloud build options using Expo and EAS (Expo Application Services) CLI tools.

### Key Concepts
- **Local Build**: Build APK directly on your development machine
- **Cloud Build**: Build APK on Expo's servers and download
- **Development Build**: Debug-enabled build for testing
- **Preview Build**: Internal distribution build for testing
- **Production Build**: Store-ready optimized build

---

## Prerequisites Check

### 1. Checking Installed CLI Tools

The following commands were used to verify CLI tool availability:

```bash
# Check if Expo CLI is installed
which expo
# Result: /home/adarsh/.nvm/versions/node/v20.19.4/bin/expo

# Check Expo CLI version
expo --version
# Result: 6.3.10

# Check if EAS CLI is installed
which eas
# Result: /home/adarsh/.nvm/versions/node/v20.19.4/bin/eas

# Check EAS CLI version
eas --version
# Result: eas-cli/16.17.4 wsl-x64 node-v20.19.4

# Check Expo via npx
npx expo --version
# Result: 0.18.31
```

### 2. Current Environment Status
- **Expo CLI**: v6.3.10 ✅ Installed
- **EAS CLI**: v16.17.4 ✅ Installed
- **Node.js**: v20.19.4 ✅ Compatible
- **Platform**: Windows 11 WSL2 with Ubuntu

### 3. Installing Missing Tools

If tools are not installed:

```bash
# Install Expo CLI globally
npm install -g expo-cli

# Install EAS CLI globally
npm install -g eas-cli

# Or using yarn
yarn global add expo-cli
yarn global add eas-cli
```

---

## CLI Tools Documentation

### Expo CLI
**Purpose**: Local development, running Metro bundler, and development builds
- **Version**: 6.3.10
- **Primary Use**: Development server and local testing
- **Key Commands**:
  - `expo start` - Start development server
  - `expo run:android` - Build and run on Android (requires Android SDK)
  - `expo prebuild` - Generate native Android/iOS folders

### EAS CLI
**Purpose**: Cloud builds, app submission, and credentials management
- **Version**: 16.17.4
- **Primary Use**: Production builds and app store deployment
- **Key Commands**:
  - `eas build` - Create production builds
  - `eas build --local` - Create local builds
  - `eas submit` - Submit to app stores
  - `eas credentials` - Manage signing credentials

### Key Differences
| Feature | Expo CLI | EAS CLI |
|---------|----------|---------|
| Build Location | Local only (with SDK) | Cloud or Local |
| Build Types | Development | Development, Preview, Production |
| Requirements | Android SDK/Studio | Minimal (for cloud builds) |
| Speed | Fast (local) | Varies (cloud queue) |
| Cost | Free | Free tier + paid options |

---

## Build Types & Profiles

### EAS Configuration (`eas.json`)
The project includes three build profiles:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "NODE_ENV": "development" }
    },
    "preview": {
      "distribution": "internal",
      "env": { "NODE_ENV": "development" }
    },
    "production": {
      "env": { "NODE_ENV": "production" }
    }
  }
}
```

### Profile Differences

| Profile | Purpose | Debug Mode | Distribution | Use Case |
|---------|---------|------------|--------------|----------|
| **development** | Active development | ✅ Yes | Internal | Debugging, hot reload |
| **preview** | Testing/QA | ❌ No | Internal | Beta testing, demos |
| **production** | Store release | ❌ No | Store | Final release |

### When to Use Each Profile

- **Development**:
  - During active development
  - When you need debugging tools
  - For hot module replacement
  - Testing new features

- **Preview**:
  - Sharing with testers
  - Client demonstrations
  - Pre-production validation
  - Performance testing

- **Production**:
  - App store submission
  - Final release builds
  - Optimized performance

---

## Build Methods

### Method 1: Local Build (Recommended for Testing)

**Advantages**:
- No wait time
- No internet required after initial setup
- Direct APK output
- Free unlimited builds

**Command**:
```bash
# Basic local build
eas build --platform android --local

# With specific profile
eas build --platform android --local --profile preview

# With custom output directory
eas build --platform android --local --output ./build/app.apk

eas build --platform android --local --profile preview --output ./build/android/wildlife-watcher-preview.apk
```

**Environment Variables for Local Builds**:

⚠️ **CRITICAL**: Environment variables must be defined in `eas.json` for local builds, NOT just in `.env.local`.

Local EAS builds read environment variables from `eas.json` at build time and bake them into the app bundle. Variables in `.env.local` are only used during development with `expo start`.

**Required variables in `eas.json`**:
```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key",
        "GOOGLE_MAPS_API_KEY_ANDROID": "your-maps-key"
      }
    }
  }
}
```

**Why this is necessary**:
- `app.config.js` reads `process.env` during build time
- Environment variables become part of the compiled app bundle
- The app accesses them via `Constants.expoConfig.extra` at runtime
- Rebuilding is required after changing environment variables in `eas.json`

**Process**:
1. Reads environment variables from `eas.json`
2. Checks dependencies locally
3. Bundles JavaScript code with baked-in config
4. Generates native code
5. Creates APK file
6. Outputs to project directory

### Method 2: Cloud Build

**Advantages**:
- No local setup required
- Consistent build environment
- Automatic credential handling
- Build history tracking

**Command**:
```bash
# Basic cloud build
eas build --platform android --profile preview

# With auto-download
eas build --platform android --profile preview --wait
```

**Process**:
1. Uploads project to EAS
2. Queues build on Expo servers
3. Builds in cloud environment
4. Provides download link
5. Optional auto-download

### Method 3: Development Server Build

**Requirements**: Android Studio/SDK installed

**Command**:
```bash
# Requires Android SDK
npx expo run:android
```

**Process**:
1. Generates native Android project
2. Compiles using local Android SDK
3. Installs directly to connected device/emulator

---

## Installation Process

### Step 1: Prepare Your Android Device

1. **Enable Developer Options**:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
   - Developer Options now appears in Settings

2. **Enable Installation from Unknown Sources**:
   - Settings → Security (or Apps & Notifications)
   - Enable "Install unknown apps"
   - Select your file manager app
   - Toggle "Allow from this source"

3. **Enable USB Debugging** (for direct installation):
   - Settings → Developer Options
   - Enable "USB Debugging"
   - Connect phone via USB

### Step 2: Build the APK

Choose your preferred method:

```bash
# Option A: Local build (fastest)
eas build --platform android --local --profile preview --output ./build/wildlife-watcher.apk

# Option B: Cloud build
eas build --platform android --profile preview

# Option C: Development build with debugging
eas build --platform android --local --profile development
```

### Step 3: Transfer APK to Phone

**Method A: USB Transfer**
```bash
# If using ADB (Android Debug Bridge)
adb install ./build/wildlife-watcher.apk

# Or copy manually via file manager
# Connect phone → Copy APK to Downloads folder
```

**Method B: Cloud Transfer**
- Email the APK to yourself
- Upload to Google Drive/Dropbox
- Use file sharing services

**Method C: Direct Download (for cloud builds)**
```bash
# List recent builds
eas build:list --platform android --limit 1

# Download specific build
eas build:download --fingerprint <HASH>
```

### Step 4: Install on Device

1. Navigate to the APK file on your phone
2. Tap the APK file
3. Review permissions
4. Tap "Install"
5. Open the app once installed

---

## Troubleshooting

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Missing Supabase configuration" on startup | Add env vars to `eas.json`, rebuild app (see details below) |
| "App not installed" error | Enable "Install unknown apps", check available storage |
| Build fails locally | Install required dependencies: `npm install` |
| EAS build queued too long | Use `--local` flag for immediate build |
| APK too large | Use production profile for optimized size |
| Can't connect phone via USB | Enable USB debugging, check cable/drivers |
| Build crashes on start | Check logs: `eas build:view <BUILD_ID>` |

### Specific Build Errors & Fixes

#### 1. Runtime Error: "Missing Supabase configuration"

**Error Message**:
```
Missing Supabase configuration. Please check your environment variables:
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY
These should be set in .env.local and exposed through app.config.js
```

**Root Cause**:
The app was built without the Supabase environment variables. Even though they're in `.env.local`, local EAS builds don't read from that file.

**Solution**:
Add environment variables to `eas.json` in the build profile you're using:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "env": {
        "NODE_ENV": "development",
        "EXPO_PUBLIC_SUPABASE_URL": "https://nuhwmubvygxyddkycmpa.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key",
        "GOOGLE_MAPS_API_KEY_ANDROID": "your-maps-key"
      }
    }
  }
}
```

**Important**: After updating `eas.json`, you **must rebuild** the app. Environment variables are baked into the app bundle at build time and cannot be changed at runtime.

```bash
# Rebuild with updated environment variables
eas build --platform android --local --profile preview --output ./build/android/wildlife-watcher-preview.apk
```

#### 2. Gradle Build Error: "compileSdkVersion is not specified"

**Error Message**:
```
A problem occurred configuring project ':expo-sqlite'.
> Failed to notify project evaluation listener.
> compileSdkVersion is not specified. Please add it to build.gradle
```

**Solution**:
Add the following to `android/build.gradle` after the `allprojects` block:

```gradle
// Fix for expo-sqlite and other expo modules
subprojects {
    afterEvaluate { project ->
        if (project.hasProperty("android")) {
            android {
                compileSdkVersion rootProject.ext.compileSdkVersion
                buildToolsVersion rootProject.ext.buildToolsVersion
            }
        }
    }
}
```

#### 2. Expo Doctor Warnings

**Warning**: ".expo directory is not ignored by Git"
**Fix**: Add `.expo/` to your `.gitignore` file

**Warning**: "Native configuration properties in app.config.js"
**Fix**: This is expected when using native folders with EAS Build. Can be safely ignored for local builds.

#### 3. EAS CLI Outdated

**Warning**: "eas-cli@X.X.X is now available"
**Fix**: Update EAS CLI to latest version:
```bash
npm install -g eas-cli@latest
```

#### 4. Node Version Mismatch

**Warning**: "Node.js version in your eas.json does not match"
**Fix**: Either:
- Update your local Node.js version to match eas.json
- Or update `.nvmrc` file to match your system Node version

#### 5. Missing Android NDK

**Warning**: "ANDROID_NDK_HOME environment variable was not specified"
**Fix**: This can be ignored for basic builds, or install Android NDK if needed:
```bash
# Install via Android Studio SDK Manager
# Or set environment variable:
export ANDROID_NDK_HOME=/path/to/android-ndk
```

#### 6. Build Exits with Non-Zero Code

**Error**: "exited with non-zero code: 1" after long build process
**Common Causes**:
- Gradle configuration conflicts
- Native module compilation issues
- Memory or disk space problems

**Solutions**:
1. **Clean prebuild approach**:
   ```bash
   npx expo prebuild --platform android --clean
   eas build --platform android --local --profile preview
   ```

2. **Alternative: Use development profile**:
   ```bash
   eas build --platform android --local --profile development
   ```

3. **Try cloud build as fallback**:
   ```bash
   eas build --platform android --profile preview
   ```

### Build Preparation Checklist

Before running a local build, ensure:

✅ **Dependencies installed**: Run `npm install`
✅ **EAS CLI updated**: Run `npm install -g eas-cli@latest`
✅ **Gradle configured**: Check `android/build.gradle` has compileSdkVersion
✅ **Git clean**: Commit or stash changes before build
✅ **Profile selected**: Choose appropriate profile (development/preview/production)

### Debug Commands

```bash
# View build logs
eas build:view <BUILD_ID>

# List all builds
eas build:list --platform android

# Check build status
eas build:list --status in-progress

# Cancel stuck build
eas build:cancel <BUILD_ID>

# Clean build cache
cd android && ./gradlew clean
cd .. && npx expo prebuild --clean

# Verify project setup
npx expo-doctor
```

### Complete Fix Sequence

If encountering build failures, follow this sequence:

1. **Update tools**:
   ```bash
   npm install -g eas-cli@latest
   npm install -g expo-cli@latest
   ```

2. **Fix Gradle configuration**:
   - Edit `android/build.gradle` as shown above
   - Add `.expo/` to `.gitignore`

3. **Clean and rebuild**:
   ```bash
   # Clean previous builds
   cd android && ./gradlew clean && cd ..

   # Clear npm cache if needed
   npm cache clean --force

   # Reinstall dependencies
   rm -rf node_modules
   npm install
   ```

4. **Retry build with preview profile** (most stable):
   ```bash
   eas build --platform android --local --profile preview
   ```

---

## Quick Reference

### Essential Commands Cheatsheet

```bash
# 🚀 Fastest local testing build
eas build --platform android --local --profile preview

# 📱 Development build with debug tools
eas build --platform android --local --profile development

# ☁️ Cloud preview build
eas build --platform android --profile preview

# 📦 Production build
eas build --platform android --profile production

# 📥 Download latest build
eas build:list --platform android --limit 1
eas build:download --fingerprint <HASH>

# 🔧 Install via ADB
adb install ./path/to/app.apk

# 📊 View build details
eas build:view <BUILD_ID>
```

### Build Time Estimates

| Build Type | Method | Typical Duration |
|------------|--------|-----------------|
| Development | Local | 5-10 minutes |
| Preview | Local | 5-10 minutes |
| Production | Local | 10-15 minutes |
| Any | Cloud | 15-45 minutes (queue dependent) |

---

## Sources & References

### Documentation Research Process

1. **Context7 Library Search**:
   - Used `mcp__context7__resolve-library-id` to find EAS CLI documentation
   - Retrieved library ID: `/expo/eas-cli`
   - Fetched 8000 tokens of documentation on local builds and Android installation

2. **Primary Sources**:
   - [EAS CLI GitHub Repository](https://github.com/expo/eas-cli)
   - [Expo Documentation](https://docs.expo.dev)
   - Context7 Library ID: `/expo/eas-cli` (224 code snippets, Trust Score: 10)

3. **Documentation Coverage**:
   - EAS Build commands and flags
   - Local vs cloud build processes
   - Build profiles and configuration
   - Installation and deployment methods

### Additional Resources

- **Expo EAS Documentation**: https://docs.expo.dev/eas/
- **EAS Build Documentation**: https://docs.expo.dev/build/introduction/
- **Android Developer Options**: https://developer.android.com/studio/debug/dev-options
- **EAS Pricing**: https://expo.dev/pricing

### Version Compatibility

| Tool | Current Version | Minimum Required |
|------|-----------------|------------------|
| Node.js | v20.19.4 | v16.0.0 |
| Expo CLI | 6.3.10 | 6.0.0 |
| EAS CLI | 16.17.4 | 5.2.0 |
| React Native | (from package.json) | 0.70.0 |

---

## Summary

This guide covers the complete process of building and installing the Wildlife Watcher mobile app on Android devices.

### ✅ Infrastructure Status (Updated 2025-09-29)
**EAS Build Infrastructure: WORKING** - All dependency and configuration issues resolved.

The build process successfully:
- ✅ Installs dependencies with expo-sqlite ~14.0.6
- ✅ Passes dependency validation with Expo SDK 51 compatibility
- ✅ Completes Gradle build and reaches JavaScript bundling
- ❌ Currently fails during bundling due to **incomplete Task 11** (SQLite Foundation)

### Current Status
**Build infrastructure is functional** - the failure is now at the application code level due to missing offline-first architecture components from Task 11. Complete Task 11 before attempting builds.

### Recommended Approach
1. **Complete Task 11** (SQLite Foundation) - Required before builds will succeed
2. Use `eas build --platform android --local --profile preview` for fast local builds
3. Transfer the APK to your phone via USB or cloud storage
4. Enable installation from unknown sources and install

For production deployments, use the cloud build system with the production profile and follow the app store submission process.

---

*Last Updated: 2025-09-29*
*Document Version: 1.0*
*Author: Generated via Claude Code with Context7 research*