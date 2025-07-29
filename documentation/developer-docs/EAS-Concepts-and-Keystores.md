# EAS Concepts and Android Keystores Guide

## Overview

This guide explains Expo Application Services (EAS) concepts and Android keystore management, specifically in the context of migrating from bare React Native to Expo development workflow.

## What is EAS (Expo Application Services)?

EAS is Expo's cloud-based suite of services that handles the complex parts of mobile app development:

### **EAS Services:**

1. **EAS Build** - Cloud-based compilation (replaces local Xcode/Android Studio builds)
2. **EAS Submit** - Automated app store submissions  
3. **EAS Update** - Over-the-air (OTA) JavaScript updates

### **Traditional vs EAS Workflow:**

| Traditional React Native | EAS Approach |
|-------------------------|--------------|
| Local Xcode + Android Studio required | Cloud-based builds |
| Complex environment setup | Single CLI tool |
| Platform-specific build processes | Unified build system |
| Manual certificate management | Automatic credential handling |
| Different deployment pipelines | Single command deployment |

**Example Commands:**
```bash
# Traditional React Native
npx react-native run-android        # Local build + install
npx react-native run-ios           # Requires Xcode

# EAS Approach  
eas build --profile development     # Cloud build
npx expo start --dev-client        # Local development server
```

## Android Keystore Fundamentals

### **What is an Android Keystore?**

An Android keystore is a **digital certificate container** that proves you are the legitimate developer of an app. Think of it as a digital signature that Google Play uses to verify app ownership.

### **Keystore Components:**

- **Keystore file** (.keystore/.jks) - Container holding your certificates
- **Key alias** - Unique name for your specific signing key
- **Keystore password** - Protects access to the keystore file
- **Key password** - Protects access to individual keys within the keystore

### **Why Keystores Matter:**

1. **App Identity** - Google Play uses keystores to verify you own the app
2. **Update Security** - Only the developer with the original keystore can update an app
3. **Fraud Prevention** - Prevents malicious apps from impersonating yours
4. **Legal Protection** - Proves app authorship in legal disputes

⚠️ **Critical Warning:** If you lose your release keystore, you **cannot update your app** on Google Play. You'd need to publish as a completely new app.

## Development vs Release Keystores

### **Debug Keystore (Development):**
- **Purpose:** Local testing and development builds
- **Security:** Uses a common, known certificate (insecure but convenient)
- **Sharing:** Same across all developers on a team
- **Location:** Usually in `~/.android/debug.keystore`
- **Automatic:** Generated automatically by Android SDK

```bash
# Default debug keystore details:
# Alias: androiddebugkey
# Password: android
# Validity: 365 days (auto-renewed)
```

### **Release Keystore (Production):**
- **Purpose:** Google Play Store releases
- **Security:** Unique, secure certificate specific to your app
- **Sharing:** Must be kept secret and secure
- **Location:** You create and manage this
- **Manual:** You must generate and maintain this

```bash
# Generate release keystore:
keytool -genkey -v -keystore my-app.keystore -alias my-app-alias -keyalg RSA -keysize 2048 -validity 10000
```

## EAS Keystore Management

EAS provides three approaches to keystore management:

### **1. EAS-Managed (Recommended for New Apps):**
```bash
# EAS creates and stores keystores securely
eas build --profile production --platform android
# EAS will prompt to generate new credentials
```

**Benefits:**
- EAS creates and stores keystores securely in the cloud
- Automatic certificate renewal
- No local files to manage or lose
- Team sharing built-in

### **2. Local Keystores (Full Control):**
```bash
# Upload your existing keystore to EAS
eas credentials
# Follow prompts to upload keystore file
```

**Benefits:**
- Complete control over your certificates
- Can use existing keystores from previous apps
- Works with existing CI/CD pipelines

### **3. Hybrid Approach (Our Migration Strategy):**
- **Debug builds:** Use local debug keystore
- **Release builds:** EAS-managed keystores

This is ideal for **bare React Native → Expo migrations** where you want to preserve existing development workflows while modernizing release management.

## Development Client Concept

### **What is a Development Client?**

A Development Client is a special build of your app that can connect to Metro bundler for hot reloading and debugging.

### **Traditional Development Flow:**
```bash
# Build and install for every change
npx react-native run-android     # Takes 2-5 minutes
# Make code changes
npx react-native run-android     # Another 2-5 minutes
```

### **EAS Development Client Flow:**
```bash
# Build once (10-15 minutes)
eas build --profile development --platform android

# Install APK on device (one-time)
# Then for daily development:
npx expo start --dev-client      # Instant connection
# Make code changes → instant hot reload
```

### **Development Client Benefits:**

1. **One Build, Many Uses** - Install once, develop for weeks
2. **Real Device Testing** - Test on actual hardware, not just simulators  
3. **Team Sharing** - Share APK with team members for testing
4. **Faster Iteration** - No rebuild needed for JavaScript/TypeScript changes
5. **Native Module Testing** - Test BLE, camera, sensors on real devices

## Wildlife Watcher Migration Context

### **Our Keystore Issue and Resolution**

During our Expo migration, we encountered this error:
```
/home/expo/workingdir/build/android/keystores/release.keystore.properties (No such file or directory)
```

**Root Cause:** Our `android/app/build.gradle` was trying to load both debug AND release keystore configurations, but we only had the debug keystore file.

**Why This Happened:**
1. **Bare React Native apps** often have complex Android configuration for both debug/release builds
2. **Original app setup** assumed local release keystores would exist  
3. **EAS migration** changes how release keystores are managed
4. **Native configuration files** still referenced the old local keystore setup

### **Our Fix Strategy:**

Instead of creating missing keystore files, we made the configuration **adaptive**:

```gradle
// Before (always tried to load both):
def keystoreProperties = new Properties()
keystoreProperties.load(new FileInputStream(keystorePropertiesFile))

// After (conditional loading):
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

**Applied to:**
- Properties loading
- Signing configurations  
- Build types

This allows:
- **Development builds** → Use local debug keystore
- **Release builds** → EAS manages release keystores automatically

## Build Profiles Explained

### **Development Profile:**
```json
{
  "development": {
    "developmentClient": true,
    "distribution": "internal",
    "android": {
      "buildType": "apk",
      "gradleCommand": ":app:assembleDebug"  
    }
  }
}
```

- **Output:** APK file for easy installation
- **Signing:** Debug keystore (local)
- **Optimization:** Disabled for faster builds
- **Debugging:** Enabled with source maps

### **Production Profile:**
```json
{
  "production": {
    "android": {
      "buildType": "app-bundle"
    }
  }
}
```

- **Output:** AAB (Android App Bundle) for Play Store
- **Signing:** Release keystore (EAS-managed or uploaded)
- **Optimization:** Enabled (minification, obfuscation)
- **Debugging:** Disabled

## Environment Variables in EAS

### **EAS Environment Variables:**
```bash
# Set secrets for builds
eas env:create --name GOOGLE_MAPS_API_KEY_ANDROID --environment development
eas env:create --name API_BASE --environment production
```

### **Access in App:**
```javascript
// app.config.js
export default {
  extra: {
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
    apiBase: process.env.API_BASE
  }
}

// In your app code:
import Constants from 'expo-constants';
const apiKey = Constants.expoConfig.extra.googleMapsApiKey;
```

## Security Best Practices

### **Keystore Security:**
1. **Never commit keystores** to version control
2. **Backup keystores securely** (encrypted cloud storage)
3. **Use strong passwords** (random, 20+ characters)
4. **Limit access** to release keystores
5. **Monitor certificate expiration** dates

### **EAS Security:**
1. **Use environment variables** for sensitive data
2. **Set appropriate visibility** (sensitive vs plain text)
3. **Use secrets** for API keys and tokens
4. **Review team access** permissions regularly

## Troubleshooting Common Issues

### **"Keystore not found" Errors:**
```bash
# Check if keystore files exist
ls -la android/keystores/

# Verify EAS credentials
eas credentials

# Regenerate if needed
eas credentials --clear-cache
```

### **"Signing config not found" Errors:**
- Ensure conditional keystore loading in `build.gradle`
- Verify keystore properties file format
- Check file permissions

### **"Build failed with unknown error" (Keystore related):**
- Check build logs: `eas build:view [BUILD_ID]`
- Verify keystore passwords in properties files
- Ensure keystore files are not corrupted

## Migration Checklist

### **From Bare React Native to EAS:**

- [ ] **Audit Android configuration** for keystore references
- [ ] **Make keystore loading conditional** in `build.gradle`
- [ ] **Choose keystore management strategy** (EAS-managed vs local)
- [ ] **Set up EAS environment variables** for secrets
- [ ] **Configure build profiles** for development/production
- [ ] **Test development client build** end-to-end
- [ ] **Document new workflow** for team members

### **Team Onboarding:**

- [ ] **Install EAS CLI:** `npm install -g @expo/cli`
- [ ] **Login to Expo:** `eas login`
- [ ] **Build development client:** `eas build --profile development`
- [ ] **Start development:** `npx expo start --dev-client`

## Resources

### **Official Documentation:**
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Credentials Guide](https://docs.expo.dev/app-signing/app-credentials/)
- [Android Keystore Guide](https://developer.android.com/studio/publish/app-signing)

### **Wildlife Watcher Specific:**
- [EAS Development Guide](./EAS-Development-Guide.md) - Daily workflow commands
- [Migration Guide](../../project-context/ww-app-migration-plan/MIGRATION-GUIDE.md) - Complete migration process

---

*This guide is based on our Wildlife Watcher Expo migration experience. Update as we learn more best practices.*