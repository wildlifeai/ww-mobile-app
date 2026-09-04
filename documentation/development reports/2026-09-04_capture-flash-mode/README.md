# Capture flash mode: what op34 changes for the app, and where the setting should live

#### File: README.md
#### Author: Claude (Fable 5.1), with Victor Anton
#### 4 September 2026

**Branch:** `docs/capture-flash-mode`
**Status:** Open. Code review of the firmware's `ae_review` flash modes against every app flow that touches the flash, plus one bug found on the way. Issues filed in four repos; no code changed yet.

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

**Deployments never flash today.** The reset writes op13 = 0 and op34 = 0 and `configureDevice`
never writes either, so no project gets a capture flash or night IR. Finding A, the one bug.

| Flow | Today | With op34 |
|---|---|---|
| Start Monitoring | resets op13 and op34 to 0, configures nothing flash-related | write op13, op34, op35, op36 from the project after the reset (A) |
| Capture Picture | writes op13/op9, then forces op25 = 1 so a chosen flash fires in any room (the `TODO(flash-mode-op)` interim block) | hold op34 = 2 for the visit through the same restore path as op8, delete the op25 hack (B) |
| Motion Detection Preview | writes op9/op13 for the test, never the mode or op21/op22 | give the test the deployment's IR: op13 and op34 = 2 for the run, restored after (B) |
| Light Sensor screen | reads op23/24/25/13, sets op26 = 0 on entry, `AI light` on demand | show and set op34; its verdict is informational unless the mode is 1 (B) |
| Reset to Defaults | op34 to op36 = 0 since #280 | correct as the baseline |

| | Finding | Repo | Type | Issue |
|---|---|---|---|---|
| [A](A_deployments_never_flash/explanation.md) | A deployment never fires the capture flash and never arms the night IR: op13 and op34 are reset to 0 and nothing writes them back | app | bug | [ww-mobile-app #282](https://github.com/wildlifeai/ww-mobile-app/issues/282) |
| B | The console flows (Capture Picture, Motion Detection Preview, Light Sensor) need to drive op34 instead of the op25 workaround | app | enhancement | [ww-mobile-app #283](https://github.com/wildlifeai/ww-mobile-app/issues/283) |
| C | `projects` needs flash mode, LED and time-of-day window columns | backend | enhancement | [ww-backend #163](https://github.com/wildlifeai/ww-backend/issues/163) |
| D | Project Defaults panel needs the flash fields, with local time converted to UTC minutes | website | enhancement | [ww-website #137](https://github.com/wildlifeai/ww-website/issues/137) |
| E | Modes 2 and 3 take a throwaway frame on the periodic wake they do not need, and the flash console lines should carry the mode | firmware | enhancement | [Seeed #214](https://github.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/issues/214) |

## Where the setting should live

The project already owns capture method, sensitivity, model, timelapse interval, LoRaWAN and
GPS (`projects` in ww-backend, the website's Project Defaults panel, the app's project card).
The flash belongs in the same row: `flash_mode`, `flash_led`, `flash_window_start_minutes_utc`,
`flash_window_minutes`. The app writes them at deployment after the reset, alongside the
capture-method parameters, so a bench-set mode never survives into a deployment.

Recommended default for existing projects: light-sensor mode with IR (mode 1, op13 = 2). That
restores night illumination, matches the 50 percent IR the hardware was tuned for (op22), and
leaves daytime pictures unlit.

## Open items

All five filed on 4 September 2026 and linked in the findings table, permalinked to f7fe54ed. Order of work: ww-backend #163 (columns), then ww-website #137 and ww-mobile-app #282 together, ww-mobile-app #283 for the console flows, Seeed #214 at Charles's pace.

## Files

| File | What |
|---|---|
| [A_deployments_never_flash/explanation.md](A_deployments_never_flash/explanation.md) | The bug, with the deployed device's op array from the person-detection bench log as evidence |
