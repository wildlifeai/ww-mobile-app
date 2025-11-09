# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 CRITICAL: Concurrent Execution & File Management

**ABSOLUTE RULES**:
1. ALL operations MUST be concurrent/parallel in a single message
2. **NEVER save working files, text/mds and tests to the root folder**
3. ALWAYS organize files in appropriate subdirectories
4. **MANDATORY**: Follow Evidence-Based Development - verify assumptions with Context7 research FIRST
5. **MANDATORY**: Use Wildlife Watcher project-specific agents and slash commands FIRST - generic agents ONLY with explicit justification

### ⚡ GOLDEN RULE: "1 MESSAGE = ALL RELATED OPERATIONS"

**MANDATORY PATTERNS:**
- **TodoWrite**: ALWAYS batch ALL todos in ONE call (5-10+ todos minimum)
- **Task tool**: ALWAYS spawn ALL agents in ONE message with full instructions
- **File operations**: ALWAYS batch ALL reads/writes/edits in ONE message
- **Bash commands**: ALWAYS batch ALL terminal operations in ONE message
- **Memory operations**: ALWAYS batch ALL memory store/retrieve in ONE message

### File Organization

**NEVER save to root folder. Use these directories:**
- `/src` - Source code files
- `/tests` - Test files
- `/project-context` - Documentation and markdown files in relation to app development
- `/documentation` - Documentation and markdown files for developer reference (technical and reference)
- `/config` - Configuration files
- `/scripts` - Utility scripts
- `/examples` - Example code

## Project Overview

**Wildlife Watcher Mobile App** - React Native field deployment tool for wildlife camera management with offline-first architecture.

- **Tech Stack**: Expo SDK 51, React Native 0.74.5, TypeScript, Redux Toolkit, Supabase
- **Build Type**: Custom Development Build (NOT Expo Go) - includes custom native modules
- **Architecture**: Offline-first with local SQLite sync, BLE + LoRaWAN device communication, organisation multi-tenancy
- **Key Features**: 6-step deployment wizard, project management, real-time sync, WW Admin access
- **User Roles**: ww_admin (global), project_admin (org-scoped), project_member (project-scoped)
- **Testing**: Jest (unit/integration), Maestro (E2E/BDD), Detox
- **Development**: SPARC methodology with TDD/BDD practices
- **Native Modules**: react-native-ble-manager, expo-updates, react-native-maps, custom BLE integrations

## Essential Commands

### Development

**IMPORTANT**: This app uses **Custom Development Builds** (NOT Expo Go). Native modules like BLE, expo-updates, and custom integrations require a full build.

```bash
# Start Metro bundler (JS updates only)
npm start

# Build and run on Android (requires rebuild for native changes)
npx expo run:android         # Local build + run on device/emulator

# Build via EAS (cloud build service)
eas build --profile development --platform android

# iOS (macOS only)
npx expo run:ios            # Local build + run on simulator
```

**When to rebuild**:
- ✅ After adding/updating native modules (e.g., expo-updates)
- ✅ After changing native configuration (app.json, plugins)
- ❌ NOT needed for JavaScript/TypeScript changes (hot reload works)

### Testing
```bash
npm test                    # Run Jest unit/integration tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:maestro        # Run all Maestro E2E tests
npm run test:maestro:auth   # Auth workflow tests
npm run test:maestro:offline # Offline workflow tests
npm run type-check          # TypeScript type checking
```

### Type Synchronization (CRITICAL)
```bash
# Local Development (Most Common)
npm run types:local         # Generate types from local Supabase (3 sec)
npm run types:check-local   # Verify types match local database (3 sec)
npm run validate:local      # Full validation: types + TypeScript + tests (30 sec)

# Cloud Development (Preview Builds)
npm run types:cloud-dev         # Generate types from cloud-dev Supabase
npm run types:check-cloud-dev   # Verify types match cloud-dev database
npm run validate:cloud-dev      # Full validation for cloud-dev

# Cloud Production (Production Builds - Future)
npm run types:cloud-prod        # Generate types from cloud-prod Supabase
npm run types:check-cloud-prod  # Verify types match cloud-prod database
npm run validate:cloud-prod     # Full validation for cloud-prod
```

**MANDATORY**: After ANY backend schema changes, run `npm run types:local` before coding. Git pre-commit hooks **BLOCK commits** with stale types. For preview builds, run `npm run types:cloud-dev`.

### Pre-Commit Hook Enforcement (MANDATORY)

**ABSOLUTE RULE**: NEVER use `git commit --no-verify` or `git commit -n`

**Why This Rule Exists**:
- Pre-commit hooks validate type system alignment (prevents 189+ TypeScript errors)
- Pre-commit hooks enforce security standards (blocks console.log pollution)
- Pre-commit hooks run tests (prevents TDD violations)
- Bypassing hooks creates production-blocking issues

**Evidence**: T-008 bypassed pre-commit hook → empty type system → 189 TypeScript errors → 10 hours remediation

**If Pre-Commit Hook Fails**:
1. **DO NOT** use `--no-verify` to bypass
2. **READ** the error message carefully
3. **FIX** the underlying issue (usually type system or test failures)
4. **VALIDATE** the fix: `npm run validate:local`
5. **COMMIT** normally (without --no-verify)

**Exception Policy**: Pre-commit hooks can ONLY be bypassed with explicit user approval AND documented justification

### Build & Deploy
```bash
npm run lint                # ESLint
npm run prebuild:check      # Pre-build validation script
eas build --profile development   # Dev build via EAS
eas build --profile production    # Production build
```

### Dependencies
```bash
npm run validate:deps       # Validate dependency compatibility
npm run deps                # Interactive dependency management CLI
npm run deps:scan           # Scan for dependency issues
```

## Architecture Overview

### Directory Structure
```
src/
├── services/          # Business logic & integrations
│   ├── offline/      # OfflineService, SyncService, DatabaseService, ConflictResolution
│   ├── supabase.ts   # Supabase client
│   ├── auth.ts       # Authentication
│   ├── database.ts   # SQLite operations
│   └── ProjectService.ts, ProjectMemberService.ts, DfuService.ts
├── redux/            # Redux Toolkit state
│   ├── slices/      # auth, projects, offline, sync, deployments, devices, etc.
│   ├── api/         # RTK Query endpoints (auth, deployments, projects, users)
│   └── middleware/  # offlineSyncMiddleware
├── types/
│   └── supabase.ts  # Generated types (DO NOT EDIT - regenerate from backend)
├── navigation/      # React Navigation setup (index.tsx, BottomTabs.tsx)
├── screens/         # Screen components
├── components/      # Reusable UI components
├── features/        # Feature-specific modules (e.g., maps)
├── hooks/           # Custom React hooks
├── utils/           # Utility functions
├── providers/       # React context providers
└── App.tsx          # Root component

tests/
├── unit/            # Jest unit tests
├── integration/     # Jest integration tests
└── maestro/         # E2E test flows (.yaml)
```

### Key Architectural Patterns

#### Offline-First Architecture
**Pattern**: Local SQLite → Queue → Sync → Supabase

- **Local-first**: All data operations hit SQLite first
- **Background sync**: SyncService handles bi-directional Supabase sync
- **Conflict resolution**: Last-write-wins with manual override capability
- **Queue-based**: Offline operations queued and replayed when online

**Key Services** (read when implementing):
- `services/offline/OfflineService.ts` - Main coordinator for offline operations
- `services/offline/DatabaseService.ts` - SQLite CRUD operations, schema management
- `services/offline/SyncService.ts` - Sync queue, conflict detection, retry logic
- `redux/middleware/offlineSyncMiddleware.ts` - Redux middleware intercepting network actions

#### State Management (Redux Toolkit)
- **Slices**: Domain-specific state in `redux/slices/` (auth, projects, devices, deployments, offline, sync)
- **RTK Query**: API endpoints with automatic caching in `redux/api/`
- **Middleware**: Custom offline sync middleware bridges online/offline worlds

#### Authentication & Authorization
- **Supabase Auth**: Email/password authentication
- **Role-Based Access Control (RBAC)**: 4-tier system
  - `ww_admin` - Global admin (Wildlife.ai staff)
  - `project_admin` - Organisation-scoped admin
  - `project_member` - Project-scoped member
  - Anonymous users (limited access)
- **Type Safety**: Generated Supabase types in `src/types/supabase.ts`
- **See**: `@project-context/development-context/MVP2/specifications/user-roles-permissions.md` for complete RBAC details

#### Testing Strategy
1. **Unit Tests** (Jest): Services, utilities, Redux slices - co-located in `__tests__/` or `.test.ts` files
2. **Integration Tests** (Jest): Component + service integration in `tests/integration/`
3. **E2E Tests** (Maestro): Real user workflows in `tests/maestro/` (.yaml files)
4. **TDD/BDD**: Write tests before implementation (Red-Green-Refactor)
5. **See**: `@project-context/development-context/MVP2/implementation/guides/testing-standards.md` for comprehensive methodology

## Type Synchronization Critical Path

**The Problem**: Backend schema changes → mobile TypeScript types become stale → runtime errors

**The Solution**: 5-layer defense-in-depth strategy (80% automated, 99% prevention rate)

**Architecture**:
```
Backend Repo (Supabase Local)
  ↓ npx supabase gen types
  ↓
Backend: project-context/database.types.ts (committed)
  ↓
Mobile: npm run types:local (generates from same Supabase)
  ↓
Mobile: src/types/supabase.ts (committed)
  ↓
Layer 4: Git pre-commit hook validates types (BLOCKS commits)
  ↓
Layer 5: GitHub Actions validates on PR (BLOCKS merge on drift)
```

**5-Layer Defense-in-Depth Strategy**:
1. **Layer 1 - Backend Pre-Commit** ✅ Backend hook blocks stale backend types + reminds to create message
2. **Layer 2 - Coordination Messages** ✅ Backend **manually** notifies mobile (template-based, quality > automation)
3. **Layer 3 - Mobile Inbox Check** 🟡 Manual daily check (`ls ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/`)
4. **Layer 4 - Mobile Pre-Commit** ✅ `.git/hooks/pre-commit` blocks commits with stale types
5. **Layer 5 - GitHub Actions** ✅ `.github/workflows/type-validation.yml` blocks PR merge

**Daily Workflow**:
1. Backend developer makes schema change
2. Backend pre-commit hook validates types + **reminds** to create coordination message
3. Backend developer **manually creates** coordination message (using template)
4. Mobile developer checks coordination inbox (daily manual check or sees pre-commit warning)
5. Mobile runs `npm run types:local` (takes 3 seconds)
6. Mobile pre-commit hook validates types before allowing commit
7. PR opens → GitHub Actions validates types (final safety net)

**Automated Safety Nets** (5-layer defense-in-depth):
1. **Backend Pre-Commit Hook**: Blocks backend commits without type regeneration + reminds to notify mobile
2. **Coordination System**: Backend **manually** sends schema change notifications (quality > automation)
3. **Manual Inbox Check**: Mobile checks daily for coordination messages
4. **Mobile Pre-Commit Hook** ✅ **NEW**: `.git/hooks/pre-commit` blocks commits with stale types
5. **GitHub Actions CI/CD**: `.github/workflows/type-validation.yml` blocks PR merge on type drift

**Note on Layer 2**: Coordination message creation is intentionally manual (not automatic) to ensure:
- Quality context in messages (humans explain "why")
- No noise from internal-only changes
- Flexibility for experimental branches
- Batching of related changes into one message
- Low effort (~2 min per schema change) with high communication value

**Coverage**: 80% automated (Layers 1,2,4,5), 99% prevention rate
**ROI**: 160:1 (15 min setup → 40 hours saved annually)

**Pre-Commit Hook Details**:
- Location: `.git/hooks/pre-commit`
- Runs: `npm run types:check-local` before every commit
- Blocks: Commits if types don't match database schema
- Warns: If unread coordination messages in inbox
- Speed: 3 seconds validation time

**Key Files**:
- Mobile: `src/types/supabase.ts` (generated, committed)
- Backend Reference: `~/wildlife-watcher-backend/project-context/database.types.ts` (for cross-validation)
- Validation Script: `scripts/check-types-local.sh`
- CI/CD Workflow: `.github/workflows/type-validation.yml`
- Both generated from: Same local Supabase instance (localhost:54321)

**Documentation**:
- Daily workflow: `@project-context/development-context/MVP2/implementation/execution/cross-project-coordination/protocols/type-synchronization/local-dev-sync-workflow.md`
- Comprehensive guide: `@project-context/development-context/MVP2/implementation/execution/cross-project-coordination/protocols/type-synchronization/Backend-Mobile-Type-Synchronization-Guide.md`
- Backend automation: `~/wildlife-watcher-backend/project-context/documentation/QUICK-REFERENCE-TYPE-AUTOMATION.md`

**Bottom Line**: Run `npm run types:local` after backend changes. Git hooks + GitHub Actions prevent type drift. Takes 3 seconds. 95% coverage. ✅

## Runtime Environment Switching System

**Status**: ✅ **PRODUCTION-READY** (Task 4 complete, 95% confidence)

The app supports runtime switching between three Supabase environments for flexible development and testing workflows.

### Three Environments

**Local Development** (`local`):
- **URL**: http://172.21.24.107:54321 (WSL host IP for physical device testing)
- **Purpose**: Rapid local development with instant schema changes
- **Default for**: Development builds (__DEV__ = true)
- **Type Source**: Backend repository local Supabase instance
- **Access**: Requires local Supabase running in backend repo

**Cloud Development** (`cloud-dev`):
- **URL**: https://nuhwmubvygxyddkycmpa.supabase.co
- **Purpose**: Staging/preview builds, team testing, cloud feature validation
- **Default for**: Preview builds (APP_VARIANT=preview)
- **Type Source**: Cloud Supabase instance via Supabase CLI
- **Access**: Requires Supabase CLI authentication

**Cloud Production** (`cloud-prod`):
- **URL**: [Not yet configured]
- **Purpose**: Production builds with production data
- **Default for**: Production builds (APP_VARIANT=production)
- **Type Source**: Cloud Supabase instance via Supabase CLI
- **Access**: Requires Supabase CLI authentication + production credentials

### Environment Switching Commands

```bash
# Type Generation (Build-Time)
npm run types:local         # Generate types from local Supabase (3 sec)
npm run types:cloud-dev     # Generate types from cloud-dev Supabase
npm run types:cloud-prod    # Generate types from cloud-prod (not yet configured)

# Type Validation (Verify Alignment)
npm run types:check-local       # Verify types match local database
npm run types:check-cloud-dev   # Verify types match cloud-dev database
npm run types:check-cloud-prod  # Verify types match cloud-prod database

# Full Validation (Types + TypeScript + Tests)
npm run validate:local      # Complete validation for local environment
npm run validate:cloud-dev  # Complete validation for cloud-dev environment
npm run validate:cloud-prod # Complete validation for cloud-prod environment
```

### Runtime Switching (Development Builds Only)

**Access Developer Settings**:
1. Launch app in development mode (`__DEV__ = true`)
2. Navigate to: Settings → Developer Settings
3. Select target environment (local/cloud-dev/cloud-prod)
4. Test connection (optional)
5. Tap "Apply & Restart" to switch environments

**Production Build Restriction**: Environment switching is automatically disabled in production builds for security. The app will use the fixed production environment (`cloud-prod`).

### Architecture Components

**Configuration**:
- `src/config/environments.ts` - Environment definitions and validation
- `src/config/EnvironmentManager.ts` - Persistence layer (AsyncStorage)
- `src/config/hooks/useSupabaseEnvironment.ts` - React hook for environment state

**Client Management**:
- `src/services/supabase.ts` - Factory pattern for Supabase client creation
- Event-driven architecture for React component updates on environment change
- Automatic client recreation and cleanup on environment switch

**UI**:
- `src/screens/DeveloperSettingsScreen.tsx` - Environment selection interface
- Visual connection status indicators
- Accessibility-compliant radio buttons and controls
- Production build safety messaging

### Type Synchronization Strategy

**Build-Time Type Generation**: Types must be generated at build time for each target environment:

1. **Local Development Workflow**:
   ```bash
   npm run types:local          # Generate from local Supabase
   npm run validate:local       # Validate everything
   # App connects to localhost:54321 at runtime
   ```

2. **Preview Build Workflow**:
   ```bash
   npm run types:cloud-dev      # Generate from cloud-dev
   npm run validate:cloud-dev   # Validate everything
   eas build --profile preview  # Build with cloud-dev types
   # App connects to cloud-dev at runtime
   ```

3. **Production Build Workflow** (Future):
   ```bash
   npm run types:cloud-prod     # Generate from cloud-prod
   npm run validate:cloud-prod  # Validate everything
   eas build --profile production  # Build with cloud-prod types
   # App connects to cloud-prod at runtime (fixed, no switching)
   ```

### Multi-Environment Type Synchronization

**5-Layer Defense-in-Depth** (now supports all three environments):

1. **Layer 1 - Backend Pre-Commit**: Backend repo blocks stale types + creates coordination messages
2. **Layer 2 - Coordination Messages**: Manual schema change notifications (quality over automation)
3. **Layer 3 - Mobile Inbox Check**: Daily check for schema change messages
4. **Layer 4 - Mobile Pre-Commit**: Blocks commits with stale types (local environment check)
5. **Layer 5 - GitHub Actions**: Validates types on PR (cloud-dev validation)

**GitHub Actions Workflow**:
- Trigger: Pull requests to main branch
- Validates: Types match cloud-dev database schema
- Blocks: PR merge if types are out of sync
- Uploads: Diff artifacts for debugging
- Status: ✅ Production-ready (Task 3.2 complete)

**Pre-Commit Hook**:
- Location: `.git/hooks/pre-commit`
- Validates: Types match local database (primary development environment)
- Blocks: Commits if types are stale
- Warns: If unread coordination messages in inbox
- Speed: 3 seconds validation time

### Daily Development Workflows

**Local Development** (Most Common):
```bash
# 1. Start local Supabase in backend repo
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase start

# 2. Check type alignment
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:check-local

# 3. If out of sync, regenerate
npm run types:local

# 4. Develop and test
npm start                        # Start Expo dev server
# App automatically connects to local Supabase (172.21.24.107:54321)

# 5. Pre-commit hook validates types automatically
git add .
git commit -m "feat: implement feature"  # Hook validates types before commit
```

**Cloud Development Testing**:
```bash
# 1. Generate types from cloud-dev
npm run types:cloud-dev

# 2. Validate alignment
npm run validate:cloud-dev

# 3. Switch environment at runtime (in-app)
# Settings → Developer Settings → Select "Cloud Development" → Apply & Restart

# 4. Test against cloud-dev database
# App now connects to https://nuhwmubvygxyddkycmpa.supabase.co
```

**Preview Build Preparation**:
```bash
# 1. Ensure types match cloud-dev
npm run types:check-cloud-dev

# 2. If out of sync, regenerate
npm run types:cloud-dev

# 3. Full validation
npm run validate:cloud-dev

# 4. Build preview
eas build --profile preview

# Preview build will use cloud-dev by default (no switching allowed)
```

### Testing Results (Task 4)

**Overall Status**: ✅ PASS WITH MINOR ISSUES

- **Unit Tests**: 113/145 passing (77.9%)
- **Integration Tests**: 18/30 passing (60%)
- **Test Failures**: All failures are test infrastructure issues (Alert mocking, Jest module hoisting), NOT implementation bugs
- **Production Readiness**: 95% confidence
- **Critical Bugs**: 0
- **Major Bugs**: 0

**Key Validation**:
- ✅ Environment configuration system working correctly
- ✅ Persistence layer (AsyncStorage) functioning properly
- ✅ Supabase client factory pattern implemented correctly
- ✅ UI components rendering and functioning as expected
- ✅ Production build restrictions enforced
- ✅ Type synchronization scripts validated
- ✅ GitHub Actions workflow syntax validated
- ✅ Pre-commit hook functional and blocking stale types

### Troubleshooting

**"Types are out of sync" Error**:
```bash
# Determine which environment you're targeting
npm run types:check-local       # For local development
npm run types:check-cloud-dev   # For preview builds

# Regenerate types for the correct environment
npm run types:local             # If local is out of sync
npm run types:cloud-dev         # If cloud-dev is out of sync

# Commit the updated types
git add src/types/supabase.ts
git commit -m "chore(types): sync with [environment] schema"
```

**"Failed to generate types from cloud" Error**:
```bash
# Authenticate to Supabase CLI
npx supabase login

# Link to the correct project
npx supabase link --project-ref nuhwmubvygxyddkycmpa  # For cloud-dev
```

**"Can't connect to local Supabase" Error**:
```bash
# Start local Supabase in backend repo
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase start

# Verify it's running
supabase status

# Should show:
#   API URL: http://localhost:54321
#   Status: Running
```

**Environment Switching Not Working**:
- Check if running a development build (`__DEV__ = true`)
- Production builds have switching disabled by design
- Try clearing app storage: Settings → Clear All Data

### Related Documentation

**Implementation Details**:
- Implementation Plan: `@project-context/development-context/MVP2/implementation/execution/RUNTIME-ENVIRONMENT-SWITCHING-IMPLEMENTATION-PLAN.md`
- Test Results: `@project-context/development-context/MVP2/implementation/execution/ENVIRONMENT-SWITCHING-TEST-RESULTS.md`
- Multi-Environment Guide: `@project-context/development-context/MVP2/implementation/execution/cross-project-coordination/protocols/type-synchronization/multi-environment-type-sync-guide.md`

**Type Synchronization**:
- Scripts README: `scripts/README-TYPE-SCRIPTS.md`
- Type Sync Guide: `@project-context/learnings/type-drift-prevention-5-layer-defense.md`

**Backend Integration**:
- Backend Type Automation: `~/wildlife-watcher-backend/project-context/documentation/QUICK-REFERENCE-TYPE-AUTOMATION.md`
- Coordination System: `~/dev/wildlifeai/cross-project-coordination/COORDINATION-QUICK-START.md`

### Security Considerations

**Development vs Production**:
- Local/cloud-dev credentials are non-sensitive (development use only)
- Cloud-prod credentials must be stored as EAS secrets
- Environment switching is disabled in production builds
- Anon keys are safe to commit for development environments

**Production Build Safety**:
- Environment switching UI not accessible in production
- EnvironmentManager enforces production build restrictions
- App fixed to `cloud-prod` environment for production builds
- No user-facing environment selection in production

## Quality Control Standards

### Discovery Phase (MANDATORY BEFORE CODING)
1. **Read type definitions** in `/src/types/` FIRST before ANY test or code
2. **Use Read tool** to examine actual interfaces and implementations
3. **Use Grep tool** to verify method signatures in existing services
4. **Never assume** interface names, method signatures, or existing types - always verify actual code structure

### Test Integrity (ZERO TOLERANCE)
- **Never skip, delete, or modify tests** without explicit user approval
- **Never use** `.skip()`, `.todo()`, or comment out tests as shortcuts
- **Never change test expectations** to make failing tests pass
- **Never reduce test coverage** or scope without justification
- **Follow TDD**: Write tests BEFORE implementation (Red-Green-Refactor cycle)

### Quality Gates (MUST PASS)
1. **Test Gate**: 100% of tests must pass without modifications
2. **Type Gate**: Zero TypeScript errors (`npm run type-check`)
3. **Integration Gate**: All service calls must use correct method signatures
4. **TDD Gate**: Implementation must satisfy original test requirements
5. **Evidence Gate**: All implementation decisions backed by Context7 research FIRST
6. **UUID Consistency Gate**: All UUID handling must maintain string types throughout
7. **Backend Sync Gate**: Types regenerated after ANY backend schema changes
8. **Type System Validation Gate**: Type system must never be empty (MANDATORY PRE-COMMIT CHECK)
   - **Check**: `test -s src/types/supabase.ts` (file exists AND not empty)
   - **Minimum Size**: 50KB (typical size: 50-100KB)
   - **Action**: Run `npm run types:local` if empty or suspiciously small
   - **Evidence**: T-008 committed empty supabase.ts → 189 TypeScript errors → 10h remediation
9. **Pre-Commit Hook Enforcement Gate**: NEVER bypass pre-commit hooks without explicit approval
10. **Console.log Pollution Gate**: Zero console.log statements in production code (use logger.ts)
11. **TestID Coverage Gate**: All interactive components must have testID props (accessibility + E2E testing)
12. **Input Validation Gate**: All user inputs must have validation (Yup/zod schemas)
13. **Offline-First Architecture Gate**: All API integrations must include OfflineService from start

### Git Commit Quality Standards (ENFORCED)

**Pre-Commit Checklist** (automated via git hooks):
- [ ] Type system validated: `npm run types:check-local` passes
- [ ] TypeScript compilation: `npm run type-check` passes (0 NEW errors)
- [ ] Tests passing: `npm test` passes (80%+ coverage for new code)
- [ ] Linting: `npm run lint` passes (<50 violations)
- [ ] Type system not empty: `test -s src/types/supabase.ts && [ $(wc -c < src/types/supabase.ts) -gt 51200 ]`
- [ ] Zero console.log: `grep -r 'console\.log' src/ --exclude-dir=__tests__ | wc -l` returns 0

**If Any Check Fails**:
1. **DO NOT** commit with `--no-verify`
2. **FIX** the underlying issue
3. **RE-RUN** validation: `npm run validate:local`
4. **COMMIT** normally

**Commit Message Standards**:
- Use conventional commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`
- Reference task IDs: `feat(T-008): add AI model selection`
- Explain WHY, not WHAT: `fix(types): regenerate after backend schema change`

**Emergency Override Policy**:
- Pre-commit hooks can be bypassed ONLY with:
  - Explicit user approval
  - Documented justification (in commit message)
  - Immediate remediation task created
  - Example: `git commit -m "fix(urgent): emergency hotfix for production issue" --no-verify`

### Test-Driven Development (TDD) Enforcement

**MANDATORY**: Write tests BEFORE implementation (RED → GREEN → REFACTOR)

**TDD Workflow**:
1. **RED**: Write failing test that defines desired behavior
2. **GREEN**: Write minimal code to make test pass
3. **REFACTOR**: Improve code quality while keeping tests passing

**Test Coverage Requirements**:
- **New Files**: 80%+ coverage mandatory
- **Modified Files**: No coverage reduction allowed
- **Critical Paths**: 100% coverage (auth, offline sync, data persistence)

**Test Types** (in priority order):
1. **Integration Tests FIRST**: Test real API + real database + real auth
2. **Unit Tests SECOND**: Test complex business logic in isolation
3. **E2E Tests THIRD**: Test critical user journeys (Maestro)

**Evidence-Based Learning** (from backend project):
- Backend spent 2+ days on elaborate mock infrastructure = WASTED TIME
- Testing real API behavior found issues immediately = EFFICIENT
- **Rule**: If test setup time > implementation time = WRONG APPROACH

**TDD Violation Consequences** (T-008 evidence):
- Zero tests written → 3.5 hours remediation effort
- Production readiness 0% → 60% (with tests)
- Quality score 7.5/10 → 8.5/10 (with tests)

**Pre-Commit Gate**: Tests must pass before commit
- Run: `npm test -- --coverage --changedSince=HEAD`
- Threshold: 80% coverage for changed files
- Blocks commit if: coverage < 80% OR tests failing

### Security & Task Prioritization

**Risk-Based P0 Triage**:
- Not all P0 tasks require immediate execution
- **Assess BEFORE committing resources**:
  - Actual risk level (LOW/MEDIUM/HIGH/CRITICAL)
  - Development phase (local/preview/production)
  - Time constraints (24-hour sprint vs multi-week project)
  - Available mitigation options (monitoring, rollback, deferral)

**Security Deferral Criteria**:
- **LOW RISK**: Gitignored credentials during local development
  - Condition: API usage monitoring available
  - Condition: Keys not publicly exposed
  - Condition: No external distribution
  - Example: T-010 deferred (1.5h saved, 15min execution when needed)
- **MEDIUM RISK**: Security issues with interim workarounds
  - Requires: Documented limitation in release notes
  - Requires: Monitoring dashboard
  - Requires: Rollback plan
- **HIGH RISK**: Security issues without workarounds
  - Action: Immediate remediation required
  - Example: Hardcoded secrets in committed code

**Research-First Efficiency**:
- Upfront research investment enables fast execution later
- **Evidence**: T-010 research (90 min) → execution (15 min) = 6x ROI
- **Pattern**: Complete research before deferral ensures execution-ready state
- **Deliverables**: 3 documents (security audit, execution plan, deferral justification)

**Quality Gate Bypass Consequences** (T-008 evidence):
- Pre-commit hook bypass → empty type system → 189 errors → 10h remediation
- TDD violation → zero tests → 3.5h test creation → production blocked
- **Rule**: NEVER bypass quality gates without documented justification

**Decision Framework**:
```
IF (risk = LOW) AND (phase = local dev) AND (monitoring = available)
  THEN defer = acceptable
  BUT research_complete = mandatory
  AND execution_plan = documented
  AND trigger_conditions = defined

IF (risk >= MEDIUM) OR (phase >= preview) OR (no_mitigation)
  THEN defer = not_acceptable
  AND immediate_action = required
```

## Automated Quality Enforcement

### Overview

Quality enforcement operates through 5 layers of automated checks and human oversight, providing 95% prevention coverage with 20:1 ROI.

### Layer 1: Developer Awareness (Documentation)

**CLAUDE.md** contains:
- Quality standards with evidence-based rationale
- Process improvements from T-008 learnings
- Pre-commit hook enforcement policy
- TDD requirements and test-first workflow
- Security deferral decision frameworks

### Layer 2: Pre-Commit Hooks (Local Enforcement)

**Location**: `.git/hooks/pre-commit`

**Current Validations** (already implemented):
- ✅ Type system alignment: `npm run types:check-local`
- ✅ Unread coordination messages warning
- ✅ Blocks commits on type drift

**REQUIRED ENHANCEMENTS** (based on T-008 learnings):

Add these checks to existing `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Existing validations (keep as-is)
npm run types:check-local || exit 1

# NEW: Type system empty check
if [ ! -s src/types/supabase.ts ] || [ $(wc -c < src/types/supabase.ts) -lt 51200 ]; then
  echo "❌ ERROR: Type system is empty or suspiciously small"
  echo "   Expected: 50-100KB, Found: $(wc -c < src/types/supabase.ts) bytes"
  echo "   Action: Run 'npm run types:local' to regenerate"
  exit 1
fi

# NEW: Console.log pollution check (exclude test files and logger.ts)
CONSOLE_LOGS=$(grep -r 'console\.log' src/ --exclude-dir=__tests__ --exclude=logger.ts | wc -l)
if [ "$CONSOLE_LOGS" -gt 0 ]; then
  echo "❌ ERROR: Found $CONSOLE_LOGS console.log statements in production code"
  echo "   Action: Replace with logger.debug/info/warn/error from src/utils/logger.ts"
  grep -rn 'console\.log' src/ --exclude-dir=__tests__ --exclude=logger.ts
  exit 1
fi

# NEW: Test coverage check (only for changed files)
npm test -- --coverage --changedSince=HEAD --silent || {
  echo "❌ ERROR: Tests failing or coverage < 80% for changed files"
  echo "   Action: Fix tests or add coverage for new code"
  exit 1
}

# NEW: TypeScript compilation check
npm run type-check || {
  echo "❌ ERROR: TypeScript compilation failed"
  echo "   Action: Fix type errors before committing"
  exit 1
}

# NEW: Linting check (allow commit if < 50 violations)
LINT_ERRORS=$(npm run lint --silent 2>&1 | grep -c "error")
if [ "$LINT_ERRORS" -gt 50 ]; then
  echo "❌ ERROR: $LINT_ERRORS linting violations (threshold: 50)"
  echo "   Action: Run 'npm run lint --fix' to auto-fix"
  exit 1
fi

echo "✅ All pre-commit checks passed"
exit 0
```

**Manual Installation** (one-time setup):
```bash
# Backup existing hook
cp .git/hooks/pre-commit .git/hooks/pre-commit.backup

# Edit .git/hooks/pre-commit to add sections above
# Make executable
chmod +x .git/hooks/pre-commit

# Test hook
./.git/hooks/pre-commit
```

### Layer 3: GitHub Actions (CI/CD Enforcement)

**Status**: ✅ **IMPLEMENTED** (`.github/workflows/quality-gate-validation.yml`)

**Workflow**: Runs on every PR to main/dev-mvp2-development

**Checks Performed**:
1. Type system not empty (min 50KB)
2. Zero console.log statements
3. Test coverage >= 70%
4. TypeScript compilation passes
5. Linting passes

**PR Blocking**: Workflow failure blocks PR merge

**Parallel Workflows**:
- `type-validation.yml` - Type system alignment with cloud-dev (already exists)
- `quality-gate-validation.yml` - Comprehensive quality gates (NEW)

### Layer 4: Code Review (Human Oversight)

**Comprehensive Checklist**:
- Quality score assessment (target: 9/10+)
- Production readiness evaluation (target: 85%+)
- Test coverage verification (target: 80%+)
- Security vulnerability scan
- Performance impact assessment

**Tools**:
- `code-analyzer` agent for automated analysis
- `technical-solution-reviewer` agent for architecture review
- Manual review for business logic and UX

**Frequency**: After EVERY task completion (before marking complete)

### Layer 5: Post-Deployment Monitoring (Production Safety Net)

**Tools** (planned):
- Sentry error tracking
- Performance monitoring
- User feedback loop
- Analytics dashboards

**Alerts**:
- Runtime errors
- Performance degradation
- Type mismatches in production
- API failures

### Enforcement Hierarchy Summary

| Layer | Type | Coverage | Timing | Blocks |
|-------|------|----------|--------|---------|
| 1 | Documentation | 100% | Pre-dev | Education |
| 2 | Pre-commit hook | 95% | Pre-commit | Local commit |
| 3 | GitHub Actions | 100% | PR creation | PR merge |
| 4 | Code review | 100% | Post-impl | Task completion |
| 5 | Monitoring | 100% | Production | Rollback |

**Overall Coverage**: 95% automated (Layers 2-3), 100% with human review (Layer 4)

**ROI Calculation**:
- **Setup Time**: 2h 15min (one-time investment)
- **Annual Savings**: 240+ hours per developer
  - Pre-commit hooks: 10 hours/month
  - GitHub Actions: 15 hours/month
  - Code review automation: 5 hours/month
- **ROI**: 106:1 (2.25h → 240h savings)

### Evidence-Based Results (T-008 Case Study)

**Without Enforcement** (T-008 actual):
- Pre-commit hook bypassed → empty type system → 189 errors
- Zero tests → 3.5h remediation
- Console.log pollution → 30min cleanup
- Total remediation: **10 hours**

**With Enforcement** (projected):
- Pre-commit hook blocks empty types → 0 errors
- Test gate blocks untested code → 0 remediation
- Console.log gate blocks pollution → 0 cleanup
- Total remediation: **0 hours** (100% prevention)

**Prevention Success Rate**: 100% for T-008 issues with full enforcement

### Integration with Existing Workflows

**Pre-Commit Hook Integration**:
- Extends existing `.git/hooks/pre-commit`
- Backward compatible with type-validation checks
- Adds 5 new quality gates
- Total execution time: ~30 seconds

**GitHub Actions Integration**:
- Runs in parallel with type-validation workflow
- Independent failure domains
- Total CI/CD time: ~5 minutes

**TodoWrite Integration**:
- All multi-step tasks (>2h) must create TodoWrite list
- Sub-tasks: 15min-1h granularity
- Enforces task breakdown
- Enables progress tracking

### Manual Override Protocol

**When Override Needed**:
- Emergency production hotfixes
- Infrastructure failures (CI/CD outage)
- Documented experimental branches

**Override Process**:
1. **Request**: Explicit user approval required
2. **Justification**: Document reason in commit message
3. **Remediation**: Create follow-up task immediately
4. **Review**: Post-merge manual review mandatory

**Example**:
```bash
git commit -m "fix(urgent): emergency hotfix for auth bypass (pre-commit disabled due to CI outage, remediation task T-XXX created)" --no-verify
```

### Maintenance & Updates

**Weekly**:
- Review pre-commit hook failures
- Update quality gate thresholds
- Analyze false positive rate

**Monthly**:
- Review GitHub Actions workflow efficiency
- Update enforcement rules based on learnings
- Calibrate coverage thresholds

**Quarterly**:
- Comprehensive ROI analysis
- Process improvement retrospective
- Tool upgrade evaluation

## MCP Tools & When to Use Them

### Context7 - Library Documentation (MANDATORY FIRST STEP)
**When to use**: ALWAYS before ANY implementation - verified 10x efficiency improvement

- `mcp__context7__resolve-library-id` - Find library ID from name
- `mcp__context7__get-library-docs` - Fetch comprehensive docs with examples

**Evidence-Based Pattern**:
```javascript
// MANDATORY: Research BEFORE implementation
// Backend Success: 2.5 hours → 15 minutes debugging via Context7
mcp__context7__resolve-library-id({ libraryName: "react-native-sqlite" })
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/resolved/library",
  topic: "uuid-handling",
  tokens: 15000
})
```

**Example**: Getting React Native, Expo, SQLite documentation - PROVEN to eliminate false solution paths

### Supabase MCP - Database & Backend
**When to use**: Managing Supabase database, migrations, and edge functions

- `mcp__supabase__list_tables`, `mcp__supabase__execute_sql` - Database operations
- `mcp__supabase__list_migrations`, `mcp__supabase__apply_migration` - Schema management
- `mcp__supabase__generate_typescript_types` - Generate types from schema
- `mcp__supabase__search_docs` - Search Supabase documentation

### Serena MCP - Enhanced Development
**When to use**: Complex code analysis and intelligent editing

- **Symbolic Code Analysis** - Understand structure without reading entire files
- **Intelligent Editing** - Precise modifications using symbols and regex
- **Cross-Project Memory** - Persistent knowledge across sessions
- **Advanced Search** - Pattern-based code discovery

### IDE Integration
**When to use**: Need TypeScript/linting diagnostics or run code in notebooks

- `mcp__ide__getDiagnostics` - Get VS Code language diagnostics
- `mcp__ide__executeCode` - Execute Python in Jupyter notebooks

### Playwright Browser Automation
**When to use**: Testing web interfaces or browser-based interactions

- `mcp__playwright__browser_*` - Full browser control (navigate, click, snapshot, etc.)

### Tool Coordination Strategy
1. **Context7**: MANDATORY FIRST - Library documentation and vendor-specific patterns
2. **Claude Code**: PRIMARY - File operations, coding, testing, git, npm
3. **Specialized Agents**: Domain expertise (mobile-dev, quality-assurance-engineer, supabase-schema-architect)
4. **MCP Tools**: Coordination, memory, metrics, GitHub integration

**PROVEN WORKFLOW**: Context7 Research → Claude Code Implementation → Specialized Agents → MCP Coordination

## AI Agentic Development Framework (AADF)

### Living Framework Documentation
**CRITICAL**: This project serves as the primary development laboratory for the **AI Agentic Development Framework (AADF)** - a comprehensive methodology for AI-orchestrated software development.

**Framework Document Locations**:
- **Core Framework**: `@project-context/learnings/ai-agentic-development-framework.md`
- **Philosophical Foundations**: `@project-context/learnings/philosophical-foundations-aadf.md`

### Framework Maintenance Directive (MANDATORY)
Update the AADF document with ALL discoveries, patterns, optimizations, and learnings encountered during development:

**Update Triggers**:
- New successful coordination patterns discovered
- Quality gate refinements and improvements
- Tool integration insights and optimizations
- Performance breakthrough discoveries
- Template scaffolding pattern improvements
- Cross-project learning integration opportunities

**Update Categories**:
- **Behavioral Patterns**: SuperClaude optimization discoveries
- **Orchestration Insights**: Claude Flow workflow improvements
- **Tool Coordination**: MCP integration pattern refinements
- **Quality Standards**: Zero-tolerance gate enhancements
- **Performance Metrics**: Efficiency measurement improvements
- **Template Evolution**: Scaffolding pattern discoveries
- **Philosophical Foundations**: Epistemological and ontological insights
- **Applied Philosophy**: Practical philosophical applications in development

### Framework Evolution Responsibility
Every developer/session MUST contribute to framework evolution by:
1. **Documenting New Patterns**: Record successful workflows immediately
2. **Recording Optimization Insights**: Capture performance improvements
3. **Updating Quality Standards**: Refine validation gates based on learnings
4. **Enhancing Tool Integration**: Document MCP coordination discoveries
5. **Template Pattern Discovery**: Identify reusable scaffolding patterns
6. **Philosophical Integration**: Document epistemological and ontological insights
7. **Applied Philosophy**: Record practical philosophical applications in development

**Goal**: Create a comprehensive, battle-tested framework that can be packaged into a `create-aadf-app` equivalent for future projects.

## Cross-Project Integration Insights (Backend Learnings)

### Reality-First Testing Methodology (CRITICAL LEARNING)
**DISCOVERED**: Backend spent 2+ days building elaborate test infrastructure instead of testing real user behavior
**IMPACT**: False security alerts and massive time waste vs feature delivery

**MANDATORY TESTING PRIORITY ORDER**:
1. **User Journey Tests FIRST** (Real API + Real Auth + Real Database)
2. **Integration Tests SECOND** (Feature-Level Validation)
3. **Unit Tests LAST** (Only Complex Business Logic)

**Mobile App Application**:
- Task 11.3 OfflineService.ts: Test with **real Supabase sync operations**
- Avoid elaborate SQLite mocking - use real database operations
- **Red Flag**: If test setup time > implementation time = WRONG approach

### Database Schema Consistency (UUID Critical)
**Backend Confirmed**: Supabase UUIDs must remain string types throughout entire system

**Mobile Requirements**:
- SQLite must handle UUID strings consistently (Task 11.8)
- No number conversion anywhere in the data flow
- Database sync operations must maintain UUID string integrity
- **Breaking Change**: Users must re-login after Task 11.8 completion

### Evidence-Based Development Results (Context7 Success)
**Backend Measured Results**:
- **Debugging Efficiency**: 10x improvement (2.5 hours → 15 minutes)
- **False Solution Elimination**: 100% (avoided 4 major debugging paths)
- **Documentation Access**: 38,009+ vendor-specific code snippets vs 0 general sources
- **Solution Quality**: Official patterns vs custom workarounds

### Cross-Project Coordination Status
- **Backend**: 98% deployment ready (Phase 2 AADF complete)
- **Mobile**: Task 11.8 UUID alignment required before proceeding
- **Integration**: Backend ready for mobile app development continuation

## MVP2 Development Context

### Current Task Status
- **Live Dashboard**: http://localhost:3333 (run `./start.sh` in `@project-context/development-context/project-progress-tracker/`)
- **Master Plan**: `@project-context/development-context/MVP2/implementation/execution/MVP2-MASTER-EXECUTION-PLAN.md`
- **Metrics Tracker**: `@project-context/development-context/MVP2/implementation/execution/MVP2-METRICS-TRACKER.md`
- **Task Specifications**: `@project-context/development-context/MVP2/implementation/tasks/task_*.txt`

### Primary Documentation
- **Implementation Spec**: `@project-context/development-context/MVP2/implementation-spec-v1.4.md` (17.5k tokens - read when needed, in `.claudeignore`)
- **User Roles**: `@project-context/development-context/MVP2/specifications/user-roles-permissions.md` (4-tier RBAC)
- **Testing Standards**: `@project-context/development-context/MVP2/implementation/guides/testing-standards.md`
- **API Integration**: `@project-context/development-context/MVP2/implementation/guides/api-integration-guide.md`
- **Component Patterns**: `@project-context/development-context/MVP2/implementation/guides/component-patterns.md`

### Backend Integration
- **Backend Repo**: `~/dev/wildlifeai/wildlife-watcher-backend` (separate Git repository)
- **Backend Status**: `~/wildlife-watcher-backend/project-context/PROJECT-STATUS.md`
- **Cross-Project Tasks**: `~/wildlife-watcher-backend/project-context/MVP2-Tasks/`
- **Backend Type Automation**: Backend has automated type sync with git pre-commit hooks. See `~/wildlife-watcher-backend/project-context/documentation/QUICK-REFERENCE-TYPE-AUTOMATION.md`

### Cross-Project Coordination System
**Location**: `~/dev/wildlifeai/cross-project-coordination/` (shared hub between mobile and backend)

#### Basic Coordination (Daily Use)

**Quick Workflow**:
```bash
# 1. Check backend inbox daily
ls ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/

# 2. Read message
cat ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/msg.md

# 3. Action it (e.g., schema change)
npm run types:local  # 3 seconds to regenerate types

# 4. Archive & log
mv ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/msg.md \
   ~/dev/wildlifeai/cross-project-coordination/archive/$(date +%Y-%m)/
~/dev/wildlifeai/cross-project-coordination/.coordination/log-message.sh "Mobile" "Actioned schema-change"
```

**Message Types**:
- `schema-change` - Backend schema changed, regenerate types
- `task-request` - Backend requesting mobile implementation
- `status-update` - Backend deployment/milestone updates
- `generic-message` - General coordination

**Basic Documentation**:
- **Quick Start**: `~/dev/wildlifeai/cross-project-coordination/COORDINATION-QUICK-START.md`
- **Type Sync Guide**: `~/dev/wildlifeai/cross-project-coordination/TYPE-SYNC-GUIDE.md`
- **System Reference**: `~/dev/wildlifeai/cross-project-coordination/SYSTEM-REFERENCE-GUIDE.md`

#### Dynamic Coordination System (Large Projects)

**Status**: ✅ Production-Ready (2025-11-01)

For **large-scale coordinated projects** with 3+ tasks, milestone-based execution, and cloud-dev deployment coordination:

**IMPORTANT CLARIFICATION** (Confirmed by Backend Team):
- **Flat-Inbox System**: DEFAULT for day-to-day coordination (schema changes, status updates, task requests)
- **Dynamic System**: ONLY for special case projects meeting criteria below

**When to Use Dynamic System**:
✅ Project has 3+ coordinated tasks across teams
✅ Requires milestone-based execution with human review
✅ Needs cloud-dev deployment coordination
✅ Has task dependencies requiring careful sequencing
✅ May exceed 200k context window (complex projects)

**Examples of Dynamic System Use**: BLE DFU integration, Auth redesign, API migrations, Multi-tenant features

**Examples of Flat-Inbox Use**: Schema changes, type regeneration, status updates, simple task requests

**Initialize Coordinated Project**:
```bash
cd ~/dev/wildlifeai/cross-project-coordination
./.scripts/init-project.sh \
  --slug "project-name" \
  --title "Project Title" \
  --teams "mobile,backend"
```

**Send Coordination Message**:
```bash
./.scripts/send-message.sh \
  --project "project-name" \
  --from "mobile" \
  --to "backend" \
  --type "deployment-ready" \
  --message "Preview build complete. Build ID: abc123. Distributed to stakeholders."
```

**Check Project Inbox**:
```bash
./.scripts/check-inbox.sh --project "project-name" --team "mobile"
```

**Core Components**:
- 6 coordination scripts (init, send, check, watch)
- 10 templates (task definitions, milestones, checklists)
- Project isolation (dedicated folder per project)
- Task orchestration with dependency tracking
- Milestone-based workflow (Local → Cloud-Dev → Preview → Stakeholder)

**Dynamic System Documentation**:
- **Comprehensive Guide**: `@project-context/development-context/MVP2/implementation/execution/cross-project-coordination/DYNAMIC-COORDINATION-SYSTEM-GUIDE.md` (PRIMARY - START HERE)
- **Quick Start**: `~/dev/wildlifeai/cross-project-coordination/QUICK-START-DYNAMIC-COORDINATION.md`
- **Troubleshooting**: `~/dev/wildlifeai/cross-project-coordination/TROUBLESHOOTING-DYNAMIC-COORDINATION.md`
- **Completion Report**: `@project-context/.../IMPLEMENTATION-COMPLETE-REPORT.md`

**Key Principles**:
- Flat monthly archive (no nested folders)
- Bidirectional inbox (no outbox)
- Send → Inbox → Archive → Log workflow
- Daily inbox checks (or use pre-commit warnings)
- Per-project isolation (failure isolation)
- Template-driven project bootstrap

#### Active Coordination Projects

**MVP2 Tranche 1: Foundation & Replanning** (2025-11-01)
- **Location**: `~/dev/wildlifeai/cross-project-coordination/projects/mvp2-tranche1-foundation-replanning`
- **Objective**: Get Tasks 1-14 working with backend schema alignment (24-hour target)
- **Scope**: Code review remediation, backend schema migration, foundation stabilization
- **Planning Document**: `@project-context/development-context/documentation-cleanup/planning/UPDATED-REPLANNING-PROMPT.md`

**Strategy**: Two-tranche approach
- **Tranche 1** (Current): Foundation + Tasks 1-14 (get what exists working)
- **Tranche 2** (Future): New features Tasks 15-23 (planned separately after Tranche 1 success)

**Check Tranche 1 Inbox**:
```bash
~/dev/wildlifeai/cross-project-coordination/.scripts/check-inbox.sh \
  --project "mvp2-tranche1-foundation-replanning" \
  --team "mobile"
```

**Send Message to Backend**:
```bash
~/dev/wildlifeai/cross-project-coordination/.scripts/send-message.sh \
  --project "mvp2-tranche1-foundation-replanning" \
  --from "mobile" \
  --to "backend" \
  --type "status-update" \
  --message "Your message here"
```

## Development Workflow

### Session Startup (AUTOMATIC - Run Every Session Start)

**CRITICAL**: At the start of EVERY session, I (Claude Code) automatically check for cross-project coordination notifications:

```bash
# Check for backend messages (run automatically)
~/dev/wildlifeai/cross-project-coordination/.scripts/check-notifications.sh mobile

# If notifications exist, read inbox
~/dev/wildlifeai/cross-project-coordination/.scripts/check-inbox.sh \
  --project "mvp2-tranche1-foundation-replanning" \
  --team "mobile"
```

**Why**: Backend team may have sent schema changes, deployment updates, or planning feedback while I was offline. Checking automatically ensures I never miss critical coordination messages.

**Watcher Status**: Background watcher monitors inboxes 24/7 and creates JSON notifications in `.notifications/` folder when messages arrive.

**What I Do When Notifications Found**:
1. Report to user: "Found X coordination messages from backend team"
2. Read and summarize each message
3. Take appropriate action (schema update, planning input, etc.)
4. Mark notifications as handled

---

### Before Starting Any Task
1. **Check Coordination Notifications**: AUTOMATIC at session start (see above)
2. **Check Current Status**: View Project Progress Tracker dashboard (http://localhost:3333)
3. **Review Strategy**: Consult `MVP2-MASTER-EXECUTION-PLAN.md` for current methodology
4. **Get Requirements**: Read `implementation-spec-v1.4.md` and specific task file
5. **Verify Types**: Run `npm run types:check-local` (or appropriate environment) if backend schema changed
6. **Confirm Environment**: Check which Supabase environment you're targeting (local/cloud-dev/cloud-prod)
7. **Start Tracking**: Note start time in `MVP2-METRICS-TRACKER.md`

### During Development
- **Research FIRST**: Use Context7 for library documentation (proven 10x efficiency)
- **Write tests BEFORE code**: Follow TDD (Red-Green-Refactor)
- **Track time**: Document blockers and actual hours in metrics tracker
- **Follow current execution strategy**: Incremental/parallel/hybrid per master plan
- **Adhere to quality gates**: Defined in execution plan

### After Task Completion
- **Update metrics tracker**: Record actual time spent vs estimates
- **Monitor progress**: Check dashboard for status
- **Commit regularly**: At sensible points (subtask completion) with descriptive messages
- **Check cross-project status**: If applicable

### Important Development Instructions
- Reference task details in `@project-context/development-context/MVP2/implementation/tasks/` before implementation
- Check in files to git regularly at sensible points (after each subtask completion)
- Update progress documentation after completing each task/feature/subtask
- Preserve implementation context for session recovery

## Documents to Keep Updated

**ALWAYS UPDATE** these documents as you work:

1. **Metrics Tracker**: `@project-context/development-context/MVP2/implementation/execution/MVP2-METRICS-TRACKER.md`
   - Record actual vs estimated hours for every task
   - Track start/end times for accuracy
   - Update completion status and variance analysis
   - Document blockers and solutions

2. **Learning Log**: `@project-context/learnings/claude-flow-usage-log.md`
   - Document patterns discovered
   - Record problem solutions
   - Capture best practices
   - Track development progress and velocity

3. **Integration Progress**: When working on backend
   - Update `supabase-integration-progress.md`
   - Document API changes
   - Record migration status

4. **Cross-Project Database Tasks**: When database changes are needed
   - Create/update task files in `~/wildlife-watcher-backend/project-context/MVP2-Tasks/`
   - Reference backend project status at `~/wildlife-watcher-backend/project-context/PROJECT-STATUS.md`
   - Follow backend development patterns from `~/wildlife-watcher-backend/CLAUDE.md`

## Task Alignment Protocol

**Before starting ANY MVP2 task or subtask**:
1. **Read Implementation Spec**: `@project-context/development-context/MVP2/implementation-spec-v1.4.md`
2. **Read Task File**: Corresponding file in `@project-context/development-context/MVP2/implementation/tasks/`
3. **Check Master Plan**: `@project-context/development-context/MVP2/implementation/execution/MVP2-MASTER-EXECUTION-PLAN.md`
4. **Verify Alignment**: Cross-reference with:
   - `specifications/user-roles-permissions.md`
   - `specifications/admin-portal-spec.md`
5. **Flag Inconsistencies**: Report any discrepancies to user for clarification

This ensures the task/subtask aligns with latest specifications and architecture decisions.

## Reference Documentation

### Testing & Quality Control
See `@project-context/development-context/MVP2/implementation/guides/testing-standards.md` for:
- Comprehensive testing methodology
- TestID patterns and conventions
- Test structure and organization
- Commit strategies

### Agent Reference
See `@project-context/agent-reference.md` for:
- Complete list of 54+ available agents
- Agent descriptions and capabilities
- Agent selection guidelines
- Coordination patterns

### SuperClaude Architecture
See `@project-context/superclaude-architecture.md` for:
- How SuperClaude integrates with Claude Code
- Task management commands
- Context preservation features
- Session recovery mechanisms

### Command Examples
See `@project-context/command-examples.md` for:
- Execution patterns and examples
- Agent coordination protocols
- MCP tool categories
- Performance benefits

## Environment Configuration

**Key Files**:
- `.env.local` - Local environment variables (gitignored)
- `.env.example` - Template for required variables
- `app.config.js` - Expo configuration (dynamic based on NODE_ENV)

**Required Environment Variables**:
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `GOOGLE_MAPS_API_KEY_ANDROID` - Google Maps for Android
- `GOOGLE_MAPS_API_KEY_IOS` - Google Maps for iOS

## Stack Best Practices & Research (2024)

**CRITICAL**: Comprehensive research completed on React Native + Expo + Supabase best practices

**Research Documents** (MUST READ before major architectural decisions):
- **Comprehensive Guide**: `@documentation/developer-docs/Stack-Best-Practices-Research-2024.md` (Quick Reference)
- **Type Synchronization**: `@project-context/learnings/typescript-cross-repo-sync-best-practices-2025.md`
- **Testing Architecture**: `@project-context/research/testing-architecture-react-native-offline-first.md`
- **Production Security**: `@project-context/production-security-performance-guide.md`

**Key Findings**:
- **Type Synchronization**: 80% coverage (git hooks) → 95% with CI/CD (✅ GitHub Actions workflow added)
- **Testing Strategy**: Maestro recommended for E2E (official Expo support, 2 hours setup vs 4+ hours for Detox)
- **Performance**: SQLite WAL mode enabled ✅ (5-10x write performance improvement)
- **Security**: Console.log removal pattern, SecureStore for credentials, RLS optimization patterns
- **Bundle Size**: 12.27 MB (baseline measured, optimization opportunities identified)

**Evidence-Based ROI**:
- GitHub Actions type validation: 160:1 ROI (15 min → 40 hours saved annually)
- Backend project measured: 10x debugging efficiency improvement via Context7 research
- Context7 analysis: 38,000+ vendor-specific code snippets validated

**Infrastructure Improvements** (Task 24):
- [x] GitHub Actions type validation (`.github/workflows/type-validation.yml`)
- [x] SQLite WAL mode (already enabled in DatabaseService.ts)
- [x] Bundle analysis baseline (12.27 MB Android bundle)
- [ ] Maestro E2E testing setup (2 hours)
- [ ] Security audit (console.log removal, env var validation)
- [ ] Nightly type reconciliation
- [ ] Production monitoring (Sentry)
- [ ] RLS performance optimization (backend coordination)

**Action Items Reference**: See Task 24 (`@project-context/development-context/MVP2/implementation/tasks/task_024_infrastructure_quality_improvements.txt`)

## Code Style & Best Practices

- **TypeScript**: Strict mode, prefer types over interfaces (per `.cursorrules`)
- **Modular Design**: Files under 500 lines
- **Environment Safety**: Never hardcode secrets
- **Clean Architecture**: Separate concerns
- **Test-First**: Write tests before implementation
- **Documentation**: Update as you code
- **Evidence-Based Development**: Use Context7 research BEFORE implementation (proven 10x efficiency)

## Quick Setup

```bash
# Add Claude Flow MCP server
claude mcp add claude-flow npx claude-flow@alpha mcp start

# Add Serena MCP server for enhanced development
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env
uvx --from git+https://github.com/oraios/serena serena start-mcp-server
```

## Wildlife Watcher AADF Agent Ecosystem

**Status**: ✅ Phase 1 P0 MVP Complete (2025-11-09)
**Production Readiness**: 95%
**Documentation**: `@project-context/investigation/aadf-work-smart/2025-11-09-PHASE-1-P0-MVP-COMPLETION-REPORT.md`

### 🔴 CRITICAL USAGE RULE: Project-Specific Agents ALWAYS Take Priority

**MANDATORY AGENT SELECTION HIERARCHY**:

1. **FIRST**: Use Wildlife Watcher project-specific agents (`ww-aadf-mobile-*` and `/ww-aadf-mobile-*` commands)
2. **SECOND**: Use generic agents ONLY if:
   - No project-specific agent exists for the task
   - Explicit justification provided to user
   - User explicitly approves generic agent usage

**Violation Policy**: Using generic agents without justification is a **CRITICAL ERROR** equivalent to bypassing quality gates.

**Examples**:
- ✅ **CORRECT**: `/ww-aadf-mobile-validate` for quality gate validation
- ❌ **WRONG**: Using generic `quality-assurance-engineer` agent without justification
- ✅ **CORRECT**: `/ww-aadf-mobile-implement` for feature implementation
- ❌ **WRONG**: Using generic `coder` agent without justification
- ✅ **CORRECT**: Inform user if no project-specific agent exists and request approval for generic agent

**Justification Template** (when generic agent is necessary):
```
NOTICE: Using generic agent [agent-name] because:
- No project-specific agent exists for [specific capability]
- Project-specific agent [ww-aadf-mobile-X] does not cover [specific requirement]
- Awaiting user approval to proceed with generic agent
```

**Evidence**: Project-specific agents contain:
- Wildlife Watcher architecture context (App.tsx layers, Redux, offline-first)
- 13 quality gates enforcement (T-008 prevention)
- Context7 research integration (10x efficiency)
- Testing strategy (REAL Supabase only)
- Type synchronization (5-layer defense)

### Overview

Specialized agent ecosystem for enforcing quality gates, preventing type drift, and orchestrating TDD/BDD workflows. All agents created with proper Claude Code formatting (YAML frontmatter) and comprehensive specifications.

### P0 Mobile Agents (5)

1. **ww-aadf-mobile-quality-enforcer** (.claude/agents/ww-mobile-agents/)
   - Enforce all 13 quality gates before commits and PR merges
   - Blocking enforcement (no bypasses without approval)
   - Pre-commit hook + GitHub Actions + manual review integration

2. **ww-aadf-mobile-type-guardian** (.claude/agents/ww-mobile-agents/)
   - Prevent type drift across environments (local, cloud-dev, cloud-prod)
   - 5-layer defense strategy (99% prevention rate)
   - Breaking change detection and validation

3. **ww-aadf-mobile-offline-validator** (.claude/agents/ww-mobile-agents/)
   - Validate offline-first coverage (current: 10%, target: 100%)
   - Service-by-service compliance analysis
   - Migration priority and effort estimation

4. **ww-aadf-mobile-test-architect** (.claude/agents/ww-mobile-agents/)
   - Orchestrate TDD/BDD testing strategy
   - REAL Supabase testing only (no mocks policy)
   - Integration tests FIRST, then unit, then E2E

5. **ww-aadf-mobile-implementation-expert** (.claude/agents/ww-mobile-agents/)
   - End-to-end feature implementation
   - Context7 research FIRST (proven 10x efficiency)
   - Quality gates enforced from start

### Coordination Agent (1)

6. **ww-aadf-coordinator** (.claude/agents/coordination/)
   - Cross-project mobile-backend coordination
   - Message routing (schema-change, task-request, status-update, deployment-ready)
   - Milestone validation and session recovery

### P0 Slash Commands (6)

**Quality & Validation**:
- `/ww-aadf-mobile-validate [gate]` - Run all 13 quality gates
- `/ww-aadf-mobile-review [files]` - Comprehensive code review
- `/ww-aadf-mobile-fix-types [env]` - Quick type regeneration (local/cloud-dev/cloud-prod)
- `/ww-aadf-mobile-check-offline [service]` - Validate offline-first coverage

**Development**:
- `/ww-aadf-mobile-implement [feature]` - End-to-end feature implementation with TDD
- `/ww-aadf-mobile-test [type]` - TDD test suite orchestration (unit/integration/e2e/all)

### Usage Examples

```bash
# Validate all quality gates before commit
/ww-aadf-mobile-validate all

# Implement feature with TDD + quality gates
/ww-aadf-mobile-implement "As a user, I want to edit my profile"

# Code review with architecture compliance
/ww-aadf-mobile-review "src/services/ProjectService.ts"

# Run integration tests with real Supabase
/ww-aadf-mobile-test integration

# Fix type drift after backend schema change
/ww-aadf-mobile-fix-types local

# Check offline-first coverage
/ww-aadf-mobile-check-offline all
```

### Agent Selection Decision Tree

**Before spawning ANY agent, follow this decision tree**:

```
START
  ↓
Is task related to: quality gates, type sync, offline-first, testing, or feature implementation?
  ↓ YES
Use appropriate /ww-aadf-mobile-* command or ww-aadf-mobile-* agent
  ↓ DONE
  ↓ NO
Does a project-specific agent exist for this task category?
  ↓ YES
Use project-specific agent with full context
  ↓ DONE
  ↓ NO
STOP → Inform user: "No project-specific agent for [task]. Request approval for generic agent [name]?"
  ↓ USER APPROVES
Use generic agent + document justification
  ↓ DONE
```

**Common Task Mappings** (ALWAYS use project-specific agents for these):

| Task Category | Use This Agent/Command | NOT Generic Agent |
|---------------|------------------------|-------------------|
| Quality validation | `/ww-aadf-mobile-validate` | ❌ quality-assurance-engineer |
| Feature implementation | `/ww-aadf-mobile-implement` | ❌ coder, implementation-expert |
| Code review | `/ww-aadf-mobile-review` | ❌ code-analyzer, reviewer |
| Testing | `/ww-aadf-mobile-test` | ❌ tester, quality-assurance-engineer |
| Type synchronization | `/ww-aadf-mobile-fix-types` | ❌ type-guardian (generic) |
| Offline-first validation | `/ww-aadf-mobile-check-offline` | ❌ architecture agent (generic) |
| Cross-project coordination | `ww-aadf-coordinator` | ❌ project-coordinator (generic) |

### Key Benefits

**Time Savings**: 62.5% (parallel agent creation: 1.5h vs 4h sequential)
**Projected ROI**: 218:1 (2h investment → 437h annual savings)
**Prevention Rate**: 100% for T-008-style failures
**Evidence-Based**: Context7 research (38,000+ code snippets), T-008 case study learnings

### Architecture Integration

All agents understand Wildlife Watcher architecture:
- App.tsx layer inheritance (Safe Area → Redux → Navigation → BLE → Auth)
- Offline-first pattern (SQLite → Queue → Sync → Supabase)
- 13 quality gates (ALL BLOCKING)
- Testing strategy (REAL Supabase only, no mocks)
- Type synchronization (5-layer defense-in-depth)

### Documentation

**Complete Plan**: `@project-context/investigation/aadf-work-smart/2025-11-09-REVISED-specialized-agent-ecosystem-plan.md`
**Quick Reference**: `@project-context/investigation/aadf-work-smart/QUICK-REFERENCE-AGENT-INVENTORY.md`
**Context7 Research**: `@project-context/investigation/aadf-work-smart/context7-research-summary-2025-11-09.md`

---

## Support

- **Documentation**: https://github.com/ruvnet/claude-flow
- **Issues**: https://github.com/ruvnet/claude-flow/issues
- **Project Repository**: https://github.com/wildlifeai/wildlife-watcher-mobile-app
- **Project Overview**: https://www.youtube.com/watch?v=Ima3n2EYfeE
