# Cloud Supabase Auth Schema Error - Backend Investigation Required

**Date**: 2025-10-25
**Severity**: CRITICAL - Blocking mobile app login
**Status**: REQUIRES BACKEND INVESTIGATION

---

## Issue Summary

**Mobile app cannot authenticate** against the cloud Supabase instance (`nuhwmubvygxyddkycmpa.supabase.co`).

### Error Details

```
ERROR  ❌ Supabase Auth Error: {
  "code": "unexpected_failure",
  "details": [AuthApiError: Database error querying schema],
  "message": "Database error querying schema",
  "name": "AuthApiError",
  "status": 500
}
```

### Environment Status

| Environment | Status | Details |
|-------------|--------|---------|
| **Local Supabase** (127.0.0.1:54321) | ✅ WORKING | All migrations applied, auth working perfectly |
| **Cloud Supabase** (nuhwmubvygxyddkycmpa) | ❌ BROKEN | 500 error on auth queries |
| **Mobile App** | ⏸️ BLOCKED | Cannot authenticate users |

### Verified Information

- ✅ All 17 migrations are applied to cloud instance (verified via `npx supabase migration list`)
- ✅ Mobile app configuration is correct (valid URL and anon key)
- ✅ REST API is responding (returns OpenAPI spec)
- ❌ **Auth system cannot query database schema** (500 error)

---

## Root Cause Hypothesis

The Supabase **auth service cannot query the database schema**, suggesting one of:

1. **RLS policies blocking auth.* schema access** (most likely)
2. **Permissions issue on auth schema tables**
3. **Database schema corruption or migration rollback**
4. **Auth service configuration issue**

---

## Backend Team Action Items

### 1. Check Auth Schema RLS Policies (HIGH PRIORITY)

**Issue**: RLS policies might be blocking the auth service from querying its own schema.

```sql
-- Connect to cloud instance
-- Check if RLS is enabled on auth tables (it shouldn't be)
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'auth'
ORDER BY tablename;
```

**Expected**: All `auth.*` tables should have `rls_enabled = false` (RLS should NOT be enabled on auth tables).

**If RLS is enabled on auth tables, disable it:**
```sql
-- DO NOT ENABLE RLS ON AUTH TABLES
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE auth.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE auth.refresh_tokens DISABLE ROW LEVEL SECURITY;
-- etc. for all auth.* tables
```

### 2. Check Auth Service Permissions

```sql
-- Check if authenticator role has access to auth schema
SELECT
  grantor,
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee IN ('authenticator', 'authenticated', 'anon')
  AND table_schema = 'auth'
LIMIT 20;
```

**Expected**: `authenticator` role should have FULL access to `auth.*` tables.

### 3. Test Auth Queries Directly

```sql
-- Test if we can query auth tables
SELECT email FROM auth.users WHERE email = 'rachel.member@ranger.gov';

-- Test schema introspection (what auth service is trying to do)
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'auth'
  AND table_name = 'users'
LIMIT 5;
```

**Expected**: Both queries should succeed without errors.

### 4. Check Recent Migration Side Effects

**Last migration applied**: `20251020223816_fix_get_organisation_users_proper.sql`

```sql
-- Check if any recent migrations modified auth schema
SELECT * FROM public.user_roles WHERE role = 'authenticator' OR role = 'authenticated';

-- Check if any functions are blocking auth
SELECT
  proname AS function_name,
  prosecdef AS security_definer
FROM pg_proc
WHERE pronamespace = 'auth'::regnamespace;
```

### 5. Check Supabase Dashboard Logs

1. Go to: https://supabase.com/dashboard/project/nuhwmubvygxyddkycmpa
2. Navigate to: **Logs** → **Postgres Logs**
3. Filter for: Last 1 hour, level: ERROR
4. Look for: "schema query" errors or "permission denied" errors

### 6. Compare Cloud vs Local Schema

```bash
# In backend repo
cd ~/dev/wildlifeai/wildlife-watcher-backend

# Dump local auth schema
npx supabase db dump --local --schema auth > /tmp/local-auth-schema.sql

# Dump cloud auth schema (if permissions allow)
npx supabase db dump --linked --schema auth > /tmp/cloud-auth-schema.sql

# Compare
diff /tmp/local-auth-schema.sql /tmp/cloud-auth-schema.sql
```

---

## Mobile App Workaround (Temporary)

**Until backend fixes cloud instance**, mobile app can use **local Supabase with WSL2 networking**:

```bash
# Get WSL2 IP address
ip addr show eth0 | grep "inet " | awk '{print $2}' | cut -d/ -f1
```

Update mobile app `.env.local`:
```bash
# Use WSL2 IP instead of localhost
EXPO_PUBLIC_SUPABASE_URL="http://172.21.24.107:54321"  # Replace with actual WSL2 IP
EXPO_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
```

---

## Expected Resolution Timeline

**CRITICAL**: This is blocking all mobile app authentication. Backend team should prioritize this as P0.

**Estimated fix time**: 1-2 hours (if RLS policy issue) or 4-6 hours (if schema corruption)

---

## Contact

- **Reported by**: Mobile team
- **Mobile app blocked**: YES - cannot authenticate any users
- **Backend repo**: `~/dev/wildlifeai/wildlife-watcher-backend`
- **Cloud project**: nuhwmubvygxyddkycmpa (Dev_Wildlife_Watcher)

---

## Additional Debug Info

```
Mobile App Error Stack:
- AuthApiError: Database error querying schema
- Status: 500
- Service: Supabase Auth
- Endpoint: POST /auth/v1/token?grant_type=password
- User attempting login: rachel.member@ranger.gov
- Error occurs: During password authentication flow
```

**Backend team**: Please run the diagnostic queries above and report findings in this document.
