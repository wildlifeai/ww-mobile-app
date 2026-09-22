---
name: ww-mobile-app
description: Working rules, guardrails and hardware-contract traps for the Wildlife Watcher mobile app (React Native + Expo, BLE to WW500, WatermelonDB + Supabase offline sync). Read before changing code or docs in this repo.
---

# Wildlife Watcher mobile app, working knowledge

Read [`AGENTS.md`](../../AGENTS.md) first for the quickstart. This file is the layer
underneath: the rules that apply to any change, and a map to the detail. The reference files
hold the things that have already cost someone a day, so read the one that matches your task
rather than all of them.

## Read this one next

| If you are touching | Read |
|---|---|
| Anything under `src/ble/`, or a hook or screen that talks to a device | [references/ble.md](references/ble.md) |
| An op parameter index, a command string, the file-transfer format, the schema, a self-test bit | [references/cross-repo-contracts.md](references/cross-repo-contracts.md) |
| A flow that fails in a way that looks like an app bug | [references/traps.md](references/traps.md) |
| Sync, the outbox, WatermelonDB, the schema version | [references/data-and-sync.md](references/data-and-sync.md) |
| Anything in `scripts/` | [references/tooling.md](references/tooling.md) |
| Documentation, a development report, or your own commit hygiene | [references/documentation.md](references/documentation.md) |
| The developer settings screen, Dev Build Info, or the first-run tutorial | [Developer-Settings.md](../../documentation/resources/Developer-Settings.md) |

## Workflow

- **Never commit or push to a shared branch without asking the maintainer.** This is a hard
  rule in this repo, not a courtesy.
- **Check the agent layer before each commit.** Decide whether this change makes anything in
  `AGENTS.md`, this file or a reference file wrong, missing or redundant, and fix it in the
  same commit. The three questions are in
  [references/documentation.md](references/documentation.md).
- Conventional Commits, enforced by `commitlint`. Branch names use `feat/`, `fix/`, `chore/`
  and `docs/`.
- Before you claim work is done, run the gates that exist precisely because things drifted
  before: `npm run type-check`, `npm run lint`, `npm test`, `npm run version:check`,
  `npm run docs:validate`.
- Do not hand-edit generated files: `src/database/schema.ts`, from `schema:generate`, and
  `src/types/database.types.ts`, from `types:cloud-dev`.
- **Verify against the code, not the docs**, and read what a passing check actually counted.
  Both habits have a history, recorded in [references/tooling.md](references/tooling.md).
- **No em dashes** in documents or anything else destined to be pasted elsewhere. Commas, or a
  new sentence.

### PRs are squash-merged, and the branch is auto-deleted

Two consequences:

1. Squashing rewrites the commit SHAs, so a branch built on the pre-merge commits shows every
   already-merged commit again as new. After a PR merges, run `git fetch` and branch fresh from
   `dev`, then cherry-pick your unmerged work across rather than opening a PR from the old
   branch.
2. Pushing to the deleted branch **silently recreates it** instead of failing. If a push
   reports `[new branch]` for a branch you know existed, it was merged and deleted underneath
   you. Stop and rebuild before opening anything.

## The five that apply to almost any change

1. **`commandRegistry.ts` is the only place BLE commands are defined**, and the only place
   device responses are matched.
2. **Connecting writes nothing to the device.** Every write belongs to a flow the user opened.
3. **The device sleeps after about a second and drops the link after about a minute.** Assume
   asleep after any disconnect.
4. **The project owns the camera's settings, the device is where they land.** A setting with no
   home in the project is a setting no deployment will ever carry.
5. **The device tells you things you did not ask for**, self-test bits after every wake and the
   light decision after every check. Look for an existing broadcast before adding a poll.
