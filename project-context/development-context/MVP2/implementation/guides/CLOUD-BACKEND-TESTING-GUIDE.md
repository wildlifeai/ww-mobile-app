# Cloud Backend Testing Guide - Task 13 Redux Fix Validation

**Branch**: `dev-mvp2-development`
**Date**: 2025-01-11
**Purpose**: Validate Redux architecture fix and Task 13 integration with live Supabase backend

---

## 🎯 Testing Objectives

1. **Verify Redux Fix**: Confirm all 5 critical bugs are resolved
2. **Validate Task 13**: Test project member management with real backend
3. **Check Organisation Filtering**: Ensure proper multi-tenancy
4. **Test Permissions**: Verify role-based access control works
5. **Confirm Zero Regressions**: Existing features still work

---

## 📋 Pre-Testing Checklist

### 1. Backend Verification
- [ ] Backend deployed to Supabase (you confirmed this ✅)
- [ ] All 5 RPC functions deployed:
  - `get_project_members(project_id, user_id)`
  - `get_organization_users(org_id, user_id)`
  - `add_project_member(project_id, user_id, role, granted_by)`
  - `update_project_member_role(project_id, user_id, new_role, updated_by)`
  - `remove_project_member(project_id, user_id, removed_by)`
- [ ] RLS policies active (56/56 tests passing on backend)

### 2. Mobile App Configuration
```bash
# Check your .env or app configuration has correct Supabase credentials
# Look for:
# - EXPO_PUBLIC_SUPABASE_URL
# - EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### 3. App Preparation
```bash
# Clean install to ensure latest code
rm -rf node_modules
npm install

# Clear Metro bundler cache
npx expo start --clear

# Or if using bare workflow:
npm run android  # or ios
```

---

## 🧪 Testing Scenarios

### **Scenario 1: Redux Store Verification**
**Goal**: Confirm single Redux store is active and middleware registered

**Steps**:
1. Open React Native Debugger or Chrome DevTools
2. Navigate to Redux DevTools
3. Check state structure

**Expected Results**:
```javascript
{
  authentication: { ... },
  projects: { projects: [], loading: false },
  deployments: { deployments: [], loading: false },
  offline: { queue: [], isOnline: true },
  sync: { status: 'idle', lastSync: null },
  network: { isConnected: true },
  // ... other slices
}
```

**Verification**:
- [ ] ✅ Single Redux store (no duplicate state)
- [ ] ✅ `offline`, `sync`, `network` slices present
- [ ] ✅ No errors in console about middleware

---

### **Scenario 2: Authentication & Organisation Context**
**Goal**: Verify user and organisation state loads correctly

**Steps**:
1. Launch app
2. Sign in with your test account
3. Check Redux state for authentication

**Expected Results**:
```javascript
authentication: {
  user: {
    id: "uuid-here",
    email: "test@example.com",
    role: "ww_admin" | "project_admin" | "project_member"
  },
  currentOrganisation: {
    id: "org-uuid",
    name: "Your Organisation"
  },
  isAuthenticated: true
}
```

**Verification**:
- [ ] ✅ User object populated
- [ ] ✅ Organisation object populated
- [ ] ✅ Role correctly set
- [ ] ✅ No console errors

---

### **Scenario 3: Project List Loading (Redux Fix Test)**
**Goal**: Verify projects slice no longer filters out ALL projects

**Critical Bug Being Tested**:
- **Before**: `(state as any).authentication` was `undefined`, filtered out all projects
- **After**: Projects correctly filtered by organisation

**Steps**:
1. Navigate to Projects screen
2. Observe project list

**Expected Results**:
- **If `ww_admin`**: See all projects across all organisations
- **If `project_admin` or `project_member`**: See only projects in your current organisation

**Verification**:
- [ ] ✅ Projects load and display (not empty list)
- [ ] ✅ Organisation filtering works correctly
- [ ] ✅ No console errors about authentication state
- [ ] ✅ Check Redux DevTools shows `projects.projects` array populated

**Console Logs to Check**:
```
✅ Should see: "Loading projects for organisation: [org-id]"
❌ Should NOT see: "undefined organisation" errors
```

---

### **Scenario 4: Task 13 - Load Project Members**
**Goal**: Test real backend integration for member list

**Steps**:
1. Navigate to Projects screen
2. Select a project that has members
3. Tap "Manage Members" or navigation to ProjectMembersScreen
4. Observe member list loading

**Expected Results**:
- Loading indicator appears briefly
- Member list populates with real data from backend
- Each member shows:
  - Name
  - Email
  - Role (ww_admin, project_admin, project_member)
  - Organisation affiliation

**Verification**:
- [ ] ✅ Members load from backend (not mock data)
- [ ] ✅ Loading states work correctly
- [ ] ✅ Member data displays properly
- [ ] ✅ No console errors

**Console Logs to Check**:
```bash
# Expected logs:
📋 Loading members for project: [project-id]
✅ Loaded X project members
✅ Loaded Y available users

# Should NOT see:
❌ "Missing user or organization context"
❌ "Failed to load project members"
❌ Mock data references
```

---

### **Scenario 5: Add Project Members**
**Goal**: Test backend integration for adding members

**Steps**:
1. On ProjectMembersScreen, tap "Add Members" button
2. Search for a user in your organisation
3. Select user(s) and assign role
4. Tap "Add Selected Members"

**Expected Results**:
- Available users load from `get_organization_users()`
- Only users from current organisation appear
- After adding, success message appears
- Member list refreshes with new member

**Verification**:
- [ ] ✅ Search/filter works
- [ ] ✅ User list loads from backend
- [ ] ✅ Adding member succeeds
- [ ] ✅ Member appears in list immediately
- [ ] ✅ Success alert shows count: "X members added successfully"

**Console Logs to Check**:
```bash
# Expected:
➕ Adding 1 members...
✅ Member added successfully

# Backend verification:
# Check Supabase dashboard → project_members table
# New row should appear with correct user_id, role, granted_by
```

---

### **Scenario 6: Update Member Role**
**Goal**: Test role change functionality

**Steps**:
1. On member list, tap a member's role chip
2. Select new role (e.g., change from `project_member` to `project_admin`)
3. Confirm change

**Expected Results**:
- Role update succeeds
- Member's role chip updates immediately
- Success message appears

**Verification**:
- [ ] ✅ Role change succeeds
- [ ] ✅ UI updates immediately
- [ ] ✅ Change persists (refresh screen, role still updated)

**Console Logs to Check**:
```bash
🔄 Updating member role to: project_admin
✅ Role updated successfully
```

---

### **Scenario 7: Remove Member**
**Goal**: Test member removal with last admin protection

**Test 7a: Remove Regular Member**:
1. Select a non-admin member
2. Tap remove/delete
3. Confirm removal

**Expected**: Member removed successfully

**Test 7b: Try Remove Last Admin**:
1. If project has only 1 admin
2. Try to remove that admin
3. Should be blocked with error

**Verification**:
- [ ] ✅ Regular member removal works
- [ ] ✅ Last admin protection prevents removal
- [ ] ✅ Error message shows: "Cannot remove last project admin"

**Console Logs**:
```bash
# Regular removal:
➖ Removing member: [user-id]
✅ Member removed successfully

# Last admin protection:
❌ Cannot remove last project admin
```

---

### **Scenario 8: Organisation Filtering (Multi-Tenancy)**
**Goal**: Verify data isolation between organisations

**Prerequisites**: You need access to 2 organisations or a `ww_admin` account

**Test 8a: Non-Admin User**:
1. Sign in as `project_admin` or `project_member`
2. Check ProjectMembersScreen available users
3. Should ONLY see users from current organisation

**Test 8b: WW Admin**:
1. Sign in as `ww_admin`
2. Check member management
3. Should see all users (global access)

**Verification**:
- [ ] ✅ Regular users see only their org's users
- [ ] ✅ WW Admin sees all users
- [ ] ✅ No cross-organisation data leakage

---

### **Scenario 9: Permission Checks**
**Goal**: Verify role-based access control

**Test Permissions**:
| Role | Can View Members | Can Add Members | Can Remove Members | Can Change Roles |
|------|-----------------|-----------------|-------------------|------------------|
| `project_member` | ✅ | ❌ | ❌ | ❌ |
| `project_admin` | ✅ | ✅ | ✅ | ✅ |
| `ww_admin` | ✅ | ✅ | ✅ | ✅ |

**Steps**:
1. Test with `project_member` account
   - Should see member list
   - Should NOT see "Add Members" button
   - Should NOT see remove/edit options

2. Test with `project_admin` account
   - Should see all management options
   - Should be able to add/remove/edit

**Verification**:
- [ ] ✅ UI correctly hides admin features for members
- [ ] ✅ Backend rejects unauthorized operations
- [ ] ✅ Appropriate error messages shown

---

### **Scenario 10: Error Handling**
**Goal**: Verify graceful error handling

**Test Cases**:
1. **Network Error**: Turn off WiFi mid-operation
2. **Invalid User**: Try to add user who doesn't exist
3. **Duplicate Member**: Try to add user who's already a member
4. **Permission Denied**: Try admin action as regular member

**Expected Results**:
- Friendly error messages (not crash)
- Loading states resolve
- User can retry operation

**Verification**:
- [ ] ✅ App doesn't crash on errors
- [ ] ✅ Error messages are user-friendly
- [ ] ✅ Loading states clear after errors

---

### **Scenario 11: Redux Regression Check**
**Goal**: Ensure existing features still work

**Quick Checks**:
1. **Project Creation**: Create a new project
   - Should work via RTK Query (independent of Redux slices)
   - Should appear in project list

2. **Deployment Operations**: If you have deployments
   - List deployments
   - Create deployment
   - Should use fixed Redux slice

3. **Offline Sync**:
   - Check `offlineSyncMiddleware` registered
   - Turn off network
   - Make changes
   - Turn on network
   - Changes should sync

**Verification**:
- [ ] ✅ Project creation works
- [ ] ✅ Deployments work (if applicable)
- [ ] ✅ Offline sync functional
- [ ] ✅ Background sync active

---

## 🔍 What to Look For

### ✅ Success Indicators

**Console Logs**:
```bash
✅ Loaded X project members
✅ Loaded Y available users
✅ Member added successfully
✅ Role updated successfully
✅ Member removed successfully
```

**Redux DevTools**:
- State updates correctly
- No duplicate stores
- Middleware actions appear

**UI Behavior**:
- Loading states work
- Data loads from backend
- Success/error messages display
- Optimistic updates work

### ❌ Failure Indicators

**Console Errors**:
```bash
❌ Missing user or organization context
❌ Failed to load project members
❌ (state as any).authentication references
❌ Middleware not registered
❌ Duplicate store warnings
```

**UI Issues**:
- Empty lists when data should exist
- Infinite loading states
- App crashes
- No error messages on failures

---

## 📊 Testing Checklist Summary

### Critical Redux Fixes
- [ ] ✅ Single Redux store (no `src/store` conflict)
- [ ] ✅ Projects slice works (doesn't filter all projects)
- [ ] ✅ Deployments slice works (operations not blocked)
- [ ] ✅ Middleware registered (offline sync active)
- [ ] ✅ Supabase imports work (no test failures)

### Task 13 Integration
- [ ] ✅ Load project members (real backend)
- [ ] ✅ Load organisation users (real backend)
- [ ] ✅ Add members (single & batch)
- [ ] ✅ Update member roles
- [ ] ✅ Remove members (with last admin protection)

### Organisation & Permissions
- [ ] ✅ Organisation filtering works
- [ ] ✅ Role-based UI rendering
- [ ] ✅ Permission checks enforced
- [ ] ✅ WW Admin global access

### Quality Checks
- [ ] ✅ No console errors
- [ ] ✅ Error handling graceful
- [ ] ✅ Loading states work
- [ ] ✅ Existing features unaffected

---

## 🐛 Troubleshooting Guide

### Problem: "Missing user or organization context"
**Cause**: Authentication state not loaded properly
**Fix**:
1. Check Redux state for `authentication.user` and `authentication.currentOrganisation`
2. Ensure `selectCurrentUser` and `selectCurrentOrganisation` selectors work
3. Verify auth flow completes before navigating to ProjectMembersScreen

### Problem: Empty project list (but projects exist)
**Cause**: Organisation filtering issue
**Fix**:
1. Check `authentication.currentOrganisation.id` is set
2. Verify projects in Supabase have correct `organisation_id`
3. Check console for filtering logs

### Problem: "Cannot read property 'authentication' of undefined"
**Cause**: Old Redux bug still present
**Fix**:
1. Verify you're on `dev-mvp2-development` branch
2. Check `projectsSlice.ts` uses `AuthContext` pattern
3. Clear Metro cache: `npx expo start --clear`

### Problem: Backend functions return 401/403
**Cause**: RLS policies rejecting requests
**Fix**:
1. Verify backend RLS policies deployed
2. Check JWT token valid in request
3. Test with `ww_admin` account (should bypass most RLS)

### Problem: Members don't load
**Cause**: Backend integration issue
**Fix**:
1. Check Supabase function logs for errors
2. Verify function names correct: `get_project_members`, `get_organization_users`
3. Test functions directly in Supabase SQL editor

---

## 📝 Test Results Template

**Copy this for your testing report**:

```markdown
# Task 13 Redux Fix - Cloud Backend Test Results

**Date**: 2025-01-11
**Tester**: [Your Name]
**Device**: [Android/iOS]
**Backend**: Supabase Cloud Dev Environment

## Redux Fix Verification
- [ ] Single Redux store confirmed
- [ ] Projects load correctly (not filtered out)
- [ ] Deployments work (if applicable)
- [ ] Middleware registered and active
- [ ] No console errors about Redux

## Task 13 Member Management
- [ ] Load project members: ✅ / ❌
- [ ] Load organisation users: ✅ / ❌
- [ ] Add members: ✅ / ❌
- [ ] Update roles: ✅ / ❌
- [ ] Remove members: ✅ / ❌
- [ ] Last admin protection: ✅ / ❌

## Permissions & Organisation
- [ ] Organisation filtering: ✅ / ❌
- [ ] Role-based UI: ✅ / ❌
- [ ] Permission enforcement: ✅ / ❌
- [ ] WW Admin access: ✅ / ❌ / N/A

## Issues Found
1. [Describe any issues]

## Notes
[Any observations or recommendations]

## Overall Result
✅ PASS / ❌ FAIL / ⚠️  PARTIAL
```

---

## 🚀 Next Steps After Testing

### If Tests Pass ✅
1. Document results
2. Commit test validation log
3. Proceed to Task 14 (Organisation Switching)
4. Consider PR for production branch

### If Tests Fail ❌
1. Document specific failures
2. Share console logs and error messages
3. I'll help debug and fix issues
4. Re-test after fixes

---

**Ready to test?** Start with Scenarios 1-3 to verify the Redux fix, then move to Task 13 scenarios (4-7). Report back your findings!
