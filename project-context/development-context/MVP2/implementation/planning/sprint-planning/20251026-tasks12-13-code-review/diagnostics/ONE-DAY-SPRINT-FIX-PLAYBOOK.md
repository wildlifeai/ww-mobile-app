# One-Day Sprint - Fix Playbook

**Use this AFTER completing diagnostic**

---

## 🎯 Likely Scenario #1: TypeScript Errors Blocking Compilation

**Symptoms**: `npm run type-check` shows 10-24 errors, app won't compile

### **RAPID FIX SEQUENCE** (2-3 hours)

**Priority 1: Type Declarations** (15 min)
```bash
npm install --save-dev @types/react-native-vector-icons
```

**Priority 2: MongoDB → PostgreSQL** (30 min)
Find and replace `_id` with `id` in these files:
```bash
# Quick fix command
grep -rl "selectId.*_id" src/redux/api/ | xargs sed -i 's/selectId: (entity) => entity\._id/selectId: (entity) => entity.id/g'
```

Files to check manually:
- `src/redux/api/devices/index.ts`
- `src/redux/api/media/index.ts`
- `src/redux/api/observations/index.ts`
- `src/redux/api/sensorRecords/index.ts`
- `src/redux/api/users/index.ts`

**Priority 3: Enum Type Constraints** (20 min)
`src/navigation/screens/ProjectDetailsScreen.tsx` lines 86, 100:
```typescript
// Before:
visibility: formData.visibility

// After:
visibility: formData.visibility as "public" | "internal" | "private" | undefined
```

**Priority 4: Type Re-Exports** (15 min)
`src/types/index.ts` - Remove duplicate exports:
```typescript
// Find the duplicate Organisation/Project exports
// Keep only ONE export for each

// If both offline.ts and project.ts export Organisation:
export type { Organisation } from './offline';  // Choose one source
// Remove: export type { Organisation } from './project';
```

**Priority 5: Remaining Errors** (1-1.5 hours)
- Fix top 5 most critical only
- Use `// @ts-ignore` for non-blocking issues (temporarily)
- Document deferred fixes for later

**Validation**:
```bash
npm run type-check  # Should be <5 errors
npm run lint --fix  # Auto-fix what you can
```

---

## 🎯 Likely Scenario #2: Login Fails with Backend

**Symptoms**: Login button works but returns error, can't authenticate

### **DEBUG SEQUENCE** (1-2 hours)

**Step 1: Check Backend Connectivity** (10 min)
```bash
# Test Supabase connection
curl https://nuhwmubvygxyddkycmpa.supabase.co/rest/v1/
```

**Step 2: Verify Test User Exists** (10 min)
Check in Supabase SQL Editor:
```sql
SELECT id, email, email_confirmed_at, confirmed_at
FROM auth.users
WHERE email = 'laura.admin@wildlife-research.org';
```

If user DOESN'T exist → Backend seed data not deployed properly

**Step 3: Check Mobile Auth Code** (20 min)
Check `src/services/auth.ts` or auth slice:
```typescript
// Look for login function
// Add console logs:
console.log('Attempting login:', email);
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});
console.log('Auth response:', data, error);
```

**Step 4: Common Auth Fixes**

**Fix A: Wrong Supabase URL/Keys**
Check `.env.local`:
```bash
EXPO_PUBLIC_SUPABASE_URL=https://nuhwmubvygxyddkycmpa.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_SZ5M-5IzbkTs74QgD7c9wg_7EUyWzsd
```

**Fix B: Auth State Not Persisting**
Check `src/services/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,  // ← Make sure this is here
      autoRefreshToken: true,
      persistSession: true,
    },
  }
);
```

**Fix C: Email Confirmation Required**
If backend requires email confirmation but test data didn't set it:
```sql
-- Run in Supabase SQL Editor
UPDATE auth.users
SET email_confirmed_at = NOW(),
    confirmed_at = NOW()
WHERE email LIKE '%@wildlife-research.org'
   OR email LIKE '%@conservation.org'
   OR email LIKE '%@ranger.gov'
   OR email LIKE '%gmail.com'
   OR email LIKE '%yahoo.com'
   OR email LIKE '%outlook.com'
   OR email LIKE '%hotmail.com';
```

**Validation**:
```bash
# Login should work now
# Test with: laura.admin@wildlife-research.org / test123
```

---

## 🎯 Likely Scenario #3: RLS Policy Blocks Project List

**Symptoms**: Login works, but project list is empty for Laura (should see 2 projects)

### **DEBUG SEQUENCE** (1-2 hours)

**Step 1: Verify Projects Exist** (5 min)
In Supabase SQL Editor:
```sql
SELECT p.name, o.name as org_name
FROM projects p
JOIN organisations o ON p.organisation_id = o.id
WHERE o.slug = 'wildlife-research';
```

Should return:
- Tiger Tracking Program
- Bird Migration Study

**Step 2: Check Laura's Organization Membership** (5 min)
```sql
SELECT o.name, o.slug
FROM user_organisations uo
JOIN organisations o ON uo.organisation_id = o.id
WHERE uo.user_id = 'a0000000-0000-0000-0000-00000000000b'  -- Laura's UUID
  AND uo.deleted_at IS NULL;
```

Should return: Wildlife Research Institute

**Step 3: Test RLS Policy Directly** (10 min)
```sql
-- Set session to Laura's user ID (simulates her logged in)
SET LOCAL request.jwt.claims.sub = 'a0000000-0000-0000-0000-00000000000b';

-- Now query projects (RLS should apply)
SELECT * FROM projects;
```

If returns 0 rows → **RLS policy is broken** (backend issue, not mobile)

**Step 4: Check Mobile API Call** (15 min)
In `src/redux/api/projects/projectsApi.ts` or similar:
```typescript
// Add console logging
getProjects: builder.query({
  queryFn: async () => {
    console.log('Fetching projects...');
    const { data, error } = await supabase
      .from('projects')
      .select('*');
    console.log('Projects response:', data, error);
    return { data };
  },
}),
```

**Common Fixes**:

**Fix A: Missing RLS Helper Function**
Check if backend has `has_project_role()` function deployed.

**Fix B: User Roles Not Set**
```sql
-- Check Laura's roles
SELECT * FROM user_roles
WHERE user_id = 'a0000000-0000-0000-0000-00000000000b'
  AND deleted_at IS NULL
  AND is_active = true;
```

Should have `project_admin` role for Tiger Tracking project.

**Fix C: Temporary Workaround** (if backend broken, 30 min)
Temporarily disable RLS on projects table (TESTING ONLY):
```sql
-- DO NOT USE IN PRODUCTION
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
```

Then re-enable after Victor's testing.

**Validation**:
```bash
# Laura should see project list now
```

---

## 🎯 Likely Scenario #4: Member Management UI Missing/Broken

**Symptoms**: Can see projects, but no "Manage Members" button or member list

### **QUICK FIX SEQUENCE** (1-2 hours)

**Step 1: Verify UI Component Exists** (10 min)
```bash
grep -r "Manage Members\|manage-members" src/navigation/screens/
```

Should find in `ProjectDetailsScreen.tsx`

**Step 2: Check Redux API Integration** (15 min)
In `ProjectDetailsScreen.tsx`:
```typescript
// Should have these imports:
import {
  useGetProjectMembersQuery,
  useRemoveProjectMemberMutation,
} from '@/redux/api/projects/projectsApi';

// Should have these hooks:
const { data: members } = useGetProjectMembersQuery(projectId);
const [removeMember] = useRemoveProjectMemberMutation();
```

**Step 3: Check Backend Endpoint** (10 min)
In `src/redux/api/projects/projectsApi.ts`:
```typescript
// Should have member management endpoints:
getProjectMembers: builder.query({
  query: (projectId) => `project_members?project_id=eq.${projectId}`,
}),

addProjectMember: builder.mutation({
  query: ({ projectId, userId, roleId }) => ({
    url: 'project_members',
    method: 'POST',
    body: { project_id: projectId, user_id: userId, role_id: roleId },
  }),
}),

removeProjectMember: builder.mutation({
  query: ({ projectId, userId }) => ({
    url: `project_members?project_id=eq.${projectId}&user_id=eq.${userId}`,
    method: 'DELETE',
  }),
}),
```

**Step 4: Common Fixes**

**Fix A: Import Path Wrong** (from Redux consolidation)
Change:
```typescript
// Before:
import { useGetProjectMembersQuery } from '@/store/api/projectsApi';

// After:
import { useGetProjectMembersQuery } from '@/redux/api/projects/projectsApi';
```

**Fix B: TestID Missing** (if UI exists but not visible)
Check that button has proper styling and isn't hidden:
```typescript
<TouchableOpacity
  testID="manage-members-button"
  style={{ marginTop: 16 }}  // Make sure not display: 'none'
  onPress={() => navigation.navigate('ProjectMembers', { projectId })}
>
  <Text>Manage Members</Text>
</TouchableOpacity>
```

**Fix C: Navigation Not Registered**
In `src/navigation/index.tsx`, check stack has ProjectMembersScreen:
```typescript
<Stack.Screen name="ProjectMembers" component={ProjectMembersScreen} />
```

**Validation**:
```bash
# Should see "Manage Members" button in project details
# Tapping should show member list
```

---

## 🎯 Emergency "Good Enough" Fixes

**If running out of time (6+ hours elapsed):**

### **Minimal Viable Demo** (1 hour)

**Skip**:
- Member management (defer to later)
- Perfect TypeScript (use `@ts-ignore` liberally)
- Full multi-tenant testing

**Focus**:
1. Login works with 1-2 test accounts (30 min)
2. Project list shows SOMETHING (15 min)
3. Can create a basic project (15 min)

**Workaround Strategy**:
```typescript
// Temporarily hardcode data if backend broken
const mockProjects = [
  { id: '1', name: 'Tiger Tracking Program', organisation_id: '...' },
  { id: '2', name: 'Bird Migration Study', organisation_id: '...' },
];

// Use mock data in development
const projects = __DEV__ ? mockProjects : actualBackendData;
```

---

## 📋 Testing Checklist (Final 30 min)

Before rebuilding APK:

**Core Flows**:
- [ ] Login with laura.admin@wildlife-research.org / test123
- [ ] See project list (at least 1 project)
- [ ] Open a project (view details)
- [ ] Create new project (if time)
- [ ] View members (if implemented)
- [ ] Add member (if implemented)

**Quick Validation**:
```bash
npm run type-check  # <5 errors acceptable
npm run lint       # No critical errors
npm test           # Most tests passing (some fails OK)
```

**Document Known Issues**:
Create `KNOWN-ISSUES.md` for Victor:
```markdown
# Known Issues in Current Build

1. **Issue**: [Description]
   **Workaround**: [How Victor can avoid/work around]

2. **Issue**: [Description]
   **Workaround**: [How Victor can avoid/work around]
```

---

## 🚀 APK Rebuild & Delivery (Final 30 min)

```bash
# Pre-build check
npm run validate:local

# Build Android APK
eas build --profile development --platform android --non-interactive

# While building, create testing doc for Victor
```

**Quick Testing Guide for Victor** (5 min to write):
```markdown
# Wildlife Watcher Testing - Oct 26 Build

## Test Accounts
- **Laura (Admin)**: laura.admin@wildlife-research.org / test123
- **Alice (Unassigned)**: alice.smith@gmail.com / test123

## What to Test
1. **Login**: Use Laura's account
2. **Projects**: You should see 2 projects
3. **Create Project**: Tap + button, create test project
4. **[If working] Members**: Open project → Manage Members

## Known Issues
[Paste from KNOWN-ISSUES.md]

## Report Problems To
[Your contact info]
```

**Delivery**:
1. Download APK when build completes
2. Upload to Google Drive/Dropbox
3. Email Victor with link + testing guide
4. Quick 5-min call/message explaining what's fixed

---

## ✅ Success Criteria for Today

**Minimum (Must Have)**:
- [ ] App compiles (<5 TS errors)
- [ ] Login works with test data
- [ ] Can see project list
- [ ] APK delivered to Victor

**Target (Should Have)**:
- [ ] Project creation works
- [ ] Member list visible
- [ ] Multi-tenant isolation works

**Stretch (Nice to Have)**:
- [ ] Add member works
- [ ] Remove member works
- [ ] All TS errors fixed

---

**Time Tracking**:
- Start: _____
- Diagnostic Done: _____ (1 hour mark)
- Fixes Complete: _____ (6-7 hour mark)
- APK Building: _____ (7.5 hour mark)
- Delivered: _____ (8 hour mark)
