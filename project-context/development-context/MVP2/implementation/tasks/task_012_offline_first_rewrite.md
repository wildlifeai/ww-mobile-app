# ❌ OBSOLETE - DO NOT USE

**Status**: SUPERSEDED by OFFLINE-INTEGRATION-REALITY.md
**Date Deprecated**: 2025-10-05
**Reason**: Initial analysis was incorrect - Task 11 infrastructure already exists

---

## 🚨 IMPORTANT: This document is OBSOLETE

**Corrected Analysis**: See `../analysis/OFFLINE-INTEGRATION-REALITY.md`

**What Happened**:
- This document assumed offline infrastructure was missing
- **Reality**: Task 11 already implemented all required infrastructure
- **Correction**: Need 5-6 hour integration (NOT 32-hour rewrite)

**Use Instead**: OFFLINE-INTEGRATION-REALITY.md (correct scope: 5-6 hours)

---

# ~~Task 12 Phase 3: Offline-First Architecture Rewrite~~ (CANCELLED)

**~~Date Created~~**: 2025-10-05
**~~Estimated Time~~**: ~~3-5 days (24-40 hours)~~ **INCORRECT**
**~~Priority~~**: ~~CRITICAL~~ **Plan was based on false assumption**
**Status**: ❌ CANCELLED - Infrastructure exists from Task 11

---

## ~~Executive Summary~~ (OBSOLETE ANALYSIS)

**~~FINDING~~**: ~~Current Task 12 implementation is NOT offline-first as required by MVP2 Implementation Spec Section 6.1.~~

**CORRECTION**: Task 11 completed offline-first infrastructure. ProjectService just needs to use it.

**Current State**: Cloud-first with offline queue (Projects stored in Supabase, temporary offline objects)

**Required State**: Offline-first with cloud sync (Projects stored in SQLite, background Supabase sync)

**Impact**: Violates core specification requirement: *"This is a core requirement, not an optional feature"*

---

## Reference Documents

- **Analysis**: `@project-context/development-context/MVP2/implementation/analysis/OFFLINE-IMPLEMENTATION-ANALYSIS.md`
- **Specification**: `@project-context/development-context/MVP2/implementation-spec-v1.4.md` (Section 6)
- **Current Status**: `TASK-12-STATUS.md` (89% complete, architecture revision required)

---

## Architecture Comparison

### Current Implementation (Cloud-First) ❌

```typescript
// Online: Direct Supabase insert
async createProject(input) {
  const { data } = await supabase.from('projects').insert(...)
  return data;
}

// Offline: Temporary in-memory object + queue
async createProject(input, offline = true) {
  const tempProject = { id: generateUUID(), ...input };
  await offlineQueue.add({ type: 'CREATE_PROJECT', data: tempProject });
  return tempProject; // Lost on app restart!
}
```

**Problems**:
- ❌ No persistent local storage
- ❌ Projects unavailable offline
- ❌ Temp objects lost on restart
- ❌ Query fails when offline

### Required Implementation (Offline-First) ✅

```typescript
// ALWAYS: Save to SQLite first
async createProject(input) {
  // Step 1: Save locally (persistent)
  const project = { id: generateUUID(), ...input, synced: false };
  await localDB.insert('local_projects', project);

  // Step 2: UI updates immediately from local DB

  // Step 3: Queue cloud sync (background)
  await syncQueue.add({ type: 'CREATE_PROJECT', entity_id: project.id });

  // Step 4: Attempt sync if online (non-blocking)
  if (online) backgroundSync();

  return project; // From local DB, always available
}

// Read from local DB (always works)
async getUserProjects() {
  return await localDB.select('local_projects')
    .where('deleted_at', null)
    .orderBy('updated_at', 'DESC');
}
```

**Benefits**:
- ✅ Projects persist locally
- ✅ Available offline indefinitely
- ✅ Survives app restart
- ✅ Instant UI updates
- ✅ Background cloud sync

---

## Implementation Phases

### Phase 1: Local Storage Foundation (8 hours)

#### 1.1 Create LocalProjectsService (3 hours)

**File**: `src/services/LocalProjectsService.ts`

```typescript
import { DatabaseService } from './offline/DatabaseService';
import type { Project, ProjectWithDetails } from '../types/project';

export class LocalProjectsService {
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
  }

  async initialize(): Promise<void> {
    await this.db.initializeDatabase();
  }

  /**
   * Save project to local SQLite
   */
  async saveProject(project: Project): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO local_projects (
        id, data, synced, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        project.id,
        JSON.stringify(project),
        project.synced ? 1 : 0,
        project.created_at,
        project.updated_at,
        project.deleted_at || null
      ]
    );
  }

  /**
   * Get all projects from local storage
   */
  async getProjects(): Promise<ProjectWithDetails[]> {
    const rows = await this.db.getAllAsync(
      `SELECT * FROM local_projects
       WHERE deleted_at IS NULL
       ORDER BY updated_at DESC`
    );

    return rows.map(row => ({
      ...JSON.parse(row.data),
      // Add computed fields from local cache or defaults
      member_count: row.member_count || 0,
      deployment_count: row.deployment_count || 0,
      lorawan_device_count: row.lorawan_device_count || 0,
    }));
  }

  /**
   * Get single project by ID
   */
  async getProjectById(id: string): Promise<ProjectWithDetails | null> {
    const row = await this.db.getFirstAsync(
      `SELECT * FROM local_projects WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (!row) return null;

    return {
      ...JSON.parse(row.data),
      member_count: row.member_count || 0,
      deployment_count: row.deployment_count || 0,
      lorawan_device_count: row.lorawan_device_count || 0,
    };
  }

  /**
   * Mark project as synced
   */
  async markSynced(id: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE local_projects SET synced = 1 WHERE id = ?`,
      [id]
    );
  }

  /**
   * Get unsynced projects
   */
  async getUnsyncedProjects(): Promise<Project[]> {
    const rows = await this.db.getAllAsync(
      `SELECT * FROM local_projects WHERE synced = 0 AND deleted_at IS NULL`
    );

    return rows.map(row => JSON.parse(row.data));
  }

  /**
   * Soft delete project
   */
  async softDelete(id: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE local_projects
       SET deleted_at = datetime('now'), synced = 0
       WHERE id = ?`,
      [id]
    );
  }

  /**
   * Subscribe to changes (for React hooks)
   */
  subscribeToChanges(callback: (projects: ProjectWithDetails[]) => void): () => void {
    // Implement polling or event-based updates
    const interval = setInterval(async () => {
      const projects = await this.getProjects();
      callback(projects);
    }, 1000);

    return () => clearInterval(interval);
  }
}
```

#### 1.2 Create local_projects Table Schema (1 hour)

**File**: Update `src/services/offline/DatabaseService.ts`

```typescript
// Add to createTables() method
await this.db.execAsync(`
  CREATE TABLE IF NOT EXISTS local_projects (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,           -- JSON blob of full project
    version INTEGER DEFAULT 1,
    synced BOOLEAN DEFAULT 0,
    sync_error TEXT,
    member_count INTEGER DEFAULT 0,
    deployment_count INTEGER DEFAULT 0,
    lorawan_device_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME            -- Logical delete
  );

  CREATE INDEX IF NOT EXISTS idx_projects_synced
    ON local_projects(synced);

  CREATE INDEX IF NOT EXISTS idx_projects_updated
    ON local_projects(updated_at DESC);
`);
```

#### 1.3 Refactor ProjectService to Offline-First (4 hours)

**File**: `src/services/ProjectService.ts`

```typescript
import { LocalProjectsService } from './LocalProjectsService';
import { SyncService } from './offline/SyncService';
import { supabase } from './supabase';
import type { Project, ProjectWithDetails, CreateProjectInput } from '../types/project';

class ProjectService {
  private local: LocalProjectsService;
  private sync: SyncService;
  private initialized = false;

  constructor() {
    this.local = new LocalProjectsService();
    this.sync = new SyncService();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.local.initialize();
    await this.sync.initialize();

    this.initialized = true;
  }

  /**
   * Create project - OFFLINE-FIRST
   * Always saves to local DB first, syncs in background
   */
  async createProject(input: CreateProjectInput): Promise<Project> {
    await this.ensureInitialized();

    const currentUserId = await this.getCurrentUserId();

    // STEP 1: Create project object
    const project: Project = {
      id: this.generateUUID(),
      name: input.name,
      description: input.description || null,
      organisation_id: input.organisation_id,
      owner_id: currentUserId,
      created_by: currentUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      privacy_level: input.privacy_level || 'public',
      project_image: null,
      end_date: null,
      is_private: input.privacy_level === 'private',
      is_baited: input.is_baited || false,
      is_monitoring_marked_individual: input.is_monitoring_marked_individual || false,
      sampling_design: input.sampling_design || null,
      website: input.website || null,
      synced: false,
    };

    // STEP 2: Save to local database (persistent)
    await this.local.saveProject(project);
    console.log('✅ Project saved to local DB:', project.id);

    // STEP 3: Queue for cloud sync
    await this.sync.queueOperation({
      id: `create-project-${project.id}`,
      type: 'CREATE_PROJECT',
      entity_type: 'project',
      entity_id: project.id,
      payload: project,
      user_id: currentUserId,
      organisation_id: input.organisation_id,
      timestamp: new Date(),
      retry_count: 0,
      priority: 800, // From spec Section 6.5
    });
    console.log('📦 Project queued for sync:', project.id);

    // STEP 4: Attempt background sync (non-blocking)
    this.sync.processSyncQueue().catch(err => {
      console.warn('Background sync failed:', err);
    });

    return project;
  }

  /**
   * Get user projects - ALWAYS from local DB
   */
  async getUserProjects(): Promise<ProjectWithDetails[]> {
    await this.ensureInitialized();

    // Read from local cache
    const projects = await this.local.getProjects();

    // Trigger background refresh if online (non-blocking)
    this.refreshFromCloud().catch(err => {
      console.warn('Background refresh failed:', err);
    });

    return projects;
  }

  /**
   * Get project by ID - ALWAYS from local DB
   */
  async getProjectById(projectId: string): Promise<ProjectWithDetails | null> {
    await this.ensureInitialized();

    return await this.local.getProjectById(projectId);
  }

  /**
   * Update project - OFFLINE-FIRST
   */
  async updateProject(projectId: string, updates: Partial<Project>): Promise<Project> {
    await this.ensureInitialized();

    // Get current project
    const current = await this.local.getProjectById(projectId);
    if (!current) throw new Error('Project not found');

    // Merge updates
    const updated: Project = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
      synced: false,
    };

    // Save to local DB
    await this.local.saveProject(updated);

    // Queue for sync
    await this.sync.queueOperation({
      id: `update-project-${projectId}`,
      type: 'UPDATE_PROJECT',
      entity_type: 'project',
      entity_id: projectId,
      payload: updated,
      user_id: await this.getCurrentUserId(),
      organisation_id: updated.organisation_id,
      timestamp: new Date(),
      retry_count: 0,
      priority: 800,
    });

    // Attempt background sync
    this.sync.processSyncQueue().catch(console.warn);

    return updated;
  }

  /**
   * Delete project - OFFLINE-FIRST (soft delete)
   */
  async deleteProject(projectId: string): Promise<void> {
    await this.ensureInitialized();

    // Soft delete locally
    await this.local.softDelete(projectId);

    // Queue for sync
    await this.sync.queueOperation({
      id: `delete-project-${projectId}`,
      type: 'DELETE_PROJECT',
      entity_type: 'project',
      entity_id: projectId,
      payload: { id: projectId, deleted_at: new Date().toISOString() },
      user_id: await this.getCurrentUserId(),
      organisation_id: '',
      timestamp: new Date(),
      retry_count: 0,
      priority: 800,
    });

    // Attempt background sync
    this.sync.processSyncQueue().catch(console.warn);
  }

  /**
   * Background refresh from cloud (when online)
   */
  private async refreshFromCloud(): Promise<void> {
    // Check if online
    const { data: session } = await supabase.auth.getSession();
    if (!session) return;

    try {
      // Fetch from Supabase
      const { data, error } = await supabase
        .from('projects_with_stats')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Merge with local data (conflict resolution)
      for (const remote of data || []) {
        const local = await this.local.getProjectById(remote.id);

        if (!local) {
          // New project from cloud
          await this.local.saveProject({ ...remote, synced: true });
        } else if (local.synced) {
          // Cloud is source of truth for synced projects
          if (new Date(remote.updated_at) > new Date(local.updated_at)) {
            await this.local.saveProject({ ...remote, synced: true });
          }
        }
        // Unsynced local projects keep their data (will sync later)
      }

      console.log('✅ Refreshed projects from cloud');
    } catch (error) {
      console.warn('Failed to refresh from cloud:', error);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async getCurrentUserId(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || 'offline-user';
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export default new ProjectService();
```

---

### Phase 2: Background Sync System (8 hours)

#### 2.1 Create SyncService (4 hours)

**File**: `src/services/offline/SyncService.ts`

```typescript
import { DatabaseService } from './DatabaseService';
import { ConflictResolver } from './ConflictResolver';
import { supabase } from '../supabase';
import type { QueuedOperation } from '../../types/offline';

export class SyncService {
  private db: DatabaseService;
  private resolver: ConflictResolver;
  private syncInProgress = false;
  private initialized = false;

  constructor() {
    this.db = new DatabaseService();
    this.resolver = new ConflictResolver();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.db.initializeDatabase();
    this.initialized = true;
  }

  /**
   * Queue operation for sync
   */
  async queueOperation(operation: QueuedOperation): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO offline_queue (
        operation_id, operation_type, entity_type, entity_id,
        payload, created_at, retry_count, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        operation.id,
        operation.type,
        operation.entity_type,
        operation.entity_id,
        JSON.stringify(operation.payload),
        operation.timestamp.toISOString(),
        operation.retry_count,
        operation.priority || 500
      ]
    );
  }

  /**
   * Process sync queue (background operation)
   */
  async processSyncQueue(): Promise<void> {
    if (this.syncInProgress) {
      console.log('⏳ Sync already in progress');
      return;
    }

    this.syncInProgress = true;

    try {
      // Get pending operations (priority order)
      const pending = await this.db.getAllAsync(`
        SELECT * FROM offline_queue
        WHERE synced = 0 AND retry_count < 5
        ORDER BY priority DESC, created_at ASC
        LIMIT 10
      `);

      console.log(`📤 Syncing ${pending.length} operations...`);

      for (const op of pending) {
        try {
          await this.syncOperation(op);

          // Mark as synced
          await this.db.runAsync(
            `UPDATE offline_queue SET synced = 1 WHERE id = ?`,
            [op.id]
          );

          console.log(`✅ Synced: ${op.operation_type} ${op.entity_id}`);
        } catch (error) {
          // Increment retry count
          await this.db.runAsync(
            `UPDATE offline_queue
             SET retry_count = retry_count + 1,
                 last_error = ?
             WHERE id = ?`,
            [error.message, op.id]
          );

          console.error(`❌ Sync failed: ${op.operation_type}`, error);
        }
      }

      console.log('🏁 Sync queue processed');
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync single operation
   */
  private async syncOperation(op: any): Promise<void> {
    const payload = JSON.parse(op.payload);

    switch (op.operation_type) {
      case 'CREATE_PROJECT':
        await this.syncCreateProject(payload);
        break;
      case 'UPDATE_PROJECT':
        await this.syncUpdateProject(payload);
        break;
      case 'DELETE_PROJECT':
        await this.syncDeleteProject(payload);
        break;
      default:
        console.warn(`Unknown operation type: ${op.operation_type}`);
    }
  }

  private async syncCreateProject(project: any): Promise<void> {
    // Insert to Supabase
    const { data, error } = await supabase
      .from('projects')
      .insert(project)
      .select()
      .single();

    if (error) throw error;

    // Update local record
    await this.db.runAsync(
      `UPDATE local_projects
       SET synced = 1, data = ?
       WHERE id = ?`,
      [JSON.stringify(data), project.id]
    );
  }

  private async syncUpdateProject(project: any): Promise<void> {
    // Update in Supabase
    const { data, error } = await supabase
      .from('projects')
      .update(project)
      .eq('id', project.id)
      .select()
      .single();

    if (error) throw error;

    // Update local record
    await this.db.runAsync(
      `UPDATE local_projects
       SET synced = 1, data = ?
       WHERE id = ?`,
      [JSON.stringify(data), project.id]
    );
  }

  private async syncDeleteProject(project: any): Promise<void> {
    // Soft delete in Supabase
    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: project.deleted_at })
      .eq('id', project.id);

    if (error) throw error;

    // Mark local as synced
    await this.db.runAsync(
      `UPDATE local_projects SET synced = 1 WHERE id = ?`,
      [project.id]
    );
  }
}
```

#### 2.2 Create Conflict Resolution (2 hours)

**File**: `src/services/offline/ConflictResolver.ts`

```typescript
import type { Project } from '../../types/project';

export class ConflictResolver {
  /**
   * Resolve project conflicts (from spec Section 6.4)
   */
  resolveProject(local: Project, remote: Project): Project {
    // Merge member lists (union of both)
    const mergedMembers = this.mergeUnique(
      (local as any).members || [],
      (remote as any).members || [],
      'userId'
    );

    // Last-write-wins for other fields
    const winner = new Date(local.updated_at) > new Date(remote.updated_at)
      ? local
      : remote;

    return {
      ...winner,
      members: mergedMembers,
    };
  }

  private mergeUnique(arr1: any[], arr2: any[], key: string): any[] {
    const map = new Map();

    [...arr1, ...arr2].forEach(item => {
      map.set(item[key], item);
    });

    return Array.from(map.values());
  }
}
```

#### 2.3 Automatic Sync Triggers (2 hours)

**File**: `src/providers/SyncProvider.tsx`

```typescript
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import ProjectService from '../services/ProjectService';

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // Sync when network becomes available
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        console.log('🌐 Network online - triggering sync');
        ProjectService.processSyncQueue().catch(console.warn);
      }
    });

    // Sync when app comes to foreground
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        console.log('📱 App active - triggering sync');
        ProjectService.processSyncQueue().catch(console.warn);
      }
    });

    // Periodic sync (every 5 minutes when online)
    const interval = setInterval(() => {
      NetInfo.fetch().then(state => {
        if (state.isConnected) {
          ProjectService.processSyncQueue().catch(console.warn);
        }
      });
    }, 5 * 60 * 1000);

    return () => {
      unsubscribe();
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  return <>{children}</>;
};
```

---

### Phase 3: UI Integration (4 hours)

#### 3.1 Replace RTK Query with Local Hooks (2 hours)

**File**: `src/hooks/useLocalProjects.ts`

```typescript
import { useState, useEffect } from 'react';
import ProjectService from '../services/ProjectService';
import type { ProjectWithDetails } from '../types/project';

export function useLocalProjects() {
  const [projects, setProjects] = useState<ProjectWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await ProjectService.getUserProjects();
        if (mounted) {
          setProjects(data);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    load();

    // Subscribe to changes
    const subscription = ProjectService.subscribeToChanges((newProjects) => {
      if (mounted) {
        setProjects(newProjects);
      }
    });

    return () => {
      mounted = false;
      subscription();
    };
  }, []);

  return { projects, loading, error };
}

export function useCreateProject() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createProject = async (input: CreateProjectInput) => {
    setCreating(true);
    setError(null);

    try {
      const project = await ProjectService.createProject(input);
      return project;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setCreating(false);
    }
  };

  return { createProject, creating, error };
}
```

#### 3.2 Update Projects Screen (1 hour)

**File**: `src/navigation/screens/Projects.tsx`

```typescript
// Replace RTK Query hooks
// OLD:
// const { data: projects, isLoading } = useGetProjectsQuery();

// NEW:
const { projects, loading } = useLocalProjects();
```

#### 3.3 Update NewProjectScreen (1 hour)

```typescript
// Replace RTK Query mutation
// OLD:
// const [createProject, { isLoading }] = useCreateProjectMutation();

// NEW:
const { createProject, creating } = useCreateProject();
```

---

### Phase 4: Sync Status UI (4 hours)

#### 4.1 Sync Status Indicator Component (2 hours)

**File**: `src/components/SyncStatusIndicator.tsx`

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Badge, IconButton } from 'react-native-paper';
import { useSyncStatus } from '../hooks/useSyncStatus';

export const SyncStatusIndicator = () => {
  const { pendingCount, syncing, lastSync, error } = useSyncStatus();

  if (pendingCount === 0 && !syncing) {
    return (
      <View style={styles.container}>
        <Icon name="cloud-check" size={20} color="green" />
      </View>
    );
  }

  if (syncing) {
    return (
      <View style={styles.container}>
        <Icon name="cloud-sync" size={20} color="orange" />
        {pendingCount > 0 && <Badge>{pendingCount}</Badge>}
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Icon name="cloud-alert" size={20} color="red" />
        <Badge>{pendingCount}</Badge>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Icon name="cloud-upload" size={20} color="blue" />
      <Badge>{pendingCount}</Badge>
    </View>
  );
};
```

#### 4.2 Add to NavigationBar (1 hour)

Show sync status near user avatar

#### 4.3 Add to Project Cards (1 hour)

Show individual project sync status

---

### Phase 5: Testing & Validation (8 hours)

#### 5.1 Unit Tests (3 hours)

- LocalProjectsService tests
- SyncService tests
- ConflictResolver tests

#### 5.2 Integration Tests (3 hours)

- Offline create → online sync flow
- Conflict resolution scenarios
- Multiple operations queuing

#### 5.3 E2E Tests (2 hours)

- Maestro flows for offline scenarios
- Performance testing with 100+ projects

---

## Migration Strategy

### Database Migration

```typescript
// DatabaseService.ts
private readonly DATABASE_VERSION = 3;

async runMigrations(): Promise<void> {
  const currentVersion = await this.getDatabaseVersion();

  if (currentVersion < 3) {
    // v2 → v3: Add local_projects table
    console.log('🔧 Migrating to v3 - adding local_projects');

    // Drop old offline_queue (recreate without FK)
    await this.db!.execAsync('DROP TABLE IF EXISTS offline_queue;');

    // Create new tables
    await this.createTables();

    // Increment version
    await this.setDatabaseVersion(3);
  }
}
```

### Data Migration

```typescript
// On first run after update
async migrateExistingProjects(): Promise<void> {
  // Fetch all projects from Supabase
  const { data } = await supabase
    .from('projects_with_stats')
    .select('*');

  // Save to local DB
  for (const project of data || []) {
    await this.local.saveProject({ ...project, synced: true });
  }

  console.log(`✅ Migrated ${data?.length || 0} projects to local DB`);
}
```

---

## Success Criteria

### Functional Requirements ✅

- [ ] Projects created offline persist across app restarts
- [ ] Projects viewable offline indefinitely
- [ ] Background sync to Supabase when online
- [ ] Conflict resolution working (member list merge, last-write-wins)
- [ ] Sync status indicators in UI
- [ ] Manual sync trigger available

### Performance Requirements ✅

- [ ] Local DB queries < 50ms for 100+ projects
- [ ] UI updates instant (no network wait)
- [ ] Background sync non-blocking
- [ ] Sync queue processes < 1s per operation

### Quality Requirements ✅

- [ ] 80%+ test coverage
- [ ] Zero data loss scenarios
- [ ] Graceful offline/online transitions
- [ ] Clear error messages for sync failures

---

## Rollout Plan

### Phase Rollout

**Week 1**: Phase 1 + Phase 2 (Local storage + Sync)
**Week 2**: Phase 3 + Phase 4 (UI integration + Status indicators)
**Week 3**: Phase 5 (Testing & validation)

### User Communication

- Update app description: "Now works fully offline!"
- Release notes highlighting offline capabilities
- In-app tutorial for sync status understanding

---

## Risk Mitigation

### Data Loss Prevention

- Local DB backup before version migration
- Transaction rollback on sync failures
- Retry logic with exponential backoff

### Performance Concerns

- Indexed queries on local DB
- Pagination for large datasets
- Background sync throttling

### Testing Challenges

- Simulate network transitions
- Test with degraded connectivity
- Stress test with large datasets

---

## Timeline Estimate

| Phase | Hours | Days (8h/day) |
|-------|-------|---------------|
| Phase 1: Local Storage | 8 | 1.0 |
| Phase 2: Background Sync | 8 | 1.0 |
| Phase 3: UI Integration | 4 | 0.5 |
| Phase 4: Sync Status UI | 4 | 0.5 |
| Phase 5: Testing | 8 | 1.0 |
| **Total** | **32** | **4.0** |

**With Claude Flow Parallel Execution**: 2.5-3 days

---

## Next Steps

1. ✅ Gain stakeholder approval for 4-day investment
2. ⬜ Apply quick fix (bump DB version to v2, remove FK)
3. ⬜ Create Claude Flow orchestration plan
4. ⬜ Execute Phase 1 (parallel with other tasks if possible)
5. ⬜ Iterate through phases with continuous testing

---

**Document Owner**: Claude Code
**Approval Status**: Pending Stakeholder Decision
**Priority**: CRITICAL - Core MVP Requirement
