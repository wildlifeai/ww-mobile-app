# Quick Fix Guide - Member Fetch RLS Error

**Error**: "Unauthorized: Must be project member or system admin to view members" (Code 42501)
**User**: adarsh@wildlife.ai (ww_admin)
**Organization**: b0000000-0000-0000-0000-000000000002

---

## 🚀 Quick Diagnosis (30 seconds)

### Step 1: Check User's Organizations
```sql
-- Run this in Supabase SQL Editor
SELECT
  uo.organisation_id,
  o.name,
  CASE
    WHEN uo.organisation_id = 'b0000000-0000-0000-0000-000000000002' THEN '✅ HAS ACCESS'
    ELSE ''
  END as status
FROM user_organisations uo
JOIN organisations o ON o.id = uo.organisation_id
JOIN auth.users au ON au.id = uo.user_id
WHERE au.email = 'adarsh@wildlife.ai'
  AND uo.deleted_at IS NULL;
```

**Expected Result**: Should see row with organization `b0000000-0000-0000-0000-000000000002`

---

## ✅ Fix Option 1: Missing Organization Membership (Most Likely)

### Symptom
Query above returns NO rows for organization `b0000000-0000-0000-0000-000000000002`

### Fix (Copy-Paste Ready)
```sql
-- Add user to organization
INSERT INTO user_organisations (user_id, organisation_id)
SELECT
  au.id,
  'b0000000-0000-0000-0000-000000000002'::uuid
FROM auth.users au
WHERE au.email = 'adarsh@wildlife.ai'
  AND NOT EXISTS (
    SELECT 1
    FROM user_organisations uo
    WHERE uo.user_id = au.id
      AND uo.organisation_id = 'b0000000-0000-0000-0000-000000000002'
  );

-- Verify insertion
SELECT 'SUCCESS: User added to organization' as result;
```

### Test Fix
```sql
-- Should now return TRUE
SELECT public.has_project_role(
  (SELECT id FROM auth.users WHERE email = 'adarsh@wildlife.ai'),
  (SELECT id FROM projects WHERE organisation_id = 'b0000000-0000-0000-0000-000000000002' LIMIT 1),
  'project_member'
) as has_access;
```

---

## ✅ Fix Option 2: Missing ww_admin Role (Less Likely)

### Symptom
```sql
-- This returns NO rows
SELECT * FROM user_roles
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'adarsh@wildlife.ai')
  AND role = 'ww_admin'
  AND scope_type = 'system'
  AND is_active = true;
```

### Fix
**IMPORTANT**: Only grant ww_admin if user is authorized as system administrator!

```sql
-- Grant ww_admin role
INSERT INTO user_roles (user_id, role, scope_type, is_active, granted_by)
SELECT
  id,
  'ww_admin',
  'system',
  true,
  id  -- Self-granted (or use granting admin's UUID)
FROM auth.users
WHERE email = 'adarsh@wildlife.ai'
  AND NOT EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.users.id
      AND ur.role = 'ww_admin'
      AND ur.scope_type = 'system'
  );

-- Verify
SELECT 'SUCCESS: ww_admin role granted' as result;
```

---

## ✅ Fix Option 3: Mobile App Should Filter Projects (Design Decision)

### If User Should NOT Have Access

This means the security is working correctly - ww_admin users are properly scoped to their organizations.

### Mobile App Fix

**File**: `src/screens/ProjectListScreen.tsx` or similar

```typescript
// Filter projects by user's accessible organizations
const filterAccessibleProjects = (projects: Project[], user: User) => {
  const userOrgIds = user.organisations.map(org => org.id);

  return projects.filter(project => {
    const hasOrgAccess = userOrgIds.includes(project.organisation_id);

    if (!hasOrgAccess) {
      console.log('Filtering out inaccessible project:', {
        projectId: project.id,
        projectOrg: project.organisation_id,
        userOrgs: userOrgIds
      });
    }

    return hasOrgAccess;
  });
};

// Usage
const accessibleProjects = filterAccessibleProjects(allProjects, currentUser);
```

**Better Error Message**:

```typescript
// src/screens/ProjectMembersScreen.tsx
catch (error: any) {
  if (error?.message?.includes('Unauthorized')) {
    // Check if it's an org access issue
    const project = await getProjectById(projectId);
    const userHasOrgAccess = user.organisations.some(
      org => org.id === project.organisation_id
    );

    if (!userHasOrgAccess) {
      Alert.alert(
        'Organization Access Required',
        'You do not belong to this project\'s organization. Contact your administrator for access.'
      );
    } else {
      Alert.alert(
        'Insufficient Permissions',
        'You do not have permission to view this project\'s members.'
      );
    }
    return;
  }
  // Handle other errors
}
```

---

## 🧪 Comprehensive Test After Fix

### Run Full Diagnostic
```bash
cd /home/adarsh/dev/wildlifeai/wildlife-watcher-backend
supabase db execute -f scripts/diagnose-member-fetch-issue.sql
```

### Manual Verification
```sql
-- 1. User has ww_admin
SELECT public.has_system_role(
  (SELECT id FROM auth.users WHERE email = 'adarsh@wildlife.ai'),
  'ww_admin'
) as has_ww_admin;
-- Expected: true

-- 2. User in organization
SELECT EXISTS (
  SELECT 1
  FROM user_organisations uo
  JOIN auth.users au ON au.id = uo.user_id
  WHERE au.email = 'adarsh@wildlife.ai'
    AND uo.organisation_id = 'b0000000-0000-0000-0000-000000000002'
    AND uo.deleted_at IS NULL
) as in_organization;
-- Expected: true

-- 3. has_project_role works
SELECT public.has_project_role(
  (SELECT id FROM auth.users WHERE email = 'adarsh@wildlife.ai'),
  (SELECT id FROM projects WHERE organisation_id = 'b0000000-0000-0000-0000-000000000002' LIMIT 1),
  'project_member'
) as has_project_access;
-- Expected: true

-- 4. get_project_members succeeds
SELECT * FROM public.get_project_members(
  (SELECT id FROM projects WHERE organisation_id = 'b0000000-0000-0000-0000-000000000002' LIMIT 1),
  (SELECT id FROM auth.users WHERE email = 'adarsh@wildlife.ai')
);
-- Expected: List of project members (no error)
```

---

## 📱 Test in Mobile App

1. **Force Refresh User Data**:
   - Log out of mobile app
   - Log back in with adarsh@wildlife.ai
   - Check console logs for organizations

2. **Navigate to Project**:
   - Go to project in org `b0000000-0000-0000-0000-000000000002`
   - Tap "Members" or "Team"
   - Should see member list (no error)

3. **Verify Console Logs**:
   ```
   ✅ Fetched X user_organisation links
   ✅ Found Y organisations
   ✅ Fetched user organisations: { organisations: [...], role: 'ww_admin', ... }
   ✅ Loaded N project members
   ```

---

## 🔍 Troubleshooting

### Still Getting Error After Fix?

1. **Check Session**:
   ```sql
   -- Verify user can authenticate
   SELECT id, email FROM auth.users WHERE email = 'adarsh@wildlife.ai';
   ```

2. **Check Organization Exists**:
   ```sql
   SELECT * FROM organisations
   WHERE id = 'b0000000-0000-0000-0000-000000000002'
     AND deleted_at IS NULL;
   ```

3. **Check Projects Exist**:
   ```sql
   SELECT id, name FROM projects
   WHERE organisation_id = 'b0000000-0000-0000-0000-000000000002'
     AND deleted_at IS NULL;
   ```

4. **Check for Soft Deletes**:
   ```sql
   -- Ensure records aren't soft-deleted
   SELECT
     'user_organisations' as table_name,
     deleted_at
   FROM user_organisations
   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'adarsh@wildlife.ai')
     AND organisation_id = 'b0000000-0000-0000-0000-000000000002';
   ```

### Mobile App Cache Issues

```typescript
// Force refresh authentication state
await supabase.auth.refreshSession();

// Clear local cache (if using)
await AsyncStorage.removeItem('userOrganisations');

// Re-fetch user data
const session = await getCurrentSession();
```

---

## 📊 Success Criteria

✅ SQL diagnostic script Step 3 shows organization membership
✅ SQL diagnostic script Step 8 shows both conditions TRUE
✅ SQL diagnostic script Step 10 returns member list (no error)
✅ Mobile app logs show user organizations including target org
✅ Mobile app displays project members without error
✅ Member management features work (add/remove/change role)

---

## 🆘 Still Stuck?

### Collect These Logs

1. **Backend Logs**:
   ```sql
   -- Run and save output
   SELECT * FROM (
     SELECT 'User ID' as info, id::text as value FROM auth.users WHERE email = 'adarsh@wildlife.ai'
     UNION ALL
     SELECT 'Has ww_admin', public.has_system_role((SELECT id FROM auth.users WHERE email = 'adarsh@wildlife.ai'), 'ww_admin')::text
     UNION ALL
     SELECT 'Org Count', COUNT(*)::text FROM user_organisations WHERE user_id = (SELECT id FROM auth.users WHERE email = 'adarsh@wildlife.ai')
   ) t;
   ```

2. **Mobile App Logs**:
   - Copy console output from login flow
   - Copy console output from member fetch attempt
   - Note exact error message and code

3. **Share**:
   - SQL query results
   - Mobile app console logs
   - Full error stack trace

---

**Last Updated**: 2025-10-20
**Author**: Claude (Supabase RLS Specialist)
**Related Docs**:
- `/project-context/investigation/DELIVERABLE-RLS-ERROR-ANALYSIS.md` (Full analysis)
- `/home/adarsh/dev/wildlifeai/wildlife-watcher-backend/scripts/diagnose-member-fetch-issue.sql` (Diagnostic script)
