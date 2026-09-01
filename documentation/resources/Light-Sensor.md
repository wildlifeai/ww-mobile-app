# Light sensor: the day/night decision

#### File: Light-Sensor.md
#### Author: Claude (Opus 5), reviewed by Victor Anton
#### 2 September 2026

How the WW500 decides whether it is dark, what the app can read, and the traps in between.
For the working history behind these decisions see
[`development reports/`](../development%20reports/); this file describes how it behaves now.

## What the sensor actually is

There is no light sensor. The HM0360's **auto-exposure registers** are the sensor. The
firmware samples them over several frames and turns them into one boolean: dark or bright.

That boolean has two consumers, and it only runs when at least one of them wants it:

| Consumer | Turned on by |
|---|---|
| The AE-driven flash | `op13` (FLASH_LED) not 0 |
| Automatic day/night camera switching | `op26` (SLOT_SWITCH) = 1 |

With both off the firmware skips AE sampling entirely, so an ordinary capture produces no
decision at all. This is the single most confusing thing about the feature and it is the
reason for the stale-op25 trap below.

## The operational parameters

| OP | Name | Meaning |
|---|---|---|
| 13 | `FLASH_LED` | 0 off, 1 visible, 2 IR. Non-zero makes the light check run |
| 23 | `AE_DARK_THRESHOLD` | Mean AE below this is dark. Ships at 65 |
| 24 | `AE_CHECK_INTERVAL` | Minutes between periodic checks while asleep. 0 disables |
| 25 | `AE_FLASH_STATE` | The last decision. **Runtime state, not a setting** |
| 26 | `SLOT_SWITCH` | 1 = switch camera image automatically on the decision |

> [!WARNING]
> **op25 is stale far more often than it is wrong.** It only updates when the check runs,
> so with the flash off and auto-switch off it keeps whatever it last held, and the device
> will cheerfully report BRIGHT inside a dark box. Never read op25 to find out how bright
> it is now. Read a measurement you triggered.

Note that **connecting to a device sets `op26 = 1`**, because `FACTORY_DEFAULTS` says so and
the pre-deployment checks write any parameter that has drifted. Automatic switching is
therefore on for practically every device the app has touched.

## The two messages the device sends

Both arrive unprompted, after every light check, and are parsed by passive subscription
rather than as command responses.

**1. The raw AE registers**, which the app has parsed for a long time:

```
HM0360 AE regs:
  Integration time = 284 lines
  Analog gain = 4
  Digital gain = 255
  AE Mean = 24
  AEConverged?: N
```

**2. The decision line**, which carries the verdict and every input to it:

```
AE light check: mean AE = 24 (min 24, max 24) over 16 frames, threshold = 65,
analog gain = 4, converged = no, gain railed = yes -> DARK (flash wanted) (changed)
```

Parsed by [`src/ble/protocol/lightCheck.ts`](../../src/ble/protocol/lightCheck.ts).

> [!IMPORTANT]
> **Parse this line by field name, never by splitting on commas.** Fields have been added
> as the firmware's algorithm has been tuned (`analog gain` and `converged` are recent) and
> more are expected. Every field except mean, threshold and the verdict is optional.

`gain railed` is the field worth understanding: when both gains hit their ceiling the
sensor cannot amplify further, and the firmware short-circuits to DARK **regardless of the
mean**. Without it the UI cannot explain a reading above the threshold that still came out
dark.

The `[LS]` prefix in serial logs is for humans and is not part of what the app receives.

## Measuring on demand

`AI light` runs a throwaway single-frame AE check. No image file, no flash, about two
seconds, and no file transfer, against roughly 13 to 50 seconds for a capture.

> [!WARNING]
> **`AI light` is two-phase, not request/response.** It replies `Checking light level...`
> immediately as an acknowledgement only, and the reading arrives afterwards as the two
> messages above. Waiting on the command's own reply for the answer will hang.
>
> This is deliberate. A blocking version **deadlocked over BLE**: the firmware's I2C
> receive state does not clear until the CLI replies, while the telemetry send needs that
> same link free. Do not ask for a synchronous variant.

`useLightSensor.measureNow()` implements this: it subscribes to the decision line *before*
sending, then resolves on whichever arrives first, the line or a 15 second timeout.

## Traps

**A dropped request is silent.** If the camera system is disabled, or the image task is
busy, the request is discarded and nothing is sent to the app. You get the acknowledgement
and then nothing at all, no error. Both paths are
[Seeed#202](https://github.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/issues/202). Until
that lands, a timeout is the only way the app learns anything went wrong.

**`setop 10 0` does not stop a running camera.** `cameraSystemEnabled` is loaded from op10
only when the image task starts, so a write takes effect at the next wake. `AI enable` and
`AI disable` change both. To switch the camera on now, write op10 **and** send `AI enable`.

**The decision line is truncated in transit.** `MSGTOMASTERLEN` is 150 and the line is 151
characters at its shortest, so the closing `)` is always lost, and `(changed)` never arrives
at all. Filed as
[Seeed#203](https://github.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/issues/203). Do not
build anything on `(changed)` until that is fixed.

**A camera fault is not the same as a camera switched off.** A hardware failure sets
self-test bit 8 and needs a physical fix; op10 = 0 sets no bit at all and the app can undo
it in two commands. [`useCameraReadiness`](../../src/hooks/useCameraReadiness.ts) keeps them
separate for that reason.

## Where the code is

| | |
|---|---|
| Decision-line parser | `src/ble/protocol/lightCheck.ts` |
| Hook: readings, `AI light`, op23/24/25 | `src/hooks/useLightSensor.ts` |
| Hook: is the camera usable at all | `src/hooks/useCameraReadiness.ts` |
| Hook: persistent log and CSV export | `src/hooks/useLightSensorLog.ts` |
| Screen | `src/screens/Devices/LightSensorScreen.tsx` |
| Firmware | Seeed `ww500_md/lightSensor.c`, `prvLight()` in `CLI-commands.c` |

## Still open

The threshold itself is under review. Analysis of 303 time-lapse frames scored against the
clock put op23 = 65 inside the daytime distribution, calling roughly one daylight frame in
six dark, and found the gain registers to be stronger discriminators than the mean. Moving
op23 and dropping `AE_HYSTERESIS` need to land together, and the default is mirrored in this
repo's `FACTORY_DEFAULTS`, so it is a cross-repo change to agree rather than make.
