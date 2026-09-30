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
  local query. Fetch it from the cloud and degrade gracefully offline.
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
- **A deployment must carry its device with it.** The push order, `projects`, `devices`,
  `deployments`, is a foreign-key order, and `DeploymentService.createDeployment` queues an
  idempotent device CREATE alongside the deployment, since the server's devices insert is
  `ON CONFLICT DO NOTHING`, so the device row always reaches the server first. Without it the
  first push fails `23503` and only a self-healing retry recovers it a cycle later, which the
  operator sees as a sync error (#294). A bare "touch" to trigger reactivity is not a sync
  operation.

## Schema version, only moves on a real change

`scripts/generate-watermelon-schema.js` compares the generated table definitions against the
existing file, with line endings normalised and the version line ignored, and **only increments
`version:` when the tables actually differ**. An unchanged schema is not rewritten, so
`npm run android` leaves no diff.

Until August 2026 it incremented on *every* run, making the number a build counter. It reached
402 without 402 schema changes. Hence two habits: docs point at `schema.ts` rather than quoting
a number, and any version below about 402 in an older document means nothing.

- **Never hand-edit the version downwards.** WatermelonDB migrates on a version increase; a
  number lower than the on-device database triggers a reset. If you want to discard a bump,
  make sure no device has already run that build.
- When the version *does* increase, add the matching migration in `src/database/migrations.ts`.
  The generator prints a reminder.
- Line endings matter here: git restores `schema.ts` as CRLF on Windows while the generator
  emits LF, so any comparison against it must normalise first.

## The schema is generated, not written

`src/database/schema.ts` comes from `npm run schema:generate`, and schema changes originate in
`wildlife-watcher-backend`. `src/types/database.types.ts` comes from `types:cloud-dev`. Neither
is hand-edited.
