# Backend-Mobile Type Synchronization Guide

**Audience**: Junior to Mid-Level Developers
**Last Updated**: 2025-10-21
**Status**: Production - Tested and Validated

---

## 📋 Table of Contents

1. [What is Type Synchronization?](#what-is-type-synchronization)
2. [Why Does It Matter?](#why-does-it-matter)
3. [The Real-World Problem](#the-real-world-problem)
4. [How It Works in Our Project](#how-it-works-in-our-project)
5. [Daily Development Workflow](#daily-development-workflow)
6. [Common Scenarios](#common-scenarios)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)
9. [FAQ](#faq)

---

## What is Type Synchronization?

### The Basics

**Type synchronization** means keeping the TypeScript type definitions in our mobile app **exactly aligned** with the actual database schema and functions in our Supabase backend.

Think of it like keeping a map (types) updated with the territory (database):
- **The Territory**: Supabase database with tables, columns, functions
- **The Map**: TypeScript type definitions in `src/types/supabase.ts`
- **The Problem**: When the territory changes but the map doesn't update, you get lost!

### Example - What Types Look Like

**Database (Supabase)**:
```sql
-- A function in PostgreSQL
CREATE FUNCTION get_user_projects(user_id UUID)
RETURNS TABLE(id UUID, name TEXT, created_at TIMESTAMPTZ);
```

**TypeScript Types (Mobile App)**:
```typescript
// Generated type definition
export interface Database {
  public: {
    Functions: {
      get_user_projects: {
        Args: { user_id: string }  // TypeScript knows the parameter type
        Returns: Array<{           // TypeScript knows what comes back
          id: string
          name: string
          created_at: string
        }>
      }
    }
  }
}
```

**Your Code (Mobile App)**:
```typescript
// TypeScript helps you write correct code
const { data, error } = await supabase.rpc('get_user_projects', {
  user_id: userId  // ✅ TypeScript validates this matches Args type
});

// TypeScript knows what's in 'data'
data?.forEach(project => {
  console.log(project.name);  // ✅ TypeScript knows 'name' exists
  console.log(project.foo);   // ❌ TypeScript error: 'foo' doesn't exist
});
```

---

## Why Does It Matter?

### Without Type Synchronization ❌

**Scenario**: Backend changes a function signature, mobile types aren't updated

```typescript
// Backend changes function (adds new required parameter)
-- OLD: get_user_projects(user_id UUID)
-- NEW: get_user_projects(user_id UUID, include_archived BOOLEAN)

// Mobile app still has old types
const { data } = await supabase.rpc('get_user_projects', {
  user_id: userId
  // Missing: include_archived parameter
});

// Result:
// ✅ TypeScript compiler: No errors (thinks old signature is correct)
// ✅ Tests: Pass (if they don't hit real database)
// ❌ Runtime: ERROR - "function get_user_projects(uuid) does not exist"
// ❌ Production: App crashes for users
```

**Impact**:
- 🔴 **Runtime crashes** in production
- 🔴 **Hours of debugging** why "it works in TypeScript"
- 🔴 **User-facing errors** that could have been caught at compile time
- 🔴 **False confidence** from passing TypeScript checks

### With Type Synchronization ✅

```typescript
// Mobile types are updated immediately after backend change
const { data } = await supabase.rpc('get_user_projects', {
  user_id: userId
  // ❌ TypeScript error: "Property 'include_archived' is missing"
});

// You fix it immediately:
const { data } = await supabase.rpc('get_user_projects', {
  user_id: userId,
  include_archived: false  // ✅ Fixed before commit
});

// Result:
// ✅ Caught at development time
// ✅ Fixed before testing
// ✅ Never reaches production
// ✅ No user impact
```

**Impact**:
- ✅ **Errors caught at compile time** (before running code)
- ✅ **Autocomplete works correctly** (IDE suggests right parameters)
- ✅ **Confidence in refactoring** (TypeScript catches all usages)
- ✅ **No surprise runtime errors** in production

---

## The Real-World Problem

### What Happened to Us (Incident Report)

**Date**: October 2024
**Impact**: 2+ hours debugging, production errors
**Root Cause**: Type synchronization failure

**Timeline**:

1. **Backend Team** (Day 1):
   ```sql
   -- Modified function signature
   ALTER FUNCTION get_organisation_users(org_id UUID)
   -- Added ::text casts to fix a bug
   RETURNS TABLE(user_id UUID::text, email TEXT::text, ...)
   ```

2. **Mobile Team** (Day 2):
   ```typescript
   // Old types still showed:
   Args: { org_id: string }
   Returns: { user_id: string, email: string }

   // Code compiled fine with old types
   const users = await supabase.rpc('get_organisation_users', {
     org_id: organisationId
   });
   ```

3. **Runtime** (Day 2):
   ```
   ❌ ERROR 42883: function get_organisation_users(uuid) does not exist
   HINT: No function matches the given name and argument types.
         You might need to add explicit type casts.
   ```

4. **Debugging** (Day 2-3):
   - ✅ Backend code: Looks correct
   - ✅ TypeScript: No errors
   - ✅ Unit tests: Passing
   - ❌ Runtime: Failing mysteriously
   - 🔍 2 hours later: Discovered types were stale

**Solution**: Regenerated types, error disappeared instantly.

**Lesson Learned**: **Type drift = invisible time bombs**

---

## How It Works in Our Project

### Project Architecture

We have **three separate components** that must stay synchronized:

```
┌─────────────────────────────────────────────────────────────┐
│                    LOCAL DEVELOPMENT                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  Backend Repo    │         │  Mobile Repo     │         │
│  │  (Separate Git)  │         │  (Separate Git)  │         │
│  ├──────────────────┤         ├──────────────────┤         │
│  │ Migrations:      │         │ Types:           │         │
│  │ - SQL schema     │         │ - supabase.ts    │         │
│  │ - Functions      │         │ - Usage code     │         │
│  │ - Tables         │         │                  │         │
│  └────────┬─────────┘         └────────▲─────────┘         │
│           │                             │                   │
│           │ applies                     │ reads from        │
│           │                             │                   │
│           ▼                             │                   │
│  ┌──────────────────────────────────────┴─────────┐        │
│  │         Supabase Local (Docker)                │        │
│  │         localhost:54321                        │        │
│  │  - PostgreSQL database                         │        │
│  │  - Applied migrations                          │        │
│  │  - Running functions                           │        │
│  │  - Single source of truth                      │        │
│  └────────────────────────────────────────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Insight

**The local Supabase instance is the bridge** between backend and mobile:
- Backend applies migrations **TO** Supabase
- Mobile generates types **FROM** Supabase
- **No direct dependency** between backend and mobile code

### Type Generation Flow

```bash
# 1. Backend developer makes a change
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase migration new add_user_permissions_function
# ... writes SQL ...
supabase db reset  # Applies to local Supabase

# 2. Mobile developer regenerates types
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:local  # Reads from local Supabase, writes to src/types/supabase.ts

# 3. TypeScript now knows about the changes
# No more manual copying, no more guessing
```

### What Gets Synchronized

**Everything in the database schema**:

1. **Tables**:
   ```typescript
   Database['public']['Tables']['projects']['Row']
   // Knows: id, name, created_at, organisation_id, etc.
   ```

2. **Functions (RPC)**:
   ```typescript
   Database['public']['Functions']['get_user_projects']
   // Knows: Args type, Returns type
   ```

3. **Views**:
   ```typescript
   Database['public']['Views']['project_summary']
   // Knows: all view columns
   ```

4. **Enums**:
   ```typescript
   Database['public']['Enums']['user_role']
   // Knows: 'ww_admin' | 'project_admin' | 'project_member'
   ```

---

## Daily Development Workflow

### The 3-Step Golden Rule

**After ANY backend schema change, follow these 3 steps:**

#### Step 1: Backend Changes → Regenerate Immediately

```bash
# YOU ARE: Backend developer
# YOU JUST: Modified a migration file

# FROM: ~/dev/wildlifeai/wildlife-watcher-backend
supabase db reset  # Apply your changes to local Supabase

# IMMEDIATELY do this:
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:local  # Takes < 5 seconds

# ✅ Mobile types are now synchronized
```

**Why immediately?**
- You'll forget if you wait
- Other developers pulling your code will have stale types
- Tests might pass with stale types but fail in production

#### Step 2: Before Testing → Verify Types Current

```bash
# YOU ARE: Mobile developer
# YOU WANT: To test your mobile code

# FROM: ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:check-local  # Takes < 5 seconds

# If types are stale:
# ❌ ERROR: Supabase types are out of sync!
#
# Backend schema changed but types not regenerated.
#
# To fix, run:
#   npm run types:local

# Fix it immediately:
npm run types:local
npm run types:check-local  # ✅ Now passes
```

**Why verify?**
- Catches backend changes you didn't know about
- Ensures you're testing against current schema
- Prevents "works on my machine" bugs

#### Step 3: Before Committing → Validate Everything

```bash
# YOU ARE: Mobile developer
# YOU WANT: To commit your changes

# FROM: ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run validate:local  # Comprehensive check

# This runs:
# 1. ✅ Check local Supabase is running
# 2. ✅ Verify types are current
# 3. ✅ Run TypeScript compiler
# 4. ✅ Run test suite
```

**Why validate?**
- Pre-commit hook will block if types are stale
- Catches all integration issues before they reach CI
- Your commit won't break other developers' builds

### Visual Workflow

```
Backend Change          Mobile Development          Commit
─────────────          ──────────────────          ──────

[Migration]
     │
     │ supabase db reset
     ▼
[Local Supabase]
     │
     │ npm run types:local
     ▼
[src/types/supabase.ts] ──────────────┐
                                      │
                        [Write Code]  │
                             │        │
                             │ uses   │
                             ▼        │
                        [Your Code]   │
                             │        │
                             │ npm run types:check-local
                             ▼        │
                        [✅ Verified] │
                             │        │
                             │ npm run validate:local
                             ▼        ▼
                        [✅ All Checks Pass]
                             │
                             ▼
                        [git commit] ✅
```

---

## Common Scenarios

### Scenario 1: Adding a New Database Function

**You're a backend developer adding a new function**:

```bash
# 1. Create migration
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase migration new add_check_user_permission

# 2. Write SQL function
cat > supabase/migrations/$(ls -t supabase/migrations | head -1) <<'EOF'
CREATE FUNCTION check_user_permission(
  user_id UUID,
  permission_name TEXT
) RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM user_permissions
    WHERE user_id = $1 AND permission = $2
  );
$$ LANGUAGE sql SECURITY DEFINER;
EOF

# 3. Apply to local Supabase
supabase db reset

# 4. Update mobile types IMMEDIATELY
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:local

# 5. Commit both repos together
cd ~/dev/wildlifeai/wildlife-watcher-backend
git add supabase/migrations/
git commit -m "feat(db): add check_user_permission function"

cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
git add src/types/supabase.ts
git commit -m "chore(types): sync after adding check_user_permission"
```

**Mobile developer can now use it with full type safety**:

```typescript
// TypeScript knows this function exists and its signature
const { data: hasPermission } = await supabase.rpc('check_user_permission', {
  user_id: userId,        // ✅ TypeScript validates type
  permission_name: 'edit' // ✅ TypeScript validates type
});

if (hasPermission) {
  // ✅ TypeScript knows this is boolean
}
```

### Scenario 2: Modifying an Existing Function

**Backend changes function signature**:

```bash
# Backend: Modify function to add optional parameter
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase migration new update_get_organisation_users

# Add migration that modifies function signature
# Apply changes
supabase db reset

# Regenerate mobile types
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:local
```

**Mobile: Old code now shows TypeScript errors**:

```typescript
// OLD CODE (now shows errors):
const users = await supabase.rpc('get_organisation_users', {
  org_id: organisationId
  // ❌ TypeScript error: Property 'include_archived' is missing
});

// FIX: Add the new parameter
const users = await supabase.rpc('get_organisation_users', {
  org_id: organisationId,
  include_archived: false  // ✅ Fixed
});
```

**This is good!** TypeScript caught the breaking change at development time.

### Scenario 3: Adding a New Table Column

**Backend adds column to existing table**:

```bash
# Backend: Add column
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase migration new add_projects_archived_column

# SQL:
# ALTER TABLE projects ADD COLUMN archived BOOLEAN DEFAULT false;

supabase db reset

# Mobile: Regenerate types
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:local
```

**Mobile: Types now include new column**:

```typescript
// Before type sync:
type Project = {
  id: string;
  name: string;
  created_at: string;
  // 'archived' doesn't exist yet
}

// After type sync:
type Project = {
  id: string;
  name: string;
  created_at: string;
  archived: boolean | null;  // ✅ New column appears
}

// Now you can use it:
const projects = await supabase
  .from('projects')
  .select('*')
  .eq('archived', false);  // ✅ TypeScript validates

projects.data?.forEach(project => {
  if (project.archived) {  // ✅ TypeScript knows this exists
    // ...
  }
});
```

### Scenario 4: Morning Start - Check for Backend Changes

**You're starting work, backend might have changed overnight**:

```bash
# FROM: ~/dev/wildlifeai/wildlife-watcher-mobile-app

# Before pulling latest code, check your types
npm run types:check-local

# Scenario A: Types are current
# ✅ Types are current with local Supabase
# → Safe to continue working

# Scenario B: Types are stale
# ❌ ERROR: Supabase types are out of sync!
# → Backend repo was updated, need to pull and regenerate

# Pull backend changes
cd ~/dev/wildlifeai/wildlife-watcher-backend
git pull
supabase db reset

# Regenerate mobile types
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:local

# Now review what changed
git diff src/types/supabase.ts
# → Shows exactly what backend changed
```

---

## Troubleshooting

### Problem: "supabase start is not running"

**Error**:
```bash
npm run types:local
# Error: supabase start is not running.
```

**Cause**: Local Supabase container isn't running

**Solution**:
```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase start

# Verify it's running
supabase status
# Should show: supabase local development setup is running.
```

### Problem: "Function signature mismatch at runtime"

**Error**:
```
ERROR 42883: function get_user_projects(uuid) does not exist
```

**Cause**: Types are out of sync with actual database

**Solution**:
```bash
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app

# 1. Check if types are stale
npm run types:check-local

# If stale:
npm run types:local

# 2. Verify backend database matches migration files
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase db reset  # Reapply all migrations

# 3. Regenerate types again
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:local
```

### Problem: "Types look wrong after generation"

**Symptom**: Generated types don't match what you expect

**Debug Steps**:

```bash
# 1. Verify which Supabase instance you're connected to
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase status
# Check API URL is: http://127.0.0.1:54321

# 2. Cross-validate with backend reference types
diff ~/dev/wildlifeai/wildlife-watcher-backend/project-context/database.types.ts \
     ~/dev/wildlifeai/wildlife-watcher-mobile-app/src/types/supabase.ts

# If different:
# → Backend reference types might also be stale
# → Regenerate both

# 3. Check migration state
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase migration list
# Ensure all migrations are applied (✔ in status column)

# 4. Reset and regenerate clean
supabase db reset
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:local
```

### Problem: "Pre-commit hook blocks my commit"

**Error**:
```bash
git commit -m "feat: add new feature"
# ❌ ERROR: Supabase types are out of sync!
```

**Cause**: You modified code without regenerating types after backend change

**Solution**:
```bash
# 1. Regenerate types
npm run types:local

# 2. Review what changed
git diff src/types/supabase.ts

# 3. If types changed, add them to commit
git add src/types/supabase.ts
git commit -m "feat: add new feature"

# If types didn't change but hook still fails:
# → Backend might have uncommitted migrations
cd ~/dev/wildlifeai/wildlife-watcher-backend
git status
# Check for uncommitted migration files
```

### Problem: "Types work in development but fail in production"

**Symptom**: App works locally but crashes in production with function errors

**Cause**: Production database schema doesn't match local types

**Solution**:

```bash
# This is a deployment issue, not a type sync issue
# Ensure backend migrations are deployed to production BEFORE mobile app

# Check backend deployment status
cd ~/dev/wildlifeai/wildlife-watcher-backend
# Verify all migrations are deployed to production

# Mobile app should always deploy AFTER backend migrations complete
```

---

## Best Practices

### ✅ DO

1. **Regenerate types immediately after backend changes**
   ```bash
   # After every backend migration:
   npm run types:local
   ```

2. **Commit backend and mobile changes together**
   ```bash
   # Backend commit
   git commit -m "feat(db): add new function"

   # Immediately follow with mobile commit
   cd ../mobile && npm run types:local
   git commit -m "chore(types): sync after backend change"
   ```

3. **Run type check before testing**
   ```bash
   npm run types:check-local
   # Only takes 5 seconds, saves hours of debugging
   ```

4. **Use full validation before committing**
   ```bash
   npm run validate:local
   # Catches everything before CI
   ```

5. **Cross-validate when debugging**
   ```bash
   # Compare mobile vs backend reference types
   diff ~/backend/project-context/database.types.ts src/types/supabase.ts
   ```

### ❌ DON'T

1. **Don't manually edit `src/types/supabase.ts`**
   ```typescript
   // ❌ WRONG: Manual edit
   export interface Database {
     // I think this should be...
   }

   // ✅ RIGHT: Always regenerate
   npm run types:local
   ```

2. **Don't commit without running type check**
   ```bash
   # ❌ WRONG:
   git add .
   git commit -m "fix: something"  # Might have stale types!

   # ✅ RIGHT:
   npm run validate:local  # Catches stale types
   git commit -m "fix: something"
   ```

3. **Don't ignore type errors with `//@ts-ignore`**
   ```typescript
   // ❌ WRONG: Hiding the real problem
   // @ts-ignore
   const data = await supabase.rpc('get_projects', {...});

   // ✅ RIGHT: Regenerate types and fix properly
   npm run types:local
   const data = await supabase.rpc('get_projects', {...});
   ```

4. **Don't assume types are current without checking**
   ```bash
   # ❌ WRONG: Just start coding

   # ✅ RIGHT: Always verify first
   npm run types:check-local
   ```

5. **Don't skip type sync because "it's just a small change"**
   - Small backend changes still break type safety
   - Takes 5 seconds to regenerate
   - Saves hours of debugging later

### Development Habits

**Start of Day**:
```bash
# Pull latest backend changes
cd ~/dev/wildlifeai/wildlife-watcher-backend
git pull
supabase db reset

# Check mobile types
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:check-local
```

**After Backend Pull**:
```bash
# Someone else updated backend
cd ~/dev/wildlifeai/wildlife-watcher-backend
git pull

# Apply their migrations
supabase db reset

# Update mobile types
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:local
```

**Before Committing**:
```bash
# Always validate
npm run validate:local

# Only commit if all checks pass
git commit -m "feat: add feature"
```

---

## FAQ

### Q: Why can't we just copy types from backend to mobile?

**A**: We don't manually maintain types - Supabase generates them automatically from the live database schema. This ensures:
- Types always match reality
- No human error in copying
- Automatic inclusion of all tables/functions/enums
- Proper TypeScript format

### Q: How long does type generation take?

**A**: < 5 seconds
- `npm run types:local`: ~2-3 seconds
- `npm run types:check-local`: ~3-4 seconds
- `npm run validate:local`: ~30-60 seconds (includes tests)

### Q: What if I forget to regenerate types?

**A**: Multiple safety nets:
1. Pre-commit hook blocks stale commits
2. `npm run validate:local` catches it
3. CI/CD pipeline will fail
4. Worst case: Runtime error in testing (before production)

### Q: Can I regenerate types too often?

**A**: No! It's fast and safe. When in doubt, regenerate:
```bash
npm run types:local  # Always safe, takes 5 seconds
```

### Q: Do types need to be in version control?

**A**: Yes! `src/types/supabase.ts` is committed to git because:
- Other developers need them to work
- CI/CD needs them to build
- Type checking happens at build time, not generation time

### Q: What's the difference between mobile types and backend reference types?

**A**:
- **Mobile**: `src/types/supabase.ts` - Used by mobile app code
- **Backend Reference**: `~/backend/project-context/database.types.ts` - Authoritative reference for cross-validation
- Both are generated from same Supabase instance, should be identical
- Use backend reference types for debugging type mismatches

### Q: What if backend and mobile are developed by different teams?

**A**: Communication is key:
1. Backend team commits migration
2. Backend team notifies mobile team (Slack, PR comment, etc.)
3. Mobile team regenerates types and tests
4. Both teams commit together

**Better**: Use shared CI/CD that regenerates types automatically (see production automation docs)

### Q: Can I work offline?

**A**: Yes, as long as:
- Local Supabase is running (`supabase start`)
- You have latest migrations applied
- Type generation works locally without internet

### Q: What happens in production?

**A**:
- Types are pre-generated during build
- Mobile app bundles these types
- No type generation at runtime
- Backend migrations deploy BEFORE mobile app
- Mobile app sees production database schema

### Q: How do I know if types are stale?

**A**: Run the check command:
```bash
npm run types:check-local

# Current:
# ✅ Types are current with local Supabase

# Stale:
# ❌ ERROR: Supabase types are out of sync!
```

---

## Summary

### The Golden Rules

1. **After EVERY backend change**: `npm run types:local`
2. **Before EVERY test run**: `npm run types:check-local`
3. **Before EVERY commit**: `npm run validate:local`

### Why It Matters

- **Type safety only works if types are current**
- **Stale types = runtime bombs** that TypeScript can't catch
- **5 seconds of prevention** > 2 hours of debugging

### Quick Commands Reference

```bash
# Generate types from local Supabase
npm run types:local

# Verify types are current
npm run types:check-local

# Full pre-commit validation
npm run validate:local

# Cross-validate with backend reference
diff ~/backend/project-context/database.types.ts src/types/supabase.ts
```

### When to Ask for Help

- Pre-commit hook keeps blocking even after regenerating types
- Runtime errors that TypeScript didn't catch
- Types look wrong after generation
- Unclear if backend change requires type regeneration

**Ask in**: #dev-mobile or #dev-backend Slack channels

---

## Related Documentation

- **Workflow Guide**: `@project-context/learnings/local-dev-sync-workflow.md` - Detailed daily workflows
- **Production Strategy**: `@project-context/learnings/supabase-type-consistency-strategy.md` - CI/CD automation
- **Test Results**: `@project-context/learnings/type-sync-workflow-test-results.md` - Validation proof
- **Backend Integration**: `@project-context/learnings/backend-mobile-integration-lessons.md` - Incident reports

---

**Remember**: Type synchronization isn't busywork - it's your safety net that catches bugs at development time instead of in production. Take the 5 seconds to regenerate types, save hours of debugging later! ✅
