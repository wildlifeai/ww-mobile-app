# Wildlife Watcher Mobile App: Whitelist & Source of Truth

> **Generated on:** April 19th, 2026.
> This document outlines the explicit boundaries of the refactored Wildlife Watcher Mobile Application (`v2.x`). Any code, screen, hook, or service mapping **not** detailed in this list is formally deprecated, legacy, or dead code, and can be removed without affecting the application's runtime boundaries.

---

## 1. Current Screens & Navigation Map

**Primary Root Context (`MainNavigation`)**
*   **System Wrappers**: `AppLoading`, `BluetoothProblems`, `BleProblems` (Rendered depending on low-level global state).
*   **Authentication**: `Login`, `Register`, `ForgotPassword`.

**Bottom Tabs (Secured User Realm, `BottomTabs`)**
The main interface revolves exclusively around 3 horizontal modes:
1.  **Scanner (`DeviceDiscoveryScreen`)**: Default tab. Scans for local hardware.
2.  **Map (`MapsScreen`)**: Mapbox/Geo context mapping active Deployments.
3.  **Projects (`ProjectsListScreen`)**: Lists grouped contexts across the authenticated User profile.

**Deep Realm Flows (Stack Navigation)**
*   **User/Profile**: `Notifications`, `Profile`, `Settings`.
*   **Project Context**: `NewProjectScreen`, `ProjectDetailsScreen`, `EditProjectScreen`, `ProjectMembersScreen`, `ProjectDevicesScreen`.
*   **Deployment Lifecycle Wizards**: 
    *   **Start**: `StartDeploymentWizard` -> `StartMonitoringDetailsStep` -> `AddDeployment`.
    *   **Management**: `DeploymentDetails` (Monitoring).
    *   **End**: `StopMonitoringWizard` -> `EndStartMonitoringDetailsStep`.
*   **Hardware / Connectivity**:
    *   `DeviceDetails`: Management screen for a synchronized device.
    *   `EngineerConsoleScreen`: Pure terminal — raw serial access to the BLE module via `writeRaw()`.
    *   `DfuScreen`: Firmware flashing / OTA updates.
    *   `StandaloneMotionDetectionScreen`: Localized hardware debugging.

---

## 2. Key User Flows

*   **Initialization Gate**: Checks Android/iOS permissions -> Verifies Bluetooth Adapter State -> Validates Local Auth Token. If any fail, intercepts the user with an explicit remediation screen before permitting access to Bottom Tabs.
*   **Deployment Assembly (Start)**: The user scans a device using `StartDeploymentWizard` -> App connects and validates Battery/Firmware/SD metrics via `useBleSession` + `commandRegistry` -> The user supplements GPS data -> App issues configuration via `useDeploymentConfiguration` -> WatermelonDB commits the record locally via `DeploymentService` and queues an upstream push to Supabase via `SyncOutbox`.
*   **End Deployment Sequence**: The user initiates a wrap-up -> the App reconnects to retrieve final statistics from the board -> locally terminates deployment -> attempts remote sync.
*   **Engineering Management**: Specialized users use `EngineerConsoleScreen` to send raw text commands via `writeRaw()` and observe responses passively through `bleEventBus` subscriptions. The console is a **pure terminal** — it does not execute workflows like DFU, capture, or GPS setting.

---

## 3. Active Services (Backend & Data Layer)

*   **Synchronization Core**:
    *   `SupabaseSyncService.ts`: The massive bidirectional heartbeat layer between local SQLite (WatermelonDB) and Supabase Cloud.
    *   `OutboxService.ts`: Local-first mutation queue (stores inserts/updates when offline).
    *   `SyncStateService.ts` / `SyncTriggerService.ts`: Edge resolution metrics.
*   **Data Models (Watermelon Proxy API)**:
    *   `DeploymentService.ts`, `ProjectService.ts`, `DeviceService.ts`, `UserRoleService.ts`, `InvitationService.ts`: Standard CRUD APIs writing directly to local Watermelon Models.
    *   `ReferenceDataService.ts`: Handles static taxonomies like capabilities and firmware registries.
*   **Hardware Edge Contexts**:
    *   `FirmwareService.ts` / `DfuService.ts`: Managing blobs and OTA distribution metrics.
    *   `MockLoRaWANService.ts`: Simulator layer for Lorawan registrations.
*   **Global Singletons**:
    *   `supabase.ts`: Main client connection for edge requests that bypass sync (Auth/Storage).
    *   `auth.ts`: Session lifecycle management.

---

## 4. Public APIs / Hooks

The BLE stack is split into three layers:

**Protocol Layer** (`src/ble/protocol/`):
*   `eventBus.ts` — Central `bleEventBus` dispatcher (6 frozen event types).
*   `rxRouter.ts` — Binary/text classification from raw bytes.
*   `commandRegistry.ts` — Typed command factories with frozen schema.
*   `commandQueue.ts` — Serialized command execution queue.
*   `runCommand.ts` / `runCommandPipeline.ts` — Single and multi-command executors.

**Session Layer** (`src/ble/session/`):
*   `createBleSession.ts` — Deterministic command execution for deployment workflows.

**Hook Layer** (`src/hooks/`):
*   **Core**: `useBle.ts` (scan, connect, writeRaw), `useBleListeners.tsx` (native event routing to `rxRouter`), `useBluetoothStatus.ts`.
*   **Session**: `useBleSession.ts` (React hook wrapping `createBleSession`).
*   **Lifecycle**: `useBleHeartbeat.ts` (inactivity keep-alive), `useBleInitialization.ts` (selftest + UTC sync).
*   **Features**: `useCapturePreview.ts` (camera capture flow), `useDeviceSettings.ts` (CONFIG.TXT management).

The Application Logic relies fundamentally on:
*   `useSupabaseAuth.ts` / `useSupabaseClient.ts`: Remote authentication logic.
*   `useDeploymentConfiguration.ts` / `useDevicePreDeploymentChecks.ts`: The data stores holding active volatile state while progressing through deployment wizards.
*   `useOfflineSync.ts`: Monitors the background connectivity stream.
*   `useGPSLocation.ts` / `useLocationStatus.ts`: Wraps `expo-location` specifically for tagging deployments.
*   `useOptimisticUpdate.ts`: Facilitates UI responses for instantaneous User interactions before the Outbox confirms upstream delivery.
