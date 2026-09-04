# First deployment from a blank SD card with the Person Detection (96x96) model

#### File: README.md
#### Author: Claude (Fable 5.1), with Victor Anton at the bench
#### 4 September 2026

**Branch:** `docs/person-detection-first-deployment`
**Status:** Open. Bench run complete, five findings filed as issues; closes when they are resolved or decided.

## Outcome

One end-to-end run, from a freshly formatted card to a stopped deployment, with the three-way
bench logger on both device consoles and the app. Device: WW500 `WILD-CNKW`, Himax
`ae_review` e8b7feb5 (RP3 build of 3 September), nRF ww-hardware `dev` 0.30.48, app `dev`
8b1c453a, user `tama@ww.org` on the cloud dev instance, project "Person detection example"
(activity detection, model Person Detection (96x96) custom 1.0.0, firmware id 20).

The flow works. The firmware built `/MANIFEST/CONFIG.TXT` on the blank card, the app delivered
the model and its labels over BLE in 44 s (251,568 bytes, about 5.7 KB/s), the deployment ID
went into every photo's EXIF, motion woke the camera, the person detector fired (`NN+`, scores
87 to 108 out of 128 against a threshold of 18, negative with nobody in frame), the app saw
every broadcast, and Stop Monitoring left the card with motion and timelapse off. Seven
minutes, 37 captures, 36 images.

Before the run could start, the user's projects were missing in the app: the sync watermarks
are global and survive a user switch, so a phone that had synced as someone else never asked
for tama's roles. A local database reset proved it. That is finding A and the one worth
fixing first.

Five findings, one folder each, in the issue template's shape:

| | Finding | Repo | Type | Issue |
|---|---|---|---|---|
| [A](A_sync_watermarks_survive_user_switch/explanation.md) | Sync watermarks survive a user switch; the next user sees no projects | app | bug | [ww-mobile-app #267](https://github.com/wildlifeai/ww-mobile-app/issues/267) |
| [B](B_person_detection_labels_one_line/explanation.md) | Person Detection labels file has one label for two classes; the person class is `''` in EXIF | data, website, firmware | data | [ww-website #134](https://github.com/wildlifeai/ww-website/issues/134) |
| [C](C_light_check_capture_fails/explanation.md) | The light-check capture in Start Monitoring was refused by the sensor; a motion wake completed the step by chance | app, firmware | bug, seen once | [ww-mobile-app #269](https://github.com/wildlifeai/ww-mobile-app/issues/269) |
| [D](D_duplicate_commands_on_connect_and_monitor/explanation.md) | Connect sends ver, AI info, AI ver twice; the monitor polls the image count twice a minute | app | cleanup | [ww-mobile-app #268](https://github.com/wildlifeai/ww-mobile-app/issues/268) |
| [E](E_organisation_manager_not_full_access/explanation.md) | Decide: organisation managers see only project-scoped roles, in the app and in RLS | app, backend, website | decision | [ww-backend #162](https://github.com/wildlifeai/ww-backend/issues/162) |

## The run, step by step

Times are the logger's `MM:SS` stamps in [flow_bench.txt](flow_bench.txt). The
first boot at 12:19:48 (card format, manifest creation) was not captured: the logger's first
launch died on a bad argument and was restarted about a minute later.

| Step | What was done | What the log shows |
|---|---|---|
| 1 | Card formatted, device plugged in | Not captured. At the first wake the Himax found `/MANIFEST` and `CONFIG.TXT` already present, all ops at firmware defaults, "No model found", MD and timelapse disabled. Card 15.26 GB |
| 2 | Middle button, Search for Devices | `00:24` auto-connect. `selftest`, `setutc`, `battery` (3120 mV, 3 percent, on USB), `AI info` (warm boot, "Wake", second "Error bits = 0x0000"), `selftest`, `AI getop -1`, `setop 0 1`, `setop 26 1`, `ver`, `AI ver`; then `ver`, `AI info`, `AI ver` again (finding D). Screen at `00:33` |
| 3 | Project picked, Start Monitoring | `01:35` `getop -1`; `AI dir` empty; `20V1.TFL` and `20V1.TXT` downloaded from storage and transferred `01:43` to `02:27`; `AI loadmodel 20 1` written to flash; `setutc`; `AI setdid`, `setgps 0,0,0`, `setop 11 1000`, `setop 18 2`, `setop 5 2`; `AI capture 1 500` refused by the sensor (finding C); motion wake `02:47`, two frames, AE light check BRIGHT; `getop -1` twice; live monitor at about `02:52` |
| 4 | Person in frame | Motion wakes at `05:39`, `06:02`: `Wake (MD)`, motion grid, `NN+` twice, "Captured 2 images", `Sleep`. Empty-scene wakes gave `NN-`. Labels warning at every load (finding B). `AI getop 19` twice per minute (finding D) |
| 5 | Stop Monitoring with a note | `06:55` `getop -1`, `AI setdid 0000…`, `AI setgps` zeros, `setop 11 0`, `dis`. Timelapse already 0, camera left enabled, model left loaded. Final "Sleep" line failed to send after the disconnect, the normal case from ww-hardware #35 |

Answer to the question asked at step 3, "do we need the light conditions?": not for
correctness. The firmware runs the AE light check on every capture and on the op24 timer, and
op26 = 1 already switches camera at the next sleep. The app step exists to print the starting
mode in the progress dialog. Finding C is the case for removing its capture.

## Open items

All five filed on 4 September 2026, permalinked to commit a97c91ec; the issue column in the
table above is the list. Filed where the fix lives: A, C and D in this repo, B in ww-website
(the upload wrote the file), E in ww-backend (the policy lives there).

## Files

| File | What |
|---|---|
| [flow_bench.txt](flow_bench.txt) | Three-way log of the whole run, filtered: hex dumps, LED debug lines, nRF state-machine chatter, AE register blocks and motion-grid rows removed. The unfiltered capture is 16,208 lines and is kept on the bench PC |
| `<Letter>_*/explanation.md` | One per finding, in the review-finding template's four sections plus an evidence table |
