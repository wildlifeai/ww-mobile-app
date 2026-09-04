# The Start Monitoring light check issues a capture the sensor refuses, and only a chance motion wake completes the step

#### File: explanation.md
#### Author: Claude (Fable 5.1), with Victor Anton at the bench
#### 4 September 2026

Labels: `review-finding`, app, firmware.

## 1. What is the problem

After configuring the device, Start Monitoring sends `AI capture 1 500` to refresh the
light decision (op25) and then reads it back to print "starting in day mode". On this run the
step took 19 s, and it did not complete the way the code expects.

The Himax accepted the command, but the IMX708 refused the stream-on register write three
times:

```
[02:31.801] himax | About to capture 1 image with an interval of '500' milliseconds
[02:31.801] himax |     retry=0, (regAddr=0x0100, val=0x01) Fail (-60)
[02:31.801] himax |     retry=1, (regAddr=0x0100, val=0x01) Fail (-60)
[02:31.801] himax |     retry=2, (regAddr=0x0100, val=0x01) Fail (-60)
[02:31.801] himax | IMAGE Task state changed from 'Init' (1) to 'Capturing' (2)
[02:32.720] himax | Inactive for 1000ms
[02:33.945] himax | IF task ready to sleep.
[02:33.945] himax | >>> Entering DPD at 2026:09:04 00:22:46
```

No frame arrived, the image task sat in Capturing, the inactivity detector counted the idle
time, and the device went to DPD with motion detection now armed (op11 had just been set to
1000). What ended the wait was the HM0360: it tripped at `[02:47.731]`, the wake captured
two frames, ran the AE light check and sent "Captured 2 images". The app's `getop -1` after
that read a fresh op25 and printed "Light check: BRIGHT". On a still scene the capture command
would have run to its timeout and the app would have fallen back to the pre-flight snapshot.

The sleep-while-capturing part is the mechanism already filed as Seeed #208 (the detector
measures idle time and a capture waiting for a frame is idle). What is new here is that the
capture never started because the sensor rejected the I2C write, on the RP3 build, a few
hundred milliseconds after `setop 5 2` was saved.

## 2. How to reproduce

1. Blank card, project with activity detection, Start Monitoring with the bench logger
   running.
2. Watch the Himax console after `AI capture 1 500`: the three `Fail (-60)` lines, then DPD
   about two seconds later.
3. Keep the scene still. The app's "Checking light conditions" step waits on the capture
   timeout, then reports the last known reading.

Seen once, on 4 September at 12:22. It has not been reproduced on demand yet; the I2C
failure needs a second run before it is filed as a firmware issue in its own right.

## 3. Where in the code

- The light check step, capture plus two `getop -1` reads:
  [`useStartDeployment.ts:610-669`](../../../../src/screens/Deployments/hooks/useStartDeployment.ts#L610-L669),
  the capture at line 629, the fallback to the pre-flight snapshot at lines 641-647.
- The step's stated purpose is a progress-dialog message; the firmware already runs the AE
  light check on every capture and on the op24 timer, and op26 = 1 (set by the factory-default
  diff on connect) switches camera at the next sleep regardless.
- Firmware side: Capturing state and the inactivity path,
  `image_task.c` in Seeed_Grove_Vision_AI_Module_V2 (`ae_review` e8b7feb5), see Seeed #208.

## 4. Suggested fix

Drop the capture from the app step and print the decision from the pre-flight `getop -1`
snapshot, which the code already holds and already uses as its fallback. That removes a
capture, two wakes and up to 8 s of timeout from every deployment start, and it removes the
one command in the pipeline that leaves a photo pair on the card before monitoring begins.

If a reference photo at deployment start is wanted, make it an explicit option, and send it
before `setop 11` arms motion detection so the two cannot race.

The I2C -60 on stream-on stays open as a firmware question: reproduce, then file against the
IMX708 driver with the console lines.

## Evidence

| What | Where |
|---|---|
| Capture refused, DPD, motion wake, app reads op25 | [`flow_bench.txt`](../flow_bench.txt), `[02:31` to `[02:51` |
