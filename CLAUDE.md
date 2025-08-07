# CLAUDE.md

## Wildlife Watcher Mobile App

The Wildlife Watcher mobile app is a sophisticated React Native application designed to revolutionize wildlife conservation field work. It connects researchers and conservationists to wildlife monitoring camera devices via Bluetooth Low Energy (BLE), enabling remote configuration, firmware updates, and real-time wildlife data collection.

### What This App Does
- **Device Management**: Scan, connect, and configure wildlife camera devices using BLE
- **Firmware Updates**: Over-the-air firmware updates using Nordic DFU protocol
- **Project Management**: Create and manage wildlife monitoring projects with team collaboration
- **Field Deployments**: GPS-tracked deployment workflows optimized for offline field conditions  
- **Maps Integration**: Visualize device deployments and wildlife data on interactive maps
- **Real-time Monitoring**: Track device status, battery levels, and wildlife detections
- **Data Collection**: Capture and synchronize wildlife observations and media files

### Expo Development Client Architecture (NOT Expo Go)

This app **REQUIRES development client builds** due to native modules and **CANNOT run on Expo Go**:

**Critical Native Dependencies:**
- **react-native-ble-manager**: Native Android/iOS Bluetooth APIs
- **react-native-nordic-dfu**: Custom GitHub fork for firmware updates
- **react-native-maps**: Native Google Maps/MapKit SDKs
- **Wildlife camera communication protocols**: Custom BLE implementations

**⚠️ IMPORTANT**: Always use `npx expo run:android` or `npx expo run:ios` - Expo Go will fail to load this app.

**EAS Build System:**
- **EAS CLI** handles both development and production builds for Android/iOS
- **Cloud Building**: No need for local Xcode/Android Studio for builds
- **Automated Workflows**: Focus on app development, not build configuration
- **Development Builds**: Install once on device, then use hot reload for development
- **Production Builds**: Automated release builds with code signing and distribution

**Developer Experience Benefits:**
- **Simplified Setup**: No complex native toolchain configuration
- **Fast Iteration**: Hot reload with native capabilities intact
- **Team Consistency**: Same build environment for all developers
- **Automated Updates**: OTA updates for JavaScript changes
- **Platform Optimization**: Expo handles platform-specific optimizations

This approach allows developers to focus on wildlife monitoring features rather than React Native build complexities while maintaining full access to native device capabilities essential for field research applications.

## Essential Quick Reference

### Common Development Commands
- `npx expo start` or `npx expo start --dev-client --clear` - Start Expo development server
- `npx expo run:android` - Build and run on Android device/emulator
- `npm test` - Run all Jest tests (unit + integration)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:e2e` - Run end-to-end tests with Detox
- `npm run test:e2e:build` - Build app for E2E testing
- `npm run test:e2e:ios` - Run E2E tests on iOS simulator
- `npm run test:e2e:android` - Run E2E tests on Android emulator
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run validate:deps` - Validate dependency compatibility
- `npm run deps` - Interactive dependency management CLI
- `npm run deps:add` - Add dependencies with compatibility check
- `npm run deps:scan` - Scan for potential conflicts
- `npm run supabase:types` - Sync Supabase types (manual process, see src/types/supabase.ts)

### Environment Requirements
- **Node.js**: Version 18+ (as specified in package.json engines)
- **Expo CLI**: For development and local builds
- **EAS CLI**: For cloud builds and deployments
- **Android Studio**: For Android development and device connections

### Tech Stack Summary
- **Framework**: Expo SDK 51 with React Native 0.74.6
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Navigation**: React Navigation 6 with native stack navigator
- **State Management**: Redux Toolkit with Supabase integration
- **Offline Storage**: Expo SQLite with sync queues
- **UI Library**: React Native Paper with custom theming
- **BLE Communication**: react-native-ble-manager for device connectivity
- **Testing**: Jest + React Native Testing Library + Detox + Custom BDD helpers

## Code Standards & Conventions

### From .cursorrules
- Always provide full updated answers when making changes
- Use existing codebase as reference rather than creating new patterns
- Prefer `type` over `interface` (TypeScript best practice)
- Follow latest TypeScript best practices

### Project Conventions
- Use existing UI components (WW-prefixed) for consistency
- Follow the established provider pattern for new features
- Implement proper TypeScript typing throughout

## Critical Provider Hierarchy

The app uses a specific nested provider pattern that **must be maintained**:

```
SafeAreaProvider → ReduxProvider → PaperProvider → NavigationContainer
→ AndroidPermissionsProvider → AppSetupProvider → BleEngineProvider
→ ListenToBleEngineProvider → AuthProvider → MainNavigation
```

**Order is critical** - changing provider order can break BLE functionality, permissions, or authentication.

## MVP2 Development Context
This app is being developed according to the MVP2 implementation specification focusing on:
- **Offline-first architecture** with Supabase sync
- **Field deployment workflows** for wildlife cameras
- **Project-based data organization** with role-based access
- **Real-time device status** via LoRaWAN integration
- **Mobile-optimized UI** following Figma designs

Key Documents:
- `@project-context/development-context/MVP2/wildlife-watcher-implementation-spec-mvp2-consolidated-20250731.md` - Complete implementation spec
- `@project-context/development-context/MVP2/User Stories_ Navigation 2.0-Figma-Design-med.pdf` - UI/UX designs
- `@project-context/development-context/supabase-backend/` - Backend documentation

## Implementation Status
✅ **Completed:**
- Expo SDK 51 migration complete
- EAS Build configuration
- Core dependencies migrated (expo-file-system, expo-constants, expo-splash-screen)
- BLE functionality verified with real devices
- Supabase integration complete and production-ready (authentication, database operations, real-time subscriptions)
- Comprehensive authentication system with deep linking
- Complete testing infrastructure (unit, integration, E2E, BDD)

🚧 **In Progress:**
- MVP2 feature development per implementation spec
- Offline-first data architecture implementation
- Project and deployment management screens

## Critical Development Notes

### Authentication & Deep Linking
- **Testing Environment**: Authentication flows MUST be tested with development builds (`npx expo run:android`), NOT Expo Go
- **URL Scheme**: `wildlifewatcher://` for deep linking
- **Navigation Pattern**: Use conditional rendering based on auth state, not programmatic navigation
- **Supabase Config**: Mobile apps need `detectSessionInUrl: false` in Supabase client config

### BLE Development
- Device connections are managed through the BleEngineProvider
- Use the `useBleActions` hook to access BLE functionality
- All device communication should go through the established parser system

### Offline-First Development
All user actions must work offline and sync when connectivity is restored:
1. Save to local SQLite immediately
2. Update Redux store
3. Queue for remote sync
4. Attempt immediate sync if online
5. Handle conflicts on reconnection

## App Configuration
- **Bundle ID**: `com.wildlife.wildlifewatcher` (iOS/Android)
- **Package Name**: `wildlifewatcher`
- **Expo SDK**: Version 51
- **React Native**: Version 0.74.6
- **Backend**: Supabase with PostgreSQL database
- **EAS Project ID**: `6cf53a5e-90e1-4987-82c6-5f0337affe97`

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

## Available MCP Servers

This project has access to three configured MCP servers:

### 1. Task Master AI (`task-master-ai`)
- **Purpose**: Project task management and workflow automation
- **Usage**: Handles MVP2 development task breakdown and progress tracking

### 2. Supabase MCP (`supabase`)
- **Purpose**: Database operations and backend integration
- **Usage**: Manages wildlife monitoring database operations and Supabase backend integration

### 3. Context7 (`context7`)
- **Purpose**: Up-to-date library documentation and code examples
- **Usage**: Provides current documentation for Expo, Supabase, and React Native development

## Documentation Architecture

### Technical Implementation Guides
Comprehensive technical guides for developers working on the codebase:

- **Application Architecture**: `@documentation/app-technical-guides/App-Architecture-Guide.md` - Complete app architecture, provider hierarchy, BLE system, navigation structure, Redux state management, and component patterns
- **Authentication System**: `@documentation/app-technical-guides/Authentication-Implementation-Guide.md` - Supabase authentication integration, deep linking, session management, and security patterns
- **Testing Framework**: `@documentation/app-technical-guides/Testing-Guide.md` - Complete testing infrastructure including unit, integration, E2E, and BDD testing patterns with examples
- **Backend Integration**: `@documentation/app-technical-guides/Supabase-Integration-Guide.md` - Supabase client setup, database operations, real-time subscriptions, and offline sync patterns

### Developer Onboarding
Non-technical onboarding and setup guides:

- **Getting Started**: `@documentation/developer-docs/Developer-Onboarding-Guide.md` - Complete setup guide for new developers
- **Environment Setup**: `@documentation/developer-docs/WSL2-Development-Setup-Guide.md` - WSL2 specific development setup
- **EAS Build System**: `@documentation/developer-docs/EAS-Development-Guide.md` - Expo Application Services build and deployment

### Backend Documentation
- **Backend Repository**: `~/dev/wildlifeai/wildlife-watcher-backend` - Supabase backend project
- **Backend Docs**: `@project-context/development-context/supabase-backend/` - Backend configuration documentation

## Development Workflow

### Testing Requirements
- **Critical Flows**: Always test authentication, BLE connection, and offline sync
- **Testing Environment**: Use development builds, never Expo Go for auth/BLE testing
- **Coverage Target**: >80% test coverage on authentication and core features
- **Testing Approach**: TDD/BDD with Given-When-Then patterns

### BLE Testing Requirements
- **Real devices required**: BLE functionality cannot be fully mocked
- **Development builds only**: Never test BLE with Expo Go
- **Android permissions**: Location and Bluetooth permissions required for BLE scanning
- **Connection management**: Test device connection/disconnection scenarios
- **Provider hierarchy**: BLE functionality depends on correct provider order

### Custom Dependency Management
This project includes automated dependency validation and management:
- `npm run validate:deps` - Automatically runs after install to check compatibility
- `npm run deps` - Interactive dependency management CLI
- `npm run deps:add` - Add dependencies with compatibility check
- `npm run deps:scan` - Scan for potential dependency conflicts
- **Location**: `scripts/validate-deps.js` and `scripts/deps-cli.js`
- **Auto-validation**: Runs on `npm install` via postinstall hook

### Quality Assurance
- Run `npm run lint` and `npm run type-check` after significant changes
- Test on real devices for BLE functionality
- Validate dependency compatibility with `npm run validate:deps`
- Follow existing patterns and conventions

### File Structure Conventions
- UI components prefixed with "WW" in `src/components/ui/`
- Redux slices in `src/redux/slices/`
- Supabase services in `src/services/supabase/`
- Offline services in `src/services/offline/`
- Screen components in `src/navigation/screens/`
- Custom hooks in `src/hooks/`
- BLE functionality in `src/ble/` and `src/providers/BleEngineProvider.tsx`
- Database types in `src/types/supabase.ts`

## Key Dependencies
- **Supabase Client**: `@supabase/supabase-js` for backend integration and real-time features
- **Expo SQLite**: `expo-sqlite` for offline data storage and sync queues
- **BLE Nordic DFU**: Custom GitHub dependency for firmware updates
- **React Native Paper**: Version 5.12.3 for Material Design components
- **Redux Toolkit**: Version 2.2.1 for state management
- **React Navigation**: Version 6 native stack for navigation
- **React Hook Form**: Version 7.54.1 for form handling
- **Testing Stack**: Jest + React Native Testing Library + Detox

---

*For detailed technical implementation information, refer to the comprehensive guides in `@documentation/app-technical-guides/`. For developer onboarding and environment setup, see `@documentation/developer-docs/`.*