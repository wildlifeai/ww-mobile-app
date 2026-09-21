# HM0360 motion detection can stick, and only unplugging the device recovered it

1. Filename: `README.md`
2. Author: Claude Opus 5, with Victor Anton on the bench
3. Date: 21 September 2026

## Status

Closed. Root cause identified and recovery confirmed on the bench.

## Outcome

The WW500's motion detection stopped firing part way through a bench session and stayed
dead for roughly ninety minutes, across **six deployments, two versions of the app, an SD
card wipe, a firmware reboot and a user power cycle**. It recovered the instant the USB
cable was unplugged and replugged.

So: the HM0360 can enter a state where it no longer raises its motion interrupt, and that
state survives everything short of physically unplugging the device.

**What recovered it is established. Why, is not.** The recovery followed the USB cable
being unplugged and replugged, immediately and unambiguously. What we cannot say from this
session is the mechanism, because the one reboot the device had already taken during the
fault did not help, and the device's boot counters are not usable as evidence here: the
app's `resetToDefaults` rewrites them at the start of every deployment, so they reset
several times during the session rather than counting boots.

The most likely explanation is that removing the USB removes power from a rail that a
power cycle at the device did not, but that is a hypothesis, not a finding. It is worth
confirming deliberately, because the recovery procedure depends on it.

This matters in the field because a camera in this state looks completely healthy. It
answers BLE, passes its self test with `Error bits = 0x0000`, accepts and correctly applies
every op parameter, reports `HM0360 Motion Detection on!` on every sleep, and records
nothing at all.

## What happened

All times are `MM:SS` from the start of each bench capture, not wall clock.

| When | Event |
|---|---|
| Legs 1 to 3 | Motion working normally. **11 interrupts, 11 captures** |
| `26:51` | Serial console goes silent mid session. USB connection was marginal |
| Legs 4 to 6 | Motion dead. Six deployments, zero interrupts |
| (mid session) | User power cycle at the device, USB left connected. **Still dead** |
| (mid session) | SD card removed, wiped, reinserted. **Still dead** |
| (mid session) | `AI inithm0360` sent. Firmware answers `Unrecognised`. **Still dead** |
| (mid session) | `AI setop 17 2`, raising sensitivity. **Still dead** |
| `48:44` | USB cable unplugged and replugged |
| `48:48` | `Wake (MD)`, `HM0360 motion in 13 blocks`, image written |

## Evidence

### The device was correctly configured throughout

A live `getop -1`, triggered from the app while the fault was present, matched the device's
own sleep broadcast exactly. Only the boot counter differed between reads:

```
op10 CAMERA_ENABLED   1
op11 MD_INTERVAL      1000    <- motion detection enabled
op17 MD_SENSITIVITY   1
op19 IMAGES_COUNT     0       <- nothing captured
```

and the firmware acted on it after every single wake, roughly forty times:

```
Preparing HM0360 for MD:   HM0360 Motion Detection on! 1000ms frame interval
   Interval of 1000ms gives sleep count = 0x8030
   Timelapse disabled.
>>> Entering DPD
```

The op tables during the failure were byte identical, from index 5 onward, to the tables
from the legs that worked an hour earlier. The sensor was armed. It simply never
interrupted.

### Why the boot counters cannot settle the mechanism

It is tempting to read `NUM_COLD_BOOTS` and `NUM_WARM_BOOTS` as proof of what kind of
reboot recovered the device. They do not support it, and the next person should not try:

```
leg 4, before the user power cycle:  cold=1  warm=72
just after the user power cycle:     cold=0  warm=9
just before the USB re-seat:         cold=0  warm=28
after the USB re-seat:               cold=1  warm=6
```

The counters reset repeatedly, in both directions, because `resetToDefaults` rewrites the
op table at the start of every deployment and the session contained six of them. They are
tracking the app's writes as much as the device's boots.

Note also that `### Warm Boot ###` appears on **every** wake from deep power down,
including a normal motion trigger, so its presence in a log says nothing about whether
power was removed. The banner from the USB re-seat is absent from the capture entirely,
because unplugging the cable drops the serial port.

The behavioural evidence stands on its own: six deployments and one in-session reboot did
not recover it, and unplugging the cable did, within four seconds.

### What a healthy trigger looks like

For comparison, from a working leg. The interrupt boots the Himax out of deep power down:

```
>>> Entering DPD at 2026:09:21 05:45:15
**** WW500 MD. (WW500_C02) Built: 05:31:26 Sep 15 2026 ****
Motion detected INT_INDIC = 0xc8
  MD sampling: 1000ms.
HM0360 motion in 32 blocks:
```

It fired 1.2 seconds after entering sleep. When it works, it is immediate.

## What was ruled out

Each of these was tested and eliminated, and each is recorded because the next person will
suspect them too.

- **App code.** The session included a change to the deployment's op reads. The change was
  reverted and the fault persisted on unmodified code, then the fault also persisted after
  the change was restored. See the timeline in the commit for
  [#322](https://github.com/wildlifeai/ww-mobile-app/pull/322).
- **Op parameters.** Verified twice by independent means, the device's sleep broadcast and a
  real `getop -1`.
- **Motion sensitivity.** Raised to 2 by hand with no effect. After recovery the sensor
  fired at `op17 = 1`, the app's hardcoded value, so sensitivity was never involved.
- **SD card.** Removed, wiped, reinserted. No change.
- **Deployment ID.** Present and correct in the deployments that failed.
- **Ambient light.** Plausible early on and worth testing, since the HM0360 scans on ambient
  light only and the IR LED is disabled entering sleep. It was not the cause here. It
  remains a real design question, see Open items.

## Related observations

**`inithm0360` is not implemented.** The app offers it and the firmware rejects it:

```
MKL62BA command received: 'inithm0360'
Unrecognised
```

It is not harmless. The command wakes the AI processor out of deep power down and forces a
reboot before being rejected. A working version of this command is exactly the tool this
fault needed, something that reinitialises the sensor without pulling power.

**The IR LED does not illuminate for motion detection.** The firmware selects the LED and
then disables it on the way into sleep:

```
DEBUG: ledFlashSelectLED(2)
DEBUG: ledFlashDisable()
>>> Entering DPD
```

The CPU is powered down during motion detection, so it cannot drive the LED. The LED fires
at capture only. This is correct for battery life, but it means motion detection cannot
self start in a dark scene when IR is the only illumination, which is the question Charles
Palmer raised on 9 September 2026.

## Open items

- [#300](https://github.com/wildlifeai/ww-mobile-app/issues/300) Review and update the list
  of Engineer Console commands. `inithm0360` is a concrete case: offered, unimplemented,
  and it reboots the device before failing.
- [#316](https://github.com/wildlifeai/ww-mobile-app/issues/316) The project's motion
  sensitivity never reaches the device, `op17` is hardcoded to 1. Confirmed in source during
  this session. Not the cause of this fault, but still wrong.
- [#315](https://github.com/wildlifeai/ww-mobile-app/issues/315) Deployment GPS write is
  silently discarded. Reproduced again during this session, addendum added to the issue.
- [#324](https://github.com/wildlifeai/ww-mobile-app/issues/324) The HM0360 can stop raising
  its motion interrupt while reporting itself healthy. This finding.

## Recommendation

Two things would have turned ninety minutes into two.

1. **Give the firmware a real sensor reinitialise command**, and make the Engineer Console
   offer only commands the connected firmware actually has.
2. **Make a stuck sensor visible.** The device reports `Error bits = 0x0000` and
   `HM0360 Motion Detection on!` while detecting nothing. A motion detection heartbeat, or
   a self test bit that checks the interrupt line, would let the app say "armed but never
   triggered" instead of looking perfectly healthy.

For operators in the meantime: **if a camera stops detecting motion, disconnect it
completely, including any USB cable, before concluding anything is wrong with it.** In this
session a reboot at the device was not enough, and the camera reported itself healthy
throughout.

Worth confirming deliberately on a future bench session, since the recovery procedure
depends on it: whether a battery-only power cycle with no USB attached recovers a stuck
sensor, or whether the USB connection itself is implicated.
