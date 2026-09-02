# Engineer Console flow tidy: baseline, redundancies, and the flows nobody can reach

#### File: README.md
#### Author: Claude (Opus 5), reviewed by Victor Anton
#### 2 September 2026

## Status

**Open.** The baseline is captured and five changes have landed on the back of it. Three orphaned
flows and the missing coverage test are still open, and the firmware request below has not been
filed.

## Outcome

The plan is in the
[Engineer Console Flow Audit](https://claude.ai/code/artifact/64711a6d-7106-4868-ba5f-a0ec2189958b),
whose steps this thread works through. The short version of what the bench changed:

**A flow that had never worked.** Capture Preview read op32, which the firmware on the bench does
not have. `getop` had no pattern for the rejection, so it waited out its 8s timeout, retried, waited
again, and the capture was never sent. 16s of dead time, and the screen looked like it had simply
done nothing.

**Six photos cost 18 fetches of the same op array.** After the session cache and the sleep-state
tracker, three photos and a camera switch cost five, and the slowest part of a capture went from
**2.03s to about 0.13s**.

**A flash that emitted nothing.** op13 was written correctly and the LED selected, but op9 was 0, so
the device lit nothing and said nothing. The comment in the code blamed a Himax strobe bug; the log
showed otherwise.

**Eight hand-written copies of two label sets**, disagreeing with each other. Four for the cameras
("Colour" / "Colour (day)" / "RP3 · day" / "Colour (RP3)") and four for the flash, split between
"Visible" and "White" for the same LED.

## Open items

- wildlifeai/ww-mobile-app#253 redundant `getops` preflights. **Partly addressed** by the session
  cache below; the workflow call sites are deliberately still uncached
- wildlifeai/ww-mobile-app#257 cancelled BLE commands keep running
- Orphaned flows and the missing `FlowsReferenceModal` coverage test: issue to be filed once the
  expose-or-delete decision is made (audit step 03)
- **Firmware request, not yet filed.** The nRF already parses the whole op array on every sleep and
  logs it as `AI processor sends stats`, then forwards six bytes: the word `Sleep`. If it appended
  the numbers, the app would not need to ask for them at all and the cache below could be deleted.
  See "The free copy we cannot see"
- The 8s timeout when a command races the device falling asleep. Rarer now, not gone

---

## Bench setup

| | |
|---|---|
| Device | WW500, `ae_review` at `4dc43587`, HM0360 and RP3 slots |
| Serial | COM5 = nRF (`FTH0BZPJA`, 115200), COM6 = Himax (`FTFAERNNA`, 921600) |
| Phone | Pixel 7, `28311FDH20013V` |
| App | `dev` at `61f3c6f`, debug build installed 2 September |
| Logger | [`bench_log.py`](https://github.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/tree/main/_Documentation/development%20reports/2026-08-24_light_sensor_review/mobile_app_three_way_bench) from the light sensor thread |

**Why the installed build rather than a fresh one.** `dev` has moved past `61f3c6f`, but only in
`android/`, docs and CI. `git diff 61f3c6f..dev -- src/` is empty, so the flow code on the phone is
identical to `dev`. Rebuilding now would install under the new `.expo` package name and start with
an empty database, costing a login for no measurement benefit.

**Close TeraTerm before every capture.** Windows COM ports are exclusive, and the logger refuses to
guess when a port is silent.

**The raw captures were not kept.** Seven three-way logs, about 910KB, of which 36% was hex byte
dumps whose ASCII already appears on the adjacent line, plus a full Himax sensor init on every DPD
wake. Every finding below quotes the lines it rests on, with timestamps, so the conclusions survive
without the noise around them.

Worth knowing if a later question needs them: the hex dumps are what a *truncation* investigation
lives on (Seeed#203 was argued entirely from payload byte counts at each stage), so a thread asking
that kind of question should keep them. This thread only ever asked "how many commands", which the
plain text answers.

---

## Chunks

One flow per chunk, safest first. Each is a separate capture so a mistake costs one chunk, not the
whole baseline.

| # | Chunk | What to do | Status |
|---|---|---|---|
| 1 | Connect only | Open Engineer Console, connect, touch nothing else | pending |
| 2 | Capture Preview | Open the flow, take one photo | pending |
| 3 | Camera Settings Test | Open the flow, press Apply once | pending |
| 4 | Light Sensor | Open the flow, measure once without a photo | pending |
| 5 | Motion Detection | Open the flow, start, wait about 20s, stop | pending |
| 6 | TX File | Run the flow from the Flows modal | pending |
| 7 | File Transfer Test | Open the flow, send one test file | pending |

### Deferred, and why

Not part of the baseline. Each either destroys state or writes firmware, and none of them is a
flow anyone runs often enough for its message count to matter.

| Flow | Why deferred |
|---|---|
| `RESET_TO_DEFAULTS` | Wipes identity, deployment ID and GPS, and erases the AI model |
| `UPDATE_BLE_FIRMWARE` | Writes nRF firmware over DFU |
| `UPDATE_HIMAX_FIRMWARE` | Writes Himax firmware, normally both camera-variant images |
| `MODEL_VALIDATION_TEST` | Erases and reloads the AI model |
| `DEV_DEPLOYMENT_TEST` | Starts a real deployment |
| `CLEAR_CONSOLE` | Local only, sends nothing, nothing to measure |

---

## Results

Filled in per chunk. "Predicted" is the count read from the code in the audit; "measured" is what
the three-way log actually shows. Where they disagree, the log wins and the audit gets corrected.

| # | Flow | Predicted | Measured | Notes |
|---|---|---|---|---|
| 1 | Connect only | 16 | **0** | Prediction was wrong, see below |
| 2 | Capture Preview | 0 on entry | **`AI slots`, then `AI getop 32` twice** | Flow never reached the capture |
| 2b | Capture Preview, after fix | 0 on entry | **4 on entry, 1 on capture** | 3 of the 5 are the same `AI getop -1` |
| 3 | Camera Settings Test | 1 on entry, 3 per Apply | **6 total, 3 of them `getop -1`** | One command cheaper than Capture Preview |
| 4 | Light Sensor | 2 to 3 on entry | **3 total** | Best behaved. `selftest` correctly skipped |
| 5 | Motion Detection | 0 on entry | **7 on start/stop, 1 `getop -1`** | Only flow that restores what it changed |
| 6 | TX File | 1 | **1, via `writeRaw`** | Bypasses the registry, error invisible |
| 7 | File Transfer Test | 0 on entry | **0 text commands** | Binary `ftx` protocol, 512KB in 95.1s |

### Baseline totals

| Flow | Commands | `AI getop -1` | Wall clock | Verdict |
|---|---|---|---|---|
| Capture Preview | 7 | 3 | ~17s | Was broken, fixed today. Costs one more than its superset |
| Camera Settings Test | 6 | 3 | ~17s | Does more than Capture Preview for less |
| Light Sensor | 3 | 2 | 3.1s | Best behaved. Only flow that skips a command via broadcast |
| Motion Detection | 7 | 1 | ~33s | Only flow that reads ops once and restores what it changed |
| TX File | 1 | 0 | 2.4s | Not really a flow, raw write, error invisible |
| File Transfer Test | 0 text | 0 | 95.1s | Binary protocol, clean |

**Eleven `AI getop -1` across six flows**, where two would do if the array were cached per
connection. Every flow that takes a photo issues three.

The two patterns worth copying into the others are both already in the codebase: Motion Detection
reads once, threads the values and restores what it changed; Light Sensor waits for the broadcast
instead of polling for it.

### Chunk 1: Engineer Console connect sends nothing

The predicted 16 was wrong, and wrongly sourced. Sixteen is what connecting **to the camera**
sends, from the device flow. Connecting to the **Engineer Console** is a different path, and it
sends no BLE commands at all: connect, negotiate MTU to 512, start notifications, start the
heartbeat, navigate.

The two commands in the log, `selftest` and `setutc`, both landed at `00:57`, over two minutes
before the app connected at `03:16`. They are the device's own boot sequence.

The idle console is not silent, though. It sends `get heartbeat` every 58 seconds to hold the link
open, visible in the chunk 2 log at `00:39`. That is by design, not redundancy.

### Chunk 2: Capture Preview is broken on this firmware

**The capture never happened.** Zero `capture` commands reached the device. The flow spent its whole
life blocked on an operational parameter this firmware does not have.

```
[01:11.296] app   | Written AI getop 32
[01:11.734] app   | RAW_RX: Error: index (32) must be between -1 and 31.
[01:12.847] app   | [useCapturePreview] startCapture called (count=1, interval=500)
[01:12.847] app   | [useCapturePreview] Phase 1: Setup, checking device state
[01:19.308] app   | Written AI getop 32          <- retry, exactly 8.012s later
[01:20.570] app   | RAW_RX: Error: index (32) must be between -1 and 31.
```

**Root cause is a cross-repo contract break.** `OP_PARAMETER.CAM_RESOLUTION` is **32**
(`useDeviceSettings.ts:59`), and `useResolutionSwitch.refresh()` reads it on screen entry because
`StandaloneCapturePreviewScreen` mounts `CaptureModeSelector`. The firmware on the bench accepts
`-1` to `31`. Its own sleep dump confirms 32 values, indices 0 to 31:

```
Sleep 138 0 0 21 247 1 500 0 1000 5 1 0 100 0 0 0 18 1 0 65 0 2 50 65 15 0 1 286 326 1 110 1
      ^0                                                                              ^31
```

Indices 0 to 31 line up with the app exactly (27 = 286 and 28 = 326 are the app's WB gain
defaults). Only index 32 is beyond the end, so the app is one parameter ahead of this build.

**Two app-side defects turn a rejected parameter into a dead flow:**

1. **`getop` has no `failureRegex`** (`commandRegistry.ts:364`). The firmware's
   `Error: index (32) ...` matches neither the success pattern nor any failure pattern, so the
   command is neither resolved nor rejected. It waits out the full `timeoutMs: 8000`.
2. **`TIMEOUT` is retryable and `getop` takes the default `maxRetries: 1`**, so it does it twice.

Measured cost: **16 seconds of dead time and two DPD wake cycles on entry**, before the capture is
even attempted. The two attempts are 8.012s apart, which is the timeout to the millisecond.

**This is why the flow looked like it did nothing.** The user pressed Run, waited, and reported the
capture as done; the capture command had not been sent and was still queued behind the retries.

### Fix applied, 2 September

Confirmed with Victor: **op32 is coming in a later firmware build and is deliberately absent from
the current one.** So the app is meant to run ahead of the device here, and the defect is that it
does not cope, not that the parameter is missing. Three changes, smallest blast radius first:

| Change | File | Why |
|---|---|---|
| `failureRegex` on `getop` | `commandRegistry.ts:364` | The range error now resolves the command instead of matching nothing and waiting out 8s |
| `MUST BE BETWEEN` is non-retryable | `runCommandPipeline.ts` | A missing parameter index reads the same on every attempt, so the retry only doubles the delay. Mirrors the existing `UNRECOGNISED` rule |
| `refresh()` reads the array, not the index | `useResolutionSwitch.ts` | One command either way, but the array's length says whether op32 exists. Same capability guard `useCameraSettingsTest` already uses for the WB gains |

The hook now exposes `supported`, and `CaptureModeSelector` disables **High-res Day** with an
explanation when the firmware lacks op32, rather than offering a mode the device cannot enter.

Regression test in `simulatedTransport.test.ts`: **21ms, against the 16s it used to take.** The
assertion is a bound rather than an exact figure, because what matters is that it no longer waits
out the timeout.

The general lesson is the second row, not the first. Any firmware response the registry has no
pattern for costs a full timeout plus a retry. `getop` is simply the one we caught.

### Chunk 2b: verified, and the real cost is now visible

Re-run after a Metro reload, no rebuild needed since only TS changed.

| | Before | After |
|---|---|---|
| `AI getop 32` attempts | 2 | **0** |
| `index (32) must be between` errors | 10 lines | **0** |
| `capture` reaching the device | **0** | 1 |
| `txfile` reaching the device | **0** | 1 |

The photo arrived. With the flow no longer blocked, the entry sequence can finally be measured:

```
01:00.831  AI slots      useCameraSwitch.querySlots()          CaptureModeSelector:42
01:01.718  AI getop -1   useCameraSwitch, wants op26           useCameraSwitch.ts:119
01:01.978  selftest      useDeviceSelfTest                     StandaloneCapturePreviewScreen:22
01:02.090  AI getop -1   useResolutionSwitch, wants op32       useResolutionSwitch.ts
   (user presses capture)
01:12.535  AI getop -1   useCapturePreview Phase 1, wants op10/op18
```

**Five commands, three of them the identical `AI getop -1`.** The audit predicted 0 on entry for
this flow, which was wrong: it read `useCapturePreview` alone and missed that the screen mounts
`CaptureModeSelector`, which mounts two more device hooks.

The two fetches at `01:01.718` and `01:02.090` are **372ms apart, from two hooks inside the same
component**, each wanting one different index out of the same array. That is the sharpest evidence
for wildlifeai/ww-mobile-app#253 so far: not two hooks on a screen that do not know about each
other, but two hooks in one component.

**Honest note on the fix.** Changing `useResolutionSwitch` from `getop 32` to `getops()` did not
reduce the command count, it was one command before and one after. What it did was make the
duplication uniform: three identical bulk fetches collapse to one under the session cache proposed
in #253, whereas a targeted `getop 32` would have needed its own handling.

### Chunk 3: the lighter flow is the heavier one

Camera Settings Test, entry then Apply then capture:

```
00:21.097  AI getop -1        entry              useCameraSettingsTest.ts:150
00:22.315  selftest                              useDeviceSelfTest
00:28.847  AI getop -1        Apply pressed      useCameraSettingsTest.ts:192
00:31.018  AI getop -1        capture Phase 1    useCapturePreview.ts:195
00:33.365  AI capture 1 500
00:38.248  AI txfile A978F140.JPG
```

Three `AI getop -1`, exactly as the audit predicted. No `setop` at all, because the parameters were
unchanged and the hook's diff-before-write guard worked.

**Side by side with Capture Preview, doing the same job on the same device:**

| Command | Capture Preview | Camera Settings Test |
|---|---|---|
| `AI getop -1` | 3 | 3 |
| `selftest` | 1 | 1 |
| `AI capture 1 500` | 1 | 1 |
| `AI txfile <file>` | 1 | 1 |
| `AI slots` | **1** | 0 |
| **Total** | **7** | **6** |

The two flows are identical on the wire except that Capture Preview sends one extra `AI slots`.

**So the flow that exists to be the quick lightweight option costs one command more than the full
settings environment, while doing strictly less.** Camera Settings Test can do everything Capture
Preview does, plus change parameters, for one fewer command. That is the measured case for audit
step 04, and it is stronger than the code read suggested: this is not just "one is a superset", it
is "the subset is more expensive".

### Chunk 4: the flow that behaves best, and the one optimisation that is working

```
00:19.720  AI getop -1
00:20.650  [CameraReadiness] device reports 0x0000     <- broadcast, unprompted
00:21.180  AI getop -1
00:21.741  [CameraReadiness] cameraOn=true
00:24.741  AI light
00:27.830  [LightSensor] BRIGHT at AE 78/65
```

**Three commands total**, the fewest of any flow measured, and **no `selftest` was sent**. The
readiness gate skipped it because the wake broadcast had already delivered `Error bits = 0x0000`
before it needed to ask. That is the broadcast-over-polling design from the light sensor work
behaving exactly as intended, and it is the only place so far where the app avoids a command it
would otherwise have sent.

Measurement took **3.1s** from `AI light` to the parsed reading, against roughly 17s for either
photo flow.

| Flow | Commands | Wall clock |
|---|---|---|
| Capture Preview | 7 | ~17s |
| Camera Settings Test | 6 | ~17s |
| **Light Sensor** | **3** | **3.1s** |

The remaining two `AI getop -1` are the known #253 pair: `useCameraReadiness` and
`useLightSensor.refresh()` fetching the same array 1.4s apart for different indices.

### Chunk 5: the best-behaved multi-step flow, and proof of the general lesson

```
00:23.385  AI getop -1          read once
00:24.985  AI setop 18 8        TEST_MODE_BITS on
00:25.620  AI setop 8 3000      hold off DPD for the test
00:26.215  AI md 1              -> Unrecognised, handled, flow continues
00:27.945  AI capture 20 1000
00:54.095  firmware completes the sequence on its own
00:54.945  AI setop 18 0        restored
00:55.845  AI setop 8 1000      restored
```

Seven device commands plus one idle heartbeat. **One `AI getop -1`**, the only multi-step flow that
reads the array once and threads the values instead of re-fetching. It also **restores both
parameters it changed**, which no other flow measured does.

**`AI md 1` is not in this firmware either**, and this is the important part:

| | `AI md 1` | `AI getop 32` |
|---|---|---|
| Device answers | `Unrecognised` | `Error: index (32) must be between -1 and 31.` |
| Registry anticipates it | yes | **no**, until today |
| Cost | 1.7s, no retry | 8s, then 8s again |
| Flow outcome | continues, logged non-critical | **blocked, capture never sent** |

Two instances of the same situation, the app running ahead of the firmware, with opposite outcomes
decided entirely by whether someone had written a pattern for that error string. The `UNRECOGNISED`
rule was added during the light sensor work for exactly this reason and it paid off here.

That is the argument for treating "unmatched device response" as a defect class rather than fixing
`getop` and moving on. The audit's step 05 should probably grow a companion: enumerate the firmware
error strings the registry cannot classify, and give the pipeline a default that fails fast rather
than waiting out a timeout.

### Chunk 6: TX File is not really a flow

```
00:12.897  AI txfile .
00:15.290  RAW_RX: Failed to open ''. (6)
00:16.040  Sleep
```

The device answered in 2.4s. `.` resolved to an empty filename and the open failed. Nothing hung,
but **the operator saw nothing**, which is why it was reported as "nothing seemed to happen".

`TX_FILE` is the only `type: 'process'` entry with no navigation handler, so it falls through to
`handleSend`, which calls **`writeRaw`** (`useEngineerConsoleActions.ts:53`). That is the raw
console path. The registry's `txfile` command is never involved, even though it handles this exact
case and would have said something useful:

```ts
/(\d+\s+bytes\s+in|Failed to open)/i,
(match) => {
  if (match[0].toLowerCase().includes('failed')) {
    throw new Error('No files found on device to download');
  }
```

**This also inverts a documented invariant.** `SKILL.md` records that the typed input line never
enqueues, so typing cannot interleave with a deployment's command sequence. A *Flow* using that same
path is an unqueued command that **can** interleave with a queued sequence. `useCapturePreview`
Phase 3 calls `commandRegistry.txfile(filename)` properly, so the flow is a worse duplicate of a
command that already exists.

Recommendation: either route `TX_FILE` through the registry, or drop it from the Flows modal and
leave `txfile` to the console's command list, where a raw write is the expected behaviour.

### Chunk 7: file transfer, clean

```
LARGE.BIN   512000 bytes   2125 packets   sliding-window(12)
FILE_START ACKed in 1066ms
DATA phase  93.6s
FILE_END    CRC=0x0300 verified
finalStatus success, disconnectOccurred false, wrapCycles 0
```

**95.1s for 512KB, about 5.4 KB/s.** No text commands at all: the `ftx` binary protocol does not go
through the command registry, which is correct.

One late `ftx ack 84` arrived after `FILE_END` and was ignored rather than treated as a protocol
error. That is the right behaviour and worth noting as a pattern the other flows do not have.

### Firmware on the bench is not what this thread assumed

```
**** WW500 MD. (WW500_C02) Built: 22:25:03 Sep  1 2026 ****
Git branch: 'nogit' nogit-dirty
Camera: RP v3 (IMX708)
```

Not `ae_review` at `4dc43587`: a local build from the evening of 1 September with uncommitted
changes, running the RP3 day slot. Whether op32 was removed on that branch or never existed there
needs Charles. Until that is settled, #202, #203 and #204 are being validated against a moving
target.

---

# Phase 2: acting on the baseline

The measurements above are what the rest of this thread is argued from. Each change below names
the number it was meant to move and the number it actually moved.

## Capture Preview folded into Capture Picture

Chunk 3 measured the two camera flows doing the same job on the same device, minutes apart:

| Command | Capture Preview | Camera Settings Test |
|---|---|---|
| `AI getop -1` | 3 | 3 |
| `selftest` | 1 | 1 |
| `AI capture 1 500` | 1 | 1 |
| `AI txfile` | 1 | 1 |
| `AI slots` | **1** | 0 |
| **Total** | **7** | **6** |

Identical except for one extra `AI slots`. **The flow that existed to be the quick lightweight
option cost one command more than the full settings environment while doing strictly less.**

So Capture Preview was removed rather than merged: the `CommandNames` entry, the `COMMANDS`
definition, the modal allowlist line, the routing handler, the navigation route, the param type and
`StandaloneCapturePreviewScreen.tsx`. Removing it only from the modal would have created a fourth
orphan, which is the problem this thread exists to fix.

`CAMERA_SETTINGS_TEST` was renamed `CAPTURE_PICTURE`, and the files went with it
(`CapturePictureScreen`, `CapturePictureSection`, `useCapturePicture`). Leaving three files called
`CameraSettingsTest*` behind a flow called `CAPTURE_PICTURE` is the drift that makes code hard to
follow later.

White balance came out of the flow: the UI card and the two `setop` writes on every Apply.
`OP_PARAMETER.WB_RED_GAIN` / `WB_BLUE_GAIN`, `useDeviceSettings` and the `DeviceResetScreen` labels
all stay, because those indices mirror the firmware contract and the reset screen still has to name
what it resets.

## The flash that emitted nothing

op13 was being written correctly. The device agreed:

```
[04:06.826] MKL62BA command received: 'setop 13 1'
[04:09.019] DEBUG: ledFlashSelectLED(1)
[04:09.019]   Flash LED(s) in use: 1
[04:09.019]   Flash brightness: 0%          <- nothing to see
```

op9 was 0 on the device. The hook seeds its state from the device on mount, so the UI read 0; the
brightness field only appears once a flash is picked, showing 0; and Apply writes only what differs,
so 0 matched 0 and nothing was sent. Every step reasonable, the result useless.

**The `KNOWN ISSUE` comment in the hook blamed a Himax strobe/DPD register bug.** That may be a real
separate defect, but it is not what happened here, and it would send the next reader to the wrong
place.

Turning a flash on from Off while brightness is 0 now lifts it to 50%, with the field on screen
showing the value. Scoped to the Off-to-on transition only, so an operator who deliberately types 0
while already on keeps it. 50 rather than the factory 5 because op22's default carries a note that
5% proved too dim on the bench at realistic distances, and it is the same LEDs.

Verified end to end on the next run: `setop 9 50` on the wire, and
`ledFlashBrightness(50%) [brbits = 0x7]` on the device where it had read `0%`.

## Shared camera and flash controls

`CameraModeSelector` and `FlashSelector` now live in `src/components/device/`, out of
`screens/Devices/` since they are no longer Devices-specific. The mode selector takes
`withResolution` (false gives a plain two-way camera switch) and `label`, so a flow that only cares
which camera is running can use the same control.

The labels moved to where the concepts live rather than into the components:
`CAMERA_VARIANT_LABELS` beside `CameraVariant` in `useCameraSwitch`, `FLASH_LED_LABELS` beside
`OP_PARAMETER` in `useDeviceSettings`. Between them that collapsed **eight** hand-written copies,
which had drifted into four different names for the day camera and two for the same LED.

`CameraSelector.tsx` was deleted: 208 lines referenced only by itself.

**Naming:** the controls are labelled by what the operator gets in the picture, "Colour" and
"Black & White", not by the sensor part number. `FirmwareUpdateScreen` keeps its own labels on
purpose, because choosing a *firmware image* is a case where the part number is the point.

## The session op cache, and the regression it caused

`opCache` holds the op array per device. One choke point in `runCommandPipeline` fills it on a
successful `getops` and empties it on a successful `setop`, so no caller can forget to invalidate.

It gives up quickly on purpose:

| Trigger | Why |
|---|---|
| `setop` | the app just changed a value it holds |
| `Wake` | the device rewrites its own ops while asleep |
| disconnect | the next connection may be a different device |

The `Wake` rule is not caution for its own sake. This thread's own log caught the device having
already switched itself to the colour camera before anyone tapped anything (`Auto-switch: on`), and
the AE check writes op25 unprompted. Anything read before a sleep is a guess afterwards. The wake
window happens to be exactly where the redundant reads cluster, so the narrow lifetime costs almost
nothing.

**The cache alone made photos slower**, and the bench caught it:

```
before cache   startCapture -> capture   2.03s
after cache    startCapture -> capture   5.03s     x3, all exactly 5.0s
```

Removing the Phase 1 read removed the thing that *woke* the device, so `waitForSleep(5000)` then
waited for a Sleep signal that had already been and gone. Four `Timed out waiting for Sleep`
warnings. A 1.2s wake had been traded for a 5s wait on something that had already happened.

`sleepState` tracks Sleep and Wake, and `waitForSleep` returns immediately when the device is
already down. **Unknown is deliberately not the same as awake**: before any signal is seen it
reports false and the wait behaves exactly as it always did, because a capture that skips a wait it
genuinely needed would race the inactivity timer, which is the failure `waitForSleep` exists to
prevent.

### Measured, same device, same three-photo sequence

| | baseline | + cache | + sleepState |
|---|---|---|---|
| `startCapture` to `capture` | 2030ms | 5030ms | **~130ms** |
| Phase 1 duration | ~800ms + a wake | 2ms | 1ms |
| `Timed out waiting for Sleep` | 0 | 4 | **0** |
| `AI getop -1` | 18 (six photos) | 5 | **5** (three photos + a switch) |

Each photo still costs one `getop -1`, and that is correct: the capture wakes the device, the wake
invalidates the entry, and the next Apply re-reads. The reads that disappeared are the redundant
ones inside a single wake window.

**Left uncached on purpose:** `configVerification` and both `deploymentPipeline` sites. They exist
to verify what was just written, so a cache hit would defeat them.

## The free copy we cannot see

The obvious better answer was to stop asking at all. The Himax sends the entire op array to the nRF
on every sleep:

```
[02:51.383] nrf | AI processor sends stats: '179 0 0 31 336 1 500 0 1000 50 1 0 100 2 ...'
[02:51.383] nrf | BLE out: Sent   6 bytes: 'Sleep'
```

Index 9 reads 50 and index 13 reads 2, exactly matching the flash test that had just run. **The nRF
parses it, logs it, and forwards six bytes.** Across a whole session the app received 30 bare
`Sleep` lines and none carrying numbers.

This was very nearly built as a parser before checking what actually reaches the app, which is the
mistake the three-way logger exists to prevent: the Himax and nRF console legs are not what the app
sees. The cache is the app-side half of the answer. The other half is a small firmware change, and
it belongs with the `AE light check` truncation work in Seeed#203, since both are about what the
nRF passes on.

## TX File and Clear Console removed

Neither was a flow. Chunks 6 and 7 measured what they actually were.

**`TX_FILE`** was the only `process` entry with no navigation handler, so it fell through to
`handleSend` and out through `writeRaw`, bypassing the command registry entirely. On the bench it
failed with `Failed to open ''. (6)` and the operator saw nothing, because
`commandRegistry.txfile`, which handles exactly that case and would have said "No files found on
device to download", was never involved. `useCapturePreview` Phase 3 calls that command properly, so
the flow was a worse duplicate of something the app already does correctly.

It also inverted a documented invariant: `SKILL.md` records that only the typed input line skips the
queue, so typing cannot interleave with a deployment's command sequence. A Flow on that path could.

**`CLEAR_CONSOLE`** was the only entry in the Flows list that sent nothing to the device at all.

Clearing the output is a console action, so it moved to a **Clear** button on the console header
beside Commands and Flows. That mattered: `CLEAR_HISTORY` was dispatched from nowhere else, so
deleting the flow without replacing it would have removed the only way to clear the console. The now
empty Console group came out of the modal with it.

| | before this thread | now |
|---|---|---|
| `type: 'process' \| 'local'` defined | 15 | **12** |
| listed in the Flows modal | 12 | **9** |
| orphaned (defined, unreachable) | 3 | 3 |

The three orphans are unchanged and still need the expose-or-delete decision:
`TRANSFER_CONFIG`, `TRANSFER_AI_MODEL`, `FIRMWARE_STATUS`.
