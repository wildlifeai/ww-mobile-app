# GitHub Branch Protection Strategy

To ensure Rock-Solid Stability and prevent CI regressions as established in the new CI/CD strategy, the repository must properly protect the `main` and `dev` branches.

## Required Steps for Repository Admins

Navigate to **Settings -> Branches** in your GitHub repository and create a new protection rule for `main` and `dev`.

### 1. Require Pull Request reviews before merging
- Prevent direct pushes to protected branches.

### 2. Require status checks to pass before merging
This is the most critical step to enforce the production-grade CI pipeline. You must check the following required checks:
- `commitlint` (from `commitlint.yml`)
- `quality-gates` (from `quality-gate-validation.yml`)
- `android-build` (from `native-build-validation.yml`)
- `ios-build` (from `native-build-validation.yml`)
- *(Optional but Recommended for `main`)*: `maestro-e2e` (from `e2e-ui-tests.yml`)

### 3. Require branches to be up to date before merging
- Ensures that code passing CI is valid against the latest base branch.

### 4. Allow force pushes
- **DO NOT check this.** Force pushes should be blocked on `main` and `dev`.

---
By enforcing these rules, no code can be merged if it fails type checks, lint checks, test coverage, or if the native project fails to compile.
