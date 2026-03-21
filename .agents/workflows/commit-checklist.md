---
description: Pre-commit checklist — read repo contributing guidelines and review documentation before committing
---

# Pre-Commit Checklist

Follow this checklist before every commit.

## 1. Read the Contributing Guidelines

Before any git operation, find and read the contributing guidelines. Check these locations **in order** and use the first one found:

1. **Repo-level**: `CONTRIBUTING.md` in the repo root, `.github/`, or `docs/`
2. **Organisation-level** (fallback): `https://github.com/wildlifeai/.github/blob/main/CONTRIBUTING.md`

Read and follow its branching strategy, commit conventions, and PR guidelines **exactly**.

> The contributing guidelines are the **single source of truth** for each repo's git workflow.
> If no repo-level file exists, the organisation default applies.

## 2. Review and Update Documentation

Before committing code changes, check if relevant documentation needs updating.

### Where documentation lives

Search for `*.md` files in **all** of these directories (not just `docs/`):

| Priority | Path | Notes |
|----------|------|-------|
| 1 | `documentation/` | Primary docs directory (onboarding guides, resource guides) |
| 2 | `docs/` | Alternative docs directory (if present) |
| 3 | Repo root | `README.md`, `CHANGELOG.md`, etc. |

> **IMPORTANT**: The docs directory may vary per repo. Always check `documentation/` AND `docs/` — do not assume either.

Skip `node_modules/`, `archive/`, and similar non-documentation directories.

### Steps

1. **Find documentation in the repo** — search for `*.md` files in the directories listed above that reference the changed functions, files, commands, or concepts.
2. **Read the relevant sections** — check if described behavior, command sequences, step tables, or architecture descriptions are now outdated by the code change.
3. **Update if needed** — update step tables, flow descriptions, architecture notes, and the "Last Updated" date.
4. **Skip if not needed** — minor refactors, formatting, test-only changes, or changes to undocumented code do not require doc updates.
5. **Include doc changes in the same commit** — documentation updates should ship with the code change, not as a separate commit.