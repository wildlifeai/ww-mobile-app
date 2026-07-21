# Himax Firmware Update

> **Related**: [File-Transfer-Protocol.md](File-Transfer-Protocol.md) (BLE file transfer for uploading firmware images), [BLE_Architecture.md](BLE_Architecture.md) (BLE command system), [04-ENGINEER-CONSOLE.md](../onboarding/04-ENGINEER-CONSOLE.md) (`AI firmware` command).

## Overview

The WW500 device contains two processors with independent firmware:

| Processor | Role | Update Method |
|-----------|------|---------------|
| **nRF52840** | BLE radio, relay, power management | Nordic DFU (separate flow via `DfuScreen`) |
| **HX6538** (Himax) | AI inference, camera, SD card | This flow — flash from SD card over BLE |

This document covers the **HX6538 firmware update** — flashing a firmware image (`<filename>.IMG` derived dynamically in 8.3 format or defaulting to `OUTPUT.IMG`) from the device's SD card to the Himax processor's XIP flash. Typical duration: 20–60 seconds for a ~442 KB image.

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
    |-- "reset" ----------------->|                                |
    |<-- "Device will reset..." --|    (Reboots into new slot)     |
```

---

## Mobile App Implementation

### Entry Point

| Screen / module | File | Context |
|-----------------|------|---------|
| Firmware Status | `FirmwareStatusScreen.tsx` | Shows BLE + Himax versions, triggers update |
| Firmware Update | `FirmwareUpdateScreen.tsx` | Update progress UI (presentational) |
| **Update orchestration** | `screens/Devices/hooks/useFirmwareUpdate.ts` | **The actual flow:** UART phase listener, progress parsing, slot/transfer logic, and the post-update reset/sleep sequence. Start here when changing behaviour. |

Accessible from Engineer Console → Flows → "Update Himax Firmware".

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
    }
)
```

**Key behaviors:**
- Sends `"AI firmware <filename> [crc]"` over BLE NUS (with CRC validation if provided)
- Waits up to **120 seconds** for `/Firmware update (OK|FAILED)/i`
- All intermediate lines (`Wake`, `Error bits`, progress) are **ignored**
- On `OK` → returns `true`; on `FAILED` → throws with error code
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

After `"Firmware update OK..."`, the app:
1. Waits for the `"Sleep"` stats line (5-second fallback timeout)
2. Sends the `reset` command → `"Device will reset after disconnecting."`
3. BLE connection drops (expected)
4. Navigates to Home screen

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

| Code | Meaning |
|------|---------|
| `-1` | Firmware file not found on SD card (`/MANIFEST/<filename>`) |
| `-2` | SD card read error |
| `-3` | Flash erase failed |
| `-4` | Flash write failed |
| `-5` | Flash verify mismatch — data written does not match source |
| `-6` | Slot selector write failed |

### App-Side Errors

| Error | Cause |
|-------|-------|
| `TIMEOUT` | No response within 120 seconds |
| `Firmware update failed (error X)` | HX6538 reported failure |
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
| BLE command timeout | 120 seconds |
| Typical erase time | ~2 seconds |
| Typical write time | 15–40 seconds |
| Typical verify time | 5–10 seconds |
| Total typical duration | 20–60 seconds (for ~442 KB image) |
| Post-update reboot delay | Event-driven (5s fallback) |
| Max image size | 1 MB (flash slot size) |

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

### Post-Update
- [ ] App shows success → sends `reset` command
- [ ] Device reboots into new firmware slot
- [ ] BLE connection drops (expected)

### Failure Cases
- [ ] Missing target image file → error -1 → app shows failure
- [ ] BLE disconnect during update → app shows failure, device firmware unchanged
- [ ] 120-second timeout → app shows failure

---

## Key Source Files

| File | Purpose |
|------|---------|
| `src/screens/Devices/hooks/useFirmwareUpdate.ts` | **Primary flow:** UART phase listener, progress parsing, reset/sleep sequence |
| `src/screens/Devices/FirmwareUpdateScreen.tsx` | Update progress UI (presentational) |
| `src/screens/Devices/FirmwareStatusScreen.tsx` | Version display + update trigger |
| `src/ble/protocol/commandRegistry.ts` | `aifirmware` command definition + `FIRMWARE_ERROR_CODES` |
| `src/ble/protocol/runCommandPipeline.ts` | Lock + heartbeat + execution orchestration |
| `src/ble/session/createBleSession.ts` | Session factory |

---

*Last Updated: June 15, 2026*
