# Git Branch and PR Workflow

This document describes the team's process for managing branches, pull requests, and code review for the **Wildlife Watcher Mobile App**. The goal is a **clean, linear commit history** with every change reviewed and validated by our CI/CD pipeline before it lands.

## Branch Strategy

| Branch | Purpose | Direct commits? |
|--------|---------|-----------------|
| `main` | Stable production releases (Semantic Release targets) | **Never** — only merged from `dev` via PR |
| `dev` | Integration branch (head branch for all work) | **Never** — only merged from feature branches via PR |
| `feature/*`, `fix/*`, `chore/*`, etc. | Individual task or feature work, bug fixes | Yes |

> [!IMPORTANT]
> All work starts and ends with `dev`. Never commit directly to `dev` or `main`.

---

## 1. Start a New Task — Create a Feature Branch

Always branch from the latest `dev`:

```bash
# Make sure you are on dev and it is up to date
git checkout dev
git pull origin dev

# Create a new branch for your task
git checkout -b feature/my-task-description
```

Use a short, descriptive name: `feature/ble-timeout-fix`, `feature/add-maps-screen`, `fix/login-validation`, etc.

---

## 2. Do Your Work — Commit Often

Make small, focused commits as you work. We use **Husky** and **lint-staged** to automatically run ESLint, TypeScript checks, and unit tests on every commit, ensuring broken code never enters the repository.

```bash
git add -A
git commit -m "feat: add retry logic for BLE command timeout"
```

### Conventional Commits
The mobile app repository enforces **[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)**. Your commit message must start with a recognized type (this powers our automated semantic versioning and changelogs):
*   `feat:` — A new feature
*   `fix:` — A bug fix
*   `chore:` — Maintenance, updating dependencies, CI changes
*   `docs:` — Documentation only changes
*   `refactor:` — Code change that neither fixes a bug nor adds a feature

*Note: If your commit message does not follow this format, the Husky hook will reject it!*

---

## 3. Before Pushing — Rebase onto `dev`

Before you push (or create a PR), rebase your branch onto the latest `dev` to keep a **linear history**:

```bash
# Fetch the latest changes from the remote
git fetch origin

# Rebase your branch onto the latest dev
git rebase origin/dev
```

If there are conflicts, Git will pause and let you resolve them file by file:

```bash
# After resolving each conflict:
git add <resolved-file>
git rebase --continue

# If you want to abort and go back to where you were:
git rebase --abort
```

> [!TIP]
> Rebasing rewrites your commits on top of the latest `dev`, producing a clean, linear history instead of merge bubbles.

---

## 4. Push Your Branch

After rebasing, push your branch to the remote. If you have already pushed before the rebase, you will need to force-push:

```bash
# First push
git push origin feature/my-task-description

# After a rebase (if you previously pushed)
git push --force-with-lease origin feature/my-task-description
```

> [!WARNING]
> Use `--force-with-lease` (not `--force`) to avoid accidentally overwriting someone else's changes.

---

## 5. Create a Pull Request

1. Go to the repository page on **GitHub.com**.
2. Click the **"Pull requests"** tab near the top.
3. Click the green **"New pull request"** button.
4. On the "Compare changes" page, choose the correct branches:
   - **base:** `dev` (This is the destination your changes will merge into)
   - **compare:** `feature/my-task-description` (This is your branch with the new changes)
   > [!IMPORTANT]
   > Do not target `main` directly. All new work should be merged into `dev`.
5. Give the PR a clear, descriptive title.
6. Fill out the description explaining **what** was changed and **why**.
7. Link any related issues or tasks.
8. Click the green **"Create pull request"** button to submit.

---

## 6. Code Review & CI Pipeline

### Automated CI Checks (GitHub Actions)
When you open a PR against `dev` or `main`, multiple GitHub Actions will run automatically to validate your code. **All these checks must pass before a merge is allowed**:
1. **Commitlint:** Verifies all commits in the PR follow the Conventional Commits format.
2. **Quality Gates:** Runs ESLint, TypeScript compiler (`tsc --noEmit`), and Unit/Integration tests on multiple Node.js versions.
3. **Native Build Validation:** Performs sanity checks for both Android (`gradlew assembleDebug`) and iOS (`xcodebuild`) to catch autolinking or native configuration errors.
4. **E2E UI Tests:** Runs a full Maestro UI test suite on a hardware-accelerated local Android emulator.

### Code Review
- **Address automated feedback**: If a GitHub Action fails, or Gemini code review leaves comments, use interactive rebase (`git rebase -i`) to amend your commits and force-push the changes. This keeps the commit history clean.
- **Request Human Review**: Request a review from at least one team member.
- **Approve and Merge**: Once approved and all CI checks are green, the PR author or reviewer can merge the PR into `dev`.

---

## 7. Switching to a Different Task (Staggered Development)

If you finish a task, open a PR for it, and want to keep progressing without waiting for it to be reviewed and merged, you have two options depending on whether your next task **depends** on the previous one.

### Option A: Independent Tasks (Parallel Branches)
If your new task is **completely unrelated** to the un-merged PR, branch off `dev`:

```bash
# 1. Commit or stash your current work
git add -A && git commit -m "chore: WIP/Finish task 1"

# 2. Go back to dev. (Your HEAD now points to your local dev branch)
git checkout dev

# 3. Fetch from remote and pull the latest
git pull origin dev

# 4. Create a new branch for the independent task
git checkout -b feature/independent-task
```

### Option B: Dependent Tasks (Stacked Branches)
If your new task **depends** on the changes in your un-merged PR (e.g., you did a fix, and now want to build a feature relying on that fix), branch off your current un-merged branch instead of `dev`.

```bash
# 1. Ensure your HEAD is on the completed, un-merged branch
git checkout feature/task-1-fix

# 2. Create a new local branch directly from this one
git checkout -b feature/task-2-new-feature

# 3. Work on task 2, commit, and push
git add -A && git commit -m "feat: add new feature based on task 1 fix"
git push origin feature/task-2-new-feature
```

**Iterating Further (Staggered PRs)**:
- When creating the **Pull Request** for `task-2` on GitHub, make sure to change the **"base" branch** dropdown from `dev` to `feature/task-1-fix`. This ensures the PR only shows your new additions for `task-2`.
- If `task-1-fix` receives feedback and is updated during code review, its `HEAD` will move. You will need to **rebase** `task-2` onto it so you inherit those updates: 
  ```bash
  git checkout feature/task-2-new-feature
  git rebase feature/task-1-fix
  ```

---

## 8. Post-Merge Cleanup

After your pull request is merged into `dev`, delete your feature branch both remotely (on GitHub) and locally to keep the repository clean.

**Locally:**
```bash
# Switch back to dev and pull the latest changes
git checkout dev
git pull origin dev

# Delete your local feature branch
git branch -d feature/my-task-description
```
If Git complains that the branch is not fully merged (because of a squash merge on GitHub), you can force delete it with: `git branch -D feature/my-task-description`.

---

## Quick Reference Cheat-sheet

```bash
# New task
git checkout dev && git pull origin dev
git checkout -b feature/my-task

# Work & commit (Must use Conventional Commits!)
git add -A && git commit -m "feat: describe what you did"

# Ready to push — rebase first
git fetch origin && git rebase origin/dev
git push origin feature/my-task          # first time
git push --force-with-lease origin feature/my-task  # after rebase

# Post-merge cleanup
git checkout dev && git pull origin dev
git branch -d feature/my-task # Use -D if needed
```
