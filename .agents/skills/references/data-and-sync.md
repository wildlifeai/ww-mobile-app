# Data and sync

#### File: .agents/skills/references/data-and-sync.md
#### Author: Claude, with Victor Anton
#### 19 September 2026

Local database, the outbox, and the rules that keep offline behaviour honest. The guided
version for humans is
[03-DATA-AND-SYNC.md](../../../documentation/onboarding/03-DATA-AND-SYNC.md).

## Rules

- **Redux holds no domain data.** Projects, deployments and devices live in WatermelonDB and
  reach the UI through `withObservables`. Redux is session and UI state only.
- **The RLS blindspot.** A local query only ever sees what the current user was allowed to
  sync. Never compute a cross-user aggregate, such as member counts or global lists, from a
  local query. Fetch it from the cloud and degrade gracefully offline. The project member list
  is the one sanctioned cache: `fetchMembersFromCloud` writes each `get_project_members` answer
  into the local `users` and `user_roles` tables, other people's rows only, and removes roles
  the server no longer lists (#307). The sync never brings those rows, since `user_roles` is
  own-row-only and `public.users` gives out no one else's profile, so do not "fix" them from
  the sync.
- **A project made on the phone makes its creator its admin on the phone too.** On the server
  the `on_project_created` trigger grants `project_admin`; offline nothing did, so every role
  check treated the creator as a stranger to their own project until a sync.
  `ProjectService.createProject` now writes that role row in the same batch as the project. It
  is never queued (the server makes its own, and `user_roles` writes from the app are refused
  by RLS), and `syncUserRoles` later updates it in place, because it matches a role by id and
  then by role and scope. Keep that matching, or the pull will duplicate the row.
- **The role pull reads all of this account's live roles on every sync (#375).** The select
  policy hides soft-deleted rows, so a role taken away, or the lower of two roles in one scope
  that ww-backend #248 soft-deleted, never shows in `updated_at > watermark`; it only shows as
  absence. So `syncUserRoles` has no watermark: it matches each server row by id, then by role
  plus scope, with a system role's NULL scope matching NULL, and removes this account's other
  local roles. The old lookup asked for `scope_id = ''` and left out the role, so every full
  pull added a copy of a system role and two roles in one scope shared a row. It keeps the
  creator's role while the project's `CREATE` is queued, keeps everything when the server lists
  no roles, and never touches another account's rows (the member cache, an earlier sign-in).
- **Server-only actions say so offline, they are not queued.** Invitations are made by
  `send_project_invitation`, so the Invite card tells the user it needs a connection instead of
  calling. Role changes and removals are the same (#335): `UserRoleService` asks
  `isKnownOffline()` before `update_project_member_role` or `remove_project_member` and sends
  nothing offline. Google sign-in too (#350): `signInWithGoogle` asks before it opens Google's
  sheet. The Members screen offline shows what the phone has (you, plus the member
  cache) and raises no Alert: the offline banner is the one offline signal. Screens that read
  `user.profile` must allow it to be undefined, since it comes from the cloud.
- **Never write `user_roles` from the app** (#335). RLS refused the insert and the update, and
  turned an unauthorised delete into "0 rows" with no error, which the app reported as a
  removal while the person kept full access. ww-backend #219 has since revoked every write
  grant on the table from `authenticated`. Members are added by invitation and changed or
  removed through the RPCs, and a reply that is not `{ success: true }` is not a change.
- **Never look an account up by email.** Invite through `send_project_invitation`
  (`InvitationService.sendInvitation`), lower-casing the address, and show the same message
  whatever the address. A `public.users` lookup tells the caller whether an account exists
  (#308), and cannot invite someone who has not signed up.
- Writes go to WatermelonDB first and the outbox syncs them. Never block the UI on network.
- **Security lives at the sync boundary, not on the client.** Role checks in the app are user
  experience; Supabase row level security is the enforcement. Never treat a local query as
  authoritative for data belonging to other users.
- **Reference sync must pull both `validated` and `deployed` models.** The backend contract, in
  ww-backend's `MOBILE_INTEGRATION_GUIDE.md`, is `status IN ('validated','deployed')`, and
  `deployed` means in use on a device, the opposite of stale. `ReferenceDataService` pulled
  `validated` alone until #290, so a project pointing at a `deployed` model started monitoring
  with no model and only the Himax console said so. Two halves keep it closed: the pull asks for
  both, and `syncAiModel` refuses a project model it cannot resolve, before the deployment is
  created or anything is written to the device. `aiModelsApi.ts` (the picker) still asks for
  `validated` only.
- **Offline, the user stays signed in until the server says no** (#310). The app opens from
  the session auth-js keeps on disk, and a missing session with that one still stored means the
  refresh could not get through: auth-js removes it only on a real rejection. Never read "no
  session" from `getSession()` as signed out, and never ask auth-js who the user is for a local
  read (`getStoredUserId()` instead): offline with an expired token it spends about 26 s
  retrying the refresh and then answers null. Supabase calls never carry an expired token, and
  the sync checks the user with the server before it uploads, so nothing writes offline.
- **Organisations come from the local tables first, then the cloud** (#332).
  `organisationMembership.ts` builds them from `user_roles` and `organisations`; the cloud answer
  replaces them, and an empty cloud answer is the server's truth. `organisations` is filled only
  by that cloud answer, nothing else writes it. The current organisation is remembered per user
  and reopened while the roles allow it.
- **Work queued offline uploads on reconnect.** `OfflineService` has a listener for that but is
  never initialised, which left a deployment in the outbox until the next sign-in. The trigger
  is `connectivityWatch.ts` and `reconnectSync.ts`, wired in `AppSetupProvider`: 3 s of connection,
  a valid session, one sync. Redux `network.isOnline` stays false throughout, so read NetInfo, as
  `SupabaseSyncService.sync()` does.
- **Offline is not an error.** The "Offline Mode" banner, rendered once by `OfflineAwareRoot`, is
  the only sign. Cloud calls that fail for network reasons log with `logCloudFailure`, not
  `logError`, and skip themselves when NetInfo reports no connection. supabase-js prints its own
  failures with `console.error`; `installNetworkErrorFilter` in `index.js` sends those to
  `console.log`.
- **Rows sync, files do not.** A model's `.TFL` and labels and a firmware image live in the
  phone's file caches (`aimodels/`, `firmware/`), filled after each sync by
  `OfflinePrefetchService` so a deployment or an update needs no signal (#333). Offline,
  `syncAiModel` stops a deployment whose model is on neither the camera nor the card and not
  in the cache, before anything is written. Ask "is it here" with
  `AiModelService.isDownloaded` or `FirmwareService.isFirmwareDownloaded`, the same checks the
  downloads make, and hold `FirmwareService.holdCache()` for the whole of anything that reads
  an image, or the pre-download may remove it as an older version. The two triggers, at the
  end of `SupabaseSyncService.sync` and `ReferenceDataService.syncReferenceData`, are lazy
  `require`s: Jest here rejects a dynamic `import()` (no VM modules flag), so a trigger written
  that way type-checks and never runs under test.
- **A site photo is uploaded, then its local file goes.** `DeploymentPhotoService` swaps each
  local path on the deployment for its bucket path after the upload, and runs one pass per
  deployment at a time, merged against the record at write time. A pull no longer puts the
  older row back over a record whose change is still in the outbox (#349), and a local path
  whose file is gone is still looked up in the bucket before it is dropped (#347).
- **A deployment must carry its device with it.** The push order, `projects`, `devices`,
  `deployments`, is a foreign-key order, and `DeploymentService.createDeployment` queues an
  idempotent device CREATE alongside the deployment, since the server's devices insert is
  `ON CONFLICT DO NOTHING`, so the device row always reaches the server first. Without it the
  first push fails `23503` and only a self-healing retry recovers it a cycle later, which the
  operator sees as a sync error (#294). A bare "touch" to trigger reactivity is not a sync
  operation.
- **A refused table must not stop the others (#287).** `uploadOutbox` pushes each table in
  that order but never breaks the chain: a refused multi-record call is retried record by
  record, and only a deployment whose parent the server does not have waits. Every
  deployment's project is looked up, not only one that failed in this sync (#330); a device
  only when its own change failed here. Keep it that way. The old `break` also left every later
  table in `syncing`, which nothing re-read, so those changes were stranded for good; `syncing`
  at the start of a push now means "cut short" and is resumed. A push error no longer skips the
  pull.
- **Incremental pulls never see a row disappear (#330).** A project deleted on the website,
  wiped by a Dev reset or taken away by removing the account from it never appears in
  `updated_at > watermark`, so `reconcileProjects`, run after a `syncProjects` that completed,
  compares the phone with the full list of project ids the server gives this account. A
  project missing there, with no `CREATE` queued or in flight, loses its row, its synced
  deployments and its roles. Anything not uploaded stays: a deployment with an unsynced change
  or a local photo keeps its row, and this account's queued operations become `orphaned`,
  never retried, with the project named in `error_message` (`OutboxService.getOrphanedOperations`,
  `getStatistics().orphaned`). Another account's held operations are not touched. It does
  nothing on a failed read, on a list shorter than its own count, or when it would remove every
  project on the phone. Orphaned operations go back to `pending` if the project reappears, and a
  server project the phone lacks clears the project and deployment watermarks for a full
  pull. There is still no screen for orphaned work.
- **A project edit sends only the fields it changed (#330).** The edit form passes every field,
  and a full record from a stale phone overwrote newer website values (Sinbad's model and GPS,
  29 September). `ProjectService.updateProject` diffs the record before and after and queues
  only the changed columns; `push_changes` keeps any column the payload leaves out. Deployment
  updates are still full records.
- **`push_changes` returns `conflicts` as an array of `{id, reason: 'not_applied'}`**, not a
  count. For an `UPDATE` or `DELETE` it means the change did not land (row missing, or RLS
  said no) and the operation stays `failed`; for a `CREATE` it means the row already exists.
  Until #287 the app read `data.conflicts > 0` and `conflict_details`, neither of which exists,
  and marked refused updates `synced`.
- **One phone, several accounts (#267).** Pull watermarks are one set per phone, owned by
  `LAST_SYNC_USER_ID`, and are cleared when another account syncs so its first pull is a full
  one. The outbox is one queue: an operation whose `user_id` is another account is held, not
  pushed under this session, except a device `CREATE`. Nothing local is deleted on sign-out,
  so the previous account's rows stay on the phone; whether to clear them, and whether the next
  account may upload the previous one's held work, are open product questions.

## Schema version, only moves on a real change

`scripts/generate-watermelon-schema.js` compares the generated table definitions against the
existing file, with line endings normalised and the version line ignored, and **only increments
`version:` when the tables actually differ**. An unchanged schema is not rewritten, so
`npm run android` leaves no diff.

Until August 2026 it incremented on *every* run, making the number a build counter. It reached
402 without 402 schema changes. Hence two habits: docs point at `schema.ts` rather than quoting
a number, and any version below about 402 in an older document means nothing.

- **There are no migrations, so any version change resets the local database.** The adapter
  in `src/database/index.ts` configures none on purpose: the database is a sync cache, and
  after the reset the next sync pulls everything again, new columns included, because
  `SupabaseSyncService.resetSyncState` finds `last_pull_timestamp` gone from the database and
  clears every sync state cached in AsyncStorage. An incremental pull would not: a backend
  column added with a default does not move `updated_at`, so existing rows would keep
  WatermelonDB's 0 until something else changed them. The cost is the outbox, lost with the
  rest, so sync before installing a build that bumps it. Schema 403 to 404 (#317) and 404 to
  405 (#342), both on 1 October 2026, were two.
- **Never hand-edit the version downwards, or reuse a number.** A device whose database
  already carries that number is not reset and keeps the old table shape. If you want to
  discard a bump, make sure no device has already run that build.
- Line endings matter here: git restores `schema.ts` as CRLF on Windows while the generator
  emits LF, so any comparison against it must normalise first.

## The schema is generated, not written

`src/database/schema.ts` comes from `npm run schema:generate`, and schema changes originate in
`wildlife-watcher-backend`. `src/types/database.types.ts` comes from `types:cloud-dev`. Neither
is hand-edited.
