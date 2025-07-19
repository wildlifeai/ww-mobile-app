# Wildlife Watcher App - Development Workflow Guide

## Overview

This guide covers the **daily development workflow** for the Wildlife Watcher React Native app on Windows 11 WSL2. It assumes you've completed the initial setup and focuses on efficient day-to-day development practices.

**Target Audience**: Developers who have completed the initial setup  
**Environment**: Windows 11 WSL2 + Android device  
**Focus**: Daily productivity, testing, and debugging workflows

## Daily Development Startup (2-3 minutes)

### Step 1: Open Development Environment

```bash
# 1. Open WSL2 Ubuntu terminal
# 2. Navigate to project directory
cd /mnt/c/Users/adars/OneDrive/00OrganisedFilesProject/Work/Codefluent/Clients/wildlifeAI/ww_app/wildlife-watcher-mobile-app

# 3. Verify you're in the right place
pwd
ls package.json  # Should exist
```

### Step 2: Start Metro Development Server

**Terminal 1** (keep this running all day):
```bash
# Start Metro bundler
npx react-native start

# Expected output:
#                        ▒▒▓▓▓▓▒▒
#                     ▒▓▓▓▒▒░░▒▒▓▓▓▒
#                  ▒▓▓▓▓░░░▒▒▒▒░░░▓▓▓▓▒
#
#                Welcome to Metro v0.80.12
#              Fast - Scalable - Integrated
```

**Metro Server Options** (press keys in Metro terminal):
- **r** - Reload app on all connected devices
- **d** - Open developer menu on devices
- **i** - Run on iOS (if iOS setup completed)
- **a** - Run on Android
- **s** - Show available devices

### Step 3: Connect Android Device

**Terminal 2**:
```bash
# Check device connection (optional - may not work in WSL2)
adb devices

# Build and install app (first time each day)
npx react-native run-android
```

**Expected behavior**: App installs and launches on your phone, showing Wildlife Watcher interface.

## Core Development Cycle

### Making Code Changes

#### 1. JavaScript/TypeScript Changes (Instant Hot Reload)

**What changes instantly:**
- React component logic
- UI styling
- Redux state management
- API calls and data handling
- Business logic

**Workflow:**
```bash
# 1. Edit files in VS Code or preferred editor
# Examples:
# - src/components/ui/WWButton.tsx
# - src/redux/slices/deviceSlice.ts
# - src/navigation/screens/TerminalScreen.tsx

# 2. Save file (Ctrl+S)
# 3. Watch changes appear on device (2-3 seconds)
# 4. No terminal commands needed!
```

#### 2. Dependencies/Native Changes (Requires Rebuild)

**What requires rebuild:**
- Adding new npm packages
- Changing `package.json` dependencies
- Modifying Android native code
- Updating build configurations
- Changing permissions or manifest

**Workflow:**
```bash
# 1. Install new dependency
npm install new-package-name --legacy-peer-deps

# 2. Stop Metro server (Ctrl+C in Terminal 1)

# 3. Rebuild and reinstall
npx react-native run-android

# 4. Restart Metro server
npx react-native start
```

### Development Commands Quick Reference

```bash
# === Daily Commands ===

# Start Metro (keep running)
npx react-native start

# Build and install app
npx react-native run-android

# Restart Metro with cache clear
npx react-native start --reset-cache

# === Weekly/Monthly Commands ===

# Clean Android build cache
cd android && ./gradlew clean && cd ..

# Clean npm cache
npm cache clean --force

# Update dependencies
npm install --legacy-peer-deps

# === Debugging Commands ===

# View device logs
adb logcat | grep -i "wildlife"

# Check Metro connection
curl http://localhost:8081/status

# List connected devices
adb devices
```

## Feature Development Workflow

### Starting a New Feature

```bash
# 1. Create feature branch
git checkout -b feature/new-camera-settings

# 2. Start Metro if not running
npx react-native start

# 3. Begin development with hot reload
# Edit files → Save → Test on device → Repeat
```

### Testing Your Changes

#### Live Testing on Device
- **UI Changes**: Save file → see changes immediately on phone
- **Logic Changes**: Test app functionality in real-time
- **BLE Features**: Test with actual Wildlife Watcher cameras (when available)
- **Location Features**: Test GPS and mapping on real device

#### Development Testing Checklist
- [ ] **Hot reload working** - changes appear quickly
- [ ] **Navigation functional** - can move between screens
- [ ] **Forms working** - input fields and buttons respond
- [ ] **API calls successful** - data loads from Supabase
- [ ] **Error handling** - app doesn't crash on errors
- [ ] **Performance smooth** - no lag or freezing

### Debugging Workflow

#### Metro Debugging
```bash
# 1. In Metro terminal, press 'd' to open debug menu
# 2. On device, select debug options:
#    - "Open Flipper" (if Flipper installed)
#    - "Toggle Inspector"
#    - "Reload"
```

#### Device Logs
```bash
# View all device logs
adb logcat

# Filter for Wildlife Watcher app
adb logcat | grep -i "wildlife"

# Filter for React Native logs
adb logcat | grep -i "ReactNativeJS"

# View crash logs
adb logcat | grep -E "(FATAL|AndroidRuntime)"
```

#### Common Debugging Scenarios

**App won't start:**
```bash
# 1. Check Metro is running
curl http://localhost:8081/status

# 2. Rebuild app
npx react-native run-android

# 3. Clear caches
npx react-native start --reset-cache
```

**Changes not appearing:**
```bash
# 1. Check file save (Ctrl+S)
# 2. Reload app manually (shake device → "Reload")
# 3. Restart Metro with cache clear
npx react-native start --reset-cache
```

**Build errors:**
```bash
# 1. Clean Android build
cd android && ./gradlew clean && cd ..

# 2. Clean npm cache
npm cache clean --force

# 3. Reinstall dependencies
rm -rf node_modules
npm install --legacy-peer-deps
```

## Git Workflow Integration

### Daily Git Operations

```bash
# Morning routine
git pull origin main
git checkout -b feature/your-feature-name

# During development (save progress frequently)
git add .
git commit -m "Add camera settings form validation"

# End of day
git push origin feature/your-feature-name
```

### Before Committing Changes

```bash
# 1. Test app functionality
npx react-native run-android

# 2. Run linting (if configured)
npm run lint

# 3. Check for TypeScript errors
npx tsc --noEmit

# 4. Test key user flows on device
```

## Performance Optimization

### Keeping Development Fast

#### Metro Server Management
```bash
# Keep Metro running between sessions
# Don't stop/start Metro frequently - it stays warm

# Only restart Metro when:
# - Adding new dependencies
# - Clearing cache for debugging
# - End of development day
```

#### File System Performance
```bash
# For faster builds, consider copying project to WSL2:
cp -r /mnt/c/path/to/project ~/wildlife-watcher-mobile-app
cd ~/wildlife-watcher-mobile-app

# Trade-off: Faster builds vs. Windows file access
```

#### Memory Management
```bash
# Close unnecessary Windows applications during development
# Especially memory-heavy apps like browsers, IDEs

# Monitor WSL2 memory usage
# Task Manager → Performance → Memory
```

### Build Performance Tips

```bash
# Use Gradle daemon (faster subsequent builds)
# This is enabled by default, don't disable it

# Parallel builds (add to android/gradle.properties)
org.gradle.parallel=true
org.gradle.configureondemand=true

# Increase JVM memory (if builds fail with memory errors)
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m
```

## Code Quality Workflow

### Before Pushing Code

#### 1. Code Review Checklist
- [ ] **Functionality works** on device
- [ ] **No console errors** in Metro logs
- [ ] **TypeScript types correct** (no `any` types)
- [ ] **Code follows project patterns** (existing component structure)
- [ ] **Comments added** for complex logic
- [ ] **Unused imports removed**

#### 2. Testing on Device
- [ ] **Hot reload tested** for this feature
- [ ] **Navigation flows work** end-to-end
- [ ] **Error scenarios handled** (network errors, validation)
- [ ] **Loading states** implemented for async operations
- [ ] **Performance acceptable** (no significant lag)

#### 3. Git Best Practices
```bash
# Descriptive commit messages
git commit -m "Add validation to camera configuration form

- Validate IP address format
- Check required fields before submission
- Show clear error messages for invalid inputs
- Add loading state during configuration save"

# Small, focused commits
git add src/components/CameraConfigForm.tsx
git commit -m "Add IP address validation to camera config form"

git add src/utils/validation.ts
git commit -m "Add IP address validation utility function"
```

## Common Development Patterns

### Working with Wildlife Watcher Features

#### BLE Device Communication
```typescript
// Pattern for BLE operations
import { useBle } from '../hooks/useBle';

const DeviceScreen = () => {
  const { connectToDevice, sendCommand, isConnected } = useBle();
  
  // Always check connection state
  // Handle loading and error states
  // Provide user feedback for BLE operations
};
```

#### Redux State Management
```typescript
// Pattern for API calls
import { useGetDevicesQuery, useUpdateDeviceMutation } from '../redux/api/deviceApi';

const DeviceList = () => {
  const { data: devices, isLoading, error } = useGetDevicesQuery();
  const [updateDevice] = useUpdateDeviceMutation();
  
  // Handle loading states
  // Handle error states
  // Optimistic updates for better UX
};
```

#### Navigation Patterns
```typescript
// Pattern for navigation
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../navigation/types';

const Screen = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  
  const handleNavigate = () => {
    navigation.navigate('DeviceConfiguration', {
      deviceId: device.id,
      deviceName: device.name
    });
  };
};
```

## Weekly/Monthly Maintenance

### Weekly Tasks
- [ ] **Pull latest changes** from main branch
- [ ] **Update feature branches** with latest main
- [ ] **Clean build caches** if builds becoming slow
- [ ] **Review and close** completed feature branches

### Monthly Tasks
- [ ] **Update dependencies** (carefully, test thoroughly)
- [ ] **Clean WSL2 disk space** (`docker system prune`, clean temp files)
- [ ] **Review performance** (build times, app startup time)
- [ ] **Update documentation** for new features or processes

### Dependency Updates (Careful!)
```bash
# Check for outdated packages
npm outdated

# Update non-major versions only (safer)
npm update --legacy-peer-deps

# For major updates, check compatibility first
# Especially for React Native core packages
```

## Emergency Recovery Procedures

### When Everything Breaks

#### 1. Metro Won't Start
```bash
# Kill all Metro processes
pkill -f metro

# Clear Metro cache
npx react-native start --reset-cache

# If still failing, restart WSL2
# Windows PowerShell: wsl --shutdown && wsl
```

#### 2. Build Completely Broken
```bash
# Nuclear option - clean everything
npm cache clean --force
rm -rf node_modules package-lock.json
cd android && ./gradlew clean && cd ..

# Fresh install
npm install --legacy-peer-deps
npx react-native run-android
```

#### 3. Device Connection Lost
```bash
# Restart ADB
adb kill-server
adb start-server

# Reconnect device
# Unplug/replug USB cable
# Enable/disable USB debugging on device
```

## Development Environment Health Check

### Daily Health Check (30 seconds)
```bash
# Check core tools
node --version    # Should be v20.x.x
npm --version     # Should be v10.x.x
java -version     # Should be OpenJDK 17

# Check Metro connection
curl http://localhost:8081/status

# Check device connection
adb devices
```

### Weekly Health Check (5 minutes)
```bash
# Check disk space
df -h

# Check WSL2 memory usage
# Windows Task Manager → Performance → Memory

# Clean temporary files
npm cache clean --force
cd android && ./gradlew clean && cd ..

# Update system packages
sudo apt update && sudo apt upgrade
```

## Success Metrics

### Daily Productivity Indicators
- ⚡ **Metro starts in < 30 seconds**
- ⚡ **Hot reload works in < 5 seconds**
- ⚡ **Build completes in < 3 minutes** (after first build)
- ⚡ **Device testing is immediate** (no connection delays)

### Weekly Development Health
- 📈 **Feature development velocity maintained**
- 🐛 **No recurring build/setup issues**
- 🔄 **Hot reload reliability > 95%**
- 📱 **Device testing catches issues early**

---

**Workflow Status**: 🚀 **OPTIMIZED FOR DAILY DEVELOPMENT**  
**Next Steps**: Focus on feature implementation and testing  
**Emergency Support**: Refer to troubleshooting reference for quick fixes

*This workflow guide is based on real development experience with the Wildlife Watcher app. Update as your team discovers new optimization techniques.*