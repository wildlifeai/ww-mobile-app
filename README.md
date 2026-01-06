# Wildlife Watcher Mobile App

Welcome to the development repository of the Wildlife Watcher mobile app. This document provides instructions for setting up and running the project on your local machine.

The Wildlife Watcher mobile app allows users to communicate with Wildlife Watcher cameras that record animals and use AI to identify them. Built with **Expo SDK 54** and **React Native 0.81.5** (New Architecture enabled), using **Supabase** backend integration and an **offline-first architecture**.

**Project Overview**: [Watch on YouTube](https://www.youtube.com/watch?v=Ima3n2EYfeE)

## Tech Stack

- **Framework**: Expo SDK 54 with React Native 0.81.5 (React 19.1.0)
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Local Database**: WatermelonDB for offline-first data persistence
- **State Management**: Redux Toolkit with RTK Query
- **Sync Engine**: Custom bidirectional sync with conflict resolution
- **UI Library**: React Native Paper with Material Design
- **BLE Communication**: react-native-ble-manager for device connectivity
- **Maps**: react-native-maps for location features
- **Development**: TypeScript with strict typing

## Architecture Overview

### Offline-First Design

The app uses an **offline-first architecture** that allows full functionality without internet connectivity:

- **Local Database**: WatermelonDB stores all data locally (projects, deployments, user roles, reference data)
- **Outbox Pattern**: All create/update/delete operations are queued in an outbox for sync
- **Bidirectional Sync**: Changes sync from device → Supabase and Supabase → device
- **Conflict Resolution**: Server-side conflict detection with timestamp-based resolution
- **Network Detection**: Automatic sync when connectivity is restored

### Data Flow

```
User Action → Local DB (WatermelonDB) → Outbox Queue → Supabase (when online)
                                                              ↓
User Interface ← Local DB ← Pull Sync ← Supabase Changes
```

### Key Components

- **`SupabaseSyncService`**: Manages bidirectional sync, outbox upload, and pull changes
- **`OutboxService`**: Records offline operations for later sync
- **`OfflineService`**: Monitors network state and triggers sync
- **`ProjectService`**: Handles project CRUD with automatic outbox queueing
- **RTK Query**: Provides optimistic UI updates with local-first data

## BLE Features

> **Important:** When working with BLE commands, please read the [BLE Architecture Guide](./documentation/ble-architecture-guide.md) to understand our hook-based command system and avoid code duplication.

### Camera Communication

- **Device Discovery**: Scan and connect to Wildlife Watcher cameras via Bluetooth
- **Command System**: Send configuration and control commands to cameras
- **Image Preview**: Capture and download preview images from camera
- **Firmware Updates**: OTA firmware updates via BLE
- **Status Monitoring**: Real-time camera status and battery level

### Image Preview Flow

1. Send `CAPTURE_PREVIEW` command to camera
2. Camera captures image and stores in memory
3. App automatically initiates download
4. Image displays in modal popup
5. User can save or discard preview

## Prerequisites

This app uses **Expo SDK 54** with a managed workflow (prebuild enabled). Ensure you have:

- **Node.js**: Version 20 (LTS) or higher
- **Expo CLI**: `npm install -g expo-cli`
- **EAS CLI**: `npm install -g eas-cli`
- **Android Studio**: Android SDK 35 (Vanilla Ice Cream) & Java 17 (Zulu JDK 17 recommended)
- **Xcode**: macOS only, latest version

> [!WARNING]
> **Windows Users:** You **MUST** clone this project into a short path (e.g., `C:\dev\ww`) to avoid Windows 260-character path limit errors during the Android build.
> Do NOT use `C:\Users\YourName\Documents\...`.
> Virtual drives (`subst`) are NOT recommended as they cause Metro module resolution issues.

## Getting Started

1. **Clone to a Short Path (Windows)**:
    ```bash
    git clone https://github.com/wildlifeai/wildlife-watcher-mobile-app.git C:\dev\ww
    cd C:\dev\ww
    ```

2. **Install Dependencies**:
    ```bash
    # On Windows:
    npm install --ignore-scripts
    
    # On macOS/Linux:
    npm install
    
    # Manually run post-install tools if --ignore-scripts was used:
    npx patch-package
    npm run validate:deps
    ```
    *Note: `npm install --ignore-scripts` is recommended on Windows to avoid script execution failures in certain native packages like `maestro`.*

3. **Set up Environment**:
    Create a `.env` file in the root directory:
    ```env
    EXPO_PUBLIC_SUPABASE_URL=your_url
    EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key
    ```

4. **Start Development Server**:
    ```bash
    # Always use --clear to ensure patches are loaded
    npx expo start --clear
    ```

## Building Locally

### Android (Windows/Mac)
1. Ensure Android Emulator is running or device is connected.
2. Run the build command:
    ```bash
    npx expo run:android
    ```
    *Note: The first build may take 10-15 minutes.*

### iOS (Mac Only)
1. Run on Simulator:
    ```bash
    npx expo run:ios
    ```

## Building with EAS (Cloud)

Builds are managed via Expo Application Services (EAS).

### Authenticating
If you need to switch accounts or link a new project:

1.  **Logout and Login**:
    ```bash
    npx eas logout
    npx eas login
    ```
2.  **Clear Existing Config**:
    *   Open `app.config.ts`.
    *   Remove or comment out `owner`, `updates.url`, and `extra.eas.projectId`.
3.  **Initialize Project**:
    ```bash
    npx eas init # Select your account/project
    ```

### Running a Build
To build for iOS (on Windows) or generic cloud builds:
```bash
npx eas build --clear-cache --profile development --platform ios
```

### Production Build & Submit (Android)
To build and automatically submit to the Google Play Console (Internal Track):
1.  **Configure Service Account**: Ensure your `eas.json` points to a valid Google Play Service Account JSON key (e.g., `./wwmap-443023-....json`).
2.  **Versioning**: Bump version in `package.json` and build code (`android.versionCode`) in `app.config.ts`.
3.  **Run Command**:
    ```bash
    eas build --platform android --profile production --auto-submit
    ```

> [!IMPORTANT]
> **Signing Key**: Ensure your EAS Signing Key (SHA1 fingerprint) matches the one registered in the Google Play Console. Use `eas credentials` to verify or upload the correct keystore.


## Troubleshooting

### "useLegacyImplementation" or "useAnimatedGestureHandler" Errors
These are caused by incompatibility between `react-native-drawer-layout` and Reanimated 4.
**Fix:** We upgraded `react-native-drawer-layout` to v4.2.1+. Ensure you are using the latest version:
```bash
npm install react-native-drawer-layout@latest
npx expo start --clear
```

### Module Resolution / EBUSY Errors (Windows)
*   **Cause:** Long paths or file locking.
*   **Fix:** Move project to `C:\dev\ww`. Delete `node_modules` and run `npm install` again.

### Android Build Failures
*   **Cause:** Missing SDK, JDK mismatch, or missing `local.properties`.
*   **Fix:** 
    - Ensure you have **Android SDK 35** and **Java 17**.
    - If you see "SDK location not found", create `android/local.properties` with:
      `sdk.dir=C:/Users/YourName/AppData/Local/Android/Sdk`
    - Run `npx expo prebuild --clean` to reset native files.

### Windows Path Length Errors (`MAX_PATH`)
*   **Cause:** Windows has a 260 character path limit.
*   **Fix:** Ensure the project is in a very short path like `C:\dev\ww`. If errors persist, try `git config --global core.longpaths true`.

### Sync Issues

If sync isn't working:
1. Check network connectivity
2. Verify Supabase credentials in `.env`
3. Check Metro logs for sync errors
4. Clear app data and reinstall if needed

### BLE Connection Issues

If camera won't connect:
1. Ensure Bluetooth is enabled
2. Check camera is powered on and in range
3. Reset camera if needed
4. Check Metro logs for BLE errors

### Database Issues

If local database is corrupted:
1. Clear app data
2. Reinstall app
3. Data will re-sync from Supabase on next login

## Offline Development & Testing

### Testing Offline Functionality

1. **Enable Airplane Mode** on your device
2. **Create/Edit/Delete** projects and deployments
3. **Disable Airplane Mode** to restore connectivity
4. **Observe Automatic Sync** - changes upload to Supabase automatically

### Monitoring Sync Status

Check Metro logs for sync activity:
- `📤 Uploading X pending operations` - Outbox upload starting
- `✅ Server processed X operations` - Sync successful
- `🔽 Pulling changes since [timestamp]` - Downloading server changes
- `⚠️ X conflicts detected` - Conflict resolution needed

### Outbox Management

The outbox automatically:
- Queues operations when offline
- Retries failed syncs with exponential backoff
- Marks operations as synced when successful
- Detects and resolves conflicts

## Building and Releasing

The app uses EAS Build for cloud builds:

### Development Builds
```bash
eas build --profile development
```

### Production Builds
```bash
eas build --profile production
```

### Local Development
For local development, use the Expo development server:
```bash
npm start
```

Building and releasing is managed through EAS Build service. See the app configuration in `app.config.js` for build settings.

## Database Migrations

### ⚠️ CRITICAL: Database Workflow Rules

> [!CAUTION]
> **NEVER make database schema changes directly in this mobile repository.**
> 
> The Mobile Repository is a **Downstream Consumer** of the backend schema. All schema changes must originate from the Backend Repository.

**Correct Workflow:**
1.  **Backend Changes**: Make schema changes in the `wildlife-watcher-backend` repository.
2.  **Cloud Deployment**: Push changes to the backend repo. The GitHub Actions CI/CD pipeline will automatically deploy changes to the Supabase Cloud.
3.  **Mobile Sync**: Once deployed, pull the changes into this mobile repo:
    *   **Schema**: `npm run db:sync-schema`
    *   **Types**: `npm run types:cloud-dev` or `npm run types:local`
    *   **Verify**: Check updated files in `supabase/schemas` and `src/types/supabase.ts`.

### WatermelonDB Schema

Local database schema is defined in `src/database/schema.ts`. To modify:

1. Update schema version in `schema.ts`
2. Create migration in `src/database/migrations.ts`
3. Test migration on development device
4. Commit changes

### Supabase Migrations (Backend)

The mobile app follows a **declarative schema-as-code** workflow, synced from the [wildlife-watcher-backend](https://github.com/wildlifeai/wildlife-watcher-backend) repository.

1. **Automated Sync**: The schema is automatically synced from the backend repo whenever you run `ios`, `android`, or `start` scripts.
    * manual sync: `npm run db:sync-schema`
    * **Note**: Synchronization uses a **Protected Clean Sync** logic—it automatically removes stale files from synced folders while preserving intentional mobile-only code (like `01_watermelon_sync.sql`). It also includes a **GitHub Fallback** if the local backend repository is not found.
2. **Local Schema Store**: Core logic lives in `supabase/schemas/`.
3. **Applying Changes**:
   * **Local Only**: `npx supabase db reset` (resets local DB with the latest synced schema files).
   * **Remote**: All remote migrations and schema deployments are managed exclusively in the [backend repository](https://github.com/wildlifeai/wildlife-watcher-backend).
4. **Detailed Guide**: See [supabase/README.md](./supabase/README.md) for full instructions on synchronization.

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

## Additional Commands

- `npm test` - Run Jest tests
- `npm run lint` - Run ESLint
- `npm run validate:deps` - Validate dependency compatibility
- `npm run deps` - Interactive dependency management CLI
- `npm run type-check` - Run TypeScript type checking

## Troubleshooting

### Sync Issues

If sync isn't working:
1. Check network connectivity
2. Verify Supabase credentials in `.env`
3. Check Metro logs for sync errors
4. Clear app data and reinstall if needed

### BLE Connection Issues

If camera won't connect:
1. Ensure Bluetooth is enabled
2. Check camera is powered on and in range
3. Reset camera if needed
4. Check Metro logs for BLE errors

### Database Issues

If local database is corrupted:
1. Clear app data
2. Reinstall app
3. Data will re-sync from Supabase on next login

## Contributing

If you wish to contribute to this project, submit a [pull request](https://github.com/wildlifeai/wildlife-watcher-mobile-app/pulls).

### Development Guidelines

- Follow TypeScript strict mode
- Write tests for new features
- Update documentation for API changes
- Use conventional commits
- Test offline functionality

## Created & Maintained By

- [Miha Drofenik](https://github.com/Burzo)
- [Victor Anton](https://github.com/victor-wildlife)

If you find this project helpful, consider [donating to Wildlife.ai](https://givealittle.co.nz/donate/org/wildlifeai)

## Documentation

All documentation is organized under `documentation/`:

### Getting Started
- **[Onboarding](./documentation/onboarding/)** - Getting started guides, architecture overview, Redux patterns
  - [Quick Start Checklist](./documentation/onboarding/Quick-Start-Checklist.md)
  - [Developer Onboarding Guide](./documentation/onboarding/Developer-Onboarding-Guide.md)

### Setup & Configuration
- **[Setup](./documentation/setup/)** - Platform setup, integrations, dependencies
  - Android, BLE, Expo/EAS, WSL2, Docker, MCP
- **[Environment](./documentation/environment/)** - Environment variable configuration  
- **[Workflows](./documentation/workflows/)** - Developer workflows, troubleshooting, database management

### Testing
- **[Testing](./documentation/testing/)** - Maestro E2E testing guide

### Archive
- **[Archive](./documentation/archive/)** - Historical documentation, agentic development guidelines, project context

## License

This project is licensed under the MIT License - see the LICENSE file for details.
