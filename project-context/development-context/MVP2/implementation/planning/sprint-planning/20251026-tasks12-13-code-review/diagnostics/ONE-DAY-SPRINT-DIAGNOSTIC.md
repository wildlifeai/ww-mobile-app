# One-Day Sprint - Critical Bug Diagnostic

**Date**: 2025-10-26
**Goal**: Identify EXACT failures blocking Tasks 12-13 functionality
**Timeline**: 1 hour diagnostic → 7 hours fixing

---

## 🔍 Diagnostic Checklist (Complete FIRST)

### **Test 1: App Compilation**
```bash
npm run type-check
```

**Result**:
- [ ] Compiles successfully (0 errors)
- [ ] Has errors (count: _______)

**Top 5 Blocking Errors** (if any):
1.
2.
3.
4.
5.

**Decision**:
- If <10 errors → Fix all now (30 min)
- If 10-24 errors → Fix only top 5 blocking (1 hour)
- If >24 errors → Something wrong, need different approach

---

### **Test 2: App Runs**
```bash
npm start
# Open on device/emulator
```

**Result**:
- [ ] App starts successfully
- [ ] App crashes on startup
- [ ] App has runtime errors

**Error Message** (if crash):
```
[Paste error here]
```

---

### **Test 3: Login with Backend Test Data**

**Test Account**: `laura.admin@wildlife-research.org` / `test123`

**Steps**:
1. Open app
2. Enter email: laura.admin@wildlife-research.org
3. Enter password: test123
4. Tap Login

**Result**:
- [ ] Login successful
- [ ] Login fails with error: _______________

**If Login Fails - Debug**:
```bash
# Check backend connectivity
curl https://nuhwmubvygxyddkycmpa.supabase.co/rest/v1/

# Check if user exists in backend
# (Run this in Supabase SQL Editor or backend project)
SELECT id, email FROM auth.users WHERE email = 'laura.admin@wildlife-research.org';
```

**Root Cause**:
- [ ] Network/connectivity issue
- [ ] Backend RLS policy blocking
- [ ] Auth token issue
- [ ] User doesn't exist in database
- [ ] Other: _______________

---

### **Test 4: Project List Visibility**

**Prerequisite**: Login as Laura successful

**Expected**: Laura should see:
- ✅ Tiger Tracking Program
- ✅ Bird Migration Study
- ❌ NOT see Marine Life Documentation (different org)
- ❌ NOT see Forest Patrol System (different org)

**Actual Result**:
- [ ] Sees expected projects only ✅
- [ ] Sees NO projects ❌
- [ ] Sees ALL projects (RLS broken) ❌
- [ ] Sees wrong projects ❌

**Projects Visible**:
1.
2.
3.

**If Wrong - Check Backend**:
```sql
-- Run in Supabase SQL Editor
-- Check Laura's organization membership
SELECT o.name, o.slug
FROM user_organisations uo
JOIN organisations o ON uo.organisation_id = o.id
WHERE uo.user_id = 'a0000000-0000-0000-0000-00000000000b';  -- Laura's UUID

-- Check projects Laura should see
SELECT p.name, o.name as org_name
FROM projects p
JOIN organisations o ON p.organisation_id = o.id
WHERE o.id IN (
  SELECT organisation_id FROM user_organisations
  WHERE user_id = 'a0000000-0000-0000-0000-00000000000b'
);
```

---

### **Test 5: Project Creation**

**Prerequisite**: Login as Laura, see project list

**Steps**:
1. Tap "New Project" or "+" button
2. Enter project name: "Test Project $(date)"
3. Fill required fields
4. Tap "Create"

**Result**:
- [ ] Project created successfully ✅
- [ ] Create button not visible/disabled
- [ ] Form validation errors
- [ ] Creation fails with error: _______________

**Error Details**:
```
[Paste error message]
```

**Root Cause**:
- [ ] UI/navigation issue
- [ ] Backend API error
- [ ] Offline queue not syncing
- [ ] RLS policy blocking insert
- [ ] Other: _______________

---

### **Test 6: Member Management (View Members)**

**Prerequisite**: Login as Laura, open "Tiger Tracking Program"

**Expected**: See members:
- ✅ Laura Admin (admin role)
- ✅ Mark Member (member role)
- ✅ Carol White (member role, from General org)

**Actual Result**:
- [ ] Sees expected members ✅
- [ ] Sees NO members ❌
- [ ] UI doesn't show members section ❌
- [ ] Error loading members: _______________

**If Fails - Check**:
```typescript
// In mobile app - check Redux query
const { data: members, error } = useGetProjectMembersQuery(projectId);
console.log('Members:', members);
console.log('Error:', error);
```

---

### **Test 7: Member Management (Add Member)**

**Prerequisite**: Can view members

**Steps**:
1. Open "Tiger Tracking Program"
2. Tap "Add Member" or similar
3. Select user from list (e.g., Alice Smith)
4. Assign role (e.g., member)
5. Tap "Add"

**Result**:
- [ ] Member added successfully ✅
- [ ] Add button not visible
- [ ] User list empty
- [ ] Add fails with error: _______________

**Error Details**:
```
[Paste error]
```

---

### **Test 8: Member Management (Remove Member)**

**Prerequisite**: Can view members

**Steps**:
1. Open "Tiger Tracking Program"
2. Find Carol White in member list
3. Tap remove/delete icon
4. Confirm removal

**Result**:
- [ ] Member removed successfully ✅
- [ ] Remove button not visible
- [ ] Remove fails with error: _______________

**Error Details**:
```
[Paste error]
```

---

## 🎯 Critical Issues Summary

After completing diagnostic, list the **TOP 3 BLOCKING ISSUES**:

### **Issue 1** (Most Critical)
**Problem**:
**Impact**: Blocks: [Login | Project List | Project Creation | Member Management]
**Estimated Fix Time**: _____ hours

### **Issue 2**
**Problem**:
**Impact**: Blocks: [Login | Project List | Project Creation | Member Management]
**Estimated Fix Time**: _____ hours

### **Issue 3**
**Problem**:
**Impact**: Blocks: [Login | Project List | Project Creation | Member Management]
**Estimated Fix Time**: _____ hours

---

## ✅ Quick Wins (Fix First)

Issues that can be fixed in <30 minutes:
1.
2.
3.

---

## ⏰ Time Budget Allocation

Based on diagnostic findings:

**Remaining Time**: 7 hours

**Proposed Allocation**:
- TypeScript errors: _____ hours
- Login fix: _____ hours
- Project creation fix: _____ hours
- Member management fix: _____ hours
- Testing & validation: _____ hours
- APK rebuild: _____ hours

**Total**: Should equal 7 hours

---

## 🚦 Go/No-Go Decision

After diagnostic (1 hour mark):

**CAN achieve today if**:
- [ ] Top 3 issues fixable in <6 hours combined
- [ ] No fundamental architecture problems
- [ ] Backend is working (test data accessible)

**CANNOT achieve today if**:
- [ ] Requires major refactoring (>4 hours)
- [ ] Backend has blocking issues
- [ ] Multiple complex interconnected problems

**Decision**: [ ] GO / [ ] REVISE PLAN

---

## 📋 Next Steps (After Diagnostic)

If **GO**:
1. Fix Top 3 issues in priority order
2. Test each fix immediately
3. Document workarounds for any deferred issues
4. Build new APK
5. Send to Victor with updated testing guide

If **NO-GO**:
1. Communicate revised timeline to Victor
2. Focus on just Login + Project List (defer member management)
3. Get partial APK working today
4. Continue tomorrow for member management

---

**Start Time**: _____
**Diagnostic Complete Time**: _____ (should be ~1 hour)
**Issues Identified**: _____
**Fix Plan Created**: _____
