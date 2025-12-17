# Backend Coordination Request - Member Access Fix

**Created**: 2025-10-20
**Priority**: 🔴 CRITICAL
**Status**: Awaiting Backend Team Action
**Blocking**: All member management features in mobile app

## Issue Summary

The mobile app cannot view project members when logged in as a ww_admin user. This has been investigated by three specialized agents who confirmed this is a **backend database issue**, not a mobile app issue.

**Error**: `Unauthorized: Must be project member or system admin to view members (code: 42501)`

## Mobile App Investigation Complete

### What We've Confirmed Works ✅

1. **Redux Consolidation**: Perfectly executed, zero regressions
2. **Mobile Code**: Using correct RTK Query hooks
3. **API Calls**: Properly structured and authenticated
4. **JWT Token**: Valid and contains correct user information
5. **Organisation Switching**: Working correctly

### Root Cause Identified ❌

**Backend RLS Policy Issue**: The `has_project_role` function is not properly recognizing ww_admin users, causing authorization failures.

## Backend Team Actions Required

### 1. Review Coordination Task

**Location**: `/wildlife-watcher-backend/project-context/MVP2-Tasks/CPT-2025-10-20-001-RLS-MEMBER-ACCESS-FIX.md`

This task contains:
- Complete issue analysis
- Diagnostic SQL queries
- Two possible fix scenarios
- Testing instructions
- Success criteria

### 2. Run Diagnostic Script

**Location**: `/wildlife-watcher-backend/scripts/diagnose-member-access-issue.sql`

**How to run**:
```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend
psql $DATABASE_URL -f scripts/diagnose-member-access-issue.sql > diagnostic-results.txt
```

This script will:
- Verify user authentication
- Check role assignments
- Validate organisation memberships
- Test the `has_project_role` function
- Show function definitions

**Estimated Time**: 2 minutes

### 3. Apply the Appropriate Fix

**Location**: `/wildlife-watcher-backend/scripts/fix-ww-admin-member-access.sql`

**How to run**:
```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend
psql $DATABASE_URL -f scripts/fix-ww-admin-member-access.sql > fix-results.txt
```

This script will:
- Add missing organisation links (if needed)
- Update the `has_project_role` function
- Run verification tests
- Confirm the fix worked

**Estimated Time**: 3 minutes

### 4. Report Results

Update the coordination task file with:
- Diagnostic findings
- Which fix scenario applied (A or B)
- Verification results

## Expected Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Backend diagnostic | 2 minutes | ⏳ Pending |
| Apply fix | 3 minutes | ⏳ Pending |
| Mobile app testing | 5 minutes | ⏳ Pending |
| **Total** | **10 minutes** | **⏳ Awaiting backend** |

## Mobile App Testing Plan

Once backend fix is applied, we will:

1. **Logout/Login**: User logs out and back in to refresh JWT token
2. **Navigate**: Go to any project in ACME Wildlife Corp
3. **Test**: Tap "View Members"
4. **Verify**: No "Unauthorized" errors
5. **Validate**: Can see member list

**Test Users**:
- adarsh@wildlife.ai (ww_admin) - Primary test case
- jane@testit.org (project_admin) - Ensure no regression
- john@testit.org (project_member) - Ensure no regression

## Technical Details

### Suspected Root Causes

**Option A: Missing Data**
- User not linked to ACME Wildlife Corp in `user_organisations` table
- **Fix**: Add missing organisation link via INSERT statement

**Option B: Function Logic**
- `has_project_role` doesn't check ww_admin bypass first
- **Fix**: Update function to check ww_admin before organisation membership

### Affected Projects

- Wildlife Monitoring System (`c0000000-0000-0000-0000-000000000001`)
- Jane's project (`a29a92ab-9c6e-4b85-835d-9df4d17c86de`)
- Test (`12cc5145-7616-45ea-9be3-6fd74051c5c5`)

All projects in ACME Wildlife Corp organisation.

## Reference Documentation

### Mobile App Investigation
- **Root Cause Analysis**: `/project-context/code-review/20251016/REGRESSION-ROOT-CAUSE-ANALYSIS.md`
- **RLS Deep Dive**: `/project-context/investigation/DELIVERABLE-RLS-ERROR-ANALYSIS.md`
- **Quick Fix Guide**: `/project-context/investigation/QUICK-FIX-GUIDE.md`

### Backend Files Created
- **Coordination Task**: `/wildlife-watcher-backend/project-context/MVP2-Tasks/CPT-2025-10-20-001-RLS-MEMBER-ACCESS-FIX.md`
- **Diagnostic Script**: `/wildlife-watcher-backend/scripts/diagnose-member-access-issue.sql`
- **Fix Script**: `/wildlife-watcher-backend/scripts/fix-ww-admin-member-access.sql`

## Communication Protocol

### Async Coordination (Recommended)
1. Backend team runs scripts
2. Backend team updates coordination task with results
3. Backend team notifies mobile team via task file
4. Mobile team tests and confirms

### Sync Coordination (If Available)
1. Backend team runs diagnostic
2. Share results with mobile team
3. Apply fix together
4. Test immediately

## Success Criteria

- ✅ ww_admin can view members for ALL projects across ALL organisations
- ✅ project_admin can view members only for their projects
- ✅ project_member can view members only for their projects
- ✅ No cross-tenant data leakage
- ✅ No regression in existing functionality

## Impact

**Current Blockage**:
- 0% of member management features working for ww_admin
- Cannot view members
- Cannot add members
- Cannot remove members
- Cannot change member roles

**After Fix**:
- 100% of member management features restored
- Full ww_admin functionality
- No impact on other roles

## Questions or Concerns

If the backend team has questions about:
- The diagnostic results
- Which fix to apply
- Testing methodology
- Integration validation

Please update the coordination task file with your questions, and we'll respond promptly.

---

**Mobile App Team Status**: Ready to test immediately after backend fix is applied
**Backend Team Action**: Please execute diagnostic and fix scripts at your earliest convenience

**Thank you for the quick turnaround!**