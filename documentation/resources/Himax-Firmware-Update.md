# Himax Firmware Update

> **Related**: [File-Transfer-Protocol.md](File-Transfer-Protocol.md) (BLE file transfer for uploading firmware images), [BLE_Architecture.md](BLE_Architecture.md) (BLE command system), [04-ENGINEER-CONSOLE.md](../onboarding/04-ENGINEER-CONSOLE.md) (`AI firmware` command).

## Overview

The WW500 device contains two processors with independent firmware:

| Processor | Role | Update Method |
|-----------|------|---------------|
| **nRF52840** | BLE radio, relay, power management | Nordic DFU (separate flow via `DfuScreen`) |
| **HX6538** (Himax) | AI inference, camera, SD card | This flow — flash from SD card over BLE |

This document covers the **HX6538 firmware update** — flashing a firmware image (`<filename>.IMG` derived dynamically in 8.3 format or defaulting to `OUTPUT.IMG`) from the device's SD card to the Himax processor's XIP flash.

> [!IMPORTANT]
> **The normal update flashes two images, not one.** The two A/B slots hold the two **camera-variant** builds (RP3 and HM0360), and the device must end up running the variant matching its physical camera. The app orchestrates both passes automatically, see [Dual-Image Update](#dual-image-update-camera-variant-pair). A single-image update happens only from the engineer view's Advanced picker, for an explicit SD filename or a build whose other camera has no build in the catalogue. The one-tap update needs both, see [One camera's build only](#one-cameras-build-only).
>
> Budget **~8–9 minutes** for a full pair from the cloud (transfer dominates), or 20–60 seconds per image when it is already staged on the SD card.

---

## Prerequisites

1. **`/MANIFEST/<filename>.IMG`** (e.g., `26520A59.IMG` or `OUTPUT.IMG`) must exist on the device's SD card
2. Device must be **connected via BLE** and responsive
3. **Battery level ≥ 30%** recommended (app warns below this)
4. No other BLE commands in-flight (enforced by transport lock)

> [!NOTE]
> If the specified image is not present on the SD card, the HX6538 responds with `"Firmware update FAILED (error -1). Existing firmware unchanged."` and the existing firmware is untouched.

---

## Architecture

```
┌──────────────────┐     BLE NUS      ┌──────────────┐      I2C       ┌──────────────┐
│   Mobile App     │ ───────────────→  │   nRF52840   │  ───────────→  │   HX6538     │
│                  │ ←───────────────  │              │  ←───────────  │   (Himax)    │
│ FirmwareUpdate-  │   Text strings   │  AI State    │  Binary msg   │  CLI + XIP   │
│ Screen.tsx       │                   │  Machine     │               │  Flash       │
└──────────────────┘                   └──────────────┘               └──────────────┘
```

| Component | Responsibility |
|-----------|---------------|
| **Mobile App** | Sends `"AI firmware <filename> [crc]"`, waits for response, handles UI |
| **nRF52840** | Relays command to HX6538 via I2C, manages AI state machine (wake → selftest → process → sleep) |
| **HX6538** | Reads the target image from SD `/MANIFEST/`, performs CRC verification, erases target flash slot, writes + verifies firmware, updates slot selector |

---

## Sequence Diagram

```
Mobile App                     nRF52840                         HX6538
    |                             |                                |
    |-- "AI firmware <file> [crc]" →|                                |
    |                             |-- wake HX6538 (if sleeping) -->|
    |                             |<-- "Wake 2026-04-22T..." ------|
    |<-- "Wake" ------------------|                                |
    |                             |-- "selftest" ----------------->|
    |                             |<-- "selfTest 0000" ------------|
    |<-- "Error bits = 0x0000" ---|                                |
    |                             |-- "firmware <file> [crc]" ------>|
    |                             |    (Erase → Write → Verify)    |
    |<-- "Firmware update OK..." -|                                |
    |                             |<-- "Sleep 42 41 1 2 ..." -----|
    |<-- "Sleep" (stats) ---------|                                |
    |   (wait for Sleep or 5s)    |                                |
    |-- "AI reset" -------------->|                                |
    |<-- "Forcing reset" ---------|                                |
    |-- "AI dpd" ---------------->|                                |
    |<-- "Forcing DPD ..." -------|    (HX sleeps, resets and boots|
    |<-- "Sleep", then "Wake" ----|     the new slot cold; BLE link|
    |                             |     to nRF survives)           |
```

---

## Mobile App Implementation

### Entry Point

| Screen / module | File | Context |
|-----------------|------|---------|
| Firmware Status | `FirmwareStatusScreen.tsx` | Shows BLE + Himax versions, triggers update |
| Firmware Update | `FirmwareUpdateScreen.tsx` | Update progress UI (presentational). Two views: the operator's, `components/SimpleFirmwareUpdate.tsx`, and the engineer's, opened with `engineer: true` |
| **Update orchestration** | `screens/Devices/hooks/useFirmwareUpdate.ts` | **The actual flow:** UART phase listener, progress parsing, slot/transfer logic, and the post-update reset/sleep sequence. Start here when changing behaviour. |

Accessible from Engineer Console → Flows → "Update Himax Firmware", which opens the engineer view: the build picker, the SD-card or cloud source and the transfer cards. Start Monitoring's banner and Firmware Status open the operator's view (#344), which says only this:

- **Before:** from which build to which ("Update from the 23 Sep build to the 30 Sep build"), and one Update button. It installs both camera images, from the SD card when they are there, otherwise from the cloud. With one camera's build in the catalogue the button stays off and a line names the camera whose firmware is missing, see [One camera's build only](#one-cameras-build-only).
- **While it runs:** one bar for the whole pair and one line, "Sending image 1 of 2 to the camera", "Installing image 2 of 2", "Restarting the camera", with the update's last six log steps under them (file names and CRCs included), so a wait of minutes shows what is happening. While an image goes to the camera, a smaller bar and a line under the log give what is across, the speed and the time left ("212 of 476 KB, 7.9 KB/s, about 38 s left"). The steps stay on screen after a failure.
- **After:** one line, "Updated to the 30 Sep build".
- **After an update that stopped between its images:** where it stopped and what finishing does ("The last update stopped after image 1 of 2. Finishing installs the night-IR image, the 9 Oct build, and puts the camera back on the night-IR camera."), and Finish update in place of Update. See [An update that stopped between images](#an-update-that-stopped-between-images).

Why it sends two images is under [Dual-Image Update](#dual-image-update-camera-variant-pair). Why a low battery blocks it: an update takes minutes of flash writing and two restarts, and a camera that dies part way through a pair is left with its two camera images on different builds. A bench unit on USB reads its battery as a few percent (the USB rail, not a battery), so both views offer "It's on USB power, update anyway" when the battery reads low.

### Command Registration (`commandRegistry.ts`)

```typescript
aifirmware: createSingleLineCommand<boolean>(
    'aifirmware',
    (filename: string, crc?: string) => crc ? `AI firmware ${filename} ${crc}` : `AI firmware ${filename}`,
    /Firmware update (OK|FAILED)(?: \(error (-?\d+)\))?/i,
    (match) => {
      if (match[1].toUpperCase() === 'FAILED') {
         const errorCode = match[2] ? parseInt(match[2], 10) : NaN;
         const errorMsg = FIRMWARE_ERROR_CODES[errorCode] ?? `unknown error (${match[2] ?? '?'})`;
         throw new Error(`Firmware update failed: ${errorMsg}`);
      }
      return true;
    },
    {
      timeoutMs: 120000,               // 2 minute timeout
      retryPolicy: { maxRetries: 0 },  // Never retry a firmware flash
      idempotent: false,
      isLongRunning: true,             // Pauses heartbeats
      requiresExclusiveLock: true,     // Acquires transport lock
      // The CRC check's refusals, before flash is touched
      failureRegex: /^Error: (?:CRC mismatch .*Flash NOT modified|cannot read '[^']*' for CRC check)/i,
    }
)
```

**Key behaviors:**
- Sends `"AI firmware <filename> [crc]"` over BLE NUS (with CRC validation if provided)
- Waits up to **120 seconds** for `/Firmware update (OK|FAILED)/i`
- All intermediate lines (`Wake`, `Error bits`, progress) are **ignored**
- On `OK` → returns `true`; on `FAILED` → throws with error code
- On the CRC check's refusal, `Error: CRC mismatch - file 0x%04X, expected 0x%04X. Flash NOT modified.` or `Error: cannot read '%s' for CRC check (%d)`, it throws at once. Until #374 it waited out the 120 s, and the timeout then ran the pass again
- **No retries** — firmware flash is never automatically retried

### Pipeline Execution

```
┌─ runCommandPipeline ──────────────────────────────────┐
│  1. transportLock.acquire('aifirmware')                │
│  2. bleEventBus.emit(HEARTBEAT_PAUSE, true)            │
│  3. runCommand → writeToDevice("AI firmware <filename> [crc]")│
│     └─ Wait for regex match or timeout (120s)          │
│  4. finally:                                           │
│     └─ bleEventBus.emit(HEARTBEAT_PAUSE, false)        │
│     └─ transportLock.release('aifirmware')             │
└────────────────────────────────────────────────────────┘
```

### Post-Update Reboot

After `"Firmware update OK..."` the app advances to the `rebooting` phase and sends **`AI reset`** (`commandRegistry.aireset`, matches `/Forcing reset/i`, 8 s timeout, no retries) to boot the newly-written slot and reload parameters, then **`AI dpd`**, which brings the sleep the reset waits for forward, as the Device Check does. It then waits, sending nothing, for the `Sleep` and the boot's `Wake` (20 s and 15 s). Every command restarts the inactivity timer, so the fixed 4 s wait and `AI ver` polls that used to follow could hold the restart off and let the next image land on the slot the camera runs from (#374).

`firmware` itself schedules no reset: it moves the boot selector, and the camera starts the new image at its next boot of any kind, a wake from sleep included. Without the reset that is a warm boot, which leaves the slot labelled `unknown`.

> [!NOTE]
> This is `AI reset`, **not** the bare `reset` command. `reset` reboots the nRF52 after disconnect; `AI reset` reboots only the Himax, leaving the BLE link to the nRF intact. A timeout or error here is tolerated and logged — the reset frequently tears down the AI session before a reply arrives.

---

## Dual-Image Update (Camera-Variant Pair)

**Source:** [`useFirmwareUpdate.runHimaxUpdate()`](../../src/screens/Devices/hooks/useFirmwareUpdate.ts)

Slot A and Slot B each hold one **camera-variant** build. `xip_update_firmware_from_sd()` always writes the *inactive* slot and flips the selector, so each flash leaves the device running the image just written. Updating both variants therefore requires two full passes, and **the order determines which camera the device ends on**.

### Pair resolution

1. If the chosen firmware record carries a `cameraVariant`, the app fetches the latest build of the *other* variant via `ReferenceDataService.getLatestHimaxByVariant()`.
2. If no variant is set, it tries to build the pair from the latest RP3 + latest HM0360.
3. If only one is available → single-image update (logged as such).
4. An explicit SD-card filename (a bare string) always takes the legacy single-pass path — the variant cannot be inferred from a filename.

Steps 3 and 4 are reachable only from the engineer view's Advanced picker; the screen starts the one-tap update only with a build of each camera.

### One camera's build only

The pair update needs an active catalogue row for each camera. With one, it cannot start: the update screen names the camera whose build is missing and keeps the button off, and Firmware Status names the same camera, with no Update outside the Engineer Console, counting the AI processor as neither outdated nor up to date (`classifyHimax` in `utils/himaxFirmwareState.ts`, #437). A sync cannot fetch a build that was never uploaded; the update screen syncs the catalogue each time it opens, so open it again once the build is there.

On cloud dev this follows every ww-backend dev deploy for some seconds: the deploy resets the database, and the Seeed upload job puts the builds back one camera at a time. Elsewhere it follows a failed or late upload of one camera's build.

A camera already on the one build there is still reads up to date.

### Ordering rule

```
AI slots  →  "Active slot 1 running 'RP3 (day/colour)'. Slot A: 'HM0360 (night/IR)', Slot B: 'RP3 (day/colour)'. Auto-switch: off"
```

The app queries `AI slots` to learn the running variant, then flashes **the other variant first and the device's current variant last**, so the device finishes on the (now updated) camera it started with. An update this phone left unfinished ends on the camera that update started on instead, see [An update that stopped between images](#an-update-that-stopped-between-images).

"Active slot" is the selector, the slot the bootloader starts **next**, not always the one running: `firmware` and `switchslot` move it before the camera restarts. "running" is the camera the running image is built for. A slot's label is written by its image's first cold boot, and `firmware` resets the written slot's to `unknown`, so straight after a write the selected slot reads `unknown` while the other still names the running camera. Labels name a camera, not a build: no command reports the other slot's build.

> [!NOTE]
> On firmware without the `slots` command the query fails, the default order is used, and a warning is logged. Correctness is unaffected — only which camera ends up active.

### Per-pass sequence

| Stage | Phase | Detail |
|-------|-------|--------|
| Check the slot | `preflight` | `AI ver` and `AI slots` before each image. The camera must run the image in its selected slot, and after an image of this update, that image's camera; if not, it is restarted once (`AI reset`, `AI dpd`, Sleep, Wake), and if still not, the update stops with "The camera did not restart into its new image. Nothing more was written." `firmware` writes the slot opposite the selector, so a camera still on its previous image would take the write on the slot it runs from. A camera already running this image (a retried pass whose write landed) skips it. Firmware without `slots` skips the check. |
| Download | `downloading` | Cloud source only. Skipped when flashing from the SD card. `FirmwareService.ensureFirmwareDownloaded` uses the copy in the phone's cache (`documentDirectory/firmware/`) when it is there at the release's size, which needs no connection. The offline pre-download keeps the latest image of each variant there after every sync, and the pre-flight card says "On this phone: Downloaded" when both are (#333). |
| Check the card | `sending` | SD-card source only. `AI crc <file>` reads the CRC16-CCITT and size of the file already on the card, and the app compares them with the release's `firmware.crc_checksum` and `file_size_bytes` before anything touches flash. See below. |
| Transfer | `transferring` | `runFileTransferPipeline` stages the `.IMG` into `/MANIFEST/`. The engineer view's download and transfer cards name this pass's image, the hook's `passImage`, not the build picked under Advanced (#436). The pipeline's whole-file CRC16 is reused as the `AI firmware` CRC argument. It sends one `ver` first and refuses on [BLE firmware below the floor](File-Transfer-Protocol.md#the-ble-firmware-floor), so an old nRF needs its BLE update before the Himax one. |
| Flash | `sending` → `flashing` | `AI firmware <file> <0xCRC>`. The phase advances to `flashing` on an 8-second timer because the HX goes silent during erase/write. |
| Reboot | `rebooting` | `AI reset`, `AI dpd`, then the `Sleep` and the boot's `Wake`, with nothing sent meanwhile. The next pass's slot check confirms the camera came back on the new image. |

A pass that fails with a transient error (`Session Reset`, `DEVICE_DISCONNECTED`, or a timeout; the `AI reset` routinely drops the session) is **retried once** after `waitForAiReady(25000)` hears the device again, and the retry starts with the slot check, so an image whose write landed is not written over the other camera's slot.

### Flashing a file already on the card

The screen offers any image whose 8.3 name is already in `/MANIFEST/`, labelled "· on SD
card", and preselects that source because it skips minutes of BLE transfer. The match is on
the filename, so the file's contents have to be established separately: a name is not a
checksum, and an image truncated by an interrupted transfer or left by an older build carries
the right name perfectly well.

Two layers do that, and they are not redundant. The device's own
`AI firmware <file> 0xCRC` recomputes the file's CRC and refuses to touch flash on a mismatch,
which is the one that actually protects the device: `"Error: CRC mismatch - file 0x%04X,
expected 0x%04X. Flash NOT modified."` The app additionally reads `AI crc <file>` first and
compares against the release's `crc_checksum` and `file_size_bytes`, which is what lets it say
*which* file is wrong and by how much, rather than surfacing a bare failure, and it is the only
check available at all when the record carries no CRC.

When there is nothing to check against — an SD-card-only file with no matching release row, or
a row whose `crc_checksum` is null, as every nRF row currently is — the app says so in the log
rather than letting an unverified flash look checked.

### Verification (`verifyAndComplete`)

Runs once, after the final pass:

1. `AI ver` → new version string for the success banner
2. `AI slots` → confirms which camera image the device finished on
3. `verifyConfigDefaults()` ([`configVerification.ts`](../../src/ble/workflows/configVerification.ts)) → the empty-SD handshake

All three are **non-fatal**, with one exception: a pair update must leave the camera on the camera it ends on. If `AI slots` says otherwise, the camera is restarted once, and the update fails if it still is not. Once it is, the update's record is cleared. The flash is already verified on-device; the rest populate the success screen and surface configuration drift for an engineer to judge.

### An update that stopped between images

**Source:** [`services/himaxUpdateRecord.ts`](../../src/services/himaxUpdateRecord.ts), [`utils/himaxFirmwareState.ts`](../../src/utils/himaxFirmwareState.ts)

A pair update cut short between its two images, by a dropped link, a killed app or a flat phone, leaves the camera on the other camera, with the other slot on an older build. The camera cannot show it: `AI ver` names the running build and `AI slots` names cameras, so on 9 October 2026 a camera stopped during image 2's transfer read `Active slot 0 running 'RP3 (day/colour)'. Slot A: 'RP3 (day/colour)', Slot B: 'HM0360 (night/IR)'`, the same as after a full update, and Firmware Status said "Up to date: 9 Oct build" (#374).

So the phone that runs a pair update keeps a record of it, per device, under `himaxUpdate:pending:<device id>`: the camera it ends on (the one running when it started), the selector and `AI ver` before the first write, the pair, and two counts. `sent` is saved **before** each `AI firmware`, since a write whose reply is lost may still have landed, and `flashed` after the OK. An update that stops before its first write leaves no record; a single-image update and firmware without `slots` write none.

| The camera, against the record | Reads as | The record |
|---|---|---|
| Runs the end camera's new build from its selected slot, every image sent | Up to date | Dropped |
| Selector and `AI ver` as before the first write (a refused or failed write) | As if there were none | Dropped |
| Anything else | "Update not finished: 1 of 2 images installed", in the error colour, with Finish update | Kept |
| No record | Up to date when `AI ver` is the latest build of the camera it runs; when `slots` fails, the latest build of either camera | |

Firmware Status, the update screen and Start Monitoring read it, and Start Monitoring's banner says "AI firmware update not finished". The check Start Monitoring runs on connect sends nothing (#268), so it reads the record against the `AI ver` it already has: unfinished unless the camera runs the end camera's new build.

**Finishing** is the Update button, and "Try again" after a failed pass is the same: the update reads the record and finishes it. It restarts the camera first, so it runs the slot its selector names, then writes the end camera's image alone when the camera runs the other camera's latest build from its selected slot (one transfer, one `AI firmware`), and both images otherwise, as when a newer pair is out. It ends on the record's end camera. Before #374 "Try again" ran the whole pair ordered by the camera then running, which was image 1's, so it ended on the wrong camera.

**The limit: the record is on the phone that ran the update.** Another phone, or the same one after a reinstall, sees the camera alone: running the other camera at its latest build reads up to date, and an older one, outdated. And a record whose update another phone finished reads unfinished until this phone finishes it, which rewrites both images and ends on the right camera. Closing the gap needs the firmware to report each slot's build.

### CONFIG.TXT handshake

On an empty SD card the firmware boots with defaults and regenerates `/MANIFEST/CONFIG.TXT` from its in-RAM OPs at the next sleep. Rather than read the file over BLE, the app compares the live OP vector against `FACTORY_DEFAULTS`:

- match → `Configuration verified (N parameters at defaults)`
- drift → `Configuration differs from defaults: op18=2 (default 0), ...`

> [!NOTE]
> The app has **no rollback button**. `switchslot` exists as an HX6538 CLI command and can be driven manually from the Engineer Console, but no UI wires it to a failed verify.

---

## nRF52 AI State Machine

When the app sends `"AI firmware <filename> [crc]"`, the nRF52 does **not** simply forward it. It runs through a managed sequence:

```
SLEEP
  → Receives "AI firmware <filename> [crc]" from BLE
  → Wakes HX6538 via GPIO/I2C → Sends "Wake" to BLE → WOKEN

WOKEN
  → Runs mandatory selftest → Sends "Error bits = 0x0000" to BLE → IDLE

IDLE
  → Forwards "firmware <filename> [crc]" to HX6538 via I2C → PROCESSING

PROCESSING
  → Waits for HX6538 response (20–60 seconds)
  → Receives "Firmware update OK..." → Sends to BLE → IDLE

IDLE
  → HX6538 sends "Sleep" stats → Forwards to BLE → SLEEP
```

> [!IMPORTANT]
> `"Error bits = 0x0000"` starts with the word "Error" but indicates **no errors** — it is a selftest result, not a firmware failure. The app ignores it.

---

## HX6538 Flash Process

### A/B Slot Scheme

Each 1 MB slot is laid out (dpd layout) as: boot chain (`0x00000–0x26FFF`), the OTA memory descriptor `hx_mem_descriptor_ota` (`0x27000`, one 4 KB sector), then the application `cm55m_application` (`0x28000`→end).

| Slot | Flash Offset | Size | Region written on update |
|------|-------------|------|--------------------------|
| Slot 0 (Slot A) | `0x00000000` | 1 MB (16 × 64KB blocks) | **OTA descriptor + application** (`0x27000`→end). Boot chain `0x00000–0x26FFF` preserved. |
| Slot 1 (Slot B) | `0x00100000` | 1 MB (16 × 64KB blocks) | **Full image** from byte 0. |

The firmware identifies the **active slot** and programs the **other**:
- Active slot 0 → Programs slot 1
- Active slot 1 → Programs slot 0

> [!IMPORTANT]
> **The two slots are NOT handled symmetrically.** The ROM bootloader always loads the boot chain (`0x00000–0x26FFF`) from **Slot A**, regardless of which slot is selected. Erasing that region while running from Slot B bricks the board with no recovery except SWD. Therefore:
>
> - **Slot A (slot 0):** erase/write/verify from **`FLASH_OTA_OFFSET = 0x27000`** onward — i.e. the OTA descriptor sector **plus** the application. The boot chain at `0x00000–0x26FFF` is left untouched in flash.
> - **Slot B (slot 1):** erase/write/verify the **full 1 MB image** from byte 0. A complete image is required so the 2nd-stage bootloader (always loaded from Slot A) can read Slot B's `hx_mem_descriptor_ota` (`Slot B base + 0x27000`) and locate the application.
>
> The descriptor at `0x27000` holds a **2-byte CRC of the application** and changes with every build. The 2nd-stage bootloader reads it **from the selected slot**, so it must be rewritten whenever the application is — that is why the Slot A lower bound is `0x27000` (the descriptor) and not `0x28000` (the application). See the root-cause note below.

### Flash Sequence

The target slot determines the region written:

| Step | Slot A (slot 0) | Slot B (slot 1) |
|------|-----------------|-----------------|
| **1. Erase** | Descriptor + application: `0x27000`→end (phase 0: 1 × 4KB descriptor sector; phase 1: 8 × 4KB sectors; phase 2: 13 × 64KB blocks). Boot chain preserved. | Full erase: 16 × 64KB blocks. |
| **2. Write** | Descriptor + application (`file 0x27000`→EOF), verified per-chunk. | Entire image from byte 0, verified per-chunk. |
| **3. Full verify** | Read-back verify of the descriptor + application area. | Read-back verify of the full slot. |
| **4. Slot selector update** | Points bootloader to new slot — **only on success**. | Same. |

Device log strings for each phase (used by the app's progress parser): `erase_firmware_slot:` / `erased OK`, `write_firmware_from_sd: slot N — descriptor + application | full image`, `chunk-verified OK`, `verify_firmware_slot: slot N verify OK`.

### Safety Guarantee

The slot selector is only updated after a successful write **and** verify, so a failure during erase/write/verify leaves the previously active slot intact and bootable.

> [!NOTE]
> **Root cause of the June 2026 Slot A bricking (fixed in `firmware_updates_CGP3`).** An earlier version used `FLASH_APP_OFFSET = 0x28000` as the Slot A lower bound and wrote the **application only**, preserving the OTA descriptor sector at `0x27000`. Because that descriptor carries a CRC of the application and changes with every build, preserving it left a **stale CRC pointing at the old application** under a freshly written new application. The write passed per-chunk and full verify (the application bytes were correct), the firmware reported `Firmware update OK`, and the slot selector was updated — but on reboot the 2nd-stage bootloader compared the stale descriptor CRC against the new application, rejected it, and dropped into the Xmodem recovery menu. The fix lowers the Slot A bound to `FLASH_OTA_OFFSET = 0x27000` so the descriptor sector is erased and rewritten together with the application, keeping CRC and application in sync. (Recovery of a board already in this state: re-flash a full image over the UART console `[1] Xmodem`, or via SWD.)

---

## Error Codes

### HX6538 Firmware Errors

`xip_update_firmware_from_sd()` in the Seeed repo's `ww500_md/xip_manager.c`, one code per step. The app's `FIRMWARE_ERROR_CODES` ran one off from `-2` until #374.

| Code | Meaning |
|------|---------|
| `-1` | Firmware file not found on SD card (`/MANIFEST/<filename>`), or the slot selector could not be read. Flash untouched |
| `-2` | Flash erase failed |
| `-3` | Flash write failed, including an SD read that failed while writing |
| `-4` | Flash verify mismatch, the data written does not match the file |
| `-5` | Slot selector write failed |

### App-Side Errors

| Error | Cause |
|-------|-------|
| `TIMEOUT` | No response within 120 seconds |
| `Firmware update failed (error X)` | HX6538 reported failure |
| `aifirmware failed: Error: CRC mismatch ... Flash NOT modified.` | The file on the card does not match the CRC sent; refused before flash is touched |
| `The camera did not restart into its new image. Nothing more was written.` | The slot check before a write, or the end check, found the camera still on its previous image after a restart |
| Device disconnects | BLE link lost during update |

---

## Progress Feedback

The app synthesises a deterministic progress bar from UART lines:

| Phase | Progress | Trigger (current firmware) | Legacy trigger (older builds) |
|-------|----------|----------------------------|-------------------------------|
| `sending` | 5% | Command sent | — |
| `waking` | 8% | Line contains `"Wake"` | — |
| `erasing` | 15% | `"erase_firmware_slot"` or `"erased OK"` | `"Erasing firmware slot"` |
| `writing` | 60% | `"write_firmware_from_sd"` | `"Writing"` + `"bytes to firmware"` |
| `verifying` | 85% | `"chunk-verified OK"`, `"verify_firmware_slot"`, or `"verify OK"` | `"full verify OK"` |
| `complete` | 100% | `aifirmware` command resolves | — |

The parser ([`useFirmwareUpdate.ts`](../../src/screens/Devices/hooks/useFirmwareUpdate.ts)) matches both the current and legacy strings so it works across HX6538 builds. Phases only advance forward. If the nRF52 does not relay intermediate HX6538 output, progress jumps from 5% to 100% — the update still succeeds.

---

## Timing

| Parameter | Value |
|-----------|-------|
| `AI firmware` command timeout | 120 seconds |
| Typical erase time | ~2 seconds |
| Typical write time | 15–40 seconds |
| Typical verify time | 5–10 seconds |
| **Flash only** (image already on SD) | 20–60 seconds per image |
| **BLE transfer** of one image | ~4 minutes (~472 KB at the measured profile) |
| **Full pair from cloud** | ~8–9 minutes |
| `flashing` phase timer | 8 seconds after `sending` (HX goes silent during flash) |
| Restart after each image | `AI reset`, `AI dpd`, then up to 20 s for `Sleep` and 15 s for `Wake` |
| Wait before a retried pass | `waitForAiReady(25000)` |
| `AI reset` timeout | 8 seconds, no retries |
| Max image size | 1 MB (flash slot size) |

> [!NOTE]
> Transfer dominates a cloud update. See [File-Transfer-Protocol.md](File-Transfer-Protocol.md#measured-performance) — throughput is ~8 KB/s for the first ~24 s, then ~1.3 KB/s once Android decays the connection interval. Build ETAs from that two-phase profile, not a flat rate.

---

## Testing Checklist

### Pre-Flight
- [ ] Target `.IMG` file present at `/MANIFEST/<filename>` on SD card
- [ ] Device connected via BLE and responsive
- [ ] Battery level ≥ 30%

### During Update
- [ ] Transport lock acquired (logs: `[TransportLock] Acquired by 'aifirmware'`)
- [ ] Heartbeats paused (logs: `UART heartbeat paused state changed to: true`)
- [ ] Intermediate messages (`Wake`, `Error bits = 0x0000`) ignored
- [ ] Update completes within 120 seconds

### Dual-image pair
- [ ] `AI slots` reports the running variant before the first pass
- [ ] The device's **current** variant is flashed **last** (check the pass order in the log)
- [ ] The camera restarts after each image (`AI reset`, `AI dpd`, `Sleep`, `Wake`), and `AI slots` before image 2 shows image 1's camera from the selected slot
- [ ] Stopped between images: Firmware Status reads "Update not finished", and Finish update sends one `AI firmware` and ends on the camera the update started on
- [ ] A link drop during a pass retries once and then succeeds
- [ ] Single-variant fallback logs "Only one camera variant available"
- [ ] The transfer card names the file in that pass's `Target firmware filename` log line, for both images
- [ ] With one camera's build in the catalogue, the update screen names the missing camera and Firmware Status offers no update

### Post-Update
- [ ] App shows success → sends `AI reset`
- [ ] Device reboots into the new firmware slot (BLE link to the nRF stays up)
- [ ] `AI ver` reports the new version
- [ ] `AI slots` reports the expected running camera variant
- [ ] Config handshake reports either "verified" or an explicit mismatch list

### Failure Cases
- [ ] Missing target image file → error -1 → app shows failure
- [ ] CRC refusal (`Flash NOT modified`) → app shows failure at once, with no retry
- [ ] BLE disconnect during update → app shows failure, device firmware unchanged
- [ ] 120-second timeout → app shows failure

---

## Key Source Files

| File | Purpose |
|------|---------|
| `src/screens/Devices/hooks/useFirmwareUpdate.ts` | **Primary flow:** UART phase listener, progress parsing, reset/sleep sequence |
| `src/services/himaxUpdateRecord.ts` | This phone's record of a pair update, for finishing one that stopped |
| `src/utils/himaxFirmwareState.ts` | Up to date, outdated or unfinished, and what finishing writes |
| `src/screens/Devices/FirmwareUpdateScreen.tsx` | Update progress UI (presentational) |
| `src/screens/Devices/FirmwareStatusScreen.tsx` | Version display + update trigger |
| `src/ble/protocol/commandRegistry.ts` | `aifirmware` command definition + `FIRMWARE_ERROR_CODES` |
| `src/ble/protocol/runCommandPipeline.ts` | Lock + heartbeat + execution orchestration |
| `src/ble/session/createBleSession.ts` | Session factory |

---

*Last Updated: June 15, 2026*
