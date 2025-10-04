# Task Specification & Planning Patterns - AADF Learning

**Date Created:** 2025-10-04
**Context:** Task 12 (Projects CRUD) Planning Session
**Framework:** AI Agentic Development Framework (AADF)
**Key Insight:** Multi-document specification strategy with specialized agent assignment

---

## 🎯 Core Discovery

**Problem Solved:** How to capture complex task requirements with cross-repo dependencies, specialized agent coordination, and business logic clarifications in a way that enables seamless execution after context clearing.

**Solution Framework:** 3-document specification pattern + coordination layer + kickoff prompt

---

## 📚 Three-Document Specification Pattern

### **Document 1: Implementation Specification**
**File Pattern:** `task_XXX_implementation_spec.md`

**Purpose:** Comprehensive requirements capture with ALL clarifications and business logic

**Essential Sections:**
```markdown
## Executive Summary
- Task overview, dependencies, estimated time
- Critical clarifications upfront

## Key Clarifications & Business Logic
- Document ALL user-provided corrections and constraints
- Example: "Standard users = 1 org, WW Admin = max 2 orgs"
- Example: "WW Admin mobile scope = org-scoped (NOT global like web)"
- Capture testing approach decisions ("pragmatic TDD, 80% coverage")
- Document environment decisions ("use live dev, not elaborate mocks")

## Component Architecture
- Detailed breakdown of all components/screens/services
- Type definitions required
- Integration points with existing system

## Backend Schema Requirements
- What exists vs what needs to be built
- Computed fields, triggers, RLS policies
- Member management functions

## Testing Strategy
- Testing philosophy for this specific task
- Coverage targets and priorities
- E2E vs integration vs unit test balance

## Success Criteria
- Measurable completion checkpoints
- Quality gates specific to this task
```

**Key Learnings:**
- ✅ **Capture user clarifications immediately** - don't rely on memory
- ✅ **Document deviations from spec** - WW Admin mobile ≠ web portal
- ✅ **Record testing philosophy decisions** - avoid over-engineering debates later
- ✅ **Specify mock vs real integration** - LoRaWAN mock now, real later
- ✅ **Frontend-first perspective** - what mobile needs from backend

### **Document 2: Execution Plan**
**File Pattern:** `task_XXX_execution_plan.md`

**Purpose:** Parallel execution strategy with agent assignments and dependency management

**Essential Sections:**
```markdown
## Version Control
- Track plan versions as agents/strategy evolves
- Document what changed in each version
- Example: v1.0 = generic agents, v2.0 = Supabase specialists

## AI Agent Coordination Layer
- Overall orchestrator (ai-project-orchestrator)
- Cross-project coordinator (cross-project-coordinator)
- Agent responsibilities matrix
- Progressive spawning strategy

## Complete Agent Assignment Matrix
| Discrete Task | Agent Type | Rationale | Dependencies |
|--------------|------------|-----------|--------------|
| B1: RLS Testing | supabase-rls-security | Security specialist | None |
| B2: Gap Analysis | postgres-function-architect | DB function expert | B1 |
| M1: Type Definitions | react-native-expo-architect | TypeScript patterns | None |

## Parallel Execution Strategy
### Phase 1: Foundation (0-60 min) - PARALLEL
- Backend Track: Agent assignments per subtask
- Mobile Track: Agent assignments per subtask
- Coordination Point: What must be complete

### Phase 2: Integration (60-150 min) - SEQUENTIAL
- Mobile Track: Depends on backend completion
- Backend Track: Monitoring in parallel
- Coordination checkpoints

### Phase 3: Quality & Polish (150-210 min)
- Quality gates
- Documentation
- Handoff preparation

## Cross-Repo Coordination Protocol
- Handoff file locations and formats
- Communication channels between repos
- Status update mechanisms
```

**Key Learnings:**
- ✅ **Version the execution plan** - strategies evolve as you discover better agents
- ✅ **Map EVERY discrete task to a specialist** - don't use generic agents when specialists exist
- ✅ **Document coordination checkpoints explicitly** - 60min, 120min, 210min marks
- ✅ **Show parallel vs sequential clearly** - backend/mobile can run simultaneously in Phase 1
- ✅ **Progressive agent spawning** - orchestrator first, then coordinators, then workers
- ✅ **Include time estimates per phase** - helps track velocity

### **Document 3: Backend Specification**
**File Pattern:** `task_XXX_backend_spec.md`

**Purpose:** Cross-repo API requirements for backend team/agents

**Essential Sections:**
```markdown
## Already Implemented (Verified)
- What exists in current migrations
- Tables, columns, RLS policies
- Helper functions already available

## Required Implementations (Gaps)
- Missing business logic functions
- Needed computed fields
- Member management functions
- Organisation membership validation triggers

## API Endpoint Summary
- REST endpoints needed
- Expected request/response formats
- Authentication requirements
- Error handling specifications

## Integration Test Requirements
- What mobile expects to test against
- Sample data requirements
- Dev environment setup needs
```

**Key Learnings:**
- ✅ **Verify existing schema first** - read migration files, don't assume
- ✅ **Document gaps explicitly** - what exists vs what's needed
- ✅ **Frontend-driven API design** - mobile defines what it needs from backend
- ✅ **Copy to backend repo** - ensures backend team has mobile requirements

---

## 🤖 Specialized Agent Selection Strategy

### **Discovery Process**

**Step 1: Check Project Agent Catalog**
- Read `@project-context/agent-reference.md` (if exists)
- Identify domain-specific agents (Supabase, React Native, testing, etc.)

**Step 2: Match Tasks to Specialists**
```yaml
Generic Assignment (AVOID):
  B1: backend-architect  # ❌ Too generic

Specialized Assignment (PREFER):
  B1: supabase-rls-security  # ✅ Security-focused for RLS testing
  B2: postgres-function-architect  # ✅ DB function expert for business logic
  B4: supabase-migration-architect  # ✅ Migration specialist for deployment
```

**Step 3: Identify Coordination Agents**
```yaml
Orchestration Layer:
  - ai-project-orchestrator: Overall task management, agent spawning, progress tracking
  - cross-project-coordinator: Backend↔Mobile sync, spec relay, deployment validation

Why Both?
  - Orchestrator: Manages execution plan, spawns agents, tracks checkpoints
  - Coordinator: Handles cross-repo dependencies, relays specs, validates handoffs
```

### **Agent Assignment Matrix Template**

```markdown
| Phase | Task ID | Description | Agent | Rationale | Duration |
|-------|---------|-------------|-------|-----------|----------|
| 1 | B1 | RLS Testing | supabase-rls-security | Security specialist | 30min |
| 1 | B2 | Gap Analysis | postgres-function-architect | DB function expert | 15min |
| 1 | B3 | Business Logic | postgres-function-architect | Same context as B2 | 45min |
| 1 | B4 | Migration Deploy | supabase-migration-architect | Migration specialist | 15min |
| 1 | B5 | API Docs | api-docs | Documentation expert | 15min |
| 1 | M1 | Type Definitions | react-native-expo-architect | TypeScript patterns | 20min |
| 1 | M2 | Service Shell | mobile-dev | Service layer expert | 20min |
| 1 | M3 | RTK Query | mobile-dev | State management | 20min |
| 2 | I1 | Service Integration | mobile-dev | API integration | 30min |
| 2 | I2 | Integration Tests | quality-assurance-engineer | Testing specialist | 30min |
| 2 | I3 | ProjectsScreen UI | frontend-design-expert | UI/UX specialist | 45min |
```

**Key Insights:**
- ✅ **Reuse agents within phase** - postgres-function-architect does B2+B3 (context preservation)
- ✅ **Specialists over generalists** - supabase-rls-security vs backend-architect
- ✅ **Quality specialists for testing** - quality-assurance-engineer, not mobile-dev
- ✅ **Frontend specialists for UI** - frontend-design-expert, not mobile-dev
- ✅ **Documentation specialists** - docs-maintainer, api-docs (not developers)

---

## 🎬 Kickoff Prompt Pattern

### **Purpose**
Enable seamless task execution after `/clear` command with full context recovery

### **Essential Components**

**1. Mandatory Reading Order**
```markdown
## 📋 Context Documents (Read These First)

**MANDATORY READING ORDER:**
1. task_XXX.txt - Task overview
2. task_XXX_implementation_spec.md - Detailed requirements
3. task_XXX_execution_plan.md - Execution strategy
4. task_XXX_backend_spec.md - Backend coordination (if cross-repo)
```

**2. Orchestrator Initialization Instructions**
```markdown
### Step 1: Initialize AI Project Orchestrator

Spawn the **ai-project-orchestrator** agent with this prompt:

```
Initialize Task XXX execution using the comprehensive execution plan.

Read these specifications:
- task_XXX_implementation_spec.md (requirements)
- task_XXX_execution_plan.md (v2.0 with specialists)
- task_XXX_backend_spec.md (cross-repo specs)

Your responsibilities:
1. Spawn agents according to Progressive Agent Spawning Strategy
2. Coordinate parallel execution across tracks
3. Monitor progress and handle checkpoints
4. Update metrics tracker
5. Ensure cross-project coordination

Start by spawning cross-project-coordinator and Phase 1 agents.
```
```

**3. Pre-Execution Checklist**
```markdown
### Step 2: Verify Pre-Execution Checklist

**Before agents start work, confirm:**
- ✅ Dependency tasks complete (Task 11 = 100%)
- ✅ Backend repo accessible
- ✅ Dev environment running
- ✅ Types generated and current
```

**4. Coordination Checkpoint Monitoring**
```markdown
### Step 3: Monitor Coordination Checkpoints

**60-minute checkpoint:**
- Backend: What should be complete
- Mobile: What should be complete
- Action: cross-project-coordinator verifies handoff

**120-minute checkpoint:**
- Integration milestones
- Action: Verify connectivity

**210-minute checkpoint:**
- Quality phase entry criteria
- Action: Begin polish phase
```

**5. Quality Gates**
```markdown
### Step 5: Quality Gates

**MUST PASS before completion:**
1. ✅ All integration tests passing
2. ✅ Organisation isolation verified
3. ✅ Role-based permissions enforced
4. ✅ Offline sync working
5. ✅ TypeScript errors resolved
6. ✅ Performance validated
```

**6. Final Execution Command**
```markdown
## 🎬 Final Command to Execute

After reading all context:

```
@ai-project-orchestrator: Begin Task XXX execution following task_XXX_execution_plan.md v2.0.
Spawn cross-project-coordinator first, then Phase 1 agents for parallel work.
Track progress in MVP2-METRICS-TRACKER.md with actual hours.
```
```

---

## 🔄 Progressive Agent Spawning Strategy

### **Phase 0: Pre-Execution (Orchestration Setup)**
```markdown
Spawn Order:
1. ai-project-orchestrator (reads all specs, creates execution plan)
2. cross-project-coordinator (prepares backend handoff, verifies deps)

Context Passing:
- Orchestrator: Full spec access, execution plan ownership
- Coordinator: Backend spec, mobile requirements, handoff protocol
```

### **Phase 1: Foundation (Parallel Execution)**
```markdown
Backend Track Agents (Sequential within track):
1. supabase-rls-security (RLS testing)
   └─ Context: Backend spec, existing migrations
2. postgres-function-architect (gap analysis + business logic)
   └─ Context: Results from #1, backend spec
3. supabase-migration-architect (deployment)
   └─ Context: New migrations from #2
4. api-docs (documentation)
   └─ Context: Deployed APIs from #3

Mobile Track Agents (Parallel within track):
1. react-native-expo-architect (type definitions)
   └─ Context: Implementation spec, existing types
2. mobile-dev (service shell + RTK Query setup)
   └─ Context: Types from #1, offline service patterns
3. mobile-dev (mock LoRaWAN service)
   └─ Context: Can run parallel with #2

Timing:
- Backend: 0-120 minutes (sequential)
- Mobile: 0-60 minutes (parallel opportunities)
- Coordination Point: 60 minutes (backend APIs ready for mobile integration)
```

### **Phase 2: Integration (Sequential After Backend Ready)**
```markdown
Mobile Track Agents:
1. mobile-dev (service integration)
   └─ Context: Backend handoff document from coordinator
2. quality-assurance-engineer (integration tests)
   └─ Context: Live backend, service implementation
3. frontend-design-expert (ProjectsScreen UI)
   └─ Context: Service layer, integration tests passing
4. frontend-design-expert (NewProjectScreen UI)
   └─ Context: ProjectsScreen patterns
5. react-native-expo-architect (org switcher)
   └─ Context: Both screens complete

Backend Monitoring:
- supabase-rls-security (parallel monitoring)
  └─ Context: Mobile integration feedback

Timing: 60-210 minutes
```

### **Phase 3: Quality & Polish**
```markdown
Sequential Agents:
1. quality-assurance-engineer (E2E tests)
   └─ Context: All screens complete
2. react-native-expo-architect (performance optimization)
   └─ Context: E2E test results
3. docs-maintainer (documentation)
   └─ Context: All implementations complete

Timing: 210-270 minutes
```

**Key Insights:**
- ✅ **Don't spawn all agents at once** - sequential spawning preserves context
- ✅ **Pass context explicitly** - each agent gets results from predecessors
- ✅ **Parallel within tracks, sequential between phases** - maximizes efficiency
- ✅ **Coordination checkpoints** - orchestrator verifies readiness before phase transitions

---

## 📊 Critical Business Logic Capture Patterns

### **User Clarification Documentation**

**Anti-Pattern:** Relying on conversation memory
```markdown
❌ User said something about org membership limits...
❌ I think WW Admin has some special access...
❌ Maybe we should test with real data?
```

**Correct Pattern:** Immediate capture in Implementation Spec
```markdown
✅ ## Key Clarifications & Business Logic

### Organisation Membership Rules
**User Clarification (2025-10-04):**
- Standard users: 1 organisation only
- WW Admin: Maximum 2 organisations
- Backend trigger: validate_user_org_limit() enforces on insert

### WW Admin Mobile Scope
**Critical Correction (2025-10-04):**
- Mobile app: Org-scoped (see projects in current selected org only)
- Web portal: Global view (see all projects across all orgs)
- DIFFERENT BEHAVIOR: Mobile ≠ Web for WW Admin

### Testing Approach
**User Decision (2025-10-04):**
- Pragmatic TDD/BDD with 80% coverage target
- Use live Supabase dev environment (no elaborate mocking)
- Focus on user journey tests first
- Avoid over-engineering test infrastructure
```

**Key Insights:**
- ✅ **Date-stamp clarifications** - know when decisions were made
- ✅ **Capture exact user wording** - "1 org" vs "single organisation"
- ✅ **Document deviations from original spec** - mobile WW Admin ≠ web portal
- ✅ **Record testing philosophy** - prevents future debates
- ✅ **Include rationale** - "avoid elaborate mocking" explains the "why"

---

## 🎓 Lessons Learned - Task 12 Planning Session

### **What Worked Exceptionally Well**

**1. Multi-Document Specification Strategy**
- Implementation Spec captured all clarifications without ambiguity
- Execution Plan provided clear parallel execution roadmap
- Backend Spec enabled cross-repo coordination
- Kickoff Prompt ensured context recovery after `/clear`

**2. Specialized Agent Selection**
- Identifying Supabase specialists (postgres-function-architect, supabase-rls-security, supabase-migration-architect) vs generic backend-architect
- Quality specialists (quality-assurance-engineer) for testing
- Frontend specialists (frontend-design-expert) for UI work
- Documentation specialists (docs-maintainer, api-docs)

**3. Progressive Clarification Process**
- User provided corrections incrementally
- Each clarification immediately captured in spec
- No reliance on conversation memory
- Created single source of truth

**4. Coordination Layer Architecture**
- Dual coordination (ai-project-orchestrator + cross-project-coordinator)
- Clear separation of concerns
- Orchestrator = task management, Coordinator = cross-repo sync

### **What Could Be Improved**

**1. Agent Discovery Process**
- Should have checked for Supabase specialists FIRST
- User had to remind about specialist agents
- Lesson: Always consult agent-reference.md before assigning generic agents

**2. Agent Prompt Templates**
- Initially considered pre-creating agent prompts
- User wisely suggested deferring to just-in-time
- Lesson: Comprehensive specs are sufficient; agents are smart enough

**3. Version Control on Execution Plan**
- Should have versioned from start (v1.0 → v2.0)
- Added versioning after changing agents
- Lesson: Version execution plans immediately, expect evolution

### **Reusable Patterns Discovered**

**Pattern 1: Three-Document Specification**
```
task_XXX.txt                      # Overview (150 lines)
task_XXX_implementation_spec.md   # Requirements (650 lines)
task_XXX_execution_plan.md        # Strategy (800 lines, versioned)
task_XXX_backend_spec.md          # Cross-repo (450 lines)
task_XXX_kickoff_prompt.md        # Context recovery (150 lines)
```

**Pattern 2: Agent Assignment Matrix**
```markdown
| Task | Agent | Rationale | Duration | Dependencies |
```

**Pattern 3: Coordination Checkpoints**
```
60-min: Backend APIs ready → Mobile integration begins
120-min: Integration complete → UI development begins
210-min: UI complete → Quality phase begins
```

**Pattern 4: Progressive Agent Spawning**
```
Pre-Execution: Orchestrator + Coordinator
Phase 1: Backend track (sequential) + Mobile track (parallel)
Phase 2: Mobile integration (sequential after backend)
Phase 3: Quality (sequential)
```

---

## 🚀 Actionable Templates for Future Tasks

### **Template 1: Implementation Spec Skeleton**

```markdown
# Task XXX: [Title] - Implementation Specification

**Version:** v1.0
**Created:** [Date]
**Task Overview:** [1-2 sentences]
**Dependencies:** [Task IDs]
**Estimated Duration:** [X hours]

## Executive Summary
[3-5 bullet points of what this task delivers]

## Key Clarifications & Business Logic
[ALL user corrections and decisions, date-stamped]

### [Business Rule Category 1]
**User Clarification ([Date]):**
- [Exact rule]
- [Constraints]
- [Backend enforcement mechanism]

### [Testing Approach]
**User Decision ([Date]):**
- [Philosophy: pragmatic/strict/etc]
- [Coverage targets]
- [Mock vs real integration]

## Component Architecture

### [Component/Service 1]
**File:** `src/[path]/[filename].ts`
**Purpose:** [What it does]
**Dependencies:** [What it uses]
**Key Methods:**
- `method1()` - [Description]
- `method2()` - [Description]

### [Component/Service 2]
...

## Backend Schema Requirements

### Already Implemented (Verified)
[What exists in migrations - verified by reading actual files]

### Required Implementations (Gaps)
[What needs to be built]

## Testing Strategy
[Task-specific testing approach]

## Success Criteria
- [ ] [Measurable checkpoint 1]
- [ ] [Measurable checkpoint 2]
```

### **Template 2: Execution Plan Skeleton**

```markdown
# Task XXX: [Title] - Execution Plan

**Version:** v1.0
**Created:** [Date]
**Execution Model:** [Parallel/Sequential/Hybrid]
**Estimated Duration:** [X hours] with [Y%] parallel efficiency savings

## Version History
- v1.0 ([Date]): Initial plan with generic agents
- v2.0 ([Date]): Updated with [change description]

## AI Agent Coordination Layer

### Orchestration Architecture
[Mermaid diagram showing orchestrator + coordinator + agents]

### Agent Responsibilities

**ai-project-orchestrator:**
- [Responsibility 1]
- [Responsibility 2]

**cross-project-coordinator:** (if cross-repo)
- [Responsibility 1]
- [Responsibility 2]

### Complete Agent Assignment Matrix

| Phase | Task ID | Description | Agent | Rationale | Duration | Dependencies |
|-------|---------|-------------|-------|-----------|----------|--------------|
| 1 | [ID] | [Task] | [agent-type] | [Why this agent] | [Xmin] | [Task IDs] |

### Progressive Agent Spawning Strategy

**Pre-Execution:**
1. ai-project-orchestrator (reads specs, owns execution)
2. [coordinator-type] (prepares [coordination need])

**Phase 1: [Phase Name]**
[Track Name] Agents:
1. [agent-type] ([task description])
   └─ Context: [What this agent receives]

## Parallel Execution Strategy

### Phase 1: [Name] ([Time Range]) - [PARALLEL/SEQUENTIAL]

**[Track 1] Track:**
```bash
[Time] [TaskID]: [Description] (Agent: [agent-type])
  ├─ [Subtask 1]
  ├─ [Subtask 2]
  └─ [Subtask 3]
```

**Coordination Point** ([Time] mark):
```
[Track 1]: [What must be complete] ✅
[Track 2]: [What must be complete] ✅
→ [Next phase readiness criteria]
```

## Cross-Repo Coordination Protocol
[Handoff files, status updates, communication channels]
```

### **Template 3: Kickoff Prompt Skeleton**

```markdown
# Task XXX Kickoff Prompt - [Title]

## 🎯 Primary Objective
Execute **Task XXX: [Title]** using comprehensive execution plan with AI agent coordination.

## 📋 Context Documents (Read These First)

**MANDATORY READING ORDER:**
1. `task_XXX.txt` - Task overview
2. `task_XXX_implementation_spec.md` - Detailed requirements
3. `task_XXX_execution_plan.md` - Execution strategy
4. `task_XXX_backend_spec.md` - Backend coordination (if applicable)

## 🚀 Execution Instructions

### Step 1: Initialize AI Project Orchestrator
[Orchestrator spawn prompt]

### Step 2: Verify Pre-Execution Checklist
- ✅ [Dependency 1 complete]
- ✅ [Resource 1 accessible]
- ✅ [Environment 1 running]

### Step 3: Monitor Coordination Checkpoints
**[Time]-minute checkpoint:**
- [Track 1]: [Completion criteria]
- [Track 2]: [Completion criteria]
- Action: [Coordination action]

### Step 4: Track Progress
[Metrics tracker updates]

### Step 5: Quality Gates
**MUST PASS before completion:**
1. ✅ [Gate 1]
2. ✅ [Gate 2]

## 📊 Success Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]

## ⚡ Key Clarifications (Critical)
[Business logic reminders from implementation spec]

## 🎬 Final Command to Execute
```
@ai-project-orchestrator: Begin Task XXX execution following task_XXX_execution_plan.md v2.0.
[Specific instructions]
```
```

---

## 🔗 Integration with Existing AADF Documentation

### **Related Documents to Update**

**1. AI Agentic Development Framework (ai-agentic-development-framework.md)**
- **Section to enhance:** "Task Management & Decomposition"
- **New pattern to add:** Three-document specification strategy
- **Reference this document:** "See task-specification-planning-patterns.md for detailed planning methodology"

**2. Claude Flow Usage Log (claude-flow-usage-log.md)**
- **Section to enhance:** "Agent Coordination Patterns"
- **New entry:** Task 12 Planning Session (2025-10-04)
- **Key insight:** Progressive agent spawning with coordination layers

**3. Knowledge Transfer Document (transfer-knowledge/AI-Assisted-Development-Knowledge-Transfer.md)**
- **Section to enhance:** "Task Management & Context Preservation"
- **New template:** Multi-document specification pattern
- **Cross-reference:** This document for planning methodology

### **How This Document Fits AADF**

```
AADF Framework Hierarchy:
├─ ai-agentic-development-framework.md (Core methodology)
├─ philosophical-foundations-aadf.md (Epistemological foundations)
├─ claude-flow-usage-log.md (Implementation journey)
├─ task-specification-planning-patterns.md (THIS DOCUMENT - Planning methodology)
└─ transfer-knowledge/ (Consolidated universal patterns)
```

**This Document's Unique Contribution:**
- **Focus:** Task planning and specification capture
- **Scope:** Multi-document strategy, agent selection, coordination layers
- **Audience:** Future task planners needing to create comprehensive execution plans
- **Differentiator:** Detailed templates and progressive spawning strategies

---

## 📝 Future Enhancements to Track

**Patterns to Validate:**
1. Does three-document strategy scale to simpler tasks? (Test on Task 13)
2. Can kickoff prompts be auto-generated from execution plans?
3. Should agent assignment matrix be extracted to separate file for large tasks?
4. Can coordination checkpoints be standardized across all MVP2 tasks?

**Questions to Answer:**
1. When to use specialized agents vs general agents? (Document threshold criteria)
2. How to handle agent spawning failures? (Error recovery protocol)
3. Should execution plans include rollback procedures? (Quality gate failures)
4. Can we create "agent persona cards" for quick reference? (Agent capabilities matrix)

---

**Document Status:** ✅ Initial version complete
**Next Review:** After Task 12 execution completion
**Success Metric:** Can this document enable Task 13 planning in <30 minutes?
