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

### Development Commands
- `npm install` - Install project dependencies
- `npx react-native start` - Alternative Metro bundler command
- `bundle install` - Install Ruby gems for iOS dependencies
- `gem install bundler` - Install Bundler for iOS development
- `npx expo` - Use npx expo instead of global expo command to avoid Node.js compatibility warnings and ensure Expo SDK 51 compatibility

### Environment Requirements
- **Node.js**: Version 18 or higher (as specified in package.json engines)
- **Ruby**: Version 2.6.10 or higher
- **React Native CLI**: Set up as per [official documentation](https://reactnative.dev/docs/set-up-your-environment)

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
- Always provide full updated answers when making changes
- Use existing codebase as reference rather than creating new patterns
- Follow latest TypeScript best practices

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

### Key Dependencies to Understand
- **BLE Nordic DFU**: Custom GitHub dependency `github:Salt-PepperEngineering/react-native-nordic-dfu` for firmware updates
- **React Native Paper**: Version 5.12.3 for Material Design components
- **Redux Toolkit**: Version 2.2.1 with RTK Query for state management
- **React Navigation**: Version 6 native stack for navigation
- **React Hook Form**: Version 7.54.1 for form handling

### File Structure Conventions
- UI components prefixed with "WW" in `src/components/ui/`
- Redux slices in `src/redux/slices/`
- API definitions in `src/redux/api/`
- Screen components in `src/navigation/screens/`
- Custom hooks in `src/hooks/`
- BLE functionality in `src/ble/` and `src/providers/BleEngineProvider.tsx`

## Development Wisdom

### Debugging and Optimization
- Debug simple first: unused packages (carrying dead weight in package.json) before architecture changes
- Focus on error messages before assumptions 
- The simplest fix is often the right one (Occam's razor!)

# IMPORTANT
## Migration Context
This codebase is currently undergoing an Expo migration. The `project-context/` directory contains detailed migration documentation and planning files. When working on migration-related tasks, refer to these documents for context and requirements.

Key Documents:
- `project-context/ww-app-migration-plan/DOCUMENT-INDEX.md` - Guide to all migration documents
- `project-context/ww-app-migration-plan/DEVELOPMENT-EXECUTION-PLAN.md` - Initial migration work plan
- `migration-config-snapshot.json` - Comprehensive pre-migration configuration snapshot including bundle IDs, environment variables, CI/CD setup, and current dependencies
- Migration involves transitioning from bare React Native to Expo SDK 51
- Critical dependencies to migrate: BLE, Nordic DFU, Maps, File System, Redux

### Migration Phases
1. **Phase 1 (Critical)**: Expo SDK 51 migration for core functionality (5-6 hours)
2. **Phase 2 (Cleanup)**: Remove legacy dependencies, security fixes, Supabase foundation (4-6 hours)
3. **Phase 3 (MVP Dev)**: Complete MVP features with Supabase backend (2-3 weeks)

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
- **Usage**: Handles the Expo migration task breakdown and progress tracking

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
- **Usage**: Provides current documentation during Expo migration for dependency updates

## App Configuration Details

From `migration-config-snapshot.json`:
- **Bundle ID**: `com.wildlife.wildlifewatcher` (iOS/Android)
- **Package Name**: `wildlifewatcher`
- **URL Schemes**: `com.wildlife.auth`, `com.wildlife.watcher`
- **Current Version**: React Native 0.74.6 → Migrating to Expo SDK 51

## Backup Configuration

### Migration Backup Files
- Backup files stored in `@migration-backups/` directory
- Specific backups for important configuration files:
  - `@package.json.backup`
  - `@package-lock.json.backup`
  - Backups created for Task Master task 1.5

## Development Migration Workflow Reminders
- Always remind yourself before starting a task of the plan we are executing per the migration documents @project-context/ww-app-migration-plan/MIGRATION-OVERVIEW.md` , 
 @project-context/ww-app-migration-plan/DEVELOPMENT-EXECUTION-PLAN.md` and @project-context/ww-app-migration-plan/README.md `
- IMPORTANT - Keep track of work done by updating the `@project-context/ww-app-migration-plan/MIGRATION-GUIDE.md` with completed tasks and notes to help reconcile progress and track details of work completed

## Documentation Directories
- `@documentation/developer-docs/` contains documentation for developers and should be maintained as we develop this codebase

## Backend and Repository Configuration

### Supabase Backend

#### git repo
- The new Supabase backend is in a git repo locally in folder `~/dev/wildlifeai/wildlife-watcher-backend`
- The `supabase` subfolder in the backend repository contains the Supabase database configuration

#### project-context document
Document on the SUpabase backend can be found in the @project-context/development-context/supabase-backend folder.