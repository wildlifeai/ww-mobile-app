# Integration Tests - Setup & Execution Guide

## Overview
Integration tests for ProjectService that validate real Supabase backend functionality including:
- Organisation isolation (RLS policies)
- CRUD operations
- Member management with cross-org validation
- Computed fields (member_count, deployment_count, etc.)
- Error handling

## Prerequisites

### 1. Local Supabase Backend
The backend must be running locally:

```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase start
```

Verify it's running on `http://127.0.0.1:54321`

### 2. Database Setup
Ensure migrations and seed data are applied:

```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase db reset  # Resets and applies all migrations
```

### 3. Required Backend Components
The following must exist in the backend:

#### Database Functions (RPC)
- `get_project_members(p_project_id UUID)` - Returns project members with user profiles
- `add_project_member(p_project_id UUID, p_user_id UUID, p_role_id INT)` - Adds member with org validation
- `remove_project_member(p_project_id UUID, p_user_id UUID)` - Soft deletes member

#### Database Views
- `projects_with_stats` - Projects with computed fields (member_count, deployment_count, etc.)

#### RLS Policies
- Organisation-scoped access for all project operations
- WW Admin sees only assigned org projects (not global)
- Standard users see only their org's projects

## Running Tests

### Run All Integration Tests
```bash
npm test -- tests/integration/ProjectService.integration.test.ts
```

### Run Specific Test Suite
```bash
npm test -- tests/integration/ProjectService.integration.test.ts -t "Organisation Isolation"
```

### Run with Coverage
```bash
npm test -- --coverage tests/integration/ProjectService.integration.test.ts
```

### Watch Mode (Development)
```bash
npm test -- --watch tests/integration/ProjectService.integration.test.ts
```

## Test Structure

### Test Files
- `ProjectService.integration.test.ts` - Main integration test suite
- `../setup/supabase-test-client.ts` - Test client configuration
- `../fixtures/project-test-data.ts` - Reusable test data

### Test Suites
1. **Organisation Isolation** (3 tests)
   - Org-scoped project listing
   - WW Admin org-scoped access
   - Cross-org access blocking

2. **CRUD Operations** (4 tests)
   - Create with org context
   - Update with permission validation
   - Prevent non-admin updates
   - Soft delete

3. **Member Management** (4 tests)
   - Add member to project
   - Prevent cross-org assignment
   - Remove member (soft delete)
   - Get members with profiles

4. **Computed Fields** (3 tests)
   - Member count accuracy
   - Deployment count
   - LoRaWAN device count

5. **Offline Queue** (2 tests - TODO)
   - Queue operations when offline
   - Sync when online

6. **Error Handling** (4 tests)
   - Network failures
   - Permission denied
   - Org limit violations
   - Cross-org assignment attempts

## Test Data

### Test Users
- `test-org1-admin@example.com` - Org1 admin
- `test-org1-member@example.com` - Org1 member
- `test-org2-admin@example.com` - Org2 admin
- `test-ww-admin@example.com` - WW Admin (assigned to Org1)

### Test Organisations
- `Test Organisation 1` (test-org-1)
- `Test Organisation 2` (test-org-2)

### Cleanup
Tests automatically clean up all test data in `beforeAll` and `afterAll` hooks.

## Debugging

### Enable Verbose Logging
```bash
npm test -- --verbose tests/integration/ProjectService.integration.test.ts
```

### Check Supabase Connection
```bash
curl http://127.0.0.1:54321/rest/v1/ -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
```

### View Test Database
```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase db studio  # Opens Studio UI
```

### Manual Cleanup
If tests fail and leave data behind:
```typescript
import { cleanupTestData } from '../setup/supabase-test-client';
await cleanupTestData();
```

## Common Issues

### Issue: "Local Supabase is not running"
**Solution**: Start Supabase backend
```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase start
```

### Issue: "RPC function not found"
**Solution**: Ensure backend migrations applied
```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase db reset
```

### Issue: "RLS policy violation"
**Solution**: Check user roles and org membership are set up correctly in test setup

### Issue: Tests hanging
**Solution**: Check for auth session not cleared between tests
```bash
# Restart tests with --forceExit
npm test -- --forceExit tests/integration/ProjectService.integration.test.ts
```

## Expected Results

### Success Criteria
- ✅ All 20+ tests passing
- ✅ 80%+ code coverage for ProjectService
- ✅ No RLS policy violations
- ✅ Org isolation enforced
- ✅ Member management validated
- ✅ Computed fields accurate

### Test Output
```
PASS tests/integration/ProjectService.integration.test.ts
  ProjectService Integration Tests
    Organisation Isolation
      ✓ should only return projects from user org (152ms)
      ✓ should enforce org-scoped access for WW Admin (98ms)
      ✓ should block cross-org project access (76ms)
    CRUD Operations
      ✓ should create project with org context (124ms)
      ✓ should update project with permission validation (89ms)
      ✓ should prevent project update by non-admin (67ms)
      ✓ should soft delete project (103ms)
    Member Management
      ✓ should add member to project (112ms)
      ✓ should prevent cross-org member assignment (45ms)
      ✓ should remove member from project (87ms)
      ✓ should get all project members with profiles (69ms)
    Computed Fields
      ✓ should return correct member_count (91ms)
      ✓ should return deployment_count (56ms)
      ✓ should return lorawan_device_count (48ms)
    Offline Queue
      ✓ should queue create operations when offline (12ms)
      ✓ should sync queued operations when online (8ms)
    Error Handling
      ✓ should handle network failures (34ms)
      ✓ should handle permission denied errors (52ms)
      ✓ should handle org limit violations (11ms)
      ✓ should handle cross-org assignment attempts (78ms)

Test Suites: 1 passed, 1 total
Tests:       20 passed, 20 total
Coverage:    82.5% (ProjectService.ts)
Time:        3.847s
```

## Next Steps

1. ✅ Implement remaining offline queue tests
2. ✅ Add performance benchmarks
3. ✅ Add load testing for concurrent operations
4. ✅ Add real LoRaWAN device integration tests
