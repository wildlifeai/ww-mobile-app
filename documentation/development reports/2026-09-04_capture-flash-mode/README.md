# Capture flash mode: what op34 changes for the app, and where the setting should live

#### File: README.md
#### Author: Claude (Fable 5.1), with Victor Anton
#### 4 September 2026

**Branch:** `docs/capture-flash-mode`
**Status:** Finding A fixed on 5 September 2026 (app 0.0.65), the rest open. Code review of the firmware's `ae_review` flash modes against every app flow that touches the flash, plus one bug found on the way. Issues filed in four repos.

## Outcome

The firmware's `ae_review` build (4bcb722c) reinstates the capture flash modes behind three
operational parameters: op34 `FLASH_MODE` (0 off, 1 light sensor, 2 always on, 3 time of day),
op35 and op36 for the time-of-day window in UTC minutes. op13 `FLASH_LED` keeps its narrower
meaning, which LED, and nothing fires while it is 0. The mode is re-read at every wake and
re-evaluated on `setutc`. Three things follow for the app.

**The light sensor is now conditional on the mode.** `lightSensor_isRequired()` is true only for
mode 1 or automatic camera switching (op26). In the other modes no light check follows a
capture, op25 stops moving, and the periodic op24 wake (renamed `FLASH_EVALUATE_INTERVAL` in the
firmware) exists to notice a time-of-day edge, with a throwaway frame it does not need.

**Night motion illumination inherits the gate.** The STROBE-driven IR for motion frames arms only
when `ledFlashIsActive() > 0`, which needs the mode's `flashActive` and op13 non-zero, plus op21.
The capture flash mode therefore also decides whether the camera can see at night.

**Deployments never flashed.** The reset writes op13 = 0 and op34 = 0 and `configureDevice`
wrote neither, so no project got a capture flash or night IR. Finding A, the one bug, fixed on
5 September 2026: the backend columns landed as ww-backend #163 and the deployment now writes
all four ops from the project.

| Flow | Today | With op34 |
|---|---|---|
| Start Monitoring | writes op13, op34, op35 and op36 from the project after the reset (A, done) | as now |
| Capture Picture | holds op34 = 2 for the visit and restores it on exit, op25 hack kept only for firmware without a mode (B, done) | as now |
| Motion Detection Preview | holds op34 = 2 for a test that asks for an LED, restored when the test ends, and opens its LED and brightness controls on op21 and op22 so a test predicts the field (B, done) | as now |
| Light Sensor screen | reads and sets op34, says when the mode is not 1 so the verdict on screen is a reading rather than the gate, and puts op26 back on the way out (B, done) | as now |
| Reset to Defaults | op34 to op36 = 0 since #280 | correct as the baseline |

| | Finding | Repo | Type | Issue |
|---|---|---|---|---|
| [A](A_deployments_never_flash/explanation.md) | A deployment never fires the capture flash and never arms the night IR: op13 and op34 are reset to 0 and nothing writes them back | app | bug | [ww-mobile-app #282](https://github.com/wildlifeai/ww-mobile-app/issues/282), fixed |
| B | The console flows (Capture Picture, Motion Detection Preview, Light Sensor) need to drive op34 instead of the op25 workaround | app | enhancement | [ww-mobile-app #283](https://github.com/wildlifeai/ww-mobile-app/issues/283), holds done |
| C | `projects` needs flash mode, LED and time-of-day window columns | backend | enhancement | [ww-backend #163](https://github.com/wildlifeai/ww-backend/issues/163), done |
| D | Project Defaults panel needs the flash fields, with local time converted to UTC minutes | website | enhancement | [ww-website #137](https://github.com/wildlifeai/ww-website/issues/137) |
| E | Modes 2 and 3 take a throwaway frame on the periodic wake they do not need, and the flash console lines should carry the mode | firmware | enhancement | [Seeed #214](https://github.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/issues/214) |

## Where the setting should live

The project already owns capture method, sensitivity, model, timelapse interval, LoRaWAN and
GPS (`projects` in ww-backend, the website's Project Defaults panel, the app's project card).
The flash belongs in the same row: `flash_mode`, `flash_led`, `flash_window_start_minutes_utc`,
`flash_window_minutes`. The app writes them at deployment after the reset, alongside the
capture-method parameters, so a bench-set mode never survives into a deployment.

Recommended default, revised 5 September 2026: **not** the light-sensor mode. The firmware's AE
light check is still being worked on, so neither a project nor a fallback in the app should
depend on its verdict yet (Victor, 5 September). The app's fallback for a row with no usable
flash value is `off`, which is what the firmware itself defaults to; a project that wants light
says so in its own row, choosing always-on or a time-of-day window.

The earlier recommendation was light-sensor mode with IR (mode 1, op13 = 2), on the grounds that
it restores night illumination, matches the 50 percent IR the hardware was tuned for (op22), and
leaves daytime pictures unlit. That reasoning holds for the day the light check is reliable.

## Open items

All five filed on 4 September 2026 and linked in the findings table, permalinked to f7fe54ed. Order of work: ww-backend #163 (columns), then ww-website #137 and ww-mobile-app #282 together, ww-mobile-app #283 for the console flows, Seeed #214 at Charles's pace.

Since then: ww-backend #163 shipped as migration `20260904121047_add_project_capture_flash`,
with `flash_mode` defaulting to `light_sensor` and `flash_led` to `ir` on every existing
project. ww-mobile-app #282 followed in app 0.0.65: the project's four columns sync to the app
and reach the device at every deployment, bench-verified the same day. The console holds from
ww-mobile-app #283 landed with it.

**The column default now needs revisiting.** The AE light check is not trusted yet, so
`light_sensor` is the wrong value for a column every existing project inherited. Victor is
setting the projects explicitly; the column's own `DEFAULT` clause still hands `light_sensor`
to the next project anyone creates. Also open: ww-website #137 (the fields on Project Defaults,
so the choice can be made without SQL), the rest of #283 (setting the mode from the Light Sensor
screen), and Seeed #214.

One thing the app cannot do until #137 lands: a project's flash can only be changed in the
database. Every project deploys with the light-sensor default in the meantime, which is the
behaviour the cameras had before the `ae_review` build reorganised the parameters. The app
reads the four columns and never writes them: `push_changes` in ww-backend names the project
columns it accepts one by one and the flash is not among them, so an edit made in the app's
project screens cannot clobber a flash set on the website.

## Files

| File | What |
|---|---|
| [A_deployments_never_flash/explanation.md](A_deployments_never_flash/explanation.md) | The bug, with the deployed device's op array from the person-detection bench log as evidence, and the 5 September bench verification of the fix |
| [fix_verification_2026-09-05.txt](fix_verification_2026-09-05.txt) | Three-way bench log of the verification: the lit capture through the op34 hold, and the deployment writing the project's flash |
