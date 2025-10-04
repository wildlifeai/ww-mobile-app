# Task 12 Kickoff Prompt - Projects CRUD Operations

## 🎯 Primary Objective

Execute **Task 12: Projects CRUD Operations** for Wildlife Watcher MVP2 mobile app using the comprehensive execution plan with AI agent coordination.

## 📋 Context Documents (Read These First)

**MANDATORY READING ORDER:**
1. `@project-context/development-context/MVP2/implementation/tasks/task_012.txt` - Task overview
2. `@project-context/development-context/MVP2/implementation/tasks/task_012_implementation_spec.md` - Detailed requirements (650 lines)
3. `@project-context/development-context/MVP2/implementation/tasks/task_012_execution_plan.md` - v2.0 execution strategy with agent assignments (800+ lines)
4. `@project-context/development-context/MVP2/implementation/tasks/task_012_backend_spec.md` - Backend coordination requirements (450 lines)

## 🚀 Execution Instructions

### Step 1: Initialize AI Project Orchestrator

Spawn the **ai-project-orchestrator** agent with this prompt:

```
Initialize Task 12 (Projects CRUD Operations) execution using the comprehensive execution plan.

Read these specifications:
- task_012_implementation_spec.md (requirements & clarifications)
- task_012_execution_plan.md (v2.0 with Supabase specialists)
- task_012_backend_spec.md (cross-repo API specs)

Your responsibilities:
1. Spawn all agents according to the Progressive Agent Spawning Strategy (Section 3.3)
2. Coordinate parallel execution across Backend and Mobile tracks
3. Monitor progress and handle handoffs at 60-min, 120-min, 210-min checkpoints
4. Update MVP2-METRICS-TRACKER.md with actual vs estimated hours
5. Ensure cross-project-coordinator relays specs between repos

Follow the execution plan exactly:
- Phase 1 (0-60min): Backend + Mobile foundation in parallel
- Phase 2 (60-210min): Integration with live backend
- Phase 3 (210-270min): Quality & polish

Start by spawning the cross-project-coordinator and Phase 1 agents.
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

**Estimated Total Time:** 4.5 hours (270 minutes) with 25% parallel efficiency savings

**Target Completion:** Single development session with 3 coordination checkpoints

**Post-Completion:** Commit all changes, update metrics tracker, create handoff notes for Task 13
