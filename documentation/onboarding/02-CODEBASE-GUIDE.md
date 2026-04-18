# Codebase Guide

Navigate the Wildlife Watcher codebase. Understand where everything lives, how state management works, and the patterns used throughout.

## Root Directory

```
wildlife-watcher-mobile-app/
├── src/                    # All application source code
├── tests/                  # Test files (unit, integration, e2e)
├── documentation/          # Developer documentation
├── project-context/        # Project specs and planning
├── android/                # Android native code (Expo-generated)
├── ios/                    # iOS native code (Expo-generated)
├── supabase/               # Schema files synced from backend
├── scripts/                # Build validation and tooling
├── package.json            # Dependencies and scripts
├── app.config.ts           # Expo/EAS configuration (dynamic)
├── tsconfig.json           # TypeScript configuration
├── babel.config.js         # Babel transpiler config
└── metro.config.js         # Metro bundler config
```

## Source Code (`src/`)

```
src/
├── App.tsx                 # Root component with nested providers
├── theme.ts                # Theming (React Native Paper + Navigation)
├── components/             # Reusable UI components
├── screens/                # Screen components (by feature)
├── navigation/             # Navigation configuration + auth screens
├── redux/                  # Redux Toolkit (session + UI state only)
├── services/               # Business logic & data services
├── database/               # WatermelonDB schema, models, migrations
├── types/                  # TypeScript type definitions
├── hooks/                  # Custom React hooks (BLE, sync, auth)
├── utils/                  # Utility functions
├── providers/              # React context providers
├── ble/                    # BLE type definitions and constants
├── features/               # Feature-specific modules (maps)
└── assets/                 # Images, fonts
```

### `src/App.tsx` — Provider Hierarchy

The app wraps all content in nested providers. The order matters — inner providers can access outer ones.

```typescript
export const App = () => {
  return (
    <GestureHandlerRootView>
      <KeyboardProvider>
        <SafeAreaProvider>
          <ReduxProvider store={store}>
            <PaperProvider>
              <NavigationContainer>
                <AndroidPermissionsProvider>
                  <AppSetupProvider>
                    <BleEngineProvider>
                      <ListenToBleEngineProvider>
                        <AuthProvider>
                          <MainNavigation />
                        </AuthProvider>
                      </ListenToBleEngineProvider>
                    </BleEngineProvider>
                  </AppSetupProvider>
                </AndroidPermissionsProvider>
              </NavigationContainer>
            </PaperProvider>
          </ReduxProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  )
}
```

### `src/components/` — Reusable Components

```
components/
├── ui/                    # WW-prefixed generic components (WWButton, WWText, etc.)
├── form/                  # Form-specific components
├── sync/                  # Sync status indicators
├── ProjectCard.tsx        # Project list item
├── DeploymentCard.tsx     # Deployment list item
├── DeviceItem.tsx         # Device list item
├── EngineerConnectDialog.tsx # Side-drawer quick BLE connect for engineer console
├── NavigationBar.tsx      # Header bar
├── AppDrawer.tsx          # Side drawer menu
├── OrgSwitcher.tsx        # Organisation switcher
└── SideNavigation.tsx     # Drawer content (includes Engineer Console trigger)
```

> [!TIP]
> Always check `src/components/ui/` before building new UI elements. The `WW`-prefixed components (`WWButton`, `WWTextInput`, `WWSelect`, etc.) provide consistent styling and theme integration.

### `src/screens/` — Screen Components

Screens live in two locations:

```
screens/                       navigation/screens/
├── Deployments/               ├── Login.tsx
│   ├── StartMonitoringScreen  ├── Register.tsx
│   ├── StopMonitoringScreen    ├── Profile.tsx
│   └── ...                    ├── Settings.tsx
├── Devices/                   └── ForgotPassword.tsx
│   ├── DeviceDiscoveryScreen
│   ├── DeviceDetailsScreen
│   ├── EngineerConsoleScreen
│   ├── components/
│   │   └── ScannerRoutingDialog.tsx  # Post-scan routing (project association, deployment start/stop)
│   └── hooks/
│       └── useDeviceDiscovery.ts     # Scanner auto-connect + routing logic
├── Projects/
│   ├── ProjectDetailsScreen
│   └── ...
└── AuthTestScreen.tsx (__DEV__)
```

> [!NOTE]
> The old `PrepareAndTestScreen` has been removed. Device configuration and metrics snapshots are captured directly during Deployment.

### `src/navigation/` — Navigation Setup

```
navigation/
├── index.tsx              # Stack navigator + route definitions
├── BottomTabs.tsx         # Bottom tab navigator (Scanner, Map, Projects — 3 tabs)
├── types.ts               # Navigation TypeScript types
├── linking.ts             # Deep linking configuration
└── screens/               # Auth & utility screens
```

The app launches to the **Scanner** tab by default. The **Engineer Console** is accessible from the side drawer (hamburger menu) — not from a tab.

The full route table with params is documented in [01-TECHNOLOGY-STACK.md](./01-TECHNOLOGY-STACK.md#route-table).

### `src/services/` — Business Logic

```
services/
├── supabase.ts                # Supabase client (factory pattern)
├── database.ts                # Typed Supabase operations
├── ProjectService.ts          # Project CRUD + outbox
├── ProjectMemberService.ts    # Member invitations
├── DeploymentService.ts       # Deployment lifecycle
├── DeviceService.ts           # Device record management
├── ReferenceDataService.ts    # Downloaded reference data (capture methods, etc.)
├── DfuService.ts              # Firmware updates (Nordic DFU)
├── MockLoRaWANService.ts      # LoRaWAN mocking
└── offline/                   # Offline-first core
    ├── OfflineService.ts      # Network monitoring + sync triggers
    ├── SupabaseSyncService.ts # Bidirectional WatermelonDB ↔ Supabase sync
    └── OutboxService.ts       # Queues offline operations for sync
```

**Service Pattern** — all data services write to WatermelonDB first:
```typescript
// src/services/ProjectService.ts
export class ProjectService {
  async createProject(data: ProjectCreate): Promise<Project> {
    await database.write(async () => {
      await projectsCollection.create(project => {
        project.name = data.name;
        // ...
      });
    });
    // WatermelonDB observers update UI automatically
    // OutboxService queues the change for sync
  }
}
```

### `src/hooks/` — Custom Hooks

```
hooks/
├── useBle.ts                  # Low-level BLE connect/write/read
├── useBleCommands.ts          # Typed BLE command wrappers
├── useBleInitialization.ts    # Shared self-test + UTC sync
├── useBleListeners.tsx        # BLE event listeners
├── useEngineerConnect.ts      # Engineer Console BLE quick-connect from side drawer
├── useDeploymentConfiguration.ts # Atomic deployment config
├── useCapturePreview.ts       # Image capture flow
├── useDeviceSettings.ts       # Device quiesce + settings
├── useOfflineSync.ts          # Offline sync triggers
├── useSupabaseAuth.ts         # Supabase auth hook
├── useUserOrganisations.ts    # Org management
├── useGPSLocation.ts          # GPS access
└── useAppNavigation.tsx       # Typed navigation hook
```

### `src/providers/` — Context Providers

```
providers/
├── AndroidPermissionsProvider.tsx  # Runtime permission requests
├── AppSetupProvider.tsx            # App initialisation (DB, sync, config)
├── BleEngineProvider.tsx           # Bluetooth engine lifecycle
├── ListenToBleEngineProvider.tsx   # BLE event routing
├── AuthProvider.tsx                # Auth state + token management
└── DeviceReconnectProvider.tsx     # Auto-reconnection
```

### `src/database/` — WatermelonDB

```
database/
├── index.ts               # Database instance + collection accessors
├── schema.ts              # Auto-generated schema (version 185, 15 tables)
├── migrations.ts          # Schema migration definitions
└── models/                # WatermelonDB model classes
    ├── Project.ts
    ├── Deployment.ts
    ├── Device.ts
    └── ... (15 models total)
```

### `src/types/` — TypeScript Definitions

```text
types/
├── index.ts               # Central export for all type definitions (API, DB, BLE, Offline, etc.)
├── database.types.ts      # Auto-generated from Supabase schema
├── api.types.ts           # Shared API types
├── device.ts              # Device-specific types
├── project.ts             # Project-specific types
├── userProfile.ts         # User profile types
└── offline.ts             # Offline operation types
```

**Type Import Pattern:**
To reduce the bundle size and prevent circular dependencies, **always import types from the central index** (`src/types/index.ts` or `src/types`) rather than individual files or the massive `database.types.ts` file. All conflicts are aliased safely.

```typescript
// ✅ CORRECT: Import from central index
import { OfflineUser, ProjectWithDetails } from "../../types"

// ❌ WRONG: Don't import from specific files
import { ProjectWithDetails } from "../../types/project"
import { Database } from "../../types/database.types"
```

**Regenerate types after backend changes:**
```bash
npm run types:cloud-dev     # Regenerate database.types.ts from cloud-dev environment
npm run schema:generate     # Regenerate WatermelonDB schema
```

---

## State Management: Redux vs WatermelonDB

> [!IMPORTANT]
> This is the most important architectural concept to understand. **Redux does NOT hold domain data.** All entity data (projects, deployments, devices, user roles) lives in WatermelonDB. Redux handles session state and UI state only.

| Concern | Where | Example |
|---------|-------|---------|
| Domain data | WatermelonDB | Projects, deployments, devices, user roles |
| Session state | Redux | Auth tokens, user profile, permissions |
| UI state | Redux | Sync status, network status, loading flags |
| Data fetching | WatermelonDB observables | `withObservables`, `database.get('projects').query().observe()` |
| API calls | RTK Query | Non-DB API calls (reference data, user search) |

### Data Access Pattern

Components subscribe to WatermelonDB via `withObservables` — **not** `useAppSelector`:

```typescript
// ✅ CORRECT: Observe database directly
const enhance = withObservables([], () => ({
  projects: database.collections.get('projects').query().observe()
}));
export default enhance(ProjectsList);

// ❌ WRONG: Don't fetch domain data from Redux
const projects = useAppSelector(state => state.projects.items);
```

> [!WARNING]
> **Aggregated Data & RLS:** WatermelonDB local queries (like `.fetchCount()`) only reflect what the current user is authorized to sync. For cross-user aggregated data (e.g., total members in a project), do not rely on local observables. Use RTK Query (`projectsApi.ts`) to fetch the true count from the Cloud.

### Redux Store

**Location:** `src/redux/index.ts`

Redux is configured with 16 feature reducers and 4 RTK Query API middlewares. The key slices:

| Slice | Purpose |
|-------|---------|
| `authSlice` | Auth tokens, user info, current org, permissions |
| `syncSlice` | Per-entity sync status tracking |
| `networkSlice` | Online/offline state |
| `deploymentSlice` | Active deployment session state |
| `devicesSlice` | Device discovery + connection state |
| `logsSlice` | BLE log buffer |

**Typed hooks:**
```typescript
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

### Creating a Slice (Session/UI State Only)

```typescript
// src/redux/slices/syncSlice.ts
const syncSlice = createSlice({
  name: 'sync',
  initialState: { isSyncing: false, lastSyncAt: null, entityStatus: {} },
  reducers: {
    setSyncing: (state, action) => { state.isSyncing = action.payload },
    setEntityStatus: (state, action) => {
      state.entityStatus[action.payload.entity] = action.payload.status
    },
  },
});
```

### Best Practices

**DO:**
- ✅ Use Redux for **session state** (auth, permissions)
- ✅ Use Redux for **UI state** (sync status, modals, network)
- ✅ Use WatermelonDB for **all domain data**
- ✅ Use `withObservables` to connect components to data
- ✅ Write to WatermelonDB directly — the sync engine handles the rest

**DON'T:**
- ❌ Duplicate WatermelonDB data into Redux
- ❌ Use `useAppSelector` for projects, deployments, devices
- ❌ Dispatch actions to "save" data — write to DB directly

---

## File Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `ProjectCard.tsx` |
| Screens | PascalCase + `Screen` | `ProjectDetailsScreen.tsx` |
| Services | PascalCase + `Service` | `ProjectService.ts` |
| Hooks | camelCase + `use` prefix | `useOfflineSync.ts` |
| Types | camelCase | `offline.ts` |
| Redux slices | camelCase + `Slice` suffix | `authSlice.ts` |

---

## Quick Navigation Cheatsheet

| What You Need | Where to Look |
|---------------|---------------|
| App entry point | `src/App.tsx` |
| Redux store | `src/redux/index.ts` |
| Auth state | `src/redux/slices/authSlice.ts` |
| Navigation + routes | `src/navigation/index.tsx` |
| Offline sync engine | `src/services/offline/SupabaseSyncService.ts` |
| Outbox (queued ops) | `src/services/offline/OutboxService.ts` |
| Local database | `src/database/index.ts` |
| WatermelonDB schema | `src/database/schema.ts` |
| API layer | `src/redux/api/` |
| Supabase client | `src/services/supabase.ts` (use `getSupabaseClient()`) |
| BLE commands | `src/hooks/useBleCommands.ts` |
| BLE types/constants | `src/ble/types.ts` |
| Custom hooks | `src/hooks/` |
| UI components | `src/components/ui/` |
| Screens | `src/screens/{Feature}/` |
| Theme | `src/theme.ts` |
| Tests | `tests/` |
| Configuration | `app.config.ts`, `package.json` |

---

## Next Steps

1. [03-DATA-AND-SYNC.md](./03-DATA-AND-SYNC.md) — WatermelonDB, Supabase sync, and security model
2. [04-DEVICE-FLOWS.md](./04-DEVICE-FLOWS.md) — Device deployment lifecycle
3. [01-TECHNOLOGY-STACK.md](./01-TECHNOLOGY-STACK.md) — Complete dependency reference

---

*Last Updated: March 27, 2026*
