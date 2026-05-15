# Engineer Console & BLE Tools

The Engineer Console is the developer's direct interface to the Wildlife Watcher device. It provides raw BLE command access, hardware testing tools, and device diagnostics — all independent of the standard deployment flow.

**Deep dive:** [BLE Architecture Guide](../resources/BLE_Architecture.md) — command system, timing constraints, message classification

---

## Accessing the Engineer Console

**Screen:** `EngineerConsoleScreen.tsx`
**Hook:** `useEngineerConnect.ts`
**Dialog:** `EngineerConnectDialog.tsx`
**Entry:** Hamburger menu → "Engineer Console" → scan → auto-connect → `EngineerConsoleScreen`

The Engineer Console is accessible from the side drawer at any time, independent of the Scanner tab.

---

## BLE Command Reference

### Key Commands

| Command | Response | Purpose |
|---------|----------|---------|
| `setutc` | `UTC set to ...` | Sync device clock to phone UTC |
| `ver` | `Ver X.Y.Z` | Read firmware version |
| `battery` | `Battery: N%` | Read battery level |
| `selftest` | Pass/fail flags | Run hardware self-test |
| `AI getop -1` | `OpParams ...` | Bulk fetch all operational parameters (OP 0–20) |
| `AI setop <idx> <val>` | `Set OpParam...` | Write a single operational parameter |
| `AI setdid <uuid>` | `Deployment ID set to...` | Set deployment ID (null = clear) |
| `AI setgps <lat>,<lng>,<alt>` | `Device GPS set...` | Set device GPS coordinates |
| `AI info` | Status flags | Read AI processor status |
| `AI capture 1 1000` | Triggers capture | Manual image capture |
| `erasemodel` | `Model erased` | Remove currently loaded AI model |
| `loadmodel <id> <ver>` | `Model loaded` | Load AI model from SD card |
| `dis` | — | Disconnect BLE |
| `get heartbeat` | `heartbeat is...` | Read heartbeat interval |
| `AI inithm0360` | — | Reinitialise HM0360 sensor (recovery from black image state) |

### OP Parameter Index

The complete index (`OP_PARAMETER` enum + `FACTORY_DEFAULTS`) is defined in [`useDeviceSettings.ts`](../../src/hooks/useDeviceSettings.ts) — that file is the **single source of truth** for all parameter indices and default values (OP 0–20).

The following subset is directly used during deployment:

| Index | Constant | Role |
|-------|----------|------|
| 5 | `NUM_PICTURES` | Images per trigger (default: 1; Dev Deployment sets 2) |
| 7 | `TIMELAPSE_INTERVAL` | 0 for activity, N seconds for timelapse/mixed |
| 8 | `INTERVAL_BEFORE_DPD` | Always 1000ms |
| 9 | `LED_BRIGHTNESS` | Flash brightness 0–100% |
| 10 | `CAMERA_ENABLED` | 1 = on, 0 = off (always sent last) |
| 11 | `MD_INTERVAL` | 1000ms for activity/mixed, 0 for timelapse |
| 12 | `FLASH_DURATION` | Flash pulse duration in ms |
| 13 | `FLASH_LED` | Flash type: 0 = off, 1 = visible, 2 = IR |
| 14 | `MODEL_PROJECT` | Currently loaded AI model ID |
| 15 | `MODEL_VERSION` | Currently loaded AI model version |
| 17 | `MD_SENSITIVITY` | 1 for activity/mixed, 0 for timelapse |
| 18 | `TEST_MODE_BITS` | Diagnostic bitmask (bit 1 = `TEST_BIT_SAVE_BMP`) |
| 19 | `IMAGES_COUNT` | Total images captured (reset on new deployment) |
| 20 | `IMAGES_FILE_INDEX` | Image subdirectory counter (reset on new deployment) |

### OP Bulk Fetch Optimization (`AI getop -1`)

All deployment flows use the **bulk parameter fetch** command to minimize BLE round-trips:

1. Fetch all params once: `AI getop -1` → `OpParams 1324 6 0 18 ...`
2. Cache the result in memory
3. Before each `AI setop`, compare target value against cached value
4. Skip the write if the parameter is already correct

**Fallback:** If `AI getop -1` fails (older firmware), all functions gracefully fall back to "blind write" mode — they send every `setop` unconditionally.

### Capture Method OP Mapping

| Method | Commands | Notes |
|--------|----------|-------|
| Activity Detection | `setop 17 1`, `setop 11 1000`, `setop 7 0`, `setop 8 1000`, `setop 10 1` | MD on, timelapse off |
| Timelapse | `setop 17 0`, `setop 11 0`, `setop 7 <secs>`, `setop 8 1000`, `setop 10 1` | MD off, timelapse on |
| Mixed | `setop 17 1`, `setop 11 1000`, `setop 7 <secs>`, `setop 8 1000`, `setop 10 1` | MD on + timelapse on |

Camera enable (`setop 10 1`) is always sent **last** to avoid premature triggers. All writes are conditional — unchanged values are skipped.

---

## Hardware Testing Tools

These tools are accessed from the Engineer Console → Flows / Command Reference menu. They bypass standard deployment flows and interface directly with the device API.

### Motion Detection Screen

**Screen:** `StandaloneMotionDetectionScreen.tsx`
**Purpose:** Real-time visualization of the HM0360 sensor's internal motion detection algorithm.

**How it works:**
- Uses `useMotionDetectionStream` to subscribe to device log messages
- Parses 256-bit binary payload representing a 16×16 grid of motion blocks
- Renders the grid natively — visual feedback loop helps understand environmental threshold behaviour

### Camera Settings Test Screen

**Screen:** `CameraSettingsTestScreen.tsx`
**Purpose:** Capture test images with configurable flash parameters to validate LED hardware and exposure settings.

**Features:**
- **Flash Configuration:** Live adjustment of `Flash Duration`, `Flash LED Type` (visible/IR/none), and `LED Brightness` (0–100%)
- **Direct Capture:** Triggers via `AI capture 1 1000` (direct command)
- **DPD Synchronisation:** Before capture, writes `MD_INTERVAL=0` and `TIMELAPSE_INTERVAL=0` alongside flash OPs (9, 12, 13), then waits for Deep Power Down (`Sleep` message). This ensures CONFIG.TXT is committed with new flash parameters and zeroed background triggers.
- **Post-Capture Cleanup:** Sends `CAMERA_ENABLED=0` (`setop 10 0`) and waits for the resulting sleep cycle — returns device to clean idle state.
- **Auto Exposure (AE) Data:** Captures console logs (`Integration time`, `Analog gain`, etc.) and renders live AE metrics with a visual AE Mean progress bar (0–255)
- **Gallery:** Every captured image is stored with its `cameraParams` and `aeData`. Tapping a thumbnail opens a light-box modal showing the exact settings for that frame.

> [!WARNING]
> **Firmware Bug — Flash strobe not configured in manual capture path.** The Himax firmware only configures the HM0360 strobe mode (`Strobe mode 0x03`) when entering DPD via the normal MD sleep preparation path. The manual `AI capture` command bypasses this, so the flash LED never fires. The timelapse workaround forces the capture through the normal DPD path where strobe IS configured. **TODO:** Revert to direct `AI capture` once the Himax firmware is updated.

> [!NOTE]
> The flash LED hardware is driven by the Himax AI processor (HX6538), not the nRF52 (WW500). The nRF only stores and forwards the OP values — the Himax reads them from CONFIG.TXT during the capture wake cycle.

---

## BLE Connection Safety

| Feature | Behaviour |
|---------|-----------|
| Heartbeat | 58s idle → sends `get heartbeat` (or RSSI ping if UART paused) |
| Disconnect Detection | `WWBleDisconnectedBanner` shown on all BLE-dependent screens |
| Disconnect Signal | `DEVICE_SIGNAL(DISCONNECT)` → `commandQueue.clearAll()` — rejects all in-flight commands instantly |
| Navigation Guard | `isNavigatingAway` ref prevents spurious disconnect alerts during screen transitions |

All screens use `bleDeviceRef` (a `useRef`) for device state inside timer callbacks, preventing stale closure bugs.

> [!NOTE]
> On unexpected disconnect, the BLE pipeline rejects all in-flight and queued commands **instantly** via the `DISCONNECT` signal (see [BLE Architecture — Disconnect Resilience](../resources/BLE_Architecture.md#disconnect-resilience)).

---

## Key Source Files

| File | Purpose |
|------|---------|
| [`EngineerConsoleScreen.tsx`](../../src/screens/Devices/EngineerConsoleScreen.tsx) | Console UI (log viewer + command input) |
| [`useEngineerConsoleActions.ts`](../../src/screens/Devices/hooks/useEngineerConsoleActions.ts) | Console command dispatch |
| [`commandRegistry.ts`](../../src/ble/protocol/commandRegistry.ts) | All BLE command definitions |
| [`deploymentPipeline.ts`](../../src/ble/workflows/deploymentPipeline.ts) | Shared pipeline functions |
| [`useDeviceSettings.ts`](../../src/hooks/useDeviceSettings.ts) | OP enum, factory defaults, quiesce |
| [`useBleHeartbeat.ts`](../../src/hooks/useBleHeartbeat.ts) | 58s heartbeat mechanism |

*Last Updated: May 15, 2026*
