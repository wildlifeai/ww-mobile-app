# Wildlife Watcher Mobile App: Key User Flows

> [!CAUTION]
> **This file used to be called a "whitelist" and is not one.**
>
> It previously claimed that anything not listed here "can be removed without affecting the application's runtime boundaries". That was never safe and was demonstrably wrong — a 2026-07-27 audit found ~25 live modules missing from it, including `useBleListeners`, `useStartDeployment`, `useEndDeployment`, `useFirmwareUpdate`, `SyncBarrier.ts`, and `src/ble/workflows/resetToDefaults.ts`. **Never delete code on the strength of any document.** `src/` is the only authority on what exists.

The screen, service, hook and BLE-module inventories that used to live here have been removed rather than maintained in parallel. They now have a single home each:

| Looking for | Go to |
|---|---|
| Folder structure, services, hooks, screens, naming conventions | [02-CODEBASE-GUIDE.md](../onboarding/02-CODEBASE-GUIDE.md) |
| Routes and navigation | [`src/navigation/index.tsx`](../../src/navigation/index.tsx), grouped in [01-TECHNOLOGY-STACK.md](../onboarding/01-TECHNOLOGY-STACK.md#route-table) |
| BLE protocol/session/workflow modules | [BLE_Architecture.md](BLE_Architecture.md#file-structure) |
| Data and sync layer | [03-DATA-AND-SYNC.md](../onboarding/03-DATA-AND-SYNC.md) |

What remains below is the part that was genuinely unique to this document: a narrative summary of how the main flows hang together.

---

## Key User Flows

**Initialization Gate** — Checks Android/iOS permissions → verifies the Bluetooth adapter state → validates the local auth token. If any fail, the user is intercepted with an explicit remediation screen before reaching the Bottom Tabs. (There is no location gate; GPS availability is tracked but does not block navigation.)

**Deployment Assembly (Start)** — The user scans a device → the app connects and validates battery/firmware/SD via `useBleSession` + `commandRegistry` → GPS data is supplemented → the app configures the device via `useDeploymentConfiguration` → WatermelonDB commits the record locally via `DeploymentService` and queues an upstream push to Supabase via the sync outbox. Detail: [05-DEVICE-FLOWS.md](../onboarding/05-DEVICE-FLOWS.md).

**End Deployment Sequence** — The user initiates wrap-up → the app reconnects to retrieve final statistics → terminates the deployment locally → attempts a remote sync.

**Dev Deployment** — Engineer Console → Flows → "Dev Deployment Test". Full control over capture method, flash LED, BMP diagnostics and AI model. Detail: [Dev-Deployment-Guide.md](Dev-Deployment-Guide.md).

**Engineer Console** — Two surfaces: a raw terminal line that sends bytes via `writeRaw()` and never enqueues commands, and a Flows modal that runs multi-step workflows behind a session. Detail: [04-ENGINEER-CONSOLE.md](../onboarding/04-ENGINEER-CONSOLE.md).

**Firmware Updates** — BLE (nRF52) via Nordic DFU; Himax (HX6538) via a two-image camera-variant pair staged on the SD card. Detail: [Himax-Firmware-Update.md](Himax-Firmware-Update.md).
