# Wildlife Watcher Mobile App - Complete Development Setup Guide

## Overview

This comprehensive guide will help junior developers set up a complete development environment for the Wildlife Watcher React Native mobile app on **Windows 11 with WSL2**. The app enables communication with AI-powered wildlife cameras via Bluetooth Low Energy (BLE).

**Target Audience**: Junior developers new to React Native, mobile development, or Windows WSL2 environments  
**Environment**: Windows 11 + WSL2 (Ubuntu) + Android device testing  
**Time Required**: 2-3 hours for complete setup  
**Difficulty**: Intermediate (requires attention to detail)

## What You'll Achieve

By the end of this guide, you'll have:
- ✅ **Complete React Native development environment** on Windows 11 WSL2
- ✅ **Working Metro development server** for live code updates
- ✅ **Android device connection** for real-world testing
- ✅ **All tools configured** for Wildlife Watcher app development
- ✅ **Understanding of the development workflow** and debugging process

## Understanding the Technology Stack

### What is the Wildlife Watcher App?
The Wildlife Watcher app is a React Native mobile application that:
- **Connects to wildlife cameras** via Bluetooth Low Energy (BLE)
- **Configures camera settings** remotely using a terminal-style interface
- **Manages wildlife monitoring projects** with location tracking
- **Updates camera firmware** using Device Firmware Update (DFU) protocol
- **Tracks deployments** on interactive maps

### Key Technologies
- **React Native 0.74.6**: Cross-platform mobile framework using JavaScript/TypeScript
- **Redux Toolkit + RTK Query**: State management and API communication
- **React Native Paper**: Material Design UI components
- **BLE Communication**: Bluetooth Low Energy for camera connectivity
- **Supabase**: Backend database and authentication
- **React Native Maps**: Location and mapping features

### Why Windows 11 WSL2?
- **Linux environment**: React Native development is optimized for Linux/macOS
- **Windows compatibility**: Keeps Windows as primary OS while accessing Linux tools
- **Performance**: WSL2 provides near-native Linux performance
- **File system challenges**: Some complexity with cross-platform file access

## Prerequisites

### Hardware Requirements
- **Windows 11** with WSL2 support
- **8GB+ RAM** (16GB recommended for smooth development)
- **20GB+ free disk space** for tools and dependencies
- **Android phone** with Android 6.0+ (API level 23+)
- **USB cable** that supports data transfer (not charging-only)

### Knowledge Prerequisites
- **Basic command line usage** (cd, ls, mkdir commands)
- **Basic JavaScript/TypeScript** understanding
- **Git basics** (clone, commit, push)
- **Text editor experience** (VS Code recommended)

## Phase 1: Windows 11 WSL2 Foundation Setup

### Step 1: Install/Verify WSL2

**Check if WSL2 is already installed:**
```powershell
# Run in Windows PowerShell (as Administrator)
wsl --version
```

**If WSL2 is not installed:**
```powershell
# Enable WSL2 feature
wsl --install

# Restart your computer when prompted
```

**Install Ubuntu (if not already installed):**
```powershell
# Install Ubuntu distribution
wsl --install -d Ubuntu

# Set WSL2 as default version
wsl --set-default-version 2
```

### Step 2: Configure WSL2 Ubuntu Environment

**Open WSL2 Ubuntu terminal** and update the system:
```bash
# Update package lists and upgrade system
sudo apt update && sudo apt upgrade -y

# Install essential build tools
sudo apt install -y curl wget git build-essential

# Install Python (required for some React Native native modules)
sudo apt install -y python3 python3-pip

# Verify installation
python3 --version
git --version
```

### Step 3: Configure WSL2 Memory (Optional but Recommended)

Create `.wslconfig` file in your Windows user directory:
```powershell
# In Windows PowerShell, navigate to user directory
cd $env:USERPROFILE

# Create .wslconfig file
notepad .wslconfig
```

Add the following content to optimize WSL2 performance:
```ini
[wsl2]
memory=8GB
processors=4
swap=2GB
```

**Restart WSL2** to apply changes:
```powershell
# In Windows PowerShell
wsl --shutdown
wsl
```

## Phase 2: Core Development Tools Installation

### Step 1: Node.js Installation (Version 20.x)

**Why Node.js 20?**: React Native 0.74.6 works best with Node.js 20.x. Newer versions may cause compatibility issues.

```bash
# Install Node Version Manager (nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal or reload bashrc
source ~/.bashrc

# Verify nvm installation
nvm --version

# Install Node.js 20 (specific version for compatibility)
nvm install 20
nvm use 20
nvm alias default 20

# Verify installation
node --version    # Should show v20.x.x
npm --version     # Should show v10.x.x
```

### Step 2: Java Development Kit (JDK) Installation

**Why Java?**: Android builds require Java to compile the native Android code.

```bash
# Install OpenJDK 17 (required for modern Android Gradle plugin)
sudo apt install -y openjdk-17-jdk

# Set JAVA_HOME environment variable
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc
source ~/.bashrc

# Verify installation
java -version     # Should show OpenJDK 17.x.x
echo $JAVA_HOME   # Should show Java installation path
```

### Step 3: Ruby Installation (Version 3.0+)

**Why Ruby?**: iOS builds and some React Native tools require Ruby and Bundler for dependency management.

```bash
# Install Ruby dependencies
sudo apt install -y autoconf bison build-essential libssl-dev libyaml-dev libreadline6-dev zlib1g-dev libncurses5-dev libffi-dev libgdbm6 libgdbm-dev libdb-dev

# Install rbenv (Ruby version manager)
git clone https://github.com/rbenv/rbenv.git ~/.rbenv
echo 'export PATH="$HOME/.rbenv/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(rbenv init -)"' >> ~/.bashrc
source ~/.bashrc

# Install ruby-build plugin
git clone https://github.com/rbenv/ruby-build.git ~/.rbenv/plugins/ruby-build

# Install Ruby 3.0.0
rbenv install 3.0.0
rbenv global 3.0.0

# Verify installation
ruby --version    # Should show ruby 3.0.0
gem --version     # Should show gem version
```

## Phase 3: Android Development Environment

### Step 1: Android SDK Installation

**Why Android SDK?**: Required to build and deploy the app to Android devices.

```bash
# Create Android SDK directory
mkdir -p ~/Android/Sdk
cd ~/Android/Sdk

# Download Android command line tools
wget https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip
unzip commandlinetools-linux-9477386_latest.zip

# Set up command line tools structure
mkdir -p cmdline-tools/latest
mv cmdline-tools/* cmdline-tools/latest/ 2>/dev/null || true

# Set environment variables
echo 'export ANDROID_HOME=~/Android/Sdk' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools' >> ~/.bashrc
source ~/.bashrc

# Accept licenses and install SDK components
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
sdkmanager "platforms;android-33" "build-tools;33.0.0"

# Verify installation
echo $ANDROID_HOME           # Should show Android SDK path
sdkmanager --list_installed  # Should show installed packages
```

### Step 2: Android Studio Installation (Windows)

**Why Android Studio?**: Provides essential USB drivers for device connection and debugging tools.

**Important**: Install Android Studio on **Windows**, not in WSL2.

1. **Download Android Studio**: https://developer.android.com/studio
2. **Install on Windows** following the setup wizard
3. **Complete initial setup** and download additional SDK components
4. **Don't worry about creating projects** - we only need it for USB drivers

## Phase 4: Project Setup and Dependencies

### Step 1: Navigate to Project Directory

```bash
# Navigate to the Wildlife Watcher project
cd /mnt/c/Users/adars/OneDrive/00OrganisedFilesProject/Work/Codefluent/Clients/wildlifeAI/ww_app/wildlife-watcher-mobile-app

# Verify you're in the right directory
ls -la
# Should see: package.json, android/, ios/, src/ folders
```

### Step 2: Install Project Dependencies

**Understanding the process**: We'll use `--legacy-peer-deps` because React Native projects often have complex dependency relationships that npm's newer resolution can't handle.

```bash
# Clean any existing installations
npm cache clean --force
rm -rf node_modules package-lock.json

# Install all project dependencies
npm install --legacy-peer-deps

# Install React Native CLI as development dependency
npm install --save-dev @react-native-community/cli --legacy-peer-deps

# Install Ruby gems (for iOS and some build tools)
gem install bundler
bundle install
```

### Step 3: Verify Installation

```bash
# Check React Native CLI
npx react-native --version

# Check Metro bundler
npx react-native start --help

# Verify key dependencies
npm list react-native
npm list react-native-reanimated
```

**Expected versions:**
- React Native: 0.74.6
- React Native Reanimated: 3.16.7 (important for compatibility)

## Phase 5: Android Device Connection

### Step 1: Enable Developer Options on Android Phone

**For most Android phones:**
1. Go to **Settings** → **About phone**
2. Find **"Build number"** and tap it **7 times rapidly**
3. You'll see "You are now a developer!" message

**For Xiaomi phones:**
1. Go to **Settings** → **About phone**
2. Find **"MIUI version"** and tap it **7 times rapidly**

### Step 2: Enable USB Debugging

1. Go to **Settings** → **Developer options** (or **Settings** → **System** → **Advanced** → **Developer options**)
2. Turn ON **"USB debugging"**
3. Turn ON **"Install via USB"** (if available)
4. Turn ON **"USB debugging (Security settings)"** (if available)

### Step 3: Connect Device via USB

1. **Connect phone** to computer via USB cable
2. **Select "File transfer"** mode when phone prompts for USB usage
3. **Allow USB debugging** when phone shows authorization dialog
4. **Check "Always allow from this computer"** and tap **"Allow"**

### Step 4: Verify Device Connection

```bash
# Check if device is recognized (this might not work in WSL2)
adb devices
```

**If device not recognized** (common in WSL2):
- Device connection will be handled through Android Studio on Windows
- The build process will still work as long as the device is connected

## Phase 6: Build and Test the App

### Step 1: Start Metro Development Server

**Open Terminal 1** and start the Metro bundler:
```bash
# Navigate to project directory
cd /mnt/c/Users/adars/OneDrive/00OrganisedFilesProject/Work/Codefluent/Clients/wildlifeAI/ww_app/wildlife-watcher-mobile-app

# Start Metro server (keep this running)
npx react-native start

# You should see the Metro welcome screen with logo
```

**What Metro does:**
- **Bundles JavaScript code** for the mobile app
- **Enables hot reloading** so changes appear instantly
- **Serves the app** to your device during development

### Step 2: Build and Install App on Device

**Open Terminal 2** (keep Metro running in Terminal 1):
```bash
# Build and install app on connected Android device
npx react-native run-android
```

**What happens during first build:**
1. **Gradle downloads** (2-3 minutes) - Android build system
2. **Dependencies download** (3-5 minutes) - React Native libraries
3. **App compilation** (2-4 minutes) - Building APK file
4. **Installation** (30 seconds) - Installing on your device
5. **App launch** - Wildlife Watcher app opens on your phone

**Expected total time for first build**: 8-12 minutes

### Step 3: Verify Successful Installation

After the build completes, you should see:
- ✅ **"BUILD SUCCESSFUL"** message in terminal
- ✅ **Wildlife Watcher app** installed on your Android phone
- ✅ **App launches** and shows the main interface
- ✅ **Metro server** shows "Connected" status

## Understanding the Development Workflow

### Making Code Changes

1. **Edit code** in your preferred editor (VS Code recommended)
2. **Save the file** (Ctrl+S)
3. **See changes instantly** on your phone via hot reloading
4. **No rebuild required** for JavaScript/TypeScript changes

### When to Rebuild

You need to rebuild (`npx react-native run-android`) when:
- **Adding new native dependencies**
- **Changing Android native code**
- **Modifying build configurations**
- **Updating React Native version**

### Development Commands Reference

```bash
# Start Metro server (always keep running)
npx react-native start

# Build and install app
npx react-native run-android

# Clear Metro cache (if having issues)
npx react-native start --reset-cache

# Clean Android build (if having build issues)
cd android && ./gradlew clean && cd ..

# View device logs
adb logcat | grep -i "wildlife"
```

## WSL2-Specific Considerations

### File System Performance

**Problem**: Windows file system access from WSL2 can be slow.

**Solution**: For better performance, consider copying project to WSL2 home:
```bash
# Copy project to WSL2 for better performance (optional)
cp -r /mnt/c/path/to/project ~/wildlife-watcher-mobile-app
cd ~/wildlife-watcher-mobile-app
```

### Memory and Performance

**Tips for better performance:**
- **Close unnecessary Windows applications** during builds
- **Use Windows Terminal** for better WSL2 experience
- **Keep Metro server running** between development sessions
- **Clear caches** if builds become slow

### File Permissions

**Common issue**: Permission errors with npm.

**Fix**:
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
```

## Common Issues and Solutions

### Issue 1: "Command not found" errors

**Problem**: Commands like `npx react-native` don't work.

**Solution**:
```bash
# Reload environment
source ~/.bashrc

# Verify Node.js installation
which node
which npm

# Reinstall React Native CLI if needed
npm install --save-dev @react-native-community/cli --legacy-peer-deps
```

### Issue 2: Build fails with dependency conflicts

**Problem**: npm install fails with ERESOLVE errors.

**Solution**:
```bash
# Always use legacy peer deps for React Native
npm install --legacy-peer-deps

# If still failing, clean and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Issue 3: Metro bundler connection issues

**Problem**: Metro can't connect to device.

**Solution**:
```bash
# Check if port 8081 is free
netstat -an | grep 8081

# Kill existing Metro processes
pkill -f metro

# Restart with cache reset
npx react-native start --reset-cache
```

### Issue 4: Android build fails

**Problem**: Gradle build errors.

**Solution**:
```bash
# Clean build cache
cd android
./gradlew clean
cd ..

# Verify Java installation
java -version
echo $JAVA_HOME

# Retry build
npx react-native run-android
```

### Issue 5: Device not recognized

**Problem**: `adb devices` shows no devices.

**Solution**:
- **Ensure Android Studio is running** on Windows
- **Check USB debugging** is enabled on phone
- **Try different USB cable** (must support data transfer)
- **Restart ADB server**: `adb kill-server && adb start-server`

## Success Verification Checklist

### ✅ Environment Setup Complete
- [ ] WSL2 Ubuntu running smoothly
- [ ] Node.js 20.x installed and working
- [ ] Java 17 installed with JAVA_HOME set
- [ ] Ruby 3.0+ installed with rbenv
- [ ] Android SDK installed with platform-tools

### ✅ Project Setup Complete
- [ ] Project dependencies installed successfully
- [ ] React Native CLI available (`npx react-native --version`)
- [ ] React Native Reanimated 3.16.7 installed
- [ ] Bundle install completed without errors

### ✅ Development Environment Working
- [ ] Metro server starts and shows welcome screen
- [ ] Android device connected and recognized
- [ ] Android build completes successfully (BUILD SUCCESSFUL)
- [ ] Wildlife Watcher app installs and launches on device
- [ ] Hot reloading works (code changes appear on device)

### ✅ Developer Tools Ready
- [ ] Android Studio installed on Windows (for USB drivers)
- [ ] VS Code or preferred editor configured
- [ ] Git working for version control
- [ ] Terminal/command line comfortable to use

## What's Next?

After completing this setup, you're ready for:

1. **Code Development**: Start making changes to the Wildlife Watcher app
2. **Feature Testing**: Test new features on your connected Android device
3. **Debugging**: Use Metro logs and device debugging tools
4. **BLE Development**: Work with Bluetooth Low Energy features (future guide)
5. **Supabase Integration**: Connect to the backend database

## Time Investment Summary

**Initial Setup Time**: 2-3 hours
- Environment setup: 45-60 minutes
- Tool installation: 60-90 minutes
- Project setup: 15-30 minutes
- First build: 10-15 minutes

**Daily Development Time**: 2-3 minutes
- Start Metro server: 30 seconds
- Build and deploy changes: 1-2 minutes
- Hot reloading: Instant

## Key Learnings for Junior Developers

### React Native Development
- **Metro server is essential** - always keep it running during development
- **Hot reloading saves time** - JavaScript changes appear instantly
- **Native changes require rebuilds** - Android/iOS code needs full rebuild
- **Device testing is crucial** - emulators can't replace real device testing

### Windows WSL2 Development
- **File system matters** - WSL2 vs Windows paths affect performance
- **Environment variables are critical** - JAVA_HOME, ANDROID_HOME must be set
- **Package managers have quirks** - Always use `--legacy-peer-deps`
- **Cross-platform complexity** - Windows + Linux + Android creates challenges

### Dependency Management
- **Version compatibility is crucial** - React Native has strict version requirements
- **Clean installs solve most issues** - When in doubt, clean and reinstall
- **Official documentation wins** - Always check official compatibility matrices
- **Cache management matters** - Multiple cache layers need different clearing commands

---

**Setup Status**: 🎯 **COMPLETE DEVELOPMENT ENVIRONMENT**  
**Next Steps**: Daily development workflow and feature implementation  
**Support**: Refer to troubleshooting section for common issues

*This guide represents real-world experience setting up the Wildlife Watcher app development environment. Keep it updated as tools and versions evolve.*