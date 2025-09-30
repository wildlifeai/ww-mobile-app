#!/bin/bash

# Wildlife Watcher - Pre-Build Validation Script
# Performs static checks before EAS build to catch common issues early
# Usage: ./scripts/pre-build-check.sh

set -e  # Exit on first error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0

# Helper functions
print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Wildlife Watcher - Pre-Build Validation${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_check() {
    echo -e "${BLUE}[$1]${NC} $2"
}

print_pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    ((CHECKS_PASSED++))
}

print_fail() {
    echo -e "  ${RED}✗${NC} $1"
    ((CHECKS_FAILED++))
}

print_warn() {
    echo -e "  ${YELLOW}⚠${NC} $1"
}

print_summary() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    if [ $CHECKS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All checks passed! ($CHECKS_PASSED/$((CHECKS_PASSED + CHECKS_FAILED)))${NC}"
        echo -e "${GREEN}  Ready to run EAS build${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        exit 0
    else
        echo -e "${RED}✗ ${CHECKS_FAILED} check(s) failed${NC}"
        echo -e "${YELLOW}  Fix the issues above before running EAS build${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        exit 1
    fi
}

# Main checks
print_header

# Check 1: Required configuration files
print_check "1/8" "Checking required configuration files..."
REQUIRED_FILES=(
    "app.json"
    "package.json"
    "metro.config.js"
    "index.js"
    "android/build.gradle"
    "eas.json"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_pass "$file exists"
    else
        print_fail "$file missing"
    fi
done

# Check 2: Entry file syntax
print_check "2/8" "Validating JavaScript syntax in entry file..."
if node -c index.js 2>/dev/null; then
    print_pass "index.js has valid syntax"
else
    print_fail "index.js has syntax errors"
fi

# Check 3: Core dependencies
print_check "3/8" "Checking core dependencies..."
node -e "
const pkg = require('./package.json');
const required = ['react', 'react-native', 'expo', '@supabase/supabase-js', '@reduxjs/toolkit'];
let allPresent = true;

required.forEach(dep => {
    if (pkg.dependencies[dep]) {
        console.log('  ✓ ' + dep);
    } else {
        console.log('  ✗ ' + dep + ' missing');
        allPresent = false;
    }
});

process.exit(allPresent ? 0 : 1);
" && ((CHECKS_PASSED++)) || ((CHECKS_FAILED++))

# Check 4: Critical import paths
print_check "4/8" "Validating critical import paths..."
IMPORT_CHECK_PASSED=true

# Check the fixed projects API import
if grep -q 'from "../../../types/api.types"' src/redux/api/projects/index.ts 2>/dev/null; then
    print_pass "projects API import path correct (../../../types/api.types)"
else
    print_fail "projects API import path incorrect or missing"
    IMPORT_CHECK_PASSED=false
fi

# Verify target file exists
if [ -f "src/types/api.types.ts" ]; then
    print_pass "api.types.ts target file exists"
else
    print_fail "api.types.ts target file missing"
    IMPORT_CHECK_PASSED=false
fi

if [ "$IMPORT_CHECK_PASSED" = true ]; then
    ((CHECKS_PASSED++))
else
    ((CHECKS_FAILED++))
fi

# Check 5: TypeScript configuration
print_check "5/8" "Checking TypeScript configuration..."
if [ -f "tsconfig.json" ]; then
    print_pass "tsconfig.json exists"
    ((CHECKS_PASSED++))
else
    print_fail "tsconfig.json missing"
    ((CHECKS_FAILED++))
fi

# Check 6: Android build configuration
print_check "6/8" "Validating Android configuration..."
ANDROID_CHECK_PASSED=true

if [ -d "android" ]; then
    print_pass "android directory exists"
else
    print_fail "android directory missing"
    ANDROID_CHECK_PASSED=false
fi

if [ -f "android/app/build.gradle" ]; then
    print_pass "android/app/build.gradle exists"
else
    print_fail "android/app/build.gradle missing"
    ANDROID_CHECK_PASSED=false
fi

if grep -q "applicationId" android/app/build.gradle 2>/dev/null; then
    print_pass "applicationId configured"
else
    print_fail "applicationId not configured"
    ANDROID_CHECK_PASSED=false
fi

if [ "$ANDROID_CHECK_PASSED" = true ]; then
    ((CHECKS_PASSED++))
else
    ((CHECKS_FAILED++))
fi

# Check 7: Environment and secrets
print_check "7/8" "Checking environment configuration..."
ENV_CHECK_PASSED=true

if [ -f ".env" ] || [ -f ".env.local" ]; then
    print_pass "Environment file present"
else
    print_warn "No .env file (may be using eas.json secrets)"
fi

# Check for Supabase config (non-blocking warning)
if grep -q "EXPO_PUBLIC_SUPABASE_URL" .env* 2>/dev/null || grep -q "SUPABASE_URL" eas.json 2>/dev/null; then
    print_pass "Supabase URL configured"
else
    print_warn "Supabase URL not found (may cause runtime issues)"
fi

if grep -q "EXPO_PUBLIC_SUPABASE_ANON_KEY" .env* 2>/dev/null || grep -q "SUPABASE_ANON_KEY" eas.json 2>/dev/null; then
    print_pass "Supabase anon key configured"
else
    print_warn "Supabase anon key not found (may cause runtime issues)"
fi

# Always pass this check (warnings only)
((CHECKS_PASSED++))

# Check 8: Git repository status
print_check "8/8" "Checking Git repository status..."
if git rev-parse --git-dir > /dev/null 2>&1; then
    print_pass "Git repository initialized"

    # Check for uncommitted changes (warning only)
    if git diff --quiet && git diff --cached --quiet; then
        print_pass "Working tree clean"
    else
        print_warn "Uncommitted changes detected (non-blocking)"
    fi

    ((CHECKS_PASSED++))
else
    print_warn "Not a Git repository (non-critical)"
    ((CHECKS_PASSED++))
fi

# Print summary
print_summary