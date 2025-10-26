# Smart Execution Plan - Reset & Realign

**Created**: 2025-10-26
**Status**: ACTIVE
**Goal**: Get to demonstrable state in 2-3 days for Victor & Karolina testing

---

## 🎯 Strategy: "Demo-Ready Sprint"

**Core Principle**: Minimize rework by getting stakeholder feedback BEFORE implementing requirement changes

**Success Metric**: Android APK in Victor & Karolina's hands by Oct 30

---

## 📊 Current State Assessment

### ✅ **Completed Work**
- Tasks 1-13: Project creation + member management implemented
- Code review: 90% complete (24 TS errors remaining)
- Backend: Test data fixed (17 users, 4 orgs, auth.users working)
- Type drift: Fixed (GitHub Actions workflow + local validation)

### 🔴 **Blockers**
- 24 TypeScript errors preventing clean build
- Tasks 12/13 regressed (needs re-testing with new test data)
- Victor & Karolina making requirement changes without seeing app
- Backend schema changes pending (mvp2-revised.md)

### ⚠️ **Risks**
- Implementing features that will be changed/removed
- Requirement churn causing rework
- Backend-mobile schema drift

---

## 🚀 Execution Tracks (Parallel)

### **Track 1: Critical Path to Android APK** (36 hours)

#### **Day 1: Fix & Verify** (8-10 hours)

**Morning** (4-5 hours):
1. **Fix 24 TypeScript errors** (Quick wins first)
   ```bash
   # Priority order:
   - Install missing type declarations (5 min)
   - Fix MongoDB _id → PostgreSQL id (30 min)
   - Fix enum type constraints ProjectDetailsScreen (20 min)
   - Fix WWScrollView hitSlop type (15 min)
   - Fix BasicMapView callback signatures (30 min)
   - Fix useLocation variable declaration order (20 min)
   - Fix remaining test type mismatches (2 hours)
   ```

2. **Run validation suite**
   ```bash
   npm run type-check  # Should be 0 errors
   npm run lint        # Fix critical issues only
   npm test           # Ensure tests pass
   ```

**Afternoon** (4-5 hours):
3. **Test Tasks 12/13 with NEW test data**
   - Login as Laura (project admin): `laura.admin@wildlife-research.org` / `test123`
   - Create new project in Wildlife Research org
   - Add Alice from General pool
   - Remove Alice
   - Change member role

4. **Test multi-tenant isolation**
   - Login as Laura (Wildlife Research)
   - Verify CANNOT see Conservation Society projects
   - Login as Oliver (Conservation Society)
   - Verify CANNOT see Wildlife Research projects
   - Login as Alice (General, unassigned)
   - Verify sees NO projects

5. **Document findings** in `TASK-12-13-VERIFICATION-RESULTS.md`

---

#### **Day 2: Build & Package** (8 hours)

**Morning** (4 hours):
1. **Pre-build checks**
   ```bash
   npm run validate:local  # Types + TypeScript + tests (30 sec)
   npm run prebuild:check  # Pre-build validation script
   ```

2. **Build Android APK**
   ```bash
   eas build --profile development --platform android
   ```
   - Monitor build progress
   - Download APK when complete

3. **Test APK on your device**
   - Install APK
   - Login with 3-4 test accounts
   - Verify core flows work
   - Document any bugs found

**Afternoon** (4 hours):
4. **Create Testing Guide for Victor & Karolina**
   ```markdown
   # Wildlife Watcher Mobile App - Testing Guide

   ## Installation
   1. Download APK from [link]
   2. Enable "Install from Unknown Sources"
   3. Install APK

   ## Test Accounts
   [Include 6-8 key accounts from USER-CREDENTIALS-REFERENCE.md]

   ## Testing Scenarios
   [Step-by-step instructions for each test]

   ## Known Limitations
   [Be upfront about what's not working]
   ```

5. **Deliver APK + Guide**
   - Share APK via Google Drive/Dropbox
   - Email testing guide
   - Schedule brief walkthrough (15 min)

---

### **Track 2: Requirement Impact Assessment** (12 hours, parallel)

#### **Schema Comparison Analysis** (4 hours)

1. **Create comparison matrix**
   ```bash
   cd ~/wildlife-watcher-backend/dbml
   diff wildlife-watcher-mvp2-schema.dbml mvp2-revised.md > schema-diff.txt
   ```

2. **Categorize changes**:
   - **Breaking changes**: Require mobile code updates
   - **Additive changes**: New features, mobile can ignore temporarily
   - **Deprecations**: Old fields being removed

3. **Mobile app impact assessment**:
   | Table | Change | Mobile Impact | Effort |
   |-------|--------|--------------|--------|
   | users | name → firstname+surname | Medium | 2-3 hours |
   | organisations | +modified_by, -metadata | Low | 1 hour |
   | user_roles | model_manager → organisation_manager | Low | 30 min |
   | projects | +model_id, +is_active, -owner_id | Medium | 3-4 hours |
   | ai_models | NEW TABLE | High | 8-12 hours |
   | device_preparation | NEW TABLE | High | 12-16 hours |
   | deployments | Major expansion | High | 16-20 hours |

4. **Create migration roadmap**

---

#### **Victor & Karolina Requirement Analysis** (4 hours)

1. **Review their recent commits** (from git history)
   - Beta scope changes
   - Feature refinements
   - Documentation updates

2. **Identify requirement drift patterns**:
   - Features added to spec but not implemented
   - Features implemented but now being removed
   - Features changing significantly

3. **Create "Current vs Proposed" comparison doc**

---

#### **Stakeholder Communication Plan** (4 hours)

1. **Draft email to Victor & Karolina**:
   ```
   Subject: Wildlife Watcher Mobile App - Ready for Testing!

   Hi Victor & Karolina,

   The mobile app (Tasks 1-13) is ready for hands-on testing on your Android phones.

   What's Implemented:
   - User authentication (17 test accounts)
   - Organisation management (4 test orgs)
   - Project creation & management
   - Member management (add/remove members, role assignment)
   - Multi-tenant isolation (data security)

   Next Steps:
   1. Install APK (attached)
   2. Review Testing Guide (attached)
   3. Test for 2 days (hands-on exploration)
   4. Provide feedback session (Nov 1)

   Why This Matters:
   Your hands-on experience will inform requirement refinements. We want your changes
   to be based on REAL app usage, not theoretical assumptions.

   Known Limitations:
   [List 3-5 key gaps]

   Questions? Let's schedule a 15-min walkthrough.

   Best,
   Adarsh
   ```

2. **Prepare feedback template** for Victor & Karolina

3. **Draft "Requirement Freeze Proposal"** → Present to team

---

### **Track 3: Code Review Completion** (8 hours, lower priority)

**Only if time permits after Track 1 complete**

1. **CR-1.1: Security - Remove Hardcoded API Keys** (2 hours)
2. **CR-1.3: Code Style - Auto-Fix Linting** (1 hour)
3. **CR-2.2: Performance - React.memo for Lists** (3 hours)
4. **CR-2.3: Security - Secure Storage** (2 hours)

**Decision Point**: Defer to AFTER Victor & Karolina testing if timeline is tight

---

## 📅 Timeline (Realistic Estimates)

| Day | Track 1 | Track 2 | Track 3 |
|-----|---------|---------|---------|
| **Oct 26 PM** | Fix TS errors (4h) | Schema comparison (4h) | - |
| **Oct 27** | Test Tasks 12/13 (6h) | Requirement analysis (4h) | - |
| **Oct 28** | Build APK (4h) | Communication plan (4h) | - |
| **Oct 29** | Test APK + Guide (4h) | - | Code review (if time) |
| **Oct 30** | Deliver to V&K | - | - |
| **Oct 31-Nov 1** | Support V&K testing | - | - |

**Total Effort**: 36 hours (Track 1) + 12 hours (Track 2) = 48 hours over 4 days

---

## 🎯 Success Criteria

### **Phase 1 Complete** (Oct 30):
- ✅ TypeScript errors: 0
- ✅ Tasks 12/13 verified with new test data
- ✅ Android APK built successfully
- ✅ APK tested on your device
- ✅ Testing guide created
- ✅ APK + guide delivered to Victor & Karolina

### **Phase 2 Complete** (Nov 1):
- ✅ Victor & Karolina complete 2-day hands-on testing
- ✅ Feedback session held
- ✅ Requirement changes documented

### **Phase 3 Begin** (Nov 4):
- ✅ Backend schema changes implemented (if approved)
- ✅ Mobile types regenerated
- ✅ UI updates for new features begin

---

## 🚨 Risk Mitigation

### **Risk: APK build fails**
- **Mitigation**: Pre-validate with `npm run prebuild:check`
- **Contingency**: Fix build errors immediately, extend Day 2 to Day 3

### **Risk: Tasks 12/13 still broken with new test data**
- **Mitigation**: Allocate full Day 1 afternoon for testing/fixing
- **Contingency**: Simplify demo scope (authentication + project list only)

### **Risk: Victor & Karolina too busy to test**
- **Mitigation**: Communicate urgency in proposal
- **Contingency**: Schedule specific 2-hour testing blocks

### **Risk: Requirement changes continue during freeze**
- **Mitigation**: Present ROI case (40-60 hours saved)
- **Contingency**: Implement new requirements in separate branch

---

## 📋 Daily Checklist

### **Day 1: Fix & Verify**
- [ ] Fix 24 TypeScript errors
- [ ] Run validation suite (type-check, lint, test)
- [ ] Test Tasks 12/13 with new test data
- [ ] Test multi-tenant isolation
- [ ] Document verification results
- [ ] Update todo list

### **Day 2: Build & Package**
- [ ] Run pre-build checks
- [ ] Build Android APK via EAS
- [ ] Download and test APK on device
- [ ] Create Testing Guide for Victor & Karolina
- [ ] Upload APK to Google Drive/Dropbox
- [ ] Send delivery email to Victor & Karolina

### **Day 3: Support & Refine**
- [ ] Answer Victor & Karolina questions
- [ ] Fix critical bugs they discover
- [ ] Create feedback template
- [ ] Draft requirement freeze proposal
- [ ] Present proposal to team

### **Day 4-5: Testing Support**
- [ ] Monitor Victor & Karolina testing
- [ ] Provide immediate bug fixes if needed
- [ ] Schedule feedback session
- [ ] Document feedback

---

## 🔄 Iteration Strategy

**If timeline slips**:
1. **Cut scope**: Deliver authentication + project list only (defer member management)
2. **Extend deadline**: Push delivery to Nov 1 (add 2 days)
3. **Request help**: Ask backend team to help with testing

**If ahead of schedule**:
1. **Add polish**: Improve UI/UX for demo
2. **Create video walkthrough**: Supplement written guide
3. **Start code review Track 3**: Get ahead on CR tasks

---

## ✅ Definition of Done

**Demo-Ready Sprint Complete** when:
- ✅ Victor & Karolina have APK installed on phones
- ✅ They can log in with test accounts
- ✅ They can create projects and manage members
- ✅ They provide initial feedback
- ✅ Team agrees on requirement freeze (or not)

---

## 🎓 Lessons Applied

From code review learnings:
- **Incremental approach**: Small daily progress > big bang
- **Evidence-based**: Test early, test often
- **MVP-focused**: Good enough to demo > perfect but late
- **Quality gates**: Clear success criteria each day

---

**Created by**: Adarsh
**For**: Wildlife Watcher Team
**Priority**: CRITICAL
**Next Update**: Daily progress in todo list
