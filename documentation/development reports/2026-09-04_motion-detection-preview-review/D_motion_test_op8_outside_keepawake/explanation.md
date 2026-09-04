# The motion test raises op8 outside `keepAwake`, so a dropped link leaves the device awake in the field

#### File: explanation.md
#### Author: Claude (Fable 5.1), with Victor Anton
#### 4 September 2026

Labels: `review-finding`, app, bug.

## 1. What is the problem

To keep the device from sleeping between test frames, `startTest` raises op8
(INTERVAL_BEFORE_DPD) to interval + 2 s and remembers the original in a React ref. It is
written back in two places: when "Captured N images" arrives, and in `stopTest`. Neither runs
if the BLE link drops during the test, the app is killed, or the screen unmounts mid-run, and
the ref is gone with the component. op8 is written to CONFIG.TXT, so a device left at 3 s, or
22 s for a 20 s interval, stays awake that long after every motion capture in the field, which
is battery.

The app already has the module built for exactly this, `ble/session/keepAwake.ts`: it holds
the original in memory and on disk and writes it back on the next connection. Its own
comment says the motion stream "raises op8 the same way for its test window but keeps the
original in a ref, so a drop there leaves the device raised. It predates this module."

The cleanup also writes `setop 18 0` and op8 as two commands after the device has started its
sleep, which wakes it once more; and on the deployment card the reset at Start Monitoring
(#270) now bounds the leak, but the Engineer Console path has no such backstop.

## 2. How to reproduce

1. Engineer Console, Motion Detection, 20 frames at 5 s (op8 goes to 7000), Start Test.
2. Walk out of BLE range during the run, or kill the app.
3. Reconnect later and `AI getop 8`: 7000. It stays until a deployment starts or someone
   writes it.

## 3. Where in the code

- Raise: [`useMotionDetectionStream.ts:347-356`](../../../../src/screens/Devices/hooks/useMotionDetectionStream.ts#L347-L356)
- Write-back on completion: [`:121-136`](../../../../src/screens/Devices/hooks/useMotionDetectionStream.ts#L121-L136);
  on stop: [`:474-488`](../../../../src/screens/Devices/hooks/useMotionDetectionStream.ts#L474-L488)
- The module to use: [`keepAwake.ts:79-81`](../../../../src/ble/session/keepAwake.ts#L79-L81)
  (the note), `acquire`/`release`/`restorePending`.

## 4. Suggested fix

Replace the ref with `keepAwake.acquire(session, deviceId, interval + 2000)` before the
capture and `keepAwake.release` in both exit paths; call `keepAwake.restorePending` when
the test screen opens, so a value owed from a drop is put back before the next run. `acquire`
already skips the write when the device sleeps later than the hold asks, which the current
code also does.

## Evidence

| What | Where |
|---|---|
| The two write-back paths and the ref | code references above |
