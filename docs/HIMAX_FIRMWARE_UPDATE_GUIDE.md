# Himax AI Processor Firmware Update — Technical Documentation

## Overview

The WW500 Wildlife Watcher device contains two processors:

| Processor | Role | Firmware Source |
|-----------|------|-----------------|
| **nRF52840** | BLE radio, relay, power management | Updated via DFU (separate flow) |
| **HX6538** (Himax) | AI inference, camera, SD card | Updated via this flow |

This document covers the **HX6538 firmware update** — flashing a new firmware image (`output.img`) from the device's SD card to the Himax processor's XIP flash. The update is triggered from the mobile app over BLE.

**Protocol version:** Current (no versioning).
**Typical duration:** 20–60 seconds depending on image size (~442 KB typical).

---

## Prerequisites

Before initiating the update:

1. **`/MANIFEST/output.img`** must exist on the device's SD card
2. Device must be **connected via BLE** and responsive
3. **Battery level ≥ 30%** recommended (app warns below this)
4. No other BLE commands should be in-flight (enforced by transport lock)

> **IMPORTANT:** If `output.img` is not present on the SD card, the HX6538 will respond with `"Firmware update FAILED (error -1). Existing firmware unchanged."` and the existing firmware is untouched.

---

## Architecture

```
┌──────────────────┐     BLE NUS      ┌──────────────┐      I2C       ┌──────────────┐
│   Mobile App     │ ───────────────→  │   nRF52840   │  ───────────→  │   HX6538     │
│                  │ ←───────────────  │              │  ←───────────  │   (Himax)    │
│ HimaxFirmware-   │   Text strings   │  AI State    │  Binary msg   │  CLI + XIP   │
│ UpdateScreen.tsx │                   │  Machine     │               │  Flash       │
└──────────────────┘                   └──────────────┘               └──────────────┘
```

### Component Responsibilities

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
    |                             |                                |
    |                             |-- "selftest" ----------------->|
    |                             |<-- "selfTest 0000" ------------|
    |<-- "Error bits = 0x0000" ---|                                |
    |                             |                                |
    |                             |-- "firmware output.img" ------>|
    |                             |                                |
    |                             |    (HX6538 internally:         |
    |                             |     1. Identify active slot    |
    |                             |     2. Erase target slot       |
    |                             |     3. Write 442368 bytes      |
    |                             |     4. Verify written data     |
    |                             |     5. Update slot selector)   |
    |                             |                                |
    |                             |<-- "Firmware update OK.        |
    |                             |     Type 'reset' to boot       |
    |<-- "Firmware update OK..." -|     the new image."            |
    |                             |                                |
    |                             |<-- "Sleep 42 41 1 2 ..." -----|
    |<-- "Sleep" (stats) ---------|                                |
    |                             |                                |
    |   (2 second delay)          |                                |
    |                             |                                |
    |-- "reset" ----------------->|                                |
    |<-- "Device will reset..." --|                                |
    |   (BLE disconnects)         |   (Device reboots into        |
    |                             |    new firmware slot)          |
```

---

## Mobile App Implementation

### Entry Points

The firmware update can be triggered from two places:

| Entry Point | File | Context |
|-------------|------|---------|
| **Engineer Console** | `useEngineerConsoleActions.ts` → `HimaxFirmwareUpdateScreen.tsx` | Standalone test screen with dedicated UI |
| **Start Deployment** | `useStartDeployment.ts` (line 871) | Inline update during deployment setup |

### Engineer Console Flow (`HimaxFirmwareUpdateScreen.tsx`)

This is the standalone screen accessible from the Engineer Console via the `UPDATE_HIMAX_FIRMWARE` command.

#### Step 1: User Presses "Start Update"

```typescript
const session = createBleSession(device)
await session.execute(() => commandRegistry.aifirmware('output.img'))
```

#### Step 2: Command Construction (`commandRegistry.ts`)

```typescript
aifirmware: createSingleLineCommand<boolean>(
    'aifirmware',
    (filename: string) => `AI firmware ${filename}`,  // filename is REQUIRED
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
      timeoutMs: 120000,        // 2 minute timeout
      retryPolicy: { maxRetries: 0 },  // Never retry a firmware flash
      idempotent: false,
      isLongRunning: true,              // Pauses heartbeats
      requiresExclusiveLock: true,      // Acquires transport lock
    }
)
```

**What this means:**
- Sends the string `"AI firmware output.img"` over BLE NUS
- Waits up to **120 seconds** for a line matching `/Firmware update (OK|FAILED)/i`
- **All intermediate lines are ignored** (Wake, Error bits, Erasing, Writing, etc.)
- On `OK` → returns `true`
- On `FAILED` → throws with the error code
- On timeout → throws `TIMEOUT`
- **No retries** — a firmware flash is never automatically retried

#### Step 3: Pipeline Execution (`runCommandPipeline.ts`)

The pipeline wraps the raw command with:

1. **Transport lock** — acquired before sending, released in `finally`
2. **Heartbeat pause** — BLE heartbeat suspended for the entire duration
3. **Retry classification** — disabled for `aifirmware` (`maxRetries: 0`)

```
┌─ runCommandPipeline ──────────────────────────────────┐
│                                                        │
│  1. transportLock.acquire('aifirmware')                │
│  2. bleEventBus.emit(HEARTBEAT_PAUSE, true)            │
│  3. runCommand(peripheral, commandConstructor)         │
│     └─ writeToDevice("AI firmware output.img")         │
│     └─ bleEventBus.on('textLine', handleEvent)         │
│     └─ Wait for match or timeout (120s)                │
│  4. finally:                                           │
│     └─ bleEventBus.emit(HEARTBEAT_PAUSE, false)        │
│     └─ transportLock.release('aifirmware')             │
│                                                        │
└────────────────────────────────────────────────────────┘
```

#### Step 4: Response Matching (`runCommand.ts`)

Every incoming BLE text line is tested against the command's matchers:

```typescript
const handleEvent = (event) => {
    if (event.deviceId !== peripheral.id) return;
    
    // Does the line match the success or failure regex?
    if (!context.match(event.line)) {
        context.onUnexpected?.(event.line);  // Ignored
        return;
    }
    
    context.collect(event.line);  // Store the match
    if (context.isComplete()) {
        resolve(context.getResult());  // Parse and return
    }
};
```

**Lines received during a typical successful update:**

| Line | Matches? | Action |
|------|----------|--------|
| `"Wake"` | ❌ | Ignored |
| `"Error bits = 0x0000"` | ❌ | Ignored |
| `"Firmware update OK. Type 'reset' to boot the new image."` | ✅ | Captured, parsed as success |
| `"Sleep 42 41 1 2 ..."` | ❌ | Ignored (arrives after resolution) |

#### Step 5: Post-Update Reboot

After receiving `"Firmware update OK..."`, the app waits for the device to send its `"Sleep"` stats line (indicating the AI state machine has completed its cycle), then sends the `reset` command. A 5-second fallback timeout prevents hanging if the Sleep line is never received.

```typescript
// Wait for "Sleep" line from nRF52 (or 5s fallback)
await waitForDeviceReady()

// Then reboot
const postSession = createBleSession(device)
await postSession.execute(() => commandRegistry.reset())
// BLE typically drops here — this is expected
```

The `reset` command sends `"reset"` and expects `"Device will reset after disconnecting."`. The BLE connection will drop during or after this — this is normal and expected.

After the reset command (or its expected failure), the app navigates back to the Home screen.

---

## nRF52 AI State Machine

The nRF52 manages the HX6538 through a state machine. When the app sends `"AI firmware output.img"`, the nRF52 does NOT simply forward it. It runs through a sequence:

### State Transitions

```
SLEEP
  → Receives "AI firmware output.img" from BLE
  → Wakes HX6538 via GPIO/I2C
  → Sends "Wake" to BLE
  → WOKEN

WOKEN
  → Runs mandatory selftest
  → Sends "selftest" to HX6538 via I2C
  → Receives "selfTest 0000" from HX6538
  → Sends "Error bits = 0x0000" to BLE
  → SELFTEST → IDLE

IDLE
  → Forwards "firmware output.img" to HX6538 via I2C
  → PROCESSING

PROCESSING
  → Waits for HX6538 response (can take 20-60 seconds)
  → Receives "Firmware update OK. Type 'reset' to boot the new image."
  → Sends response to BLE
  → IDLE

IDLE
  → HX6538 sends "Sleep" stats
  → Forwards stats to BLE
  → SLEEP
```

### Key Insight: Intermediate Messages

The nRF52 sends several BLE messages **before** the firmware command is forwarded to the HX6538:

1. `"Wake"` — HX6538 woken from deep power-down
2. `"Error bits = 0x0000"` — Selftest result (0x0000 = all clear, no errors)

These are **not** responses to the firmware command. The mobile app must ignore them.

> **CAUTION:** `"Error bits = 0x0000"` starts with the word "Error" but indicates **no errors**. It is a selftest result, not a firmware failure. The app previously had a bug where this line triggered a false failure (fixed by removing an overly broad `failureRegex`).

---

## HX6538 Firmware Flash Process

When the HX6538 receives `"firmware output.img"` via I2C, it performs:

### 1. Slot Selection

The HX6538 uses an A/B slot scheme:
- **Slot 0:** Flash offset `0x00000000` (16 × 64KB blocks)
- **Slot 1:** Flash offset `0x00100000` (16 × 64KB blocks)

The firmware identifies the **currently active slot** and programs the **other** slot:

```
Current active: slot 0 → Programs slot 1
Current active: slot 1 → Programs slot 0
```

### 2. Erase

Erases 16 × 64KB blocks (1 MB) at the target slot's flash offset.

### 3. Write

Writes the entire `output.img` file from SD card to flash. Typical size: ~442 KB.
Each chunk is verified immediately after writing.

### 4. Full Verify

After all chunks are written, performs a full byte-for-byte verification of the entire slot.

### 5. Slot Selector Update

Writes the slot selector to point to the newly programmed slot. On the next boot, the bootloader will load from the new slot.

### 6. Response

Returns one of two strings via I2C:

| Outcome | Response String |
|---------|----------------|
| **Success** | `"Firmware update OK. Type 'reset' to boot the new image."` |
| **Failure** | `"Firmware update FAILED (error %d). Existing firmware unchanged."` |

### Error Codes

The app maps numeric error codes from `xip_update_firmware_from_sd()` to human-readable descriptions:

| Code | Meaning |
|------|---------|
| `-1` | Firmware file not found on SD card (`/MANIFEST/output.img`) |
| `-2` | SD card read error |
| `-3` | Flash erase failed |
| `-4` | Flash write failed |
| `-5` | Flash verify mismatch — data written does not match source |
| `-6` | Slot selector write failed |

> **Note:** On failure, the existing firmware is **unchanged**. The slot selector is only updated on success, so the device continues booting from the previous working slot. This is safe.

---

## Timing & Constraints

| Parameter | Value | Notes |
|-----------|-------|-------|
| BLE command timeout | 120 seconds | Set in `commandRegistry.ts` |
| Typical erase time | ~2 seconds | 16 × 64KB blocks |
| Typical write time | 15–40 seconds | Depends on SD card speed and image size |
| Typical verify time | 5–10 seconds | Full slot verification |
| Total typical duration | 20–60 seconds | For a ~442 KB image |
| Post-update reboot delay | Event-driven | App waits for "Sleep" line (5s fallback) |
| Max image size | 1 MB | Flash slot size (16 × 64KB) |

---

## Error Handling

### App-Side Errors

| Error | Cause | User-Visible Message |
|-------|-------|---------------------|
| `TIMEOUT` | No response within 120s | "Update failed." |
| `Firmware update failed on device (error X)` | HX6538 reported failure | "Update failed." + error details |
| Device disconnects during update | BLE link lost | "Update failed." |

### Firmware-Side Errors

| Condition | Response | App Behavior |
|-----------|----------|-------------|
| `output.img` not on SD | `"Firmware update FAILED (error -1)..."` | Shows failure |
| Flash erase failure | `"Firmware update FAILED (error X)..."` | Shows failure |
| Flash write/verify failure | `"Firmware update FAILED (error X)..."` | Shows failure |
| I2C communication failure | nRF52 may send NACK | Timeout after 120s |

### Recovery After Failure

- **Existing firmware is preserved** — the slot selector is only updated on success
- **No partial flash risk** — the old slot remains bootable
- **User can retry** — the app resets state and allows another attempt
- **Power loss during flash** — old slot remains active, device boots normally

---

## Progress Feedback

The app synthesises a deterministic progress bar from known UART phases:

| Phase | Progress | Trigger Line |
|-------|----------|-------------|
| `sending` | 5% | Command sent |
| `waking` | 8% | Line contains `"Wake"` |
| `erasing` | 15% | Line contains `"Erasing firmware slot"` or `"erased OK"` |
| `writing` | 60% | Line contains `"Writing"` + `"bytes to firmware"` |
| `verifying` | 85% | Line contains `"chunk-verified OK"` or `"full verify OK"` |
| `complete` | 100% | `aifirmware` command resolves successfully |

Phases only advance forward (never backward), and raw UART lines are also displayed below the progress bar (last 5 lines).

> **Note:** If the nRF52 does not relay intermediate HX6538 output, the progress bar will jump from 5% (sending) directly to 100% (complete). The update still works correctly — just with less granular progress feedback.

---

## Transport Layer Details

### Lock Acquisition

The `aifirmware` command has `requiresExclusiveLock: true`, which means:

1. `runCommandPipeline` calls `transportLock.acquire('aifirmware')` before sending
2. This prevents any other BLE commands (heartbeats, file transfers, etc.) from being sent
3. The lock is released in the `finally` block regardless of success or failure

### Heartbeat Pause

The command has `isLongRunning: true`, which means:

1. `runCommandPipeline` emits `HEARTBEAT_PAUSE(true)` before sending
2. The BLE heartbeat timer is suspended for the entire duration
3. Heartbeats resume in the `finally` block

### Command Queue

The command is enqueued through `createBleSession → commandQueue.enqueue()`:

1. If another command is already executing, the firmware update waits in the queue
2. While the firmware update is running, all subsequent commands wait
3. The queue is single-flight — only one command executes at a time

---

## Known Issues & Historical Bugs

### Bug: `"Error bits = 0x0000"` Falsely Matching as Failure (FIXED)

**Symptom:** App reported "Update failed" immediately after sending the command, even though the firmware update succeeded on the device.

**Root Cause:** The `aifirmware` command had `failureRegex: /^Error/i`, which matched the selftest response `"Error bits = 0x0000"` — a message meaning "no errors." The app treated it as a firmware failure and aborted before the real response arrived.

**Fix:** Removed the `failureRegex` entirely. The success regex `/Firmware update (OK|FAILED)/i` already handles both outcomes. All intermediate messages are now correctly ignored.

### Potential Issue: nRF52 Does Not Relay Intermediate HX6538 Output

The progress lines (`Erasing...`, `Writing...`, `verified...`) are generated by the HX6538 but may not always be relayed to BLE by the nRF52. The app's progress display relies on these lines being forwarded. If they're not forwarded, the user sees only the spinner with no progress detail — the update still works, just with less feedback.

### Historical Issue: Deployment Flow Uses Default Filename (FIXED)

The deployment flow (`useStartDeployment.ts`) previously called `aifirmware` without a filename argument, relying on an implicit default. This has been fixed — the filename parameter is now **required** and both call sites pass `'output.img'` explicitly.

---

## Testing Checklist

### Pre-Flight
- [ ] `output.img` is present at `/MANIFEST/output.img` on the SD card
- [ ] Device is connected via BLE and responsive
- [ ] Battery level is adequate (≥30% recommended)
- [ ] No other operations are in progress

### During Update
- [ ] App shows "Sending AI firmware update command..." status
- [ ] Transport lock is acquired (check logs for `[TransportLock] Acquired by 'aifirmware'`)
- [ ] Heartbeats are paused (check logs for `UART heartbeat paused state changed to: true`)
- [ ] Intermediate messages (`Wake`, `Error bits = 0x0000`) are ignored (no early failure)
- [ ] Progress lines from device are displayed (if relayed by nRF52)
- [ ] Update completes within 120 seconds

### Post-Update
- [ ] App shows "Update successful! Rebooting device..."
- [ ] `reset` command is sent after 2-second delay
- [ ] Device reboots into new firmware slot
- [ ] BLE connection drops (expected)
- [ ] App navigates to Home screen

### Failure Cases
- [ ] Missing `output.img` → "Firmware update FAILED (error -1)" → App shows failure
- [ ] BLE disconnect during update → App shows failure, device firmware unchanged
- [ ] 120-second timeout → App shows failure
- [ ] Low battery warning is displayed when battery < 30%

### Negative Tests
- [ ] Start update while another command is running → waits in queue
- [ ] Start update with no BLE connection → "Device disconnected" shown
- [ ] Device sends `"Error bits = 0x0000"` (selftest) → **must NOT** trigger failure

---

## File References

| File | Purpose |
|------|---------|
| `src/screens/Devices/HimaxFirmwareUpdateScreen.tsx` | Standalone UI screen |
| `src/ble/protocol/commandRegistry.ts` (line 211) | `aifirmware` command definition |
| `src/ble/protocol/runCommandPipeline.ts` | Lock + heartbeat + retry orchestration |
| `src/ble/protocol/runCommand.ts` | Core command execution (send + listen + timeout) |
| `src/ble/session/createBleSession.ts` | Session factory (queue integration) |
| `src/ble/protocol/commandQueue.ts` | Single-flight command queue |
| `src/ble/protocol/transportLock.ts` | Exclusive transport lock |
| `src/screens/Devices/hooks/useEngineerConsoleActions.ts` | Engineer Console routing |
| `src/screens/Deployments/hooks/useStartDeployment.ts` (line 871) | Deployment flow integration |

---

## Appendix: Firmware Enhancement Requests

The following improvements require firmware changes on the nRF52 and/or HX6538. They are listed in priority order and have been reviewed by an independent engineer.

### Priority 1: Structured Response Markers

**Problem:** The current protocol relies on fragile string parsing (`/Firmware update (OK|FAILED)/`). A wording change in firmware would silently break the app.

**Proposed firmware change:** Add machine-parseable markers alongside human-readable text:

```
[FW] START
[FW] PROGRESS 45
[FW] OK
[FW] FAIL -3
```

The app would then match `/^\[FW\] (OK|FAIL)/` — zero ambiguity, backward compatible.

### Priority 2: Pre-Flight Validation Command

**Problem:** The app only discovers `output.img` is missing after initiating the update (wasting 5–10 seconds on wake + selftest).

**Proposed firmware command:** `AI firmware_check output.img`

**Proposed response:**
```
[FW] READY size=442368 slot=1
[FW] NOTFOUND
```

Benefits: fail fast, display file size and target slot to user before committing.

### Priority 3: Deterministic Progress from HX6538

**Problem:** Progress feedback depends on whether the nRF52 relays intermediate UART lines. The app currently synthesises progress from heuristic pattern matching.

**Proposed firmware change:** HX6538 emits structured progress:
```
[FW] PROGRESS 0    // start
[FW] PROGRESS 10   // erase complete
[FW] PROGRESS 60   // write complete
[FW] PROGRESS 90   // verify complete
[FW] PROGRESS 100  // slot selector updated
```

### Priority 4: Post-Update Verification Command

**Problem:** After `reset`, the app trusts the device booted correctly but has no verification.

**Proposed firmware command:** `AI firmware_status`

**Proposed response:**
```
[FW] ACTIVE_SLOT 1 VERSION 2.3.1 CRC OK
```

The app would reconnect after reboot and verify the new version is running.

### Priority 5: Explicit Ready-for-Reset Signal

**Problem:** The app waits for the `"Sleep"` line (with a 5s fallback timeout) before sending `reset`. This is fragile.

**Proposed firmware change:** After a successful update, emit:
```
[FW] READY_FOR_RESET
```

The app would use this as the definitive trigger to send `reset`.

### Priority 6: Standardised Error Codes as Enum

**Problem:** Error codes from `xip_update_firmware_from_sd()` are undocumented magic numbers. The app has a best-guess lookup table.

**Proposed firmware change:** Define error codes as an enum in firmware and expose them in the response:
```
[FW] FAIL code=-3 stage=erase
```

This enables field debugging without needing firmware source access.

### Priority 7: Transaction ID / Correlation

**Problem:** The app listens globally for matching lines. If the device reboots mid-process or multiple commands leak logs, the app could match the wrong response.

**Proposed protocol change:**
```
AI firmware output.img req=123
[FW][123] OK
```

Even a simple incrementing ID eliminates correlation ambiguity.

### Priority 8: Firmware State Exposure

**Problem:** If BLE disconnects at 90%, the app cannot determine if the flash is partially written, complete, or corrupt.

**Proposed firmware command:** `AI firmware_state`

**Proposed response:**
```
[FW] STATE IDLE | WRITING | VERIFYING | COMPLETE
```

Enables the app to make informed retry decisions.

### Priority 9: Structured Logging Domains

**Problem:** Debugging requires reading raw BLE logs and guessing state.

**Proposed change:** Prefix all UART output with domain tags:
```
[FW] Firmware update OK...
[SYS] BUSY FW_UPDATE
[AI] Sleep 42 41 1 2...
[BLE] Connected
```

### Priority 10: Firmware Integrity Verification

**Current state:** Firmware is trusted blindly from SD card. The HX6538 already performs CRC verification during chunk writes.

**Proposed enhancement (in order of impact):**
1. **Minimum:** Expose CRC32 of written firmware for app-side comparison
2. **Better:** SHA256 hash check before writing
3. **Best:** Signed firmware with public key on device

---

## Appendix: Failure State Diagram

```
                    ┌──────────┐
                    │   IDLE   │
                    └────┬─────┘
                         │ User presses "Start Update"
                         ▼
                    ┌──────────┐
                    │ SENDING  │──── BLE disconnect ──→ FAILED (device unchanged)
                    └────┬─────┘
                         │ Command sent
                         ▼
                    ┌──────────┐
                    │ WAKING   │──── BLE disconnect ──→ FAILED (device unchanged)
                    └────┬─────┘
                         │ HX6538 awake
                         ▼
                    ┌──────────┐
                    │ ERASING  │──── BLE disconnect ──→ UNKNOWN (old slot safe)
                    └────┬─────┘     Power loss ──────→ SAFE (old slot boots)
                         │ Erase OK
                         ▼
                    ┌──────────┐
                    │ WRITING  │──── BLE disconnect ──→ UNKNOWN (old slot safe)
                    └────┬─────┘     Power loss ──────→ SAFE (old slot boots)
                         │           Flash error ─────→ FAILED (error -4)
                         │ Write + verify OK
                         ▼
                    ┌──────────┐
                    │VERIFYING │──── Verify mismatch ─→ FAILED (error -5)
                    └────┬─────┘
                         │ Slot selector written
                         ▼
                    ┌──────────┐
                    │ COMPLETE │──── Wait for Sleep ──→ Send reset
                    └────┬─────┘     5s fallback ────→ Send reset anyway
                         │
                         ▼
                    ┌──────────┐
                    │ REBOOTING│──── BLE drops (expected)
                    └──────────┘
```

**Key safety guarantee:** At every failure point, the old firmware slot remains intact and bootable. The slot selector is only updated after a successful write AND verify.

---

## Appendix: Stress & Chaos Test Cases

| Test | Expected Outcome | Status |
|------|-------------------|--------|
| Disconnect BLE at 10% (during erase) | App shows failure, old firmware boots | Not tested |
| Disconnect BLE at 50% (during write) | App shows failure, old firmware boots | Not tested |
| Disconnect BLE at 90% (during verify) | App shows failure, old firmware boots | Not tested |
| Power off device during erase | Old firmware boots on next power-on | Not tested |
| Power off device during write | Old firmware boots on next power-on | Not tested |
| Corrupt `output.img` on SD card | HX6538 verify fails, error -5 expected | Not tested |
| Slow SD card (simulate delay) | Update takes longer but succeeds within 120s | Not tested |
| Spam BLE commands during update | Transport lock blocks them; update unaffected | Not tested |
| Start update with another command running | Waits in queue, then executes | Not tested |
| Start update with `output.img` missing | Fail fast with error -1 | Verified |
| Retry after failure | State resets cleanly, second attempt works | Not tested |
| Back button during active update | `unmountedRef` prevents state updates | Not tested |
