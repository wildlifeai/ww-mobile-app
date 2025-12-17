# CLAUDE.md

Wildlife Watcher Mobile App guidance for Claude Code (claude.ai/code).

## 🔴 Critical: Concurrent Execution & File Management

**Absolute Rules**:
1. ALL operations MUST be concurrent/parallel in single message
2. **NEVER save working files, text/mds and tests to root folder**
3. ALWAYS organize files in appropriate subdirectories
4. **Mandatory**: Follow Evidence-Based Development - verify assumptions with Context7 research FIRST
5. **Mandatory**: Use WW project-specific agents/commands FIRST - generic agents ONLY with explicit justification

### ⚡ Golden Rule: "1 Message = All Related Operations"

**Mandatory Patterns**:
- **TodoWrite**: ALWAYS batch ALL todos in ONE call (5-10+ todos minimum)
- **Task tool**: ALWAYS spawn ALL agents in ONE message with full instructions
- **File operations**: ALWAYS batch ALL reads/writes/edits in ONE message
- **Bash commands**: ALWAYS batch ALL terminal operations in ONE message
- **Memory operations**: ALWAYS batch ALL memory store/retrieve in ONE message

### File Organization

**NEVER save to root. Use these directories**:
- `/src` - Source code files
- `/tests` - Test files
- `/project-context` - Documentation re app development
- `/documentation` - Developer reference docs (technical/reference)
- `/config` - Configuration files
- `/scripts` - Utility scripts
- `/examples` - Example code

## Abbreviations Reference

- AADF: AI Agentic Development Framework
- TDD: Test-Driven Development
- BDD: Behavior-Driven Development
- E2E: End-to-End
- RN: React Native
- RTK: Redux Toolkit
- RBAC: Role-Based Access Control
- XPC: Cross-Project Coordination
- QG: Quality Gate
- Type Sync: Type Synchronization
- WW Mobile: Wildlife Watcher Mobile App

## Project Overview

**Wildlife Watcher Mobile App** - RN field deployment tool for wildlife camera management with offline-first architecture.

- **Tech Stack**: Expo SDK 51, RN 0.74.5, TypeScript, RTK, Supabase
- **Build Type**: Custom Development Build (NOT Expo Go) - includes custom native modules
- **Architecture**: Offline-first with local SQLite sync, BLE + LoRaWAN device communication, organisation multi-tenancy
- **Key Features**: 6-step deployment wizard, project management, real-time sync, WW Admin access
- **User Roles**: ww_admin (global), project_admin (org-scoped), project_member (project-scoped)
- **Testing**: Jest (unit/integration), Maestro (E2E/BDD), Detox
- **Development**: SPARC methodology with TDD/BDD practices
- **Native Modules**: react-native-ble-manager, expo-updates, react-native-maps, custom BLE integrations

## Essential Commands

### Development

**Important**: This app uses **Custom Development Builds** (NOT Expo Go). Native modules like BLE, expo-updates require full build.

```bash
npm start                              # Metro bundler (JS updates only)
npx expo run:android                   # Local build + run on device/emulator
eas build --profile development        # Build via EAS cloud service
npx expo run:ios                       # iOS (macOS only)
```

**When to rebuild**:
- ✅ After adding/updating native modules
- ✅ After changing native config (app.json, plugins)
- ❌ NOT needed for JS/TS changes (hot reload works)

### Testing

```bash
npm test                    # Jest unit/integration tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:maestro        # All Maestro E2E tests
npm run test:maestro:auth   # Auth workflow tests
npm run test:maestro:offline # Offline workflow tests
npm run type-check          # TypeScript type checking
```

### Type Sync (Critical)

```bash
# Local Development (Most Common)
npm run types:local         # Generate from local Supabase (3 sec)
npm run types:check-local   # Verify alignment (3 sec)
npm run validate:local      # Full validation (30 sec)

# Cloud Development (Preview Builds)
npm run types:cloud-dev         # Generate from cloud-dev
npm run types:check-cloud-dev   # Verify cloud-dev alignment
npm run validate:cloud-dev      # Full cloud-dev validation

# Cloud Production (Future)
npm run types:cloud-prod        # Generate from cloud-prod
npm run types:check-cloud-prod  # Verify cloud-prod alignment
npm run validate:cloud-prod     # Full cloud-prod validation
```

**Mandatory**: After ANY backend schema changes → `npm run types:local` before coding. Pre-commit hooks **BLOCK commits** with stale types.

### Pre-Commit Hook Enforcement (Mandatory)

**Absolute Rule**: NEVER use `git commit --no-verify` or `git commit -n`

**Why This Rule Exists**:
- Pre-commit hooks validate type system alignment (prevents 189+ TypeScript errors)
- Enforce security standards (blocks console.log pollution)
- Run tests (prevents TDD violations)
- Bypassing hooks creates production-blocking issues

**Evidence**: T-008 bypassed pre-commit hook → empty type system → 189 TypeScript errors → 10h remediation

**If Pre-Commit Hook Fails**:
1. **DO NOT** use `--no-verify` to bypass
2. **READ** error message carefully
3. **FIX** underlying issue (usually type system or test failures)
4. **VALIDATE** fix: `npm run validate:local`
5. **COMMIT** normally (without --no-verify)

**Exception Policy**: Pre-commit hooks can ONLY be bypassed with explicit user approval AND documented justification

### Build & Deploy

```bash
npm run lint                # ESLint
npm run prebuild:check      # Pre-build validation
eas build --profile development   # Dev build
eas build --profile production    # Production build
```

### Dependencies

```bash
npm run validate:deps       # Validate compatibility
npm run deps                # Interactive management CLI
npm run deps:scan           # Scan for issues
```

## Architecture Overview

### Directory Structure

```
src/
├── services/          # Business logic & integrations
│   ├── offline/      # OfflineService, SyncService, DatabaseService
│   ├── supabase.ts   # Supabase client
│   ├── auth.ts       # Authentication
│   └── database.ts   # SQLite operations
├── redux/            # RTK state
│   ├── slices/      # auth, projects, offline, sync, deployments
│   ├── api/         # RTK Query endpoints
│   └── middleware/  # offlineSyncMiddleware
├── types/
│   └── supabase.ts  # Generated types (DO NOT EDIT)
├── navigation/      # RN Navigation setup
├── screens/         # Screen components
├── components/      # Reusable UI components
├── features/        # Feature modules (e.g., maps)
├── hooks/           # Custom React hooks
├── utils/           # Utilities
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
- `services/offline/OfflineService.ts` - Main coordinator
- `services/offline/DatabaseService.ts` - SQLite CRUD, schema management
- `services/offline/SyncService.ts` - Sync queue, conflict detection, retry
- `redux/middleware/offlineSyncMiddleware.ts` - Redux middleware

#### State Management (RTK)

- **Slices**: Domain state in `redux/slices/`
- **RTK Query**: API endpoints with caching in `redux/api/`
- **Middleware**: Custom offline sync middleware

#### Authentication & Authorization

- **Supabase Auth**: Email/password
- **RBAC**: 4-tier system
  - `ww_admin` - Global admin (Wildlife.ai staff)
  - `project_admin` - Organisation-scoped admin
  - `project_member` - Project-scoped member
  - Anonymous users (limited access)
- **Type Safety**: Generated Supabase types in `src/types/supabase.ts`
- **See**: `@project-context/development-context/MVP2/specifications/user-roles-permissions.md`

#### Testing Strategy

1. **Unit Tests** (Jest): Services, utilities, RTK slices - co-located
2. **Integration Tests** (Jest): Component + service integration
3. **E2E Tests** (Maestro): Real user workflows (.yaml files)
4. **TDD/BDD**: Write tests BEFORE implementation (Red-Green-Refactor)
5. **See**: `@project-context/development-context/MVP2/implementation/guides/testing-standards.md`

## Type Sync Critical Path

**Full Guide**: `@project-context/learnings/type-drift-prevention-5-layer-defense.md`

**TL;DR**: 5-layer defense (99% prevention rate)
- Layer 1: Backend pre-commit → blocks stale types
- Layer 2: Coordination messages (manual quality)
- Layer 3: Mobile inbox check (daily)
- Layer 4: Mobile pre-commit → blocks commits ✅
- Layer 5: GitHub Actions → blocks PR merge ✅

**Daily Command**:
```bash
npm run types:local  # 3 sec, hook validates automatically
```

**When to Deep-Dive**: Setting up new env, debugging drift, understanding architecture

**Key Files**:
- Mobile: `src/types/supabase.ts` (generated, committed)
- Validation Script: `scripts/check-types-local.sh`
- CI/CD Workflow: `.github/workflows/type-validation.yml`

## Runtime Environment Switching

**Status**: ✅ Production-Ready (Task 4 complete, 95% confidence)

**Three Environments**:
- **Local** (`local`): http://172.21.24.107:54321 - Rapid development
- **Cloud Dev** (`cloud-dev`): https://nuhwmubvygxyddkycmpa.supabase.co - Staging/preview
- **Cloud Prod** (`cloud-prod`): [Not configured] - Production

### Environment Commands

```bash
# Type Generation (Build-Time)
npm run types:local         # From local Supabase (3 sec)
npm run types:cloud-dev     # From cloud-dev Supabase
npm run types:cloud-prod    # From cloud-prod

# Type Validation
npm run types:check-local       # Verify local alignment
npm run types:check-cloud-dev   # Verify cloud-dev alignment
npm run types:check-cloud-prod  # Verify cloud-prod alignment

# Full Validation
npm run validate:local      # Types + TS + tests (local)
npm run validate:cloud-dev  # Types + TS + tests (cloud-dev)
npm run validate:cloud-prod # Types + TS + tests (cloud-prod)
```

### Runtime Switching (Dev Builds Only)

**Access**: Settings → Developer Settings → Select env → Apply & Restart

**Production Restriction**: Environment switching disabled in production builds (fixed to `cloud-prod`)

**Architecture**:
- `src/config/environments.ts` - Env definitions/validation
- `src/config/EnvironmentManager.ts` - Persistence (AsyncStorage)
- `src/config/hooks/useSupabaseEnvironment.ts` - React hook
- `src/services/supabase.ts` - Factory pattern for client creation
- `src/screens/DeveloperSettingsScreen.tsx` - UI

### Daily Workflows

**Local Development** (Most Common):
```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend && supabase start
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:check-local
npm run types:local  # If out of sync
npm start            # Auto-connects to local Supabase
git commit           # Hook validates types automatically
```

**Cloud Dev Testing**:
```bash
npm run types:cloud-dev
npm run validate:cloud-dev
# Settings → Dev Settings → Cloud Development → Apply & Restart
```

**Preview Build Prep**:
```bash
npm run types:check-cloud-dev
npm run types:cloud-dev  # If out of sync
npm run validate:cloud-dev
eas build --profile preview
```

### Troubleshooting

**"Types out of sync"**:
```bash
npm run types:check-local       # Determine target env
npm run types:local             # Regenerate if needed
git add src/types/supabase.ts
git commit -m "chore(types): sync with [env] schema"
```

**"Can't connect to local Supabase"**:
```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase start
supabase status  # Verify running
```

## Quality Control Standards

### Discovery Phase (Mandatory Before Coding)

1. **Read type definitions** in `/src/types/` FIRST before ANY test/code
2. **Use Read tool** to examine actual interfaces/implementations
3. **Use Grep tool** to verify method signatures in existing services
4. **Never assume** - always verify actual code structure

### Test Integrity (Zero Tolerance)

- **Never skip, delete, modify tests** without explicit user approval
- **Never use** `.skip()`, `.todo()`, comment-out as shortcuts
- **Never change test expectations** to make failing tests pass
- **Never reduce coverage** or scope without justification
- **Follow TDD**: Write tests BEFORE implementation (Red-Green-Refactor)

### Quality Gates (Must Pass)

1. **Test Gate**: 100% tests pass without modifications
2. **Type Gate**: Zero TS errors (`npm run type-check`)
3. **Integration Gate**: All service calls use correct method signatures
4. **TDD Gate**: Implementation satisfies original test requirements
5. **Evidence Gate**: All decisions backed by Context7 research FIRST
6. **UUID Consistency Gate**: All UUID handling maintains string types throughout
7. **Backend Sync Gate**: Types regenerated after ANY backend schema changes
8. **Type System Validation Gate**: Type system never empty (MANDATORY PRE-COMMIT CHECK)
   - **Check**: `test -s src/types/supabase.ts` (exists AND not empty)
   - **Minimum Size**: 50KB (typical: 50-100KB)
   - **Action**: Run `npm run types:local` if empty/suspiciously small
   - **Evidence**: T-008 committed empty supabase.ts → 189 TS errors → 10h remediation
9. **Pre-Commit Hook Enforcement Gate**: NEVER bypass without explicit approval
10. **Console.log Pollution Gate**: Zero console.log in production code (use logger.ts)
11. **TestID Coverage Gate**: All interactive components have testID props
12. **Input Validation Gate**: All user inputs have validation (Yup/zod schemas)
13. **Offline-First Architecture Gate**: All API integrations include OfflineService from start

### Git Commit QG Standards (Enforced)

**Pre-Commit Checklist** (automated via hooks):
- [ ] Type system validated: `npm run types:check-local` passes
- [ ] TS compilation: `npm run type-check` passes (0 NEW errors)
- [ ] Tests passing: `npm test` passes (80%+ coverage for new code)
- [ ] Linting: `npm run lint` passes (<50 violations)
- [ ] Type system not empty: `test -s src/types/supabase.ts && [ $(wc -c < src/types/supabase.ts) -gt 51200 ]`
- [ ] Zero console.log: `grep -r 'console\.log' src/ --exclude-dir=__tests__ | wc -l` → 0

**If Any Check Fails**:
1. **DO NOT** commit with `--no-verify`
2. **FIX** underlying issue
3. **RE-RUN** validation: `npm run validate:local`
4. **COMMIT** normally

**Commit Message Standards**:
- Use conventional commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`
- Reference task IDs: `feat(T-008): add AI model selection`
- Explain WHY, not WHAT: `fix(types): regenerate after backend schema change`

**Emergency Override Policy**:
Pre-commit hooks can be bypassed ONLY with:
- Explicit user approval
- Documented justification (in commit message)
- Immediate remediation task created
- Example: `git commit -m "fix(urgent): emergency hotfix (pre-commit disabled due to CI outage, remediation T-XXX)" --no-verify`

### TDD Enforcement

**Mandatory**: Write tests BEFORE implementation (RED → GREEN → REFACTOR)

**TDD Workflow**:
1. **RED**: Write failing test defining desired behavior
2. **GREEN**: Write minimal code to make test pass
3. **REFACTOR**: Improve code quality while tests passing

**Test Coverage Requirements**:
- **New Files**: 80%+ coverage mandatory
- **Modified Files**: No coverage reduction allowed
- **Critical Paths**: 100% coverage (auth, offline sync, data persistence)

**Test Types** (priority order):
1. **Integration Tests FIRST**: Real API + database + auth
2. **Unit Tests SECOND**: Complex business logic in isolation
3. **E2E Tests THIRD**: Critical user journeys (Maestro)

**Evidence-Based Learning** (backend project):
- Backend: 2+ days on elaborate mock infrastructure = WASTED TIME
- Testing real API behavior found issues immediately = EFFICIENT
- **Rule**: If test setup time > implementation time = WRONG APPROACH

**TDD Violation Consequences** (T-008 evidence):
- Zero tests → 3.5h remediation
- Production readiness 0% → 60% (with tests)
- Quality score 7.5/10 → 8.5/10 (with tests)

**Pre-Commit Gate**: Tests must pass before commit
- Run: `npm test -- --coverage --changedSince=HEAD`
- Threshold: 80% coverage for changed files
- Blocks commit if: coverage < 80% OR tests failing

### Security & Task Prioritization

**Risk-Based P0 Triage**:
Not all P0 tasks require immediate execution - **Assess BEFORE committing resources**:
- Actual risk level (LOW/MEDIUM/HIGH/CRITICAL)
- Development phase (local/preview/production)
- Time constraints (24h sprint vs multi-week project)
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
- **Evidence**: T-010 research (90min) → execution (15min) = 6x ROI
- **Pattern**: Complete research before deferral ensures execution-ready state
- **Deliverables**: 3 documents (security audit, execution plan, deferral justification)

**QG Bypass Consequences** (T-008 evidence):
- Pre-commit hook bypass → empty type system → 189 errors → 10h remediation
- TDD violation → zero tests → 3.5h test creation → production blocked
- **Rule**: NEVER bypass QGs without documented justification

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

**Overview**: 5 layers providing 95% prevention coverage with 20:1 ROI

### Layer 1: Developer Awareness (Documentation)

CLAUDE.md contains:
- QG standards with evidence-based rationale
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

**Required Enhancements** (based on T-008 learnings):
See `.git/hooks/pre-commit` for full implementation including:
- Type system empty check (min 50KB)
- Console.log pollution check (exclude tests/logger.ts)
- Test coverage check (changed files only)
- TS compilation check
- Linting check (<50 violations threshold)

### Layer 3: GitHub Actions (CI/CD Enforcement)

**Status**: ✅ Implemented (`.github/workflows/quality-gate-validation.yml`)

**Checks Performed**:
1. Type system not empty (min 50KB)
2. Zero console.log statements
3. Test coverage >= 70%
4. TS compilation passes
5. Linting passes

**PR Blocking**: Workflow failure blocks PR merge

**Parallel Workflows**:
- `type-validation.yml` - Type system alignment with cloud-dev
- `quality-gate-validation.yml` - Comprehensive QGs

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
- Manual review for business logic/UX

**Frequency**: After EVERY task completion (before marking complete)

### Layer 5: Post-Deployment Monitoring (Production Safety Net)

**Tools** (planned):
- Sentry error tracking
- Performance monitoring
- User feedback loop
- Analytics dashboards

**Alerts**: Runtime errors, performance degradation, type mismatches, API failures

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

## MCP Tools & When to Use

### Context7 - Library Documentation (Mandatory First Step)

**When**: ALWAYS before ANY implementation - verified 10x efficiency improvement

- `mcp__context7__resolve-library-id` - Find library ID from name
- `mcp__context7__get-library-docs` - Fetch comprehensive docs with examples

**Evidence-Based Pattern**:
```javascript
// MANDATORY: Research BEFORE implementation
// Backend Success: 2.5h → 15min debugging via Context7
mcp__context7__resolve-library-id({ libraryName: "react-native-sqlite" })
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/resolved/library",
  topic: "uuid-handling",
  tokens: 15000
})
```

**Example**: Getting RN, Expo, SQLite documentation - PROVEN to eliminate false solution paths

### Supabase MCP - Database & Backend

**When**: Managing Supabase database, migrations, edge functions

- `mcp__supabase__list_tables`, `mcp__supabase__execute_sql` - Database operations
- `mcp__supabase__list_migrations`, `mcp__supabase__apply_migration` - Schema management
- `mcp__supabase__generate_typescript_types` - Generate types from schema
- `mcp__supabase__search_docs` - Search Supabase documentation

### Serena MCP - Enhanced Development

**When**: Complex code analysis, intelligent editing

- **Symbolic Code Analysis** - Understand structure without reading entire files
- **Intelligent Editing** - Precise modifications using symbols/regex
- **Cross-Project Memory** - Persistent knowledge across sessions
- **Advanced Search** - Pattern-based code discovery

### IDE Integration

**When**: Need TS/linting diagnostics or run code in notebooks

- `mcp__ide__getDiagnostics` - Get VS Code language diagnostics
- `mcp__ide__executeCode` - Execute Python in Jupyter notebooks

### Playwright Browser Automation

**When**: Testing web interfaces or browser-based interactions

- `mcp__playwright__browser_*` - Full browser control (navigate, click, snapshot, etc.)

### Tool Coordination Strategy

1. **Context7**: MANDATORY FIRST - Library docs/vendor-specific patterns
2. **Claude Code**: PRIMARY - File ops, coding, testing, git, npm
3. **Specialized Agents**: Domain expertise (mobile-dev, quality-assurance-engineer, supabase-schema-architect)
4. **MCP Tools**: Coordination, memory, metrics, GitHub integration

**Proven Workflow**: Context7 Research → Claude Code Implementation → Specialized Agents → MCP Coordination

## AADF Framework

### Living Framework Documentation

**Critical**: This project = primary development laboratory for **AADF** - comprehensive methodology for AI-orchestrated software development.

**Framework Locations**:
- **Core**: `@project-context/learnings/ai-agentic-development-framework.md`
- **Philosophical**: `@project-context/learnings/philosophical-foundations-aadf.md`

### Framework Maintenance Directive (Mandatory)

Update AADF document with ALL discoveries/patterns/optimizations/learnings:

**Update Triggers**:
- New successful coordination patterns
- QG refinements/improvements
- Tool integration insights/optimizations
- Performance breakthrough discoveries
- Template scaffolding pattern improvements
- XPC learning integration opportunities

**Update Categories**:
- **Behavioral Patterns**: SuperClaude optimization discoveries
- **Orchestration Insights**: Claude Flow workflow improvements
- **Tool Coordination**: MCP integration pattern refinements
- **Quality Standards**: Zero-tolerance gate enhancements
- **Performance Metrics**: Efficiency measurement improvements
- **Template Evolution**: Scaffolding pattern discoveries
- **Philosophical Foundations**: Epistemological/ontological insights
- **Applied Philosophy**: Practical philosophical applications in development

### Framework Evolution Responsibility

Every developer/session MUST contribute:
1. **Document New Patterns**: Record successful workflows immediately
2. **Record Optimization Insights**: Capture performance improvements
3. **Update QG Standards**: Refine validation gates based on learnings
4. **Enhance Tool Integration**: Document MCP coordination discoveries
5. **Template Pattern Discovery**: Identify reusable scaffolding patterns
6. **Philosophical Integration**: Document epistemological/ontological insights
7. **Applied Philosophy**: Record practical philosophical applications

**Goal**: Create comprehensive, battle-tested framework packageable as `create-aadf-app` equivalent

## XPC Integration Insights (Backend Learnings)

### Reality-First Testing Methodology (Critical Learning)

**Discovered**: Backend spent 2+ days building elaborate test infrastructure instead of testing real user behavior
**Impact**: False security alerts, massive time waste vs feature delivery

**Mandatory Testing Priority Order**:
1. **User Journey Tests FIRST** (Real API + Auth + Database)
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
- No number conversion anywhere in data flow
- Database sync operations maintain UUID string integrity
- **Breaking Change**: Users must re-login after Task 11.8 completion

### Evidence-Based Development Results (Context7 Success)

**Backend Measured Results**:
- **Debugging Efficiency**: 10x improvement (2.5h → 15min)
- **False Solution Elimination**: 100% (avoided 4 major debugging paths)
- **Documentation Access**: 38,009+ vendor-specific code snippets vs 0 general sources
- **Solution Quality**: Official patterns vs custom workarounds

### XPC Status

- **Backend**: 98% deployment ready (Phase 2 AADF complete)
- **Mobile**: Task 11.8 UUID alignment required before proceeding
- **Integration**: Backend ready for mobile app development continuation

## MVP2 Development Context

### Current Task Status

- **Live Dashboard**: http://localhost:3333 (run `./start.sh` in `@project-context/development-context/project-progress-tracker/`)
- **Master Plan**: `@project-context/development-context/MVP2/implementation/execution/MVP2-MASTER-EXECUTION-PLAN.md`
- **Metrics Tracker**: `@project-context/development-context/MVP2/implementation/execution/MVP2-METRICS-TRACKER.md`
- **Task Specs**: `@project-context/development-context/MVP2/implementation/tasks/task_*.txt`

### Primary Documentation

- **Implementation Spec**: `@project-context/development-context/MVP2/implementation-spec-v1.4.md` (17.5k tokens - read when needed, in `.claudeignore`)
- **User Roles**: `@project-context/development-context/MVP2/specifications/user-roles-permissions.md` (4-tier RBAC)
- **Testing Standards**: `@project-context/development-context/MVP2/implementation/guides/testing-standards.md`
- **API Integration**: `@project-context/development-context/MVP2/implementation/guides/api-integration-guide.md`
- **Component Patterns**: `@project-context/development-context/MVP2/implementation/guides/component-patterns.md`

### Backend Integration

- **Backend Repo**: `~/dev/wildlifeai/wildlife-watcher-backend` (separate Git repo)
- **Backend Status**: `~/wildlife-watcher-backend/project-context/PROJECT-STATUS.md`
- **XPC Tasks**: `~/wildlife-watcher-backend/project-context/MVP2-Tasks/`
- **Backend Type Automation**: Backend has automated type sync with pre-commit hooks. See `~/wildlife-watcher-backend/project-context/documentation/QUICK-REFERENCE-TYPE-AUTOMATION.md`

### XPC System

**Location**: `~/dev/wildlifeai/cross-project-coordination/` (shared hub: mobile/backend)

#### Basic Coordination (Daily Use)

**Quick Workflow**:
```bash
# 1. Check backend inbox daily
ls ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/

# 2. Read message
cat ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/msg.md

# 3. Action (e.g., schema change)
npm run types:local  # 3 sec to regenerate types

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

**Basic Docs**:
- **Quick Start**: `~/dev/wildlifeai/cross-project-coordination/COORDINATION-QUICK-START.md`
- **Type Sync Guide**: `~/dev/wildlifeai/cross-project-coordination/TYPE-SYNC-GUIDE.md`
- **System Reference**: `~/dev/wildlifeai/cross-project-coordination/SYSTEM-REFERENCE-GUIDE.md`

#### Dynamic Coordination System (Large Projects)

**Status**: ✅ Production-Ready (2025-11-01)

For **large-scale coordinated projects** with 3+ tasks, milestone-based execution, cloud-dev deployment coordination:

**Important Clarification** (Backend Team Confirmed):
- **Flat-Inbox System**: DEFAULT for day-to-day coordination (schema changes, status updates, task requests)
- **Dynamic System**: ONLY for special case projects meeting criteria below

**When to Use Dynamic System**:
✅ Project has 3+ coordinated tasks across teams
✅ Requires milestone-based execution with human review
✅ Needs cloud-dev deployment coordination
✅ Has task dependencies requiring careful sequencing
✅ May exceed 200k context window (complex projects)

**Examples**:
- **Dynamic**: BLE DFU integration, Auth redesign, API migrations, Multi-tenant features
- **Flat-Inbox**: Schema changes, type regeneration, status updates, simple task requests

**Initialize Project**:
```bash
cd ~/dev/wildlifeai/cross-project-coordination
./.scripts/init-project.sh \
  --slug "project-name" \
  --title "Project Title" \
  --teams "mobile,backend"
```

**Send Message**:
```bash
./.scripts/send-message.sh \
  --project "project-name" \
  --from "mobile" \
  --to "backend" \
  --type "deployment-ready" \
  --message "Preview build complete. Build ID: abc123."
```

**Check Inbox**:
```bash
./.scripts/check-inbox.sh --project "project-name" --team "mobile"
```

**Core Components**:
- 6 coordination scripts (init, send, check, watch)
- 10 templates (task definitions, milestones, checklists)
- Project isolation (dedicated folder per project)
- Task orchestration with dependency tracking
- Milestone-based workflow (Local → Cloud-Dev → Preview → Stakeholder)

**Dynamic Docs**:
- **Comprehensive**: `@project-context/development-context/MVP2/implementation/execution/cross-project-coordination/DYNAMIC-COORDINATION-SYSTEM-GUIDE.md` (PRIMARY)
- **Quick Start**: `~/dev/wildlifeai/cross-project-coordination/QUICK-START-DYNAMIC-COORDINATION.md`
- **Troubleshooting**: `~/dev/wildlifeai/cross-project-coordination/TROUBLESHOOTING-DYNAMIC-COORDINATION.md`

**Key Principles**:
- Flat monthly archive (no nested folders)
- Bidirectional inbox (no outbox)
- Send → Inbox → Archive → Log workflow
- Daily inbox checks (or pre-commit warnings)
- Per-project isolation (failure isolation)
- Template-driven project bootstrap

#### Active Coordination Projects

**MVP2 Tranche 1: Foundation & Replanning** (2025-11-01)
- **Location**: `~/dev/wildlifeai/cross-project-coordination/projects/mvp2-tranche1-foundation-replanning`
- **Objective**: Get Tasks 1-14 working with backend schema alignment (24h target)
- **Scope**: Code review remediation, backend schema migration, foundation stabilization
- **Planning**: `@project-context/development-context/documentation-cleanup/planning/UPDATED-REPLANNING-PROMPT.md`

**Strategy**: Two-tranche approach
- **Tranche 1** (Current): Foundation + Tasks 1-14 (get what exists working)
- **Tranche 2** (Future): New features Tasks 15-23 (plan separately after Tranche 1 success)

**Check Inbox**:
```bash
~/dev/wildlifeai/cross-project-coordination/.scripts/check-inbox.sh \
  --project "mvp2-tranche1-foundation-replanning" \
  --team "mobile"
```

**Send to Backend**:
```bash
~/dev/wildlifeai/cross-project-coordination/.scripts/send-message.sh \
  --project "mvp2-tranche1-foundation-replanning" \
  --from "mobile" \
  --to "backend" \
  --type "status-update" \
  --message "Your message"
```

## Development Workflow

### Session Startup (Automatic - Run Every Session Start)

**Critical**: At EVERY session start, I (Claude Code) automatically check for XPC notifications:

```bash
# Check for backend messages (run automatically)
~/dev/wildlifeai/cross-project-coordination/.scripts/check-notifications.sh mobile

# If notifications exist, read inbox
~/dev/wildlifeai/cross-project-coordination/.scripts/check-inbox.sh \
  --project "mvp2-tranche1-foundation-replanning" \
  --team "mobile"
```

**Why**: Backend may have sent schema changes, deployment updates, planning feedback while offline. Auto-check ensures never missing critical coordination messages.

**Watcher**: Background watcher monitors inboxes 24/7, creates JSON notifications in `.notifications/` when messages arrive.

**What I Do When Notifications Found**:
1. Report to user: "Found X coordination messages from backend team"
2. Read and summarize each message
3. Take appropriate action (schema update, planning input, etc.)
4. Mark notifications as handled

---

### Before Starting Any Task

1. **Check Coordination Notifications**: AUTOMATIC at session start (see above)
2. **Check Current Status**: View dashboard (http://localhost:3333)
3. **Review Strategy**: Consult `MVP2-MASTER-EXECUTION-PLAN.md`
4. **Get Requirements**: Read `implementation-spec-v1.4.md` + specific task file
5. **Verify Types**: Run `npm run types:check-local` (or appropriate env) if backend schema changed
6. **Confirm Environment**: Check Supabase env targeting (local/cloud-dev/cloud-prod)
7. **Start Tracking**: Note start time in `MVP2-METRICS-TRACKER.md`

### During Development

- **Research FIRST**: Use Context7 for library docs (proven 10x efficiency)
- **Write tests BEFORE code**: Follow TDD (Red-Green-Refactor)
- **Track time**: Document blockers, actual hours in metrics tracker
- **Follow execution strategy**: Incremental/parallel/hybrid per master plan
- **Adhere to QGs**: Defined in execution plan

### After Task Completion

- **Update metrics tracker**: Record actual time vs estimates
- **Monitor progress**: Check dashboard for status
- **Commit regularly**: At sensible points (subtask completion) with descriptive messages
- **Check XPC status**: If applicable

### Important Development Instructions

- Reference task details in `@project-context/development-context/MVP2/implementation/tasks/` before implementation
- Check files into git regularly at sensible points (after subtask completion)
- Update progress docs after completing each task/feature/subtask
- Preserve implementation context for session recovery

## Documents to Keep Updated

**ALWAYS UPDATE** as you work:

1. **Metrics Tracker**: `@project-context/development-context/MVP2/implementation/execution/MVP2-METRICS-TRACKER.md`
   - Record actual vs estimated hours for every task
   - Track start/end times for accuracy
   - Update completion status, variance analysis
   - Document blockers, solutions

2. **Learning Log**: `@project-context/learnings/claude-flow-usage-log.md`
   - Document patterns discovered
   - Record problem solutions
   - Capture best practices
   - Track development progress/velocity

3. **Integration Progress**: When working on backend
   - Update `supabase-integration-progress.md`
   - Document API changes
   - Record migration status

4. **XPC Database Tasks**: When database changes needed
   - Create/update task files in `~/wildlife-watcher-backend/project-context/MVP2-Tasks/`
   - Reference backend status: `~/wildlife-watcher-backend/project-context/PROJECT-STATUS.md`
   - Follow backend patterns: `~/wildlife-watcher-backend/CLAUDE.md`

## Task Alignment Protocol

**Before starting ANY MVP2 task/subtask**:
1. **Read Implementation Spec**: `@project-context/development-context/MVP2/implementation-spec-v1.4.md`
2. **Read Task File**: Corresponding file in `@project-context/development-context/MVP2/implementation/tasks/`
3. **Check Master Plan**: `@project-context/development-context/MVP2/implementation/execution/MVP2-MASTER-EXECUTION-PLAN.md`
4. **Verify Alignment**: Cross-reference:
   - `specifications/user-roles-permissions.md`
   - `specifications/admin-portal-spec.md`
5. **Flag Inconsistencies**: Report discrepancies to user for clarification

Ensures task/subtask aligns with latest specs/architecture decisions.

## Reference Documentation

### Testing & QC

See `@project-context/development-context/MVP2/implementation/guides/testing-standards.md` for:
- Comprehensive testing methodology
- TestID patterns/conventions
- Test structure/organization
- Commit strategies

### Agent Reference

See `@project-context/agent-reference.md` for:
- Complete list of 54+ agents
- Agent descriptions/capabilities
- Agent selection guidelines
- Coordination patterns

### SuperClaude Architecture

See `@project-context/superclaude-architecture.md` for:
- SuperClaude + Claude Code integration
- Task management commands
- Context preservation features
- Session recovery mechanisms

### Command Examples

See `@project-context/command-examples.md` for:
- Execution patterns/examples
- Agent coordination protocols
- MCP tool categories
- Performance benefits

## Environment Configuration

**Key Files**:
- `.env.local` - Local env vars (gitignored)
- `.env.example` - Template for required vars
- `app.config.js` - Expo config (dynamic based on NODE_ENV)

**Required Env Vars**:
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `GOOGLE_MAPS_API_KEY_ANDROID` - Google Maps for Android
- `GOOGLE_MAPS_API_KEY_IOS` - Google Maps for iOS

## Stack Best Practices & Research (2024)

**Critical**: Comprehensive research completed on RN + Expo + Supabase best practices

**Research Docs** (MUST READ before major architectural decisions):
- **Comprehensive**: `@documentation/developer-docs/Stack-Best-Practices-Research-2024.md` (Quick Reference)
- **Testing Architecture**: Research docs available for offline-first testing patterns
- **Production Security**: Production security/performance guides available

**Key Findings**:
- **Type Sync**: 80% coverage (git hooks) → 95% with CI/CD (✅ GitHub Actions workflow added)
- **Testing**: Maestro recommended for E2E (official Expo support, 2h setup vs 4+ h for Detox)
- **Performance**: SQLite WAL mode enabled ✅ (5-10x write performance improvement)
- **Security**: Console.log removal pattern, SecureStore for credentials, RLS optimization patterns
- **Bundle Size**: 12.27 MB (baseline measured, optimization opportunities identified)

**Evidence-Based ROI**:
- GitHub Actions type validation: 160:1 ROI (15min → 40h saved annually)
- Backend measured: 10x debugging efficiency improvement via Context7 research
- Context7 analysis: 38,000+ vendor-specific code snippets validated

**Infrastructure Improvements** (Task 24):
- [x] GitHub Actions type validation (`.github/workflows/type-validation.yml`)
- [x] SQLite WAL mode (enabled in DatabaseService.ts)
- [x] Bundle analysis baseline (12.27 MB Android bundle)
- [ ] Maestro E2E testing setup (2h)
- [ ] Security audit (console.log removal, env var validation)
- [ ] Nightly type reconciliation
- [ ] Production monitoring (Sentry)
- [ ] RLS performance optimization (backend coordination)

**Action Items**: See Task 24 (`@project-context/development-context/MVP2/implementation/tasks/task_024_infrastructure_quality_improvements.txt`)

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

## WW AADF Agent Ecosystem

**Status**: ✅ Phase 1 P0 MVP Complete (2025-11-09)
**Production Readiness**: 95%
**Docs**: `@project-context/investigation/aadf-work-smart/2025-11-09-PHASE-1-P0-MVP-COMPLETION-REPORT.md`

### 🔴 Critical Usage Rule: Project-Specific Agents ALWAYS Take Priority

**Mandatory Agent Selection Hierarchy**:

1. **FIRST**: Use WW project-specific agents (`ww-aadf-mobile-*` and `/ww-aadf-mobile-*` commands)
2. **SECOND**: Use generic agents ONLY if:
   - No project-specific agent exists for task
   - Explicit justification provided to user
   - User explicitly approves generic agent usage

**Violation Policy**: Using generic agents without justification = **CRITICAL ERROR** equivalent to bypassing QGs

**Examples**:
- ✅ **CORRECT**: `/ww-aadf-mobile-validate` for QG validation
- ❌ **WRONG**: Using generic `quality-assurance-engineer` without justification
- ✅ **CORRECT**: `/ww-aadf-mobile-implement` for feature implementation
- ❌ **WRONG**: Using generic `coder` without justification
- ✅ **CORRECT**: Inform user if no project-specific agent exists, request approval for generic

**Justification Template** (when generic agent necessary):
```
NOTICE: Using generic agent [agent-name] because:
- No project-specific agent for [specific capability]
- Project-specific agent [ww-aadf-mobile-X] doesn't cover [specific requirement]
- Awaiting user approval to proceed
```

**Evidence**: Project-specific agents contain:
- WW architecture context (App.tsx layers, RTK, offline-first)
- 13 QGs enforcement (T-008 prevention)
- Context7 research integration (10x efficiency)
- Testing strategy (REAL Supabase only)
- Type sync (5-layer defense)

### Overview

Specialized agent ecosystem for enforcing QGs, preventing type drift, orchestrating TDD/BDD workflows. All agents created with proper Claude Code formatting (YAML frontmatter), comprehensive specs.

### P0 Mobile Agents (5)

1. **ww-aadf-mobile-quality-enforcer** (.claude/agents/ww-mobile-agents/)
   - Enforce all 13 QGs before commits/PR merges
   - Blocking enforcement (no bypasses without approval)
   - Pre-commit hook + GitHub Actions + manual review integration

2. **ww-aadf-mobile-type-guardian** (.claude/agents/ww-mobile-agents/)
   - Prevent type drift across environments (local, cloud-dev, cloud-prod)
   - 5-layer defense strategy (99% prevention rate)
   - Breaking change detection/validation

3. **ww-aadf-mobile-offline-validator** (.claude/agents/ww-mobile-agents/)
   - Validate offline-first coverage (current: 10%, target: 100%)
   - Service-by-service compliance analysis
   - Migration priority/effort estimation

4. **ww-aadf-mobile-test-architect** (.claude/agents/ww-mobile-agents/)
   - Orchestrate TDD/BDD testing strategy
   - REAL Supabase testing only (no mocks policy)
   - Integration tests FIRST, then unit, then E2E

5. **ww-aadf-mobile-implementation-expert** (.claude/agents/ww-mobile-agents/)
   - End-to-end feature implementation
   - Context7 research FIRST (proven 10x efficiency)
   - QGs enforced from start

### Coordination Agent (1)

6. **ww-aadf-coordinator** (.claude/agents/coordination/)
   - XPC mobile-backend coordination
   - Message routing (schema-change, task-request, status-update, deployment-ready)
   - Milestone validation/session recovery

### P0 Slash Commands (6)

**Quality & Validation**:
- `/ww-aadf-mobile-validate [gate]` - Run all 13 QGs
- `/ww-aadf-mobile-review [files]` - Comprehensive code review
- `/ww-aadf-mobile-fix-types [env]` - Quick type regeneration (local/cloud-dev/cloud-prod)
- `/ww-aadf-mobile-check-offline [service]` - Validate offline-first coverage

**Development**:
- `/ww-aadf-mobile-implement [feature]` - End-to-end feature implementation with TDD
- `/ww-aadf-mobile-test [type]` - TDD test suite orchestration (unit/integration/e2e/all)

### Usage Examples

```bash
# Validate all QGs before commit
/ww-aadf-mobile-validate all

# Implement feature with TDD + QGs
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

**Before spawning ANY agent, follow this tree**:

```
START
  ↓
Is task related to: QGs, type sync, offline-first, testing, feature implementation?
  ↓ YES
Use appropriate /ww-aadf-mobile-* command or ww-aadf-mobile-* agent
  ↓ DONE
  ↓ NO
Does project-specific agent exist for this task category?
  ↓ YES
Use project-specific agent with full context
  ↓ DONE
  ↓ NO
STOP → Inform user: "No project-specific agent for [task]. Request approval for generic [name]?"
  ↓ USER APPROVES
Use generic agent + document justification
  ↓ DONE
```

**Common Task Mappings** (ALWAYS use project-specific):

| Task Category | Use This | NOT Generic |
|---------------|----------|-------------|
| Quality validation | `/ww-aadf-mobile-validate` | ❌ quality-assurance-engineer |
| Feature implementation | `/ww-aadf-mobile-implement` | ❌ coder, implementation-expert |
| Code review | `/ww-aadf-mobile-review` | ❌ code-analyzer, reviewer |
| Testing | `/ww-aadf-mobile-test` | ❌ tester, quality-assurance-engineer |
| Type sync | `/ww-aadf-mobile-fix-types` | ❌ type-guardian (generic) |
| Offline-first validation | `/ww-aadf-mobile-check-offline` | ❌ architecture (generic) |
| XPC | `ww-aadf-coordinator` | ❌ project-coordinator (generic) |

### Key Benefits

**Time Savings**: 62.5% (parallel agent creation: 1.5h vs 4h sequential)
**Projected ROI**: 218:1 (2h investment → 437h annual savings)
**Prevention Rate**: 100% for T-008-style failures
**Evidence-Based**: Context7 research (38,000+ code snippets), T-008 case study learnings

### Architecture Integration

All agents understand WW architecture:
- App.tsx layer inheritance (Safe Area → RTK → Navigation → BLE → Auth)
- Offline-first pattern (SQLite → Queue → Sync → Supabase)
- 13 QGs (ALL BLOCKING)
- Testing strategy (REAL Supabase only, no mocks)
- Type sync (5-layer defense-in-depth)

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
