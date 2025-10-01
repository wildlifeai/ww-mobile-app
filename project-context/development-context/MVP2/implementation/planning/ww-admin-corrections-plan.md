# WW Admin Task Corrections Plan & Execution Tracker

**Created**: 2025-01-29
**Purpose**: Systematically correct WW Admin references in task files to align with architectural decision that WW Admin user management is web-only
**Status**: ✅ COMPLETED (16/16 files corrected)

---

## 🚀 **EXECUTION PLAN - OPTIMIZED FOR EFFICIENCY**

**⚡ IMMEDIATE ACTION**: Use the detailed execution plan for systematic corrections.

### **📋 Detailed Execution Plan Available**
**Full Strategic Plan**: [`@project-context/MVP2-Tasks/WW-ADMIN-CORRECTIONS-EXECUTION-PLAN.md`](../../MVP2-Tasks/WW-ADMIN-CORRECTIONS-EXECUTION-PLAN.md)

**Key Features of Execution Plan**:
- ✅ **Optimized for clean context windows** - Full clear between phases
- ✅ **Dependency-based sequencing** - Critical path identified
- ✅ **Maximum parallel execution** - 3 agents working simultaneously where possible
- ✅ **Phase-based approach** - 4 focused sessions (4.5 hours total)
- ✅ **Agent specialization** - Right expert for each phase

### **Quick Reference Execution Strategy**:
1. **Phase 1** (45-60 min): Critical Redux corrections (`mobile-dev`)
2. **Phase 2** (45 min): Parallel validation - Database + Tests + Docs (3 agents)
3. **Phase 3** (60 min): Task file corrections (`docs-maintainer`)
4. **Phase 4** (30 min): Final validation (`tester` + `docs-maintainer`)

### **Legacy Execution Prompt** (Use detailed plan instead):
~~Use this prompt~~ → **DEPRECATED**: Use detailed execution plan above for better results

```
REPLACED BY DETAILED EXECUTION PLAN - See link above
```

---

## 📋 Architecture Clarification (Reference)

### ✅ WW Admin MOBILE App Permissions:
- **Read-only** project visibility across all organisations
- **WW Admin Tools menu** that redirects to web portal
- **NO** user management operations
- **NO** organisation switching (they belong to wildlife.ai only)
- **NO** deployment operations (unless through other roles)

### 🌐 WW Admin WEB Portal Functions:
- **ALL** user management (add, deactivate, assign to organisations)
- **ALL** organisation management
- **ALL** system configuration
- **ALL** bulk operations
- **ALL** administrative functions

---

## 🔧 Task Files Requiring Corrections

### ✅ Correction Status Legend:
- ⬜ Not Started
- 🔄 In Progress
- ✅ Completed
- ⚠️ Needs Review
- ❌ Blocked

---

## Task-by-Task Correction Plan

### ⚠️ **SPECIAL HANDLING: Tasks 10 & 11**

**Current Status**:
- **Task 10**: ✅ ALREADY IMPLEMENTED (Redux Integration complete)
- **Task 11**: 🔄 IN PROGRESS (Subtasks 11.1-11.5 completed, working on 11.6)

**Consolidation Strategy**:
Since Task 10 is already implemented and we're midway through Task 11, we need to:
1. **Create a new Task 11 subtask** to review and correct what's already implemented
2. **Identify gaps** between current implementation and corrected requirements
3. **Make necessary adjustments** before proceeding to Task 11.6

---

### **Task 11 Subtask: WW Admin Implementation Review & Correction** 🆕
**To be inserted before Task 11.6**
**Purpose**: Review implemented code from Tasks 10 & 11.1-11.5 and correct WW Admin misalignments

#### Implementation Review Checklist:

**From Task 10 (Redux) - Already Implemented**:
- [ ] Check if WW Admin Redux slice exists with user provisioning
- [ ] If yes, refactor to read-only project visibility only
- [ ] Remove any user management actions/reducers
- [ ] Add web portal navigation handlers

**From Task 11.1-11.5 (Offline/Sync) - Already Implemented**:
- [ ] Review DatabaseService.ts for WW Admin user management tables
- [ ] Review OfflineService.ts (already corrected - verify)
- [ ] Review OfflineApiService.ts (already corrected - verify)
- [ ] Check ConflictResolutionService.ts for user management conflicts
- [ ] Review test files for WW Admin user management tests

#### Code Changes Required:

1. **Redux Store Review** (`src/store/slices/`):
   - Locate any `wwAdminSlice.ts` or similar
   - Remove user provisioning state/actions
   - Keep only read-only project visibility state

2. **Database Schema Review** (`src/services/offline/DatabaseService.ts`):
   - Check for user management tables
   - These should remain for caching but not for creation
   - Ensure read-only access patterns

3. **Service Layer Cleanup**:
   - ✅ OfflineService.ts (already cleaned)
   - ✅ OfflineApiService.ts (already cleaned)
   - Check other services for WW Admin operations

4. **Test Updates**:
   - Update tests to reflect read-only access
   - Remove user management test scenarios
   - Add web portal navigation tests

---

### **Task 011: Offline SQLite Foundation (Original File Updates)** ⬜
**File**: `task_011.txt`
**Status**: Documentation needs updating after implementation review

#### Required Corrections:

1. **Lines 52-62** - Section "11.4: WW Admin Offline Features"
   - **Change Title to**: "11.4: Sync Infrastructure with Conflict Resolution"
   - **Remove ALL** WW Admin offline user provisioning content
   - **Keep Only**: Conflict resolution and sync infrastructure content
   - **Note**: WW Admin features are web-only, no offline user management needed

2. **Line 121** - Test Strategy
   - **Current**: "test WW Admin offline features"
   - **Change to**: "test read-only project visibility for WW Admin role"

3. **Line 128** - Subtask 1 Details (COMPLETED section)
   - **Current**: Mentions "WW Admin features"
   - **Change to**: "cross-organisation read-only access patterns"

4. **Lines 148-152** - Subtask 11.5: WW Admin Offline Features
   - **REMOVE ENTIRE SUBTASK** or
   - **REPLACE WITH**: Performance optimization content
   - **Reason**: User provisioning is web-only

5. **Line 164** - Subtask 11.7 Details
   - **Current**: "WW Admin offline user provisioning"
   - **Change to**: "WW Admin read-only project access"

#### Validation Check:
- [ ] No offline user management references remain
- [ ] Sync focuses on project data only for WW Admin
- [ ] Test scenarios reflect read-only access

---

### **Task 012: Projects CRUD Operations** ⬜
**File**: `task_012.txt`
**Status**: Not Started

#### Required Corrections:

1. **Line 6** - Task Description
   - **Current**: "WW Admin features"
   - **Change to**: "WW Admin read-only visibility"

2. **Line 19** - WW Admin view ✅ (ALREADY CORRECT)
   - States: "View all projects across all organisations"
   - **No change needed** - this is correct

3. **Lines 53-55** - WW Admin operations
   - **Current**: Lists admin operations
   - **Change to**:
   ```
   - **NEW**: WW Admin read-only operations:
     - `getAllProjectsReadOnly()` - cross-organisation project viewing
     - No modification operations (handled via web portal)
   ```

#### Validation Check:
- [ ] Service layer only provides read methods for WW Admin
- [ ] No create/update/delete operations for WW Admin role
- [ ] UI shows read-only state clearly

---

### **Task 013: Member Management & Invitations** ⬜
**File**: `task_013.txt`
**Status**: Not Started

#### Required Corrections:

1. **Lines 61-63** - WW Admin bulk invitation
   - **Current**: "WW Admin bulk invitation capabilities"
   - **REMOVE** these lines entirely
   - **Add Note**: "Bulk invitations handled through web portal only"

#### Validation Check:
- [ ] No bulk operations in mobile app
- [ ] Member management limited to project admins
- [ ] WW Admin invitation features removed

---

### **Task 014: Project Administration & Analytics** ⬜
**File**: `task_014.txt`
**Status**: Not Started

#### Required Corrections:

1. **Line 104** - Key Features
   - **Current**: "WW Admin Global Management: MVP user provisioning"
   - **Change to**: "WW Admin Global Visibility: Read-only project overview across organisations"

#### Validation Check:
- [ ] Analytics are read-only for WW Admin
- [ ] No management operations available
- [ ] Clear distinction between viewing and managing

---

### **Task 014_maestro_installation** ⬜
**File**: `task_014_maestro_installation.txt`
**Status**: Not Started

#### Required Corrections:

1. **Line 68** - Test coverage
   - **Current**: "WW Admin login and organisation switching"
   - **Change to**: "WW Admin login with wildlife.ai organisation only"

#### Validation Check:
- [ ] Test scenarios reflect single organisation
- [ ] No organisation switching tests for WW Admin

---

### **Task 015: Start Deployment Flow** ⬜
**File**: `task_015.txt`
**Status**: Not Started

#### Required Corrections:

1. **Lines 17-18** - Project Access
   - **Current**: "ww_admin: All projects across all organisations"
   - **Change to**: "ww_admin: Read-only view of all projects (no deployment operations unless via other role)"

#### Validation Check:
- [ ] Deployment requires project role, not WW Admin role
- [ ] WW Admin can only view, not start deployments

---

### **Task 016: End Deployment Flow** ⬜
**File**: `task_016.txt`
**Status**: Not Started

#### Required Corrections:
- Review for similar patterns as Task 015
- Ensure WW Admin cannot end deployments unless through project role

---

### **Task 017: Deployments Management** ⬜
**File**: `task_017.txt`
**Status**: Not Started

#### Required Corrections:
- Review for WW Admin deployment management references
- Ensure read-only visibility only

---

### **Task 018: Device Management** ⬜
**File**: `task_018.txt`
**Status**: Not Started

#### Required Corrections:
- Review for WW Admin device management capabilities
- Should be read-only or through project roles only

---

### **Task 019: Maps & Location Services** ⬜
**File**: `task_019.txt`
**Status**: Not Started

#### Required Corrections:
- Review for WW Admin location/deployment operations
- Ensure viewing only, no modifications

---

### **Task 020: Sync & Conflict Resolution** ⬜
**File**: `task_020.txt`
**Status**: Not Started

#### Required Corrections:
- Review WW Admin sync operations
- Focus on read-only data sync only

---

### **Task 021: Comprehensive Testing** ⬜
**File**: `task_021.txt`
**Status**: Not Started

#### Required Corrections:

1. **Line 18** - WW Admin workflows
   - **Current**: "Global user provisioning"
   - **Change to**: "Read-only project visibility verification"

2. **Line 27** - Integration Testing
   - **Current**: "WW Admin features ↔ User provisioning"
   - **Change to**: "WW Admin features ↔ Web portal navigation"

3. **Line 77** - Functional Testing
   - **Current**: "WW Admin user provisioning"
   - **Change to**: "WW Admin read-only access verification"

#### Validation Check:
- [ ] All test scenarios reflect read-only access
- [ ] No user management testing in mobile
- [ ] Web portal redirection tested

---

### **Task 022: UI/UX Polish** ⬜
**File**: `task_022.txt`
**Status**: Not Started

#### Required Corrections:
- Review for WW Admin UI elements
- Ensure read-only states are clear in UI

---

### **Task 023: Production Readiness** ⬜
**File**: `task_023.txt`
**Status**: Not Started

#### Required Corrections:
- Review security and permissions
- Ensure WW Admin limitations are documented

---

### **tasks.json** ⬜
**File**: `tasks.json`
**Status**: Not Started

#### Required Corrections:
- Line 721: Update task details to reflect web-only user management
- Search for all WW Admin references and correct

---

## 📝 Execution Instructions

### For Each Task:

1. **BEFORE CHANGES**:
   ```
   "I'm about to update Task [NUMBER]: [TITLE]

   Current Understanding:
   - [List main corrections needed]
   - [List what will be removed]
   - [List what will be added/changed]

   Do you approve these changes?"
   ```

2. **MAKE CHANGES** following the correction plan

3. **AFTER CHANGES**:
   - Update status in this document from ⬜ to ✅
   - Add completion timestamp
   - Note any additional changes made

4. **COMMIT** after each task or logical batch

---

## 🔄 Progress Tracking

### Summary:
- **Total Files**: 16
- **Completed**: 16 ✅
- **In Progress**: 0
- **Remaining**: 0
- **Code Corrections**: wwAdminSlice.ts, WWAdminOfflineService.ts, DatabaseService.ts
- **Test Corrections**: wwAdminSlice.test.ts, WWAdminOfflineService.test.ts, AdvancedSyncOperations.test.ts
- **Documentation Updates**: Implementation specs, user roles spec, CLAUDE.md

### Completion Log:
```
[2025-01-29] - Phase 1A: wwAdminSlice.ts - COMPLETED - Refactored from user management to read-only + web portal
[2025-01-29] - Phase 1B: Redux Integration - COMPLETED - Store integration validated and working
[2025-01-29] - Phase 2A: DatabaseService - COMPLETED - Removed user management violations, now read-only compliant
[2025-01-29] - Phase 2B: Test Suites - COMPLETED - 34 tests updated/added, all passing
[2025-01-29] - Phase 2C: Documentation - COMPLETED - Implementation specs and user roles spec corrected
[2025-01-29] - Phase 3A: Tasks 011-015 - COMPLETED - Priority task files corrected
[2025-01-29] - Phase 3B: Tasks 016-023 + tasks.json - COMPLETED - All remaining task files corrected
[2025-01-29] - Phase 4A: Integration Testing - COMPLETED - All tests passing, TypeScript compilation successful
[2025-01-29] - Phase 4B: Progress Update - COMPLETED - All documentation and tracking updated
```

---

## ⚠️ Important Notes

1. **ALWAYS** confirm understanding before making changes
2. **NEVER** assume - ask if unclear
3. **PRESERVE** existing work that's unrelated to WW Admin
4. **TEST** changes don't break dependencies
5. **DOCUMENT** any discoveries or issues

---

## 🚀 Ready to Execute

This plan is ready for systematic execution. Start with Task 010 and work through sequentially, as later tasks may depend on earlier corrections.

**Next Steps**:
1. **IMMEDIATE**: Create Task 11 review subtask to check already-implemented code
2. **THEN**: Update task documentation files to reflect reality
3. **FINALLY**: Continue with remaining task file corrections

**Critical Note**: Since Tasks 10 and 11 are partially implemented, we must first review what exists and correct it before updating the task documentation files.