# BLE File Transfer Protocol

> **Related**: [AI-Model-Integration.md](AI-Model-Integration.md) (AI model transfer flow), [BLE_Architecture.md](BLE_Architecture.md) (BLE command system), [04-ENGINEER-CONSOLE.md](../onboarding/04-ENGINEER-CONSOLE.md) (file transfer commands).

## Overview

The mobile app implements a **stop-and-wait** binary file transfer protocol over BLE NUS. Files are sent as chunked packets through the nRF52, which relays them via I2C to the HX6538 for SD card storage.

**Protocol version:** v1 (no version byte in packets).

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
 |         ... repeat for all chunks ...                     |
 |                             |                             |
 |-- FILE_END (BLE) --------->|-- I2C FILE_END ------------>|
 |                             |<-- "ftx ack end" ----------|
 |<-- "ftx done" (BLE) -------|  (nRF52 translates)         |
```

---

## Transport Guarantees

The protocol is **strict stop-and-wait**:

| Rule | Description |
|------|-------------|
| **One packet at a time** | App sends exactly one FILE_DATA packet, then waits for ACK |
| **No pipelining** | Next packet is not sent until `ftx ack <N>` is received |
| **Ordered ACKs** | ACKs must match the last sent packet number exactly |
| **Duplicate tolerance** | BLE may retry at the link layer — duplicate ACKs are tolerated |
| **Retry on timeout** | App retries the *same* packet up to 3 times before aborting |

---

## Packet Format

### Packets (BLE → nRF52)

| Byte 0 | Type | Byte 1 | Byte 2 | Payload |
|--------|------|--------|--------|---------|
| `0x07` | FILE_START | `0x00` | payload len | `[size_u32_LE][filename\0]` |
| `0x08` | FILE_DATA | pkt num (1–255, wraps) | payload len | `[file_data]` (≤241 bytes) |
| `0x09` | FILE_END | `0x00` | `0x02` | `[crc16_LE]` |

### Responses (nRF52 → BLE, as strings)

| Response | Meaning | When |
|----------|---------|------|
| `ftx ack 0` | FILE_START accepted | After FILE_START |
| `ftx ack <N>` | FILE_DATA chunk N accepted | After each FILE_DATA |
| `ftx done` | FILE_END accepted, CRC verified | After FILE_END |
| `ftx err <N>` | Error, transfer aborted | Any time |

### Example: Sending "HELLO.TXT" containing "Hello World!\n" (13 bytes)

**FILE_START:**
```
Byte:  07  00  0E  0D 00 00 00  48 45 4C 4C 4F 2E 54 58 54 00
       |   |   |   |           |
       |   |   |   size=13 LE  filename="HELLO.TXT\0"
       |   |   payload_len=14
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

## CRC Algorithm

**CRC-16/CCITT (Augmented)** — matches firmware `crc16_ccitt.c`:

```
Polynomial: 0x1021
Init:       0xFFFF
Reflect:    No
Augment:    2 bytes of 0x00 appended after data
```

**Test vector:** `"123456789"` (9 ASCII bytes, no null) → `0xE5CC`

**CRC scope — computed over file data bytes ONLY:**
- ✅ The raw file content bytes (what gets written to SD)
- ❌ Does NOT include filename, packet headers, packet numbers, or null terminators

---

## App Behavior

### Automatic Handling

1. **Validates filename** — rejects if not 8.3 uppercase format
2. **Validates file size** — rejects if > 10MB
3. **Computes CRC-16** over file data before transfer starts
4. **Pauses heartbeat** for the entire transfer session
5. **Acquires exclusive transport lock** — rejects all other BLE commands
6. **Sends FILE_START** with `write()` (with BLE response confirmation)
7. **Sends FILE_DATA chunks** with `writeWithoutResponse()` — strict stop-and-wait
8. **Retries same packet** up to 3 times on ACK timeout
9. **Sends FILE_END** with `write()` (with BLE response confirmation)
10. **Waits for `ftx done`** before declaring success
11. **Releases lock, resumes heartbeat** in `finally` block
12. **Aborts immediately** on disconnect, user cancel, or 3 consecutive timeouts

### Retry Behavior

| Packet | Write Mode | Retry Policy |
|--------|-----------|--------------|
| FILE_START | `write()` (with BLE response) | BLE-level confirmation; no app retries |
| FILE_DATA | `writeWithoutResponse()` | Retries same packet up to 3× on ACK timeout |
| FILE_END | `write()` (with BLE response) | BLE-level confirmation; no app retries |

### Timeout Values

| Timeout | Duration |
|---------|----------|
| ACK timeout | 10 seconds |
| Silence timeout | 15 seconds (no `ftx`-prefixed UART activity) |
| Max consecutive timeouts | 3 (auto-abort) |

### Packet Number Wrapping

- Starts at 1 for first FILE_DATA
- Increments 2, 3, ... 254, 255, 1, 2, ... (wraps, skips 0)
- At 241 bytes/chunk: wrap occurs every ~60KB
- 2MB file = ~33 wrap cycles

### Expected Performance

| Metric | Value |
|--------|-------|
| Chunk size | ≤241 bytes per FILE_DATA packet |
| Estimated throughput | ~2–4 KB/s (stop-and-wait over BLE) |
| 2KB file | ~1–2 seconds |
| 2MB file | ~8–16 minutes |
| 10MB file | ~40–80 minutes |

---

## Error Codes

| Code | Source | Meaning | App Retry Policy |
|------|--------|---------|-----------------|
| 1 | nRF52 | Wrong state (packet in unexpected phase) | Auto-retry once |
| 2 | nRF52 | Malformed packet (too short / bad length) | Never retry |
| 3 | nRF52 | Bad filename (not 8.3 uppercase) | Never retry |
| 4 | nRF52 | I2C send to HX6538 failed | Operator retry |
| 5 | HX6538 | Filename validation failed on AI processor | Never retry |
| 6 | HX6538 | Failed to open or create file on SD card | Operator retry |
| 7 | HX6538 | SD card write failed | Operator retry |
| 8 | HX6538 | Packet sequence mismatch (out-of-order) | Never retry |
| 9 | HX6538 | CRC mismatch (file corrupted) | Auto-retry once |
| 10 | HX6538 | Malformed frame (e.g. zero-length chunk) | Never retry |

---

## Storage Constraints

| Constraint | Value |
|------------|-------|
| Max filename length | 12 characters (8.3 format, no null) |
| Max file size (app enforced) | 10 MB |
| Target directory | `/MANIFEST/` on SD card |
| File atomicity | Written as `.tmp`, renamed on CRC success, deleted on failure |

---

## Testing

### Text Files for Verification

| Filename | Content | Size | Packets | Purpose |
|----------|---------|------|---------|---------|
| `HELLO.TXT` | `Hello World!` | 12 bytes | 1 | Minimal — verify basic flow |
| `NUMBERS.TXT` | `0123456789` repeated 25× | 250 bytes | 2 | Verify multi-packet |
| `BIG.TXT` | Any text, 2KB | ~2048 bytes | 9 | Verify multi-packet |
| `WRAP.TXT` | Any text, 62KB+ | ~63000 bytes | 262 | Verify packet number wrap 255→1 |

### Failure Injection Tests

| Test | Expected Outcome |
|------|-----------------|
| Wrong packet number | `ftx err 9`, transfer aborted |
| Wrong CRC | `ftx err 6`, file deleted |
| Disconnect mid-transfer | Partial `.tmp` file deleted on next boot |
| Duplicate FILE_DATA | No duplicate data written, `ftx ack <N>` re-sent |
| SD card removed | `ftx err 5` |
| SD card full | `ftx err 7` |

---

## Debugging

### nRF52 Console Output

```
BLE in: file pkt type 7, 18 bytes     ← FILE_START
fileTx: FILE_START sent, file=HELLO.TXT
fileTx AI resp: 'ack 0' state=0       ← HX6538 ACKed

BLE in: file pkt type 8, 16 bytes     ← FILE_DATA
fileTx: FILE_DATA pkt 1 sent (13 bytes)
fileTx AI resp: 'ack 1' state=1       ← HX6538 ACKed

BLE in: file pkt type 9, 5 bytes      ← FILE_END
fileTx: FILE_END sent
fileTx AI resp: 'ack end' state=1     ← CRC verified → "ftx done"
```

### Common Failures

| Symptom | Likely Cause |
|---------|-------------|
| `ftx err 1` immediately | Device in ACTIVE state from previous failed transfer — disconnect and reconnect |
| `ftx err 3` | Filename not 8.3 uppercase |
| `ftx err 4` | I2C bus failure between nRF52 and HX6538 |
| App timeout after FILE_START | HX6538 not responding to I2C file message |
| `ftx err 9` | CRC mismatch — verify both sides compute CRC with 2 zero-bytes augmentation |
| Partial file on SD | Transfer interrupted — check for orphaned `.tmp` files |

---

## Key Source Files

| File | Purpose |
|------|---------|
| `src/ble/protocol/fileTransfer/runFileTransferPipeline.ts` | Transfer orchestration |
| `src/ble/protocol/fileTransfer/fileTransferPackets.ts` | Packet framing and serialization |
| `src/ble/protocol/fileTransfer/ackMatcher.ts` | ACK matching for reliable delivery |
| `src/ble/protocol/fileTransfer/crc16ccitt.ts` | CRC-16 checksum implementation |
| `src/ble/protocol/fileTransfer/filenameValidator.ts` | 8.3 filename validation |
| `src/screens/Devices/FileTransferTestScreen.tsx` | File transfer test UI |

---

*Last Updated: May 16, 2026*
