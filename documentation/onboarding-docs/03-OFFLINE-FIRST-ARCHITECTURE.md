# Offline-First Architecture

The heart of Wildlife Watcher - understanding offline-first design patterns with real examples from our codebase.

## Core Philosophy

**"The network is a lie"** - Never trust connectivity. This app must function perfectly in remote wilderness areas with zero connectivity for days or weeks.

### Traditional vs Offline-First

| Traditional App | Offline-First (Our App) |
|-----------------|-------------------------|
| API call → Update UI | Save locally → Update UI → Queue sync |
| Network errors = app broken | Network errors = invisible to user |
| Data loss risk when offline | Data integrity guaranteed |
| Optimistic UI as feature | Optimistic UI as default |

## Architecture Overview

```
┌─────────────────────────────────────────┐
│          User Action                     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│     1. Save to SQLite (ALWAYS FIRST)    │
│        - Immediate persistence           │
│        - User sees instant feedback      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│     2. Update Redux State               │
│        - UI reflects change immediately  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│     3. Queue for Sync (if applicable)   │
│        - Add to offline_queue table      │
│        - Priority-based ordering         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│     4. Sync When Online                 │
│        - Network monitor detects         │
│        - Process queue automatically     │
│        - Conflict resolution if needed   │
└─────────────────────────────────────────┘
```

## SQLite Schema

Located in: `src/services/offline/DatabaseService.ts:157-283`

### Key Tables

**1. local_projects** - Project data cache
```sql
CREATE TABLE IF NOT EXISTS local_projects (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK(status IN ('active', 'inactive', 'completed')),
  members TEXT NOT NULL,  -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organisation_id) REFERENCES local_organisations (id)
);
```

**2. offline_queue** - Pending sync operations
```sql
CREATE TABLE IF NOT EXISTS offline_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_type TEXT NOT NULL,  -- 'CREATE_PROJECT', 'UPDATE_DEPLOYMENT', etc.
  data TEXT NOT NULL,             -- JSON payload
  organisation_id TEXT NOT NULL,  -- For multi-tenancy filtering
  user_id TEXT NOT NULL,
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  status TEXT DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**3. conflict_resolutions** - Audit trail
```sql
CREATE TABLE IF NOT EXISTS conflict_resolutions (
  id TEXT PRIMARY KEY,
  conflict_type TEXT NOT NULL,
  resolution_strategy TEXT,  -- 'server_wins', 'local_wins', 'merge'
  resolved_at DATETIME,
  server_data TEXT NOT NULL,
  local_data TEXT NOT NULL,
  needs_user_resolution BOOLEAN DEFAULT FALSE
);
```

## OfflineService Deep Dive

Located in: `src/services/offline/OfflineService.ts` (983 lines!)

### Initialization

```typescript
// src/services/offline/OfflineService.ts:55-65
async initialize(): Promise<void> {
  if (this.initialized) return;

  // Initialize database connection
  await this.databaseService.initializeDatabase();

  // Set up network monitoring
  await this.setupNetworkMonitoring();

  this.initialized = true;
}
```

### Network Monitoring

```typescript
// src/services/offline/OfflineService.ts:70-100
private async setupNetworkMonitoring(): Promise<void> {
  // Get initial network state
  const initialState = await NetInfo.fetch();
  this.updateNetworkStatus(initialState);

  // Listen for network changes
  this.networkUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const wasOffline = !this.networkStatus.isConnected;
    this.updateNetworkStatus(state);
    const isNowOnline = this.networkStatus.isConnected;

    console.log('📡 ============ NETWORK STATE CHANGE ============');
    console.log('📡 Was offline:', wasOffline);
    console.log('📡 Is now online:', isNowOnline);

    // Trigger sync when coming online
    if (wasOffline && isNowOnline) {
      console.log('📡 🔄 TRANSITIONING FROM OFFLINE → ONLINE');
      this.syncPendingOperations().catch(error => {
        console.error('📡 ❌ Failed to sync pending operations:', error);
      });
    }
  });
}
```

**Key Points**:
- Monitors network state changes in real-time
- Automatically triggers sync when connectivity returns
- Logs extensively for debugging offline issues

### Queuing Operations

```typescript
// src/services/offline/OfflineService.ts:130-170
async queueOperation(operation: OfflineOperation): Promise<void> {
  console.log(`📤 Queue operation called: ${operation.type}`);
  console.log(`📤 Network status: ${this.networkStatus.isConnected ? 'ONLINE' : 'OFFLINE'}`);

  if (this.networkStatus.isConnected) {
    // Attempt immediate execution if online
    try {
      const success = await this.executeOperation(operation);
      if (success) {
        console.log('📤 ✅ Operation completed successfully, not queuing');
        return; // Don't queue if successful
      }
    } catch (error) {
      console.warn('📤 ❌ Failed immediately, queuing for retry:', error);
    }
  }

  // Queue operation for offline processing or retry
  const queueItem: any = {
    id: operation.id,
    operation_type: operation.type,
    data: JSON.stringify(operation.data),
    user_id: operation.user_id,
    organisation_id: operation.organisation_id,
    priority: 'medium',
    retry_count: operation.retry_count,
    max_retries: 3,
    status: 'pending'
  };

  await this.databaseService.addToOfflineQueue(queueItem);
}
```

**Smart Queuing Logic**:
1. If online → Try immediate execution
2. If succeeds → Don't queue (optimization)
3. If fails OR offline → Queue for later

### Sync Process

```typescript
// src/services/offline/OfflineService.ts:240-301
async syncPendingOperations(user?: User): Promise<void> {
  console.log('🔄 ============ SYNC PENDING OPERATIONS START ============');

  if (!this.networkStatus.isConnected) {
    console.log('🔄 ❌ Sync aborted - network not connected');
    return;
  }

  const operations = await this.getOperationsForSync(user);
  console.log(`🔄 Found ${operations.length} operations to sync`);

  let processedCount = 0;
  let failedCount = 0;

  for (const operation of operations) {
    // Role-based permission check
    if (user && !this.canUserPerformOperation(user, operation)) {
      console.warn(`🔄 ⚠️ User ${user.id} cannot perform operation, skipping`);
      continue;
    }

    // Check retry delay (exponential backoff)
    if (!this.isOperationReadyForRetry(operation)) {
      console.log(`🔄 ⏱️ Operation not ready for retry yet`);
      continue;
    }

    const success = await this.executeOperation(operation);
    if (success) {
      processedCount++;
    } else {
      failedCount++;
    }
  }

  console.log(`🔄 Processed: ${processedCount}, Failed: ${failedCount}`);
}
```

### Operation Execution

```typescript
// src/services/offline/OfflineService.ts:175-235
async executeOperation(operation: OfflineOperation): Promise<boolean> {
  try {
    switch (operation.type) {
      case 'CREATE_PROJECT':
        await this.executeCreateProject(operation);
        break;
      case 'UPDATE_PROJECT':
        await this.executeUpdateProject(operation);
        break;
      case 'CREATE_DEPLOYMENT':
        await this.executeCreateDeployment(operation);
        break;
      // ... more operation types
    }

    // Remove successful operation from queue
    await this.databaseService.markQueueItemCompleted(operation.id);
    return true;
  } catch (error) {
    // Update retry count and requeue if within limits
    if (this.shouldRetryOperation(operation)) {
      await this.databaseService.updateQueueItemRetry(
        operation.id,
        operation.retry_count + 1,
        'pending'
      );
    }
    return false;
  }
}
```

### Example: Creating a Project Offline

```typescript
// src/services/offline/OfflineService.ts:580-604
private async executeCreateProject(operation: OfflineOperation): Promise<void> {
  const projectData = operation.data as ProjectCreate;

  // Execute API call through OfflineApiService
  const result = await OfflineApiService.createProject(projectData);

  // Update local database with server response
  const dbProject = {
    name: result.name || projectData.name,
    description: result.description || projectData.description || '',
    status: result.status || 'active',
    members: result.members || []
  };

  await this.databaseService.updateProject(result.id, dbProject);
}
```

## Retry Logic & Exponential Backoff

```typescript
// src/services/offline/OfflineService.ts:552-577
calculateRetryDelay(retryCount: number): number {
  const delay = Math.min(
    this.BASE_RETRY_DELAY * Math.pow(2, retryCount),
    this.MAX_RETRY_DELAY
  );
  return delay;
}

private isOperationReadyForRetry(operation: OfflineOperation): boolean {
  if (operation.retry_count === 0) return true;

  const retryDelay = this.calculateRetryDelay(operation.retry_count);
  const timeSinceLastAttempt = Date.now() - operation.timestamp.getTime();

  return timeSinceLastAttempt >= retryDelay;
}

shouldRetryOperation(operation: OfflineOperation): boolean {
  return operation.retry_count < this.MAX_RETRY_ATTEMPTS; // 5 attempts
}
```

**Retry Schedule**:
- Attempt 1: Immediate
- Attempt 2: 1 second delay
- Attempt 3: 2 seconds delay
- Attempt 4: 4 seconds delay
- Attempt 5: 8 seconds delay
- After 5 attempts: Mark as failed

## Conflict Resolution

### Detection

```typescript
// src/services/offline/OfflineService.ts:456-482
async syncWithConflictResolution(user: User, operationType: string, serverData: any, localData: any): Promise<any> {
  // Detect conflicts using advanced conflict resolution service
  const conflicts = await this.conflictResolutionService.detectConflicts(
    serverData,
    localData,
    operationType,
    user
  );

  if (conflicts.length === 0) {
    return serverData; // No conflicts
  }

  // Resolve conflicts with strategy
  const resolvedData = await this.conflictResolutionService.resolveConflicts(conflicts);

  return resolvedData[0] || serverData;
}
```

### Resolution Strategies

1. **Server Wins** - Use server data (default for most conflicts)
2. **Local Wins** - Keep local changes
3. **Merge** - Intelligent merge (e.g., union of project members)
4. **User Choice** - Prompt user to resolve manually

### Example: Project Member Merge

```
Local:  [user1, user2, user3]
Server: [user1, user4, user5]
Result: [user1, user2, user3, user4, user5]  // Union
```

## Role-Based Sync Filtering

```typescript
// src/services/offline/OfflineService.ts:306-339
async getOperationsForSync(user?: User): Promise<OfflineOperation[]> {
  let queueItems: any[];

  if (!user) {
    queueItems = await this.databaseService.getPendingQueueItems();
  } else {
    switch (user.role) {
      case 'ww_admin':
        // WW Admin can sync all organisations
        queueItems = await this.databaseService.getPendingQueueItems();
        break;

      case 'project_admin':
      case 'project_member':
        // Organisation-scoped operations only
        queueItems = await this.databaseService.getQueueItemsByOrganisation(user.organisation_id);
        break;

      default:
        queueItems = [];
    }
  }

  return queueItems.map(item => ({
    id: item.id,
    type: item.operation_type,
    data: JSON.parse(item.data),
    // ... rest of mapping
  }));
}
```

**Security**: Users only sync operations for their organisation (except WW Admins).

## Priority System

```typescript
// src/redux/slices/offlineSlice.ts:25-30
export const OPERATION_PRIORITY = {
  CRITICAL: 1000, // Deployment end (prevent orphaned cameras)
  HIGH: 900,      // Deployment start
  MEDIUM: 800,    // Project updates
  LOW: 500,       // Profile updates
};
```

**Higher priority operations sync first** when multiple are queued.

## Practical Example: Complete Offline Flow

### Scenario: User creates project in airplane mode

**Step 1: Component dispatches action**
```typescript
const handleCreateProject = async () => {
  dispatch(queueOfflineOperation({
    type: 'CREATE_PROJECT',
    entityType: 'project',
    entityId: newProject.id,
    data: newProject,
    userId: currentUser.id,
    organisationId: currentUser.organisationId,
    priority: OPERATION_PRIORITY.MEDIUM,
  }));
};
```

**Step 2: Redux thunk saves to SQLite**
```typescript
// offlineSlice.ts async thunk
await databaseService.insertProject(newProject);
await databaseService.addToOfflineQueue(queueItem);
```

**Step 3: UI updates immediately**
```typescript
// Component re-renders with new project in list
const projects = useAppSelector(state => state.projects.items);
```

**Step 4: User lands, network returns**
```typescript
// NetInfo detects connection
// OfflineService.syncPendingOperations() called automatically
```

**Step 5: Sync processes queue**
```typescript
// 1. Fetch operation from SQLite
// 2. POST to Supabase API
// 3. Get server-assigned ID
// 4. Update local database with real ID
// 5. Mark operation completed
// 6. Remove from queue
```

## Best Practices

### DO:
✅ Save to SQLite before any API call
✅ Update UI optimistically
✅ Handle conflicts gracefully
✅ Log extensively for debugging
✅ Use priorities for important operations
✅ Test offline scenarios thoroughly

### DON'T:
❌ Rely on network availability
❌ Skip local persistence
❌ Ignore conflict scenarios
❌ Forget retry logic
❌ Show network errors to users (handle gracefully)

## Debugging Offline Issues

### Useful Logs
```typescript
// Network state changes
console.log('📡 Network status:', isConnected);

// Queue operations
console.log('📤 Queuing operation:', operationType);

// Sync process
console.log('🔄 Syncing:', operationCount, 'operations');

// Execution
console.log('⚙️ Executing:', operationType);
```

### Check Queue State
```typescript
const queueItems = await databaseService.getPendingQueueItems();
console.log('Pending operations:', queueItems);
```

### Inspect Database
```sql
-- Check queue
SELECT * FROM offline_queue WHERE status = 'pending';

-- Check projects
SELECT * FROM local_projects WHERE organisation_id = 'xxx';

-- Check conflicts
SELECT * FROM conflict_resolutions WHERE needs_user_resolution = TRUE;
```

## Advanced Topics

### Batch Sync
```typescript
// src/services/offline/OfflineService.ts:769-801
async batchSyncOperations(operations: OfflineOperation[], batchSize: number = 10): Promise<{ successful: number; failed: number }> {
  // Process in batches to avoid overwhelming server
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(op => this.executeOperation(op)));
  }
}
```

### Incremental Sync
```typescript
// Sync only operations since last sync timestamp
await offlineService.incrementalSync(user, lastSyncTimestamp);
```

### Selective Sync
```typescript
// Sync only specific operation types
await offlineService.selectiveSync(user, ['CREATE_PROJECT', 'UPDATE_PROJECT'], 'high');
```

## Next Steps

1. Explore [04-REDUX-STATE-MANAGEMENT.md](./04-REDUX-STATE-MANAGEMENT.md) for Redux patterns
2. Study [02-PROJECT-STRUCTURE.md](./02-PROJECT-STRUCTURE.md) to find offline code
3. Read implementation spec for full requirements

## Resources

- [Offline-First Web Apps Book](https://www.oreilly.com/library/view/building-progressive-web/9781491961643/)
- [NetInfo Documentation](https://github.com/react-native-netinfo/react-native-netinfo)
- [Expo SQLite Documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/)
