# A capture sequence cannot be aborted, so the motion test's Stop only stops listening and its cleanup races the stream

#### File: explanation.md
#### Author: Claude (Fable 5.1), with Victor Anton
#### 4 September 2026

Labels: `review-finding`, firmware, enhancement.

## 1. What is the problem

`AI capture <N> <interval>` starts a sequence the image task runs to completion: up to 60
frames in the motion test, each a full capture with NN and telemetry. There is no command
that ends it early. The app's `stopTest()` therefore does the only thing it can, it stops
processing frames, and then writes `setop 18 0` and the original op8 into a device that is
still streaming two lines per frame. The hook's own comment says why that is risky: during a
sequence the nRF's BLE TX buffer is saturated with frame data and a command sent into that
flood risks a disconnect. The deployment card avoids the problem by not offering Stop at all
and telling the user the test "cannot be stopped early".

The same limitation shapes the test's design: the app pre-raises op8 to interval + 2 s and
retries the capture command four times, because the run must be launched exactly once and
then left alone.

## 2. How to reproduce

1. Engineer Console, Motion Detection, 60 frames at 1 s, Start Test, then Stop after a few
   frames.
2. The Himax console keeps printing frames for the remaining 50-odd seconds; the app's two
   `setop` writes land somewhere in that stream.

## 3. Where in the code

Seeed_Grove_Vision_AI_Module_V2, `dev` da79fcb9:

- `image_task.c:642`: `g_captures_to_take` set from the command; the Capturing, NN Processing
  and Wait For Timer states cycle until it is reached, with no event that clears it.
- `CLI-commands.c`: `capture` accepts a count and an interval only.

App: `useMotionDetectionStream.ts:450-489` (`stopTest`), and the risk note at `:455-460`.

## 4. Suggested fix

A `capture 0` (or `AI abort`) that sets the remaining count to zero and lets the current
frame finish, replied with "Capture aborted after N images", plus the existing "Captured N
images" line so the app's completion path stays the same. The app's Stop then sends it and
waits for "Captured" before its cleanup writes, instead of writing into the stream.

## Evidence

| What | Where |
|---|---|
| Sequence semantics and the risk note | code references above |
