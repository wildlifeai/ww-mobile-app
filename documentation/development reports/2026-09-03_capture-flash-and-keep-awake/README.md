# Capture flash gate, capture timing, and holding the device awake

#### File: README.md
#### Author: Claude (Fable 5.1), with Victor Anton at the bench
#### 3 September 2026

**Branch:** `feat/capture-keep-awake`
**Status:** Complete. Code unit-tested and bench-verified on 3 September 2026; awaiting review

## Outcome

Two questions from the bench, both answered with the three-way log, and one app change.

1. **"The flash selection doesn't come through."** It does. The app's `setop 13` lands and the
   device confirms it. The LED stays off because this firmware fires the flash only when its own
   last light decision (op25) was DARK, and in a lit room the check after every capture says
   BRIGHT. Proven in four console commands, below. There is no "always flash" mode; that is a
   firmware ask, not an app fix.
2. **"Getting the image takes ages."** 21.8 s from tap to picture for a 12.9 KB image, of which
   the capture itself was 52 ms. Waits for the device to sleep and the wakes they forced were
   about 9 s; the transfer was 10.7 s at 1.2 KB/s, throttled by the nRF's per-packet console
   output. The app change removes the 9 s. The transfer is a ww-hardware item.

The app now holds the device awake for a Capture Picture visit by raising its inactivity timeout
(op8) to 3 s and putting it back on exit, or on the next connection if the link dropped first.
The capture path sends `txfile` straight after `Captured` while the hold is active, instead of
waiting for a sleep and paying a wake. The first cut used 20 s and skipped both waits; the third
bench run showed why that cannot work (below), and the hold was shortened the same afternoon.
The screen also gained a step list with a transfer countdown, so the 13 s are no longer spent
watching a spinner.

## The flash, step by step

Typed in the Engineer Console with the bench logger running. Every line quoted is in
[capture_flash_bench.txt](capture_flash_bench.txt).

| Step | Command | Result |
|---|---|---|
| 1 | `AI flash 50 500` | LED lit. Himax: `ledFlashBrightness(50%)`, `ledFlashSelectLED(1)`, `ledFlashEnable()`, off 600 ms later. Hardware, driver and command path all good. Note the first attempt was typed `fash` and came back `Unrecognised`. |
| 2 | `AI getop 25` | 0. The device believes it is bright. |
| 3 | `AI setop 25 1`, wait for `Sleep`, `AI capture 1 500` | LED flashed. The wake restored op25 = 1 into `flashActive`, `ledFlashEnable()` ran before the 52 ms frame, the post-capture check said `BRIGHT (change)` and op25 went back to 0 at the next sleep. |
| 4 | Lens covered, `AI light`, `AI capture 1 500` | `AGain = 4, conv=Y -> DARK (change)` (integration 376, analog gain 4, digital gain 71, mean 71), then a flash on the capture with no override. |

So: app correct, hardware correct, firmware doing what it was written to do. What the product
wants (a user-requested photo with flash actually flashes) needs a firmware option, either an
"always" value for op13 or a flag on the capture command.

**What op13 used to mean.** Checked in the firmware history the same afternoon: from
`d50ac4cc` (4 November 2025) op13 chose the LED and every capture fired it for op12 ms, with no
light gate anywhere; from `39639dac` (9 June 2026) op22 chose a mode, 0 always on (the default),
1 light-driven, more a time-of-day window from op21; `d9d9d253` (5 July 2026, this repo's own
commit) removed always-on and time-of-day, made op13 light-driven only and reassigned 21 and 22
to motion-detection illumination. The app's Off / White / IR selector was built for the first two
eras. Charles's proposal reconstructs what `39639dac` had, minus the op22 overloading; the working
code is recoverable from that commit.

**Interim, agreed with Victor:** Capture Picture writes op25 = 1 before a capture with a flash
selected, so the picture is lit whatever the room; the check after the capture puts the real
verdict back. Only that screen does it. The block is marked `TODO(flash-mode-op)` in
[`useCapturePicture.ts`](../../../src/screens/Devices/hooks/useCapturePicture.ts) and goes when
the new parameter lands.

## Where the 22 seconds went

App capture at 12:36, op8 = 3000 on this device (firmware default is 1000), Colour sensor,
12,942 byte image.

| Stage | Time | Cause |
|---|---|---|
| Setup, then wait for the device to sleep | 4.5 s | op8 inactivity timer, plus one wake for the op read |
| Capture, including its wake | 2.7 s | the frame itself took 52 ms |
| Wait for the device to sleep again | 2.4 s | op8 again |
| Transfer, including its wake | 12.2 s | 54 packets of 241 bytes |

A second transfer on its own (`AI txfile`, 19,395 bytes, 81 packets) took 17.1 s, the same
1.1 KB/s, so the app adds nothing to the transfer. During the first transfer the nRF wrote 85 KB
to its console in 10.7 s, near the ceiling of a 115200 baud line, because it hex-dumps every
I2C packet (`print_x_schedulePrintBuffer`, aiProcessor.c) and calls `NRF_LOG_FLUSH()` before
each BLE send (ble_actions.c). The transfer runs at the speed of the debug console.

## What changed in the app

- **[`ble/session/keepAwake.ts`](../../../src/ble/session/keepAwake.ts)** (new). `acquire`
  raises op8 to 3 s unless it is already higher and records the original in memory and on disk;
  `release` puts it back; `restorePending` writes back anything a dropped link or an app restart
  left owed. A hold taken while a restore is owed keeps the earlier original, not the raised value
  the device reports. An owed original is treated as stale once something else has set op8 below
  the hold, so a deployment's 1000 is never undone. A hold that finds a larger raise of its own
  on the device brings it down to the hold now asked for. Fifteen unit tests cover those paths.
- **[`useCapturePicture.ts`](../../../src/screens/Devices/hooks/useCapturePicture.ts)** acquires
  on entry while connected and releases on exit. If the screen is left before the raise lands, the
  hold is released as soon as it exists. The stale "strobe bug" comment on the flash was replaced
  with the verified op25 behaviour.
- **[`useCapturePreview.ts`](../../../src/hooks/useCapturePreview.ts)** skips the post-capture
  wait under a hold. It exists to keep `txfile` clear of the Save State that precedes sleep, and
  `txfile` follows `Captured` within a second. The pre-capture wait always runs: the wake after
  it is what applies any parameter written since the last wake.
- **[`useCameraSwitch.ts`](../../../src/hooks/useCameraSwitch.ts)** no longer polls its way
  through a switch. After `switchslot` it waits for the Sleep signal (up to 30 s), then for the
  Wake the reboot sends (up to 15 s), then asks `slots` once. Polling stays only as a fallback
  when no Sleep comes. The first version of this fix waited 10 s and then polled, and failed the
  same way on the fourth run: the device had woken on a stale 20 s timer from the earlier build,
  because op8 is read at wake and the restore written straight after connecting only applied to
  the next window. `createBleSession` gained `waitForWake`, and `waitForSleep` now reports
  whether the signal came.
- **[`opCache.ts`](../../../src/ble/protocol/opCache.ts)** patches the value a `setop` wrote
  instead of dropping the array. The fourth run showed why: after the app wrote op13 and, on the
  next capture, op9, the capture's pre-flight re-read the parameters, which woke the device, which
  then had to sleep for 3 s again before the picture. A wake and a sleep, 3.6 s, on every capture
  that changed a setting.
- **A step list while a capture runs.** Victor asked for the operator to see what the camera is
  doing rather than wait and guess. [`utils/captureSteps.ts`](../../../src/utils/captureSteps.ts)
  is the pure state machine (thirteen unit tests), fed by
  [`useCaptureSteps.ts`](../../../src/screens/Devices/hooks/useCaptureSteps.ts) from the device's
  own lines (`About to capture`, the light verdict, `Captured`, `N bytes in`, `Finished sending`),
  the Wake signal and the reassembler's packet progress, plus two milestones only the app knows.
  [`CaptureSteps.tsx`](../../../src/screens/Devices/components/CaptureSteps.tsx) draws it: four
  steps with ticks, and under the transfer a bar with the size and the seconds left, counting at
  the nominal 1.1 KB/s until 2 KB have arrived and at the measured rate after. No new command to
  the device; the list reports what the camera said, not what the app hoped.
- **Tidy-up before the commit,** at Victor's request. `useCapturePicture` lost the test-mode
  state nothing set, an unused reset, a duplicate AE register parser (it now uses the Light Sensor
  screen's) and a type named for the camera-settings-test screen; `CapturePictureSection` lost two
  dead styles and six inline ones. The console guide's row for the flow shrank from 865 characters
  to one line, the duplicate capture sequence diagram left `BLE_Architecture.md`, three stale lines
  in `DOCUMENTATION-AUDIT.md` were corrected, and everything the flow does now has one page,
  [`resources/Capture-Picture.md`](../../resources/Capture-Picture.md). Left for their own PRs,
  since they change behaviour: renaming and widening `useCapturePreview`, one progress and ETA model
  for the three capturing screens, one transfer-completion rule on `bleEventBus` with the
  EventEmitter3 emitters gone, and coalesced `getOps`.
- **Nothing at connect time.** A first cut called `restorePending` from `useBle.connectDevice`,
  so a device dropped mid-hold was put back on the next connection. Victor removed it by rule:
  the Engineer Console connects and changes nothing, and only a flow the user has opened may
  write. The owed restore now waits for the next hold on that device, which `acquire` handles;
  the rule is in the skill file.
- **A flow stops when its screen goes, and nothing is sent into an image stream.** The eighth
  run found both. `useCapturePreview` and `useCapturePicture` check a mounted ref before each
  command, so Back mid-run sends no capture and no `txfile`, and a screen shows only the picture
  it asked for (`useCaptureSteps` ignores a foreign one too). `bleTransportController` holds its
  queue from the reassembler's `onImageStart` (the `N bytes in` line) to its finish, with a 10 s
  silence backstop; four more transport tests cover it. The command type has carried a
  `safeDuringStreaming` flag since the queue was written and nothing ever read it.

Why the care: op8 is written to CONFIG.TXT and applies in the field. A device left at 20 s stays
awake 20 s after every motion capture. The Motion Detection stream raises op8 the same way for
its test window but keeps the original only in a ref, so a drop there leaves the device raised.
That is listed below.

## Verification

- `npm test`: 593 passed, 45 of them new. `npm run type-check`, `npm run lint`,
  `npm run docs:validate` clean.
- Bench, after, at 13:26 NZST with the same firmware, op8 at 1000 before the hold, two captures
  from the app in one visit. Black & White was chosen on entry, so the device reset once before
  the first capture and both frames came from the HM0360, which behaved this time. Log in
  [capture_keepawake_bench.txt](capture_keepawake_bench.txt).

| Capture | Tap to picture | Transfer | Everything else |
|---|---|---|---|
| Before, op8 at 3000 (12:36) | 21.8 s | 10.7 s for 12,942 bytes | 11.1 s |
| First under the hold, device asleep at the tap | 13.2 s | 10.3 s for 11,818 bytes | 2.9 s |
| Second under the hold, device awake | 14.5 s | 11.4 s for 11,762 bytes | 3.1 s |

  The 2.9 s that remain are the op read that starts a capture (one wake when the device has
  slept, 0.6 s), the capture command and its reply, and the txfile round trip. The transfer is
  unchanged and is now three quarters of the total.
- The hold did what it says. `Set OpParam 8 = 20000` on entry; the device slept exactly 20 s
  after the last transfer byte (`Inactive for 20000ms`); on leaving the screen the app wrote
  `AI setop 8 1000` and logged `op8 restored to 1000 (release)`. The restore woke the device,
  which had entered DPD 0.9 s earlier; that wake is the price of a clean restore.
- The flash behaved as the gate predicts: the first capture flashed because op25 was still 1
  from the covered-lens run, its check said `BRIGHT (change)`, and the second did not flash.

### Third run: the 20 s hold broke the camera switch, and why the hold is now 3 s

On Charles's `ae_review` at e8b7feb5, with a fresh SD card, Victor changed the camera from Colour
to Black & White on the Capture Picture screen. The log
([capture_switch_bench.txt](capture_switch_bench.txt)) shows `switchslot` accepted at 14:04:58,
`write_slot_selector: slot 0 selector written OK`, `Reset scheduled`, then four `AI slots` polls
five seconds apart each answering `Active slot 0 running 'RP3'`: the selector had flipped but the
image had not changed, because the reset happens on the way into sleep, the 20 s hold kept the
device awake, and every poll restarted the timer. The app gave up at 14:05:20. The device slept at
14:05:40, 20 s after the last poll, and rebooted into HM0360 with nobody watching.

The same mechanism affects the flash: the firmware selects the LED and brightness (op13, op9) in
`setupLEDFlash()` when it wakes, not when `setop` lands, so under a 20 s hold a changed flash
would not have reached the next capture either. The pre-capture wait for sleep was never only
about the FatFS race; it is also how a changed setting gets applied.

So the hold is 3 s, the pre-capture wait always runs, only the post-capture wait is skipped, and
the camera switch waits for the Sleep signal before polling. A 3 s hold still covers the gap
between `Captured` and `txfile` (under 1 s), and with the device asleep at the tap, which after
3 s it nearly always is, the capture timing is the 13 s measured above. A longer hold needs the
firmware to apply parameters on `setop`, listed below.

### Fourth run: the switch as designed, and one wake too many per capture

With the hold at 3 s and the switch waiting on the device's signals, Colour to Black & White took
8.7 s: `switchslot` at 14:30:47, Sleep 3.5 s later, `Reset by watchdog`, Wake at 14:30:55, one
`slots`, confirmed. The two captures that followed each changed a setting first (op13, then op9)
and each paid the wake described above under `opCache.ts`: 20.2 s and 23.3 s tap to picture, the
transfers 10.2 s and 11.9 s (13.4 KB for the second). Both light checks said `BRIGHT` at analog
gain 0, so neither flashed; the step list carried that verdict. Log in
[capture_switch_bench.txt](capture_switch_bench.txt), second half.

### Fifth run: the finished flow

Two captures at 14:41 with every change in place. The first, settings unchanged and the device
asleep: both waits returned at once, one wake, 10.1 s tap to picture (11.2 KB, transfer 8.1 s).
The second, after changing the brightness to 80%: the write was patched into the cache, no
re-read and no extra wake, one 3 s sleep, then the capture's wake applied it
(`ledFlashBrightness(80%)` in the Himax log), 15.9 s tap to picture (transfer 9.5 s). Both light
checks said `BRIGHT`, so neither flashed, and the step list said so. Log in
[capture_switch_bench.txt](capture_switch_bench.txt), last section.

| Capture | Tap to picture | Of which transfer |
|---|---|---|
| Before this work, op8 at 3000 | 21.8 s | 10.7 s |
| Now, settings unchanged | 10.1 s | 8.1 s |
| Now, one setting changed | 15.9 s | 9.5 s |

### Sixth run: the interim flash write

Black & White image, lit room, White selected, brightness 80%. The app wrote `setop 25 1` with
the settings at 15:14:04, the device slept 3 s later carrying op25 = 1, the capture's wake logged
`ledFlashSetFlashModeFromOpParam with 1 Mode 1` restoring the flag, the LED fired (Victor saw it;
on this image the sensor's STROBE pin drives it, so there is no `ledFlashEnable()` line), and the
check afterwards said `BRIGHT (change)`, the change being our 1 going back to 0. The device then
slept with `No LED flashes`, so the forced value never reached the motion-detection illumination.
17.6 s tap to picture for 10.6 KB, of which the transfer was 10.4 s: the write costs one command
and the 3 s sleep the changed setting needs anyway. Log in
[capture_forced_flash_bench.txt](capture_forced_flash_bench.txt).

### Seventh run: the full matrix, and a transport deadlock at step 9

Ten steps at 16:34 on the tidied branch: flash Off, White, White again, IR on Black & White;
switch to Colour (9.4 s, Sleep then Wake then one `slots`); White and Off on Colour; leave the
screen; re-enter; capture. Steps 1 to 8 all did what the page says, including `ledFlashEnable()`
on the Colour image's software path and the IR LED selected for step 5. Connecting wrote
nothing; the first write came when the flow was opened.

Step 9 hung. On re-entry the screen's `AI slots` was answered at 16:37:12.3 and the device, back
on its 1 s timer after the release, slept 0.45 s later. The JS thread was slow at that moment
(the mount carried eight gallery images; the `slots` write itself took 400 ms to leave the
phone), so the transport handled the Sleep signal before it had finished completing `slots`.
That moved the queue to `PAUSED_SLEEP`, which only a Wake could lift, and a sleeping Himax is
woken only by a command the paused queue would not send. The op read, the hold and the capture
sat behind it until the link timed out. A latent deadlock, not introduced here; the 1 s timer
and a heavy mount are enough. Fixed in `bleTransportController.ts`: a sleep pause now lifts on
its own after `SLEEP_SETTLE_MS` (500 ms) when a Wake has not come, since the next command is
the wake. Four transport tests cover it. Log in
[capture_final_bench.txt](capture_final_bench.txt).

Before the switch, this run also showed the fresh-card defaults arriving with op7 = 0 after an
earlier mystery: between 13:38 and 13:51, with no logger running, op7 had become 1 and the device
captured on a 1 s timelapse until the card was wiped. Neither the firmware defaults nor the app's
reset write a 1 there; the cause was not established.

### Eighth run: the re-entry retest, and a capture that outlived its screen

At 18:32 on the transport fix, three rounds of leave, re-enter, capture. Rounds one and two were
clean, and the re-entry that hung at step 9 now went `slots`, four op reads, `setop 8 3000`,
Sleep, and the capture 0.3 s after the Sleep: the settle lifted the pause. Round two also
switched to Black & White and forced the flash on the way (`setop 13 1`, `setop 25 1`), 13 KB in
11.5 s.

Round three: Victor pressed Back while the flow was between the op read and the capture. The
hold was released at 18:35:16 (`setop 8 1000`) but the chain kept going: `capture` at 18:35:20,
`Captured 59200920.JPG` at 18:35:22, and, the device now back on its 1 s timer, a sleep before
`txfile` at 18:35:24. He re-entered while the picture was streaming. The re-entry's `slots` at
18:35:36 went straight into the stream: the nRF forwarded it and restarted its packet counter
(packet 51, then 1), and again after the retry at 18:35:44; the reassembler counted 412 phantom
gaps (the byte count matched and it appends in arrival order, so the file was most likely
intact); `AI processor not responding` came at 18:35:48 and the `slots` reply at 18:35:49, once
the file had finished. The new screen's completion listener then showed the picture the old one
had asked for, and 5 s later the old chain's 30 s download timer fired a `console.error`, which
the debug build shows as a red box: the error Victor saw. Log in
[capture_retest_bench.txt](capture_retest_bench.txt).

Two faults, neither in the device: the capture chain did not know its screen was gone, and the
transport did not know a stream was running. Both fixed as described under "What changed".

Retested at 18:54 on that fix: Back pressed 1.4 s into the run, and the log says
`[useCapturePreview] Screen left; not sending the capture`; the release went out, nothing else
did, and the re-entry 12 s later was clean. The Back press is proven on the bench; the stream
gate rests on its tests, since nothing was left streaming to exercise it.

The camera switch that followed failed, and this time the device was at fault. On the re-entry
the device woke on its 1 s timer (op8 was back at 1000 from the release) and the screen's entry
burst ran `slots`, the health banner's `selftest`, then `setop 8 3000`. That write arrived as
the 1 s inactivity fired: the Himax's image task was already in Save State (the config save
failed, `Error 12 saving config`, though the reply still said `Set OpParam 8 = 3000`), and the
IF task received its `Inactivity` event while transmitting the reply, a state with no handler
for it (`IF Task unhandled event 'Inactivity' in 'I2C TX State'`). The image task had already
reported ready to the two-party shutdown barrier and gone `Uninitialised`; the IF task never
sent its `Sleep` line, so the barrier stayed at one and the device never entered DPD. From then
on, every second: inactivity, the image task flags it as unhandled and sends that text to the
nRF, which puts the IF task into its transmit state exactly when its own `Inactivity` event
lands, unhandled again. Self-sustaining: close to 600 cycles by 19:05, the device awake
throughout, the scheduled slot reset never taken. `AI reset` would not help (the request is
consumed on the way into DPD) and `AI enable` is not handled in `Uninitialised`; a power cycle
is the way out. The app did what the page says: waited 30 s for a Sleep, polled `slots` four
times (`Active slot 0 running 'RP3'`: selector switched, image not), and reported the failure.
Both windows are in [capture_retest_bench.txt](capture_retest_bench.txt).

## Earlier the same day: a capture that never returned

Before the flash steps, with the Black & White sensor selected, an app capture hung for 30 s and
the link then dropped. From the same log: the HM0360 had failed to initialise on a wake 25 minutes
earlier (`HM0360 initialisation failed 4`, self-test `0300`), came back on later wakes, then
delivered no frame for the capture (`Frame timed out - restarting sensor, retry 1/5`). The
firmware's inactivity timer fired during the retry and the device slept mid-capture. The app's
30 s timeout fired, no heartbeat went out in the following 34 s, and the nRF dropped the link at
its 60 s inactivity limit. Switching to the Colour sensor made captures reliable for the rest of
the session. The firmware items go to the ground-truth document for Charles in the firmware repo
(`_Documentation/development reports/2026-08-24_light_sensor_review/`); the heartbeat gap is an
app item below.

## Linked documentation

- [BLE_Architecture.md](../../resources/BLE_Architecture.md), session section and Capture Preview
  section, updated.
- [04-ENGINEER-CONSOLE.md](../../onboarding/04-ENGINEER-CONSOLE.md), `CAPTURE_PICTURE` row.
- [02-CODEBASE-GUIDE.md](../../onboarding/02-CODEBASE-GUIDE.md), session folder.
- `.agents/skills/SKILL.md`, BLE rules: op8 is a field setting.
- [capture_flash_bench.txt](capture_flash_bench.txt): the three-way bench log, filtered to the
  lines that carry the story. Times are MM:SS.mmm from the start of the capture, which began at
  12:21 NZST. [capture_keepawake_bench.txt](capture_keepawake_bench.txt) is the second run
  (13:22) and [capture_switch_bench.txt](capture_switch_bench.txt) the third (14:04).
- Bench: WW500 `WILD-CNKW`, firmware `ae_review` at ee65771f on both slots, Pixel 7
  `28311FDH20013V`, debug build of this branch served by Metro. Logger:
  [`bench_log.py`](https://github.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/tree/main/_Documentation/development%20reports/2026-08-24_light_sensor_review/mobile_app_three_way_bench)
  from the firmware repo's light sensor thread, the Himax console at 921600 and the nRF console
  at 115200 interleaved with `adb logcat`.

## Open items

To be filed as issues once this thread is reviewed:

- **Firmware (Seeed):** an "always flash" option for user-requested captures. Today op13 only
  chooses the LED and op25 gates it; the app carries an interim op25 write until then. Charles's `flash_led_modes_proposal.md` (on `ae_review`
  at e8b7feb5, pushed the same afternoon) proposes always-on and time-of-day modes behind a new
  op parameter numbered from 32. **The app already holds 32 (`CAM_RESOLUTION`) and 33
  (`MD_BLOCK_NUM_MAX`)**, so the index has to be agreed before either side ships.
- **Firmware (Seeed):** the inactivity timer fires during a frame-timeout retry and the device
  sleeps mid-capture. The retry should count as activity.
- **Firmware (Seeed):** apply op9 and op13 (and ideally every wake-read parameter) when `setop`
  lands, or add a command that enters DPD now. Either would let the app hold the device awake for
  a whole visit instead of 3 s, and would make a changed flash take effect without a sleep.
- **Firmware (ww-hardware):** the nRF's per-packet hex dump and `NRF_LOG_FLUSH()` in the binary
  send path cap image transfer at about 1.1 KB/s over a 115200 baud console.
- **Firmware (ww-hardware):** `Finished sending` was logged as `Failed to send` twice before it
  went through, while the last binary packets were still draining. Harmless here, worth a look.
- **Firmware (ww-hardware):** a command received while a file is streaming is forwarded to the
  Himax at once and restarts the binary packet counter (packet 51, then 1), and its reply waits
  for the file. Holding it until `Finished sending`, or refusing it, would let the app show a
  clean error instead of gating the queue itself.
- **Firmware (Seeed):** the IF task has no handler for `Inactivity` in its I2C transmit state.
  When the inactivity timer fires while a reply is going out (op8 at 1 s and a command about a
  second after the last), the image task reaches the shutdown barrier and the IF task never
  does; the device then stays awake for good, one unhandled-event message a second, until it is
  power-cycled. Seen 3 September 2026 at 18:55 on `ae_review` e8b7feb5 (eighth run). A pending
  flag acted on at TX done, or re-posting the event, would close it; the `Uninitialised` image
  task flagging inactivity is what keeps the loop fed.
- **Firmware (Seeed):** a `setop` that lands during Save State replies `Set OpParam` but the
  config save fails (`Error 12 saving config`), so the value is lost at the next boot.
- **App:** recognise the stuck-awake broadcast (`IMAGE task unhandled event 'Image Event
  Inactivity' in 'Uninitialised'` every second) on the health banner and tell the operator to
  power-cycle, instead of letting the next flow time out against it.
- **App:** the Motion Detection stream should take its hold through `keepAwake` instead of a ref.
- **App:** no heartbeat went out during and after the timed-out capture, so the nRF dropped the
  link. Establish whether the timer was starved or the hook was not mounted on that screen.
- **App:** with the device held awake, the op cache could live longer than one wake window. It is
  still dropped on every Wake, which is correct but conservative.
- **App:** the op cache does not coalesce concurrent misses. Screen entry sent four `AI getop -1`
  within one second (13:26:02.3 to 13:26:03.3), one per hook that wanted the array before the
  first reply had landed. A shared in-flight promise per device in `getOps` would make that one
  round trip.
