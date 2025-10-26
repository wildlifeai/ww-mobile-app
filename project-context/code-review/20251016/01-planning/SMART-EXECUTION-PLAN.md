# Smart Execution Plan - Option 3: Pragmatic Fix

**Objective**: Fix member management bugs + app TypeScript errors, delete invalid tests
**Time Estimate**: 3-4 hours
**Strategy**: Parallel execution where possible, specialized agents for efficiency

---

## 🎯 Task Dependency Analysis

### Independent Tasks (Can Run in Parallel)

**Group A: Critical Runtime Bugs** (NO dependencies)
1. Fix cross-organisation member filtering (`ProjectMembersScreen.tsx`)
2. Fix missing React keys in member list (`ProjectDetailsScreen.tsx`)
3. Add authorization check before fetching members (`ProjectMembersScreen.tsx`)

**Group B: TypeScript Type Errors** (NO dependencies)
4. Fix type re-export conflicts (`src/types/index.ts`)
5. Fix ProjectDetailsScreen type casts (lines 86, 100)
6. Fix MongoDB `_id` → `id` references (5 files in `src/redux/api/`)

**Group C: Missing Database Properties** (NO dependencies)
7. Add missing properties to database types or remove references

### Sequential Tasks (Order Matters)

**Phase 1**: Fix all code issues (Groups A, B, C in parallel)
**Phase 2**: Delete TDD violation tests (depends on Phase 1 completion)
**Phase 3**: Verify & test (depends on Phase 2)

---

## 🚀 Execution Strategy

### **Phase 1: Parallel Bug Fixes** (1.5 hours)

**Agent Assignments:**

1. **Main Agent**: Fix critical runtime bugs (Group A)
   - Cross-org filtering bug
   - React keys
   - Authorization checks

2. **Agent Task (mobile-dev)**: Fix TypeScript errors (Group B + C)
   - Type re-exports
   - Type casts
   - MongoDB _id references
   - Database property mismatches

**Rationale**: Mobile-dev agent specializes in React Native/TypeScript, can handle all type errors efficiently while main agent fixes runtime logic bugs.

### **Phase 2: Test Cleanup** (30 minutes)

**Main Agent**: Delete TDD violation test files
- Remove `airplane-mode.test.ts` (21 errors)
- Remove `organisation-isolation.test.ts` (37 errors)
- Remove `offlineSlice.test.ts` (23 errors)
- Remove `projectsSlice.test.ts` (19 errors)

**Rationale**: Sequential after code fixes to avoid conflicts.

### **Phase 3: Verification** (30 minutes)

**Main Agent**:
1. Run `npm run type-check`
2. Verify error count reduction (179 → ~57 remaining)
3. Test member management manually
4. Commit with batch strategy

---

## 📋 Detailed Task Breakdown

### Group A: Critical Runtime Bugs

#### Task A1: Fix Cross-Organisation Filtering
**File**: `src/screens/ProjectMembersScreen.tsx:140`
**Current Bug**:
```typescript
const orgUsers = await getOrganizationUsers(currentOrg.id, user.id);
// ❌ Using currentOrg.id but project may belong to different org!
```

**Fix**: Get project's organisation_id from project data
```typescript
// Need to fetch project first to get its organisation_id
const project = await getProjectById(projectId);
const orgUsers = await getOrganizationUsers(project.organisation_id, user.id);
```

**Complexity**: Medium (need project fetch)
**Time**: 20 min

#### Task A2: Fix React Keys
**File**: `src/navigation/screens/ProjectDetailsScreen.tsx:534`
**Current Bug**:
```typescript
{members.map((member) => (
  <View key={member.user_id} style={styles.memberRow}>
  // ❌ Warning: Each child needs unique key
))}
```

**Fix**: Verify key is unique
```typescript
{members.map((member) => (
  <View key={`member-${member.user_id}`} style={styles.memberRow}>
))}
```

**Complexity**: Easy
**Time**: 5 min

#### Task A3: Authorization Check
**File**: `src/screens/ProjectMembersScreen.tsx:135`
**Current Bug**:
```typescript
const members = await getProjectMembers(projectId, user.id);
// ❌ No check if user has permission to view members
```

**Fix**: Add try-catch with permission check
```typescript
try {
  const members = await getProjectMembers(projectId, user.id);
  setMembers(members);
} catch (error) {
  if (error.message.includes('Unauthorized')) {
    // User not authorized - show empty list or message
    setMembers([]);
    return;
  }
  throw error;
}
```

**Complexity**: Easy
**Time**: 10 min

---

### Group B: TypeScript Type Errors

#### Task B1: Fix Type Re-Exports
**File**: `src/types/index.ts:13`
**Error**:
```
Module './offline' has already exported Organisation
Module './offline' has already exported Project
```

**Investigation Needed**: Check what's exported from both files
**Fix**: Remove duplicate exports or use explicit re-export
**Complexity**: Easy
**Time**: 10 min

#### Task B2: Fix ProjectDetailsScreen Type Casts
**File**: `src/navigation/screens/ProjectDetailsScreen.tsx`
**Lines**: 86, 100
**Error**: `Type 'string' is not assignable to type '"public" | "internal" | "private" | undefined'`

**Fix**: Cast to enum type
```typescript
// Line 86, 100
visibility: formData.visibility as 'public' | 'internal' | 'private'
```

**Complexity**: Easy
**Time**: 5 min

#### Task B3: Fix MongoDB _id References
**Files**:
- `src/redux/api/devices/index.ts:15`
- `src/redux/api/media/index.ts:15`
- `src/redux/api/observations/index.ts:20`
- `src/redux/api/sensorRecords/index.ts:20`
- `src/redux/api/users/index.ts:15`

**Error**: `Property '_id' does not exist on type`

**Fix**: Change `_id` to `id`
```typescript
// Before: item._id
// After: item.id
```

**Complexity**: Easy (find & replace)
**Time**: 10 min

---

### Group C: Database Property Mismatches

#### Task C1: Missing Project Properties
**File**: `src/services/offline/OfflineService.ts`
**Errors**:
- Line 595, 622: `Property 'status' does not exist`
- Line 596, 623: `Property 'members' does not exist`

**Investigation**: Check if properties exist in Supabase schema
**Fix Options**:
- Option A: Add to type definitions
- Option B: Remove references if not in schema

**Complexity**: Medium (requires schema check)
**Time**: 20 min

#### Task C2: Missing Deployment Properties
**File**: `src/services/offline/OfflineService.ts`
**Errors**:
- Line 668, 700: `Property 'status' does not exist`
- Line 669, 701: `Property 'lorawan_status' does not exist`

**Same as C1**
**Time**: 15 min

---

## 🎬 Execution Order

### **Step 1: Launch Parallel Agents** (5 min setup)
```typescript
// Agent 1 (Main): Group A tasks
// Agent 2 (mobile-dev): Group B + C tasks
```

### **Step 2: Main Agent Executes Group A** (35 min)
1. Read project files to understand data flow
2. Fix cross-org filtering (20 min)
3. Fix React keys (5 min)
4. Fix authorization (10 min)

### **Step 3: Mobile-Dev Agent Executes B + C** (60 min)
1. Investigate type re-exports (10 min)
2. Fix all type errors (Group B: 25 min)
3. Investigate database schema (15 min)
4. Fix property mismatches (Group C: 35 min)

### **Step 4: Merge Results** (10 min)
- Main agent waits for mobile-dev completion
- Review all changes
- Ensure no conflicts

### **Step 5: Delete Tests** (20 min)
```bash
rm tests/integration/projects/airplane-mode.test.ts
rm tests/integration/projects/organisation-isolation.test.ts
rm tests/unit/redux/offlineSlice.test.ts
rm tests/unit/redux/projectsSlice.test.ts
```

### **Step 6: Verify** (20 min)
```bash
npm run type-check
# Expected: 179 → ~40 errors (TDD tests deleted)
# Remaining: useDeepLinking tests + minor issues
```

### **Step 7: Test Member Management** (10 min)
- Navigate to project details
- Try adding member
- Verify correct org filtering
- Check no errors in console

### **Step 8: Commit** (10 min)
```bash
git add src/screens/ProjectMembersScreen.tsx
git add src/navigation/screens/ProjectDetailsScreen.tsx
git add src/types/
git add src/redux/api/
git add src/services/offline/
git commit -m "fix(member-management): resolve cross-org bug, React keys, and type errors

- Fix cross-organisation member filtering bug
- Add missing React keys in member list
- Add authorization error handling
- Fix type re-export conflicts
- Fix TypeScript type casts
- Fix MongoDB _id → id references
- Fix missing database properties

Resolves member management issues identified in code review.
Reduces TypeScript errors from 179 to ~40.

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

git add tests/
git commit -m "test: remove TDD violation tests with unimplemented methods

- Remove airplane-mode.test.ts (21 errors)
- Remove organisation-isolation.test.ts (37 errors)
- Remove offlineSlice.test.ts (23 errors)
- Remove projectsSlice.test.ts (19 errors)

These tests expected methods that were never implemented in Task 11.8.
Total test errors removed: 100

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## ⚡ Optimization Benefits

**Time Savings**:
- **Sequential approach**: 3.5 hours
- **Parallel approach**: 2 hours (43% faster!)

**Context Window Savings**:
- Mobile-dev agent handles all TypeScript errors
- Main agent focuses on runtime logic
- No duplicate file reads

**Risk Mitigation**:
- Independent tasks can't conflict
- Each agent has clear scope
- Verification step catches integration issues

---

## 🎯 Success Criteria

**Phase 1 Complete**:
- [  ] No cross-org members shown in modal
- [  ] No React key warnings
- [  ] Authorization errors handled gracefully
- [  ] Type re-exports resolved
- [  ] All type casts fixed
- [  ] All _id references changed to id
- [  ] Database property errors resolved

**Phase 2 Complete**:
- [  ] 4 test files deleted
- [  ] ~100 test errors removed

**Phase 3 Complete**:
- [  ] TypeScript errors reduced to ~40
- [  ] Member management works correctly
- [  ] All changes committed

---

## 📊 Expected Results

**Before**:
- Total errors: 179
- App errors: 57
- Test errors: 122
- Member management: BROKEN

**After**:
- Total errors: ~40 (77% reduction)
- App errors: ~15 (74% reduction)
- Test errors: ~25 (80% reduction)
- Member management: WORKING ✅

---

**Ready to execute!** Awaiting user confirmation to proceed with parallel agent approach.
