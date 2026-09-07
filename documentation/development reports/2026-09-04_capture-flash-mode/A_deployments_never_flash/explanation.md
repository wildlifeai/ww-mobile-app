# A deployment never fires the capture flash and never arms the night IR: the reset writes op13 = 0 and op34 = 0 and nothing writes them back

#### File: explanation.md
#### Author: Claude (Fable 5.1), with Victor Anton
#### 4 September 2026

Labels: `bug`, app, cross-repo (project settings live in ww-backend and ww-website).

**Status: fixed in the app on 5 September 2026, app version 0.0.65.** The backend columns
landed first (ww-backend #163, migration `20260904121047_add_project_capture_flash`, defaults
`light_sensor` and `ir`); the app now pulls them, shows them, and writes them at deployment.
See "5. What the fix does" below. The website fields (ww-website #137) and the console flows
(#283) are still open.

## 1. What is the problem

Two operational parameters decide whether a capture is lit. op13 `FLASH_LED` chooses the LED
(0 none, 1 white, 2 IR). On the `ae_review` firmware op34 `FLASH_MODE` decides when it is
armed (0 off, 1 light sensor, 2 always on, 3 time of day); on the earlier build the last light
verdict in op25 played that part. Whatever the mode, nothing fires while op13 is 0, and the
same `ledFlashIsActive()` test gates the STROBE-driven IR that lights motion-detection frames
while the device sleeps (op21, op22).

Start Monitoring resets the device to `FACTORY_DEFAULTS`, which holds op13 = 0 and, since
#280, op34 = 0. `configureDevice` then writes the capture-method parameters (op17, op11, op7,
op8, op10), the deployment id and GPS, and never touches op13 or op34. So every deployment
goes out with the capture flash off and, because the IR illumination inherits the same gate,
with motion detection blind at night. The project's capture method, sensitivity, model,
LoRaWAN and GPS all reach the device; the flash is the one field that has no home in the
project and no write in the pipeline.

## 2. How to reproduce

From the person-detection deployment on 4 September 2026 (blank card, Person detection example
project, `ae_review` e8b7feb5), the op array the Himax reports on every sleep,
[`flow_bench.txt`](https://github.com/wildlifeai/ww-mobile-app/blob/e3b989e9a937f44c5034ffde8d03d69276a80c84/documentation/development%20reports/2026-09-04_person-detection-first-deployment/flow_bench.txt)
line 1886, once monitoring had started:

```
[02:33.011] nrf | AI processor sends stats: '1 0 0 1 4 2 500 0 1000 5 1 1000 100 0 20 1 18 1 2 0 0 2 50 65 15 0 1 286 326 1 110 1 '
[02:48.606] himax | [LS] In ledFlashSetFlashModeFromOpParam with 0 Mode 0
```

Index 13 is 0 (no LED), index 21 is 2 and index 22 is 50 (IR motion illumination at 50 percent,
which the gate keeps off), and the firmware's own line confirms LED 0, mode 0. The configure
sequence in the same log (lines 1787 to 1816) is `setop 11 1000`, `setop 18 2`, `setop 5 2`:
no op13, no op34. Any project on any device shows the same; a bench-set op13 does not survive
the reset either, by design (#268).

## 3. Where in the code

- `FACTORY_DEFAULTS` op13 = 0 and op34 = 0:
  [`useDeviceSettings.ts:104`](../../../../src/hooks/useDeviceSettings.ts#L104) and the 29 to 36 block.
- The deployment writes: [`useDeploymentConfiguration.ts:92-135`](../../../../src/hooks/useDeploymentConfiguration.ts#L92-L135)
  (capture method) and `configureDevice` in [`deploymentPipeline.ts`](../../../../src/ble/workflows/deploymentPipeline.ts).
- The project row has no flash field: `projects` in ww-backend
  (`supabase/schemas/public/tables/25_projects.sql`) carries `capture_method_id`,
  `activity_detection_sensitivity_id`, `timelapse_interval_seconds`, `model_id`,
  `lorawan_required`, `record_gps_in_images`.
- Firmware gate: `ledFlashIsActive()` in `ledFlash.c` (`flashActive && op13`), used by the
  capture path (`image_task.c`, `ledFlashActivate`) and by the sleep-time STROBE arming
  (`image_task.c`, `hm0360_md_configureStrobe(ledFlashIsActive() > 0)` and the
  `OP_PARAMETER_MD_FLASH_LED` check).

## 4. Suggested fix

Make the flash a project setting and write it at deployment, the way the capture method is:

1. ww-backend: `flash_mode` (off, light-sensor, always-on, time-of-day), `flash_led` (white,
   IR), `flash_window_start_minutes_utc`, `flash_window_minutes` on `projects`; migration plus
   the app's generated schema.
2. ww-website: the four fields on the Project Defaults panel, local time converted to UTC
   minutes for the window.
3. ww-mobile-app: `configureDevice` writes op13, op34, op35, op36 from the project after the
   reset; the project card shows a flash chip beside the capture-method icons.

Recommended default, revised 5 September 2026: not the light-sensor mode. The AE light check is
still being worked on, so nothing may fall back to a mode that depends on its verdict; the app's
fallback for an unusable row is `off`, and each project chooses its own flash explicitly. The
earlier recommendation, light-sensor mode with IR, holds for the day that check is reliable.

## 5. What the fix does

Four writes were added to the deployment, and one older mistake had to be corrected before they
could land.

- The project carries the flash. `projects.flash_mode`, `flash_led`,
  `flash_window_start_minutes_utc` and `flash_window_minutes` are pulled by the project sync,
  held on the WatermelonDB `Project` model, and shown on the project card and the Start
  Monitoring feature row.
- `configureDevice` writes them after the reset, as op34, op13, op35 and op36. The column to op
  mapping lives in one file, [`src/utils/projectFlash.ts`](../../../../src/utils/projectFlash.ts).
  A row that predates the columns, or holds a value outside the check constraint, resolves to
  the table defaults rather than to darkness. Mode `off` writes op13 = 0 too, so the night IR
  gate closes with it. Firmware reporting fewer than 37 parameters gets op13 only.
- The dev deployment screen keeps its own LED picker and now deploys it as always-on, so the
  choice actually fires on `ae_review`.

The correction: `configureDevice` was diffing against the op snapshot taken **before** the
reset. Any parameter whose pre-reset value happened to equal what the deployment wanted was
skipped, leaving the device on the factory default the reset had just written. For the flash
that is the whole bug in miniature: a bench-set op13 = 2 would have made the deployment skip
its own op13 = 2 write, and the device would have gone out at 0. `executeResetToDefaults` now
returns the op table as it stands after the reset, and both deployment screens configure
against that. The redundant `setop 8 1000` noted on #268 disappears with it.

## 6. Verified on the bench, 5 September 2026

Device WILD-CNKW, firmware `ae_review_to_merge` 931ef923, app 0.0.65, three-way log in
[`fix_verification_2026-09-05.txt`](../fix_verification_2026-09-05.txt).

**The deployment writes the flash.** The reset zeroed what the bench had left, then the
configure step put the project's values back:

```
[05:17.457] app | [ResetDefaults] Setting OP 13 = 0
[05:19.060] app | [ResetDefaults] Setting OP 34 = 0
[05:20.998] app | [DeployConfig] Configuring capture flash: IR flash, light sensor decides
[05:20.999] app | [DeployConfig] Setting parameter 13 to 2
[05:21.393] app | [DeployConfig] Setting parameter 34 to 1
[05:21.784] app | [DeployConfig] Skipping parameter 35 (already 0)
```

The op array the device reported afterwards carries `13 = 2` and `34 = 1`, against `13 = 0` and
`34 = 0` on 4 September:

```
OpParams 2 0 0 1 17 2 500 0 1000 5 1 1000 100 2 0 0 18 1 2 1 0 2 50 65 15 0 1 286 326 1 110 1 0 0 1 0 0
```

The mode written is the project's, which on the day of the test still read `light_sensor` from
the migration's column default. The revision above is about which value a project should carry,
not about whether the write works.

**The post-reset op table is the one being diffed.** `Skipping parameter 8 (already 1000)` in
the same run is the old redundant `setop 8 1000` from #268 disappearing: op8 was 3000 on the
device when the deployment started, the reset wrote 1000, and the configure step now knows that.

**The console hold arms the flash (#283).** In a lit room, with the white LED chosen, the
firmware refused while the mode was 0 and fired once the hold had written 2:

```
[03:38.879] himax | [LS] In ledFlashSetFlashModeFromOpParam with 1 Mode 0
[03:38.879] himax |   Flash is currently not armed.
[03:41.575] app   | [FlashHold] holding the flash on D6:47:9B:89:E7:23: op34 0 -> 2
[03:46.994] himax | [LS] In ledFlashSetFlashModeFromOpParam with 1 Mode 2
[03:46.994] himax |   Flash is currently armed.
[03:47.180] himax | DEBUG: ledFlashEnable()
[03:47.697] nrf   | Captured 1 images. Last is 592008F0.JPG (File write 49ms avg.)
```

Victor confirmed the LED fired. The picture came back whole, 25048 bytes in 104 packets.

**The three console follow-ups, same session.** The motion preview now opens its LED and
brightness controls on the device's own motion-illumination settings, and the firmware confirms
the test ran on them:

```
[24:10.464] app   | [MotionDetectionSection] Flash controls seeded from op21=2 op22=50
[24:51.009] app   | [FlashHold] holding the flash on D6:47:9B:89:E7:23: op34 1 -> 2
[24:53.999] himax | DEBUG: ledFlashBrightness(50%) [brbits = 0x7]
[24:53.999] himax | DEBUG: ledFlashSelectLED(2)
[24:53.999] himax |   Flash is currently armed.
[25:01.755] app   | [FlashHold] op34 on D6:47:9B:89:E7:23 restored to 1 (release)
```

Before this the same screen opened on no LED, and on 5 percent once one was picked, against the
50 percent a deployment uses. And the Light Sensor screen now writes op34 itself and puts op26
back on the way out:

```
[25:36.000] app   | [LightSensor] op26 was 1 on entry; set to 0 so a light check cannot reboot the device mid-session
[25:55.660] app   | [LightSensor] op34 set to 2
[26:18.198] himax |   Flash is currently armed.
[26:19.193] app   | [LightSensor] op26 restored to 1 on D6:47:9B:89:E7:23
```

Two incidental confirmations. The link dropped twice mid-visit and both times the hold logged
`restore deferred to the next visit`, then settled op34 back to 0 on the following visit, which
is the path that keeps a field camera from being left flashing every capture. And captures on
the HM0360 slot timed out throughout, because this board has no HM0360 fitted
(`HM0360 not present at 0x24`); switching to the RP3 colour image is what made the capture work,
and it has nothing to do with the flash.

## Evidence

| What | Where |
|---|---|
| Deployed device's op array with op13 = 0, firmware line "LED 0 Mode 0" | [`flow_bench.txt`](https://github.com/wildlifeai/ww-mobile-app/blob/e3b989e9a937f44c5034ffde8d03d69276a80c84/documentation/development%20reports/2026-09-04_person-detection-first-deployment/flow_bench.txt) lines 1886 and 1988 |
| Configure sequence without op13 | same file, lines 1787 to 1816 |
| Firmware gate and the IR arming | Seeed `ae_review` 4bcb722c, `ledFlash.c` `ledFlashIsActive`, `image_task.c` STROBE arming before DPD |
