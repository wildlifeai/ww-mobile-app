# Task 13 Project Members - Testing Guide

## Prerequisites

### Backend Requirements
- ✅ Backend deployed with 56/56 tests passing
- ✅ Supabase RPC functions available:
  - `get_project_members`
  - `get_organisation_users`
  - `add_project_member`
  - `update_project_member_role`
  - `remove_project_member`

### Mobile App Requirements
- ✅ Redux auth state populated with:
  - `user.id` - Current user UUID
  - `user.role` - One of: `ww_admin`, `project_admin`, `project_member`
  - `currentOrganisation.id` - Organization UUID
  - `currentOrganisation.name` - Organization name

### Test Data Setup
You'll need:
1. **1 Organization** with at least 5 users
2. **1 Project** in that organization
3. **Test Users**:
   - 1 ww_admin (system-wide access)
   - 1 project_admin (full project access)
   - 2 project_members (limited access)
   - 1 user not in project (for adding)

## Test Scenarios

### 1. Initial Load Test ✅

**Test**: Navigate to Project Members screen

**Expected Behavior**:
- Loading indicator appears briefly
- Member list displays all current project members
- Each member shows:
  - Name and email
  - Role badge (Admin = green, Member = blue)
  - Avatar with initials
- Member count displays correctly in header
- No console errors

**Console Output**:
```
📋 Loading members for project: {projectId}
✅ Loaded {N} project members
✅ Loaded {M} available users
```

---

### 2. Permission Visibility Tests ✅

#### Test 2A: As Project Admin
**Login as**: project_admin user

**Expected Behavior**:
- ✅ "Add Member" button visible
- ✅ Three-dot menu appears on each member card
- ✅ Menu shows "Change Role" option
- ✅ Menu shows "Remove from Project" option (except last admin)

#### Test 2B: As Project Member
**Login as**: project_member user

**Expected Behavior**:
- ❌ "Add Member" button hidden
- ❌ No three-dot menu on member cards
- ✅ Can view all member details
- ✅ Can refresh list (pull to refresh)

#### Test 2C: As WW Admin
**Login as**: ww_admin user

**Expected Behavior**:
- ✅ "Add Member" button visible
- ✅ Full management capabilities
- ✅ Can modify any member (except last admin removal)

---

### 3. Add Members Test ✅

**Test**: Add new members to project

**Steps**:
1. Login as project_admin or ww_admin
2. Tap "Add Member" button
3. Full-screen modal appears
4. Search for users in organization
5. Select 2-3 users via checkboxes
6. Choose role (Member or Admin)
7. Tap "Add {N}" button

**Expected Behavior**:
- ✅ Modal shows all organization users not in project
- ✅ Search filters by name and email
- ✅ "Select All" checkbox works
- ✅ Selected count appears in button: "Add 3"
- ✅ Role selection uses green segmented buttons
- ✅ After adding, modal closes
- ✅ Success alert: "{N} members added successfully"
- ✅ Member list refreshes automatically
- ✅ Added users appear with correct role badges

**Console Output**:
```
➕ Adding 3 members...
✅ Loaded {N+3} project members
✅ Loaded {M-3} available users
```

**Edge Cases**:
- ❌ Cannot add if no users selected (disabled button)
- ⚠️ Partial failures reported: "2 members could not be added"
- ✅ Users removed from available list after adding

---

### 4. Change Role Test ✅

**Test**: Promote member to admin / demote admin to member

**Steps**:
1. Login as project_admin or ww_admin
2. Tap three-dot menu on a member card
3. Tap "Promote to Admin" or "Change to Member"
4. Confirmation dialog appears
5. Review current role → new role
6. Tap "Change Role"

**Expected Behavior**:
- ✅ Dialog shows role transition clearly
- ✅ Role description displayed
- ✅ After confirming, success alert appears
- ✅ Member list refreshes
- ✅ Role badge updates to new role color
- ✅ Menu text updates ("Promote" ↔ "Change to Member")

**Console Output**:
```
🔄 Changing role for {userName}...
✅ Loaded {N} project members
```

**Edge Cases**:
- ✅ Can toggle admin ↔ member multiple times
- ✅ Backend enforces permission checks

---

### 5. Remove Member Test ✅

**Test**: Remove non-admin member from project

**Steps**:
1. Login as project_admin or ww_admin
2. Tap three-dot menu on a project_member card
3. Tap "Remove from Project" (red text)
4. Confirmation dialog appears with warning
5. Tap "Remove"

**Expected Behavior**:
- ✅ Dialog shows user name and warning message
- ✅ Warning: "This action cannot be undone"
- ✅ After confirming, success alert appears
- ✅ Member list refreshes
- ✅ Removed user disappears from list
- ✅ User appears in "Add Members" available list

**Console Output**:
```
➖ Removing member {userName}...
✅ Loaded {N-1} project members
✅ Loaded {M+1} available users
```

---

### 6. Last Admin Protection Test ✅

**Test**: Attempt to remove the only project admin

**Setup**: Ensure project has only 1 project_admin

**Steps**:
1. Login as project_admin or ww_admin
2. Tap three-dot menu on the only admin
3. Observe menu options

**Expected Behavior**:
- ✅ Menu shows disabled option: "Last Admin (Cannot Remove)"
- ✅ "Remove from Project" option not present
- ❌ Cannot remove last admin
- ✅ Can still change role to member (then another admin needed)

**Alternative Flow**:
1. Try to change last admin to member
2. Attempt to remove
3. ❌ Alert: "Cannot remove the last project admin"

---

### 7. Organization Filtering Test ✅

**Test**: Verify users from other organizations don't appear

**Setup**: Have 2+ organizations with projects

**Steps**:
1. Login to Organization A
2. Navigate to Project Members in Org A
3. Tap "Add Member"
4. Observe available users

**Expected Behavior**:
- ✅ Only Organization A users appear
- ❌ Organization B users not shown
- ✅ Search only finds Org A users
- ✅ Backend enforces org-scoped queries

---

### 8. Refresh Test ✅

**Test**: Pull to refresh member list

**Steps**:
1. Navigate to Project Members
2. Pull down to refresh

**Expected Behavior**:
- ✅ Loading indicator appears
- ✅ Member list updates
- ✅ No duplicate members
- ✅ Console logs show new fetch

**Console Output**:
```
📋 Loading members for project: {projectId}
✅ Loaded {N} project members
✅ Loaded {M} available users
```

---

### 9. Error Handling Tests ⚠️

#### Test 9A: Network Failure
**Simulate**: Disable network or stop Supabase

**Expected Behavior**:
- ❌ Alert: "Failed to load project members"
- ❌ Console error logged
- ✅ App doesn't crash
- ✅ Can retry via pull to refresh

#### Test 9B: Invalid User Context
**Simulate**: Clear Redux auth state

**Expected Behavior**:
- ❌ Alert: "User authentication required"
- ❌ Operations blocked
- ✅ Redirected to login (if navigation configured)

#### Test 9C: Backend Permission Denial
**Simulate**: Login as user without org access

**Expected Behavior**:
- ❌ Backend returns permission error
- ❌ Alert with error message
- ✅ No unauthorized data shown

---

### 10. Batch Operations Test ✅

**Test**: Add multiple members simultaneously

**Steps**:
1. Tap "Add Member"
2. Select 5+ users
3. Tap "Add 5"
4. Observe batch processing

**Expected Behavior**:
- ✅ All API calls fire in parallel (`Promise.all()`)
- ✅ Loading indicator shows during processing
- ✅ Success/failure count reported
- ⚠️ Partial failures handled gracefully
- ✅ Only successful adds appear in list

**Performance**:
- 5 members should add in <3 seconds (network dependent)

---

### 11. Search Functionality Test ✅

**Test**: Search for users in Add Member modal

**Steps**:
1. Tap "Add Member"
2. Type in search box:
   - Partial name: "john"
   - Email: "@example.com"
   - Mixed case: "JOHN"

**Expected Behavior**:
- ✅ Real-time filtering (no submit button)
- ✅ Case-insensitive search
- ✅ Matches name OR email
- ✅ Empty state: "No users found"
- ✅ Clear search icon works

---

### 12. UI/UX Validation ✅

**Visual Tests**:
- ✅ Dark text in search box (black on white)
- ✅ Green theme for role selection (#4CAF50)
- ✅ Proper spacing and padding
- ✅ Avatar colors match role (green=admin, blue=member)
- ✅ Chip badges show correct role names
- ✅ Menu items have appropriate icons
- ✅ Red text for destructive actions

**Accessibility**:
- ✅ Buttons have clear labels
- ✅ Alerts provide user feedback
- ✅ Loading states prevent double-taps
- ✅ Error messages are descriptive

---

## Console Monitoring

### Expected Log Patterns

**Successful Operation**:
```
📋 Loading members for project: abc-123
✅ Loaded 5 project members
✅ Loaded 10 available users
```

**Add Members**:
```
➕ Adding 3 members...
✅ Loaded 8 project members
✅ Loaded 7 available users
```

**Change Role**:
```
🔄 Changing role for John Doe...
✅ Loaded 8 project members
```

**Remove Member**:
```
➖ Removing member Jane Smith...
✅ Loaded 7 project members
✅ Loaded 8 available users
```

**Error**:
```
❌ Error loading members: [error details]
❌ Missing user or organization context
```

---

## Backend Response Samples

### Successful Operation
```json
{
  "success": true,
  "user_id": "user-uuid",
  "project_id": "project-uuid",
  "role": "project_member"
}
```

### Failed Operation
```json
{
  "success": false,
  "user_id": "user-uuid",
  "project_id": "project-uuid",
  "error": "User is already a member of this project"
}
```

### Member List Response
```json
[
  {
    "id": "user-uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "project_admin",
    "granted_at": "2025-10-11T10:00:00Z",
    "granted_by": "admin-uuid",
    "granted_by_name": "Admin User"
  }
]
```

---

## Performance Benchmarks

| Operation | Expected Duration | Network Calls |
|-----------|-------------------|---------------|
| Initial Load | <2s | 2 (members + org users) |
| Add 1 Member | <1.5s | 3 (add + refresh) |
| Add 5 Members | <3s | 7 (5 adds + refresh) |
| Change Role | <1.5s | 3 (update + refresh) |
| Remove Member | <1.5s | 3 (remove + refresh) |
| Refresh | <2s | 2 (members + org users) |

---

## Bug Reporting Template

If you find issues, report with:

```markdown
### Issue Description
[What went wrong?]

### Steps to Reproduce
1. Login as: [role]
2. Navigate to: [screen]
3. Perform action: [what you did]

### Expected Behavior
[What should happen?]

### Actual Behavior
[What actually happened?]

### Console Output
```
[Paste relevant console logs]
```

### Environment
- Device: [iOS/Android/Simulator]
- App Version: [version]
- Backend Status: [check backend tests]

### Screenshots
[Attach if applicable]
```

---

## Success Criteria

All tests pass when:
- ✅ Members load without errors
- ✅ Permissions enforce correctly by role
- ✅ CRUD operations complete successfully
- ✅ Error handling prevents crashes
- ✅ Organization filtering works
- ✅ UI matches design specifications
- ✅ Console logs show expected patterns
- ✅ Performance meets benchmarks

---

## Next Steps After Testing

1. **If All Tests Pass**:
   - Mark Task 13 as complete
   - Update metrics tracker
   - Merge to main branch
   - Deploy to staging

2. **If Issues Found**:
   - Document bugs using template above
   - Create GitHub issues for tracking
   - Prioritize fixes by severity
   - Retest after fixes deployed

3. **Integration Testing**:
   - Test with Task 11 (Project Management)
   - Test with Task 12 (User Profile)
   - Test multi-org switching
   - Test offline behavior (future)

---

## Testing Completion Checklist

Mark each test as completed:

- [ ] Initial Load Test
- [ ] Permission Visibility (3 roles)
- [ ] Add Members (single + batch)
- [ ] Change Role (promote + demote)
- [ ] Remove Member
- [ ] Last Admin Protection
- [ ] Organization Filtering
- [ ] Refresh Functionality
- [ ] Error Handling (3 scenarios)
- [ ] Batch Operations
- [ ] Search Functionality
- [ ] UI/UX Validation

**Tester**: ___________________
**Date**: ___________________
**Pass/Fail**: ___________________
**Notes**: ___________________
