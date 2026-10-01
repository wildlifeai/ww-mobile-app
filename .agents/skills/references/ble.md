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
- **A console command never fills in a value for the operator.** A `COMMANDS` entry whose
  `writeCommand` takes arguments declares them as `params`; the Commands list asks for each and
  sends nothing until they check out, and `useEngineerConsoleActions` refuses one that arrives
  without them. `md` used to default to level 0, which the firmware saves to op17 and which
  turns motion triggering off (#300). `src/components/__tests__/commandArgs.test.ts` fails when
  a command with `params` gains a default. A one-tap entry with fixed arguments, such as
  `capture_one`, builds its string from the registry, so the golden test pins its bytes.
- **`readRegex` and `expectedPattern` on `COMMANDS` entries are read by nothing.** They
  describe the reply for a human; the console writes raw and matches nothing. Fixing one changes
  no behaviour, and a reply that matters belongs in `commandRegistry.ts`.
- **`commandQueue` does not exist.** The queue is `bleTransportController.ts`. Old docs and
  comments still name the former.
- **Cancelling stops the command, and frees the queue at once.** Pass `signal` to
  `session.execute`. The transport aborts the task's own signal wherever it marks it cancelled,
  `clearAll()` included, and `runCommand` drops its listeners and timeout (#257). Before that a
  cancelled command lived on for its full timeout, two minutes for `aifirmware`, and a retryable
  one could write again after a disconnect. The flip side: a cancelled command that was already
  sent no longer holds the queue, so the next one can reach the nRF while the Himax is still
  answering. Cancel when giving up on the device, not to tidy away a poll about to finish.

## Connecting, sleeping, waking

- **Connecting changes nothing on the device.** The Engineer Console connects and shows a
  terminal; every write to the device happens inside a flow the user opened, after they
  navigated to it. Never add a write to `useBle.connectDevice`, the console screen or the
  heartbeat path. A deferred sleep-timer restore was briefly wired into the connect path on
  3 September 2026 and removed the same day for this reason. It now waits for the next hold.
- **The device sleeps aggressively.** Deep Power Down after about 1000 ms of inactivity, and
  the BLE link drops after 60 s with nothing sent either way. The heartbeat pings after 30 s of
  air silence, `HEARTBEAT_IDLE_MS`: at 58 s a JS timer running late lost the link six times in
  one session (#312). Only air traffic restarts it, because only that restarts the nRF's timer,
  and the RSSI read it falls back to while paused never reaches the nRF at all. After *any*
  disconnect assume the device is asleep and not advertising until woken by button, motion or
  timer, and budget minutes: after a timeout disconnect on 4 September 2026 the nRF did not
  advertise again for two and a half, and a connect attempt inside that gap simply timed out.
- **Ending a deployment does not wait on a sleeping camera.** While monitoring, the Himax may not
  answer the wake at all, and every step then sat out its timeout and retries: about 40 s under a
  "Disconnecting" spinner (#293). `session/endDeploymentSession.ts` probes once, skips every later
  `AI` command after the first timeout, caps the lot at 20 s, and lets `dis` through because the
  nRF answers it. The operator is told the camera was left running. Reuse it for any other flow
  whose device steps are optional.
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
  The HM0360's motion rate, op11, is programmed on the way into that sleep. The motion test got
  its sleep for free from `md`'s 5 s timeout until #272 started skipping `md`, so it now waits
  for one explicitly before the capture (#274).
  Whether the firmware should apply on `setop` instead is Charles's decision in Seeed #209.
- **op8 is a field setting, so go through `ble/session/keepAwake.ts`.** It is written to
  CONFIG.TXT, and a device left raised stays awake that long after every motion capture in the
  field. `acquire` raises op8, 3 s for Capture Picture and the interval plus 2 s for the motion
  test, and records the original on disk; `release` puts it back; and anything a dropped link
  left owed is restored the next time a flow takes a hold on that device. Nothing is written at
  connect time. Never `setop 8` from a screen and never keep the original only in a ref, which
  the motion test did until #271. The one exception is a deployment, which sets op8 as the
  field value (above 1000 for a burst, #317) and calls `keepAwake.forget` first, so no hold or
  owed restore from before it can write the old value back. Every way out of a flow must release its holds, failures
  included: a hold left in memory makes the next `acquire` a no-op. While `keepAwake.holds(deviceId)` the capture path sends `txfile` straight after
  `Captured` instead of paying a wake: 22 s to 13 s for the same picture.
- **op11 is a field setting too, and the motion test holds it through
  `ble/session/mdIntervalHold.ts`** at the test interval (#274). Raised on a stopped camera it
  turns motion capture back on, so it differs from keepAwake in three ways: the owed record goes
  to disk before the raise, since a write whose reply is lost may have landed; the test's cleanup
  pays a restore left owed as well as releasing its own hold; and a deployment calls `forget`
  before writing op11, because it writes the same 1000 ms the Start Monitoring card tests at and
  an owed restore cannot tell the two apart. Any other flow that writes op11 to a value a test
  could hold needs the same `forget`. With the detector armed through the setup sleep, a motion
  wake can take and report a capture of its own first, so the test counts grids and ends only
  after its own `About to capture` (bench, 1 October 2026).
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
  parameters and wrong for the other. op6 is not preserved either: the reset sets 500, and
  since #317 Start Monitoring writes op5 and op6 from the project, through
  `utils/projectBurst.ts`, with op5 doubled when the raw BMP is recorded and op8 raised to
  op6 + 1000 when op5 is above 1. op16, the model threshold, is reset to 18 too, so a value
  set from the console does not survive a deployment; since #342 both deployment flows write
  it from the project's `detection_threshold_pct`, through `utils/projectDetectionThreshold.ts`.

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
