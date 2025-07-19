# Wildlife Watcher App - Troubleshooting Reference

## Quick Lookup Guide

This is a **fast-reference troubleshooting guide** for common issues when developing the Wildlife Watcher React Native app on Windows 11 WSL2. Use Ctrl+F to quickly find your error message or symptom.

## 🚨 Emergency Quick Fixes

### Metro Won't Start
```bash
# Kill all Metro processes and restart
pkill -f metro
npx react-native start --reset-cache
```

### Build Completely Broken
```bash
# Nuclear option - clean everything
npm cache clean --force
rm -rf node_modules package-lock.json
cd android && ./gradlew clean && cd ..
npm install --legacy-peer-deps
npx react-native run-android
```

### Device Not Responding
```bash
# Restart ADB and reconnect device
adb kill-server
adb start-server
# Unplug/replug USB cable
```

## 📋 Error Message Quick Reference

### npm install Errors

#### `npm error ERESOLVE unable to resolve dependency tree`
**Symptom**: Dependency conflicts during npm install
```bash
# Solution: Always use legacy peer deps for React Native
npm install --legacy-peer-deps

# If still failing:
npm cache clean --force
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

#### `npm error ENOTEMPTY: directory not empty`
**Symptom**: WSL2 file system corruption during npm operations
```bash
# Solution: Clean installation
npm cache clean --force
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

#### `npm error code EACCES`
**Symptom**: Permission errors with npm
```bash
# Solution: Fix npm permissions
sudo chown -R $(whoami) ~/.npm
npm cache clean --force
```

### React Native CLI Errors

#### `error: unknown option '--version'`
**Symptom**: React Native CLI not installed or corrupted
```bash
# Solution: Install/reinstall CLI
npm install --save-dev @react-native-community/cli --legacy-peer-deps
npx react-native --version
```

#### `command not found: react-native`
**Symptom**: CLI not in PATH or not installed
```bash
# Solution: Reload environment and verify installation
source ~/.bashrc
which npx
npm install --save-dev @react-native-community/cli --legacy-peer-deps
```

### Build Errors

#### `[Reanimated] Unsupported React Native version. Please use 75. or newer.`
**Symptom**: Wrong react-native-reanimated version
```bash
# Solution: Install compatible version
rm -rf node_modules/react-native-reanimated
npm install react-native-reanimated@3.16.7 --legacy-peer-deps
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

#### `Could not read script 'native_modules.gradle' as it does not exist`
**Symptom**: CLI package structure changed, paths are wrong
```bash
# Solution: Find correct path and update build files
find node_modules/ -name "native_modules.gradle" -type f

# Update android/settings.gradle and android/app/build.gradle
# Change paths to: ../node_modules/react-native/node_modules/@react-native-community/cli-platform-android/native_modules.gradle
```

#### `FAILURE: Build failed with an exception. * What went wrong: Execution failed for task ':app:installDebug'`
**Symptom**: Generic Android build failure
```bash
# Solution: Clean build and retry
cd android
./gradlew clean
./gradlew --stop
cd ..
npx react-native run-android
```

#### `Error: JAVA_HOME is not set`
**Symptom**: Java environment not configured
```bash
# Solution: Set JAVA_HOME
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc
source ~/.bashrc
java -version
echo $JAVA_HOME
```

### Metro Server Errors

#### `Error: EADDRINUSE: address already in use :::8081`
**Symptom**: Port 8081 already occupied
```bash
# Solution: Kill existing Metro and restart
pkill -f metro
netstat -an | grep 8081
npx react-native start
```

#### `Metro has encountered an error`
**Symptom**: Generic Metro bundling error
```bash
# Solution: Clear cache and restart
npx react-native start --reset-cache

# If still failing:
rm -rf /tmp/metro-*
npx react-native start --reset-cache
```

#### `Unable to resolve module`
**Symptom**: Metro can't find imported modules
```bash
# Solution: Clear Metro cache and node_modules
npx react-native start --reset-cache

# If still failing:
rm -rf node_modules
npm install --legacy-peer-deps
npx react-native start --reset-cache
```

### Device Connection Errors

#### `error Failed to launch emulator. Reason: No emulators found`
**Symptom**: No Android emulator configured (expected for device testing)
```bash
# Solution: This is normal - we're using real devices
# Connect Android phone via USB and enable USB debugging
# Or ignore this message if device is connected
```

#### `adb: device offline` or `adb: no devices/emulators found`
**Symptom**: Device connection lost
```bash
# Solution: Reset ADB connection
adb kill-server
adb start-server
adb devices

# On device: Disable/enable USB debugging
# Try different USB cable
# Restart Android Studio on Windows
```

## 🔧 Issue Categories & Solutions

### WSL2-Specific Issues

#### Slow File System Performance
**Symptom**: Builds take much longer than expected
```bash
# Solution: Consider moving project to WSL2 filesystem
cp -r /mnt/c/path/to/project ~/wildlife-watcher-mobile-app
cd ~/wildlife-watcher-mobile-app

# Trade-off: Faster builds vs. Windows file access
```

#### WSL2 Memory Issues
**Symptom**: Out of memory errors, system slowdown
```bash
# Solution: Configure WSL2 memory limit
# Create ~/.wslconfig in Windows user directory:
[wsl2]
memory=8GB
processors=4
swap=2GB

# Restart WSL2:
# Windows PowerShell: wsl --shutdown && wsl
```

#### Permission Problems
**Symptom**: File permission errors in WSL2
```bash
# Solution: Fix common permission issues
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) ~/Android

# For project files:
sudo chown -R $(whoami) /mnt/c/path/to/project
```

### Environment Setup Issues

#### Node.js Version Problems
**Symptom**: Compatibility issues with wrong Node version
```bash
# Solution: Install and use Node 20.x
nvm install 20
nvm use 20
nvm alias default 20
node --version  # Should show v20.x.x
```

#### Java Version Conflicts
**Symptom**: Build fails with Java-related errors
```bash
# Solution: Verify Java 17 installation
java -version   # Should show OpenJDK 17
echo $JAVA_HOME # Should show Java 17 path

# If wrong version:
sudo apt install openjdk-17-jdk
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc
source ~/.bashrc
```

#### Android SDK Issues
**Symptom**: Android build tools not found
```bash
# Solution: Verify Android SDK setup
echo $ANDROID_HOME  # Should show SDK path
sdkmanager --list_installed

# If missing:
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

### Development Workflow Issues

#### Hot Reload Not Working
**Symptom**: Code changes don't appear on device
```bash
# Solution: Check Metro connection and restart
# In Metro terminal, press 'r' to reload
# On device: Shake → "Reload"

# If still not working:
npx react-native start --reset-cache
```

#### App Crashes on Device
**Symptom**: App starts but immediately crashes
```bash
# Solution: Check device logs for errors
adb logcat | grep -E "(FATAL|AndroidRuntime|ReactNativeJS)"

# Common fixes:
npx react-native start --reset-cache
# Check for JavaScript errors in Metro logs
```

#### Slow Build Times
**Symptom**: Builds take longer than 5-10 minutes
```bash
# Solution: Optimize build performance
cd android

# Add to gradle.properties:
org.gradle.parallel=true
org.gradle.configureondemand=true
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m

# Clean build cache:
./gradlew clean
```

## 📊 Diagnostic Commands

### Environment Health Check
```bash
# Check all core tools
node --version          # Should be v20.x.x
npm --version           # Should be v10.x.x
java -version           # Should be OpenJDK 17
ruby --version          # Should be ruby 3.0.x
npx react-native --version  # Should show CLI version

# Check environment variables
echo $JAVA_HOME         # Should show Java path
echo $ANDROID_HOME      # Should show Android SDK path
echo $PATH | grep -o '[^:]*android[^:]*'  # Should show Android tools in PATH
```

### Project Health Check
```bash
# Check project dependencies
npm list react-native                    # Should be 0.74.6
npm list react-native-reanimated        # Should be 3.16.7
npm list @react-native-community/cli    # Should be installed

# Check Metro server
curl http://localhost:8081/status        # Should return "packager-status:running"

# Check Android build tools
cd android && ./gradlew --version && cd ..  # Should show Gradle version
```

### Device Connection Check
```bash
# Check ADB connection
adb devices                  # Should show device ID with "device" status
adb shell getprop ro.build.version.sdk  # Should show Android API level

# Check device logs
adb logcat | grep -i "wildlife" | head -10  # Should show app logs
```

## 🔍 Debugging Strategies

### Systematic Debugging Approach

#### 1. Identify the Layer
- **JavaScript Layer**: Hot reload issues, logic errors
- **Native Layer**: Build failures, device connection
- **Environment Layer**: Tool installation, PATH issues
- **Network Layer**: API calls, Metro connection

#### 2. Check the Basics First
```bash
# Basic environment check
which node && which npm && which java
echo $JAVA_HOME && echo $ANDROID_HOME

# Basic project check
ls package.json && npm list react-native

# Basic connection check
curl http://localhost:8081/status && adb devices
```

#### 3. Gather Information
```bash
# Get detailed error logs
npx react-native run-android --verbose 2>&1 | tee build.log

# Get device logs
adb logcat > device.log &
# Reproduce issue, then:
kill %1  # Stop log collection
```

#### 4. Apply Progressive Fixes
1. **Soft restart**: Reload app, restart Metro
2. **Medium restart**: Clear cache, restart Metro
3. **Hard restart**: Clean build, reinstall dependencies
4. **Nuclear restart**: Full environment reset

### Common Issue Patterns

#### Pattern 1: "It worked yesterday, now it doesn't"
**Likely causes**: Cache corruption, environment changes
```bash
# Solution sequence:
npx react-native start --reset-cache
cd android && ./gradlew clean && cd ..
npm cache clean --force
```

#### Pattern 2: "Build fails after adding new dependency"
**Likely causes**: Version conflicts, native module issues
```bash
# Solution sequence:
npm install --legacy-peer-deps
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

#### Pattern 3: "Metro starts but device shows blank screen"
**Likely causes**: JavaScript errors, bundle loading issues
```bash
# Solution sequence:
# Check Metro logs for JavaScript errors
npx react-native start --reset-cache
# Check device logs for native errors
adb logcat | grep -E "(FATAL|ReactNativeJS)"
```

## 🚀 Performance Troubleshooting

### Build Performance Issues

#### Gradle Builds Too Slow
```bash
# Check build configuration
cat android/gradle.properties

# Optimize gradle.properties:
org.gradle.parallel=true
org.gradle.configureondemand=true
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m

# Check available memory
free -h
```

#### Metro Bundle Too Slow
```bash
# Check Metro cache size
du -sh /tmp/metro-*

# Clear Metro cache
npx react-native start --reset-cache

# Check file watching
# Ensure Watchman is installed (optional)
which watchman
```

### Runtime Performance Issues

#### App Laggy on Device
```bash
# Check device performance
adb shell dumpsys meminfo com.wildlife.wildlifewatcher
adb shell dumpsys cpuinfo | grep wildlife

# Enable performance monitoring
# In app: Shake device → "Perf Monitor"
```

#### Hot Reload Slow
```bash
# Check Metro connection
curl http://localhost:8081/status

# Check file system performance
time ls -la node_modules/  # Should be fast (<2 seconds)

# Consider moving to WSL2 filesystem
```

## 📞 Escalation Procedures

### When to Seek Help

#### Level 1: Self-troubleshooting (15-30 minutes)
- Try common fixes listed above
- Check error messages against this guide
- Clear caches and restart services

#### Level 2: Documentation review (30-60 minutes)
- Review complete setup guide
- Check if environment matches expected configuration
- Try nuclear reset options

#### Level 3: Team escalation
- Gather diagnostic information:
  ```bash
  # Create support package
  npx react-native doctor > doctor.log
  npm list > packages.log
  adb logcat > device.log
  ```
- Document exact steps to reproduce
- Include error messages and logs

### Information to Include in Bug Reports

```bash
# Environment information
cat /etc/os-release                    # WSL2 version
node --version && npm --version        # Node/npm versions
java -version                          # Java version
npx react-native doctor              # React Native environment check

# Project information
git branch && git rev-parse HEAD      # Current branch and commit
npm list react-native                 # React Native version
cat package.json | grep "react-native" # Dependencies

# Error reproduction
# 1. Exact command that failed
# 2. Complete error message
# 3. Steps to reproduce
# 4. Expected vs actual behavior
```

## 🔄 Maintenance & Prevention

### Daily Prevention
- Keep Metro server running between development sessions
- Don't kill Metro unnecessarily
- Commit changes frequently to avoid lost work

### Weekly Prevention
```bash
# Clean build caches
cd android && ./gradlew clean && cd ..
npm cache clean --force

# Update system packages
sudo apt update && sudo apt upgrade

# Check disk space
df -h
```

### Monthly Prevention
```bash
# Review and update dependencies (carefully)
npm outdated
# Update only patch/minor versions

# Clean WSL2 temporary files
rm -rf /tmp/metro-*
rm -rf /tmp/react-*

# Review performance and adjust WSL2 config if needed
```

---

**Reference Status**: 🛠️ **COMPREHENSIVE TROUBLESHOOTING GUIDE**  
**Usage**: Use Ctrl+F to quickly find error messages or symptoms  
**Maintenance**: Update as new issues are discovered and resolved

*This troubleshooting guide is based on real-world issues encountered during Wildlife Watcher app development. Keep it updated as the project evolves.*