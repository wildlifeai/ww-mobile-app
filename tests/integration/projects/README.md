# Task 12 - Phase 3.3: Test Execution Guide

## 📋 Test Suite Overview

This directory contains comprehensive integration tests for Task 12 (Projects CRUD Operations) Phase 3.3, focusing on:

1. **Airplane Mode Testing** (`airplane-mode.test.ts`)
   - Offline project creation and sync
   - Offline editing and conflict resolution
   - Organisation switching offline behavior
   - Queue persistence across app restarts
   - Performance under offline conditions
   - Network reconnection behavior

2. **Organisation Isolation Security** (`organisation-isolation.test.ts`)
   - Organisation-scoped data visibility
   - WW Admin mobile scope validation (org-based, NOT global)
   - Cross-organisation data leakage prevention
   - Organisation membership limit enforcement
   - Role-based access control

## 🚀 Running the Tests

### Prerequisites

```bash
# Ensure dependencies are installed
npm install

# Ensure local Supabase backend is running (for integration tests)
# In backend repo: supabase start
```

### Run All Task 12 Tests

```bash
npm test -- tests/integration/projects/
```

### Run Specific Test Suites

```bash
# Airplane mode tests only
npm test -- tests/integration/projects/airplane-mode.test.ts

# Organisation isolation tests only
npm test -- tests/integration/projects/organisation-isolation.test.ts
```

### Run With Coverage

```bash
npm test -- --coverage tests/integration/projects/
```

### Run in Watch Mode

```bash
npm test -- --watch tests/integration/projects/
```

## 📊 Expected Test Results

### Airplane Mode Tests (9 tests)

| Scenario | Tests | Expected Outcome |
|----------|-------|------------------|
| Offline Project Creation | 3 | ✅ All pass - local creation, sync on reconnect, ordered queue |
| Offline Project Editing | 2 | ✅ All pass - local updates, conflict resolution |
| Organisation Switching | 1 | ✅ Pass - context maintained offline |
| Queue Persistence | 1 | ✅ Pass - survives app restart |
| Performance | 1 | ✅ Pass - 100+ projects in <2s |
| Network Reconnection | 1 | ✅ Pass - auto-sync triggers |

**Total: 9 tests, 100% pass rate expected**

### Organisation Isolation Tests (9 tests)

| Security Requirement | Tests | Expected Outcome |
|---------------------|-------|------------------|
| Organisation-Scoped Visibility | 2 | ✅ All pass - users see only their org, ID access blocked |
| WW Admin Mobile Scope | 2 | ✅ All pass - org-scoped (NOT global), switching isolated |
| Membership Limits | 2 | ✅ All pass - standard=1 org, WW Admin=2 orgs |
| Role-Based Access | 2 | ✅ All pass - member=read-only, admin=edit rights |
| Data Leakage Prevention | 1 | ✅ Pass - no cross-org cache contamination |

**Total: 9 tests, 100% pass rate expected**

## 🎯 Test Coverage Targets

### Phase 3.3 Coverage Goals

- **Overall Coverage**: >80% (Target: 90%)
- **Critical Paths**: 100% (offline operations, org isolation)
- **Service Layer**: >85% (ProjectService, DatabaseService, OfflineService)
- **Security Functions**: 100% (RLS enforcement, org validation)

### Coverage Report

```bash
# Generate detailed coverage report
npm test -- --coverage --coverageDirectory=coverage/task-12

# View HTML report
open coverage/task-12/index.html
```

## 🧪 Test Scenarios Explained

### Airplane Mode Scenarios

#### 1. Offline Project Creation
**What it tests:** Can users create projects when device is offline?

**Success criteria:**
- Project saved to local SQLite database
- Project marked as `sync_status: 'pending'`
- Operation queued in OfflineService
- Local project immediately visible in UI
- Syncs to Supabase when reconnected

**Real-world scenario:** Field researcher creates project in remote area without cell signal.

#### 2. Offline Project Editing
**What it tests:** Can users edit projects while offline and handle conflicts?

**Success criteria:**
- Updates saved locally immediately
- Changes queued for sync
- Conflict resolution on reconnect (last-write-wins)
- No data loss

**Real-world scenario:** Two team members edit same project offline, sync resolves conflict.

#### 3. Organisation Switching Offline
**What it tests:** WW Admin can switch between their 2 orgs while offline?

**Success criteria:**
- Context switches cleanly
- Data isolated between orgs
- No cache contamination
- Queued operations tagged with correct org

**Real-world scenario:** WW Admin manages Wildlife.ai project, then switches to Conservation Trust project, both offline.

#### 4. Queue Persistence
**What it tests:** Offline operations survive app restarts?

**Success criteria:**
- Queue stored in SQLite (persistent storage)
- Restored on app initialization
- Operations execute in original order

**Real-world scenario:** App crashes while user has pending uploads; operations resume on restart.

#### 5. Performance Under Load
**What it tests:** App remains responsive with many projects offline?

**Success criteria:**
- 100+ projects fetch in <2 seconds
- UI remains responsive
- No memory leaks

**Real-world scenario:** Large conservation organization with 200+ projects loads project list.

#### 6. Network Reconnection
**What it tests:** Automatic sync when connectivity returns?

**Success criteria:**
- Network monitor detects reconnection
- Sync queue automatically processes
- All pending operations synced
- Success/failure notifications

**Real-world scenario:** Device reconnects to WiFi after field work day.

### Organisation Isolation Scenarios

#### 1. Organisation-Scoped Visibility
**What it tests:** Users can ONLY see projects from their organisation(s)?

**Success criteria:**
- Standard user sees only 1 org's projects
- WW Admin sees only their 2 assigned orgs
- No cross-org data leaks
- Direct ID access blocked across orgs

**Security impact:** Prevents unauthorized access to other organisations' wildlife data.

#### 2. WW Admin Mobile Scope
**What it tests:** WW Admin is org-scoped in mobile (NOT global like web portal)?

**Success criteria:**
- WW Admin sees ONLY assigned org projects
- Cannot see unrelated org projects
- Org switching maintains isolation
- Mobile != web portal permissions

**Security impact:** Prevents WW Admin from accessing all organisation data via mobile app.

#### 3. Membership Limits
**What it tests:** Users can only join allowed number of organisations?

**Success criteria:**
- Standard users: max 1 organisation
- WW Admin: max 2 organisations
- Attempts to exceed limit rejected
- Backend trigger enforces limits

**Security impact:** Prevents membership sprawl and unauthorized access.

#### 4. Role-Based Access
**What it tests:** Roles correctly limit user capabilities?

**Success criteria:**
- `project_member`: read-only access
- `project_admin`: edit + member management
- `ww_admin`: organisation-level permissions
- Permission checks before operations

**Security impact:** Prevents unauthorized modifications by read-only users.

#### 5. Data Leakage Prevention
**What it tests:** No accidental cross-org data exposure?

**Success criteria:**
- Cache isolated by organisation
- User switch clears previous org data
- No residual data in memory
- Query results org-filtered

**Security impact:** Critical for multi-tenant data security compliance.

## 🐛 Troubleshooting

### Common Test Failures

#### Mock Initialization Errors
**Symptom:** `TypeError: Cannot read properties of undefined`

**Solution:**
```bash
# Clear Jest cache
npm test -- --clearCache

# Reinstall dependencies
rm -rf node_modules && npm install
```

#### Database Connection Errors
**Symptom:** `SQLite database not initialized`

**Solution:**
```bash
# Ensure DatabaseService initializes before tests
# Check beforeAll() hook in test file
```

#### Supabase Mock Errors
**Symptom:** `supabase.from is not a function`

**Solution:**
```javascript
// Verify jest.mock() is at top level (before describe blocks)
// Check mock structure matches actual Supabase client API
```

### Performance Issues

#### Tests Run Slowly
**If tests take >30 seconds:**

```bash
# Run specific slow test in isolation
npm test -- tests/integration/projects/airplane-mode.test.ts -t "should render 100+ projects"

# Check for missing async/await
# Verify cleanup in afterEach()
```

## 📝 Adding New Tests

### Test Template

```typescript
describe('Feature Name', () => {
  let projectService: ProjectService;
  let dbService: DatabaseService;

  beforeAll(async () => {
    projectService = new ProjectService();
    dbService = new DatabaseService();
    await dbService.initializeDatabase();
    await projectService.initialize();
  });

  afterAll(async () => {
    await dbService.close();
  });

  beforeEach(async () => {
    await dbService.clearAllData();
  });

  it('should do something', async () => {
    // ARRANGE: Setup test data and conditions
    const testData = { /* ... */ };

    // ACT: Perform the operation being tested
    const result = await projectService.someMethod(testData);

    // ASSERT: Verify expected outcomes
    expect(result).toBeDefined();
    expect(result.someProperty).toBe(expectedValue);
  });
});
```

### Best Practices

1. **Use AAA Pattern**: Arrange, Act, Assert
2. **Clear Test Names**: Describe what is being tested and expected outcome
3. **Independent Tests**: Each test should run in isolation
4. **Cleanup**: Always clean database in beforeEach()
5. **Meaningful Assertions**: Test behavior, not implementation
6. **Console Logs**: Use for debugging but don't commit excessive logs

## 📈 Success Criteria

### Phase 3.3 Complete When:

- ✅ All 18 tests passing (9 airplane mode + 9 org isolation)
- ✅ Code coverage >80% for ProjectService
- ✅ Code coverage >85% for DatabaseService
- ✅ Code coverage >80% for OfflineService
- ✅ Performance tests meet <2s target
- ✅ Security tests validate all isolation requirements
- ✅ No critical bugs or edge cases discovered
- ✅ Test execution documented
- ✅ TASK-12-STATUS.md updated
- ✅ MVP2-METRICS-TRACKER.md updated with Phase 3.3 hours

## 🔍 Quality Gates

### Before Marking Phase 3.3 Complete:

1. **All Tests Green**: 100% pass rate
2. **Coverage Targets Met**: >80% overall, 100% critical paths
3. **Performance Validated**: 100+ projects <2s verified
4. **Security Validated**: All org isolation tests passing
5. **Documentation Updated**: README, status files, metrics tracker
6. **Commit Clean**: All test files committed to git
7. **Integration Verified**: Works with real DatabaseService and OfflineService

## 📚 Related Documentation

- **Task 12 Specification**: `task_012_implementation_spec.md`
- **Execution Plan**: `task_012_execution_plan.md`
- **Current Status**: `TASK-12-STATUS.md`
- **Metrics Tracker**: `MVP2-METRICS-TRACKER.md`
- **Master Plan**: `MVP2-MASTER-EXECUTION-PLAN.md`

---

**Last Updated**: 2025-10-05
**Test Suite Version**: 1.0.0
**Phase**: Task 12 - Phase 3.3 (Final Testing & Validation)
**Status**: ✅ Ready for Execution
