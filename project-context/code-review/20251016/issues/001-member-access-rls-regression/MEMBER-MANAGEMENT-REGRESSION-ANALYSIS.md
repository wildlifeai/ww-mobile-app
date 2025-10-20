# Member Management Regression Analysis
**Date:** 2025-10-20
**Issue:** Member loading failure in ProjectDetailsScreen
**Severity:** CRITICAL - Breaks member management functionality

---

## 🔴 Critical Errors Identified

### 1. **TypeError: getProjectById is not a function**
**Location:** `src/navigation/screens/ProjectDetailsScreen.tsx:69`

**Root Cause:**
ProjectDetailsScreen imports `useGetProjectByIdQuery` from `src/redux/api/projectsApi.ts`, but the hook was successfully migrated and exists. The error message is misleading - the actual issue is in the **member loading flow**.

**Evidence:**
```typescript
// ProjectDetailsScreen.tsx:69
const { data: project, isLoading, error, refetch } = useGetProjectByIdQuery(projectId);

// This hook works correctly - project data loads successfully
```

**Real Problem:** The error occurs when `ProjectMembersScreen.tsx` calls:
```typescript
const { getProjectById } = await import('../services/ProjectService');
const project = await getProjectById(projectId);
```

The function exists but is a **method on the default export singleton**, not a named export.

---

### 2. **Unauthorized RLS Policy Error**
**Error:** `Unauthorized: Must be project member or system admin to view members`

**Location:** Backend RPC function `get_project_members`

**Root Cause:**
The `get_project_members` RPC function has RLS policies that require:
1. User must be a project member, OR
2. User must be a system admin (ww_admin role)

**Problem:** Even though user is logged in as `ww_admin` (adarsh@wildlife.ai), the RLS policy check is failing.

**Evidence from ProjectService.ts:**
```typescript
async getProjectMembers(projectId: string): Promise<ProjectMemberWithProfile[]> {
  const { data, error } = await (supabase as any)
    .rpc('get_project_members', { p_project_id: projectId });

  if (error) {
    console.error('Failed to fetch project members:', error);
    throw new Error(`Failed to fetch project members: ${error.message}`);
  }
  // ... transform data
}
```

**Why This Fails:**
- RPC function `get_project_members` enforces RLS
- ww_admin users should have system-wide access
- RLS policy might not be checking `user_roles.value = 'ww_admin'` properly
- Backend issue: Policy needs to be updated to recognize ww_admin

---

### 3. **React Key Duplication: `member-undefined`**
**Location:** `src/navigation/screens/ProjectDetailsScreen.tsx:535`

**Root Cause:**
When member data fails to load due to RLS error, the `members` array contains objects with `undefined` `user_id` fields.

**Code Analysis:**
```typescript
// ProjectDetailsScreen.tsx:535
{members.map((member) => (
  <View key={`member-${member.user_id}`} style={styles.memberRow}>
    {/* If member.user_id is undefined, key becomes "member-undefined" */}
```

**Chain of Failure:**
1. `getProjectMembers` RPC call fails with RLS error
2. Error is caught, but empty array or partial data is returned
3. Member objects have missing/undefined fields
4. React key generation creates duplicate `member-undefined` keys
5. React warning is triggered

---

## 📂 File-Level Analysis

### **File 1: `src/redux/api/projectsApi.ts`**
**Status:** ✅ Correctly migrated, all hooks exported properly

**Verification:**
```typescript
// Lines 268-277: All hooks exported correctly
export const {
  useGetProjectsQuery,
  useGetProjectByIdQuery,          // ✅ EXISTS
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useGetProjectMembersQuery,       // ✅ EXISTS
  useAddProjectMemberMutation,
  useRemoveProjectMemberMutation,
} = projectsApi;
```

**Used By:**
- ✅ `ProjectDetailsScreen.tsx` - imports all hooks correctly
- ✅ `Projects.tsx` - uses `useGetProjectsQuery`
- ✅ `AddProject.tsx`, `NewProjectScreen.tsx` - use `useCreateProjectMutation`

---

### **File 2: `src/services/ProjectService.ts`**
**Status:** ⚠️ Export pattern mismatch

**Problem:**
```typescript
// Line 586: Default export of singleton instance
export default new ProjectService();

// NOT exported as named exports:
// ❌ export { getProjectById, getProjectMembers }
```

**Impact:**
- `ProjectMembersScreen.tsx:152` tries to import as named export:
  ```typescript
  const { getProjectById } = await import('../services/ProjectService');
  ```
- This works because TypeScript allows destructuring default exports
- BUT runtime may fail if the instance methods aren't bound correctly

**Methods Available on Singleton:**
- ✅ `getProjectById(projectId: string)` - Lines 176-202
- ✅ `getProjectMembers(projectId: string)` - Lines 431-456
- ✅ `getUserProjects(organisationId: string)` - Lines 64-85
- ✅ `createProject(input)`, `updateProject()`, `deleteProject()`
- ✅ `addProjectMember()`, `removeProjectMember()`

---

### **File 3: `src/navigation/screens/ProjectDetailsScreen.tsx`**
**Status:** ⚠️ Vulnerable to undefined member data

**Lines 530-557: Member rendering logic**
```typescript
{membersLoading ? (
  <ActivityIndicator size="small" />
) : members && members.length > 0 ? (
  <View style={styles.membersList}>
    {members.map((member) => (
      // ⚠️ LINE 535: Key uses member.user_id which can be undefined
      <View key={`member-${member.user_id}`} style={styles.memberRow}>
        <View style={styles.memberInfo}>
          <WWIcon source="account-circle" size={40} />
          <View style={styles.memberDetails}>
            {/* LINE 540: Optional chaining protects against undefined */}
            <Text>{member.user_profile?.name || 'Unknown User'}</Text>
            {member.role?.value && (
              <Text>{member.role.value}</Text>
            )}
          </View>
        </View>
        {/* LINE 553: Remove button uses member.user_id */}
        <IconButton onPress={() => handleRemoveMember(member.user_id)} />
      </View>
    ))}
  </View>
) : (
  <Text>No members yet</Text>
)}
```

**Vulnerability:**
1. If RLS error occurs, `members` might be empty or contain partial data
2. No error handling for failed member fetch
3. Key generation assumes `member.user_id` is always defined

---

### **File 4: `src/screens/ProjectMembersScreen.tsx`**
**Status:** ⚠️ Import pattern works but fragile

**Line 152:**
```typescript
const { getProjectById } = await import('../services/ProjectService');
const project = await getProjectById(projectId);
```

**Analysis:**
- This dynamic import destructures the default export
- Works because TypeScript transpiles it correctly
- BUT relies on default export being an object with `getProjectById` method
- Could fail if default export pattern changes

**Better Pattern:**
```typescript
import ProjectService from '../services/ProjectService';
const project = await ProjectService.getProjectById(projectId);
```

---

## 🔍 Cross-Organization Bug Analysis

**Potential Issue:** Member fetching might be attempting cross-org access

**Evidence:**
1. User is logged in with org `wildlife-ai`
2. Projects load correctly (RLS filters by user's org)
3. Members fail to load with "Must be project member or system admin" error

**Hypothesis:**
- User has `ww_admin` role
- RLS policy for `get_project_members` doesn't recognize `ww_admin` as "system admin"
- Policy only checks if `user_id` exists in `project_members` table
- ww_admin users should bypass this check but don't

**Backend Investigation Needed:**
1. Check `get_project_members` RPC function in backend
2. Verify RLS policy checks for `ww_admin` role
3. Confirm user role is properly set in `user_roles` table

---

## 🛠️ Required Fixes

### **Fix 1: Update ProjectDetailsScreen.tsx** (FRONTEND)
**Priority:** HIGH
**File:** `src/navigation/screens/ProjectDetailsScreen.tsx`

**Changes:**
1. Add error handling for member fetch failure
2. Use fallback key for members with undefined user_id
3. Show user-friendly error message when RLS fails

```typescript
// Line 70: Add error state for members
const {
  data: members,
  isLoading: membersLoading,
  error: membersError  // ADD THIS
} = useGetProjectMembersQuery(projectId);

// Line 535: Fix key generation
<View
  key={`member-${member.user_id || member.id || index}`}
  style={styles.memberRow}
>

// After line 528: Add error handling
{membersError && (
  <Text style={{ color: theme.colors.error }}>
    Failed to load members. You may not have permission to view this project's members.
  </Text>
)}
```

---

### **Fix 2: Update Backend RLS Policy** (BACKEND)
**Priority:** CRITICAL
**File:** Backend repository - `get_project_members` RPC function

**Changes:**
1. Update RLS policy to recognize `ww_admin` users
2. Check `user_roles.value = 'ww_admin'` in addition to project membership

**SQL Policy:**
```sql
CREATE POLICY "get_project_members_policy"
ON project_members
FOR SELECT
USING (
  -- User is project member
  user_id = auth.uid()
  OR
  -- User is system admin
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND value = 'ww_admin'
  )
);
```

---

### **Fix 3: Improve ProjectMembersScreen Import** (FRONTEND)
**Priority:** LOW
**File:** `src/screens/ProjectMembersScreen.tsx`

**Changes:**
1. Use consistent import pattern for ProjectService

```typescript
// Line 152: Change from dynamic import to static
import ProjectService from '../services/ProjectService';

// Line 153: Use singleton instance
const project = await ProjectService.getProjectById(projectId);
```

---

### **Fix 4: Add Member Fetch Error Recovery** (FRONTEND)
**Priority:** MEDIUM
**File:** `src/redux/api/projectsApi.ts`

**Changes:**
1. Add retry logic for RLS errors
2. Return empty array instead of error for unauthorized access

```typescript
// Line 200: getProjectMembers endpoint
getProjectMembers: builder.query<ProjectMemberWithProfile[], string>({
  queryFn: async (projectId) => {
    try {
      const data = await ProjectService.getProjectMembers(projectId);
      return { data };
    } catch (error) {
      // If RLS error, return empty array instead of failing
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        console.warn('⚠️ User not authorized to view members');
        return { data: [] };
      }
      return {
        error: {
          status: 'CUSTOM_ERROR',
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  },
  providesTags: (result, error, projectId) => [
    { type: 'ProjectMembers', id: projectId },
  ],
}),
```

---

## 📊 Impact Summary

| Component | Status | Impact | Priority |
|-----------|--------|--------|----------|
| ProjectDetailsScreen | ⚠️ Broken | Cannot view members | HIGH |
| ProjectMembersScreen | ⚠️ Fragile | Works but vulnerable | MEDIUM |
| projectsApi.ts | ✅ Working | Redux hooks correct | - |
| ProjectService | ⚠️ Export issue | Inconsistent pattern | LOW |
| Backend RLS | 🔴 Broken | ww_admin blocked | CRITICAL |

---

## 🎯 Root Cause Summary

**Primary Issue:** Backend RLS policy for `get_project_members` doesn't recognize `ww_admin` users as having system-wide access.

**Secondary Issues:**
1. Frontend doesn't handle RLS authorization errors gracefully
2. React key generation doesn't handle undefined member.user_id
3. Inconsistent import patterns for ProjectService

**Recommended Fix Order:**
1. ✅ **Fix Backend RLS policy** (Unblocks ww_admin users)
2. ✅ **Add frontend error handling** (Graceful degradation)
3. ✅ **Fix React keys** (Eliminates warnings)
4. ⚠️ **Standardize imports** (Code quality improvement)

---

## 📝 Testing Verification

**After Fixes Applied:**
1. ✅ ww_admin users can view all project members
2. ✅ project_admin users can view their project members
3. ✅ project_member users can view their project members
4. ✅ Unauthorized users see "No members" instead of error
5. ✅ No React key duplication warnings
6. ✅ Member remove button works correctly

---

**Generated:** 2025-10-20
**Author:** Claude Code (Sonnet 4.5)
**Context:** Code Review Session - Member Management Regression
