# React Doctor Guide

> **Related**: [Testing-Guide.md](Testing-Guide.md) (CI/CD overview), [quality-gate-validation.yml](../../.github/workflows/quality-gate-validation.yml) (quality gates).

## What is React Doctor?

[react-doctor](https://github.com/millionco/react-doctor) scans React / React Native codebases for 60+ rules across:

| Category | Examples |
|----------|----------|
| **Security** | `dangerouslySetInnerHTML`, unescaped expressions |
| **Performance** | Inline objects in JSX, missing `useMemo`/`useCallback` |
| **Correctness** | Stale closures in effects, missing dependency arrays |
| **Architecture** | Overly large components, deeply nested prop drilling |
| **Dead Code** | Unused files, exports, types, and duplicates |

It outputs a **0–100 health score** (75+ Great, 50–74 Needs work, <50 Critical).

## How It's Integrated

### Automatic — Every PR

The `react-doctor.yml` workflow runs automatically on every pull request. The health score is posted to the **job summary** (visible in the PR's Checks tab) and as a sticky PR comment. The workflow runs with `blocking: 'error'`, so a finding at error severity fails the check on a PR; warnings never do. On a push to a branch the run is a health snapshot and never fails.

The action tag and the CLI `version:` in the workflow are pinned as a pair. A Dependabot bump moves only the action tag, so bump the CLI with it (#329 showed the failure mode: the action passes a flag the old CLI rejects).

### Manual — On Demand

1. Go to **Actions** → **React Doctor Review** → **Run workflow**
2. Optionally toggle verbose output
3. Click **Run workflow**

### Running Locally

```bash
npx -y react-doctor@latest .             # quick scan
npx -y react-doctor@latest . --verbose   # with file-level details
```

## Configuration

The config file is `doctor.config.json` at the project root.

### Ignored Rules

The following `jsx-a11y` rules are suppressed because they target HTML DOM elements and are not applicable in React Native:

- `jsx-a11y/no-autofocus`
- `jsx-a11y/accessible-emoji`
- `jsx-a11y/anchor-is-valid`
- `jsx-a11y/click-events-have-key-events`
- `jsx-a11y/no-static-element-interactions`
- `jsx-a11y/no-noninteractive-element-interactions`

Additionally, `doctor.config.json` ignores baseline aesthetic warnings that are not strict bugs (e.g., `prefer-module-scope-pure-function`, `jsx-pascal-case`) and suppresses `deadCode` checking (`"deadCode": false`) to prevent false-positives like `unused-file` on Expo navigation routes.

### Ignored Files

| Pattern | Reason |
|---------|--------|
| `android/**`, `ios/**` | Native platform code, not React |
| `scripts/**`, `patches/**`, `archive/**` | Tooling and legacy code |
| `**/*.test.ts`, `**/*.test.tsx`, `**/__tests__/**`, `**/__mocks__/**` | Test files |
| `src/types/database.types.ts` | Auto-generated Supabase types |
| `supabase/**` | SQL schema dumps. CLI 0.9.x reads `service_role` in a `GRANT` as a leaked secret (`artifact-secret-leak`), and `supabase-table-missing-rls` only looks in the `CREATE TABLE` file while RLS is enabled in `xxx_rls/` and `yyy_policies/`. Both are false positives here. |

### Rules at error severity

CLI 0.9.14 added `effect-needs-cleanup`, `no-ref-current-in-render` and `no-impure-state-updater` at error severity and found 11 existing cases, fixed in #380. They run at their default severity, so a new case fails the PR. Two of them have a shape the rule does not accept even when the code is sound: a timer whose `async` callback re-arms it (an await in flight could re-arm after cleanup; keep the callback synchronous and await in a helper), and a ref written during render to hand a fresh closure to a long-running loop (write it in an effect instead).

### Updating the Config

To add a new ignored rule, file pattern, or configuration option:

```jsonc
// doctor.config.json
{
  "deadCode": false,
  "ignore": {
    "rules": ["plugin/rule-name"],   // add rule ID here
    "files": ["path/glob/**"]        // add file glob here
  }
}
```

Alternatively, use the `"reactDoctor"` key in `package.json` (config file takes precedence).

## Interpreting Results

- **Score 75–100** — Great. No action needed.
- **Score 50–74** — Needs work. Review the flagged diagnostics.
- **Score <50** — Critical. Prioritise fixing the most severe issues.

- The CLI's score moves with its rule set: 0.5.1 reported no issues, 0.9.14 reported 85 warnings and a score of 62 before #380, 70 warnings after. Compare scores only across the same CLI version.

Use `--verbose` (enabled by default in CI) to see which files and line numbers are affected by each rule.

---

**Last Updated**: 2026-10-02
