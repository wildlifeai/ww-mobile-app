# Task 12 - Quick Start Guide

**For Immediate Context Recovery** - Read this first!

---

## 📍 Current Status

- **Progress**: 55% complete (2.0/9.5 hours spent)
- **Phase Complete**: Mobile UI + Backend 87%
- **Next Phase**: Offline integration (5-6 hours)
- **Key Insight**: Task 11 has ALL offline infrastructure already!

---

## 🚀 Start Here

### 1. Read This First
**File**: `TASK-12-INTEGRATION-PATH.md`
- Complete integration checklist
- Step-by-step instructions
- Testing scenarios

### 2. Context Documents
- **Status**: `task_012_status.md` - Progress tracking
- **Analysis**: `../analysis/OFFLINE-INTEGRATION-REALITY.md` - Why 5-6 hrs not 32 hrs

### 3. What NOT to Read
- ❌ `task_012_offline_first_rewrite.md` - CANCELLED (marked obsolete)
- ❌ `../analysis/OFFLINE-IMPLEMENTATION-ANALYSIS.md` - SUPERSEDED

---

## ⚡ 30-Second Summary

**Problem**: ProjectService bypasses Task 11 offline infrastructure
**Solution**: Integrate with existing DatabaseService + OfflineService
**Time**: 5-6 hours (NOT 32-hour rewrite)

**What Exists from Task 11**:
- ✅ DatabaseService (`local_projects` table + CRUD)
- ✅ OfflineService (queue + sync)
- ✅ Redux slices (sync, offline, network)
- ✅ Comprehensive tests

**What to Change**:
- ProjectService.ts - Use DatabaseService instead of Supabase
- projectsApi.ts - Remove network branching (always offline-first)

---

## 📋 Phase 3 Checklist (5-6 hours)

### Step 1: Refactor ProjectService (2 hrs)
- [ ] Import DatabaseService + OfflineService
- [ ] Change getUserProjects() to read from SQLite
- [ ] Change createProject() to save locally + queue sync
- [ ] Change updateProject() to use DatabaseService
- [ ] Change deleteProject() to use DatabaseService

### Step 2: Update RTK Query (1 hr)
- [ ] Modify getProjects to use local data
- [ ] Remove offline parameter logic
- [ ] Keep optimistic updates

### Step 3: Test (2.5 hrs)
- [ ] Airplane mode create/read/update/delete
- [ ] Background sync on network restore
- [ ] Conflict resolution

---

## 🎯 Files to Modify

**Primary**:
1. `src/services/ProjectService.ts` - Main integration
2. `src/store/api/projectsApi.ts` - RTK Query updates

**Reference** (from Task 11 - already complete):
- `src/services/offline/DatabaseService.ts`
- `src/services/offline/OfflineService.ts`
- `src/services/offline/ConflictResolutionService.ts`

---

## 💡 Key Reminders

1. **Task 11 is complete** - Don't rebuild what exists
2. **Integration not rewrite** - Use existing infrastructure
3. **Always offline-first** - Remove `offline` parameters
4. **Test with airplane mode** - Verify actual offline functionality

---

**Quick Links**:
- Full Plan: `TASK-12-INTEGRATION-PATH.md`
- Status: `task_012_status.md`
- Metrics: `../execution/MVP2-METRICS-TRACKER.md`

---

**Ready to Start**: Open `TASK-12-INTEGRATION-PATH.md` and follow Step 1
