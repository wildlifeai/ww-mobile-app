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
├── database/               # WatermelonDB schema and models
├── types/                  # TypeScript type definitions
├── hooks/                  # Custom React hooks (BLE, sync, auth)
├── utils/                  # Utility functions (incl. cameraVariant.ts, firmwareWords.ts, himaxFirmwareState.ts, flashCameraMatch.ts, networkErrors.ts)
├── providers/              # React context providers
├── ble/                    # BLE protocol engine (protocol/, session/, command registry)
├── features/               # Feature-specific modules (maps)
└── assets/                 # Images, fonts
```

### `src/App.tsx`: Provider Hierarchy

The app wraps all content in nested providers. The order matters, inner providers can access outer ones.

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

### `src/components/`: Reusable Components

```
components/
├── ui/                    # WW-prefixed generic components (WWButton, WWText, etc.)
├── form/                  # Form-specific components
├── sync/                  # Sync status indicators
├── ProjectCard.tsx        # Project list item
├── EngineerConnectDialog.tsx # Side-drawer quick BLE connect for engineer console
├── NavigationBar.tsx      # Header bar
├── AppDrawer.tsx          # Side drawer menu
├── OrgSwitcher.tsx        # Organisation switcher
├── GoogleSignInButton.tsx # "Continue with Google" on Login and Register
└── SideNavigation.tsx     # Drawer content (includes Engineer Console trigger)
```

> [!TIP]
> Always check `src/components/ui/` before building new UI elements. The `WW`-prefixed components (`WWButton`, `WWTextInput`, `WWSelect`, etc.) provide consistent styling and theme integration.

### `src/screens/`: Screen Components

Screens live in two locations:

```
screens/                                  navigation/screens/
├── Deployments/                          ├── auth/
│   ├── StartMonitoringScreen.tsx         │   ├── LoginScreen.tsx
│   ├── StopMonitoringScreen.tsx          │   ├── RegisterScreen.tsx
│   ├── components/                       │   └── ForgotPasswordScreen.tsx
│   │   └── DeploymentMonitorView.tsx     ├── user/
│   └── hooks/                            ├── system/
│       ├── useStartDeployment.ts         ├── developer/       # __DEV__ only
│       ├── useEndDeployment.ts           └── MapsScreen.tsx
│       └── useDeploymentMonitor.ts
├── Devices/
│   ├── DeviceDiscoveryScreen / EngineerConsoleScreen
│   ├── DevDeploymentTestScreen / DeviceResetScreen / DeviceCheckScreen
│   ├── DfuScreen / FirmwareUpdateScreen / FirmwareStatusScreen
│   ├── FileTransferTestScreen / ModelValidationTestScreen
│   ├── CapturePictureScreen / LightSensorScreen
│   ├── StandaloneMotionDetectionScreen
│   ├── DeviceMonitoringSummaryScreen
│   ├── components/
│   │   ├── ScannerRoutingDialog.tsx      # Post-scan routing
│   │   └── SimpleFirmwareUpdate.tsx      # The operator's firmware update (#344)
│   └── hooks/
│       ├── useDeviceDiscovery.ts         # Scanner auto-connect + routing
│       ├── useAutoConnectStateMachine.ts
│       ├── useFirmwareUpdate.ts          # Himax update orchestration
│       ├── useMotionDetectionStream.ts
│       └── useDeviceCheck.ts             # Screen state for the ship check
├── Projects/
```

> [!NOTE]
> Auth screens live in `navigation/screens/auth/` with a `Screen` suffix, not flat in `navigation/screens/`.

> [!NOTE]
> The old `PrepareAndTestScreen` has been removed. Device configuration and metrics snapshots are captured directly during Deployment.

> [!NOTE]
> `navigation/screens/developer/` holds the two developer screens and their twelve sections.
> [Developer-Settings.md](../resources/Developer-Settings.md) lists what each one shows, which
> actions wipe the local database, and how to reach them.

### `src/navigation/`: Navigation Setup

```
navigation/
├── index.tsx              # Stack navigator + route definitions
├── BottomTabs.tsx         # Bottom tab navigator (Scanner, Map, Projects, 3 tabs)
├── types.ts               # Navigation TypeScript types
├── linking.ts             # Deep linking configuration
└── screens/               # Auth & utility screens
```

The app launches to the **Scanner** tab by default. The **Engineer Console** is accessible from the side drawer (hamburger menu), not from a tab.

The full route table with params is documented in [01-TECHNOLOGY-STACK.md](./01-TECHNOLOGY-STACK.md#route-table).

### `src/services/`: Business Logic

```
services/
├── supabase.ts                # Supabase client (factory pattern)
├── supabaseFetch.ts           # The client's fetch: 30 s limit on auth and PostgREST reads
├── auth.ts                    # Session lifecycle management; offline, the stored session stands
├── organisationMembership.ts  # User's organisations and roles, cloud or local; current org remembered
├── connectivityWatch.ts       # NetInfo: offline and reconnect handlers, isKnownOffline()
├── reconnectSync.ts           # One sync per reconnect, on a valid session
├── ProjectService.ts          # Project CRUD + outbox
├── DeploymentService.ts       # Deployment lifecycle
├── DeviceService.ts           # Device record management
├── UserRoleService.ts         # User role management
├── InvitationService.ts       # Member invitations
├── AiModelService.ts          # AI model metadata, the model file cache
├── ReferenceDataService.ts    # Downloaded reference data (capture methods, etc.)
├── FirmwareService.ts         # Firmware blob management, the firmware file cache
├── himaxUpdateRecord.ts       # This phone's record of an AI pair update, to finish one that stopped (#374)
├── OfflinePrefetchService.ts  # Fills both caches after a sync, for the field (#333)
├── DfuService.ts              # Firmware updates (Nordic DFU)
├── DeploymentPhotoService.ts  # Deployment photo capture + upload
├── SupabaseSyncService.ts     # Bidirectional WatermelonDB ↔ Supabase sync
├── OutboxService.ts           # Queues offline operations for sync
├── SyncStateService.ts        # Sync state tracking
└── SyncBarrier.ts             # Event-driven initial-sync readiness barrier
```

**Service Pattern**, all data services write to WatermelonDB first:
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

### `src/hooks/`: Custom Hooks

> This is the maintained inventory. Other documents link here rather than keeping their own copies.

```
hooks/
├── useBle.ts                  # Low-level BLE connect/writeRaw/disconnect
├── useBleSession.ts           # React hook wrapping createBleSession (deterministic workflows)
├── useBleInitialization.ts    # Shared self-test + UTC sync
├── useBleListeners.tsx        # BLE event listeners → rxRouter
├── useBleHeartbeat.ts         # 30s inactivity keep-alive
├── useSetupBLELibrary.ts      # BLE library initialization
├── useBluetoothStatus.ts      # Bluetooth adapter state
├── useEngineerConnect.ts      # Console connection management
├── useScanLoop.ts             # Shared 3s burst scan loop + cache flush
├── useDeviceSelfTest.ts       # Device health from the self-test cache (Capture Picture banner)
├── useSelectDevice.tsx        # Device selection helper
├── useDeploymentConfiguration.ts # Capture method and capture flash → OP mapping
├── useDeploymentProgress.ts   # Deployment progress tracking
├── useDevicePreDeploymentChecks.ts # Battery/firmware/SD validation
├── useMonitoringActions.ts    # Deployment monitoring commands
├── useCapturePreview.ts       # Image capture flow
├── useDeviceSettings.ts       # OP_PARAMETER enum, FACTORY_DEFAULTS, quiesce
├── useCameraSwitch.ts         # Camera variant switching
├── useLightSensor.ts          # Light readings: AI light, the AE register block, op23/24/25, and the flash mode op34
├── useCameraReadiness.ts      # Is the camera usable: self-test bits + op10
├── useOfflineFiles.ts         # Is the project's model / the firmware image on this phone
├── useSupabaseAuth.ts         # Supabase auth hook
├── useSupabaseClient.ts       # Supabase client hook
├── useUserOrganisations.ts    # Org management
├── useGPSLocation.ts          # GPS access
├── useAndroidPermissions.ts   # Android runtime permissions
├── useDeepLinking.ts          # Deep link handling
├── useAppNavigation.tsx       # Typed navigation hook
├── useInterval.tsx            # Interval utility
└── useTimer.ts                # Timer utility
```

Screen-scoped hooks live beside their screens, see `src/screens/Devices/hooks/` (scanner, firmware update, console) and `src/screens/Deployments/hooks/` (start/end/monitor).

### `src/ble/`: BLE Protocol Engine

```
ble/
├── types.ts                    # UI command definitions (CommandNames, COMMANDS for Console)
├── transport.ts                # Raw BLE write + service discovery
├── messageClassifier.ts        # UI-only log categorization for monitoring display
├── emitters.ts                 # Legacy EventEmitter3 (retained for ImageReassembler)
├── protocol/                   # Event-driven command engine
│   ├── eventBus.ts             # bleEventBus, frozen event types
│   ├── rxRouter.ts             # Binary/text classification
│   ├── commandRegistry.ts      # Typed command factories (frozen schema)
│   ├── runCommandPipeline.ts   # Multi-command sequential executor
│   ├── bleTransportController.ts # Low-level BLE transport management
│   ├── protocolConstants.ts    # Timing constants (MTU, timeouts)
│   ├── deviceSignals.ts        # Sleep/Wake/Busy signals
│   ├── textStreamScope.ts      # Text stream scoping for responses
│   ├── selfTestCache.ts        # Latest `Error bits` per connection, from the wake broadcast
│   ├── opCache.ts              # Op table cached per device for one wake window; dropped on Wake
│   ├── lightCheck.ts           # Parser for the `AE light check` telemetry line
│   ├── awaitAeRegisters.ts     # Wait for the `HM0360 AE regs` block that answers the two-phase `AI light`
│   └── fileTransfer/           # Chunked file transfer protocol
│       ├── runFileTransferPipeline.ts
│       ├── bleFirmwareFloor.ts # Oldest BLE firmware the transfer window works on; refuses below it
│       ├── fileTransferPackets.ts
│       ├── ackMatcher.ts
│       ├── crc16ccitt.ts
│       └── filenameValidator.ts
├── session/                    # Deterministic workflow API
│   ├── createBleSession.ts     # Session factory
│   ├── keepAwake.ts            # Hold a device awake for a screen visit (op8 raised, restored on exit or next connection)
│   ├── flashHold.ts            # Hold the capture flash armed for a screen visit (op34 always-on, restored the same way; a deployment drops it)
│   ├── flashLedHold.ts         # Hold a motion test's flash LED and brightness (op13, op9, restored the same way; a deployment drops it)
│   ├── mdIntervalHold.ts       # Hold the HM0360 motion rate at a motion test's interval (op11, restored the same way; a deployment drops it)
│   └── endDeploymentSession.ts # Ending a deployment: one probe, skip the camera after its first timeout, 20 s cap, `dis` exempt
└── workflows/                  # Reusable BLE workflow functions
    ├── deploymentPipeline.ts   # Shared deployment pipeline
    ├── resetToDefaults.ts      # executeResetToDefaults, shared OP factory reset
    ├── configVerification.ts   # Post-firmware-update CONFIG.TXT handshake
    ├── checkSdCard.ts          # SD card health validation
    ├── deviceCheck.ts          # The ship check's steps (rules in utils/deviceCheck/)
    ├── downloadPhoto.ts        # One photo off the SD card, outside a screen
    └── lorawanPing.ts          # LoRaWAN test uplink: sent, not joined, busy, off (op32 0) or no answer, and its words
```

### `src/providers/`: Context Providers

```
providers/
├── AndroidPermissionsProvider.tsx  # Runtime permission requests
├── AppSetupProvider.tsx            # App initialisation (DB, sync, config)
├── BleEngineProvider.tsx           # Bluetooth engine lifecycle
├── ListenToBleEngineProvider.tsx   # BLE event routing
└── AuthProvider.tsx                # Auth state + token management
```

### `src/database/`: WatermelonDB

```
database/
├── index.ts               # Database instance + collection accessors; no migrations, a version change resets the local database
├── schema.ts              # Auto-generated schema, version + table count live in the file
└── models/                # WatermelonDB model classes
    ├── Project.ts
    ├── Deployment.ts
    ├── Device.ts
    └── ... (one class per synced table)
```

### `src/types/`: TypeScript Definitions

```text
types/
├── database.types.ts      # Auto-generated from Supabase schema
├── device.ts              # Device-specific types
├── project.ts             # Project-specific types
├── UserProfile.ts         # User profile types
├── expo-constants.d.ts    # Typing for the app config extras
└── expo-updates.d.ts      # Typing for expo-updates
```

**Type Import Pattern:** import a type from the file that defines it, and take anything from
`database.types.ts` with `import type`, which Babel removes, so the generated file never reaches
the bundle or Jest. There is no central type index: the old `types/index.ts` was imported by
nothing and went with the dead-code cleanup of #393.

```typescript
import type { ProjectWithDetails } from "../../types/project"
import type { Database } from "../../types/database.types"
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

Components subscribe to WatermelonDB via `withObservables`, **not** `useAppSelector`:

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
- ✅ Write to WatermelonDB directly, the sync engine handles the rest

**DON'T:**
- ❌ Duplicate WatermelonDB data into Redux
- ❌ Use `useAppSelector` for projects, deployments, devices
- ❌ Dispatch actions to "save" data. Write to the DB directly instead

---

## File Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `ProjectCard.tsx` |
| Screens | PascalCase + `Screen` | `ProjectDetailsScreen.tsx` |
| Services | PascalCase + `Service` | `ProjectService.ts` |
| Hooks | camelCase + `use` prefix | `useScanLoop.ts` |
| Types | camelCase | `project.ts` |
| Redux slices | camelCase + `Slice` suffix | `authSlice.ts` |

---

## Quick Navigation Cheatsheet

| What You Need | Where to Look |
|---------------|---------------|
| App entry point | `src/App.tsx` |
| Redux store | `src/redux/index.ts` |
| Auth state | `src/redux/slices/authSlice.ts` |
| Navigation + routes | `src/navigation/index.tsx` |
| Offline sync engine | `src/services/SupabaseSyncService.ts` |
| Outbox (queued ops) | `src/services/OutboxService.ts` |
| Local database | `src/database/index.ts` |
| WatermelonDB schema | `src/database/schema.ts` |
| API layer | `src/redux/api/` |
| Supabase client | `src/services/supabase.ts` (use `getSupabaseClient()`) |
| BLE commands | `src/ble/protocol/commandRegistry.ts` |
| BLE events | `src/ble/protocol/eventBus.ts` |
| BLE sessions | `src/ble/session/createBleSession.ts` |
| BLE types/constants | `src/ble/types.ts` (UI definitions only) |
| Custom hooks | `src/hooks/` |
| UI components | `src/components/ui/` |
| Screens | `src/screens/{Feature}/` |
| Theme | `src/theme.ts` |
| Tests | `tests/` |
| Configuration | `app.config.ts`, `package.json` |

---

## Next Steps

1. [03-DATA-AND-SYNC.md](./03-DATA-AND-SYNC.md): WatermelonDB, Supabase sync, and security model
2. [05-DEVICE-FLOWS.md](./05-DEVICE-FLOWS.md): device deployment lifecycle
3. [01-TECHNOLOGY-STACK.md](./01-TECHNOLOGY-STACK.md): complete dependency reference

---

*Last Updated: May 16, 2026*
