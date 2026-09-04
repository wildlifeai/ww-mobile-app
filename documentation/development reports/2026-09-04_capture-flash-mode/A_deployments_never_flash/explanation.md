# A deployment never fires the capture flash and never arms the night IR: the reset writes op13 = 0 and op34 = 0 and nothing writes them back

#### File: explanation.md
#### Author: Claude (Fable 5.1), with Victor Anton
#### 4 September 2026

Labels: `bug`, app, cross-repo (project settings live in ww-backend and ww-website).

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

Recommended default for existing projects: light-sensor mode with IR (mode 1, op13 = 2). It
restores night illumination, matches the 50 percent IR the hardware was tuned for, and leaves
daytime pictures unlit.

## Evidence

| What | Where |
|---|---|
| Deployed device's op array with op13 = 0, firmware line "LED 0 Mode 0" | [`flow_bench.txt`](https://github.com/wildlifeai/ww-mobile-app/blob/e3b989e9a937f44c5034ffde8d03d69276a80c84/documentation/development%20reports/2026-09-04_person-detection-first-deployment/flow_bench.txt) lines 1886 and 1988 |
| Configure sequence without op13 | same file, lines 1787 to 1816 |
| Firmware gate and the IR arming | Seeed `ae_review` 4bcb722c, `ledFlash.c` `ledFlashIsActive`, `image_task.c` STROBE arming before DPD |
