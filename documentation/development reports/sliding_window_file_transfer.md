# Sliding Window File Transfer — Firmware Engineering Guide

**Date:** 2026-04-29  
**Mobile App Version:** 0.0.44  
**Branch:** `feature/ai-model-families`

---

## Overview

The mobile app now supports two file transfer modes over BLE:

| Mode | Window | Behaviour | Throughput |
|---|---|---|---|
| **Stop-and-Wait** (default) | 1 | Send packet → wait ACK → send next | ~0.24 KB/s |
| **Sliding Window** | 2 | Send 2 packets → ACK-driven refill | ~0.4–0.6 KB/s (estimated) |

The sliding window mode is **ready in the mobile app** but requires a small firmware change on the HX6538 to buffer one additional packet.

---

## Current Protocol (Stop-and-Wait)

This is what works today. No firmware changes needed.

```
App                          nRF52                        HX6538
 │                            │                            │
 │── FILE_START (binary) ────►│── I2C ────────────────────►│
 │                            │                            │ open file on SD
 │◄──────── ftx ack 0 ───────│◄────────────────────────────│
 │                            │                            │
 │── FILE_DATA pkt 1 ────────►│── I2C ────────────────────►│
 │                            │                            │ write to SD
 │◄──────── ftx ack 1 ───────│◄────────────────────────────│
 │                            │                            │
 │── FILE_DATA pkt 2 ────────►│── I2C ────────────────────►│
 │                            │                            │ write to SD
 │◄──────── ftx ack 2 ───────│◄────────────────────────────│
 │                            │                            │
 │── FILE_END (CRC) ─────────►│── I2C ────────────────────►│
 │                            │                            │ verify CRC
 │◄──────── ftx done ────────│◄────────────────────────────│
```

**Key timings (benchmark from today):**

| Phase | Duration |
|---|---|
| FILE_START → ACK 0 (cold, from DPD) | ~700ms |
| FILE_START → ACK 0 (warm) | ~420–500ms |
| DATA packet → ACK | ~200–420ms |
| FILE_END → ftx done | ~210–400ms |
| **Total (TINY.TXT, 5 bytes)** | **~1.1–1.3s** |

---

## Sliding Window Protocol (Window = 2)

### What the App Does Differently

Instead of:
```
send pkt 1 → wait ack 1 → send pkt 2 → wait ack 2
```

The app now does:
```
send pkt 1
send pkt 2          ← sent immediately, no wait
     ← ack 1       ← app receives this
send pkt 3          ← refills window immediately
     ← ack 2
send pkt 4
     ...
```

The app keeps **at most 2 packets in-flight** at any time.

### What the nRF52 Needs to Change

Currently the nRF52 likely waits for an I2C ACK from the HX6538 before forwarding the next BLE packet. This needs to change:

1. **Forward BLE packets immediately over I2C** — do not block on ACK from HX6538
2. If HX6538 returns I2C busy/NACK → temporarily stop forwarding BLE packets until it's ready
3. No other changes needed — error codes and ACK forwarding remain the same

### What the HX6538 Needs to Change

#### 1. Add a 1-packet buffer (~250 bytes)

```c
typedef struct {
    uint8_t data[241];  // MAX_PAYLOAD_BYTES
    uint8_t len;
    uint8_t pktNum;
    bool    occupied;
} packet_slot_t;

packet_slot_t pending_slot;  // single-slot buffer for next expected packet
```

**Total RAM cost: ~250 bytes**

#### 2. Track expected packet number

```c
uint8_t expected_pkt = 1;  // after FILE_START ACK
```

#### 3. Modified FILE_DATA handler

When a DATA packet arrives:

```c
void handle_file_data(uint8_t pktNum, uint8_t* data, uint8_t len) {
    if (pktNum == expected_pkt) {
        // Case 1: Expected packet — write immediately
        sd_write(data, len);
        send_ack(pktNum);
        expected_pkt = next_wire_pkt(expected_pkt);

        // Check if buffer has the next one ready
        if (pending_slot.occupied && pending_slot.pktNum == expected_pkt) {
            sd_write(pending_slot.data, pending_slot.len);
            send_ack(pending_slot.pktNum);
            expected_pkt = next_wire_pkt(expected_pkt);
            pending_slot.occupied = false;
        }
    }
    else if (pktNum == next_wire_pkt(expected_pkt)) {
        // Case 2: Next packet arrived early — buffer it
        if (pending_slot.occupied) {
            // Buffer full — should not happen with window=2
            send_err(SEQUENCE_ERROR);
            return;
        }
        memcpy(pending_slot.data, data, len);
        pending_slot.len = len;
        pending_slot.pktNum = pktNum;
        pending_slot.occupied = true;
        // Do NOT send ACK yet — wait until expected_pkt is processed
    }
    else {
        // Out of window — sequence error
        send_err(SEQUENCE_ERROR);  // ftx err 8
    }
}
```

#### 4. Reset on FILE_START

```c
void handle_file_start(...) {
    expected_pkt = 1;
    pending_slot.occupied = false;
    // ... existing file open logic ...
}
```

#### 5. Flush buffer on FILE_END

Before CRC verification:
```c
if (pending_slot.occupied) {
    sd_write(pending_slot.data, pending_slot.len);
    send_ack(pending_slot.pktNum);
    pending_slot.occupied = false;
}
```

---

## How to Test from the Mobile App

### Prerequisites

1. Mobile app running on `feature/ai-model-families` branch
2. Connect to the device via Engineering Console
3. Navigate to **File Transfer Test** (via the Engineering Console action menu)

### Test 1: Stop-and-Wait (Baseline — No Firmware Changes Needed)

1. Select **Stop-and-Wait (current)** radio button
2. Tap **Send TINY.TXT** (5 bytes, 1 packet)
3. **Expected:** Transfer completes in ~1.1–1.3s, logs show:
   ```
   [FileTransfer] FILE_START ACKed (400-700ms)
   [FileTransfer] DATA phase complete: 1 pkts | avg=200-420ms [stop-and-wait]
   [FileTransfer] Transfer complete: "ftx done" received (FILE_END took 200-400ms)
   ```
4. Tap **Send MED.TXT** (300 bytes, 2 packets)
5. **Expected:** Transfer completes successfully, 2 packets acknowledged
6. Tap **Send BIG.TXT** (1000 bytes, 5 packets)
7. **Expected:** Transfer completes successfully, 5 packets acknowledged

### Test 2: Sliding Window (Requires Firmware Changes)

1. Select **Sliding Window (2-packet)** radio button
2. Tap **Send MED.TXT** (300 bytes, 2 packets)
3. **Expected logs (success case):**
   ```
   [FileTransfer] DATA phase: sliding window (w=2)
   [FileTransfer] DATA phase complete: 2 pkts | avg=XXms [sliding-window(2)]
   ```
4. **If firmware does NOT have the buffer yet**, you'll see:
   ```
   ftx err 8   ← SEQUENCE_ERROR (packet 2 arrived before 1 was processed)
   ```
   This is expected and the app handles it gracefully (session retry, then fail).

5. Tap **Send BIG.TXT** (1000 bytes, 5 packets) — this is the real throughput test
6. Compare the `avg` round-trip time with Stop-and-Wait mode
7. **Expected improvement:** ~30–50% faster per-packet average

### Test 3: BLE Loopback Benchmark

1. Tap **Run Benchmark** — sends FILE_LOOPBACK packets (type 10) at 3 payload sizes (5, 100, 241 bytes)
2. The device should echo each packet immediately — no I2C or SD card involvement
3. Results are grouped by payload size, showing avg/min/max round-trip times
4. **⚠️ Currently blocked:** The nRF52 firmware recognises FILE_LOOPBACK but does not send the echo response. All benchmark rounds will time out until firmware implements the echo. See Questions section.

### Test 4: Error Recovery

1. During a Large Binary transfer, **remove the SD card** (if physically possible)
2. **Expected:** `ftx err 7` (SD write fail), app retries once, then fails gracefully
3. Reinsert SD card, retry — should succeed

### Test 5: Verify SD Card Contents

After successful transfers, check the SD card at `/MANIFEST/`:

| File | Expected Content | Size |
|---|---|---|
| `TINY.TXT` | `Hello` | 5 bytes |
| `MED.TXT` | Repeated "Line N: The quick brown fox..." | 300 bytes |
| `BIG.TXT` | Numbered test lines | 1000 bytes |
| `BIN.DAT` | Repeating 0x00–0xFF pattern | 500 bytes |

**CRC verification:** The app logs the CRC for each file. The device confirms CRC match with `ftx done`. If there's a mismatch, you'll see `ftx err 9`.

---

## Error Code Reference

| Code | Constant | Source | Meaning | App Behaviour |
|---|---|---|---|---|
| 1 | WRONG_STATE | nRF52 | Packet outside transfer state | Fail |
| 2 | MALFORMED | nRF52 | Packet too short | Fail |
| 3 | BAD_FILENAME | nRF52 | Not 8.3 format | Fail |
| 4 | I2C_FAIL | nRF52 | I2C to HX6538 failed | Fail |
| 5 | HX_BAD_FILENAME | HX6538 | Filename rejected | Fail |
| 6 | FILE_OPEN_FAIL | HX6538 | SD card file open failed | Fail |
| **7** | **SD_WRITE_FAIL** | HX6538 | **SD write failed** | **Retry once, then fail** |
| **8** | **SEQUENCE_ERROR** | HX6538 | **Packet out of order** | **Fail (expected without buffer)** |
| 9 | CRC_MISMATCH | HX6538 | CRC check failed | Fail |
| 10 | MALFORMED_FRAME | HX6538 | Zero-length chunk | Fail |

---

## Protocol Packet Format (Unchanged)

All packets use the existing binary format over the BLE UART service:

| Byte 0 | Description | Payload |
|---|---|---|
| `0x07` | FILE_START | filename (8.3, null-padded) + file size (4 bytes LE) |
| `0x08` | FILE_DATA | packet number (1 byte) + chunk data (up to 241 bytes) |
| `0x09` | FILE_END | CRC-16-CCITT (2 bytes LE) |
| `0x0A` | FILE_LOOPBACK | arbitrary payload — device should echo back immediately (see below) |

Wire packet numbers: 1–255, wrap back to 1 (never 0).

### FILE_LOOPBACK (Packet Type 10)

Per the app developer spec, FILE_LOOPBACK is a BLE speed test diagnostic. The app sends:

```
Byte 0:  10  (FILE_LOOPBACK)
Byte 1:  sequence number (app-defined, for tracking)
Byte 2:  payload length
Bytes 3+: arbitrary payload
```

The device should echo the entire packet back as a binary notification (using `0x06` framing),
without involving I2C or the AI processor. No `ftx ack` string should be sent.

**Current status (2026-04-29):** The nRF52 firmware **receives** FILE_LOOPBACK packets
(logs show `BLE fileTx LOOPBACK N bytes`) but does **not send the echo response**.
The loopback benchmark in the mobile app times out on all attempts. This is a ~5-line
firmware change — see "Required firmware action" in the Questions section.

---

## Safety Properties (Preserved)

The sliding window design maintains all existing safety guarantees:

- ✅ **Ordered writes** — packets always written to SD in order
- ✅ **Per-packet ACK** — every packet gets an explicit `ftx ack N`
- ✅ **CRC end validation** — whole-file integrity check at FILE_END
- ✅ **Existing error codes** — no new error codes needed
- ✅ **Minimal RAM** — only ~250 bytes additional on HX6538
- ✅ **Backward compatible** — if firmware doesn't support buffering, app falls back to stop-and-wait retry behaviour

---

## 🔴 CRITICAL: SD Card Write Failure (ftx err 7) on Large Files

> **This is a firmware-side issue. All mobile app optimisations have been exhausted.**

### Symptom

When transferring files larger than ~3-7KB (15-30 packets), the HX6538 returns `ftx err 7` (SD write fail) non-deterministically. The failure point varies between attempts:

| Attempt | Packets Before Failure | Data Written |
|---|---|---|
| Run 1, attempt 1 | 30 | ~7.2 KB |
| Run 1, attempt 2 | 2 | ~0.5 KB |
| Run 2, attempt 1 | 15 | ~3.6 KB |
| Run 2, attempt 2 | 13 | ~3.1 KB |

Small files (TINY.TXT = 5 bytes, 1 packet) transfer reliably every time.

### Evidence from nRF52 Logs

The nRF52 logs reveal two contributing factors:

#### Factor 1: BLE idle time approaching the 1000ms inactivity timer

```
Packet 28: BLE idle time 608ms  → ack (ok)
Packet 29: BLE idle time 609ms  → ack (ok)
Packet 30: BLE idle time 999ms  → ack (barely)
Packet 31: BLE idle time 999ms  → ftx err 7 ← SD shutting down
```

The HX6538's 1000ms inactivity timer fires during the gap between packets, powering down the SD card subsystem just as the next write arrives.

#### Factor 2: Non-deterministic SD write failure

Even after pipelining the mobile app's send loop to minimise BLE idle time, the failure moved from packet 31 to packet 16 — **earlier**, not later. This rules out timing as the sole cause and points to:

- **SD card internal garbage collection** stalling after filling an erase block (~4-32KB)
- **Missing `f_sync()` calls** causing FAT metadata corruption
- **Write cache overflow** in the SD card's internal buffer

### What the Mobile App Has Already Done (exhausted)

| Optimisation | Status | Impact |
|---|---|---|
| Remove Phase 0 (aiver) wake gap | ✅ Done | Eliminated sleep between init and FILE_START |
| Pre-build all packets | ✅ Done | Zero JS overhead per packet |
| writeWithoutResponse for all BLE writes | ✅ Done | Saves ~200ms GATT round trip per packet |
| Pipeline send loop (write N+1 before accounting for N) | ✅ Done | Minimises inter-packet JS processing |
| Reduce FILE_START timeout 20s→10s | ✅ Done | Faster failure detection |
| Reduce benchmark delay 2s→500ms | ✅ Done | Faster test iteration |

**None of these fixed the large file transfer.** The bottleneck is firmly on the HX6538 SD card subsystem.

### Required Firmware Fixes (Priority Order)

#### 1. Extend inactivity timer during active ftx session

```c
// In FILE_START handler:
inactivity_timeout_ms = 5000;  // was 1000

// In FILE_END handler (or on error):
inactivity_timeout_ms = 1000;  // restore default
```

**Why:** The BLE round-trip is ~600-800ms. With 1000ms timeout, a single Android BLE scheduling hiccup (common) exceeds the deadline.

#### 2. Add periodic `f_sync()` every 16 packets

```c
static uint16_t writes_since_sync = 0;

void handle_file_data_write(uint8_t* data, uint16_t len) {
    FRESULT res = f_write(&file, data, len, &bw);
    if (res != FR_OK) {
        send_err(SD_WRITE_FAIL);
        return;
    }

    writes_since_sync++;
    if (writes_since_sync >= 16) {
        f_sync(&file);
        writes_since_sync = 0;
    }

    send_ack(pktNum);
}
```

**Why:** Without `f_sync()`, the FAT filesystem accumulates dirty metadata (cluster chain updates, directory entries). After ~16-32 writes, the internal state can overflow or the SD card's write cache fills, causing `f_write()` to fail.

**Trade-off:** `f_sync()` adds ~50-100ms per call, but only every 16 packets. Cost: ~3-6ms average per packet.

#### 3. Add write retry logic

```c
FRESULT safe_sd_write(FIL* fp, const void* buff, UINT btw, UINT* bw) {
    for (int attempt = 0; attempt < 3; attempt++) {
        FRESULT res = f_write(fp, buff, btw, bw);
        if (res == FR_OK) return FR_OK;

        // Brief delay to let SD card recover
        delay_ms(10);
    }
    return FR_DISK_ERR;
}
```

**Why:** SD card write failures can be transient — a brief retry often succeeds after the card completes internal housekeeping.

#### 4. Clean up file handle on error

```c
void handle_ftx_error(void) {
    if (file_is_open) {
        f_close(&file);      // properly close file handle
        file_is_open = false;
    }
    // Then enter sleep/DPD as normal
}
```

**Why:** The nRF logs show that after `ftx err 7`, the retry (attempt 2) fails much faster. This suggests the file handle from attempt 1 was never properly closed, leaving the SD card filesystem in a dirty state.

---

## Questions for Firmware Engineers

1. **Inactivity timer:** Can the 1000ms DPD timer be extended to 5000ms (or disabled entirely) while an ftx session is active? This is the single highest-impact change.

2. **`f_sync()` usage:** Is `f_sync()` called at any point during the file transfer? If not, this is the most likely cause of the non-deterministic write failures.

3. **File handle cleanup:** When `ftx err 7` occurs, is `f_close()` called on the open file? The nRF logs show retry attempts failing much faster, suggesting a stale file handle.

4. **SD card health:** How old is the SD card? Has it been reformatted recently? Heavy wear on low-cost SD cards can cause intermittent write failures at ~4-8KB boundaries (erase block size).

5. **nRF52 I2C gating:** Is the nRF52 currently blocking on I2C ACK before forwarding the next BLE packet? If so, removing this gate is required for sliding window mode.

6. **SD card init on wake:** When waking from DPD to handle FILE_START, how long does the SD card subsystem take to initialise? Benchmark shows ~700-1050ms for a cold FILE_START ACK.

7. **FILE_LOOPBACK echo (new):** The nRF52 firmware receives FILE_LOOPBACK packets (`BLE fileTx LOOPBACK N bytes` in logs) but does not send the echo response. The mobile app has a ready-to-use benchmark that tests pure BLE round-trip latency at 3 payload sizes. To enable it, the nRF52 needs to echo the received packet back via NUS TX wrapped in `0x06` binary framing:

   ```c
   // In fileTx.c, handle_loopback() or equivalent:
   case FILE_LOOPBACK:
       // Echo the entire received packet back as a binary notification
       // Wrap in 0x06 framing: [0x06, seqNum, payloadLen, ...payload]
       uint8_t echo_buf[3 + payload_len];
       echo_buf[0] = 0x06;           // binary marker
       echo_buf[1] = pkt_num;        // sequence number from received packet
       echo_buf[2] = payload_len;    // payload length
       memcpy(&echo_buf[3], payload, payload_len);
       nus_send(echo_buf, 3 + payload_len);
       break;
   ```
