# Light sensor flow: from a verdict parser to a readings tool

#### File: README.md
#### Author: Claude (Opus 5), with Victor Anton
#### 2 September 2026

**Status:** open. App side built and gated; not yet run against the new firmware.

## Why this thread exists

Charles pushed `ae_review` in the Seeed repo with two selectable light-sensor algorithms
and asked for them to be tried. Victor built and flashed the images. Before the first
measurement, a read of the branch against the app found that the app's Light Sensor flow
would fail on both algorithms, for a reason that had nothing to do with the sensor.

## What was found

**1. The app would report a hardware fault on a device that had answered correctly.**
`parseLightCheck` was anchored on `AE light check: mean AE =` and required mean, threshold
and verdict. The new firmware's decision line is worded differently under both algorithms:

| Algorithm | Line as sent | Parser result |
|---|---|---|
| Gain-based (default) | `AE light check: AGain = 0, conv=Y -> BRIGHT` | null: no `mean AE` |
| Mean-based | `AE light check: mean AE=77 (min 75, max 80, 16 frames) thr=65, AGain=0, conv=Y, gain railed = N -> BRIGHT` | null: `thr=` is not `threshold =` |

Verified by running both strings through the shipped parser, not by reading the regexes.
The consequence on screen: the raw AE fields fill in (they come from the unchanged
`HM0360 AE regs` block), then the measurement times out after 15 s, the health check
re-runs, and an alert says to check for a hardware problem. Numbers and a fault alert at
once, both wrong.

This is Seeed#203 arriving from the other direction. The issue offered raising the 150-byte
cap or shortening the message and noted shortening "leaves the same trap for the next
field". The firmware took the shortening route; the app's two required fields were among
what got renamed. Nobody's fault in particular. There was no test on either side holding
the contract.

**2. The fast LED flashing has a probable cause.** Charles reported the LED flashing when it
should not and had not found why. `decideDarkBrightGainBased()` wakes the HM0360 into
streaming for 500 ms and reads the gain registers, but unlike `sampleAeStats()` never
saves, disables and restores the STROBE pin (`lightSensor.c:202`, `:204`, `:260` in the old
path). At sleep, `image_task.c:2721` arms the strobe when the flash is active, the MD
interval is non-zero and op21 is set, so the sensor gates the LED directly during motion
detection, and that arming survives DPD. Five frames at 10 fps with it still armed is a
half-second flicker. Not proven on hardware; matches the symptom exactly. Reproduce with
op21 non-zero, MD interval non-zero, flash active, then a light check.

**3. The "old algorithm" on the branch is not dev's.** `AE_HYSTERESIS` is 0 there (Seeed#204
being tried), so the dead band that stopped dusk chatter is gone. A comparison on
stability needs it set back to 12 first.

**4. op23 is inert under the gain-based algorithm.** `decideDarkBrightGainBased()` never reads
it. The app was showing a threshold slider and a margin against it.

**5. The digital gain decode was wrong until 28 August** (`0xfa >> 6` became `0xfc >> 2`),
so that column in earlier CSV exports is not comparable with new ones.

## What was decided

Victor: the app does not need to decide dark or bright. It needs a way to get the relevant
values off the light-sensor method, and ideally to let the user choose the approach. How the
device makes its own decision is a separate piece of work.

So the flow was turned the right way round:

- **The register block is the measurement.** It is sent after every capture and every light
  check on every firmware, whatever the algorithm. A measurement completes when it arrives.
- **The decision line is optional metadata.** Only the verdict is required; every field is
  optional and every label accepts both wordings. Recorded beside the registers as the
  device's opinion.
- **The app scores the same registers by each rule**, the mean rule and the gain rule,
  with the constants from the roadmap analysis, and shows them side by side with the
  device's verdict. Which rule the firmware runs is a compile-time flag the app cannot see;
  scoring client-side is how the two are compared on identical inputs with no reflash.
- **Stream mode**, a measurement every few seconds until stopped, so a dusk run yields a
  series. One empty tick is a missed row; three in a row stops the stream.
- **The mean-rule threshold is app-side**, seeded from op23 and never written back. This
  screen evaluates rules; it does not configure the device.
- **The CSV keeps its columns** and appends the per-rule verdicts and the raw decision line.

Removed: `lightMargin`, `explainDecision`, the parser's required-field rule, the
timeout-on-verdict path, and three device-writing setters in the hook that nothing called.

**Revised after the first device run, same evening.** Victor: declutter. Both rules are now
always shown (the Mean / Gain / Compare selector is gone), the stream control moved into
Settings with the interval beside it, and the hysteresis toggle and the app-side threshold
are gone: the mean rule scores against the device's own op23. On entry the screen turns
op26 off if it was on, without a notice, and does not turn it back on.

## First device run

Eight `AI light` requests over a stream, eight complete measurements, zero timeouts, on
`ae_review` at `ee65771f` with the gain-based algorithm. Every measurement arrived in the
same order: acknowledgement, decision line, register block, `Captured`, `Sleep`, so the
device's verdict row was populated every time and the app never waited on it. At a steady
bench scene the gain rule flipped BRIGHT, DARK, DARK, DARK, BRIGHT across the first five
readings while the mean rule (op23 = 65, means 75 to 90) never moved; integration sat at
its ceiling of 376 throughout, which is the roadmap's transition zone. The passive `light`
command persisted its verdict to op25 on every call (visible in the `Sleep` stats), a design
point for the firmware author since with the flash in AE mode each app measurement would
set the next capture's flash state. The strobe hypothesis was not exercised: op13 was 0 and
motion detection off, so every sleep logged `No LED flashes`.

Timing: the phone renegotiated the connection interval from 15 ms to 195 ms after about
twenty seconds, after which each notification took about 300 ms to reach the app. Separately,
on the last two ticks the hook acted on the register block up to a second after it arrived,
with no wait in the pipeline, controller or logger to account for it; two log markers were
added (`light acked`, `registers complete`) for the next run. Capture:
`bench/2026-09-02_light-sensor/light_sensor_01.log` in the session scratchpad.

**Second run, five at 3 s, with the markers.** `registers complete` fired in the same
millisecond the block arrived on every tick. `light acked`, the command's own promise
returning, lagged its acknowledgement line by 0.4 s on the first tick and 1.3 s on the
fifth, and the hook was waiting on that. The transport completes a command through a 10 ms
timer, which fires only once the JS thread is free; the thread is busy behind every incoming
line (the console log store holds up to 1000 lines per device and something re-renders on
each one; not yet confirmed which). Fix in the hook: await the register block, watch the
command only for failure. The op26 write on entry is confirmed in the capture at 18:31,
`AI setop 26 0` straight after the entry read; later entries found it already 0 and wrote
nothing. All five readings on the RP3 image: mean 80, gain 3, converged, gain rule DARK,
mean rule BRIGHT, device DARK.

Later the same evening, at Victor's request, the three verdict rows came off the screen.
They remain in every logged row.

## Final run

A scripted pass over every path, three-way logged, with the CSV pulled off the phone
afterwards. Both are beside this file: [final_run_bench.txt](final_run_bench.txt), the
app, nRF and Himax sides interleaved with hex dumps and heartbeats stripped (`.txt`
because the repo ignores `*.log`), and
[light-sensor-readings.csv](light-sensor-readings.csv), the export as the phone wrote it.
Everything asked of the flow happened:

- op26 set to 1 from the console, then the screen's entry read and its `AI setop 26 0`,
  logged, within a second of opening.
- Two single measurements, 1.7 s each from press to logged row. The note typed before
  the second is on that row.
- A stream of six at 3 s, then a photo measurement (`capture 1 500`, `txfile`, 12830 of
  12830 bytes, logged with its path), then a second stream left mid-run with the back
  arrow: four requests, nothing written to the device afterwards until the screen was
  opened again. The reading in flight when the screen closed was not logged, which is the
  right outcome.
- Export wrote the CSV; all seventeen columns present, the device line intact on every
  row that had one and empty on the photo row, where no light check runs.

Two defects in the CSV, both fixed the same evening:

- Three light-only rows after the photo carried the photo's path. The preview keeps the
  last image and the log row attaches whatever is current. Now cleared at the start of
  every measurement.
- The note stays on every row after it is typed, while the field says "next reading".
  Left as is for now; it reads as a run label in practice.

Two things outside this flow:

- The keyboard. The app declares `adjustPan`, so the bare ScrollView on this screen could
  not scroll to anything under an open keyboard. Replaced with the app's
  `KeyboardAwareScrollView`, the one `WWScreenView` uses.
- A session-long slowdown of the JS thread. The gap between the register block arriving
  and the hook acting on it grew from 0.14 s on the first measurement to 0.59 s on the
  twelfth, even though the hook now awaits the block directly, and the command's own
  completion lagged its acknowledgement by 3 s at the end. The flow is insulated from the
  second; the first is the cost of every incoming line and grows with the session. Not
  profiled. The 52 "Failed to send 244 bytes" lines on the nRF all sit inside the image
  transfer, which completed, so they are the relay's fast-transfer retries.

The debug build on the bench phone is `com.wildlife.wildlifewatcher`, without the `.expo`
suffix, so it predates PR #258 and still carries the store package name.

## Files

| | |
|---|---|
| Rules | `src/utils/lightSensorRules.ts`, tests in `src/utils/__tests__/` |
| Parser | `src/ble/protocol/lightCheck.ts`, tests rewritten for all three wordings |
| Hook | `src/hooks/useLightSensor.ts`: `waitForRegisters` replaces `waitForLightCheck` |
| Log | `src/hooks/useLightSensorLog.ts`: five new columns |
| Screen | `src/screens/Devices/LightSensorScreen.tsx` |
| Console label | `src/ble/messageClassifier.ts` via `summariseLightCheck` |
| Durable doc | [Light-Sensor.md](../../resources/Light-Sensor.md), rewritten |

Gates at the time of writing: type-check clean, 547 tests passing, lint clean,
`docs:validate` clean. **No device run yet.** The first run should confirm three things: a
measurement completes on the block alone, the device's verdict row appears under the
gain-based firmware, and a stream survives a dropped request.

## Open items

To be filed as issues once Victor confirms; listed here so they are not lost.

- Seeed: the strobe is not disabled in the gain-based light check (finding 2 above). A
  four-line fix, lifting the save/disable/restore from `sampleAeStats()` into a helper both
  paths share.
- Seeed: the decision line's wording is not a contract the app can hold any more, and
  Seeed#203's warning-on-truncation is still worth adding so the next overflow is caught at
  the bench.
- Cross-repo: which rule the device runs in the field, and whether to select it at runtime
  with a new operational parameter. Indices 32 and 33 are spoken for. Seeed#204 belongs to
  the same decision.
- App: a device run over this branch, then the same over `chore/console-flow-tidy`'s seven
  untested commits (see that thread).
