# Each motion-test frame is a full capture with about 300 bytes of telemetry; a grid-only mode would make sub-second intervals real

#### File: explanation.md
#### Author: Claude (Fable 5.1), with Victor Anton
#### 4 September 2026

Labels: `review-finding`, firmware, enhancement.

## 1. What is the problem

The motion test wants one thing per frame: the HM0360's 32 motion-output registers. What it
gets per frame is a main-camera capture (2304 by 1296 on RP3), NN inference when a model is
loaded, the AE register read, the light-check sampling when op26 or the AE flash is on, and
then two messages to the app: "HM0360 AE regs" (118 bytes) and "HM0360 motion in N blocks"
with the hex bytes (124 bytes), plus `NN+`/`NN-` and the AE light-check line. On the bench this
morning a two-frame capture took about 1.1 s end to end, and the nRF forwards console output at
roughly 1 KB/s (ww-hardware #34), so the telemetry alone is about a third of a second per
frame. The app's UI offers intervals down to 0.3 s and warns that the grid "refreshes up to
10 fps for stability"; the firmware cannot deliver frames at that rate, so the interval field
promises more than the device does.

The grid is 32 bytes. Everything else is carried because the test rides on the capture path
with one test bit (skip file creation) rather than having a path of its own.

## 2. How to reproduce

1. Motion test, 20 frames at 0.3 s, bench logger running.
2. Time the "HM0360 motion in" lines on the Himax console: the spacing is the capture and
   telemetry time, not 0.3 s.

## 3. Where in the code

Seeed_Grove_Vision_AI_Module_V2, `dev` da79fcb9:

- `image_task.c:840-945`: the post-capture telemetry block: AE regs, light check, camera
  switch check, the ROI read and the two `sendMsgToMaster` calls.
- `image_task.c:968-985`: `TEST_BIT_SKIP_FILE_CREATION` only skips the file write.
- `fatfs_task.h:107-113`: the test bits.

App: `useMotionDetectionStream.ts:157-227` parses the two lines; `MotionDetectionSection.tsx`
lines 13-15 allow 0.3 s.

## 4. Suggested fix

A test bit (or a `md stream <N> <interval>` command) that reads the ROI registers on a timer
without a main-camera capture and sends one compact line per sample, for example
`MD <n> <32 hex bytes>`, and nothing else. That is what the standalone preview needs; the
deployment card can keep the capture-based run because it also proves the capture path. The
app then drops the AE-regs parsing for this mode and can honour the interval it advertises.

## Evidence

| What | Where |
|---|---|
| Per-frame telemetry during a real capture | [`flow_bench.txt`](https://github.com/wildlifeai/ww-mobile-app/blob/e3b989e9a937f44c5034ffde8d03d69276a80c84/documentation/development%20reports/2026-09-04_person-detection-first-deployment/flow_bench.txt), `[02:48.606` to `[02:50.350` |
