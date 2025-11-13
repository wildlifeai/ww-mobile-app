# Continuation Prompt - Specialized Agent Ecosystem Implementation

**Date Created**: 2025-11-09
**Project**: Wildlife Watcher Mobile App - AADF Agent Ecosystem
**Status**: Planning Complete, Ready for Implementation
**Context Window**: New session continuation

---

## 🎯 Mission

Continue implementing the specialized agent ecosystem for Wildlife Watcher mobile app to prevent T-008-style quality failures through enforced quality gates and project-specific agents.

---

## 📋 What Has Been Completed

### 1. Planning Documents Created

**Main Plan**: `project-context/investigation/aadf-work-smart/2025-11-09-REVISED-specialized-agent-ecosystem-plan.md`
- 3,894 lines, 115KB
- Brutally honest current state assessment
- Complete implementation phases (5 phases, 12 weeks)
- 19 mobile deliverables specified (8 agents + 10 commands + 1 coordinator)
- Backend pattern provided (18 deliverables for backend team)

**Key Decisions Made**:
1. ✅ Naming convention: `/ww-aadf-mobile-*` for commands, `ww-aadf-mobile-*` for agents
2. ✅ ALL quality gates are BLOCKING (no warnings, no bypass)
3. ✅ REAL Supabase testing ONLY (no mocks)
4. ✅ Agents are project-specific (mobile specialists OR backend specialists)
5. ✅ Parallel agent creation strategy (93.75% time reduction)

**Supporting Documents**:
- `2025-11-09-specialized-agent-ecosystem-plan.md` (original, aspirational - superseded)
- `UPDATE-SUMMARY-2025-11-09.md` (comprehensive update log)
- `QUICK-REFERENCE-AGENT-INVENTORY.md` (quick reference card)

### 2. Current State Assessment (from Plan)

**Reality Check**:
- ❌ Only 1 of 13 quality gates implemented (type-size check)
- ❌ Only ProjectService is offline-first (10% coverage, 90% call Supabase directly)
- ❌ 156 console.log statements in production code (contradicts "zero tolerance" policy)
- ❌ No Husky, no /ww-aadf-mobile-* slash commands exist yet
- ❌ Pre-commit hook exists but only validates type drift (1 of 12 checks)
- ✅ Offline infrastructure EXISTS (OfflineService, DatabaseService, SyncService)
- ✅ Testing infrastructure EXISTS (Jest, Maestro, real Supabase integration tests)
- ✅ Type synchronization EXISTS (5-layer defense, pre-commit hook)

**T-008 Failure** (Why We Need This):
- Pre-commit hook bypassed (`--no-verify`)
- TDD not followed (0% test coverage)
- Type system empty (supabase.ts 0 bytes → 189 TypeScript errors)
- Offline-first bypassed (direct API calls)
- Console.log pollution (8 violations)
- **Impact**: 10 hours remediation (5h Phase 1 + 4h Phase 2)

### 3. Architecture Context (Critical for Agents)

**Root Component Layers** (src/App.tsx):
```
Safe Area Provider → Platform permissions inherited by all screens
├── React Suspense → Error boundaries before render
├── Redux Provider → Store available to all components
│   ├── 4 RTK Query APIs (api, enhancedApi, projectsApi, aiModelsApi)
│   ├── 15 Redux slices (auth, projects, devices, BLE, offline, sync, etc.)
│   └── Listener middleware (NetInfo events → queue processing)
├── Paper Provider → Material Design components
├── Navigation Container → React Navigation v6
├── BLE Providers → Hardware state before screens render
└── Auth Providers → Supabase auth context
```

**Key Pattern**: Screens automatically inherit platform permissions, BLE state, and auth context before MainNavigation renders.

**Offline-First Pattern** (Only ProjectService implements this today):
```
User Action → Component → Redux Action → OfflineService.queueOperation()
    ↓
SQLite Write (local-first)
    ↓
Queue Operation (if offline)
    ↓
Background Sync (when online)
    ↓
Supabase Write → Invalidate RTK Query Cache
```

**Current Coverage**: ProjectService only (src/services/ProjectService.ts)
**Gap**: RTK Query APIs, auth, devices, media, observations all call Supabase directly

---

## 🚀 What Needs To Happen Next

### Immediate Next Step: Implement P0 MVP (3 weeks)

**Phase 1: Core Quality Enforcers** (Week 1)

**6 Agents to Create**:
1. `ww-aadf-mobile-quality-enforcer` - Enforce all 13 quality gates (BLOCKING)
2. `ww-aadf-mobile-type-guardian` - Prevent type drift (5-layer defense)
3. `ww-aadf-mobile-offline-validator` - Validate offline-first coverage
4. `ww-aadf-mobile-test-architect` - TDD enforcement (RED → GREEN → REFACTOR)
5. `ww-aadf-mobile-implementation-expert` - Feature implementation with quality
6. `ww-aadf-coordinator` - Cross-project mobile-backend coordination

**6 Slash Commands to Create**:
1. `/ww-aadf-mobile-validate` - Run all quality gates
2. `/ww-aadf-mobile-implement` - End-to-end feature implementation
3. `/ww-aadf-mobile-review` - Comprehensive code review
4. `/ww-aadf-mobile-test` - TDD-first test creation
5. `/ww-aadf-mobile-fix-types` - Quick type regeneration + validation
6. `/ww-aadf-mobile-check-offline` - Validate offline-first coverage

**File Locations**:
```
.claude/agents/mobile-app/
├── quality/
│   ├── ww-aadf-mobile-quality-enforcer.md
│   ├── ww-aadf-mobile-type-guardian.md
│   └── ww-aadf-mobile-offline-validator.md
├── testing/
│   └── ww-aadf-mobile-test-architect.md
├── implementation/
│   └── ww-aadf-mobile-implementation-expert.md
└── coordination/
    └── ww-aadf-coordinator.md

.claude/commands/
├── ww-aadf-mobile-validate.md
├── ww-aadf-mobile-implement.md
├── ww-aadf-mobile-review.md
├── ww-aadf-mobile-test.md
├── ww-aadf-mobile-fix-types.md
└── ww-aadf-mobile-check-offline.md
```

---

## 📦 Full Context Package for Agent Creation

### Agent Creation Requirements (ALL agents must include)

**1. Architecture Context**:
- App.tsx layer inheritance (Safe Area, Suspense, Redux, Paper, Navigation, BLE, Auth)
- Redux store setup (4 RTK Query APIs, 15 slices, listener middleware)
- Offline-first pattern (SQLite → Queue → Sync → Supabase)
- BLE custom engine (command scheduling, pacing, Redux coordination)
- Supabase environment switching (local, cloud-dev, cloud-prod)

**2. Codebase Implementation References**:
- File paths with line numbers (e.g., src/services/ProjectService.ts:64-180)
- Existing patterns to follow (ProjectService as offline-first template)
- Testing patterns (real Supabase integration tests)
- Quality gate patterns (pre-commit hook validation)

**3. Context7 Research**:
- React Native official patterns
- Expo SDK 51 best practices
- Redux Toolkit + RTK Query vendor docs
- Supabase integration guides
- SQLite offline-first patterns

**4. Quality Gate Enforcement** (All 13 gates):
1. Test Gate: 100% tests passing
2. Type Gate: Zero TypeScript errors
3. Integration Gate: Correct service method signatures
4. TDD Gate: Tests written BEFORE implementation
5. Evidence Gate: Context7 research completed
6. UUID Consistency Gate: String types maintained
7. Backend Sync Gate: Types regenerated after schema changes
8. Type System Validation Gate: supabase.ts not empty (>50KB)
9. Pre-Commit Hook Enforcement Gate: --no-verify banned
10. Console.log Pollution Gate: Zero console.log in production code
11. TestID Coverage Gate: All interactive components have testID
12. Input Validation Gate: All user inputs validated (Yup/zod)
13. Offline-First Architecture Gate: All APIs integrate with OfflineService

**5. Testing Requirements**:
- REAL Supabase ONLY (no mocks)
- Local: http://172.21.24.107:54321 (WSL host IP)
- Cloud-dev: https://nuhwmubvygxyddkycmpa.supabase.co
- Test users: project_admin@test.com, project_member@test.com
- Test data seeded via scripts/seed-test-data.sh
- Integration tests use scripts/test-integration-local.sh

**6. Integration Patterns**:
- How this agent works with other agents
- What tools it has access to (MCP servers)
- What it validates/enforces/implements
- What it outputs/reports

---

## 🎬 Execution Instructions

### Use Parallel Creation Strategy (Section 10 of Plan)

**Workflow**:
```
Step 1: Preparation (5 minutes)
- Read revised plan (Section 6: Agent Specifications)
- Read current codebase context (src/App.tsx, src/redux/index.ts, src/services/ProjectService.ts)
- Gather Context7 research for key technologies

Step 2: Parallel Agent Creation (15 minutes)
- Use Task tool to spawn 6 agents in PARALLEL
- Each agent receives FULL context package (architecture + codebase + Context7 + quality gates + testing)
- All agents create simultaneously

Step 3: Parallel Command Creation (15 minutes)
- Use Task tool to spawn 6 command creators in PARALLEL
- Each command receives agent specifications + workflow patterns
- All commands create simultaneously

Step 4: Validation (30 minutes)
- Test /ww-aadf-mobile-validate on existing codebase
- Run /ww-aadf-mobile-review on T-008 commit (should detect 12 issues)
- Validate all quality gates work as expected
```

**Time Savings**: Sequential = 4 hours, Parallel = 1 hour (75% reduction)

---

## 🔧 Technical Details

### Current Git Status
```
Branch: dev-mvp2-development
Untracked files:
- .github/workflows/quality-gate-validation.yml
- project-context/development-context/MVP2/planning/tranches-1-and-2.md
- project-context/investigation/aadf-work-smart/ (all plan documents)
```

### Key File References

**Architecture**:
- `src/App.tsx` (lines 1-52): Root component layers
- `src/redux/index.ts` (lines 1-90): Store setup
- `src/services/offline/OfflineService.ts` (lines 1-220): Offline infrastructure
- `src/services/ProjectService.ts` (lines 1-180): Offline-first template

**Quality Infrastructure**:
- `.git/hooks/pre-commit` (68 lines): Current pre-commit hook (type drift only)
- `scripts/test-integration-local.sh` (lines 1-42): Integration test script
- `package.json` (lines 5-40): NPM scripts

**Testing**:
- `tests/integration/ProjectService.integration.test.ts` (lines 1-200): Real Supabase integration tests

**Documentation**:
- `CLAUDE.md` (1,420 lines): Project-specific development rules and patterns

### MCP Servers Available
- Context7: Library documentation
- Serena: Code analysis
- Supabase: Database operations
- IDE: Diagnostics

---

## ✅ Success Criteria

**Phase 1 Complete When**:
- ✅ 6 agents created with full specifications
- ✅ 6 slash commands created and tested
- ✅ `/ww-aadf-mobile-validate` runs all 13 quality gates
- ✅ `/ww-aadf-mobile-review` detects T-008's 12 issues
- ✅ All quality gates enforced as BLOCKING
- ✅ Zero console.log violations allowed
- ✅ Type drift prevention validated
- ✅ Offline-first coverage tracked

**Pilot Feature Implementation** (Week 2-3):
- Implement 1 small feature using `/ww-aadf-mobile-implement`
- Validate all quality gates pass
- Measure quality score (target: 9.5/10)
- Zero remediation time
- Production readiness: 85%+

---

## 📚 Reference Documents

**Must Read**:
1. `project-context/investigation/aadf-work-smart/2025-11-09-REVISED-specialized-agent-ecosystem-plan.md`
   - Section 1: Current State Assessment
   - Section 6: Agent Specifications (detailed specs for all 8 agents)
   - Section 7: Slash Command Specs (detailed specs for all 10 commands)
   - Section 10: Parallel Creation Strategy
   - Section 11: Complete Inventory

2. `CLAUDE.md` (lines 1-1420)
   - Quality Control Standards (lines 563-662)
   - 13 Quality Gates (lines 577-596)
   - Offline-First Architecture (lines 172-185)
   - Testing Strategy (lines 201-207)

3. Codebase Architecture:
   - `src/App.tsx` (lines 1-52)
   - `src/redux/index.ts` (lines 1-90)
   - `src/services/offline/OfflineService.ts` (lines 1-220)
   - `src/services/ProjectService.ts` (lines 1-180)

**Quick Reference**:
- `QUICK-REFERENCE-AGENT-INVENTORY.md` - Agent counts and priorities
- `UPDATE-SUMMARY-2025-11-09.md` - What changed in revised plan

---

## 🎯 Recommended Next Action

**Option 1: Create All P0 Agents in Parallel** (Recommended)
```
Start with Section 10 parallel creation workflow:
1. Read agent specs from Section 6
2. Spawn 6 agents in parallel using Task tool
3. Each receives full context package
4. Validate outputs against success criteria
```

**Option 2: Create Agents Sequentially**
```
Start with highest priority:
1. ww-aadf-mobile-quality-enforcer (validates all other agents)
2. ww-aadf-mobile-type-guardian (prevents type drift)
3. ww-aadf-mobile-test-architect (enforces TDD)
... (continue in priority order)
```

**Option 3: Review Plan First**
```
Read the revised plan thoroughly:
1. Section 1: Understand current state
2. Section 6: Review agent specifications
3. Section 10: Understand parallel creation workflow
4. Ask clarifying questions before implementation
```

---

## 🤔 Questions to Clarify (If Needed)

1. **Scope Confirmation**: Proceed with P0 MVP (6 agents + 6 commands) or full implementation (8 agents + 10 commands)?
2. **Creation Strategy**: Parallel (15 min) or sequential (4 hours)?
3. **Validation Approach**: Test each agent individually or test complete ecosystem?
4. **Backend Coordination**: Send coordination message to backend team now or after mobile agents complete?

---

## 📝 Copy-Paste Prompt for New Session

```
Continue implementing the specialized agent ecosystem for Wildlife Watcher mobile app.

Context:
- Planning complete: project-context/investigation/aadf-work-smart/2025-11-09-REVISED-specialized-agent-ecosystem-plan.md
- Current state: 1/13 quality gates implemented, 10% offline-first coverage, 156 console.log violations
- Goal: Create 6 P0 agents + 6 slash commands to prevent T-008-style failures
- Naming: /ww-aadf-mobile-* for commands, ww-aadf-mobile-* for agents
- Testing: REAL Supabase only (no mocks)
- Enforcement: ALL quality gates BLOCKING

Next Action:
Implement Phase 1 P0 MVP using parallel creation strategy from Section 10 of the plan.

Create these 6 agents in parallel:
1. ww-aadf-mobile-quality-enforcer
2. ww-aadf-mobile-type-guardian
3. ww-aadf-mobile-offline-validator
4. ww-aadf-mobile-test-architect
5. ww-aadf-mobile-implementation-expert
6. ww-aadf-coordinator

And these 6 slash commands:
1. /ww-aadf-mobile-validate
2. /ww-aadf-mobile-implement
3. /ww-aadf-mobile-review
4. /ww-aadf-mobile-test
5. /ww-aadf-mobile-fix-types
6. /ww-aadf-mobile-check-offline

Each agent/command must include:
- Full architecture context (App.tsx layers, Redux setup, offline-first patterns)
- Codebase references (file paths + line numbers)
- Context7 research requirements
- All 13 quality gate enforcement
- REAL Supabase testing strategy
- Integration patterns with other agents

Reference: Section 6 (Agent Specifications) and Section 10 (Parallel Creation) in the revised plan.
```

---

**End of Continuation Prompt**

**File**: Save this as reference for future sessions
**Usage**: Copy the "Copy-Paste Prompt" section into a new Claude Code session
**Estimated Context**: ~15% of context window (leaves 85% for implementation work)
