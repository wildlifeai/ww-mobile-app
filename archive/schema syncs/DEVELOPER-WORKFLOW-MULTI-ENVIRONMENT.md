# Developer Workflow Guide: Multi-Environment Development

**Purpose**: Practical workflows for developers using the Runtime Environment Switching system

**Last Updated**: 2025-10-30
**Status**: Production-Ready
**Version**: 1.0

---

## Table of Contents

1. [Your First Day Setup](#your-first-day-setup)
2. [Daily Development Workflow](#daily-development-workflow)
3. [Preparing for Stakeholder Demo (Preview Build)](#preparing-for-stakeholder-demo-preview-build)
4. [Production Deployment Workflow](#production-deployment-workflow)
5. [Backend Schema Changed Workflow](#backend-schema-changed-workflow)
6. [Emergency Hotfix Workflow](#emergency-hotfix-workflow)
7. [Team Collaboration Patterns](#team-collaboration-patterns)
8. [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)
9. [Quick Reference](#quick-reference)

---

## 1. Your First Day Setup

### Prerequisites Checklist

Before you begin, ensure you have:
- [ ] **Node.js 18+** installed (`node --version` to check)
- [ ] **npm** installed (`npm --version` to check)
- [ ] **WSL2** configured (if on Windows 11)
- [ ] **Supabase CLI** installed (`npx supabase --version` to check)
- [ ] **EAS CLI** installed (`npm install -g eas-cli`)
- [ ] **Android Studio** or **Xcode** configured for testing
- [ ] **Expo Go** app installed on your physical device (optional)

### Initial Setup Steps

#### Step 1: Clone Repositories

```bash
# Clone mobile app repository
cd ~/dev/wildlifeai
git clone [repo-url] wildlife-watcher-mobile-app
cd wildlife-watcher-mobile-app

# OPTIONAL: Clone backend repository (for full cross-repo coordination)
cd ~/dev/wildlifeai
git clone [repo-url] wildlife-watcher-backend
```

**Note**: While cloning the backend is recommended for full visibility, the mobile app now supports a **GitHub Fallback**. If you haven't cloned the backend locally, the sync script will automatically fetch the latest schema from GitHub.

**Why a local Supabase?** It provides a disposable sandbox for testing the app's **offline-first sync engine** and powers isolated **CI/CD integration tests**. See [supabase/README.md](../../supabase/README.md) for the full rationale.

#### Step 2: Configure Local Environment

```bash
# Navigate to mobile app directory
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your credentials
# Ask team for:
#   - EXPO_PUBLIC_SUPABASE_URL
#   - EXPO_PUBLIC_SUPABASE_ANON_KEY
#   - GOOGLE_MAPS_API_KEY_ANDROID
#   - GOOGLE_MAPS_API_KEY_IOS
nano .env.local  # or use your preferred editor

# Install dependencies
npm install

# Verify installation
npm run type-check  # Should pass with 0 errors
npm test           # Should pass all tests (or show known failures)
```

**Expected Time**: 10-15 minutes (depending on npm install speed)

#### Step 3: Start Local Supabase

```bash
# Navigate to backend repository
cd ~/dev/wildlifeai/wildlife-watcher-backend

# Start local Supabase instance
supabase start

# Wait for initialization (first time: ~2-3 minutes)
# Subsequent starts: ~10-20 seconds

# Verify it's running
supabase status

# Expected output:
#   API URL: http://localhost:54321
#   Status: Running
#   DB URL: postgresql://postgres:postgres@localhost:54322/postgres
```

**Troubleshooting**:
- If `supabase: command not found`, install CLI: `npm install -g supabase`
- If port conflict (54321 in use), stop other Supabase instances: `supabase stop --all`
- If Docker not running, start Docker Desktop

#### Step 4: Generate Types for Local Environment

```bash
# Navigate to mobile app repository
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app

# Generate types from local Supabase
npm run types:local

# Expected output:
#   Generating types from local Supabase...
#   Types written to: src/types/supabase.ts
#   ✅ Done in 3s

# Validate everything compiles
npm run validate:local

# Expected output:
#   ✅ Type check passed
#   ✅ TypeScript compilation successful
#   ✅ Tests passed (or show known failures)
```

**Expected Time**: 3-5 seconds for type generation, 30 seconds for full validation

#### Step 5: Launch App in Development Mode

```bash
# Start Expo development server
npm start

# Choose a testing method:
# Option 1: Physical device with Expo Go
#   - Scan QR code with Expo Go app
#   - Ensure device on same network as development machine

# Option 2: Android emulator
#   - Press 'a' in terminal
#   - Requires Android Studio with emulator configured

# Option 3: iOS simulator (macOS only)
#   - Press 'i' in terminal
#   - Requires Xcode installed
```

**Expected Time**: 30-60 seconds to launch

#### Step 6: Verify Environment

Once app launches:

1. **Navigate to Developer Settings**:
   - Tap **Settings** tab (bottom navigation)
   - Scroll down to **Developer Settings** section
   - Tap **Developer Settings**

2. **Verify Default Environment**:
   - Should show **"Local Development"** selected (default)
   - Connection status shows **"Not Tested"** initially

3. **Test Connection**:
   - Tap **"Test Connection"** button
   - Should show **"✅ Connected"** with green status
   - If fails, see [Troubleshooting Guide](./TROUBLESHOOTING-ENVIRONMENT-SWITCHING.md#cant-connect-to-local-supabase)

4. **Verify Database Access**:
   - Navigate to **Projects** tab
   - Should load projects from local database
   - If no projects, database is empty (expected for fresh install)

**Congratulations!** You're ready for development. 🎉

---

## 2. Daily Development Workflow

### Morning Routine (5 minutes)

Start your day with this routine to ensure a smooth development experience:

```bash
# 1. Pull latest changes from remote
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
git pull origin dev-mvp2-development

# 2. Check for backend schema changes (coordination inbox)
ls ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/

# If messages exist, read and action them:
cat ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/[message].md
# Follow instructions in message (usually "npm run types:local")

# 3. Start local Supabase (if not running)
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase start

# Or restart if already running:
supabase stop && supabase start

# 4. Verify type alignment
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:check-local

# If out of sync (common after pulling backend changes):
npm run types:local

# 5. Start development server
npm start
```

**Pro Tip**: Create a shell alias for the morning routine:
```bash
# Add to ~/.bashrc or ~/.zshrc
alias ww-start='cd ~/dev/wildlifeai/wildlife-watcher-backend && supabase start && cd ~/dev/wildlifeai/wildlife-watcher-mobile-app && npm run types:check-local && npm start'
```

### Development Loop (TDD Approach)

Follow this loop for implementing features:

```bash
# 1. Create feature branch
git checkout -b feat/your-feature-name

# 2. Write tests FIRST (TDD Red-Green-Refactor)
# Example: Create test file
touch src/services/__tests__/YourService.test.ts

# Write failing tests
npm test src/services/__tests__/YourService.test.ts --watch
# ❌ Tests fail (Red phase)

# 3. Implement functionality
# Edit: src/services/YourService.ts

# 4. Verify tests pass
npm test src/services/__tests__/YourService.test.ts
# ✅ Tests pass (Green phase)

# 5. Refactor code
# Clean up implementation while keeping tests passing

# 6. Run full validation
npm test                 # All tests should pass
npm run type-check       # 0 TypeScript errors
npm run lint             # Clean linting

# 7. Commit regularly (at sensible checkpoints)
git add .
git commit -m "feat: implement feature X"
# Pre-commit hook validates types automatically (3 seconds)

# 8. Push to remote
git push origin feat/your-feature-name
```

**Best Practices**:
- **Commit frequently**: After each subtask completion (not just end of day)
- **Descriptive commits**: Use conventional commits format (`feat:`, `fix:`, `chore:`)
- **Small commits**: Easier to review and revert if needed
- **Test before commit**: Pre-commit hook will block if types stale or tests fail

### Testing Features Against Different Environments

#### Testing Against Local Backend

```bash
# Already configured by default
# App automatically connects to http://172.21.24.107:54321

# Verify environment in app:
# Settings → Developer Settings → "Local Development" selected
```

#### Testing Against Cloud Development

```bash
# 1. Generate types from cloud-dev
npm run types:cloud-dev

# 2. Launch app (if not running)
npm start

# 3. Switch environment at runtime
# In-app:
#   Settings → Developer Settings → Select "Cloud Development" → Apply & Restart

# 4. Test features against cloud-dev database
# App now connects to https://nuhwmubvygxyddkycmpa.supabase.co

# 5. When done, switch back to local
# In-app:
#   Settings → Developer Settings → Select "Local Development" → Apply & Restart
```

**Use Cases for Cloud-Dev Testing**:
- Testing Edge Functions (only available in cloud)
- Testing Realtime subscriptions (better performance in cloud)
- Testing Storage uploads (S3 backend)
- Collaborating with team using shared staging database
- Debugging issues specific to cloud environment

### End of Day Routine (2 minutes)

```bash
# 1. Commit all work in progress
git add .
git commit -m "wip: end of day checkpoint for feature X"

# 2. Push to remote (backup and visibility)
git push origin feat/your-feature-name

# 3. Stop local Supabase (optional, to free resources)
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase stop

# Optional: Stop Expo dev server (Ctrl+C)
```

**Pro Tip**: Use `git stash` if you have uncommitted changes you don't want to commit yet:
```bash
git stash save "WIP: feature X - partial implementation"
# Work is saved, working directory clean
# Restore later: git stash pop
```

---

## 3. Preparing for Stakeholder Demo (Preview Build)

**Scenario**: Product owner wants to see your feature on a real device for Friday demo

**Timeline**: ~30-45 minutes (build time depends on EAS queue)

**Prerequisites**:
- Feature complete and tested locally
- All tests passing
- TypeScript errors resolved

### Step-by-Step Workflow

#### Step 1: Ensure Feature Complete on Local

```bash
# Verify everything works locally
npm test                    # All tests pass
npm run type-check          # 0 TypeScript errors
npm run lint                # Clean linting

# Manual testing checklist:
# - Test feature on physical device (Expo Go)
# - Test feature on emulator
# - Test offline behavior (if applicable)
# - Test edge cases and error scenarios
```

**Time**: 10-15 minutes (depending on feature complexity)

#### Step 2: Switch to Cloud-Dev Types

Preview builds connect to cloud-dev Supabase instance, so types must match cloud-dev schema.

```bash
# Generate types from cloud-dev
npm run types:cloud-dev

# Validate alignment
npm run validate:cloud-dev

# If validation fails:
#   - Backend may not have deployed to cloud-dev yet
#   - Coordinate with backend team
#   - Wait for backend deployment, then regenerate types
```

**Time**: 10-15 seconds (network call)

**Expected Output** (Success):
```
🔍 Checking if types are current with cloud-dev Supabase...
✅ Types are current with cloud-dev Supabase
✅ TypeScript compilation successful
✅ Tests passed
```

**Expected Output** (Out of Sync):
```
❌ ERROR: Types are out of sync with cloud-dev!

Diff:
- old_field: string
+ new_field: number

To fix:
  1. Coordinate with backend team
  2. Wait for cloud-dev deployment
  3. Run: npm run types:cloud-dev
```

#### Step 3: Test with Cloud-Dev Environment (Optional but Recommended)

Before building preview, test your feature against cloud-dev database to catch any environment-specific issues.

```bash
# 1. Launch app (if not running)
npm start

# 2. In app: Settings → Developer Settings
# 3. Select "Cloud Development"
# 4. Tap "Apply & Restart"

# 5. Test your feature against cloud-dev data
#    - Verify no errors in Expo console
#    - Test authentication
#    - Test data operations
#    - Verify offline sync

# 6. When satisfied, proceed to build
```

**Time**: 5-10 minutes

#### Step 4: Commit Cloud-Dev Types

```bash
# Commit type changes
git add src/types/supabase.ts
git commit -m "chore(types): sync with cloud-dev for preview build"

# Push to remote
git push origin feat/your-feature-name
```

**Time**: 5 seconds

#### Step 5: Build Preview with EAS

```bash
# Ensure you're on the correct branch
git status
# Should show: On branch feat/your-feature-name

# Build preview for Android
eas build --platform android --profile preview

# Build preview for iOS (if needed, macOS only)
eas build --platform ios --profile preview

# Wait for build (typical times):
#   - Android: 15-30 minutes
#   - iOS: 20-40 minutes

# Monitor build progress:
#   - EAS CLI shows build URL
#   - Visit URL for live logs
#   - Or use: eas build:list
```

**Time**: 15-40 minutes (EAS queue + build time)

**Build Configuration** (automatic):
- **Environment**: Fixed to `cloud-dev` (no switching in preview builds)
- **Type Source**: Cloud-dev Supabase
- **Build Variant**: `preview` (`app.config.js` automatically sets this)

#### Step 6: Install on Demo Device

```bash
# Option 1: Download APK/IPA from EAS dashboard
#   - Visit EAS dashboard: https://expo.dev/accounts/[account]/projects/wildlife-watcher/builds
#   - Click latest preview build
#   - Download APK (Android) or IPA (iOS)
#   - Install on device

# Option 2: Use QR code (Android only)
#   - EAS build completion shows QR code
#   - Scan with device camera
#   - Downloads and installs automatically

# Option 3: Share build link
#   - Copy build URL from EAS dashboard
#   - Send to stakeholder
#   - They install via link
```

**Time**: 2-5 minutes

#### Step 7: Verify and Demo

1. **Launch app on demo device**
2. **Verify environment** (should be fixed to cloud-dev, no switching option)
3. **Test authentication** (cloud-dev credentials)
4. **Demo your feature** to stakeholder
5. **Gather feedback**

**Time**: 15-30 minutes (demo duration)

#### Step 8: Return to Local Development

After demo, switch back to local types for continued development:

```bash
# Generate types from local Supabase
npm run types:local

# Validate alignment
npm run validate:local

# Commit type change
git add src/types/supabase.ts
git commit -m "chore(types): return to local development environment"

# Push to remote
git push origin feat/your-feature-name

# Switch environment in app (if still running)
# Settings → Developer Settings → Select "Local Development" → Apply & Restart
```

**Time**: 5 seconds

**Total Time**: ~30-45 minutes (excluding build queue time)

---

## 4. Production Deployment Workflow

**Scenario**: Feature approved, ready for production deployment

**Timeline**: ~1-2 hours (including build time and app store submission)

**Prerequisites**:
- Feature merged to `main` branch
- All PR checks passed (GitHub Actions, tests, linting)
- QA testing complete
- Product owner approval

### Step-by-Step Workflow

#### Step 1: Create Release Branch

```bash
# Pull latest main
git checkout main
git pull origin main

# Create release branch
git checkout -b release/v1.x.x

# Bump version in app.config.js and package.json
# Use semantic versioning: major.minor.patch
npm version patch  # or minor, or major

# Commit version bump
git add .
git commit -m "chore(release): bump version to v1.x.x"

# Push release branch
git push origin release/v1.x.x
```

**Time**: 2-3 minutes

#### Step 2: Switch to Cloud-Prod Types (Future)

**Status**: Cloud-prod environment not yet configured. This step is a placeholder for future workflow.

```bash
# Generate types from cloud-prod
npm run types:cloud-prod

# Validate alignment
npm run validate:cloud-prod

# Commit type changes
git add src/types/supabase.ts
git commit -m "chore(types): sync with cloud-prod for production build"
```

**Time**: 10-15 seconds

#### Step 3: Final Validation

```bash
# Run comprehensive validation
npm run validate:cloud-prod  # Full test suite

# Manual testing checklist (on production-like environment):
# - Authentication flow
# - Critical user journeys
# - Offline functionality
# - Data sync
# - Edge cases

# Verify build configuration
cat app.config.js
# Ensure production environment correctly configured
```

**Time**: 10-15 minutes

#### Step 4: Build Production with EAS

```bash
# Build production for Android
eas build --platform android --profile production

# Build production for iOS
eas build --platform ios --profile production

# Wait for builds (typical times):
#   - Android: 20-40 minutes
#   - iOS: 30-50 minutes

# Monitor build progress
eas build:list
```

**Time**: 30-50 minutes (build time)

**Build Configuration** (automatic):
- **Environment**: Fixed to `cloud-prod` (no switching in production)
- **Type Source**: Cloud-prod Supabase
- **Build Variant**: `production`
- **Credentials**: EAS secrets for production Supabase keys
- **Optimizations**: Hermes enabled, minification, code obfuscation

#### Step 5: Submit to App Stores

```bash
# Submit to Google Play Store (Android)
eas submit --platform android --profile production

# Submit to Apple App Store (iOS)
eas submit --platform ios --profile production

# Follow EAS prompts for:
#   - Store credentials
#   - Release notes
#   - Build selection
```

**Time**: 10-15 minutes (submission process)

**App Store Review Times**:
- **Google Play**: 1-3 days (typically)
- **Apple App Store**: 1-7 days (typically)

#### Step 6: Merge Release to Main

```bash
# After builds submitted successfully
git checkout main
git merge release/v1.x.x

# Create Git tag
git tag -a v1.x.x -m "Release version 1.x.x"

# Push to remote
git push origin main --tags

# Delete release branch (optional)
git branch -d release/v1.x.x
git push origin --delete release/v1.x.x
```

**Time**: 1-2 minutes

#### Step 7: Post-Deployment Monitoring

After app store approval and rollout:

1. **Monitor crash reports** (Sentry, Firebase Crashlytics)
2. **Monitor user feedback** (app store reviews)
3. **Track key metrics** (authentication rate, sync errors, offline queue size)
4. **Respond to critical issues** (follow Emergency Hotfix workflow if needed)

**Status**: Cloud-prod environment not yet configured. Full production workflow pending.

---

## 5. Backend Schema Changed Workflow

**Scenario**: Backend team deployed new migration with schema changes

**Trigger**: Message in `~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/`

**Timeline**: 5-10 minutes

### Step-by-Step Workflow

#### Step 1: Check Coordination Inbox (Daily Routine)

```bash
# Check for messages
ls ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/

# Expected output (if messages exist):
#   2025-10-30-schema-change-camera-deployments.md
#   2025-10-29-task-request-add-deployment-wizard.md

# No messages = no action needed
```

**Frequency**: Daily at start of day, or when pre-commit hook warns

#### Step 2: Read Coordination Message

```bash
# Read message
cat ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/2025-10-30-schema-change-camera-deployments.md

# Example message content:
---
Type: schema-change
From: Backend Development Team
To: Mobile Development Team
Date: 2025-10-30
Environment: local
Priority: high

## Summary
Added new 'camera_deployments' table with columns:
- id (uuid, primary key)
- project_id (uuid, foreign key to projects)
- camera_id (uuid, foreign key to cameras)
- deployed_at (timestamp with timezone)
- retrieved_at (timestamp with timezone, nullable)
- location (geography, point)
- created_at (timestamp with timezone)
- updated_at (timestamp with timezone)

## Impact
- High: New functionality required
- Mobile app needs to implement camera deployment tracking
- Types must be regenerated

## Action Required
1. Regenerate types: `npm run types:local`
2. Implement CameraDeploymentService
3. Update UI components for deployment tracking

## Backend Developer
John Doe (john@wildlife.ai)
---
```

#### Step 3: Determine Environment Impact

**Message says "Environment: local"**:
- Backend changed local schema only
- Action: Regenerate types from local

**Message says "Environment: cloud-dev"**:
- Backend deployed to cloud-dev
- Action: Regenerate types from cloud-dev

**Message says "Environment: cloud-prod"**:
- Backend deployed to production
- Action: Regenerate types from cloud-prod

#### Step 4: Regenerate Types for Affected Environment

```bash
# For local changes (most common)
npm run types:local

# For cloud-dev changes
npm run types:cloud-dev

# For cloud-prod changes (future)
npm run types:cloud-prod

# Validate alignment
npm run validate:local  # or validate:cloud-dev, etc.
```

**Time**: 3 seconds (local), 10-15 seconds (cloud)

**Expected Output**:
```
Generating types from local Supabase...
Types written to: src/types/supabase.ts
✅ Done in 3s

✅ Type check passed
✅ TypeScript compilation successful
✅ Tests passed
```

#### Step 5: Review Type Changes

```bash
# View diff of type changes
git diff src/types/supabase.ts

# Expected output (example):
+  camera_deployments: {
+    Row: {
+      id: string
+      project_id: string
+      camera_id: string
+      deployed_at: string
+      retrieved_at: string | null
+      location: unknown // geography type
+      created_at: string
+      updated_at: string
+    }
+    Insert: { ... }
+    Update: { ... }
+  }
```

**Review for**:
- New tables added
- Columns added/removed/renamed
- Type changes (e.g., `string | null` → `string`)
- Breaking changes that require code updates

#### Step 6: Update Code (if needed)

If schema changes add new functionality:

```bash
# Create new service for new table
touch src/services/CameraDeploymentService.ts

# Write tests first (TDD)
touch src/services/__tests__/CameraDeploymentService.test.ts

# Implement service
# Update UI components
# Add screens/navigation as needed
```

**Time**: Varies (30 minutes to several hours depending on complexity)

#### Step 7: Commit Type Changes

```bash
# If ONLY type sync (no new implementation)
git add src/types/supabase.ts
git commit -m "chore(types): sync with backend schema changes (camera_deployments table)"

# If new implementation included
git add .
git commit -m "feat: integrate camera_deployments table from backend

- Regenerate types with new camera_deployments table
- Implement CameraDeploymentService
- Add deployment tracking UI components

Backend coordination: 2025-10-30-schema-change-camera-deployments.md"
```

**Best Practice**: Reference coordination message in commit for traceability

#### Step 8: Archive Coordination Message

```bash
# Create archive directory if needed
mkdir -p ~/dev/wildlifeai/cross-project-coordination/archive/$(date +%Y-%m)

# Move message to archive
mv ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/2025-10-30-schema-change-camera-deployments.md \
   ~/dev/wildlifeai/cross-project-coordination/archive/$(date +%Y-%m)/

# Log message action
~/dev/wildlifeai/cross-project-coordination/.coordination/log-message.sh "Mobile" "Actioned schema-change: camera_deployments table"
```

**Time**: 10 seconds

#### Step 9: Push Changes

```bash
# Push to feature branch or main (depending on workflow)
git push origin feat/your-feature-name

# Or if on main:
git push origin main
```

**Total Time**: 5-10 minutes (type sync only), 30+ minutes (with new implementation)

---

## 6. Emergency Hotfix Workflow

**Scenario**: Critical production bug needs immediate fix

**Timeline**: 1-3 hours (depending on bug complexity)

**Priority**: P0 (drop everything)

### Step-by-Step Workflow

#### Step 1: Verify Bug Severity

**Critical bugs** (require hotfix):
- App crashes on launch
- Authentication completely broken
- Data loss or corruption
- Security vulnerability
- Core functionality completely broken

**Non-critical bugs** (can wait for next release):
- UI glitches
- Minor feature issues
- Performance degradation (unless severe)

#### Step 2: Create Hotfix Branch

```bash
# Pull latest production
git checkout main
git pull origin main

# Create hotfix branch from main
git checkout -b hotfix/critical-bug-description

# Example:
git checkout -b hotfix/auth-crash-on-logout
```

**Time**: 10 seconds

#### Step 3: Reproduce Bug in Local Environment

```bash
# Ensure local Supabase running
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase start

# Verify types aligned
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:check-local

# Launch app
npm start

# Reproduce bug steps
# Document exact steps in hotfix commit message
```

**Time**: 5-10 minutes

#### Step 4: Write Failing Test (TDD)

```bash
# Create test that reproduces bug
# Example: src/services/__tests__/AuthService.test.ts

# Add test case
describe('AuthService - Logout Bug', () => {
  it('should not crash when logging out with null session', async () => {
    // Arrange
    const authService = new AuthService();
    await authService.signOut();  // Currently crashes

    // Assert
    // Should not throw error
  });
});

# Run test
npm test src/services/__tests__/AuthService.test.ts
# ❌ Test fails (confirming bug)
```

**Time**: 10-15 minutes

#### Step 5: Fix Bug

```bash
# Implement fix
# Edit: src/services/AuthService.ts

# Run test
npm test src/services/__tests__/AuthService.test.ts
# ✅ Test passes

# Run full test suite
npm test

# Validate types
npm run type-check

# Test manually
npm start
# Verify bug fixed
```

**Time**: 30 minutes to 2 hours (depending on complexity)

#### Step 6: Commit Fix

```bash
# Commit with descriptive message
git add .
git commit -m "fix(auth): prevent crash on logout with null session

Bug: App crashes when user logs out while session is null
Cause: AuthService.signOut() didn't handle null session
Fix: Add null check before accessing session methods

Severity: Critical (P0)
Affected: Production users (v1.2.0 and above)
Test: Added regression test in AuthService.test.ts

Resolves: #1234"

# Push hotfix branch
git push origin hotfix/auth-crash-on-logout
```

**Time**: 1 minute

#### Step 7: Emergency Type Override (If Needed)

**Warning**: Only use if absolutely necessary (schema drift between environments)

If hotfix requires types that don't match cloud-prod yet:

```bash
# Skip pre-commit hook (EMERGENCY ONLY)
git commit --no-verify -m "fix: emergency hotfix (bypassing type validation)

Emergency type override due to:
[Detailed explanation]

Follow-up ticket: #XXXX to sync types"

# Immediately create follow-up ticket
# Document reason for bypass
# Schedule type sync for next release
```

**Note**: This should be **extremely rare**. Coordinate with backend team to align schemas ASAP.

#### Step 8: Build Emergency Release

```bash
# Bump patch version
npm version patch  # e.g., 1.2.0 → 1.2.1

# Build production
eas build --platform android --profile production
eas build --platform ios --profile production

# Wait for build (15-40 minutes)
```

**Time**: 15-40 minutes

#### Step 9: Submit to App Stores (Expedited Review)

```bash
# Submit with expedited review request
eas submit --platform android --profile production
eas submit --platform ios --profile production

# In submission notes:
# "CRITICAL BUG FIX: App crashes on logout. Affects all users on v1.2.0."

# Request expedited review (if available):
# - Apple: Use "Expedited App Review" form (1-2 days)
# - Google: Contact Play Console support (1-2 days)
```

**Time**: 10-15 minutes

#### Step 10: Merge Hotfix to Main and Develop

```bash
# Merge to main
git checkout main
git merge hotfix/auth-crash-on-logout

# Tag release
git tag -a v1.2.1 -m "Hotfix: Auth crash on logout"

# Push
git push origin main --tags

# Merge to develop (if using gitflow)
git checkout develop
git merge hotfix/auth-crash-on-logout
git push origin develop

# Delete hotfix branch
git branch -d hotfix/auth-crash-on-logout
git push origin --delete hotfix/auth-crash-on-logout
```

**Time**: 2-3 minutes

#### Step 11: Monitor Rollout

After app store approval:

1. **Monitor crash reports**: Verify crash rate drops
2. **Monitor user feedback**: Check app store reviews
3. **Communicate**: Notify team and stakeholders of fix
4. **Document**: Update incident postmortem document

**Total Time**: 1-3 hours (excluding app store review)

---

## 7. Team Collaboration Patterns

### Pattern A: Feature Branch Development

**Scenario**: Multiple developers working on different features

**Workflow**:

```bash
# Developer A: Feature branch for deployment wizard
git checkout -b feat/deployment-wizard

# Developer B: Feature branch for camera management
git checkout -b feat/camera-management

# Both develop independently with local types
npm run types:local

# Commit regularly
git commit -m "feat: implement step 1 of deployment wizard"

# Push frequently for visibility
git push origin feat/deployment-wizard
```

**Avoiding Conflicts**:
- Communicate in team chat: "I'm working on DeploymentService"
- Pull main frequently: `git pull origin main`
- Rebase instead of merge: `git rebase main` (keeps history clean)
- Use draft PRs for early feedback

### Pattern B: Parallel Feature Development

**Scenario**: Two features that touch the same files

**Workflow**:

```bash
# Developer A: Working on ProjectService
# Developer B: Also needs to modify ProjectService

# Developer A: Implements feature first
git checkout -b feat/project-filtering
# ... implement ...
git push origin feat/project-filtering

# Opens PR, gets reviewed, merges

# Developer B: Rebases on latest main
git checkout feat/project-sorting
git fetch origin
git rebase origin/main
# Resolve conflicts if any

# Test to ensure both features work together
npm test
npm run type-check

# Commit and push
git push origin feat/project-sorting --force-with-lease
```

**Best Practices**:
- **Small PRs**: Easier to review and merge quickly
- **Frequent rebases**: Reduces conflict complexity
- **Communication**: "I'm about to merge, hold off on rebasing"

### Pattern C: Backend-Mobile Coordination

**Scenario**: Feature requires both backend schema changes and mobile implementation

**Workflow**:

```bash
# Phase 1: Backend team implements schema
# Backend developer:
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase migration new add_feature_x
# ... implement migration ...
git add .
git commit -m "feat(db): add feature X schema"

# Backend pre-commit hook validates types
# Backend creates coordination message
~/dev/wildlifeai/cross-project-coordination/.coordination/create-message.sh \
  "Backend" "Mobile" "schema-change" \
  "Added feature X tables: users, projects"

# Phase 2: Mobile team receives message
# Mobile developer:
ls ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/
cat [message].md

# Regenerates types
npm run types:local

# Implements mobile feature
git checkout -b feat/feature-x
# ... implement ...

# Commits with coordination reference
git commit -m "feat: implement feature X

Backend coordination: 2025-10-30-schema-change-feature-x.md"
```

**Best Practices**:
- **Backend first**: Schema changes before mobile implementation
- **Coordination messages**: Mandatory for schema changes
- **Type sync**: Mobile regenerates types immediately
- **Testing coordination**: Backend provides test data

### Pattern D: Code Review Workflow

**Scenario**: PR ready for review, types need validation

**Workflow**:

```bash
# Developer: Open PR
git push origin feat/your-feature
# Open PR on GitHub

# GitHub Actions automatically:
# 1. Validates types against cloud-dev
# 2. Runs tests
# 3. Checks linting
# 4. Reports status

# If type validation fails:
# Download diff artifact from GitHub Actions
# Regenerate types
npm run types:cloud-dev

# Commit and push
git add src/types/supabase.ts
git commit -m "chore(types): sync with cloud-dev"
git push origin feat/your-feature

# Reviewer: Review code
# 1. Check implementation logic
# 2. Verify tests cover edge cases
# 3. Validate type safety
# 4. Test locally if needed

# Merge PR
# GitHub Actions validates again before merge
```

**Best Practices**:
- **Self-review first**: Review your own diff before requesting review
- **Test locally**: Don't rely only on CI/CD
- **Respond quickly**: Address review comments within 24 hours

---

## 8. Common Pitfalls and Solutions

### Pitfall 1: Forgot to Regenerate Types After Environment Switch

**Symptom**: TypeScript errors or runtime crashes after switching environments

**Example**:
```bash
# Developer switches to cloud-dev for testing
# In-app: Settings → Developer Settings → Cloud Development → Apply & Restart

# Continues coding with local types
# TypeScript compiles (types match local schema)
# Runtime crash: database schema doesn't match types
```

**Solution**:
```bash
# ALWAYS regenerate types after switching environments
# Check current environment in app (Developer Settings)

# If on local:
npm run types:local

# If on cloud-dev:
npm run types:cloud-dev

# If on cloud-prod:
npm run types:cloud-prod

# Validate alignment
npm run validate:local  # (or cloud-dev, cloud-prod)
```

**Prevention**:
- Use `npm run types:check-[environment]` before coding
- Pre-commit hook validates types (blocks commit if stale)

### Pitfall 2: Building Preview with Local Types

**Symptom**: Preview build crashes or has database connection errors

**Example**:
```bash
# Developer generates types from local
npm run types:local

# Builds preview (should use cloud-dev types)
eas build --profile preview

# Preview build connects to cloud-dev but has local types
# Runtime crash: schema mismatch
```

**Solution**:
```bash
# ALWAYS generate cloud-dev types before preview builds
npm run types:cloud-dev
npm run validate:cloud-dev

# Then build preview
eas build --profile preview
```

**Prevention**:
- Add pre-build script in `package.json`:
  ```json
  "scripts": {
    "prebuild:preview": "npm run validate:cloud-dev"
  }
  ```
- GitHub Actions validates types on PR (blocks merge if out of sync)

### Pitfall 3: Committing with Stale Types

**Symptom**: Pre-commit hook blocks commit with "types out of sync" error

**Example**:
```bash
# Backend team made schema changes yesterday
# Developer pulls latest backend code
git pull origin main

# Doesn't regenerate types
# Tries to commit
git commit -m "feat: implement feature"

# Pre-commit hook blocks:
# ❌ COMMIT BLOCKED: Database types are out of sync
```

**Solution**:
```bash
# Pre-commit hook tells you which environment is out of sync
npm run types:local        # Regenerate

# Review changes
git diff src/types/supabase.ts

# Add to staging
git add src/types/supabase.ts

# Commit again
git commit -m "feat: implement feature"
# ✅ Pre-commit hook passes
```

**Prevention**:
- Run `npm run types:check-local` at start of day
- Check coordination inbox daily
- Pre-commit hook automatically validates (3 seconds)

### Pitfall 4: WSL Networking Issues (Can't Connect to Local Supabase)

**Symptom**: App shows "Connection failed" for local environment

**Example**:
```bash
# Developer launches app on physical device
# Selects "Local Development"
# Taps "Test Connection"
# ❌ Connection Failed
```

**Solution**:
```bash
# 1. Verify local Supabase is running
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase status
# Should show: Status: Running

# If not running:
supabase start

# 2. Verify WSL host IP in environments.ts
cat src/config/environments.ts
# Should have: supabaseUrl: "http://172.21.24.107:54321"

# 3. Test WSL IP accessibility from device
# On Windows host, run:
ipconfig
# Find "WSL" adapter, check IP matches

# 4. Ensure firewall allows traffic on port 54321
# Windows: Allow inbound traffic on port 54321

# 5. For emulator testing, use localhost instead
# Emulators can access localhost directly
# Physical devices need WSL host IP
```

**Prevention**:
- Document WSL IP in team wiki
- Use environment variable for WSL IP (configurable per developer)

### Pitfall 5: Forgetting to Test After Type Regeneration

**Symptom**: Types regenerated but tests fail due to schema changes

**Example**:
```bash
# Backend adds new non-nullable column
# Developer regenerates types
npm run types:local

# Types now expect new column
# Existing tests fail (not providing new column in test data)

# Developer commits without running tests
# CI/CD fails
```

**Solution**:
```bash
# ALWAYS run tests after regenerating types
npm run types:local

# Update test data to include new columns
# src/services/__tests__/ProjectService.test.ts
const mockProject = {
  id: 'test-id',
  name: 'Test Project',
  new_column: 'default_value',  // Add new column
  // ...
};

# Run tests
npm test

# Validate full suite
npm run validate:local
```

**Prevention**:
- Use `npm run validate:local` (runs types + TypeScript + tests)
- Pre-commit hook runs tests (blocks commit if tests fail)

### Pitfall 6: Not Archiving Coordination Messages

**Symptom**: Inbox cluttered, pre-commit hook always warns

**Example**:
```bash
# Developer actioned schema-change message
# Forgot to archive it
# Inbox still has old message
# Pre-commit hook warns every commit:
# ⚠️  WARNING: Unread coordination messages (1)
```

**Solution**:
```bash
# Archive message after actioning
mv ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/[message].md \
   ~/dev/wildlifeai/cross-project-coordination/archive/$(date +%Y-%m)/

# Log action
~/dev/wildlifeai/cross-project-coordination/.coordination/log-message.sh \
  "Mobile" "Actioned schema-change"
```

**Prevention**:
- Archive immediately after actioning message
- Use coordination CLI tool for automation (future)

### Pitfall 7: Building Production with Wrong Types

**Symptom**: Production build crashes due to schema mismatch

**Example**:
```bash
# Developer builds production with local types
npm run types:local

# Builds production
eas build --profile production

# Production build connects to cloud-prod with local types
# Crash: schema mismatch
```

**Solution**:
```bash
# ALWAYS generate cloud-prod types before production builds
npm run types:cloud-prod
npm run validate:cloud-prod

# Then build production
eas build --profile production
```

**Prevention**:
- GitHub Actions validates types on PR (blocks merge if out of sync)
- Add pre-build script: `"prebuild:production": "npm run validate:cloud-prod"`

### Pitfall 8: Assuming Types Are Current

**Symptom**: Developer assumes types are current, doesn't validate

**Example**:
```bash
# Developer starts coding without checking types
# Implements feature using outdated types
# Compiles successfully (types are valid TypeScript)
# Runtime crash: schema changed
```

**Solution**:
```bash
# ALWAYS validate types at start of day
npm run types:check-local

# If out of sync, regenerate
npm run types:local
```

**Prevention**:
- Add to morning routine (see [Daily Development Workflow](#daily-development-workflow))
- Pre-commit hook validates types (blocks commit if stale)

---

## 9. Quick Reference

### Daily Commands Cheatsheet

```bash
# ========================================
# MORNING ROUTINE (5 minutes)
# ========================================
# Start of day
cd ~/dev/wildlifeai/wildlife-watcher-backend && supabase start
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app && npm run types:check-local

# ========================================
# ACTIVE DEVELOPMENT
# ========================================
# Development server + watch tests
npm start
npm test --watch

# ========================================
# BEFORE COMMIT
# ========================================
# Full validation
npm test && npm run type-check && npm run lint

# ========================================
# END OF DAY
# ========================================
# Commit and stop Supabase
git push && cd ~/dev/wildlifeai/wildlife-watcher-backend && supabase stop

# ========================================
# TYPE SYNCHRONIZATION
# ========================================
# Check types (3 seconds)
npm run types:check-local
npm run types:check-cloud-dev

# Regenerate types (3-15 seconds)
npm run types:local
npm run types:cloud-dev

# Full validation (30 seconds)
npm run validate:local
npm run validate:cloud-dev

# ========================================
# COORDINATION INBOX
# ========================================
# Check for messages
ls ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/

# Read message
cat ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/[message].md

# Archive after actioning
mv ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/[message].md \
   ~/dev/wildlifeai/cross-project-coordination/archive/$(date +%Y-%m)/

# ========================================
# ENVIRONMENT SWITCHING
# ========================================
# Local development (default)
# In-app: Settings → Developer Settings → "Local Development"

# Cloud development testing
# In-app: Settings → Developer Settings → "Cloud Development"

# ========================================
# BUILDING
# ========================================
# Preview build (stakeholder demo)
npm run types:cloud-dev && eas build --platform android --profile preview

# Production build (app stores)
npm run types:cloud-prod && eas build --platform android --profile production
```

### Environment Switching Cheatsheet

| Scenario | Environment | Type Command | Build Command |
|----------|-------------|--------------|---------------|
| **Local development** (daily) | `local` | `npm run types:local` | `npm start` |
| **Cloud testing** (shared staging) | `cloud-dev` | `npm run types:cloud-dev` | `npm start` + switch in-app |
| **Preview build** (stakeholder demo) | `cloud-dev` | `npm run types:cloud-dev` | `eas build --profile preview` |
| **Production** (app stores) | `cloud-prod` | `npm run types:cloud-prod` | `eas build --profile production` |

### Type Validation Decision Tree

```
Start
  ↓
  Did backend schema change? ───Yes──→ Check coordination inbox
  ↓ No                                   ↓
  ↓                                    Read message
  ↓                                      ↓
  Are you switching environments? ──Yes─→ Regenerate types for target environment
  ↓ No                                   ↓
  ↓                              ←───────┘
  Are you about to commit? ──Yes──→ Run: npm run types:check-local
  ↓ No                             ↓
  ↓                              Out of sync? ──Yes──→ npm run types:local
  ↓                                ↓ No
  Continue coding                 Commit (pre-commit hook validates)
```

### Common Error Messages and Solutions

| Error Message | Solution |
|---------------|----------|
| `❌ Types are out of sync with local Supabase` | `npm run types:local` |
| `❌ Types are out of sync with cloud-dev` | `npm run types:cloud-dev` |
| `❌ Failed to generate types from cloud` | `npx supabase login && npx supabase link --project-ref [ref]` |
| `❌ Can't connect to local Supabase` | `cd ~/wildlife-watcher-backend && supabase start` |
| `⚠️  WARNING: Unread coordination messages` | `ls ~/cross-project-coordination/inbox/backend-to-mobile/` |
| `❌ COMMIT BLOCKED: Database types are out of sync` | `npm run types:local && git add src/types/supabase.ts` |

### File Locations Quick Reference

```
Mobile Repository:
  src/types/supabase.ts                           # Generated types (committed)
  src/config/environments.ts                      # Environment configurations
  src/config/EnvironmentManager.ts                # Persistence layer
  src/services/supabase.ts                        # Supabase client factory
  scripts/check-types-local.sh                    # Local validation script
  scripts/check-types-cloud.sh                    # Cloud validation script
  .git/hooks/pre-commit                           # Pre-commit hook (validates types)
  .github/workflows/cloud-type-validation.yml     # GitHub Actions workflow

Backend Repository:
  ~/dev/wildlifeai/wildlife-watcher-backend/project-context/database.types.ts

Coordination Hub:
  ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/
  ~/dev/wildlifeai/cross-project-coordination/archive/YYYY-MM/
```

### When to Use Which Environment

| Use Case | Environment | Reason |
|----------|-------------|--------|
| Daily feature development | `local` | Fast iteration, no network dependency |
| Testing cloud-only features (Edge Functions, Realtime) | `cloud-dev` | Cloud infrastructure required |
| Debugging cloud-specific issues | `cloud-dev` | Reproduce production-like environment |
| Stakeholder demo | `cloud-dev` | Shared data, stable environment |
| QA testing | `cloud-dev` | Pre-production validation |
| Production release | `cloud-prod` | Live user data |

### Emergency Contacts

| Issue Type | Contact | Response Time |
|------------|---------|---------------|
| Backend schema questions | Backend team lead | < 2 hours |
| Type sync issues | DevOps team | < 1 hour |
| Production crash | On-call engineer | < 30 minutes |
| Build failures | DevOps team | < 2 hours |

---

## Additional Resources

### Documentation

- **Multi-Environment Type Sync Guide**: `project-context/development-context/MVP2/implementation/execution/cross-project-coordination/protocols/type-synchronization/multi-environment-type-sync-guide.md`
- **Troubleshooting Guide**: `project-context/development-context/MVP2/implementation/execution/TROUBLESHOOTING-ENVIRONMENT-SWITCHING.md`
- **Implementation Plan**: `project-context/development-context/MVP2/implementation/execution/RUNTIME-ENVIRONMENT-SWITCHING-IMPLEMENTATION-PLAN.md`
- **Test Results**: `project-context/development-context/MVP2/implementation/execution/ENVIRONMENT-SWITCHING-TEST-RESULTS.md`
- **CLAUDE.md**: Root project documentation with environment switching section

### Scripts

- **Type Scripts README**: `scripts/README-TYPE-SCRIPTS.md`
- **Local Type Check**: `scripts/check-types-local.sh`
- **Cloud Type Check**: `scripts/check-types-cloud.sh`
- **Pre-Commit Hook**: `.git/hooks/pre-commit`

### External Links

- **Supabase CLI Docs**: https://supabase.com/docs/guides/cli
- **EAS Build Docs**: https://docs.expo.dev/build/introduction/
- **Expo Dev Client**: https://docs.expo.dev/development/introduction/

---

**Questions or Issues?**

- Consult [Troubleshooting Guide](./TROUBLESHOOTING-ENVIRONMENT-SWITCHING.md)
- Ask in team chat: `#wildlife-watcher-mobile`
- Create GitHub issue with `[environment-switching]` tag

---

**Document Version**: 1.0
**Last Updated**: 2025-10-30
**Maintainer**: Wildlife.ai Mobile Development Team
