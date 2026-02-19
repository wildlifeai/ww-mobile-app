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

The `react-doctor.yml` workflow runs automatically on every pull request. The health score is posted to the **job summary** (visible in the PR's Checks tab). This is **informational only** — it will not block a PR from merging.

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

The config file is `react-doctor.config.json` at the project root.

### Ignored Rules

The following `jsx-a11y` rules are suppressed because they target HTML DOM elements and are not applicable in React Native:

- `jsx-a11y/no-autofocus`
- `jsx-a11y/accessible-emoji`
- `jsx-a11y/anchor-is-valid`
- `jsx-a11y/click-events-have-key-events`
- `jsx-a11y/no-static-element-interactions`
- `jsx-a11y/no-noninteractive-element-interactions`

### Ignored Files

| Pattern | Reason |
|---------|--------|
| `android/**`, `ios/**` | Native platform code, not React |
| `scripts/**`, `patches/**`, `archive/**` | Tooling and legacy code |
| `**/*.test.ts`, `**/*.test.tsx`, `**/__tests__/**`, `**/__mocks__/**` | Test files |
| `src/types/database.types.ts` | Auto-generated Supabase types |

### Updating the Config

To add a new ignored rule or file pattern:

```jsonc
// react-doctor.config.json
{
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

Use `--verbose` (enabled by default in CI) to see which files and line numbers are affected by each rule.

---

**Last Updated**: 2026-02-20
