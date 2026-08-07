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

## 2. Cross-repo contracts — never change unilaterally

The app is one of four repos around one device. These interfaces are shared, and
changing one side silently breaks the other:

| Contract | Here | Counterpart |
|---|---|---|
| **OP parameter indices** | `OP_PARAMETER` in `src/hooks/useDeviceSettings.ts` | `OP_PARAMETERS_E` in Seeed `ww500_md/fatfs_task.h`; mirrored again in ww-hardware `aiProcessor.h` |
| **BLE command strings** | `src/ble/protocol/commandRegistry.ts` | Seeed `CLI-commands.c` / `CLI-FATFS-commands.c`; relay in ww-hardware |
| **`ftx` file-transfer wire format** | `src/ble/protocol/fileTransfer/` | ww-hardware `fileTx.c` ↔ Seeed `fileRx.c` |
| **Database schema** | `src/database/schema.ts` (generated) | **owned by** `wildlife-watcher-backend` — schema changes start there |
| **AI model / firmware filenames** | `deploymentPipeline.ts`, `useFirmwareUpdate.ts` | Seeed `xip_manager.c` parser |

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
- **A stale scan entry will hang you.** Auto-connect only trusts a device seen in the
  current scan session (`lastSeen` gate) — a just-disconnected device lingers in cache
  and connecting to it hangs until timeout.
- **`commandQueue` does not exist.** The queue is `bleTransportController.ts`. Old docs
  and comments still name the former.

## 4. Traps that have already cost time

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

## 5. Data and sync

- **Redux holds no domain data.** Projects, deployments, devices live in WatermelonDB and
  reach the UI through `withObservables`. Redux is session + UI state only.
- **RLS blindspot.** A local query only ever sees what the current user was allowed to
  sync. Never compute a cross-user aggregate (member counts, global lists) from a local
  query — fetch it from the cloud and degrade gracefully offline.
- Writes go to WatermelonDB first; the outbox syncs them. Never block the UI on network.

## 6. Documentation

- `documentation/onboarding/` = the guided path (six numbered guides).
  `documentation/resources/` = deep dives. `documentation/development reports/` = how
  decisions were reached.
- Point at code for anything that drifts (schema version, table counts, route lists).
  `npm run docs:validate` fails CI on a dead path or link.
- Substantive discussion belongs in a dated thread under `development reports/`; anything
  still open when the thread pauses becomes a GitHub issue.
