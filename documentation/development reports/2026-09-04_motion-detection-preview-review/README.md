# Motion Detection Preview: how the flow works and what to change

#### File: README.md
#### Author: Claude (Fable 5.1), with Victor Anton at the bench
#### 4 September 2026

**Branch:** `docs/motion-detection-preview-review`
**Status:** Open. Code review plus one bench session on the RP3 slot; seven findings filed as issues. F was re-measured on 23 September 2026 and is resolved by #326; that session found H, on the nRF. The app-side changes (D, E, G) are the next step.

## Outcome

A read of the `MOTION_DETECTION_PREVIEW` flow from the Flows modal down to the HM0360
registers, followed by five runs on the bench with the three-way logger. Prompted by the
person-detection run earlier today
([2026-09-04_person-detection-first-deployment](https://github.com/wildlifeai/ww-mobile-app/blob/e3b989e9a937f44c5034ffde8d03d69276a80c84/documentation/development%20reports/2026-09-04_person-detection-first-deployment/README.md)),
whose log carries real motion grids from a deployment. Device: WW500 `WILD-CNKW`, Himax
`ae_review` e8b7feb5 on the RP3 (colour) slot, nRF 0.30.48, dev app with Metro attached.

**How it works.** The flow entry is a navigation to `StandaloneMotionDetectionScreen`, which
hosts the same `MotionDetectionSection` card as the Engineer Console, driven by
`useMotionDetectionStream`. Start Monitoring reuses the hook in a fixed-value card (20 frames,
1 s, the project's sensitivity). Start Test sends `AI getop -1`, `AI setop 18 8` (skip file
creation), optional flash ops, `setop 8` raised to interval + 2 s, `AI md <level>`, then
`AI capture <N> <interval>`. The firmware then owns the run: each frame is a main-camera
capture, NN inference if a model is loaded, one read of the HM0360's 32 motion-output
registers, and three lines to the app (`NN-`, "HM0360 AE regs", "HM0360 motion in N blocks"
plus 32 hex bytes). The app decodes the bytes into a 16 by 16 string, drops frame 1, throttles
repaints to ten a second, keeps a frame history, and on "Captured N images" writes
`setop 18 0` and puts op8 back.

**What the grid shows.** The HM0360's own frame-to-frame detector, sampled when each
main-camera frame is taken, at the sensor rate the device was put to sleep with (finding G).
It is not motion between test frames. The app's byte-to-cell mapping matches the firmware's
console grid (`hm0360_md_printGrid`) bit for bit.

**What the bench said.** The sensitivity command is refused on this build, every time
(finding A, now bench-verified). The detector's rate follows op11 from the last sleep, so a
device that has just been stopped or reset tests against a two-second detector (G). The dev
app fell 48 to 63 s behind the device during a run and wrote its cleanup a minute late (F).
Waving "during frames 3 to 6" is not something a person can do when the app is that far
behind, which is why runs 3, 4 and 5 read zero blocks and only the pairing in run 2 and the
post-run motion wakes prove the detector works. A release-build repeat is owed for F and G.

| | Finding | Repo | Type | Issue |
|---|---|---|---|---|
| [A](A_sensitivity_compiled_out_on_rp3/explanation.md) | MD sensitivity (op17, `AI md`) is compiled out of the RP3 build: Low, Med, High are the same thresholds on the colour camera | firmware | bug, bench-verified | [Seeed #211](https://github.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/issues/211) |
| [B](B_capture_sequence_cannot_be_aborted/explanation.md) | A capture sequence cannot be aborted, so "Stop" only stops listening and the cleanup races the stream | firmware | enhancement | [Seeed #212](https://github.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/issues/212) |
| [C](C_grid_only_streaming/explanation.md) | Each test frame is a full capture and about 250 bytes; a grid-only mode would make sub-second intervals real | firmware | enhancement | [Seeed #213](https://github.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/issues/213) |
| [D](D_motion_test_op8_outside_keepawake/explanation.md) | The test raises op8 outside `keepAwake`, so a dropped link leaves the device awake in the field | app | bug | [ww-mobile-app #271](https://github.com/wildlifeai/ww-mobile-app/issues/271) |
| [E](E_sensitivity_feedback_and_labels/explanation.md) | The app hides a refused `AI md`, maps the sensitivity row id straight to a level, and labels the grid as if it were the test's own motion | app | cleanup | [ww-mobile-app #272](https://github.com/wildlifeai/ww-mobile-app/issues/272) |
| [F](F_app_receive_backlog_during_stream/explanation.md) | The app falls a minute behind the device during a test and writes its cleanup late (dev build measurement) | app | bug, resolved by #326, [re-measured 23 September](#re-measured-23-september-2026) | [ww-mobile-app #273](https://github.com/wildlifeai/ww-mobile-app/issues/273) |
| [G](G_detector_rate_inherited_from_op11/explanation.md) | The test cannot set the detector's rate; it inherits op11 from the last sleep, two seconds after a stop or reset | app, firmware | bug | [ww-mobile-app #274](https://github.com/wildlifeai/ww-mobile-app/issues/274) |
| [H](#re-measured-23-september-2026) | `AI md` never answers over BLE: the nRF takes `MD sensitivity set to N` for the `MD <time>` motion wake and drops it, so every test waits 5 s | nRF | bug, bench-verified | [ww-hardware #52](https://github.com/wildlifeai/ww-hardware/issues/52) |

## The runs

Times are the logger's stamps in [md_preview_bench.txt](md_preview_bench.txt). Sensitivity
was refused in every run (`Unrecognised` at `[00:47`, `[01:51`, `[08:12`, `[10:19`, `[17:06`).

| Run | Settings | op11 at last sleep | Frames | Blocks per frame | Notes |
|---|---|---|---|---|---|
| 1 | `AI md 2` from the console | | | | "Unrecognised" on the Himax console, `[00:47.8` |
| 2 | Low, 1.0 s, 10 | 0 (detector every 2 s) | 10 in 10.4 s, 1.1 s apart | 0 x6, 44, 44, 39, 20 | Setup 4.5 s, device awake throughout. Wave registered three frames late, in pairs |
| 3 | High, 1.0 s, 10 | 0 | 10 in 10.3 s | all 0 | Setup 13 s, a DPD wake per command. "Captured" reached the app 11 s late |
| 4 | Low, 1.0 s, 10 | 1000 | 10 in 10.4 s | all 0 | Setup 28 s. "Captured" 48 s late. A 37 and 66-block motion wake fired before the run started |
| 5 | Low, 0.3 s, 20 | 300 | 20 in 8.2 s, 0.41 s apart | 0 x18, 1, 0 | nRF on time; "Captured" 63 s late in the app. A 46-block motion wake 7 s after the run |

Steps not run for lack of time: High at op11 = 1000, the stop-mid-run op8 check, and the HM0360
slot. They are listed in the findings as the bench checks still owed.

## Re-measured 23 September 2026

Two runs of the standalone test on the HM0360 slot, WILD-SIFK, nRF `WW500-C02 V 00.30.51`
built 18 September, Himax `dev` bcb45deb, model `1V1.TFL` loaded so inference ran on every
frame. Dev build with Metro attached, the same conditions as finding F, after
[#326](https://github.com/wildlifeai/ww-mobile-app/pull/326) capped the Engineer Console and
took the per-line render out of the receive path. Times are the logger's stamps in
[md_remeasure_bench.txt](md_remeasure_bench.txt), computed by [measure_md.py](measure_md.py).

| Run | Settings | Device | App behind the Himax, per motion line | "Captured" reached the app | App lines, median gap | Tap to done |
|---|---|---|---|---|---|---|
| 1 | Low, 1.0 s, 20 | 20 frames in 18.8 s, median 0.99 s apart | 0.07 to 0.58 s | 0.25 s after the Himax sent it | 183 in 19.4 s, 1 ms | 28.1 s |
| 2 | Low, 0.5 s, 20 | 20 frames in 9.4 s, median 0.51 s apart | 0.15 to 0.65 s | 0.5 s | 180 in 10.3 s, 2 ms | 20.1 s |

Finding F is resolved: the September figure was the console screen re-rendering its whole
history for every received line (a median 1.37 s per line in run 5, 1.82 s in run 4, measured
from the same log this time), and with that gone the phone keeps pace with the device at
0.5 s intervals. The cleanup writes now land 0.5 s and 0.8 s after "Captured", inside the 3 s
hold the test raised, so they cost no wake. The console held under 200 entries in both runs;
the 98 minute session at the 500 entry cap in the #326 bench notes covers the long-session
case.

Where the 28.1 s of run 1 goes: setup 7.4 s (`getop` 1.0 s, `setop 18` 0.4 s, `setop 8`
0.3 s, `AI md 1` 5.0 s, the capture's wake 0.6 s), capture 19.5 s, cleanup 1.1 s. The 5.0 s
is finding H. The Himax answered `MD sensitivity set to 1` within 0.2 s both times and the nRF
read it over I2C (`I2C RX payload 23/250 bytes`), then matched it against its prefix table of
Himax-originated messages, whose first entry `"MD "` is the motion-wake announcement
`MD <utc time>`; the reply was raised as `Wake (MD)`, which the PROCESSING state does not
handle, so the nRF logged `UNHANDLED event Wake (MD) in PROCESSING`, reset to SLEEP and never
forwarded it. The app waited its full 5 s timeout and logged "md command failed
(non-critical)". September did not see this because on the RP3 slot the command is refused
with `Unrecognised` (finding A), which does not start with `MD `. Filed as
[ww-hardware #52](https://github.com/wildlifeai/ww-hardware/issues/52) with the two fixes; the
app can also skip `AI md` when the op table it has just read already holds the level (#272).

## Open items

All seven filed on 4 September 2026, permalinked to 561da458: A, B, C in Seeed_Grove_Vision_AI_Module_V2, D to G in this repo. D, E and G
are the app-only changes and go first, on one branch.

## Files

| File | What |
|---|---|
| [md_preview_bench.txt](md_preview_bench.txt) | Three-way log of the session, filtered as in the person-detection thread (hex dumps, LED debug, nRF state chatter, AE register blocks, grid rows removed), then trimmed again on 19 September 2026 to 2,362 lines before merging. The second pass dropped plumbing and capped repeated lines at the first three and the last of each kind, keeping every app line and every string these findings quote. The 10,184 line version is commit [561da458](https://github.com/wildlifeai/ww-mobile-app/blob/561da458bccda3ff1bb0dc2489292a949470e438/documentation/development%20reports/2026-09-04_motion-detection-preview-review/md_preview_bench.txt) |
| [md_remeasure_bench.txt](md_remeasure_bench.txt) | Three-way log of the 23 September re-measurement, connect through the second run's cleanup, 1,893 lines after [filter_md_remeasure.py](filter_md_remeasure.py) dropped the same plumbing as above. Every app line kept |
| [measure_md.py](measure_md.py) | Times one test run from a three-way log: setup command spacing, each frame across the three legs, the "Captured" lag, the app's per-line gaps, the cleanup writes |
| [filter_md_remeasure.py](filter_md_remeasure.py) | The filter that produced md_remeasure_bench.txt from the raw capture |
| `<Letter>_*/explanation.md` | One per finding, in the review-finding template's four sections plus an evidence table |
