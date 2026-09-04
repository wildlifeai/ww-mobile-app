# During a motion test the app falls a minute behind the device: "Captured" arrived 63 s after the nRF sent it, and the cleanup writes land long after the run

#### File: explanation.md
#### Author: Claude (Fable 5.1), with Victor Anton at the bench
#### 4 September 2026

Labels: `review-finding`, app, ble, measured on a dev build.

## 1. What is the problem

Every test frame sends the app three lines (`NN-`, "HM0360 AE regs", "HM0360 motion in N
blocks" with 32 hex bytes), about 250 bytes. The nRF forwards them promptly: on the bench each
motion line left the nRF within 0.3 s of the Himax printing it, and the whole session had one
failed send. The phone does not keep up. In the 0.3 s run (20 frames in 8 s) the nRF sent
"Captured 20 images" at `[10:31.8]`; the app logged it at `[11:35.2]`, 63 s later. In the 1 s
run that followed the lag was 48 s (`[17:24.5]` to `[18:12.8]`). The app's cleanup, `setop 18 0`
and the op8 restore, therefore went out a minute or more after the device had finished and
slept, each paying a wake, and in the last run the user started the next test while the
previous cleanup was still being written (`[18:25.4]` start, `[18:25.7]` the old `setop 8 1000`).

The backlog also slows the setup of the next run: in run 2 the five setup commands went out
0.6 s apart and the device stayed awake between them; in runs 3 and 4 they went out 3 s and
7 s apart, the device slept between each one, and the setup took 28 s instead of 4.5 s.

This was measured on a development build attached to Metro, which logs every received line
(`[useBleListeners] RAW_RX received ...`) to the packager over adb. That path is a known
throttle, so the number is not the product's number. It still shows that the stream is
processed line by line on the JS thread with per-line logging and regex work, and that
nothing in the app bounds the backlog: the "10 fps" note on the card describes the parser's
throttle, not what the phone keeps up with.

## 2. How to reproduce

1. Dev build with Metro attached, bench logger running.
2. Motion test, 20 frames at 0.3 s, then compare the nRF's "BLE out: Sent ... Captured" time
   with the app's `RAW_RX received ... Captured` time.
3. Repeat on a release or preview build to get the product number.

## 3. Where in the code

- Per-line logging of every received line:
  [`useBleListeners.tsx:125`](../../../../src/hooks/useBleListeners.tsx#L125).
- Line classification and emission: [`rxRouter.ts:155-195`](../../../../src/ble/protocol/rxRouter.ts#L155-L195),
  50 ms flush debounce at line 24.
- Per-line parsing in the stream hook:
  [`useMotionDetectionStream.ts:87-234`](../../../../src/screens/Devices/hooks/useMotionDetectionStream.ts#L87-L234).
- Cleanup writes after "Captured": lines 121-136.

## 4. Suggested fix

Measure first on a release build. Then: drop the per-line `RAW_RX` log in favour of a
ring buffer the console screen reads; have the stream hook parse only when a test is
active (it already checks `activeRef`, but the router and the listeners upstream do not);
and make the cleanup wait for the device to sleep, or send it as one command, rather than
two wakes a minute late. Finding C on the firmware side removes most of the bytes.

## Evidence

| What | Where |
|---|---|
| 0.3 s run: nRF sent "Captured" at 10:31.8, app received at 11:35.2 | [`md_preview_bench.txt`](../md_preview_bench.txt) |
| 1 s run: 17:24.5 sent, 18:12.8 received; next test started at 18:25.4 during the old cleanup | same file |
| Setup spacing, run 2 versus runs 3 and 4 | same file, `[01:48` to `[01:53`, `[08:03` to `[08:16`, `[16:44` to `[17:13` |
