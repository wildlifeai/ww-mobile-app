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
┌─────────────────────────────────────────────┐
│  Mobile App (Offline-First)                │
│                                             │
│  ┌───────────────────────────────┐         │
│  │  React Native UI              │         │
│  │  (withObservables)            │         │
│  └───────────────────────────────┘         │
│             ↓ ↑                             │
│  ┌───────────────────────────────┐         │
│  │  WatermelonDB (Local SQLite)  │         │
│  │  - Source of truth for UI     │         │
│  │  - Reactive observables       │         │
│  │  - No security enforcement    │         │
│  └───────────────────────────────┘         │
│             ↓                               │
│  ┌───────────────────────────────┐         │
│  │  SupabaseSyncService          │  ◄──── Sync Boundary
│  │  - JWT authentication         │         │
│  │  - Bi-directional sync        │         │
│  └───────────────────────────────┘         │
└─────────────────────────────────────────────┘
                 ↓ HTTPS + JWT
┌─────────────────────────────────────────────┐
│  Supabase (Server-Side)                     │
│  - PostgreSQL database                      │
│  - RLS policies (security)                  │
│  - Constraints (validation)                 │
│  - Source of truth for data                 │
└─────────────────────────────────────────────┘
```

## WatermelonDB Schema

Located in: `src/database/schema.ts`

### Key Tables

**1. projects** - Project data
```typescript
tableSchema({
  name: 'projects',
  columns: [
    { name: 'name', type: 'string' },
    { name: 'description', type: 'string', isOptional: true },
    { name: 'organisation_id', type: 'string', isIndexed: true },
    { name: 'is_active', type: 'boolean' },
    { name: 'created_by', type: 'string' },
    { name: 'modified_by', type: 'string' }, // Audit trail
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
    { name: 'deleted_at', type: 'number' },
    // Sync tracking
    { name: '_version', type: 'number' },
    { name: '_custom_sync_status', type: 'string', isOptional: true },
  ]
})
```

**2. user_roles** - User permissions (replaces project_members)
```typescript
tableSchema({
  name: 'user_roles',
  columns: [
    { name: 'user_id', type: 'string', isIndexed: true },
    { name: 'role', type: 'string' }, // 'ww_admin', 'project_admin', 'project_member'
    { name: 'scope_type', type: 'string' }, // 'global', 'organisation', 'project'
    { name: 'scope_id', type: 'string', isOptional: true, isIndexed: true },
    { name: 'granted_by', type: 'string' },
    { name: 'is_active', type: 'boolean' },
    { name: 'modified_by', type: 'string' },
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
  ]
})
```

**3. sync_outbox** - Pending sync operations (Internal)
```typescript
tableSchema({
  name: 'sync_outbox',
  columns: [
    { name: 'operation_id', type: 'string', isIndexed: true },
    { name: 'table_name', type: 'string' },
    { name: 'record_id', type: 'string' },
    { name: 'operation_type', type: 'string' }, // CREATE, UPDATE, DELETE
    { name: 'payload', type: 'string' }, // JSON payload
    { name: 'status', type: 'string', isIndexed: true }, // pending, syncing, synced, failed
    { name: 'retry_count', type: 'number' },
    { name: 'error_message', type: 'string', isOptional: true },
    { name: 'created_at', type: 'number' },
  ]
})
```

## Security & Data Integrity

### The 3-Layer Security Model

**Critical Concept:** Security is enforced at the **sync boundary**, not in the local database.

```
Layer 1: WatermelonDB (Local)
├─ ❌ No RLS policies
├─ ❌ No constraints
├─ ❌ No authorization checks
└─ ✅ Fast, optimistic storage for UI

Layer 2: SupabaseSyncService (Sync Boundary)
├─ ✅ JWT authentication
├─ ⚠️ Client-side filtering (efficiency, not security)
└─ ✅ Sync error handling

Layer 3: Supabase/PostgreSQL (Server)
├─ ✅ RLS policies (authorization)
├─ ✅ Constraints (validation)
└─ ✅ Source of truth
```

### How RLS Works in Practice

**Row Level Security (RLS)** policies on Supabase automatically filter data based on the authenticated user's permissions.

**Example: Project Access RLS Policy**
```sql
-- Server-side (Supabase PostgreSQL)
CREATE POLICY "projects_org_isolation" 
ON projects FOR ALL 
TO authenticated
USING (
    organisation_id IN (
        SELECT organisation_id 
        FROM user_roles
        WHERE user_id = auth.uid()
        AND scope_type IN ('global', 'organisation')
        AND is_active = true
    )
);
```

**What happens during sync:**

1. **Local write** (offline): User creates project → ✅ Always succeeds locally
2. **Sync attempt**: App sends to Supabase with JWT token
3. **RLS enforcement**: PostgreSQL checks if user has access
4. **Result**: 
   - ✅ Allowed → Data synced to server
   - ❌ Denied → Sync fails, data stays local only, error logged

### Offline Security Workflow Example

**Scenario: User tries to create project in wrong organisation**

```typescript
// Step 1: Local write (NO security check)
await database.write(async () => {
    await projects.create(p => {
        p.name = "My Project"
        p.organisation_id = "other-org-id" // ← User doesn't belong to this org!
    })
})
// ✅ Succeeds locally - UI updates immediately
// User sees: "Project created"

// Step 2: Sync to server (RLS ENFORCES)
const client = getSupabaseClient();
const { error } = await client
    .from('projects')
    .insert({ 
        name: "My Project", 
        organisation_id: "other-org-id" 
    })
// ❌ RLS blocks: "new row violates row-level security policy"

// Step 3: Error handling
// - Sync fails
// - Error logged to sync_outbox
// - User notification: "Sync failed - check permissions"
// - Data never reaches server
```

### Database Constraints

**Constraints** ensure data integrity at the server level.

**Example: Foreign Key Constraint**
```sql
ALTER TABLE deployments
ADD CONSTRAINT fk_project
FOREIGN KEY (project_id) REFERENCES projects(id);
```

**What happens:**
- User creates deployment offline with invalid `project_id`
- Sync attempts to push to server
- Constraint fails: `violates foreign key constraint`
- Sync error, deployment stays local

### Security Best Practices

**1. Never Trust Client-Side Checks**
```typescript
// ❌ BAD: Client-side security
if (user.role === 'admin') {
    // Attacker can bypass this
    await deleteProject()
}

// ✅ GOOD: Client-side UX only
if (user.role === 'admin') {
    showAdminUI() // For better UX
    // Server still enforces via RLS
}
```

**2. Handle Sync Failures Gracefully**
```typescript
// Show sync status to user
<View>
    <Text>Project saved locally</Text>
    {syncStatus === 'failed' && (
        <Text style={styles.error}>
            ⚠️ Failed to sync - check permissions
        </Text>
    )}
</View>
```

**3. Pre-validate When Possible**
```typescript
// Better UX: Check before writing
if (!userBelongsToOrg(organisationId)) {
    throw new Error("No access to this organisation")
}
await database.write(...)
```

## SupabaseSyncService Deep Dive

Located in: `src/services/SupabaseSyncService.ts`

### Core Sync Logic

The sync service orchestrates bi-directional data flow:

1. **Push Changes**: Reads `sync_outbox` and sends changes to Supabase
2. **Pull Changes**: Fetches changes from Supabase and updates WatermelonDB

```typescript
async sync(): Promise<void> {
  if (this.isSyncing) return
  this.isSyncing = true

  try {
    // Step 1: Upload local changes
    await this.uploadOutbox()

    // Step 2: Download remote changes
    await this.pullRemoteChanges()
    await this.syncUserRoles()
    await this.syncDevices()

    // Step 3: Update sync timestamps
    await SyncStateService.set(
        SYNC_STATE_KEYS.LAST_SYNCED_AT,
        Date.now().toString()
    )

    console.log('✅ Sync completed successfully')
  } catch (error) {
    console.error('❌ Sync failed:', error)
    await SyncStateService.set(
        SYNC_STATE_KEYS.LAST_SYNC_ERROR,
        error.message
    )
  } finally {
    this.isSyncing = false
  }
}
```

### Push Implementation

```typescript
private async uploadOutbox() {
  // Get pending operations
  const pendingOps = await database
    .get<SyncOutbox>('sync_outbox')
    .query(Q.where('status', 'pending'))
    .fetch()

  if (pendingOps.length === 0) return

  // Group by table and operation type
  const changes = {
    projects: { created: [], updated: [], deleted: [] },
    deployments: { created: [], updated: [], deleted: [] },
    // ...
  }

  // Send to server via RPC
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('push_changes', { changes })

  if (error) {
    // Mark operations as failed
    // Retry with exponential backoff
  } else {
    // Mark operations as synced
  }
}
```

### Pull Implementation

```typescript
private async pullRemoteChanges() {
  const lastPulledAt = await SyncStateService.get(
    SYNC_STATE_KEYS.LAST_PULL_TIMESTAMP
  )

  // Fetch changes since last sync
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('pull_changes', {
    last_pulled_at: lastPulledAt || 0
  })

  if (error) throw error

  // Apply changes to local database
  await database.write(async () => {
    for (const change of data.changes) {
      // Update/create/delete local records
      // RLS has already filtered to allowed data only
    }
  })
}
```

## Retry Logic & Exponential Backoff

```typescript
calculateRetryDelay(retryCount: number): number {
  const BASE_DELAY = 1000 // 1 second
  const MAX_DELAY = 60000 // 1 minute
  
  return Math.min(
    BASE_DELAY * Math.pow(2, retryCount),
    MAX_DELAY
  )
}
```

**Retry Schedule:**
- Attempt 1: Immediate
- Attempt 2: 1 second delay
- Attempt 3: 2 seconds delay
- Attempt 4: 4 seconds delay
- Attempt 5: 8 seconds delay
- After 5 attempts: Mark as failed, require manual intervention

## Conflict Resolution

### Detection

Conflicts occur when:
- Local record modified offline
- Server record modified by another user
- Both changes synced

### Resolution Strategy: Last Write Wins

```typescript
async resolveConflict(localRecord, serverRecord) {
  // Compare timestamps
  if (serverRecord.updated_at > localRecord.updated_at) {
    // Server wins - update local
    return serverRecord
  } else {
    // Local wins - push to server
    return localRecord
  }
}
```

## Practical Example: Complete Offline Flow

### Scenario: User creates project in airplane mode

**Step 1: Component calls Service**
```typescript
// src/services/ProjectService.ts
async createProject(input: CreateProjectInput) {
  await database.write(async () => {
    await projectsCollection.create(project => {
      project.name = input.name
      project.organisation_id = currentUser.organisation_id
      project.created_by = currentUser.id
      project.modified_by = currentUser.id
    })
  })
}
```

**Step 2: WatermelonDB updates UI automatically**
```typescript
// Component using withObservables
const enhance = withObservables([], () => ({
  projects: database.collections.get('projects').query()
}))
// UI re-renders automatically!
```

**Step 3: Sync Outbox Entry Created**
WatermelonDB tracks this creation in `sync_outbox`.

**Step 4: User lands, network returns**
`SupabaseSyncService` detects connection and triggers `sync()`.

**Step 5: Sync Engine Pushes**
- Pending creation sent to Supabase
- RLS policy checks user has access
- Server confirms, returns record with server timestamps
- WatermelonDB updates local record

## Best Practices

### DO:
- ✅ Save to WatermelonDB before any API call
- ✅ Update UI optimistically
- ✅ Handle sync failures gracefully
- ✅ Log extensively for debugging
- ✅ Test offline scenarios thoroughly
- ✅ Show sync status to users

### DON'T:
- ❌ Rely on network availability
- ❌ Skip local persistence
- ❌ Ignore conflict scenarios
- ❌ Trust client-side security checks
- ❌ Show raw network errors to users

## Debugging Offline Issues

### Check Sync Status
```typescript
import SyncStateService, { SYNC_STATE_KEYS } from '@/services/SyncStateService'

// Check last sync
const lastSync = await SyncStateService.get(SYNC_STATE_KEYS.LAST_SYNCED_AT)
console.log('Last synced:', new Date(parseInt(lastSync)))

// Check for errors
const lastError = await SyncStateService.get(SYNC_STATE_KEYS.LAST_SYNC_ERROR)
if (lastError) console.error('Sync error:', lastError)
```

### Inspect Sync Queue
```typescript
const pendingOps = await database
  .get('sync_outbox')
  .query(Q.where('status', 'pending'))
  .fetch()

console.log('Pending operations:', pendingOps.length)
pendingOps.forEach(op => {
  console.log(`- ${op.operationType} ${op.tableName} (retries: ${op.retryCount})`)
})
```

### View Database Contents
```typescript
// Check projects
const projects = await database.get('projects').query().fetch()
console.log('Local projects:', projects.map(p => p.name))

// Check user roles
const roles = await database.get('user_roles').query().fetch()
console.log('User roles:', roles)
```

## Security Checklist

- ✅ All Supabase requests include JWT authentication
- ✅ RLS policies enabled on all tables
- ✅ Sync errors logged and surfaced to user
- ✅ Organisation filtering in sync queries
- ⚠️ Client-side validation for UX (not security)
- ❌ Local database has no security (by design)

**Key Takeaway:** 
- **Local DB** = Optimistic cache for UI performance
- **Sync boundary** = Authentication layer (who you are)
- **Server** = Authorization & validation (what you can do)

## Schema Drift Prevention

### The 5-Layer Defense Strategy

The project uses a **"5-Layer Defense-in-Depth Strategy"** to prevent the mobile app's WatermelonDB schema from drifting away from the backend Supabase schema.

**The 5 Layers:**
1. **Backend Pre-Commit** - Blocks backend commits if types aren't regenerated
2. **Coordination Messages** - Manual notifications from backend to mobile devs
3. **Mobile Inbox Check** - Daily manual check by mobile devs
4. **Mobile Pre-Commit** - Blocks mobile commits if local types don't match schema
5. **GitHub Actions** - Blocks Pull Requests if types are out of sync

### Key Scripts & Tools

**Schema Validation:**
```bash
# Primary validation tool
npm run schema:validate:live:cloud-dev
```
- Connects to live Supabase database (cloud-dev environment)
- Fetches current schema and compares against local `src/database/schema.ts`
- Reports **Errors** (critical mismatches) and **Warnings** (optionality differences)
- Handles special cases (e.g., Timestamp: Supabase `string` → WatermelonDB `number`)

**Type Generation:**
```bash
# Regenerate TypeScript types from backend
npm run types:cloud-dev    # From cloud-dev environment
npm run types:local        # From local backend
```

### Recommended Workflow for Schema Changes

When backend schema changes:

1. **Regenerate Types**
   ```bash
   npm run types:cloud-dev
   ```

2. **Validate Schema**
   ```bash
   npm run schema:validate:live:cloud-dev
   ```

3. **Update Schema**
   - Fix any errors in `src/database/schema.ts`
   - Add/remove tables or columns as needed

4. **Increment Version**
   - Update `version` in `src/database/schema.ts` (currently v6)

5. **Create Migration** (if needed)
   - Add migration steps in `src/database/migrations.ts`
   - Or use database reset for dev environment

**Example:**
```typescript
// src/database/schema.ts
export default appSchema({
    version: 6, // ← Increment when schema changes
    tables: [
        tableSchema({
            name: 'user_roles',
            columns: [
                { name: 'user_id', type: 'string' },
                { name: 'role', type: 'string' },
                // ...
            ]
        }),
        // ...
    ]
})
```

## Next Steps

1. Explore [04-REDUX-STATE-MANAGEMENT.md](./04-REDUX-STATE-MANAGEMENT.md) for Redux patterns
2. Study [02-PROJECT-STRUCTURE.md](./02-PROJECT-STRUCTURE.md) to find offline code
3. Read [Supabase-Integration-Guide.md](../../archive/documentation/Supabase-Integration-Guide.md) for API details

## Resources

- [WatermelonDB Documentation](https://watermelondb.dev/docs)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [NetInfo Documentation](https://github.com/react-native-netinfo/react-native-netinfo)
- [Offline-First Web Apps Book](https://www.oreilly.com/library/view/building-progressive-web/9781491961643/)
