# Device Check

The ship check for a finished WW500 in its case, run from the phone: Engineer Console, Flows,
**Tests**, `DEVICE_CHECK`. The screen shows a start button, then each step full screen while it
runs (*Step 3 of 13*, what it is doing, and any question with the photos it is about), then
every step's result. It takes about five minutes and ends with *Ready to ship*, *Ready to ship,
with warnings* or *Not ready to ship*, and one line per step saying why.

It needs no firmware change and no USB. The PCB line's check, `_Tools/ww500_ship_check.py` in
the firmware repo, tests bare boards over USB; this one tests the assembled unit over
Bluetooth, using the same photo limits.

Code: [`ble/workflows/deviceCheck.ts`](../../src/ble/workflows/deviceCheck.ts) runs the steps,
[`utils/deviceCheck/`](../../src/utils/deviceCheck/) holds the rules,
`screens/Devices/DeviceCheckScreen.tsx` shows them.

## Setting up

- **A test card in a fixed jig.** Anything with fine detail (printed text, a fine pattern), in
  front of both cameras, at the same distance every time. The lens rule compares against a
  reference unit in the same jig, so a different card or distance needs a new reference.
- **A lens reference, once per phone.** Run the check on a known good unit, then tap *Use this
  unit as the lens reference*. The phone keeps that unit's sharpest lens position (AsyncStorage
  `deviceCheck:reference`) and holds every later unit to it. Without one, the lens step can
  only say the lens moves and is not stuck at an end.
- **Both camera images on the unit**, the colour (RP3) and the black and white (HM0360). The
  check switches between them and back.

## The steps

| Step | What it sends | Fails when | Warns when |
|------|---------------|------------|------------|
| Cameras connected | `AI slots`, `AI reset` and `AI dpd`, then the self-test the restarted AI processor reports | Any camera bit (8, the running image's camera; 9, the HM0360) or any other error bit. The photo steps are then skipped | Any warning bit; or the restart was not seen, so the reading is the last wake's |
| Firmware and camera images | `ver`, `AI ver`, `AI slots`, `AI getop -1` | Both slots hold the same image | A slot is unlabelled; a setting could not be reset to its default at the start; or automatic camera switching (op26) is on |
| Colour camera and focus lens | `AI vcm 512`, 3 warm-up photos, then `AI vcm` + `AI capture 1 500` at 256 to 1023 and back, `AI dir`, `AI txfile` of the sharpest | See the lens rules below; the sharpest photo is under 3000 bytes | |
| White flash | op13 = 1, op9 = 100, op34 = 2, a sleep, `AI vcm` at the sharpest position, 3 warm-up photos and one photo, all lit, `AI txfile` | The photo is under 3000 bytes; the operator says it is no brighter than the plain colour one | |
| Battery and temperature | `battery`, `temp` | BLE chip outside -20 to 70 °C | Battery is shown, not judged |
| Clocks | `setutc`, `getutc`, `AI setutc`, `AI getutc` | The BLE clock reads back more than 5 s off the time it was given, or the AI processor's more than 5 minutes off, meaning it did not take the time. A lost `AI setutc` reply is not a failure: setting the RTC holds the AI processor's interrupts off for about a second, and on the bench the reply was lost while the clock did change | The AI processor's clock reads back more than 5 s but less than 5 minutes off: it stops while the camera sleeps (see below) |
| SD card | `AI info` | No answer, or no card size | |
| LEDs | `flashr`/`flashg`/`flashb 3 200`, then `flashb 1 65535` to leave the blue LED on as the connection light (65535 is the firmware's "on until told otherwise"), `AI flash 50 500`, then op12 written back (`AI flash` saves its length there) | The operator did not see the small LED's three colours, or the white LED | |
| Light sensor | `AI light` (sent once more after a timeout: one sent as the processor fell asleep was lost, 7 October 2026), then the AE register block | No block within 40 s | |
| Motion detection | op18 bit 3, op11 at 500 ms, a sleep, `AI capture 10 500` (sent up to 4 times until the camera answers `About to capture 10 images`); then the operator waves and taps *I'm waving* within 5 s, and when the burst ends the screen says *The Watcher says hi back! You can stop waving now.* (OK dismisses it; the check carries on without waiting) | No frame reports a motion block. Without a tap the step is not judged and reads *Not checked*, so the check is not finished | |
| Black & white camera | 2 warm-up photos, one photo with its AE register block, `AI txfile` (its `N bytes in FILE` reply gives the size) | The new image's boot self-test reports a camera fault; the photo is under 3000 bytes, or its mean brightness is outside 8 to 248 | |
| IR flash | op13 = 2, op9 = 100, op34 = 2, a sleep, one photo, `AI txfile` | The operator says the IR photo is no brighter than the plain one | |
| Both cameras see the card | Nothing: the operator compares the colour and black & white photos | The operator says they differ | |

Each step reports and the check carries on, so one run lists every fault on the unit. The
exceptions: a camera fault in the first step skips every step that takes a photo, since each
would only time out; each flash step is skipped when its camera's plain photo is missing; and
the last step is skipped when either plain photo is missing.

### Why the first step restarts the camera

The camera bits are only trustworthy from a cold boot. On 5 September 2026 a board with no
HM0360 reported it on the first wake and clean on every wake after, and on 6 October a colour
camera whose lens driver did not answer (`VCM write failed (-60)`) still read 0x0000 on a warm
wake. `AI reset` restarts the AI processor at its next sleep without dropping Bluetooth, `AI dpd`
sends it to that sleep at once (a unit whose sleep timer was 60 s took a minute to restart
without it and 5 s with it, 7 October 2026), and the
self-test it reports as it boots is the reading the step judges. Each camera switch later is also a
boot, and its self-test is judged the same way, which is where the colour image's camera is
checked when the unit started on the black and white one.

The restart sets the AI processor's clock to 2024, a known wrong date chosen on purpose ([Seeed #152](https://github.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/issues/152)),
and the BLE processor does not put it right straight away ([Seeed #56](https://github.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/issues/56)), so the clock step sets
the AI processor's clock itself. Without that the unit would leave with photos stamped 2024.

The AI processor's clock also stops while the camera sleeps (Seeed #56), so it reads back a few
seconds behind whenever the camera slept between the set and the read: 5.6 s on WILD-5WGJ and
4.3 s on WILD-DJUU, 7 October 2026. That is the firmware's known limit, not the unit's fault, so
the step warns rather than fails. The BLE processor corrects the AI processor's clock only when it
is more than 5 minutes out, so photos can be stamped up to 5 minutes early until the firmware
change is made: getting the BLE processor to give it the time sooner is deferred to
[Seeed #251](https://github.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/issues/251).

### The lens rules

From [`lensSweep.ts`](../../src/utils/deviceCheck/lensSweep.ts), which carries the reasons:

- the largest photo is at least **1.2×** the smallest (the bench sweep gave 1.83×), else the lens
  is stuck or the card is missing;
- the sharpest photo is **not at 256 or 1023**, else the case may be pressing on the lens;
- going up and coming down agree within **15%** on average and their peaks within **128** steps,
  else the lens is catching or something moved;
- the peak is within **128** steps of the reference unit's.

### Where the photo sizes come from

`AI dir` lists the firmware's current folder, not the photo folder. Writing a photo moves it into
the photo folder (`/MEDIA/<deployment>/IMAGES.NNN`, a new one every 100 photos), but saving
CONFIG.TXT after any op change moves it to MANIFEST, and `dir` then lists the models. So the
sweep reads `AI dir` straight after its last photo, with no op change between, and fails with
"listed another folder" if its photos are not there. The single photos take their size from the
`txfile` reply instead, since `txfile` changes into the photo folder itself (bench, 6 October
2026: the IR step's listing came back as MANIFEST and the photo read as 0 bytes).

### Why the numbers come from the camera, not the photo

The app has no JPEG decoder, so it judges what the camera reports:

- **Sharpness is the JPEG's size.** A sharper photo holds more detail and compresses less. On
  the bench (6 October 2026, WILD-5WGJ) the file size peaked where a Laplacian sharpness score of
  the same photos peaked, correlation 0.92. It also keeps the sweep's 13 photos off Bluetooth,
  which carries about 1.1 KB/s: only the sharpest is downloaded.
- **Brightness is the HM0360's `AE Mean`**, from the register block it sends after every
  capture. Both camera images send the HM0360's block, so the colour photo is judged by size
  only.
- **Both flashes, framing and the LEDs are the operator's eye.** `AE Mean` cannot judge the IR
  flash: on the bench the IR photo read 72 against 78 without, because the sensor's auto
  exposure had already lowered its gain, while the same frame reported motion in 29 blocks,
  the flash lighting the scene (6 October 2026). Each flash photo is downloaded and shown beside
  its camera's plain one.

## What it changes, and what the unit is left with

The check starts by writing the factory defaults, as Reset to Defaults does, so no setting left
by a deployment or a bench session (a 60 s sleep timer, a flash mode, test bits, a disabled
camera) can change a step. It keeps what is not a setting: the AI model, the deployment ID and
GPS. What the steps change after that goes back to those defaults, so **the unit leaves on factory
defaults**, which is the state it ships in. If a default cannot be written, the firmware step
warns.

| Setting | During the check | Back to the default |
|---------|------------------|---------------------|
| op8, the sleep timer | Exactly 3 s for the whole check: long enough that each `AI vcm` is followed by its photo before the lens position is lost, short enough that the check's waits for a sleep do not time out. A unit left at 60 s would still take the old time for its first sleep, which `AI dpd` in the first step cuts short | Through `keepAwake`, which also restores it on the next visit if the link drops |
| op34, the flash mode | Off for the camera steps, always on for the two flash photos | Through `flashHold`, the same way |
| op11, the motion rate | 500 ms for the motion step | Through `mdIntervalHold`, the same way |
| op18, test bits | Bit 3 (no files) for the motion step | Cleared after it |
| op13 and op9, the flash LED and brightness | White at 100% for the white flash photo, IR at 100% for the IR one | Written back after each |
| op12, the flash length | 500 ms, which `AI flash` saves during the LED test | Written back after it |
| The running camera | Colour for the lens, black and white for the IR | The image that was running at the start, which is not a setting |

op18, op13, op12 and op9 are written back by the check itself, so a link dropped during the
LED, motion or flash steps leaves them changed. Running the check again, or Reset to Defaults,
puts them right; a deployment resets every op anyway.

The check leaves about 25 photos on the SD card. Run `format` from the console before shipping
if the unit should leave with an empty card.

## Open

- The clock step's warning for the AI processor's clock goes once the firmware corrects it
  sooner ([Seeed #251](https://github.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/issues/251)); then a lag of more than 5 s can fail the unit again.
- The motion step asks the operator to wave and tap only once the camera says `About to capture 10
  images`: with the detector armed through the setup sleep, a hand in front of the camera wakes
  it first (`Wake (MD)`, or `Wake (Motion)` from newer BLE firmware), and a burst sent into that wake went unanswered for 45 s on the bench
  until the step learned to send it again.
- On the first bench run (6 October 2026) op18, op11 and op12, written back shortly before a
  camera switch that timed out, came back from the card at their earlier values after the
  reboot. Not yet explained; check the op table after a run that failed a switch.
