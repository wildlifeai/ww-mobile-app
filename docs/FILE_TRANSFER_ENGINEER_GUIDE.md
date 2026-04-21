# BLE File Transfer — Firmware Engineer Testing Guide

## Overview

The mobile app now implements the **app-side** of the BLE file transfer protocol as defined in `fileTx.c` / `fileTx.h`. This document tells you what the app sends, what it expects back, and how to test your firmware integration.

The nRF52 relay code (`fileTx.c`) is already complete. **The HX6538 side needs to be implemented** to handle FILE_START, FILE_DATA, and FILE_END I2C messages, write to SD card, and send back `ftx ack/err/done` responses.

**Protocol version:** v1 (no version byte in packets — reserved for future extension).

---

## Sequence Diagram

```
App                          nRF52                        HX6538
 |                             |                             |
 |-- FILE_START (BLE) -------->|-- I2C FILE_START ---------->|
 |                             |<-- "ftx ack 0" ------------|
 |<-- "ftx ack 0" (BLE) ------|                             |
 |                             |                             |
 |-- FILE_DATA pkt 1 (BLE) -->|-- I2C FILE_DATA pkt 1 ---->|
 |                             |<-- "ftx ack 1" ------------|
 |<-- "ftx ack 1" (BLE) ------|                             |
 |                             |                             |
 |-- FILE_DATA pkt 2 (BLE) -->|-- I2C FILE_DATA pkt 2 ---->|
 |                             |<-- "ftx ack 2" ------------|
 |<-- "ftx ack 2" (BLE) ------|                             |
 |                             |                             |
 |         ... repeat for all chunks ...                     |
 |                             |                             |
 |-- FILE_END (BLE) --------->|-- I2C FILE_END ------------>|
 |                             |<-- "ftx ack end" ----------|
 |<-- "ftx done" (BLE) -------|  (nRF52 translates)         |
```

---

## Transport Guarantees (Stop-and-Wait)

The protocol is **strict stop-and-wait**. These guarantees are non-negotiable:

| Rule | Description |
|------|-------------|
| **One packet at a time** | App sends exactly one FILE_DATA packet, then waits for ACK |
| **No pipelining** | App will NOT send the next packet until `ftx ack <N>` is received |
| **Ordered ACKs** | ACKs must match the last sent packet number exactly |
| **Duplicate tolerance** | BLE may retry at the link layer — duplicate ACKs must be tolerated |
| **Retry on timeout** | App retries the *same* packet up to 3 times before aborting |

**Firmware must:**

- Treat duplicate packet numbers as **idempotent** — if the same packet number arrives again, do NOT append data, but DO send `ftx ack <N>` again
- Reject genuinely out-of-order packets with `ftx err 9`

---

## Protocol Quick Reference

### Packet Types (BLE → nRF52)

| Byte 0 | Type | Byte 1 | Byte 2 | Payload |
|--------|------|--------|--------|---------|
| `0x07` | FILE_START | `0x00` | payload len | `[size_u32_LE][filename\0]` |
| `0x08` | FILE_DATA | pkt num (1–255, wraps) | payload len | `[file_data]` (≤241 bytes) |
| `0x09` | FILE_END | `0x00` | `0x02` | `[crc16_LE]` |

### Expected Responses (nRF52 → BLE, as strings)

| Response | Meaning | When |
|----------|---------|------|
| `ftx ack 0` | FILE_START accepted | After FILE_START |
| `ftx ack <N>` | FILE_DATA chunk N accepted | After each FILE_DATA |
| `ftx done` | FILE_END accepted, CRC verified | After FILE_END |
| `ftx err <N>` | Error, transfer aborted | Any time |

### CRC Algorithm & Scope

**CRC-16/CCITT-FALSE** (not XMODEM, not augmented)

```
Polynomial: 0x1021
Init:       0xFFFF  
Reflect:    No
Final XOR:  None
```

**Test vector:** `"123456789"` (9 ASCII bytes, no null) → `0x29B1`

**CRC scope — computed over file data bytes ONLY:**
- ✅ The raw file content bytes (exactly what gets written to SD)
- ❌ Does NOT include filename
- ❌ Does NOT include packet headers (type, pkt num, length)
- ❌ Does NOT include packet numbers
- ❌ Does NOT include null terminators from filename

Reference C implementation:
```c
uint16_t crc16_ccitt(const uint8_t *data, size_t len) {
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < len; i++) {
        crc ^= ((uint16_t)data[i] << 8);
        for (int j = 0; j < 8; j++) {
            if (crc & 0x8000)
                crc = (crc << 1) ^ 0x1021;
            else
                crc = crc << 1;
        }
    }
    return crc;
}
```

---

## What the App Sends (Exact Bytes)

### Example: Sending "HELLO.TXT" containing "Hello World!\n" (13 bytes)

**FILE_START:**
```
Byte:  07  00  12  0D 00 00 00  48 45 4C 4C 4F 2E 54 58 54 00
       |   |   |   |           |
       |   |   |   size=13 LE  filename="HELLO.TXT\0"
       |   |   payload_len=18
       |   pkt_num=0
       type=FILE_START
```

**FILE_DATA (packet 1):**
```
Byte:  08  01  0D  48 65 6C 6C 6F 20 57 6F 72 6C 64 21 0A
       |   |   |   |
       |   |   |   "Hello World!\n" (13 bytes)
       |   |   payload_len=13
       |   pkt_num=1
       type=FILE_DATA
```

**FILE_END:**
```
Byte:  09  00  02  XX XX
       |   |   |   |
       |   |   |   CRC-16 LE of "Hello World!\n"
       |   |   payload_len=2
       |   pkt_num=0
       type=FILE_END
```

---

## App Retry Behavior

| Packet | Write Mode | Retry Behavior |
|--------|-----------|----------------|
| FILE_START | `write()` (with BLE response) | BLE-level confirmation; no app retries |
| FILE_DATA | `writeWithoutResponse()` | Retries same packet up to 3x on ACK timeout |
| FILE_END | `write()` (with BLE response) | BLE-level confirmation; no app retries |

**On retry, the app re-sends the identical packet** (same packet number, same data). Firmware must:

- **NOT append the data again** if the packet number matches the last received
- **DO re-send `ftx ack <N>`** for the duplicate packet
- Treat it as a no-op for file writes

---

## Testing Approach: Text Files for Easy Verification

The app transfers files as raw binary regardless of content. For testing, you can send **text files** and verify the content just by reading them on the SD card. This is the simplest way to validate end-to-end.

### Test Files to Try

| Filename | Content | Size | Packets | Purpose |
|----------|---------|------|---------|---------|
| `HELLO.TXT` | `Hello World!` | 12 bytes | 1 | Minimal — verify basic flow |
| `TEST.TXT` | `Testing 1 2 3\nLine two\n` | ~23 bytes | 1 | Verify newlines preserved |
| `NUMBERS.TXT` | `0123456789` repeated 25x | 250 bytes | 2 | Verify multi-packet + wrap-free |
| `BIG.TXT` | Any text, 2KB worth | ~2048 bytes | 9 | Verify multi-packet, no wrap |
| `WRAP.TXT` | Any text, 62KB+ | ~63000 bytes | 262 | Verify packet number wrap 255→1 |

### What to Check on SD Card

1. **File exists** at `/MANIFEST/<filename>`
2. **File size matches** the original exactly
3. **Content matches** byte-for-byte (for text files, just open and read)
4. **No extra bytes** at end of file
5. **No truncation** — last line intact

### Failure Injection Tests

| Test | What to Do | Expected Outcome |
|------|-----------|-----------------|
| Wrong packet number | App sends pkt 3, firmware expects pkt 2 | `ftx err 9`, transfer aborted |
| Skipped packet | App sends pkt 1, then pkt 3 | `ftx err 9`, transfer aborted |
| Wrong CRC | Modify FILE_END CRC bytes | `ftx err 6`, file deleted |
| Disconnect mid-transfer | Kill BLE connection during FILE_DATA | Partial file deleted on next boot/abort |
| Double FILE_START | Send FILE_START while already ACTIVE | `ftx err 1`, existing transfer aborted |
| Duplicate FILE_DATA | Send same packet number twice | No duplicate data written, `ftx ack <N>` re-sent |
| SD card removed | Remove card before FILE_START | `ftx err 5` |
| SD card full | Fill SD card, then transfer | `ftx err 7` |

---

## HX6538 Implementation Requirements

### What the nRF52 Forwards to HX6538 (I2C)

The nRF52 strips the 3-byte BLE header and forwards the payload via `aiProcessorTxBinaryMsg()`:

| Message Type | I2C Payload |
|---|---|
| `AI_PROCESSOR_MSG_FILE_START` (7) | `[size_u32_LE][filename\0]` |
| `AI_PROCESSOR_MSG_FILE_DATA` (8) | `[pkt_num_u8][file_data...]` |
| `AI_PROCESSOR_MSG_FILE_END` (9) | `[crc_lo][crc_hi]` |

### What the HX6538 Must Respond

Responses are sent as strings back through the AI state machine (same path as other `AI` command responses). The nRF52 routes any response starting with `ftx ` through `fileTx_onAiResponse()`.

| Received | Response String | Notes |
|----------|----------------|-------|
| FILE_START | `ftx ack 0` | Open file for writing on SD |
| FILE_DATA (pkt N) | `ftx ack <N>` | Write chunk to file, echo packet number |
| FILE_END | `ftx ack end` | Close file, verify CRC. **nRF52 translates this to `ftx done` for the app** |
| Any error | `ftx err <code>` | Abort. Code 5+ are HX6538-generated. |

> **IMPORTANT:** For FILE_END success, the HX6538 sends `ftx ack end` (its standard ACK convention). The nRF52 automatically translates this to `ftx done` before sending to the BLE app. See `fileTx_onAiResponse()` lines 418-422.

### HX6538 State Machine

```
IDLE
  → FILE_START received
  → validate: is SD card present? (if no → "ftx err 5")
  → validate: enough space for declared size? (if no → "ftx err 7")
  → create /MANIFEST/<filename>.tmp for write
  → set expectedPktNum = 1
  → respond "ftx ack 0"
  → ACTIVE

ACTIVE
  → FILE_DATA received
  → extract pkt_num from payload[0]
  → if pkt_num == lastReceivedPktNum:
      → (duplicate) respond "ftx ack <N>" but do NOT write data
  → if pkt_num != expectedPktNum:
      → respond "ftx err 9", delete .tmp file → IDLE
  → write payload[1..] to file (NOT the packet number byte)
  → set lastReceivedPktNum = pkt_num
  → set expectedPktNum = next(pkt_num)  (255→1 wrap)
  → respond "ftx ack <N>"
  → ACTIVE (continue)

  → FILE_END received
  → close .tmp file
  → recompute CRC over the entire written file
  → if CRC matches:
      → rename .tmp → final filename
      → respond "ftx ack end"
  → if CRC mismatch:
      → delete .tmp file
      → respond "ftx err 6"
  → IDLE

  → FILE_START received (while ACTIVE)
  → respond "ftx err 1", delete .tmp file → IDLE
```

### File Write Atomicity

Files must **never appear as complete until FILE_END succeeds**:

| Requirement | Details |
|-------------|---------|
| **Temp file during transfer** | Write to `/MANIFEST/<filename>.tmp` during ACTIVE |
| **Rename on success** | Rename `.tmp` → final filename only after CRC verification passes |
| **Delete on failure** | Delete `.tmp` file on any error, abort, or CRC mismatch |
| **No partial files** | A file at `/MANIFEST/<filename>` (without `.tmp`) is always complete and verified |

### Power Loss / Reset Recovery

If the device resets or loses power during ACTIVE:

1. **On boot:** Scan `/MANIFEST/` for any `*.tmp` files
2. **Delete them** — they are incomplete transfers
3. **Reset state machine to IDLE** — no attempt to resume
4. The app will detect the disconnect and start a fresh transfer

> **IMPORTANT:** Never attempt to resume a partial transfer. The app always starts fresh after reconnect.

### Storage Constraints

| Constraint | Value |
|------------|-------|
| Max filename length | 12 characters (8.3 format, no null) |
| Max file size (app enforced) | 10 MB |
| Target directory | `/MANIFEST/` — must exist on SD card |
| Directory creation | Firmware should create `/MANIFEST/` if it doesn't exist |

### Invalid State Handling

The firmware must reject packets that arrive in the wrong state:

| Condition | Current State | Expected Response |
|-----------|--------------|-------------------|
| FILE_DATA received | IDLE | `ftx err 1` (wrong state) |
| FILE_END received | IDLE | `ftx err 1` (wrong state) |
| FILE_START received | ACTIVE | `ftx err 1` (wrong state) |
| Malformed packet (too short) | Any | `ftx err 2` (malformed) |
| Invalid filename | IDLE | `ftx err 3` (bad filename) |

### Complete Error Code Table

| Code | Source | Meaning | App Retry Policy |
|------|--------|---------|-----------------|
| 1 | nRF52 | Wrong state (packet in unexpected phase) | Auto-retry once |
| 2 | nRF52 | Malformed packet (too short / bad length) | Never retry |
| 3 | nRF52 | Bad filename (not 8.3 uppercase) | Never retry |
| 4 | nRF52 | I2C send to HX6538 failed | Operator retry |
| 5 | HX6538 | SD card not present or not mounted | Operator retry |
| 6 | HX6538 | CRC mismatch (file corrupted) | Auto-retry once |
| 7 | HX6538 | SD card full (insufficient space) | Manual intervention |
| 8 | HX6538 | File open/write/close error | Operator retry |
| 9 | HX6538 | Packet sequence mismatch (out-of-order) | Never retry |

### Required Firmware Logs

Firmware must log these events for debugging (via UART console):

```
ftx: FILE_START received, file=HELLO.TXT, size=13
ftx: FILE_DATA pkt 1 received, 13 bytes written
ftx: FILE_DATA pkt 1 duplicate, ignored
ftx: FILE_END received, CRC=0x29B1, verified=OK
ftx: ERROR code=9, expected pkt 3 got pkt 5
ftx: Transfer complete, 13 bytes, 1 packets
ftx: Abort received, partial file deleted
ftx: Boot cleanup: deleted HELLO.TXT.tmp
```

---

## Firmware Enhancement Requests (Optional but Recommended)

These are not required for basic testing but will improve production reliability:

### 1. `ftx abort` Command (HIGH Priority)

**Why:** If the app crashes mid-transfer, the firmware may be stuck in ACTIVE state. Currently the only recovery is BLE disconnect.

```c
// String command "ftx abort" handled in ble_commands.c
// Action:
//   1. Close any open SD file handle
//   2. Delete partial .tmp file
//   3. Reset fileTx state to IDLE
//   4. Respond "ftx aborted"
```

### 2. Transfer Session ID (HIGH Priority)

**Why:** After reconnect, stale ACKs from a previous transfer could be misinterpreted. A session ID makes ACKs unambiguous.

```
Current: ftx ack 5
Better:  ftx ack A3F2 5    (where A3F2 is the session ID from FILE_START)
```

### 3. Enriched FILE_END Response (MEDIUM Priority)

```
Current: ftx done
Better:  ftx done crc=29B1 size=2048000
```

This lets the app verify both CRC and byte count independently.

### 4. Pre-Flight Check (MEDIUM Priority)

```
App sends:   "ftx ready"
Device:      "ftx ready sd=1 free=30511056"
```

### 5. Protocol Version (LOW Priority, Future-Proofing)

If the protocol evolves, consider adding a version byte to FILE_START:

```
Current:  [size_u32][filename\0]
Future:   [version_u8][size_u32][filename\0]
```

For v1, this is not required. The app does not send a version byte.

---

## App Behavior Summary

### What the App Does Automatically

1. **Validates filename** — rejects if not 8.3 uppercase format
2. **Validates file size** — rejects if > 10MB
3. **Computes CRC-16/CCITT-FALSE** over file data before transfer starts
4. **Pauses heartbeat** for the entire transfer session
5. **Acquires exclusive transport lock** — rejects all other BLE commands
6. **Sends FILE_START** with `write()` (with BLE response confirmation)
7. **Sends FILE_DATA chunks** with `writeWithoutResponse()` — strict stop-and-wait
8. **Retries same packet** up to 3 times on ACK timeout
9. **Sends FILE_END** with `write()` (with BLE response confirmation)
10. **Waits for `ftx done`** before declaring success
11. **Releases lock, resumes heartbeat** in `finally` block
12. **Aborts immediately** on disconnect, user cancel, or 3 consecutive timeouts

### Timeout Values

| Timeout | Duration | Trigger |
|---------|----------|---------|
| ACK timeout | 10 seconds | Expected ACK not received |
| Silence timeout | 15 seconds | No `ftx`-prefixed UART activity |
| Max consecutive timeouts | 3 | Auto-abort, "Bluetooth unstable" |

### Packet Number Wrapping

- Starts at 1 for first FILE_DATA
- Increments 2, 3, ... 254, 255, 1, 2, ... (wraps)
- At 241 bytes/chunk: wrap occurs every ~60KB
- 2MB file = ~33 wrap cycles — this is normal
- App tracks a monotonic internal counter for progress, wire number for ACKs

### Expected Performance

| Metric | Value |
|--------|-------|
| Chunk size | ≤241 bytes per FILE_DATA packet |
| Estimated throughput | ~2-4 KB/s (stop-and-wait over BLE) |
| 2KB file estimated time | ~1-2 seconds |
| 2MB file estimated time | ~8-16 minutes |
| 10MB file estimated time | ~40-80 minutes |

> **Note:** Actual throughput depends on BLE connection interval, signal strength, and HX6538 SD write speed. If you observe significantly lower throughput, check UART logs for errors or long ACK delays.

---

## Debugging & Validation

### nRF52 Console Output

When file packets arrive, the nRF52 logs:
```
BLE in: file pkt type 7, 18 bytes     ← FILE_START
fileTx: FILE_START sent, file=HELLO.TXT
fileTx AI resp: 'ack 0' state=0       ← HX6538 ACKed

BLE in: file pkt type 8, 16 bytes     ← FILE_DATA
fileTx: FILE_DATA pkt 1 sent (13 bytes)
fileTx AI resp: 'ack 1' state=1       ← HX6538 ACKed

BLE in: file pkt type 9, 5 bytes      ← FILE_END
fileTx: FILE_END sent
fileTx AI resp: 'ack end' state=1     ← CRC verified, translates to "ftx done"
```

### Common Failure Modes

| Symptom | Likely Cause |
|---------|-------------|
| `ftx err 1` immediately | Device was already in ACTIVE state from a previous failed transfer. Disconnect and reconnect. |
| `ftx err 3` | Filename not 8.3 uppercase. Check app is sending valid filename. |
| `ftx err 4` | I2C bus failure. Check physical connection between nRF52 and HX6538. |
| `ftx err 9` on packet 2+ | Duplicate or out-of-order packet. Check BLE retry behavior. |
| App timeout after FILE_START | HX6538 not responding to I2C file message. Is the HX6538 handler implemented? |
| CRC mismatch | Different CRC algorithm variants. Verify test vector: `"123456789"` → `0x29B1` on both sides. |
| Partial file on SD | Transfer interrupted. Check for `.tmp` file — should be cleaned up on boot. |

### Wire-Level Validation

**Recommended tools:**
- nRF Sniffer (Wireshark plugin) for BLE packet capture
- UART console logs from nRF52
- Hex dump comparison (`xxd` or similar)

**Validation checklist:**
1. Capture BLE packets during transfer
2. Verify packet sequence: START → DATA 1 → ACK 1 → DATA 2 → ACK 2 → ... → END → done
3. Verify payload lengths match byte[2] in each packet
4. Verify CRC in FILE_END matches CRC computed over all DATA payloads
5. Compare file on SD card byte-for-byte against the original

---

## Quick Start Checklist

- [ ] Verify nRF52 firmware includes `fileTx.c` and `fileTx.h`
- [ ] Implement HX6538 handler for `AI_PROCESSOR_MSG_FILE_START` (7)
- [ ] Implement HX6538 handler for `AI_PROCESSOR_MSG_FILE_DATA` (8)
- [ ] Implement HX6538 handler for `AI_PROCESSOR_MSG_FILE_END` (9)
- [ ] Verify CRC-16/CCITT-FALSE: `"123456789"` → `0x29B1`
- [ ] Verify CRC covers data bytes only (no headers, no filename)
- [ ] Write `ftx ack 0` response for FILE_START
- [ ] Write `ftx ack <N>` response for FILE_DATA (echo packet number)
- [ ] Write `ftx ack end` response for FILE_END (nRF52 translates to `ftx done`)
- [ ] Write `ftx err <N>` response for errors (see error code table)
- [ ] Handle duplicate FILE_DATA idempotently (re-ACK, don't re-write)
- [ ] Reject out-of-order packets with `ftx err 9`
- [ ] Write to `.tmp` file, rename on success, delete on failure
- [ ] Delete `.tmp` files on boot (power loss recovery)
- [ ] Ensure `/MANIFEST/` directory exists (create if missing)
- [ ] Test with `HELLO.TXT` — check file on SD card
- [ ] Test with 2KB file — verify multi-packet
- [ ] Test with 62KB+ file — verify packet number wrap
- [ ] Run failure injection tests (see table above)
- [ ] (Optional) Implement `ftx abort` string command
- [ ] (Optional) Implement transfer session ID
