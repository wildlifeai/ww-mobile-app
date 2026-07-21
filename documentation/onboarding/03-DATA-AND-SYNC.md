# Data & Sync — Offline-First Architecture

The heart of Wildlife Watcher — understanding offline-first design patterns, WatermelonDB, Supabase sync, and the security model.

## Core Philosophy

**"The network is a lie"** — this app must function perfectly in remote wilderness areas with zero connectivity for days or weeks.

| Traditional App | Offline-First (Our App) |
|-----------------|-------------------------|
| API call → Update UI | Save locally → Update UI → Queue sync |
| Network errors = app broken | Network errors = invisible to user |
| Data loss risk when offline | Data integrity guaranteed |
| Optimistic UI as feature | Optimistic UI as default |

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│  Mobile App (Offline-First)                 │
│                                             │
│  ┌───────────────────────────────┐          │
│  │  React Native UI              │          │
│  │  (withObservables)            │          │
│  └───────────────────────────────┘          │
│             ↓ ↑                              │
│  ┌───────────────────────────────┐          │
│  │  WatermelonDB (Local SQLite)  │          │
│  │  - Source of truth for UI     │          │
│  │  - Reactive observables       │          │
│  │  - No security enforcement    │          │
│  └───────────────────────────────┘          │
│             ↓                                │
│  ┌───────────────────────────────┐          │
│  │  SupabaseSyncService          │  ◄── Sync Boundary
│  │  - JWT authentication         │          │
│  │  - Bi-directional sync        │          │
│  └───────────────────────────────┘          │
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

---

## WatermelonDB Schema

**Location:** `src/database/schema.ts` (auto-generated, version 185, 15 tables)

### Key Tables

**projects** — project data:
```typescript
tableSchema({
  name: 'projects',
  columns: [
    { name: 'name', type: 'string' },
    { name: 'description', type: 'string', isOptional: true },
    { name: 'organisation_id', type: 'string', isIndexed: true },
    { name: 'is_active', type: 'boolean' },
    { name: 'created_by', type: 'string' },
    { name: 'modified_by', type: 'string' },
    { name: 'created_at', type: 'number' },   // Unix timestamp
    { name: 'updated_at', type: 'number' },
    { name: 'deleted_at', type: 'number' },
    { name: '_version', type: 'number' },      // Sync tracking
    { name: '_custom_sync_status', type: 'string', isOptional: true },
  ]
})
```

**user_roles** — permissions (replaces legacy `project_members`):
```typescript
tableSchema({
  name: 'user_roles',
  columns: [
    { name: 'user_id', type: 'string', isIndexed: true },
    { name: 'role', type: 'string' },        // 'ww_admin', 'project_admin', 'project_member'
    { name: 'scope_type', type: 'string' },  // 'global', 'organisation', 'project'
    { name: 'scope_id', type: 'string', isOptional: true, isIndexed: true },
    { name: 'granted_by', type: 'string' },
    { name: 'is_active', type: 'boolean' },
    // ... timestamps
  ]
})
```

**sync_outbox** — queued offline operations:
```typescript
tableSchema({
  name: 'sync_outbox',
  columns: [
    { name: 'operation_id', type: 'string', isIndexed: true },
    { name: 'table_name', type: 'string' },
    { name: 'record_id', type: 'string' },
    { name: 'operation_type', type: 'string' },  // CREATE, UPDATE, DELETE
    { name: 'payload', type: 'string' },          // JSON
    { name: 'status', type: 'string', isIndexed: true },  // pending, syncing, synced, failed
    { name: 'retry_count', type: 'number' },
    { name: 'error_message', type: 'string', isOptional: true },
    { name: 'created_at', type: 'number' },
  ]
})
```

For the complete list of 15 tables, see [01-TECHNOLOGY-STACK.md](./01-TECHNOLOGY-STACK.md#watermelondb).

---

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
4. **Result**: ✅ Allowed → synced | ❌ Denied → stays local, error logged

### Offline Security Example

```typescript
// Step 1: Local write (NO security check — by design)
await database.write(async () => {
    await projects.create(p => {
        p.name = "My Project"
        p.organisation_id = "other-org-id"  // ← User doesn't belong to this org!
    })
})
// ✅ Succeeds locally — UI updates immediately

// Step 2: Sync to server (RLS ENFORCES)
// ❌ RLS blocks: "new row violates row-level security policy"
// Error logged to sync_outbox, data never reaches server
```

### Security Best Practices

```typescript
// ❌ BAD: Client-side security
if (user.role === 'admin') {
    await deleteProject()  // Attacker can bypass this
}

// ✅ GOOD: Client-side UX only
if (user.role === 'admin') {
    showAdminUI()  // Better UX — server still enforces via RLS
}
```

---

## SupabaseSyncService

**Location:** `src/services/offline/SupabaseSyncService.ts` (~1325 lines)

### Core Sync Logic

```typescript
async sync(): Promise<void> {
  if (this.isSyncing) return
  this.isSyncing = true

  try {
    await this.uploadOutbox()         // Push local changes
    await this.pullRemoteChanges()    // Pull reference data
    await this.syncUserRoles()        // Pull roles
    await this.syncDevices()          // Pull devices
    // ... more entity syncs

    await SyncStateService.set(SYNC_STATE_KEYS.LAST_SYNCED_AT, Date.now().toString())
  } catch (error) {
    await SyncStateService.set(SYNC_STATE_KEYS.LAST_SYNC_ERROR, error.message)
  } finally {
    this.isSyncing = false
  }
}
```

Sync is debounced (2s) and tracks per-entity status via `syncSlice` in Redux. See the full sync method table in [01-TECHNOLOGY-STACK.md](./01-TECHNOLOGY-STACK.md#sync-architecture).

### Push (Outbox Upload)

```typescript
private async uploadOutbox() {
  const pendingOps = await database
    .get<SyncOutbox>('sync_outbox')
    .query(Q.where('status', 'pending'))
    .fetch()

  if (pendingOps.length === 0) return

  // Group by table and operation type, then push via RPC
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('push_changes', { changes })
  // Mark operations as synced or failed
}
```

### Pull

```typescript
private async pullRemoteChanges() {
  const lastPulledAt = await SyncStateService.get(SYNC_STATE_KEYS.LAST_PULL_TIMESTAMP)
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('pull_changes', {
    last_pulled_at: lastPulledAt || 0
  })
  // Apply changes to local database
  // RLS has already filtered to allowed data only
}
```

### Retry Logic

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1s |
| 3 | 2s |
| 4 | 4s |
| 5 | 8s |
| 6+ | Failed — requires manual intervention |

---

## Conflict Resolution

**Strategy: Last Write Wins** — compares `updated_at` timestamps.

Conflicts occur when the same record is modified both locally (offline) and on the server (by another user) before sync runs.

```typescript
async resolveConflict(localRecord, serverRecord) {
  if (serverRecord.updated_at > localRecord.updated_at) {
    return serverRecord   // Server wins — update local
  } else {
    return localRecord    // Local wins — push to server
  }
}
```

---

## Practical Example: Complete Offline Flow

**Scenario:** User creates a project in airplane mode

```typescript
// 1. Component calls service
await ProjectService.createProject({ name: "Kea Monitoring", ... })

// 2. Service writes to WatermelonDB
await database.write(async () => {
  await projectsCollection.create(project => {
    project.name = input.name
    project.organisation_id = currentUser.organisation_id
  })
})
// → UI updates automatically via withObservables
// → sync_outbox entry created

// 3. User lands, network returns
// → OfflineService detects connectivity
// → SupabaseSyncService.sync() triggers
// → Outbox pushes to Supabase
// → RLS validates, server confirms
// → Local record updated with server timestamps
```

---

## Best Practices

**DO:**
- ✅ Save to WatermelonDB before any API call
- ✅ Update UI optimistically
- ✅ Handle sync failures gracefully
- ✅ Test offline scenarios thoroughly
- ✅ Show sync status to users

**DON'T:**
- ❌ Rely on network availability
- ❌ Skip local persistence
- ❌ Ignore conflict scenarios
- ❌ Trust client-side security checks
- ❌ Show raw network errors to users

---

## Debugging

### Check Sync Status
```typescript
const lastSync = await SyncStateService.get(SYNC_STATE_KEYS.LAST_SYNCED_AT)
const lastError = await SyncStateService.get(SYNC_STATE_KEYS.LAST_SYNC_ERROR)
```

### Inspect Outbox
```typescript
const pendingOps = await database
  .get('sync_outbox')
  .query(Q.where('status', 'pending'))
  .fetch()
console.log('Pending operations:', pendingOps.length)
```

### View Local Data
```typescript
const projects = await database.get('projects').query().fetch()
console.log('Local projects:', projects.map(p => p.name))
```

### Dev Database Reset

A development-only utility resets the local WatermelonDB when testing with fresh seed data or after backend migrations.

> [!WARNING]
> Only available when `__DEV__ === true`. Throws in production builds.

**Use cases:** New seed data deployed, testing multi-tenancy, database corruption, post-migration clean slate.

```typescript
import { resetDatabaseForDev } from '@/utils/devDatabaseReset';

// Drops all data + schema, recreates from scratch
await resetDatabaseForDev();
```

This calls `database.unsafeResetDatabase()` internally. After reset:
1. Restart the app
2. Log out → log back in to trigger a fresh initial sync

The reset is also available from the **Database Dev Tools** UI section (`DatabaseDevToolsSection.tsx`).

**Source:** `src/utils/devDatabaseReset.ts`

---

## Schema Drift Prevention

The project uses a **5-layer defence strategy** to prevent the mobile WatermelonDB schema from drifting from the backend Supabase schema:

1. **Backend Pre-Commit** — blocks commits if types aren't regenerated
2. **Coordination Messages** — manual notifications from backend devs
3. **Mobile Inbox Check** — daily manual check by mobile devs
4. **Mobile Pre-Commit** — blocks commits if types don't match schema
5. **GitHub Actions** — blocks PRs if types are out of sync

### Schema Change Workflow

```bash
# 1. Regenerate types
npm run types:cloud-dev

# 2. Validate schema
npm run schema:validate:live:cloud-dev

# 3. Fix mismatches in src/database/schema.ts
# 4. Increment version number (currently 185)
# 5. Add migration in src/database/migrations.ts (or database reset for dev)
```

> [!WARNING]
> **Never make schema changes directly in this repo.** All schema changes originate from the `wildlife-watcher-backend` repository. See the README for the full database workflow.

---

## Security Checklist

- ✅ All Supabase requests include JWT authentication
- ✅ RLS policies enabled on all tables
- ✅ Sync errors logged and surfaced to user
- ✅ Organisation filtering in sync queries
- ⚠️ Client-side validation for UX (not security)
- ❌ Local database has no security (by design)

**Key Takeaway:**
- **Local DB** = Optimistic cache for UI performance
- **Sync boundary** = Authentication (who you are)
- **Server** = Authorisation & validation (what you can do)

---

## 🚧 Guardrails for Future Development

Based on past architectural issues, adhere strictly to these operational guardrails:

### 1. The RLS "Offline Blindspot"
**Trigger:** Writing UI that displays aggregated numbers or cross-user data (e.g. "Total Members", "Pending Global Invitations").
**Guardrail:** Never rely on a local WatermelonDB `.fetchCount()` or `.fetch()` for data relating to other users. RLS physically prevents the mobile app from downloading records the current user doesn't own (like another user's `user_roles`).
**Solution:** Use a **"Network-First, Fallback to Local"** strategy via RTK Query (`projectsApi.ts`) or `Supabase.rpc()`. Fetch the authoritative data directly from the cloud when online, and gracefully degrade to the local WatermelonDB estimate when completely offline.

### 2. Silent RPC Parameter Drift
**Trigger:** Modifying a backend database function (`.sql` migration) that changes the parameters.
**Guardrail:** The Supabase JavaScript client does not fail at compile-time when calling `.rpc()` with outdated runtime arguments. If an argument is dropped on the server, the mobile app will receive a generic "function does not exist" error, leading to obscure fallback behavior.
**Solution:** Always run `npm run types:cloud-dev` after backend schema changes, and manually search the `src/services/` directory for any hardcoded `.rpc('your_function', { ... })` calls to verify the parameter signatures match precisely.

### 3. Sync Performance vs. Data Leaks
**Trigger:** Building or modifying the `pull_changes` sync function.
**Guardrail:** Do not use repeated subqueries or generic `EXISTS(SELECT 1 FROM user_roles...)` inline checks directly within the massive JSON aggregation blocks. It destroys horizontal scaling performance. Furthermore, do not define wide open `SECURITY DEFINER` queries without explicitly scoping data to the calling user limit, or you will leak data (e.g. users seeing deployments for projects they aren't members of).
**Solution:** Pre-compute the user's accessible scope IDs natively up front via PostgreSQL arrays (e.g. `array_agg(scope_id)`), store them in local variables (`_project_ids`, `_org_ids`), and perform rapid array intersection checks (`project_id = ANY(_project_ids)`) in the body JSON payloads.

---

## Next Steps

1. [02-CODEBASE-GUIDE.md](./02-CODEBASE-GUIDE.md) — Where the offline code lives
2. [05-DEVICE-FLOWS.md](./05-DEVICE-FLOWS.md) — Device deployment lifecycle
3. [01-TECHNOLOGY-STACK.md](./01-TECHNOLOGY-STACK.md) — Complete dependency and sync service reference

## Resources

- [WatermelonDB Documentation](https://watermelondb.dev/docs)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)

---

*Last Updated: May 16, 2026*
