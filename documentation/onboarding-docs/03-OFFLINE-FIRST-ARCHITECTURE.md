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
Located in: `src/database/schema.ts`

### Key Tables

**1. projects** - Project data
```typescript
tableSchema({
  name: 'projects',
  columns: [
    { name: 'name', type: 'string' },
    { name: 'description', type: 'string', isOptional: true },
    { name: 'status', type: 'string' },
    { name: 'organisation_id', type: 'string', isIndexed: true },
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
    { name: 'modified_by', type: 'string' }, // Audit trail
  ]
})
```

**2. sync_outbox** - Pending sync operations (Internal)
```typescript
tableSchema({
  name: 'sync_outbox',
  columns: [
    { name: 'operation_id', type: 'string', isIndexed: true },
    { name: 'table_name', type: 'string' },
    { name: 'record_id', type: 'string' },
    { name: 'operation_type', type: 'string' }, // create, update, delete
    { name: 'payload', type: 'string' }, // JSON payload
    { name: 'status', type: 'string', isIndexed: true }, // pending, syncing, synced, failed
    { name: 'created_at', type: 'number' },
  ]
})
```

## SupabaseSyncService Deep Dive

Located in: `src/services/SupabaseSyncService.ts`

### Core Logic

The sync service orchestrates the bi-directional data flow:

1.  **Push Changes**: Reads `sync_outbox` and sends changes to Supabase via RPC.
2.  **Pull Changes**: Fetches changes from Supabase (since last sync) and updates WatermelonDB.

### Sync Process

```typescript
// src/services/SupabaseSyncService.ts
async sync(): Promise<void> {
  if (this.isSyncing) return;
  this.isSyncing = true;

  try {
    // 1. Push local changes
    await this.pushChanges();

    // 2. Pull remote changes
    await this.pullChanges();

  } catch (error) {
    console.error('Sync failed:', error);
  } finally {
    this.isSyncing = false;
  }
}
```

### Push Implementation

```typescript
private async pushChanges() {
  const { changes, lastPulledAt } = await database.write(async () => {
    // Get pending changes from sync_outbox
    // ...
  });

  if (changes.length > 0) {
    // Send to Supabase RPC 'push_changes'
    await supabase.rpc('push_changes', { payload: changes });
  }
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

**Step 1: Component calls Service**
```typescript
// src/services/ProjectService.ts
async createProject(input: CreateProjectInput) {
  await database.write(async () => {
    // Create in WatermelonDB
    await projectsCollection.create(project => {
      project.name = input.name;
      // ...
    });
  });
}
```

**Step 2: WatermelonDB updates UI**
```typescript
// Component using withObservables
const enhance = withObservables([], () => ({
  projects: database.collections.get('projects').query()
}));
// UI updates automatically!
```

**Step 3: Sync Outbox Entry Created**
WatermelonDB automatically tracks this creation in `sync_outbox` (if configured) or via our custom sync adapter logic.

**Step 4: User lands, network returns**
`SupabaseSyncService` detects connection and triggers `sync()`.

**Step 5: Sync Engine Pushes**
The pending creation is sent to Supabase. The server responds with the confirmed record. WatermelonDB updates the local record with any server-side changes (e.g., timestamps).

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
- [WatermelonDB Documentation](https://watermelondb.dev/docs)
- [Supabase Offline Sync Guide](https://supabase.com/docs/guides/mobile/offline-sync)
