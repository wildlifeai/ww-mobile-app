# ❌ OBSOLETE - DO NOT USE

**Status**: SUPERSEDED by OFFLINE-INTEGRATION-REALITY.md
**Date Deprecated**: 2025-10-05
**Reason**: Analysis was partially incorrect - didn't check Task 11 completion

---

## 🚨 IMPORTANT: This document contains INCORRECT conclusions

**Corrected Analysis**: See `OFFLINE-INTEGRATION-REALITY.md`

**What Was Wrong**:
- Assumed offline infrastructure didn't exist
- Missed that Task 11 completed all foundation work
- Recommended 32-hour rewrite when only 5-6 hour integration needed

**Use Instead**: OFFLINE-INTEGRATION-REALITY.md (correct scope)

---

# ~~Offline-First Implementation Analysis~~ (SUPERSEDED)

**Date**: 2025-10-05
**Scope**: Task 12 Projects CRUD - Offline Architecture Review
**Status**: ❌ **ANALYSIS PARTIALLY INCORRECT**

---

## ~~Executive Summary~~ (INCORRECT CONCLUSION)

**~~FINDING~~**: ~~The current implementation is **NOT offline-first** as specified. We have a **hybrid approach** that tries to sync online first, then queues offline - this is backwards from the specification requirements.~~

**CORRECTION**: Current implementation IS cloud-first (TRUE), but Task 11 already has offline-first infrastructure (MISSED IN ANALYSIS).

### Specification Requirements (Section 6.1)

> "Field researchers often work in locations without cellular coverage for extended periods. The app must function fully offline, storing all operations locally and syncing intelligently when connectivity returns. **This is a core requirement, not an optional feature.**"

### Current Implementation Reality

❌ **Projects are stored in Supabase only** (cloud-first)
❌ **Local SQLite used only for offline queue** (sync buffer)
❌ **No local `local_projects` table** with cached data
❌ **Queries fail offline** instead of returning cached data
❌ **Foreign key constraints** assume local organisation cache exists

---

## Specification vs Implementation

### What Spec Says (Section 6.3)

```sql
-- Local storage for projects
CREATE TABLE local_projects (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,  -- JSON blob
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,  -- Logical delete
  synced BOOLEAN DEFAULT 0,
  sync_error TEXT
);
```

**Expected Flow:**
1. **Create project** → Save to `local_projects` SQLite
2. **Update UI** → Show project immediately from local DB
3. **Queue sync** → Add to `offline_queue` for cloud sync
4. **When online** → Sync to Supabase, mark `synced = 1`
5. **Conflict resolution** → Apply merge rules (Section 6.4)

### What We Actually Have

```typescript
// ProjectService.ts - CLOUD-FIRST APPROACH
async createProject(input, offline = false): Promise<Project> {
  if (offline) {
    // Only used when offline detected
    return tempProject; // Temporary in-memory object
    // Queue to offline_queue (sync buffer only)
  }

  // DEFAULT PATH: Direct Supabase insert
  const { data } = await supabase.from('projects').insert(...)
  return data;
}
```

**Actual Flow:**
1. **Online** → Insert directly to Supabase (no local storage)
2. **Offline** → Create temp object + queue (lost on app restart!)
3. **No local cache** → Can't view projects offline
4. **No sync merging** → No conflict resolution implemented

---

## Architecture Mismatch Root Causes

### 1. **Two Separate Offline Systems**

**Location A**: `/src/redux/slices/` (legacy)
- `offlineSlice.ts` - Basic queue state

**Location B**: `/src/store/slices/` (newer)
- `networkSlice.ts` - Network status
- `offlineSlice.ts` - Advanced sync queue
- `syncSlice.ts` - Sync coordination

**Problem**: Duplication and confusion about which system to use

### 2. **DatabaseService Has Full Schema But Not Used**

```typescript
// DatabaseService.ts defines:
- local_organisations
- local_user_roles
- local_projects
- local_deployments
- local_devices
- offline_queue

// But ProjectService.ts NEVER writes to local_projects!
```

**Problem**: Infrastructure exists but bypassed

### 3. **RTK Query Incompatible with Offline-First**

```typescript
// RTK Query expects network responses
useGetProjectsQuery() // Returns error when offline

// Should be:
useLocalProjectsQuery() // Returns cached data from SQLite
```

**Problem**: Wrong state management pattern for offline-first

---

## Required Architectural Changes

### Phase 1: True Offline-First Storage (CRITICAL)

#### 1.1 Implement Local Storage Layer

```typescript
// NEW: LocalProjectsService.ts
class LocalProjectsService {
  async saveProject(project: Project): Promise<void> {
    await db.insert('local_projects', {
      id: project.id,
      data: JSON.stringify(project),
      synced: false,
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  async getProjects(): Promise<Project[]> {
    const rows = await db.select('local_projects')
      .where('deleted_at', 'IS NULL')
      .orderBy('updated_at', 'DESC');

    return rows.map(row => JSON.parse(row.data));
  }

  async getProject(id: string): Promise<Project | null> {
    const row = await db.select('local_projects')
      .where({ id, deleted_at: null })
      .first();

    return row ? JSON.parse(row.data) : null;
  }
}
```

#### 1.2 Refactor ProjectService to Offline-First

```typescript
// REFACTORED: ProjectService.ts
class ProjectService {
  private local = new LocalProjectsService();
  private sync = new SyncService();

  async createProject(input: CreateProjectInput): Promise<Project> {
    // STEP 1: Always save locally first
    const project: Project = {
      id: generateUUID(),
      ...input,
      created_at: new Date().toISOString(),
      synced: false
    };

    await this.local.saveProject(project);

    // STEP 2: Update UI immediately (optimistic)
    // UI reads from local DB, sees project instantly

    // STEP 3: Queue for cloud sync
    await this.sync.queueOperation({
      type: 'CREATE_PROJECT',
      entity_id: project.id,
      payload: project
    });

    // STEP 4: Attempt sync if online (background)
    if (navigator.onLine) {
      this.sync.processSyncQueue(); // Non-blocking
    }

    return project;
  }

  async getUserProjects(): Promise<Project[]> {
    // ALWAYS read from local DB
    return await this.local.getProjects();
  }
}
```

#### 1.3 Replace RTK Query with Local-First Hooks

```typescript
// NEW: useLocalProjects.ts
export function useLocalProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load from SQLite
    ProjectService.getUserProjects().then(setProjects);
    setLoading(false);

    // Subscribe to changes
    const subscription = ProjectService.subscribeToChanges((newProjects) => {
      setProjects(newProjects);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { projects, loading };
}
```

### Phase 2: Background Sync System

#### 2.1 Sync Coordinator

```typescript
// SyncService.ts
class SyncService {
  private queue: OfflineQueue;

  async processSyncQueue(): Promise<void> {
    const pending = await this.queue.getPendingOperations();

    for (const operation of pending) {
      try {
        await this.syncOperation(operation);
        await this.queue.markCompleted(operation.id);
      } catch (error) {
        await this.queue.incrementRetry(operation.id, error);
      }
    }
  }

  private async syncOperation(op: QueuedOperation): Promise<void> {
    switch (op.type) {
      case 'CREATE_PROJECT':
        await this.syncCreateProject(op);
        break;
      case 'UPDATE_PROJECT':
        await this.syncUpdateProject(op);
        break;
      // ... other operations
    }
  }

  private async syncCreateProject(op: QueuedOperation): Promise<void> {
    const project = JSON.parse(op.payload);

    // Insert to Supabase
    const { data, error } = await supabase
      .from('projects')
      .insert(project)
      .select()
      .single();

    if (error) throw error;

    // Update local record with cloud ID if different
    await db.update('local_projects')
      .set({ synced: true, cloud_id: data.id })
      .where({ id: project.id });
  }
}
```

#### 2.2 Conflict Resolution

```typescript
// ConflictResolver.ts (from spec Section 6.4)
class ConflictResolver {
  resolveProject(local: Project, remote: Project): Project {
    // Merge member lists (union)
    const mergedMembers = this.mergeUnique(
      local.members,
      remote.members,
      'userId'
    );

    // Last-write-wins for other fields
    const winner = new Date(local.updated_at) > new Date(remote.updated_at)
      ? local
      : remote;

    return { ...winner, members: mergedMembers };
  }
}
```

### Phase 3: Sync Status UI

```typescript
// SyncStatusIndicator.tsx
export const SyncStatusIndicator = () => {
  const { pendingCount, lastSync, error } = useSyncStatus();

  if (pendingCount === 0) {
    return <Icon name="cloud-check" color="green" />;
  }

  return (
    <View>
      <Icon name="cloud-sync" color="orange" />
      <Badge>{pendingCount}</Badge>
    </View>
  );
};
```

---

## Migration Strategy

### Option A: Complete Rewrite (Recommended for MVP2)

**Effort**: 3-5 days
**Risk**: Medium
**Benefit**: True offline-first as specified

**Steps**:
1. Implement `LocalProjectsService`
2. Refactor `ProjectService` to local-first
3. Replace RTK Query with local hooks
4. Implement background sync
5. Add conflict resolution
6. Comprehensive offline testing

### Option B: Hybrid Enhancement (Quick Fix)

**Effort**: 1-2 days
**Risk**: High (technical debt)
**Benefit**: Basic offline functionality

**Steps**:
1. Fix current foreign key issues
2. Cache last-fetched projects in SQLite
3. Return cached data when offline
4. Keep cloud-first create/update
5. Defer true offline-first to later

### Option C: Defer to Post-MVP (NOT RECOMMENDED)

**Risk**: ⚠️ **VIOLATES CORE SPECIFICATION**
Section 6.1 states: "*This is a core requirement, not an optional feature*"

---

## Current Implementation Gaps

| Requirement | Spec Section | Status | Gap |
|------------|-------------|--------|-----|
| Local project storage | 6.3 | ❌ Missing | No `local_projects` usage |
| Offline create/update | 6.1 | ⚠️ Partial | Temp objects, no persistence |
| Sync conflict resolution | 6.4 | ❌ Missing | No merge logic |
| Sync priority levels | 6.5 | ❌ Missing | No priority queue |
| Logical deletes | 6.3 | ❌ Missing | Hard deletes only |
| Sync status indicators | 6.5 | ❌ Missing | No UI feedback |
| Offline readiness check | 6.2 | ❌ Missing | No pre-deployment prep |

---

## Immediate Action Required

### Fix Foreign Key Issue (30 minutes)

**Problem**: `offline_queue` references non-existent `local_organisations`

**Solution**:
```sql
-- Drop and recreate without FK
DROP TABLE IF EXISTS offline_queue;
CREATE TABLE offline_queue (
  -- Same schema, remove:
  -- FOREIGN KEY (organisation_id) REFERENCES local_organisations (id)
);
```

**Code Change**: Already done in DatabaseService.ts (pending DB version bump)

### Increment DB Version to Apply Migration

```typescript
// DatabaseService.ts
private readonly DATABASE_VERSION = 2; // Triggers table recreation
```

---

## Recommendation

**PROCEED WITH OPTION A** (Complete Offline-First Rewrite)

**Rationale**:
1. ✅ **Specification compliance** - Delivers core MVP requirement
2. ✅ **Field use case** - Researchers work offline for days/weeks
3. ✅ **Data integrity** - No lost work from network issues
4. ✅ **Better UX** - Instant responses, background sync
5. ✅ **Future-proof** - Scales to deployments, observations, etc.

**Timeline**: Can be done in parallel with other tasks using Claude Flow sub-agents

---

## Next Steps

1. ✅ Fix immediate foreign key constraint (apply DB v2 migration)
2. 🔄 Decide on architectural approach (A, B, or C)
3. ⬜ If Option A: Create implementation plan with Claude Flow
4. ⬜ Update Task 12 scope to include offline-first refactor
5. ⬜ Document architectural decision in project context

---

## Questions for Product Owner

1. **Priority**: Is true offline-first required for MVP2 launch?
2. **Timeline**: Can we allocate 3-5 days for proper implementation?
3. **Scope**: Should we refactor all CRUD (Projects, Deployments) or just Projects?
4. **Testing**: Do we have field testing scenarios for offline validation?

---

**Document Owner**: Claude Code
**Review Status**: Pending User Decision
**Next Review**: After architectural decision made
