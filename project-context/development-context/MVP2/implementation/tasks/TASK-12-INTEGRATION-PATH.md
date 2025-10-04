# Task 12 - Clear Integration Path

**Last Updated**: 2025-10-05
**Status**: Ready to Execute Phase 3
**Estimated Remaining**: 5-6 hours

---

## ✅ Quick Summary

**What's Done**:
- ✅ Phase 1: Type definitions, ProjectService, RTK Query (1 hr)
- ✅ Phase 2: UI screens (ProjectsScreen, NewProjectScreen) (1 hr)
- ✅ Backend Phase 1: 87% complete (separate repo)

**What's Next**:
- 🔧 Phase 3: Integrate ProjectService with Task 11 offline infrastructure (5-6 hrs)

**Key Point**: Task 11 already has ALL offline infrastructure - we just need to use it!

---

## 📋 Phase 3 Integration Checklist

### Step 1: Refactor ProjectService (2 hours)

**File**: `src/services/ProjectService.ts`

**Actions**:
1. Import Task 11 services:
   ```typescript
   import { DatabaseService } from './offline/DatabaseService';
   import { OfflineService } from './offline/OfflineService';
   ```

2. Initialize in constructor:
   ```typescript
   private db: DatabaseService;
   private offlineService: OfflineService;

   constructor() {
     super();
     this.db = new DatabaseService();
     this.offlineService = new OfflineService();
   }
   ```

3. Refactor `getUserProjects()`:
   - Change from: `supabase.from('projects_with_stats').select()`
   - Change to: `this.db.getProjectsByOrganisation(currentOrgId)`
   - Add background sync trigger

4. Refactor `createProject()`:
   - Remove `offline` parameter
   - Always save to: `this.db.addProject(project)`
   - Always queue: `this.offlineService.queueOperation({...})`
   - Background sync if online

5. Refactor `updateProject()`:
   - Use: `this.db.updateProject(id, updates)`
   - Queue sync operation

6. Refactor `deleteProject()`:
   - Use: `this.db.deleteProject(id)`
   - Queue sync operation

### Step 2: Update RTK Query (1 hour)

**File**: `src/store/api/projectsApi.ts`

**Actions**:
1. Modify `getProjects` query:
   - Use `ProjectService.getUserProjects()` (which now reads from SQLite)
   - Remove network state branching (always works offline)

2. Modify `createProject` mutation:
   - Remove `offline` parameter passing
   - Service now handles offline automatically

3. Keep optimistic updates:
   - Current pattern is good
   - Just ensure it works with local-first data

### Step 3: Testing & Validation (2.5 hours)

**Test Scenarios**:

1. **Airplane Mode Create** (30 min):
   - Enable airplane mode
   - Create new project
   - Verify saved to SQLite
   - Verify appears in projects list
   - Restore network
   - Verify syncs to Supabase

2. **Airplane Mode Read** (30 min):
   - Create projects while online
   - Enable airplane mode
   - Verify projects list shows cached data
   - Verify project details load

3. **Offline Update** (30 min):
   - Edit project while offline
   - Verify changes saved to SQLite
   - Restore network
   - Verify changes sync to Supabase

4. **Background Sync** (30 min):
   - Create multiple projects offline
   - Check offline queue
   - Restore network
   - Verify automatic sync
   - Check queue cleared

5. **Conflict Resolution** (30 min):
   - Edit same project on two devices offline
   - Bring both online
   - Verify conflict resolution logic

---

## 🎯 Success Criteria

- [ ] ProjectService uses DatabaseService (not direct Supabase)
- [ ] Projects list works in airplane mode (shows cached data)
- [ ] Create project works in airplane mode
- [ ] Background sync triggers on network restore
- [ ] Offline queue processes correctly
- [ ] No data loss during offline/online transitions
- [ ] All existing UI functionality still works

---

## 📚 Key Files & References

### Task 11 Infrastructure (Already Complete)

**Database**:
- `src/services/offline/DatabaseService.ts`
  - `addProject()`, `getProjectsByOrganisation()`, `updateProject()`, `deleteProject()`

**Sync**:
- `src/services/offline/OfflineService.ts`
  - `queueOperation()`, `processQueue()`, `initialize()`

**Conflict Resolution**:
- `src/services/offline/ConflictResolutionService.ts`

**Redux**:
- `src/store/slices/syncSlice.ts`
- `src/store/slices/offlineSlice.ts`
- `src/store/slices/networkSlice.ts`
- `src/store/middleware/offlineSyncMiddleware.ts`

**Hooks**:
- `src/hooks/useOfflineSync.ts`
- `src/hooks/useOptimisticUpdate.ts`

### Task 12 Files to Modify

**Service Layer**:
- `src/services/ProjectService.ts` - Main integration point

**State Management**:
- `src/store/api/projectsApi.ts` - RTK Query integration

**UI** (no changes needed - already correct):
- `src/navigation/screens/ProjectsScreen.tsx`
- `src/navigation/screens/NewProjectScreen.tsx`

### Documentation

**Correct Analysis**:
- `../analysis/OFFLINE-INTEGRATION-REALITY.md` - Integration guide

**Obsolete** (DO NOT USE):
- ~~`OFFLINE-IMPLEMENTATION-ANALYSIS.md`~~ - Superseded
- ~~`task_012_offline_first_rewrite.md`~~ - Cancelled

---

## 🚀 Execution Commands

### Start Integration

```bash
# 1. Ensure database FK fix applied
# Check DATABASE_VERSION = 2 in DatabaseService.ts

# 2. Start Phase 3 integration
# Focus on ProjectService.ts refactoring first
```

### Testing Commands

```bash
# Enable airplane mode on device/simulator
# adb shell cmd connectivity airplane-mode enable  # Android
# Or use device settings

# Disable airplane mode
# adb shell cmd connectivity airplane-mode disable  # Android
```

---

## ⚡ Quick Context Recovery

If you need to resume this work:

1. **Read**: This file (TASK-12-INTEGRATION-PATH.md)
2. **Check**: `task_012_status.md` for current progress
3. **Review**: Task 11 (`task_011.txt`) to see what infrastructure exists
4. **Start**: ProjectService.ts refactoring (Step 1 above)

**Estimated Time**: 5-6 hours total
- Step 1: 2 hours
- Step 2: 1 hour
- Step 3: 2.5 hours

---

**Document Owner**: Claude Code
**Purpose**: Clear execution path for Task 12 Phase 3
**Next Update**: After Phase 3 completion
