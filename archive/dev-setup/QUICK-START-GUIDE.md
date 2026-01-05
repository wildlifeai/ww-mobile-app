# Wildlife Watcher App - Quick Start Guide

## Overview

**Fast setup guide** for experienced React Native developers setting up the Wildlife Watcher mobile app on **Windows 11 WSL2**. For detailed explanations, see `COMPLETE-SETUP-GUIDE.md`.

**Target**: Experienced React Native developers  
**Time**: 30-45 minutes  
**Environment**: Windows 11 WSL2 + Android device

## Prerequisites Check

```bash
# Verify these are already installed:
wsl --version           # WSL2 should be running
node --version          # Should be v20.x.x (required)
java -version           # Should be OpenJDK 17 (required)
adb devices             # Android device connected
```

## Critical Version Requirements

⚠️ **Version-specific requirements** (compatibility tested):
- **Node.js**: 20.x.x (not 22.x.x)
- **Java**: OpenJDK 17 (for Android Gradle Plugin 8.2.1)
- **React Native**: 0.74.6
- **react-native-reanimated**: 3.16.7 (NOT 3.18.0 - incompatible)

## 15-Minute Setup

### 1. Environment Setup (5 minutes)

```bash
# WSL2 Ubuntu - Install core tools
sudo apt update && sudo apt install -y curl wget git build-essential python3

# Node.js 20 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20 && nvm use 20 && nvm alias default 20

# Java 17 + JAVA_HOME
sudo apt install -y openjdk-17-jdk
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc
source ~/.bashrc

# Ruby 3.0 (for build tools)
sudo apt install -y autoconf bison build-essential libssl-dev libyaml-dev libreadline6-dev zlib1g-dev libncurses5-dev libffi-dev libgdbm6 libgdbm-dev libdb-dev
git clone https://github.com/rbenv/rbenv.git ~/.rbenv
echo 'export PATH="$HOME/.rbenv/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(rbenv init -)"' >> ~/.bashrc
source ~/.bashrc
git clone https://github.com/rbenv/ruby-build.git ~/.rbenv/plugins/ruby-build
rbenv install 3.0.0 && rbenv global 3.0.0
```

### 2. Android SDK Setup (5 minutes)

```bash
# Android SDK via command line tools
mkdir -p ~/Android/Sdk && cd ~/Android/Sdk
wget https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip
unzip commandlinetools-linux-9477386_latest.zip
mkdir -p cmdline-tools/latest
mv cmdline-tools/* cmdline-tools/latest/ 2>/dev/null || true

# Environment variables
echo 'export ANDROID_HOME=~/Android/Sdk' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools' >> ~/.bashrc
source ~/.bashrc

# Install SDK components
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

### 3. Project Dependencies (5 minutes)

```bash
# Navigate to project
cd /mnt/c/Users/adars/OneDrive/00OrganisedFilesProject/Work/Codefluent/Clients/wildlifeAI/ww_app/wildlife-watcher-mobile-app

# Clean install with correct versions
npm cache clean --force
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Essential: Install React Native CLI
npm install --save-dev @react-native-community/cli --legacy-peer-deps

# Ruby gems
gem install bundler && bundle install

# Verify critical versions
npm list react-native                 # Should be 0.74.6
npm list react-native-reanimated      # Should be 3.16.7
```

## Android Device Setup (2 minutes)

```bash
# On Android phone:
# 1. Settings → About → Tap "Build number" 7 times
# 2. Settings → Developer Options → Enable "USB debugging"
# 3. Connect via USB → Allow debugging

# Install Android Studio on Windows (for USB drivers)
# Download: https://developer.android.com/studio
```

## Build and Run (5 minutes)

```bash
# Terminal 1: Start Metro (keep running)
npx react-native start

# Terminal 2: Build and install
npx react-native run-android

# Expected: BUILD SUCCESSFUL + app launches on phone
```

## Known WSL2 Issues & Fixes

### Issue: CLI native_modules.gradle not found
```bash
# Find correct path
find node_modules/ -name "native_modules.gradle" -type f

# Update android/settings.gradle and android/app/build.gradle:
# Change to: ../node_modules/react-native/node_modules/@react-native-community/cli-platform-android/native_modules.gradle
```

### Issue: Reanimated version error
```bash
# Wrong version installed - install compatible version
rm -rf node_modules/react-native-reanimated
npm install react-native-reanimated@3.16.7 --legacy-peer-deps
cd android && ./gradlew clean && cd ..
```

### Issue: ENOTEMPTY errors (WSL2 file system)
```bash
# Clean install
npm cache clean --force
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

## Daily Workflow Commands

```bash
# Start development (2 commands)
npx react-native start                    # Terminal 1 - keep running
npx react-native run-android             # Terminal 2 - build/install

# Development cycle
# Edit code → Save → Changes appear on device (hot reload)

# When to rebuild (native changes only)
npx react-native run-android

# Emergency fixes
pkill -f metro                           # Kill Metro
npx react-native start --reset-cache     # Clear cache
cd android && ./gradlew clean && cd ..   # Clean build
```

## Essential Commands Reference

```bash
# Environment check
node --version && npm --version && java -version
echo $JAVA_HOME && echo $ANDROID_HOME
npx react-native --version

# Project health check
npm list react-native react-native-reanimated
curl http://localhost:8081/status
adb devices

# Troubleshooting
npm install --legacy-peer-deps           # Always use for React Native
npx react-native start --reset-cache     # Clear Metro cache
cd android && ./gradlew clean && cd ..   # Clean Android build
adb kill-server && adb start-server      # Reset device connection
```

## Performance Optimization

```bash
# WSL2 memory config (~/.wslconfig on Windows)
[wsl2]
memory=8GB
processors=4

# Gradle performance (android/gradle.properties)
org.gradle.parallel=true
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m

# Optional: Move project to WSL2 for speed
cp -r /mnt/c/path/to/project ~/wildlife-watcher-mobile-app
```

## Critical Success Indicators

✅ **Metro starts with welcome logo**  
✅ **npx react-native --version works**  
✅ **BUILD SUCCESSFUL in terminal**  
✅ **Wildlife Watcher app launches on phone**  
✅ **Hot reload works (code changes appear instantly)**  

## Emergency Recovery

```bash
# Nuclear option - when everything breaks
pkill -f metro
npm cache clean --force
rm -rf node_modules package-lock.json
cd android && ./gradlew clean && cd ..
npm install --legacy-peer-deps
npx react-native run-android
```

## What Makes This Setup Different

🔥 **Wildlife Watcher-specific requirements:**
- **BLE functionality** - requires React Native CLI (not Expo)
- **Native DFU support** - custom Nordic DFU integration
- **Maps integration** - react-native-maps with location services
- **Real device testing** - BLE requires physical Android device

⚠️ **WSL2-specific challenges:**
- **File system performance** - Windows drive access slower
- **USB device access** - requires Android Studio on Windows
- **Node modules corruption** - ENOTEMPTY errors common
- **Path complexity** - nested CLI package structure

🎯 **Version compatibility critical:**
- **React Native 0.74.6** locked for stability
- **Reanimated 3.16.7** highest compatible version
- **Node 20.x.x** required for build tools
- **Java 17** required for Android Gradle Plugin 8.2.1

## Documentation References

- **Complete Setup**: `COMPLETE-SETUP-GUIDE.md` - Detailed explanations for junior developers
- **Daily Workflow**: `DEVELOPMENT-WORKFLOW.md` - Development process and productivity tips
- **Troubleshooting**: `TROUBLESHOOTING-REFERENCE.md` - Quick error fixes and diagnostics
- **Dependency Analysis**: `react-native-dependency-issues-analysis.md` - Detailed compatibility research

## Support Escalation

1. **First**: Check `TROUBLESHOOTING-REFERENCE.md` for error message
2. **Second**: Review `COMPLETE-SETUP-GUIDE.md` for detailed setup steps
3. **Third**: Run diagnostic commands and gather logs for team escalation

---

**Quick Start Status**: ⚡ **FAST TRACK TO DEVELOPMENT**  
**Total Time**: 30-45 minutes for experienced React Native developers  
**Success Rate**: High with version requirements followed exactly

*This quick start guide assumes React Native experience. For detailed explanations and junior developer guidance, use the Complete Setup Guide.*