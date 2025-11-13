# Quick Fix: ProjectMembersScreen Import Issue

## Problem
Line 152-153 in `src/screens/ProjectMembersScreen.tsx` incorrectly destructures a method from a singleton service instance, causing runtime error: `getProjectById is not a function (it is undefined)`.

## Root Cause
```typescript
// ❌ INCORRECT - Destructuring loses 'this' binding
const { getProjectById } = await import('../services/ProjectService');
const project = await getProjectById(projectId);
```

ProjectService exports a singleton instance, not a class. Destructuring methods from the instance loses the `this` context.

## Solution Option 1: Use Default Import (Quickest)

### Location
**File**: `src/screens/ProjectMembersScreen.tsx`
**Line**: 64 (add import)
**Lines**: 152-153 (modify usage)

### Changes Required

**Add import at top of file (after line 63)**:
```typescript
import ProjectService from '../services/ProjectService';
```

**Replace lines 152-153**:
```typescript
// OLD (lines 152-153) ❌
const { getProjectById } = await import('../services/ProjectService');
const project = await getProjectById(projectId);

// NEW ✅
const project = await ProjectService.getProjectById(projectId);
```

### Full Context
```typescript
const loadMembers = async () => {
  if (!user) {
    console.error('❌ Missing user context');
    Alert.alert('Error', 'User authentication required');
    return;
  }

  setLoading(true);
  try {
    console.log('📋 Loading members for project:', projectId);

    // Load project members (with authorization handling)
    let members: ProjectMember[] = [];
    try {
      members = await getProjectMembers(projectId, user.id);
      setMembers(members);
      console.log(`✅ Loaded ${members.length} project members`);
    } catch (error: any) {
      if (error?.message?.includes('Unauthorized')) {
        console.log('⚠️ User not authorized to view project members');
        setMembers([]);
        setAvailableUsers([]);
        return;
      }
      throw error;
    }

    // ✅ FIX: Use default import instead of destructuring
    const project = await ProjectService.getProjectById(projectId);

    if (!project?.organisation_id) {
      console.error('❌ Project has no organisation_id');
      return;
    }

    // Load available users from PROJECT'S organization
    const orgUsers = await getOrganizationUsers(project.organisation_id, user.id);
    // ... rest of implementation
  }
};
```

## Solution Option 2: Use RTK Query Hook (Best Practice)

### Benefits
- ✅ Consistent with rest of codebase (ProjectDetailsScreen uses this)
- ✅ Automatic caching and refetching
- ✅ Loading states handled by RTK Query
- ✅ No manual error handling needed

### Changes Required

**Add import at line 64**:
```typescript
import { useGetProjectByIdQuery } from '../redux/api/projectsApi';
```

**Modify component to use hook**:
```typescript
export const ProjectMembersScreen: React.FC = () => {
  const route = useRoute<RouteProp<{ params: RouteParams['params'] }, 'params'>>();
  const navigation = useNavigation();
  const theme = useTheme();

  const { projectId, projectName } = route.params || {};

  // ✅ ADD: Query for project details
  const { data: project, isLoading: projectLoading } = useGetProjectByIdQuery(projectId);

  // Redux selectors
  const user = useAppSelector(selectCurrentUser);
  const currentOrg = useAppSelector(selectCurrentOrganisation);

  // ... rest of state

  // Load data - Modified to use project from hook
  useEffect(() => {
    if (project?.organisation_id) {
      loadMembers();
    }
  }, [projectId, project?.organisation_id]);

  const loadMembers = async () => {
    if (!user) {
      console.error('❌ Missing user context');
      Alert.alert('Error', 'User authentication required');
      return;
    }

    // ✅ Remove dynamic import - project comes from hook
    if (!project?.organisation_id) {
      console.error('❌ Project has no organisation_id');
      return;
    }

    setLoading(true);
    try {
      console.log('📋 Loading members for project:', projectId);

      let members: ProjectMember[] = [];
      try {
        members = await getProjectMembers(projectId, user.id);
        setMembers(members);
        console.log(`✅ Loaded ${members.length} project members`);
      } catch (error: any) {
        if (error?.message?.includes('Unauthorized')) {
          console.log('⚠️ User not authorized to view project members');
          setMembers([]);
          setAvailableUsers([]);
          return;
        }
        throw error;
      }

      // Load available users from PROJECT'S organization
      const orgUsers = await getOrganizationUsers(project.organisation_id, user.id);

      // Filter out users already in project
      const available = orgUsers.filter(
        orgUser => !members.some(m => m.id === orgUser.id)
      );
      setAvailableUsers(available);
      console.log(`✅ Loaded ${available.length} available users`);

    } catch (error) {
      console.error('❌ Error loading members:', error);
      Alert.alert('Error', 'Failed to load project members');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Add loading check for project
  if (loading && members.length === 0 || projectLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16 }}>Loading project members...</Text>
      </View>
    );
  }

  // ... rest of component
};
```

## Recommended Approach

**Use Solution Option 1** for quick fix (2 minutes):
- Minimal changes (2 lines)
- No refactoring required
- Immediate bug resolution

**Plan migration to Solution Option 2** for next refactoring cycle:
- Better architecture
- Consistent with codebase patterns
- Improved UX with loading states

## Testing Checklist

After applying fix:
1. ✅ Navigate to ProjectMembersScreen
2. ✅ Verify members list loads successfully
3. ✅ Verify "Add Member" functionality works
4. ✅ Check console for errors
5. ✅ Verify organisation filtering works correctly

## Files Modified

- `src/screens/ProjectMembersScreen.tsx` (1 file, 2-3 lines changed)

## Risk Assessment

- **Risk**: ⚫ Minimal
- **Breaking Changes**: None
- **Test Impact**: None (restores original functionality)
- **Deployment**: Can be deployed independently

---

**Fix Prepared By**: Claude Code Quality Analyzer
**Estimated Time**: 2-5 minutes
**Priority**: 🔴 Critical (blocks Member Management functionality)
