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

**Location:** [`src/database/schema.ts`](../../src/database/schema.ts) — auto-generated. The `version:` field and the `tableSchema` entries in that file are authoritative; this doc deliberately does not restate them.

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
    { name: 'role', type: 'string' },        // 'ww_admin', 'organisation_manager', 'organisation_member', 'project_admin', 'project_member', 'project_viewer'
    { name: 'scope_type', type: 'string' },  // 'system', 'organisation', 'project'
    { name: 'scope_id', type: 'string', isOptional: true, isIndexed: true },
    { name: 'granted_by', type: 'string' },
    { name: 'is_active', type: 'boolean' },
    // ... timestamps
  ]
})
```

Which projects, devices and deployments a user sees on the phone follows the backend's role
rules, in `services/roleAccess.ts` (#351): `ww_admin` is system scope and sees everything, an
`organisation_manager` sees every project of its organisation, and project roles cover their
own project only. Sync already sends only what the account may read; the local rule keeps
another account's unsynced rows out of view on a shared phone.

A project created on the phone also gets a local `project_admin` row for its creator, written
by `ProjectService.createProject` in the same batch as the project. It mirrors ww-backend's
`on_project_created` trigger, so the creator is the project's admin offline as well. It is
never queued for upload; when the server's own row arrives, `syncUserRoles` updates the local
row in place, since it matches roles by user and scope rather than by id.

The sync only ever brings the signed-in user's own `user_roles` rows, because the table's
select policy is own-row-only, and `public.users` gives no one else's profile. Other members of
a project reach `user_roles` and `users` one way: `fetchMembersFromCloud` writes each
`get_project_members` answer there, so the member list, and the member counts on the project
cards, work offline for any project whose members were seen online (#307). The cache is only as
fresh as that last view. Offline, the Members screen shows what the phone has, at least the
current user, and raises no Alert; the offline banner is the one offline signal. Invitations
are made on the server, so offline the Invite card says it needs a connection and sends
nothing, and nothing is queued. An admin cancels a pending invitation from the same screen
(`cancel_project_invitation`, #364), which is server-only in the same way.

Changing a member's role and removing a member are server actions too (#335).
`UserRoleService` calls `update_project_member_role` and `remove_project_member`, which check
that the caller is a project admin and is the signed-in user, and refuse the last admin's
removal or demotion. The app never writes `user_roles`: RLS refused the insert and the update,
and turned an unauthorised delete into "0 rows", which the app once reported as a removal, and
ww-backend #219 has since revoked the table's write grants from `authenticated`. A refusal is
shown with its reason, a success reloads the list from `get_project_members`, and offline both
say they need a connection and send nothing.

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
    { name: 'status', type: 'string', isIndexed: true },  // pending, syncing, synced, failed, orphaned
    { name: 'retry_count', type: 'number' },
    { name: 'error_message', type: 'string', isOptional: true },
    { name: 'created_at', type: 'number' },
  ]
})
```

For the complete table list, read [`src/database/schema.ts`](../../src/database/schema.ts) directly.

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
        AND scope_type IN ('system', 'organisation')
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

**Location:** `src/services/SupabaseSyncService.ts`

### Core Sync Logic

```typescript
async sync(): Promise<void> {
  if (this.isSyncing) {
    this.syncAgain = true             // one more when this one ends
    return
  }
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
    this.syncAgainIfAsked()
  }
}
```

Sync tracks per-entity status via `syncSlice` in Redux. See the full sync method table in [01-TECHNOLOGY-STACK.md](./01-TECHNOLOGY-STACK.md#sync-architecture).

### When the outbox is pushed

Nothing pushes on a timer. A sync runs when:

- the app starts with a signed-in user, or someone signs in (`AppSetupProvider`);
- the connection comes back and stays for 3 s (`connectivityWatch.ts`, `reconnectSync.ts`);
- a deployment is started or ended on the phone, at once: `DeploymentService.createDeployment`
  and `endDeployment` call `SupabaseSyncService.requestSync()`, so Start Monitoring, the Dev
  Deployment Test, End Deployment and Stop Monitoring all send it while the app is open;
- 2 s after a project is made or edited, a site photo is uploaded, or a realtime change arrives
  from the server (`debouncedSync()`);
- the Projects list is pulled to refresh, the organisation is switched, or an invitation is
  accepted.

A sync asked for while one is running is not dropped (8 October 2026). The running one read the
outbox before the new change was queued, so it syncs once more when it ends: one more, however
many asked. Before, a deployment started during a sync waited for the next trigger while its
camera stamped photos with an id the website did not have. A sync turned away by the in-progress
flag a killed run left behind runs once `resetSyncState` clears the flag at start-up. Offline, a
request does nothing, and the reconnect sync uploads the change.

A push that does not complete no longer skips the pull (#287). The pulls run, the initial sync
is marked complete, and only then is the push error thrown, so one refused change cannot stop
the phone seeing anything new from the cloud.

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

The outbox is uploaded in a fixed foreign-key order — `projects`, then `devices`, then `deployments` — so a parent row always lands before the child that references it. Because of this, `DeploymentService.createDeployment` queues an idempotent device `CREATE` alongside the deployment (the server's devices insert is `ON CONFLICT DO NOTHING`), guaranteeing the device is in the same push and reaches the server first. Without it, a deployment whose device was never synced fails with `23503` (foreign key) and only a self-healing retry in `SupabaseSyncService` recovers it a cycle later, which the operator sees as a transient sync error (#294). A bare "touch" of the device to trigger UI reactivity records no outbox operation, so it does not count.

**When the server refuses part of a push (#287).** Each table is still one `push_changes` call,
but a refused table no longer stops the ones after it:

- `push_changes` applies a call all or nothing, so when the server refuses a call with more than
  one record, the table is retried one record at a time and the refusal stays with its own row.
- A deployment waits only when a lookup shows the server does not have its parent. Every
  deployment's project is looked up, since a project can vanish from the server on its own
  (#330); a device only when its own change failed in this sync. Every other deployment goes
  ahead. A waiting deployment goes back to `pending` with the reason in `error_message`.
- `push_changes` reports each row it did not write as `{id, reason: 'not_applied'}` in
  `conflicts`. For a `CREATE` that means the server already has the row, so it counts as saved.
  For an `UPDATE` or `DELETE` the change did not land (the row is missing, or row-level security
  would not let this account change it), so the operation stays `failed` and queued rather than
  being marked `synced`.
- Operations found in `syncing` at the start of a push were stranded by a sync that was cut
  short, and are pushed again.
- The error names each table and why, for example `Push incomplete. projects: 1 saved; devices:
  1 refused by the server (42501 new row violates row-level security policy for table
  "devices"); deployments: 1 saved, 1 waiting for their project or device to reach the server`.
  It lands in the app log and in `LAST_SYNC_ERROR`.

**Another account on the same phone (#267).** The outbox has one queue for the phone. An
operation recorded by a different account than the one syncing (its `user_id`) is held, not
pushed: pushing it would write it under this session with the audit fields rewritten to this
user. It goes out the next time its own account syncs on this phone. A device `CREATE` is the
exception, because it registers the camera rather than anyone's work, and this account may be
deploying that camera.

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

Every pull is incremental from a "last pulled at" watermark in `sync_state`, one per table, and
there is one set for the phone, not one per account. `LAST_SYNC_USER_ID` records whose they
are. When a different account syncs, `resetWatermarksOnUserChange` clears them so its first pull
is a full one (#267); before that, a second account only asked for rows changed after the first
account's last sync and never received its own older roles, so its Projects tab was empty. Rows
already on the phone are kept, and signing out also resets `syncSlice`, so the scanner waits for
the new account's own first sync.

**A record with a change still to push keeps its local copy (#349).** The project, device and
deployment pulls skip any row whose record has an outbox operation not yet on the server
(pending, failed or being sent), and log `Kept the local deployment ...`. The server's row is
older than that change; applying it once put a deployment's local photo path back over the
uploaded one, and the next upload dropped the photo (#347). The record is pulled again after the
push.

**A project that disappears from the server (#330).** An incremental pull never sees a row that
no longer exists, so a project deleted on the website, wiped by a Dev database reset, or taken
away by removing the account from it used to stay on the phone for good, and every deployment
made on it was refused on each sync. After a project pull that completed, `reconcileProjects`
reads the full list of project ids the server gives this account (`projects_with_stats`, not
soft-deleted, with an exact count) and compares the phone with it:

- A project missing from that list, with no `CREATE` queued or in flight, is gone. Its row,
  its synced deployments and every role scoped to it are removed.
- Nothing not yet uploaded is destroyed. A deployment with an unsynced change, or a photo still
  only on the phone, keeps its row. This account's queued operations for the project become
  `orphaned`: never retried, and `error_message` names the project. `OutboxService` exposes them
  (`getOrphanedOperations`, and `getStatistics().orphaned`) for a screen to show later.
  Another account's held operations are left for that account.
- It does nothing when the read fails, when the list is shorter than its own count, or when it
  would remove every project on the phone, which reads as a bad answer rather than deletions.
- If a project comes back, its orphaned operations return to `pending`. If the server lists a
  project the phone has never pulled, the project, role and deployment watermarks are cleared so
  the next sync pulls them in full.

The push side uses the same lookup: a deployment whose project the server does not have waits
instead of being refused, and the reconcile then orphans it.

A project edit queues only the fields it changed (`ProjectService.updateProject`), and
`push_changes` keeps any column the payload leaves out. Before #330 the edit sent the whole
record, so a phone holding a stale copy put back the old value of every field it had not
touched, over a newer change made on the website. Deployment updates still send the whole
record.

> [!WARNING]
> **Both directions name their columns by hand, and both have dropped some.** `syncProjects`
> assigns each field of a project row one line at a time, and ww-backend's `push_changes` lists
> the columns it accepts in an `INSERT` and an `UPDATE`. A column missing from either list is
> not an error: the pull leaves the local record at its model default, and the push writes the
> row without that value and still reports success. `lorawan_required`, `record_gps_in_images`
> and `is_archived` were missing from both for months (#285, ww-backend #170), so a project set
> to record GPS on the website deployed with GPS zeroed and nothing said why. When you add a
> column, add it to both lists in the same change, and check the round trip rather than the
> save dialog.

### Retry Logic

There is no backoff and no retry limit. Every sync pushes every `pending` and `failed`
operation of the signed-in account again, and `retry_count` only counts attempts. A change the server refuses keeps
being retried, which is what lets it go through by itself once the server side is fixed, and
it only holds back the deployments that depend on it. The exception is an `orphaned` operation,
whose project the server no longer has for this account: it is kept but not retried (#330).

---

## Files for the field

Rows sync; files do not. A deployment needs its AI model's `.TFL` and labels, and a firmware
update needs its image, and until #333 both were fetched only at the moment of use. The first
deployment of a model somewhere without signal went out without it.

`OfflinePrefetchService` (`src/services/OfflinePrefetchService.ts`) fetches them ahead. It runs
after each successful `SupabaseSyncService.sync()` and after each `syncReferenceData()`, one
file at a time, in the background:

| What | Which | Cache |
|------|-------|-------|
| AI models | The model of every active project in the local database, which holds what RLS let this user sync. Skips a model not in the reference data or without firmware IDs, since the deployment refuses those anyway (#290) | `documentDirectory/aimodels/`, through `AiModelService.ensureFilesDownloaded` |
| Firmware | The latest BLE image, and the latest Himax image per camera variant (RP3, HM0360): the images the update screen flashes. Older images of a variant are deleted once its new one is complete, never while an update holds the cache | `documentDirectory/firmware/`, through `FirmwareService.ensureFirmwareDownloaded` |

- **Nothing runs offline**, and nothing on mobile data when Settings says "Sync on Wi-Fi only"
  or "Ask before syncing". In the default automatic mode it uses mobile data too. For scale,
  the rat model is 73 KB, the person model 920 KB and a Himax image about 450 KB, and each is
  fetched once.
- **A file already there is not fetched again.** The check is the one the consumer makes: the
  binary's size for a model (labels by presence), the size within 100 bytes for firmware.
  Model files are written to a `.part` name and moved into place, so a file under its final
  name is always whole.
- **Failures are quiet.** A warning in the log, and the next sync tries again.
- **It only downloads.** It never starts a firmware update; `useFirmwareUpdate` finds the file
  in the cache and flashes it without a connection.

The screens say what is on the phone: Start Monitoring and the Dev Deployment Test show whether
the project's model is ready, and the firmware update screen shows "On this phone" in its
pre-flight card. Offline, `syncAiModel` stops a deployment whose model is on neither the camera
nor its card and not on the phone, before anything is written to the camera.

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
// → AppSetupProvider's connectivity watch (connectivityWatch.ts) sees it
// → after 3 s of connection, once the session is valid, reconnectSync.ts
//   runs SupabaseSyncService.sync() (one per reconnect, never two at once)
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

# 2. Regenerate src/database/schema.ts; `version:` moves only if a table changed
npm run schema:generate

# 3. Validate schema
npm run schema:validate:live:cloud-dev

# 4. Add the new columns to the model, the pull in SupabaseSyncService and the push payload
```

There are no migrations. The adapter in `src/database/index.ts` configures none on purpose,
so a version change resets the local database and the next sync pulls everything again.
Anything still in the outbox is lost with it, so sync before installing such a build.

### What the validator actually checks, and what it cannot

Ground-truthed on 5 September 2026 against `qegeovogqxiouqbrxmnh` (Dev_Wildlife_Watcher).
Read this before trusting a green run.

The counts below come from a branch whose `database.types.ts` was current. Run it on a
branch whose types are stale and it stops at step 1 instead, which is the tool doing its
job: on `dev` that day it refused to go further because the live database had the four
`projects` flash columns and the committed types did not.

**It compared nothing at all until that date.** `parseSupabaseTypes` used a regex to find the
`Tables` block, and a regex cannot match balanced braces more than one level deep. Against a
real generated types file it captured nothing, found **zero** tables, downgraded every
WatermelonDB table to a *warning* ("exists in WatermelonDB but not in Supabase types"), and
then reported `✅ Schema validation PASSED (with warnings)` because there were no errors. A
validator that passes vacuously is worse than one that fails, because layer 4 of the defence
above reads as green while checking nothing. It now walks the braces explicitly and finds 43
tables.

**A reported difference is not automatically a bug.** The first honest run found 83, and the
shape matters more than the number:

| Column | Count | What it is |
|---|---|---|
| `modified_by`, `deleted_at`, `updated_at`, `created_at` | 76 | audit columns the app defines on tables that genuinely lack them in Supabase (verified: `account_deletion_requests` has none of the three) |
| `deployment_comments`, `camera_location_description`, `camera_location_image_path` | 3 | **legacy**, and labelled as such in `models/Deployment.ts`. The backend split the first into `start_`/`end_deployment_comments` and pluralised the third to `camera_location_image_paths`; the app uses the new names everywhere |
| `remote_id` on `project_invitations` | 1 | confirmed absent upstream. An empty table defeats reading columns from a row, so ask for the one column: `GET /rest/v1/<table>?select=<column>&limit=1` returns 400 when it does not exist, and 200 when it does |

So the validator cannot tell deliberate legacy from real drift, and never will be able to.
Treat its output as a list to explain, not a list to fix.

**Two traps that stop it running at all on Windows.** `check-types-cloud.ps1` must be saved as
**UTF-8 with a BOM**: it contains emoji, and Windows PowerShell 5.1 reads a BOM-less `.ps1` as
ANSI, then fails to tokenise and reports a syntax error on an innocent line. And if
PowerShell's execution policy blocks `npx.ps1`, use `npx.cmd` rather than changing the policy.

**The environment label is not the project ref.** `validate-watermelon-schema-live.js` takes
the ref from `EXPO_PUBLIC_SUPABASE_URL` in `.env.development` at runtime. Its `cloud-dev`
description used to hardcode `nuhwmubvygxyddkycmpa`, which is Stag_Wildlife_Watcher, while
validating against dev all along. Confirmed with `npx supabase projects list`: dev is
`qegeovogqxiouqbrxmnh`, staging is `nuhwmubvygxyddkycmpa`.

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
