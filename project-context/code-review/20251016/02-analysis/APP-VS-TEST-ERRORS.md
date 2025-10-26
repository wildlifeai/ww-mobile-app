# App Code vs Test Code Errors - Breakdown

**Total Errors**: 179
**App Code Errors**: 67 (37%)
**Test Code Errors**: 112 (63%)

## 🎯 Key Finding: Most Errors Are Test-Only

**63% of errors are in test files only** - These don't affect the running application.

---

## 📊 Breakdown by Location

### APP CODE ERRORS (67 errors) - AFFECTS PRODUCTION

| Category | Location | Count | Fix Type |
|----------|----------|-------|----------|
| **Type Re-exports** | `src/types/index.ts` | 13 | APP FIX |
| **Offline Services** | `src/services/offline/` | 16 | APP FIX |
| **Redux Slices** | `src/redux/slices/` | 8 | APP FIX |
| **Redux Middleware** | `src/redux/middleware/` | 3 | APP FIX |
| **Redux API** | `src/redux/api/` | 8 | APP FIX |
| **Navigation** | `src/navigation/` | 4 | APP FIX |
| **Screens** | `src/screens/`, `src/navigation/screens/` | 5 | APP FIX |
| **Components** | `src/components/`, `src/features/` | 5 | APP FIX |
| **Services** | `src/services/` (non-offline) | 5 | APP FIX |

### TEST CODE ERRORS (112 errors) - TEST-ONLY

| Category | Location | Count | Fix Type |
|----------|----------|-------|----------|
| **Unit Tests - Redux** | `tests/unit/redux/` | 41 | TEST FIX |
| **Integration - Projects** | `tests/integration/projects/` | 37 | TEST FIX |
| **Integration - Navigation** | `tests/integration/navigation/` | 23 | TEST FIX |
| **Integration - Services** | `tests/integration/services/` | 4 | TEST FIX |
| **Unit Tests - Services** | `tests/unit/services/` | 1 | TEST FIX |
| **Hook Tests** | `src/hooks/__tests__/` | 5 | TEST FIX |
| **Mock Files** | `tests/__mocks__/` | 2 | TEST FIX |

---

## 🚨 CRITICAL: App Code Must Be Fixed (67 errors)

These errors **BLOCK production builds** and must be fixed:

### Priority 1: Type System (13 errors) - 30 minutes
**Location**: `src/types/index.ts`
**Problem**: Re-export conflicts
**Impact**: Entire type system broken
**Fix**: Use explicit re-exports with aliases

### Priority 2: Missing Service Methods (13 errors) - 3-4 hours
**Location**: `src/services/offline/OfflineService.ts`, `DatabaseService.ts`, `src/redux/slices/offlineSlice.ts`
**Problem**: Code calls methods that don't exist
**Impact**: Runtime crashes when offline features used
**Fix**: Implement missing methods

**Methods needed**:
- `OfflineService`: ❌ Missing but ACTUALLY CALLED BY APP CODE
- `DatabaseService`: ❌ Missing but ACTUALLY CALLED BY APP CODE

### Priority 3: MongoDB Legacy (5 errors) - 15 minutes
**Location**: `src/redux/api/*.ts` (devices, media, observations, sensorRecords, users)
**Problem**: Using `_id` instead of `id`
**Impact**: RTK Query entity adapters broken
**Fix**: Find/replace `_id` → `id`

### Priority 4: Missing Domain Properties (16 errors) - 2 hours
**Location**: `src/services/offline/OfflineService.ts`
**Problem**: Accessing properties that don't exist on Supabase types
**Impact**: Runtime errors when syncing data
**Properties**: `status`, `members`, `device_count`, `lorawan_status`
**Fix**: Add computed properties or handle missing gracefully

### Priority 5: Component/UI Types (9 errors) - 1 hour
**Locations**:
- `src/components/ui/WWScrollView.tsx` (hitSlop)
- `src/features/maps/components/BasicMapView.tsx` (callback)
- `src/features/maps/hooks/useLocation.ts` (variable order)
- `src/navigation/screens/ProjectDetailsScreen.tsx` (visibility enum)
**Impact**: Component type safety
**Fix**: Correct prop types and signatures

### Priority 6: Redux/Auth Types (11 errors) - 1 hour
**Locations**: `src/redux/api/enhanced/`, `src/redux/middleware/`, `src/redux/slices/authSlice.ts`, `src/screens/`, `src/services/auth.ts`
**Impact**: Error handling, auth flow type safety
**Fix**: Proper error types, null checks, enum handling

---

## ✅ Optional: Test Code Fixes (112 errors)

These errors **DO NOT affect the running app** - tests just won't pass:

### Category 1: Test Type Mismatches (60+ errors)
**Problem**: Tests use `OfflineOperation` type but expect `OfflineQueueItem` properties
**Fix**: Change type annotations in tests from `OfflineOperation` to `OfflineQueueItem`

**Example**:
```typescript
// ❌ WRONG - Test code
const ops = await offlineService.getQueueStatus();
ops.operations.forEach((op: OfflineOperation) => {  // ← Wrong type
  expect(op.entity_type).toBe('projects');  // ← Property doesn't exist
});

// ✅ CORRECT
import { OfflineQueueItem } from '../../services/offline/DatabaseService';
ops.operations.forEach((op: OfflineQueueItem) => {  // ← Right type
  expect(op.operation_type).toContain('PROJECT');  // ← Correct property
});
```

### Category 2: Test Helper Issues (40+ errors)
**Problem**: Test mocks, helpers, and assertions have type issues
**Examples**:
- Missing `scheme` property on ParsedURL mocks
- `toBeDisabled()` matcher not recognized
- `beforeEach`/`afterEach` return type issues
- Mock AuthError construction

### Category 3: Test Method Calls (12+ errors)
**Problem**: Tests call service methods that don't exist
**Note**: These are THE SAME missing methods from app code Priority 2!
**Fix**: Once app methods implemented, test errors disappear

---

## 🎯 RECOMMENDED FIX STRATEGY

### Option A: Fix App Code Only (Minimum Viable)
**Goal**: Get production build working
**Time**: 6-8 hours
**Result**: App works, tests still fail

**Steps**:
1. ✅ Fix type re-exports (30 min)
2. ✅ Implement missing service methods (3-4 hrs)
3. ✅ Fix MongoDB `_id` refs (15 min)
4. ✅ Fix missing domain properties (2 hrs)
5. ✅ Fix component/UI types (1 hr)
6. ✅ Fix Redux/auth types (1 hr)

**Outcome**: 67 app errors → 0 ✅ | 112 test errors remain ⚠️

---

### Option B: Fix App + Tests (Complete)
**Goal**: Everything works, full test coverage
**Time**: 10-12 hours
**Result**: App works, all tests pass

**Steps**:
1. ✅ All of Option A (6-8 hrs)
2. ✅ Fix test type annotations (2 hrs)
3. ✅ Fix test helpers/mocks (2 hrs)

**Outcome**: 179 errors → 0 ✅

---

### Option C: Fix App, Defer Tests (Pragmatic)
**Goal**: Unblock development, fix tests later
**Time**: 6-8 hours + document test debt
**Result**: App works, tests documented as tech debt

**Steps**:
1. ✅ All of Option A (6-8 hrs)
2. ✅ Skip/disable failing tests temporarily
3. ✅ Document test fixes in backlog

**Outcome**: App works ✅ | Test suite partial ⚠️ | Tech debt tracked 📋

---

## 📝 RECOMMENDATION

**Recommended**: **Option A - Fix App Code Only**

**Why**:
- **Unblocks production builds** (most critical)
- **Tests were written incorrectly** (using wrong types)
- **Tests can be fixed later** as separate task
- **Focus limited time on production code**

**Then Later**:
- Create separate task for "Fix Test Type Errors"
- Fix tests when you have more time
- Or fix tests as you work on related features

---

## 🔢 Summary

| Metric | Value |
|--------|-------|
| **Total Errors** | 179 |
| **App Code (Production-Blocking)** | 67 (37%) |
| **Test Code (Non-Blocking)** | 112 (63%) |
| **Time to Fix App Only** | 6-8 hours |
| **Time to Fix Everything** | 10-12 hours |
| **Recommended Approach** | Option A (App Only) |

**Key Insight**: You can get the app working in production by fixing just 67 errors, leaving the 112 test errors for later.
