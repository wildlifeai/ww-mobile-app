# Supabase Schema Management

This project follows a **declarative schema-as-code** approach, matching the backend repository's best practices.

## Source of Truth
The `supabase/schemas/` directory is the **Source of Truth** for the database structure.
- `schemas/public/tables/`: Table definitions
- `schemas/public/functions/`: RPC and trigger functions
- `schemas/public/policies/`: RLS policies

## Why a Local Supabase in the Mobile Repo?
While the backend repository is the owner of all shared migrations, the mobile repository maintains its own local Supabase configuration for three critical reasons:

1. **Offline-First Sync Verification**: The core of the app is its custom bidirectional sync logic. A local instance allows developers to test complex sync scenarios (conflicts, deletions, partial updates) in a clean, disposable 'sandbox' without affecting shared cloud instances.
2. **CI/CD Integration Testing**: Automated E2E tests (like Maestro) use the local Supabase configuration to spin up a fresh database environment for every test run, ensuring isolation and reproducibility.
3. **Stand-alone Development**: Mobile-only developers can start a local database and begin testing features even if they haven't cloned the backend repository, thanks to the automated schema synchronization script.

## Workflow

1. **Sync from Backend**: Pull the latest schema before starting work.
   ```bash
   npm run db:sync-schema
   ```
   * **Clean Sync**: Files in `supabase/schemas/` that are not present in the backend will be automatically removed to prevent deprecated code.
   * **Safeguards**: Files in the `PRESERVE_FILES` list (e.g., `01_watermelon_sync.sql`, `99_push_changes.sql`, `01_auth_user_trigger.sql`) are protected from deletion.
   * **Fallback**: Automated shallow clone from GitHub if the local backend path is missing.

2. **Local Reset**: Apply the synced schema to your local development database.
   ```bash
   npx supabase db reset
   ```
   * **Note**: This is the **only** database command used in the mobile repository. It ensures your local environment matches the current backend source of truth.

3. **Backend Changes**: If you need to modify the schema (even for mobile-specific features like new WatermelonDB sync tables):
   * **DO NOT** generate migrations in this repository.
   * **Modify** the backend repository (`wildlife-watcher-backend`).
   * **Generate and push** migrations from the backend to the remote Supabase instance.
   * **Re-sync** this repository once the backend changes are committed.

## Source of Truth Architecture

* **Backend**: Owner of all migrations and remote deployments.
* **Mobile**: Consumer of declarative schema files for local development and testing.
