# Troubleshooting Guide: Environment Switching & Type Synchronization

**Purpose**: Solutions for common issues with the multi-environment system

**Last Updated**: 2025-10-30
**Status**: Production-Ready
**Version**: 1.0

---

## Table of Contents

1. [Type Synchronization Issues](#1-type-synchronization-issues)
2. [Environment Switching Issues](#2-environment-switching-issues)
3. [Build Issues](#3-build-issues)
4. [Connection Issues](#4-connection-issues)
5. [WSL Networking Issues](#5-wsl-networking-issues)
6. [Pre-Commit Hook Issues](#6-pre-commit-hook-issues)
7. [GitHub Actions Issues](#7-github-actions-issues)
8. [Development Workflow Issues](#8-development-workflow-issues)
9. [Quick Diagnostic Commands](#quick-diagnostic-commands)

---

## 1. Type Synchronization Issues

### Issue 1.1: "Types are out of sync" Error (Local)

**Symptom**:
```
❌ ERROR: Types are out of sync with local Supabase!

To fix, run:
  npm run types:local
```

**Cause**: Committed types in `src/types/supabase.ts` don't match current local database schema

**Common Triggers**:
- Backend team made schema changes
- Pulled backend migration files without regenerating types
- Local Supabase has pending migrations
- Switched branches with different schemas

**Solution**:

```bash
# 1. Ensure local Supabase is running
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase status

# If not running:
supabase start

# 2. Return to mobile repo and regenerate types
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:local

# 3. Review the changes
git diff src/types/supabase.ts

# 4. Add to staging
git add src/types/supabase.ts

# 5. Commit again
git commit -m "chore(types): sync with local schema"
```

**Expected Time**: 5 seconds

**Verification**:
```bash
# Should pass
npm run types:check-local
```

**Prevention**:
- Run `npm run types:check-local` at start of day
- Check coordination inbox daily for schema-change messages

---

### Issue 1.2: "Types are out of sync" Error (Cloud-Dev)

**Symptom**:
```
❌ ERROR: Types are out of sync with cloud-dev!

Diff:
- old_field: string
+ new_field: number

To fix:
  npm run types:cloud-dev
```

**Cause**: Committed types don't match cloud-dev Supabase schema

**Common Triggers**:
- Backend deployed schema changes to cloud-dev
- Building preview without regenerating types
- GitHub Actions validation failure

**Solution**:

```bash
# 1. Ensure authenticated to Supabase CLI
npx supabase login
# Opens browser for authentication

# 2. Ensure linked to cloud-dev project
npx supabase link --project-ref nuhwmubvygxyddkycmpa

# 3. Regenerate types from cloud-dev
npm run types:cloud-dev

# 4. Validate alignment
npm run validate:cloud-dev

# 5. Commit updated types
git add src/types/supabase.ts
git commit -m "chore(types): sync with cloud-dev schema"
```

**Expected Time**: 10-15 seconds

**Verification**:
```bash
# Should pass
npm run types:check-cloud-dev
```

**Prevention**:
- GitHub Actions validates types on PR (blocks merge if out of sync)
- Check coordination inbox for cloud-dev deployment messages

---

### Issue 1.3: "Failed to generate types from cloud"

**Symptom**:
```
❌ Error: Failed to generate types from cloud-dev

Possible causes:
  1. Not authenticated to Supabase CLI
  2. No access to project ref
  3. Network connectivity issues
```

**Cause**: Supabase CLI not authenticated or not linked to project

**Solution A: Not Authenticated**

```bash
# Authenticate to Supabase CLI
npx supabase login

# Follow prompts:
# 1. Browser opens
# 2. Authenticate with Supabase account
# 3. Return to terminal

# Verify authentication
npx supabase projects list
# Should list your projects
```

**Solution B: Not Linked to Project**

```bash
# Link to cloud-dev project
npx supabase link --project-ref nuhwmubvygxyddkycmpa

# Verify link
npx supabase projects list
# Should show "linked" status for cloud-dev

# Try again
npm run types:cloud-dev
```

**Solution C: Network Issues**

```bash
# Check network connectivity
ping supabase.com

# If behind corporate firewall/VPN:
# 1. Connect to VPN
# 2. Try again
# 3. If still failing, contact IT

# Try with verbose logging
npx supabase gen types typescript --linked --project-ref nuhwmubvygxyddkycmpa
```

**Expected Time**: 2-3 minutes

**Verification**:
```bash
# Should succeed
npm run types:cloud-dev
```

---

### Issue 1.4: "Supabase CLI not found"

**Symptom**:
```bash
npm run types:local
# Error: supabase: command not found
```

**Cause**: Supabase CLI not installed

**Solution**:

```bash
# Install Supabase CLI globally
npm install -g supabase

# Verify installation
npx supabase --version
# Should show: supabase 1.x.x

# Try again
npm run types:local
```

**Alternative (npm/npx method)**:
```bash
# Use npx instead (slower, but works without global install)
npx supabase gen types typescript --local > src/types/supabase.ts
```

**Expected Time**: 1-2 minutes

---

### Issue 1.5: Type Changes Break Existing Tests

**Symptom**:
```bash
npm run types:local
# ✅ Types generated

npm test
# ❌ 10 tests failed
# Error: Property 'new_column' does not exist on type 'Project'
```

**Cause**: Backend schema changes added new columns, existing tests don't provide them

**Solution**:

```bash
# 1. Review type changes
git diff src/types/supabase.ts

# 2. Identify new required columns (non-nullable)
# Example: "new_column: string" (not "string | null")

# 3. Update test mock data
# File: src/services/__tests__/ProjectService.test.ts

const mockProject = {
  id: 'test-id',
  name: 'Test Project',
  new_column: 'default_value',  // Add new column
  // ...
};

# 4. Run tests again
npm test

# 5. Commit both type changes and test updates
git add src/types/supabase.ts src/services/__tests__/ProjectService.test.ts
git commit -m "chore(types): sync with backend schema + update tests"
```

**Expected Time**: 10-30 minutes (depending on number of tests)

**Best Practice**: Use factory functions for test data to reduce update burden:
```typescript
// src/__tests__/factories/projectFactory.ts
export const createMockProject = (overrides = {}): Project => ({
  id: 'default-id',
  name: 'Default Project',
  new_column: 'default_value',  // Only update here
  ...overrides,
});
```

---

### Issue 1.6: Pre-Commit Hook Blocks Commit

**Symptom**:
```bash
git commit -m "feat: implement feature"

# Pre-commit hook output:
❌ COMMIT BLOCKED: Database types are out of sync

Your committed types don't match the current database schema.

To fix this issue:
  1. Run: npm run types:local
  2. Review the changes in src/types/supabase.ts
  3. Add to staging: git add src/types/supabase.ts
  4. Commit again
```

**Cause**: Pre-commit hook detected types don't match local database

**Solution**:

```bash
# 1. Regenerate types
npm run types:local

# 2. Review changes (understand what changed)
git diff src/types/supabase.ts

# 3. Add to staging
git add src/types/supabase.ts

# 4. Commit again
git commit -m "feat: implement feature"
# ✅ Pre-commit hook passes
```

**Expected Time**: 5 seconds

**Prevention**:
- Run `npm run types:check-local` before committing
- Check coordination inbox daily

---

## 2. Environment Switching Issues

### Issue 2.1: Can't Access Developer Settings

**Symptom**: Developer Settings option not visible in Settings screen

**Cause A: Production Build**

**Check**:
```bash
# In app, check build variant
# Settings → About → Build Variant
# Should show: "development"

# If shows "preview" or "production":
# Developer Settings intentionally disabled
```

**Solution**: Use development build
```bash
# Run development build
npm start
# Or: expo start --dev-client
```

---

**Cause B: Navigation Not Configured**

**Check**:
```bash
# Verify navigation integration
cat src/navigation/index.tsx | grep -i "developer"
```

**Solution**: Verify navigation configured correctly
```bash
# Should have:
{__DEV__ && (
  <Stack.Screen
    name="DeveloperSettings"
    component={DeveloperSettingsScreen}
  />
)}
```

If missing, see [RUNTIME-ENVIRONMENT-SWITCHING-IMPLEMENTATION-PLAN.md](./db-environment-switching-in-app/RUNTIME-ENVIRONMENT-SWITCHING-IMPLEMENTATION-PLAN.md) Task 2.2

---

### Issue 2.2: Environment Switch Doesn't Apply

**Symptom**: Selected new environment, tapped "Apply & Restart", but app still uses old environment

**Solution A: Verify App Restarted**

```bash
# 1. Close app completely (swipe away from recent apps)
# 2. Relaunch app
# 3. Verify environment in Developer Settings
```

**Solution B: Clear AsyncStorage**

```bash
# In app:
# Settings → Clear All Data → Confirm

# Then:
# 1. Close app
# 2. Relaunch
# 3. Re-select environment
# 4. Apply & Restart
```

**Solution C: Check Logs**

```bash
# Monitor Expo logs during environment switch
npm start

# In app, switch environment
# Check logs for:
# "Environment switched to: cloud-dev"
# "Supabase client reinitialized"

# If no logs, AsyncStorage write failed
```

**Expected Time**: 1-2 minutes

---

### Issue 2.3: "Apply & Restart" Button Disabled

**Symptom**: Can't tap "Apply & Restart" button after selecting environment

**Cause A: No Environment Selected**

**Check**: Ensure an environment radio button is selected

**Solution**: Tap one of the environment options first

---

**Cause B: Same Environment Already Active**

**Check**: Current environment already matches selected environment

**Solution**: This is expected behavior (no need to apply if already active)

---

**Cause C: App Restarting**

**Check**: Button shows "Restarting..."

**Solution**: Wait for restart to complete (5-10 seconds)

---

### Issue 2.4: Environment Reverts After Restart

**Symptom**: Selected "Cloud Development", restarted app, but reverted to "Local Development"

**Cause**: AsyncStorage persistence failure

**Solution**:

```bash
# 1. Check AsyncStorage permissions
# Ensure app has storage permissions

# 2. Clear AsyncStorage and try again
# Settings → Clear All Data → Restart

# 3. Re-select environment
# Settings → Developer Settings → Cloud Development → Apply & Restart

# 4. Verify persistence
# Close app completely
# Relaunch
# Check: Settings → Developer Settings
# Should still show "Cloud Development" selected
```

**Expected Time**: 2-3 minutes

**If still failing**: Report issue with device details (OS version, device model)

---

## 3. Build Issues

### Issue 3.1: Preview Build Crashes on Launch

**Symptom**: Preview build crashes immediately after launch

**Cause A: Type Mismatch**

**Check**: Built preview with local types instead of cloud-dev types

**Solution**:
```bash
# 1. Regenerate types from cloud-dev
npm run types:cloud-dev

# 2. Commit type changes
git add src/types/supabase.ts
git commit -m "chore(types): sync with cloud-dev for preview build"

# 3. Rebuild preview
eas build --platform android --profile preview
```

**Expected Time**: 30 minutes (rebuild time)

---

**Cause B: Environment Variables Missing**

**Check**: `.env.local` not read in preview builds

**Solution**:
```bash
# Preview builds use EAS secrets, not .env.local

# 1. Check EAS secrets
eas secret:list

# 2. Ensure these secrets exist:
#    - EXPO_PUBLIC_SUPABASE_URL (cloud-dev URL)
#    - EXPO_PUBLIC_SUPABASE_ANON_KEY (cloud-dev anon key)

# 3. If missing, create:
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://nuhwmubvygxyddkycmpa.supabase.co"

# 4. Rebuild
eas build --platform android --profile preview
```

**Expected Time**: 30 minutes (rebuild time)

---

### Issue 3.2: Production Build Fails Type Check

**Symptom**:
```bash
eas build --profile production
# Build fails during type check phase
# Error: Types out of sync with cloud-prod
```

**Cause**: Building production with local or cloud-dev types

**Solution**:
```bash
# 1. Ensure cloud-prod types (when configured)
npm run types:cloud-prod

# 2. Validate alignment
npm run validate:cloud-prod

# 3. Commit type changes
git add src/types/supabase.ts
git commit -m "chore(types): sync with cloud-prod for production build"

# 4. Rebuild production
eas build --profile production
```

**Expected Time**: 40 minutes (rebuild time)

---

### Issue 3.3: EAS Build Fails with "Supabase CLI not found"

**Symptom**: EAS build fails during type generation phase

**Cause**: Type generation scripts rely on local Supabase CLI

**Solution**: Don't run type generation during EAS build

```bash
# Verify prebuild scripts don't run type generation
cat package.json

# Should NOT have:
"prebuild": "npm run types:local"  # ❌ Wrong

# Should have:
"prebuild": "npm run validate:local"  # ✅ Correct (only validates, doesn't generate)

# Or for cloud builds:
"prebuild:preview": "npm run type-check"  # ✅ Skip type generation, only check TypeScript
```

**Best Practice**: Generate types locally and commit before building with EAS

---

## 4. Connection Issues

### Issue 4.1: "Connection Failed" for Local Environment

**Symptom**: Tapped "Test Connection" for Local Development, shows red "✗ Connection Failed"

**Cause A: Local Supabase Not Running**

**Solution**:
```bash
# Start local Supabase
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase start

# Verify status
supabase status
# Should show: Status: Running

# Try connection test again in app
```

**Expected Time**: 30 seconds

---

**Cause B: WSL Host IP Incorrect**

**Solution**: See [Issue 5.1: WSL IP Address Changed](#issue-51-wsl-ip-address-changed)

---

**Cause C: Firewall Blocking Port 54321**

**Solution**:
```bash
# Test port accessibility from development machine
curl http://localhost:54321/rest/v1/
# Should return: {"message":"Authentication required"}

# If fails, check firewall:
# Windows: Allow inbound traffic on port 54321
# Linux: sudo ufw allow 54321

# Test again
```

**Expected Time**: 5 minutes

---

### Issue 4.2: "Connection Failed" for Cloud-Dev Environment

**Symptom**: Tapped "Test Connection" for Cloud Development, shows red "✗ Connection Failed"

**Cause A: Network Issue**

**Solution**:
```bash
# Test cloud-dev reachability
curl https://nuhwmubvygxyddkycmpa.supabase.co/rest/v1/
# Should return: {"message":"Authentication required"}

# If fails:
# 1. Check internet connectivity
# 2. Try from browser: https://nuhwmubvygxyddkycmpa.supabase.co
# 3. If behind corporate firewall, connect to VPN
```

**Expected Time**: 1-2 minutes

---

**Cause B: Anon Key Expired/Invalid**

**Solution**:
```bash
# Verify anon key in environments.ts
cat src/config/environments.ts | grep -A 5 "cloud-dev"

# Anon key should start with: "eyJhbGciOi..."

# If incorrect:
# 1. Get correct anon key from Supabase dashboard
# 2. Update src/config/environments.ts
# 3. Rebuild app: npm start
# 4. Test connection again
```

**Expected Time**: 5 minutes

---

**Cause C: Cloud-Dev Instance Down**

**Solution**:
```bash
# Check Supabase status page: https://status.supabase.com

# Check cloud-dev project in Supabase dashboard:
# https://app.supabase.com/project/nuhwmubvygxyddkycmpa

# If instance paused:
# 1. Resume instance in dashboard
# 2. Wait 2-3 minutes for restart
# 3. Test connection again
```

**Expected Time**: 5 minutes

---

### Issue 4.3: Connection Test Hangs (Timeout)

**Symptom**: Tapped "Test Connection", shows loading indefinitely, never succeeds or fails

**Cause**: Network timeout, no response from Supabase

**Solution**:

```bash
# 1. Close app completely
# 2. Verify network connectivity
# 3. Relaunch app
# 4. Try connection test again

# If still hangs:
# Check timeout configuration in code
# File: src/screens/DeveloperSettingsScreen.tsx
# Should have:
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);  // 10 second timeout
```

**Expected Time**: 1 minute

---

## 5. WSL Networking Issues

### Issue 5.1: WSL IP Address Changed

**Symptom**: Local environment worked yesterday, fails today

**Cause**: WSL host IP address changes on Windows reboot

**Solution**:

```bash
# 1. Find current WSL host IP
# On Windows, run PowerShell:
ipconfig
# Find "vEthernet (WSL)" adapter
# Note "IPv4 Address": e.g., 172.21.24.107

# 2. Update mobile app configuration
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
nano src/config/environments.ts

# Update line:
supabaseUrl: "http://172.21.24.107:54321",  # Change to new IP

# 3. Restart app
npm start

# 4. Test connection
# Settings → Developer Settings → Test Connection
```

**Expected Time**: 5 minutes

**Prevention**: Use dynamic WSL IP resolution (future improvement)

---

### Issue 5.2: Physical Device Can't Reach WSL IP

**Symptom**: Emulator works, physical device shows "Connection Failed"

**Cause**: Physical device on different network or firewall blocking

**Solution**:

```bash
# 1. Ensure device on same network as development machine
# Check WiFi network on device matches PC WiFi

# 2. Test connectivity from device
# On device, open browser
# Navigate to: http://172.21.24.107:54321
# Should show Supabase REST API response

# If fails:
# 3. Check Windows firewall
# Allow inbound traffic on port 54321 for "Public" networks

# 4. Test again
```

**Expected Time**: 10 minutes

**Alternative**: Use Android emulator instead (can access localhost directly)

---

### Issue 5.3: "localhost:54321" Works in Emulator, Not on Device

**Symptom**: Configured `localhost:54321`, works in emulator but not on physical device

**Cause**: Emulators can access host's localhost, physical devices cannot

**Solution**:

```bash
# Use WSL host IP for physical devices

# Update src/config/environments.ts:
local: {
  supabaseUrl: "http://172.21.24.107:54321",  # WSL host IP
  // Not: "http://localhost:54321"
  // ...
}

# Restart app
npm start

# Test on physical device
```

**Expected Time**: 2 minutes

**Best Practice**: Always use WSL host IP for cross-platform compatibility

---

## 6. Pre-Commit Hook Issues

### Issue 6.1: Pre-Commit Hook Not Running

**Symptom**: Commits succeed even with stale types (no validation)

**Cause**: Pre-commit hook missing or not executable

**Solution**:

```bash
# 1. Verify hook exists
ls -la .git/hooks/pre-commit

# If missing:
# 2. Copy from scripts
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit

# 3. Make executable
chmod +x .git/hooks/pre-commit

# 4. Test manually
.git/hooks/pre-commit
# Should run validation
```

**Expected Time**: 1 minute

**Verification**:
```bash
# Create test commit with stale types
# Should block
git commit -m "test"
# Expected: ❌ COMMIT BLOCKED: Database types are out of sync
```

---

### Issue 6.2: Pre-Commit Hook Too Slow

**Symptom**: Pre-commit hook takes 30+ seconds to run

**Cause**: Running full test suite in pre-commit hook

**Solution**:

```bash
# Pre-commit hook should only validate types (3 seconds)
# NOT run full test suite

# Check hook configuration
cat .git/hooks/pre-commit

# Should have:
npm run types:check-local --silent

# Should NOT have:
npm test  # Too slow for pre-commit
npm run validate:local  # Too slow for pre-commit

# If incorrect, update hook:
nano .git/hooks/pre-commit
# Remove slow commands
```

**Expected Time**: 1 minute

**Best Practice**: Run full test suite manually before pushing, not on every commit

---

### Issue 6.3: Pre-Commit Hook Fails with "npm: command not found"

**Symptom**:
```bash
git commit -m "feat: implement feature"
# Error: npm: command not found
```

**Cause**: Pre-commit hook can't find npm in PATH

**Solution**:

```bash
# Update hook shebang to use bash with full environment
nano .git/hooks/pre-commit

# Change first line from:
#!/bin/sh

# To:
#!/bin/bash
source ~/.bashrc  # Load full environment

# Or use full npm path:
/usr/bin/npm run types:check-local
```

**Expected Time**: 2 minutes

---

## 7. GitHub Actions Issues

### Issue 7.1: GitHub Actions Type Validation Fails on PR

**Symptom**: PR checks fail with "Types out of sync with cloud-dev"

**Cause**: Committed types don't match cloud-dev schema

**Solution**:

```bash
# 1. Download diff artifact from GitHub Actions run
# Go to: Actions tab → Failed workflow → Artifacts → cloud-dev-type-diff.txt

# 2. Review diff to understand what changed

# 3. Regenerate types from cloud-dev
npm run types:cloud-dev

# 4. Commit and push
git add src/types/supabase.ts
git commit -m "chore(types): sync with cloud-dev schema"
git push origin feature-branch

# 5. PR checks re-run automatically
```

**Expected Time**: 5 minutes

**Prevention**: Run `npm run types:check-cloud-dev` before opening PR

---

### Issue 7.2: GitHub Actions Fails with "SUPABASE_ACCESS_TOKEN not set"

**Symptom**: GitHub Actions workflow fails during Supabase CLI authentication

**Cause**: GitHub secret not configured

**Solution**:

```bash
# 1. Create Supabase access token
# Visit: https://app.supabase.com/account/tokens
# Create new token

# 2. Add to GitHub secrets
# Go to: Repository → Settings → Secrets and variables → Actions
# Create new secret:
#   Name: SUPABASE_ACCESS_TOKEN
#   Value: [paste token]

# 3. Re-run workflow
# Go to: Actions tab → Failed workflow → Re-run jobs
```

**Expected Time**: 10 minutes

**Note**: Only repository admins can add secrets

---

### Issue 7.3: GitHub Actions Hangs on Type Generation

**Symptom**: GitHub Actions workflow stuck on "Generating types from cloud-dev" step

**Cause**: Network timeout or Supabase CLI issue

**Solution**:

```bash
# 1. Cancel workflow run
# Actions tab → Running workflow → Cancel

# 2. Check Supabase status: https://status.supabase.com

# 3. Try manual type generation locally
npm run types:cloud-dev
# If succeeds locally, GitHub Actions networking issue

# 4. Re-run workflow
# Usually transient network issue
```

**Expected Time**: 5 minutes

**If persists**: Contact DevOps team (possible GitHub Actions infrastructure issue)

---

## 8. Development Workflow Issues

### Issue 8.1: Forgot Which Environment Is Active

**Symptom**: Not sure if app is using local or cloud-dev database

**Solution**:

```bash
# Check in app:
# Settings → Developer Settings → Current Environment
# Shows which environment is active

# Or check AsyncStorage directly (advanced):
# In app, run:
import AsyncStorage from '@react-native-async-storage/async-storage';
const env = await AsyncStorage.getItem('supabase_environment');
console.log('Current environment:', env);  # "local", "cloud-dev", or "cloud-prod"
```

**Expected Time**: 10 seconds

---

### Issue 8.2: Accidentally Committed to Wrong Branch

**Symptom**: Committed type changes to main instead of feature branch

**Solution**:

```bash
# 1. Don't push yet (if not pushed)
# Move commits to new branch
git branch feat/fix-types  # Create branch with current commits
git reset --hard origin/main  # Reset main to remote
git checkout feat/fix-types  # Switch to new branch

# 2. If already pushed:
# Revert commit on main
git checkout main
git revert HEAD
git push origin main

# Cherry-pick to feature branch
git checkout feat/fix-types
git cherry-pick <commit-hash>
git push origin feat/fix-types
```

**Expected Time**: 5 minutes

---

### Issue 8.3: Need to Test Feature on Both Local and Cloud-Dev

**Symptom**: Feature works on local, need to verify on cloud-dev without committing cloud-dev types

**Solution**:

```bash
# Use git stash to switch types temporarily

# 1. Test on local (already working)
npm run types:local
npm start
# Test feature

# 2. Switch to cloud-dev temporarily
git stash  # Stash current work

npm run types:cloud-dev
npm start
# In-app: Switch to Cloud Development
# Test feature

# 3. Return to local
git stash pop  # Restore original work
npm run types:local
npm start
# In-app: Switch back to Local Development
```

**Expected Time**: 5-10 minutes

---

### Issue 8.4: Multiple Developers Committing Type Changes

**Symptom**: Git merge conflict in `src/types/supabase.ts`

**Solution**:

```bash
# 1. Pull latest
git pull origin main
# Conflict in src/types/supabase.ts

# 2. Don't resolve manually (types are generated)
# Regenerate from source of truth
npm run types:local  # Or types:cloud-dev

# 3. Mark as resolved
git add src/types/supabase.ts

# 4. Complete merge
git merge --continue
# Or: git rebase --continue
```

**Expected Time**: 1 minute

**Best Practice**: Never manually resolve type conflicts, always regenerate

---

## Quick Diagnostic Commands

### Check System Health

```bash
# ========================================
# SUPABASE STATUS
# ========================================
# Check local Supabase
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase status
# Expected: Status: Running

# Check cloud-dev reachability
curl https://nuhwmubvygxyddkycmpa.supabase.co/rest/v1/
# Expected: {"message":"Authentication required"}

# ========================================
# TYPE SYNCHRONIZATION
# ========================================
# Check type alignment (local)
npm run types:check-local
# Expected: ✅ Types are current with local Supabase

# Check type alignment (cloud-dev)
npm run types:check-cloud-dev
# Expected: ✅ Types are current with cloud-dev Supabase

# ========================================
# TYPESCRIPT COMPILATION
# ========================================
# Check TypeScript errors
npm run type-check
# Expected: ✅ No errors

# ========================================
# TEST SUITE
# ========================================
# Run all tests
npm test
# Expected: All tests passing (or known failures only)

# ========================================
# ENVIRONMENT CONFIGURATION
# ========================================
# Check environment configurations
cat src/config/environments.ts | grep -A 10 "local:"
cat src/config/environments.ts | grep -A 10 "cloud-dev:"

# ========================================
# PRE-COMMIT HOOK
# ========================================
# Check pre-commit hook exists
ls -la .git/hooks/pre-commit
# Expected: File exists and is executable

# Test pre-commit hook
.git/hooks/pre-commit
# Expected: ✅ Database types are synchronized

# ========================================
# GITHUB ACTIONS
# ========================================
# Check GitHub Actions secrets (requires admin access)
gh secret list
# Expected: SUPABASE_ACCESS_TOKEN listed

# ========================================
# COORDINATION INBOX
# ========================================
# Check for unread messages
ls ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/
# Expected: Empty or README.md only (no unactioned messages)

# ========================================
# WSL NETWORKING (Windows only)
# ========================================
# Check WSL host IP (PowerShell)
ipconfig | Select-String "vEthernet.*WSL" -Context 0,5
# Note IPv4 address

# Test port 54321 accessibility
curl http://172.21.24.107:54321/rest/v1/
# Expected: {"message":"Authentication required"}
```

### Common Error Patterns and Quick Fixes

| Error Pattern | Quick Fix |
|---------------|-----------|
| `Types are out of sync` | `npm run types:local` |
| `Failed to generate types` | `npx supabase login` |
| `Supabase CLI not found` | `npm install -g supabase` |
| `Connection failed` | `supabase start` (in backend repo) |
| `COMMIT BLOCKED` | `npm run types:local && git add src/types/supabase.ts` |
| `GitHub Actions failing` | `npm run types:cloud-dev` |
| `Port 54321 in use` | `supabase stop --all && supabase start` |
| `WSL IP changed` | Update IP in `src/config/environments.ts` |

---

## Emergency Recovery Procedures

### Procedure 1: Complete Type Reset

**Use Case**: Types completely broken, need clean slate

```bash
# 1. Back up current types
cp src/types/supabase.ts src/types/supabase.ts.backup

# 2. Delete types
rm src/types/supabase.ts

# 3. Regenerate from local
npm run types:local

# 4. Validate
npm run validate:local

# 5. If tests fail, restore backup and investigate
# cp src/types/supabase.ts.backup src/types/supabase.ts
```

**Expected Time**: 1 minute

---

### Procedure 2: Complete Environment Reset

**Use Case**: Environment switching completely broken

```bash
# 1. Clear all app data
# In app: Settings → Clear All Data

# 2. Uninstall app completely
# On device: Long press app → Uninstall

# 3. Reinstall app
npm start
# Scan QR code with Expo Go

# 4. Reconfigure environment
# Settings → Developer Settings → Select "Local Development"

# 5. Test connection
# Tap "Test Connection"
# Should show: ✅ Connected
```

**Expected Time**: 5 minutes

---

### Procedure 3: Complete Development Environment Reset

**Use Case**: Everything broken, need fresh start

```bash
# 1. Stop all processes
# Kill Expo dev server: Ctrl+C
# Stop Supabase: supabase stop --all

# 2. Clean mobile app
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
rm -rf node_modules
rm -rf .expo
npm cache clean --force

# 3. Reinstall dependencies
npm install

# 4. Regenerate types
npm run types:local

# 5. Start Supabase
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase start

# 6. Start mobile app
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm start
```

**Expected Time**: 10-15 minutes

---

## Getting Help

### Self-Help Resources

1. **Documentation**:
   - [Developer Workflow Guide](./DEVELOPER-WORKFLOW-MULTI-ENVIRONMENT.md)
   - [Multi-Environment Type Sync Guide](./cross-project-coordination/protocols/type-synchronization/multi-environment-type-sync-guide.md)
   - [CLAUDE.md](../../../../../CLAUDE.md) - Environment switching section

2. **Logs and Diagnostics**:
   - Expo logs: Monitor terminal running `npm start`
   - Supabase logs: `supabase logs` in backend repo
   - GitHub Actions logs: Actions tab on GitHub

3. **Quick Diagnostic**:
   - Run all diagnostic commands above
   - Copy output to GitHub issue or team chat

### Team Support

| Issue Type | Contact | Response Time |
|------------|---------|---------------|
| Type sync issues | DevOps team | < 1 hour |
| Backend schema questions | Backend team lead | < 2 hours |
| Production crashes | On-call engineer | < 30 minutes |
| Build failures | DevOps team | < 2 hours |
| Environment switching bugs | Mobile team lead | < 4 hours |

### Reporting Bugs

**When reporting issues, include**:

1. **Environment Information**:
   ```bash
   # Run and include output
   node --version
   npm --version
   npx supabase --version
   npx expo --version

   # Device information
   # OS: Windows 11 / macOS / Linux
   # WSL version (if Windows): wsl --version
   # Physical device or emulator
   ```

2. **Error Messages**:
   - Full error message (not truncated)
   - Stack trace (if available)
   - Screenshot (if UI issue)

3. **Steps to Reproduce**:
   - Exact sequence of actions that triggered issue
   - Expected behavior vs actual behavior

4. **Diagnostic Output**:
   ```bash
   # Include output of:
   npm run types:check-local
   npm run type-check
   supabase status
   ```

5. **Recent Changes**:
   - Backend schema changes
   - Recent git commits
   - Environment switches

---

## Appendix: Advanced Debugging

### Debug Type Generation Process

```bash
# Verbose type generation
cd ~/dev/wildlifeai/wildlife-watcher-backend
npx supabase gen types typescript --local --debug > /tmp/types-debug.log 2>&1

# Review debug output
cat /tmp/types-debug.log
```

### Debug Supabase Client Initialization

```bash
# Add debug logs to supabase.ts
# src/services/supabase.ts

export const initializeSupabaseClient = async (config: EnvironmentConfig): Promise<void> => {
  console.log('[Supabase] Initializing client with config:', {
    url: config.supabaseUrl,
    hasAnonKey: !!config.supabaseAnonKey,
  });

  // ... rest of implementation
};
```

### Debug AsyncStorage Persistence

```bash
# Add debug logs to EnvironmentManager.ts
# src/config/EnvironmentManager.ts

export const setEnvironment = async (envId: EnvironmentId): Promise<void> => {
  console.log('[EnvironmentManager] Setting environment to:', envId);

  try {
    await AsyncStorage.setItem(STORAGE_KEY, envId);
    console.log('[EnvironmentManager] Environment saved to AsyncStorage');
  } catch (error) {
    console.error('[EnvironmentManager] Failed to save environment:', error);
    throw error;
  }
};
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-30
**Maintainer**: Wildlife.ai Mobile Development Team

**Questions?** Ask in team chat: `#wildlife-watcher-mobile`
