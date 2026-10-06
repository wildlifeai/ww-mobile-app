# Device Check

The ship check for a finished WW500 in its case, run from the phone: Engineer Console, Flows,
**Tests**, `DEVICE_CHECK`. It takes about five minutes and ends with *Ready to ship*, *Ready to
ship, with warnings* or *Not ready to ship*, and one line per step saying why.

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
| Cameras connected | `AI slots`, `AI reset`, then the self-test the restarted AI processor reports | Any camera bit (8, the running image's camera; 9, the HM0360) or any other error bit. The photo steps are then skipped | Any warning bit; or the restart was not seen, so the reading is the last wake's |
| Firmware and camera images | `ver`, `AI ver`, `AI slots`, `AI getop -1` | Both slots hold the same image | A slot is unlabelled, or automatic camera switching (op26) is on |
| Colour camera and focus lens | `AI vcm 512`, 3 warm-up photos, then `AI vcm` + `AI capture 1 500` at 256 to 1023 and back, `AI dir`, `AI txfile` of the sharpest | See the lens rules below; the sharpest photo is under 3000 bytes | |
| Battery and temperature | `battery`, `temp` | BLE chip outside -20 to 70 °C | Battery is shown, not judged |
| Clocks | `setutc`, `getutc`, `AI setutc`, `AI getutc` | Either clock reads back more than 5 s off the time it was given. A lost `AI setutc` reply is not a failure: setting the RTC holds the AI processor's interrupts off for about a second, and on the bench the reply was lost while the clock did change | |
| SD card | `AI info` | No answer, or no card size | |
| LEDs | `flashr`/`flashg`/`flashb 3 200`, `AI flash 50 500` | The operator did not see the small LED's three colours, or the white LED | |
| Light sensor | `AI light`, then the AE register block | No block within 15 s | |
| Motion detection | op18 bit 3, op11 at 500 ms, a sleep, `AI capture 10 500` (sent up to 4 times until the camera answers `About to capture 10 images`); the operator waves | No frame reports a motion block | |
| Black & white camera | 2 warm-up photos, one photo with its AE register block, `AI txfile` (its `N bytes in FILE` reply gives the size) | The new image's boot self-test reports a camera fault; the photo is under 3000 bytes, or its mean brightness is outside 8 to 248 | |
| IR flash | op13 = 2, op9 = 100, op34 = 2, a sleep, one photo, `AI txfile` | The operator says the IR photo is no brighter than the plain one | |
| Both cameras see the card | Nothing: the operator compares the colour and black & white photos | The operator says they differ | |

Each step reports and the check carries on, so one run lists every fault on the unit. Three
exceptions: a camera fault in the first step skips every step that takes a photo, since each
would only time out; the IR step is skipped when the black and white photo failed; and the last
step is skipped when either photo is missing.

### Why the first step restarts the camera

The camera bits are only trustworthy from a cold boot. On 5 September 2026 a board with no
HM0360 reported it on the first wake and clean on every wake after, and on 6 October a colour
camera whose lens driver did not answer (`VCM write failed (-60)`) still read 0x0000 on a warm
wake. `AI reset` restarts the AI processor at its next sleep without dropping Bluetooth, and the
self-test it reports as it boots is the reading the step judges. Each camera switch later is also a
boot, and its self-test is judged the same way, which is where the colour image's camera is
checked when the unit started on the black and white one.

The restart rewinds the AI processor's clock to 2024, and the BLE processor only passes the time
on every 15 minutes (`SENDUTCINTERVAL` in ww-hardware), so the clock step sets the AI processor's
clock itself. Without that the unit would leave with photos stamped 2024.

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
- **The IR flash, framing and the LEDs are the operator's eye.** `AE Mean` cannot judge the IR
  flash: on the bench the IR photo read 72 against 78 without, because the sensor's auto
  exposure had already lowered its gain, while the same frame reported motion in 29 blocks,
  the flash lighting the scene (6 October 2026). The IR photo is downloaded and shown under
  the plain one.

## What it changes, and puts back

| Setting | During the check | Put back |
|---------|------------------|----------|
| op8, the sleep timer | Exactly 3 s for the whole check: long enough that each `AI vcm` is followed by its photo before the lens position is lost, short enough that the check's waits for a sleep do not time out. A unit left at 60 s is brought down too, and its first sleep still takes the old time | Through `keepAwake`, which also restores it on the next visit if the link drops |
| op34, the flash mode | Off for the camera steps, always on for the IR photo | Through `flashHold`, the same way |
| op11, the motion rate | 500 ms for the motion step | Through `mdIntervalHold`, the same way |
| op18, test bits | Bit 3 (no files) for the motion step | Cleared after it |
| op13 and op9, the flash LED and brightness | IR at 100% for the IR photo | Written back after it |
| The running camera | Colour for the lens, black and white for the IR | The image that was running at the start |
| op10, camera enabled, and op18 | Set to 1 and cleared at the start if they were not, as Capture Picture does | Not put back |

op18, op13 and op9 are written back by the check itself, so a link dropped during the motion or
IR step leaves them changed. A deployment resets every op, so a unit is safe once deployed; to
put them right before that, run Reset to Defaults.

The check leaves about 20 photos on the SD card. Run `format` from the console before shipping
if the unit should leave with an empty card.

## Open

- The motion step asks the operator to wave only once the camera says `About to capture 10
  images`: with the detector armed through the setup sleep, a hand in front of the camera wakes
  it first (`Wake (MD)`), and a burst sent into that wake went unanswered for 45 s on the bench
  until the step learned to send it again.
- On the first bench run (6 October 2026) op18, op11 and op12, written back shortly before a
  camera switch that timed out, came back from the card at their earlier values after the
  reboot. Not yet explained; check the op table after a run that failed a switch.
