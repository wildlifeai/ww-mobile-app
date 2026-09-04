# The motion test cannot set the HM0360's sample rate: it inherits op11 from the device's last sleep, and with motion detection off that is one frame every two seconds

#### File: explanation.md
#### Author: Claude (Fable 5.1), with Victor Anton at the bench
#### 4 September 2026

Labels: `review-finding`, app, firmware.

## 1. What is the problem

The grid the test shows is the HM0360's motion-output registers, read once per test frame.
How often those registers change is the HM0360's own frame period, and that is programmed
when the Himax goes to sleep, in `hm0360_md_prepare()`, from op11: `sleepCount = op11 ms *
0x8030 / 1000`, capped at 0xffff. When op11 is 0 ("MD off", which is what Stop Monitoring
and the factory reset leave) the firmware still runs the sensor, at the slowest rate, a frame
about every two seconds, with the interrupt disabled. Nothing in the awake path re-arms it,
and the test does not touch op11.

So the test's time resolution is whatever the device last slept with, not the interval the
user typed:

- Run 2 (op11 = 0, 1 s test): frames 1 to 6 read 0 blocks, then 44, 44, 39, 20. The pair of
  44s is one HM0360 result read twice, and the wave landed three frames after it was made.
- Run 5 (op11 = 300, 0.3 s test): the sensor ran at the test rate. It read 0 blocks
  throughout because of the timing problem in finding F, but 7 s after the run a motion wake
  fired with 46 blocks, so the detector was live at that rate.

The deployment card is worse off: Start Monitoring runs its test before `configureDevice`
sets op11, so on a freshly connected device the card always tests against a two-second
detector, and the test the operator is shown does not exercise the interval the deployment
will use.

## 2. How to reproduce

1. Console `AI setop 11 0`, let the device sleep. Motion test at 1 s with a hand wave: the
   counts repeat in pairs and lag by seconds.
2. Console `AI setop 11 1000`, let the device sleep. Same test: counts change every frame.
   (Run 4 intended this; the app backlog in finding F defeated the wave timing, so the pair
   is not yet a clean comparison. Worth one more run on a release build.)

## 3. Where in the code

Seeed_Grove_Vision_AI_Module_V2, `dev` da79fcb9, `EPII_CM55M_APP_S/app/ww_projects/ww500_md/`:

- `hm0360_md.c:94-107` (`calculateSleepTime`) and `:757-795` (`hm0360_md_prepare`, called
  from `image_task.c:2620` on the way to sleep).
- `hm0360_md.c:270-285`: `sleepTime == 0` means 0xffff and "Inhibiting MD".
- `image_task.c:776-800`: the wake path only clears the interrupt.

App:

- The test never writes op11: [`useMotionDetectionStream.ts:309-356`](../../../../src/screens/Devices/hooks/useMotionDetectionStream.ts#L309-L356).
- The deployment card runs before op11 is configured:
  [`DeploymentMotionDetectionSection.tsx:61-76`](../../../../src/screens/Deployments/components/DeploymentMotionDetectionSection.tsx#L61-L76)
  versus `useDeploymentConfiguration.ts:105`.

## 4. Suggested fix

App, now: before the test, write op11 = the test interval (the sleep the setup already
causes then arms the sensor at that rate), and restore it afterwards through the same hold
mechanism as op8 (finding D). The deployment card should use the project's interval, which
is what the deployment will run.

Firmware, better: arm the HM0360 at the test interval when a capture sequence starts with the
skip-file test bit, or as part of the grid-only mode in finding C, so the test does not depend
on the previous sleep at all.

## Evidence

| What | Where |
|---|---|
| Sleep entries with `sleepTime=0 sleepCount = 0xffff` before runs 2 and 3 | [`md_preview_bench.txt`](../md_preview_bench.txt), `[00:48`, `[01:52`, `[08:15` |
| Run 2 counts 0 x6, 44, 44, 39, 20 | same file, `[01:54` to `[02:04` |
| Run 5 at op11 = 300 and the 46-block wake after it | same file, `[10:23` to `[10:40` |
