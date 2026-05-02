#!/bin/bash
# Test suite for environment-aware pre-commit hook
# Validates all key features and edge cases

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TEST_PASSED=0
TEST_FAILED=0

# Test result tracking
pass_test() {
  local test_name=$1
  echo -e "${GREEN}✅ PASS: $test_name${NC}"
  ((TEST_PASSED++))
}

fail_test() {
  local test_name=$1
  local reason=$2
  echo -e "${RED}❌ FAIL: $test_name${NC}"
  echo -e "${RED}   Reason: $reason${NC}"
  ((TEST_FAILED++))
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Environment-Aware Pre-Commit Hook Test Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Hook exists and is executable
echo "${BLUE}Test 1: Hook installation${NC}"
if [ -f "scripts/pre-commit-hook.sh" ] && [ -x "scripts/pre-commit-hook.sh" ]; then
  pass_test "Hook file exists and is executable"
else
  fail_test "Hook file missing or not executable" "Run: chmod +x scripts/pre-commit-hook.sh"
fi
echo ""

# Test 2: Standard local validation
echo "${BLUE}Test 2: Standard local validation${NC}"
if bash scripts/pre-commit-hook.sh >/dev/null 2>&1; then
  pass_test "Standard local validation succeeds"
else
  fail_test "Standard local validation failed" "Check local Supabase status"
fi
echo ""

# Test 3: Emergency override
echo "${BLUE}Test 3: Emergency override mechanism${NC}"
output=$(SKIP_TYPE_CHECK=1 bash scripts/pre-commit-hook.sh 2>&1)
if echo "$output" | grep -q "SKIP_TYPE_CHECK=1" && echo "$output" | grep -q "WARNING"; then
  pass_test "Emergency override works and shows warning"
else
  fail_test "Emergency override not working properly" "Check SKIP_TYPE_CHECK logic"
fi
echo ""

# Test 4: Manual context override
echo "${BLUE}Test 4: Manual context override${NC}"
output=$(COMMIT_CONTEXT=cloud bash scripts/pre-commit-hook.sh 2>&1)
if echo "$output" | grep -q "Manual context override" && echo "$output" | grep -q "CLOUD-RELATED COMMIT"; then
  pass_test "Manual context override detected and handled"
else
  fail_test "Manual context override not detected" "Check COMMIT_CONTEXT logic"
fi
echo ""

# Test 5: Commit message cloud keyword detection
echo "${BLUE}Test 5: Commit message cloud keyword detection${NC}"
echo "[cloud-dev] deploy: test feature" > .git/COMMIT_EDITMSG
output=$(bash scripts/pre-commit-hook.sh 2>&1)
rm -f .git/COMMIT_EDITMSG
if echo "$output" | grep -q "Cloud-related commit detected" && echo "$output" | grep -q "CLOUD-RELATED COMMIT"; then
  pass_test "Cloud keywords detected in commit message"
else
  fail_test "Cloud keywords not detected" "Check keyword regex patterns"
fi
echo ""

# Test 6: Environment tag detection
echo "${BLUE}Test 6: Environment tag detection${NC}"
echo "chore(deploy): update [cloud-dev] environment" > .git/COMMIT_EDITMSG
output=$(bash scripts/pre-commit-hook.sh 2>&1)
rm -f .git/COMMIT_EDITMSG
if echo "$output" | grep -q "Cloud environment tag detected"; then
  pass_test "Environment tags detected"
else
  fail_test "Environment tags not detected" "Check tag regex patterns"
fi
echo ""

# Test 7: Performance check (should be <5 seconds)
echo "${BLUE}Test 7: Performance check (<5 seconds)${NC}"
start_time=$(date +%s)
bash scripts/pre-commit-hook.sh >/dev/null 2>&1
end_time=$(date +%s)
duration=$((end_time - start_time))
if [ $duration -lt 5 ]; then
  pass_test "Hook executes in ${duration}s (fast path)"
else
  fail_test "Hook too slow: ${duration}s" "Target: <5s"
fi
echo ""

# Test 8: Local Supabase health check
echo "${BLUE}Test 8: Local Supabase connectivity${NC}"
if curl -s http://localhost:54321/health > /dev/null 2>&1; then
  pass_test "Local Supabase is reachable"
else
  fail_test "Local Supabase not reachable" "Start with: npx supabase start"
fi
echo ""

# Test 9: Type validation scripts exist
echo "${BLUE}Test 9: Required validation scripts${NC}"
if [ -x "scripts/check-types-local.sh" ] && [ -x "scripts/check-types-cloud.sh" ]; then
  pass_test "All required validation scripts present"
else
  fail_test "Validation scripts missing or not executable" "Check scripts/ directory"
fi
echo ""

# Test 10: Coordination inbox check
echo "${BLUE}Test 10: Coordination inbox integration${NC}"
output=$(bash scripts/pre-commit-hook.sh 2>&1)
# Should always run this check (warning or not)
if echo "$output" | grep -qE "(WARNING: Unread|Pre-commit checks passed)"; then
  pass_test "Coordination inbox check runs"
else
  fail_test "Coordination inbox check not running" "Check inbox logic"
fi
echo ""

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Test Results Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "  ${GREEN}Passed: $TEST_PASSED${NC}"
echo -e "  ${RED}Failed: $TEST_FAILED${NC}"
echo -e "  Total:  $((TEST_PASSED + TEST_FAILED))"
echo ""

if [ $TEST_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed! Hook is ready for installation.${NC}"
  echo ""
  echo "To install:"
  echo "  ln -sf ../../scripts/pre-commit-hook.sh .git/hooks/pre-commit"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Some tests failed. Review failures above.${NC}"
  echo ""
  exit 1
fi
