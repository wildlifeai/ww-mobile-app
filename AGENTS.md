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
  in the Seeed repo). A cross-repo contract — never renumber unilaterally.
- **The schema is generated, not written.** `src/database/schema.ts` comes from
  `npm run schema:generate`; schema changes originate in `wildlife-watcher-backend`.
- **Security lives at the sync boundary, not on the client.** Role checks in the app are
  UX; Supabase RLS is the enforcement. Never treat a local query as authoritative for
  data belonging to other users.
- **Version bumps touch six files.** `npm run version:check` is the gate — EAS reads the
  native Android values, not `app.config.ts`.
- Docs are the record, GitHub issues are the tracker: substantive findings go in
  `documentation/development reports/`, open items become issues (they auto-add to the
  [project board](https://github.com/orgs/wildlifeai/projects/3)).

## Where things are

| | |
|---|---|
| Start here as a human | `documentation/onboarding/00-GETTING-STARTED.md` (six guides, in order) |
| Structure, hooks, services | `documentation/onboarding/02-CODEBASE-GUIDE.md` — the maintained inventory |
| BLE engine | `src/ble/` — protocol/, session/, workflows/; deep dive in `documentation/resources/BLE_Architecture.md` |
| Device flows | `documentation/onboarding/05-DEVICE-FLOWS.md`, `06-BLE-CONNECTIONS.md` |
| Offline/sync | `documentation/onboarding/03-DATA-AND-SYNC.md` |
| How the code got this way | `documentation/development reports/` |
| Known doc drift | `documentation/DOCUMENTATION-AUDIT.md` |
