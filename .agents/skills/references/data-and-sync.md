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
- **Reference sync must pull both `validated` and `deployed` models.** `ReferenceDataService`
  filters `ai_models` to `status = 'validated'` only, but the backend contract, in ww-backend's
  `MOBILE_INTEGRATION_GUIDE.md`, is `status IN ('validated','deployed')`. `deployed` means in
  use on a device, the opposite of stale. A project pointing at a `deployed` model then cannot
  be deployed from the app and the model never appears in the picker; the camera runs with no
  model and only the Himax console says so. Filed as #290.
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
