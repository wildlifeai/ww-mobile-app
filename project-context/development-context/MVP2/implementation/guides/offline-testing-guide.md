# Offline Project Creation Testing Guide

## Overview
This guide covers testing the offline-first project creation feature, which queues operations when offline and syncs when network returns.

## Current Implementation Status

### ✅ Components Already Implemented
- **Network Detection**: `@react-native-community/netinfo` installed
- **Offline Indicator**: Red banner shows "Offline Mode" when disconnected
- **Offline Service**: Queue operations to SQLite database
- **Sync Middleware**: Automatic background sync when network returns
- **ProjectService**: Has offline parameter for `createProject(input, offline)`

### ⚠️ Missing Integration
- RTK Query `createProject` mutation doesn't detect network state
- Need to pass `offline` flag from projectsApi to ProjectService

## Testing Steps

### 1. Enable Airplane Mode on Android

**Option A: Via ADB**
```bash
adb shell cmd connectivity airplane-mode enable
```

**Option B: Manually on Device**
1. Swipe down notification panel
2. Tap Airplane mode icon
3. Or: Settings → Network & Internet → Airplane mode → ON

### 2. Verify Offline Detection

**Expected Behavior:**
- Red banner appears at top: "🚫 Offline Mode"
- App remains functional (no crashes)

**Check Logs:**
```
LOG  🔴 Network offline - sync paused
```

### 3. Create Project While Offline

**Steps:**
1. Navigate to Projects screen
2. Tap "New Project" FAB
3. Fill out form:
   - Name: "Offline Test Project"
   - Description: "Created while offline"
   - Check "Using Bait"
   - Privacy: Private
4. Tap "Create Project"

**Current Behavior (NEEDS FIX):**
- ❌ Will attempt online creation and fail
- Error: "Network request failed"

**Expected Behavior (After Fix):**
- ✅ Project appears in list immediately (optimistic update)
- ✅ Project has temporary ID (UUID)
- ✅ Operation queued in SQLite offline_queue table
- ✅ Log: `📦 CREATE_PROJECT operation queued`

### 4. Verify Queue Storage

**Check Logs:**
```
LOG  📦 Queued operation: CREATE_PROJECT
LOG  📦 1 operations queued for sync when online
```

**Check SQLite Database:**
```bash
# If you have sqlite3 access on device
adb shell "sqlite3 /data/data/com.wildlifewatcher/databases/wildlife_watcher.db 'SELECT * FROM offline_queue;'"
```

### 5. Disable Airplane Mode

**Option A: Via ADB**
```bash
adb shell cmd connectivity airplane-mode disable
```

**Option B: Manually**
- Disable airplane mode on device

### 6. Verify Auto-Sync

**Expected Behavior:**
- Offline indicator disappears
- Automatic sync begins

**Expected Logs:**
```
LOG  🌐 Network online - starting background sync
LOG  📤 Syncing 1 pending operations...
LOG  🔧 Creating project with data: {...}
LOG  ✅ Project created successfully: <real-uuid>
LOG  ✅ Batch processed: 1 succeeded, 0 failed, 0 remaining
LOG  🏁 Background sync completed
```

**Result:**
- Temporary project ID replaced with real Supabase UUID
- Project now synced to cloud database
- Can verify in Supabase dashboard

### 7. Advanced Testing Scenarios

#### Test A: Multiple Offline Operations
1. Enable airplane mode
2. Create 3 projects while offline
3. Update 1 existing project
4. Disable airplane mode
5. Verify all 4 operations sync in order

#### Test B: Partial Sync Failure
1. Enable airplane mode
2. Create project with invalid data (e.g., name too long >100 chars)
3. Create valid project
4. Disable airplane mode
5. Verify: Invalid fails, valid succeeds, failed operation retried with backoff

#### Test C: Network Interruption During Sync
1. Create project offline
2. Disable airplane mode (sync starts)
3. Quickly re-enable airplane mode
4. Verify: Sync pauses mid-operation
5. Disable airplane mode again
6. Verify: Sync resumes from where it stopped

## Required Code Fix

### Update RTK Query to Detect Network State

**File:** `src/store/api/projectsApi.ts`

**Current Code (lines 70-90):**
```typescript
createProject: builder.mutation<ProjectWithDetails, CreateProjectInput>({
  queryFn: async (input) => {
    console.log('📤 RTK Query - createProject mutation called');
    console.log('  Input:', input);
    try {
      const data = await ProjectService.createProject(input);
      console.log('✅ RTK Query - createProject succeeded');
      return { data };
    } catch (error) {
      console.error('❌ RTK Query - createProject failed:', error);
      return {
        error: {
          status: 'CUSTOM_ERROR',
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  },
  invalidatesTags: [{ type: 'Projects', id: 'LIST' }],
}),
```

**Required Fix:**
```typescript
createProject: builder.mutation<ProjectWithDetails, CreateProjectInput>({
  queryFn: async (input, { getState }) => {
    console.log('📤 RTK Query - createProject mutation called');
    console.log('  Input:', input);

    // Check network state
    const state = getState() as RootState;
    const isOffline = !state.network.isOnline;

    console.log(`🌐 Network state: ${isOffline ? 'OFFLINE' : 'ONLINE'}`);

    try {
      // Pass offline flag to service
      const data = await ProjectService.createProject(input, isOffline);

      if (isOffline) {
        console.log('📦 Project queued for offline sync');
      } else {
        console.log('✅ RTK Query - createProject succeeded');
      }

      return { data };
    } catch (error) {
      console.error('❌ RTK Query - createProject failed:', error);
      return {
        error: {
          status: 'CUSTOM_ERROR',
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  },
  invalidatesTags: [{ type: 'Projects', id: 'LIST' }],
}),
```

**Additional Required Imports:**
```typescript
import type { RootState } from '../index';
```

## Verification Checklist

- [ ] Offline indicator appears when airplane mode enabled
- [ ] Project creation works while offline (no error)
- [ ] Project appears in list immediately (optimistic update)
- [ ] Operation logged in console: `📦 CREATE_PROJECT operation queued`
- [ ] Auto-sync starts when network returns
- [ ] Project synced to Supabase (check cloud dashboard)
- [ ] Temporary ID replaced with real UUID
- [ ] Projects list refreshes automatically after sync

## Troubleshooting

### Issue: "Network request failed" when offline
**Cause:** RTK Query not detecting offline state
**Fix:** Apply code fix above to check `state.network.isOnline`

### Issue: Sync doesn't start when network returns
**Cause:** Network monitoring not initialized
**Fix:** Check `App.tsx` calls `initializeNetworkMonitoring(dispatch)`

### Issue: Operations not queued
**Cause:** OfflineService not initializing SQLite database
**Fix:** Check OfflineService constructor creates tables

### Issue: Duplicate projects after sync
**Cause:** Optimistic update + sync both create projects
**Fix:** Use `upsert` pattern or check for temporary IDs before adding to list

## Related Files

- `/src/store/api/projectsApi.ts` - RTK Query mutations (NEEDS UPDATE)
- `/src/services/ProjectService.ts` - Has offline support (✅ Complete)
- `/src/services/offline/OfflineService.ts` - Queue operations (✅ Complete)
- `/src/store/middleware/offlineSyncMiddleware.ts` - Auto-sync (✅ Complete)
- `/src/store/slices/networkSlice.ts` - Network state
- `/src/store/slices/offlineSlice.ts` - Queue state
- `/src/components/ui/OfflineIndicator.tsx` - UI feedback (✅ Complete)

## Success Metrics

✅ **MVP2 Task 12 Offline Requirements:**
- Projects can be created without network
- Operations queued reliably in SQLite
- Auto-sync when network returns
- No data loss during offline period
- User sees immediate feedback (optimistic updates)
- Proper error handling for sync failures

## Next Steps After This Feature

1. Implement offline support for `updateProject`
2. Implement offline support for `deleteProject`
3. Add conflict resolution for concurrent edits
4. Add manual "Sync Now" button in settings
5. Show sync progress indicator
6. Add "Clear Queue" option for failed operations
