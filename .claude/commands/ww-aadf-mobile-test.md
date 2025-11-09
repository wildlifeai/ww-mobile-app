---
allowed-tools: Task, Bash(npm test*), Bash(scripts/test-*), Read, mcp__serena__*
description: TDD test suite orchestration with real Supabase testing
argument-hint: [optional: test type - unit|integration|e2e|all]
---

# Mobile Test Orchestration

Test: $ARGUMENTS (default: all)

Execute using ww-aadf-mobile-test-architect agent:

**Testing Strategy** (PRIORITY ORDER):

1. **Integration Tests FIRST** (Real Supabase)
   - Test real API behavior (no mocks)
   - Test Redux state updates
   - Test complete user workflows
   - Test offline scenarios
   - Coverage target: 70%+

2. **Unit Tests SECOND** (Complex Logic Only)
   - Test complex business logic
   - Test form validation schemas
   - Test utility functions
   - Test Redux reducers
   - Coverage target: 80%+

3. **E2E Tests THIRD** (Maestro - Critical Paths)
   - Test critical user journeys
   - Test on real devices
   - Test BDD scenarios
   - Test accessibility

**Evidence-Based Approach**:
- REAL Supabase only (NEVER mocks)
- Tests BEFORE implementation (RED → GREEN → REFACTOR)
- TestID-based element selection
- BDD Given/When/Then patterns

**Usage Examples**:
```bash
# Run all tests
/ww-aadf-mobile-test all

# Run integration tests only (Real Supabase)
/ww-aadf-mobile-test integration

# Run unit tests only
/ww-aadf-mobile-test unit

# Run E2E tests (Maestro)
/ww-aadf-mobile-test e2e

# Run tests with coverage
/ww-aadf-mobile-test --coverage
```

**Expected Output**:
- Test execution summary
- Coverage analysis (unit: 80%+, integration: 70%+)
- Test quality metrics:
  - Pass rate: 100% (no skipped tests)
  - Test speed: <5 seconds per integration test
  - Flakiness: 0% (deterministic only)
- Real Supabase validation:
  - Local Supabase running check
  - Test users seeded validation
  - Cleanup functions executed
- Production readiness score (0-100%)
