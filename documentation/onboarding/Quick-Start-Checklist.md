# Wildlife Watcher - Quick Start Checklist

## For Experienced React Native/Expo Developers

If you're already familiar with React Native and Expo development, here's the condensed setup guide:

## Choose Your Setup Method

### 🐳 Docker (Recommended for Teams)
**Best for:** Teams, identical environments, avoiding system conflicts  
**Supports:** Windows, macOS, Linux (iOS builds still require macOS)

### 💻 Native Installation
**Best for:** Solo developers, maximum performance, iOS development  
**Supports:** Windows (WSL2), macOS, Linux

---

## 🐳 Docker Quick Start (5 minutes)

### Prerequisites
- [ ] Docker Desktop (Windows/macOS) or Docker Engine (Linux)
- [ ] Android device with USB debugging enabled
- [ ] Expo account (free): [expo.dev](https://expo.dev)

### Setup
```bash
# 1. Clone and setup
git clone [REPO_URL] wildlife-watcher-mobile-app
cd wildlife-watcher-mobile-app
git checkout dev-mvp2-development

# 2. Start Docker environment
docker-compose -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.dev.yml exec wildlife-watcher-dev bash

# 3. Inside container - install and start
npm install --ignore-scripts
npx expo start
```

**✅ DOCKER READY:** Exact environment (Node 20.19.4, Expo CLI 0.18.31, EAS CLI 16.17.3)

---

## 💻 Native Quick Start

### Prerequisites
- [ ] Node.js 20.19.4 (exact version): `nvm install 20.19.4 && nvm use 20.19.4`  
- [ ] Expo CLI & EAS CLI: `npm install -g @expo/cli@0.18.31 eas-cli@16.17.3`
- [ ] Android device with USB debugging enabled
- [ ] Expo account (free): [expo.dev](https://expo.dev)

### Setup
```bash
# 1. Clone and setup
git clone [REPO_URL] wildlife-watcher-mobile-app
cd wildlife-watcher-mobile-app
git checkout dev-mvp2-development

# 2. Install dependencies
# On Windows:
npm install --ignore-scripts
# On macOS/Linux:
npm install

# 3. Start development server
npx expo start
```

---

## Get App on Device (All Platforms)

### Option A: Pre-built Development Build (Fastest)
1. Download APK: https://expo.dev/accounts/apps_wildlife/projects/wildlife-watcher-expo/builds/12fa61c8-cf82-47c5-a8b1-f92fea0a04ca
2. Install on Android device
3. Connect to development server via QR code

### Option B: Build Your Own
```bash
# Login (native or Docker container)
eas login

# Build development client
eas build --platform android --profile development
# Wait ~15 minutes, install APK
```

### Option C: Expo Go (Limited - No BLE)
- Install Expo Go app
- Scan QR code from `npx expo start` (native) or inside Docker container
- Note: BLE functionality disabled in Expo Go

## Key Tech Stack Notes

- **React Native 0.81.5** + **Expo SDK 54**
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
npx expo start        # Start dev server (use npx for new CLI)
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

### For Docker Setup
```bash
# Restart container
docker-compose -f docker-compose.dev.yml restart wildlife-watcher-dev

# Rebuild container (if environment issues)
docker-compose -f docker-compose.dev.yml build wildlife-watcher-dev

# Clear cache (inside container)
npx expo start --clear
```

### For Native Setup
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

### Universal Fixes
```bash
# Network issues (any setup)
npx expo start --tunnel

# Port conflicts (change port)
npx expo start --port 8082
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

## Setup Decision Matrix

| Scenario | Recommended Approach | Why |
|----------|---------------------|-----|
| **Team Development** | 🐳 Docker | Identical environments, 5-min setup |
| **Windows (avoiding WSL2)** | 🐳 Docker | Simpler than WSL2, no compatibility issues |
| **Multiple RN Projects** | 🐳 Docker | Isolated tool versions per project |
| **Solo Development** | 💻 Native | Best performance, direct system access |
| **iOS Development** | 💻 Native on macOS | Xcode requires macOS regardless |
| **Performance Critical** | 💻 Native | No container overhead |
| **Linux Distributions** | Either | Both work well, Docker for consistency |

## Ready to Code! 🚀

### ✅ Verification Checklist (Any Setup)
- [ ] App running on device with full BLE support
- [ ] Hot reload working (changes appear automatically)
- [ ] Access to all native functionality (scanning works)
- [ ] Debug menu accessible (shake phone)
- [ ] Development server connects reliably

### 🎯 Platform-Specific Success
- [ ] **Docker**: Container starts, exact versions verified
- [ ] **Windows**: No WSL2 issues, ports accessible
- [ ] **macOS**: iOS development tools working (if needed)
- [ ] **Linux**: Package dependencies installed correctly
- [ ] **Android**: ADB recognizes device, APK installs

**Next:** Check `documentation/developer-docs/` for detailed technical docs on BLE, DFU, and system architecture.

---

*Need the full guide? See [Developer-Onboarding-Guide.md](./Developer-Onboarding-Guide.md)  
Docker details? See [Docker-Development-Guide.md](./Docker-Development-Guide.md)*