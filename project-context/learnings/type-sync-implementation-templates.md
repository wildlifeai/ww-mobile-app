# Type Synchronization Implementation Templates

**Quick Start Guide**: Copy-paste templates for immediate implementation
**Context**: Mobile App (React Native/Expo) + Backend (Supabase)

---

## Template 1: GitHub Actions Type Validation Workflow

**File**: `.github/workflows/type-validation.yml`
**Estimated Setup**: 15 minutes
**Priority**: HIGH

```yaml
name: Type Synchronization Validation

on:
  pull_request:
    branches: [main, dev-*]
  push:
    branches: [main]

jobs:
  validate-types:
    name: Validate Database Types
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase local instance
        run: |
          supabase start
          echo "Waiting for Supabase services to be ready..."
          sleep 10

      - name: Generate fresh types from database
        run: |
          echo "Generating types from local Supabase instance..."
          supabase gen types typescript --local > /tmp/fresh-types.ts

      - name: Compare with committed types
        run: |
          echo "Comparing generated types with committed types..."
          if ! diff -u src/types/supabase.ts /tmp/fresh-types.ts; then
            echo ""
            echo "❌ ERROR: Types are out of sync with backend schema"
            echo ""
            echo "To fix this issue, run the following command:"
            echo "  npm run types:local"
            echo ""
            echo "Then commit the updated types:"
            echo "  git add src/types/supabase.ts"
            echo "  git commit -m 'chore: sync database types'"
            echo ""
            exit 1
          fi
          echo "✅ Types are synchronized"

      - name: Run TypeScript type check
        run: npm run type-check

      - name: Run tests
        run: npm test -- --passWithNoTests

      - name: Stop Supabase
        if: always()
        run: supabase stop --no-backup

  summary:
    name: Validation Summary
    runs-on: ubuntu-latest
    needs: validate-types
    if: always()

    steps:
      - name: Check validation result
        run: |
          if [ "${{ needs.validate-types.result }}" == "success" ]; then
            echo "✅ All type validations passed"
          else
            echo "❌ Type validation failed"
            exit 1
          fi
```

**Usage**:
```bash
# Test locally (requires nektos/act)
act pull_request

# OR push to test branch
git push origin feature/test-ci
```

---

## Template 2: Nightly Type Reconciliation Workflow

**File**: `.github/workflows/nightly-type-sync.yml`
**Estimated Setup**: 30 minutes
**Priority**: MEDIUM

```yaml
name: Nightly Type Reconciliation

on:
  schedule:
    # Runs at 2 AM UTC every day
    - cron: '0 2 * * *'
  workflow_dispatch:  # Allow manual trigger

jobs:
  reconcile-types:
    name: Check for Type Drift
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1

      - name: Start Supabase local instance
        run: |
          supabase start
          sleep 10

      - name: Generate fresh types
        run: npm run types:local

      - name: Check for type changes
        id: changes
        run: |
          if git diff --exit-code src/types/supabase.ts; then
            echo "changed=false" >> $GITHUB_OUTPUT
            echo "✅ No type drift detected"
          else
            echo "changed=true" >> $GITHUB_OUTPUT
            echo "⚠️ Type drift detected"
          fi

      - name: Create Pull Request
        if: steps.changes.outputs.changed == 'true'
        uses: peter-evans/create-pull-request@v6
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: 'chore: sync database types (automated)'
          title: '🤖 Automated Type Synchronization'
          body: |
            ## Automated Type Synchronization

            This PR was automatically generated because database types have drifted from the committed version.

            ### Changes
            - Updated `src/types/supabase.ts` to match current database schema

            ### Action Required
            - Review the type changes
            - Ensure no breaking changes are introduced
            - Update affected code if necessary
            - Run tests locally: `npm test`

            ### Generated
            - Date: ${{ github.event.head_commit.timestamp }}
            - Workflow: ${{ github.workflow }}
            - Run ID: ${{ github.run_id }}

            ---
            *This is an automated PR. Please review carefully before merging.*
          branch: auto/type-sync-${{ github.run_number }}
          delete-branch: true
          labels: |
            automated
            type-sync
            dependencies

      - name: Stop Supabase
        if: always()
        run: supabase stop --no-backup

  notify:
    name: Send Notifications
    runs-on: ubuntu-latest
    needs: reconcile-types
    if: always() && needs.reconcile-types.outputs.changed == 'true'

    steps:
      - name: Notify via GitHub Comment
        uses: actions/github-script@v7
        with:
          script: |
            const output = `
            ### ⚠️ Type Drift Detected

            Database types have drifted from the committed version.
            An automated PR has been created to sync the types.

            **Action Required**: Review and merge the auto-generated PR.
            `;
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Type Drift Detected - Automated PR Created',
              body: output,
              labels: ['type-sync', 'automated']
            });
```

**Usage**:
```bash
# Test manually via GitHub UI
# Go to: Actions → Nightly Type Reconciliation → Run workflow

# OR test locally
act workflow_dispatch -W .github/workflows/nightly-type-sync.yml
```

---

## Template 3: Enhanced Git Hooks

### Pre-commit Hook

**File**: `.husky/pre-commit`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."

# 1. Lint staged files
echo "→ Linting staged files..."
npx lint-staged

# 2. Fast type check (incremental)
echo "→ Running TypeScript type check..."
npx tsc --noEmit --incremental || {
  echo "❌ TypeScript type check failed"
  exit 1
}

echo "✅ Pre-commit checks passed"
```

### Pre-push Hook

**File**: `.husky/pre-push`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🚀 Running pre-push validations..."

# 1. Check type synchronization
echo "→ Validating type synchronization..."
npm run types:check-local || {
  echo ""
  echo "❌ ERROR: Database types are out of sync"
  echo ""
  echo "Fix by running:"
  echo "  npm run types:local"
  echo ""
  echo "Then commit the changes:"
  echo "  git add src/types/supabase.ts"
  echo "  git commit -m 'chore: sync database types'"
  echo ""
  exit 1
}

# 2. Full TypeScript compilation
echo "→ Running full TypeScript compilation..."
npm run type-check || {
  echo "❌ TypeScript compilation failed"
  exit 1
}

# 3. Run tests
echo "→ Running test suite..."
npm test -- --passWithNoTests || {
  echo "❌ Tests failed"
  exit 1
}

echo "✅ All pre-push validations passed"
```

### Post-merge Hook

**File**: `.husky/post-merge`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔄 Post-merge: Synchronizing environment..."

# 1. Install new dependencies
if git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD | grep --quiet "package-lock.json"; then
  echo "→ Dependencies changed, running npm install..."
  npm install
fi

# 2. Sync types if backend changed
if git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD | grep --quiet "supabase/"; then
  echo "→ Backend schema may have changed, syncing types..."
  npm run types:local
  echo "✅ Types synchronized"
fi

echo "✅ Post-merge synchronization complete"
```

**Setup**:
```bash
# Install husky
npm install --save-dev husky
npx husky init

# Create hooks
npx husky add .husky/pre-commit
npx husky add .husky/pre-push
npx husky add .husky/post-merge

# Copy templates above into each hook file
# Make them executable
chmod +x .husky/pre-commit
chmod +x .husky/pre-push
chmod +x .husky/post-merge
```

---

## Template 4: Type Validation Scripts

### Check Types Script

**File**: `scripts/check-types-local.sh`

```bash
#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Checking type synchronization..."

# Ensure Supabase is running
if ! supabase status > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  Supabase not running. Starting...${NC}"
  supabase start
  sleep 5
fi

# Generate fresh types to temp file
echo "→ Generating fresh types from database..."
TEMP_TYPES=$(mktemp)
supabase gen types typescript --local > "$TEMP_TYPES" 2>&1

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to generate types${NC}"
  cat "$TEMP_TYPES"
  rm "$TEMP_TYPES"
  exit 1
fi

# Compare with committed types
echo "→ Comparing with committed types..."
if diff -q src/types/supabase.ts "$TEMP_TYPES" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Types are synchronized${NC}"
  rm "$TEMP_TYPES"
  exit 0
else
  echo -e "${RED}❌ Types are out of sync${NC}"
  echo ""
  echo "Differences found:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  diff -u src/types/supabase.ts "$TEMP_TYPES" || true
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "To fix, run:"
  echo "  npm run types:local"
  echo ""
  rm "$TEMP_TYPES"
  exit 1
fi
```

**Make executable**:
```bash
chmod +x scripts/check-types-local.sh
```

### Generate Types Script

**File**: `scripts/generate-types-local.sh`

```bash
#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔄 Generating database types...${NC}"

# Check if Supabase is running
if ! supabase status > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  Supabase not running. Starting...${NC}"
  supabase start
  sleep 5
fi

# Generate types
echo "→ Generating TypeScript types from Supabase schema..."
supabase gen types typescript --local > src/types/supabase.ts

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Types generated successfully${NC}"
  echo ""
  echo "File updated: src/types/supabase.ts"
  echo ""
  echo "Next steps:"
  echo "  1. Review changes: git diff src/types/supabase.ts"
  echo "  2. Test locally: npm run type-check"
  echo "  3. Commit: git add src/types/supabase.ts && git commit -m 'chore: sync types'"
  echo ""
else
  echo -e "${RED}❌ Failed to generate types${NC}"
  exit 1
fi
```

**Make executable**:
```bash
chmod +x scripts/generate-types-local.sh
```

---

## Template 5: Package.json Scripts

**File**: `package.json` (add to scripts section)

```json
{
  "scripts": {
    "types:local": "./scripts/generate-types-local.sh",
    "types:check-local": "./scripts/check-types-local.sh",
    "type-check": "tsc --noEmit",
    "validate:local": "npm run types:check-local && npm run type-check && npm test",
    "prebuild:check": "npm run validate:local"
  }
}
```

---

## Template 6: VSCode Tasks

**File**: `.vscode/tasks.json`

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Sync Types (Local)",
      "type": "shell",
      "command": "npm run types:local",
      "problemMatcher": [],
      "presentation": {
        "reveal": "always",
        "panel": "new",
        "focus": true
      },
      "group": {
        "kind": "build",
        "isDefault": false
      }
    },
    {
      "label": "Check Type Sync",
      "type": "shell",
      "command": "npm run types:check-local",
      "problemMatcher": [],
      "presentation": {
        "reveal": "always",
        "panel": "new",
        "focus": true
      }
    },
    {
      "label": "Full Validation (Local)",
      "type": "shell",
      "command": "npm run validate:local",
      "problemMatcher": ["$tsc"],
      "presentation": {
        "reveal": "always",
        "panel": "new",
        "focus": true
      },
      "group": {
        "kind": "test",
        "isDefault": true
      }
    }
  ]
}
```

**Usage**:
- `Cmd+Shift+P` → "Run Task" → Select task
- Or set keyboard shortcuts in `.vscode/keybindings.json`:

```json
[
  {
    "key": "cmd+shift+t",
    "command": "workbench.action.tasks.runTask",
    "args": "Sync Types (Local)"
  }
]
```

---

## Template 7: README Documentation

**File**: `README.md` (add section)

```markdown
## Type Synchronization

This project uses automated type generation from the Supabase database schema.

### Quick Commands

```bash
# Generate types from local Supabase
npm run types:local

# Check if types are synchronized
npm run types:check-local

# Full validation (types + TypeScript + tests)
npm run validate:local
```

### Daily Workflow

1. **After pulling latest changes**:
   ```bash
   npm run types:local  # Auto-runs via post-merge hook
   ```

2. **Before committing**:
   ```bash
   # Pre-commit hook automatically validates types
   git commit -m "your message"
   ```

3. **Before pushing**:
   ```bash
   # Pre-push hook runs full validation
   git push
   ```

### Git Hooks

This project uses Husky for automated type validation:

- **Pre-commit**: Lint + fast type check
- **Pre-push**: Full type sync validation + tests
- **Post-merge**: Auto-sync types if backend changed

### CI/CD

- **Pull Requests**: Types validated before merge
- **Nightly**: Automated PRs created if drift detected

### Troubleshooting

**Types out of sync error**:
```bash
npm run types:local
git add src/types/supabase.ts
git commit -m "chore: sync database types"
```

**Supabase not running**:
```bash
supabase start
npm run types:local
```

**Git hooks not working**:
```bash
npx husky install
chmod +x .husky/pre-commit
chmod +x .husky/pre-push
```
```

---

## Implementation Checklist

### Phase 1: Local Validation (Day 1)

- [ ] Create `scripts/` directory
- [ ] Copy `generate-types-local.sh` template
- [ ] Copy `check-types-local.sh` template
- [ ] Make scripts executable (`chmod +x`)
- [ ] Add scripts to `package.json`
- [ ] Test: `npm run types:local`
- [ ] Test: `npm run types:check-local`

### Phase 2: Git Hooks (Day 1)

- [ ] Install Husky: `npm install --save-dev husky`
- [ ] Initialize: `npx husky init`
- [ ] Create `.husky/pre-commit`
- [ ] Create `.husky/pre-push`
- [ ] Create `.husky/post-merge`
- [ ] Make hooks executable
- [ ] Test: Make a commit (should validate)

### Phase 3: CI/CD (Day 2)

- [ ] Create `.github/workflows/` directory
- [ ] Copy `type-validation.yml` template
- [ ] Test in PR
- [ ] Enable required status checks
- [ ] Copy `nightly-type-sync.yml` template
- [ ] Test manual trigger
- [ ] Monitor for false positives

### Phase 4: Developer Experience (Day 2)

- [ ] Create `.vscode/tasks.json`
- [ ] Copy VSCode tasks template
- [ ] Test tasks: `Cmd+Shift+P` → "Run Task"
- [ ] Update `README.md` with type sync section
- [ ] Document in `CLAUDE.md`

### Phase 5: Monitoring (Week 2)

- [ ] Add Slack webhook (optional)
- [ ] Configure notifications (optional)
- [ ] Create dashboard (optional)

---

## Testing the Setup

### Test 1: Local Type Generation

```bash
# Generate types
npm run types:local

# Should create/update: src/types/supabase.ts
# No errors should occur
```

### Test 2: Type Validation

```bash
# Should pass if types are current
npm run types:check-local

# Should fail if types are stale
# (manually edit src/types/supabase.ts to test)
```

### Test 3: Git Hooks

```bash
# Test pre-commit
git add .
git commit -m "test: pre-commit hook"
# Should run linting + type check

# Test pre-push
git push
# Should validate type sync + run tests
```

### Test 4: CI/CD (GitHub Actions)

```bash
# Create test PR
git checkout -b test/ci-validation
git push origin test/ci-validation

# Open PR in GitHub
# Check that "Type Synchronization Validation" runs
```

---

## Troubleshooting

### Hook not executing

```bash
# Reinstall Husky
rm -rf .husky
npx husky init
# Recreate hooks from templates
```

### Types generation fails

```bash
# Check Supabase is running
supabase status

# Restart if needed
supabase stop
supabase start
```

### CI fails but local passes

```bash
# Test CI locally (requires act)
brew install act  # macOS
act pull_request
```

---

## Maintenance

**Monthly Review**:
- Review auto-generated PRs
- Check CI/CD success rates
- Update templates if tooling changes
- Audit hook execution times (target: <5s)

**Quarterly Review**:
- Update dependencies (`husky`, `lint-staged`)
- Review GitHub Actions marketplace for new tools
- Benchmark performance metrics
- Update documentation

---

**Last Updated**: 2025-10-22
**Maintained By**: Wildlife Watcher Development Team
