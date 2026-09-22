# Wildlife Watcher Mobile App

Welcome to the development repository of the Wildlife Watcher mobile app. This document provides instructions for setting up and running the project on your local machine.

The Wildlife Watcher mobile app allows users to communicate with Wildlife Watcher cameras that record animals and use AI to identify them. Built with **Expo SDK 54** and **React Native 0.81.5** (New Architecture enabled), using **Supabase** backend integration and an **offline-first architecture**.

**Project Overview**: [Watch on YouTube](https://www.youtube.com/watch?v=Ima3n2EYfeE)

## 🤖 Working with a coding agent

Most work in this repo now happens with an agent in the loop, so the prompts below are part of
the documentation rather than a novelty. Each section has a few worth starting from.

Point your agent at [`AGENTS.md`](./AGENTS.md) first. It is the quickstart, and it links to
[`.agents/skills/SKILL.md`](./.agents/skills/SKILL.md), which carries the rules that apply to
any change and a map to six reference files: BLE, cross-repo contracts, traps, data and sync,
tooling, and documentation. An agent that has read those will not re-learn things that have
already cost this project a day.

Two house rules an agent must follow here:

- **Ask before committing or pushing** to a shared branch.
- **Check the agent layer before each commit**, meaning `AGENTS.md`, the skill and its
  references, and fix what the change made wrong, missing or redundant in the same commit.

> 💬 **Ask the agent:** "Read AGENTS.md and the skill, then tell me in ten lines what this app
> does and what the device contract is."
>
> 💬 **Ask the agent:** "What should I know about this repo before I touch anything in
> `src/ble/`?"

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

> 💬 **Ask the agent:** "Set this repo up on my machine: install, check my JDK and Android SDK,
> create the env file from the example, and tell me what is missing."
>
> 💬 **Ask the agent:** "`npm run android:doctor` is unhappy. Work out why and fix it."
>
> 🔍 **What it does:** the doctor script checks JDK 17, the Android SDK, an attached adb device
> and the Supabase environment before a build starts, so most setup failures surface there
> rather than fifteen minutes into Gradle.

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

> 💬 **Ask the agent:** "Bump the app version and show me the six files that carry it, then run
> `npm run version:check`."
>
> 💬 **Ask the agent:** "I want to hand a build to a tester. Which EAS profile, and what will it
> do to the app already on their phone?"
>
> ⚠️ **Worth knowing before you ask:** preview and staging builds are release-type, so they
> replace the Play Store app and destroy its local database. The agent should tell you this; if
> it does not, it has not read the skill.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `useLegacyImplementation` errors | `npm install react-native-drawer-layout@^4.2.1 && npx expo start --clear` |
| Module resolution / EBUSY (Windows) | Move project to `C:\dev\ww`, delete `node_modules`, `npm install` |
| Android build failures | Ensure SDK 35 + Java 17. Run `npx expo prebuild --clean` to reset native files |
| Windows `MAX_PATH` errors | Use short path like `C:\dev\ww`. Try `git config --global core.longpaths true` |
| Sync not working | Check network, verify `.env` credentials, check Metro logs |
| BLE connection issues | Enable Bluetooth + permissions, keep within 5m, check Metro for `[RxRouter]` / `[bleEventBus]` logs |
| Database corrupted | Clear app data, reinstall, and data re-syncs from Supabase on next login |

> 💬 **Ask the agent:** "The app connects to the camera but the flow times out. Read the Metro
> log, work out which side stopped, and tell me before changing anything."
>
> 💬 **Ask the agent:** "Is this a known trap? Check the traps reference before you debug."
>
> 🔍 **Why that second prompt earns its place:** several failures that look like app bugs are
> firmware behaviour with a known cause and a known cost. The traps file exists so nobody
> rediscovers them.

## Database Migrations

> [!CAUTION]
> **NEVER make database schema changes directly in this mobile repository.** All schema changes must originate from the `wildlife-watcher-backend` repository. See the [Data & Sync Guide](./documentation/onboarding/03-DATA-AND-SYNC.md) for the full schema drift prevention strategy.

## Testing

```bash
npm test                   # Unit tests (Jest)
npm run test:integration   # Integration tests
npm run test:maestro:smoke # the one E2E flow CI requires (install, launch, screenshot)
npm run test:maestro       # every E2E flow; CI runs these on the full-e2e label
```

For detailed testing patterns, see the [Testing Guide](./documentation/resources/Testing-Guide.md).

> 💬 **Ask the agent:** "Write a test that reproduces this bug first, show me it failing, then
> fix it."
>
> 💬 **Ask the agent:** "Run the gates: type-check, lint, tests, version:check and
> docs:validate. Report what actually failed, not a summary."
>
> 🧪 **Try it out:** ask for a test around a BLE command's timeout and retry policy. Those live
> in `commandRegistry.ts` and are the part most likely to regress silently.

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
| [Developer Settings](./documentation/resources/Developer-Settings.md) | The developer screens, the environment switcher, the database reset actions, and the first-run tutorial |

### For agents

| File | What It Covers |
|------|----------------|
| [AGENTS.md](./AGENTS.md) | Quickstart, the non-negotiables, and where everything lives |
| [.agents/skills/SKILL.md](./.agents/skills/SKILL.md) | The rules that apply to any change, and which reference to read next |
| [references/ble.md](./.agents/skills/references/ble.md) | Command definitions, sleep and wake, op parameters, captures and telemetry |
| [references/cross-repo-contracts.md](./.agents/skills/references/cross-repo-contracts.md) | The eleven interfaces shared with the firmware, backend and website repos |
| [references/traps.md](./.agents/skills/references/traps.md) | Failures that look like app bugs and are not, each with what it cost |
| [references/data-and-sync.md](./.agents/skills/references/data-and-sync.md) | Local database rules, the RLS blindspot, the schema version |
| [references/tooling.md](./.agents/skills/references/tooling.md) | Writing scripts that survive Windows, macOS and CI |
| [references/documentation.md](./.agents/skills/references/documentation.md) | Where each kind of document lives, house style, and the commit-time check |

> 💬 **Ask the agent:** "I just changed how the capture flow works. What in AGENTS.md or the
> skill is now wrong, missing or redundant?"
>
> ✏️ **Make changes:** when a session teaches you something that would have saved you an hour,
> ask the agent to add it to the right reference file with the date and what it cost. That is
> the whole maintenance model for this layer.

## Contributing

If you wish to contribute to this project, submit a [pull request](https://github.com/wildlifeai/wildlife-watcher-mobile-app/pulls).

### Development Guidelines

- Follow TypeScript strict mode
- Write tests for new features
- Update documentation for API changes
- Use conventional commits
- Test offline functionality
- Ask the maintainer before committing or pushing to a shared branch
- Check `AGENTS.md`, the skill and its references before each commit, and fix what your change
  made wrong, missing or redundant
- No em dashes in documents, commas or a new sentence instead

## Created & Maintained By

- [Miha Drofenik](https://github.com/Burzo)
- [Victor Anton](https://github.com/victor-wildlife)

If you find this project helpful, consider [donating to Wildlife.ai](https://givealittle.co.nz/donate/org/wildlifeai)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
