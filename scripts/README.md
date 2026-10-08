# Wildlife Watcher - Development Scripts

## Quick Reference

| Script | Purpose | Platform |
|--------|---------|----------|
| `sync-types-cloud.js` | Generate Supabase types from active `.env.development` | Cross-platform |
| `sync-db-schema.js` | Sync WatermelonDB schema from backend repo | Cross-platform |
| `generate-watermelon-schema.js` | Generate WatermelonDB schema from Supabase types | Cross-platform |
| `validate-build-env.js` | Validate Gradle + critical dependencies before EAS build | Cross-platform |
| `validate-deps.js` | Enforce dependency rules | Cross-platform |
| `validate-watermelon-schema.js` | Static WatermelonDB schema validation | Cross-platform |
| `validate-watermelon-schema-live.js` | Live schema comparison against Supabase | Cross-platform |
| `deps-cli.js` | Interactive dependency management CLI | Cross-platform |
| `post-install-helper.js` | Detect new packages after npm install | Cross-platform |
| `check-types-cloud.sh` / `.ps1` | Compare committed types against cloud DB | Bash / PowerShell |
| `check-types-local.sh` / `.ps1` | Compare committed types against local DB | Bash / PowerShell |
| `switch-supabase-instance.sh` | Switch Supabase CLI project link | Bash |
| `pre-build-check.sh` | Full pre-build validation (9 checks) | Bash |
| `pre-commit-hook.sh` | Git pre-commit hook | Bash |
| `test-integration-local.sh` | Run local integration tests | Bash |
| `install-maestro-wsl2.sh` | Install the Maestro CLI and JDK 17 in WSL2 | Bash (WSL2) |
| `ci-maestro.sh` | Run the Maestro flows on the CI emulator (install APK, Bluetooth on, junit report, final hierarchy, logcat) | Bash (CI) |
| `ci-maestro-output.sh` | Redact the E2E password and print Maestro's report, hierarchies and logs into the job log | Bash (CI) |
| `maestro-offline.sh` | Run the three offline Maestro phases, switching airplane mode and restoring Bluetooth between them | Bash |

## Environment Configuration

All scripts that interact with Supabase read the project ID **dynamically** from `.env.development`. You never need to hardcode project refs — just update your `.env.development` file:

```bash
# To use staging (current setup):
EXPO_PUBLIC_SUPABASE_URL=https://nuhwmubvygxyddkycmpa.supabase.co

# To switch back to dev, comment out staging and uncomment dev:
# EXPO_PUBLIC_SUPABASE_URL=https://qegeovogqxiouqbrxmnh.supabase.co
```

Then `npm run android`, `npm run types:cloud-dev`, etc. will all target the correct instance automatically.

## Pre-Build Validation

### `pre-build-check.sh`

**Purpose**: Fast static validation before running EAS builds to catch common issues early.

**Usage**:
```bash
# Direct execution
./scripts/pre-build-check.sh

# Via npm script (recommended)
npm run prebuild:check
```

**What it checks** (9 validation steps):

1. **Required Configuration Files** — app.json, package.json, metro.config.js, index.js, android/build.gradle, eas.json
2. **JavaScript Syntax** — Validates index.js entry point
3. **Core Dependencies** — react, react-native, expo, @supabase/supabase-js, @reduxjs/toolkit
4. **Critical Import Paths** — api.types import validation
5. **TypeScript Configuration** — tsconfig.json presence
6. **Android Build Configuration** — android directory, build.gradle, applicationId
7. **Environment Configuration** — .env file, Supabase URL/key (warnings only)
8. **Git Repository Status** — repo initialized, uncommitted changes (warnings)
9. **Schema Validation** — WatermelonDB schema vs cloud-dev

**Time**: ~2-3 seconds (vs 5-15 minutes for full build)

## Type Generation

### `sync-types-cloud.js`

**Purpose**: Generate TypeScript types from the active Supabase cloud instance.

- Reads `EXPO_PUBLIC_SUPABASE_URL` from `.env.development`
- Extracts the project ID automatically
- Gracefully handles paused/sleeping databases (warns but doesn't fail the build)

Called automatically by `npm run android`, `npm run ios`, and `npm run start`.

## Dependency Management

- `npm run validate:deps` — Validates package versions against migration rules
- `npm run deps` — Interactive dependency management CLI
- `npm run deps:add` — Add new dependencies with validation
- `npm run deps:scan` — Scan for dependency issues

## Schema Management

- `npm run schema:generate` — Generate WatermelonDB schema from Supabase types
- `npm run schema:validate` — Static schema validation
- `npm run schema:validate:live` — Live comparison against Supabase database
- `npm run db:sync-schema` — Sync SQL schema files from backend repo

## Testing

- `npm test` — Run all tests
- `npm run test:unit` — Unit tests only
- `npm run test:integration` — Integration tests
- `npm run test:maestro` — UI automation tests (requires the Maestro CLI and `-e E2E_TEST_EMAIL`/`-e E2E_TEST_PASSWORD`)

## Contributing

When adding new scripts:
1. Add to this README with clear documentation
2. Prefer Node.js (`.js`) scripts for cross-platform compatibility
3. Use descriptive script names
4. Read environment config from `.env.development`, never hardcode project refs
5. Add to `package.json` scripts section

## validate-watermelon-schema.js

`npm run schema:validate` compares `src/database/schema.ts` with the Supabase types (`src/types/supabase.ts`, or `src/types/database.types.ts` while that file is empty), column by column. It prints how many columns and tables it compared, and fails if it compared none. CI runs it in Schema Mirror Drift, where it blocks.

Every difference it accepts is named in the allowlists at the top of the script, never matched by pattern. An entry that stops matching fails the run: an allowlisted table or column that WatermelonDB no longer has, or that Supabase now has, so a stale skip cannot hide a column that should be compared. Add an entry only with the evidence, and add it here.

| Skipped | Why |
|---|---|
| `id`, `created_at`, `updated_at`, `deleted_at`, `_version`, `_custom_sync_status`, `modified_by`, on every table | The sync fields `generate-watermelon-schema.js` adds to every table, some of which the Supabase table lacks. `_status`, `_changed` and `last_modified_at` are skipped too, though `schema.ts` never declares them |
| `sync_outbox` (table) | The queue of local changes waiting to upload, never on the server |
| `sync_state` (table) | Sync bookkeeping, such as the pull watermarks |
| `server_id` on `capture_methods`, `activity_sensitivity`, `sampling_designs` | Holds the integer Supabase `id`, since a WatermelonDB id is a string. `ReferenceDataService` matches rows on it |
| `server_id` on `ai_models` | The Supabase uuid, kept beside the local id. `AiModelService` uses it as the model cache key |
| `remote_id` on `project_invitations` | The Supabase invitation id. `InvitationService` creates the local row with a WatermelonDB id and matches on this |
| `deployment_comments`, `camera_location_description`, `camera_location_image_path` on `deployments` | Legacy names. Upstream split the first into `start_` and `end_deployment_comments`, and renamed the others `location_description` and `camera_location_image_paths`, before its December 2025 baseline. `models/Deployment.ts` still declares them, but nothing reads or writes them, and the pull and the push use the new names. Removing them changes `schema.ts`, so it waits for a schema version bump |

Two type rules, which are not skips:

- **Timestamps.** A column the model reads with `@date` is epoch milliseconds, a `number`, where Supabase types an ISO `string`; the pulls convert with `new Date()` (`responded_at` is never written). The validator accepts that pair only for the columns in `TIMESTAMP_COLUMNS`, and fails either side changing: `deployment_start` and `deployment_end` on `deployments`, `expires_at` and `responded_at` on `project_invitations`.
- **Arrays and JSON.** WatermelonDB has no array column, so the generator stores a Supabase array (`number[]`, `string[]`) or `Json` as a JSON `string`, and the validator expects `string`. `device_alert_rules.backoff_steps_min` (`integer[]`) is the one number array today; the app has no model for that table.

## check-schema-mirror.js and schema-sync-config.js

`node scripts/check-schema-mirror.js <ww-backend checkout>` reports how `supabase/schemas` differs from the backend's declarative schema: files that differ, files the backend added, files it dropped. It shares `schema-sync-config.js` (the folder list and the files the sync never deletes) with `sync-db-schema.js`, so a compare and a copy cannot disagree. Exit 1 on drift, 2 when the folder list itself is stale.
