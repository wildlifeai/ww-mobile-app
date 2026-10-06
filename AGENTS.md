# Agent guide, Wildlife Watcher mobile app

React Native + Expo app for deploying and managing WW500 wildlife cameras. It talks to
the camera over BLE, stores everything locally in WatermelonDB, and syncs to Supabase.
Built for the field: **connectivity is the exception, not the rule.**

**Before changing code or docs, read
[`.agents/skills/SKILL.md`](.agents/skills/SKILL.md)**: the workflow rules, the five that
apply to almost any change, and a map to the reference files that carry the detail (BLE,
cross-repo contracts, traps, data and sync, tooling, documentation). This file is only the
quickstart.

## Run it

```bash
npm install
npm run android:doctor   # JDK 17, Android SDK, adb device, Supabase env
npm run android          # preflight, types, schema sync, build, launch
npm run android:local    # skips the two network steps (fast iteration loop)
```

`postinstall` applies `patches/` via patch-package, and skipping it breaks the native build.
Plain `npm install` works on Windows since October 2026, when the npm package `maestro` (an
unrelated AWS tool whose shell postinstall aborted the install) left `devDependencies`; if an
install still dies in a postinstall, `npm install --ignore-scripts && npx patch-package` reaches
the same state. Mobile Maestro is a separate CLI, see the Testing Guide.

Needs a `.env.development`, copied from `.env.example` with the Dev anon key pasted in. The
app cannot reach Supabase without it. iOS builds require macOS; there is no tracked `ios/`
directory.

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
npm run test:maestro:smoke   # the one E2E flow CI requires: install, launch, the login screen renders
```

All of these run in CI on each pull request; the smoke flow runs after the native build,
which a docs-only PR skips. CI builds the release-type `e2e` EAS profile for it, because a
development client carries no JavaScript and only ever showed Expo's launcher. The fuller
flows (`E2E Full`, on the `full-e2e` label) sign in as a seeded cloud-dev user from two
secrets; what each proves is in the Testing Guide. Every check that can be required also runs on `merge_group`,
so `dev` can sit behind a merge queue without touching the workflows. PR-Agent is the one
that cannot: it triggers on open and on comments, so it stays advisory.
The coverage floor is a ratchet at 20%: it only moves up, by hand.
Expo Doctor gates dependency changes; CodeQL, Schema Mirror Drift, Dead Code, Dependency Audit
and Op Index Drift are advisory, and iOS builds once a week. The Testing Guide's CI/CD table lists every workflow,
what it proves and whether it blocks.

## Non-negotiables

- **Ask the maintainer before committing or pushing** to any shared branch.
- **Check the agent layer before each commit.** Ask whether the change makes anything in this
  file, the skill or its reference files wrong, missing or redundant, then add, edit or delete
  in the same commit. The three questions are in
  [`.agents/skills/references/documentation.md`](.agents/skills/references/documentation.md).
  A confidently wrong skill costs more than a thin one.
- **No em dashes** in documents or anything else that gets pasted elsewhere. Commas, or a new
  sentence.
- **No AI attribution on a commit or a pull request.** No `Co-Authored-By: Claude`, no model
  name, no generated-with footer. A commit message ends with its last paragraph or its
  `Closes #N` line, and a PR description ends with its own last line. The history and the PR
  queue are read by outside collaborators and funders, the same reason the em dash rule exists.
- **`commandRegistry.ts` is the only place BLE commands are defined.** Never match device
  responses anywhere else; `messageClassifier.ts` is UI presentation only.
- **OP parameter indices mirror the firmware**, where `OP_PARAMETER` here matches
  `OP_PARAMETERS_E` in the Seeed repo. That is a cross-repo contract, never renumber
  unilaterally. So are the self-test bit numbers and the `AE light check` line's fields.
- **The project owns the camera's settings, the device is where they land.** Capture method,
  sensitivity, model, GPS, the capture flash (#282), the pictures per trigger and their
  interval (#317) and, since #342, the model's detection threshold all live on the `projects`
  row and are written to the device after the deployment reset. A setting with no home in the
  project is a setting that no deployment will ever carry. Beware the two halves of that
  contract in `SupabaseSyncService.syncProjects` and ww-backend's `push_changes`: both name
  their columns by hand, and both have silently dropped some (#285, ww-backend #170). The app
  half is now guarded: `syncProjects.columns.test.ts` fails when a local `projects` column has
  no pull line.
- **The device tells you things you didn't ask for.** Self-test bits after every wake, the
  light decision after every check, motion grids while monitoring. Check for an existing
  broadcast before adding a command that polls. One already cost us a stale banner that
  made a working camera look broken.
- **The schema is generated, not written.** `src/database/schema.ts` comes from
  `npm run schema:generate`; schema changes originate in `wildlife-watcher-backend`. Its
  `version:` moves only on a real table change, and must never be edited downwards.
- **Don't export `CI` locally.** It puts the type sync into strict mode and `npm run
  android` dies at step 2.
- **Security lives at the sync boundary, not on the client.** Role checks in the app are
  UX; Supabase RLS is the enforcement. Never treat a local query as authoritative for
  data belonging to other users.
- **Version bumps touch six files.** `npm run version:check` is the gate, because EAS reads the
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
| Structure, hooks, services | `documentation/onboarding/02-CODEBASE-GUIDE.md`, the maintained inventory |
| BLE engine | `src/ble/`, meaning protocol/, session/ and workflows/; deep dive in `documentation/resources/BLE_Architecture.md` |
| Day/night light sensor | `documentation/resources/Light-Sensor.md`: op23 to op26, `AI light`, why op25 reads stale, and the flash mode op34 that decides whether any of it reaches the LED |
| Capture Picture | `documentation/resources/Capture-Picture.md`: the capture in order, the 3 s hold, what applies at wake, and the flash hold that arms the LED for the visit |
| Device flows | `documentation/onboarding/05-DEVICE-FLOWS.md`, `06-BLE-CONNECTIONS.md` |
| Offline/sync | `documentation/onboarding/03-DATA-AND-SYNC.md` |
| Sign-in, sessions, Google sign-in and its setup | `documentation/resources/Authentication-Implementation-Guide.md` |
| E2E flows, the EAS profile CI builds and why, how to read a failed run | `documentation/resources/Testing-Guide.md`, "Maestro E2E Testing" |
| Developer settings, Dev Build Info, first-run tutorial | `documentation/resources/Developer-Settings.md` |
| How the code got this way | `documentation/development reports/` |
