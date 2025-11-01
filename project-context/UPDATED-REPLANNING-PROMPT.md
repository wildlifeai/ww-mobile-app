# Wildlife Watcher MVP2 - Comprehensive Replanning Prompt
**Generated**: 2025-10-31
**Context**: Three Parallel Workstreams Convergence
**Methodology**: AADF Framework with Evidence-Based Discovery

---

## Executive Summary

There have been several activities in parallel requiring reorganization and replanning:

1. **Requirements Changes**: Stakeholder refinements (OVERVIEW.md → OVERVIEW-GOAL.md)
2. **Code Review Refactoring**: Technical debt remediation (Phase 1-3)
3. **Current Development**: Stream A Tasks 12-14 (Tasks 12-13 complete, Task 14 pending)

**Current State**:
- MVP2: 60.9% complete (Tasks 1-13 done, Tasks 14-23 pending)
- Stream A: 66.7% complete (Tasks 12-13 done, Task 14 pending)
- Development velocity: 1.3 tasks/day, 22% ahead of schedule

**Challenge**: These three workstreams need convergence into a unified, revised execution plan.

---

## 🔍 Comprehensive Discovery Findings

### Discovery Scope Completed
✅ Codebase structure & git history (30 commits analyzed)
✅ Backend schema evolution (mvp2-revised.md + comparison document)
✅ Code review findings (remediation plan + action items)
✅ Requirements gap analysis (baseline → goal state)
✅ Task specifications (all 24 tasks reviewed)

---

## DOCUMENT ORGANIZATION

Due to the large size of this analysis, the full document has been split into focused sections:

### 📁 Core Analysis Files (In project-context/)
1. **BACKEND-SCHEMA-IMPACT.md** - Complete backend schema changes analysis
2. **CODE-REVIEW-STATUS.md** - Remediation plan integration  
3. **REQUIREMENTS-DELTA.md** - Baseline → Goal requirements gap
4. **TASK-EVOLUTION-ANALYSIS.md** - How Tasks 14-23 have evolved
5. **CONVERGENCE-STRATEGY.md** - Phased integration plan

### 📊 Quick Reference Summary

**Backend Impact**: 12 breaking changes + 8 new tables = 47-66 days work
**Code Review**: 25.5-27.5 hours remediation (3-4 days)
**Requirements**: +23-35 days new features identified
**Task Specs**: +25-35 hours overhead across Tasks 14-23

**Total Timeline**: 6-8 weeks to production-ready MVP2

---

## 1. BACKEND SCHEMA IMPACT SUMMARY

**Source**: `~/wildlife-watcher-backend/dbml/mvp2-revised.md` + `SCHEMA-COMPARISON-MVP2-REVISED.md`

### Critical Breaking Changes

1. **Role Rename**: `model_manager` → `organisation_manager` (2-3 days)
2. **Users Table**: `name` → `firstname`/`surname` (3-4 days)
3. **Projects**: Added model_id, removed owner_id/end_date (7-10 days)
4. **Devices**: Complete rebuild with org_id, battery, SD card (5-7 days)
5. **Deployments**: Added ai_model_id, firmware_id, split comments (5-7 days)

### New Features Required

6. **AI Models System**: Model upload, selection, management (8-10 days)
7. **Firmware Management**: Version tracking, display (3-5 days)
8. **Device Preparation**: Workbench workflow before deployment (7-10 days)
9. **LoRaWAN Integration**: Webhook receiver, message parsing (5-7 days)
10. **Lookup Tables**: activity_sensitivity, sampling_designs (2-3 days)

**Total Backend Integration**: 47-66 days

**See**: `project-context/BACKEND-SCHEMA-IMPACT.md` for complete analysis

---

## 2. CODE REVIEW REMEDIATION SUMMARY

**Source**: `project-context/code-review/20251016/CODE-REVIEW-REMEDIATION-PLAN.md`

### Phase 1: Critical Blockers (5-8 hours)
⚠️ **MUST COMPLETE BEFORE TASK 14**

- **CR-1.1**: Remove hardcoded API keys from eas.json (2 hours)
- **CR-1.2**: Fix remaining 24 TypeScript errors (2-3 hours)  
- **CR-1.3**: Auto-fix 1000+ linting violations (1 hour)

### Phase 2: Quality Gates (6.5 hours)
📋 **BEFORE TASK 14 START**

- **CR-2.1**: ✅ Redux consolidation (COMPLETE)
- **CR-2.2**: React.memo for list components (3 hours)
- **CR-2.3**: SecureStore for auth tokens (2 hours)
- **CR-2.4**: Complete app.json setup (1.5 hours)

### Phase 3: Debt Reduction (14 hours)
🔄 **INCREMENTAL DURING TASKS 14-23**

- **CR-3.1**: Replace 486 console.log statements (4 hours)
- **CR-3.2**: Refactor large services (6 hours)
- **CR-3.3**: Add component tests (4 hours)

**Total Remediation**: 25.5-27.5 hours

**See**: `project-context/CODE-REVIEW-STATUS.md` for detailed plan

---

## 3. REQUIREMENTS DELTA SUMMARY

**Source**: OVERVIEW.md → OVERVIEW-GOAL.md comparison

### Major Changes

1. **Role Simplification**: 4 roles → 3 roles for MVP2
2. **Org Simplification**: Multi-org → Single "General" org  
3. **Camera Prep Workflow**: NEW 2-step process (7-10 days)
4. **In-App Invitations**: NEW project invitation system (5-7 days)
5. **Self-Registration**: NEW with email verification (3-5 days)
6. **Profile/Settings/Feedback**: NEW screens (4-6 days)
7. **Photo Storage Strategy**: Test vs deployment photos (2-3 days)
8. **Deployment Wizard**: 6 steps → 4-5 steps (1-2 days)
9. **Device Status Lifecycle**: Clarified transitions (1-2 days)

**Total New Work**: 23-35 days

**See**: `project-context/REQUIREMENTS-DELTA.md` for complete gap analysis

---

## 4. TASK EVOLUTION SUMMARY

**Source**: Task specifications (task_014.txt through task_023.txt)

### Task Specification Overhead

- **Task 14**: +5-7 hours (LoRaWAN device management, WW Admin features)
- **Task 15**: +7-10 hours (Device prep integration, LoRaWAN config)
- **Task 20**: +3-5 hours (Org-aware sync, LoRaWAN sync priority)
- **Task 23**: +2-3 hours (LoRaWAN security, org multi-tenancy)

**Total Overhead**: +25-35 hours

**Simplifications Needed**:
- Remove org switching UI (single "General" org MVP2)
- Clarify LoRaWAN scope (display vs full management)
- Confirm WW Admin mobile vs web portal features

**See**: `project-context/TASK-EVOLUTION-ANALYSIS.md` for detailed updates

---

## 5. CONVERGENCE STRATEGY SUMMARY

**Source**: Comprehensive analysis of all three workstreams

### Phased Integration Approach

**Phase 0: Blockers** (1-2 days)
- Security: API key rotation
- TypeScript: Fix 24 errors
- Linting: Auto-fix violations

**Phase 1: Quality Gates** (1-2 days)
- Performance: React.memo
- Security: SecureStore
- Config: app.json complete

**Phase 2: Backend Alignment** (2-3 days)
- Type regeneration after schema deployment
- Service adapters for new schema
- Placeholder implementations for new features

**Phase 3: Task Spec Updates** (1-2 days)
- Update Tasks 14, 15, 20, 23
- Create new tasks: 14.5, 13.5, 1.5, 23.5
- Stakeholder approval

**Phase 4: Parallel Streams** (3-4 weeks)
- Stream A: Tasks 14
- Stream B: Tasks 15-17
- Stream C: Tasks 18-20
- Incremental: Phase 3 improvements

**Phase 5: Integration & Polish** (1-2 weeks)
- Tasks 21-23
- Final validation
- Production prep

**Total Timeline**: 6-8 weeks

**See**: `project-context/CONVERGENCE-STRATEGY.md` for execution details

---

## 6. RECOMMENDED EXECUTION PATH

### Option C: Hybrid Path (RECOMMENDED)

**Week 1: Preparation**
- Phase 0: Blockers (1-2 days)
- Phase 1: Quality Gates (1-2 days)
- Phase 2: Backend Alignment (2-3 days, overlaps Phase 1)
- Phase 3: Task Specs (1-2 days)

**Weeks 2-5: Parallel Development**
- Stream A: Task 14 → 14.5 → 13.5
- Stream B: Tasks 15 → 16 → 17
- Stream C: Tasks 18 → 19 → 20
- Phase 3: Incremental improvements

**Weeks 6-7: Integration**
- Tasks 21 → 22 → 23
- Final validation
- Production deployment

**Total**: 6-7 weeks to production-ready MVP2

### Why Hybrid Path?

✅ Addresses critical blockers immediately
✅ Establishes quality foundation before features
✅ Coordinates backend alignment upfront
✅ Enables parallel stream execution
✅ Prevents technical debt compounding
✅ Balances speed with quality

---

## 7. IMMEDIATE NEXT STEPS

### This Week

1. **Stakeholder Alignment Meeting**
   - Review comprehensive findings
   - Confirm backend schema timeline
   - Lock down MVP2 requirements
   - Approve Hybrid Path execution

2. **Backend Coordination**
   - Confirm mvp2-revised deployment date
   - Request LoRaWAN webhook examples
   - Align on data migration strategy

3. **Execute Phase 0 (IMMEDIATE)**
   - Remove hardcoded API keys
   - Rotate Supabase + Google Maps keys
   - Fix TypeScript errors
   - Auto-fix linting

### Next 2 Weeks

4. **Execute Phase 1**
   - React.memo list components
   - SecureStore implementation
   - Complete app.json

5. **Execute Phase 2**
   - Regenerate types after backend deploys
   - Create service adapters
   - Build placeholder implementations

6. **Execute Phase 3**
   - Update task specifications
   - Create new task specs
   - Get stakeholder approval

---

## 8. SUCCESS METRICS

### Phase 0 Gates
- [ ] Zero hardcoded secrets
- [ ] TypeScript errors: 0
- [ ] Linting violations: <50
- [ ] EAS build succeeds

### Phase 1 Gates
- [ ] List components memoized
- [ ] Auth tokens encrypted
- [ ] app.json complete
- [ ] Build succeeds on both platforms

### Phase 2 Gates
- [ ] Types regenerated successfully
- [ ] Service adapters created
- [ ] Integration tests passing
- [ ] Rollback plan documented

### Phase 3 Gates
- [ ] All task specs updated
- [ ] Stakeholder approval obtained
- [ ] Timeline estimates revised
- [ ] Team aligned on scope

### Phase 4 Gates (Feature Complete)
- [ ] Streams A, B, C: 100%
- [ ] TypeScript errors: 0
- [ ] Console statements: -50%
- [ ] Test coverage: ≥70%
- [ ] Integration tests passing

### Phase 5 Gates (Production Ready)
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] App store submission ready

---

## 9. RISK MITIGATION

### High-Risk Areas

1. **Backend Schema Not Deployed**
   - **Mitigation**: Immediate coordination, staging environment testing

2. **Hardcoded API Keys Exposed**
   - **Mitigation**: Rotate within 24 hours, configure EAS Secrets

3. **Requirements Drift**
   - **Mitigation**: Lock requirements after Phase 3, defer new items to MVP2.1

4. **Technical Debt Accumulation**
   - **Mitigation**: Mandatory Phase 0+1 completion, quality gates in PRs

5. **LoRaWAN Integration Complexity**
   - **Mitigation**: Spike/POC, Context7 research, backend payload examples

6. **Offline Sync Conflicts**
   - **Mitigation**: Extensive testing, schema versioning, force re-sync option

---

## 10. DELIVERABLES OVERVIEW

### Analysis Documents Created
- ✅ This summary document
- 📁 Backend Schema Impact Analysis
- 📁 Code Review Status & Remediation Plan
- 📁 Requirements Delta (Baseline → Goal)
- 📁 Task Evolution & Specification Updates
- 📁 Convergence Strategy & Timeline

### Execution Documents Needed
- [ ] Updated MVP2-MASTER-EXECUTION-PLAN.md
- [ ] Updated MVP2-METRICS-TRACKER.md
- [ ] Updated task specifications (Tasks 14, 15, 20, 23)
- [ ] New task specifications (14.5, 13.5, 1.5, 23.5)

### Coordination Documents Needed
- [ ] Stakeholder alignment meeting notes
- [ ] Backend coordination plan
- [ ] Phase 0-5 execution checklists

---

## Conclusion

This comprehensive analysis reveals three parallel workstreams requiring careful convergence:

1. **Requirements Changes**: +23-35 days new work
2. **Code Review Refactoring**: 25.5-27.5 hours (3-4 days)
3. **Current Development**: Stream A continuation + Streams B & C

**Recommended Path**: Hybrid (Option C)
- 1 week preparation (Phases 0-3)
- 3-4 weeks parallel development (Phase 4)
- 1-2 weeks integration (Phase 5)
- **Total**: 6-7 weeks to production

**Key Success Factors**:
- Immediate stakeholder alignment
- Backend schema coordination
- Phase 0 blocker resolution (48 hours)
- Requirements freeze after Phase 3
- Parallel execution discipline

---

**Next Action**: Schedule stakeholder alignment meeting THIS WEEK

**Document Version**: 1.0 (Summary)
**Full Analysis**: See individual documents in project-context/
**Review Required**: YES - Stakeholder approval needed
