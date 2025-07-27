# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.



## Common Development Commands

### Running the App
- `npm start` - Start Metro bundler
- `npm run android` - Run Android app (requires emulator/device)
- `npm run ios` - Run iOS app (requires Xcode/simulator)

### iOS-Specific Setup
- `npm run pod-install` - Install iOS pods (equivalent to `bundle exec pod install --project-directory=./ios/`)
- `bundle install` - Install Ruby gems for iOS dependencies

### Testing and Quality
- `npm test` - Run Jest tests
- `npm run lint` - Run ESLint

## Architecture Overview

### Tech Stack
- **Framework**: React Native 0.74.6
- **Navigation**: React Navigation 6 with native stack navigator
- **State Management**: Redux Toolkit with RTK Query for API calls
- **UI Library**: React Native Paper with custom theming
- **BLE Communication**: react-native-ble-manager for device connectivity
- **Maps**: react-native-maps for location features
- **Development**: TypeScript with strict typing conventions

### Core Application Structure

#### Provider Hierarchy
The app uses a nested provider pattern in `src/App.tsx`:
```
SafeAreaProvider → ReduxProvider → PaperProvider → NavigationContainer
→ AndroidPermissionsProvider → AppSetupProvider → BleEngineProvider
→ ListenToBleEngineProvider → AuthProvider → MainNavigation
```

#### Key Architectural Components

**State Management**: 
- Redux store configured in `src/redux/index.ts` with slices for devices, authentication, BLE status, location, and scanning
- RTK Query API slice for server communication in `src/redux/api/`

**BLE Engine**: 
- Core BLE functionality in `src/hooks/useBle.ts` and `src/providers/BleEngineProvider.tsx`
- Device communication parsing in `src/ble/parser.ts`
- BLE types and interfaces in `src/ble/types.ts`

**Navigation Structure**:
- Main navigation in `src/navigation/index.tsx` with stack navigator
- Bottom tabs for primary screens in `src/navigation/BottomTabs.tsx`
- Screen components in `src/navigation/screens/`

**Custom Components**:
- UI components prefixed with "WW" in `src/components/ui/`
- Form components in `src/components/form/`
- Shared components like navigation and device items in `src/components/`

### Key Features
- **Device Management**: BLE scanning, connecting, and communication with wildlife cameras
- **Authentication**: User login/registration system
- **Project & Deployment Tracking**: Manage wildlife monitoring projects
- **Maps Integration**: Location-based features for device deployment
- **Firmware Updates**: Device Firmware Update (DFU) functionality
- **Real-time Communication**: Terminal-style device interaction

## Development Guidelines

### Code Conventions
- Prefer `type` over `interface` (as specified in .cursorrules)
- Use existing UI components (WW-prefixed) for consistency
- Follow the established provider pattern for new features
- Implement proper TypeScript typing throughout

### BLE Development
- Device connections are managed through the BleEngineProvider
- Use the `useBleActions` hook to access BLE functionality
- All device communication should go through the established parser system

### State Management
- Use Redux Toolkit slices for local state
- Use RTK Query for API calls in `src/redux/api/`
- Follow the existing pattern of typed hooks (`useAppDispatch`, `useAppSelector`)

### Testing
- Tests are located in `__tests__/` directory
- Use Jest with React Native preset
- Test files should follow the `.test.tsx` naming convention

# IMPORTANT
## Migration Context
This codebase is currently undergoing an Expo migration. The `project-context/` directory contains detailed migration documentation and planning files. When working on migration-related tasks, refer to these documents for context and requirements.

Key Document are project-context/ww-app-migration-plan/DOCUMENT-INDEX.md (guide to all documentn in the folder) and @project-context/ww-app-migration-plan/DEVELOPMENT-EXECUTION-PLAN.md   (this is the initial work to be done).
