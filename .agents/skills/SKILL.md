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
- **Verify against the code, not the docs.** `documentation/DOCUMENTATION-AUDIT.md`
  records a period where ~40 documented facts had drifted from reality. Much is fixed;
  treat any undated claim as a hypothesis.
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
| **`AE light check` line format** | `src/ble/protocol/lightCheck.ts` | Seeed `ww500_md/lightSensor.c` `decideDarkBright()`. Still gaining fields, so parse **by field name**, never by comma position |
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
- **The device sleeps aggressively.** Deep Power Down after ~1000 ms of inactivity; the
  BLE link drops after ~60 s (hence the 58 s heartbeat). After *any* disconnect assume
  the device is asleep and not advertising until woken by button, motion or timer.
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
- **`useCapturePreview` is the capture path — don't hand-roll one.** It carries the
  op10/op18 pre-flight that re-enables a camera left disabled by a stopped deployment,
  the Save State/DPD waits that stop `txfile` racing FatFS and corrupting the file
  handle, and the reassembly that turns binary packets into an image URI (with
  byte-level progress). Use it whenever you need an image.
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
- **`setop 10 0` does not stop a running camera.** `cameraSystemEnabled` is loaded from
  op10 only when the image task starts, so the write lands at the next wake. `AI enable` /
  `AI disable` change both. To turn the camera on *now*, write op10 **and** send
  `AI enable`. The inverse of this trap is documented on the firmware side.
- **A local dev build destroys the production app's data.** `app.config.ts` derives an
  `.expo`-suffixed bundle ID from `APP_VARIANT`, but the tracked
  `android/app/build.gradle` hardcodes `applicationId 'com.wildlife.wildlifewatcher'` —
  and because `android/` is committed, prebuild never regenerates it, so the variant
  logic is dead on Android. A debug build therefore collides with the Play Store build
  on package name while carrying a different signature: the install fails with
  `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, and the only way through is uninstalling the
  store app — taking its WatermelonDB, anything unsynced in the outbox, and the login
  session with it. **Warn the operator before they uninstall; there may be unsynced
  field data.** The proper fix — `applicationIdSuffix ".expo"` on the debug buildType so
  both coexist — is **still not applied**.
- **`npm install --ignore-scripts` breaks the build.** It skips `postinstall`, so
  `patch-package` never applies `patches/`, and the native build then fails somewhere
  unrelated-looking.
- **…but on Windows plain `npm install` fails anyway.** The `maestro` devDependency's
  postinstall runs `./bin/welcome-message.sh`, which `cmd.exe` cannot execute
  (`'.' is not recognized`), and npm aborts the whole install. On Windows use:
  `npm install --ignore-scripts` then `npx patch-package` — that reaches the same state
  as `postinstall` (`npx patch-package && npm run validate:deps`) without maestro's
  broken script. Maestro is E2E-only; the app build does not need it.
- **`ftx err 1` after a failed transfer.** The nRF's session is still open; every new
  `FILE_START` is rejected until the link drops. Disconnect/reconnect to clear. On iOS
  with BLE firmware < 0.30.48 the transfer dies mid-file and re-creates this state — fix
  the firmware rather than retrying.
- **8.3 filenames, uppercase.** The transfer validator rejects anything else *before*
  sending, so a lowercase extension means the file silently never reaches the SD card.
  Max 12 characters (a firmware truncation bug makes 13+ fail confusingly later).
- **Play Store installs can be blocked invisibly.** Play Console → Protected with Play →
  Store listing device checks filters devices, and those exclusions are deliberately
  absent from the Device catalog tables. See `documentation/resources/publishing_guide.md`.
- **Version bumps are six files.** `package.json`, `app.config.ts` (×2),
  `android/app/build.gradle` (×2), `strings.xml`, and `package-lock.json` (only refreshed
  by `npm install` — it sat three versions behind until Aug 2026). Because `android/` is
  tracked, EAS reads the *native* values and ignores `app.config.ts`.
  `npm run version:check` catches all six.
- **`eas.json` has five profiles, not three**, and `production` in the GitHub workflow
  also **submits to the stores**. Check before dispatching a build.
- **A failed submission tells you nothing through the web console.** It shows a bare
  `ERRORED` with `error: null`, `logFiles: []` and `completedAt: null` — because it failed
  before uploading, so there is nothing to log. **Re-run the same submission from the CLI**
  (`eas submit --platform ios --profile production --id <buildId>`): it prints the actual
  Apple response. That is how a month-old mystery turned out to be one wrong number.
- **Store identifiers must match EAS's credential records, not memory.** A stale
  `ascAppId` in `eas.json` made every iOS submission fail instantly
  (`There is no resource of type 'apps' with id '…'`). Query what the stored App Store
  Connect key can actually see rather than guessing — `remoteAppStoreConnectApps` on the
  EAS GraphQL API lists it. Note the **web console ignores `eas.json` entirely** and uses
  stored credentials, so a value being wrong there can hide until CI submits.
- **`CI=1` in your shell changes behaviour.** `sync-types-cloud.js` treats
  `process.env.CI` as strict mode: a failed type sync becomes fatal instead of a warning,
  so `npm run android` dies at step 2. Don't export `CI` locally.
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

- **Merge stderr.** `java -version` writes to **stderr**; `adb devices` to stdout. A
  helper that captures only stdout reports "java not on PATH" for a perfectly good JDK.
  Use `cmd 2>&1`.
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
