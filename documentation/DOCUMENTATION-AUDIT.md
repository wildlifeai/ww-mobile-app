# Documentation Audit — `documentation/`

**Date:** 2026-07-27
**Scope:** all 27 files under `documentation/` (onboarding/, resources/, development reports/), cross-checked against the code at `3d26702` (v0.0.61).
**Method:** full read of every document, then verification of concrete claims (file paths, versions, constants, schemas, scripts, routes) against `src/`, `package.json`, `eas.json`, `.github/workflows/`.

> **Remediation status (branch `chore/docs-audit-remediation-v0.0.62`):** all "Immediately" items (1–5) and all "Next" items (6–12) from Part 5 are applied, plus §2.9 (dependency script table), §2.10–2.12, §1.13 (EAS profiles) and the §1.4 console-scope contradiction. `npm run docs:validate` and `npm run version:check` now guard against recurrence in CI. Remaining open: the consolidation work (Part 5 items 13–19) and the Part 3 gaps.

**Headline:** the documentation set is unusually rich and well written, but it has drifted badly in three specific areas — **the database layer, the BLE file-transfer protocol, and the service/hook file map**. Roughly 40 verifiable claims are now wrong. Two documents (`whitelist.md`, `File-Transfer-Protocol.md`) are actively dangerous to trust as written.

---

## Severity summary

| # | Finding | Severity |
|---|---|---|
| A1 | Schema version documented as 185; actual is **402**. Table count documented as 15; actual is **45**. | 🔴 Critical |
| A2 | `File-Transfer-Protocol.md` describes strict stop-and-wait; code ships **credit streaming, window=12, cumulative ACKs**. | 🔴 Critical |
| A3 | `whitelist.md` claims to be an exhaustive "source of truth" and licences deletion of anything absent — it omits ~15 live modules. | 🔴 Critical |
| A4 | Sync/outbox service paths wrong in 2 of 3 docs (`services/offline/` vs `services/`). | 🟠 High |
| A5 | Scan session duration: 15 s vs 60 s, documented both ways. Code says 15 s. | 🟠 High |
| A6 | `commandQueue.ts` documented as a real file in 2 docs; it does not exist. | 🟠 High |
| A7 | `LocationProblems` navigation gate documented in 2 docs; it does not exist anywhere in `src/`. | 🟠 High |
| A8 | Engineer Console described as "pure terminal, no workflows" in one doc and as a workflow launcher in another. | 🟠 High |
| A9 | July dev reports contradict each other and the May resource docs on transfer architecture. | 🟠 High |
| A10 | AI model filename format documented three different ways. | 🟡 Medium |
| A11 | Error-code → failure-mode table in `File-Transfer-Protocol.md` self-contradicts. | 🟡 Medium |
| A12 | Bare vs managed Expo workflow contradiction. | 🟡 Medium |
| A13 | EAS profile / Supabase environment table wrong in 2 docs. | 🟡 Medium |
| A14 | Dependency-validation npm script table wrong in 4 of 7 rows. | 🟡 Medium |
| A15 | Large-scale redundancy: hook/service/route inventories duplicated across 4 documents, all diverged. | 🟡 Medium |

---

# Part 1 — Contradictions between documents

### 1.1 Where does `SupabaseSyncService` live? (3 docs, 2 answers)

| Doc | Claim |
|---|---|
| [01-TECHNOLOGY-STACK.md:199](onboarding/01-TECHNOLOGY-STACK.md) | `services/SupabaseSyncService.ts` |
| [02-CODEBASE-GUIDE.md:164](onboarding/02-CODEBASE-GUIDE.md) | `services/offline/SupabaseSyncService.ts` |
| [03-DATA-AND-SYNC.md:202](onboarding/03-DATA-AND-SYNC.md) | `src/services/offline/SupabaseSyncService.ts` |

**Code:** `src/services/SupabaseSyncService.ts`. `src/services/offline/` contains exactly one file — `OfflineService.ts`. `OutboxService.ts`, `SyncStateService.ts` and `SyncTriggerService.ts` are all at `src/services/` top level, not under `offline/`.

01 is right; 02 and 03 are wrong, including the "Quick Navigation Cheatsheet" in 02 that a new engineer would use first.

### 1.2 Scan session duration — 15 s or 60 s?

- [06-BLE-CONNECTIONS.md:13](onboarding/06-BLE-CONNECTIONS.md) — "15 s countdown (`idle → active → expired`)"
- [BLE_Architecture.md:346](resources/BLE_Architecture.md) — "User presses 'Search' → 60-second countdown session", repeated at lines 363, 371, 376.

**Code:** `src/screens/Devices/hooks/useDeviceDiscovery.ts:93` — `const SCAN_DURATION_SECONDS = 15`. 06 is correct; `BLE_Architecture.md` is wrong in four places.

Related: `BLE_Architecture.md` says the session starts on a "Search" button press; [05-DEVICE-FLOWS.md:12](onboarding/05-DEVICE-FLOWS.md) says the Scanner tab "auto-scans … when the scanner tab is active". Both can't be the entry contract.

### 1.3 Event bus — 6 or 7 event types?

- [01-TECHNOLOGY-STACK.md:336](onboarding/01-TECHNOLOGY-STACK.md) — "Central event dispatcher (6 frozen event types)"
- [BLE_Architecture.md:65](resources/BLE_Architecture.md) — "emits **7 event types**. This contract is frozen."

**Code:** `src/ble/protocol/eventBus.ts` defines 7 (`TEXT_LINE`, `RAW_TX`, `RAW_RX`, `BINARY_PACKET`, `QUEUE_STATE_CHANGED`, `DEVICE_SIGNAL`, `HEARTBEAT_PAUSE`) plus an `any` wildcard channel that neither doc mentions.

### 1.4 Is the Engineer Console a terminal or a workflow launcher?

[BLE_Architecture.md:754-767](resources/BLE_Architecture.md) is emphatic:

> The Engineer Console is a **pure terminal** … **What the Engineer Console does NOT do:** ❌ Execute workflow actions (DFU, capture, GPS, motion detection) ❌ Import or use `useCapturePreview` …
> **Never** call `bleSession.execute()` from the Engineer Console.

[04-ENGINEER-CONSOLE.md:202-252](onboarding/04-ENGINEER-CONSOLE.md) then documents 11 Flows launched *from* the Engineer Console, including `CAPTURE_PREVIEW` ("sends `AI capture 1 500`, receives the image via BLE binary transfer"), `RESET_TO_DEFAULTS` ("Uses `useDeviceSettings.resetToDefaults()`"), `UPDATE_HIMAX_FIRMWARE`, and `MODEL_VALIDATION_TEST`.

**Code:** both readings are partly true, which is why this needs resolving explicitly. `useEngineerConsoleActions.ts:19,53` uses only `writeRaw` — the *typed command line* is a pure terminal. But `src/components/FlowsReferenceModal.tsx` and the `type: 'process'` entries in `src/ble/types.ts:597-660` do launch workflows and navigate to workflow screens from the same screen. The invariant as stated in `BLE_Architecture.md` is false; what's actually true is narrower ("the console's raw input path never enqueues typed commands").

The same doc's **Connection Ownership** table ([BLE_Architecture.md:963-972](resources/BLE_Architecture.md)) marks `EngineerConsoleScreen` as **Can Connect ❌**, while [04-ENGINEER-CONSOLE.md:14](onboarding/04-ENGINEER-CONSOLE.md) and [06-BLE-CONNECTIONS.md:10-22](onboarding/06-BLE-CONNECTIONS.md) both describe the console owning its own scanner, `flushBleCache`, and auto-connect via `useEngineerConnect`.

### 1.5 Is `pipeline.resetOps()` the same as the console's `RESET_TO_DEFAULTS`?

- [04-ENGINEER-CONSOLE.md:223](onboarding/04-ENGINEER-CONSOLE.md) — `RESET_TO_DEFAULTS` is "**More aggressive** than `pipeline.resetOps()` which skips configure-managed OPs."
- [05-DEVICE-FLOWS.md:147](onboarding/05-DEVICE-FLOWS.md) — "the pipeline resets the device using the shared `RESET_TO_DEFAULTS` workflow (`executeResetToDefaults`). This is the **exact same logic** used by the Engineer Console's manual reset."

Directly opposed. (`src/ble/workflows/resetToDefaults.ts` exists and is shared, but neither doc lists it in any file tree — see 3.4.)

### 1.6 `NUM_PICTURES` default is 1, 2, or 3

| Source | Default |
|---|---|
| [04-ENGINEER-CONSOLE.md:136](onboarding/04-ENGINEER-CONSOLE.md) (`SET_NUM_PICTURES` shortcut) | 3 |
| [04-ENGINEER-CONSOLE.md:151](onboarding/04-ENGINEER-CONSOLE.md) (OP index table) | 1 (Dev Deployment sets 2) |
| [Dev-Deployment-Guide.md:109](resources/Dev-Deployment-Guide.md) | 2 |

Both `04` tables are in the same document, four sections apart.

### 1.7 Himax reset command: `reset` or `AI reset`?

- [04-ENGINEER-CONSOLE.md:230](onboarding/04-ENGINEER-CONSOLE.md) — "`AI firmware` + `AI reset`"
- [Himax-Firmware-Update.md:134](resources/Himax-Firmware-Update.md) — "Sends the `reset` command → `Device will reset after disconnecting.`"
- [04-ENGINEER-CONSOLE.md:65](onboarding/04-ENGINEER-CONSOLE.md) lists `reset` as an **nRF52** (non-`AI`) command with exactly that response string.

`AI reset` appears nowhere in the command reference. 04's Flows table is wrong.

### 1.8 AI model filename format — three answers

| Source | Format |
|---|---|
| [04-ENGINEER-CONSOLE.md:128](onboarding/04-ENGINEER-CONSOLE.md) | `1V1.tflite` |
| [AI-Model-Integration.md:30,90](resources/AI-Model-Integration.md) | `42V2.TFL` — `${firmwareModelId}V${versionNumber}.TFL` |
| [empty_sd_update_architecture.md:142](development%20reports/empty_sd_update_architecture.md) | `PPPPVN.TFL` parsed as `%4dV%d`, e.g. `0001V2.TFL` (zero-padded to 4) |

`.tflite` is not 8.3-legal and the file-transfer layer rejects non-8.3 names, so `04` is certainly wrong. Whether the ID is zero-padded is a real functional question the docs answer two ways.

Labels file: `AI-Model-Integration.md:141` says the firmware loads "`labels.txt`"; `empty_sd_update_architecture.md:142` says labels are `PPPPVN.TXT` with the same basename as the model, derived by `load_labels_from_manifest()`. These are incompatible.

### 1.9 Auth screen file paths

- [02-CODEBASE-GUIDE.md:104-109](onboarding/02-CODEBASE-GUIDE.md) — `navigation/screens/Login.tsx`, `Register.tsx`, `Profile.tsx`, `Settings.tsx`, `ForgotPassword.tsx`
- [Authentication-Implementation-Guide.md:53](resources/Authentication-Implementation-Guide.md) — `src/navigation/screens/auth/LoginScreen.tsx`, `RegisterScreen.tsx`, `ForgotPasswordScreen.tsx`

**Code:** the Authentication guide is right. Actual layout is `src/navigation/screens/{auth,developer,system,user}/` with `Screen`-suffixed filenames. 02's tree — the one an onboarding engineer reads first — is wrong on both the folder and the filenames.

### 1.10 Maps module structure

- [01-TECHNOLOGY-STACK.md:310-321](onboarding/01-TECHNOLOGY-STACK.md) — flat list of 7 files directly under `features/maps/`
- [Maps.md:12-27](resources/Maps.md) — nested `components/`, `hooks/`, `screens/`, `types/`

**Code:** Maps.md is right. 01 also omits `LocationPermissionPrompt.tsx`.

### 1.11 Bare workflow or managed workflow?

- [00-GETTING-STARTED.md:130](onboarding/00-GETTING-STARTED.md) / [01-TECHNOLOGY-STACK.md:16](onboarding/01-TECHNOLOGY-STACK.md) — "Expo SDK ~54.0.32 — **Managed workflow** with dev client"
- [Dependency-Validation-System.md:23,77](resources/Dependency-Validation-System.md) — blocks packages "incompatible with Expo **managed** workflow"
- [Android-Guide.md:54](resources/Android-Guide.md) — "Because this is a **Bare workflow** project where the `android/` folder is tracked in Git…"
- [Expo-EAS-Guide.md:115](resources/Expo-EAS-Guide.md) — "**Native File Secret Leaks (Bare Workflow)**"
- [publishing_guide.md:77](resources/publishing_guide.md) — "EAS Build acts as a **bare** React Native builder"

The repo tracks `android/` and requires `npx expo prebuild` in the release process, so it is a prebuild/bare setup. The onboarding docs' "managed workflow" framing is wrong and it changes how a new engineer reasons about `app.config.ts`, secrets, and version bumps.

### 1.12 Install command

- [00-GETTING-STARTED.md:75,95](onboarding/00-GETTING-STARTED.md) — `npm install --ignore-scripts` (twice, for both Docker and native paths)
- [Docker-Development-Guide.md:37](resources/Docker-Development-Guide.md) — `npm install`
- [Dependency-Validation-System.md:442](resources/Dependency-Validation-System.md) — claims validation runs automatically on install

`--ignore-scripts` skips `postinstall`, which is `npx patch-package && npm run validate:deps` (`package.json:57`). Following the getting-started guide means **`patches/` are never applied** and dependency validation never runs. This is the single most likely cause of "works on my machine" onboarding failures in the set.

### 1.13 EAS profiles and Supabase environments

Both [Expo-EAS-Guide.md:58-62](resources/Expo-EAS-Guide.md) and [publishing_guide.md:9-13](resources/publishing_guide.md) publish this table:

| Profile | Doc says Supabase |
|---|---|
| `development` | Dev (`qegeovogqxiouqbrxmnh`) |
| `preview` | Stag (`nuhwmubvygxyddkycmpa`) |
| `production` | Stag (`nuhwmubvygxyddkycmpa`) |

**Actual `eas.json`:** five profiles — `ci`, `development`, `staging`, `preview`, `production`. `development` sets **no** `EXPO_PUBLIC_SUPABASE_ENV` at all; `preview` → `cloud-dev`; `staging` → `cloud-staging`; `production` → `cloud-staging`. Neither project ref appears in `eas.json`. The `ci` and `staging` profiles are undocumented, and the `preview` mapping is inverted relative to the docs.

### 1.14 The three file-transfer documents disagree with each other

| Claim | `File-Transfer-Protocol.md` (May) | `fast_file_transfer_proposal.md` (8 Jul) | `empty_sd_update_architecture.md` (10 Jul) |
|---|---|---|---|
| Transport mode | strict stop-and-wait, "no pipelining" | Phase 2 window=2 implemented; Phase 3 credit streaming **FUTURE** | window **12**, cumulative acks, "working, device-verified" |
| Throughput | ~2–4 KB/s | 0.24 KB/s today → 3–6 KB/s (Ph1) → 6–10 (Ph2) | ~8 KB/s for 24 s, then ~1.3 KB/s |
| Mid-transfer `requestConnectionPriority` | not mentioned | **required** — "at the start of every transfer" (Phase 1, IMPLEMENTED) | **"Do not** re-request CONNECTION_PRIORITY_HIGH mid-transfer (desyncs nRF↔HX I2C — measured)" |
| nRF FIFO depth | n/a | 4 slots | 16 slots |
| CRC scope | whole file only, "does NOT include … packet headers" | whole file | "CRC16-CCITT **per-packet** + whole-file" |

Two documents written two days apart give opposite instructions on connection priority. That is an operational hazard, not a cosmetic inconsistency.

### 1.15 `FILE_START` payload field order

- [File-Transfer-Protocol.md:56](resources/File-Transfer-Protocol.md) — `[size_u32_LE][filename\0]` (worked hex example agrees)
- [sliding_window_file_transfer.md:267](development%20reports/sliding_window_file_transfer.md) — "filename (8.3, null-padded) + file size (4 bytes LE)"

Reversed. The worked example in `File-Transfer-Protocol.md` makes it the credible one, but a firmware engineer handed the sliding-window doc would build the wrong parser.

### 1.16 `File-Transfer-Protocol.md` contradicts itself on error codes

Its own error table (lines 175-186) vs its own failure-injection table (lines 212-221):

| Injection test | Doc says | Error table says that code means |
|---|---|---|
| Wrong packet number | `ftx err 9` | 9 = CRC mismatch (8 = sequence mismatch) |
| Wrong CRC | `ftx err 6` | 6 = failed to open/create file (9 = CRC mismatch) |
| SD card removed | `ftx err 5` | 5 = filename validation failed on HX6538 |

The error table matches `sliding_window_file_transfer.md:246-257` and the "Common Failures" section further down the same file, so the injection table is the outlier.

**Correction (post-verification):** on retry *policy* the resource doc is the accurate one. `File-Transfer-Protocol.md`'s column matches `ERROR_RETRY_POLICY` in `fileTransferTypes.ts:49-60` exactly (1 → `auto_once`, 7 → `operator`, 9 → `auto_once`). It is `sliding_window_file_transfer.md` that diverges by marking 1 and 9 as "Fail".

### 1.17 Test-account roles include a role that doesn't exist

[Testing-Guide.md:264-272](resources/Testing-Guide.md) lists an **"Org Manager"** role for two seeded users. The type is `UserRole = "ww_admin" | "project_admin" | "project_member"` ([authSlice.ts](../src/redux/slices/authSlice.ts), documented in [Authentication-Implementation-Guide.md:140](resources/Authentication-Implementation-Guide.md) and [01-TECHNOLOGY-STACK.md:111](onboarding/01-TECHNOLOGY-STACK.md)). The permission matrix immediately below in the same Testing-Guide section has only three columns. A reader cannot tell what "Org Manager" maps to.

---

# Part 2 — Documentation that contradicts the code

Verified against `3d26702`.

### 2.1 🔴 Database schema version and table count

| Claim | Documented | Actual |
|---|---|---|
| Schema version | **185** — [01:126](onboarding/01-TECHNOLOGY-STACK.md), [02:265](onboarding/02-CODEBASE-GUIDE.md), [03:54,408](onboarding/03-DATA-AND-SYNC.md) | **402** (`src/database/schema.ts:15`) |
| Table count | **15** — [02:265](onboarding/02-CODEBASE-GUIDE.md), [03:54,112](onboarding/03-DATA-AND-SYNC.md) | **45** (`tableSchema({` occurrences) |
| Model count | "15 models total" — [02:271](onboarding/02-CODEBASE-GUIDE.md) | 16 files in `src/database/models/` |

`03-DATA-AND-SYNC.md:408` instructs engineers to "Increment version number (currently 185)" — following that literally would corrupt local databases. The model table in `01-TECHNOLOGY-STACK.md:130-145` also omits `AiModelFamily`, which `AI-Model-Integration.md` treats as central.

### 2.2 🔴 File transfer is not stop-and-wait

`File-Transfer-Protocol.md` is the canonical reference and states (lines 37-46): "The protocol is **strict stop-and-wait** … **No pipelining** — Next packet is not sent until `ftx ack <N>` is received".

**Code:** `src/ble/protocol/fileTransfer/runFileTransferPipeline.ts:112` — `const windowSize = requestedWindowSize ?? 12`, and line 527 logs `DATA phase: credit streaming (window=${windowSize})`, line 521 documents cumulative in-order ACKs. Stop-and-wait is the `windowSize <= 1` branch (line 438) — a fallback, not the default.

Consequences within the same document: the "Transport Guarantees" table, "App Behavior" step 7, the "Retry Behavior" table, and the entire "Expected Performance" table (~2–4 KB/s) are all describing a code path that no longer runs by default. Packet type `0x0A` (`FILE_LOOPBACK`), documented in the dev reports and referenced in current firmware work, is missing from its packet table entirely.

`ACK_TIMEOUT_MS = 10_000` and `SILENCE_TIMEOUT_MS = 15_000` (`fileTransferTypes.ts:23,26`) do still match the doc.

### 2.3 🔴 `whitelist.md` is not a whitelist

The document opens with:

> Any code, screen, hook, or service **not** detailed in this list is formally deprecated, legacy, or dead code, and can be removed without affecting the application's runtime boundaries.

Live modules absent from it include: `useBleListeners`, `useAppNavigation`, `useDeviceDiscovery`, `useAutoConnectStateMachine`, `useMotionDetectionStream`, `useStartDeployment`, `useEndDeployment`, `useDeploymentMonitor`, `useFirmwareUpdate`, `useFirmwareStatus`, `useDevDeployment`, `useConsoleReducer`, `useCameraSwitch`, `useResolutionSwitch`, `useLightSensor`, `useDeviceSelfTest`, `useReconnectDevice`, `useSelectDevice`, `useInterval`, `SyncBarrier.ts`, `DeploymentPhotoService.ts`, `OfflineService.ts`, `src/ble/workflows/resetToDefaults.ts`, `src/ble/workflows/configVerification.ts`, `LightSensorScreen`, `EditProjectScreen`, `ProjectDevicesScreen`, `Tutorial`.

It also lists `LocationProblems` implicitly by omission but includes `BleProblems`/`BluetoothProblems`, and its Bottom Tabs section describes a `ProjectsListScreen` that does not exist under that name. As a deletion licence this is unsafe; as an inventory it is 3 months stale.

### 2.4 🟠 `commandQueue.ts` does not exist

- [00-GETTING-STARTED.md:221](onboarding/00-GETTING-STARTED.md) — "Commands are serialized through `commandQueue`"
- [01-TECHNOLOGY-STACK.md:339](onboarding/01-TECHNOLOGY-STACK.md) — table row: `src/ble/protocol/commandQueue.ts` — "Serialized command execution queue"
- `BLE_Architecture.md` refers to `commandQueue` in prose and sequence diagrams throughout

**Code:** `find src -name "commandQueue*"` → nothing. The real module is `src/ble/protocol/bleTransportController.ts`, which `02-CODEBASE-GUIDE.md` and the `BLE_Architecture.md` file tree both name correctly. The prose and the file tree of the same document disagree.

### 2.5 🟠 The `LocationProblems` navigation gate does not exist

- [01-TECHNOLOGY-STACK.md:246-256](onboarding/01-TECHNOLOGY-STACK.md) — mermaid guard: "Location enabled? — No → LocationProblems screen"
- [Authentication-Implementation-Guide.md:29](resources/Authentication-Implementation-Guide.md) — `if (!locationEnabled) → LocationProblems screen`
- [01:472](onboarding/01-TECHNOLOGY-STACK.md) — "Bluetooth/Location off | Navigation guard shows dedicated problem screens"

**Code:** `grep -rn "LocationProblems" src/` returns nothing. `src/navigation/index.tsx` renders `AppLoading`, `BluetoothProblems`, `BLEProblems` only. A `locationStatusSlice` exists but no screen consumes it as a gate.

### 2.6 🟠 Redux store shape

- [02-CODEBASE-GUIDE.md:342](onboarding/02-CODEBASE-GUIDE.md) — "16 feature reducers and 4 RTK Query API middlewares"
- [01-TECHNOLOGY-STACK.md:56-73](onboarding/01-TECHNOLOGY-STACK.md) — 16-row table (12 feature + 4 API)

**Code:** `src/redux/index.ts` — **13** feature reducers + 4 API reducers = 17 keys. Neither doc lists `location` (`locationSlice.ts`), which is distinct from `locationStatus`. `02` also names the slice `deploymentSlice`; the actual export is `deploymentsSlice`.

### 2.7 🟠 Route table is stale

[01-TECHNOLOGY-STACK.md:217-240](onboarding/01-TECHNOLOGY-STACK.md) documents routes that do not exist — `DeviceDetails`/`DeviceDetailsScreen` (no such file anywhere in `src/`), `AddDeployment`, `StartDeploymentWizard`, `StartMonitoringDetailsStep`, `StopMonitoringWizard`, `EndStartMonitoringDetailsStep` — and omits routes that do: `Tutorial`, `EditProjectScreen`, `ProjectDevicesScreen`, `DeviceMonitoringSummary`, `LightSensorScreen`, `StandaloneCapturePreviewScreen`, `StandaloneMotionDetectionScreen`, `CameraSettingsTestScreen`, `FirmwareUpdateScreen`, `FileTransferTestScreen`, `ModelValidationTestScreen`, `ConfigTransferScreen`, `AiModelTransferScreen`.

`05-DEVICE-FLOWS.md` inherits the error by naming screens `StartMonitoringDetailsStep` / `EndStartMonitoringDetailsStep` throughout.

### 2.8 🟠 The "frozen" `CommandContext` schema is missing two fields

[BLE_Architecture.md:186-218](resources/BLE_Architecture.md) presents the interface as frozen. `src/ble/protocol/commandRegistry.ts:50,54` also defines `isLongRunning?: boolean` and `requiresExclusiveLock?: boolean`.

[Himax-Firmware-Update.md:104-105](resources/Himax-Firmware-Update.md) uses both fields in its `aifirmware` example — so the Himax doc silently documents an extension the "frozen" contract denies exists.

### 2.9 🟡 Dependency-validation script table is wrong

[Dependency-Validation-System.md:434-445](resources/Dependency-Validation-System.md) presents these as "already configured in `package.json`":

| Documented | Actual (`package.json`) |
|---|---|
| `"deps": "node scripts/manage-dependency-rules.js"` | `node scripts/deps-cli.js` |
| `"deps:add"`, `"deps:scan"` → `manage-dependency-rules.js` | → `deps-cli.js` |
| `"prebuild:check": "bash scripts/pre-build-check.sh"` | `node scripts/validate-build-env.js && npm run db:sync-schema && bash scripts/pre-build-check.sh` |
| `"preinstall": "node scripts/validate-deps.js \|\| true"` | **no `preinstall` script exists** |
| `"postinstall": "node scripts/post-install-helper.js"` | `npx patch-package && npm run validate:deps` |

Only `validate:deps` is accurate. The doc's EAS integration section (lines 490-508) also shows `prebuildCommand` entries that are absent from the real `eas.json`, presented as configuration rather than as a proposal.

### 2.10 🟡 React Doctor config filename

[Testing-Guide.md:250](resources/Testing-Guide.md) — "Config: `react-doctor.config.json`". The file is `doctor.config.json`, which [React-Doctor-Guide.md:40](resources/React-Doctor-Guide.md) gets right.

### 2.11 🟡 Testing-Guide "Known Issues" describes a file that isn't there

[Testing-Guide.md:391](resources/Testing-Guide.md) — "`src/ble/__tests__/commandManager.test.ts` is skipped (`.skip.ts`)". That directory contains `messageClassifier.test.ts` and `transport.test.ts` only. Likewise `BLE_Architecture.md:862` claims a `src/ble/session/__tests__/` directory — `src/ble/session/` contains only `createBleSession.ts`.

Testing-Guide also gives two different Supabase mock paths in adjacent code blocks: `'../../test/mocks/supabase'` (line 49) and `tests/__mocks__/supabase.ts` (line 57).

### 2.12 🟡 `react-native-nordic-dfu` is not a dependency

[Android-Guide.md:73](resources/Android-Guide.md) flags `react-native-nordic-dfu` as the **High** risk item for 16 KB page-size compliance — "Custom fork with native C/C++". The actual DFU dependency is `@getquip/expo-nordic-dfu@^2.0.3`. The 16 KB risk assessment is therefore evaluating the wrong package.

### 2.13 🟡 Line-count citations have drifted

Several docs cite exact line counts as identity markers:

| Doc claim | Actual |
|---|---|
| `SupabaseSyncService.ts` (1325 lines) — 01, 03 | 1279 |
| `auth.ts` (~559 lines) — Auth guide | 608 |
| `authSlice.ts` (~283 lines) — Auth guide | 331 |
| `supabase.ts` (~387 lines) — Auth guide | 386 |
| `AuthProvider.tsx` (~50 lines) — Auth guide | 57 |
| `validate-deps.js` (~380), `manage-dependency-rules.js` (~474) — Dependency doc | 379, 473 |

Individually trivial; collectively they guarantee the docs look stale even when the prose is fine. Recommend dropping line counts entirely.

### 2.14 🟡 Miscellaneous verified errors

- [01-TECHNOLOGY-STACK.md:37,54,85,100,…](onboarding/01-TECHNOLOGY-STACK.md) uses ~20 absolute local file URLs of the form `file:///c:/dev/ww/src/App.tsx`. These are broken links for everyone except the original author, and they leak a personal path. All other docs use repo-relative links correctly.
- [Authentication-Implementation-Guide.md:288](resources/Authentication-Implementation-Guide.md) — "Verify URL scheme in `app.config.js`". The file is `app.config.ts`.
- [Authentication-Implementation-Guide.md:116](resources/Authentication-Implementation-Guide.md) — `fetchUserOrganisations` "Query `user_organisations` table". No such table appears in any schema documentation; `03-DATA-AND-SYNC.md:78` states `user_roles` replaced the legacy membership tables.
- [AI-Model-Integration.md:6,145](resources/AI-Model-Integration.md) links to `../../../ww-website/documentation/resources/embedded-model-lifecycle.md` — a path outside this repository that resolves for nobody who hasn't cloned `ww-website` as a sibling.
- [BLE_Architecture.md:742](resources/BLE_Architecture.md) says the heartbeat sends a keep-alive; `src/hooks/useBleHeartbeat.ts:6` header comment says it sends `AI selftest` while the code at line 65 sends `get heartbeat`. The doc matches the code; the *code comment* is the stale one — worth fixing in the same pass.
- [Testing-Guide.md:9](resources/Testing-Guide.md) puts unit tests at `src/**/__tests__/*.test.ts` while [02-CODEBASE-GUIDE.md:426](onboarding/02-CODEBASE-GUIDE.md) says "Tests | `tests/`". Both exist plus a root `__tests__/App.test.tsx`; no doc explains the three-way split.
- [Testing-Guide.md:239-251](resources/Testing-Guide.md) lists 2 of the 10 GitHub workflows. `cloud-type-validation.yml`, `e2e-ui-tests.yml`, `native-build-validation.yml`, `type-validation.yml`, `release-publish.yml`, `commitlint.yml`, `pr-agent-review.yml` are undocumented anywhere.

---

# Part 3 — Gaps

### 3.1 The Himax firmware doc predates the dual-slot pipeline

[Himax-Firmware-Update.md](resources/Himax-Firmware-Update.md) (June 15) documents a single `AI firmware <file>` → `reset` flow. [empty_sd_update_architecture.md](development%20reports/empty_sd_update_architecture.md) (July 10) states that the implemented flow is a **dual-image, dual-slot pair** driven by `useFirmwareUpdate.runHimaxUpdate()` using an `AI slots` query, taking ~8–9 minutes for both images, with `switchslot` rollback and a `configVerification.ts` CONFIG.TXT handshake. None of that is in the resource doc. Its timing table ("Total typical duration 20–60 seconds") describes only the flash step and will read as a bug report to any operator who runs the real flow.

Image size also differs: 442 KB (Himax doc) vs 483,328 B / 472 KB (dev report); command timeout 120 s vs the dev report's recommended 90 s.

### 3.2 No document covers the app's own configuration surface

There is no guide to `.env.example` / `.env.development.example` / `EnvironmentManager` / the environment switcher, even though `Expo-EAS-Guide.md` references `getEnvironmentConfig()` and `01-TECHNOLOGY-STACK.md` documents `reconnectSupabase()` and `getCurrentEnvironment()`. `00-GETTING-STARTED.md` never mentions creating a `.env.local` at all, so a new engineer following it verbatim gets an app with no Supabase configuration.

### 3.3 Undocumented feature areas

Present in code, absent from all 27 documents:

- **Tutorial / first-run carousel** — a real route in `navigation/index.tsx`; `Testing-Guide.md:350` writes E2E assertions against `tutorial-skip-button` but no doc explains the gate.
- **Developer settings surface** — `navigation/screens/developer/` has 12 components (`MigrationStatusSection`, `NativeModulesSection`, `EnvironmentItem`, …). Only `DatabaseDevToolsSection` gets a passing mention in `03-DATA-AND-SYNC.md:381`.
- **`LightSensorScreen` + `useLightSensor`** — directly relevant to the "AE as light-sensor proxy" investigation in `04-ENGINEER-CONSOLE.md:324`, which says it "has not yet been implemented".
- **Camera/resolution switching** (`useCameraSwitch`, `useResolutionSwitch`, `CameraSelector`, `CaptureModeSelector`) — shipped in the day-camera resolution PR (#233) at HEAD.
- **`DeploymentPhotoService` / `DeploymentPhotosSection`** — deployment photo capture and storage.
- **`SyncBarrier`** — described in `BLE_Architecture.md` but missing from `02-CODEBASE-GUIDE.md`'s service list and `03-DATA-AND-SYNC.md`, where it belongs.
- **`DeviceReconnectProvider`** — listed in `02-CODEBASE-GUIDE.md:257` as an active provider, but it is not mounted in `src/App.tsx`. Either dead code or an undocumented mounting point.

### 3.4 BLE file trees omit two shipped workflows

`src/ble/workflows/` contains `checkSdCard.ts`, `deploymentPipeline.ts`, **`resetToDefaults.ts`**, **`configVerification.ts`**. The last two are missing from both `02-CODEBASE-GUIDE.md:243-245` and `BLE_Architecture.md:863`, yet `resetToDefaults` is the subject of the §1.5 contradiction and `configVerification` is the one gap `empty_sd_update_architecture.md` says was closed.

Also missing from the trees: `fileTransfer/fileTransferTypes.ts` and `fileTransfer/index.ts` (both listed in `BLE_Architecture.md` but not `02`).

### 3.5 No iOS setup path

`00-GETTING-STARTED.md:65` says "iOS Development → Native on macOS", then never returns to it. `Android-Guide.md`, `WSL2-Setup-Guide.md`, and `Docker-Development-Guide.md` are Android/Windows-only. `06-BLE-CONNECTIONS.md` documents several iOS-specific BLE behaviours (CoreBluetooth UUIDs, write-with-response, connect timeouts) that imply active iOS work with no corresponding setup guide.

### 3.6 Dev reports have no status header

`documentation/development reports/` mixes a **superseded April spec** (`sliding_window_file_transfer_spec.md`, "Status: Draft"), a **superseded April guide** (`sliding_window_file_transfer.md`), a **partially-superseded July proposal**, and a **current July architecture doc with a STATUS ADDENDUM saying half of it is obsolete**. Nothing in the folder tells a reader which document is current. `fast_file_transfer_proposal.md:5` has a "Supersedes" line — that convention should be mandatory here and the two April docs should be marked superseded or archived.

### 3.7 Unresolved cross-references

- `04-ENGINEER-CONSOLE.md:193` links to `#key-commands` — no such heading exists in that file (the section is "BLE Command Reference"). `05-DEVICE-FLOWS.md:134` links to the same dead anchor.
- `03-DATA-AND-SYNC.md:227` links to `01-TECHNOLOGY-STACK.md#sync-architecture` for a "full sync method table" that 01 does not contain — 01 instead defers back to 03. Circular.
- `01-TECHNOLOGY-STACK.md:203` and `03-DATA-AND-SYNC.md:227` point at each other for the same content, which exists in neither.
- `00-GETTING-STARTED.md:23` says "This folder contains **five** onboarding guides" and its table lists 01–05. `06-BLE-CONNECTIONS.md` exists and is unlisted — a new engineer will never find the most current BLE document in the set.

---

# Part 4 — Redundancy

### 4.1 Four competing inventories of the same code

The hook list, service list, and BLE file tree each appear in **four** places, all diverged:

| Content | Locations |
|---|---|
| Hook inventory | `02-CODEBASE-GUIDE.md:190-215`, `whitelist.md:102-112`, `BLE_Architecture.md:865-880`, `01-TECHNOLOGY-STACK.md:334-348` |
| Service inventory | `02-CODEBASE-GUIDE.md:150-167`, `whitelist.md:55-70` |
| BLE protocol file tree | `02-CODEBASE-GUIDE.md:218-246`, `BLE_Architecture.md:834-893`, `whitelist.md:76-100` |
| Screen/route inventory | `01-TECHNOLOGY-STACK.md:217-240`, `whitelist.md:8-41`, `02-CODEBASE-GUIDE.md:103-127` |

Every one of these is now wrong in a different way. Recommend a single generated inventory (or none) and prose references elsewhere.

### 4.2 Duplicated conceptual content

| Content | Duplicated in |
|---|---|
| Redux-vs-WatermelonDB split, `withObservables` pattern, typed hooks | `01:166-171`, `02:307-388`, `03:1-48` |
| Supabase factory pattern (`getSupabaseClient`, `reconnectSupabase`, legacy `Proxy` warning) | `01:172-196`, `Authentication-Implementation-Guide.md:206-228` |
| Permission matrix by role | `Authentication-Implementation-Guide.md:174-187` (10 flags), `Testing-Guide.md:276-290` (9 capabilities) — overlapping but not identical, and the Testing version invents rows with no backing flag ("Manage project members", "Start/stop deployments") |
| Secret-leak-via-prebuild warning | `Android-Guide.md:53-54` and `Expo-EAS-Guide.md:114-115`, near-verbatim |
| WSL2 ADB bridge setup | `Testing-Guide.md:157-166` and `WSL2-Setup-Guide.md` |
| EAS profile table | `Expo-EAS-Guide.md:58-62` and `publishing_guide.md:9-13`, verbatim — and both wrong (§1.13) |
| Docker quick start | `00-GETTING-STARTED.md:70-77` and `Docker-Development-Guide.md:24-39`, with conflicting install commands (§1.12) |
| Capture-preview three-phase flow | `BLE_Architecture.md:117-175` (sequence diagram) and `BLE_Architecture.md:697-721` (prose) — same document, twice |
| Disconnect fail-fast cascade | `BLE_Architecture.md:519`, `:556`, `:784-819`, and `04-ENGINEER-CONSOLE.md:413-429` |
| `AI getop -1` bulk-fetch optimisation | `04:166-175`, `05:149`, `05:157`, `05:206` |

### 4.3 Redundant / near-duplicate documents

- **`sliding_window_file_transfer.md` and `sliding_window_file_transfer_spec.md`** — 756 lines describing the same window=2 design one day apart, both superseded by `fast_file_transfer_proposal.md`, which supersedes them by name. The two files' HX6538 C snippets differ (1-slot vs 2-slot buffer) for no stated reason.
- **`whitelist.md`** — adds nothing that `02-CODEBASE-GUIDE.md` doesn't cover, is more stale, and carries a dangerous deletion licence. Strongest candidate for deletion.
- **`Docker-Development-Guide.md`** vs `00-GETTING-STARTED.md` Option A — the getting-started version is a strict subset except for the conflicting install flag.

### 4.4 Documentation living outside `documentation/`

`scripts/README.md`, `scripts/README-SCHEMA-VALIDATION.md`, `scripts/README-TYPE-SCRIPTS.md`, and the 9.8 KB root `README.md` are not referenced from any file in `documentation/`, and `03-DATA-AND-SYNC.md:412` defers to "the README for the full database workflow" without saying which one.

### 4.5 Stale illustrative examples in `Dependency-Validation-System.md`

The doc's own examples use versions the doc elsewhere says are locked: `"react-native": "0.74.5"` and `"react-native-reanimated": "~3.10.1"` (lines 760-774), and an Expo SDK 52 migration example (lines 698-707). Against a real RN 0.81.5 / reanimated ~4.1.1 / SDK 54 project, these read as authoritative and will mislead. At 932 lines it is also the longest document in the set while covering a 379-line script — roughly 60% of it (Migration History, Lessons Learned, Future Enhancements, Automated Rule Generation, Renovate config) is speculative or narrative rather than operational.

---

# Part 5 — Recommended remediation, in order

**Immediately (correctness hazards):**

1. Fix schema version 185 → 402 and table count 15 → 45 in `01`, `02`, `03`. Better: replace the literal with a pointer to `src/database/schema.ts` and add a CI check that fails when a doc mentions a stale version.
2. Rewrite `File-Transfer-Protocol.md` around credit streaming / `windowSize = 12` / cumulative ACKs, add `FILE_LOOPBACK` (`0x0A`), fix the failure-injection table against the error table, and replace the performance table with the measured profile from `empty_sd_update_architecture.md` (~8 KB/s for ~24 s, then ~1.3 KB/s).
3. Resolve the `requestConnectionPriority` mid-transfer contradiction (§1.14) — this is a behavioural instruction firmware and app engineers are both reading.
4. Delete or fully rewrite `whitelist.md`; at minimum strip the "anything not listed can be removed" claim today.
5. Fix `00-GETTING-STARTED.md`'s `npm install --ignore-scripts` (skips `patch-package`), and add the `.env.local` step.

**Next (navigational correctness):**

6. Fix the `SupabaseSyncService` / `OutboxService` / `SyncStateService` / `SyncTriggerService` paths in `02` and `03`.
7. Remove the `LocationProblems` gate from `01` and the Authentication guide, or implement it.
8. Replace `commandQueue.ts` with `bleTransportController.ts` in `00` and `01`.
9. Fix `BLE_Architecture.md`'s 60 s → 15 s scan session (4 places) and its `session/__tests__` claim.
10. Regenerate `01`'s route table from `src/navigation/index.tsx` and fix `02`'s auth-screen paths.
11. Convert `01`'s `file:///c:/dev/ww/...` links to repo-relative paths.
12. Add `06-BLE-CONNECTIONS.md` to the `00-GETTING-STARTED.md` roadmap and change "five onboarding guides" to six.

**Then (consolidation):**

13. Pick one home for each inventory (hooks, services, BLE tree, routes) — `02-CODEBASE-GUIDE.md` is the natural owner — and replace the other three with links.
14. Add a `> Status: superseded by X` header convention to `development reports/`, applied to both April sliding-window docs.
15. Fold the dual-slot/dual-image reality from `empty_sd_update_architecture.md` into `Himax-Firmware-Update.md`.
16. Settle the `.TFL` filename format (padded or not) and the labels filename, then make `04`, `AI-Model-Integration.md`, and the dev report agree.
17. Resolve §1.4 (console scope), §1.5 (`resetOps` vs `RESET_TO_DEFAULTS`), §1.6 (`NUM_PICTURES` default), §1.7 (`reset` vs `AI reset`), §1.11 (bare vs managed).
18. Drop all line-count citations; regenerate the EAS profile table from `eas.json` (5 profiles, `preview` → `cloud-dev`).
19. Trim `Dependency-Validation-System.md` to the ~350 operational lines and fix its npm-script table; mark the EAS `prebuildCommand` section as a proposal.

**Structural suggestion:** most of the drift above is in facts that are mechanically checkable — file paths, schema version, npm scripts, route names, constants. A `npm run docs:validate` script that greps documented paths and constants against the tree would have caught roughly 30 of the ~40 findings here, and would keep catching them.

---

## Documents by health

| Document | Verdict |
|---|---|
| `06-BLE-CONNECTIONS.md` | ✅ Accurate, current, well-scoped. Model for the rest. |
| `React-Doctor-Guide.md`, `Maps.md`, `WSL2-Setup-Guide.md`, `Dev-Deployment-Guide.md` | ✅ Broadly accurate; minor issues only. |
| `Himax-Firmware-Update.md` | 🟡 Excellent on flash internals; missing the dual-slot pipeline that ships. |
| `empty_sd_update_architecture.md`, `fast_file_transfer_proposal.md` | 🟡 High quality but mutually contradictory; need reconciliation. |
| `04-ENGINEER-CONSOLE.md`, `05-DEVICE-FLOWS.md`, `BLE_Architecture.md`, `Authentication-Implementation-Guide.md`, `Testing-Guide.md`, `AI-Model-Integration.md`, `Expo-EAS-Guide.md`, `publishing_guide.md`, `Android-Guide.md`, `Docker-Development-Guide.md` | 🟡 Structurally sound, individually stale facts. |
| `00-GETTING-STARTED.md`, `01-TECHNOLOGY-STACK.md`, `02-CODEBASE-GUIDE.md`, `03-DATA-AND-SYNC.md` | 🟠 The onboarding path is the most-read and the most wrong. Fix first. |
| `File-Transfer-Protocol.md` | 🔴 Describes a superseded protocol as current. |
| `whitelist.md` | 🔴 Delete or rewrite. |
| `sliding_window_file_transfer.md`, `sliding_window_file_transfer_spec.md` | 🔴 Superseded; archive. |
