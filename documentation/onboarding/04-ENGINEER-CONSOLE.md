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

### DFU Recovery (Device Firmware Update)

If a device becomes stuck in Nordic DFU mode (advertising as `DfuTarg` with the `fe59` service UUID), it will be **invisible** to the normal Scanner tab to prevent users from accidentally interrupting operations. 

To rescue a device in DFU mode:
1. Open the Engineer Console.
2. The Engineer Console scanner automatically includes the DFU service UUID in its scan.
3. When the `DfuTarg` device is discovered, the Engineer Console will immediately intercept it and route you to the **DFU Firmware Update** screen.
4. From there, you can select a firmware ZIP file from your phone and flash the device back to a working state.

---

## BLE Command Reference

Commands are organised by **target processor**. All commands are sent over BLE; AI-prefixed commands are forwarded by the nRF52 to the Himax chip.

### 📡 BLE Processor (nRF52)

Direct commands handled by the BLE chip — no `AI` prefix.

#### System & Identity

| Command | Response | Purpose |
|---------|----------|---------|
| `id` | BLE name | Device BLE advertising name |
| `ver` | `WW500-C02 V 00.21.14 ...` | BLE firmware version + build date |
| `device` | `WW500-C00` | Product name / hardware variant |
| `status` | `Sensor: enabled/disabled` | Device status (sensor, LoRaWAN, sequence) |
| `state` | `State = ...` | State machine state |
| `battery` | `Battery = 3305mV 100%` | Battery voltage and percentage |
| `temp` | `Temperature: 23.5C` | Board temperature |
| `selftest` | `Error bits = 0x0000` | Hardware self-test bitmask |
| `get heartbeat` | `heartbeat is 58s` | Read/set heartbeat interval |

#### Clock & Location

| Command | Response | Purpose |
|---------|----------|---------|
| `setutc` | `RTC set to...` | Sync device clock to phone UTC (auto-generates ISO 8601 timestamp) |
| `getutc` | `UTC is: ...` | Read device system time |
| `getgps` | `Location is: ...` | Read stored GPS location |

#### Device Control

| Command | Response | Purpose |
|---------|----------|---------|
| `dis` | `Disconnecting` | BLE disconnect |
| `reset` | `Device will reset after disconnecting.` | Board reset (takes effect after disconnect) |
| `erase` | `NVM will be erased after disconnecting.` | Erase non-volatile memory (takes effect after disconnect) |
| `dfu` | `Device will enter DFU mode after disconnecting.` | Enter DFU mode for BLE firmware update |
| `wake` | `AI processor is awake` | Wake AI processor from Deep Power Down |

#### LoRaWAN

| Command | Response | Purpose |
|---------|----------|---------|
| `get deveui` | `DevEui: XX:XX:...` | Read LoRaWAN DevEUI |
| `get appeui` | `AppEui: XX:XX:...` | Read LoRaWAN AppEUI |
| `get appkey` | `AppKey: XX:XX:...` | Read LoRaWAN AppKey (may fail with `Failed 2`) |
| `join` | `Already joined` / `OK` / `Wrong state` | Request LoRaWAN join |
| `ping` | `Joined` / `Not Joined` | Send LoRaWAN test packet |
| `network` | `RSSI: -85dB, SNR: 7dB` | Most recent LoRaWAN signal quality |

#### LED Diagnostics

| Command | Response | Purpose |
|---------|----------|---------|
| `flashr <count> <ms>` | `Flashing ...` | Flash red LED (default: 2× 500ms) |
| `flashg <count> <ms>` | `Flashing ...` | Flash green LED (default: 2× 500ms) |
| `flashb <count> <ms>` | `Flashing ...` | Flash blue LED (default: 2× 500ms) |

---

### 🧠 AI Processor (Himax HX6538)

Commands prefixed with `AI` — routed via BLE to the Himax chip. These interact with the SD card, CONFIG.TXT, camera sensor, and AI model.

#### AI System

| Command | Response | Purpose |
|---------|----------|---------|
| `AI ver` | `V X.Y.Z` | AI processor firmware version |
| `AI info` | `30515200 K total... 30511056 K available.` | SD card space (total / available KB) |
| `AI camera` | `HM0360` / `RP2` / `RP3` | Connected camera sensor type |
| `AI inithm0360` | `OK` / `Error` | Reinitialise HM0360 sensor (recovery from black images) |
| `AI firmware <filename> [crc]` | `Firmware update OK/FAILED` | Update Himax firmware from SD card image. With a CRC the device recomputes the file's own and refuses to touch flash on a mismatch |
| `AI crc <filename>` | `CRC 0x4569 (487424 bytes)` | CRC16-CCITT and size of a file in `/MANIFEST/`. The same algorithm the file transfer uses, so a file already on the card can be checked against a release or a model without sending it again |

#### Operational Parameters

| Command | Response | Purpose |
|---------|----------|---------|
| `AI getop -1` | `OpParams 1324 6 0 ...` | Bulk fetch ALL OPs (0–20) in one response |
| `AI getop <n>` | `OpParam N = ...` | Read a single OP by index |
| `AI setop <idx> <val>` | `Set OpParam N = ...` | Write a single OP |
| `AI setdid <uuid>` | `Deployment ID set to...` | Set deployment ID (null = clear) |
| `AI getdid` | UUID string | Read deployment ID |
| `AI setgps <lat>,<lng>,<alt>` | `Device GPS set...` | Set GPS location (stored in CONFIG.TXT) |

#### Capture & Motion Detection

| Command | Response | Purpose |
|---------|----------|---------|
| `AI capture 1 1000` | `Captured` | Manual image capture (count, delay_ms) |
| `AI md <0-3>` | — | Set motion detection sensitivity (0 = off, 1–3 = increasing) |

#### Model Management

| Command | Response | Purpose |
|---------|----------|---------|
| `AI erasemodel` | `OK` / `erased` | Erase loaded AI model, write 0,0 to CONFIG.TXT lines 14 & 15 |
| `AI loadmodel <id> <ver>` | `OK` / `loaded` | Load model from SD (e.g. `1V1.TFL`, paired with `1V1.TXT` labels), update CONFIG.TXT |

#### OP Shortcuts

Convenience commands that wrap `AI setop` with human-readable names and defaults:

| Command | Underlying | Purpose |
|---------|------------|---------|
| `SET_NUM_PICTURES` | `AI setop 5 <n>` | Images per trigger |
| `SET_PICTURE_INTERVAL` | `AI setop 6 <ms>` | Interval between images in ms |
| `SET_TIMELAPSE_INTERVAL` | `AI setop 7 <sec>` | Timelapse interval in seconds, 0 = off |
| `SET_MOTION_DETECT_INTERVAL` | `AI setop 11 <ms>` | Motion detection polling interval, 0 = off |

> [!NOTE]
> Factory defaults are **not** listed here — `FACTORY_DEFAULTS` in [`useDeviceSettings.ts`](../../src/hooks/useDeviceSettings.ts) is the single source of truth and these shortcuts do not carry their own defaults.
| `DISABLE_MOTION_DETECT` | `AI setop 11 0` | Disable motion detection |
| `DISABLE_TIMELAPSE` | `AI setop 7 0` | Disable timelapse capture |

### OP Parameter Index

The complete index (`OP_PARAMETER` enum + `FACTORY_DEFAULTS`) is defined in [`useDeviceSettings.ts`](../../src/hooks/useDeviceSettings.ts) — that file is the **single source of truth** for all parameter indices and default values. The range extends well past OP 20 (MD illumination, AE thresholds, white balance, camera resolution); read the enum rather than assuming an upper bound.

The following subset is directly used during deployment:

| Index | Constant | Role |
|-------|----------|------|
| 5 | `NUM_PICTURES` | Images per trigger. Start Monitoring writes 1 (JPEG only, the default since 5 September 2026) or 2 when the advanced BMP toggle is off; the Dev Deployment screen defaults its own control to 2 for JPG+BMP pairs |
| 7 | `TIMELAPSE_INTERVAL` | 0 for activity, N seconds for timelapse/mixed |
| 8 | `INTERVAL_BEFORE_DPD` | Always 1000ms |
| 9 | `LED_BRIGHTNESS` | Flash brightness 0–100% |
| 10 | `CAMERA_ENABLED` | 1 = on, 0 = off (always sent last) |
| 11 | `MD_INTERVAL` | 1000ms for activity/mixed, 0 for timelapse |
| 12 | `FLASH_DURATION` | Flash pulse duration in ms |
| 13 | `FLASH_LED` | Which LED the capture flash uses: 0 = none, 1 = visible, 2 = IR. Written from the project's `flash_led` at deployment |
| 14 | `MODEL_PROJECT` | Currently loaded AI model ID |
| 15 | `MODEL_VERSION` | Currently loaded AI model version |
| 17 | `MD_SENSITIVITY` | 1 for activity/mixed, 0 for timelapse |
| 18 | `TEST_MODE_BITS` | Diagnostic bitmask (bit 1 = `TEST_BIT_SAVE_BMP`, bit 3 = `TEST_BIT_SKIP_FILE_CREATION`) |
| 19 | `IMAGES_COUNT` | Total images captured (reset on new deployment) |
| 20 | `IMAGES_FILE_INDEX` | Image subdirectory counter (reset on new deployment) |
| 34 | `FLASH_MODE` | When the flash is armed: 0 = off, 1 = light sensor, 2 = always on, 3 = time of day. Written from the project's `flash_mode`. With op13 it is the gate the firmware's `ledFlashIsActive()` tests, so it also decides whether motion frames get IR light at night |
| 35 | `FLASH_TOD_START` | Time-of-day mode only: minutes after midnight UTC when the flash turns on |
| 36 | `FLASH_TOD_DURATION` | Time-of-day mode only: how many minutes it stays on, wrapping past midnight |

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

## Commands vs Flows

The Engineer Console provides two reference modals:

**Commands** (`CommandReferenceModal`) — Atomic BLE operations that send a single command string and receive a single response. These map 1:1 to firmware commands (e.g., `ver`, `battery`, `AI getop -1`). See [Key Commands](#key-commands) above.

**Flows & Processes** (`FlowsReferenceModal`) — Multi-step workflows or convenience wrappers. These either compose multiple BLE commands, interact with app services (cloud, GPS, navigation), or wrap a single `setop` with a human-readable name. Tapping "Run" executes the full sequence.

> [!NOTE]
> In the codebase, commands have `type: 'command'` and flows have `type: 'process'` or `type: 'local'` in `COMMANDS` ([types.ts](../../src/ble/types.ts)).

---

## Flows & Processes Reference

All flows are accessible from the Engineer Console → **Flows** button, grouped by what you are
trying to do rather than by the mechanism underneath.

> [!NOTE]
> The modal's group arrays set the display order. It used to filter `COMMANDS`, so the order came
> from the declaration order in `types.ts` and editing the modal changed nothing on screen. See
> `pick()` in [FlowsReferenceModal.tsx](../../src/components/FlowsReferenceModal.tsx).

### 📷 Camera & Sensors

| Flow | What It Does |
|------|-------------|
| `CAPTURE_PICTURE` | The single camera flow: camera mode, flash, one capture with a step list, the picture and a gallery. Holds the device awake for the visit and forces a chosen flash on; like every flow, it writes to the device only once the user has opened it. Everything about it is in [Capture-Picture.md](../resources/Capture-Picture.md). |
| `MOTION_DETECTION_PREVIEW` | Real-time 16×16 grid. The best-behaved multi-step flow: reads the op array once and restores op18/op8 on the way out. |
| `LIGHT_SENSOR` | The AE registers via `AI light`, about 2 s and no photo. Single shot, or streamed every few seconds from Settings. The screen shows the level and registers; every row is logged with the app's mean and gain verdicts beside the device's own, and exportable. Turns automatic camera switching (op26) off on entry. See [Light-Sensor.md](../resources/Light-Sensor.md). |

### 📲 Firmware Updates

| Flow | What It Does |
|------|-------------|
| `UPDATE_BLE_FIRMWARE` | Nordic nRF52 OTA update (ZIP) via the DFU screen. |
| `UPDATE_HIMAX_FIRMWARE` | Himax AI processor update (`AI firmware <file> <0xCRC>` + `AI reset`). Normally flashes **both** camera-variant images, see [Himax-Firmware-Update.md](../resources/Himax-Firmware-Update.md#dual-image-update-camera-variant-pair). |
| `FIRMWARE_STATUS` | Compares installed BLE + Himax versions against cloud and offers updates. Also reached from Start Monitoring with `restrictToLatest`, so the screen is production code, not only a bench tool. |
| `MODEL_VALIDATION` | Full AI model lifecycle: validate metadata → download → transfer to SD → `erasemodel` → `loadmodel`. Grouped here rather than under file transfer because the transfer is how it works, not what it is for. |

### ⚙️ Device Configuration

| Flow | What It Does |
|------|-------------|
| `RESET_TO_DEFAULTS` | Diffs every op against `FACTORY_DEFAULTS` and writes those that differ, clears the deployment ID and zeroes GPS. **It also erases the AI model**, which the screen now warns about. Counters in `RESET_PRESERVED_OPS` survive, and ops the connected firmware does not report are skipped. |

### 🧪 Tests

| Flow | What It Does |
|------|-------------|
| `DEV_DEPLOYMENT_TEST` | Full deployment with manual control over capture method, flash, diagnostics and AI model. See [Dev-Deployment-Guide.md](../resources/Dev-Deployment-Guide.md). |
| `FILE_TRANSFER_TEST` | Sends a test file to the SD card to exercise the `ftx` pipeline end to end. |

### Removed, and why

| Flow | Fate |
|------|------|
| `CAPTURE_PREVIEW` | Folded into `CAPTURE_PICTURE`. Measured on the bench, the two were identical on the wire except that Capture Preview sent one extra `AI slots`: 7 commands against 6, for less function. |
| `TX_FILE` | Deleted. It was the only `process` entry with no navigation handler, so it fell through to `writeRaw` and bypassed the command registry: its `Failed to open ''. (6)` never reached the operator, while `commandRegistry.txfile` handles that case and `useCapturePreview` already calls it properly. |
| `CLEAR_CONSOLE` | Deleted as a flow, since it sent nothing to the device. Clearing the output is now a **Clear** button on the console header. |
| `TRANSFER_CONFIG` | Deleted with its screen and hook, 455 lines reachable from nowhere. The deployment pipeline transfers config as part of a real deployment. |

> [!WARNING]
> `TRANSFER_AI_MODEL` is still defined and routed but **absent from the Flows modal**, so there is
> no way to run it. The modal is a hand-maintained allowlist with no coverage test, unlike
> `CommandReferenceModal`, so an entry can be fully wired and still invisible.

## Hardware Testing Tools (Detailed)

The following screens are accessed from the Engineer Console → Flows modal. They bypass standard deployment flows and interface directly with the device API.

### Motion Detection Screen

**Screen:** `StandaloneMotionDetectionScreen.tsx`
**Purpose:** Real-time visualization of the HM0360 sensor's internal motion detection algorithm.

**How it works:**
- Uses `useMotionDetectionStream` to subscribe to `TEXT_LINE` events from `bleEventBus`
- Sets `TEST_BIT_SKIP_FILE_CREATION` (OP 18, bit 3) before capture so firmware streams MD data without saving JPEGs
- Parses `HM0360 motion in N blocks:` header + 32 hex-byte grid data from BLE text lines
- Renders the 16×16 grid as a precomputed text string — visual feedback loop helps understand environmental threshold behaviour
- **On completion/stop**, automatically resets `TEST_MODE_BITS` to 0 so subsequent captures (e.g., photo preview) save JPEG files normally

**The flash on this screen, and how it differs from the field.** A test frame is lit through the
awake path, which takes the LED from op13 and the brightness from op9. A deployed camera lights
its motion frames through the STROBE path armed just before it sleeps, which takes them from
op21 `MD_FLASH_LED` and op22 `MD_FLASH_BRIGHTNESS_PERCENT`, infrared at 50 percent by default.
Same gate, different LED and brightness. The screen's two controls therefore open on the
device's own op21 and op22 rather than on Off and 5 percent, so a night test predicts the
deployment instead of a dimmer version of it.

The gate itself is op34 with op13: since `ae_review` the LED fires only when the flash mode arms
it, so the screen holds op34 at always-on for a test that asks for an LED and puts the previous
mode back when the test ends ([`flashHold.ts`](../../src/ble/session/flashHold.ts)).

### Camera Settings Test Screen

**Screen:** `CapturePictureScreen.tsx`
**Purpose:** Capture test images with configurable flash parameters to validate LED hardware and exposure settings.

**Features:**
- **Flash:** Off / White / IR (op13) and `LED Brightness` (op9, 0-100%), via the shared
  [`FlashSelector`](../../src/components/device/FlashSelector.tsx). Brightness only appears once a
  flash is chosen, and picking one while op9 reads 0 raises it to 50%: the bench found op13 written
  and the LED selected while the device reported `Flash brightness: 0%`, so the flash lit nothing
  and nothing on screen said why. White balance was removed from this flow; op27/op28 remain in
  `OP_PARAMETER` and are still covered by the factory reset.
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

## Flash, IR & Image Quality Experiments

This section documents the experimental workflows for testing LED illumination, image quality, and auto-exposure behaviour. These experiments combine firmware compile flags with app-configurable OPs.

### Flash Operational Parameters

Three OPs control the LED flash hardware:

| OP | Constant | Range | Notes |
|----|----------|-------|-------|
| 9 | `LED_BRIGHTNESS` | 0–100 | Percentage. **0 = dim, not off.** Use OP 13 = 0 to fully disable the flash. |
| 12 | `FLASH_DURATION` | ms | Flash pulse duration. Currently only applies to the RP3 camera — untested on HM0360. |
| 13 | `FLASH_LED` | 0, 1, 2 | 0 = off (no flash), 1 = visible (white) LED, 2 = IR LED |

> [!IMPORTANT]
> Setting `LED_BRIGHTNESS` to 0 still produces a dim flash — the LED is not fully off. To disable the flash entirely, set `FLASH_LED` to 0.

### Auto Exposure (AE) Registers

The HM0360 sensor outputs AE register values via BLE console after each capture:

```
HM0360 AE regs:
  Integration time = 376 lines
  Analog gain = 1
  Digital gain = 65
  AE Mean = 76
  AEConverged?: Y
```

These values are captured per image by the Capture Picture flow. The standing AE panel was replaced
by the picture itself; the numbers now appear beside the shot they describe, in the preview modal,
rather than beside whichever shot came next.

**Used as the light sensor.** The AE registers *are* the day/night sensor: the firmware averages them over several frames and turns them into one dark/bright decision that drives the flash (OP 13) and automatic camera switching (OP 26). The Light Sensor flow exposes this, and `AI light` measures on demand without taking a photo. See [Light-Sensor.md](../resources/Light-Sensor.md).

Which registers correlate best has been measured rather than guessed. Scoring 303 time-lapse frames against their capture times, so the label owes nothing to the registers being scored: analog gain 100%, digital gain 100%, AE Mean 98.8%, integration time 96.5%. The gain registers are the stronger discriminators; AE Mean is used because it is the tunable one. The threshold itself (OP 23) is still under review.

### Firmware Compile Flags for Experiments

These flags are in the Himax firmware source (`ww-hardware` repo). They enable automated test sequences that the app triggers by setting the appropriate OPs.

| Flag | What It Does | OP Setup |
|------|-------------|----------|
| `INVESTIGATE_FLASH_BRIGHTNESS` | Captures N images at **progressively increasing** brightness levels in a single trigger | Set `NUM_PICTURES` (OP 5) to desired count (e.g., 6). Set `FLASH_LED` (OP 13) to 1 (visible) or 2 (IR). |
| `SAVEBMP` | Saves alternating JPG and BMP files (e.g., image 1 = JPG, image 2 = BMP, image 3 = JPG, ...) | Set `TEST_MODE_BITS` (OP 18) bit 1 = 1. Set `NUM_PICTURES` to an even number for complete pairs. |
| `INVESTIGATE_TONE_MAPPING` | Cycles through 4 HM0360 grey-scale tone levels across captures | Set `NUM_PICTURES` to 8 for 2 file types × 4 tones. Combine with `SAVEBMP` for JPG+BMP at each tone. |

> [!NOTE]
> These are **compile-time** firmware flags — they require reflashing the Himax AI processor. They are not runtime-configurable from the app.

### JPEG Quality

The HM0360 hardware JPEG encoder supports two compression levels:

```c
// In Himax firmware source
#define DP_JPEG_ENCQTABLE  JPEG_ENC_QTABLE_4X   // higher quality (current default)
//#define DP_JPEG_ENCQTABLE  JPEG_ENC_QTABLE_10X // lower quality
```

This is a compile-time setting. BMP output (via `SAVEBMP`) provides uncompressed reference images for quality comparison.

### App-Side Test Flows

**Camera Settings Test Screen** (single captures, manual parameter adjustment):
1. Connect via Engineer Console
2. Navigate to Flows → Camera Settings Test
3. Select flash type (Off / Visible / IR) and brightness
4. Tap "Capture Image" — image + AE data saved to gallery
5. Adjust settings and repeat — gallery preserves per-image metadata for comparison

**Dev Deployment** (multi-capture with diagnostics):
1. Connect via Engineer Console → Flows → Dev Deployment Test
2. Set `NUM_PICTURES` (e.g., 6 for brightness sweep, 8 for tone mapping)
3. Enable "Save BMP" toggle (sets `TEST_MODE_BITS` bit 1)
4. Configure flash type and brightness
5. Start deployment — device captures sequence per firmware mode

### Recommended Experimental Protocols

**1. Flash Brightness Calibration**
Goal: Establish optimal brightness for different subject distances (30cm, 1m, 5m).

- Firmware: enable `INVESTIGATE_FLASH_BRIGHTNESS`
- App: set `NUM_PICTURES=6`, `FLASH_LED=1` (visible), start Dev Deployment
- Repeat with `FLASH_LED=2` (IR)
- Compare images at each brightness level across distances
- Note: IR produces a faint reddish glow visible to the human eye

**2. IR vs Visible for Motion Detection**
Goal: Determine whether NN models detect subjects under IR illumination.

- Firmware: standard build (no special flags)
- App: Deploy with Activity Detection + IR flash
- Observation: Green LED flash = NN detected person; Red LED flash = NN did not detect
- Charles's finding: NN detection may fail under IR-only illumination (possibly insufficient image contrast or the subject was not fully in frame)

**3. Image Quality Comparison**
Goal: Compare JPEG compression levels and BMP output.

- Firmware: enable `SAVEBMP` + `INVESTIGATE_TONE_MAPPING`
- App: set `NUM_PICTURES=8` (4 tones × 2 formats)
- Compare JPG vs BMP at each tone level to assess quality loss
- The `JPEG_ENC_QTABLE_4X` (higher quality) setting is the current default

**4. Night/Low-Light AE Behaviour**
Goal: Understand AE register changes across ambient light conditions.

- Firmware: standard build
- App: Use Camera Settings Test screen
- Capture images at intervals across day → dusk → night
- Record AE Mean, Integration time, Analog gain progression
- Assess whether these values can serve as an ambient light proxy

**5. Motion Detection in Darkness**
Goal: Validate MD triggers when subject is only illuminated by flash.

- Setup: Use an emulated target (e.g., paper cutout on a string) in a dark room
- Deploy with Activity Detection + flash enabled
- Verify MD triggers from subject movement alone (no ambient light)
- Test at different `MD_SENSITIVITY` levels (`AI md <n>` command)

---

## BLE Connection Safety

| Feature | Behaviour |
|---------|-----------|
| Heartbeat | 58s idle → sends `get heartbeat` (or RSSI ping if UART paused) |
| Disconnect Detection | `WWBleDisconnectedBanner` shown on all BLE-dependent screens |
| DFU Suppression | Banner is hidden when `dfuInProgress` is `true` — the BLE disconnect during firmware updates is expected |
| Disconnect Signal | `DEVICE_SIGNAL(DISCONNECT)` → `commandQueue.clearAll()` — rejects all in-flight commands instantly |
| Navigation Guard | `isNavigatingAway` ref prevents spurious disconnect alerts during screen transitions |

All screens use `bleDeviceRef` (a `useRef`) for device state inside timer callbacks, preventing stale closure bugs.

> [!NOTE]
> On unexpected disconnect, the BLE pipeline rejects all in-flight and queued commands **instantly** via the `DISCONNECT` signal (see [BLE Architecture — Disconnect Resilience](../resources/BLE_Architecture.md#disconnect-resilience)).

> [!NOTE]
> During firmware updates (BLE DFU or Himax), `useFirmwareUpdate` dispatches `setDfuStatus(true)` to the device's Redux state. The `WWBleDisconnectedBanner` checks `dfuInProgress` and suppresses the error banner during expected DFU disconnections.

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

*Last Updated: May 16, 2026*
