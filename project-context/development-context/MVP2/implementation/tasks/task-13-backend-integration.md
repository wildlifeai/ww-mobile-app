# Task 13: Backend Integration Guide

## Overview
This document provides detailed instructions for integrating the Project Member Management UI with the backend services once the database functions are implemented.

## Backend Prerequisites

### Required Database Functions (from task-13-backend-spec.md)
1. `get_organisation_users(p_organisation_id UUID, p_requesting_user_id UUID)`
2. `add_project_member(p_project_id UUID, p_user_id UUID, p_role TEXT, p_granted_by UUID)`
3. `update_project_member_role(p_project_id UUID, p_user_id UUID, p_new_role TEXT, p_updated_by UUID)`
4. `remove_project_member(p_project_id UUID, p_user_id UUID, p_removed_by UUID)`
5. `get_project_members(p_project_id UUID, p_requesting_user_id UUID)`

### Required RLS Policies
- Organization user pool viewing (project admins only)
- Project member management (project admins only)
- Audit logging for all operations

## Integration Steps

### 1. Service Layer (READY - No Changes Required)
File: `src/services/ProjectMemberService.ts`

**Status**: ✅ Complete - Already implements correct RPC function calls

The service layer is **already configured** with the correct Supabase RPC calls:
- `supabase.rpc('get_organisation_users', {...})`
- `supabase.rpc('add_project_member', {...})`
- `supabase.rpc('update_project_member_role', {...})`
- `supabase.rpc('remove_project_member', {...})`
- `supabase.rpc('get_project_members', {...})`

**No changes needed** - service layer will work once backend functions are deployed.

### 2. UI Layer Integration
File: `src/screens/ProjectMembersScreen.tsx`

**Current State**: Using mock data via `mockApiResponses`

**Required Changes**: Replace mock calls with real service calls

#### A. Import Real Service Functions

**Current (Line 34-48)**:
```typescript
// Mock data (will be replaced with real service calls)
import {
  mockProjectMembers,
  mockOrganizationUsers,
  mockCurrentUser,
  getRoleBadgeColor,
  getRoleDisplayName,
  getRoleDescription,
  canAddMembers,
  canRemoveMembers,
  canChangeRoles,
  canRemoveSpecificMember,
  getAvailableUsers,
  mockApiResponses,
} from '../mocks/projectMembers';
```

**Replace with**:
```typescript
// Real service integration
import {
  getOrganizationUsers,
  getProjectMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  isProjectAdmin,
} from '../services/ProjectMemberService';

// Keep UI helpers from mocks
import {
  getRoleBadgeColor,
  getRoleDisplayName,
  getRoleDescription,
  canAddMembers,
  canRemoveMembers,
  canChangeRoles,
  canRemoveSpecificMember,
} from '../mocks/projectMembers';

import type { ProjectMember, ProjectRole, OrganizationUser } from '../services/ProjectMemberService';
```

#### B. Replace loadMembers() Function

**Current (Lines 95-113)**:
```typescript
const loadMembers = async () => {
  setLoading(true);
  try {
    // TODO: Replace with actual API call
    // const members = await getProjectMembers(projectId, mockCurrentUser.id);
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API delay
    setMembers(mockProjectMembers);

    // Load available users for adding
    const allUsers = mockOrganizationUsers;
    const available = getAvailableUsers(allUsers, mockProjectMembers);
    setAvailableUsers(available);
  } catch (error) {
    console.error('Error loading members:', error);
    Alert.alert('Error', 'Failed to load project members');
  } finally {
    setLoading(false);
  }
};
```

**Replace with**:
```typescript
const loadMembers = async () => {
  setLoading(true);
  try {
    // Get current user ID from auth context
    const currentUserId = /* TODO: Get from auth context/redux */;
    const organisationId = /* TODO: Get from project or user context */;

    // Fetch project members
    const members = await getProjectMembers(projectId, currentUserId);
    setMembers(members);

    // Fetch organization users for adding
    const allUsers = await getOrganizationUsers(organisationId, currentUserId);

    // Filter out users already in project
    const memberIds = new Set(members.map(m => m.id));
    const available = allUsers.filter(u => !memberIds.has(u.id));
    setAvailableUsers(available);
  } catch (error) {
    console.error('Error loading members:', error);
    Alert.alert('Error', 'Failed to load project members');
  } finally {
    setLoading(false);
  }
};
```

#### C. Replace handleAddMember() Function

**Current (Lines 121-150)**:
```typescript
const handleAddMember = async () => {
  if (!selectedUserId) {
    Alert.alert('Error', 'Please select a user to add');
    return;
  }

  setLoading(true);
  try {
    // TODO: Replace with actual API call
    // const result = await addProjectMember({
    //   project_id: projectId,
    //   user_id: selectedUserId,
    //   role: selectedUserRole,
    //   granted_by: mockCurrentUser.id,
    // });

    await mockApiResponses.addMember(selectedUserId, selectedUserRole);

    Alert.alert('Success', 'Member added successfully');
    setShowAddMemberDialog(false);
    setSelectedUserId(null);
    setSelectedUserRole('project_member');
    await loadMembers();
  } catch (error) {
    console.error('Error adding member:', error);
    Alert.alert('Error', 'Failed to add member');
  } finally {
    setLoading(false);
  }
};
```

**Replace with**:
```typescript
const handleAddMember = async () => {
  if (!selectedUserId) {
    Alert.alert('Error', 'Please select a user to add');
    return;
  }

  setLoading(true);
  try {
    // Get current user ID from auth context
    const currentUserId = /* TODO: Get from auth context/redux */;

    // Call real service
    const result = await addProjectMember({
      project_id: projectId,
      user_id: selectedUserId,
      role: selectedUserRole,
      granted_by: currentUserId,
    });

    if (result.success) {
      Alert.alert('Success', 'Member added successfully');
      setShowAddMemberDialog(false);
      setSelectedUserId(null);
      setSelectedUserRole('project_member');
      await loadMembers();
    } else {
      Alert.alert('Error', result.error || 'Failed to add member');
    }
  } catch (error) {
    console.error('Error adding member:', error);
    Alert.alert('Error', 'Failed to add member');
  } finally {
    setLoading(false);
  }
};
```

#### D. Replace handleChangeRole() Function

**Current (Lines 152-177)**:
```typescript
const handleChangeRole = async () => {
  if (!selectedMember) return;

  setLoading(true);
  try {
    // TODO: Replace with actual API call
    // const result = await updateProjectMemberRole({
    //   project_id: projectId,
    //   user_id: selectedMember.id,
    //   new_role: selectedRole,
    //   updated_by: mockCurrentUser.id,
    // });

    await mockApiResponses.updateRole(selectedMember.id, selectedRole);

    Alert.alert('Success', 'Role updated successfully');
    setShowRoleChangeDialog(false);
    setSelectedMember(null);
    await loadMembers();
  } catch (error) {
    console.error('Error changing role:', error);
    Alert.alert('Error', 'Failed to update role');
  } finally {
    setLoading(false);
  }
};
```

**Replace with**:
```typescript
const handleChangeRole = async () => {
  if (!selectedMember) return;

  setLoading(true);
  try {
    // Get current user ID from auth context
    const currentUserId = /* TODO: Get from auth context/redux */;

    // Call real service
    const result = await updateProjectMemberRole({
      project_id: projectId,
      user_id: selectedMember.id,
      new_role: selectedRole,
      updated_by: currentUserId,
    });

    if (result.success) {
      Alert.alert('Success', 'Role updated successfully');
      setShowRoleChangeDialog(false);
      setSelectedMember(null);
      await loadMembers();
    } else {
      Alert.alert('Error', result.error || 'Failed to update role');
    }
  } catch (error) {
    console.error('Error changing role:', error);
    Alert.alert('Error', 'Failed to update role');
  } finally {
    setLoading(false);
  }
};
```

#### E. Replace handleRemoveMember() Function

**Current (Lines 179-212)**:
```typescript
const handleRemoveMember = async () => {
  if (!selectedMember) return;

  // Check if this is the last admin
  const adminCount = members.filter((m) => m.role === 'project_admin').length;
  const isLastAdmin = selectedMember.role === 'project_admin' && adminCount === 1;

  if (isLastAdmin) {
    Alert.alert('Cannot Remove', 'Cannot remove the last project admin');
    return;
  }

  setLoading(true);
  try {
    // TODO: Replace with actual API call
    // const result = await removeProjectMember({
    //   project_id: projectId,
    //   user_id: selectedMember.id,
    //   removed_by: mockCurrentUser.id,
    // });

    await mockApiResponses.removeMember(selectedMember.id);

    Alert.alert('Success', 'Member removed successfully');
    setShowRemoveDialog(false);
    setSelectedMember(null);
    await loadMembers();
  } catch (error) {
    console.error('Error removing member:', error);
    Alert.alert('Error', 'Failed to remove member');
  } finally {
    setLoading(false);
  }
};
```

**Replace with**:
```typescript
const handleRemoveMember = async () => {
  if (!selectedMember) return;

  // Check if this is the last admin (client-side validation)
  const adminCount = members.filter((m) => m.role === 'project_admin').length;
  const isLastAdmin = selectedMember.role === 'project_admin' && adminCount === 1;

  if (isLastAdmin) {
    Alert.alert('Cannot Remove', 'Cannot remove the last project admin');
    return;
  }

  setLoading(true);
  try {
    // Get current user ID from auth context
    const currentUserId = /* TODO: Get from auth context/redux */;

    // Call real service
    const result = await removeProjectMember({
      project_id: projectId,
      user_id: selectedMember.id,
      removed_by: currentUserId,
    });

    if (result.success) {
      Alert.alert('Success', 'Member removed successfully');
      setShowRemoveDialog(false);
      setSelectedMember(null);
      await loadMembers();
    } else {
      Alert.alert('Error', result.error || 'Failed to remove member');
    }
  } catch (error) {
    console.error('Error removing member:', error);
    Alert.alert('Error', 'Failed to remove member');
  } finally {
    setLoading(false);
  }
};
```

#### F. Update Permission Checks

**Current (Lines 86-88)**:
```typescript
// Permission checks
const currentUserRole = mockCurrentUser.role;
const canManageMembers = canAddMembers(currentUserRole);
```

**Replace with**:
```typescript
// Permission checks
const [currentUserRole, setCurrentUserRole] = useState<ProjectRole>('project_member');

// Load user role on mount
useEffect(() => {
  const checkPermissions = async () => {
    const currentUserId = /* TODO: Get from auth context/redux */;
    const isAdmin = await isProjectAdmin(projectId, currentUserId);
    setCurrentUserRole(isAdmin ? 'project_admin' : 'project_member');
  };
  checkPermissions();
}, [projectId]);

const canManageMembers = canAddMembers(currentUserRole);
```

### 3. Auth Context Integration

**Required**: Get current user ID from auth context

**Options**:
1. **Redux Auth Slice** (recommended):
```typescript
import { useAppSelector } from '../redux';

const currentUserId = useAppSelector((state) => state.authentication.userId);
```

2. **Auth Hook**:
```typescript
import { useAuth } from '../hooks/useAuth';

const { userId } = useAuth();
```

3. **Supabase Session**:
```typescript
import { supabase } from '../services/supabase';

const { data: { session } } = await supabase.auth.getSession();
const currentUserId = session?.user?.id;
```

### 4. Organization Context

**Required**: Get organization ID for fetching user pool

**Options**:
1. From project data (if project includes organisation_id)
2. From user profile in Redux
3. Pass as route param from ProjectDetailsScreen

**Recommended Approach**:
```typescript
// In loadMembers function
const project = /* Get from Redux or query */;
const organisationId = project.organisation_id;
```

## Testing Plan

### Phase 1: Backend Verification
1. ✅ Verify all 5 database functions exist in backend
2. ✅ Test each function with Supabase SQL editor
3. ✅ Verify RLS policies are working correctly
4. ✅ Test audit logging for all operations

### Phase 2: Service Layer Testing
1. ✅ Test `getOrganizationUsers()` with real data
2. ✅ Test `getProjectMembers()` with real data
3. ✅ Test `addProjectMember()` - verify success response
4. ✅ Test `updateProjectMemberRole()` - verify role change
5. ✅ Test `removeProjectMember()` - verify soft delete
6. ✅ Test permission checks (`isProjectAdmin()`, `isWWAdmin()`)

### Phase 3: UI Integration Testing
1. ✅ Navigate to Project Members screen
2. ✅ Verify member list loads correctly
3. ✅ Test add member flow:
   - Search for users
   - Select user
   - Assign role
   - Verify member appears in list
4. ✅ Test change role flow:
   - Open member menu
   - Change role
   - Verify role badge updates
5. ✅ Test remove member flow:
   - Try removing last admin (should fail)
   - Remove non-admin member (should succeed)
   - Verify member disappears from list
6. ✅ Test pull-to-refresh
7. ✅ Test permission-based UI rendering

### Phase 4: Error Handling
1. ✅ Test unauthorized access (non-admin user)
2. ✅ Test network errors
3. ✅ Test backend validation errors
4. ✅ Test last-admin protection
5. ✅ Test duplicate member addition

## Rollback Plan

If backend integration fails, revert to mock data:
1. Restore original imports from `mockApiResponses`
2. Restore mock data in state initialization
3. UI will continue functioning with mock data
4. No breaking changes to navigation or UI components

## Performance Considerations

1. **User Pool Loading**: Organization user pool may be large
   - Consider pagination if org has 100+ users
   - Implement client-side search/filter (already done)

2. **Permission Checks**: Cache user role to avoid repeated RPC calls
   - Load once on screen mount
   - Store in component state

3. **Optimistic Updates**: Consider showing UI changes immediately
   - Update local state first
   - Revert on API error
   - Improves perceived performance

## Security Notes

1. **Client-side validation is NOT security** - all enforcement happens on backend via RLS
2. UI permission checks are for UX only (hiding buttons from non-admins)
3. Backend will reject unauthorized operations even if UI allows them
4. Always handle backend error responses gracefully

## Current Status

- ✅ Backend specification complete and handed off
- ✅ Service layer complete and ready
- ✅ UI complete with mock data
- ✅ Navigation integrated
- ⏳ Waiting for backend database functions
- ⏳ Integration testing pending backend completion

## Backend Task Reference

Backend implementation tracked in:
- `~/wildlife-watcher-backend/project-context/MVP2-Tasks/task-13-backend-spec.md`
- Backend project status: `~/wildlife-watcher-backend/project-context/PROJECT-STATUS.md`

Contact backend team when ready for integration testing.
