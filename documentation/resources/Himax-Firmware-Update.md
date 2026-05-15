# Himax Firmware Update

> **Related**: [File-Transfer-Protocol.md](File-Transfer-Protocol.md) (BLE file transfer for uploading `output.img`), [BLE_Architecture.md](BLE_Architecture.md) (BLE command system), [04-ENGINEER-CONSOLE.md](../onboarding/04-ENGINEER-CONSOLE.md) (`AI firmware` command).

## Overview

The WW500 device contains two processors with independent firmware:

| Processor | Role | Update Method |
|-----------|------|---------------|
| **nRF52840** | BLE radio, relay, power management | Nordic DFU (separate flow via `DfuScreen`) |
| **HX6538** (Himax) | AI inference, camera, SD card | This flow — flash from SD card over BLE |

This document covers the **HX6538 firmware update** — flashing `output.img` from the device's SD card to the Himax processor's XIP flash. Typical duration: 20–60 seconds for a ~442 KB image.

---

## Prerequisites

1. **`/MANIFEST/output.img`** must exist on the device's SD card
2. Device must be **connected via BLE** and responsive
3. **Battery level ≥ 30%** recommended (app warns below this)
4. No other BLE commands in-flight (enforced by transport lock)

> [!NOTE]
> If `output.img` is not present, the HX6538 responds with `"Firmware update FAILED (error -1). Existing firmware unchanged."` and the existing firmware is untouched.

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
| **Mobile App** | Sends `"AI firmware output.img"`, waits for response, handles UI |
| **nRF52840** | Relays command to HX6538 via I2C, manages AI state machine (wake → selftest → process → sleep) |
| **HX6538** | Reads `output.img` from SD, erases target flash slot, writes + verifies firmware, updates slot selector |

---

## Sequence Diagram

```
Mobile App                     nRF52840                         HX6538
    |                             |                                |
    |-- "AI firmware output.img" →|                                |
    |                             |-- wake HX6538 (if sleeping) -->|
    |                             |<-- "Wake 2026-04-22T..." ------|
    |<-- "Wake" ------------------|                                |
    |                             |-- "selftest" ----------------->|
    |                             |<-- "selfTest 0000" ------------|
    |<-- "Error bits = 0x0000" ---|                                |
    |                             |-- "firmware output.img" ------>|
    |                             |    (Erase → Write → Verify)    |
    |                             |<-- "Firmware update OK..."  ---|
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

| Screen | File | Context |
|--------|------|---------|
| Firmware Status | `FirmwareStatusScreen.tsx` | Shows BLE + Himax versions, triggers update |
| Firmware Update | `FirmwareUpdateScreen.tsx` | Update progress UI |

Accessible from Engineer Console → Flows → "Update Himax Firmware".

### Command Registration (`commandRegistry.ts`)

```typescript
aifirmware: createSingleLineCommand<boolean>(
    'aifirmware',
    (filename: string) => `AI firmware ${filename}`,
    /Firmware update (OK|FAILED)(?: \(error (-?\d+)\))?/i,
    (match) => {
      if (match[1].toUpperCase() === 'FAILED') {
         const errorCode = match[2] ? parseInt(match[2], 10) : NaN;
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
- Sends `"AI firmware output.img"` over BLE NUS
- Waits up to **120 seconds** for `/Firmware update (OK|FAILED)/i`
- All intermediate lines (`Wake`, `Error bits`, progress) are **ignored**
- On `OK` → returns `true`; on `FAILED` → throws with error code
- **No retries** — firmware flash is never automatically retried

### Pipeline Execution

```
┌─ runCommandPipeline ──────────────────────────────────┐
│  1. transportLock.acquire('aifirmware')                │
│  2. bleEventBus.emit(HEARTBEAT_PAUSE, true)            │
│  3. runCommand → writeToDevice("AI firmware output.img")│
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

When the app sends `"AI firmware output.img"`, the nRF52 does **not** simply forward it. It runs through a managed sequence:

```
SLEEP
  → Receives "AI firmware output.img" from BLE
  → Wakes HX6538 via GPIO/I2C → Sends "Wake" to BLE → WOKEN

WOKEN
  → Runs mandatory selftest → Sends "Error bits = 0x0000" to BLE → IDLE

IDLE
  → Forwards "firmware output.img" to HX6538 via I2C → PROCESSING

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

| Slot | Flash Offset | Size |
|------|-------------|------|
| Slot 0 | `0x00000000` | 16 × 64KB blocks (1 MB) |
| Slot 1 | `0x00100000` | 16 × 64KB blocks (1 MB) |

The firmware identifies the **active slot** and programs the **other**:
- Active slot 0 → Programs slot 1
- Active slot 1 → Programs slot 0

### Flash Sequence

1. **Erase** — 16 × 64KB blocks at target slot (~2 seconds)
2. **Write** — Entire `output.img` from SD to flash, verified per-chunk (15–40 seconds)
3. **Full verify** — Byte-for-byte verification of entire slot (5–10 seconds)
4. **Slot selector update** — Points bootloader to new slot (only on success)

### Safety Guarantee

The slot selector is only updated after successful write AND verify. At every failure point, the old firmware slot remains intact and bootable.

---

## Error Codes

### HX6538 Firmware Errors

| Code | Meaning |
|------|---------|
| `-1` | Firmware file not found on SD card (`/MANIFEST/output.img`) |
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

| Phase | Progress | Trigger |
|-------|----------|---------|
| `sending` | 5% | Command sent |
| `waking` | 8% | Line contains `"Wake"` |
| `erasing` | 15% | Line contains `"Erasing firmware slot"` or `"erased OK"` |
| `writing` | 60% | Line contains `"Writing"` + `"bytes to firmware"` |
| `verifying` | 85% | Line contains `"chunk-verified OK"` or `"full verify OK"` |
| `complete` | 100% | `aifirmware` command resolves |

Phases only advance forward. If the nRF52 does not relay intermediate HX6538 output, progress jumps from 5% to 100% — the update still succeeds.

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
- [ ] `output.img` present at `/MANIFEST/output.img` on SD card
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
- [ ] Missing `output.img` → error -1 → app shows failure
- [ ] BLE disconnect during update → app shows failure, device firmware unchanged
- [ ] 120-second timeout → app shows failure

---

## Key Source Files

| File | Purpose |
|------|---------|
| `src/screens/Devices/FirmwareUpdateScreen.tsx` | Update progress UI |
| `src/screens/Devices/FirmwareStatusScreen.tsx` | Version display + update trigger |
| `src/ble/protocol/commandRegistry.ts` | `aifirmware` command definition |
| `src/ble/protocol/runCommandPipeline.ts` | Lock + heartbeat + execution orchestration |
| `src/ble/session/createBleSession.ts` | Session factory |

---

*Last Updated: May 16, 2026*
