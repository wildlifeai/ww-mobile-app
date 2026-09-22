# Traps that have already cost time

#### File: .agents/skills/references/traps.md
#### Author: Claude, with Victor Anton
#### 19 September 2026

Each of these cost someone at least a day. They are here so the next person spends minutes
instead. Device behaviour that is simply how the system works belongs in [ble.md](ble.md); this
file is the list of things that look like an app bug and are not, and the reverse.

## Hardware and firmware faces

- **Self-test bits are meaningless until the Himax is awake.** The nRF pre-sets *every*
  AI-processor bit, 8 to 15, at boot and clears them only when the Himax reports for itself, so
  a `selftest` run before `AI info` returns `0xFF00`-ish garbage in that range.
  `useBleInitialization` masks bits 8 to 15 for exactly this reason and runs a **second**
  `selftest` after waking the AI processor. The two are not duplicates, and neither is
  removable. Anything reading bits 8 or 9, the main camera and the HM0360, must reject the
  all-bits-set pattern or it will report five hardware failures on a healthy device.
- **The device is woken only by a command, so nothing may wait for a Wake it will not cause.**
  The transport queue paused on Sleep and resumed only on Wake; when a Sleep landed while a
  slow JavaScript thread was still completing `slots`, during a screen mounting eight gallery
  images, every command behind it hung until the 60 s link timeout. The pause now lifts itself
  after `SLEEP_SETTLE_MS`. The same rule applies to any flow: a wait for Sleep is fine, a wait
  for Wake is only fine right after a reset the device scheduled itself.
- **`setop 10 0` does not stop a running camera.** `cameraSystemEnabled` is loaded from op10
  only when the image task starts, so the write lands at the next wake. `AI enable` and
  `AI disable` change both. To turn the camera on *now*, write op10 **and** send `AI enable`.
  The inverse of this trap is documented on the firmware side.
- **A selected flash does not mean a flash.** op13 only chooses the LED; the firmware fires it
  on a capture only when its last light decision, op25, was DARK, and the check after every
  capture rewrites op25. In a lit room the LED never fires whatever the app selected, and that
  is not an app bug. Before touching the app, isolate it in three console commands:
  `AI flash 50 500` lights the white LED directly, proving hardware and command path;
  `AI getop 25` shows the gate; and `AI setop 25 1` followed by `AI capture 1 500` proves the
  capture path can fire it. Bench-proven 3 September 2026. Capture Picture forces it for now by
  writing op25 = 1 before a capture with a flash chosen, marked `TODO(flash-mode-op)` in
  `useCapturePicture.ts`. Do not copy that elsewhere. It is a stand-in for the always-on mode
  Charles is adding behind a new op parameter, `flash_led_modes_proposal.md` on `ae_review`,
  proposed from index 32, which this app already uses for `CAM_RESOLUTION` and 33 for
  `MD_BLOCK_NUM_MAX`. Agree the index before either side ships, Seeed #209, then replace the
  op25 write with the new parameter.
- **A multi-image capture with a gap above op8 is cut short by the device** (Seeed #208).
  Images after the first never come, `Captured` is never sent, and the app receives `Sleep`
  instead. Keep any `capture N interval` below op8, and treat a `Sleep` during a capture as the
  end of it rather than waiting on the 30 s timeout.
- **A device that prints `IMAGE task unhandled event 'Image Event Inactivity' in
  'Uninitialised'` once a second is stuck awake, and only a power cycle brings it back.**
  Firmware race on `ae_review` e8b7feb5: the inactivity timer fired while the IF task was
  transmitting a reply, op8 at 1 s and a command about a second after the last, the image task
  reached the shutdown barrier alone, and every later inactivity event is unhandled. No console
  command clears it, since `AI reset` is consumed on the way into DPD. Do not spend time on the
  app side when you see it; the app's flows time out correctly against it. Filed as Seeed #205,
  reproduced on demand, and an ordinary wake-then-command can trigger it. Two more faces: once
  in the loop the nRF parks in SELFTEST and drops every app command, so the console goes silent
  as well, and a `setop` inside the same window is acknowledged with `Set OpParam N = V` and
  never saved (#207), so that reply is not proof a value survived a sleep.

## Screens and navigation

- **The stack's header is `components/NavigationBar.tsx`, not the native one, so a header
  option it does not render is dropped without a warning.** `headerRight` was dropped that
  way until 21 September 2026 (#302): the screen set it, the type-check passed, and the phone
  showed nothing. `headerTitleAlign: 'left'` was ignored the same way. Both are honoured now;
  anything else (`headerTitle` components, `headerStyle`) still has to be added there before a
  screen can rely on it. Check the phone, not the option name.

- **A screen left in the stack under a flow keeps rendering, and the Engineer Console is
  under every flow it opens.** Until 22 September 2026 `BleConsoleOutput` rebuilt its whole
  history, every line a touchable with three texts in a plain ScrollView, on every BLE line.
  By the thousandth line each line cost the JS thread about 1.3 s: the nRF sent `Wake`,
  `Error bits` and `Set OpParam` within 0.8 s of a `setop` and the app received them 1.3 s
  apart, so one `setop` took 6 s and a dev deployment start took 90 s for commands the device
  answered in under a second. It is a FlatList of memoised rows now, capped at 500 entries,
  and the console effect finds new lines by identity rather than by count, which had gone
  silent once the Redux log hit its 1000-entry trim. The same cost is the likely reason #273
  (the app a minute behind the device during a motion test). Before blaming the device or
  BLE for a slow flow, measure the gap between consecutive `RAW_RX` lines in logcat: the
  device's replies are timestamped on the nRF console, the app's arrivals in logcat.

## File transfer

- **The File Transfer Test's loopback benchmark cannot pass on BLE firmware 0.30.48.** The nRF
  drops the echo unless an image stream is open, ww-hardware #36, so thirty timeouts in a row
  is the firmware, not the phone or the link. The 500 KB upload on the same screen is the
  working link measurement: 5.2 KB/s on 4 September 2026.
- **Image transfer runs at about 1.1 KB/s and the app is not the reason.** `AI txfile` on its
  own measures the same as inside the capture flow. The nRF hex-dumps every 241-byte packet to
  its 115200 baud console and flushes the log before each BLE send, so the transfer runs at the
  speed of the debug UART. A 12 KB image is 10 s; do not spend app time on it. Filed as
  ww-hardware #34 with the proof: the nRF already gates that logging off for uploads, and the
  same 241-byte packets went five times faster that way on the same device. The app's 1.1 KB/s
  countdown model stands until the gate covers downloads.
- **The transfer window only works on nRF firmware 0.30.47 and later.** The app streams up to
  12 packets ahead by default, in `runFileTransferPipeline.ts`, which the nRF's 16-slot FIFO,
  0.30.47 and later, ww-hardware #27, absorbs. On pre-FIFO firmware there is one relay slot:
  the surplus packets are dropped with a log-only warning, an in-flight-ack race resets the AI
  state machine to SLEEP, and the transfer hangs to the 15 s silence timeout with **no
  `ftx err`**, reporting only "no transfer response for 15s". It does not fail fast, and it does
  not complete via retries, because the windowed path has no per-packet ACK timeout. The window
  must be gated on the `ver` string; until then a board on old firmware has to be DFU'd to
  0.30.48 first. Filed as #289. The comment at `runFileTransferPipeline.ts` lines 109 to 111
  and `File-Transfer-Protocol.md`, which claim it "fails fast with an ftx error" and "completes
  slowly via ACK-timeout retries", both describe this wrongly.
- **Nothing may be sent while an image is streaming in, and a flow must stop when its screen
  goes.** The nRF forwards any command to the Himax at once, restarts its binary packet
  counter, and the reply comes only when the file has finished: a `slots` sent mid-stream drew
  `AI processor not responding`, 412 phantom sequence gaps and a reply 14 s late, on
  3 September 2026, ww-hardware #33, reproduced on demand. The transport holds the queue from
  `N bytes in` to the reassembler's finish, `bleTransport.isStreaming`; do not work around it
  with a direct write. The Engineer Console's typed line is that direct write by design, which
  is why it can reproduce #33 and why nothing should be typed during a transfer. The stream was
  there because a capture chain kept running after Back: `useCapturePreview` and
  `useCapturePicture` check a mounted ref before each command, and a screen shows only the
  picture it asked for. Any new multi-step flow needs the same check.
- **`ftx err 1` after a failed transfer.** The nRF's session is still open; every new
  `FILE_START` is rejected until the link drops. Disconnect and reconnect to clear. On iOS with
  BLE firmware below 0.30.48 the transfer dies mid-file and re-creates this state, so fix the
  firmware rather than retrying.
- **8.3 filenames, uppercase.** The transfer validator rejects anything else *before* sending,
  so a lowercase extension means the file silently never reaches the SD card. Maximum 12
  characters, because a firmware truncation bug makes 13 or more fail confusingly later.

## Builds, versions and the shell

- **Debug and store builds now coexist, but only on Android and only for debug.**
  `android/app/build.gradle` sets `applicationIdSuffix '.expo'` on the debug buildType, so a
  local build installs as `com.wildlife.wildlifewatcher.expo` alongside the Play Store app
  instead of colliding with it. `src/debug/res/values/strings.xml` renames it "Wildlife Watcher
  (Dev)" so the two are distinguishable in the launcher. **This is a gradle-level fix, not the
  `APP_VARIANT` logic in `app.config.ts`.** That logic is still dead on Android, because
  `android/` is committed and prebuild never regenerates it. The two now agree on `.expo` by
  hand; change one and you must change the other. Two things it does **not** cover. **EAS
  `preview` and `staging` builds are release-type, so they keep the production applicationId
  and still collide with the store app**, which means the uninstall-and-lose-the-database
  problem is unchanged for anything handed to a tester. Separating those needs the EAS
  keystore's SHA-1 registered against `.expo` in the Google Maps key, or maps break in those
  builds. And `.expo` is not in the website's `assetlinks.json`, so App Links to
  `wildlifewatcher.ai/reset-password` will not open a debug build.
- **Installing on Windows** is in AGENTS.md: `npm install --ignore-scripts` then
  `npx patch-package`, because `maestro`'s postinstall aborts a plain install, and skipping
  `postinstall` alone leaves `patches/` unapplied, which breaks the native build later.
- **Publishing traps live in `documentation/resources/publishing_guide.md`**, not here: Play
  Store installs blocked invisibly by device checks, the five `eas.json` profiles and the one
  that also submits, a failed submission that shows nothing in the web console until re-run
  from the CLI, and store identifiers that must match EAS's credential records rather than
  memory. Read that guide before dispatching a build or a submission.
- **Version bumps are six files.** `package.json`, `app.config.ts` twice,
  `android/app/build.gradle` twice, `strings.xml`, and `package-lock.json`, which is only
  refreshed by `npm install` and sat three versions behind until August 2026. Because
  `android/` is tracked, EAS reads the *native* values and ignores `app.config.ts`.
  `npm run version:check` catches all six.
- **`supabase gen types` needs auth and lies about failing.** It requires `npx supabase login`
  or `SUPABASE_ACCESS_TOKEN`, and on failure it **exits 0** while printing a JSON error blob to
  stdout. Any `cmd > file` capture therefore writes the error into the file. The script now
  generates to a temp file, checks the content looks like types, and only then renames. Keep
  that shape if you touch it.
- **Every text file is LF, enforced by `.gitattributes` since 21 September 2026.** Before
  that, 53 files were committed CRLF and one was mixed, and `core.autocrlf` normalised on
  `git add`, so any edit to one of them showed as a whole-file rewrite: `deploymentPipeline.ts`
  changed 88 lines and diffed 796. If a diff is about the size of the file, check endings
  before reading it. Binary types are declared, so `.apk`, `.tfl` and images are never
  touched.
- **An IR flash is invisible to the colour camera.** The RP3 has an IR-cut filter, so a
  project set to the IR flash on a device running the colour slot fires the LED, drains the
  battery and records black night frames. Nothing coupled the two until #321, and it matters
  more since #304 stopped the device switching slots on its own: whatever camera is active at
  deployment time is the one the whole deployment uses. The rule is
  [`utils/flashCameraMatch.ts`](../../../src/utils/flashCameraMatch.ts) and Start Monitoring
  warns; it deliberately does not switch the slot.
- **Never redirect straight onto a tracked file.** The shell truncates the target *before* the
  command runs, so a failure destroys the committed version. This wiped
  `src/types/database.types.ts`, 169 KB down to a 217-byte error blob, and only surfaced two
  steps later as a confusing `schema:generate` crash.
