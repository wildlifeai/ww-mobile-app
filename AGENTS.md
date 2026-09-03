# Agent guide — Wildlife Watcher mobile app

React Native + Expo app for deploying and managing WW500 wildlife cameras. It talks to
the camera over BLE, stores everything locally in WatermelonDB, and syncs to Supabase.
Built for the field: **connectivity is the exception, not the rule.**

**Before changing code or docs, read
[`.agents/skills/SKILL.md`](.agents/skills/SKILL.md)** — workflow rules, the cross-repo
contracts that will bite you, and the traps a code-read won't reveal. This file is only
the quickstart.

## Run it

```bash
npm install                                   # macOS/Linux
npm install --ignore-scripts && npx patch-package   # Windows (see note)
npm run android:doctor   # JDK 17, Android SDK, adb device, Supabase env
npm run android          # preflight → types → schema sync → build → launch
npm run android:local    # skips the two network steps (fast iteration loop)
```

`postinstall` applies `patches/` via patch-package — skipping it breaks the native build.
On Windows plain `npm install` aborts on the `maestro` package's shell postinstall, so run
`patch-package` by hand as above.

Needs a `.env.development` (copy `.env.example`, paste the Dev anon key) — the app cannot
reach Supabase without it. iOS builds require macOS; there is no tracked `ios/` directory.

> [!NOTE]
> A local debug build installs as `com.wildlife.wildlifewatcher.expo` and shows up as
> "Wildlife Watcher (Dev)", so it sits alongside the Play Store app instead of replacing
> it. Nothing to uninstall, and no field data at risk.
>
> **EAS `preview` and `staging` builds are a different matter.** They are release-type, so
> they still carry the production package name and a different signature: installing one
> means **uninstalling the store app, destroying its local database and anything
> unsynced**. Check with the device owner before doing that on a phone carrying field data.

## Check it

```bash
npm test                 # Jest
npm run type-check       # tsc --noEmit
npm run lint             # ESLint
npm run version:check    # the 5 files carrying the app version agree
npm run docs:validate    # every path/link in documentation/ resolves
```

## Non-negotiables

- **Ask the maintainer before committing or pushing** to any shared branch.
- **`commandRegistry.ts` is the only place BLE commands are defined.** Never match device
  responses anywhere else; `messageClassifier.ts` is UI presentation only.
- **OP parameter indices mirror the firmware** (`OP_PARAMETER` here ↔ `OP_PARAMETERS_E`
  in the Seeed repo). A cross-repo contract — never renumber unilaterally. So are the
  self-test bit numbers and the `AE light check` line's fields.
- **The device tells you things you didn't ask for.** Self-test bits after every wake, the
  light decision after every check, motion grids while monitoring. Check for an existing
  broadcast before adding a command that polls — one already cost us a stale banner that
  made a working camera look broken.
- **The schema is generated, not written.** `src/database/schema.ts` comes from
  `npm run schema:generate`; schema changes originate in `wildlife-watcher-backend`. Its
  `version:` moves only on a real table change — and must never be edited downwards.
- **Don't export `CI` locally.** It puts the type sync into strict mode and `npm run
  android` dies at step 2.
- **Security lives at the sync boundary, not on the client.** Role checks in the app are
  UX; Supabase RLS is the enforcement. Never treat a local query as authoritative for
  data belonging to other users.
- **Version bumps touch six files.** `npm run version:check` is the gate — EAS reads the
  native Android values, not `app.config.ts`.
- Docs are the record, GitHub issues are the tracker: substantive findings go in
  `documentation/development reports/` as a dated thread folder, open items become issues
  (they auto-add to the [project board](https://github.com/orgs/wildlifeai/projects/3)).
  A report records **how the work happened**; how the code behaves belongs in
  `onboarding/` or `resources/`. Convention and checklist:
  [development reports/README.md](documentation/development%20reports/README.md).

## Where things are

| | |
|---|---|
| Start here as a human | `documentation/onboarding/00-GETTING-STARTED.md` (six guides, in order) |
| Structure, hooks, services | `documentation/onboarding/02-CODEBASE-GUIDE.md` — the maintained inventory |
| BLE engine | `src/ble/` — protocol/, session/, workflows/; deep dive in `documentation/resources/BLE_Architecture.md` |
| Day/night light sensor | `documentation/resources/Light-Sensor.md` — op23/24/25/26, `AI light`, and why op25 reads stale |
| Capture Picture | `documentation/resources/Capture-Picture.md` — the capture in order, the 3 s hold, what applies at wake, the flash gate and its interim write |
| Device flows | `documentation/onboarding/05-DEVICE-FLOWS.md`, `06-BLE-CONNECTIONS.md` |
| Offline/sync | `documentation/onboarding/03-DATA-AND-SYNC.md` |
| How the code got this way | `documentation/development reports/` |
| Known doc drift | `documentation/DOCUMENTATION-AUDIT.md` |
