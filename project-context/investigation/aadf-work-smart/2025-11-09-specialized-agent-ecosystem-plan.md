# Specialized Agent Ecosystem - Implementation Plan

**Date**: 2025-11-09
**Objective**: Create project-specific agents that prevent T-008-style quality failures
**Context**: T-008 required 10 hours remediation due to quality gate bypasses
**Goal**: Zero-defect implementation with enforced quality standards

---

## 🎯 Problem Statement

### T-008 Failure Analysis

**What Went Wrong**:
1. ❌ Pre-commit hook bypassed (`--no-verify`)
2. ❌ TDD not followed (tests written after, 0% coverage)
3. ❌ Type system validation skipped (supabase.ts 0 bytes committed)
4. ❌ Offline-first architecture bypassed (API calls didn't use OfflineService)
5. ❌ Console.log pollution (8 security violations)
6. ❌ Missing testID props (accessibility failure)
7. ❌ No input validation (UUID format not validated)

**Root Cause**: Generic agents lack **project-specific context** and **quality gate enforcement**

**Impact**: **10 hours remediation** (5h Phase 1 + 4h Phase 2) vs **30 minutes if quality gates enforced**

---

## 🏗️ Solution Architecture

### Three-Layer Agent System

#### **Layer 1: Technology Experts** (Generic, reusable)
- React Native + Expo specialist
- TypeScript expert
- Redux Toolkit + RTK Query specialist
- Supabase expert
- SQLite expert
- Jest + Maestro testing specialist

#### **Layer 2: Project Pattern Enforcers** (Project-specific)
- Offline-first architecture enforcer
- Type synchronization guardian
- Quality gate validator
- TDD compliance enforcer
- CLAUDE.md rules enforcer

#### **Layer 3: Workflow Orchestrators** (Slash commands)
- `/mobile-implement` - Implement with enforced quality
- `/mobile-review` - Comprehensive code review
- `/mobile-test` - TDD-first test creation
- `/backend-mobile-sync` - Cross-project coordination

---

## 📋 Agent Specifications

### 1. **mobile-implementation-expert** (Layer 1 + 2 Combined)

**Purpose**: Implement features with project-specific patterns and quality enforcement

**Context Knowledge**:
- Offline-first architecture (SQLite → Queue → Sync → Supabase)
- Redux Toolkit patterns (slices, RTK Query, middleware)
- Type-safe Supabase integration
- React Native + Expo 51 best practices
- Testing strategy (integration → unit → E2E)

**Quality Gates Enforced**:
1. ✅ Context7 research FIRST (mandatory)
2. ✅ TDD: Write tests BEFORE implementation
3. ✅ Offline-first: ALL API calls use OfflineService
4. ✅ Type safety: Regenerate types if schema changed
5. ✅ Zero console.log (use logger utility)
6. ✅ testID props on all interactive components
7. ✅ Input validation (Yup schemas)
8. ✅ 80%+ test coverage

**Implementation Workflow**:
```
1. Research (Context7) → 2. Design (Architecture) → 3. Test (TDD) →
4. Implement → 5. Validate (Quality Gates) → 6. Document → 7. Commit
```

**Tools Available**:
- Context7 (library documentation)
- Serena (code analysis)
- IDE diagnostics
- Git hooks validation

**Output**:
- Implementation code
- Test suite (80%+ coverage)
- Documentation updates
- Quality gate validation report

---

### 2. **mobile-quality-enforcer** (Layer 2)

**Purpose**: Validate ALL quality gates before allowing commits

**Quality Gates** (13 total from CLAUDE.md):
1. Test Gate: 100% tests passing
2. Type Gate: Zero TypeScript errors
3. Integration Gate: Correct service method signatures
4. TDD Gate: Tests written before implementation
5. Evidence Gate: Context7 research completed
6. UUID Consistency Gate: String types maintained
7. Backend Sync Gate: Types regenerated after schema changes
8. Type System Validation Gate: supabase.ts not empty (>50KB)
9. Pre-Commit Hook Enforcement Gate: --no-verify banned
10. Console.log Pollution Gate: Zero console.log in production code
11. TestID Coverage Gate: All interactive components have testID
12. Input Validation Gate: All user inputs validated (Yup/zod)
13. Offline-First Architecture Gate: All APIs integrate with OfflineService

**Workflow**:
```bash
# Before commit
npm run validate:local  # Runs all quality gates

# Quality gates in order:
1. Type system check: test -s src/types/supabase.ts && [ $(wc -c < src/types/supabase.ts) -gt 51200 ]
2. Console.log check: grep -r 'console\.log' src/ --exclude-dir=__tests__ --exclude=logger.ts
3. TypeScript compilation: npm run type-check
4. Test coverage: npm test -- --coverage --changedSince=HEAD
5. Linting: npm run lint
6. testID coverage: Custom script validation
7. Input validation: Schema validation check
8. Offline-first integration: Custom architecture check
```

**Blocking Criteria**: ANY gate failure blocks commit

**Output**:
- Quality gate report (pass/fail for each gate)
- Specific issues found with line numbers
- Remediation instructions

---

### 3. **type-system-guardian** (Layer 2)

**Purpose**: Prevent type drift between backend and mobile

**Validation Checks**:
1. ✅ supabase.ts not empty (>50KB, typical 50-100KB)
2. ✅ Types match local/cloud-dev/cloud-prod database schema
3. ✅ No manual edits to generated types
4. ✅ All backend schema changes have coordination message
5. ✅ Type regeneration after EVERY backend schema change

**5-Layer Defense Integration**:
- Layer 1: Backend pre-commit hook (backend responsibility)
- Layer 2: Coordination messages (manual, quality > automation)
- Layer 3: Mobile inbox check (daily manual check)
- Layer 4: Mobile pre-commit hook (THIS AGENT enforces)
- Layer 5: GitHub Actions (CI/CD validation)

**Workflow**:
```bash
# Before commit
npm run types:check-local  # Validate types match database

# If types stale
npm run types:local        # Regenerate types (3 seconds)

# Validation
test -s src/types/supabase.ts && [ $(wc -c < src/types/supabase.ts) -gt 51200 ]
```

**Blocking Criteria**: Stale types block commit

**Output**:
- Type alignment status
- Schema diff if out of sync
- Regeneration instructions

---

### 4. **offline-first-enforcer** (Layer 2)

**Purpose**: Ensure ALL API integrations use OfflineService

**Architecture Pattern**:
```typescript
// ❌ WRONG - Direct API call (T-008 violation)
const { data } = useGetAiModelsQuery();

// ✅ CORRECT - Offline-first integration
const dispatch = useDispatch();
const aiModels = useSelector(selectAiModels);

useEffect(() => {
  // Queue operation through OfflineService
  OfflineService.queueOperation({
    type: 'FETCH_AI_MODELS',
    endpoint: '/ai_models',
    method: 'GET'
  });
}, []);
```

**Validation Rules**:
1. ✅ All RTK Query endpoints integrated with OfflineService
2. ✅ All API calls queued when offline
3. ✅ All mutations synchronized via SyncService
4. ✅ No direct supabase.from() calls in components

**Workflow**:
```bash
# Scan codebase for direct API calls
grep -r "supabase.from" src/screens src/components
grep -r "useQuery" src/screens src/components --exclude-dir=__tests__

# Validate OfflineService integration
npm run validate:offline-first  # Custom script
```

**Blocking Criteria**: Direct API calls in screens/components block commit

**Output**:
- List of violations with file paths and line numbers
- Remediation patterns for each violation

---

### 5. **mobile-test-architect** (Layer 1 + 2)

**Purpose**: Write comprehensive tests BEFORE implementation (TDD)

**TDD Workflow** (RED → GREEN → REFACTOR):
```
1. RED: Write failing test that defines desired behavior
2. GREEN: Write minimal code to make test pass
3. REFACTOR: Improve code quality while keeping tests passing
```

**Test Priority** (MANDATORY ORDER):
1. **Integration Tests FIRST** - Real API + Real Database + Real Auth
2. **Unit Tests SECOND** - Complex business logic in isolation
3. **E2E Tests THIRD** - Critical user journeys (Maestro)

**Test Coverage Requirements**:
- New files: 80%+ coverage MANDATORY
- Modified files: No coverage reduction allowed
- Critical paths: 100% coverage (auth, offline sync, data persistence)

**Test Structure**:
```typescript
// Integration test (FIRST)
describe('AIModelSelect Integration', () => {
  it('fetches AI models from real Supabase', async () => {
    // Real API call, real database, real auth
    const { result } = renderHook(() => useGetAiModelsQuery());
    await waitFor(() => expect(result.current.data).toBeDefined());
  });
});

// Unit test (SECOND)
describe('AIModelSelect Component', () => {
  it('displays loading state', () => {
    const { getByTestId } = render(<AIModelSelect isLoading={true} />);
    expect(getByTestId('ai-model-select-loading')).toBeDefined();
  });
});

// E2E test (THIRD)
// tests/maestro/create-project-with-ai-model.yaml
```

**Quality Gates**:
- ✅ Tests written BEFORE implementation
- ✅ 80%+ coverage for new code
- ✅ 100% tests passing
- ✅ testID props on all interactive components

**Output**:
- Test suite (integration + unit + E2E)
- Coverage report
- Test execution log

---

### 6. **mobile-code-reviewer** (Layer 2)

**Purpose**: Comprehensive code review against CLAUDE.md standards

**Review Checklist** (12 categories):

#### **1. Type System** (CRITICAL)
- [ ] supabase.ts not empty (>50KB)
- [ ] Types match database schema
- [ ] No manual type edits
- [ ] UUID types are strings (not numbers)

#### **2. Testing** (CRITICAL)
- [ ] Tests written BEFORE implementation
- [ ] 80%+ coverage for new files
- [ ] Integration tests present
- [ ] All tests passing
- [ ] testID props present

#### **3. Security** (CRITICAL)
- [ ] Zero console.log statements
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] XSS/SQL injection prevention

#### **4. Architecture** (MAJOR)
- [ ] Offline-first integration (OfflineService used)
- [ ] Redux patterns followed
- [ ] Component patterns followed
- [ ] Service layer used correctly

#### **5. Code Quality** (MAJOR)
- [ ] TypeScript strict mode
- [ ] No ESLint violations (threshold: <50)
- [ ] Files under 500 lines
- [ ] Proper error handling

#### **6. Performance** (MINOR)
- [ ] React.memo where appropriate
- [ ] useMemo/useCallback used correctly
- [ ] No unnecessary re-renders

#### **7. Accessibility** (MINOR)
- [ ] testID props present
- [ ] Proper ARIA labels
- [ ] Keyboard navigation

#### **8. UX** (MINOR)
- [ ] Loading states
- [ ] Empty states
- [ ] Error states
- [ ] Offline indicators

#### **9. Documentation** (MINOR)
- [ ] JSDoc comments
- [ ] README updates
- [ ] CLAUDE.md updates
- [ ] Metrics tracker updates

#### **10. Git Hygiene** (MINOR)
- [ ] Commit message follows conventional commits
- [ ] No --no-verify used
- [ ] Logical commit boundaries

#### **11. Evidence-Based Development** (MAJOR)
- [ ] Context7 research completed
- [ ] Vendor-specific patterns used
- [ ] No custom workarounds where official patterns exist

#### **12. Coordination** (if applicable)
- [ ] Backend coordination message sent (if schema changed)
- [ ] Cross-project dependencies documented

**Output**:
- Quality score (1-10)
- Production readiness percentage
- Issue list with severity (critical/major/minor)
- Remediation plan

---

### 7. **backend-mobile-coordinator** (Layer 2)

**Purpose**: Manage cross-project dependencies and type synchronization

**Coordination Workflows**:

#### **Backend Schema Change → Mobile**:
```bash
# Backend sends schema-change message
~/dev/wildlifeai/cross-project-coordination/.scripts/send-message.sh \
  --project "mvp2-tranche1-foundation-replanning" \
  --from "backend" \
  --to "mobile" \
  --type "schema-change" \
  --message "T-001 complete: organisation_manager role added, 8 new columns in api_logs"

# Mobile receives and actions
npm run types:local  # Regenerate types (3 seconds)
git add src/types/supabase.ts
git commit -m "chore(types): sync with backend schema after T-001"
```

#### **Mobile Feature Request → Backend**:
```bash
# Mobile sends task-request message
~/dev/wildlifeai/cross-project-coordination/.scripts/send-message.sh \
  --project "mvp2-tranche1-foundation-replanning" \
  --from "mobile" \
  --to "backend" \
  --type "task-request" \
  --message "Need LoRaWAN webhook for device telemetry updates"
```

**Quality Gates**:
- ✅ Type synchronization validated
- ✅ Coordination message sent/received
- ✅ Both teams aligned on schema changes

**Output**:
- Coordination message
- Type alignment validation
- Cross-project task tracking

---

## 🔧 Slash Command Workflows

### `/mobile-implement [task-description]`

**Purpose**: Implement feature with enforced quality gates

**Workflow**:
```
1. Context7 Research (MANDATORY)
   - Identify all technologies involved
   - Fetch vendor-specific documentation
   - Validate patterns and best practices

2. Architecture Design
   - Review existing patterns
   - Design offline-first integration
   - Plan Redux state management
   - Plan component structure

3. TDD: Write Tests FIRST
   - Integration tests (real API + DB)
   - Unit tests (business logic)
   - Component tests (UI behavior)

4. Implementation
   - Follow TDD (RED → GREEN → REFACTOR)
   - Use established patterns
   - Integrate with OfflineService
   - Add testID props
   - Add input validation
   - Use logger (not console.log)

5. Quality Gate Validation
   - Run npm run validate:local
   - All 13 gates must pass

6. Documentation
   - Update JSDoc comments
   - Update README if needed
   - Update metrics tracker

7. Commit
   - Conventional commit message
   - NO --no-verify flag
   - Pre-commit hooks validate automatically
```

**Agents Involved**:
1. `mobile-implementation-expert` - Main implementation
2. `mobile-test-architect` - Test creation
3. `mobile-quality-enforcer` - Quality gate validation
4. `offline-first-enforcer` - Architecture validation
5. `type-system-guardian` - Type validation

**Example Usage**:
```bash
/mobile-implement "Add AI model selection dropdown to project creation form with offline support and validation"
```

**Output**:
- Implementation code
- Test suite (80%+ coverage)
- Quality gate validation report
- Documentation updates
- Git commit (if all gates pass)

---

### `/mobile-review [file-path or commit-hash]`

**Purpose**: Comprehensive code review against CLAUDE.md standards

**Workflow**:
```
1. Static Analysis
   - TypeScript compilation check
   - ESLint violations scan
   - Console.log detection
   - testID coverage check

2. Architecture Review
   - Offline-first integration check
   - Redux patterns validation
   - Component patterns validation
   - Service layer usage check

3. Testing Review
   - Test coverage analysis (80%+ required)
   - TDD compliance check
   - Integration test presence
   - Test quality assessment

4. Security Review
   - Input validation check
   - XSS/SQL injection prevention
   - Secret exposure check
   - Authentication/authorization check

5. Type System Review
   - Type drift detection
   - UUID consistency check
   - Generated types validation
   - Manual type edit detection

6. Quality Score Calculation
   - Grade 1-10 based on 12 categories
   - Production readiness percentage
   - Critical/major/minor issue counts

7. Remediation Plan
   - Issue list with severity
   - Remediation instructions
   - Time estimates for fixes
```

**Agents Involved**:
1. `mobile-code-reviewer` - Main review orchestrator
2. `mobile-quality-enforcer` - Quality gate validation
3. `offline-first-enforcer` - Architecture validation
4. `type-system-guardian` - Type system validation
5. `code-analyzer` - Static analysis

**Example Usage**:
```bash
/mobile-review src/redux/api/aiModelsApi.ts
# or
/mobile-review 50e446d  # T-008 commit hash
```

**Output**:
- Quality score (1-10)
- Production readiness percentage
- Issue list (critical/major/minor)
- Remediation plan with time estimates
- Code smell detection

---

### `/mobile-test [file-path or feature-description]`

**Purpose**: Write comprehensive tests (TDD-first)

**Workflow**:
```
1. Test Strategy Design
   - Identify test scenarios
   - Plan integration tests (FIRST)
   - Plan unit tests (SECOND)
   - Plan E2E tests (THIRD)

2. Integration Tests (Real API + DB)
   - Setup: Real Supabase connection
   - Test: Actual API calls
   - Assertions: Real data validation
   - Teardown: Cleanup test data

3. Unit Tests (Business Logic)
   - Setup: Mock dependencies
   - Test: Component/service logic
   - Assertions: Isolated behavior
   - Coverage: 80%+ for complex logic

4. Component Tests (UI Behavior)
   - Setup: Render component
   - Test: User interactions
   - Assertions: UI state changes
   - testID: All interactive elements

5. E2E Tests (Maestro)
   - Setup: Real app instance
   - Test: User journey flows
   - Assertions: End-to-end validation

6. Coverage Validation
   - Run npm test -- --coverage
   - Verify 80%+ coverage
   - Identify untested code

7. Documentation
   - Add test descriptions
   - Document edge cases
   - Update test README
```

**Agents Involved**:
1. `mobile-test-architect` - Main test creation
2. `quality-assurance-engineer` - Test strategy
3. `mobile-quality-enforcer` - Coverage validation

**Example Usage**:
```bash
/mobile-test src/components/form/AIModelSelect.tsx
# or
/mobile-test "AI model selection with offline support"
```

**Output**:
- Integration test suite
- Unit test suite
- Component test suite
- E2E test flows (Maestro)
- Coverage report (80%+ validated)

---

### `/backend-mobile-sync [action: schema-change|task-request|status-update]`

**Purpose**: Coordinate cross-project dependencies

**Workflow**:

#### **Schema Change** (Backend → Mobile):
```
1. Backend completes schema migration
2. Backend sends schema-change message
3. Mobile receives message
4. Mobile regenerates types: npm run types:local
5. Mobile validates types: npm run types:check-local
6. Mobile commits types: chore(types): sync with backend schema
7. Mobile sends acknowledgment message
```

#### **Task Request** (Mobile → Backend or Backend → Mobile):
```
1. Requesting team identifies dependency
2. Requesting team sends task-request message
3. Receiving team reviews request
4. Receiving team estimates effort
5. Receiving team prioritizes in backlog
6. Receiving team sends acknowledgment with timeline
```

#### **Status Update** (Either Team):
```
1. Team completes milestone
2. Team sends status-update message
3. Other team receives notification
4. Other team updates planning accordingly
```

**Agents Involved**:
1. `backend-mobile-coordinator` - Main coordination
2. `type-system-guardian` - Type synchronization
3. `project-organizer` - Task tracking

**Example Usage**:
```bash
/backend-mobile-sync schema-change "T-001 complete: organisation_manager role added"
# or
/backend-mobile-sync task-request "Need LoRaWAN webhook for device telemetry"
# or
/backend-mobile-sync status-update "T-008 complete, T-008.5 remediation required"
```

**Output**:
- Coordination message sent to inbox
- Type regeneration (if schema-change)
- Task tracking update
- Coordination log entry

---

## 📁 Agent File Structure

### Proposed Directory Organization:

```
.claude/agents/
├── mobile-app/                          # NEW - Mobile app specialists
│   ├── implementation/
│   │   ├── mobile-implementation-expert.md
│   │   └── mobile-feature-developer.md
│   ├── quality/
│   │   ├── mobile-quality-enforcer.md
│   │   ├── type-system-guardian.md
│   │   ├── offline-first-enforcer.md
│   │   └── tdd-compliance-enforcer.md
│   ├── testing/
│   │   ├── mobile-test-architect.md
│   │   └── integration-test-specialist.md
│   ├── review/
│   │   ├── mobile-code-reviewer.md
│   │   └── architecture-compliance-reviewer.md
│   └── coordination/
│       └── backend-mobile-coordinator.md
├── technology-experts/                  # NEW - Tech-specific experts
│   ├── react-native-expo-expert.md
│   ├── redux-toolkit-expert.md
│   ├── supabase-integration-expert.md
│   ├── sqlite-offline-expert.md
│   └── typescript-patterns-expert.md
└── workflows/                           # NEW - Slash command implementations
    ├── mobile-implement.md
    ├── mobile-review.md
    ├── mobile-test.md
    └── backend-mobile-sync.md
```

---

## 🔄 Integration with Existing Agents

### Existing Agents to Leverage:
1. `code-analyzer` - Static analysis foundation
2. `technical-solution-reviewer` - Architecture review patterns
3. `quality-assurance-engineer` - Testing strategy
4. `react-native-expo-architect` - Technology expertise
5. `supabase-schema-manager` - Backend schema management
6. `project-context-manager` - Documentation updates

### New Agents Build Upon Existing:
- `mobile-implementation-expert` extends `react-native-expo-architect` with project-specific context
- `mobile-quality-enforcer` extends `code-analyzer` with CLAUDE.md quality gates
- `mobile-test-architect` extends `quality-assurance-engineer` with TDD enforcement
- `mobile-code-reviewer` extends `technical-solution-reviewer` with project patterns

---

## 📊 Success Metrics

### Prevention Metrics (Goal: Zero T-008-style failures):
1. **Type Drift Incidents**: 0 (down from 1 in T-008)
2. **Pre-Commit Hook Bypasses**: 0 (down from 1 in T-008)
3. **TDD Violations**: 0 (down from 1 in T-008)
4. **Console.log Pollution**: 0 per commit (down from 8 in T-008)
5. **Test Coverage Failures**: 0 commits with <80% coverage

### Quality Metrics (Goal: 9.5/10 average):
1. **Quality Score**: Average 9.5/10 per commit (up from 7.5/10 in T-008)
2. **Production Readiness**: 85%+ per commit (up from 0% in T-008)
3. **Critical Issues**: 0 per commit (down from 2 in T-008)
4. **Major Issues**: 0 per commit (down from 4 in T-008)

### Efficiency Metrics (Goal: Zero remediation time):
1. **Remediation Time**: 0 hours per commit (down from 10 hours in T-008)
2. **First-Time Quality**: 100% (up from 0% in T-008)
3. **Quality Gate Pass Rate**: 100% (up from 0% in T-008)

---

## 🚀 Implementation Phases

### Phase 1: Core Quality Enforcers (3 hours)
**Goal**: Prevent T-008-style failures

**Agents to Create**:
1. `mobile-quality-enforcer` - Enforce all 13 quality gates
2. `type-system-guardian` - Prevent type drift
3. `offline-first-enforcer` - Ensure offline-first architecture

**Slash Commands**:
1. `/mobile-review` - Comprehensive code review
2. `/mobile-validate` - Run all quality gates

**Validation**:
- Run `/mobile-review` on T-008 commit
- Verify all 12 issues detected
- Verify blocking criteria prevents commit

**Timeline**: Complete by 2025-11-10

---

### Phase 2: TDD Enforcement (2 hours)
**Goal**: Ensure tests written BEFORE implementation

**Agents to Create**:
1. `mobile-test-architect` - TDD-first test creation
2. `tdd-compliance-enforcer` - Validate TDD workflow

**Slash Commands**:
1. `/mobile-test` - Write comprehensive tests

**Validation**:
- Run `/mobile-test` on new feature
- Verify integration tests written first
- Verify 80%+ coverage enforced

**Timeline**: Complete by 2025-11-10

---

### Phase 3: Implementation Experts (4 hours)
**Goal**: Implement with project-specific patterns

**Agents to Create**:
1. `mobile-implementation-expert` - Main implementation agent
2. Technology experts (React Native, Redux, Supabase, SQLite, TypeScript)

**Slash Commands**:
1. `/mobile-implement` - End-to-end feature implementation

**Validation**:
- Implement small feature using `/mobile-implement`
- Verify Context7 research done first
- Verify TDD workflow followed
- Verify all quality gates pass

**Timeline**: Complete by 2025-11-11

---

### Phase 4: Coordination & Documentation (2 hours)
**Goal**: Cross-project coordination and documentation

**Agents to Create**:
1. `backend-mobile-coordinator` - Cross-project coordination
2. `mobile-documentation-specialist` - Documentation updates

**Slash Commands**:
1. `/backend-mobile-sync` - Coordination workflows

**Validation**:
- Simulate backend schema change
- Verify coordination message sent
- Verify types regenerated
- Verify documentation updated

**Timeline**: Complete by 2025-11-11

---

### Phase 5: Integration & Testing (2 hours)
**Goal**: Validate entire agent ecosystem

**Testing**:
1. Run `/mobile-implement` on T-008.5 remediation
2. Verify all quality gates enforced
3. Verify zero T-008-style issues
4. Measure quality score (target: 9.5/10)

**Documentation**:
1. Update CLAUDE.md with new workflows
2. Create agent reference guide
3. Document success metrics

**Timeline**: Complete by 2025-11-12

---

## 📝 Agent Template Structure

### Each Agent File Should Include:

```markdown
# Agent Name

## Purpose
[Clear, concise purpose statement]

## Context Knowledge
[What this agent knows about the codebase]

## Quality Gates Enforced
[Which of the 13 quality gates this agent enforces]

## Workflow
[Step-by-step workflow this agent follows]

## Tools Available
[MCP tools, bash commands, file operations]

## Validation Criteria
[How to validate this agent's output]

## Blocking Criteria
[What causes this agent to block commits]

## Output
[What this agent produces]

## Integration
[How this agent works with other agents]

## Example Usage
[Concrete examples of using this agent]
```

---

## 🎯 Expected Outcomes

### Immediate Benefits:
1. **Zero T-008-style failures** - Quality gates prevent issues before commit
2. **100% TDD compliance** - Tests written before implementation
3. **Zero type drift** - Type synchronization validated automatically
4. **Zero console.log pollution** - Logger utility enforced
5. **80%+ test coverage** - Coverage validation enforced

### Long-Term Benefits:
1. **Reduced remediation time** - From 10 hours to 0 hours
2. **Higher quality scores** - From 7.5/10 to 9.5/10 average
3. **Faster development** - No rework, no debugging, no remediation
4. **Better coordination** - Backend and mobile aligned automatically
5. **Knowledge preservation** - Project patterns encoded in agents

### AADF Framework Enhancement:
1. **Agent-Enforced Quality** - Quality gates automated via agents
2. **Context-Aware Implementation** - Agents know project patterns
3. **Zero-Defect Development** - Quality built in, not inspected in
4. **Evidence-Based Enforcement** - Context7 research mandatory
5. **Continuous Improvement** - Agents learn from failures (T-008 → T-008.5 prevention)

---

## 📚 Documentation Updates Required

### CLAUDE.md Updates:
1. Add `/mobile-implement` workflow section
2. Add `/mobile-review` workflow section
3. Add `/mobile-test` workflow section
4. Update quality gate enforcement section
5. Document agent ecosystem architecture

### Agent Reference Guide (NEW):
```
.claude/agents/README-MOBILE-APP-AGENTS.md
```
- Overview of agent ecosystem
- When to use each agent
- How agents work together
- Success metrics and validation

### Slash Command Reference (NEW):
```
.claude/commands/README-MOBILE-WORKFLOWS.md
```
- `/mobile-implement` usage guide
- `/mobile-review` usage guide
- `/mobile-test` usage guide
- `/backend-mobile-sync` usage guide

---

## 🔍 Questions for User Approval

### Before Implementation:
1. **Agent Scope**: Do you want agents for backend as well, or only mobile?
2. **Slash Command Naming**: Approve naming convention (`/mobile-*` vs `/aadf-mobile-*`)?
3. **Quality Gate Strictness**: Enforce ALL 13 gates (blocking) or some as warnings?
4. **Integration Testing**: Use real Supabase or mock for agent testing?
5. **Documentation Level**: How detailed should agent documentation be?

### Implementation Priorities:
1. **Phase 1 First**: Start with quality enforcers to prevent T-008 issues?
2. **Incremental Rollout**: Test each phase before moving to next?
3. **Backward Compatibility**: Keep existing agents or replace with specialized ones?

---

## ✅ Approval Checklist

Before proceeding with implementation, confirm:

- [ ] Agent specifications approved
- [ ] Slash command workflows approved
- [ ] Directory structure approved
- [ ] Integration strategy approved
- [ ] Success metrics approved
- [ ] Implementation phases approved
- [ ] Documentation plan approved

---

## 🚀 Next Steps (After Approval)

1. **Create Phase 1 Agents** (3 hours)
   - `mobile-quality-enforcer.md`
   - `type-system-guardian.md`
   - `offline-first-enforcer.md`

2. **Create Phase 1 Slash Commands** (2 hours)
   - `/mobile-review` workflow
   - `/mobile-validate` workflow

3. **Test Phase 1** (1 hour)
   - Run `/mobile-review` on T-008
   - Verify all 12 issues detected
   - Validate blocking behavior

4. **Iterate** (Repeat for Phases 2-5)

**Total Implementation Time**: 13 hours (spread across 3 days)

**Expected Completion**: 2025-11-12

---

**End of Plan**

**Ready for User Review**: YES
**Blocking User Approval**: Agent specifications, slash command workflows, implementation phases
