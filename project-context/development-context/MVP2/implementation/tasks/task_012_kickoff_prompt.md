# Task 12 Kickoff Prompt - Projects CRUD Operations

**🚨 CRITICAL UPDATE**: Offline-first architectural gap discovered. Before executing:
- Read `@project-context/development-context/MVP2/implementation/analysis/OFFLINE-IMPLEMENTATION-ANALYSIS.md`
- Read `@project-context/development-context/MVP2/implementation/tasks/task_012_offline_first_rewrite.md`
- Current implementation is CLOUD-FIRST (violates MVP2 Spec Section 6.1)
- **MANDATORY**: Complete 32-hour offline-first rewrite before proceeding with original plan

## 🎯 Primary Objective

Execute **Task 12: Projects CRUD Operations** for Wildlife Watcher MVP2 mobile app using the comprehensive execution plan with AI agent coordination.

## 📋 Context Documents (Read These First)

**MANDATORY READING ORDER (UPDATED):**
1. `@project-context/development-context/MVP2/implementation/analysis/OFFLINE-IMPLEMENTATION-ANALYSIS.md` - **READ FIRST** - Architectural gap analysis
2. `@project-context/development-context/MVP2/implementation/tasks/task_012_offline_first_rewrite.md` - **32-hour rewrite plan**
3. `@project-context/development-context/MVP2/implementation/tasks/task_012.txt` - Task overview (UPDATED with rewrite scope)
4. `@project-context/development-context/MVP2/implementation/tasks/task_012_implementation_spec.md` - Detailed requirements (650 lines)
5. `@project-context/development-context/MVP2/implementation/tasks/task_012_execution_plan.md` - v2.0 execution strategy (NOW SUPERSEDED by offline-first rewrite)
6. `@project-context/development-context/MVP2/implementation/tasks/task_012_backend_spec.md` - Backend coordination requirements (450 lines)

## 🚀 Execution Instructions

### Step 1: Acknowledge Architectural Change

**STOP**: Original execution plan is INVALID due to architectural mismatch.

**What Happened:**
- Current implementation: Cloud-first (Supabase as primary store)
- MVP2 Spec Section 6.1: Offline-first required ("core requirement, not optional")
- Discovery: Testing revealed projects stored in Supabase only, SQLite only used as sync buffer
- Impact: App fails offline instead of working seamlessly

**New Execution Strategy:**
1. **Complete offline-first rewrite FIRST** (32 hours / 4 days)
2. **Then** proceed with original integration plan

### Step 2: Initialize Offline-First Rewrite

Spawn the **ai-project-orchestrator** agent with this updated prompt:

```
Initialize Task 12 Phase 3A: Offline-First Architecture Rewrite

Read these critical documents:
- OFFLINE-IMPLEMENTATION-ANALYSIS.md (architectural gap discovery)
- task_012_offline_first_rewrite.md (32-hour implementation plan)
- task_012_implementation_spec.md (original requirements still apply)

Your responsibilities:
1. Execute 5-phase offline-first rewrite (LocalProjectsService, SyncService, ConflictResolver)
2. Coordinate mobile-dev, supabase-schema-architect, and quality-assurance-engineer agents
3. Replace RTK Query with local-first hooks (useLocalProjects)
4. Implement background sync with conflict resolution per Spec Section 6.4
5. Update MVP2-METRICS-TRACKER.md with 32-hour rewrite allocation

Follow the offline-first rewrite plan:
- Phase 1 (8hrs): Local Storage Foundation
- Phase 2 (8hrs): Background Sync System
- Phase 3 (4hrs): UI Integration
- Phase 4 (4hrs): Sync Status UI
- Phase 5 (8hrs): Testing & Validation

Start by spawning mobile-dev agent for Phase 1.
```

### Step 2: Verify Pre-Execution Checklist

**Before agents start work, confirm:**
- ✅ Task 11 (Offline SQLite Foundation) is 100% complete
- ✅ Backend repo is accessible at `~/dev/wildlifeai/wildlife-watcher-backend`
- ✅ Supabase dev environment is running
- ✅ Mobile dev environment is configured
- ✅ All Supabase types are generated and current

### Step 3: Monitor Coordination Checkpoints

**60-minute checkpoint:**
- Backend: APIs tested, gaps analyzed, business logic implemented, deployed to dev
- Mobile: Types defined, service shell created, RTK Query configured, mock LoRaWAN ready
- Action: cross-project-coordinator verifies handoff readiness

**120-minute checkpoint:**
- Mobile: Service integration complete, integration tests passing
- Backend: Monitoring active, ready for UI integration
- Action: Verify live backend connectivity

**210-minute checkpoint:**
- Mobile: All UI screens complete (ProjectsScreen, NewProjectScreen, OrgSwitcher)
- Backend: All API adjustments documented
- Action: Begin quality phase

### Step 4: Track Progress

**Continuously update:**
- `@project-context/development-context/MVP2/implementation/execution/MVP2-METRICS-TRACKER.md`
- Record actual hours per subtask
- Document variance from estimates
- Track blockers and solutions

### Step 5: Quality Gates

**MUST PASS before completion:**
1. ✅ All integration tests passing with live backend
2. ✅ Organisation isolation verified (users see only their org data)
3. ✅ WW Admin scope correct (org-scoped on mobile, NOT global)
4. ✅ Offline creation and sync working
5. ✅ Role-based permissions enforced (ww_admin, project_admin, project_member)
6. ✅ LoRaWAN mock data displaying correctly
7. ✅ All TypeScript errors resolved
8. ✅ Performance validated with 100+ projects

## 📊 Success Criteria (From Task 12 Spec)

- [ ] Project creation working online and offline
- [ ] Projects list displaying correctly with all summary info
- [ ] Search and filtering functional and performant
- [ ] Team member management working with proper permissions
- [ ] Proper error handling and user feedback
- [ ] Smooth navigation and user experience
- [ ] RTK Query integration with optimistic updates
- [ ] Offline support with reliable sync
- [ ] Organisation multi-tenancy enforced
- [ ] WW Admin mobile scope correctly implemented (org-scoped)

## 🤝 Cross-Repo Coordination

**Backend handoff files:**
- Backend creates: `~/wildlife-watcher-backend/project-context/MVP2-Tasks/task-12-mobile-api-ready.md`
- Backend updates: `~/wildlife-watcher-backend/project-context/PROJECT-STATUS.md`

**Mobile requirements relay:**
- Mobile already created: `task_012_backend_spec.md`
- cross-project-coordinator copies to: `~/wildlife-watcher-backend/project-context/MVP2-Tasks/task-12-mobile-requirements.md`

## ⚡ Key Clarifications (Critical)

**Organisation Membership Rules:**
- Standard users: 1 organisation only
- WW Admin: Maximum 2 organisations
- Backend trigger validates this on user_organisations insert

**WW Admin Mobile Scope:**
- Mobile app: Org-scoped (see projects in current selected org only)
- Web portal: Global view (see all projects across all orgs) - DIFFERENT from mobile!

**LoRaWAN Integration:**
- Use mock data for now (MockLoRaWANService)
- Display battery_level and sd_card_usage on project cards
- Real webhook integration deferred to later task

**Testing Approach:**
- Pragmatic TDD/BDD with 80% coverage target
- Focus on user journey tests first
- Use live Supabase dev environment (no elaborate mocking)

## 🎬 Final Command to Execute

After reading all context documents, execute:

```
@ai-project-orchestrator: Begin Task 12 execution following task_012_execution_plan.md v2.0.
Spawn cross-project-coordinator first, then spawn Phase 1 agents for parallel backend + mobile foundation work.
Track all progress in MVP2-METRICS-TRACKER.md with actual hours.
```

---

**🔴 UPDATED ESTIMATES:**

**Offline-First Rewrite (Phase 3A):** 32 hours (4 days)
- Phase 1: Local Storage Foundation - 8 hrs
- Phase 2: Background Sync System - 8 hrs
- Phase 3: UI Integration - 4 hrs
- Phase 4: Sync Status UI - 4 hrs
- Phase 5: Testing & Validation - 8 hrs

**Original Integration (Phase 3B):** 4.5 hours (after rewrite complete)

**New Total Estimate:** 36.5 hours

**Target Completion:** 4-5 development sessions with comprehensive testing

**Post-Completion:** Commit all changes, update metrics tracker, validate offline-first works in field conditions, create handoff notes for Task 13
