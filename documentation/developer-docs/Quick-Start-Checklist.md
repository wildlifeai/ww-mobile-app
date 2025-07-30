# Wildlife Watcher - Quick Start Checklist

## For Experienced React Native/Expo Developers

If you're already familiar with React Native and Expo development, here's the condensed setup guide:

## Prerequisites ✅

- [ ] Node.js 18+
- [ ] Expo CLI & EAS CLI: `npm install -g @expo/cli eas-cli`
- [ ] Android device with USB debugging enabled
- [ ] Expo account (free): [expo.dev](https://expo.dev)

## Quick Setup (5 minutes)

```bash
# 1. Clone and setup
git clone [REPO_URL] wildlife-watcher-mobile-app
cd wildlife-watcher-mobile-app
git checkout expo-migration

# 2. Install dependencies
npm install
# For iOS: npm run pod-install

# 3. Start development server
npm start
```

## Get App on Device (Choose One)

### Option A: Pre-built Development Build (Fastest)
1. Download APK: https://expo.dev/accounts/apps_wildlife/projects/wildlife-watcher-expo/builds/12fa61c8-cf82-47c5-a8b1-f92fea0a04ca
2. Install on Android device
3. Connect to development server via QR code

### Option B: Build Your Own
```bash
eas login
eas build --platform android --profile development
# Wait ~15 minutes, install APK
```

### Option C: Expo Go (Limited - No BLE)
- Install Expo Go app
- Scan QR code from `npm start`
- Note: BLE functionality disabled in Expo Go

## Key Tech Stack Notes

- **React Native 0.74.6** + **Expo SDK 51**
- **TypeScript** throughout
- **Redux Toolkit** + RTK Query for state
- **React Navigation 6** (native stack)
- **React Native Paper** for UI
- **Critical native modules:**
  - `react-native-ble-manager` - BLE communication
  - `react-native-nordic-dfu` - Firmware updates
  - `react-native-maps` - Location features

## Important: BLE Testing

- **Must use development build** (not Expo Go) for BLE functionality
- Requires location permissions for BLE scanning
- Test with real Wildlife Watcher devices for full functionality

## Project Structure

```
src/
├── components/ui/       # WW-prefixed UI components
├── navigation/screens/  # Screen components
├── hooks/useBle.ts     # Core BLE functionality
├── providers/          # Context providers (BLE, Auth, etc.)
├── redux/             # State management
├── services/          # External integrations
└── ble/               # BLE types and parsing
```

## Development Commands

```bash
npm start              # Start dev server
npm test              # Jest tests
npm run lint          # ESLint
npm run android       # Run on Android (bare RN)
npm run ios           # Run on iOS (bare RN)
```

## Build Commands

```bash
# Development builds
eas build --platform android --profile development
eas build --platform ios --profile development

# Production builds
eas build --platform android --profile production
eas build --platform ios --profile production
```

## Troubleshooting Quick Fixes

```bash
# Clear cache
npx expo start --clear

# Clean reinstall
rm -rf node_modules package-lock.json && npm install

# ADB issues
adb kill-server && adb start-server

# iOS pod issues (macOS)
cd ios && pod install --repo-update && cd ..
```

## Key Development Notes

1. **Provider Hierarchy:** App uses nested providers (Redux → Paper → Navigation → BLE → Auth)
2. **BLE Queue System:** 500ms intervals prevent device buffer overflow
3. **TypeScript:** Prefer `type` over `interface` (per .cursorrules)
4. **Custom Components:** Use existing WW-prefixed components
5. **State Management:** RTK Query for API, Redux Toolkit for local state

## Testing BLE Features

- Device scanning works without hardware
- Connection requires real Wildlife Watcher devices
- DFU requires firmware files and connected devices
- Map features work with internet connection

## Ready to Code! 🚀

You should now have:
- ✅ App running on device with full BLE support
- ✅ Hot reload working
- ✅ Access to all native functionality
- ✅ Understanding of key architecture

**Next:** Check `documentation/developer-docs/` for detailed technical docs on BLE, DFU, and system architecture.

---

*Need the full guide? See [Developer-Onboarding-Guide.md](./Developer-Onboarding-Guide.md)*