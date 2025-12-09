# Wildlife Watcher Mobile App

Welcome to the development repository of the Wildlife Watcher mobile app. This document provides instructions for setting up and running the project on your local machine.

The Wildlife Watcher mobile app allows users to communicate with Wildlife Watcher cameras that record animals and use AI to identify them. Built with **Expo SDK 51** and **React Native 0.74.6** with **Supabase** backend integration and **offline-first architecture**.

**Project Overview**: [Watch on YouTube](https://www.youtube.com/watch?v=Ima3n2EYfeE)

## Tech Stack

- **Framework**: Expo SDK 51 with React Native 0.74.6
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

This app now uses Expo SDK 51 with a managed workflow. Make sure you have the following prerequisites installed on your machine:

- **Node.js**: Version 18 or higher
- **Expo CLI**: For development and builds
- **EAS CLI**: For cloud builds and deployments
- **Android Studio**: For Android development and device connections (if developing for Android)
- **Xcode**: For iOS development (macOS only, if developing for iOS)

## Getting Started

1. Clone this repository to your local machine:

    ```bash
    git clone https://github.com/wildlifeai/wildlife-watcher-mobile-app.git
    cd wildlife-watcher-mobile-app
    ```

2. Install project dependencies:

    ```bash
    npm install
    ```

3. Set up environment variables:

    Create a `.env` file in the root directory with:
    ```env
    EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
    EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4. Start the Expo development server:

    ```bash
    npm start
    # or
    npx expo start
    ```

## iOS Setup

For iOS development:

1. Ensure you have Xcode installed (macOS only)

2. Run the project in development mode:

    ```bash
    npm run ios
    # or
    npx expo run:ios
    ```

## Android Setup

For Android development:

1. Ensure you have Android Studio installed for device/emulator support

2. Run the project in development mode:

```bash
npm run android
# or
npx expo run:android
```

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

### WatermelonDB Schema

Local database schema is defined in `src/database/schema.ts`. To modify:

1. Update schema version in `schema.ts`
2. Create migration in `src/database/migrations.ts`
3. Test migration on development device
4. Commit changes

### Supabase Migrations

Backend database migrations are in `../wildlife-watcher-backend/supabase/migrations/`:

1. Create migration file: `npx supabase migration new migration_name`
2. Write SQL migration
3. Test locally: `npx supabase db reset`
4. Deploy: `npx supabase db push`

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

## License

This project is licensed under the MIT License - see the LICENSE file for details.
