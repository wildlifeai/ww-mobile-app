# Wildlife Watcher Mobile App: Whitelist & Source of Truth

> **Generated on:** May 16, 2026.
> This document outlines the explicit boundaries of the Wildlife Watcher Mobile Application. Any code, screen, hook, or service **not** detailed in this list is formally deprecated, legacy, or dead code, and can be removed without affecting the application's runtime boundaries.

---

## 1. Current Screens & Navigation Map

**Primary Root Context (`MainNavigation`)**
*   **System Wrappers**: `AppLoading`, `BluetoothProblems`, `BleProblems` (Rendered depending on low-level global state).
*   **Authentication**: `Login`, `Register`, `ForgotPassword`.

**Bottom Tabs (Secured User Realm, `BottomTabs`)**
The main interface revolves around 3 horizontal tabs:
1.  **Scanner (`DeviceDiscoveryScreen`)**: Default tab. Scans for BLE devices.
2.  **Map (`MapScreen`)**: Google Maps with deployment markers (via `src/features/maps/`).
3.  **Projects (`ProjectsListScreen`)**: Lists projects across the authenticated user's organisations.

**Deep Realm Flows (Stack Navigation)**
*   **User/Profile**: `Notifications`, `Profile`, `Settings`.
*   **Project Context**: `NewProjectScreen`, `ProjectDetailsScreen`, `EditProjectScreen`, `ProjectMembersScreen`, `ProjectDevicesScreen`, `ProjectVisualizationScreen`.
*   **Deployment Lifecycle**:
    *   **Start**: `StartMonitoringScreen` → deployment wizard.
    *   **Monitoring**: `DeploymentMonitorView` (shared by standard and dev deployments).
    *   **End**: `StopMonitoringScreen` → end deployment flow.
    *   **Summary**: `DeviceMonitoringSummaryScreen` — post-deployment review.
*   **Hardware / Connectivity**:
    *   `EngineerConsoleScreen`: Terminal — raw serial access to BLE module via `writeRaw()`.
    *   `DfuScreen`: Firmware flashing / OTA updates.
    *   `StandaloneMotionDetectionScreen`: Motion detection stream for hardware debugging.
    *   `StandaloneCapturePreviewScreen`: Camera capture preview.
*   **Engineer Console Flows** (accessible from Flows menu):
    *   `DevDeploymentTestScreen`: Developer deployment with full parameter control.
    *   `FirmwareUpdateScreen` / `FirmwareStatusScreen`: Himax firmware management.
    *   `AiModelTransferScreen`: AI model upload to device SD card.
    *   `ConfigTransferScreen`: CONFIG.TXT transfer.
    *   `FileTransferTestScreen`: Generic file transfer testing.
    *   `ModelValidationTestScreen`: AI model inference validation.
    *   `CameraSettingsTestScreen`: Camera parameter experimentation.
    *   `DeviceResetScreen`: Factory defaults reset flow.

---

## 2. Key User Flows

*   **Initialization Gate**: Checks Android/iOS permissions → Verifies Bluetooth Adapter State → Validates Local Auth Token. If any fail, intercepts the user with an explicit remediation screen before permitting access to Bottom Tabs.
*   **Deployment Assembly (Start)**: The user scans a device → App connects and validates battery/firmware/SD via `useBleSession` + `commandRegistry` → GPS data supplemented → App configures device via `useDeploymentConfiguration` → WatermelonDB commits the record locally via `DeploymentService` and queues upstream push to Supabase via `SyncOutbox`.
*   **End Deployment Sequence**: The user initiates wrap-up → App reconnects to retrieve final statistics → locally terminates deployment → attempts remote sync.
*   **Dev Deployment**: Developer uses Engineer Console → Flows → "Dev Deployment Test". Full control over capture method, flash LED, BMP diagnostics, and AI model. See [Dev-Deployment-Guide.md](Dev-Deployment-Guide.md).
*   **Engineering Console**: Specialized users use `EngineerConsoleScreen` to send raw text commands via `writeRaw()` and observe responses through `bleEventBus`. Supports Flows (multi-step workflows) and Commands (atomic BLE operations). See [04-ENGINEER-CONSOLE.md](../onboarding/04-ENGINEER-CONSOLE.md).

---

## 3. Active Services (Backend & Data Layer)

*   **Synchronization Core**:
    *   `SupabaseSyncService.ts`: Bidirectional sync between local SQLite (WatermelonDB) and Supabase Cloud.
    *   `OutboxService.ts`: Local-first mutation queue (stores inserts/updates when offline).
    *   `SyncStateService.ts` / `SyncTriggerService.ts`: Sync coordination and edge resolution.
*   **Data Models (WatermelonDB Services)**:
    *   `DeploymentService.ts`, `ProjectService.ts`, `DeviceService.ts`, `UserRoleService.ts`, `InvitationService.ts`: Standard CRUD APIs writing to local WatermelonDB models.
    *   `ReferenceDataService.ts`: Static taxonomies (capabilities, firmware registries).
    *   `AiModelService.ts`: AI model metadata and registration.
*   **Hardware Services**:
    *   `FirmwareService.ts` / `DfuService.ts`: Firmware blob management and OTA distribution.
    *   `MockLoRaWANService.ts`: Simulator layer for LoRaWAN registrations.
*   **Global Singletons**:
    *   `supabase.ts`: Main client for edge requests that bypass sync (Auth/Storage).
    *   `auth.ts`: Session lifecycle management.

---

## 4. Public APIs / Hooks

### BLE Stack (3 layers)

**Protocol Layer** (`src/ble/protocol/`):
*   `eventBus.ts` — Central `bleEventBus` dispatcher (frozen event types).
*   `rxRouter.ts` — Binary/text classification from raw bytes.
*   `commandRegistry.ts` — Typed command factories with frozen schema.
*   `runCommandPipeline.ts` — Multi-command executor.
*   `bleTransportController.ts` — Low-level BLE transport management.
*   `deviceSignals.ts` — Device state signal management.
*   `textStreamScope.ts` — Text stream scoping for command responses.
*   `protocolConstants.ts` — Protocol-level constants (MTU, timeouts).

**File Transfer** (`src/ble/protocol/fileTransfer/`):
*   `runFileTransferPipeline.ts` — Chunked file transfer orchestration.
*   `fileTransferPackets.ts` — Packet framing and serialization.
*   `ackMatcher.ts` — Acknowledgment matching for reliable delivery.
*   `crc16ccitt.ts` — CRC-16 checksum for data integrity.
*   `filenameValidator.ts` — SD card filename validation.

**Session Layer** (`src/ble/session/`):
*   `createBleSession.ts` — Deterministic command execution for deployment workflows.

**Workflows** (`src/ble/workflows/`):
*   `deploymentPipeline.ts` — Shared deployment pipeline (syncTime, syncAiModel, configureDevice).
*   `checkSdCard.ts` — SD card health validation.

### Application Hooks (`src/hooks/`)

*   **BLE Core**: `useBle.ts` (scan, connect, writeRaw), `useBleSession.ts` (React wrapper for `createBleSession`), `useBluetoothStatus.ts`, `useSetupBLELibrary.ts`.
*   **BLE Lifecycle**: `useBleHeartbeat.ts` (inactivity keep-alive), `useBleInitialization.ts` (selftest + UTC sync), `useEngineerConnect.ts` (console connection management), `useScanLoop.ts` (continuous BLE scanning).
*   **BLE Features**: `useCapturePreview.ts` (camera capture flow), `useDeviceSettings.ts` (CONFIG.TXT / OP parameter management), `useMonitoringActions.ts` (deployment monitoring commands).
*   **Deployment**: `useDeploymentConfiguration.ts` (capture method → OP mapping), `useDevicePreDeploymentChecks.ts` (battery/firmware/SD validation), `useDeploymentProgress.ts` (deployment progress tracking).
*   **Auth**: `useSupabaseAuth.ts`, `useSupabaseClient.ts`.
*   **Location**: `useGPSLocation.ts` (deployment GPS tagging), `useAndroidPermissions.ts`.
*   **Sync**: `useOfflineSync.ts` (background connectivity monitoring), `useOptimisticUpdate.ts` (UI responses before outbox confirms).
*   **Navigation**: `useDeepLinking.ts` (deep link handling).
*   **Misc**: `useTimer.ts`, `useUserOrganisations.ts`.

---

*Last Updated: May 16, 2026*
