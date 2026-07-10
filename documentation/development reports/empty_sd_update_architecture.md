# Empty SD Card Framework — Architecture, Pipelines & Verification

**Date:** 2026-07-10
**Scope:** Himax (HX6538) firmware update over BLE, manifest ingestion, embedded-AI deployment
**Grounded in:** `ww500_md` firmware (feat/ble-fast-transfer @3c0baafa), BLE fw 0.30.47, wwmobile feat/ble-fast-transfer @5cdc45a, and throughput measurements from the 2026-07-09/10 fast-transfer work.

> **STATUS ADDENDUM (2026-07-10, feat/himax-update-pipeline):** a code audit found
> that Flows 1, 2A, 2B and 3 are **already implemented** in the app:
> `useFirmwareUpdate.runHimaxUpdate()` (dual-slot pair ordering via `AI slots`,
> ftx transfer + `AI firmware <file> 0xCRC`, `AI reset`, `waitForAiReady`,
> transient-drop retry, sdcard/download sources) driven by
> `FirmwareUpdateScreen`; the Flow-1 gate lives in `StartMonitoringScreen`
> (`onUpdateFirmware` → FirmwareUpdateScreen with `restrictToLatest`); Flow 3's
> skip-if-present + transfer + `loadmodel` lives in `deploymentPipeline.ts`.
> §1.1's "new orchestrator" is therefore **obsolete** — kept below only as
> design rationale. The one gap was the §2.2 CONFIG.TXT handshake, added as
> `src/ble/workflows/configVerification.ts` and wired into
> `useFirmwareUpdate.verifyAndComplete()`. Still open: the §4 QA matrix run
> and the §5 firmware asks.

---

## 0. What already exists (build on this, don't reinvent)

| Building block | Where | Status |
|---|---|---|
| Sliding-window BLE file transfer (`ftx`, window 12, cumulative acks, CRC16-CCITT per-packet + whole-file) | `src/ble/protocol/fileTransfer/runFileTransferPipeline.ts` ↔ nRF `fileTx.c` ↔ HX `fileRx.c`/`if_task.c` | **Working, device-verified** (512 KB CRC-checked) |
| Files land in **`/MANIFEST`** (`CONFIG_DIR`) on SD | HX `directory_manager.h`, `fatfs_task.c` OPEN/APPEND/CLOSE | Working |
| Dual firmware slots A/B + selector sector | HX `xip_manager.c`, bootloader (selector @ `0xFFF000`, `HIMAXWE2` header) | Working (`doc/slot_selector.md`) |
| **`firmware <file> [0xCRC]`** CLI command: CRC pre-check → erase inactive slot → write → verify → update selector; *"Existing firmware unchanged"* on any failure | HX `CLI-FATFS-commands.c` `prvFirmwareCommand` | Working |
| `switchslot` (boot other slot) and `dump-sel` (inspect selector) | HX `CLI-commands.c` | Working |
| Manifest **zip** ingester: extracts `CONFIG.TXT`, `labels.txt`, `NNNNVN.tfl` from a zip on SD; parses ProjectID/Version | HX `fatfs_task.c` (`UNZIPMANIFEST`) | Working |
| CONFIG.TXT auto-persist: `save_configuration(STATE_FILE)` writes `/MANIFEST/CONFIG.TXT` from in-RAM OPs at every DPD entry; missing file at boot → defaults + regenerate | HX `fatfs_task.c:705,732,1574` | Working |
| Model/label loading from `/MANIFEST/<model>.TFL` + `/MANIFEST/<model>.TXT` into XIP; device tracks loaded model (`metaDataRam.modelName`) | HX `xip_manager.c` | Working |
| App deployment pipeline (time sync, `getop -1` diff reset, model+labels transfer via ftx, `loadmodel`) | `src/ble/workflows/deploymentPipeline.ts`, `resetToDefaults.ts`, `AiModelService`, `ReferenceDataService` | Working (Flow 3 is ~80 % of this) |
| BLE (nRF) OTA update pipeline | existing DFU flow | Working, out of scope |

**Measured transfer profile (Android test device, 0.30.47 + fixed HX):**
- ~8 KB/s for the first ~24 s (until Android decays the connection interval), then ~1.3 KB/s.
- ⇒ ≤ ~190 KB files ride the fast window entirely.
- HX firmware image = **483,328 B (472 KB)** ⇒ **~4 min/image**, **~8–9 min for both**.
- Do **not** re-request `CONNECTION_PRIORITY_HIGH` mid-transfer (desyncs nRF↔HX I2C — measured, documented in `runFileTransferPipeline.ts`).

**Key architectural insight:** the ftx transfer only ever *stages files on the SD card*. Flash is touched exclusively by the `firmware` command, which verifies before flipping the selector. This gives a natural three-stage integrity chain (§3.1) and makes mid-transfer failure inherently safe.

---

## 1. Mobile application impact & UI design

### 1.1 New orchestrator: `himaxUpdatePipeline.ts`

A new workflow in `src/ble/workflows/` mirroring `deploymentPipeline.ts` conventions (stateless async stages + `ProgressCallbacks`), acquiring the transport lock (`bleTransport.acquireLock`) for the whole session.

```
Stage 0  PREFLIGHT   phone battery ≥30% or charging · device awake · cloud
                     manifest fetched (2 images + CRC16s + version) · images
                     cached locally (expo-file-system, CRC-verified on disk)
Stage 1  TRANSFER-1  ftx image for the *inactive* slot variant → /MANIFEST/FW_A.IMG
Stage 2  FLASH-1     `firmware FW_A.IMG 0xCRC` → wait "Firmware update OK"
Stage 3  REBOOT-1    `reset` → HX boots the newly flashed slot (BLE link to the
                     nRF is NOT lost — only the HX reboots; wait for Wake)
Stage 4  VERIFY-1    `ver` → confirm new version string
Stage 5  TRANSFER-2 / FLASH-2 / REBOOT-2 / VERIFY-2  (other variant, now-inactive slot)
Stage 6  CONFIG      CONFIG.TXT handshake (§2.2)
Stage 7  CLEANUP     optional: delete staged .IMG files; release lock
```

Notes:
- **8.3 filenames are mandatory** (`filenameValidator.ts`, HX `fileRx_start`). Use fixed staging names, e.g. `FW_RP3.IMG` / `FW_HM.IMG`, independent of cloud blob names.
- `xip_update_firmware_from_sd()` always writes the **inactive** slot and flips the selector, so updating both slots requires the flash→reset→flash sequence above. (Optional firmware enhancement: `firmware <file> <0xCRC> <slot>` to target a slot explicitly and collapse Stages 3–5; not required for v1.)
- The `firmware` command erases+writes ~500 KB of XIP flash — allow a **90 s command timeout** (vs the ftx 15 s silence timeout) and expect console progress lines.
- Wrap the session in `expo-keep-awake`; on Android consider a foreground service notification ("Updating camera — keep phone nearby").

### 1.2 State management

- **New Redux slice `firmwareUpdateSlice`** (or a `useReducer` in a dedicated provider, matching `FileTransferTestScreen`'s reducer pattern):
  ```ts
  {
    phase: 'idle'|'preflight'|'downloading'|'transferring'|'flashing'|'rebooting'|'verifying'|'config-check'|'done'|'failed',
    currentFile: 1|2, filesTotal: 2,
    bytesSent, totalBytes, currentSpeed, etaMs,        // from ftx onProgress
    deviceVersion, targetVersion,
    error?: { stage, code, recoverable, retryCount }
  }
  ```
- **Version-check service** (`FirmwareVersionService`): compares device `ver` response (already parsed for the Engineer Console) against the cloud "latest" endpoint; cache result per session. Called from the start-monitoring flow (Flow 1 gate) and the Engineer Console (Flow 2).
- **Pre-monitoring hook**: in the start-monitoring saga/hook, after connect + wake, `await FirmwareVersionService.check(device)`; if newer ⇒ dispatch a modal prompt (`Update available: vX → vY, ~9 min`) with *Update now* / *Skip*. Never auto-start the transfer without consent — it blocks monitoring for ~10 min.
- **Download-before-touch rule**: both images fully downloaded and CRC-verified on the phone *before* the first ftx byte. A mid-air cloud failure must never leave the device half-staged.

### 1.3 UX / UI components

| Component | Details |
|---|---|
| **Dual-file stepper progress** | "Image 1 of 2" / "Image 2 of 2" master steps; per-file progress bar fed by the existing throttled `onProgress` (percentage, bytes, `currentSpeed`, ETA). Reuse `FileTransferTestScreen` progress block as the base. |
| **Phase banner** | Transfer → Flash → Restart → Verify. During FLASH/REBOOT show an indeterminate spinner + "Do not power off the camera" (transfer phases are safely interruptible; flash phases are not — communicate the difference). |
| **Speed expectation setting** | Show honest ETA from the measured profile (fast first ~24 s, then slower): "~4 min remaining" beats a stuck-looking bar. |
| **Failure dialog** | Maps `FileTransferError` reasons (`DEVICE_SILENT`, `DISCONNECTED`, `DEVICE_ERROR` + ftx err code) and `firmware` command failures to plain-language messages with a **Retry stage** button (retry restarts the *current file* only — earlier stages are already durable on SD/flash). |
| **Low battery guard** | Preflight modal if phone <30 % and not charging; hard block <15 %. Device-side battery from the status/`ver` telemetry if below threshold. |
| **Success screen** | Old → new version, per-slot result (`dump-sel` summary optional in Engineer Console), "config verified ✓" (§2.2). |

---

## 2. Edge cases & failure mitigation

### 2.1 Dual-slot recovery semantics

The slot architecture makes almost every failure mode recoverable **by construction**:

| Failure | Effect | Recovery |
|---|---|---|
| BLE drop / app kill / phone dies **during ftx transfer** | Partial file in `/MANIFEST`; **flash untouched**; HX cleans up via 5 s session-inactivity + delete-on-abort; nRF `fileTx_abort()` on disconnect | Reconnect → restart that file's transfer (ftx has no partial resume — a retry re-sends the whole file, ~4 min worst case). Idempotent. |
| Data corruption in transit | Three independent CRC16 gates: per-packet CRC (nRF relay), whole-file CRC at `FILE_END` (HX deletes file on mismatch), and `firmware <file> 0xCRC` re-computes from SD before any flash op | Automatic reject at the failing gate; app retries the stage |
| Power loss / abort **during `firmware` flash write** | Only the **inactive** slot is being erased/written; active slot + selector untouched | Device still boots the active slot; app re-runs FLASH stage |
| New image **boots but is broken** (passes CRC, bad behavior) | Selector points at bad slot | App (or user via Engineer Console) issues **`switchslot`** + `reset` → previous firmware boots. Expose as a "Roll back" button after VERIFY fails. |
| Power loss during the **selector sector write** (~ms window, single sector) | Residual risk: selector sector corrupt | *Open firmware question:* confirm bootloader behavior on invalid `HIMAXWE2` header (fallback to Slot A?). Recommend a bench test + documenting the answer; if fallback is Slot A, always update Slot B first when both slots change. |
| Reboot between the two flash stages fails to reconnect | HX in unknown state, nRF link alive | VERIFY stage times out → dialog: "Camera didn't respond after restart" with Retry (re-`reset`) and Roll back (`switchslot`) actions |

**App rules encoded in the pipeline:**
1. Safe-abort points = anywhere in PREFLIGHT/TRANSFER; unsafe = FLASH/REBOOT (UI must not offer Cancel there).
2. VERIFY failure ⇒ offer rollback, never silently continue to the second image.
3. Persist pipeline state (slice) so an app restart mid-update can resume at the correct stage instead of starting over.

### 2.2 CONFIG.TXT verification handshake

Firmware behavior (existing): on boot with no `/MANIFEST/CONFIG.TXT`, defaults are used and the file is (re)written by `save_configuration()` at the next DPD entry; the device also prints the full OP vector in its `Sleep …` line.

Recommended handshake after the update completes on an empty card:

1. App sends **`getop -1`** (already used by `executeResetToDefaults`) → receives every operational parameter.
2. Compare against `FACTORY_DEFAULTS` (already in the app) — *verify-only* mode of the existing diff logic; report mismatches.
3. Force persistence deterministically: issue the existing config-persisting command path (any `setop`, or letting the device sleep once) then optionally confirm file existence via a directory/exists CLI query.
4. Surface "Configuration verified ✓ (N parameters at defaults)" in the success screen; mismatches ⇒ warning with a one-tap "Reset to defaults" (reuses `executeResetToDefaults`).

This avoids reading the file over BLE entirely — the OP vector in RAM *is* what gets persisted, so `getop -1` is the authoritative check.

---

## 3. Embedded AI file validation & transfer (Flow 3)

### 3.1 Validation before transfer (phone side)

- **Naming contract** (from `xip_manager.c` / zip ingester): model `PPPPVN.TFL` (parsed as `%4dV%d`, e.g. `0001V2.TFL`) + labels `PPPPVN.TXT` (same basename — `load_labels_from_manifest()` derives it). Both 8.3-safe. Enforce via `filenameValidator` + a model-specific regex.
- **Integrity**: cloud manifest must carry CRC16-CCITT (same algorithm as `crc16ccitt.ts`) + byte size per file. `AiModelService` verifies the cached download before any BLE byte moves. Size gate: ≤ `FILERX_MAX_FILE_SIZE` (10 MB) — and warn ≥ ~1 MB (≈ 13 min at sustained rate).
- **Labels sanity parse**: non-empty, newline-separated, class count matches the model metadata from the cloud (catches the "corrupted labels" case before transfer, not on-device).
- **OP contract**: resolve OP14 (model family) / OP15 (version) via `ReferenceDataService.getFirmwareIds()` exactly as `deploymentPipeline.ts` does today.

### 3.2 Missing-from-SD check + sync protocol

1. Query the device for its loaded/staged model (device tracks `metaDataRam.modelName`; the `loadmodel`/model-info command reports it — reuse the response the deployment pipeline already parses).
2. If `PPPPVN` matches target ⇒ skip transfer (fast path, empty-SD false-negative safe: absent file ⇒ no match ⇒ transfer).
3. Else transfer **labels first, then model** (labels are tiny and ride the fast window; a model-without-labels state is never staged where a reboot could pick it up half-done):
   `ftx 0001V2.TXT` → `ftx 0001V2.TFL` → `loadmodel 0001V2.TFL` (existing command; firmware copies SD → XIP model region and loads labels) → confirm via model-info query → set OP14/OP15.
4. All through the same `runFileTransferPipeline` — no new protocol. The whole-file CRC at `FILE_END` plus the phone-side pre-check is sufficient; `loadmodel` failure (bad magic/size) is the final gate.

---

## 4. End-to-end QA & validation test matrix

**Fixtures:** WW500 C02 (RP3 + HM0360), empty SD + populated SD, Android phone (the ~24 s interval-decay device) + iOS phone, cloud dev DB with N and N+1 firmware versions, model `0001V2` (+ a deliberately truncated `.TFL` and an empty `.TXT`).

### 4.1 Flow 1 — automated pre-monitoring update

| # | Step / condition | Expected |
|---|---|---|
| 1.1 | Connect, start monitoring; device already at latest | No prompt; monitoring starts directly |
| 1.2 | Device at N, cloud at N+1 | Prompt with versions + ~9 min estimate; *Skip* proceeds to monitoring unchanged |
| 1.3 | Accept update, let it run | Stages 0–7 in order; two transfers ~4 min each; two HX reboots **without BLE re-pairing**; `ver` shows N+1; CONFIG handshake passes |
| 1.4 | Version check with cloud unreachable | Monitoring proceeds; non-blocking "couldn't check for updates" toast |
| 1.5 | Re-run after success | No prompt (idempotent) |

### 4.2 Flow 2A — Engineer Console, cloud source

| # | Step | Expected |
|---|---|---|
| 2A.1 | Trigger update from Engineer Console | Same pipeline as 1.3, manual entry point |
| 2A.2 | Kill app at TRANSFER-1 50 % | Flash untouched; reconnect → pipeline resumes at TRANSFER-1 restart; completes |
| 2A.3 | Toggle Bluetooth off during TRANSFER-2 | `DISCONNECTED` dialog; FLASH-1 result survives (slot already updated); retry completes file 2 only |
| 2A.4 | Corrupt the cached image on phone (flip one byte) | Phone-side CRC check fails in PREFLIGHT; nothing sent |
| 2A.5 | Tamper CRC param so SD file mismatches | `firmware` replies "CRC mismatch … Flash NOT modified"; app surfaces retry; flash untouched (`ver` unchanged) |
| 2A.6 | Power-cycle camera during FLASH-1 (unsafe window, bench only) | Device still boots old firmware (inactive slot was being written); pipeline retries FLASH-1 |
| 2A.7 | After successful flash, force VERIFY fail (bench: stage older image) | Rollback offer; `switchslot`+`reset` restores previous `ver` |

### 4.3 Flow 2B — Engineer Console, local manifest on SD

| # | Step | Expected |
|---|---|---|
| 2B.1 | SD pre-loaded from website "Prepare SD Card" (MANIFEST folder), insert, connect | App discovery finds staged images (dir listing or known filenames); skips TRANSFER stages; runs FLASH→REBOOT→VERIFY per slot |
| 2B.2 | MANIFEST present but one image missing | App reports exactly which file is missing; offers 2A fallback for that file |
| 2B.3 | Website manifest delivered as zip | Device `UNZIPMANIFEST` path extracts config/labels/models; summary line parsed (`config=yes, labels=yes, models=N`) |
| 2B.4 | Local image is stale (older than device) | Version comparison warns "downgrade?" and requires explicit confirmation |

### 4.4 Flow 3 — AI model deployment

| # | Step | Expected |
|---|---|---|
| 3.1 | Empty SD, deploy project with model `0001V2` | Model-info query shows no match → labels then model transferred → `loadmodel` OK → OP14/15 set → detection labels correct |
| 3.2 | Model already on SD/XIP | Query matches → transfer skipped (log line proves it) |
| 3.3 | Truncated `.TFL` staged (bench copy) | `loadmodel` rejects; app shows model error, offers re-transfer; no crash loop |
| 3.4 | Empty/garbled labels file | Phone-side sanity parse blocks transfer (empty) / on-device label load falls back with warning (garbled) — no mislabeled uploads |
| 3.5 | Model + labels count mismatch vs cloud metadata | Blocked in validation with explicit message |
| 3.6 | 2 MB model transfer on Android | Completes; ETA honest (~25 min → recommend Wi-Fi-proximity messaging); no `DEVICE_SILENT` |

### 4.5 Cross-cutting edge cases

| # | Scenario | Expected |
|---|---|---|
| E.1 | **Completely empty SD card** end-to-end: insert → Flow 1 update → Flow 3 model → monitoring | Firmware auto-creates directory tree + CONFIG.TXT at first DPD; `getop -1` handshake passes; images + model staged in `/MANIFEST`; monitoring session records correctly |
| E.2 | No SD card at all | ftx `FILE_START` fails (open error → `ftx err 6`); app message "No/faulty SD card", no retry loop |
| E.3 | BLE drop at exact `FILE_END` (ack race) | nRF/HX session cleanup (watchdog + inactivity); retry transfers cleanly; no stuck `transferFileOpen` handle (regression test for the fixed stale-handle path) |
| E.4 | Phone battery hits 15 % mid-TRANSFER | Pipeline pauses at next safe-abort point with "charge your phone" dialog; resume works |
| E.5 | Phone battery dies mid-FLASH | Camera unaffected (flash driven by HX autonomously once commanded); on next connect, VERIFY stage detects actual state and continues |
| E.6 | Android interval decay (>24 s transfers) | Speed drops ~8→~1.3 KB/s but **no failure**; regression: watch for `DEVICE_SILENT` (would indicate the priority-refresh bug re-introduced) |
| E.7 | iOS run of every flow | No `requestConnectionPriority` calls attempted; throughput profile recorded (expected steadier); all flows complete |
| E.8 | Second update immediately after first (overwrite staged files) | `FA_CREATE_ALWAYS` + f_sync path handles overwrite (regression for the fixed `ftx err 7`) |
| E.9 | Device enters DPD between file 1 and file 2 (user idles at a dialog) | Pipeline re-wakes device (existing wake handshake) before TRANSFER-2; no silent hang |
| E.10 | Monitoring attempted while update pipeline holds the transport lock | Blocked with clear message (lock already enforces exclusivity) |

**Pass criteria for release:** all matrix rows on both platforms; 3 consecutive full Flow-1 runs on the Android decay device; zero occurrences of `AI processor not responding`, `I2C master did not read`, or `ftx err 7`.

---

## 5. Open questions / firmware asks (small, none block v1)

1. **Bootloader behavior on corrupt selector sector** — bench-verify and document (drives the slot-ordering rule in §2.1).
2. Optional `firmware <file> <0xCRC> <slot>` to target a slot without the intermediate reboot (halves Flow-1 wall time).
3. Optional ftx **resume** (`FILE_START` with offset) — only worth it if >1 MB models become common.
4. A cheap `fileinfo <name>` CLI (size + CRC16 of an SD file) would make Flow 2B verification airtight without transfers.
