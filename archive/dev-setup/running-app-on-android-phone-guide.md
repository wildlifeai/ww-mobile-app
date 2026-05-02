# Running Wildlife Watcher App on Android Phone - Complete Guide

## Overview

This guide walks you through the complete process of running the Wildlife Watcher React Native app on your Android phone. Written for junior developers who are new to React Native development.

**Target Audience**: New developers unfamiliar with React Native, Android development, or mobile app testing  
**Time Required**: 30-60 minutes (depending on setup needs)  
**Environment**: Windows WSL2 + Android phone

## What You'll Achieve

By the end of this guide, you'll be able to:
- ✅ Connect your Android phone to your development computer
- ✅ Run the Wildlife Watcher app directly on your phone
- ✅ See live changes as you develop (hot reloading)
- ✅ Debug and test the app on a real device

## Prerequisites

Before starting, ensure you have:
- ✅ **Working Development Environment** (see `actual-setup-process-and-fixes.md`)
- ✅ **Android Phone** with Android 6.0+ (API level 23+)
- ✅ **USB Cable** that supports data transfer (not just charging)
- ✅ **Android Studio** installed on Windows (for USB drivers)

## Understanding the Process

### What is React Native?
React Native lets you build mobile apps using JavaScript. Your app runs on both the phone and your computer simultaneously:
- **Your Computer**: Runs the development server (Metro) and builds the app
- **Your Phone**: Runs the actual app and receives updates from your computer

### What is ADB?
ADB (Android Debug Bridge) is a tool that lets your computer communicate with your Android phone for development purposes.

### What is Gradle?
Gradle is the build system that compiles your React Native code into an Android APK (the installable app file).

## Step-by-Step Process

### Phase 1: Enable Developer Mode on Your Phone

#### Step 1: Find Developer Options
**For most Android phones:**
1. Go to **Settings** → **About phone**
2. Find **"Build number"** and tap it **7 times rapidly**
3. You'll see "You are now a developer!" message

**For Xiaomi phones (like Mi 10T Pro):**
1. Go to **Settings** → **About phone**
2. Find **"MIUI version"** (not Build number)
3. Tap **"MIUI version" 7 times rapidly**
4. You'll see "You are now a developer!" message

#### Step 2: Enable USB Debugging
1. Go to **Settings** → **Additional settings** (or **System** → **Advanced**)
2. Find **"Developer options"**
3. Turn ON **"USB debugging"**
4. Also turn ON **"Install via USB"** (if available)
5. Turn ON **"USB debugging (Security settings)"** (if available)

### Phase 2: Install Android Studio (Driver Management)

#### Why Android Studio?
Android Studio provides the proper USB drivers needed for your phone to communicate with your computer. Without it, your phone won't be recognized for development.

#### Step 1: Download and Install
1. **Download**: https://developer.android.com/studio
2. **Install** on Windows (not WSL2)
3. **Follow setup wizard** - let it download SDK components
4. **Open Android Studio** and complete initial setup

#### Step 2: Verify Phone Detection
1. **Connect your phone** via USB cable
2. **Select "File transfer"** when your phone asks about USB use
3. **Look for "Allow USB debugging?"** popup on phone → Tap **"Allow"**
4. **In Android Studio**: View → Tool Windows → Device Manager
5. **Your phone should appear** in the device list

### Phase 3: Set Up Development Environment

#### Step 1: Verify Prerequisites
Ensure your development environment is ready:
```bash
# Check all required tools
node --version          # Should be v20.x.x
npm --version           # Should be v10.x.x
java -version           # Should be OpenJDK 11
npx react-native -v    # Should show CLI version
```

#### Step 2: Navigate to Project
```bash
cd /mnt/c/Users/adars/OneDrive/00OrganisedFilesProject/Work/Codefluent/Clients/wildlifeAI/ww_app/wildlife-watcher-mobile-app
```

#### Step 3: Test ADB Connection
```bash
# Test if your phone is detected
adb devices
```

**Expected output:**
```
List of devices attached
ABC123456789    device
```

If your phone doesn't appear, see "Troubleshooting ADB Connection" section below.

### Phase 4: Run the App on Your Phone

#### Step 1: Start Metro Server
Open **Terminal 1** and run:
```bash
npx react-native start
```

**What this does:**
- Starts the React Native development server
- Bundles your JavaScript code
- Enables hot reloading for live updates

**Expected output:**
```
info Welcome to React Native v0.74
info Starting dev server on port 8081...

                        ▒▒▓▓▓▓▒▒
                     ▒▓▓▓▒▒░░▒▒▓▓▓▒
                  ▒▓▓▓▓░░░▒▒▒▒░░░▓▓▓▓▒

                Welcome to Metro v0.80.12
              Fast - Scalable - Integrated
```

#### Step 2: Build and Install App
Open **Terminal 2** and run:
```bash
npx react-native run-android
```

**What this does:**
- Builds your React Native app for Android
- Creates an APK file
- Installs the APK on your phone
- Launches the app on your phone

#### Step 3: First Build Process
The first time you run this command, you'll see:

**1. Gradle Download (2-3 minutes)**
```
Downloading https://services.gradle.org/distributions/gradle-8.6-all.zip
....................10%.....................20%.....................30%...
```

**2. Gradle Daemon Start (1-2 minutes)**
```
Starting a Gradle Daemon (subsequent builds will be faster)
<-------------> 0% INITIALIZING [1m 29s]
```

**3. Build Process (3-5 minutes)**
```
> Evaluating settings
> Configuring project
> Task :app:compileDebugJavaWithJavac
> Task :app:packageDebug
```

**4. Success Message**
```
BUILD SUCCESSFUL in 5m 23s
info Installing the app...
info Launching the app...
```

#### Step 4: App Launches on Phone
- **Wildlife Watcher app** installs automatically on your phone
- **App launches** and shows the main screen
- **You can now use the app** directly on your phone

## Understanding Build Times

### First Build: 5-10 Minutes
**Why it's slow:**
- Downloads Gradle build system
- Downloads Android dependencies
- Downloads React Native libraries
- Builds entire app from scratch

**What happens:**
- Gradle daemon starts (stays running for future builds)
- Dependencies are cached locally
- App is compiled and packaged

### Future Builds: 30 seconds - 2 minutes
**Why it's faster:**
- Gradle daemon already running
- Dependencies already cached
- Only changed code is recompiled

## Development Workflow

### Making Changes
1. **Edit your code** in VSCode or your preferred editor
2. **Save the file**
3. **App automatically updates** on your phone (hot reloading)
4. **See changes instantly** without rebuilding

### Common Commands
```bash
# Start Metro server (keep running)
npx react-native start

# Build and install app (run once)
npx react-native run-android

# If you need to restart Metro with clean cache
npx react-native start --reset-cache

# If you need to reinstall the app
npx react-native run-android --reset-cache
```

## Troubleshooting Common Issues

### Issue 1: Phone Not Detected by ADB

**Symptoms:**
- `adb devices` shows empty list
- No "Allow USB debugging?" popup on phone

**Solutions:**
1. **Check USB cable**: Try a different cable that supports data transfer
2. **Try different USB port**: Some ports may have driver issues
3. **Restart ADB server**:
   ```bash
   adb kill-server
   adb start-server
   adb devices
   ```
4. **Reset USB debugging authorizations**:
   - Settings → Developer options → "Revoke USB debugging authorizations"
   - Disconnect and reconnect USB cable
   - Allow debugging when prompted

### Issue 2: Build Fails with Permission Errors

**Symptoms:**
- Build fails with "permission denied" errors
- Cannot write to directories

**Solutions:**
1. **Check file permissions**:
   ```bash
   sudo chmod -R 755 android/
   ```
2. **Clean build cache**:
   ```bash
   cd android
   ./gradlew clean
   cd ..
   ```

### Issue 3: App Crashes on Phone

**Symptoms:**
- App installs but crashes immediately
- App shows white screen

**Solutions:**
1. **Check Metro server is running**:
   ```bash
   npx react-native start
   ```
2. **Clear app data** on phone:
   - Settings → Apps → Wildlife Watcher → Storage → Clear Data
3. **Reinstall app**:
   ```bash
   npx react-native run-android --reset-cache
   ```

### Issue 4: Build Stuck at "Evaluating settings"

**Symptoms:**
- Build process hangs at initialization
- No progress for 10+ minutes

**Solutions:**
1. **Kill build process** (Ctrl+C) and retry
2. **Clean Gradle cache**:
   ```bash
   cd android
   ./gradlew clean
   cd ..
   ```
3. **Check internet connection** (Gradle needs to download dependencies)

## Advanced Tips

### Viewing App Logs
```bash
# View real-time logs from your phone
adb logcat | grep -i "wildlife"
```

### Installing APK Manually
If automatic installation fails:
```bash
# Build APK manually
cd android
./gradlew assembleDebug
cd ..

# Install APK on phone
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Using WiFi Instead of USB
Once USB debugging is working:
```bash
# Enable WiFi debugging
adb tcpip 5555

# Find phone's IP address (Settings → WiFi → Current network)
adb connect <PHONE_IP>:5555

# Now you can disconnect USB cable
```

## Success Checklist

After completing this guide, you should have:
- ✅ **Developer options enabled** on your phone
- ✅ **USB debugging working** (phone appears in `adb devices`)
- ✅ **Android Studio installed** and detecting your phone
- ✅ **Metro server running** and showing React Native logo
- ✅ **App built successfully** (BUILD SUCCESSFUL message)
- ✅ **App installed and running** on your phone
- ✅ **Hot reloading working** (changes appear instantly)

## Next Steps

Now that you have the app running on your phone, you can:
1. **Start developing**: Make changes and see them instantly
2. **Test BLE features**: Use real BLE devices with your phone
3. **Debug issues**: Use real device debugging tools
4. **Test user experience**: Get realistic performance testing

## Time Investment Summary

**Setup Time**: 30-60 minutes (one-time)
- Phone setup: 5-10 minutes
- Android Studio installation: 15-30 minutes
- First build: 5-10 minutes

**Daily Development**: 30 seconds
- Start Metro server: 10 seconds
- App updates: Instant (hot reloading)
- Build time: 30 seconds - 2 minutes

## Key Concepts Learned

### React Native Development
- **Metro Server**: Development server that bundles JavaScript
- **Hot Reloading**: Instant updates without rebuilding
- **ADB**: Communication bridge between computer and phone

### Android Development
- **Gradle**: Build system that compiles your app
- **APK**: Android application package (installable file)
- **Developer Options**: Hidden settings for development

### Development Workflow
- **Edit-Save-Test**: Make changes, save, see results instantly
- **Build Once**: Initial build takes time, subsequent builds are fast
- **Real Device Testing**: Better than emulators for performance and features

---

**Status**: ✅ COMPLETE GUIDE FOR RUNNING APP ON ANDROID PHONE  
**Next**: Start developing and testing your Supabase integration!  
**Support**: Refer to troubleshooting section for common issues