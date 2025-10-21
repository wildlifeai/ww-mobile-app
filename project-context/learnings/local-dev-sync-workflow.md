# Local Development Sync Workflow
# Simple Practical Backend-Mobile Synchronization

**Date**: 2025-10-21
**Context**: Local development with Supabase + Backend + Mobile repos
**Goal**: Dead simple workflow to prevent type/function mismatches

---

## 🎯 The Problem

You have 3 repos locally:
1. **Supabase Local** - Running on `localhost:54321`
2. **Backend Repo** - `~/dev/wildlifeai/wildlife-watcher-backend`
3. **Mobile Repo** - `~/dev/wildlifeai/wildlife-watcher-mobile-app`

**Challenge**: Keep mobile types in sync with backend changes **without complex automation**

---

## ✅ Simple 3-Step Local Workflow

### Step 1: Backend Changes → Regenerate Types Immediately

**When you make backend changes** (migrations, functions, tables):

```bash
# FROM: ~/dev/wildlifeai/wildlife-watcher-backend
# After creating/modifying migration files

# Apply migration to local Supabase
supabase db reset

# IMMEDIATELY regenerate mobile types
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:local

# Commit BOTH repos together
cd ~/dev/wildlifeai/wildlife-watcher-backend
git add supabase/migrations/
git commit -m "feat(db): add new function"

cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
git add src/types/supabase.ts
git commit -m "chore(types): sync after backend migration"
```

### Step 2: Before Testing Mobile App → Verify Types Current

**Before running mobile tests or manual testing**:

```bash
# FROM: ~/dev/wildlifeai/wildlife-watcher-mobile-app

# Quick check: Are types current?
npm run types:check-local

# This will:
# 1. Regenerate types from local Supabase
# 2. Compare with committed types
# 3. Exit with error if different
```

### Step 3: Before Committing Mobile Code → Validate Contract

**Before committing mobile feature code**:

```bash
# FROM: ~/dev/wildlifeai/wildlife-watcher-mobile-app

# Run type check + tests
npm run validate:local

# This will:
# 1. Check types are current
# 2. Run TypeScript compiler
# 3. Run tests (which hit local Supabase)
```

---

## 🛠️ Setup (One-Time, 10 Minutes)

### 1. Add npm Scripts to Mobile App

Edit `package.json` in mobile repo:

```json
{
  "scripts": {
    "types:local": "supabase gen types typescript --local > src/types/supabase.ts",
    "types:check-local": "supabase gen types typescript --local > .types-check.ts && diff -q src/types/supabase.ts .types-check.ts && rm .types-check.ts || (echo '❌ Types out of sync! Run: npm run types:local' && rm .types-check.ts && exit 1)",
    "validate:local": "npm run types:check-local && npm run type-check && npm test",
    "db:status": "supabase db diff --use-migra"
  }
}
```

### 2. Create Pre-Commit Hook (Automatic Check)

Create `.git/hooks/pre-commit` in mobile repo:

```bash
#!/bin/bash
# Mobile app pre-commit hook: Verify types are current

echo "🔍 Checking if Supabase types are current..."

# Generate fresh types from local Supabase
npx supabase gen types typescript --local > .types-check.ts 2>/dev/null

# Compare with committed types
if ! diff -q src/types/supabase.ts .types-check.ts > /dev/null 2>&1; then
  echo ""
  echo "❌ ERROR: Supabase types are out of sync!"
  echo ""
  echo "Backend schema changed but types not regenerated."
  echo ""
  echo "Run: npm run types:local"
  echo ""
  rm .types-check.ts
  exit 1
fi

rm .types-check.ts
echo "✅ Types are current"
```

Make it executable:

```bash
chmod +x .git/hooks/pre-commit
```

### 3. Create Backend Post-Migration Script

Create `~/dev/wildlifeai/wildlife-watcher-backend/scripts/post-migration.sh`:

```bash
#!/bin/bash
# Run after creating/modifying migrations
# Automatically syncs mobile types

BACKEND_DIR="$HOME/dev/wildlifeai/wildlife-watcher-backend"
MOBILE_DIR="$HOME/dev/wildlifeai/wildlife-watcher-mobile-app"

echo "🔄 Post-migration: Syncing mobile types..."

# Apply migration to local Supabase
cd "$BACKEND_DIR"
supabase db reset

# Regenerate mobile types
cd "$MOBILE_DIR"
npm run types:local

echo "✅ Types regenerated"
echo ""
echo "📋 Next steps:"
echo "  1. Review type changes: git diff src/types/supabase.ts"
echo "  2. Update mobile code if needed"
echo "  3. Test mobile app: npm test"
echo "  4. Commit both repos together"
```

Make it executable:

```bash
chmod +x ~/dev/wildlifeai/wildlife-watcher-backend/scripts/post-migration.sh
```

---

## 📋 Daily Development Workflow

### Scenario 1: Creating New Backend Function

```bash
# 1. Backend: Create migration
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase migration new add_user_permissions

# 2. Backend: Edit migration file
# Add your SQL...

# 3. Backend: Apply + Sync mobile types
./scripts/post-migration.sh

# 4. Mobile: Review type changes
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
git diff src/types/supabase.ts

# 5. Mobile: Update code to use new function
# ... edit your service files ...

# 6. Mobile: Test
npm test

# 7. Commit BOTH repos
cd ~/dev/wildlifeai/wildlife-watcher-backend
git add supabase/migrations/
git commit -m "feat(db): add user_permissions function"

cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
git add src/types/ src/services/
git commit -m "feat(auth): use new user_permissions function"
```

### Scenario 2: Modifying Existing Function

```bash
# 1. Backend: Modify function in migration
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase migration new update_get_organisation_users

# 2. Backend: Apply + Sync
./scripts/post-migration.sh

# 3. Mobile: Pre-commit hook will BLOCK if you forget to sync
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
# ... make changes ...
git commit -m "fix: update org users call"
# ❌ Hook fails if types not regenerated

# 4. Fix: Regenerate types
npm run types:local
git add src/types/supabase.ts
git commit -m "fix: update org users call + sync types"
# ✅ Hook passes
```

### Scenario 3: Morning Start - Verify State

```bash
# Mobile: Check if backend changed overnight
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:check-local

# If types out of sync:
# ❌ Backend was updated, mobile types stale

# Fix:
npm run types:local
git diff src/types/supabase.ts  # Review what changed
```

---

## 🚨 Simple Rules to Follow

### ✅ DO

1. **Always run `post-migration.sh` after backend changes**
   - Applies migration to local Supabase
   - Regenerates mobile types automatically

2. **Commit backend + mobile changes together**
   - Backend migration file
   - Mobile type file
   - Mobile code changes (if any)

3. **Let pre-commit hook protect you**
   - It will block commits if types stale
   - Trust it, don't override it

4. **Test against local Supabase**
   - Mobile app connects to `localhost:54321`
   - Backend changes immediately visible

### ❌ DON'T

1. **Don't skip type regeneration**
   - You'll get runtime errors
   - Pre-commit hook will catch you

2. **Don't commit mobile code without types**
   - Always `git add src/types/supabase.ts`

3. **Don't work on backend without mobile repo**
   - Need both to see full impact

4. **Don't bypass pre-commit hook**
   - `git commit --no-verify` defeats safety

---

## 🔍 Quick Checks (When Something Feels Wrong)

### "Are my types current?"

```bash
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:check-local
```

### "What backend changes are uncommitted?"

```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase db diff --use-migra
```

### "Did backend functions change?"

```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend
git log --oneline supabase/migrations/ | head -5
```

### "What's running in local Supabase?"

```bash
# List all functions
supabase db execute --local <<SQL
  SELECT routine_name, routine_type
  FROM information_schema.routines
  WHERE routine_schema = 'public'
  ORDER BY routine_name;
SQL

# List all tables
supabase db execute --local <<SQL
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;
SQL
```

---

## 🎯 Visual Workflow Diagram

```
Backend Change Workflow:
──────────────────────────

1. Backend Dev
   ↓
[Create Migration] → supabase migration new my_change
   ↓
[Edit SQL File] → Add function/table/view
   ↓
[Run Post-Migration] → ./scripts/post-migration.sh
   ↓                     ├─ supabase db reset (apply to local)
   ↓                     └─ npm run types:local (regen mobile types)
   ↓
2. Mobile Dev
   ↓
[Review Types] → git diff src/types/supabase.ts
   ↓
[Update Code] → Use new function/table
   ↓
[Test] → npm test (against local Supabase)
   ↓
3. Commit Both
   ↓
[Backend Commit] → Migration file
   ↓
[Mobile Commit] → Types + Code
   ↓
✅ Sync Complete
```

---

## 💡 Pro Tips

### Tip 1: Keep Both Repos Side-by-Side in IDE

**VS Code Multi-Root Workspace**:

Create `wildlife-watcher.code-workspace`:

```json
{
  "folders": [
    {
      "name": "Backend",
      "path": "/home/adarsh/dev/wildlifeai/wildlife-watcher-backend"
    },
    {
      "name": "Mobile",
      "path": "/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app"
    }
  ],
  "settings": {
    "files.watcherExclude": {
      "**/node_modules/**": true
    }
  }
}
```

Open with: `code wildlife-watcher.code-workspace`

**Benefits**:
- See both repos in same window
- Switch between backend migration and mobile service files
- Search across both repos

### Tip 2: Alias for Quick Sync

Add to `~/.bashrc` or `~/.zshrc`:

```bash
# Quick sync mobile types after backend change
alias sync-mobile='cd ~/dev/wildlifeai/wildlife-watcher-mobile-app && npm run types:local && cd -'

# Full workflow: reset DB + sync types + test
alias sync-all='cd ~/dev/wildlifeai/wildlife-watcher-backend && supabase db reset && cd ~/dev/wildlifeai/wildlife-watcher-mobile-app && npm run types:local && npm test'
```

Usage:

```bash
# After editing backend migration
cd ~/dev/wildlifeai/wildlife-watcher-backend
# ... edit migration ...
sync-mobile  # Regenerates types, returns to backend repo
```

### Tip 3: VS Code Tasks for Common Operations

Create `.vscode/tasks.json` in mobile repo:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Sync Types from Local DB",
      "type": "shell",
      "command": "npm run types:local",
      "problemMatcher": [],
      "presentation": {
        "echo": true,
        "reveal": "always",
        "panel": "new"
      }
    },
    {
      "label": "Check Types Current",
      "type": "shell",
      "command": "npm run types:check-local",
      "problemMatcher": []
    },
    {
      "label": "Validate Local State",
      "type": "shell",
      "command": "npm run validate:local",
      "problemMatcher": []
    }
  ]
}
```

Run with: `Cmd+Shift+P` → "Tasks: Run Task" → Select task

### Tip 4: Git Commit Message Convention

**For Backend Changes**:

```bash
git commit -m "feat(db): add user_permissions function

Mobile Impact: Types regeneration required
Mobile PR: #123 (link to mobile PR)

Migration: 20251021123456_add_user_permissions.sql"
```

**For Mobile Changes**:

```bash
git commit -m "feat(auth): use new user_permissions function

Backend: Synced with migration 20251021123456
Backend PR: wildlifeai/backend#456

Type changes:
- Added: Database['public']['Functions']['user_permissions']"
```

**Links commits across repos** for future debugging.

---

## 🧪 Testing Integration

### Quick Integration Test Script

Create `scripts/test-integration.sh` in mobile repo:

```bash
#!/bin/bash
# Quick integration test against local Supabase

echo "🧪 Testing mobile app against local Supabase..."

# 1. Verify Supabase is running
if ! curl -s http://localhost:54321/rest/v1/ > /dev/null; then
  echo "❌ Local Supabase not running!"
  echo "Start it: cd ~/dev/wildlifeai/wildlife-watcher-backend && supabase start"
  exit 1
fi

# 2. Check types are current
echo "Checking types..."
npm run types:check-local || exit 1

# 3. Run TypeScript check
echo "Type checking..."
npm run type-check || exit 1

# 4. Run tests
echo "Running tests..."
npm test || exit 1

echo "✅ Integration tests passed!"
```

Make it executable:

```bash
chmod +x scripts/test-integration.sh
```

Run before committing:

```bash
./scripts/test-integration.sh
```

---

## 📊 Checklist: Before Committing Mobile Code

```
[ ] Backend migration applied locally (supabase db reset)
[ ] Mobile types regenerated (npm run types:local)
[ ] Type changes reviewed (git diff src/types/supabase.ts)
[ ] Mobile code updated to use new types
[ ] TypeScript compiles (npm run type-check)
[ ] Tests pass (npm test)
[ ] Integration tested manually (if applicable)
[ ] Both repos ready to commit together
```

---

## 🔧 Troubleshooting

### Issue: "Types out of sync" but I just regenerated

**Cause**: Local Supabase not running or outdated

**Solution**:

```bash
# Check Supabase status
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase status

# If not running:
supabase start

# If running but stale:
supabase db reset

# Then regenerate types
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:local
```

### Issue: Pre-commit hook blocks but types look correct

**Cause**: Whitespace or formatting differences

**Solution**:

```bash
# See exact diff
diff src/types/supabase.ts <(supabase gen types typescript --local)

# Force regenerate
npm run types:local
git add src/types/supabase.ts
```

### Issue: Function exists in backend but mobile can't call it

**Cause**: Migration not applied to local DB

**Solution**:

```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend

# Check migration history
supabase migration list

# Apply all migrations
supabase db reset

# Verify function exists
supabase db execute --local <<SQL
  SELECT routine_name
  FROM information_schema.routines
  WHERE routine_name = 'your_function_name';
SQL
```

### Issue: Mobile tests fail with "function does not exist"

**Cause**: Test database not seeded or migration not applied

**Solution**:

```bash
# Reset backend database
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase db reset

# Verify seed data
supabase db execute --local <<SQL
  SELECT COUNT(*) FROM your_table;
SQL

# Re-run mobile tests
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm test
```

---

## 🎯 Simple Daily Habits

### Morning (Start of Day)

```bash
# 1. Pull both repos
cd ~/dev/wildlifeai/wildlife-watcher-backend && git pull
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app && git pull

# 2. Reset backend DB (apply any new migrations)
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase db reset

# 3. Check if mobile types need update
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:check-local

# If out of sync:
npm run types:local
```

### After Backend Change

```bash
# 1. Apply migration
cd ~/dev/wildlifeai/wildlife-watcher-backend
./scripts/post-migration.sh

# 2. Review type changes
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
git diff src/types/supabase.ts

# 3. Update mobile code (if needed)
# 4. Test
npm test
```

### Before Committing

```bash
# Mobile repo
./scripts/test-integration.sh

# Pre-commit hook will also verify
git commit -m "your message"
```

### End of Day

```bash
# Commit both repos together
cd ~/dev/wildlifeai/wildlife-watcher-backend
git status  # Verify migration committed

cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
git status  # Verify types + code committed

# If both clean: ✅ Good
# If uncommitted changes: Commit before EOD
```

---

## 📚 Summary: The Absolute Minimum

**If you do NOTHING else, do these 3 things:**

### 1. Add This npm Script

```json
{
  "scripts": {
    "types:local": "supabase gen types typescript --local > src/types/supabase.ts"
  }
}
```

### 2. Create This Habit

```bash
# After ANY backend change:
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:local
```

### 3. Add This Pre-Commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

npx supabase gen types typescript --local > .types-check.ts 2>/dev/null
if ! diff -q src/types/supabase.ts .types-check.ts > /dev/null 2>&1; then
  echo "❌ Types out of sync! Run: npm run types:local"
  rm .types-check.ts
  exit 1
fi
rm .types-check.ts
```

**That's it.** These 3 things prevent 99% of type mismatch issues.

---

## 🎓 Why This Works

**Simplicity Principles**:

1. **Local-First**: Everything runs locally, no cloud dependencies
2. **Immediate Feedback**: Errors caught at commit time, not runtime
3. **Single Command**: `npm run types:local` after backend changes
4. **Automated Safety**: Pre-commit hook prevents mistakes
5. **No Coordination**: No cross-repo webhooks or CI dependencies

**Trade-offs Accepted**:

- ✅ Simple, easy to understand
- ✅ Fast feedback loop
- ✅ No cloud dependencies
- ✅ Works offline
- ❌ Manual trigger (but takes 2 seconds)
- ❌ Requires discipline (but pre-commit hook enforces)

---

**Created**: 2025-10-21
**Status**: 🟢 Production-ready for local development
**Time to Setup**: 10 minutes
**Daily Overhead**: ~30 seconds per backend change

**Next**: Combine this local workflow with production GitHub Actions from `supabase-type-consistency-strategy.md` for full coverage.
