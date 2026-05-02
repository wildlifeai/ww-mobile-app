# Cross-Project Coordination Files - Comprehensive Audit Report

**Date**: 2025-10-28
**Purpose**: Identify all cross-project coordination files for centralized organization
**Scope**: Wildlife Watcher Mobile App Repository

---

## Executive Summary

**Total Files Identified**: 73 files across 8 major categories
**Current State**: Scattered across multiple directories without clear organization
**Recommendation**: Consolidate into structured `cross-project-coordination/` system
**Estimated Effort**: 4-6 hours for complete reorganization
**Risk Level**: LOW (primarily documentation moves, minimal code impact)

### Key Findings

1. **Active Coordination Files**: 14 files requiring immediate centralization
2. **Historical/Archive Material**: 31 files that should be preserved in archive
3. **Documentation & Guides**: 18 files providing coordination protocols
4. **Agent Definitions**: 3 files defining cross-project coordinator agent
5. **Type Synchronization**: 12 files related to backend-mobile type sync
6. **Issue Resolution History**: 14 files documenting cross-project debugging
7. **Integration Patterns**: 8 files describing integration workflows
8. **Scattered Status Reports**: Multiple completion/status files in various locations

---

## Category 1: Active Coordination Files (PRIORITY: HIGH)

**Location**: Needs centralized coordination hub
**Files**: 14

### 1.1 Core Coordination Documents

| File | Current Location | Purpose | Action |
|------|-----------------|---------|---------|
| `cross-project-coordination-reference.md` | `project-context/` | Main reference doc | **MOVE** to active/ |
| `CROSS-PROJECT-ORCHESTRATION-GUIDE.md` | `MVP2/implementation/execution/cross-project-coordination/` | Orchestration guide | **KEEP** (already in target) |
| `COORDINATION-COMPLETE.md` | `project-context/` | Completion status (Oct 20) | **ARCHIVE** (completed activity) |
| `swarm-coordination-strategy.md` | `project-context/` | Agent swarm coordination | **EVALUATE** (may be general, not cross-project) |

### 1.2 Backend Coordination Requests

| File | Current Location | Purpose | Action |
|------|-----------------|---------|---------|
| `BACKEND-COORDINATION-REQUEST.md` | `code-review/20251016/issues/001-member-access-rls-regression/` | RLS fix coordination | **ARCHIVE** (issue resolved) |
| `BACKEND-FIX-COMPLETE.md` | `code-review/20251016/issues/001-member-access-rls-regression/` | Fix completion report | **ARCHIVE** (historical) |
| `BACKEND-FIX-COMPLETE-V2.md` | `code-review/` | Type casting fix report | **ARCHIVE** (historical) |
| `BACKEND-UPDATE-SUMMARY.md` | `code-review/` | Backend update summary | **ARCHIVE** (historical) |
| `BACKEND-INCOMPLETE-DEPLOYMENT.md` | `code-review/` | Deployment testing results | **ARCHIVE** (valuable lessons learned) |

### 1.3 Cross-Project Task Files (CPT)

| File | Current Location | Purpose | Action |
|------|-----------------|---------|---------|
| `CPT-2025-09-17-001-backend-mobile-coordination-status.md` | `MVP2/archive/` | Coordination status (Sept) | **KEEP** in archive (historical) |
| `CPT-2025-09-29-001-backend-alignment-assessment.md` | `MVP2/archive/` | Backend alignment (Sept) | **KEEP** in archive (historical) |

### 1.4 Coordination Summary Documents

| File | Current Location | Purpose | Action |
|------|-----------------|---------|---------|
| `CROSS-PROJECT-COORDINATION-SUMMARY.md` | `code-review/20251016/issues/001-member-access-rls-regression/` | RLS issue coordination | **ARCHIVE** (completed) |
| `CROSS-PROJECT-COORDINATION-COMPLETE.md` | `code-review/20251016/issues/001-member-access-rls-regression/` | Completion report | **ARCHIVE** (completed) |
| `COORDINATOR-EXECUTIVE-SUMMARY.md` | `code-review/20251016/issues/001-member-access-rls-regression/` | Executive summary | **ARCHIVE** (completed) |

**Recommendation**: Most "active" coordination files are actually completed activities. Archive these and keep only the guides/templates active.

---

## Category 2: Documentation & Protocol Guides (PRIORITY: HIGH)

**Location**: Needs dedicated protocols/ subfolder
**Files**: 18

### 2.1 Integration Guides

| File | Current Location | Purpose | Action |
|------|-----------------|---------|---------|
| `Backend-Mobile-Type-Synchronization-Guide.md` | `documentation/developer-docs/` | Type sync guide | **LINK** from coordination/ |
| `Supabase-Integration-Guide.md` | `documentation/app-technical-guides/` | Supabase integration | **LINK** from coordination/ |
| `task-13-integration-complete.md` | `MVP2/implementation/guides/` | Task 13 integration | **ARCHIVE** (task-specific) |
| `task-13-backend-integration.md` | `MVP2/implementation/tasks/` | Backend integration spec | **ARCHIVE** (task-specific) |
| `BACKEND-REPOSITORY-ANALYSIS.md` | `MVP2/implementation/guides/` | Backend repo analysis | **MOVE** to protocols/ |
| `CLOUD-BACKEND-TESTING-GUIDE.md` | `MVP2/implementation/guides/` | Cloud testing guide | **MOVE** to protocols/ |
| `CLOUD-INTEGRATION-VALIDATION-SUMMARY.md` | `MVP2/implementation/guides/` | Validation summary | **ARCHIVE** (completed validation) |

### 2.2 Coordination Patterns & Learnings

| File | Current Location | Purpose | Action |
|------|-----------------|---------|---------|
| `backend-mobile-integration-lessons.md` | `learnings/` | **CRITICAL** lessons learned | **MOVE** to protocols/ (essential reading) |
| `backend-mobile-type-sync-comparison.md` | `learnings/` | Type sync comparison | **MOVE** to protocols/ |
| `supabase-type-consistency-strategy.md` | `learnings/` | Type consistency strategy | **MOVE** to protocols/ |
| `typescript-cross-repo-sync-best-practices-2025.md` | `learnings/` | Cross-repo sync practices | **MOVE** to protocols/ |
| `type-sync-workflow-test-results.md` | `learnings/` | Test results | **ARCHIVE** (historical data) |
| `type-sync-decision-matrix.md` | `learnings/` | Decision matrix | **MOVE** to protocols/ |
| `type-sync-implementation-templates.md` | `learnings/` | Implementation templates | **MOVE** to templates/ |
| `local-dev-sync-workflow.md` | `learnings/` | Daily workflow guide | **MOVE** to protocols/ |
| `QUICK-REFERENCE-TYPE-SYNC-RESEARCH.md` | `learnings/` | Quick reference | **MOVE** to protocols/ |

### 2.3 Dashboard & Tracking

| File | Current Location | Purpose | Action |
|------|-----------------|---------|---------|
| `aadf-cross-project-dashboard-framework.md` | `learnings/` | Dashboard framework | **EVALUATE** (may be general AADF, not specific to backend coordination) |

**Recommendation**: Create `protocols/` subfolder with clear categorization by topic (type-sync, testing, integration).

---

## Category 3: Agent Definitions (PRIORITY: MEDIUM)

**Location**: Should remain in agents/ with reference link
**Files**: 3

| File | Current Location | Purpose | Action |
|------|-----------------|---------|---------|
| `cross-project-coordinator.md` | `project-context/agents/` | Agent definition | **KEEP** + link from coordination/README |
| `cross-project-coordinator.md` | `.claude/agents/` | Agent definition (duplicate) | **VERIFY** if duplicate or different version |
| `agent-reference.md` | `project-context/` | All agents reference | **KEEP** (general reference) |

**Recommendation**: Keep agent definitions in their current locations. Add reference links in coordination/README.md.

---

## Category 4: Type Synchronization Infrastructure (PRIORITY: HIGH)

**Location**: Needs dedicated type-sync/ subfolder or keep in protocols/
**Files**: 12

### 4.1 Scripts & Automation

| File | Current Location | Purpose | Action |
|------|-----------------|---------|---------|
| `check-types-local.sh` | `scripts/` | Type validation script | **KEEP** (code infrastructure) |
| `test-integration-local.sh` | `scripts/` | Integration test script | **KEEP** (code infrastructure) |
| `verify-backend.sh` | `tests/integration/` | Backend verification | **KEEP** (code infrastructure) |

### 4.2 Documentation

All documentation files listed in Category 2.2 above.

**Recommendation**: Keep scripts in place. Create `protocols/type-synchronization/` subfolder for all type sync documentation.

---

## Category 5: Issue Resolution History (PRIORITY: LOW - Archive)

**Location**: code-review/20251016/issues/001-member-access-rls-regression/
**Files**: 14

### 5.1 RLS Regression Issue (October 16, 2025)

| File | Current Location | Purpose | Action |
|------|-----------------|---------|---------|
| `README.md` | `issues/001-member-access-rls-regression/` | Issue overview | **KEEP** (well-organized) |
| `REGRESSION-ROOT-CAUSE-ANALYSIS.md` | `issues/001-member-access-rls-regression/` | Root cause analysis | **KEEP** (valuable reference) |
| `DELIVERABLE-RLS-ERROR-ANALYSIS.md` | `issues/001-member-access-rls-regression/` | Error analysis | **KEEP** |
| `MEMBER-MANAGEMENT-REGRESSION-ANALYSIS.md` | `issues/001-member-access-rls-regression/` | Regression analysis | **KEEP** |
| `QUICK-FIX-GUIDE.md` | `issues/001-member-access-rls-regression/` | Quick fix guide | **KEEP** |
| `QUICK-FIX-ProjectMembersScreen.md` | `issues/001-member-access-rls-regression/` | Screen-specific fix | **KEEP** |
| `rls-member-fetch-error-analysis.md` | `issues/001-member-access-rls-regression/` | Fetch error analysis | **KEEP** |
| `REDUX-CONSOLIDATION-REGRESSION-ANALYSIS.md` | `issues/001-member-access-rls-regression/` | Redux analysis | **KEEP** |

**Additional coordination files already listed in Category 1.2**

### 5.2 Code Review Organization

| File | Current Location | Purpose | Action |
|------|-----------------|---------|---------|
| `CODE-REVIEW-REMEDIATION-PLAN.md` | `code-review/20251016/` | Remediation plan | **KEEP** |
| `ORGANIZATION-REPORT.md` | `code-review/20251016/` | Organization report | **KEEP** |
| `TASK-12-13-STATUS-REPORT.md` | `code-review/20251016/03-status-reports/` | Status report | **KEEP** |

**Recommendation**: This is well-organized. Keep entire `code-review/20251016/` structure intact. Reference from coordination/archive/.

---

## Category 6: Task-Specific Backend Integration (PRIORITY: LOW)

**Location**: MVP2/implementation/tasks/
**Files**: 8

| File | Current Location | Purpose | Action |
|------|-----------------|---------|---------|
| `task_012_backend_spec.md` | `implementation/tasks/` | Task 12 backend spec | **KEEP** (task-specific) |
| `task_012_execution_plan.md` | `implementation/tasks/` | Execution plan | **KEEP** (task-specific) |
| `task_012_implementation_spec.md` | `implementation/tasks/` | Implementation spec | **KEEP** (task-specific) |
| `task_012_kickoff_prompt.md` | `implementation/tasks/` | Kickoff prompt | **KEEP** (task-specific) |
| `task_012_status.md` | `implementation/tasks/` | Status tracking | **KEEP** (task-specific) |
| `TASK-12-STATUS.md` | `implementation/tasks/` | Status (duplicate?) | **CONSOLIDATE** |
| `TASK-13-STATUS.md` | `implementation/tasks/` | Task 13 status | **KEEP** (task-specific) |
| `TASK-12-INTEGRATION-PATH.md` | `implementation/tasks/` | Integration path | **KEEP** (task-specific) |

**Recommendation**: Keep task-specific files where they are. Do NOT move to coordination/ (belongs with task context).

---

## Category 7: Reference Documentation (PRIORITY: MEDIUM)

**Location**: Various locations
**Files**: 8

| File | Current Location | Purpose | Action |
|------|-----------------|---------|---------|
| `Stack-Best-Practices-Research-2024.md` | `documentation/developer-docs/` | Stack best practices | **KEEP** (general reference) |
| `dev-database-reset-guide.md` | `documentation/developer-docs/` | Database reset guide | **KEEP** (developer reference) |
| `supabase-integration-progress.md` | `development-context/supabase-backend/` | Integration progress | **ARCHIVE** or **UPDATE** |
| `database-information.md` | `development-context/supabase-backend/` | Database info | **EVALUATE** relevance |
| `SQLITE-SUPABASE-SCHEMA-ALIGNMENT.md` | `MVP2/implementation/analysis/` | Schema alignment | **MOVE** to protocols/ |

**Recommendation**: Most reference docs are fine where they are. Move schema alignment to coordination protocols.

---

## Category 8: Scattered Status/Completion Files (PRIORITY: HIGH - Cleanup)

**Location**: Various (root, project-context, etc.)
**Files**: 6

| File | Current Location | Purpose | Action |
|------|-----------------|---------|---------|
| `COORDINATION-COMPLETE.md` | `project-context/` | Coordination complete (Oct 20) | **ARCHIVE** |
| `ORGANIZATION-COMPLETE.md` | `code-review/` | Organization complete | **ARCHIVE** |
| `task-13-integration-complete.md` | `MVP2/implementation/guides/` | Task 13 complete | **ARCHIVE** |
| `TASK-12-PHASE-3.3-COMPLETE.md` | `MVP2/implementation/tasks/` | Phase completion | **ARCHIVE** |
| `TASK-12-PHASE2-I2-COMPLETE.md` | `ROOT/` | Phase completion (ROOT!) | **ARCHIVE** (wrong location!) |
| `PROJECT-TEST-SUMMARY.md` | `ROOT/` | Test summary (ROOT!) | **ARCHIVE** (wrong location!) |

**Recommendation**: Files in ROOT should NEVER happen. Archive all completion files with clear dates and context.

---

## Proposed Folder Structure

```
cross-project-coordination/
├── README.md                          # Overview, quick links, agent references
│
├── active/                            # Current coordination activities
│   ├── .gitkeep                      # (Currently no active items)
│   └── TEMPLATE-coordination-task.md # Template for new coordination tasks
│
├── protocols/                         # Coordination protocols & best practices
│   ├── type-synchronization/
│   │   ├── README.md
│   │   ├── backend-mobile-type-sync-comparison.md
│   │   ├── supabase-type-consistency-strategy.md
│   │   ├── typescript-cross-repo-sync-best-practices-2025.md
│   │   ├── type-sync-decision-matrix.md
│   │   ├── local-dev-sync-workflow.md
│   │   └── QUICK-REFERENCE-TYPE-SYNC-RESEARCH.md
│   │
│   ├── integration-testing/
│   │   ├── README.md
│   │   ├── CLOUD-BACKEND-TESTING-GUIDE.md
│   │   ├── backend-mobile-integration-lessons.md  # CRITICAL
│   │   └── SQLITE-SUPABASE-SCHEMA-ALIGNMENT.md
│   │
│   ├── backend-coordination/
│   │   ├── README.md
│   │   ├── BACKEND-REPOSITORY-ANALYSIS.md
│   │   └── cross-project-communication-protocol.md  # NEW
│   │
│   └── orchestration/
│       ├── CROSS-PROJECT-ORCHESTRATION-GUIDE.md  # Already exists
│       └── cross-project-coordination-reference.md
│
├── templates/                         # Reusable templates
│   ├── TEMPLATE-backend-coordination-request.md
│   ├── TEMPLATE-cross-project-task.md  # CPT-YYYY-MM-DD-NNN format
│   ├── TEMPLATE-deployment-checklist.md
│   └── type-sync-implementation-templates.md
│
├── archive/                           # Completed coordination activities
│   ├── 2025-09/
│   │   ├── CPT-2025-09-17-001-backend-mobile-coordination-status.md
│   │   └── CPT-2025-09-29-001-backend-alignment-assessment.md
│   │
│   ├── 2025-10/
│   │   ├── oct-16-rls-regression-issue/
│   │   │   ├── README.md
│   │   │   ├── BACKEND-COORDINATION-REQUEST.md
│   │   │   ├── BACKEND-FIX-COMPLETE.md
│   │   │   ├── CROSS-PROJECT-COORDINATION-SUMMARY.md
│   │   │   ├── CROSS-PROJECT-COORDINATION-COMPLETE.md
│   │   │   └── COORDINATOR-EXECUTIVE-SUMMARY.md
│   │   │
│   │   ├── oct-20-coordination-complete/
│   │   │   └── COORDINATION-COMPLETE.md
│   │   │
│   │   ├── oct-21-type-casting-fix/
│   │   │   ├── BACKEND-FIX-COMPLETE-V2.md
│   │   │   ├── BACKEND-INCOMPLETE-DEPLOYMENT.md
│   │   │   └── BACKEND-UPDATE-SUMMARY.md
│   │   │
│   │   └── task-13-integration/
│   │       ├── task-13-integration-complete.md
│   │       └── CLOUD-INTEGRATION-VALIDATION-SUMMARY.md
│   │
│   └── completion-reports/
│       ├── TASK-12-PHASE-3.3-COMPLETE.md
│       ├── TASK-12-PHASE2-I2-COMPLETE.md
│       ├── PROJECT-TEST-SUMMARY.md
│       └── ORGANIZATION-COMPLETE.md
│
└── reference-links/                   # Symlinks or references to related docs
    ├── agent-cross-project-coordinator.md  → ../../agents/cross-project-coordinator.md
    ├── backend-mobile-type-sync-guide.md   → ../../../documentation/developer-docs/Backend-Mobile-Type-Synchronization-Guide.md
    ├── supabase-integration-guide.md       → ../../../documentation/app-technical-guides/Supabase-Integration-Guide.md
    └── code-review-rls-issue.md            → ../../code-review/20251016/issues/001-member-access-rls-regression/README.md
```

---

## Detailed File Inventory by Current Location

### Root Directory (2 files - WRONG LOCATION)
- `TASK-12-PHASE2-I2-COMPLETE.md` → **ARCHIVE** to `completion-reports/`
- `PROJECT-TEST-SUMMARY.md` → **ARCHIVE** to `completion-reports/`

### project-context/ (3 files)
- `cross-project-coordination-reference.md` → **MOVE** to `protocols/orchestration/`
- `COORDINATION-COMPLETE.md` → **ARCHIVE** to `archive/2025-10/oct-20-coordination-complete/`
- `swarm-coordination-strategy.md` → **EVALUATE** (may not be cross-project specific)

### project-context/agents/ (1 file + 1 reference)
- `cross-project-coordinator.md` → **KEEP** + reference link
- Reference in `agent-reference.md` → **KEEP**

### project-context/learnings/ (12 files - Type Sync Related)
- `backend-mobile-integration-lessons.md` → **MOVE** to `protocols/integration-testing/` (CRITICAL)
- `backend-mobile-type-sync-comparison.md` → **MOVE** to `protocols/type-synchronization/`
- `supabase-type-consistency-strategy.md` → **MOVE** to `protocols/type-synchronization/`
- `typescript-cross-repo-sync-best-practices-2025.md` → **MOVE** to `protocols/type-synchronization/`
- `type-sync-workflow-test-results.md` → **ARCHIVE** (historical data)
- `type-sync-decision-matrix.md` → **MOVE** to `protocols/type-synchronization/`
- `type-sync-implementation-templates.md` → **MOVE** to `templates/`
- `local-dev-sync-workflow.md` → **MOVE** to `protocols/type-synchronization/`
- `QUICK-REFERENCE-TYPE-SYNC-RESEARCH.md` → **MOVE** to `protocols/type-synchronization/`
- `aadf-cross-project-dashboard-framework.md` → **EVALUATE**
- `tech-stack-best-practice.md` → **KEEP** (general, not cross-project specific)
- `task-specification-planning-patterns.md` → **KEEP** (general patterns)

### project-context/code-review/ (5 files)
- `BACKEND-FIX-COMPLETE-V2.md` → **ARCHIVE** to `archive/2025-10/oct-21-type-casting-fix/`
- `BACKEND-INCOMPLETE-DEPLOYMENT.md` → **ARCHIVE** to `archive/2025-10/oct-21-type-casting-fix/`
- `BACKEND-UPDATE-SUMMARY.md` → **ARCHIVE** to `archive/2025-10/oct-21-type-casting-fix/`
- `ORGANIZATION-COMPLETE.md` → **ARCHIVE** to `archive/completion-reports/`
- `WHERE-AM-I.md` → **KEEP** (navigation helper)

### project-context/code-review/20251016/issues/001-member-access-rls-regression/ (14 files)
- Entire directory → **REFERENCE LINK** from `archive/2025-10/oct-16-rls-regression-issue/`
- Key coordination files:
  - `BACKEND-COORDINATION-REQUEST.md`
  - `BACKEND-FIX-COMPLETE.md`
  - `CROSS-PROJECT-COORDINATION-SUMMARY.md`
  - `CROSS-PROJECT-COORDINATION-COMPLETE.md`
  - `COORDINATOR-EXECUTIVE-SUMMARY.md`
- Keep entire issue folder intact, reference from archive

### project-context/development-context/MVP2/archive/ (2 files)
- `CPT-2025-09-17-001-backend-mobile-coordination-status.md` → **MOVE** to `archive/2025-09/`
- `CPT-2025-09-29-001-backend-alignment-assessment.md` → **MOVE** to `archive/2025-09/`

### project-context/development-context/MVP2/implementation/guides/ (4 files)
- `BACKEND-REPOSITORY-ANALYSIS.md` → **MOVE** to `protocols/backend-coordination/`
- `CLOUD-BACKEND-TESTING-GUIDE.md` → **MOVE** to `protocols/integration-testing/`
- `CLOUD-INTEGRATION-VALIDATION-SUMMARY.md` → **ARCHIVE** to `archive/2025-10/task-13-integration/`
- `task-13-integration-complete.md` → **ARCHIVE** to `archive/2025-10/task-13-integration/`

### project-context/development-context/MVP2/implementation/tasks/ (9 files)
- All task-specific files → **KEEP** in place (task context, not coordination context)
- `task_012_backend_spec.md`, `task_012_execution_plan.md`, etc. → **KEEP**
- `TASK-12-PHASE-3.3-COMPLETE.md` → **ARCHIVE** to `completion-reports/`

### project-context/development-context/MVP2/implementation/analysis/ (1 file)
- `SQLITE-SUPABASE-SCHEMA-ALIGNMENT.md` → **MOVE** to `protocols/integration-testing/`

### project-context/development-context/MVP2/implementation/execution/cross-project-coordination/ (1 file)
- `CROSS-PROJECT-ORCHESTRATION-GUIDE.md` → **KEEP** (already in target location!)

### documentation/developer-docs/ (2 files)
- `Backend-Mobile-Type-Synchronization-Guide.md` → **KEEP** + reference link
- `dev-database-reset-guide.md` → **KEEP** (general reference)

### documentation/app-technical-guides/ (1 file)
- `Supabase-Integration-Guide.md` → **KEEP** + reference link

### scripts/ (2 files)
- `check-types-local.sh` → **KEEP** (code infrastructure)
- `test-integration-local.sh` → **KEEP** (code infrastructure)

### tests/integration/ (1 file)
- `verify-backend.sh` → **KEEP** (code infrastructure)

### .claude/agents/ (1 file)
- `cross-project-coordinator.md` → **VERIFY** if duplicate

---

## Files That Should NOT Move

**Reason**: Better organized where they are, or code infrastructure

1. **All task-specific files** in `MVP2/implementation/tasks/` (8 files)
2. **Code review issue folder** `code-review/20251016/` (keep intact, reference only)
3. **General documentation** in `documentation/` (2 files + reference links)
4. **Scripts** in `scripts/` and `tests/integration/` (3 files - code infrastructure)
5. **Agent definitions** in `project-context/agents/` (1 file)
6. **General learnings** not specific to cross-project coordination (2-3 files)

---

## Files Requiring Evaluation

**Need to determine if truly cross-project or general**

1. `swarm-coordination-strategy.md` - May be general agent coordination, not backend-specific
2. `aadf-cross-project-dashboard-framework.md` - May be AADF framework doc, not backend coordination
3. `supabase-integration-progress.md` - May be outdated or superseded
4. `database-information.md` - May be general database info
5. `.claude/agents/cross-project-coordinator.md` - Verify if duplicate of `project-context/agents/` version

---

## Risk Assessment

### Low Risk (Safe to Move - Documentation Only)

- **All learnings/ files** (12 files) - Pure documentation, no code references
- **All archive/ files** (2 files) - Already archived, just reorganizing
- **All code-review completion files** (5 files) - Historical documentation
- **All ROOT completion files** (2 files) - Should never have been in root
- **All guides/ files** (4 files) - Documentation, may have references

### Medium Risk (Check References Before Moving)

- `cross-project-coordination-reference.md` - May be referenced in CLAUDE.md or other docs
- `CROSS-PROJECT-ORCHESTRATION-GUIDE.md` - Already in target location, verify no external references
- Task-specific guides (4 files) - May be referenced from task files

### No Risk (Do Not Move)

- Scripts and test files (3 files) - Code infrastructure
- Task-specific files (8 files) - Task context integrity
- Documentation/ files (2 files) - Correct location for developer docs
- Agent definitions (1 file) - Correct location for agent definitions

---

## Implementation Plan

### Phase 1: Preparation (30 min)

1. **Create folder structure** in `cross-project-coordination/`
   - `active/`, `protocols/`, `templates/`, `archive/`, `reference-links/`
   - Subfolders under `protocols/`: `type-synchronization/`, `integration-testing/`, `backend-coordination/`, `orchestration/`
   - Archive subfolders: `2025-09/`, `2025-10/`, `completion-reports/`

2. **Create README.md** in `cross-project-coordination/`
   - Overview of system
   - Quick navigation links
   - Agent references
   - How to create new coordination tasks

3. **Search for references** to files being moved
   ```bash
   grep -r "cross-project-coordination-reference.md" .
   grep -r "backend-mobile-integration-lessons.md" .
   grep -r "CROSS-PROJECT-ORCHESTRATION-GUIDE.md" .
   ```

### Phase 2: Move Active/Protocol Files (1 hour)

**Order**: Low-risk first, check references before each move

1. **Move learnings/ files** (12 files)
   - Type sync files → `protocols/type-synchronization/`
   - Integration lessons → `protocols/integration-testing/`
   - Templates → `templates/`

2. **Move guides/ files** (4 files)
   - Backend analysis → `protocols/backend-coordination/`
   - Cloud testing → `protocols/integration-testing/`
   - Schema alignment → `protocols/integration-testing/`

3. **Move project-context/ files** (2 files)
   - Coordination reference → `protocols/orchestration/`

### Phase 3: Archive Historical Files (1 hour)

1. **Archive 2025-09 coordination** (2 files)
   - CPT files → `archive/2025-09/`

2. **Archive 2025-10 coordination** (12 files)
   - RLS regression coordination (5 files) → `archive/2025-10/oct-16-rls-regression-issue/`
   - Type casting fix (3 files) → `archive/2025-10/oct-21-type-casting-fix/`
   - Task 13 integration (2 files) → `archive/2025-10/task-13-integration/`
   - Coordination complete (1 file) → `archive/2025-10/oct-20-coordination-complete/`

3. **Archive completion reports** (5 files)
   - All completion files from various locations → `archive/completion-reports/`

### Phase 4: Create Reference Links (30 min)

1. **Create reference links** in `reference-links/`
   - Agent definition
   - Developer docs (type sync guide, Supabase guide)
   - Code review RLS issue folder
   - Other relevant external documentation

2. **Create README.md** in each protocol subfolder
   - Overview of topic
   - Links to related files
   - Quick reference guides

### Phase 5: Update References (1 hour)

1. **Update CLAUDE.md** if it references moved files
2. **Update cross-project-coordination/README.md** with complete navigation
3. **Update task files** if they reference moved guides
4. **Update any scripts** that reference moved documentation
5. **Create git commit** with clear description

### Phase 6: Create Templates (1 hour)

1. **TEMPLATE-backend-coordination-request.md**
   - Based on `BACKEND-COORDINATION-REQUEST.md`
   - Standard format for coordination requests

2. **TEMPLATE-cross-project-task.md**
   - Based on CPT files
   - CPT-YYYY-MM-DD-NNN format

3. **TEMPLATE-deployment-checklist.md**
   - Based on lessons from `backend-mobile-integration-lessons.md`
   - Pre-deployment verification steps

4. **Update README** with template usage instructions

### Phase 7: Validation (30 min)

1. **Verify all files moved successfully**
2. **Test reference links work**
3. **Check no broken references**
4. **Review folder structure makes sense**
5. **Create final documentation commit**

---

## Files to Update After Reorganization

### CLAUDE.md

**Current references** (if any):
- Search for any references to moved files
- Update paths to new locations

**Additions needed**:
```markdown
### Cross-Project Coordination
- **Central Hub**: `project-context/development-context/MVP2/implementation/execution/cross-project-coordination/`
- **Key Protocols**: Type synchronization, integration testing, backend coordination
- **Agent**: `cross-project-coordinator` (see `project-context/agents/`)
- **Archive**: Historical coordination activities organized by date
```

### cross-project-coordination/README.md (NEW)

**Content outline**:
1. **Purpose** - What this folder contains
2. **Quick Navigation** - Links to active, protocols, templates, archive
3. **Agent Reference** - Link to cross-project-coordinator agent
4. **How to Create New Coordination Task** - Step-by-step guide
5. **Protocol Index** - Quick links to all protocols
6. **Archive Index** - Historical coordination activities
7. **External References** - Links to related documentation

### Each Protocol Subfolder README.md (NEW)

**type-synchronization/README.md**:
- Overview of type sync process
- Links to all type sync files
- Quick reference workflow
- Common issues and solutions

**integration-testing/README.md**:
- Overview of integration testing protocols
- Backend-mobile testing guide
- Cloud testing procedures
- Lessons learned reference

**backend-coordination/README.md**:
- Backend repository structure
- Coordination request protocol
- Communication standards
- Deployment verification

**orchestration/README.md**:
- Orchestration guide overview
- Cross-project workflow
- Supabase services matrix
- Success metrics

---

## Success Metrics

### Organization Quality

- **Discoverability**: Any developer can find coordination protocols in <60 seconds
- **Completeness**: All cross-project files centralized (100% coverage)
- **Clarity**: Clear separation between active, protocols, templates, archive
- **Navigation**: README files provide instant orientation

### Efficiency Improvements

- **Onboarding Time**: New developers understand coordination system in <15 minutes
- **Protocol Access**: Common protocols accessible in 1-2 clicks
- **Historical Research**: Past coordination activities easy to find and reference
- **Template Usage**: Creating new coordination tasks takes <5 minutes

### Maintenance

- **File Placement**: Clear rules for where new files go
- **Archive Process**: Completed activities archived within 1 week
- **Reference Links**: External docs linked, not duplicated
- **Documentation Updates**: README files stay current

---

## Next Steps

1. **Review this audit** with stakeholders
2. **Get approval** for reorganization plan
3. **Schedule implementation** (estimated 4-6 hours)
4. **Execute phased implementation** per plan above
5. **Update all references** to moved files
6. **Create templates** for future coordination
7. **Document learnings** in AADF framework

---

## Questions for Stakeholder Review

1. **Archive Strategy**: Should we keep original code-review/20251016/ folder intact and just reference it, or move coordination files into new archive structure?

2. **Evaluation Needed**: What should we do with these files?
   - `swarm-coordination-strategy.md`
   - `aadf-cross-project-dashboard-framework.md`
   - `supabase-integration-progress.md`

3. **Duplicate Files**: Which version to keep?
   - `project-context/agents/cross-project-coordinator.md`
   - `.claude/agents/cross-project-coordinator.md`

4. **Task Files**: Should task-specific backend integration files stay in tasks/ folder or move to coordination/?

5. **Reference Links**: Use symlinks or markdown reference files in `reference-links/`?

---

**Status**: ✅ Audit Complete - Ready for Review
**Created**: 2025-10-28
**Estimated Implementation**: 4-6 hours
**Risk Level**: LOW (documentation reorganization)
**Benefit**: HIGH (improved discoverability and maintenance)
