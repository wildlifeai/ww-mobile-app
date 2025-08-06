# Wildlife Watcher Expo Migration - Quick Reference

## 🚀 5-Hour Fast Track

### Hour 1: Setup (Human Actions Required)
```bash
# 1. Clone WW app and create branch
cd [WW_APP_PATH]
git checkout -b expo-eas-migration

# 2. Install tools and login
npm install -g eas-cli expo-cli
eas login  # 🚨 HUMAN: Enter credentials

# 3. Copy PoC scripts folder to app
cp -r [POC_PATH]/ww-expo-poc/scripts ./scripts
```

### Hour 2: Core Integration
```bash
# 🚨 HUMAN: Create Expo project first
eas project:create --name="Wildlife Watcher Expo"

# Run these commands in sequence  
npm install expo@~51.0.39
# Create app.json with slug "wildlife-watcher-expo"
eas init --id wildlife-watcher-expo  # Link to created project
eas project:info  # Verify linkage
```

### Hour 3: Dependencies
```bash
# Expo packages
npx expo install expo-dev-client@~4.0.29
npx expo install expo-status-bar expo-splash-screen expo-constants expo-file-system

# Remove old packages
npm uninstall react-native-fs react-native-config react-native-bootsplash

# Fix versions
npm install react-native@0.74.6 --save-exact
npm install react@18.2.0 --save-exact
```

### Hour 4: Code Migration
```bash
# Run migration scripts with validation
node scripts/migrate-filesystem.js
npm run validate:deps  # PoC Guardrail

node scripts/migrate-env.js  
npm run validate:deps  # PoC Guardrail

node scripts/migrate-splash.js
npm run validate:deps  # PoC Guardrail

# Final validation
npx expo-doctor --verbose
```

### Hour 5: Build & Deploy
```bash
# 🚨 HUMAN: Set secrets first
eas secret:create --name GOOGLE_MAPS_API_KEY_ANDROID
eas secret:create --name API_BASE

# Start Android build
eas build --profile development --platform android
# ~10 minutes - do other tasks while waiting
```

### Hour 6: Test
```bash
# Start dev server
npx expo start --dev-client
# 🚨 HUMAN: Install APK and test
```

---

## 📋 Critical File Changes

### 1. package.json additions:
```json
{
  "main": "index.js",
  "scripts": {
    "start": "expo start --dev-client",
    "validate:deps": "node scripts/validate-deps.js"
  },
  "overrides": {
    "react-native": "0.74.6"
  }
}
```

### 2. New files to create:
- `index.js` - Entry point
- `app.config.js` - Expo config
- `eas.json` - EAS config
- `metro.config.js` - Metro config

### 3. Code replacements:
- `RNFS` → `FileSystem`
- `Config.` → `Constants.expoConfig.extra.`
- `RNBootSplash` → `SplashScreen`

---

## 🚨 Common Issues & Quick Fixes

### Build Fails
```bash
eas build:list  # Check status
eas build:view [BUILD_ID]  # See logs
```

### Dependencies Issues
```bash
npx expo-doctor --fix-dependencies
npm run validate:deps
```

### Metro Issues
```bash
npx expo start --clear
rm -rf node_modules/.cache
```

### Can't Connect Device
- Check same WiFi network
- Use `adb reverse tcp:8081 tcp:8081` for USB
- Try tunnel mode: `npx expo start --tunnel`

---

## ✅ Success Checklist

**PoC-Level Rigorous Testing:**
- [ ] App builds on EAS (< 15 min)
- [ ] Installs on device successfully
- [ ] **BLE CRITICAL**: Scanning works
- [ ] **BLE CRITICAL**: Can connect to real device
- [ ] **BLE CRITICAL**: PING/PONG works
- [ ] **DFU CRITICAL**: Firmware selection works
- [ ] **Maps**: Display with markers
- [ ] **Navigation**: All tabs/screens work
- [ ] **Redux**: State updates correctly
- [ ] **File System**: Read/write operations work
- [ ] No console errors (same as before migration)
- [ ] Hot reload works
- [ ] Performance comparable to original

**Stop and fix if any critical tests fail**

---

## 📞 Getting Help

1. Check build logs: `eas build:view`
2. Run doctor: `npx expo-doctor`
3. Validate deps: `npm run validate:deps`
4. Clear everything: `npx expo start --clear`

---

## 🎯 Time Savers

1. **Start Android build ASAP** - it takes 10 min
2. **Run migrations while build runs**
3. **Skip iOS initially** - adds 30+ min
4. **Use PoC as reference** - proven configs
5. **Don't refactor** - just migrate

---

## 📱 Testing Priority

Test in this order:
1. App launches ✓
2. BLE permissions ✓
3. BLE scanning ✓
4. Maps display ✓
5. Navigation ✓
6. Redux state ✓
7. File operations ✓

Stop and fix if any fail!