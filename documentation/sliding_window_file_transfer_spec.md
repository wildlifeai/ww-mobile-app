# BLE File Transfer: 2-Packet Sliding Window Protocol Spec

**Status:** Draft — for review by nRF52 + HX6538 engineering teams  
**Author:** Wildlife Watcher Mobile Team  
**Date:** 2026-04-28  

---

## 1. Overview

Replace the current stop-and-wait (S&W) protocol with a **2-packet sliding window** to reduce idle time between BLE round-trips. This targets the ~200–400ms gap that currently sits between ACK receipt and the next write.

### Expected improvement

| Metric | Stop-and-Wait | Window=2 |
|--------|---------------|----------|
| Effective RTT cost | 1× per packet | ~0.5× per packet |
| Throughput | ~0.24 KB/s | ~0.4–0.6 KB/s |
| Inactivity timer risk | High | Significantly reduced |

### Design constraints

- Same packet format (types 7/8/9)
- Same CRC + `FILE_END` verification
- Backward-compatible — the app will offer both modes via the test screen
- No large buffers required (max 1 extra 241-byte slot)

---

## 2. Protocol Rules

### Window size
```
WINDOW_SIZE = 2
max_unacked_packets ≤ 2
```

### ACK semantics (unchanged)
```
ftx ack <N>
```
ACK N means: "Packet N has been written to SD successfully."

### Ordering guarantee
Strict in-order writes are maintained:
```
N → N+1 → N+2 → ...
```
If out-of-order packet arrives → `ftx err 8` (SEQUENCE_ERROR, existing behavior).

### Flow (replaces stop-and-wait)
```
send pkt 1
send pkt 2       ← window full
wait ACK 1       ← on receive, slide window
send pkt 3
wait ACK 2
send pkt 4
...
```

---

## 3. HX6538 Firmware Changes

### 3.1 Add 2-slot packet buffer

```c
typedef struct {
    uint8_t data[241];
    uint8_t len;
    uint8_t pktNum;
    bool occupied;
} packet_slot_t;

static packet_slot_t slots[2];
```

**Memory cost:** ~500 bytes total.

### 3.2 Add tracking state

```c
static uint8_t expected_pkt = 1;
```

### 3.3 On FILE_DATA receive

```c
void handleFileData(uint8_t pktNum, uint8_t *data, uint8_t len) {
    // Reject if outside window
    uint8_t next = nextWireNum(expected_pkt);
    if (pktNum != expected_pkt && pktNum != next) {
        sendError(SEQUENCE_ERROR);
        return;
    }

    if (pktNum == expected_pkt) {
        // Case 1: Expected packet — write immediately
        writeToSd(data, len);
        sendAck(pktNum);
        expected_pkt = nextWireNum(expected_pkt);

        // Flush buffer if next packet is already waiting
        if (slots[1].occupied && slots[1].pktNum == expected_pkt) {
            writeToSd(slots[1].data, slots[1].len);
            sendAck(slots[1].pktNum);
            slots[1].occupied = false;
            expected_pkt = nextWireNum(expected_pkt);
        }
    } else {
        // Case 2: Next packet arrived early — buffer it
        memcpy(slots[1].data, data, len);
        slots[1].len = len;
        slots[1].pktNum = pktNum;
        slots[1].occupied = true;
        // Do NOT ACK yet — ACK only after SD write
    }
}
```

### 3.4 Inactivity timer interaction

> [!IMPORTANT]
> The sliding window naturally reduces the gap between I2C messages, making `ftx err 7` (SD write fail from DPD) much less likely. However, **the inactivity timer reset fix is still needed** for robustness.

---

## 4. nRF52 Firmware Changes

### Current behavior
```
Receive BLE FILE_DATA → forward to HX6538 via I2C → wait for ACK → accept next BLE packet
```

### Required change
```
Receive BLE FILE_DATA → forward to HX6538 via I2C immediately
Do NOT block on ACK before accepting next BLE packet
```

### I2C busy handling (recommended)
```c
if (i2c_busy || hx6538_buffer_full) {
    // Temporarily stop accepting BLE packets
    // Resume when HX6538 signals ready
}
```

The nRF52 does not need to track window state — it simply acts as a pass-through.

---

## 5. Mobile App Changes

The app-side implementation is the most substantial change. A new pipeline variant runs alongside the existing stop-and-wait pipeline, selectable via the test screen.

### 5.1 New state tracking

```typescript
let nextToSend = 1          // next packet number to transmit
let nextExpectedAck = 1     // oldest unacked packet
const inFlight = new Map<number, { packet: Uint8Array, sentAt: number }>()
```

### 5.2 Send loop (replaces blocking per-packet loop)

```typescript
// Fill window
while (inFlight.size < WINDOW_SIZE && nextToSend <= totalPackets) {
    const pkt = preBuiltPackets[nextToSend - 1]
    await writeBinaryToDevice(peripheral, pkt.packet, false)
    inFlight.set(nextToSend, { packet: pkt.packet, sentAt: Date.now() })
    nextToSend++
}
```

### 5.3 ACK handling

```typescript
function onAck(ackNum: number) {
    if (ackNum === nextExpectedAck) {
        inFlight.delete(ackNum)
        nextExpectedAck++
        packetsAcked++

        // Immediately send next packet (fill window)
        fillWindow()
    }
    // ACK for future packet → ignore (duplicate protection)
    // ACK for past packet → ignore (already processed)
}
```

### 5.4 Timeout + retry (per-packet within window)

```typescript
const PACKET_TIMEOUT_MS = 1200  // tighter than S&W since we have overlap

function checkTimeouts() {
    const now = Date.now()
    for (const [pktNum, info] of inFlight) {
        if (now - info.sentAt > PACKET_TIMEOUT_MS) {
            // Resend this specific packet
            writeBinaryToDevice(peripheral, info.packet, false)
            info.sentAt = now
            retryCount++
        }
    }
}
```

> [!WARNING]
> If a packet times out, do NOT send new packets — only retry the missing one. This prevents the window from growing beyond 2.

### 5.5 ACK matcher update

Current matcher expects a single packet number. For windowed mode, accept any ACK within the window:

```typescript
// Window-aware matching
expected: { min: nextExpectedAck, max: nextExpectedAck + WINDOW_SIZE - 1 }

// Accept if ackNum ∈ [min, max]
// Ignore if ackNum < min (duplicate)
// Ignore if ackNum > max (future — shouldn't happen)
```

---

## 6. Backward Compatibility

The app implements both modes:
- **Stop-and-Wait** (current, default): unchanged behavior
- **Sliding Window** (new, opt-in): selectable in the File Transfer Test Screen

The protocol is negotiated implicitly:
- S&W firmware + windowed app: works correctly (device ACKs before next packet arrives, window never exceeds 1 in practice)
- Windowed firmware + S&W app: works correctly (device buffer is never used)
- Windowed firmware + windowed app: full benefit

---

## 7. Safety Properties

This design preserves:

- ✅ Ordered SD writes (strict sequence enforcement)
- ✅ Per-packet ACK validation
- ✅ Existing error codes (1–10)
- ✅ CRC end-of-file validation
- ✅ Minimal RAM usage (~500 bytes on HX6538)
- ✅ Session retry on `ftx err 7`
- ✅ Disconnect detection + circuit breaker

---

## 8. Failure Handling

| Failure | Behavior |
|---------|----------|
| `ftx err 7` (SD write fail) | Restart full session from `FILE_START` (same as S&W) |
| `ftx err 8` (sequence error) | Restart full session |
| BLE disconnect | In-flight packets lost; restart session |
| Packet timeout | Retry specific packet only (not whole session) |
| `ftx err 9` (CRC mismatch) | Restart full session |

---

## 9. Implementation Checklist

### HX6538 Firmware
- [ ] Add 1-packet buffer struct (~250 bytes)
- [ ] Track `expected_pkt` counter
- [ ] Implement buffer-then-flush logic on FILE_DATA
- [ ] Reset buffer state on FILE_START
- [ ] Unit test: packets arriving in order
- [ ] Unit test: packet N+1 arrives before N is ACKed
- [ ] Unit test: out-of-window packet rejected

### nRF52 Firmware
- [ ] Remove ACK gating on BLE→I2C forwarding
- [ ] Add I2C busy back-pressure handling
- [ ] Test: 2 rapid BLE packets forwarded without blocking

### Mobile App
- [ ] Add radio button toggle in FileTransferTestScreen (S&W vs Window)
- [ ] Implement `runSlidingWindowTransfer()` pipeline variant
- [ ] Windowed send loop with `inFlight` tracking
- [ ] Event-driven ACK handling within window
- [ ] Per-packet timeout + retry
- [ ] Window-aware ACK matcher
- [ ] Progress reporting (based on ACKed packets, not sent)
- [ ] Integration test with existing S&W firmware (graceful degradation)
