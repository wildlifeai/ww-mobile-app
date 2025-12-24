# Supabase Schema Management

This project follows a **declarative schema-as-code** approach, matching the backend repository's best practices.

## Source of Truth
The `supabase/schemas/` directory is the **Source of Truth** for the database structure.
- `schemas/public/tables/`: Table definitions
- `schemas/public/functions/`: RPC and trigger functions
- `schemas/public/policies/`: RLS policies

## Workflow
1. **Sync from Backend**: Run the sync script to pull the latest core schema from the `wildlife-watcher-backend` repository.
   ```bash
   npm run db:sync-schema
   ```
2. **Modify Mobile-Specific Schema**: If you need mobile-specific RPCs (like WatermelonDB sync functions), edit them in `supabase/schemas/public/functions/`.
3. **Generate Migration**: Create a new migration file in `supabase/migrations/` to apply the changes.
   - *Example*: `002_invitation_rpcs.sql` was created after a sync.
4. **Apply Migration**: Run the migration on the target Supabase instance.
   - Local: `npx supabase db reset`
   - Remote: `npx supabase db push`

## Database Rebuilds
When the database is reset or rebuilt, ensure all migrations are applied. By keeping the `schemas/` directory updated, we maintain a clear history and the ability to reproduce the exact state of the database.
