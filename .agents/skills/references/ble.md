# BLE, the rules that keep it deterministic

#### File: .agents/skills/references/ble.md
#### Author: Claude, with Victor Anton
#### 19 September 2026

Read this before changing anything under `src/ble/`, or any hook or screen that talks to a
device. The contracts with the firmware are in
[cross-repo-contracts.md](cross-repo-contracts.md), and the failures that have already cost a
day are in [traps.md](traps.md).

## Where commands live

- **One source of truth.** Every command is a factory in `commandRegistry.ts` with its own
  matchers, timeout and retry policy. Never parse a device response anywhere else.
  `messageClassifier.ts` colours log lines for the UI and has **no protocol authority**.
- **Two write paths, deliberately separate.** `bleSession.execute()` for anything
  deterministic, meaning queued, matched and timed out. `writeRaw()` only for the Engineer
  Console's raw input line. The console does also run workflows from its Flows modal; the
  invariant is that the **typed input line** never enqueues, so typing can never interleave
  with a deployment's command sequence.
- **Defining a command does not make it visible.** `CommandReferenceModal` builds its list
  from a hand-maintained allowlist, a `pick([...])` per group, so a command can be fully
  defined in `COMMANDS`, work when typed, and never appear in the UI. `slots` and
  `switchslot` were unreachable that way until August 2026. A coverage test now fails CI if a
  `type: 'command'` entry belongs to no group. **`FlowsReferenceModal` has the same shape and
  no equivalent guard**, so `type: 'process'` entries can still go missing silently. When you
  add one, open the modal and confirm it renders.
- **`commandQueue` does not exist.** The queue is `bleTransportController.ts`. Old docs and
  comments still name the former.

## Connecting, sleeping, waking

- **Connecting changes nothing on the device.** The Engineer Console connects and shows a
  terminal; every write to the device happens inside a flow the user opened, after they
  navigated to it. Never add a write to `useBle.connectDevice`, the console screen or the
  heartbeat path. A deferred sleep-timer restore was briefly wired into the connect path on
  3 September 2026 and removed the same day for this reason. It now waits for the next hold.
- **The device sleeps aggressively.** Deep Power Down after about 1000 ms of inactivity, and
  the BLE link drops after about 60 s, which is why the heartbeat is 58 s. After *any*
  disconnect assume the device is asleep and not advertising until woken by button, motion or
  timer, and budget minutes: after a timeout disconnect on 4 September 2026 the nRF did not
  advertise again for two and a half, and a connect attempt inside that gap simply timed out.
- **A stale scan entry will hang you.** Auto-connect only trusts a device seen in the current
  scan session, the `lastSeen` gate. A just-disconnected device lingers in cache and
  connecting to it hangs until timeout.
- **`waitForSleep` returns immediately when the device is already asleep**, tracked in
  `ble/protocol/sleepState.ts`. This is not an optimisation, it is a correctness fix: once the
  op cache stopped the capture path from waking the device, the wait sat out its full 5000 ms
  timeout waiting for a Sleep signal that had already been sent. `startCapture` to `capture`
  went from 2.03 s to 5.03 s to **0.13 s**. Note that *unknown* is not treated as awake, so a
  first-ever wait still waits.
- **Order the commands so the wake works for you.** The device announces its self-test when it
  wakes, so a command that wakes it, such as `getop -1`, answers the next question for free.
  Sending `selftest` first instead means it goes out about 200 ms *before* the broadcast that
  would have made it unnecessary. That ordering bug survived a code review and was only
  visible in a merged app, nRF and Himax log.

## Operational parameters

- **Read ops through `session.getOps()`, not `execute(getops)`.** `AI getop -1` returns all 32
  values and almost every hook wants one or two, so the array is cached per device for one wake
  window, in `ble/protocol/opCache.ts`. A `setop` patches the one value the device confirmed;
  the array is dropped on **Wake** and on disconnect, because the device rewrites its own
  parameters while asleep: automatic day and night switching moves the active slot, and the AE
  check writes op25. A bench run counted **18 fetches for six photos** before this, and
  dropping the array on `setop` cost a wake on every capture that changed a setting.
  Verification paths, `configVerification` and `deploymentPipeline`, deliberately still read
  fresh. Concurrent misses are not coalesced yet: screen entry still sends four `getop -1` in a
  second, an open item.
- **Stored op values can be stale, so check what keeps them updated.** The clearest case is the
  light decision, op25. The firmware only runs its AE check when something consumes the result,
  meaning the flash mode is AE (op34 is 1) or auto camera switch is on (op26 is 1). **Since #304
  both are off on a deployed camera unless the project chose the AE flash**, so op25 stale is
  the normal case, not the edge one: the device happily reports BRIGHT inside a dark box and no
  amount of waiting changes it. Read the AE mean streamed during a capture *you* triggered
  rather than the stored decision, and never phrase a stored verdict as a measurement. The
  deployment log made exactly that mistake before #304. Before surfacing any op as "current",
  establish what writes it and when.
- **`setop` stores; the device applies at wake.** The flash LED and brightness, op13 and op9,
  are read in `setupLEDFlash()` when the device wakes, the camera settings when the image task
  starts, a camera switch resets at the next sleep, and op8 itself sets the timer of the *next*
  awake window. So a flow that changes a setting must let the device sleep before the capture
  that should use it, which is why the pre-capture `waitForSleep` is not an optimisation to
  remove, and it must send nothing while waiting, because every command restarts the timer. A
  20 s hold with `slots` polling, tried on 3 September 2026, meant a camera switch never reset.
  Whether the firmware should apply on `setop` instead is Charles's decision in Seeed #209.
- **op8 is a field setting, so go through `ble/session/keepAwake.ts`.** It is written to
  CONFIG.TXT, and a device left raised stays awake that long after every motion capture in the
  field. `acquire` raises op8, 3 s for Capture Picture, and records the original on disk;
  `release` puts it back; and anything a dropped link left owed is restored the next time a
  flow takes a hold on that device. Nothing is written at connect time. Never `setop 8` from a
  screen and never keep the original only in a ref, which the Motion Detection stream still
  does (#271). While `keepAwake.holds(deviceId)` the capture path sends `txfile` straight after
  `Captured` instead of paying a wake: 22 s to 13 s for the same picture.
- **The app runs ahead of the firmware on op indices, deliberately.** op32, `CAM_RESOLUTION`,
  exists here before it ships on the device. Guard on the array length before touching a high
  index, the way `useCapturePicture` does for the white balance gains, rather than reading it
  and hoping. `getop` now has a `failureRegex` for the out-of-range error and it is
  non-retryable: without it a rejection matched neither success nor failure and burned 8 s,
  then retried, which silently broke a whole flow for 16 s at a time.
- **The nRF strips the op array out of the Sleep broadcast.** The Himax sends all 32 values on
  every sleep and the nRF logs them as `AI processor sends stats`, then forwards six bytes: the
  word `Sleep`. The app never sees the numbers, so there is nothing to parse and the cache
  above is the only app-side answer. Getting them forwarded is a firmware ask, and it would
  delete the cache.
- **The deployment reset does not touch op5.** `RESET_PRESERVED_OPS` keeps `NUM_PICTURES`
  alongside the counters, so a device left at 2 pictures per trigger by an earlier BMP
  deployment stays at 2 through every reset. Both deployment flows write op5 themselves for
  that reason. op18 is not preserved and is 0 after the reset. Noted on 21 September 2026
  while retiring the BMP option, where "the reset handles it" was true for one of the two
  parameters and wrong for the other.

## Captures, light and telemetry

- **`useCapturePreview` is the capture path, do not hand-roll one.** It carries the op10 and
  op18 pre-flight that re-enables a camera left disabled by a stopped deployment, the Save
  State and DPD waits that stop `txfile` racing FatFS and corrupting the file handle (the
  post-capture one is skipped while `keepAwake.holds(deviceId)`, the pre-capture one always
  runs because that wake applies any changed setting), and the reassembly that turns binary
  packets into an image URI with byte-level progress. Use it whenever you need an image. What
  Capture Picture does around it is in
  [Capture-Picture.md](../../../documentation/resources/Capture-Picture.md).
- **To measure light, do not take a photo.** `AI light` is about a second, no JPEG, no flash and
  no transfer, against 13 to 50 s for a capture. It is **two-phase**, because the command's reply
  is only an acknowledgement and the reading arrives afterwards as unsolicited telemetry, so the
  caller subscribes before sending. A blocking version of this deadlocked the firmware over BLE;
  do not ask for a synchronous one. The wait is
  [`protocol/awaitAeRegisters.ts`](../../../src/ble/protocol/awaitAeRegisters.ts), shared by
  `useLightSensor.measureNow` and `deploymentPipeline.measureLight` so the screen and the
  deployment cannot disagree on what a complete reading is. The deployment took a capture here
  until #304, which cost 21 s on the bench the day it was replaced. See
  [Light-Sensor.md](../../../documentation/resources/Light-Sensor.md).
- **Ask what the device already tells you before adding a poll.** Self-test bits arrive
  unprompted after *every* wake, and the light decision after every light check. A September
  2026 bench run counted 25 `Error bits` lines received against 6 `selftest` commands sent.
  Polling costs a DPD wake and, worse, can display a stale answer while a fresher one goes
  unread. That exact bug made a healthy camera look broken until the device was power-cycled.
  Passive subscriptions are listed in
  [BLE_Architecture.md](../../../documentation/resources/BLE_Architecture.md).
- **A three-way bench log is three different viewpoints, not one.** The Himax and nRF console
  legs show what those processors did; only the `app` leg shows what reached the phone. Reading
  a firmware console line and assuming the app got it is how a parser for that Sleep broadcast
  almost got built. Confirm against the `app` leg before designing on it.
