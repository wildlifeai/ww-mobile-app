# Revised Specialized Agent Ecosystem Plan

**Date**: 2025-11-09
**Status**: Reality-Grounded Assessment
**Purpose**: Address critical feedback and provide honest appraisal of current vs proposed state

---

## Executive Summary

This document provides a **brutally honest assessment** of the Wildlife Watcher mobile app's current state versus the aspirational specialized agent ecosystem. The original plan was overly optimistic. This revision clearly separates:

1. **What exists today** (actual implementation)
2. **What needs building** (gaps and prerequisites)
3. **Realistic implementation phases** (with dependencies)
4. **Risk-aware rollout strategy** (pilot → staging → production)

**Key Findings**:
- Only 1 of 13 quality gates implemented (type-size check)
- Only ProjectService is offline-first (RTK Query APIs call Supabase directly)
- 156 console.log statements in production code despite "zero tolerance" policy
- No Husky, no /ww-aadf-mobile-* slash commands, agents not in expected directories
- Pre-commit hook exists but only validates type drift (1 of 12 checks)

**SCOPE SUMMARY** (See Section 11 for complete inventory):

**Mobile Team Deliverables** (This Plan):
- **8 Mobile Agents** (5 P0, 2 P1, 1 P2)
- **10 Mobile Slash Commands** (6 P0, 3 P1, 1 P2)
- **1 Coordination Agent** (P0)
- **Total**: 18 mobile deliverables + 1 coordination = **19 deliverables**

**P0 MVP Scope** (12 deliverables for immediate quality enforcement):
- 5 P0 agents (quality-gate-enforcer, type-sync-guardian, offline-architect, testing-coordinator, code-reviewer)
- 6 P0 commands (test, validate-local, validate-cloud-dev, quality-gate, sync-types, check-inbox)
- 1 coordination agent (ww-aadf-coordinator)

**Backend Team Pattern** (Future - Backend Team Responsibility):
- 8 backend agents (pattern provided, backend team implements)
- 10 backend slash commands (pattern provided, backend team implements)
- Total: 18 backend deliverables (backend team responsibility)

**CRITICAL SCOPE CLARIFICATIONS** (Updated 2025-11-09):

1. **Naming Convention**: `ww-aadf-{domain}-{capability}` pattern (Wildlife Watcher + AADF + domain)
   - Mobile agents: `ww-aadf-mobile-*` (e.g., `ww-aadf-mobile-quality-gate-enforcer`)
   - Mobile commands: `/ww-aadf-mobile-*` (e.g., `/ww-aadf-mobile-test`)
   - Backend agents: `ww-aadf-backend-*` (pattern for backend team)
   - Backend commands: `/ww-aadf-backend-*` (pattern for backend team)
   - Coordination agents: `ww-aadf-*` (no domain prefix)

2. **Project-Specific Agents**: These agents are NOT generic. They are **mobile specialists** with deep understanding of:
   - Offline-first architecture (SQLite + queue + sync)
   - Redux patterns (RTK Query, slices, listener middleware)
   - React Native + Expo 51 ecosystem
   - Supabase integration patterns
   - BLE workflows and device communication

3. **Backend Coordination**: Backend team will conduct their own agent review separately. Mobile team provides PATTERN and STRUCTURE via Section 11.3-11.4.

4. **Quality Gate Enforcement**: ALL 13 gates are BLOCKING (not warnings). No exceptions, no bypass allowed.

5. **Testing Strategy**: REAL Supabase ONLY - no mocks, no test doubles:
   - Test data seeded in local and cloud-dev environments
   - Test users: project_admin@test.com, project_member@test.com
   - Integration tests run against actual Supabase database
   - Current: scripts/test-integration-local.sh uses real local Supabase

6. **Parallel Creation**: All agents and slash commands created in parallel using Task tool with FULL context (architecture, patterns, file references, quality gates).

---

## Section 1: Current State Assessment

### 1.1 Architecture Reality Check

**What EXISTS Today**:

```
App Root (src/App.tsx - 900 lines)
├── Safe Area Provider (react-native-safe-area-context)
├── React Suspense (error boundary)
├── Redux Provider (src/redux/index.ts)
│   ├── 4 RTK Query APIs (api, enhancedApi, projectsApi, aiModelsApi)
│   ├── 15 Redux slices (auth, projects, deployments, devices, BLE, offline, sync, network)
│   └── 1 listener middleware (offlineSyncMiddleware)
├── Paper Provider (react-native-paper)
├── Navigation Container (react-navigation)
├── Hardware/Bluetooth Providers (BLE initialization)
└── Auth Providers (Supabase auth listener)
```

**Redux Store Reality** (src/redux/index.ts):
- **4 RTK Query APIs**: api, enhancedApi, projectsApi, aiModelsApi
- **15 Redux slices**: bleLibrary, deployments, androidPermissions, network, locationStatus, scanning, offline, sync, auth, logs, projects, bluetoothStatus, devices, configuration, wwAdmin
- **1 custom middleware**: offlineSyncMiddleware (RTK listener middleware)

**Offline-First Coverage** (CRITICAL FINDING):
- ✅ **ProjectService** (`src/services/ProjectService.ts`, 900 lines): Full offline-first with DatabaseService, OfflineService, SQLite queue, background sync
- ❌ **RTK Query APIs**: ALL call Supabase directly via `src/redux/api/index.ts` base query
  - `deploymentsApi` → Direct Supabase (src/redux/api/deployments/index.ts)
  - `auth` → Direct Supabase (src/redux/api/auth/index.ts)
  - `devices` → Direct Supabase (src/redux/api/devices/index.ts)
  - `media`, `observations`, `sensorRecords`, `users` → All direct Supabase
- ❌ **Other Services**: auth.ts, ProjectMemberService.ts, DfuService.ts → Direct Supabase
- **Coverage**: ~10% (1 service out of ~10 total)

**Offline Infrastructure** (EXISTS):
- ✅ `src/services/offline/OfflineService.ts` (900 lines): Network monitoring, operation queuing, retry logic
- ✅ `src/services/offline/DatabaseService.ts` (SQLite CRUD, schema management, WAL mode enabled)
- ✅ `src/services/offline/SyncService.ts` (Sync queue, conflict detection)
- ✅ `src/redux/middleware/offlineSyncMiddleware.ts` (Network listener, auto-sync)
- ✅ `src/redux/slices/offlineSlice.ts` (Queue state management)
- ✅ `src/redux/slices/syncSlice.ts` (Sync status tracking)

**BLE Architecture** (EXISTS):
- ✅ `src/hooks/useBle.ts` (700+ lines): Custom BLE engine with command scheduling
- ✅ `src/ble/parser.ts`: Command construction and parsing
- ✅ Redux slices: bleLibrary, bluetoothStatus, scanning, devices
- ✅ `react-native-ble-manager` integration
- **Pattern**: Custom engine with function queue, NOT standard BLE service pattern

**Supabase Environment Switching** (EXISTS):
- ✅ `src/config/environments.ts`: 3 environments (local, cloud-dev, cloud-prod)
- ✅ `src/config/EnvironmentManager.ts`: AsyncStorage persistence
- ✅ `src/services/supabase.ts`: Factory pattern with runtime switching
- ✅ `src/screens/DeveloperSettingsScreen.tsx`: UI for environment selection
- ✅ Event-driven client recreation on environment change
- **Restriction**: Production builds disable switching (security)

**Testing Infrastructure** (EXISTS):
- ✅ Jest (unit/integration): 113/145 unit tests passing (77.9%), 18/30 integration tests passing (60%)
- ✅ Maestro E2E: Installed, some flows in `tests/maestro/`
- ✅ Detox: Configured but not actively used
- ✅ BDD helpers: `tests/setup/helpers/bdd.ts` (Given/When/Then)
- ✅ Real Supabase testing: `scripts/test-integration-local.sh`
- ❌ **NO mocking infrastructure** (intentional - tests use real Supabase)

### 1.1.1 Architecture Layers Deep Dive

**Root Component Layers** (src/App.tsx):

Understanding these layers is CRITICAL for agents because screens automatically inherit permissions, state, and context:

```
Root Component Layers (src/App.tsx):
├── Safe Area Provider → Platform permissions inherited by all screens
├── React Suspense → Error boundaries before render
├── Redux Provider → Store available to all components
│   ├── 4 RTK Query APIs (auto-caching, optimistic updates)
│   ├── 15 Redux slices (domain state: auth, projects, devices, BLE, offline, sync)
│   └── Listener middleware (NetInfo events → queue processing)
├── Paper Provider → Material Design components
├── Navigation Container → React Navigation v6
├── BLE Providers → Hardware state before screens render
└── Auth Providers → Supabase auth context

**Key Pattern**: Screens automatically inherit platform permissions, BLE state, and auth context
BEFORE MainNavigation renders. Agents must understand this inheritance chain.
```

**Redux Store Setup** (src/redux/index.ts):

```typescript
// 4 RTK Query APIs with serializable check exceptions for queue metadata
const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['offline/addToQueue', 'offline/updateQueueItem'],
        ignoredPaths: ['offline.queue', 'sync.conflicts']
      }
    }).concat(
      api.middleware,
      enhancedApi.middleware,
      projectsApi.middleware,
      aiModelsApi.middleware
    )
});

// Listener-based offline middleware (not standard Redux middleware)
// Reacts to NetInfo events, manages queue processing
```

**Offline-First Implementation Pattern**:

```
SQLite-Backed Queue + Status Slice:
├── src/redux/slices/offlineSlice.ts → Queue state management
├── src/redux/middleware/offlineSyncMiddleware.ts → Listener middleware
│   └── Reacts to NetInfo events (online → process queue)
├── src/services/offline/OfflineService.ts (900 lines)
│   ├── Network monitoring
│   ├── Operation queuing with retry logic
│   ├── Conflict detection
│   └── Delegates to OfflineApiService for Supabase operations
└── ProjectService Pattern (TEMPLATE for other services):
    ├── Every read hits SQLite FIRST
    ├── Writes queue operations (not direct Supabase)
    ├── Background sync invalidates RTK Query caches
    └── Conflict resolution: last-write-wins with manual override
```

**Device Configuration & BLE**:

```
Custom BLE Engine (NOT standard service pattern):
├── src/hooks/useBle.ts (700+ lines)
│   ├── Command scheduling with pacing enforcement
│   ├── Function queue (not standard BLE manager)
│   └── Coordinates with Redux slices
├── BleEngineProvider → Encapsulates hardware workflows
├── DeviceReconnectProvider → Auto-reconnect logic
└── Redux Slices:
    ├── bleLibrary → BLE device library state
    ├── bluetoothStatus → Hardware status
    ├── scanning → Device discovery
    ├── devices → Connected device management
    └── configuration → Device configuration workflows
```

**Why This Matters for Agents**:

1. **Implementation Agent** must understand layer inheritance (don't re-implement what's already inherited)
2. **Review Agent** must validate proper use of existing providers (avoid duplicate context)
3. **Testing Agent** must understand that tests need Redux Provider + Navigation Container setup
4. **Offline Agent** must understand ProjectService as the template pattern for all services

### 1.2 Quality Gate Reality Check

**Pre-Commit Hook** (`.git/hooks/pre-commit`):
- ✅ EXISTS: 68 lines, executable
- ✅ **Gate 1**: Type drift validation (`npm run types:check-local`)
- ✅ **Gate 2**: Coordination message warning (non-blocking)
- ❌ **Missing 11 gates**:
  - Type system empty check (min 50KB)
  - Console.log pollution check
  - Test coverage check (80%+ for changed files)
  - TypeScript compilation check
  - Linting check (<50 violations)
  - TestID coverage check
  - Input validation check
  - Offline-first architecture check
  - Bundle size regression check
  - Security vulnerability scan
  - Performance regression check

**GitHub Actions Workflows** (`.github/workflows/`):
- ✅ `type-validation.yml`: Validates types match cloud-dev database on PR
- ✅ `quality-gate-validation.yml`: Type size, console.log, test coverage, TypeScript, linting
- ✅ `cloud-type-validation.yml`: Cloud environment type checking
- ✅ `build.yml`: EAS build workflow
- **Coverage**: 5 of 13 quality gates (38%)

### 1.2.6 Console.log Reality vs Policy (CONTRADICTION RESOLUTION)

**Policy** (CLAUDE.md):
- "Zero console.log tolerance"
- Quality gate should block commits with console.log statements

**Reality** (Actual Codebase):
- **156 console.log statements** across 9 production files:
  - `src/services/supabase.ts`: 8
  - `src/services/apiTest.ts`: 16
  - `src/services/offline/OfflineService.ts`: 48
  - `src/services/ProjectService.ts`: 39
  - `src/services/ProjectMemberService.ts`: 8
  - `src/services/auth.ts`: 17
  - `src/services/offline/WWAdminOfflineService.ts`: 3
  - `src/services/offline/SyncService.ts`: 7
  - `src/services/offline/DatabaseService.ts`: 10

**Current Enforcement**:
- ❌ No pre-commit gate for console.log
- ❌ No ESLint rule blocking console.log
- ✅ GitHub Actions quality-gate-validation.yml checks for console.log (but not blocking PRs yet)

**Resolution Strategy** (Phased Approach):

**Phase 1 (Week 1-2)**: Centralized Logger Infrastructure
- Create `src/utils/logger.ts` with environment-aware logging:
  ```typescript
  // Development: console output
  // Production: Sentry/remote logging
  // Test: silent or test-specific output
  export const logger = {
    debug: (message: string, meta?: any) => { /* ... */ },
    info: (message: string, meta?: any) => { /* ... */ },
    warn: (message: string, meta?: any) => { /* ... */ },
    error: (message: string, meta?: any) => { /* ... */ }
  };
  ```
- Add ESLint rule: `no-console` with warning level (not error yet)

**Phase 2 (Week 3-4)**: Migration Plan
- Migrate 156 console.log statements to logger.* calls
- Priority order:
  1. Critical services (auth, offline, sync) first
  2. ProjectService and ProjectMemberService second
  3. Utility files last
- Each migration validates existing functionality unchanged

**Phase 3 (Week 5)**: Enforcement
- Upgrade ESLint rule from warning to error
- Add pre-commit gate blocking console.log
- Update GitHub Actions to block PRs with console.log

**Interim Approach**:
- Document logging strategy in CLAUDE.md
- Maybe use `__DEV__` flag for development-only console.log
- Create tracking issue for migration progress

**Why This Matters for Agents**:
- Agents must use `logger.*` not `console.log` for new code
- Agents should NOT enforce zero console.log policy until Phase 3 complete
- Review agent should flag console.log in new code (warning, not blocking)

### 1.3 Agent Infrastructure Reality Check

**Agent Directory Structure** (ACTUAL):
```
.claude/agents/
├── specialized/
│   └── mobile/
│       └── spec-mobile-react-native.md (5540 bytes, single file)
├── core/ (generic agents)
├── data/ (generic agents)
├── development/ (generic agents)
├── devops/ (generic agents)
├── documentation/ (generic agents)
├── sparc/ (generic agents)
└── testing/ (generic agents)
```

**What EXISTS**:
- ✅ 1 mobile-specific agent spec: `spec-mobile-react-native.md`
- ✅ Generic agents in other categories (not mobile-specific)
- ❌ **NO** ww-aadf-mobile-offline-architect
- ❌ **NO** ww-aadf-mobile-ble-specialist
- ❌ **NO** ww-aadf-mobile-performance-optimizer
- ❌ **NO** ww-aadf-mobile-testing-coordinator

**Slash Commands** (`.claude/commands/`):
```
.claude/commands/
├── analysis/
├── automation/
├── coordination/
├── github/
├── hooks/
├── memory/
├── monitoring/
├── optimization/
├── sparc/
├── tm/ (28 subdirectories)
├── training/
└── workflows/
```

**What EXISTS**:
- ✅ Generic slash commands (analysis, automation, etc.)
- ✅ SPARC methodology commands
- ✅ Claude Flow commands (/claude-flow-help, /claude-flow-memory, /claude-flow-swarm)
- ✅ AADF commands (/aadf-work-smart, /aadf-commit, /aadf-commit-staged, /aadf-check-x-project-message)
- ❌ **NO** /ww-aadf-mobile-* commands
- ❌ **NO** mobile-specific shortcuts

### 1.4 Type Synchronization Reality Check

**What EXISTS** (5-layer defense):
1. ✅ **Layer 1 - Backend Pre-Commit**: Backend repo blocks stale types + reminds to create coordination messages
2. ✅ **Layer 2 - Coordination Messages**: Manual schema change notifications (template-based)
3. ✅ **Layer 3 - Manual Inbox Check**: Daily check for backend messages
4. ✅ **Layer 4 - Mobile Pre-Commit**: `.git/hooks/pre-commit` blocks commits with stale types
5. ✅ **Layer 5 - GitHub Actions**: `.github/workflows/type-validation.yml` blocks PR merge on type drift

**Scripts** (`scripts/`):
- ✅ `check-types-local.sh`: Validates types match local Supabase (3 sec)
- ✅ `check-types-cloud-dev.sh`: Validates types match cloud-dev Supabase
- ✅ `check-types-cloud-prod.sh`: Validates types match cloud-prod Supabase
- ✅ `test-integration-local.sh`: Runs integration tests with real Supabase
- **Coverage**: 100% for type synchronization

**Coordination System** (`~/dev/wildlifeai/cross-project-coordination/`):
- ✅ **Flat-Inbox System** (daily use): schema changes, status updates, task requests
- ✅ **Dynamic System** (large projects): 3+ coordinated tasks, milestone execution
- ✅ Message templates, inbox/archive workflow
- ✅ Watcher script monitors inboxes 24/7
- ✅ Backend pre-commit reminds to notify mobile

### 1.5 Git Hooks Reality Check

**Husky**: ❌ **DOES NOT EXIST** (no `.husky/` directory)

**Manual Pre-Commit Hook**: ✅ **EXISTS** (`.git/hooks/pre-commit`)
- Created: 2025-10-29
- Purpose: Type drift prevention (Layer 4 of 5-layer defense)
- Blocks commits: Type drift only (1 of 12 checks)
- Warning only: Unread coordination messages

**Limitations**:
- Manual installation required (not committed to repo)
- Developer must create hook locally
- No automatic setup via `npm install`
- No centralized management

---

## Section 2: Proposed State (What Needs Building)

### 2.1 Specialized Agent Ecosystem (8 New Agents)

**Mobile-Specific Agents** (NEW):

1. **ww-aadf-mobile-offline-architect** (.claude/agents/specialized/mobile/ww-aadf-mobile-offline-architect.md)
   - **Purpose**: Design and validate offline-first architecture for new features
   - **Inputs**: Feature spec, API requirements, offline constraints
   - **Outputs**: SQLite schema, sync strategy, conflict resolution approach
   - **File References**: ProjectService.ts (pattern), OfflineService.ts (queue)

2. **ww-aadf-mobile-ble-specialist** (.claude/agents/specialized/mobile/ww-aadf-mobile-ble-specialist.md)
   - **Purpose**: BLE integration, command scheduling, device communication
   - **Inputs**: BLE requirements, device firmware specs
   - **Outputs**: BLE service implementation, command parser updates
   - **File References**: useBle.ts (engine pattern), src/ble/parser.ts

3. **ww-aadf-mobile-performance-optimizer** (.claude/agents/specialized/mobile/ww-aadf-mobile-performance-optimizer.md)
   - **Purpose**: Bundle size, render performance, battery optimization
   - **Inputs**: Performance baseline, target metrics
   - **Outputs**: Optimization plan, implementation patches
   - **File References**: Bundle analysis baseline (12.27 MB)

4. **ww-aadf-mobile-testing-coordinator** (.claude/agents/specialized/mobile/ww-aadf-mobile-testing-coordinator.md)
   - **Purpose**: Orchestrate Jest, Maestro, Detox testing strategy
   - **Inputs**: Feature implementation
   - **Outputs**: Test suite (unit, integration, E2E)
   - **File References**: tests/setup/helpers/bdd.ts, scripts/test-integration-local.sh

5. **ww-aadf-mobile-type-sync-guardian** (.claude/agents/specialized/mobile/ww-aadf-mobile-type-sync-guardian.md)
   - **Purpose**: Validate type synchronization across environments
   - **Inputs**: Backend schema changes, coordination messages
   - **Outputs**: Type regeneration commands, validation reports
   - **File References**: scripts/check-types-*.sh, src/types/supabase.ts

6. **ww-aadf-mobile-environment-manager** (.claude/agents/specialized/mobile/ww-aadf-mobile-environment-manager.md)
   - **Purpose**: Manage local/cloud-dev/cloud-prod environment switching
   - **Inputs**: Environment target, build profile
   - **Outputs**: Environment config, type sync validation
   - **File References**: src/config/environments.ts, src/config/EnvironmentManager.ts

7. **ww-aadf-mobile-quality-gate-enforcer** (.claude/agents/specialized/mobile/ww-aadf-mobile-quality-gate-enforcer.md)
   - **Purpose**: Run all 13 quality gates before task completion
   - **Inputs**: Changed files, test results
   - **Outputs**: Quality score (0-10), production readiness (0-100%)
   - **File References**: .git/hooks/pre-commit, .github/workflows/quality-gate-validation.yml

8. **ww-aadf-mobile-code-reviewer** (.claude/agents/specialized/mobile/ww-aadf-mobile-code-reviewer.md)
   - **Purpose**: Post-implementation comprehensive review
   - **Inputs**: Task implementation, test coverage
   - **Outputs**: Review report with quality score, production readiness
   - **File References**: All source files, test files

### 2.2 Slash Command Shortcuts (10 New Commands)

**Mobile-Specific Commands** (.claude/commands/mobile/):

1. **/ww-aadf-mobile-test** - Run full test suite (unit + integration + E2E)
   ```bash
   npm test && npm run test:integration && npm run test:maestro
   ```

2. **/ww-aadf-mobile-validate-local** - Full validation for local environment
   ```bash
   npm run validate:local
   ```

3. **/ww-aadf-mobile-validate-cloud-dev** - Full validation for cloud-dev
   ```bash
   npm run validate:cloud-dev
   ```

4. **/ww-aadf-mobile-quality-gate** - Run all 13 quality gates
   ```bash
   .claude/agents/specialized/mobile/run-quality-gates.sh
   ```

5. **/ww-aadf-mobile-sync-types** - Sync types from backend (auto-detect environment)
   ```bash
   scripts/sync-types-from-backend.sh
   ```

6. **/ww-aadf-mobile-check-inbox** - Check cross-project coordination inbox
   ```bash
   ~/dev/wildlifeai/cross-project-coordination/.scripts/check-inbox.sh \
     --project "mvp2-tranche1-foundation-replanning" \
     --team "mobile"
   ```

7. **/ww-aadf-mobile-bundle-analyze** - Analyze bundle size and dependencies
   ```bash
   npx react-native-bundle-visualizer
   ```

8. **/ww-aadf-mobile-performance** - Run performance benchmarks
   ```bash
   npm run test:performance
   ```

9. **/ww-aadf-mobile-security-audit** - Security vulnerability scan
   ```bash
   npm audit && scripts/check-console-logs.sh && scripts/check-secrets.sh
   ```

10. **/ww-aadf-mobile-offline-coverage** - Report offline-first coverage
    ```bash
    scripts/report-offline-coverage.sh
    ```

### 2.3 Quality Gate Tooling (8 New Scripts)

**New Scripts** (scripts/quality-gates/):

1. **check-type-system-size.sh** - Validate supabase.ts size (min 50KB)
2. **check-console-logs.sh** - Fail if console.log found (exclude tests, logger.ts)
3. **check-test-coverage.sh** - Validate 80%+ coverage for changed files
4. **check-typescript.sh** - Zero TypeScript errors allowed
5. **check-linting.sh** - <50 linting violations
6. **check-testid-coverage.sh** - All interactive components have testID
7. **check-input-validation.sh** - All user inputs have Yup/zod schemas
8. **check-offline-first.sh** - New API integrations use OfflineService

**Integration Points**:
- Pre-commit hook calls all 8 scripts
- GitHub Actions workflow validates on PR
- Mobile-quality-gate-enforcer agent orchestrates execution

### 2.4 Offline-First Migration Strategy

**Current Coverage**: ~10% (ProjectService only)

**Target Coverage**: 100% (all API interactions)

**Migration Priority**:
1. **P0 - Critical User Journeys** (Weeks 1-2):
   - deploymentsApi (src/redux/api/deployments/index.ts)
   - auth (src/redux/api/auth/index.ts)
   - devices (src/redux/api/devices/index.ts)

2. **P1 - Secondary Features** (Weeks 3-4):
   - media (src/redux/api/media/index.ts)
   - observations (src/redux/api/observations/index.ts)
   - sensorRecords (src/redux/api/sensorRecords/index.ts)

3. **P2 - Administrative Functions** (Weeks 5-6):
   - users (src/redux/api/users/index.ts)
   - ProjectMemberService.ts
   - DfuService.ts

**Migration Pattern** (per API):
```typescript
// BEFORE: Direct Supabase call (RTK Query)
getDeployments: builder.query<Deployment[], void>({
  query: () => ({
    url: API_URLS.DEPLOYMENTS,
    method: HttpMethod.GET,
  }),
  // ...
})

// AFTER: Offline-first via DatabaseService + OfflineService
getDeployments: builder.query<Deployment[], void>({
  queryFn: async () => {
    // 1. Read from local SQLite
    const local = await databaseService.getDeployments()

    // 2. Trigger background sync
    offlineService.backgroundSync('deployments').catch(console.warn)

    // 3. Return local data immediately
    return { data: local }
  },
  // ...
})
```

**Testing Strategy**:
- Integration tests with real Supabase (no mocks)
- Offline scenarios: airplane mode, intermittent connectivity
- Conflict resolution scenarios: concurrent edits
- Data integrity checks: SQLite → Supabase → SQLite round-trip

---

## Section 3: Implementation Phases

### Phase 1: Foundation (Week 1) - Quality Gate Infrastructure

**Prerequisites**:
- [ ] Local Supabase running (backend repo)
- [ ] npm packages installed
- [ ] .git/hooks/pre-commit exists

**Deliverables**:
1. **Enhanced Pre-Commit Hook** (.git/hooks/pre-commit):
   - Add 8 new quality gate checks
   - Total: 10 gates (type drift + 8 new + coordination warning)
   - Execution time: <30 seconds

2. **Quality Gate Scripts** (scripts/quality-gates/):
   - 8 new bash scripts (see Section 2.3)
   - Integration with pre-commit hook
   - Parallel execution for speed

3. **GitHub Actions Enhancement** (.github/workflows/quality-gate-validation.yml):
   - Add missing gates (TestID, input validation, offline-first)
   - Total: 13 gates validated on PR
   - Blocks PR merge on failure

4. **Console.log Remediation**:
   - Replace 156 console.log with logger.debug/info/warn/error
   - Add ESLint rule: `no-console: ["error", { allow: ["warn", "error"] }]`
   - Update src/utils/logger.ts if needed

**Success Criteria**:
- ✅ Pre-commit hook blocks commits with console.log
- ✅ Pre-commit hook blocks commits with <80% test coverage
- ✅ GitHub Actions blocks PR merge on quality gate failures
- ✅ Zero console.log in production code

**Risk**: Developer friction if gates too strict
**Mitigation**: Allow manual override with explicit approval + justification

### Phase 2: Agent Development (Weeks 2-3) - Specialized Mobile Agents

**Prerequisites**:
- [ ] Phase 1 complete
- [ ] Agent template structure defined
- [ ] Claude Flow MCP server running

**Deliverables**:
1. **8 Mobile-Specific Agents** (.claude/agents/specialized/mobile/):
   - ww-aadf-mobile-offline-architect.md
   - ww-aadf-mobile-ble-specialist.md
   - ww-aadf-mobile-performance-optimizer.md
   - ww-aadf-mobile-testing-coordinator.md
   - ww-aadf-mobile-type-sync-guardian.md
   - ww-aadf-mobile-environment-manager.md
   - ww-aadf-mobile-quality-gate-enforcer.md
   - ww-aadf-mobile-code-reviewer.md

2. **Agent Specifications** (per agent):
   - Role and responsibilities
   - Input requirements
   - Output format
   - File references (actual codebase paths)
   - Example workflows
   - Integration with other agents

3. **Agent Testing**:
   - Test each agent with real task
   - Validate output quality
   - Measure time savings vs manual

**Success Criteria**:
- ✅ All 8 agents functional
- ✅ Agent outputs validated by humans
- ✅ Documented examples for each agent
- ✅ Integration with Claude Flow

**Risk**: Agents produce low-quality output
**Mitigation**: Human-in-the-loop validation, iterative refinement

### Phase 3: Slash Command Integration (Week 4) - Developer Productivity

**Prerequisites**:
- [ ] Phase 1 complete (quality gates)
- [ ] Phase 2 complete (agents)

**Deliverables**:
1. **10 Mobile Slash Commands** (.claude/commands/mobile/):
   - /ww-aadf-mobile-test.md
   - /ww-aadf-mobile-validate-local.md
   - /ww-aadf-mobile-validate-cloud-dev.md
   - /ww-aadf-mobile-quality-gate.md
   - /ww-aadf-mobile-sync-types.md
   - /ww-aadf-mobile-check-inbox.md
   - /ww-aadf-mobile-bundle-analyze.md
   - /ww-aadf-mobile-performance.md
   - /ww-aadf-mobile-security-audit.md
   - /ww-aadf-mobile-offline-coverage.md

2. **Helper Scripts** (scripts/mobile/):
   - sync-types-from-backend.sh (auto-detect environment)
   - report-offline-coverage.sh (analyze services)
   - run-quality-gates.sh (orchestrate all gates)

3. **Documentation**:
   - Update CLAUDE.md with slash command reference
   - Add examples to command-examples.md
   - Create mobile-specific quick reference guide

**Success Criteria**:
- ✅ All 10 commands functional
- ✅ Commands reduce task time by 50%+
- ✅ Developer adoption >80%

**Risk**: Commands not discoverable or adopted
**Mitigation**: In-app hints, onboarding documentation, team training

### Phase 4: Offline-First Migration (Weeks 5-10) - Architecture Completion

**Prerequisites**:
- [ ] Phase 1 complete (quality gates enforce offline-first)
- [ ] Phase 2 complete (ww-aadf-mobile-offline-architect agent available)
- [ ] Testing infrastructure validated (real Supabase integration tests)

**Deliverables**:
1. **P0 APIs - Critical User Journeys** (Weeks 5-6):
   - deploymentsApi: Offline-first with DatabaseService
   - auth: Offline-first with credential caching
   - devices: Offline-first with BLE device sync

2. **P1 APIs - Secondary Features** (Weeks 7-8):
   - media: Offline-first with local file storage
   - observations: Offline-first with photo/video handling
   - sensorRecords: Offline-first with bulk data sync

3. **P2 APIs - Administrative Functions** (Weeks 9-10):
   - users: Offline-first with profile caching
   - ProjectMemberService: Offline-first with role validation
   - DfuService: Offline-first with firmware download queue

4. **Integration Testing** (All phases):
   - Offline scenarios (airplane mode)
   - Conflict resolution scenarios (concurrent edits)
   - Data integrity checks (round-trip validation)
   - Performance benchmarks (sync speed, battery usage)

**Migration Pattern** (per API):
- Step 1: Create SQLite schema (DatabaseService)
- Step 2: Implement local-first read (return immediately)
- Step 3: Add background sync (OfflineService queue)
- Step 4: Add conflict resolution (ConflictResolutionService)
- Step 5: Write integration tests (real Supabase)
- Step 6: Update Redux API to use new pattern

**Success Criteria**:
- ✅ 100% API coverage (all endpoints offline-first)
- ✅ Integration tests passing (real Supabase)
- ✅ Offline mode functional (airplane mode tested)
- ✅ Conflict resolution working (concurrent edits handled)
- ✅ Performance acceptable (<1s local reads, <5s sync)

**Risk**: Data integrity issues, sync failures, battery drain
**Mitigation**: Extensive testing, monitoring, rollback plan

### Phase 5: Monitoring & Rollout (Weeks 11-12) - Production Readiness

**Prerequisites**:
- [ ] Phases 1-4 complete
- [ ] All quality gates passing
- [ ] Integration tests passing

**Deliverables**:
1. **Monitoring Infrastructure**:
   - Sentry error tracking (production builds)
   - Performance monitoring (bundle size, render time, battery)
   - Sync success rate tracking (OfflineService metrics)
   - Type drift alerts (GitHub Actions notifications)

2. **Rollout Strategy**:
   - **Pilot** (Week 11): Internal team testing (5 users)
   - **Staging** (Week 11): Stakeholder preview build (20 users)
   - **Production** (Week 12): Full rollout (all users)

3. **Rollback Plan**:
   - Feature flags for offline-first (disable per API)
   - Quick revert to direct Supabase calls
   - Data integrity checks before/after rollback

4. **Documentation**:
   - Developer onboarding guide (agents, slash commands)
   - Architecture decision records (ADRs)
   - Troubleshooting guides

**Success Criteria**:
- ✅ Zero production incidents during rollout
- ✅ Monitoring dashboards operational
- ✅ Developer adoption >90%
- ✅ User satisfaction maintained

**Risk**: Production incidents, user complaints, performance degradation
**Mitigation**: Gradual rollout, monitoring, rollback plan, stakeholder communication

---

## Section 4: Quality Gate Rollout

**CRITICAL POLICY UPDATE (2025-11-09)**:

**ALL quality gates are BLOCKING** (not warnings). Key principles:
- ✅ No exceptions allowed
- ✅ No bypass permitted (no `--no-verify`)
- ✅ Pre-commit hook must enforce ALL gates
- ✅ CI/CD must enforce ALL gates before merge
- ✅ Manual override ONLY with explicit user approval + documented justification
- ✅ Emergency override protocol: approval + justification + immediate remediation task

**Enforcement Locations**:
1. **Pre-commit hook** (.git/hooks/pre-commit) - Blocks local commits
2. **GitHub Actions** (.github/workflows/) - Blocks PR merge
3. **Both layers required** - Defense-in-depth (no single point of failure)

### 4.1 Quality Gates Inventory

**Status Key**: ✅ Fully Blocking | ⚠️ Partial Blocking | ❌ Not Implemented

| # | Quality Gate | Status | Pre-Commit Hook | GitHub Actions | Blocking Behavior |
|---|--------------|--------|-----------------|----------------|-------------------|
| 1 | Type Drift Validation | ✅ | ✅ Blocks | ✅ Blocks PR | FULLY ENFORCED |
| 2 | Type System Size Check | ⚠️ | ❌ Missing | ✅ Blocks PR | NEEDS PRE-COMMIT |
| 3 | Console.log Pollution | ⚠️ | ❌ Missing | ✅ Blocks PR | NEEDS PRE-COMMIT (after Phase 3 migration) |
| 4 | Test Coverage (80%+) | ⚠️ | ❌ Missing | ✅ Blocks PR | NEEDS PRE-COMMIT |
| 5 | TypeScript Compilation | ⚠️ | ❌ Missing | ✅ Blocks PR | NEEDS PRE-COMMIT |
| 6 | Linting (<50 violations) | ⚠️ | ❌ Missing | ✅ Blocks PR | NEEDS PRE-COMMIT |
| 7 | Coordination Messages | ⚠️ | ⚠️ Warning only | ❌ Missing | NEEDS BLOCKING UPGRADE |
| 8 | TestID Coverage | ❌ | ❌ Missing | ❌ Missing | NEEDS IMPLEMENTATION |
| 9 | Input Validation | ❌ | ❌ Missing | ❌ Missing | NEEDS IMPLEMENTATION |
| 10 | Offline-First Architecture | ❌ | ❌ Missing | ❌ Missing | NEEDS IMPLEMENTATION |
| 11 | Bundle Size Regression | ❌ | ❌ Missing | ❌ Missing | NEEDS IMPLEMENTATION |
| 12 | Security Vulnerability Scan | ❌ | ❌ Missing | ❌ Missing | NEEDS IMPLEMENTATION (`npm audit` exists) |
| 13 | Performance Regression | ❌ | ❌ Missing | ❌ Missing | NEEDS IMPLEMENTATION |

**Summary**:
- **Fully Blocking**: 1 (Type drift at both layers)
- **Partial Blocking**: 6 (GitHub Actions only, missing pre-commit)
- **Not Implemented**: 6 (Need tooling, scripts, and enforcement)

**Priority Order for Full Blocking Status**:
1. **Week 1**: Gates 2, 4, 5, 6 (add to pre-commit hook)
2. **Week 2**: Gate 7 (upgrade to blocking)
3. **Week 3**: Gates 8, 9, 10 (implement tooling)
4. **Week 4**: Gates 11, 12, 13 (implement benchmarking)

### 4.2 Phase 1 Priority (Week 1)

**Goal**: Move 5 partial gates to pre-commit hook

**Deliverables**:
1. **scripts/quality-gates/check-type-system-size.sh**:
   ```bash
   #!/bin/bash
   FILE="src/types/supabase.ts"
   MIN_SIZE=51200  # 50KB

   if [ ! -s "$FILE" ]; then
     echo "❌ ERROR: Type system is empty"
     exit 1
   fi

   SIZE=$(wc -c < "$FILE")
   if [ "$SIZE" -lt "$MIN_SIZE" ]; then
     echo "❌ ERROR: Type system too small ($SIZE bytes, expected >$MIN_SIZE)"
     exit 1
   fi

   echo "✅ Type system size OK ($SIZE bytes)"
   exit 0
   ```

2. **scripts/quality-gates/check-console-logs.sh**:
   ```bash
   #!/bin/bash
   COUNT=$(grep -r 'console\.log' src/ \
     --exclude-dir=__tests__ \
     --exclude=logger.ts \
     | wc -l)

   if [ "$COUNT" -gt 0 ]; then
     echo "❌ ERROR: Found $COUNT console.log statements"
     grep -rn 'console\.log' src/ \
       --exclude-dir=__tests__ \
       --exclude=logger.ts
     exit 1
   fi

   echo "✅ No console.log statements found"
   exit 0
   ```

3. **scripts/quality-gates/check-test-coverage.sh**:
   ```bash
   #!/bin/bash
   npm test -- --coverage --changedSince=HEAD --silent || {
     echo "❌ ERROR: Test coverage <80% or tests failing"
     exit 1
   }

   echo "✅ Test coverage OK"
   exit 0
   ```

4. **scripts/quality-gates/check-typescript.sh**:
   ```bash
   #!/bin/bash
   npm run type-check || {
     echo "❌ ERROR: TypeScript compilation failed"
     exit 1
   }

   echo "✅ TypeScript compilation OK"
   exit 0
   ```

5. **scripts/quality-gates/check-linting.sh**:
   ```bash
   #!/bin/bash
   ERRORS=$(npm run lint --silent 2>&1 | grep -c "error")

   if [ "$ERRORS" -gt 50 ]; then
     echo "❌ ERROR: $ERRORS linting violations (threshold: 50)"
     exit 1
   fi

   echo "✅ Linting OK ($ERRORS violations)"
   exit 0
   ```

6. **Enhanced .git/hooks/pre-commit**:
   ```bash
   #!/bin/bash

   # Existing: Type drift validation
   npm run types:check-local || exit 1

   # NEW: Type system size check
   scripts/quality-gates/check-type-system-size.sh || exit 1

   # NEW: Console.log check
   scripts/quality-gates/check-console-logs.sh || exit 1

   # NEW: Test coverage check
   scripts/quality-gates/check-test-coverage.sh || exit 1

   # NEW: TypeScript compilation check
   scripts/quality-gates/check-typescript.sh || exit 1

   # NEW: Linting check
   scripts/quality-gates/check-linting.sh || exit 1

   # Existing: Coordination messages warning
   # (non-blocking)

   echo "✅ All pre-commit checks passed"
   exit 0
   ```

**Testing Strategy**:
1. Test each script individually
2. Test pre-commit hook with failing conditions
3. Test pre-commit hook with passing conditions
4. Measure execution time (<30s target)
5. Validate developer experience (clear error messages)

### 4.3 Phase 2 Priority (Weeks 2-3)

**Goal**: Implement remaining 6 gates

**Deliverables**:
1. **scripts/quality-gates/check-testid-coverage.sh**:
   - Parse component files for interactive elements
   - Validate all have testID props
   - Report missing testIDs with file/line numbers

2. **scripts/quality-gates/check-input-validation.sh**:
   - Parse forms for user inputs
   - Validate all have Yup/zod schemas
   - Report missing validation

3. **scripts/quality-gates/check-offline-first.sh**:
   - Parse new API endpoints
   - Validate use of OfflineService
   - Report direct Supabase calls

4. **scripts/quality-gates/check-bundle-size.sh**:
   - Compare current bundle size to baseline (12.27 MB)
   - Fail if >10% increase without justification
   - Report bundle composition changes

5. **scripts/quality-gates/check-security.sh**:
   - Run `npm audit` (fail on high/critical)
   - Check for hardcoded secrets (API keys, passwords)
   - Validate .env.local not committed

6. **scripts/quality-gates/check-performance.sh**:
   - Run performance benchmarks
   - Compare to baseline (TBD)
   - Fail if regression >20%

**Integration**:
- Add all 6 to pre-commit hook
- Add all 6 to GitHub Actions workflow
- Create ww-aadf-mobile-quality-gate-enforcer agent to orchestrate

---

## Section 5: Offline-First Migration (Per-Service Detail)

### 5.1 Current Coverage Analysis

**Fully Offline-First** (10%):
- ✅ **ProjectService** (src/services/ProjectService.ts):
  - Local SQLite reads via DatabaseService
  - Background sync via OfflineService
  - Queue-based operations
  - Conflict detection foundation
  - **Pattern**: Read local → Return immediately → Background sync

**Direct Supabase** (90%):
- ❌ **deploymentsApi** (src/redux/api/deployments/index.ts): 5 endpoints (GET, GET:id, POST, PUT, DELETE)
- ❌ **auth** (src/redux/api/auth/index.ts): Login, logout, register, session management
- ❌ **devices** (src/redux/api/devices/index.ts): Device CRUD, BLE status sync
- ❌ **media** (src/redux/api/media/index.ts): Photo/video uploads, S3 integration
- ❌ **observations** (src/redux/api/observations/index.ts): Wildlife observations CRUD
- ❌ **sensorRecords** (src/redux/api/sensorRecords/index.ts): Sensor data bulk upload
- ❌ **users** (src/redux/api/users/index.ts): User profile management
- ❌ **ProjectMemberService** (src/services/ProjectMemberService.ts): Member management
- ❌ **DfuService** (src/services/DfuService.ts): Firmware updates over BLE
- ❌ **auth.ts** (src/services/auth.ts): Direct Supabase auth calls

### 5.2 Migration Strategy by Service

#### P0: deploymentsApi (Week 5)

**Current Implementation** (src/redux/api/deployments/index.ts):
```typescript
getDeployments: builder.query<Deployment[], void>({
  query: () => ({
    url: API_URLS.DEPLOYMENTS,
    method: HttpMethod.GET,
  }),
  transformResponse: (response: ApiResponse<Deployment[]>) => response.data,
  // ...
})
```

**Target Implementation**:
```typescript
// NEW: DatabaseService methods
class DatabaseService {
  // Add to existing class
  async getDeployments(organisationId: string): Promise<DatabaseDeployment[]> {
    // SQLite query: SELECT * FROM deployments WHERE organisation_id = ?
  }

  async saveDeployment(deployment: DatabaseDeployment): Promise<void> {
    // SQLite: INSERT OR REPLACE INTO deployments
  }
}

// NEW: OfflineService queue operations
class OfflineService {
  async queueDeploymentCreate(deployment: DeploymentCreate): Promise<void> {
    // Add to offline_operations queue
  }

  async syncDeployments(organisationId: string): Promise<void> {
    // Background sync: SQLite ↔ Supabase
  }
}

// UPDATED: RTK Query endpoint
getDeployments: builder.query<Deployment[], void>({
  queryFn: async (arg, api, extraOptions, baseQuery) => {
    const state = api.getState() as RootState
    const organisationId = state.authentication.currentOrganisation?.id

    if (!organisationId) {
      return { error: { status: 401, data: 'No organisation' } }
    }

    // 1. Read from local SQLite
    const databaseService = new DatabaseService()
    await databaseService.initializeDatabase()
    const localDeployments = await databaseService.getDeployments(organisationId)

    // 2. Trigger background sync (non-blocking)
    const offlineService = new OfflineService()
    await offlineService.initialize()
    offlineService.syncDeployments(organisationId).catch(console.warn)

    // 3. Return local data immediately
    return { data: localDeployments.map(mapDatabaseToDeployment) }
  },
  // ...
})
```

**SQLite Schema** (add to DatabaseService):
```sql
CREATE TABLE IF NOT EXISTS deployments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  organisation_id TEXT NOT NULL,
  camera_id TEXT,
  deployment_number INTEGER,
  deployment_status TEXT,
  start_date TEXT,
  end_date TEXT,
  location_name TEXT,
  latitude REAL,
  longitude REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_deployments_organisation
  ON deployments(organisation_id);
CREATE INDEX IF NOT EXISTS idx_deployments_project
  ON deployments(project_id);
```

**Testing Strategy**:
1. Integration test: Create deployment offline → Verify SQLite → Go online → Verify sync
2. Integration test: Concurrent edits → Verify conflict detection
3. Integration test: Network failure during sync → Verify retry logic
4. Performance test: 1000 deployments → Measure read speed (<1s target)

**Success Criteria**:
- ✅ Deployments readable offline
- ✅ Background sync working (when online)
- ✅ Conflict resolution functional
- ✅ Integration tests passing (real Supabase)

#### P0: auth (Week 5)

**Challenge**: Authentication inherently requires network

**Strategy**: Offline session caching + credential storage

**Implementation**:
```typescript
// NEW: DatabaseService methods
async getCachedSession(): Promise<Session | null> {
  // SQLite: SELECT * FROM auth_sessions WHERE expires_at > NOW()
}

async cacheSession(session: Session): Promise<void> {
  // SQLite: INSERT OR REPLACE INTO auth_sessions
}

// NEW: Offline auth service
class OfflineAuthService {
  async login(email: string, password: string): Promise<Session> {
    // 1. Check if online
    if (isOnline) {
      const session = await supabase.auth.signInWithPassword({ email, password })
      await databaseService.cacheSession(session)
      return session
    }

    // 2. Offline: Check cached session
    const cachedSession = await databaseService.getCachedSession()
    if (cachedSession) {
      return cachedSession
    }

    throw new Error('Cannot authenticate offline without cached session')
  }

  async validateCachedSession(): Promise<boolean> {
    const session = await databaseService.getCachedSession()
    return session && session.expires_at > Date.now()
  }
}
```

**Security Considerations**:
- Use SecureStore for session tokens (encrypted storage)
- Session expiry enforcement (max 7 days offline)
- Automatic re-authentication when online
- Credential validation against backend on first online opportunity

**Testing Strategy**:
1. Integration test: Login online → Go offline → Validate cached session works
2. Integration test: Cached session expired → Require re-authentication
3. Security test: Token storage encrypted (SecureStore validation)
4. Integration test: Come online after offline → Session refresh

#### P0: devices (Week 6)

**Current Implementation** (src/redux/api/devices/index.ts): Direct Supabase calls

**Target Implementation**: Offline-first with BLE device sync

**Challenge**: BLE device status changes frequently (battery, signal strength)

**Strategy**:
- Device metadata: Offline-first SQLite storage
- Real-time BLE status: In-memory Redux state (not persisted)
- Background sync: Periodic upload of BLE status logs

**Implementation**:
```typescript
// NEW: DatabaseService methods
async getDevices(organisationId: string): Promise<DatabaseDevice[]> {
  // SQLite: SELECT * FROM devices WHERE organisation_id = ?
}

async saveDevice(device: DatabaseDevice): Promise<void> {
  // SQLite: INSERT OR REPLACE INTO devices
}

async saveBLEStatusLog(log: BLEStatusLog): Promise<void> {
  // SQLite: INSERT INTO ble_status_logs
  // Batched upload on sync
}

// NEW: BLE sync service
class BLEOfflineService {
  async syncDeviceMetadata(organisationId: string): Promise<void> {
    // Background sync: Device CRUD (name, serial, firmware)
  }

  async uploadBLEStatusLogs(): Promise<void> {
    // Background sync: Upload accumulated BLE status logs
  }
}
```

**SQLite Schema**:
```sql
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL,
  device_serial TEXT UNIQUE NOT NULL,
  device_name TEXT,
  firmware_version TEXT,
  hardware_revision TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ble_status_logs (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  battery_level INTEGER,
  signal_strength INTEGER,
  connection_status TEXT,
  timestamp TEXT NOT NULL,
  synced BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE INDEX IF NOT EXISTS idx_ble_logs_device
  ON ble_status_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_ble_logs_synced
  ON ble_status_logs(synced);
```

**Testing Strategy**:
1. Integration test: BLE device connect → Status logs created → Verify SQLite
2. Integration test: Go online → Verify status logs uploaded
3. Performance test: 100 devices × 10 status updates/min → Verify no lag
4. BLE test: Device disconnect/reconnect → Verify state recovery

### 5.3 Migration Rollout Schedule

**Week 5**:
- deploymentsApi (5 endpoints): SQLite schema, offline reads, background sync
- auth (session caching): SecureStore integration, cached session validation
- Integration tests for both

**Week 6**:
- devices (BLE integration): Metadata offline, status log batching
- Integration tests with real BLE devices

**Week 7**:
- media (photo/video storage): Local file storage, S3 sync queue
- observations (wildlife data): Offline CRUD with photo references

**Week 8**:
- sensorRecords (bulk data): Batched uploads, compression
- Integration tests for P1 APIs

**Week 9**:
- users (profile management): Profile caching, background refresh
- ProjectMemberService: Member list caching, RBAC validation

**Week 10**:
- DfuService (firmware updates): Firmware download queue, BLE DFU offline
- Final integration tests across all services

**Week 11** (Pilot):
- Internal team testing (5 users)
- Real-world usage scenarios
- Bug fixes and performance tuning

**Week 12** (Production):
- Stakeholder preview build (20 users)
- Full production rollout (all users)
- Monitoring and support

### 5.4 Testing Requirements per Service

**Integration Test Template** (tests/integration/offline/[service].test.ts):
```typescript
describe('[Service] Offline-First Integration', () => {
  beforeAll(async () => {
    // Initialize real Supabase (scripts/test-integration-local.sh)
    await setupTestSupabase()
  })

  it('should read from local database when offline', async () => {
    // 1. Seed data in Supabase
    // 2. Sync to local SQLite
    // 3. Go offline (mock network)
    // 4. Read data via API
    // 5. Verify returned from SQLite (not Supabase)
  })

  it('should queue operations when offline', async () => {
    // 1. Go offline
    // 2. Create/update/delete via API
    // 3. Verify in SQLite offline_operations queue
    // 4. Verify NOT in Supabase yet
  })

  it('should sync queued operations when online', async () => {
    // 1. Offline operations queued (from previous test)
    // 2. Go online
    // 3. Wait for background sync
    // 4. Verify operations in Supabase
    // 5. Verify queue cleared
  })

  it('should detect conflicts on concurrent edits', async () => {
    // 1. Record synced to both SQLite and Supabase
    // 2. Edit in Supabase (simulate another user)
    // 3. Edit in SQLite (offline)
    // 4. Go online, trigger sync
    // 5. Verify conflict detected
    // 6. Verify conflict resolution (last-write-wins or manual)
  })

  it('should maintain data integrity on round-trip', async () => {
    // 1. Create data in SQLite
    // 2. Sync to Supabase
    // 3. Clear SQLite
    // 4. Sync from Supabase
    // 5. Verify data identical (including UUIDs, timestamps)
  })
})
```

**Performance Benchmarks**:
- Local reads: <1 second for 1000 records
- Background sync: <5 seconds for 100 operations
- Conflict detection: <2 seconds for 10 concurrent edits
- Battery impact: <5% drain per hour of active sync

---

## Section 6: Agent Specifications

**CRITICAL CONTEXT REQUIREMENTS (2025-11-09)**:

ALL agents must check BOTH context sources before implementation:

1. **Codebase Context** (Architecture Patterns):
   - App.tsx layers (Safe Area → Suspense → Redux → Paper → Navigation → BLE → Auth)
   - Redux store setup (4 RTK Query APIs, 15 slices, listener middleware, serializable exceptions)
   - Offline-first patterns (SQLite-backed queue, OfflineService coordination)
   - ProjectService as template (local-first reads, queued writes, background sync)
   - BLE custom engine (command scheduling, function queue, NOT standard BLE service)
   - Implementation references (actual file paths with line numbers)

2. **Context7 Documentation** (Vendor Best Practices):
   - React Native official patterns (hooks, navigation, platform APIs)
   - Expo SDK 51 best practices (updates, builds, native modules)
   - Redux Toolkit + RTK Query vendor docs (createApi, queryFn, listener middleware)
   - Supabase integration guides (auth, realtime, storage, RLS)
   - SQLite offline-first patterns (WAL mode, transactions, migrations)

**Validation Pattern**: Agents must validate implementation against BOTH sources (not just Context7).

**Example**:
```
User: Implement offline-first deployments API

Agent Must:
1. Read ProjectService.ts (lines 1-900) for codebase pattern
2. Fetch Context7 docs for RTK Query queryFn pattern
3. Validate SQLite schema against ProjectService pattern
4. Validate RTK Query setup against vendor docs
5. Test against REAL Supabase (no mocks)
```

### 6.1 ww-aadf-mobile-offline-architect

**Location**: .claude/agents/specialized/mobile/ww-aadf-mobile-offline-architect.md

**Role**: Design and validate offline-first architecture for new features

**Input Requirements**:
1. Feature specification (user story, acceptance criteria)
2. API requirements (endpoints, data models)
3. Offline constraints (storage limits, sync frequency)
4. Performance targets (read latency, sync speed)

**Context Sources** (MANDATORY):
- **Codebase**: ProjectService.ts (template), OfflineService.ts (queue), DatabaseService.ts (SQLite)
- **Context7**: RTK Query docs, SQLite offline-first patterns, Supabase integration guides

**Output Format**:
```markdown
# Offline-First Architecture: [Feature Name]

## 1. SQLite Schema
```sql
CREATE TABLE IF NOT EXISTS [table_name] (
  -- Schema definition
);
```

## 2. Sync Strategy
- **Read Pattern**: Local-first, background sync
- **Write Pattern**: Queue-based with retry logic
- **Conflict Resolution**: [Strategy]

## 3. Implementation Checklist
- [ ] DatabaseService methods
- [ ] OfflineService queue operations
- [ ] RTK Query queryFn update
- [ ] Integration tests

## 4. Performance Analysis
- Estimated storage: [X KB per record]
- Sync frequency: [Every X minutes]
- Expected latency: [<X seconds]

## 5. Risks & Mitigations
- [Risk 1]: [Mitigation]
```

**File References**:
- Pattern: src/services/ProjectService.ts (lines 1-100)
- Queue: src/services/offline/OfflineService.ts (lines 1-100)
- Database: src/services/offline/DatabaseService.ts

**Example Workflow**:
```
User: Design offline-first architecture for wildlife observations with photos

Agent:
1. Analyze observations data model (src/types/api.types.ts)
2. Review photo storage patterns (src/redux/api/media/index.ts)
3. Design SQLite schema (observations + local_photos)
4. Define sync strategy (photos upload first, then metadata)
5. Identify conflicts (concurrent photo edits)
6. Estimate storage (50KB per photo thumbnail, 5MB per full photo)
7. Output architecture document
```

**Integration with Other Agents**:
- Calls ww-aadf-mobile-testing-coordinator to generate integration tests
- Calls ww-aadf-mobile-performance-optimizer to validate storage/sync performance

### 6.2 ww-aadf-mobile-ble-specialist

**Location**: .claude/agents/specialized/mobile/ww-aadf-mobile-ble-specialist.md

**Role**: BLE integration, command scheduling, device communication

**Input Requirements**:
1. BLE requirements (device type, services, characteristics)
2. Device firmware specs (command protocol, response format)
3. Communication constraints (packet size, timing, reliability)

**Output Format**:
```markdown
# BLE Integration: [Device Type]

## 1. BLE Service Configuration
```typescript
export const BLE_SERVICES = {
  [SERVICE_NAME]: {
    uuid: '[UUID]',
    characteristics: {
      [CHAR_NAME]: '[UUID]',
    }
  }
};
```

## 2. Command Parser Updates
```typescript
// src/ble/parser.ts additions
export function construct[Command]Command(
  options: [CommandOptions]
): string {
  // Command construction logic
}
```

## 3. BLE Hook Integration
```typescript
// src/hooks/useBle.ts integration
export const useBle = (): ReturnType => {
  // New command scheduling
  const [command]Engine = useCallback(() => {
    // Command execution logic
  }, []);
};
```

## 4. Testing Strategy
- BLE device required: [Yes/No]
- Mock strategy: [Approach]
- Integration tests: [Scenarios]
```

**File References**:
- Engine pattern: src/hooks/useBle.ts (lines 1-80)
- Command parser: src/ble/parser.ts
- BLE types: src/ble/types.ts

**Example Workflow**:
```
User: Add BLE command for camera firmware update (DFU)

Agent:
1. Review DFU service UUID spec (Nordic DFU protocol)
2. Design command sequence (START → UPLOAD → VALIDATE → ACTIVATE)
3. Update src/ble/types.ts with DFU command types
4. Update src/ble/parser.ts with DFU command construction
5. Integrate into useBle.ts engine (pause engine during DFU)
6. Create integration test with mock BLE device
7. Output implementation patches
```

**Integration with Other Agents**:
- Calls ww-aadf-mobile-testing-coordinator for BLE device testing strategy
- Calls ww-aadf-mobile-offline-architect for DFU queue (offline firmware downloads)

### 6.3 ww-aadf-mobile-performance-optimizer

**Location**: .claude/agents/specialized/mobile/ww-aadf-mobile-performance-optimizer.md

**Role**: Bundle size, render performance, battery optimization

**Input Requirements**:
1. Performance baseline (bundle size, render time, battery usage)
2. Target metrics (optimization goals)
3. Changed files (for impact analysis)

**Output Format**:
```markdown
# Performance Optimization: [Feature/Issue]

## 1. Current Baseline
- Bundle size: [X MB]
- Render time: [X ms]
- Battery usage: [X %/hour]

## 2. Identified Issues
- [Issue 1]: [Impact] - [Root cause]
- [Issue 2]: [Impact] - [Root cause]

## 3. Optimization Plan
### Bundle Size
- [ ] Remove unused dependencies: [List]
- [ ] Code splitting: [Modules]
- [ ] Tree shaking: [Libraries]

### Render Performance
- [ ] Memoization: [Components]
- [ ] Lazy loading: [Screens]
- [ ] FlatList optimization: [Lists]

### Battery Optimization
- [ ] Reduce sync frequency: [From X to Y]
- [ ] Background task optimization: [Tasks]
- [ ] BLE connection pooling: [Approach]

## 4. Implementation Patches
```typescript
// Example: Memoize expensive component
const MemoizedComponent = React.memo(Component, (prev, next) => {
  // Custom comparison logic
});
```

## 5. Performance Testing
- [ ] Bundle analysis: npx react-native-bundle-visualizer
- [ ] Render profiling: React DevTools Profiler
- [ ] Battery testing: 24-hour device test
```

**File References**:
- Bundle baseline: 12.27 MB (from Stack-Best-Practices-Research-2024.md)
- Render patterns: src/App.tsx, src/navigation/index.tsx
- Background tasks: src/redux/middleware/offlineSyncMiddleware.ts

**Example Workflow**:
```
User: Optimize deployment list rendering (500+ deployments)

Agent:
1. Analyze current implementation (src/screens/DeploymentsScreen.tsx)
2. Identify issues: No memoization, no pagination, no virtualization
3. Benchmark current: 2.5s render time for 500 items
4. Propose optimizations:
   - FlatList with getItemLayout (O(1) vs O(n))
   - React.memo for deployment list item
   - Pagination (50 items per page)
5. Implement patches
6. Benchmark optimized: 0.3s render time (8x improvement)
7. Output optimization report
```

**Integration with Other Agents**:
- Calls ww-aadf-mobile-testing-coordinator for performance benchmarking tests
- Calls ww-aadf-mobile-code-reviewer to validate optimization quality

### 6.4 ww-aadf-mobile-testing-coordinator

**Location**: .claude/agents/specialized/mobile/ww-aadf-mobile-testing-coordinator.md

**Role**: Orchestrate Jest, Maestro, Detox testing strategy

**Input Requirements**:
1. Feature implementation (code changes)
2. Acceptance criteria (from user story)
3. Testing constraints (real devices available, offline mode required)

**Output Format**:
```markdown
# Testing Strategy: [Feature Name]

## 1. Unit Tests (Jest)
### src/services/[Feature]Service.test.ts
```typescript
describe('[Feature]Service', () => {
  it('should [behavior]', async () => {
    // Test implementation
  });
});
```

## 2. Integration Tests (Jest + Real Supabase)
### tests/integration/[feature].test.ts
```typescript
describe('[Feature] Integration', () => {
  beforeAll(async () => {
    await setupTestSupabase()
  });

  it('should [scenario]', async () => {
    // Integration test implementation
  });
});
```

## 3. E2E Tests (Maestro)
### tests/maestro/flows/[feature].yaml
```yaml
appId: com.wildlifeai.wildlifewatcher
---
- launchApp
- tapOn: "Login"
- inputText: "test@example.com"
- tapOn: "Submit"
- assertVisible: "Welcome"
```

## 4. Coverage Analysis
- Unit: [X%] (target: 80%+)
- Integration: [Y%] (target: 70%+)
- E2E: [Z scenarios] (critical paths)

## 5. Testing Checklist
- [ ] Unit tests passing
- [ ] Integration tests passing (real Supabase)
- [ ] E2E tests passing (Maestro)
- [ ] Offline scenarios covered
- [ ] Performance benchmarks run
```

**File References**:
- BDD helpers: tests/setup/helpers/bdd.ts
- Integration setup: tests/setup/supabase-test-client.ts
- Integration script: scripts/test-integration-local.sh
- Maestro flows: tests/maestro/

**Example Workflow**:
```
User: Create test suite for offline-first deployments API

Agent:
1. Generate unit tests:
   - DatabaseService.getDeployments()
   - OfflineService.queueDeploymentCreate()
2. Generate integration tests:
   - Offline scenario: Create deployment → Verify queue → Go online → Verify sync
   - Conflict scenario: Concurrent edits → Verify conflict detection
3. Generate Maestro E2E test:
   - Login → Navigate to deployments → Create deployment (offline) → Verify success
4. Run tests: npm test && scripts/test-integration-local.sh
5. Generate coverage report
6. Output test suite
```

**Integration with Other Agents**:
- Called by ww-aadf-mobile-offline-architect for offline-first test generation
- Called by ww-aadf-mobile-ble-specialist for BLE device test strategy
- Calls ww-aadf-mobile-quality-gate-enforcer to validate test coverage

### 6.5 ww-aadf-mobile-type-sync-guardian

**Location**: .claude/agents/specialized/mobile/ww-aadf-mobile-type-sync-guardian.md

**Role**: Validate type synchronization across environments

**Input Requirements**:
1. Backend schema change notification (from coordination inbox)
2. Target environment (local, cloud-dev, cloud-prod)
3. Current type file state (src/types/supabase.ts)

**Output Format**:
```markdown
# Type Synchronization Report

## 1. Schema Change Detection
- **Backend Changes**: [Summary of schema changes]
- **Impact**: [Tables/columns affected]
- **Breaking Changes**: [Yes/No]

## 2. Type Regeneration Command
```bash
npm run types:[environment]
```

## 3. Validation Results
- **Type Size**: [X KB] (expected: >50KB)
- **Type Count**: [Y types] (previous: Z types, delta: +N)
- **Breaking Changes**: [List]

## 4. TypeScript Compilation
```bash
npm run type-check
```
- **Errors**: [Count] (target: 0)
- **Affected Files**: [List]

## 5. Action Items
- [ ] Review breaking changes
- [ ] Update API calls if needed
- [ ] Run integration tests
- [ ] Commit type changes
```

**File References**:
- Type scripts: scripts/check-types-local.sh, scripts/check-types-cloud-dev.sh
- Type file: src/types/supabase.ts
- Pre-commit hook: .git/hooks/pre-commit
- GitHub Actions: .github/workflows/type-validation.yml

**Example Workflow**:
```
User: Backend added 'ai_model_id' column to deployments table

Agent:
1. Check coordination inbox for backend message
2. Read backend schema change summary
3. Determine environment (local for development)
4. Run type regeneration: npm run types:local
5. Analyze diff: src/types/supabase.ts
6. Detect breaking changes: deployments table updated
7. Validate TypeScript compilation: npm run type-check
8. Report affected files: src/redux/api/deployments/index.ts
9. Generate action items: Update createDeployment mutation
10. Output synchronization report
```

**Integration with Other Agents**:
- Monitors coordination inbox (cross-project messages)
- Calls ww-aadf-mobile-code-reviewer to validate type changes impact
- Integrates with ww-aadf-mobile-quality-gate-enforcer for type validation gate

### 6.6 ww-aadf-mobile-environment-manager

**Location**: .claude/agents/specialized/mobile/ww-aadf-mobile-environment-manager.md

**Role**: Manage local/cloud-dev/cloud-prod environment switching

**Input Requirements**:
1. Target environment (local, cloud-dev, cloud-prod)
2. Build profile (development, preview, production)
3. Current environment state (src/config/EnvironmentManager.ts)

**Output Format**:
```markdown
# Environment Switch: [From] → [To]

## 1. Pre-Switch Validation
- [ ] Types synchronized with target environment
- [ ] Local Supabase running (if target = local)
- [ ] Supabase CLI authenticated (if target = cloud)
- [ ] Environment variables configured

## 2. Type Synchronization
```bash
npm run types:check-[environment]
# If out of sync:
npm run types:[environment]
```

## 3. Environment Configuration
- **Supabase URL**: [URL]
- **Anon Key**: [Key (safe to commit for dev/cloud-dev)]
- **Build Profile**: [Profile]
- **Runtime Switching**: [Enabled/Disabled]

## 4. Testing Validation
```bash
npm run validate:[environment]
```
- TypeScript: [Pass/Fail]
- Tests: [Pass/Fail]
- Integration: [Pass/Fail]

## 5. Switch Instructions
### Development Build (Runtime Switching)
1. Launch app
2. Settings → Developer Settings
3. Select "[Environment]"
4. Tap "Apply & Restart"

### Production Build (Fixed Environment)
```bash
# Cloud-dev
eas build --profile preview

# Cloud-prod
eas build --profile production
```

## 6. Verification Checklist
- [ ] Types match target environment
- [ ] API calls reaching correct Supabase
- [ ] Authentication working
- [ ] Data syncing correctly
```

**File References**:
- Environments: src/config/environments.ts
- Manager: src/config/EnvironmentManager.ts
- Supabase client: src/services/supabase.ts
- Developer settings: src/screens/DeveloperSettingsScreen.tsx
- Type scripts: scripts/check-types-*.sh, scripts/validate-*.sh

**Example Workflow**:
```
User: Switch to cloud-dev for preview build testing

Agent:
1. Validate current environment: local
2. Check type synchronization: npm run types:check-cloud-dev
3. Detect out of sync: types last regenerated from local
4. Regenerate types: npm run types:cloud-dev
5. Run validation: npm run validate:cloud-dev
6. Detect failures: 5 TypeScript errors (API endpoint references)
7. Report issues: Update API_URLS to use cloud-dev endpoints
8. Wait for fixes
9. Re-validate: All checks pass
10. Output switch instructions (runtime switching via dev settings)
```

**Integration with Other Agents**:
- Calls ww-aadf-mobile-type-sync-guardian for type validation
- Calls ww-aadf-mobile-quality-gate-enforcer for pre-switch validation
- Called by ww-aadf-mobile-testing-coordinator for environment-specific testing

### 6.7 ww-aadf-mobile-quality-gate-enforcer

**Location**: .claude/agents/specialized/mobile/ww-aadf-mobile-quality-gate-enforcer.md

**Role**: Run all 13 quality gates before task completion

**Input Requirements**:
1. Changed files (from git diff)
2. Task specification (acceptance criteria)
3. Test results (Jest, Maestro coverage)

**Output Format**:
```markdown
# Quality Gate Report: [Task ID]

## 1. Quality Gates (13 Total)

| # | Gate | Status | Details |
|---|------|--------|---------|
| 1 | Type Drift Validation | ✅/❌ | [Details] |
| 2 | Type System Size Check | ✅/❌ | [Details] |
| 3 | Console.log Pollution | ✅/❌ | [Details] |
| 4 | Test Coverage (80%+) | ✅/❌ | [Details] |
| 5 | TypeScript Compilation | ✅/❌ | [Details] |
| 6 | Linting (<50 violations) | ✅/❌ | [Details] |
| 7 | Coordination Messages | ✅/❌ | [Details] |
| 8 | TestID Coverage | ✅/❌ | [Details] |
| 9 | Input Validation | ✅/❌ | [Details] |
| 10 | Offline-First Architecture | ✅/❌ | [Details] |
| 11 | Bundle Size Regression | ✅/❌ | [Details] |
| 12 | Security Vulnerability Scan | ✅/❌ | [Details] |
| 13 | Performance Regression | ✅/❌ | [Details] |

## 2. Quality Score: [X/10]
- **Gates Passed**: [N/13]
- **Critical Failures**: [Count]
- **Warnings**: [Count]

## 3. Production Readiness: [X%]
- **Functionality**: [Y%]
- **Quality**: [Z%]
- **Testing**: [W%]

## 4. Blockers
- [ ] [Blocker 1]
- [ ] [Blocker 2]

## 5. Action Items
- [ ] [Action 1]
- [ ] [Action 2]

## 6. Approval
- [ ] All critical gates passed
- [ ] Quality score ≥ 8/10
- [ ] Production readiness ≥ 80%
```

**File References**:
- Quality scripts: scripts/quality-gates/ (8 scripts)
- Pre-commit hook: .git/hooks/pre-commit
- GitHub Actions: .github/workflows/quality-gate-validation.yml
- CLAUDE.md quality standards section

**Example Workflow**:
```
User: Validate Task 8 (AI model selection) before marking complete

Agent:
1. Run all 13 quality gates:
   - Gate 1 (Type drift): ✅ Pass
   - Gate 2 (Type size): ✅ Pass (52KB)
   - Gate 3 (Console.log): ❌ FAIL (3 console.log in ProjectForm.tsx)
   - Gate 4 (Test coverage): ⚠️ WARNING (75%, target 80%)
   - Gate 5 (TypeScript): ✅ Pass (0 errors)
   - Gate 6 (Linting): ✅ Pass (12 violations)
   - Gate 7 (Coordination): ✅ Pass (no unread messages)
   - Gate 8 (TestID): ❌ FAIL (AI model selector missing testID)
   - Gate 9 (Input validation): ✅ Pass
   - Gate 10 (Offline-first): ✅ Pass (uses ProjectService)
   - Gate 11 (Bundle size): ✅ Pass (12.29 MB, +20KB)
   - Gate 12 (Security): ✅ Pass (0 vulnerabilities)
   - Gate 13 (Performance): ✅ Pass (no regression)

2. Calculate quality score: 10/13 gates passed = 7.7/10
3. Calculate production readiness: 70%
4. Identify blockers:
   - Console.log pollution (critical)
   - Missing testID (critical)
   - Test coverage <80% (warning)
5. Generate action items:
   - Replace 3 console.log with logger.debug
   - Add testID to AI model selector
   - Add 2 unit tests to reach 80% coverage
6. Output quality gate report
7. Block task completion until blockers resolved
```

**Integration with Other Agents**:
- Called by all other agents before task completion
- Calls ww-aadf-mobile-testing-coordinator to validate test coverage
- Calls ww-aadf-mobile-performance-optimizer to validate performance
- Integrates with ww-aadf-mobile-code-reviewer for comprehensive review

### 6.8 ww-aadf-mobile-code-reviewer

**Location**: .claude/agents/specialized/mobile/ww-aadf-mobile-code-reviewer.md

**Role**: Post-implementation comprehensive review

**Input Requirements**:
1. Task implementation (all changed files)
2. Test coverage report (Jest, Maestro)
3. Quality gate results (from ww-aadf-mobile-quality-gate-enforcer)

**Output Format**:
```markdown
# Code Review Report: [Task ID]

## 1. Executive Summary
- **Quality Score**: [X/10]
- **Production Readiness**: [Y%]
- **Recommendation**: [APPROVE/REVISE/REJECT]

## 2. Architecture Review
### Strengths
- [Strength 1]
- [Strength 2]

### Concerns
- [Concern 1] (Severity: [LOW/MEDIUM/HIGH/CRITICAL])
- [Concern 2] (Severity: [LOW/MEDIUM/HIGH/CRITICAL])

## 3. Code Quality
### Best Practices Adherence
- ✅ Offline-first architecture
- ✅ Type safety
- ❌ [Violation 1]

### Maintainability
- Complexity: [LOW/MEDIUM/HIGH]
- Documentation: [ADEQUATE/INSUFFICIENT]
- Testability: [GOOD/FAIR/POOR]

## 4. Testing Assessment
- **Unit Tests**: [X/Y scenarios covered] ([Z%])
- **Integration Tests**: [A/B scenarios covered] ([C%])
- **E2E Tests**: [D critical paths covered]
- **Coverage**: [Overall %]

## 5. Performance Analysis
- Bundle size impact: [+X KB]
- Render performance: [No regression/Regression detected]
- Battery impact: [Acceptable/Concerning]

## 6. Security Review
- Credential handling: [SECURE/VULNERABLE]
- Input validation: [ADEQUATE/INSUFFICIENT]
- RLS enforcement: [CORRECT/MISSING]

## 7. Action Items
### Critical (Must Fix)
- [ ] [Critical issue 1]

### High Priority (Should Fix)
- [ ] [High priority issue 1]

### Low Priority (Nice to Have)
- [ ] [Low priority issue 1]

## 8. Approval Criteria
- [ ] Quality score ≥ 8/10
- [ ] Production readiness ≥ 80%
- [ ] Zero critical issues
- [ ] Test coverage ≥ 80%

## 9. Final Verdict
[APPROVE/REVISE/REJECT]

**Reasoning**: [Detailed explanation]
```

**File References**:
- All source files in task implementation
- Test files (unit, integration, E2E)
- Quality standards: CLAUDE.md sections on testing, quality gates, best practices

**Example Workflow**:
```
User: Review Task 8 implementation (AI model selection in project forms)

Agent:
1. Analyze architecture:
   - ReviewProjectForm.tsx changes (180 lines)
   - useProjectCreation.ts integration (25 lines)
   - Redux projectsSlice.ts updates (15 lines)
2. Review code quality:
   - Type safety: ✅ All props typed correctly
   - Offline-first: ✅ Uses ProjectService
   - Console.log: ❌ 3 violations
3. Assess testing:
   - Unit tests: 0/5 scenarios (0%)
   - Integration tests: 0/3 scenarios (0%)
   - E2E tests: 0 critical paths
   - Overall coverage: 0%
4. Analyze performance:
   - Bundle size: +20KB (acceptable)
   - Render performance: No regression (memoized components)
5. Security review:
   - Input validation: ✅ Yup schema present
   - RLS enforcement: ✅ Backend handles
6. Calculate scores:
   - Quality: 6.5/10 (console.log violations, missing tests)
   - Production readiness: 55% (functionality works, but quality issues)
7. Generate action items:
   - CRITICAL: Remove console.log statements
   - CRITICAL: Add unit tests (5 scenarios)
   - HIGH: Add integration tests (3 scenarios)
   - MEDIUM: Add E2E test (project creation with AI model)
8. Final verdict: REVISE (not ready for production)
9. Output comprehensive review report
```

**Integration with Other Agents**:
- Called after task implementation complete
- Integrates ww-aadf-mobile-quality-gate-enforcer results
- Calls ww-aadf-mobile-testing-coordinator to validate test adequacy
- Final approval gate before task completion

---

## Section 7: Slash Command Specifications

### 7.1 Command Naming Convention

**Pattern**: `/ww-aadf-mobile-[action]`

**Rationale**:
- Namespace: `aadf-` indicates AADF framework command
- Scope: `mobile-` indicates mobile-specific (vs backend, shared)
- Action: Descriptive verb (test, validate, sync, check)

**Examples**:
- `/ww-aadf-mobile-test` - Run tests
- `/ww-aadf-mobile-validate-local` - Validate local environment
- `/ww-aadf-mobile-sync-types` - Sync types from backend

### 7.2 Command Specifications

#### /ww-aadf-mobile-test

**Location**: .claude/commands/mobile/ww-aadf-mobile-test.md

**Purpose**: Run full test suite (unit + integration + E2E)

**Command**:
```bash
#!/bin/bash
echo "🧪 Running full mobile test suite..."

# Unit tests
echo "📝 Running unit tests..."
npm test -- --coverage --silent || exit 1

# Integration tests
echo "🔗 Running integration tests..."
scripts/test-integration-local.sh || exit 1

# E2E tests (Maestro)
echo "🎭 Running E2E tests..."
npm run test:maestro || exit 1

echo "✅ All tests passed!"
```

**Output**:
```
🧪 Running full mobile test suite...
📝 Running unit tests...
  ✅ 113/145 tests passing (77.9%)
  Coverage: 78.5%

🔗 Running integration tests...
  ✅ 18/30 tests passing (60%)

🎭 Running E2E tests...
  ✅ 5/5 flows passing

✅ All tests passed!
```

**Use Cases**:
- Pre-PR validation
- Task completion verification
- Local development confidence check

#### /ww-aadf-mobile-validate-local

**Location**: .claude/commands/mobile/ww-aadf-mobile-validate-local.md

**Purpose**: Full validation for local environment (types + TypeScript + tests)

**Command**:
```bash
#!/bin/bash
npm run validate:local
```

**Expands to**:
```bash
#!/bin/bash
echo "🔍 Validating local environment..."

# 1. Type synchronization check
echo "📄 Checking type synchronization..."
npm run types:check-local || exit 1

# 2. TypeScript compilation
echo "🔧 Checking TypeScript compilation..."
npm run type-check || exit 1

# 3. Test suite
echo "🧪 Running test suite..."
npm test -- --coverage --silent || exit 1

# 4. Linting
echo "🎨 Running linting..."
npm run lint || exit 1

echo "✅ Local environment validated!"
```

**Output**:
```
🔍 Validating local environment...
📄 Checking type synchronization...
  ✅ Types synchronized with local database

🔧 Checking TypeScript compilation...
  ✅ 0 TypeScript errors

🧪 Running test suite...
  ✅ 113/145 tests passing (77.9%)
  Coverage: 78.5%

🎨 Running linting...
  ✅ 12 linting violations (<50 threshold)

✅ Local environment validated!
```

**Use Cases**:
- Pre-commit validation
- Task start verification
- Daily development health check

#### /ww-aadf-mobile-validate-cloud-dev

**Location**: .claude/commands/mobile/ww-aadf-mobile-validate-cloud-dev.md

**Purpose**: Full validation for cloud-dev environment (preview builds)

**Command**:
```bash
#!/bin/bash
npm run validate:cloud-dev
```

**Expands to**:
```bash
#!/bin/bash
echo "🔍 Validating cloud-dev environment..."

# 1. Type synchronization check (cloud-dev Supabase)
echo "📄 Checking type synchronization with cloud-dev..."
npm run types:check-cloud-dev || exit 1

# 2. TypeScript compilation
echo "🔧 Checking TypeScript compilation..."
npm run type-check || exit 1

# 3. Test suite
echo "🧪 Running test suite..."
npm test -- --coverage --silent || exit 1

# 4. Linting
echo "🎨 Running linting..."
npm run lint || exit 1

# 5. Environment-specific checks
echo "🌐 Validating cloud-dev configuration..."
grep -q "nuhwmubvygxyddkycmpa" src/config/environments.ts || exit 1

echo "✅ Cloud-dev environment validated!"
```

**Output**:
```
🔍 Validating cloud-dev environment...
📄 Checking type synchronization with cloud-dev...
  ✅ Types synchronized with cloud-dev database

🔧 Checking TypeScript compilation...
  ✅ 0 TypeScript errors

🧪 Running test suite...
  ✅ 113/145 tests passing (77.9%)

🎨 Running linting...
  ✅ 12 linting violations (<50 threshold)

🌐 Validating cloud-dev configuration...
  ✅ Cloud-dev environment configured correctly

✅ Cloud-dev environment validated!
```

**Use Cases**:
- Pre-preview-build validation
- Cloud-dev deployment preparation
- Stakeholder demo preparation

#### /ww-aadf-mobile-quality-gate

**Location**: .claude/commands/mobile/ww-aadf-mobile-quality-gate.md

**Purpose**: Run all 13 quality gates (comprehensive validation)

**Command**:
```bash
#!/bin/bash
.claude/agents/specialized/mobile/scripts/run-quality-gates.sh
```

**Expands to**:
```bash
#!/bin/bash
echo "🚦 Running all 13 quality gates..."

PASSED=0
FAILED=0

# Gate 1: Type drift validation
echo "1/13: Type drift validation..."
npm run types:check-local --silent && ((PASSED++)) || ((FAILED++))

# Gate 2: Type system size check
echo "2/13: Type system size check..."
scripts/quality-gates/check-type-system-size.sh && ((PASSED++)) || ((FAILED++))

# Gate 3: Console.log pollution
echo "3/13: Console.log pollution..."
scripts/quality-gates/check-console-logs.sh && ((PASSED++)) || ((FAILED++))

# Gate 4: Test coverage (80%+)
echo "4/13: Test coverage..."
scripts/quality-gates/check-test-coverage.sh && ((PASSED++)) || ((FAILED++))

# Gate 5: TypeScript compilation
echo "5/13: TypeScript compilation..."
scripts/quality-gates/check-typescript.sh && ((PASSED++)) || ((FAILED++))

# Gate 6: Linting (<50 violations)
echo "6/13: Linting..."
scripts/quality-gates/check-linting.sh && ((PASSED++)) || ((FAILED++))

# Gate 7: Coordination messages
echo "7/13: Coordination messages..."
# Warning only, always passes
((PASSED++))

# Gate 8: TestID coverage
echo "8/13: TestID coverage..."
scripts/quality-gates/check-testid-coverage.sh && ((PASSED++)) || ((FAILED++))

# Gate 9: Input validation
echo "9/13: Input validation..."
scripts/quality-gates/check-input-validation.sh && ((PASSED++)) || ((FAILED++))

# Gate 10: Offline-first architecture
echo "10/13: Offline-first architecture..."
scripts/quality-gates/check-offline-first.sh && ((PASSED++)) || ((FAILED++))

# Gate 11: Bundle size regression
echo "11/13: Bundle size regression..."
scripts/quality-gates/check-bundle-size.sh && ((PASSED++)) || ((FAILED++))

# Gate 12: Security vulnerability scan
echo "12/13: Security vulnerability..."
scripts/quality-gates/check-security.sh && ((PASSED++)) || ((FAILED++))

# Gate 13: Performance regression
echo "13/13: Performance regression..."
scripts/quality-gates/check-performance.sh && ((PASSED++)) || ((FAILED++))

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Quality Gate Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Passed: $PASSED/13"
echo "  Failed: $FAILED/13"
echo "  Quality Score: $(echo "scale=1; $PASSED*10/13" | bc)/10"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FAILED -eq 0 ]; then
  echo "✅ All quality gates passed!"
  exit 0
else
  echo "❌ $FAILED quality gate(s) failed"
  exit 1
fi
```

**Output**:
```
🚦 Running all 13 quality gates...
1/13: Type drift validation... ✅
2/13: Type system size check... ✅
3/13: Console.log pollution... ❌ (3 violations found)
4/13: Test coverage... ⚠️ (75%, target 80%)
5/13: TypeScript compilation... ✅
6/13: Linting... ✅
7/13: Coordination messages... ✅
8/13: TestID coverage... ❌ (5 components missing testID)
9/13: Input validation... ✅
10/13: Offline-first architecture... ✅
11/13: Bundle size regression... ✅
12/13: Security vulnerability... ✅
13/13: Performance regression... ✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quality Gate Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Passed: 10/13
  Failed: 3/13
  Quality Score: 7.7/10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ 3 quality gate(s) failed
```

**Use Cases**:
- Task completion validation
- Pre-PR comprehensive check
- Production readiness assessment

#### /ww-aadf-mobile-sync-types

**Location**: .claude/commands/mobile/ww-aadf-mobile-sync-types.md

**Purpose**: Sync types from backend (auto-detect environment)

**Command**:
```bash
#!/bin/bash
scripts/mobile/sync-types-from-backend.sh
```

**Expands to**:
```bash
#!/bin/bash
echo "🔄 Auto-detecting environment for type synchronization..."

# Detect current environment
if grep -q "localhost:54321" src/config/environments.ts; then
  ENV="local"
elif grep -q "nuhwmubvygxyddkycmpa" src/config/environments.ts; then
  ENV="cloud-dev"
else
  ENV="cloud-prod"
fi

echo "📍 Detected environment: $ENV"

# Check if types are out of sync
echo "🔍 Checking type synchronization..."
npm run types:check-$ENV --silent

if [ $? -eq 0 ]; then
  echo "✅ Types already synchronized with $ENV"
  exit 0
fi

# Types out of sync, regenerate
echo "⚠️ Types out of sync with $ENV, regenerating..."
npm run types:$ENV

if [ $? -eq 0 ]; then
  echo "✅ Types synchronized successfully!"
  echo ""
  echo "Next steps:"
  echo "  1. Review changes: git diff src/types/supabase.ts"
  echo "  2. Stage changes: git add src/types/supabase.ts"
  echo "  3. Commit: git commit -m 'chore(types): sync with $ENV schema'"
  exit 0
else
  echo "❌ Type synchronization failed"
  exit 1
fi
```

**Output**:
```
🔄 Auto-detecting environment for type synchronization...
📍 Detected environment: local
🔍 Checking type synchronization...
⚠️ Types out of sync with local, regenerating...
  Fetching schema from http://localhost:54321...
  Generating TypeScript types...
  Writing to src/types/supabase.ts...
✅ Types synchronized successfully!

Next steps:
  1. Review changes: git diff src/types/supabase.ts
  2. Stage changes: git add src/types/supabase.ts
  3. Commit: git commit -m 'chore(types): sync with local schema'
```

**Use Cases**:
- Backend schema changed (coordination message received)
- Daily development start (ensure types fresh)
- Pre-commit type drift error

#### /ww-aadf-mobile-check-inbox

**Location**: .claude/commands/mobile/ww-aadf-mobile-check-inbox.md

**Purpose**: Check cross-project coordination inbox for backend messages

**Command**:
```bash
#!/bin/bash
~/dev/wildlifeai/cross-project-coordination/.scripts/check-inbox.sh \
  --project "mvp2-tranche1-foundation-replanning" \
  --team "mobile"
```

**Output**:
```
📬 Checking coordination inbox for mobile team...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Unread Messages (2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Message 1/2:
  From: backend
  Type: schema-change
  Date: 2025-11-09 14:30
  Subject: Added ai_model_id to deployments table

  Summary:
    - Table: deployments
    - Changes: Added column 'ai_model_id UUID'
    - Breaking: No
    - Action: Regenerate types (npm run types:local)

Message 2/2:
  From: backend
  Type: status-update
  Date: 2025-11-09 15:00
  Subject: Phase 4-5 migrations complete

  Summary:
    - All Phase 4-5 migrations applied to local Supabase
    - organisation_manager role renamed to project_admin
    - Action: Review updated RBAC permissions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next Steps:
  1. Read messages: cat inbox/[message-file].md
  2. Take action (e.g., regenerate types)
  3. Archive messages: mv inbox/[message] archive/2025-11/
  4. Log action: .scripts/log-message.sh "Mobile" "Actioned [message]"
```

**Use Cases**:
- Daily session start (check for overnight messages)
- Pre-commit hook warning (unread messages exist)
- Before starting new task (ensure up-to-date with backend)

#### /ww-aadf-mobile-bundle-analyze

**Location**: .claude/commands/mobile/ww-aadf-mobile-bundle-analyze.md

**Purpose**: Analyze bundle size and dependencies

**Command**:
```bash
#!/bin/bash
echo "📦 Analyzing bundle size and dependencies..."

# Generate bundle analysis
npx react-native-bundle-visualizer --platform android

# Display summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Bundle Analysis Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Total Size: $(du -h android/app/build/generated/assets/react/release/index.android.bundle | cut -f1)"
echo "  Baseline: 12.27 MB"
echo "  Delta: [Calculated difference]"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Opening bundle visualization in browser..."
```

**Output**:
```
📦 Analyzing bundle size and dependencies...
  Building production bundle...
  Generating dependency tree...
  Creating visualization...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Bundle Analysis Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total Size: 12.29 MB
  Baseline: 12.27 MB
  Delta: +20 KB (+0.16%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Opening bundle visualization in browser...
  http://localhost:3000

Top Dependencies:
  1. react-native: 4.2 MB
  2. @react-navigation: 1.8 MB
  3. redux: 1.2 MB
  4. react-native-ble-manager: 0.9 MB
  5. expo: 0.8 MB
```

**Use Cases**:
- Pre-PR bundle size validation
- Performance optimization baseline
- Dependency audit

#### /ww-aadf-mobile-performance

**Location**: .claude/commands/mobile/ww-aadf-mobile-performance.md

**Purpose**: Run performance benchmarks

**Command**:
```bash
#!/bin/bash
echo "⚡ Running performance benchmarks..."

# Run performance tests
npm run test:performance || {
  echo "⚠️ Performance test suite not yet implemented"
  echo "   Creating baseline benchmarks..."

  # Measure app launch time
  echo "1. App launch time: [TBD]"

  # Measure screen render time
  echo "2. Screen render time: [TBD]"

  # Measure SQLite query performance
  echo "3. SQLite query performance: [TBD]"

  # Measure sync performance
  echo "4. Sync performance: [TBD]"

  exit 0
}

echo "✅ Performance benchmarks complete"
```

**Output** (future state):
```
⚡ Running performance benchmarks...

1. App Launch Time
  Cold start: 2.3s (target: <3s) ✅
  Warm start: 0.8s (target: <1s) ✅

2. Screen Render Time
  DeploymentsScreen (500 items): 0.3s (target: <1s) ✅
  ProjectsScreen (50 items): 0.1s (target: <0.5s) ✅

3. SQLite Query Performance
  SELECT 1000 deployments: 120ms (target: <500ms) ✅
  INSERT 100 projects: 45ms (target: <100ms) ✅

4. Sync Performance
  100 operations: 3.2s (target: <5s) ✅
  1000 operations: 28s (target: <60s) ✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Performance Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  All benchmarks: PASS ✅
  Regressions: 0
  Improvements: 2 (SQLite, Sync)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Performance benchmarks complete
```

**Use Cases**:
- Pre-PR performance validation
- Optimization baseline measurement
- Production readiness assessment

#### /ww-aadf-mobile-security-audit

**Location**: .claude/commands/mobile/ww-aadf-mobile-security-audit.md

**Purpose**: Security vulnerability scan

**Command**:
```bash
#!/bin/bash
echo "🛡️ Running security audit..."

ISSUES=0

# 1. npm audit
echo "1/3: Dependency vulnerabilities..."
npm audit --audit-level=moderate || ((ISSUES++))

# 2. Check for console.log
echo "2/3: Console.log pollution..."
scripts/quality-gates/check-console-logs.sh || ((ISSUES++))

# 3. Check for hardcoded secrets
echo "3/3: Hardcoded secrets..."
scripts/quality-gates/check-secrets.sh || ((ISSUES++))

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Security Audit Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ISSUES -eq 0 ]; then
  echo "  ✅ No security issues found"
else
  echo "  ⚠️ $ISSUES security issue(s) found"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $ISSUES
```

**Output**:
```
🛡️ Running security audit...

1/3: Dependency vulnerabilities...
  Auditing 1,234 dependencies...
  ✅ 0 vulnerabilities found

2/3: Console.log pollution...
  Scanning src/ directory...
  ❌ 3 console.log statements found:
    - src/services/ProjectService.ts:67
    - src/services/ProjectService.ts:76
    - src/services/ProjectService.ts:80

3/3: Hardcoded secrets...
  Scanning for API keys, passwords...
  ✅ No hardcoded secrets found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Security Audit Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️ 1 security issue(s) found
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Use Cases**:
- Pre-PR security validation
- Production deployment preparation
- Compliance audit

#### /ww-aadf-mobile-offline-coverage

**Location**: .claude/commands/mobile/ww-aadf-mobile-offline-coverage.md

**Purpose**: Report offline-first coverage across services

**Command**:
```bash
#!/bin/bash
scripts/mobile/report-offline-coverage.sh
```

**Expands to**:
```bash
#!/bin/bash
echo "📊 Analyzing offline-first architecture coverage..."

OFFLINE_SERVICES=0
ONLINE_SERVICES=0

# Check ProjectService
if grep -q "DatabaseService" src/services/ProjectService.ts; then
  echo "✅ ProjectService: Offline-first"
  ((OFFLINE_SERVICES++))
else
  echo "❌ ProjectService: Direct Supabase"
  ((ONLINE_SERVICES++))
fi

# Check deploymentsApi
if grep -q "queryFn.*DatabaseService" src/redux/api/deployments/index.ts; then
  echo "✅ deploymentsApi: Offline-first"
  ((OFFLINE_SERVICES++))
else
  echo "❌ deploymentsApi: Direct Supabase"
  ((ONLINE_SERVICES++))
fi

# ... (check all services)

# Summary
TOTAL=$((OFFLINE_SERVICES + ONLINE_SERVICES))
PERCENTAGE=$((OFFLINE_SERVICES * 100 / TOTAL))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Offline-First Coverage Report"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Offline-first: $OFFLINE_SERVICES/$TOTAL ($PERCENTAGE%)"
echo "  Direct Supabase: $ONLINE_SERVICES/$TOTAL"
echo "  Target: 100%"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

**Output**:
```
📊 Analyzing offline-first architecture coverage...

✅ ProjectService: Offline-first
❌ deploymentsApi: Direct Supabase
❌ auth: Direct Supabase
❌ devices: Direct Supabase
❌ media: Direct Supabase
❌ observations: Direct Supabase
❌ sensorRecords: Direct Supabase
❌ users: Direct Supabase
❌ ProjectMemberService: Direct Supabase
❌ DfuService: Direct Supabase

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Offline-First Coverage Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Offline-first: 1/10 (10%)
  Direct Supabase: 9/10
  Target: 100%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Recommendation:
  Migrate remaining services to offline-first architecture.
  See: project-context/investigation/aadf-work-smart/2025-11-09-REVISED-specialized-agent-ecosystem-plan.md
  Section 5: Offline-First Migration Strategy
```

**Use Cases**:
- Architecture assessment
- Migration progress tracking
- Quality gate validation (offline-first requirement)

---

## Section 8: Tooling Prerequisites

### 8.1 Development Environment Requirements

**Local Machine**:
- Node.js: v18+ (LTS)
- npm: v9+
- Git: v2.30+
- WSL2 (Windows) or macOS/Linux
- Android Studio (for Android development)
- Xcode (macOS only, for iOS development)

**Backend Integration**:
- Backend repo cloned: `~/dev/wildlifeai/wildlife-watcher-backend`
- Local Supabase running: `cd backend && supabase start`
- Supabase CLI authenticated: `npx supabase login`

**Cross-Project Coordination**:
- Coordination repo: `~/dev/wildlifeai/cross-project-coordination`
- Inbox watcher running: `.scripts/watch-inbox.sh`
- Coordination scripts executable: `chmod +x .scripts/*.sh`

### 8.2 Credentials & Access

**Supabase Credentials**:
- Local Supabase: No credentials needed (localhost:54321)
- Cloud-dev Supabase:
  - Project Ref: `nuhwmubvygxyddkycmpa`
  - Anon Key: Safe to commit (in src/config/environments.ts)
  - CLI auth: `npx supabase login` (one-time)
- Cloud-prod Supabase: (Not yet configured)

**EAS (Expo Application Services)**:
- Account: Wildlife.ai organization
- Access: Team member invitation required
- Authentication: `eas login`
- Build profiles: development, preview, production

**GitHub Actions**:
- Secrets: SUPABASE_ACCESS_TOKEN (cloud-dev)
- Permissions: Workflows enabled, PR checks required

### 8.3 MCP Server Setup

**Claude Flow**:
```bash
claude mcp add claude-flow npx claude-flow@alpha mcp start
```

**Serena** (enhanced development):
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env
uvx --from git+https://github.com/oraios/serena serena start-mcp-server
```

**Context7** (library documentation):
- Automatically available via Claude MCP
- No setup required

### 8.4 Testing Infrastructure

**CRITICAL TESTING POLICY (2025-11-09)**:

**NO MOCKING INFRASTRUCTURE** - Tests use REAL Supabase ONLY:
- ❌ No mocks for Supabase client
- ❌ No test doubles for API calls
- ❌ No elaborate mock infrastructure (lesson from backend: 2+ days wasted)
- ✅ REAL Supabase connections (local and cloud-dev)
- ✅ Test data seeded before tests run
- ✅ Test users with proper roles

**Real Supabase Access**:

1. **Local Environment** (Primary Development):
   - **URL**: http://172.21.24.107:54321 (WSL host IP for physical device testing)
   - **Access**: Start backend repo Supabase (`cd ~/wildlife-watcher-backend && supabase start`)
   - **Test Data**: Seeded via `scripts/seed-test-data.sh`
   - **Test Users**:
     - project_admin@test.com (Project Admin role)
     - project_member@test.com (Project Member role)
   - **Integration Test Script**: `scripts/test-integration-local.sh`

2. **Cloud-dev Environment** (Preview Builds):
   - **URL**: https://nuhwmubvygxyddkycmpa.supabase.co
   - **Access**: Requires Supabase CLI auth (`npx supabase login`)
   - **Test Data**: Seeded via cloud-dev seeding script (TBD)
   - **Test Users**: Same as local (synced)

**Why No Mocks**:
- Backend project evidence: 2+ days wasted on elaborate test infrastructure
- Testing real API behavior finds issues immediately
- Mock infrastructure becomes maintenance burden
- Real Supabase tests validate actual behavior
- **Rule**: If test setup time > implementation time = WRONG approach

**Jest** (unit/integration):
- Installed: ✅ (via npm install)
- Config: jest.config.js
- **Real Supabase Integration**: scripts/test-integration-local.sh
- **Test Pattern**: Setup → Seed data → Test → Cleanup
- **NO mocking**: Tests connect to actual Supabase instance

**Maestro** (E2E):
- Installation: `curl -Ls "https://get.maestro.mobile.dev" | bash`
- Flows: tests/maestro/
- Run: `npm run test:maestro`
- **Real devices required**: Physical device or emulator

**Detox** (E2E, backup):
- Installed: ✅ (via npm install)
- Config: .detoxrc.js
- Status: Configured but not actively used (Maestro preferred)

### 8.5 Quality Gate Scripts

**Location**: scripts/quality-gates/

**Required Scripts** (8 new):
1. check-type-system-size.sh
2. check-console-logs.sh
3. check-test-coverage.sh
4. check-typescript.sh
5. check-linting.sh
6. check-testid-coverage.sh
7. check-input-validation.sh
8. check-offline-first.sh

**Installation**:
```bash
# Create directory
mkdir -p scripts/quality-gates

# Create scripts (see Section 4.2 for implementations)
# ...

# Make executable
chmod +x scripts/quality-gates/*.sh

# Test each script
scripts/quality-gates/check-type-system-size.sh
# ...
```

### 8.6 Git Hooks Setup

**Pre-Commit Hook** (.git/hooks/pre-commit):
- Exists: ✅ (manual installation)
- Enhanced version needed: See Section 4.2
- Backup existing: `cp .git/hooks/pre-commit .git/hooks/pre-commit.backup`
- Install enhanced: Edit .git/hooks/pre-commit with enhanced version
- Make executable: `chmod +x .git/hooks/pre-commit`

**Husky** (future):
- Status: Not installed
- Benefits: Automatic hook installation via `npm install`
- Setup: `npm install --save-dev husky && npx husky install`
- Migration: Move .git/hooks/pre-commit to .husky/pre-commit

---

## Section 9: Risk & Rollout Strategy

### 9.1 Risk Assessment

**High Risks**:

1. **Developer Friction** (Likelihood: HIGH, Impact: HIGH)
   - Quality gates too strict → developers bypass hooks
   - Mitigation: Allow manual override with approval + justification
   - Monitoring: Track --no-verify usage in git logs

2. **Agent Output Quality** (Likelihood: MEDIUM, Impact: HIGH)
   - Agents produce incorrect/incomplete implementations
   - Mitigation: Human-in-the-loop validation, iterative refinement
   - Monitoring: Track agent output acceptance rate

3. **Type Drift** (Likelihood: MEDIUM, Impact: CRITICAL)
   - Backend schema changes → mobile types stale → production errors
   - Mitigation: 5-layer defense (already implemented)
   - Monitoring: GitHub Actions notifications, pre-commit blocks

4. **Offline-First Migration Bugs** (Likelihood: HIGH, Impact: CRITICAL)
   - Data integrity issues, sync failures, conflict resolution bugs
   - Mitigation: Extensive integration testing, gradual rollout
   - Monitoring: Sentry error tracking, sync success rate metrics

5. **Performance Regression** (Likelihood: MEDIUM, Impact: HIGH)
   - Bundle size bloat, render lag, battery drain
   - Mitigation: Performance benchmarking, bundle analysis
   - Monitoring: Bundle size tracking, user feedback

**Medium Risks**:

1. **Test Infrastructure Overhead** (Likelihood: HIGH, Impact: MEDIUM)
   - Integration tests with real Supabase slow down CI/CD
   - Mitigation: Parallel test execution, cached Supabase instances
   - Monitoring: CI/CD execution time tracking

2. **Slash Command Discoverability** (Likelihood: MEDIUM, Impact: MEDIUM)
   - Developers don't know commands exist → underutilization
   - Mitigation: Onboarding documentation, in-app hints
   - Monitoring: Command usage analytics

**Low Risks**:

1. **Documentation Staleness** (Likelihood: HIGH, Impact: LOW)
   - CLAUDE.md out of sync with reality
   - Mitigation: Regular documentation reviews, automated checks
   - Monitoring: Monthly documentation audit

### 9.2 Rollout Strategy

**UPDATED ROLLOUT APPROACH (2025-11-09)**:

**Pilot Scope Refinement**:
- **Start Small**: 1 feature implementation using new agents (proof of concept)
- **Validate Quality Gates**: Ensure all gates pass before enforcing blocking behavior
- **Monitor Effectiveness**: Track agent output quality, remediation time, developer satisfaction
- **Rollback Ready**: If agents cause more issues than they solve, disable blocking and reassess

**Production Readiness Criteria**:
- Quality gates must prevent issues (not just detect them)
- Agents must reduce implementation time (not increase it)
- Developer friction must be minimal (<10% bypass attempts)
- Zero critical bugs from agent-generated code

**Phase 1: Pilot (Week 11) - Single Feature Proof of Concept**

**Participants**: 2 internal developers

**Scope** (REDUCED):
- **1 Feature Implementation**: Offline-first for deploymentsApi (single API, not 3)
- **5 Quality Gates** (not 10): Type drift, type size, TypeScript compilation, test coverage, linting
- **3 Agents** (not 8): ww-aadf-mobile-offline-architect, ww-aadf-mobile-testing-coordinator, ww-aadf-mobile-code-reviewer
- **3 Slash Commands** (not 10): /ww-aadf-mobile-test, /ww-aadf-mobile-validate-local, /ww-aadf-mobile-quality-gate

**Success Criteria** (TIGHTENED):
- ✅ Quality gates catch issues before commit (>80% prevention rate)
- ✅ Agent output accepted without major changes (>85% acceptance rate)
- ✅ Feature implementation faster than manual (target: 30% time savings)
- ✅ Zero production incidents from agent-generated code
- ✅ Developer satisfaction >75% (via survey)

**Monitoring** (ENHANCED):
- **Quality Score**: Track quality scores for agent-generated code (target: 9/10+)
- **Time Tracking**: Measure implementation time vs manual baseline
- **Remediation Time**: Track time spent fixing agent-generated issues
- **Bypass Attempts**: Count --no-verify usage (target: <5%)
- **Agent Effectiveness**: Acceptance rate, modification rate, rejection rate

**Exit Criteria** (STRICTER):
- All success criteria met for 1 week continuously
- No critical bugs found
- Team confidence >80% via anonymous survey
- **MANDATORY**: If agents increase workload or reduce quality, pilot STOPS

**Phase 2: Staging (Week 11) - Stakeholder Preview**

**Participants**: 20 stakeholders + internal team

**Scope**:
- All quality gates (13 total)
- All agents (8 mobile-specific)
- All slash commands (10 mobile-specific)
- Offline-first: P0 + P1 APIs (7 total)

**Success Criteria**:
- Zero production incidents
- User satisfaction >85%
- Offline mode functional (tested by stakeholders)
- Performance acceptable (no regressions)

**Monitoring**:
- Sentry error tracking
- Sync success rate metrics
- User feedback surveys
- Performance dashboards

**Exit Criteria**:
- All success criteria met
- No high-severity bugs
- Stakeholder approval for production

**Phase 3: Production (Week 12) - Full Rollout**

**Participants**: All users

**Scope**:
- All features enabled
- All quality gates enforced
- All agents available
- Offline-first: 100% coverage

**Success Criteria**:
- Zero production incidents
- User satisfaction maintained
- Offline mode adoption >50%
- Performance within targets

**Monitoring**:
- Sentry error tracking (24/7)
- Performance monitoring (bundle size, render time, battery)
- Sync success rate (target: >95%)
- User feedback (in-app + support tickets)

**Rollback Plan**:
- Feature flags for offline-first (disable per API)
- Quick revert to direct Supabase calls
- Data integrity checks before/after rollback
- Communication plan (users, stakeholders)

### 9.3 Monitoring & Metrics

**Quality Metrics**:
- Quality gate pass rate: >90%
- Agent output acceptance rate: >70%
- Slash command usage: >50% of daily tasks
- Developer satisfaction: >80%

**Performance Metrics**:
- Bundle size: 12.27 MB baseline, <15 MB target
- App launch time: <3s cold start, <1s warm start
- Screen render time: <1s for 1000 items
- Battery usage: <5% drain per hour active sync

**Offline-First Metrics**:
- Offline coverage: 100% target
- Sync success rate: >95%
- Conflict resolution rate: >90% automatic
- Data integrity: 100% (zero data loss)

**Type Synchronization Metrics**:
- Type drift incidents: 0 target
- GitHub Actions failures: <5% (false positives)
- Pre-commit hook blocks: Track frequency
- Coordination message response time: <24 hours

**Developer Experience Metrics**:
- Pre-commit hook execution time: <30s
- Agent response time: <5 minutes
- Slash command usage: >10 per developer per day
- Documentation accuracy: >95%

### 9.4 Success Criteria

**Technical Success**:
- ✅ All 13 quality gates implemented and enforced
- ✅ 8 specialized mobile agents functional
- ✅ 10 slash commands available and documented
- ✅ 100% offline-first coverage
- ✅ Zero type drift incidents
- ✅ Zero production incidents during rollout

**Business Success**:
- ✅ Developer productivity increased (measured by task velocity)
- ✅ Code quality improved (quality score avg >8/10)
- ✅ Production readiness consistent (avg >85%)
- ✅ User satisfaction maintained or improved
- ✅ Offline mode adoption >50%

**Process Success**:
- ✅ Developer adoption >90%
- ✅ Documentation maintained (monthly updates)
- ✅ Learnings captured in AADF framework
- ✅ Ecosystem sustainable (low maintenance overhead)

---

## Appendix A: File Reference Index

**Core Architecture**:
- App root: src/App.tsx (900 lines)
- Redux store: src/redux/index.ts
- Offline service: src/services/offline/OfflineService.ts (900 lines)
- Database service: src/services/offline/DatabaseService.ts
- Project service: src/services/ProjectService.ts (900 lines)

**BLE**:
- BLE hook: src/hooks/useBle.ts (700+ lines)
- BLE parser: src/ble/parser.ts
- BLE types: src/ble/types.ts

**Environment Management**:
- Environments: src/config/environments.ts
- Manager: src/config/EnvironmentManager.ts
- Supabase client: src/services/supabase.ts
- Developer settings: src/screens/DeveloperSettingsScreen.tsx

**Testing**:
- BDD helpers: tests/setup/helpers/bdd.ts
- Supabase client: tests/setup/supabase-test-client.ts
- Integration script: scripts/test-integration-local.sh
- Maestro flows: tests/maestro/

**Quality Gates**:
- Pre-commit hook: .git/hooks/pre-commit (68 lines)
- GitHub Actions: .github/workflows/quality-gate-validation.yml
- Type validation: .github/workflows/type-validation.yml
- Quality scripts: scripts/quality-gates/ (8 scripts, to be created)

**Type Synchronization**:
- Type file: src/types/supabase.ts (52KB)
- Check local: scripts/check-types-local.sh
- Check cloud-dev: scripts/check-types-cloud-dev.sh
- Validate local: scripts/validate-local.sh (npm script)

**Coordination**:
- Inbox: ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/
- Archive: ~/dev/wildlifeai/cross-project-coordination/archive/
- Scripts: ~/dev/wildlifeai/cross-project-coordination/.scripts/

**Agents** (to be created):
- .claude/agents/specialized/mobile/ww-aadf-mobile-offline-architect.md
- .claude/agents/specialized/mobile/ww-aadf-mobile-ble-specialist.md
- .claude/agents/specialized/mobile/ww-aadf-mobile-performance-optimizer.md
- .claude/agents/specialized/mobile/ww-aadf-mobile-testing-coordinator.md
- .claude/agents/specialized/mobile/ww-aadf-mobile-type-sync-guardian.md
- .claude/agents/specialized/mobile/ww-aadf-mobile-environment-manager.md
- .claude/agents/specialized/mobile/ww-aadf-mobile-quality-gate-enforcer.md
- .claude/agents/specialized/mobile/ww-aadf-mobile-code-reviewer.md

**Slash Commands** (to be created):
- .claude/commands/mobile/ww-aadf-mobile-test.md
- .claude/commands/mobile/ww-aadf-mobile-validate-local.md
- .claude/commands/mobile/ww-aadf-mobile-validate-cloud-dev.md
- .claude/commands/mobile/ww-aadf-mobile-quality-gate.md
- .claude/commands/mobile/ww-aadf-mobile-sync-types.md
- .claude/commands/mobile/ww-aadf-mobile-check-inbox.md
- .claude/commands/mobile/ww-aadf-mobile-bundle-analyze.md
- .claude/commands/mobile/ww-aadf-mobile-performance.md
- .claude/commands/mobile/ww-aadf-mobile-security-audit.md
- .claude/commands/mobile/ww-aadf-mobile-offline-coverage.md

---

## Appendix B: Implementation Checklist

**Phase 1: Foundation (Week 1)**
- [ ] Create quality gate scripts (scripts/quality-gates/)
  - [ ] check-type-system-size.sh
  - [ ] check-console-logs.sh
  - [ ] check-test-coverage.sh
  - [ ] check-typescript.sh
  - [ ] check-linting.sh
- [ ] Enhance pre-commit hook (.git/hooks/pre-commit)
- [ ] Remediate 156 console.log statements
- [ ] Add ESLint rule: no-console
- [ ] Update GitHub Actions workflow
- [ ] Test all quality gates
- [ ] Document quality gate process

**Phase 2: Agents (Weeks 2-3)**
- [ ] Create agent specifications
  - [ ] ww-aadf-mobile-offline-architect.md
  - [ ] ww-aadf-mobile-ble-specialist.md
  - [ ] ww-aadf-mobile-performance-optimizer.md
  - [ ] ww-aadf-mobile-testing-coordinator.md
  - [ ] ww-aadf-mobile-type-sync-guardian.md
  - [ ] ww-aadf-mobile-environment-manager.md
  - [ ] ww-aadf-mobile-quality-gate-enforcer.md
  - [ ] ww-aadf-mobile-code-reviewer.md
- [ ] Test each agent with real tasks
- [ ] Document agent workflows
- [ ] Create agent integration examples

**Phase 3: Slash Commands (Week 4)**
- [ ] Create slash command specifications
  - [ ] /ww-aadf-mobile-test.md
  - [ ] /ww-aadf-mobile-validate-local.md
  - [ ] /ww-aadf-mobile-validate-cloud-dev.md
  - [ ] /ww-aadf-mobile-quality-gate.md
  - [ ] /ww-aadf-mobile-sync-types.md
  - [ ] /ww-aadf-mobile-check-inbox.md
  - [ ] /ww-aadf-mobile-bundle-analyze.md
  - [ ] /ww-aadf-mobile-performance.md
  - [ ] /ww-aadf-mobile-security-audit.md
  - [ ] /ww-aadf-mobile-offline-coverage.md
- [ ] Create helper scripts
  - [ ] scripts/mobile/sync-types-from-backend.sh
  - [ ] scripts/mobile/report-offline-coverage.sh
  - [ ] scripts/mobile/run-quality-gates.sh
- [ ] Update CLAUDE.md with slash command reference
- [ ] Create quick reference guide

**Phase 4: Offline-First Migration (Weeks 5-10)**
- [ ] Week 5: P0 APIs
  - [ ] deploymentsApi offline-first
  - [ ] auth session caching
  - [ ] Integration tests
- [ ] Week 6: P0 APIs continued
  - [ ] devices offline-first
  - [ ] BLE integration
  - [ ] Integration tests
- [ ] Week 7: P1 APIs
  - [ ] media offline-first
  - [ ] observations offline-first
  - [ ] Integration tests
- [ ] Week 8: P1 APIs continued
  - [ ] sensorRecords offline-first
  - [ ] Integration tests
- [ ] Week 9: P2 APIs
  - [ ] users offline-first
  - [ ] ProjectMemberService offline-first
- [ ] Week 10: P2 APIs continued
  - [ ] DfuService offline-first
  - [ ] Final integration tests

**Phase 5: Rollout (Weeks 11-12)**
- [ ] Week 11: Pilot + Staging
  - [ ] Internal team testing (5 users)
  - [ ] Stakeholder preview build (20 users)
  - [ ] Bug fixes and performance tuning
- [ ] Week 12: Production
  - [ ] Full production rollout
  - [ ] Monitoring and support
  - [ ] Documentation updates
  - [ ] Retrospective and learnings capture

---

## Section 10: Parallel Agent & Slash Command Creation Strategy

**CRITICAL EFFICIENCY REQUIREMENT (2025-11-09)**:

To avoid sequential bottleneck, ALL sub-agents and slash commands MUST be created in PARALLEL using the Task tool.

### 10.1 Parallel Creation Workflow

**Step 1: Prepare Full Context Package** (5 minutes):

Create a comprehensive context document containing:

1. **Architecture Context**:
   - App.tsx layers with inheritance explanation
   - Redux store setup with middleware details
   - Offline-first patterns with ProjectService template
   - BLE custom engine architecture
   - All file paths with line number references

2. **Quality Standards**:
   - All 13 quality gates (with blocking requirements)
   - Testing strategy (REAL Supabase only, no mocks)
   - Console.log resolution strategy (phased approach)
   - Type synchronization 5-layer defense

3. **Implementation Patterns**:
   - ProjectService.ts (lines 1-900) as offline-first template
   - OfflineService.ts (lines 1-900) for queue management
   - useBle.ts (lines 1-700) for BLE patterns
   - Redux store setup (src/redux/index.ts)

4. **Context7 Requirements**:
   - React Native official docs
   - Expo SDK 51 best practices
   - Redux Toolkit + RTK Query vendor docs
   - Supabase integration guides
   - SQLite offline-first patterns

**Step 2: Spawn ALL Sub-Agents in ONE Task Call** (15 minutes):

```typescript
// Example Task invocation (pseudocode)
Task.spawn([
  {
    agent: "mobile-dev",
    task: "Create ww-aadf-mobile-offline-architect agent spec",
    context: fullContextPackage,
    output: ".claude/agents/specialized/mobile/ww-aadf-mobile-offline-architect.md"
  },
  {
    agent: "mobile-dev",
    task: "Create ww-aadf-mobile-ble-specialist agent spec",
    context: fullContextPackage,
    output: ".claude/agents/specialized/mobile/ww-aadf-mobile-ble-specialist.md"
  },
  {
    agent: "mobile-dev",
    task: "Create ww-aadf-mobile-testing-coordinator agent spec",
    context: fullContextPackage,
    output: ".claude/agents/specialized/mobile/ww-aadf-mobile-testing-coordinator.md"
  },
  // ... 5 more agents
  {
    agent: "mobile-dev",
    task: "Create /ww-aadf-mobile-test slash command",
    context: fullContextPackage,
    output: ".claude/commands/mobile/ww-aadf-mobile-test.md"
  },
  // ... 9 more slash commands
]);
```

**Key Principle**: Each sub-agent receives IDENTICAL full context package, ensuring:
- Consistent architecture understanding
- Consistent quality gate enforcement
- Consistent testing approach
- Consistent integration patterns

**Step 3: Validation & Integration** (30 minutes):

After parallel creation:
1. Read all generated agent specs
2. Validate consistency across agents
3. Validate file references point to actual code
4. Validate Context7 research requirements specified
5. Validate quality gate enforcement requirements included
6. Test one agent with real task (proof of concept)

### 10.2 Full Context Package Template

**File**: `project-context/development-context/agent-creation/mobile-agent-full-context.md`

**Contents** (complete architecture knowledge):

```markdown
# Mobile Agent Full Context Package

## 1. Architecture Layers (App.tsx)

### Layer Inheritance Chain
[Copy from Section 1.1.1 - complete layer breakdown]

### Why This Matters
Screens inherit:
- Platform permissions (Safe Area Provider)
- Error boundaries (React Suspense)
- Redux state (all slices + APIs)
- Material Design components (Paper Provider)
- Navigation context (React Navigation)
- BLE hardware state (BLE providers)
- Auth context (Supabase auth)

Agents must NOT re-implement inherited functionality.

## 2. Redux Store Architecture

### Store Setup (src/redux/index.ts)
[Copy from Section 1.1.1 - Redux store setup code]

### Middleware Configuration
- 4 RTK Query APIs with auto-caching
- Listener middleware for offline sync
- Serializable check exceptions for queue metadata

## 3. Offline-First Template (ProjectService.ts)

### Pattern Overview
[Copy from Section 1.1.1 - offline-first implementation pattern]

### Implementation References
- src/services/ProjectService.ts (lines 1-900)
- src/services/offline/OfflineService.ts (lines 1-900)
- src/services/offline/DatabaseService.ts (full file)
- src/redux/middleware/offlineSyncMiddleware.ts (full file)

## 4. BLE Custom Engine

### Architecture
[Copy from Section 1.1.1 - BLE architecture]

### Implementation References
- src/hooks/useBle.ts (lines 1-700)
- src/ble/parser.ts (full file)
- src/ble/types.ts (full file)

## 5. Quality Gates (ALL BLOCKING)

[Copy from Section 4 - complete quality gate table with blocking requirements]

## 6. Testing Strategy (REAL Supabase ONLY)

[Copy from Section 8.4 - complete testing infrastructure with no-mocking policy]

## 7. Console.log Resolution Strategy

[Copy from Section 1.2.6 - phased migration approach]

## 8. Type Synchronization

[Copy type synchronization details - 5-layer defense, scripts, coordination]

## 9. Context7 Research Requirements

Agents MUST use Context7 for:
- React Native official patterns
- Expo SDK 51 best practices
- Redux Toolkit + RTK Query vendor docs
- Supabase integration guides
- SQLite offline-first patterns

Validation: Implementation must match BOTH codebase patterns AND vendor docs.

## 10. Agent Integration Patterns

### How Agents Call Each Other
- ww-aadf-mobile-offline-architect → ww-aadf-mobile-testing-coordinator (integration tests)
- ww-aadf-mobile-offline-architect → ww-aadf-mobile-performance-optimizer (storage/sync validation)
- ww-aadf-mobile-ble-specialist → ww-aadf-mobile-testing-coordinator (BLE device testing)
- ww-aadf-mobile-code-reviewer → ALL agents (validation)

### Human-in-the-Loop Points
- After agent output (human validation required)
- Before quality gate enforcement (human approval for exceptions)
- During pilot rollout (human monitoring)
```

### 10.3 Parallel Creation Benefits

**Time Savings**:
- Sequential: 8 agents × 30 min = 4 hours
- Parallel: 8 agents in 15 min = **93.75% time reduction**

**Consistency Gains**:
- All agents share identical architecture understanding
- All agents enforce same quality gates
- All agents use same testing strategy
- All agents follow same Context7 research requirements

**Quality Improvements**:
- Full context prevents incomplete agent specs
- Consistent file references prevent broken links
- Consistent patterns prevent architectural drift
- Consistent validation prevents quality gaps

### 10.4 Post-Creation Validation Checklist

For EACH agent created:

- [ ] File references point to actual code (verify with Read tool)
- [ ] Context7 research requirements specified for relevant technologies
- [ ] Quality gate enforcement requirements included (all 13 gates)
- [ ] Testing strategy specified (REAL Supabase, no mocks)
- [ ] Integration points with other agents documented
- [ ] Example workflow provided
- [ ] Output format template included
- [ ] Human-in-the-loop points identified

**Success Criteria**:
- ALL agents pass validation checklist
- Test 1 agent with real task (proof of concept)
- Agent output quality score >8/10
- Agent output accepted with <15% modifications

---

**End of Revised Specialized Agent Ecosystem Plan**
## Section 11: Agent & Slash Command Inventory

### 11.1 Mobile Agents (To Be Implemented)

| # | Agent Name | File Location | Purpose | Priority |
|---|------------|---------------|---------|----------|
| 1 | ww-aadf-mobile-quality-gate-enforcer | .claude/agents/specialized/mobile/ww-aadf-mobile-quality-gate-enforcer.md | Enforce all 13 quality gates (blocking) before any merge | P0 |
| 2 | ww-aadf-mobile-type-sync-guardian | .claude/agents/specialized/mobile/ww-aadf-mobile-type-sync-guardian.md | Prevent type drift via 5-layer defense-in-depth system | P0 |
| 3 | ww-aadf-mobile-offline-architect | .claude/agents/specialized/mobile/ww-aadf-mobile-offline-architect.md | Design and validate offline-first architecture (SQLite sync, conflict resolution) | P0 |
| 4 | ww-aadf-mobile-testing-coordinator | .claude/agents/specialized/mobile/ww-aadf-mobile-testing-coordinator.md | Orchestrate TDD/BDD testing with REAL Supabase (no mocks) | P0 |
| 5 | ww-aadf-mobile-code-reviewer | .claude/agents/specialized/mobile/ww-aadf-mobile-code-reviewer.md | Comprehensive code review with quality score + production readiness | P0 |
| 6 | ww-aadf-mobile-ble-specialist | .claude/agents/specialized/mobile/ww-aadf-mobile-ble-specialist.md | BLE device communication, DFU updates, LoRaWAN integration | P1 |
| 7 | ww-aadf-mobile-performance-optimizer | .claude/agents/specialized/mobile/ww-aadf-mobile-performance-optimizer.md | Bundle analysis, SQLite WAL mode, render performance optimization | P1 |
| 8 | ww-aadf-mobile-environment-manager | .claude/agents/specialized/mobile/ww-aadf-mobile-environment-manager.md | Runtime environment switching (local/cloud-dev/cloud-prod) | P2 |

**Total Count**: 8 mobile agents

**Priority Breakdown**:
- **P0 (Must Implement)**: 5 agents (quality-gate-enforcer, type-sync-guardian, offline-architect, testing-coordinator, code-reviewer)
- **P1 (High Value)**: 2 agents (ble-specialist, performance-optimizer)
- **P2 (Nice-to-Have)**: 1 agent (environment-manager)

### 11.2 Mobile Slash Commands (To Be Implemented)

| # | Command Name | File Location | Purpose | Agents Used | Priority |
|---|--------------|---------------|---------|-------------|----------|
| 1 | /ww-aadf-mobile-test | .claude/commands/mobile/ww-aadf-mobile-test.md | Run full test suite (unit + integration + E2E) | testing-coordinator | P0 |
| 2 | /ww-aadf-mobile-validate-local | .claude/commands/mobile/ww-aadf-mobile-validate-local.md | Full validation for local environment (types + tests + TS + lint) | quality-gate-enforcer, type-sync-guardian, testing-coordinator | P0 |
| 3 | /ww-aadf-mobile-quality-gate | .claude/commands/mobile/ww-aadf-mobile-quality-gate.md | Run all 13 quality gates (blocking validation) | quality-gate-enforcer | P0 |
| 4 | /ww-aadf-mobile-sync-types | .claude/commands/mobile/ww-aadf-mobile-sync-types.md | Sync types from backend (auto-detect environment) | type-sync-guardian | P0 |
| 5 | /ww-aadf-mobile-validate-cloud-dev | .claude/commands/mobile/ww-aadf-mobile-validate-cloud-dev.md | Full validation for cloud-dev environment | quality-gate-enforcer, type-sync-guardian, testing-coordinator | P0 |
| 6 | /ww-aadf-mobile-check-inbox | .claude/commands/mobile/ww-aadf-mobile-check-inbox.md | Check cross-project coordination inbox for backend messages | type-sync-guardian | P0 |
| 7 | /ww-aadf-mobile-bundle-analyze | .claude/commands/mobile/ww-aadf-mobile-bundle-analyze.md | Analyze bundle size and dependencies | performance-optimizer | P1 |
| 8 | /ww-aadf-mobile-performance | .claude/commands/mobile/ww-aadf-mobile-performance.md | Run performance benchmarks (SQLite, React render, bundle) | performance-optimizer | P1 |
| 9 | /ww-aadf-mobile-security-audit | .claude/commands/mobile/ww-aadf-mobile-security-audit.md | Security vulnerability scan (console.log, env vars, secrets) | quality-gate-enforcer | P1 |
| 10 | /ww-aadf-mobile-offline-coverage | .claude/commands/mobile/ww-aadf-mobile-offline-coverage.md | Report offline-first coverage (API integrations, OfflineService usage) | offline-architect | P2 |

**Total Count**: 10 mobile slash commands

**Priority Breakdown**:
- **P0 (Must Implement)**: 6 commands (test, validate-local, quality-gate, sync-types, validate-cloud-dev, check-inbox)
- **P1 (High Value)**: 3 commands (bundle-analyze, performance, security-audit)
- **P2 (Nice-to-Have)**: 1 command (offline-coverage)

### 11.3 Backend Agents (Future - Pattern for Backend Team)

**NOTE**: These are PATTERN EXAMPLES for the backend team to implement. The mobile team is NOT responsible for creating these.

| # | Agent Name | File Location | Purpose | Priority |
|---|------------|---------------|---------|----------|
| 1 | ww-aadf-backend-quality-gate-enforcer | .claude/agents/specialized/backend/ww-aadf-backend-quality-gate-enforcer.md | Enforce backend quality gates (test coverage, linting, security) | P0 |
| 2 | ww-aadf-backend-schema-guardian | .claude/agents/specialized/backend/ww-aadf-backend-schema-guardian.md | Validate declarative schema approach + type generation | P0 |
| 3 | ww-aadf-backend-rls-architect | .claude/agents/specialized/backend/ww-aadf-backend-rls-architect.md | Design RLS policies with 4-tier RBAC (ww_admin, project_admin, project_member) | P0 |
| 4 | ww-aadf-backend-testing-coordinator | .claude/agents/specialized/backend/ww-aadf-backend-testing-coordinator.md | Orchestrate backend testing with REAL Supabase (user journey focus) | P0 |
| 5 | ww-aadf-backend-code-reviewer | .claude/agents/specialized/backend/ww-aadf-backend-code-reviewer.md | Backend code review with quality score + production readiness | P0 |
| 6 | ww-aadf-backend-migration-specialist | .claude/agents/specialized/backend/ww-aadf-backend-migration-specialist.md | Manage database migrations + coordination message creation | P1 |
| 7 | ww-aadf-backend-performance-optimizer | .claude/agents/specialized/backend/ww-aadf-backend-performance-optimizer.md | RLS optimization, query performance, connection pooling | P1 |
| 8 | ww-aadf-backend-edge-function-architect | .claude/agents/specialized/backend/ww-aadf-backend-edge-function-architect.md | Design Supabase Edge Functions with security + performance | P2 |

**Total Count**: 8 backend agents (backend team responsibility)

**Priority Breakdown**:
- **P0 (Must Implement)**: 5 agents
- **P1 (High Value)**: 2 agents
- **P2 (Nice-to-Have)**: 1 agent

### 11.4 Backend Slash Commands (Future - Pattern for Backend Team)

**NOTE**: These are PATTERN EXAMPLES for the backend team to implement. The mobile team is NOT responsible for creating these.

| # | Command Name | File Location | Purpose | Agents Used | Priority |
|---|--------------|---------------|---------|-------------|----------|
| 1 | /ww-aadf-backend-test | .claude/commands/backend/ww-aadf-backend-test.md | Run backend test suite (unit + integration + user journey) | testing-coordinator | P0 |
| 2 | /ww-aadf-backend-validate-local | .claude/commands/backend/ww-aadf-backend-validate-local.md | Full backend validation (types + tests + schema + RLS) | quality-gate-enforcer, schema-guardian, testing-coordinator | P0 |
| 3 | /ww-aadf-backend-quality-gate | .claude/commands/backend/ww-aadf-backend-quality-gate.md | Run backend quality gates (blocking validation) | quality-gate-enforcer | P0 |
| 4 | /ww-aadf-backend-sync-types | .claude/commands/backend/ww-aadf-backend-sync-types.md | Generate types + create coordination message for mobile | schema-guardian, migration-specialist | P0 |
| 5 | /ww-aadf-backend-validate-cloud-dev | .claude/commands/backend/ww-aadf-backend-validate-cloud-dev.md | Full backend validation for cloud-dev | quality-gate-enforcer, schema-guardian, testing-coordinator | P0 |
| 6 | /ww-aadf-backend-send-message | .claude/commands/backend/ww-aadf-backend-send-message.md | Send coordination message to mobile team | migration-specialist | P0 |
| 7 | /ww-aadf-backend-migration | .claude/commands/backend/ww-aadf-backend-migration.md | Create and apply database migration | migration-specialist, schema-guardian | P1 |
| 8 | /ww-aadf-backend-rls-validate | .claude/commands/backend/ww-aadf-backend-rls-validate.md | Validate RLS policies for all roles | rls-architect | P1 |
| 9 | /ww-aadf-backend-performance | .claude/commands/backend/ww-aadf-backend-performance.md | Run backend performance benchmarks | performance-optimizer | P1 |
| 10 | /ww-aadf-backend-edge-function | .claude/commands/backend/ww-aadf-backend-edge-function.md | Create Supabase Edge Function | edge-function-architect | P2 |

**Total Count**: 10 backend slash commands (backend team responsibility)

**Priority Breakdown**:
- **P0 (Must Implement)**: 6 commands
- **P1 (High Value)**: 3 commands
- **P2 (Nice-to-Have)**: 1 command

### 11.5 Cross-Project Coordination Agents

These agents facilitate mobile-backend coordination and are shared responsibility.

| # | Agent Name | File Location | Purpose | Used By | Priority |
|---|------------|---------------|---------|---------|----------|
| 1 | ww-aadf-coordinator | .claude/agents/coordination/ww-aadf-coordinator.md | Coordinate mobile-backend workflows (messages, type sync, deployments) | Both teams | P0 |
| 2 | ww-aadf-project-manager | .claude/agents/coordination/ww-aadf-project-manager.md | Track cross-project milestones, dependencies, and deployment coordination | Both teams | P1 |

**Total Count**: 2 coordination agents

**Priority Breakdown**:
- **P0 (Must Implement)**: 1 agent (coordinator)
- **P1 (High Value)**: 1 agent (project-manager)

### 11.6 Implementation Summary

```
Wildlife Watcher AADF Agent Ecosystem

Mobile Implementation (This Plan - Mobile Team Responsibility):
├─ Agents: 8
│  ├─ P0 (Must Implement): 5 agents
│  ├─ P1 (High Value): 2 agents
│  └─ P2 (Nice-to-Have): 1 agent
├─ Slash Commands: 10
│  ├─ P0 (Must Implement): 6 commands
│  ├─ P1 (High Value): 3 commands
│  └─ P2 (Nice-to-Have): 1 command
└─ Total Deliverables: 18

Backend Implementation (Future - Backend Team Responsibility):
├─ Agents: 8 (pattern provided, backend team implements)
│  ├─ P0 (Must Implement): 5 agents
│  ├─ P1 (High Value): 2 agents
│  └─ P2 (Nice-to-Have): 1 agent
├─ Slash Commands: 10 (pattern provided, backend team implements)
│  ├─ P0 (Must Implement): 6 commands
│  ├─ P1 (High Value): 3 commands
│  └─ P2 (Nice-to-Have): 1 command
└─ Total Deliverables: 18 (backend team responsibility)

Cross-Project Coordination (Shared Responsibility):
├─ Agents: 2
│  ├─ P0 (Must Implement): 1 agent
│  └─ P1 (High Value): 1 agent
└─ Total Deliverables: 2

════════════════════════════════════════════════════════════════

GRAND TOTAL (All Teams):
├─ Mobile: 8 agents + 10 commands = 18 deliverables (THIS PLAN)
├─ Backend: 8 agents + 10 commands = 18 deliverables (BACKEND TEAM)
├─ Coordination: 2 agents = 2 deliverables (SHARED)
└─ TOTAL: 18 agents + 20 commands = 38 deliverables

════════════════════════════════════════════════════════════════

Mobile Team Immediate Scope (P0 Only):
├─ P0 Agents: 5
├─ P0 Commands: 6
├─ P0 Coordination: 1
└─ TOTAL P0 DELIVERABLES: 12 (MVP for quality enforcement)

Mobile Team Full Scope (P0 + P1 + P2):
└─ TOTAL DELIVERABLES: 18 (complete mobile agent ecosystem)
```

### 11.7 Pilot Rollout Strategy (P0 Only)

**Phase 1**: Quality Gates Foundation (Week 1)
- Agent: ww-aadf-mobile-quality-gate-enforcer
- Command: /ww-aadf-mobile-quality-gate
- Validation: Run on 1 completed task (e.g., Task 8)

**Phase 2**: Type System Protection (Week 1)
- Agent: ww-aadf-mobile-type-sync-guardian
- Commands: /ww-aadf-mobile-sync-types, /ww-aadf-mobile-check-inbox
- Validation: Test type drift prevention workflow

**Phase 3**: Testing Infrastructure (Week 2)
- Agent: ww-aadf-mobile-testing-coordinator
- Commands: /ww-aadf-mobile-test, /ww-aadf-mobile-validate-local, /ww-aadf-mobile-validate-cloud-dev
- Validation: Test suite execution for 1 task

**Phase 4**: Offline-First Architecture (Week 2)
- Agent: ww-aadf-mobile-offline-architect
- Validation: Review existing offline implementations (OfflineService, DatabaseService)

**Phase 5**: Code Review Automation (Week 3)
- Agent: ww-aadf-mobile-code-reviewer
- Validation: Automated review for 1 completed task

**Phase 6**: Cross-Project Coordination (Week 3)
- Agent: ww-aadf-coordinator
- Validation: Backend message workflow test

**Success Criteria**:
- All 6 P0 agents operational
- All 6 P0 commands functional
- 1 coordination agent tested
- Total: 12 P0 deliverables validated

**Timeline**: 3 weeks for P0 MVP

### 11.8 File Organization Structure

```
.claude/
├── agents/
│   ├── specialized/
│   │   └── mobile/
│   │       ├── ww-aadf-mobile-quality-gate-enforcer.md (P0)
│   │       ├── ww-aadf-mobile-type-sync-guardian.md (P0)
│   │       ├── ww-aadf-mobile-offline-architect.md (P0)
│   │       ├── ww-aadf-mobile-testing-coordinator.md (P0)
│   │       ├── ww-aadf-mobile-code-reviewer.md (P0)
│   │       ├── ww-aadf-mobile-ble-specialist.md (P1)
│   │       ├── ww-aadf-mobile-performance-optimizer.md (P1)
│   │       └── ww-aadf-mobile-environment-manager.md (P2)
│   └── coordination/
│       ├── ww-aadf-coordinator.md (P0)
│       └── ww-aadf-project-manager.md (P1)
└── commands/
    └── mobile/
        ├── ww-aadf-mobile-test.md (P0)
        ├── ww-aadf-mobile-validate-local.md (P0)
        ├── ww-aadf-mobile-quality-gate.md (P0)
        ├── ww-aadf-mobile-sync-types.md (P0)
        ├── ww-aadf-mobile-validate-cloud-dev.md (P0)
        ├── ww-aadf-mobile-check-inbox.md (P0)
        ├── ww-aadf-mobile-bundle-analyze.md (P1)
        ├── ww-aadf-mobile-performance.md (P1)
        ├── ww-aadf-mobile-security-audit.md (P1)
        └── ww-aadf-mobile-offline-coverage.md (P2)

Total Files: 20 (18 mobile + 2 coordination)
```

### 11.9 Naming Convention Rationale

**Pattern**: `ww-aadf-{domain}-{capability}`

**Components**:
- `ww` = Wildlife Watcher (project-specific prefix)
- `aadf` = AI Agentic Development Framework (methodology identifier)
- `{domain}` = mobile, backend, or coordination (scope identifier)
- `{capability}` = specific agent/command function (e.g., quality-gate-enforcer, test)

**Benefits**:
1. **Project Isolation**: `ww-` prefix prevents conflicts with other AADF projects
2. **Methodology Clarity**: `aadf-` identifies framework-specific tooling
3. **Domain Separation**: `mobile-`/`backend-` enables parallel team development
4. **Capability Discovery**: Descriptive names enable autocomplete-driven discovery
5. **Scalability**: Pattern extends to future domains (e.g., `ww-aadf-desktop-`, `ww-aadf-web-`)

**Examples**:
- `/ww-aadf-mobile-test` - Wildlife Watcher mobile app test command
- `/ww-aadf-backend-sync-types` - Wildlife Watcher backend type sync command
- `ww-aadf-coordinator` - Wildlife Watcher cross-project coordinator agent

**Consistency**:
- Mobile commands: `/ww-aadf-mobile-*`
- Mobile agents: `ww-aadf-mobile-*`
- Backend commands: `/ww-aadf-backend-*` (future)
- Backend agents: `ww-aadf-backend-*` (future)
- Coordination agents: `ww-aadf-*` (no domain prefix)

### 11.10 Backend Pattern Guidance

**For Backend Team**:

This plan provides the PATTERN and STRUCTURE for backend agent creation. The backend team should:

1. **Mirror Mobile Structure**: Use same agent categories (quality-gate-enforcer, testing-coordinator, code-reviewer)
2. **Adapt to Backend Context**: Replace mobile-specific concerns with backend equivalents:
   - Offline-first architecture → Declarative schema approach
   - BLE specialist → Edge Function architect
   - Environment manager → Migration specialist
3. **Maintain Naming Convention**: Use `ww-aadf-backend-*` prefix consistently
4. **Coordinate on Shared Concerns**: Type synchronization, quality gates, testing strategy
5. **Create Backend-Specific Commands**: `/ww-aadf-backend-sync-types` with mobile notification

**Backend Team Deliverables** (suggested):
- 8 backend agents (mirroring mobile structure)
- 10 backend slash commands (mirroring mobile commands)
- Integration with existing backend AADF system
- Coordination message templates for mobile team

**Backend Team Timeline** (suggested):
- Phase 1: P0 agents (quality-gate-enforcer, schema-guardian, rls-architect) - Week 1-2
- Phase 2: P0 commands (test, validate-local, sync-types) - Week 2-3
- Phase 3: P1 agents and commands - Week 4-5
- Phase 4: P2 agents and commands - Week 6

**Total Effort Estimate**: 6 weeks for complete backend agent ecosystem (mirroring mobile plan)

---

**End of Section 11**
