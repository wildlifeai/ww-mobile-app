# Capture Picture

#### File: Capture-Picture.md
#### Author: Claude (Fable 5.1), reviewed by Victor Anton
#### 3 September 2026

The Engineer Console flow that takes one picture with the connected WW500 and shows it. This
page is how it behaves now; how it got here is in the
[capture flash and keep-awake thread](../development%20reports/2026-09-03_capture-flash-and-keep-awake/README.md).

## What is on the screen

| Part | Code |
|---|---|
| Camera mode: Colour, Black & White, High-res Colour where the firmware has op32 | [`CameraModeSelector`](../../src/components/device/CameraModeSelector.tsx), [`useCameraSwitch`](../../src/hooks/useCameraSwitch.ts), [`useResolutionSwitch`](../../src/hooks/useResolutionSwitch.ts) |
| Flash: Off, White, IR (op13) and brightness (op9) | [`FlashSelector`](../../src/components/device/FlashSelector.tsx) |
| Capture Image, the step list while it runs, the picture, a gallery | [`CapturePictureSection`](../../src/screens/Devices/components/CapturePictureSection.tsx), [`CaptureSteps`](../../src/screens/Devices/components/CaptureSteps.tsx) |
| The screen's own logic: settings, hold, step state | [`useCapturePicture`](../../src/screens/Devices/hooks/useCapturePicture.ts), [`useCaptureSteps`](../../src/screens/Devices/hooks/useCaptureSteps.ts), [`captureSteps.ts`](../../src/utils/captureSteps.ts) |
| The capture itself, shared with the deployment camera view and the Light Sensor screen | [`useCapturePreview`](../../src/hooks/useCapturePreview.ts) |
| Holding the device awake | [`keepAwake.ts`](../../src/ble/session/keepAwake.ts) |

## One capture, in order

1. Read the op array (cached per wake). Write op9 and op13 only if they differ from the chosen
   values. If a flash is chosen, write op25 = 1 (see the flash section).
2. Wait for the device to sleep. This is not optional: the firmware applies the flash LED,
   brightness and camera settings when it wakes, so the capture's wake is what makes a changed
   setting real. It returns at once when the device is already asleep.
3. `AI capture 1 500`. The device wakes, takes the frame (about 50 ms), runs its light check,
   writes the file and announces `Captured 1 images. Last is X.JPG`.
4. `AI txfile X.JPG` straight away. Under the hold the device is still awake and its Save State
   is 3 s away, so nothing races the file handle. Without a hold the flow waits for a sleep here.
5. Packets arrive at about 1.1 KB/s and are reassembled and saved; the step list counts down.

Measured on 3 September 2026 with firmware `ae_review` and a 10 to 13 KB image:

| Capture | Tap to picture | Of which transfer |
|---|---|---|
| Before this design, op8 at 3000 and a wait for sleep before and after the capture | 21.8 s | 10.7 s |
| Settings unchanged, device asleep at the tap | 10.1 s | 8.1 s |
| One setting changed (a 3 s sleep, one wake) | 15.9 s | 9.5 s |
| Flash chosen in a lit room (the op25 write plus that sleep) | 17.6 s | 10.4 s |

The transfer is bounded by the nRF's console output per packet, not by BLE or the app; see the
thread's open items.

## The hold

While the screen is open the device's inactivity timeout (op8) is raised to 3 s and put back on
exit. If the link dropped first, the original is kept on disk and put back the next time this
screen takes a hold on that device; nothing is written at connect time, because connecting and
the Engineer Console must change nothing on the device. op8 is a field setting written to
CONFIG.TXT, so the restore matters.

3 s is deliberate. It covers the gap between `Captured` and `txfile` (under a second). Longer
holds delay everything the firmware applies at wake: a 20 s hold, tried first, kept a camera
switch from ever resetting while the app polled for it and would have kept a changed flash
from reaching the next capture. op8 itself is read at wake, so a write only changes the next
awake window.

## The flash

Since firmware `d9d9d253` (5 July 2026) op13 only chooses the LED. Whether it fires on a capture
is decided by op25, the device's last light verdict, which the check after every capture
rewrites; in a lit room that verdict is BRIGHT and nothing selected in the app would flash.
Before that commit op13 was the flash type and every capture fired it. The full chain, the
history and the three console commands that isolate a non-firing flash are in
[Light-Sensor.md](Light-Sensor.md), "How the decision reaches the flash LED".

**Interim, marked `TODO(flash-mode-op)` in `useCapturePicture.ts`:** when a flash is chosen and
the device's last verdict is not already dark, the screen writes op25 = 1 before the capture.
The capture's wake arms the flash, the picture is lit, and the check afterwards puts the real
verdict back, so nothing leaks into motion-detection lighting. Only this screen does it. It goes
when the firmware's flash-mode parameter (Charles's `flash_led_modes_proposal.md` on `ae_review`)
lands; that parameter's index has to be agreed first, because the app already uses 32 and 33.

## Changing camera

`AI switchslot` flips the boot slot and the device resets on its way into its next sleep. The app
sends nothing until the Sleep signal arrives (budget 30 s, enough for a stale timer), then waits
for the Wake the reboot sends (15 s), then asks `slots` once. Polling before the sleep only
postpones the reset, because every command restarts the inactivity timer. About 9 s end to end.

If no Sleep comes at all, the device is usually stuck awake by a firmware race (an inactivity
event landing while the IF task is transmitting a reply); the polls then report `Active slot 0
running 'RP3'`, selector switched but the image not, and the only way out is a power cycle. Seen
once on 3 September 2026; see the thread's open items.

## The step list

Four steps, ticked on the device's own lines: flash settings, taking the picture, light check
(with the verdict), transferring (with size and seconds left, at the nominal 1.1 KB/s until 2 KB
have arrived and at the measured rate after). The app's own stage text sits underneath for the
waits the device is silent through. No new command is sent for any of it.

## Leaving the screen

Back stops the run at its next step: after the op read, after the wait for sleep, and before
`txfile`. Nothing is sent for a screen nobody is looking at, and the hold is released as before.
A transfer already streaming runs to its end, because the only way to stop it would be to send a
command, and a command sent into the stream is exactly what must not happen: the nRF forwards it
to the Himax at once, restarts its binary packet counter, and answers it only after the file has
finished. So the transport holds every command from `N bytes in` to the reassembler's finish
(`bleTransport.isStreaming`; a stream that goes quiet releases the queue after 10 s). A picture
from a transfer this screen did not start stays in the cache and is not shown.

Found on the bench on 3 September 2026: Back pressed while the flow was waiting for sleep, the
capture and its `txfile` went out 4 and 8 s later, a re-entry's `slots` landed mid-stream and was
answered 14 s late with `AI processor not responding` on the way, the reassembler counted 412
phantom gaps from two counter restarts, and the picture appeared on the new visit.

## Known limits

- Screen entry used to send four `AI getop -1` within a second, one per hook. The op cache now
  shares a fetch in flight (`opCache.fetchOnce`), so entry sends one; the hooks still each ask.
- Progress and time-remaining are computed three ways across the screens that capture
  (`captureProgress`, the Light Sensor screen's own estimate, `captureSteps`). `captureSteps` is
  the one with tests and should absorb the others.
- A transfer can end three ways (the reassembler's 3 s watchdog, the 30 s inactivity timer, the
  grace after `Finished sending`), spread over an EventEmitter3 the codebase guide already calls
  legacy.
