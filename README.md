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

> For a complete dependency reference with versions, patterns, and architecture details, see the [Technology Stack Guide](./documentation/onboarding/01-TECHNOLOGY-STACK.md).

## Critical Version Requirements (Expo SDK 54)
> [!IMPORTANT]
> This project has **STRICT** version requirements to avoid compilation errors (specifically `Unresolved reference 'extensions'`).
>
> - **Gradle**: Must be **8.14.3** (Configured in `android/gradle/wrapper/gradle-wrapper.properties`).
> - **Kotlin**: Version is managed by Expo autolinking (currently **2.1.20**), do NOT manually override in `build.gradle` unless necessary.
> - **React Native**: **0.81.5**
> - **React**: **19.1.0**
>
> A validation script (`scripts/validate-build-env.js`) runs automatically before builds to enforce these versions.

## Prerequisites

This app uses **Expo SDK 54** with a managed workflow (prebuild enabled). Ensure you have:

- **Node.js**: Version 20 (LTS) or higher
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

2. **Clone the Backend Repository** (recommended for schema sync):
    ```bash
    # Clone alongside the mobile repo so schema sync finds it automatically
    git clone https://github.com/wildlifeai/wildlife-watcher-backend.git C:\dev\ww-backend
    ```
    > The `db:sync-schema` script automatically detects sibling backend repos named `ww-backend` or `wildlife-watcher-backend`. If unavailable, it falls back to a GitHub shallow clone.

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

## Building

### Local Builds
```bash
npm run android            # Full pipeline: types → schema sync → build
npm run ios                # Full pipeline: types → schema sync → build (Mac only)
npx expo run:android       # Build only (skip schema sync)
npx expo run:ios           # Build only (skip schema sync, Mac only)
```
*Note: The first Android build may take 10-15 minutes. `npm run android` automatically syncs the database schema from the backend repo before building.*

### Cloud Builds (EAS)
```bash
eas build --profile development                          # Development
eas build --profile production                           # Production
eas build --platform android --profile production --auto-submit  # Build + submit to Play Console
```

> [!IMPORTANT]
> **Signing Key**: Ensure your EAS Signing Key (SHA1 fingerprint) matches the one registered in the Google Play Console. Use `eas credentials` to verify.

For detailed EAS configuration, see the [EAS Guide](./documentation/resources/Expo-EAS-Guide.md).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `useLegacyImplementation` errors | `npm install react-native-drawer-layout@^4.2.1 && npx expo start --clear` |
| Module resolution / EBUSY (Windows) | Move project to `C:\dev\ww`, delete `node_modules`, `npm install` |
| Android build failures | Ensure SDK 35 + Java 17. Run `npx expo prebuild --clean` to reset native files |
| Windows `MAX_PATH` errors | Use short path like `C:\dev\ww`. Try `git config --global core.longpaths true` |
| Sync not working | Check network, verify `.env` credentials, check Metro logs |
| BLE connection issues | Enable Bluetooth + permissions, keep within 5m, check Metro for `[RxRouter]` / `[bleEventBus]` logs |
| Database corrupted | Clear app data, reinstall — data re-syncs from Supabase on next login |

## Database Migrations

> [!CAUTION]
> **NEVER make database schema changes directly in this mobile repository.** All schema changes must originate from the `wildlife-watcher-backend` repository. See the [Data & Sync Guide](./documentation/onboarding/03-DATA-AND-SYNC.md) for the full schema drift prevention strategy.

## Testing

```bash
npm test                   # Unit tests (Jest)
npm run test:integration   # Integration tests
npm run test:maestro       # E2E UI tests (Maestro)
```

For detailed testing patterns, see the [Testing Guide](./documentation/resources/Testing-Guide.md).

## Additional Commands

| Command | Purpose |
|---------|---------|
| `npm run android` | **Full build pipeline**: sync types → sync schema → generate WatermelonDB → build |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run `tsc --noEmit` |
| `npm run validate:deps` | Validate dependency compatibility |
| `npm run deps` | Interactive dependency management CLI |
| `npm run db:sync-schema` | Sync database schema from backend repo |
| `npm run schema:generate` | Regenerate WatermelonDB schema |
| `npm run schema:validate` | Validate schema consistency |

## Documentation

All documentation is organised under `documentation/`:

### Onboarding (Start Here)

| Guide | What It Covers |
|-------|----------------|
| [00-GETTING-STARTED.md](./documentation/onboarding/00-GETTING-STARTED.md) | Setup, architecture overview, verification checklist |
| [01-TECHNOLOGY-STACK.md](./documentation/onboarding/01-TECHNOLOGY-STACK.md) | All dependencies, versions, patterns, and integrations |
| [02-CODEBASE-GUIDE.md](./documentation/onboarding/02-CODEBASE-GUIDE.md) | Project structure, state management, naming conventions |
| [03-DATA-AND-SYNC.md](./documentation/onboarding/03-DATA-AND-SYNC.md) | WatermelonDB, Supabase sync, security model |
| [04-ENGINEER-CONSOLE.md](./documentation/onboarding/04-ENGINEER-CONSOLE.md) | BLE commands, OP parameters, hardware testing tools |
| [05-DEVICE-FLOWS.md](./documentation/onboarding/05-DEVICE-FLOWS.md) | Device deployment, monitoring, and retrieval flows |
| [Git Workflow (org-level)](https://github.com/wildlifeai/.github/blob/main/agents/git-SKILL.md) | Git branching, Conventional Commits, PR review, and CI pipeline rules |

### Reference Guides

| Guide | What It Covers |
|-------|----------------|
| [BLE Architecture](./documentation/resources/BLE_Architecture.md) | BLE command system, timing, firmware constraints |
| [Android Setup](./documentation/resources/Android-Guide.md) | SDK, emulator, and device configuration |
| [Docker Guide](./documentation/resources/Docker-Development-Guide.md) | Containerised development environment |
| [EAS/Expo](./documentation/resources/Expo-EAS-Guide.md) | Cloud builds and OTA updates |
| [WSL2 Guide](./documentation/resources/WSL2-Setup-Guide.md) | Windows Subsystem for Linux setup |
| [Maps](./documentation/resources/Maps.md) | Maps feature architecture and API configuration |
| [Testing](./documentation/resources/Testing-Guide.md) | Jest, Maestro, and E2E testing |
| [Auth Guide](./documentation/resources/Authentication-Implementation-Guide.md) | Authentication implementation details |

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
