# Light sensor: the AE registers and what to make of them

#### File: Light-Sensor.md
#### Author: Claude (Opus 5), reviewed by Victor Anton
#### 2 September 2026, revised the same day for the register-first flow

What the WW500's light sensor actually measures, what the app can read, how the app scores
it, and the traps in between. For the working history behind these decisions see
[`development reports/`](../development%20reports/); this file describes how it behaves now.

## What the sensor actually is

There is no light sensor. The HM0360's **auto-exposure registers** are the sensor. Five of
them are read after every capture and every light check:

| Register | Range | What it measures |
|---|---|---|
| AE Mean | 0-255 | Average scene brightness, the sensor's own number |
| Analog gain | 0-7 | Pre-ADC amplification. Higher means darker |
| Digital gain | 0-255 | Post-ADC amplification. Higher means darker |
| Integration time | lines | Exposure duration. Higher means darker |
| AE converged | Y/N | Whether the AE loop has settled |

The firmware turns these into one boolean, dark or bright, which drives the AE flash and
automatic camera switching. **The app does not depend on that boolean.** It reads the
registers and scores them itself, for reasons that follow.

## Two algorithms in the firmware, chosen at compile time

`lightSensor.c` carries both, selected by `#define AE_DECISION_GAIN_BASED`:

| | Mean-based (the original) | Gain-based (the default since September 2026) |
|---|---|---|
| Rule | Dark when the mean of 16 frames is below `op23` | Dark when AE has not converged, or analog gain is above 2 |
| Uses op23 | Yes | **No**. Tuning op23 does nothing |
| Hysteresis | `AE_HYSTERESIS`, 12 as shipped, 0 on the review branch (Seeed#204) | None |
| Sampling | 16 frames, 120 ms apart, about 2 s | One register read after a 500 ms settle |
| Evidence | 96.7% of 303 frames scored right at mean < 56 | 99.7% at analog gain > 2 |

Both come from the roadmap analysis in the Seeed repo (`_Documentation/AE_Light_Sensor_Roadmap.md`).
The app cannot see which one a device is running, and cannot change it. That is why the
app scores the registers by both rules and shows them side by side: the comparison happens
on identical inputs, with no reflash.

The app's rules live in [`src/utils/lightSensorRules.ts`](../../src/utils/lightSensorRules.ts)
and mirror the firmware's, with one omission: the mean-based firmware also forces DARK when
both gains sit at their ceiling. The ceilings are sensor registers the app never reads, so
that clause is not reproduced. In practice a railed frame scores dark on the mean anyway.

## The operational parameters

| OP | Name | Meaning |
|---|---|---|
| 13 | `FLASH_LED` | 0 off, 1 visible, 2 IR. Non-zero makes the light check run on captures |
| 23 | `AE_DARK_THRESHOLD` | Mean-rule threshold. Ships at 65. **Ignored by the gain-based algorithm** |
| 24 | `AE_CHECK_INTERVAL` | Minutes between periodic checks while asleep. 0 disables |
| 25 | `AE_FLASH_STATE` | The last decision. **Runtime state, not a setting** |
| 26 | `SLOT_SWITCH` | 1 = switch camera image automatically on the decision |

> [!WARNING]
> **op25 is stale far more often than it is wrong.** It only updates when the check runs,
> so with the flash off and auto-switch off it keeps whatever it last held, and the device
> will cheerfully report BRIGHT inside a dark box. Never read op25 to find out how bright
> it is now. Read a measurement you triggered.

### How the decision reaches the flash LED

op13 only chooses the LED. On every wake the firmware restores op25 into its `flashActive`
flag, and a capture lights the LED only when that flag is set; the check after the capture
then rewrites op25 for the next one. So a flash selected in the app fires on the next capture
only if the device's last decision was DARK, and in a lit room it never fires at all. There is
no "always flash" value yet: the firmware repo's `flash_led_modes_proposal.md` (on `ae_review`,
3 September 2026) proposes always-on and time-of-day modes behind a new op parameter, and
wants to number it from 32, which this app already uses for `CAM_RESOLUTION`. When a flash
does not fire, isolate it in three console commands before looking at the app:

| Command | Proves |
|---|---|
| `AI flash 50 500` | The white LED, its driver and the command path: lights it directly at 50% for 500 ms, ignoring op13 and op25 |
| `AI getop 25` | The gate. 0 means no capture will flash, whatever op13 says |
| `AI setop 25 1`, wait for `Sleep`, then `AI capture 1 500` | The capture path can fire it: this capture flashes, then its check writes op25 back |

Bench-proven on 3 September 2026; the record is in
[the capture flash thread](../development%20reports/2026-09-03_capture-flash-and-keep-awake/README.md).
The firmware side is `ledFlash.c` (`ledFlashSetFlashModeFromOpParam`, `ledFlashActivate`).

It was not always so. From November 2025 op13 chose the LED and every capture fired it for op12
milliseconds; from June 2026 op22 chose a mode (0 always on, 1 light-driven, more a time-of-day
window) and always-on was the default; firmware `d9d9d253` on 5 July 2026 removed the other modes
and made op13 light-driven only. The app's Off / White / IR selector was written for the earlier
meaning.

**Interim, until the flash-mode parameter ships:** Capture Picture writes op25 = 1 before a
capture with a flash selected, so the picture is lit whatever the room; the check after the
capture puts the real verdict back. Only that screen does it, deployments are untouched, and the
block is marked `TODO(flash-mode-op)` in `useCapturePicture.ts` for removal when the new
parameter lands. The screen itself is described in [Capture-Picture.md](Capture-Picture.md).

Note that **connecting to a device sets `op26 = 1`**, because `FACTORY_DEFAULTS` says so and
the pre-deployment checks write any parameter that has drifted. Automatic switching is
therefore on for practically every device the app has touched.

## The two messages the device sends

Both arrive unprompted and are parsed by passive subscription rather than as command
responses. They arrive in this order.

**1. The decision line**, sent only when a light check ran. Its wording depends on the
algorithm compiled in:

```
AE light check: mean AE=77 (min 75, max 80, 16 frames) thr=65, AGain=0, conv=Y, gain railed = N -> BRIGHT
AE light check: AGain = 3, conv=N -> DARK (change)
```

Older firmware spelled the fields out (`threshold = 65`, `analog gain = 4`,
`converged = no`, `(changed)`). All three wordings parse.

**2. The raw AE registers**, sent after every capture and every light check, on every
firmware, whatever the algorithm:

```
HM0360 AE regs:
  Integration time = 284 lines
  Analog gain = 4
  Digital gain = 255
  AE Mean = 24
  AEConverged?: N
```

**The register block is the measurement.** A measurement is complete when it arrives; the
decision line is recorded beside it when the firmware sent one, as the device's opinion.

> [!IMPORTANT]
> **Only the verdict is required from the decision line.** `parseLightCheck` in
> [`src/ble/protocol/lightCheck.ts`](../../src/ble/protocol/lightCheck.ts) anchors on
> `AE light check:` and `-> DARK|BRIGHT`; every other field is optional and each label is
> matched in both its spelled-out and abbreviated form. A version that required the mean
> and threshold turned the September 2026 rewording into a 15 second timeout and a false
> "hardware problem" alert, on a device that had answered correctly. Do not make any field
> but the verdict required again.

Two timing caveats when comparing the block against the decision line. The block is one
frame, read just before the light check runs. Against the mean-based algorithm it will not
match the 16-frame mean; against the gain-based one it is one frame earlier than the frame
the decision used. And the digital gain decode was wrong before 28 August 2026
(`0xfa >> 6` became `0xfc >> 2`), so that column in older exports is not comparable.

The `[LS]` prefix in serial logs is for humans and is not part of what the app receives.

## Measuring on demand

`AI light` runs a throwaway single-frame AE check. No image file, no flash, about a
second, and no file transfer, against roughly 13 to 50 seconds for a capture.

> [!WARNING]
> **`AI light` is two-phase, not request/response.** It replies `Checking light level...`
> immediately as an acknowledgement only, and the reading arrives afterwards as the two
> messages above. Waiting on the command's own reply for the answer will hang.
>
> This is deliberate. A blocking version **deadlocked over BLE**: the firmware's I2C
> receive state does not clear until the CLI replies, while the telemetry send needs that
> same link free. Do not ask for a synchronous variant.

`useLightSensor.measureNow()` implements this: it subscribes to the register block *before*
sending, then resolves on whichever arrives first, the complete block or a 15 second
timeout. The decision line is picked up by the same passive listener and never waited on.

The screen can also **stream**: one measurement every few seconds until stopped, light-only,
each row logged. A single empty tick is a missed row, since a dropped request (Seeed#202)
is exactly what a long run hits now and then; three in a row stops the stream and re-runs
the health check.

## What the app scores and logs

Every completed measurement is logged with the five registers, the app's verdict by each
rule, and the device's verdict when it sent one. The verdicts are in the log only; the
screen shows the level and the registers. The mean rule scores against the device's own
op23 with no hysteresis; the gain rule uses the firmware's constant. Nothing about the
rules is configurable on the screen, so two operators' logs are comparable.

The measurement completes when the register block arrives, and the `AI light` command is
watched only for failure. Its own promise resolves on the acknowledgement line but reaches
the hook late, by up to 1.3 s on a busy session, because the transport completes commands
through a timer that waits for a free JS thread. Awaiting the block directly took that off
every measurement.

The screen changes one thing on the device: **op26 is turned off on entry** if it was on,
and not turned back on. Automatic switching reboots the device into the other camera image
after a DARK verdict, which a capture with the photo option or the periodic op24 check would
trigger in the middle of a run. A deployment's reset to defaults writes op26 = 1 again.

The CSV keeps the original columns in their original order and appends `approach`,
`meanRuleDark`, `hysteresis`, `gainRuleDark` and `deviceLine`, so an old export and a new
one line up in the same spreadsheet.

## Traps

**A dropped request is silent.** If the camera system is disabled, or the image task is
busy, the request is discarded and nothing is sent to the app. You get the acknowledgement
and then nothing at all, no error. Both paths are
[Seeed#202](https://github.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/issues/202). Until
that lands, a timeout is the only way the app learns anything went wrong.

**`setop 10 0` does not stop a running camera.** `cameraSystemEnabled` is loaded from op10
only when the image task starts, so a write takes effect at the next wake. `AI enable` and
`AI disable` change both. To switch the camera on now, write op10 **and** send `AI enable`.

**The decision line was truncated in transit** at 150 bytes, which is what
[Seeed#203](https://github.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/issues/203)
records. The firmware's answer was to shorten the labels, which fixed the truncation and
changed the wording. Nothing in the app depends on the wording any more, and nothing should.

**The gain-based light check used to fire the flash LED.** `decideDarkBrightGainBased()`
woke the sensor into streaming without disabling the STROBE pin, which the previous sleep may
have armed for motion-detection illumination, so a check after a dark capture flickered the
LED. Fixed on `ae_review` at e8b7feb5 (3 September 2026): the check now saves, disables and
restores STROBE the way the mean-based path always did, and the settle delay dropped from
500 ms to 200 ms. On older firmware a fast flicker during a light check is this, not a fault
in the app's request.

**A camera fault is not the same as a camera switched off.** A hardware failure sets
self-test bit 8 and needs a physical fix; op10 = 0 sets no bit at all and the app can undo
it in two commands. [`useCameraReadiness`](../../src/hooks/useCameraReadiness.ts) keeps them
separate for that reason.

## Where the code is

| | |
|---|---|
| The app's rules | `src/utils/lightSensorRules.ts` |
| Decision-line parser | `src/ble/protocol/lightCheck.ts` |
| Hook: `AI light`, the register block, op13/23/24/25/26 | `src/hooks/useLightSensor.ts` |
| Hook: is the camera usable at all | `src/hooks/useCameraReadiness.ts` |
| Hook: persistent log and CSV export | `src/hooks/useLightSensorLog.ts` |
| Screen | `src/screens/Devices/LightSensorScreen.tsx` |
| Firmware | Seeed `ww500_md/lightSensor.c`, `prvLight()` in `CLI-commands.c` |
| Console equivalent | Seeed `_Tools/ae_stream.py`, on the Himax console port at 921600 |

## Still open

Which rule the **device** should run in the field, and whether that should be selectable
at runtime. Selecting it needs a new operational parameter, a cross-repo change to agree
rather than make; indices 32 and 33 are already spoken for. The app-side comparison exists
so that decision can be made on logged data rather than on a bench impression. Seeed#204
(move op23 off 65 and drop the hysteresis together) is part of the same decision.
