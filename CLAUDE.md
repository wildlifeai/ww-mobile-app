<!-- ANTHROPIC_CACHE: claude.md/context -->
# CLAUDE.md

Wildlife Watcher Mobile App guidance for Claude Code.

## Abbreviations

- AADF: AI Agentic Development Framework
- TDD: Test-Driven Development
- BDD: Behavior-Driven Development
- E2E: End-to-End
- RN: React Native
- RTK: Redux Toolkit
- RBAC: Role-Based Access Control
- XPC: Cross-Project Coordination
- QG: Quality Gate
- WW: Wildlife Watcher

## Project Overview

**WW Mobile App** - RN field deployment tool for wildlife camera management with offline-first architecture.

**Tech Stack**: Expo SDK 51, RN 0.74.5, TypeScript, RTK, Supabase
**Build**: Custom Development Build (NOT Expo Go)
**Architecture**: Offline-first, SQLite sync, BLE + LoRaWAN, multi-tenancy
**Testing**: Jest (unit/integration), Maestro (E2E/BDD)
**Development**: SPARC methodology, TDD/BDD

## Essential Commands

```bash
# Development
npm start                              # Metro bundler
npx expo run:android                   # Build + run Android
eas build --profile development        # EAS cloud build

# Testing
npm test                               # Jest
npm run test:maestro                   # E2E tests
npm run type-check                     # TS validation

# Type Sync (CRITICAL - run after ANY backend schema changes)
npm run types:local                    # Generate from local Supabase (3 sec)
npm run types:check-local              # Verify alignment
npm run validate:local                 # Full validation

# Cloud environments
npm run types:cloud-dev                # Generate from cloud-dev
npm run validate:cloud-dev             # Full cloud-dev validation
```

## Directory Structure

```
src/
├── services/offline/    # OfflineService, SyncService, DatabaseService
├── redux/               # RTK state (slices, api, middleware)
├── types/supabase.ts    # Generated types (DO NOT EDIT)
├── navigation/          # RN Navigation
├── screens/             # Screen components
└── App.tsx              # Root

tests/
├── unit/                # Jest unit
├── integration/         # Jest integration
└── maestro/             # E2E (.yaml)
```

## Type Sync Critical Path

**Full Details**: `@project-context/learnings/type-drift-prevention-5-layer-defense.md`

**5-Layer Defense** (99% prevention):
1. Backend pre-commit → blocks stale types
2. Coordination messages (manual quality)
3. Mobile inbox check (daily)
4. Mobile pre-commit → **BLOCKS commits** ✅
5. GitHub Actions → **BLOCKS PR merge** ✅

**Daily**: `npm run types:local` (3 sec, hook auto-validates)

**Key Files**:
- `src/types/supabase.ts` (generated, committed)
- `scripts/check-types-local.sh`
- `.github/workflows/type-validation.yml`

## Runtime Environment Switching

**Guide**: `@project-context/development-context/MVP2/implementation/execution/cross-project-coordination/protocols/type-synchronization/multi-environment-type-sync-guide.md`

**Environments**:
- **local**: http://172.21.24.107:54321 - Rapid development
- **cloud-dev**: https://nuhwmubvygxyddkycmpa.supabase.co - Staging
- **cloud-prod**: [Not configured] - Production

**Access**: Settings → Dev Settings → Select env → Apply & Restart

**Troubleshooting**:
```bash
npm run types:check-local       # Check alignment
npm run types:local             # Regenerate if needed
```
<!-- END_CACHE -->

<!-- ANTHROPIC_CACHE: claude.md/critical_rules -->
## 🔴 Critical Rules

### 1. Concurrent Execution (MANDATORY)
ALL operations MUST be concurrent/parallel in single message:
- **TodoWrite**: Batch ALL todos in ONE call (5-10+ minimum)
- **Task tool**: Spawn ALL agents in ONE message
- **File ops**: Batch ALL reads/writes/edits in ONE message
- **Bash**: Batch ALL terminal operations in ONE message

### 2. File Organization (NEVER root folder)
- `/src` - Source code
- `/tests` - Test files
- `/project-context` - Development docs
- `/documentation` - Reference docs

### 3. Evidence-Based Development
**MANDATORY**: Context7 research FIRST, ALWAYS
- **Evidence**: 10x debugging efficiency (2.5h → 15min)
- **Proven**: Eliminates false solution paths

### 4. WW Project-Specific Agents First
**CRITICAL**: Use WW agents FIRST - generic ONLY with explicit justification + user approval
- ✅ `/ww-aadf-mobile-validate` for QG
- ❌ Generic `quality-assurance-engineer` without justification

### 5. Pre-Commit Hook Enforcement
**ABSOLUTE**: NEVER `git commit --no-verify`
- **Why**: Validates types, runs tests, enforces security
- **Evidence**: T-008 bypass → 189 errors → 10h remediation
- **Exception**: ONLY with user approval + documented justification

### 6. Type System Validation
Type system must NEVER be empty:
- **Check**: `test -s src/types/supabase.ts` (min 50KB)
- **Action**: `npm run types:local` if empty
- **Evidence**: T-008 empty supabase.ts → 189 TS errors
<!-- END_CACHE -->

<!-- ANTHROPIC_CACHE: claude.md/quality_gates -->
## Quality Gates (Must Pass - ALL BLOCKING)

**Full Details**: `@project-context/development-context/MVP2/implementation/guides/testing-standards.md`

**13 Quality Gates**:
1. **Test Gate**: 100% tests pass without modifications
2. **Type Gate**: Zero TS errors
3. **Integration Gate**: Correct method signatures
4. **TDD Gate**: Tests written BEFORE implementation
5. **Evidence Gate**: Context7 research FIRST
6. **UUID Consistency**: String types throughout
7. **Backend Sync**: Types regenerated after schema changes
8. **Type System Validation**: Never empty (min 50KB)
9. **Pre-Commit Enforcement**: NEVER bypass
10. **Console.log Pollution**: Zero in production (use logger.ts)
11. **TestID Coverage**: All interactive components
12. **Input Validation**: All inputs (Yup/zod)
13. **Offline-First**: OfflineService from start

**Pre-Commit Checklist** (automated):
- [ ] `npm run types:check-local` passes
- [ ] `npm run type-check` passes (0 NEW errors)
- [ ] `npm test` passes (80%+ coverage new code)
- [ ] `npm run lint` passes (<50 violations)
- [ ] Type system not empty (>50KB)
- [ ] Zero console.log in src/

**If Fails**: FIX issue → `npm run validate:local` → commit normally

**Commit Standards**:
- Conventional commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`
- Reference tasks: `feat(T-008): add feature`
- Explain WHY: `fix(types): regenerate after backend schema change`

## TDD Enforcement (MANDATORY)

**RED → GREEN → REFACTOR**

**Test Priority**:
1. **Integration FIRST**: Real API + database + auth
2. **Unit SECOND**: Complex logic in isolation
3. **E2E THIRD**: Critical user journeys (Maestro)

**Coverage**:
- New files: 80%+ mandatory
- Modified files: No reduction allowed
- Critical paths: 100% (auth, offline sync, persistence)

**Evidence** (T-008):
- Zero tests → 3.5h remediation
- Production readiness 0% → 60% (with tests)

**Rule**: If test setup time > implementation time = WRONG APPROACH
<!-- END_CACHE -->

## Architecture Patterns

**Offline-First**: Local SQLite → Queue → Sync → Supabase
**State**: RTK slices, RTK Query, custom middleware
**Auth**: Supabase Auth, 4-tier RBAC (ww_admin, project_admin, project_member, anonymous)

**Key Services**:
- `services/offline/OfflineService.ts` - Main coordinator
- `services/offline/DatabaseService.ts` - SQLite CRUD
- `services/offline/SyncService.ts` - Sync queue, retry
- `redux/middleware/offlineSyncMiddleware.ts` - Redux bridge

**RBAC Details**: `@project-context/development-context/MVP2/specifications/user-roles-permissions.md`

## MCP Tools

### Context7 (MANDATORY FIRST)
**When**: ALWAYS before implementation
```javascript
mcp__context7__resolve-library-id({ libraryName: "react-native-sqlite" })
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/resolved/library",
  topic: "uuid-handling",
  tokens: 15000
})
```

### Supabase MCP
- Database ops: `list_tables`, `execute_sql`
- Schema: `list_migrations`, `apply_migration`
- Types: `generate_typescript_types`

### Serena MCP
- Symbolic code analysis
- Intelligent editing
- Cross-project memory

**Tool Coordination**: Context7 → Claude Code → Specialized Agents → MCP

## AADF Framework

**Core**: `@project-context/learnings/ai-agentic-development-framework.md`
**Philosophy**: `@project-context/learnings/philosophical-foundations-aadf.md`

**Framework Maintenance** (MANDATORY):
Update AADF with ALL discoveries: coordination patterns, QG refinements, tool insights, performance breakthroughs, template patterns

**Goal**: Create `create-aadf-app` equivalent

## XPC Integration

**Backend Learnings**:
- **Reality-First Testing**: User journey tests FIRST, integration SECOND, unit LAST
- **UUID Consistency**: String types throughout entire system
- **Context7 Success**: 10x efficiency (2.5h → 15min debugging)

## MVP2 Development

**Dashboard**: http://localhost:3333
**Master Plan**: `@project-context/development-context/MVP2/implementation/execution/MVP2-MASTER-EXECUTION-PLAN.md`
**Metrics**: `@project-context/development-context/MVP2/implementation/execution/MVP2-METRICS-TRACKER.md`
**Tasks**: `@project-context/development-context/MVP2/implementation/tasks/task_*.txt`

**Primary Docs**:
- Implementation Spec: `@project-context/development-context/MVP2/implementation-spec-v1.4.md`
- User Roles: `@project-context/development-context/MVP2/specifications/user-roles-permissions.md`
- Testing: `@project-context/development-context/MVP2/implementation/guides/testing-standards.md`

### XPC System

**Location**: `~/dev/wildlifeai/cross-project-coordination/`

**Daily Workflow**:
```bash
# 1. Check inbox
ls ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/

# 2. Read message
cat ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/msg.md

# 3. Action (schema change)
npm run types:local

# 4. Archive
mv msg.md ~/dev/wildlifeai/cross-project-coordination/archive/$(date +%Y-%m)/
```

**Message Types**: `schema-change`, `task-request`, `status-update`, `generic-message`

**Dynamic System** (large projects only):
- 3+ coordinated tasks across teams
- Milestone-based execution
- Cloud-dev deployment coordination
- **Guide**: `@project-context/development-context/MVP2/implementation/execution/cross-project-coordination/DYNAMIC-COORDINATION-SYSTEM-GUIDE.md`

### Session Startup (AUTOMATIC)

**CRITICAL**: Every session, auto-check XPC notifications:
```bash
~/dev/wildlifeai/cross-project-coordination/.scripts/check-notifications.sh mobile
```

**Why**: Backend may send schema changes/updates while offline

### Before Any Task

1. Check XPC notifications (automatic)
2. View dashboard (http://localhost:3333)
3. Read task file: `@project-context/development-context/MVP2/implementation/tasks/task_*.txt`
4. Verify types: `npm run types:check-local`
5. Start tracking in metrics tracker

### During Development

- **Research FIRST**: Context7 (proven 10x efficiency)
- **Tests BEFORE code**: TDD (Red-Green-Refactor)
- **Track time**: Document blockers in metrics
- **Adhere to QGs**: All 13 gates

### After Completion

- Update metrics tracker (actual vs estimates)
- Commit regularly (subtask completion)
- Check XPC status

## Documents to Update

**ALWAYS UPDATE**:
1. **Metrics**: `@project-context/development-context/MVP2/implementation/execution/MVP2-METRICS-TRACKER.md`
2. **Learning Log**: `@project-context/learnings/claude-flow-usage-log.md`
3. **Integration Progress**: When working on backend

## WW AADF Agent Ecosystem

**Status**: ✅ Phase 1 P0 MVP Complete (95% ready)
**Full Details**: `@project-context/investigation/aadf-work-smart/2025-11-09-PHASE-1-P0-MVP-COMPLETION-REPORT.md`
**Quick Reference**: `@project-context/investigation/aadf-work-smart/QUICK-REFERENCE-AGENT-INVENTORY.md`

### 🔴 Critical: Project-Specific Agents ALWAYS First

**Hierarchy**:
1. **FIRST**: WW agents (`ww-aadf-mobile-*`, `/ww-aadf-mobile-*`)
2. **SECOND**: Generic ONLY if no WW agent exists + user approval + justification

**Examples**:
- ✅ `/ww-aadf-mobile-validate` for QG validation
- ❌ Generic `quality-assurance-engineer` without justification

### P0 Agents (5)

1. **ww-aadf-mobile-quality-enforcer** - Enforce 13 QGs (blocking)
2. **ww-aadf-mobile-type-guardian** - Prevent type drift (5-layer defense)
3. **ww-aadf-mobile-offline-validator** - Validate offline-first coverage
4. **ww-aadf-mobile-test-architect** - Orchestrate TDD/BDD (REAL Supabase only)
5. **ww-aadf-mobile-implementation-expert** - E2E feature implementation

### Coordination Agent (1)

6. **ww-aadf-coordinator** - XPC mobile-backend coordination

### P0 Commands (6)

**Quality**:
- `/ww-aadf-mobile-validate [gate]` - Run all 13 QGs
- `/ww-aadf-mobile-review [files]` - Code review
- `/ww-aadf-mobile-fix-types [env]` - Type regeneration
- `/ww-aadf-mobile-check-offline [service]` - Offline coverage

**Development**:
- `/ww-aadf-mobile-implement [feature]` - E2E with TDD
- `/ww-aadf-mobile-test [type]` - Test orchestration

**Common Mappings**:
| Task | Use This | NOT Generic |
|------|----------|-------------|
| Quality validation | `/ww-aadf-mobile-validate` | ❌ quality-assurance-engineer |
| Feature implementation | `/ww-aadf-mobile-implement` | ❌ coder |
| Code review | `/ww-aadf-mobile-review` | ❌ code-analyzer |
| Testing | `/ww-aadf-mobile-test` | ❌ tester |
| Type sync | `/ww-aadf-mobile-fix-types` | ❌ type-guardian |

**Benefits**:
- Time: 62.5% savings (1.5h vs 4h)
- ROI: 218:1 (2h → 437h annual)
- Prevention: 100% for T-008 failures

## Reference Docs

**Testing & QC**: `@project-context/development-context/MVP2/implementation/guides/testing-standards.md`
**Agents**: `@project-context/agent-reference.md`
**SuperClaude**: `@project-context/superclaude-architecture.md`
**Commands**: `@project-context/command-examples.md`
**Stack Best Practices**: `@documentation/developer-docs/Stack-Best-Practices-Research-2024.md`

## Environment Config

**Files**:
- `.env.local` - Local vars (gitignored)
- `.env.example` - Template
- `app.config.js` - Expo config

**Required Vars**:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_MAPS_API_KEY_ANDROID`
- `GOOGLE_MAPS_API_KEY_IOS`

## Code Style

- **TypeScript**: Strict mode, types over interfaces
- **Modular**: Files <500 lines
- **Environment**: Never hardcode secrets
- **Clean Architecture**: Separate concerns
- **Test-First**: Tests before implementation
- **Documentation**: Update as you code
- **Evidence-Based**: Context7 BEFORE implementation

## Quick Setup

```bash
claude mcp add claude-flow npx claude-flow@alpha mcp start
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env
uvx --from git+https://github.com/oraios/serena serena start-mcp-server
```

## Support

- **Docs**: https://github.com/ruvnet/claude-flow
- **Issues**: https://github.com/ruvnet/claude-flow/issues
- **Repo**: https://github.com/wildlifeai/wildlife-watcher-mobile-app
- **Overview**: https://www.youtube.com/watch?v=Ima3n2EYfeE
