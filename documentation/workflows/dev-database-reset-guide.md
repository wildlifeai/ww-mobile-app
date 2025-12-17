# Dev Database Reset Guide

## Overview

Development-only utilities to reset the local SQLite database when testing with new seed data from the cloud dev instance or local Supabase.

**⚠️ IMPORTANT**: These features are **ONLY available in development mode** and will throw errors in production builds.

## Use Cases

1. **New seed data deployed** - Backend team has deployed fresh test data to cloud dev instance
2. **Testing multi-tenancy** - Need to clear old org/project data and sync fresh data
3. **Database corruption** - Local SQLite has inconsistent data
4. **Schema changes** - After backend migrations, need clean slate

## Safety Features

✅ **Multiple safety checks**:
- Only works when `__DEV__` is true (development builds)
- Checks Supabase URL to prevent production usage
- Blocks if URL contains "production" or doesn't match localhost/supabase.co patterns
- Confirmation dialogs before any destructive actions

## How to Use

### Method 1: Dev Menu (Recommended)

1. Open the app in development mode
2. Navigate to **Dev Build Info** screen (usually in Settings or Dev menu)
3. Scroll to **"Database (Dev Tools)"** section
4. Choose an option:
   - **"Clear Database Data"** - Removes all data, keeps schema (faster)
   - **"Reset Database (Full)"** - Drops and recreates all tables (complete reset)

### Method 2: Programmatic (Advanced)

```typescript
import { resetDatabaseForDev, clearDatabaseDataForDev } from '@/utils/devDatabaseReset';

// Full reset - drops and recreates tables
await resetDatabaseForDev();

// Clear data only - preserves schema
await clearDatabaseDataForDev();
```

## What Each Option Does

### Clear Database Data
- **Action**: `DELETE FROM` all tables
- **Result**: Empty tables with preserved schema and indexes
- **Speed**: Fast (~1 second)
- **Use When**: Need quick reset between test runs

### Reset Database (Full)
- **Action**: `DROP TABLE` → `CREATE TABLE` → rebuild indexes
- **Result**: Fresh database structure
- **Speed**: Slower (~2-3 seconds)
- **Use When**: Schema changes, migration issues, or complete clean slate needed

## Post-Reset Steps

After database reset:

1. **Restart the app** (recommended)
2. **Log out and log back in** - This will trigger:
   - Fresh authentication
   - Initial sync from Supabase
   - Download of org/project/user data aligned with new seed data

## Current Dev Instance Setup

**Cloud Dev Instance**: `https://nuhwmubvygxyddkycmpa.supabase.co`

**Test Users** (see `~/wildlife-watcher-backend/supabase/seeds/USER-CREDENTIALS-REFERENCE.md`):
- All users have password: `test123`
- 4 organizations: General, Wildlife Research Institute, Conservation Society, Park Rangers Network
- 4 projects distributed across organizations
- 17 test users with various roles

## Troubleshooting

### "Database reset is only available in development mode"
- Running in production build or `__DEV__` is false
- Solution: Use development build with Expo dev client

### "Database reset is not allowed in production environment"
- Supabase URL check detected production environment
- Solution: Verify `.env.local` has correct dev instance URL

### "Database not initialized"
- App hasn't opened database connection yet
- Solution: Wait for app to fully load, then try again

### Database still has old data after reset
- Need to re-authenticate to trigger sync
- Solution: Log out, close app, reopen, log in

## Technical Details

**Files**:
- `src/services/offline/DatabaseService.ts` - Reset methods (`resetDatabase()`, `clearAllData()`)
- `src/utils/devDatabaseReset.ts` - Utility wrapper functions
- `src/navigation/screens/DevBuildInfo.tsx` - UI integration

**Database Version**: v1 (tracks schema migrations)

**Tables Reset**:
- `local_organisations`
- `local_user_roles`
- `local_projects`
- `local_devices`
- `local_deployments`
- `offline_queue`
- `conflict_resolutions`

**Indexes**: All indexes are preserved (Clear) or recreated (Full Reset)

**Foreign Keys**: Handled properly with deletion in reverse dependency order

## Integration with Backend Seed Data

When backend team deploys new seed data (see backend `supabase/seeds/` directory):

1. Backend runs seed deployment: `./deployment_scripts/deploy.local.sh` or cloud equivalent
2. Mobile developers receive notification of new seed data
3. Mobile developers open Dev Build Info screen
4. Click "Reset Database (Full)" or "Clear Database Data"
5. Log out and log back in with test credentials
6. App syncs fresh seed data from Supabase

This ensures mobile app local SQLite database is aligned with backend test data.

---

**Last Updated**: 2025-10-26
**Backend Seed Reference**: `~/wildlife-watcher-backend/supabase/seeds/USER-CREDENTIALS-REFERENCE.md`
