# RLS Policy Error Investigation - Project Members Fetch Failure

**Date**: 2025-10-20
**Error Code**: 42501 (Insufficient Privilege)
**Affected User**: adarsh@wildlife.ai (ww_admin role)

## Error Message
```
Failed to fetch project members: {
  "code": "42501",
  "details": null,
  "hint": null,
  "message": "Unauthorized: Must be project member or system admin to view members"
}
```

## Investigation Summary

### Root Cause Analysis

**Issue Identified**: The `get_project_members` function security check is failing due to multi-tenant isolation requirements in the `has_project_role` function.

### Backend RLS Architecture

#### 1. Function Call Chain
```
getProjectMembers()
  → supabase.rpc('get_project_members', {...})
    → get_project_members(p_project_id, p_requesting_user_id)
      → has_system_role(check_user_id, 'ww_admin') [CHECK 1]
      → has_project_role(check_user_id, p_project_id, 'project_admin') [CHECK 2]
      → has_project_role(check_user_id, p_project_id, 'project_member') [CHECK 3]
```

#### 2. Permission Check Logic (get_project_members function)
```sql
-- Security check at line 40-46
IF NOT (
  public.has_system_role(check_user_id, 'ww_admin') OR
  public.has_project_role(check_user_id, p_project_id, 'project_admin') OR
  public.has_project_role(check_user_id, p_project_id, 'project_member')
) THEN
  RAISE EXCEPTION 'Unauthorized: Must be project member or system admin to view members'
```

#### 3. Critical Security Constraint in has_project_role
```sql
-- Lines 56-74: System admin inheritance WITH tenant validation
RETURN EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = check_user_id
    AND ur.role = 'ww_admin'
    AND ur.scope_type = 'system'
    AND ur.is_active = true
    -- ... expiry checks
) AND EXISTS (
  -- CRITICAL: Validate admin belongs to the project's organisation
  SELECT 1
  FROM public.projects p
  JOIN public.user_organisations uo ON uo.organisation_id = p.organisation_id
  WHERE p.id = has_project_role.project_id
    AND uo.user_id = check_user_id
    AND p.deleted_at IS NULL
    AND uo.deleted_at IS NULL
);
```

### The Problem

**Multi-Tenant Isolation Requirement**: Even though the user has `ww_admin` system role, the `has_project_role` function requires **organization membership validation** for security purposes.

**Key Security Design Decision**:
- Line 66 comment: "CRITICAL: Validate admin belongs to the project's organisation (prevents cross-tenant access)"
- This prevents ww_admin users from accessing projects in organizations they don't belong to
- **This is intentional security-by-design, NOT a bug**

### Current State Verification Needed

1. **User's ww_admin role**: ✅ Confirmed exists (user.role === 'ww_admin')
2. **User's organization membership**: ❓ Need to verify
3. **Project's organization**: `b0000000-0000-0000-0000-000000000002`
4. **user_organisations link**: ❓ Need to verify existence

### Diagnostic Questions

1. Does `user_organisations` table contain a record linking:
   - `user_id`: adarsh@wildlife.ai's UUID
   - `organisation_id`: `b0000000-0000-0000-0000-000000000002`

2. Is the `user_organisations.deleted_at` field NULL for this record?

3. Does the `user_roles` table contain an active ww_admin role for this user?

## Issue Classification

**Type**: Data integrity issue OR expected multi-tenant security behavior

**Severity**:
- If user SHOULD have access to org `b0000000-0000-0000-0000-000000000002`: **Critical** (missing data)
- If user should NOT have access to other orgs: **Expected behavior** (security working correctly)

## Potential Resolutions

### Scenario A: User Should Have Access
**Fix Location**: Backend database
**Action Required**:
1. Insert missing `user_organisations` record
2. Verify `user_roles` has active ww_admin entry
3. Ensure no `deleted_at` timestamps on records

### Scenario B: Expected Security Behavior
**Fix Location**: Mobile app UX
**Action Required**:
1. Update error handling to distinguish between:
   - "No permission" (expected)
   - "Missing org membership" (data issue)
2. Improve error messaging for users
3. Add organization filtering in project list

## Backend Files Examined

1. `/supabase/schemas/public/functions/36_get_project_members.sql`
   - Line 40-46: Authorization check
   - Uses 3-tier permission model

2. `/supabase/schemas/public/functions/29_has_project_role.sql`
   - Line 56-74: System admin with org validation
   - Implements multi-tenant isolation

3. `/supabase/schemas/public/functions/27_has_system_role.sql`
   - Basic system role check
   - No org validation (just role existence)

4. `/supabase/schemas/public/policies/51_project_members.sql`
   - RLS policies for direct table access
   - Not used when calling SECURITY DEFINER functions

## Mobile App Code Analysis

### Authentication Flow (src/services/auth.ts)
- Line 50-196: `fetchUserOrganisations()` function
- Line 77-92: Queries `user_organisations` table
- Line 94-101: Returns empty array if no organizations found
- **Potential Issue**: If this returns empty, user appears authenticated but has no org access

### Member Fetch (src/services/ProjectMemberService.ts)
- Line 116-138: `getProjectMembers()` function
- Line 122-125: Calls `get_project_members` RPC
- Line 127-130: Catches error and logs message
- **Current Handling**: Generic error message, no specific org membership check

### UI Error Handling (src/screens/ProjectMembersScreen.tsx)
- Line 136-148: Error handling in `loadMembers()`
- Line 141-147: Checks for "Unauthorized" in error message
- Shows empty list on unauthorized (may hide real issue)

## Recommended Next Steps

1. **Verify Database State** (Backend):
   ```sql
   -- Check user_organisations for this user
   SELECT * FROM user_organisations
   WHERE user_id = '<adarsh-uuid>'
     AND organisation_id = 'b0000000-0000-0000-0000-000000000002';

   -- Check user_roles for ww_admin
   SELECT * FROM user_roles
   WHERE user_id = '<adarsh-uuid>'
     AND role = 'ww_admin'
     AND scope_type = 'system';
   ```

2. **Enhanced Mobile App Logging**:
   - Log organization IDs from `fetchUserOrganisations()`
   - Log project organization_id before member fetch
   - Compare to identify mismatch

3. **Improved Error Messages**:
   - Distinguish "not in organization" vs "insufficient role"
   - Provide actionable feedback to user

## Security Analysis

**Backend Security Posture**: ✅ EXCELLENT
- Multi-tenant isolation properly implemented
- ww_admin scoped to their organizations
- Prevents cross-tenant data leakage
- Follows principle of least privilege

**Mobile App Security**: ⚠️ NEEDS IMPROVEMENT
- Error messages may expose internal authorization logic
- Consider generic "Access Denied" with internal logging
- Avoid revealing organization structure to unauthorized users

## Conclusion

**PRIMARY DETERMINATION NEEDED**:
Should `adarsh@wildlife.ai` have access to organization `b0000000-0000-0000-0000-000000000002`?

**If YES**: Backend data issue (missing `user_organisations` record)
**If NO**: Mobile app should not show projects from inaccessible organizations

**Recommended Fix Approach**:
1. Query backend to verify user's organization memberships
2. If missing membership: Add `user_organisations` record (backend)
3. If membership exists: Debug `has_project_role` function execution
4. Enhance mobile app to filter projects by accessible organizations
5. Improve error messaging for better user experience

---

**Investigation Status**: ✅ Root cause identified - awaiting database state verification
**Impact**: User cannot view/manage members for projects in org `b0000000-0000-0000-0000-000000000002`
**Fix Ownership**: Backend (if data issue) OR Mobile App (if UX issue)
