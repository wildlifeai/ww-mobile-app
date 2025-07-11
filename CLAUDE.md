# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wildlife Watcher is a React Native mobile application that enables users to communicate with Wildlife Watcher cameras via Bluetooth Low Energy (BLE). The cameras record animals and use AI to identify them. The app serves as a configuration and management interface for these wildlife monitoring devices.

## Development Commands

### Core Commands
- `npm install` - Install dependencies
- `npm start` - Start Metro bundler
- `npm run android` - Run on Android device/emulator
- `npm run ios` - Run on iOS device/simulator
- `npm run lint` - Run ESLint
- `npm test` - Run Jest tests
- `npm run pod-install` - Install iOS CocoaPods dependencies

### iOS Setup
- `gem install bundler && bundle install` - Install Ruby gems
- `bundle exec pod install --project-directory=ios` - Install iOS pods

### Build Commands
- Building is automated via GitHub Actions
- Manual builds use fastlane (see `fastlane/Fastfile`)

## Architecture Overview

### State Management
- **Redux Toolkit** with RTK Query for API state management
- Store configured in `src/redux/index.ts` with slices for:
  - `devices` - BLE device management
  - `configuration` - Device configuration state
  - `bleLibrary` - BLE library initialization
  - `authentication` - User authentication (currently disabled)
  - `scanning` - BLE scanning state
  - API endpoints organized in `src/redux/api/`

### BLE Communication
- **Core BLE Logic**: `src/hooks/useBle.ts` - Main BLE operations
- **Device Communication**: `src/hooks/useCommand.tsx` - Command interface
- **Protocol**: `src/ble/parser.ts` and `src/ble/types.ts` - Command parsing and types
- **Device Management**: Wildlife Watcher devices communicate via custom BLE protocol with specific command structure

### Navigation Structure
- **Main Navigation**: `src/navigation/index.tsx` - Stack navigator with conditional rendering
- **Route Types**: `RootStackParamList` interface defines all navigation parameters
- **Conditional Navigation**: App shows different screens based on:
  - Bluetooth status (`BluetoothProblems`)
  - Location permissions (`LocationProblems`) 
  - BLE library initialization (`BleProblems`)
  - Authentication status (currently disabled)

### Provider Architecture
The app uses a nested provider structure in `src/App.tsx`:
- `AndroidPermissionsProvider` - Handles Android permissions
- `AppSetupProvider` - App initialization
- `BleEngineProvider` - BLE engine setup
- `ListenToBleEngineProvider` - BLE event listeners
- `AuthProvider` - Authentication (currently disabled)
- `DeviceReconnectProvider` - Device reconnection logic (device-specific)

### Key Features
- **Device Configuration**: Terminal-style interface (`src/navigation/screens/TerminalScreen.tsx`)
- **Firmware Updates**: DFU (Device Firmware Update) support
- **Project Management**: Create and manage wildlife monitoring projects
- **Deployment Tracking**: Track device deployments in field
- **Maps Integration**: React Native Maps for location features

### Component Structure
- **UI Components**: `src/components/ui/` - Reusable WW-prefixed components
- **Form Components**: `src/components/form/` - Form utilities
- **Navigation Components**: Custom navigation bar and drawer

### Services
- **DFU Service**: `src/services/DfuService.ts` - Device firmware update functionality
- **API Services**: `src/redux/api/` - REST API integration for backend services

## Code Style Guidelines

From `.cursorrules`:
- Use existing codebase as reference
- Use TypeScript best practices
- Prefer types over interfaces
- Always provide full updated answers

## Platform-Specific Notes

### Android
- Uses `react-native-ble-manager` for BLE communication
- Requires location permissions for BLE scanning
- Firebase integration for app distribution

### iOS
- Minimum deployment target: iOS 14.0
- Uses CocoaPods for dependency management
- Firebase integration for app distribution
- Static frameworks configuration for React Native Maps

## Testing
- Jest configuration in `jest.config.js`
- Test files should follow `__tests__/` directory structure
- Run tests with `npm test`