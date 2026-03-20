---
description: Git branching rules — NEVER commit directly to protected branches
---

# Git Branching Rules

## Protected Branches (NEVER commit directly)
- `main` — production
- `dev` — development integration

> **CRITICAL**: Always create a feature branch before committing. Never commit directly to `main` or `dev`.

## Branch Naming Conventions
- `fix/<short-description>` — bug fixes
- `feature/<short-description>` — new features
- `chore/<short-description>` — maintenance, CI, tooling

## Workflow
// turbo-all

1. Check current branch: `git branch --show-current`
2. If on a protected branch, create a new branch: `git checkout -b <type>/<description>`
3. Make changes and commit to the feature branch
4. Push: `git push origin <branch-name>`
5. Create a PR to merge into `dev` (or `main` for releases)
