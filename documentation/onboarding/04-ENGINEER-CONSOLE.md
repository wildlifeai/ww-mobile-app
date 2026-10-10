# Engineer Console & BLE Tools

The Engineer Console is the developer's direct interface to the Wildlife Watcher device. It provides raw BLE command access, hardware testing tools, and device diagnostics, all independent of the standard deployment flow.

**Deep dive:** [BLE Architecture Guide](../resources/BLE_Architecture.md): command system, timing constraints, message classification

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

The tables follow the firmware command tables: `appCommands[]` in ww-hardware's
`MokoTech/Workspace/WildlifeWatcher_1/ble_commands.c` for the nRF, and `vRegisterCLICommands()` in
the Seeed repo's `ww500_md/CLI-commands.c` and `CLI-FATFS-commands.c` for the Himax, both on `dev`
as of 30 September 2026. A row marked *typed only* is not in the Commands list; type it into the
input line.

### 📡 BLE Processor (nRF52)

Direct commands handled by the BLE chip, no `AI` prefix.

#### System & Identity

| Command | Response | Purpose |
|---------|----------|---------|
| `id` | BLE name | Device BLE advertising name |
| `ver` | `WW500-C02 V 00.30.52 ...` | BLE firmware version + build date |
| `device` | `WW500-C00` | Product name / hardware variant |
| `status` | `Sensor: enabled. LoRaWan: Joined. Seq: 12` | Device status (sensor, LoRaWAN, sequence) |
| `battery` | `Battery = 3305mV 100%` | Battery voltage and percentage |
| `temp` | `Temperature: 23.25C` | The BLE chip's own die temperature, not the air |
| `selftest` | `Error bits = 0x0000` | Hardware self-test bitmask |
| `get heartbeat` | `heartbeat is 12h` | The nRF's LoRaWAN heartbeat interval. The app also sends it as its BLE keep-alive, because the nRF answers it without waking the Himax. Setting it is *typed only*: `heartbeat 1h` |

#### Clock

| Command | Response | Purpose |
|---------|----------|---------|
| `setutc` | `UTC is: ...` | Sync device clock to phone UTC (auto-generates ISO 8601 timestamp) |
| `getutc` | `UTC is: ...` | Read device system time |

#### Device Control

| Command | Response | Purpose |
|---------|----------|---------|
| `dis` | `Disconnecting` | BLE disconnect |
| `reset` | `Device will reset after disconnecting.` | Board reset (takes effect after disconnect) |
| `dfu` | `Device will enter DFU mode after disconnecting.` | Enter DFU mode for BLE firmware update |
| `wake` | `AI processor is awake.` / `Waking AI processor.` | Wake AI processor from Deep Power Down |

#### LoRaWAN

| Command | Response | Purpose |
|---------|----------|---------|
| `get deveui` | `DevEui: XX:XX:...` | Read LoRaWAN DevEUI |
| `get appeui` | `AppEui: XX:XX:...` | Read LoRaWAN AppEUI (JoinEUI) |
| `join` | `Already joined` / `OK` / `Wrong state: ...` | Request LoRaWAN join |
| `ping` | `OK` / `Not joined yet.` / `Busy` | Send LoRaWAN test packet |
| `network` | `RSSI: -85dB, SNR: 7dB, PER: 0%. Last seen 3 minutes ago.` | Most recent LoRaWAN signal quality |

#### LED Diagnostics

| Command | Response | Purpose |
|---------|----------|---------|
| `flashr <count> <ms>` | `Flashing 500ms 2 times` | Flash red LED. Run sends `flashr 2 500`; other values are *typed only* |
| `flashg <count> <ms>` | `Flashing 500ms 2 times` | Flash green LED, as above |
| `flashb <count> <ms>` | `Flashing 500ms 2 times` | Flash blue LED, as above |

`erase` and `get appkey` left the Commands list on 30 September 2026 (#300): the BLE firmware
answers `erase` with `Not yet implemented`, and `get appkey` with `Failed N` because it cannot
read the key back. Setting the key is still *typed only*: `appkey XX:XX:...`.

---

### 🧠 AI Processor (Himax HX6538)

Commands prefixed with `AI`, routed via BLE to the Himax chip. These interact with the SD card, CONFIG.TXT, camera sensor, and AI model.

#### AI System

| Command | Response | Purpose |
|---------|----------|---------|
| `AI ver` | `WW500_C02 ...` | AI processor firmware version |
| `AI info` | `Label: ...`, `Serial No: ...`, `30515200 K total drive space.`, `30511056 K available.` | `ai_info` in the list. SD card label, serial number, size and free space in KB |
| `AI inithm0360` | `OK` / `Error.` | Reinitialise HM0360 sensor (recovery from black images). HM0360 firmware only; the RP3 firmware answers `Unrecognised` |
| `AI crc <filename>` | `CRC 0x4569 (487424 bytes)` | *Typed only.* CRC16-CCITT and size of a file in `/MANIFEST/`. The same algorithm the file transfer uses, so a file already on the card can be checked against a release or a model without sending it again |

#### SD Card & Files

| Command | Response | Purpose |
|---------|----------|---------|
| `AI dir` | One line per file | List the files in the SD card's current directory |
| `AI format` | `WARNING: all data on the SD card will be erased. Run 'format' again to confirm...`, then `Formatted OK. Reboot to remount.` / `Format failed (FRESULT N).` | Erase the SD card and format it FAT32. The firmware formats only on a second `format` before the Himax next sleeps, about a second later, too soon for a second tap, so Run sends the second itself once the warning arrives. Reboot the camera afterwards to remount the card |

#### Operational Parameters

| Command | Response | Purpose |
|---------|----------|---------|
| `AI getop -1` | `OpParams 1324 6 0 ...` | Bulk fetch every op (0 to 36 on current firmware) in one response |
| `AI getop <n>` | `OpParam N = ...` | Read a single OP by index. Run asks for the index, as a number or an `OP_PARAMETER` name such as `MD_SENSITIVITY` |
| `AI setop <idx> <val>` | `Set OpParam N = ...` | Write a single OP, saved to CONFIG.TXT at once. Run asks for the index, by number or name, and the value |
| `AI setgps <location>` | `Device GPS set` | Set the location written into each photo's EXIF, and saved to CONFIG.TXT: degrees, minutes and seconds with `_` for every space, e.g. `37°48'30.50"_N_122°25'10.22"_W_500.75_Above`. Decimal `lat,lng,alt` is silently discarded (#315) |
| `AI getgps` | `Device Location: ...` | Read back the location photos get |

#### Camera Functions

| Command | Response | Purpose |
|---------|----------|---------|
| `AI capture 1 500` | `About to capture 1 image ...`, then `Captured 1 images. Last is X.JPG (File write Nms avg.)` | `capture_one` in the list: take one photo. See [Take one photo](#take-one-photo) below. Other counts and intervals are *typed only* |
| `AI light` | `Checking light level...`, then the AE registers | Measure light without a photo. See [Light-Sensor.md](../resources/Light-Sensor.md) |
| `AI slots` | `Active slot 1 running 'HM0360 (night/IR)'. Slot A: 'RP3 (day/colour)', Slot B: 'HM0360 (night/IR)'. Auto-switch: off` | Which firmware slot runs, and the camera each slot is built for (day/night switching) |
| `AI switchslot` | `Switched to slot N` / `Slot switch failed` | Boot the other firmware slot; the camera resets on its way into its next sleep |

#### Take one photo

`capture_one`, under AI Processor, Camera Functions, is one tap and no form. It sends
`AI capture 1 500`, the same bytes Capture Picture sends, and nothing else: no keep-awake hold, no
flash hold, no download and no preview. The console shows the device's own replies, `About to
capture 1 image with an interval of '500' milliseconds` and then `Captured 1 images. Last is
X.JPG (File write Nms avg.)`. The photo stays on the SD card. The AE registers and the motion grid
follow on their own, as after every capture.

Because it is raw, the result depends on the device's state, and these are the device telling you
so rather than the button failing:

| You see | Why | What to do |
|---|---|---|
| `Camera system not enabled` | op10 is 0, which is how ending a deployment leaves a camera. A camera that did not answer at boot disables the system for that wake too, with self-test bit 8 | Capture Picture turns op10 back on by itself. From the console, `AI setop 10 1`, wait for `Sleep`, tap again: the next wake starts the camera. If it persists, read the self-test after the wake |
| `About to capture ...` and then nothing, with `Fail (-60)` lines on the Himax console | The RP3 firmware cannot capture right after a cold boot (Seeed #238, fix in draft Seeed #239) | Let it sleep and try again: the warm boot re-initialises the sensor |
| No reply at all | The device is stuck awake (Seeed #205) and the nRF drops every command | Power cycle; see [traps.md](../../.agents/skills/references/traps.md) |
| No flash | The LED fires only when the device armed it: op13 chooses the LED, op34 the mode, and in AE mode the stored light decision op25. Capture Picture holds op34 at always-on for its visit; this button does not | Use Capture Picture for a flash photo, or see the three commands in [Light-Sensor.md](../resources/Light-Sensor.md) |
| `Captured 1 images. Last is` with an old name or none, and no new file | op18 bit 3, `TEST_BIT_SKIP_FILE_CREATION`, was left set by a motion test that did not finish | `AI setop 18 0` |

It is a real capture in every other way: it counts toward op19, runs the AI model if one is
loaded, and when automatic camera switching (op26) is on, its light check can schedule a slot
switch and a reboot at the next sleep. Any setting changed with `setop` applies from the next
wake, so to photograph with it, let the device sleep first.

### OP Parameter Index

The complete index (`OP_PARAMETER` enum + `FACTORY_DEFAULTS`) is defined in [`useDeviceSettings.ts`](../../src/hooks/useDeviceSettings.ts). That file is the **single source of truth** for all parameter indices and default values. The range extends well past OP 20 (MD illumination, AE thresholds, white balance, camera resolution); read the enum rather than assuming an upper bound.

The following subset is directly used during deployment:

| Index | Constant | Role |
|-------|----------|------|
| 5 | `NUM_PICTURES` | Images per trigger, motion and timelapse alike. Start Monitoring writes the project's `photos_per_trigger`, twice that when the raw BMP is recorded (#317); the Dev Deployment screen writes what its Pictures per Trigger field holds, default 3. Both write it explicitly because the reset preserves it |
| 6 | `PICTURE_INTERVAL` | Milliseconds between those images. Start Monitoring writes the project's `photo_interval_milliseconds` (#317); the reset sets 500. The firmware wants it below op8, see D under [Device Configuration](./05-DEVICE-FLOWS.md#device-configuration-usedeploymentconfiguration) |
| 7 | `TIMELAPSE_INTERVAL` | 0 for activity, N seconds for timelapse/mixed |
| 8 | `INTERVAL_BEFORE_DPD` | 1000ms, except that Start Monitoring writes op6 + 1000 when op5 is above 1, so the camera stays awake for the whole burst (#317) |
| 9 | `LED_BRIGHTNESS` | Flash brightness 0–100% |
| 10 | `CAMERA_ENABLED` | 1 = on, 0 = off (always sent last) |
| 11 | `MD_INTERVAL` | 1000ms for activity/mixed, 0 for timelapse |
| 12 | `FLASH_DURATION` | Read by nothing: the firmware turns the LED off when the image arrives. Only `AI flash` writes it |
| 13 | `FLASH_LED` | Which LED the capture flash uses: 0 = none, 1 = visible, 2 = IR. Written from the project's `flash_led` at deployment |
| 14 | `MODEL_PROJECT` | Currently loaded AI model ID |
| 15 | `MODEL_VERSION` | Currently loaded AI model version |
| 16 | `MODEL_THRESHOLD` | The score the model's int8 output must reach: q means probability (q + 128) / 256. Both deployment flows write the project's `detection_threshold_pct` as `ceil(pct * 2.56) - 128` (#342), see E under [Device Configuration](./05-DEVICE-FLOWS.md#device-configuration-usedeploymentconfiguration); the reset sets 18, which is 57%, the column default |
| 17 | `MD_SENSITIVITY` | The project's sensitivity for activity/mixed (low 1, medium 2, high 3; medium when the project has none), 0 for timelapse. Only the HM0360 image applies it until Seeed #211 |
| 18 | `TEST_MODE_BITS` | Diagnostic bitmask (bit 1 = `TEST_BIT_SAVE_BMP`, bit 3 = `TEST_BIT_SKIP_FILE_CREATION`). Neither deployment writes it since 21 September 2026; the reset leaves it 0 |
| 19 | `IMAGES_COUNT` | Total images captured (reset on new deployment) |
| 20 | `IMAGES_FILE_INDEX` | Image subdirectory counter (reset on new deployment) |
| 32 | `LORAWAN_PING_MINUTES` | LoRaWAN ping period in minutes, 0 = never join. Factory 720 (12 h); a deployment writes 720 or 0 from the project's `lorawan_required`. Was `CAM_RESOLUTION` before ae_review, so firmware without op34 is never written |
| 34 | `FLASH_MODE` | When the flash is armed: 0 = off, 1 = light sensor, 2 = always on, 3 = time of day. Written from the project's `flash_mode`. With op13 it is the gate the firmware's `ledFlashIsActive()` tests, so it also decides whether motion frames get IR light at night |
| 35 | `FLASH_TOD_START` | Time-of-day mode only: minutes after midnight UTC when the flash turns on |
| 36 | `FLASH_TOD_DURATION` | Time-of-day mode only: how many minutes it stays on, wrapping past midnight |

### OP Bulk Fetch Optimization (`AI getop -1`)

All deployment flows use the **bulk parameter fetch** command to minimize BLE round-trips:

1. Fetch all params once: `AI getop -1` → `OpParams 1324 6 0 18 ...`
2. Cache the result in memory
3. Before each `AI setop`, compare target value against cached value
4. Skip the write if the parameter is already correct

**Fallback:** If `AI getop -1` fails (older firmware), all functions gracefully fall back to "blind write" mode: they send every `setop` unconditionally.

### Capture Method OP Mapping

| Method | Commands | Notes |
|--------|----------|-------|
| Activity Detection | `setop 17 1`, `setop 11 1000`, `setop 7 0`, `setop 8 1000`, `setop 10 1` | MD on, timelapse off |
| Timelapse | `setop 17 0`, `setop 11 0`, `setop 7 <secs>`, `setop 8 1000`, `setop 10 1` | MD off, timelapse on |
| Mixed | `setop 17 1`, `setop 11 1000`, `setop 7 <secs>`, `setop 8 1000`, `setop 10 1` | MD on + timelapse on |

Camera enable (`setop 10 1`) is always sent **last** to avoid premature triggers. All writes are conditional: unchanged values are skipped. A Start Monitoring burst then raises `setop 8` past the picture interval, see D under [Device Configuration](./05-DEVICE-FLOWS.md#device-configuration-usedeploymentconfiguration).

---

## Commands vs Flows

The Engineer Console provides two reference modals:

**Commands** (`CommandReferenceModal`): atomic BLE operations that send a single command string and receive a single response. These map 1:1 to firmware commands (e.g., `ver`, `battery`, `AI getop -1`). See [BLE Command Reference](#ble-command-reference) above.

The list shows the two processors as headings, each with its categories as toggles, all closed
when the list opens and one open at a time; the ? beside the title says how it works. A command
that takes values (`getop`, `setop` and `setgps`) lists them as `params` in `COMMANDS`. Tapping
Run opens a small form under its row, and Send stays disabled until every value checks out;
nothing is filled in on the operator's behalf (#300). An op index can be typed
as a number or a name, the app's `OP_PARAMETER` name or the firmware's, with or without the
`OP_PARAMETER_` prefix, and the form shows what it resolved to. Every other command, including
`capture_one`, sends on the first tap. Nothing in the list sends anything when the console opens
or connects.

**Flows & Processes** (`FlowsReferenceModal`): multi-step workflows or convenience wrappers. These either compose multiple BLE commands, interact with app services (cloud, GPS, navigation), or wrap a single `setop` with a human-readable name. Tapping "Run" executes the full sequence.

The Flows list is laid out like the Commands list: its groups are toggles, all closed when it
opens and one open at a time, and the ? beside the title says how it works. Flows have no
processor, so there is no heading above the groups.

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
| `FIRMWARE_STATUS` | One line per chip, up to date or update available, with Update. With one camera's AI build in the catalogue, the AI line names the camera whose firmware is missing instead ([why](../resources/Himax-Firmware-Update.md#one-cameras-build-only)). Also reached from Start Monitoring, so the screen is production code, not only a bench tool. |
| `MODEL_VALIDATION` | Full AI model lifecycle: validate metadata → download → transfer to SD → `erasemodel` → `loadmodel`. Grouped here rather than under file transfer because the transfer is how it works, not what it is for. |

From the console, all three open the **engineer view** of the update screen (`engineer: true`): the build picker, the SD-card or cloud source and the transfer cards. Start Monitoring opens the operator's view, one version line, one button, one bar and one status line with the update's last steps under them, and one result line (#344).

### ⚙️ Device Configuration

| Flow | What It Does |
|------|-------------|
| `RESET_TO_DEFAULTS` | Diffs every op against `FACTORY_DEFAULTS` and writes those that differ, clears the deployment ID and zeroes GPS. **It also erases the AI model**, which the screen now warns about. Counters in `RESET_PRESERVED_OPS` survive, and ops the connected firmware does not report are skipped. |

### 🧪 Tests

| Flow | What It Does |
|------|-------------|
| `DEVICE_CHECK` | The ship check for a finished unit, about five minutes. It resets the settings to factory defaults and leaves the unit on them. First a restart and its self-test, which flags a camera that does not answer before anything else, then firmware and both camera images, the colour camera and its focus lens, the white flash, battery, clocks, SD card, LEDs, light sensor, motion, the black and white camera and the IR flash. One step per screen while it runs, then a pass, warn or fail per step. The operator confirms the LEDs, both flashes and the framing, and taps while waving for the motion test. See [Device-Check.md](../resources/Device-Check.md). |
| `DEV_DEPLOYMENT_TEST` | Full deployment with the project's capture method and capture flash chosen on screen (the time-of-day window in local time), plus the camera, pictures per trigger, LED brightness, motion-detection light and AI model, and a button that lights the white LED. See [Dev-Deployment-Guide.md](../resources/Dev-Deployment-Guide.md). |
| `FILE_TRANSFER_TEST` | Sends a test file to the SD card to exercise the `ftx` pipeline end to end. |

### Removed, and why

| Flow | Fate |
|------|------|
| `CAPTURE_PREVIEW` | Folded into `CAPTURE_PICTURE`. Measured on the bench, the two were identical on the wire except that Capture Preview sent one extra `AI slots`: 7 commands against 6, for less function. |
| `TX_FILE` | Deleted. It was the only `process` entry with no navigation handler, so it fell through to `writeRaw` and bypassed the command registry: its `Failed to open ''. (6)` never reached the operator, while `commandRegistry.txfile` handles that case and `useCapturePreview` already calls it properly. |
| `CLEAR_CONSOLE` | Deleted as a flow, since it sent nothing to the device. Clearing the output is the trash icon in the screen header, beside the Commands and Flows icons (#302, 21 September 2026). The September tidy recorded a Clear button on the console header that was never actually added. |
| `TRANSFER_CONFIG` | Deleted with its screen and hook, 455 lines reachable from nowhere. The deployment pipeline transfers config as part of a real deployment. |

## Hardware Testing Tools (Detailed)

The following screens are accessed from the Engineer Console → Flows modal. They bypass standard deployment flows and interface directly with the device API.

### Motion Detection Screen

**Screen:** `StandaloneMotionDetectionScreen.tsx`
**Purpose:** Real-time visualization of the HM0360 sensor's internal motion detection algorithm.

**How it works:**
- Uses `useMotionDetectionStream` to subscribe to `TEXT_LINE` events from `bleEventBus`
- Sets `TEST_BIT_SKIP_FILE_CREATION` (OP 18, bit 3) before capture so firmware streams MD data without saving JPEGs
- Parses `HM0360 motion in N blocks:` header + 32 hex-byte grid data from BLE text lines
- Renders the 16×16 grid as a precomputed text string, a visual feedback loop that helps understand environmental threshold behaviour. The grid is the HM0360's own detector read once per test frame, not motion between the test's frames, and frame 1 is always empty
- Writes the sensitivity only when op17 differs from the chosen level, as `AI setop 17 <level>`, which the camera acknowledges, then sends `AI md <level>` only to learn whether the build applies a level. The HM0360 build applies op17 at the sleep before the capture and at the capture's wake; its `md` reply never arrives (ww-hardware #52) and is no longer shown (#385). The RP3 build refuses `md` (`Unrecognised`, Seeed #211): the card says the colour camera ignores the sensitivity, in the neutral colour since the test still runs, op17 goes back to its previous value, and the selector is disabled for the visit (#272). "May not have taken" now means the `setop` itself went unanswered
- The interval floor is 0.5 s, the fastest the device has been shown to sustain
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
mode back when the test ends ([`flashHold.ts`](../../src/ble/session/flashHold.ts)). The LED and
brightness are held the same way, op13 and op9 through
[`flashLedHold.ts`](../../src/ble/session/flashLedHold.ts): both are the camera's own photo
settings, and until #387 a test left them at its values for good.

Putting op13 back is also what stops the camera flashing after the test (#383). On the way into
Deep Power Down the firmware arms the HM0360's STROBE, which lights op21's LED on every motion
frame, when op11 is non-zero, op21 names an LED and `ledFlashIsActive()` is non-zero, and that
returns op13, read live, whenever the flash is armed. The flash mode is only read at wake, and the
wake the test ends in read op34 at always-on, so an op13 left at the test's LED kept a camera with
op11 set flashing through the sleep after the test, link or no link, until the next wake, however
promptly op34 went back. The cleanup runs inside that wake and puts op13 back before the sleep.
A test whose app died or whose link dropped leaves all of them owed on disk, and the next motion
test on the camera pays them, with a flash of its own or without.

**The detector's rate is the test's interval, held for the test (#274).** The HM0360 takes its
rate from op11 `MD_INTERVAL` on the way into Deep Power Down, and nothing re-arms it while the
device is awake, so a test that left op11 alone ran at whatever the device last slept with. After
Stop Monitoring or a reset that is 0, a sensor frame about every two seconds. The test writes op11 = the
interval after its `getop -1`, waits for the device to sleep, then sends the capture, and puts
op11 back on every way out through
[`mdIntervalHold.ts`](../../src/ble/session/mdIntervalHold.ts). Raised on a stopped camera op11
turns motion capture back on, so a restore a dropped link leaves owed is kept on disk and paid by
the next test on that camera, and a deployment drops it, because it writes op11 itself at the
same 1000 ms the Start Monitoring card tests at.

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
- **Post-Capture Cleanup:** Sends `CAMERA_ENABLED=0` (`setop 10 0`) and waits for the resulting sleep cycle, which returns the device to a clean idle state.
- **Auto Exposure (AE) Data:** Captures console logs (`Integration time`, `Analog gain`, etc.) and renders live AE metrics with a visual AE Mean progress bar (0–255)
- **Gallery:** Every captured image is stored with its `cameraParams` and `aeData`. Tapping a thumbnail opens a light-box modal showing the exact settings for that frame.

> [!NOTE]
> This section predates [Capture-Picture.md](../resources/Capture-Picture.md), which is how the
> flow behaves now. The manual-capture strobe bug it used to warn about is gone: every capture,
> `AI capture` included, arms the HM0360 STROBE from `ledFlashIsActive()` when it starts the
> sensor (`configure_image_sensor(CAMERA_CONFIG_RUN)` in the Seeed repo's `image_task.c`, `dev`,
> 30 September 2026). Whether the LED fires is op13 with the flash mode op34.

> [!NOTE]
> The flash LED hardware is driven by the Himax AI processor (HX6538), not the nRF52 (WW500). The nRF only stores and forwards the OP values; the Himax reads them from CONFIG.TXT during the capture wake cycle.

---

## Flash, IR & Image Quality Experiments

This section documents the experimental workflows for testing LED illumination, image quality, and auto-exposure behaviour. These experiments combine firmware compile flags with app-configurable OPs.

### Flash Operational Parameters

Three OPs control the LED flash hardware:

| OP | Constant | Range | Notes |
|----|----------|-------|-------|
| 9 | `LED_BRIGHTNESS` | 0–100 | Percentage. **0 = dim, not off.** Use OP 13 = 0 to fully disable the flash. |
| 12 | `FLASH_DURATION` | ms | Read by nothing: the firmware turns the LED off when the image arrives (Charles Palmer, 6 October 2026). Only `AI flash` writes it. |
| 13 | `FLASH_LED` | 0, 1, 2 | 0 = off (no flash), 1 = visible (white) LED, 2 = IR LED |

> [!IMPORTANT]
> Setting `LED_BRIGHTNESS` to 0 still produces a dim flash; the LED is not fully off. To disable the flash entirely, set `FLASH_LED` to 0.

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
> These are **compile-time** firmware flags: they require reflashing the Himax AI processor. They are not runtime-configurable from the app.

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
4. Tap "Capture Image". The image and its AE data are saved to the gallery
5. Adjust settings and repeat. The gallery preserves per-image metadata for comparison

**Dev Deployment** (multi-capture):
1. Connect via Engineer Console → Flows → Dev Deployment Test
2. Pick the camera, then set pictures per trigger (e.g., 6 for a brightness sweep, 8 for tone mapping)
3. Choose the flash mode, LED and brightness
4. Start the deployment. The device captures the sequence the firmware build dictates

BMP output needs `TEST_MODE_BITS` bit 1, which the app no longer writes (retired 21 September 2026,
the code is commented out in `useDevDeployment.ts` and `DevDeploymentTestScreen.tsx`). The
deployment's reset clears OP 18, so for a BMP run set it from the console after the deployment has
started, `AI setop 18 2`, or restore the commented-out switch.

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
- App: set `NUM_PICTURES=8` (4 tones × 2 formats), and `TEST_MODE_BITS` bit 1 from the console after the start, since the app no longer writes it
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
| Heartbeat | 30s with nothing sent or received → sends `get heartbeat` (or reads RSSI if UART paused, which does not reach the nRF) |
| Disconnect Detection | `WWBleDisconnectedBanner` shown on all BLE-dependent screens |
| DFU Suppression | Banner is hidden when `dfuInProgress` is `true`, since the BLE disconnect during firmware updates is expected |
| Disconnect Signal | `DEVICE_SIGNAL(DISCONNECT)` → `commandQueue.clearAll()`, which rejects all in-flight commands instantly |
| Navigation Guard | `isNavigatingAway` ref prevents spurious disconnect alerts during screen transitions |

All screens use `bleDeviceRef` (a `useRef`) for device state inside timer callbacks, preventing stale closure bugs.

> [!NOTE]
> On unexpected disconnect, the BLE pipeline rejects all in-flight and queued commands **instantly** via the `DISCONNECT` signal (see [BLE Architecture, Disconnect Resilience](../resources/BLE_Architecture.md#disconnect-resilience)).

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
| [`useBleHeartbeat.ts`](../../src/hooks/useBleHeartbeat.ts) | 30s heartbeat mechanism |

*Last Updated: 30 September 2026 (BLE Command Reference checked against firmware `dev`, #300)*
