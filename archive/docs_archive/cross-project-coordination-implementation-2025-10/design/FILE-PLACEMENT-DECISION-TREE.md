# Cross-Project Coordination - File Placement Decision Tree

**Purpose**: Quick reference for determining where files should go
**Audience**: Developers adding new coordination files
**Date**: 2025-10-28

---

## Quick Decision Tree

```
┌─ New file related to backend coordination?
│
├─ YES → Is it still active/ongoing?
│   │
│   ├─ YES → Is it a general protocol/guide?
│   │   │
│   │   ├─ YES → What type?
│   │   │   ├─ Type synchronization → protocols/type-synchronization/
│   │   │   ├─ Integration testing → protocols/integration-testing/
│   │   │   ├─ Backend coordination → protocols/backend-coordination/
│   │   │   └─ Orchestration process → protocols/orchestration/
│   │   │
│   │   └─ NO → Is it a specific coordination task?
│   │       │
│   │       ├─ YES → active/CPT-YYYY-MM-DD-NNN-description.md
│   │       └─ NO → Is it a template?
│   │           ├─ YES → templates/TEMPLATE-description.md
│   │           └─ NO → Evaluate with team
│   │
│   └─ NO → Completed/Historical?
│       │
│       └─ YES → archive/YYYY-MM/description/
│
└─ NO → Is it task-specific (Task 12, 13, etc.)?
    │
    ├─ YES → Stay in MVP2/implementation/tasks/task_NNN/
    │
    └─ NO → Is it general developer documentation?
        │
        ├─ YES → documentation/developer-docs/
        │
        └─ NO → Is it code infrastructure (scripts, tests)?
            │
            ├─ YES → scripts/ or tests/integration/
            │
            └─ NO → Evaluate with team
```

---

## Decision Criteria

### 1. Is it cross-project coordination?

**YES** if the file involves:
- Mobile app ↔ Backend repository communication
- Backend team coordination requests
- Cross-repository type synchronization
- Backend deployment coordination
- Cross-project integration testing

**NO** if the file is:
- Single-project documentation
- General development practices
- Internal mobile app architecture
- Testing within mobile app only
- General AADF framework patterns

**If YES**: Continue to question 2
**If NO**: Not a coordination file, use normal project organization

---

### 2. Is it active or historical?

**ACTIVE** if:
- Coordination task is ongoing (not completed)
- Protocol is current and in use
- Template is actively used
- Guide is up-to-date

**HISTORICAL** if:
- Coordination task completed
- Issue resolved
- Deployment finished
- Completion report
- Superseded by newer version

**If ACTIVE**: Continue to question 3
**If HISTORICAL**: → `archive/YYYY-MM/description/`

---

### 3. What type of active file is it?

### Type A: Protocol/Guide (Reusable)

**Characteristics**:
- Describes "how to" do something
- Applicable to multiple coordination activities
- Contains best practices or lessons learned
- Referenced by multiple coordination tasks

**Examples**:
- Type synchronization workflow
- Backend deployment checklist
- Integration testing guide
- Communication protocols

**Destination**: → `protocols/<topic>/filename.md`

**Topics**:
- `type-synchronization/` - Type sync workflows, strategies, decisions
- `integration-testing/` - Testing protocols, cloud validation, lessons learned
- `backend-coordination/` - Backend repo info, coordination requests, processes
- `orchestration/` - High-level orchestration guides, cross-project workflows

---

### Type B: Coordination Task (Specific)

**Characteristics**:
- Addresses a specific coordination need
- Time-bound activity
- Has start and completion criteria
- Follows CPT-YYYY-MM-DD-NNN format

**Examples**:
- CPT-2025-10-28-001-new-backend-api-integration.md
- CPT-2025-11-05-002-type-sync-validation-failure.md

**Destination**: → `active/CPT-YYYY-MM-DD-NNN-description.md`

**Naming Convention**:
- `CPT` = Cross-Project Task
- `YYYY-MM-DD` = Date created
- `NNN` = Sequential number for that day (001, 002, etc.)
- `description` = Brief hyphenated description

**Move to archive** when task is completed (within 1 week of completion)

---

### Type C: Template (Reusable Pattern)

**Characteristics**:
- Provides standard format for creating new files
- Contains placeholders or instructions
- Starts with "TEMPLATE-"
- Not specific to any one coordination activity

**Examples**:
- TEMPLATE-backend-coordination-request.md
- TEMPLATE-cross-project-task.md
- TEMPLATE-deployment-checklist.md

**Destination**: → `templates/TEMPLATE-description.md`

**Usage**: Copy template, fill in details, save to appropriate location

---

## Edge Cases

### Edge Case 1: Task-Specific Backend Integration

**Question**: File describes backend work needed for a specific mobile app task (e.g., Task 12, Task 13)

**Answer**: **Keep with task context**

**Destination**: `MVP2/implementation/tasks/task_NNN/`

**Rationale**: Task-specific files belong with task context for session recovery and task execution. They're not reusable coordination patterns.

**Example**:
- `task_012_backend_spec.md` → Stay in `tasks/`
- `task_012_execution_plan.md` → Stay in `tasks/`

---

### Edge Case 2: Issue Resolution Documentation

**Question**: Files document a specific bug or issue that required backend coordination (e.g., RLS regression)

**Answer**: **Depends on organization**

**Well-organized issue folder** (e.g., `code-review/20251016/issues/001-member-access-rls-regression/`):
- **Keep intact** in original location
- **Create reference link** in `archive/YYYY-MM/issue-name.md`
- **Do not duplicate** files

**Scattered issue files**:
- **Consolidate** into `archive/YYYY-MM/issue-name/`
- **Preserve all context** and cross-references

**Rationale**: Issue folders are already chronologically organized. Reference links maintain discoverability without duplication.

---

### Edge Case 3: Completion/Status Reports

**Question**: File reports completion of a coordination activity or phase

**Answer**: **Archive immediately**

**Destination**: `archive/completion-reports/` or `archive/YYYY-MM/<activity>/`

**Rationale**: Completion reports are historical documentation. Archive preserves them for reference without cluttering active areas.

**Examples**:
- `COORDINATION-COMPLETE.md` → `archive/2025-10/oct-20-coordination-complete/`
- `TASK-12-PHASE2-I2-COMPLETE.md` → `archive/completion-reports/`
- `BACKEND-FIX-COMPLETE.md` → `archive/2025-10/oct-21-type-casting-fix/`

---

### Edge Case 4: External Documentation References

**Question**: File in another location (e.g., `documentation/developer-docs/`) is relevant to coordination

**Answer**: **Keep original, create reference link**

**Destination**: `reference-links/descriptive-name.md`

**Reference file format**:
```markdown
# Backend-Mobile Type Synchronization Guide

**Location**: `documentation/developer-docs/Backend-Mobile-Type-Synchronization-Guide.md`

**Purpose**: Comprehensive guide to maintaining type consistency between backend and mobile app

**Quick Link**: [View Guide](../../../documentation/developer-docs/Backend-Mobile-Type-Synchronization-Guide.md)

**Topics Covered**:
- Type generation workflow
- Validation scripts
- CI/CD integration
- Common issues and solutions
```

**Rationale**: Avoids duplication, maintains single source of truth, improves discoverability

---

### Edge Case 5: Agent Definitions

**Question**: File defines a cross-project agent (e.g., `cross-project-coordinator.md`)

**Answer**: **Keep in agents/, create reference link**

**Original Location**: `project-context/agents/cross-project-coordinator.md`
**Reference Location**: `reference-links/agent-cross-project-coordinator.md`

**Rationale**: Agent definitions belong in agents/ folder. Reference link improves discoverability from coordination hub.

---

### Edge Case 6: Code Infrastructure (Scripts, Tests)

**Question**: File is a script or test that supports coordination (e.g., `check-types-local.sh`)

**Answer**: **Keep in code infrastructure location**

**Destination**:
- Scripts → `scripts/`
- Tests → `tests/integration/`

**Reference**: Mention in relevant protocol documentation

**Rationale**: Code files belong with code infrastructure, not documentation. Protocol docs should reference them.

---

## Common Mistakes to Avoid

### Mistake 1: Saving to Root Directory

**NEVER save coordination files to repository root**

Examples of wrong locations:
- `/TASK-12-PHASE2-I2-COMPLETE.md` ❌
- `/PROJECT-TEST-SUMMARY.md` ❌
- `/COORDINATION-STATUS.md` ❌

**Correct**: Use appropriate subfolder in `cross-project-coordination/`

---

### Mistake 2: Duplicating External Documentation

**DON'T**: Copy files from `documentation/` into `cross-project-coordination/`

**DO**: Create reference link in `reference-links/`

**Why**: Single source of truth, avoid version drift

---

### Mistake 3: Mixing Active and Historical

**DON'T**: Keep completed tasks in `active/`

**DO**: Move to `archive/` within 1 week of completion

**Why**: Keep active/ folder clean and relevant

---

### Mistake 4: Task Files in Coordination Folder

**DON'T**: Move task-specific backend specs to `cross-project-coordination/`

**DO**: Keep in `MVP2/implementation/tasks/task_NNN/`

**Why**: Task context integrity for session recovery

---

### Mistake 5: No Clear Naming Convention

**DON'T**: Use inconsistent naming
- `backend-stuff-oct.md` ❌
- `coordination-thing-2.md` ❌
- `FIXME-backend-mobile.md` ❌

**DO**: Follow conventions
- `CPT-2025-10-28-001-description.md` ✅ (coordination tasks)
- `TEMPLATE-description.md` ✅ (templates)
- `descriptive-protocol-name.md` ✅ (protocols)

---

## Validation Checklist

Before saving a new file, verify:

- [ ] File is truly cross-project coordination (involves backend team)
- [ ] File destination chosen using decision tree above
- [ ] Naming convention followed
- [ ] Not duplicating existing documentation
- [ ] Not saving to root directory
- [ ] Not mixing active and historical content
- [ ] README.md updated with reference if needed

---

## Quick Reference Table

| File Type | Example | Destination |
|-----------|---------|-------------|
| Active coordination task | CPT-2025-10-28-001-api-sync.md | `active/` |
| Type sync protocol | backend-mobile-type-sync-workflow.md | `protocols/type-synchronization/` |
| Integration testing guide | cloud-backend-testing-protocol.md | `protocols/integration-testing/` |
| Backend coordination process | backend-deployment-verification.md | `protocols/backend-coordination/` |
| Orchestration guide | cross-project-workflow.md | `protocols/orchestration/` |
| Reusable template | TEMPLATE-coordination-request.md | `templates/` |
| Completed coordination | [Task completed Oct 20] | `archive/2025-10/description/` |
| Completion report | PHASE-X-COMPLETE.md | `archive/completion-reports/` |
| Issue resolution docs | [RLS regression Oct 16] | Reference link to `code-review/` |
| External doc reference | Backend-Mobile-Type-Sync-Guide | `reference-links/` |
| Agent definition | cross-project-coordinator.md | Reference link to `agents/` |
| Task-specific backend spec | task_012_backend_spec.md | `tasks/task_012/` |
| Script/test | check-types-local.sh | `scripts/` or `tests/` |

---

## Getting Help

**Not sure where a file should go?**

1. **Use decision tree** above
2. **Check similar files** - where are related files?
3. **Review audit report** - `COORDINATION-FILES-AUDIT-REPORT.md`
4. **Ask in coordination README** - examples provided
5. **When in doubt** - create in `active/` and evaluate with team

**Remember**: It's easy to move files later. Better to have clear organization than scattered files.

---

**Created**: 2025-10-28
**Status**: Active Reference
**Update Frequency**: As needed when new patterns emerge
