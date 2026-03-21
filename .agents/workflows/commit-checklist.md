---
description: Pre-commit checklist — read repo contributing guidelines and review documentation before committing
---

# Pre-Commit Checklist

Follow this checklist before every commit.

## 1. Read the Repo's Contributing Guidelines

Before any git operation, find and read the repo's contributing guidelines:

1. Search for `CONTRIBUTING.md` in the repo root, `.github/`, or `docs/`
2. Read and follow its branching strategy, commit conventions, and PR guidelines **exactly**
3. If on a protected branch, create a feature branch before committing as described in the guidelines

> The contributing guidelines are the **single source of truth** for each repo's git workflow.

## 2. Review and Update Documentation

Before committing code changes, check if relevant documentation needs updating.

**Applies when changes affect any documented behavior:**
- Workflows or multi-step flows (e.g., device preparation, deployment, sync)
- Communication protocols (BLE, API, LoRaWAN)
- Database schema, models, migrations, or services
- Architecture, navigation, or screen structure
- CI/CD pipelines, build processes, or versioning

**Steps:**

1. **Find documentation in the repo** — search for `*.md` files that reference the changed functions, files, commands, or concepts. Skip `node_modules/`, `archive/`, and similar non-documentation directories.
2. **Read the relevant sections** — check if described behavior, command sequences, step tables, or architecture descriptions are now outdated by the code change.
3. **Update if needed** — update step tables, flow descriptions, architecture notes, and the "Last Updated" date.
4. **Skip if not needed** — minor refactors, formatting, test-only changes, or changes to undocumented code do not require doc updates.
5. **Include doc changes in the same commit** — documentation updates should ship with the code change, not as a separate commit.
