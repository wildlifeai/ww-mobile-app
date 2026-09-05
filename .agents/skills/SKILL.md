---
name: ww-mobile-app
description: Working rules, guardrails and hardware-contract traps for the Wildlife Watcher mobile app (React Native + Expo, BLE to WW500, WatermelonDB + Supabase offline sync).
---

# Wildlife Watcher mobile app — working knowledge

Read [`AGENTS.md`](../../AGENTS.md) first for the quickstart. This file is the layer
underneath: the rules, the contracts with other repos, and the things that have already
cost someone a day.

---

## 1. Workflow

- **Never commit or push to a shared branch without asking the maintainer.** This is a
  hard rule in this repo, not a courtesy.
- Conventional Commits (`commitlint` enforces it). Branch names: `feat/`, `fix/`,
  `chore/`, `docs/`.
- Before you claim work is done, run the gates that exist precisely because things
  drifted before: `npm run type-check`, `npm test`, `npm run version:check`,
  `npm run docs:validate`.
- Don't hand-edit generated files: `src/database/schema.ts` (from `schema:generate`) and
  `src/types/database.types.ts` (from `types:cloud-dev`).
- **Verify against the code, not the docs.** A July 2026 audit found about 40
  documented facts that had drifted from reality; they were fixed in v0.0.62 and
  `npm run docs:validate` now guards paths and links, but not claims. Treat any
  undated claim as a hypothesis.
- **A green check is a claim too: confirm it actually compared something.** On
  5 September 2026 `schema:validate:live:cloud-dev` was reporting
  `✅ PASSED (with warnings)` while parsing **zero** tables out of the Supabase types,
  because its brace-matching regex could not cope with a real generated file. Every
  table was reported missing, as a warning, so nothing failed. Layer 4 of the
  documented anti-drift defence had been reading green while checking nothing. When a
  tool passes, read the counts it prints (`Found 43 tables`, `Found 45 tables`), not
  the tick. The same run also proved the point twice over: the checker could not
  execute at all on Windows (BOM-less `.ps1` with emoji, read as ANSI by PowerShell
  5.1), and its environment label named staging while it validated dev.
- **Ground-truth a difference before calling it a bug.** That same validator's first
  honest run reported 83 "errors". 76 were audit columns the app defines on tables
  that genuinely lack them upstream, and 3 were legacy columns already labelled
  `// Legacy fields` in `models/Deployment.ts`. Query the live database for the real
  column list rather than reasoning from the generated types, and check whether the
  code still uses the field, before proposing a fix.
- **PRs are squash-merged, and the branch is auto-deleted.** Two consequences:
  1. Squashing rewrites the commit SHAs, so a branch built on the pre-merge commits
     shows every already-merged commit again as "new". After a PR merges, `git fetch`
     and branch fresh from `dev` — cherry-pick your unmerged work across rather than
     opening a PR from the old branch.
  2. Pushing to the deleted branch **silently recreates it** instead of failing. If a
     push reports `[new branch]` for a branch you know existed, it was merged and
     deleted underneath you — stop and rebuild before opening anything.

## 2. Cross-repo contracts — never change unilaterally

The app is one of four repos around one device. These interfaces are shared, and
changing one side silently breaks the other:

| Contract | Here | Counterpart |
|---|---|---|
| **OP parameter indices** | `OP_PARAMETER` in `src/hooks/useDeviceSettings.ts` | `OP_PARAMETERS_E` in Seeed `ww500_md/fatfs_task.h`; mirrored again in ww-hardware `aiProcessor.h` |
| **BLE command strings** | `src/ble/protocol/commandRegistry.ts` | Seeed `CLI-commands.c` / `CLI-FATFS-commands.c`; relay in ww-hardware |
| **`ftx` file-transfer wire format** | `src/ble/protocol/fileTransfer/` | ww-hardware `fileTx.c` ↔ Seeed `fileRx.c` |
| **Database schema** | `src/database/schema.ts` (generated) | **owned by** `wildlife-watcher-backend` — schema changes start there |
| **Backend schema directory names** | `SCHEMA_MAP` in `scripts/sync-db-schema.js` | `ww-backend/supabase/schemas/public/*` — the `aaa_`/`xxx_`/`yyy_`/`zzz_` prefixes encode apply order |
| **AI model / firmware filenames** | `deploymentPipeline.ts`, `useFirmwareUpdate.ts` | Seeed `xip_manager.c` parser |
| **`AE light check` line format** | `src/ble/protocol/lightCheck.ts` | Seeed `ww500_md/lightSensor.c`, two wordings selected by `AE_DECISION_GAIN_BASED` at compile time. Only the `-> DARK\|BRIGHT` verdict is required; every other field is optional and each label is matched in both its spelled-out and abbreviated form. The app's measurement is built from the `HM0360 AE regs` block, never from this line |
| **Self-test bit numbers** | `SelfTestBit` in `src/utils/deviceSelfTest.ts` | Seeed `ww500_md/selfTest.h`. Bits 0-7 nRF, 8-15 Himax |
| **Apple team ID** | `eas.json` → `submit.production.ios.appleTeamId` | ww-website `frontend/public/.well-known/apple-app-site-association` — the `appID` there is `<TeamID>.<BundleID>`, and iOS silently refuses to associate the domain if it does not match the installed app |
| **Store identifiers** | `eas.json` → `ascAppId` | EAS credential records, **not** a value to type from memory — see §4 |

**The `AI ` prefix rule.** Commands prefixed `AI ` are forwarded by the nRF52 to the
Himax; unprefixed ones are handled by the nRF itself. Consequences that have caught
people: `reset` reboots the nRF *after disconnect*; `AI reset` reboots only the Himax and
**leaves the BLE link up**. The firmware-update flow needs `AI reset`.

## 3. BLE — the rules that keep it deterministic

- **One source of truth.** Every command is a factory in `commandRegistry.ts` with its
  own matchers, timeout and retry policy. Never parse a device response elsewhere.
  `messageClassifier.ts` colours log lines for the UI and has **no protocol authority**.
- **Two write paths, deliberately separate.** `bleSession.execute()` for anything
  deterministic (queued, matched, timed out). `writeRaw()` only for the Engineer
  Console's raw input line. The console *does* also run workflows from its Flows modal —
  the invariant is that the **typed input line** never enqueues, so typing can never
  interleave with a deployment's command sequence.
- **Connecting changes nothing on the device.** The Engineer Console connects and shows a
  terminal; every write to the device happens inside a flow the user opened, after they
  navigated to it. Never add a write to `useBle.connectDevice`, the console screen or the
  heartbeat path. A deferred sleep-timer restore was briefly wired into the connect path on
  3 September 2026 and removed the same day for this reason; it now waits for the next hold.
- **The device sleeps aggressively.** Deep Power Down after ~1000 ms of inactivity; the
  BLE link drops after ~60 s (hence the 58 s heartbeat). After *any* disconnect assume
  the device is asleep and not advertising until woken by button, motion or timer, and
  budget minutes: after a timeout disconnect on 4 September 2026 the nRF did not advertise
  again for two and a half, and a connect attempt inside that gap simply timed out.
- **Stored op values can be stale — check what keeps them updated.** The clearest case
  is the light decision (op25): the firmware only runs its AE check when something
  consumes the result, i.e. the flash is on (op13 ≠ 0) or auto camera switch is on
  (op26 = 1). With both off, op25 keeps whatever it last held, so the device happily
  reports BRIGHT inside a dark box and no amount of waiting changes it. Read the AE mean
  streamed during a capture *you* triggered rather than the stored decision. Before
  surfacing any op as "current", establish what writes it and when.
- **A stale scan entry will hang you.** Auto-connect only trusts a device seen in the
  current scan session (`lastSeen` gate) — a just-disconnected device lingers in cache
  and connecting to it hangs until timeout.
- **`commandQueue` does not exist.** The queue is `bleTransportController.ts`. Old docs
  and comments still name the former.
- **Defining a command does not make it visible.** `CommandReferenceModal` builds its
  list from a hand-maintained allowlist (`pick([...])` per group), so a command can be
  fully defined in `COMMANDS`, work when typed, and never appear in the UI — `slots` and
  `switchslot` were unreachable that way until Aug 2026. A coverage test now fails CI if
  a `type: 'command'` entry belongs to no group. **`FlowsReferenceModal` has the same
  shape and no equivalent guard**, so `type: 'process'` entries can still go missing
  silently: when you add one, open the modal and confirm it renders.
- **Read ops through `session.getOps()`, not `execute(getops)`.** `AI getop -1` returns all 32
  values and almost every hook wants one or two, so the array is cached per device for one wake
  window (`ble/protocol/opCache.ts`). A `setop` patches the one value the device confirmed; the
  array is dropped on **Wake** and on disconnect, because the device rewrites its own parameters
  while asleep: automatic day/night switching moves the active slot and the AE check writes op25.
  A bench run counted **18 fetches for six photos** before this, and dropping the array on
  `setop` cost a wake on every capture that changed a setting. Verification paths
  (`configVerification`, `deploymentPipeline`) deliberately still read fresh. Concurrent misses
  are not coalesced yet: screen entry still sends four `getop -1` in a second (open item).
- **`waitForSleep` returns immediately when the device is already asleep**, tracked in
  `ble/protocol/sleepState.ts`. This is not an optimisation, it is a correctness fix: once the op
  cache stopped the capture path from waking the device, the wait sat out its full 5000ms timeout
  waiting for a Sleep signal that had already been sent. `startCapture` to `capture` went 2.03s →
  5.03s → **0.13s**. Note that *unknown* is not treated as awake, so a first-ever wait still waits.
- **`setop` stores; the device applies at wake.** The flash LED and brightness (op13, op9) are
  read in `setupLEDFlash()` when the device wakes, the camera settings when the image task
  starts, a camera switch resets at the next sleep, and op8 itself sets the timer of the *next*
  awake window. So a flow that changes a setting must let the device sleep before the capture
  that should use it (the pre-capture `waitForSleep` is not an optimisation to remove), and it
  must send nothing while waiting, because every command restarts the timer: a 20 s hold with
  `slots` polling, tried on 3 September 2026, meant a camera switch never reset. Whether the
  firmware should apply on `setop` instead is Charles's decision in Seeed #209.
- **op8 is a field setting, so go through `ble/session/keepAwake.ts`.** It is written to
  CONFIG.TXT, and a device left raised stays awake that long after every motion capture in the
  field. `acquire` raises op8 (3 s for Capture Picture) and records the original on disk,
  `release` puts it back, and anything a dropped link left owed is restored the next time a flow
  takes a hold on that device; nothing is written at connect time. Never `setop 8` from a screen
  and never keep the original only in a ref (the Motion Detection stream still does, an open
  item). While `keepAwake.holds(deviceId)` the capture path sends `txfile` straight after
  `Captured` instead of paying a wake: 22 s to 13 s for the same picture.
- **The app runs ahead of the firmware on op indices, deliberately.** op32 (`CAM_RESOLUTION`) exists
  here before it ships on the device. Guard on the array length before touching a high index, the
  way `useCapturePicture` does for the WB gains, rather than reading it and hoping. `getop` now has
  a `failureRegex` for the out-of-range error and it is non-retryable: without it a rejection
  matched neither success nor failure and burned 8s, then retried, which silently broke a whole
  flow for 16s at a time.
- **The nRF strips the op array out of the Sleep broadcast.** The Himax sends all 32 values on every
  sleep and the nRF logs them as `AI processor sends stats`, then forwards six bytes: the word
  `Sleep`. The app never sees the numbers, so there is nothing to parse and the cache above is the
  only app-side answer. Getting them forwarded is a firmware ask, and it would delete the cache.
- **A three-way bench log is three different viewpoints, not one.** The Himax and nRF console legs
  show what those processors did; only the `app` leg shows what reached the phone. Reading a firmware
  console line and assuming the app got it is how a parser for that Sleep broadcast almost got
  built. Confirm against the `app` leg before designing on it.
- **`useCapturePreview` is the capture path — don't hand-roll one.** It carries the
  op10/op18 pre-flight that re-enables a camera left disabled by a stopped deployment,
  the Save State/DPD waits that stop `txfile` racing FatFS and corrupting the file
  handle (the post-capture one is skipped while `keepAwake.holds(deviceId)`; the pre-capture
  one always runs because that wake applies any changed setting), and the reassembly that
  turns binary packets into an image URI (with byte-level progress). Use it whenever you
  need an image. What Capture Picture does around it is in
  [Capture-Picture.md](../../documentation/resources/Capture-Picture.md).
- **To measure light, don't take a photo.** `useLightSensor.measureNow` uses `AI light`:
  about 2 s, no JPEG, no transfer, against 13–50 s for a capture. It is **two-phase** —
  the command's reply is only an acknowledgement and the reading arrives afterwards as
  unsolicited telemetry, so it subscribes before sending. A blocking version of this
  deadlocked the firmware over BLE; don't ask for a synchronous one.
  See [Light-Sensor.md](../../documentation/resources/Light-Sensor.md).
- **Ask what the device already tells you before adding a poll.** Self-test bits arrive
  unprompted after *every* wake, and the light decision after every light check. A Sep
  2026 bench run counted 25 `Error bits` lines received against 6 `selftest` commands
  sent. Polling costs a DPD wake and, worse, can display a stale answer while a fresher
  one goes unread — that exact bug made a healthy camera look broken until the device was
  power-cycled. Passive subscriptions are listed in
  [BLE_Architecture.md](../../documentation/resources/BLE_Architecture.md).
- **Order the commands so the wake works for you.** The device announces its self-test
  when it wakes, so a command that wakes it (`getop -1`) answers the next question for
  free. Sending `selftest` first instead means it goes out ~200 ms *before* the broadcast
  that would have made it unnecessary. That ordering bug survived a code review and was
  only visible in a merged app/nRF/Himax log.

## 4. Traps that have already cost time

- **Self-test bits are meaningless until the Himax is awake.** The nRF pre-sets *every*
  AI-processor bit (8–15) at boot and clears them only when the Himax reports for itself,
  so a `selftest` run before `AI info` returns `0xFF00`-ish garbage in that range.
  `useBleInitialization` masks bits 8–15 for exactly this reason and runs a **second**
  `selftest` after waking the AI processor — the two are not duplicates, and neither is
  removable. Anything reading bits 8 or 9 (main camera, HM0360) must reject the
  all-bits-set pattern or it will report five hardware failures on a healthy device.
- **The device is woken only by a command, so nothing may wait for a Wake it will not cause.**
  The transport queue paused on Sleep and resumed only on Wake; when a Sleep landed while a
  slow JS thread was still completing `slots` (a screen mounting eight gallery images), every
  command behind it hung until the 60 s link timeout. The pause now lifts itself after
  `SLEEP_SETTLE_MS`. The same rule applies to any flow: a wait for Sleep is fine, a wait for
  Wake is only fine right after a reset the device scheduled itself.
- **`setop 10 0` does not stop a running camera.** `cameraSystemEnabled` is loaded from
  op10 only when the image task starts, so the write lands at the next wake. `AI enable` /
  `AI disable` change both. To turn the camera on *now*, write op10 **and** send
  `AI enable`. The inverse of this trap is documented on the firmware side.
- **A selected flash does not mean a flash.** op13 only chooses the LED; the firmware fires
  it on a capture only when its last light decision, op25, was DARK, and the check after
  every capture rewrites op25. In a lit room the LED never fires whatever the app selected,
  and that is not an app bug. Before touching the app, isolate it in three console commands:
  `AI flash 50 500` lights the white LED directly (hardware and command path), `AI getop 25`
  shows the gate, and `AI setop 25 1` then `AI capture 1 500` proves the capture path can
  fire it. Bench-proven 3 September 2026. Capture Picture forces it for now by writing op25 = 1
  before a capture with a flash chosen (`TODO(flash-mode-op)` in `useCapturePicture.ts`); do
  not copy that elsewhere, it is a stand-in for the always-on mode Charles is adding behind a
  new op parameter (`flash_led_modes_proposal.md` on `ae_review`), proposed from index 32,
  which this app already uses for `CAM_RESOLUTION` (and 33 for `MD_BLOCK_NUM_MAX`): agree
  the index before either side ships (Seeed #209), then replace the op25 write with the new
  parameter.
- **A multi-image capture with a gap above op8 is cut short by the device** (Seeed #208):
  images after the first never come, `Captured` is never sent, and the app receives `Sleep`
  instead. Keep any `capture N interval` below op8, and treat a `Sleep` during a capture as
  the end of it rather than waiting on the 30 s timeout.
- **The File Transfer Test's loopback benchmark cannot pass on BLE firmware 0.30.48.** The
  nRF drops the echo unless an image stream is open (ww-hardware #36), so thirty timeouts in
  a row is the firmware, not the phone or the link. The 500 KB upload on the same screen is
  the working link measurement: 5.2 KB/s on 4 September 2026.
- **Image transfer runs at about 1.1 KB/s and the app is not the reason.** `AI txfile` on
  its own measures the same as inside the capture flow. The nRF hex-dumps every 241-byte
  packet to its 115200 baud console and flushes the log before each BLE send, so the
  transfer runs at the speed of the debug UART. A 12 KB image is 10 s; do not spend app
  time on it. Filed as ww-hardware #34 with the proof: the nRF already gates that logging
  off for uploads, and the same 241-byte packets went five times faster that way on the
  same device. The app's 1.1 KB/s countdown model stands until the gate covers downloads.
- **The transfer window only works on nRF firmware >= 0.30.47.** The app streams up to 12
  packets ahead by default (`runFileTransferPipeline.ts`), which the nRF's 16-slot FIFO
  (0.30.47+, ww-hardware #27) absorbs. On pre-FIFO firmware there is one relay slot: the
  surplus packets are dropped with a log-only warning, an in-flight-ack race resets the AI
  state machine to SLEEP, and the transfer hangs to the 15 s silence timeout with **no
  `ftx err`** ("no transfer response for 15s"). It does not fail fast, and it does not
  complete via retries — the windowed path has no per-packet ACK timeout. The window must
  be gated on the `ver` string; until then a board on old firmware has to be DFU'd to
  0.30.48 first. Filed as #289. The comment at `runFileTransferPipeline.ts` lines 109-111
  and `File-Transfer-Protocol.md` ("fails fast with an ftx error" / "completes slowly via
  ACK-timeout retries") both describe this wrongly.
- **Nothing may be sent while an image is streaming in, and a flow must stop when its
  screen goes.** The nRF forwards any command to the Himax at once, restarts its binary
  packet counter, and the reply comes only when the file has finished: a `slots` sent
  mid-stream drew `AI processor not responding`, 412 phantom sequence gaps and a reply 14 s
  late (3 September 2026; ww-hardware #33, reproduced on demand). The transport holds the
  queue from `N bytes in` to the reassembler's finish (`bleTransport.isStreaming`); do not
  work around it with a direct write. The Engineer Console's typed line is that direct
  write by design, which is why it can reproduce #33 and why nothing should be typed
  during a transfer. The stream was there because a capture chain kept running after Back:
  `useCapturePreview` and `useCapturePicture` check a mounted ref before each command, and a
  screen shows only the picture it asked for. Any new multi-step flow needs the same check.
- **A device that prints `IMAGE task unhandled event 'Image Event Inactivity' in
  'Uninitialised'` once a second is stuck awake, and only a power cycle brings it back.**
  Firmware race on `ae_review` e8b7feb5: the inactivity timer fired while the IF task was
  transmitting a reply (op8 at 1 s, a command about a second after the last), the image task
  reached the shutdown barrier alone, and every later inactivity event is unhandled. No
  console command clears it (`AI reset` is consumed on the way into DPD). Do not spend time
  on the app side when you see it; the app's flows time out correctly against it. Filed as
  Seeed #205, reproduced on demand, and an ordinary wake-then-command can trigger it. Two
  more faces: once in the loop the nRF parks in SELFTEST and drops every app command, so
  the console goes silent as well; and a `setop` inside the same window is acknowledged
  with `Set OpParam N = V` and never saved (#207), so that reply is not proof a value
  survived a sleep.
- **Debug and store builds now coexist, but only on Android and only for debug.**
  `android/app/build.gradle` sets `applicationIdSuffix '.expo'` on the debug buildType, so
  a local build installs as `com.wildlife.wildlifewatcher.expo` alongside the Play Store
  app instead of colliding with it. `src/debug/res/values/strings.xml` renames it
  "Wildlife Watcher (Dev)" so the two are distinguishable in the launcher.
  **This is a gradle-level fix, not the `APP_VARIANT` logic in `app.config.ts`.** That
  logic is still dead on Android, because `android/` is committed and prebuild never
  regenerates it. The two now agree on `.expo` by hand; change one and you must change
  the other.
  Two things it does **not** cover. **EAS `preview` and `staging` builds are release-type,
  so they keep the production applicationId and still collide with the store app.** The
  uninstall-and-lose-the-database problem is unchanged for anything handed to a tester. Separating those needs the EAS keystore's SHA-1 registered against `.expo` in
  the Google Maps key, or maps break in those builds. And `.expo` is not in the website's
  `assetlinks.json`, so App Links to `wildlifewatcher.ai/reset-password` will not open a
  debug build.
- **Installing on Windows** is in AGENTS.md: `npm install --ignore-scripts` then
  `npx patch-package`, because `maestro`'s postinstall aborts a plain install and skipping
  `postinstall` alone leaves `patches/` unapplied, which breaks the native build later.
- **`ftx err 1` after a failed transfer.** The nRF's session is still open; every new
  `FILE_START` is rejected until the link drops. Disconnect/reconnect to clear. On iOS
  with BLE firmware < 0.30.48 the transfer dies mid-file and re-creates this state — fix
  the firmware rather than retrying.
- **8.3 filenames, uppercase.** The transfer validator rejects anything else *before*
  sending, so a lowercase extension means the file silently never reaches the SD card.
  Max 12 characters (a firmware truncation bug makes 13+ fail confusingly later).
- **Publishing traps live in `documentation/resources/publishing_guide.md`**, not here:
  Play Store installs blocked invisibly by device checks, the five `eas.json` profiles and
  the one that also submits, a failed submission that shows nothing in the web console
  until re-run from the CLI, and store identifiers that must match EAS's credential
  records rather than memory. Read that guide before dispatching a build or a submission.
- **Version bumps are six files.** `package.json`, `app.config.ts` (×2),
  `android/app/build.gradle` (×2), `strings.xml`, and `package-lock.json` (only refreshed
  by `npm install` — it sat three versions behind until Aug 2026). Because `android/` is
  tracked, EAS reads the *native* values and ignores `app.config.ts`.
  `npm run version:check` catches all six.
- **`supabase gen types` needs auth and lies about failing.** It requires
  `npx supabase login` or `SUPABASE_ACCESS_TOKEN`, and on failure it **exits 0** while
  printing a JSON error blob to stdout. Any `cmd > file` capture therefore writes the
  error into the file. The script now generates to a temp file, checks the content looks
  like types, and only then renames — keep that shape if you touch it.
- **Never `>` straight onto a tracked file.** The shell truncates the target *before* the
  command runs, so a failure destroys the committed version. This wiped
  `src/types/database.types.ts` (169 KB → a 217-byte error blob) and only surfaced two
  steps later as a confusing `schema:generate` crash.

## 5. Data and sync

- **Redux holds no domain data.** Projects, deployments, devices live in WatermelonDB and
  reach the UI through `withObservables`. Redux is session + UI state only.
- **RLS blindspot.** A local query only ever sees what the current user was allowed to
  sync. Never compute a cross-user aggregate (member counts, global lists) from a local
  query — fetch it from the cloud and degrade gracefully offline.
- Writes go to WatermelonDB first; the outbox syncs them. Never block the UI on network.
- **Reference sync must pull both `validated` and `deployed` models.** `ReferenceDataService`
  filters `ai_models` to `status = 'validated'` only, but the backend contract (ww-backend
  `MOBILE_INTEGRATION_GUIDE.md`) is `status IN ('validated','deployed')` — `deployed` means
  in use on a device, the opposite of stale. A project pointing at a `deployed` model then
  cannot be deployed from the app and the model never appears in the picker; the camera runs
  with no model and only the Himax console says so. Filed as #290.
- **A deployment must carry its device with it.** The push order (`projects`, `devices`,
  `deployments`) is a foreign-key order, and `DeploymentService.createDeployment` queues an
  idempotent device CREATE alongside the deployment (the server's devices insert is
  `ON CONFLICT DO NOTHING`) so the device row always reaches the server first. Without it the
  first push fails `23503` and only a self-healing retry recovers it a cycle later, which the
  operator sees as a sync error (#294). A bare "touch" to trigger reactivity is not a sync op.

### Schema version — only moves on a real change

`scripts/generate-watermelon-schema.js` compares the generated table definitions against
the existing file (line endings normalised, version line ignored) and **only increments
`version:` when the tables actually differ**. An unchanged schema is not rewritten, so
`npm run android` leaves no diff.

Until Aug 2026 it incremented on *every* run, making the number a build counter — it
reached 402 without 402 schema changes. Hence: docs point at `schema.ts` rather than
quoting a number, and any version below ~402 in an older document means nothing.

- **Never hand-edit the version downwards.** WatermelonDB migrates on version increase; a
  number lower than the on-device database triggers a reset. If you want to discard a
  bump, make sure no device has already run that build.
- When the version *does* increase, add the matching migration in
  `src/database/migrations.ts` — the generator prints a reminder.
- Line endings matter here: git restores `schema.ts` as CRLF on Windows while the
  generator emits LF, so any comparison against it must normalise first.

## 6. Writing tooling in `scripts/`

These run on Windows, macOS and CI. Every bug found in them so far has been at the
shell boundary, and none of them reproduced in a Linux container:

- **Merge stderr to read diagnostics — never into a payload you compare.** `java -version`
  writes to **stderr**; `adb devices` to stdout. A helper that captures only stdout reports
  "java not on PATH" for a perfectly good JDK, so use `cmd 2>&1` when you want a tool's
  messages. But when stdout *is* the data you parse or diff, keep stderr separate:
  `check-types-cloud.ps1` merged `supabase gen types` stderr into the "fresh types" and the
  npm banner corrupted every comparison. On Windows PowerShell also beware `Out-File`/`>`,
  which write a BOM and CRLF — strip the BOM and normalise line endings before comparing
  generated files, or byte-identical content reads as "out of sync" (both fixed in #292).
- **Always time out external commands.** The first `adb devices` after a reboot starts a
  daemon that inherits your stdout pipe and never closes it — an untimed `execSync` hangs
  forever even though `adb devices` itself exited. Warm it with `adb start-server` first.
- **Exit codes lie.** Check output content, not just the exit status (see the Supabase CLI
  in §4).
- **Absence of a tool is not proof your check works.** The JDK bug survived a container
  test because with no JDK present the wrong code path produced the right answer. If a
  check can only pass or fail for the same reason, it hasn't been tested.
- Prefer `npm run <guard>` over ad-hoc verification: `version:check` and `docs:validate`
  exist so drift fails loudly in CI.

## 7. Documentation

- `documentation/onboarding/` = the guided path (six numbered guides).
  `documentation/resources/` = deep dives. `documentation/development reports/` = how
  decisions were reached.
- Point at code for anything that drifts (schema version, table counts, route lists).
  `npm run docs:validate` fails CI on a dead path or link.
- **Development reports follow the firmware repo's convention** — see
  [`development reports/README.md`](../../documentation/development%20reports/README.md).
  The three rules that matter when you write one:
  1. Docs are the record, GitHub issues are the tracker. A document is never the only
     place an open task lives.
  2. A thread is a folder `YYYY-MM-DD_short-description/` whose README carries **Status,
     Outcome and Open items**. Append as it evolves; don't rewrite it.
  3. **A report records how the work happened, not how the code works.** Anything a future
     developer needs about current behaviour belongs in `onboarding/` or `resources/` —
     nobody should have to read a thread to find out how something behaves now.
- Head every new markdown file with `#### File:`, `#### Author:` and the date, so a reader
  can place it without digging through git history.
