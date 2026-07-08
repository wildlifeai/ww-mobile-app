# Faster BLE File Transfer — Bottleneck Analysis & Phased Proposal

**Date:** 2026-07-08
**Scope:** app ↔ WW500 transfers in both directions — firmware images (~430–490 KB), embedded AI models (~0.5–5 MB), image previews (~16–36 KB JPEG)
**Supersedes / builds on:** `sliding_window_file_transfer.md`, `sliding_window_file_transfer_spec.md` (2026-04-28/29), `hx6538_dfu_proposal.md` (2026-04-19), `app_developer_spec (1).md` (2026-04-20)

## Implementation status (updated 2026-07-09)

Phases 0–2 are implemented on matching feature branches:

| Repo | Branch | Base | Changes |
|---|---|---|---|
| wwmobile | `feat/ble-fast-transfer` | `chore/bump-version-59` | Per-session `requestConnectionPriority` (Phase 1); this document |
| ww-hardware | `feature/ble-fast-transfer` | `feature/ai-state-machine-updates` | `ble_actions_setFastConnParams()`, fileTx packet FIFO + session watchdog (Phases 1+2); BLE firmware 0.30.42 |
| Seeed_Grove_Vision_AI_Module_V2 | `feat/ble-fast-transfer` | `feat/camera-features-combined` | `f_sync` cadence, session inactivity extension, 10 MB cap (Phase 0) |

Phase 2 needed **no HX6538 protocol change**: the nRF-side FIFO keeps the I2C
link stop-and-wait (order preserved, no `ftx err 8`) while the app overlaps the
BLE leg — enable it by passing `windowSize: 2` (File Transfer Test screen).
Phases 3–4 below remain future work. Firmware changes are hardware-untested;
see §6 risks.

---

## 1. What exists today

### Upload path (app → SD card): the `ftx` protocol

| Layer | File | Behaviour |
|---|---|---|
| App pipeline | `wwmobile/src/ble/protocol/fileTransfer/runFileTransferPipeline.ts` | Stop-and-wait (default) **and** a complete window=2 sliding-window mode, pre-built packets, session retry on `ftx err 7` |
| nRF52832 relay | `ww-hardware/MokoTech/Workspace/WildlifeWatcher_1/fileTx.c` | One packet buffered (`m_pktBuf`), relayed through `aiStateMachine` — hard one-in-flight gate (`AI_STATE_PROCESSING` until HX ACK). FILE_LOOPBACK echo now implemented |
| HX6538 receive | `Seeed…/ww500_md/if_task.c` (~line 433–606) + `fileRx.c` | Each I2C frame → `APP_MSG_FATFSTASK_APPEND_FILE` → wait disk done → send `ftx ack N` → **I2C RX not re-armed until the master reads the ACK** |
| SD write | `fatfs_task.c` | One `f_write()` per 241-byte chunk; no `f_sync()` cadence; 1 MB hard cap (`FILERX_MAX_FILE_SIZE` in `fileRx.h`) |

Every 241-byte chunk therefore costs a **full round trip across all three links**: BLE write → I2C frame → SD write → I2C ACK read → BLE notification → app JS → next write.

### Download path (SD card → app): CLI `txfile`

`prvTxFileCommand` in `CLI-FATFS-commands.c` reads 241-byte chunks; each chunk is one I2C frame (gated by `xI2CTxSemaphore`, i.e. by the master having read the previous frame), relayed by `aiProcessor.c → rxComplete() → bleMsg_sendBinary()`, which holds a **single** binary slot (`binaryPending`) until the SoftDevice confirms transmission. No app-level ACKs, but still one-chunk-at-a-time end to end.

### Measured performance (from the 2026-04-29 benchmark)

- Stop-and-wait throughput: **~0.24 KB/s**
- DATA packet → ACK: 200–420 ms; BLE idle between ACK and next packet (nRF-measured): 600–1000 ms
- `ftx err 7` (SD write fail) kills transfers > ~3–7 KB non-deterministically
- At 0.24 KB/s: a 36 KB preview ≈ 2.5 min, a 480 KB firmware image ≈ **33 min**, a 2 MB model ≈ 2.3 h. Unusable.

---

## 2. Where the time goes (per 241-byte chunk, stop-and-wait)

| Step | Cost | Source |
|---|---|---|
| **BLE write waits for a connection event** | up to 1 interval = **100–200 ms** | `MIN/MAX_CONN_INTERVAL` 100/200 ms, `ble_actions.c:97-98` |
| nRF ISR → scheduler → aiStateMachine → TWIM TX (250 B @ 400 kHz) | ~7–10 ms | `aiProcessor.c` (`NRF_DRV_TWI_FREQ_400K`, line 156) |
| HX ifTask → fatfs queue → `f_write` → back | ~2–15 ms (spikes ≫ 100 ms on FAT metadata / erase-block GC) | `if_task.c`, `fatfs_task.c` |
| HX ACK frame → IP_INT → nRF I2C read | ~2–4 ms | `if_task.c` / `aiProcessor.c` |
| **ACK notification waits for a connection event** | up to 1 interval = **100–200 ms** | same conn params |
| Android BLE stack + RN bridge + JS loop | ~50–300 ms | observed "BLE idle 600–1000 ms" |

**The radio link itself is not the problem.** MTU is 247 (244-byte payload), DLE is 251 (`sdk_config.h:11395`), so one chunk fits in a single link-layer PDU (~2.3 ms airtime at 1M PHY). The protocol pays **two 100–200 ms connection-interval waits per 241 bytes**, plus Android stack latency, plus a serialized I2C/SD round trip.

### Root causes, ranked

1. **Connection interval 100–200 ms during transfers.** The app *does* call `BleManager.requestConnectionPriority(id, 1)` at connect (`useBle.ts:232`) — but 20 s later (`FIRST_CONN_PARAMS_UPDATE_DELAY`) the nRF's `ble_conn_params` module renegotiates to its preferred 100–200 ms (`conn_params_init`, `cp_init.p_conn_params = NULL` → GAP preferred params). Any transfer started >20 s after connect runs at the slow interval. This single fact costs **~10–20×**.
2. **Per-chunk end-to-end ACK.** Even at a fast interval, stop-and-wait caps throughput at `241 B / (2 × interval + processing)`.
3. **Fully serialized I2C relay.** The HX I2C slave is not re-armed for RX until the previous ACK is read (`i2cRxDataReady`, `rearmI2C = false` for FILE_*; re-arm in `i2cTransmissionComplete`). The nRF `aiStateMachine` enforces the same one-in-flight rule from its side.
4. **SD write per 241 B + no `f_sync` cadence + 1000 ms inactivity timer** → the `ftx err 7` reliability bug (correctness blocker for big files regardless of speed).
5. **Download path: single notification slot.** `bleMsg.c` holds one binary buffer; no `hvn_tx_queue_size` configured (S132 default = 1), so ≈1 notification per connection event.

---

## 3. Phased proposal

Phases are independent and sequenced by value/effort. Phase 0+1 alone make the feature usable; Phase 3 is the end-state design the sliding-window docs were groping toward.

### Phase 0 — Reliability prerequisites (HX6538, small) — IMPLEMENTED

Already identified in `sliding_window_file_transfer.md` §"CRITICAL"; still required before any speed work matters:

1. Suspend/extend the 1000 ms inactivity timer while a fileRx session is active (`FILE_START` → 5000 ms; restored at every session end point).
2. `f_sync()` every 16 packets in the fatfs append path.
3. `f_close()` on error paths — **already handled** by the current `fatfs_task.c` (stale-handle guard on OPEN, CLOSE on every error), contrary to the April doc's hypothesis; no change needed.
4. Raise `FILERX_MAX_FILE_SIZE` (was **1 MB** — too small for the 1–5 MB models; now 10 MB, matching the app's `MAX_TRANSFER_SIZE_BYTES`).
5. Optional (not implemented): `f_expand()`/pre-allocate at FILE_START to reduce FAT churn.

### Phase 1 — Fast connection interval during transfer sessions (nRF + app, small) → **~3–6 KB/s** — IMPLEMENTED

The 10–20× win, no protocol change:

- **nRF:** `ble_actions_setFastConnParams(true)` on FILE_START requests 15–30 ms via `ble_conn_params_change_conn_params()` (which also updates the module's preferred set so it *defends* the fast params); restored on done/error/watchdog. A 30 s session watchdog also recovers abandoned sessions, which previously left the device rejecting all new FILE_STARTs with `ftx err 1` until disconnect.
- **App:** `BleManager.requestConnectionPriority(peripheral.id, 1)` at the start of every transfer (not just at connect), restored to balanced in the pipeline's `finally`.
- Same change applies to the **preview download** path when it gets a session wrapper (future).

Expected: RTT per packet 200–420 ms → ~30–60 ms; stop-and-wait lands ~3–6 KB/s. 480 KB firmware ≈ 1.5–3 min; 36 KB preview ≈ 7–12 s. (Reference point: Nordic Secure DFU on this same nRF52832 moves ~70 KB in 30–60 s ≈ 1.2–2.3 KB/s *including flash erase* — confirming the radio/pipeline supports this class of speed.)

### Phase 2 — Enable the already-built window=2 (nRF only, medium) → **~6–10 KB/s** — IMPLEMENTED

The app side was already done (`windowSize: 2` in `runFileTransferPipeline.ts`). Implementation deviates from `sliding_window_file_transfer_spec.md` in one significant, simplifying way:

- **nRF:** `fileTx.c` now holds a 4-slot packet FIFO instead of a single buffer, so BLE receive is no longer gated on the HX ACK. The `aiStateMachine` drains the FIFO one packet per IDLE/PROCESSING cycle (new benign `Ai_Event_TxFileToAI` case in PROCESSING; end-of-bump hook checks `fileTx_hasPending()`).
- **HX:** **no change needed.** The I2C link stays strictly stop-and-wait (the nRF only relays the next packet after reading the previous ACK), so packet order is preserved and the spec's 1-slot buffer + `expected_pkt` logic is unnecessary. The window benefit comes entirely from overlapping the BLE leg with the I2C+SD leg.

This also means old-firmware compatibility is unchanged: an app running window=2 against pre-FIFO firmware sees dropped packets and falls back via ACK-timeout retries (slow but functional), exactly as before.

### Phase 3 — Credit-based streaming with cumulative ACKs (all three, larger) → **~10–20 KB/s** — FUTURE

This is the Nordic-DFU-shaped end state:

**Protocol** (backwards compatible — negotiated at session start):
- `FILE_START` gains a capability exchange: device replies `ftx ack 0 win=<N> ack_every=<K>` (old firmware replies `ftx ack 0` → app falls back to stop-and-wait). N = device buffer credit (e.g. 8), K = cumulative-ACK cadence (e.g. 8).
- App streams FILE_DATA with `writeWithoutResponse` keeping ≤ N packets unacknowledged; device sends **one cumulative `ftx ack <n>`** per K packets (after those bytes hit the SD write path), replenishing credit.
- Sequence numbers (already in the wire format) + existing `ftx err 8` catch loss; whole-file CRC16 unchanged; on any error, session restart (unchanged semantics).

**nRF:** BLE RX → the existing FIFO (deepened as needed); an I2C pump drains it one 244 B frame at a time as fast as the HX accepts. ACK strings from HX pass through untouched.
- The nRF52832 TWIM EasyDMA is capped at 255 B per transfer, so **don't** chase bigger I2C frames; instead pipeline 244 B frames back-to-back. At 400 kHz that's ~8 ms per frame ≈ **~28 KB/s I2C ceiling** — comfortably above the BLE-side realistic rate.
- HX must signal RX readiness (re-arm immediately after copying into its ring buffer). Today an un-armed slave produces an address NACK, which `aiProcessor.c:i2cError()` treats as "HX asleep → pulse wake" — during an active session that path must become "brief retry", not a wake pulse.

**HX:** ring buffer (e.g. 8 × 242 B ≈ 2 KB — trivial in HX6538 SRAM); coalesce SD writes to 2–4 KB blocks (10–16× fewer `f_write` calls, far kinder to FAT + erase blocks); cumulative ACK after each coalesced write.

**App:** new streaming loop variant (simpler than the sliding-window one — no per-packet ACK matching, just credit accounting + cumulative ACK progress).

### Phase 4 — Device→app fast path for previews (nRF + HX, medium) → preview 36 KB in ~2–4 s — FUTURE

- Apply Phase 1's fast interval to downloads too.
- Configure `hvn_tx_queue_size ≥ 4` for S132 (via `ble_cfg_t` at stack init; costs a little SoftDevice RAM) and extend `bleMsg.c` to hold a small queue of binary packets instead of the single `binaryPending` slot, so several notifications go out per connection event.
- HX: read-ahead double buffering in `prvTxFileCommand` so the next SD read overlaps the I2C wait.
- Optional product-level win: a `preview` command that emits a reduced-quality/downscaled JPEG (HX6538 JPEG encoder quality is configurable) — 10–15 KB instead of 36 KB halves the wall-clock again.

---

## 4. Projected wall-clock times

| Payload | Today (0.24 KB/s) | Phase 1 (~4 KB/s) | Phase 2 (~8 KB/s) | Phase 3 (~15 KB/s) |
|---|---|---|---|---|
| 36 KB preview JPEG | ~2.5 min | ~9 s | ~5 s | ~2.5 s |
| 480 KB firmware image | ~33 min | ~2 min | ~1 min | ~32 s |
| 2 MB model | ~2.3 h | ~8.5 min | ~4.3 min | ~2.3 min |

(Conservative; Phase-3 upper bound is the ~28 KB/s I2C ceiling, with the RN bridge and Android write pacing the practical limiter.)

---

## 5. Compatibility & rollout

- Wire format (types 7/8/9/10, 3-byte header, CRC16-CCITT augmented, 8.3 names) is unchanged in every phase.
- Phase 1 is invisible to the protocol — old app + new firmware and vice versa both work (just slower on the old side).
- Phase 3 negotiates via the FILE_START ACK text, so one app binary supports every firmware vintage; keep stop-and-wait as the universal fallback (it already is, `windowSize ?? 1`).
- Mobile invariants respected: transfers keep using the exclusive transport lock; no parallel BLE *commands* are introduced (streaming FILE_DATA is one session under one lock).

## 6. Risks / open questions

1. **Conn-param tug-of-war:** some Android stacks renegotiate autonomously; firmware must tolerate (and re-request) mid-session updates. Verify with the dev Android device.
2. **HX I2C slave re-arm latency** after `hx_lib_i2ccomm_enable_read()` — determines the real I2C pipeline rate; measure with back-to-back frames (the FILE_LOOPBACK plumbing can be extended into an I2C loopback benchmark).
3. **NACK-vs-wake:** confirm the `i2cError → aiProcessorPulseWake` path can be safely suppressed during an active session (Phase 3 note above).
4. **nRF RAM headroom** for the ~1 KB FIFO + any `hvn_tx_queue_size` increase (SoftDevice RAM start moves) — check `Memory_map.md` figures and the map file after building `feature/ble-fast-transfer`.
5. **SD card variance:** Phase 0's `f_sync` cadence needs testing across card brands/ages (erase-block stalls were the prior failure mode).
6. **LoRaWAN coexistence:** fast conn interval increases radio duty cycle; confirm no scheduling conflicts with the SX1262 during long sessions.

## 7. Files reviewed

| File | Role |
|---|---|
| `wwmobile/src/ble/protocol/fileTransfer/runFileTransferPipeline.ts` (+ packets/types/ackMatcher) | App transfer pipeline, both modes |
| `wwmobile/src/hooks/useBle.ts:226-247` | Conn priority + MTU at connect |
| `ww-hardware/…/WildlifeWatcher_1/fileTx.c`, `fileTx.h` | nRF relay state machine |
| `ww-hardware/…/WildlifeWatcher_1/ble_actions.c`, `bleMsg.c`, `aiProcessor.c` | Conn params (97-104, 811-828), BLE TX queue, I2C master |
| `ww-hardware/…/ww500_c02/s132/config/sdk_config.h` | MTU 247, DLE 251, event length 6 |
| `Seeed…/ww500_md/if_task.c`, `fileRx.c`, `fileRx.h`, `CLI-FATFS-commands.c` | HX I2C slave, fileRx session, txfile download |
| `sliding_window_file_transfer.md`, `…_spec.md`, `hx6538_dfu_proposal.md`, `app_developer_spec (1).md` | Prior art & benchmarks |
