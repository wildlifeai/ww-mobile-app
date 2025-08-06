# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Running the App
- `npx expo start` - Start Expo development server
- `npx expo run:android` - Build and run on Android device/emulator
- `npx expo run:ios` - Build and run on iOS device/simulator (when iOS support added)

### Development Commands
- `npm start` - Start Expo development server (alias for `npx expo start`)
- `npm run android` - Build and run on Android (alias for `npx expo run:android`)
- `npm run ios` - Build and run on iOS (alias for `npx expo run:ios`)
- `npm install` - Install project dependencies
- `npx expo install` - Install Expo SDK compatible packages
- `npx expo prebuild` - Generate native directories (if needed)
- `eas build` - Build app using EAS Build service
- `npm run validate:deps` - Validate dependency compatibility
- `npm run deps` - Interactive dependency management CLI
- `npm run deps:scan` - Scan for dependency issues
- `npm run supabase:types` - Sync Supabase types (manual process, see src/types/supabase.ts)

### Testing and Quality
- `npm test` - Run Jest tests
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Environment Requirements
- **Node.js**: Version 18+ (as specified in package.json engines)
- **Expo CLI**: For development and local builds
- **EAS CLI**: For cloud builds and deployments
- **Android Studio**: For Android development and device connections

## Architecture Overview

### Tech Stack
- **Framework**: Expo SDK 51 with React Native 0.74.6
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Navigation**: React Navigation 6 with native stack navigator
- **State Management**: Redux Toolkit with Supabase integration
- **Offline Storage**: Expo SQLite with sync queues
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

**Key Providers:**
- **AuthProvider**: Supabase authentication state management
- **BleEngineProvider**: Core BLE functionality and device management
- **AndroidPermissionsProvider**: Runtime permissions management
- **AppSetupProvider**: App initialization and configuration
- **ListenToBleEngineProvider**: BLE event handling and device communication

#### Key Architectural Components

**State Management**: 
- Redux store configured in `src/redux/index.ts` with slices for devices, authentication, BLE status, location, deployments, and projects
- Supabase client for API calls and real-time subscriptions in `src/services/supabase/`
- Offline service for local SQLite storage and sync queues in `src/services/offline/`

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
- Always provide full updated answers when making changes
- Use existing codebase as reference rather than creating new patterns
- Follow latest TypeScript best practices

### Dependency Management
This project includes custom dependency validation and management tools:
- `npm run validate:deps` - Automatically runs after install to check compatibility
- `npm run deps` - Interactive CLI for dependency management
- `npm run deps:scan` - Scan for potential dependency conflicts
- Located in: `scripts/validate-deps.js` and `scripts/deps-cli.js`

### BLE Development
- Device connections are managed through the BleEngineProvider
- Use the `useBleActions` hook to access BLE functionality
- All device communication should go through the established parser system

### State Management
- Use Redux Toolkit slices for local state management
- Use Supabase client for API calls and real-time subscriptions
- Implement offline-first approach with local SQLite and sync queues
- Follow the existing pattern of typed hooks (`useAppDispatch`, `useAppSelector`)
- Always save to local storage first, then queue for remote sync

### Testing
- Tests are located in `__tests__/` directory
- Use Jest with React Native preset
- Test files should follow the `.test.tsx` naming convention

### Key Dependencies to Understand
- **Supabase Client**: `@supabase/supabase-js` for backend integration and real-time features
- **Expo SQLite**: `expo-sqlite` for offline data storage and sync queues
- **BLE Nordic DFU**: Custom GitHub dependency for firmware updates
- **React Native Paper**: Version 5.12.3 for Material Design components
- **Redux Toolkit**: Version 2.2.1 for state management
- **React Navigation**: Version 6 native stack for navigation
- **React Hook Form**: Version 7.54.1 for form handling
- **NetInfo**: `@react-native-community/netinfo` for network status monitoring

### File Structure Conventions
- UI components prefixed with "WW" in `src/components/ui/`
- Redux slices in `src/redux/slices/`
- Supabase services in `src/services/supabase/`
- Offline services in `src/services/offline/`
- Screen components in `src/navigation/screens/`
- Custom hooks in `src/hooks/`
- BLE functionality in `src/ble/` and `src/providers/BleEngineProvider.tsx`
- Database types in `src/types/supabase.ts`

## Development Wisdom

### Debugging and Optimization
- Debug simple first: unused packages (carrying dead weight in package.json) before architecture changes
- Focus on error messages before assumptions 
- The simplest fix is often the right one (Occam's razor!)

# IMPORTANT
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

## Current Implementation Status
✅ **Completed:**
- Expo SDK 51 migration complete
- EAS Build configuration
- Core dependencies migrated (expo-file-system, expo-constants, expo-splash-screen)
- BLE functionality verified with real devices
- Basic Supabase integration started

🚧 **In Progress:**
- MVP2 feature development per implementation spec
- Offline-first data architecture
- Project and deployment management screens

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

## Migration Configuration Snapshot
- Noted the migration configuration snapshot in project-context directory
- Reference file contains details about the Expo migration process and configuration requirements
- Added references for `@EXPO_ENVIRONMENT_VARIABLES.md` and `@migration-config-snapshot.json` for further investigation and documentation tracking

## Available MCP Servers

This project has access to three configured MCP servers:

### 1. Task Master AI (`task-master-ai`)
- **Purpose**: Project task management and workflow automation
- **Key Functions**: 
  - `get_tasks` / `next_task` - Task retrieval and workflow management
  - `set_task_status` - Update task completion status  
  - `expand_task` / `update_task` - Task refinement and detail management
  - `parse_prd` - Generate tasks from Product Requirements Documents
- **Usage**: Handles MVP2 development task breakdown and progress tracking

### 2. Supabase MCP (`supabase`)
- **Purpose**: Database operations and backend integration
- **Key Functions**:
  - `list_tables` / `execute_sql` - Database schema and query operations
  - `apply_migration` - Database schema changes and migrations
  - `get_logs` / `get_advisors` - Debugging and performance monitoring
- **Usage**: Manages wildlife monitoring database operations and Supabase backend integration

### 3. Context7 (`context7`)
- **Purpose**: Up-to-date library documentation and code examples
- **Key Functions**:
  - `resolve-library-id` - Find Context7-compatible library identifiers
  - `get-library-docs` - Fetch current documentation for React Native, Expo, and other libraries
- **Usage**: Provides current documentation for Expo, Supabase, and React Native development

## App Configuration Details

**Current Configuration:**
- **Bundle ID**: `com.wildlife.wildlifewatcher` (iOS/Android)
- **Package Name**: `wildlifewatcher`
- **Expo SDK**: Version 51
- **React Native**: Version 0.74.6
- **Backend**: Supabase with PostgreSQL database

**Bundle Identifier Strategy:**
- Development: `com.wildlife.wildlifewatcher.expo` 
- Production: `com.wildlife.wildlifewatcher`
- Automatically determined by NODE_ENV
- EAS Project ID: `6cf53a5e-90e1-4987-82c6-5f0337affe97`

## Supabase Integration Guidelines

### Database Schema
- Uses Row Level Security (RLS) for data isolation
- Project-based multi-tenancy model
- Offline-first with sync conflict resolution

#### Type Management
- Supabase types are manually synced from backend repository
- Located in: `src/types/supabase.ts`
- Run `npm run supabase:types` for sync instructions
- Backend repo: `~/dev/wildlifeai/wildlife-watcher-backend`

### Development Patterns
- Always save to local SQLite first
- Queue operations when offline
- Use Supabase client for real-time subscriptions
- Handle auth state changes through Redux

## Offline-First Development

### Core Principle
All user actions must work offline and sync when connectivity is restored.

### Implementation Pattern
1. Save to local SQLite immediately
2. Update Redux store
3. Queue for remote sync
4. Attempt immediate sync if online
5. Handle conflicts on reconnection

### Conflict Resolution
- Last-write-wins for most fields
- Deployment status: ended status always wins
- Project members: merge strategy (union of both lists)

## Documentation Directories
- `@documentation/developer-docs/` contains documentation for developers and should be maintained as we develop this codebase

### Backend and Repository Configuration

#### Supabase Backend

##### git repo
- The new Supabase backend is in a git repo locally in folder `~/dev/wildlifeai/wildlife-watcher-backend`
- The `supabase` subfolder in the backend repository contains the Supabase database configuration

##### database/backend project-context documents location
Documents on the Supabase backend can be found in the @project-context/development-context/supabase-backend folder.

**Note**: The README.md contains outdated React Native CLI instructions. Follow the commands in this CLAUDE.md file for current Expo-based workflow.


### App MVP2 Documents
Documents relating to the final state for this app for MVP2 are located in folder `@project-context/development-context/MVP2`.

### Development Priorities
Focus development on MVP2 features as specified in the implementation spec:
1. **Authentication & User Management** - Supabase Auth integration
2. **Project Management** - Create, manage, and share wildlife monitoring projects
3. **Deployment Workflows** - Start/end deployment flows with offline support
4. **Device Management** - BLE scanning, connection, and firmware updates
5. **Maps Integration** - Location-based deployment tracking
6. **Offline Support** - Local SQLite with background sync