# Wildlife Watcher Mobile App - Developer Onboarding Guide

## Welcome to Wildlife Watcher Development! 🦎📱

This guide will help you get the Wildlife Watcher mobile app running on your development machine and phone, even if you've never worked with React Native, Expo, or EAS before. We'll walk through everything step-by-step with verification checkpoints along the way.

## Table of Contents

1. [What You're Building](#what-youre-building)
2. [Prerequisites](#prerequisites)
3. [Development Environment Setup](#development-environment-setup)
4. [Project Setup](#project-setup)
5. [Running the App](#running-the-app)
6. [Installing on Your Phone](#installing-on-your-phone)
7. [Verification & Testing](#verification--testing)
8. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
9. [Next Steps](#next-steps)

## What You're Building

The Wildlife Watcher app is a React Native application that:
- Connects to wildlife camera devices via Bluetooth Low Energy (BLE)
- Updates device firmware and (future) AI models
- Manages wildlife monitoring deployments
- Uses maps for device location tracking

**Technology Stack:**
- **React Native 0.81.5**: Cross-platform mobile framework
- **Expo SDK 54**: Development and build platform
- **TypeScript**: Type-safe JavaScript
- **Redux Toolkit**: State management
- **React Navigation**: Navigation system
- **React Native Paper**: UI components

## Prerequisites

### System Requirements

#### For Docker Setup (Recommended)
**Windows:**
- Windows 10/11 with Docker Desktop
- At least 8GB RAM, 20GB free disk space
- No WSL2 setup required!

**macOS:**
- macOS 12.0+ (Monterey or later) with Docker Desktop
- At least 8GB RAM, 20GB free disk space

**Linux:**
- Any modern distribution with Docker Engine + Docker Compose
- At least 8GB RAM, 20GB free disk space

#### For Native Setup
**Windows:**
- Windows 10/11 with WSL2 (Windows Subsystem for Linux)
- At least 8GB RAM, 20GB free disk space

**macOS:**
- macOS 12.0+ (Monterey or later)
- At least 8GB RAM, 20GB free disk space

**Linux:**
- Any modern distribution (Ubuntu, Fedora, Arch, etc.)
- At least 8GB RAM, 20GB free disk space

#### Mobile Devices
**Android Phone:**
- Android 12+ recommended
- USB debugging enabled (we'll cover this)

**iOS Phone (Optional - requires macOS):**
- iOS 15+ recommended
- Apple Developer account for device installation
- **Note**: iOS development requires macOS even with Docker

### Required Accounts

1. **Expo Account** (Free)
   - Sign up at [expo.dev](https://expo.dev)
   - We'll use this for building and distributing the app

2. **Git/GitHub Access**
   - Access to the Wildlife Watcher repository

## Development Environment Setup

### Choose Your Setup Method

You have two main options for setting up your development environment:

#### 🐳 **Option 1: Docker (Recommended for Teams)**
- **Pros**: Identical environment across all platforms, 5-minute setup, no tool conflicts
- **Cons**: Slight performance overhead, requires Docker knowledge
- **Best for**: Teams, multiple projects, avoiding system pollution
- **Supports**: Windows, macOS, Linux (iOS builds still require macOS)

#### 💻 **Option 2: Native Installation** 
- **Pros**: Best performance, direct system integration
- **Cons**: Platform differences, potential version conflicts, longer setup
- **Best for**: Solo developers, performance-critical work, iOS development
- **Supports**: Windows (WSL2), macOS, Linux

**👥 For teams**: We strongly recommend **Docker** to ensure everyone has identical environments.  
**🏗️ For iOS development**: You'll need **macOS** regardless of Docker usage.

---

### 🐳 Docker Setup (All Platforms)

If you choose Docker, skip to the [Docker Development Guide](./Docker-Development-Guide.md) for complete setup instructions.

**Quick Docker Start:**
```bash
# Install Docker Desktop (Windows/macOS) or Docker Engine (Linux)
# Then:
git clone [REPO_URL] wildlife-watcher-mobile-app
cd wildlife-watcher-mobile-app
git checkout dev-mvp2-development
docker-compose -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.dev.yml exec wildlife-watcher-dev bash
# Inside container:
npm install --ignore-scripts
npx expo start
```

**✅ CHECKPOINT DOCKER:** Environment ready in 5 minutes with exact tool versions.

---

### 💻 Native Installation Setup

If you prefer native installation, continue with the platform-specific instructions below:

### Step 1: Install Node.js

Node.js is the JavaScript runtime that powers our development tools.

**Check if you have Node.js:**
```bash
node --version
```

**If you don't have Node.js (or have version < 20.19.4):**

**Windows (WSL2):**
```bash
# Install Node Version Manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install Node.js 20.19.4 (exact version used by project maintainer)
nvm install 20.19.4
nvm use 20.19.4
```

**macOS:**
```bash
# Using Node Version Manager (recommended for version matching)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.zshrc
nvm install 20.19.4
nvm use 20.19.4

# Or using Homebrew (may be slightly different version)
brew install node
```

**Linux:**
```bash
# Using Node Version Manager (recommended for version matching)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20.19.4
nvm use 20.19.4

# Or using package manager (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or using package manager (Fedora/RHEL)
sudo dnf install nodejs npm

# Or using package manager (Arch Linux)
sudo pacman -S nodejs npm
```

**✅ CHECKPOINT 1:** Verify Node.js installation
```bash
node --version    # Should show v20.19.4 (or v20.x.x)
npm --version     # Should show 10.8.2 (or 10.x.x)
```

### Step 2: Install Development Tools

**Install Git (if not already installed):**
```bash
# Windows (WSL2)
sudo apt update && sudo apt install git

# macOS
brew install git

# Linux (Ubuntu/Debian)
sudo apt update && sudo apt install git

# Linux (Fedora/RHEL)
sudo dnf install git

# Linux (Arch Linux)
sudo pacman -S git
```

**Install Expo CLI and EAS CLI:**
```bash
# Install exact versions used by project maintainer
npx expo --version # Verify SDK 54
npm install -g eas-cli@latest

# Verify installation
npx @expo/cli --version  # Use npx for new Expo CLI
eas --version
```

**✅ CHECKPOINT 2:** Verify CLI installation
```bash
npx @expo/cli --version    # Should show 0.18.31
eas --version              # Should show eas-cli/16.17.3
```

**⚠️ Note:** If you see a warning about legacy expo-cli when running `expo --version`, that's expected. Always use `npx @expo/cli` for the new CLI.

### Step 3: Set Up Your Phone for Development

#### Android Setup

1. **Enable Developer Options:**
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times until you see "You are now a developer"

2. **Enable USB Debugging:**
   - Go to Settings → Developer Options
   - Enable "USB Debugging"
   - Enable "Install via USB" (if available)

3. **Connect Your Phone:**
   - Connect via USB cable
   - Allow USB debugging when prompted
   - Choose "File Transfer" or "MTP" mode

4. **Install ADB (Android Debug Bridge):**
   
   **Windows (WSL2):**
   ```bash
   sudo apt update
   sudo apt install android-tools-adb
   ```
   
   **macOS:**
   ```bash
   brew install android-platform-tools
   ```

   **Linux (Ubuntu/Debian):**
   ```bash
   sudo apt update
   sudo apt install android-tools-adb android-tools-fastboot
   ```

   **Linux (Fedora/RHEL):**
   ```bash
   sudo dnf install android-tools
   ```

   **Linux (Arch Linux):**
   ```bash
   sudo pacman -S android-tools
   ```

**✅ CHECKPOINT 3:** Verify Android connection
```bash
adb devices
# Should show your device listed (not "unauthorized")
```

#### iOS Setup (Optional)

1. **Install Xcode** (macOS only):
   - Download from Mac App Store
   - Install Xcode Command Line Tools: `xcode-select --install`

2. **Device Setup:**
   - Connect iPhone via USB
   - Trust your computer when prompted
   - Enable "Developer Mode" in Settings → Privacy & Security (iOS 16+)

## Project Setup

### Step 1: Clone the Repository

```bash
# Navigate to your development folder
cd ~/Development  # or wherever you keep projects

# Clone the repository
git clone [REPOSITORY_URL] wildlife-watcher-mobile-app
cd wildlife-watcher-mobile-app

# Switch to the expo-migration branch (the latest development branch)
git checkout dev-mvp2-development
```

**✅ CHECKPOINT 4:** Verify repository
```bash
pwd  # Should end with /wildlife-watcher-mobile-app
git branch  # Should show * expo-migration
ls  # Should see package.json, src/, etc.
```

### Step 2: Install Dependencies

```bash
# Install JavaScript dependencies
# On Windows:
npm install --ignore-scripts
# On macOS/Linux:
npm install

# 2b. Sync Database Schema (Pull core logic from backend)
npm run db:sync-schema
```

This will take several minutes the first time. The app has many dependencies including BLE libraries and UI components.

**✅ CHECKPOINT 5:** Verify installation
```bash
# Check if node_modules was created
ls node_modules  # Should show many folders

# Check if lockfile exists
ls package-lock.json  # Should exist

# No error messages during install
```

### Step 3: Environment Configuration

The app uses environment variables for configuration. Check if you need any additional setup:

```bash
# Check for environment files
ls .env* 2>/dev/null || echo "No .env files found (this is okay for development)"

# Check app configuration
cat app.config.js  # Should show Expo configuration
```

## Running the App

### Method 1: Expo Go (Quickest for Testing)

Expo Go is the fastest way to see your app running, but has limitations with native modules like BLE.

1. **Install Expo Go on your phone:**
   - Android: [Play Store - Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - iOS: [App Store - Expo Go](https://apps.apple.com/app/expo-go/id982107779)

2. **Start the development server:**
   ```bash
   npx expo start
   ```

3. **Connect your phone:**
   - Scan the QR code with your phone's camera (iOS) or Expo Go app (Android)
   - The app will load on your phone

**⚠️ Note:** BLE functionality won't work in Expo Go due to native module limitations.

**✅ CHECKPOINT 6:** App loads in Expo Go
- App opens on your phone
- You can navigate between screens
- No major error messages (BLE errors are expected)

### Method 2: Development Build (Full Functionality)

For full BLE functionality, you need a development build. We have a pre-built version available!

## Installing on Your Phone

### Option A: Use Pre-built Development Build (Recommended)

We have a development build ready for Android:

1. **Download the build:**
   - Visit: https://expo.dev/accounts/apps_wildlife/projects/wildlife-watcher-expo/builds/12fa61c8-cf82-47c5-a8b1-f92fea0a04ca
   - Download the `.apk` file to your phone

2. **Install on Android:**
   - Open the downloaded `.apk` file
   - Allow installation from unknown sources if prompted
   - Install the app

3. **Connect to development server:**
   ```bash
   # Start the development server
   npx expo start

   # In the Expo CLI, press 'd' to open development menu
   # Or scan QR code from the development build
   ```

**✅ CHECKPOINT 7:** Development build working
- App installs successfully
- App connects to development server
- BLE scanning works (you'll see scanning interface)

### Option B: Build Your Own Development Build

If you want to build your own version:

1. **Login to Expo:**
   ```bash
   eas login
   # Enter your Expo account credentials
   ```

2. **Configure the build:**
   ```bash
   # Generate/update build configuration
   eas build:configure
   ```

3. **Build for Android:**
   ```bash
   # Build development version for Android
   eas build --platform android --profile development
   ```

4. **Wait for build:**
   - This takes 10-15 minutes
   - You'll get a URL to download the APK
   - Install as described in Option A

**✅ CHECKPOINT 8:** Custom build working
- Build completes successfully
- APK installs on your device
- App connects to development server

## Verification & Testing

### Basic Functionality Test

1. **App Launch:**
   - App opens without crashing
   - You see the main interface

2. **Navigation Test:**
   - Bottom tabs work (Home, Devices, Maps, Settings)
   - You can navigate between screens

3. **BLE Test (Development Build Only):**
   - Go to Devices tab
   - Tap scan button
   - Should see "Scanning..." indicator
   - No crash (devices won't appear without real Wildlife Watcher hardware)

4. **Maps Test:**
   - Navigate to Maps tab
   - Map should load (requires internet)
   - No error messages

### Development Workflow Test

1. **Hot Reload Test:**
   ```bash
   # Make a small change to a file
   echo "// Test change" >> src/App.tsx
   
   # Save the file - app should reload automatically on your phone
   ```

2. **Debug Menu:**
   - Shake your phone or press Cmd+D (iOS) / Ctrl+M (Android)
   - Should see debug menu with options
   - Try "Reload" option

**✅ CHECKPOINT 9:** Development workflow
- Changes appear on phone automatically
- Debug menu accessible
- No connection issues between computer and phone

## Common Issues & Troubleshooting

### Issue: "Metro bundler won't start"

```bash
# Clear Metro cache
npx expo start --clear

# If that doesn't work, clear npm cache
npx expo start --reset-cache
```

### Issue: "Phone won't connect to development server"

1. **Ensure same network:**
   - Computer and phone on same WiFi network
   - No VPN running

2. **Check firewall:**
   ```bash
   # Temporarily disable firewall (Windows)
   # Or allow port 8081 through firewall
   ```

3. **Try tunnel mode:**
   ```bash
   npx expo start --tunnel
   ```

### Issue: "ADB device unauthorized"

```bash
# Revoke and re-grant USB debugging
adb kill-server
adb start-server
adb devices

# Re-allow USB debugging on phone when prompted
```

### Issue: "Build fails with dependency errors"

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# For iOS issues (macOS only)
cd ios && pod install --repo-update && cd ..
```

### Issue: "BLE not working"

- ✅ Make sure you're using development build (not Expo Go)
- ✅ Check phone has Bluetooth enabled
- ✅ Grant location permissions (required for BLE scanning)
- ✅ On Android, enable location services

### Issue: "Expo Go shows error about incompatible SDK"

This is expected! The app uses native modules that aren't supported in Expo Go. Use the development build instead.

## Next Steps

### Congratulations! 🎉

You now have a fully functional Wildlife Watcher development environment. Here's what you can do next:

### 1. Explore the Codebase

```bash
# Key directories to explore
src/                    # Main application code
├── components/         # Reusable UI components
├── navigation/        # Screen navigation setup
├── hooks/             # Custom React hooks (including BLE)
├── providers/         # Context providers
├── redux/             # State management
├── services/          # External service integrations
└── ble/              # Bluetooth Low Energy code

documentation/         # Project documentation
├── developer-docs/    # Technical documentation
└── ...
```

### 2. Understanding the Architecture

Read these documents to understand the app better:
- `documentation/developer-docs/README.md` - Project overview
- `documentation/developer-docs/BLE-DFU-Technical-Analysis.md` - BLE system details
- `CLAUDE.md` - Development guidelines and conventions

### 3. Common Development Tasks

**Making Changes:**
```bash
# Always work on feature branches
git checkout -b feature/your-feature-name

# Make your changes
# Test on device
# Commit and push
git add .
git commit -m "Your change description"
git push origin feature/your-feature-name
```

**Running Tests:**
```bash
npm test        # Run Jest tests
npm run lint    # Check code style
```

**Building for Distribution:**
```bash
# Production build for Android
eas build --platform android --profile production

# Production build for iOS (requires Apple Developer account)
eas build --platform ios --profile production
```

### 4. Development Best Practices

1. **Use TypeScript:** The project is fully typed - maintain type safety
2. **Follow Existing Patterns:** Look at existing components before creating new ones
3. **Test on Real Device:** BLE functionality requires physical device testing
4. **Read the Docs:** Check documentation before asking questions

### 5. Getting Help

- **Project Documentation:** Check `documentation/` folder first
- **Expo Documentation:** [docs.expo.dev](https://docs.expo.dev)
- **React Native Docs:** [reactnative.dev](https://reactnative.dev)
- **Team Communication:** Ask in team channels for project-specific help

## Final Verification Checklist

Before you start developing, make sure all these work:

### For Docker Setup:
- [ ] ✅ Docker Desktop/Engine installed and running
- [ ] ✅ Container starts and connects successfully
- [ ] ✅ Exact tool versions verified (Node 20.19.4, Expo CLI 0.18.31, EAS CLI 16.17.3)
- [ ] ✅ Development server starts (`npx expo start`)
- [ ] ✅ Hot reload works between container and phone

### For Native Setup:
- [ ] ✅ Node.js 20.19.4+ installed
- [ ] ✅ Expo CLI 0.18.31 and EAS CLI 16.17.3 installed
- [ ] ✅ Project cloned and dependencies installed
- [ ] ✅ Development server starts (`npx expo start`)

### For All Setups:
- [ ] ✅ Phone can connect to development server
- [ ] ✅ Development build installed and working
- [ ] ✅ BLE scanning works (shows scanning interface)
- [ ] ✅ Hot reload works (changes appear automatically)
- [ ] ✅ Debug menu accessible on phone
- [ ] ✅ Can navigate all app screens
- [ ] ✅ Maps load correctly
- [ ] ✅ No major error messages or crashes

### Platform-Specific:
- [ ] ✅ **iOS (macOS only)**: Xcode installed and device connected
- [ ] ✅ **Android (All platforms)**: ADB recognizes device
- [ ] ✅ **Linux**: Package manager dependencies installed correctly

## Welcome to the Team! 🚀

You're now ready to contribute to the Wildlife Watcher project! The app helps protect wildlife through advanced monitoring technology, and your work directly contributes to conservation efforts around the world.

**Happy coding!** 🦎📱✨

---

*Need help? Check the troubleshooting section above or reach out to the team. Remember: every expert was once a beginner!*