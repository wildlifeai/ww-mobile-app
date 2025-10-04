#!/bin/bash

# Backend Verification Script for Integration Tests
# Checks if local Supabase is ready for ProjectService integration tests

echo "🔍 Verifying Local Supabase Backend Setup..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SUPABASE_URL="http://127.0.0.1:54321"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

# 1. Check if Supabase is running
echo "1. Checking Supabase connection..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/rest/v1/" -H "apikey: $ANON_KEY")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
    echo -e "   ${GREEN}✓${NC} Supabase is running at $SUPABASE_URL"
else
    echo -e "   ${RED}✗${NC} Supabase is NOT running (HTTP $HTTP_CODE)"
    echo -e "   ${YELLOW}→${NC} Start with: cd ~/dev/wildlifeai/wildlife-watcher-backend && supabase start"
    exit 1
fi

# 2. Check if tables exist
echo ""
echo "2. Checking required tables..."

check_table() {
    local table=$1
    RESULT=$(curl -s "$SUPABASE_URL/rest/v1/$table?select=id&limit=0" \
        -H "apikey: $ANON_KEY" \
        -H "Authorization: Bearer $ANON_KEY")

    if [[ "$RESULT" == *"error"* ]] || [[ "$RESULT" == *"not found"* ]]; then
        echo -e "   ${RED}✗${NC} Table '$table' not found"
        return 1
    else
        echo -e "   ${GREEN}✓${NC} Table '$table' exists"
        return 0
    fi
}

TABLES=("users" "organisations" "projects" "project_members" "user_organisations" "user_roles")
TABLE_CHECK_PASSED=true

for table in "${TABLES[@]}"; do
    if ! check_table "$table"; then
        TABLE_CHECK_PASSED=false
    fi
done

if [ "$TABLE_CHECK_PASSED" = false ]; then
    echo -e "   ${YELLOW}→${NC} Apply migrations: cd ~/dev/wildlifeai/wildlife-watcher-backend && supabase db reset"
    exit 1
fi

# 3. Check if view exists
echo ""
echo "3. Checking required views..."

VIEW_RESULT=$(curl -s "$SUPABASE_URL/rest/v1/projects_with_stats?select=id&limit=0" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY")

if [[ "$VIEW_RESULT" == *"error"* ]] || [[ "$VIEW_RESULT" == *"not found"* ]]; then
    echo -e "   ${YELLOW}⚠${NC}  View 'projects_with_stats' not found (may need to be created)"
    echo -e "   ${YELLOW}→${NC} This is expected if backend hasn't implemented the view yet"
    echo -e "   ${YELLOW}→${NC} Tests will fail without this view"
else
    echo -e "   ${GREEN}✓${NC} View 'projects_with_stats' exists"
fi

# 4. Check if RPC functions exist (test by calling with dummy data)
echo ""
echo "4. Checking required RPC functions..."

# Note: We can't easily test RPC functions without auth, so we'll document them
echo -e "   ${YELLOW}ℹ${NC}  RPC functions cannot be verified without authentication"
echo "   Required functions:"
echo "      - get_project_members(p_project_id UUID)"
echo "      - add_project_member(p_project_id UUID, p_user_id UUID, p_role_id INT)"
echo "      - remove_project_member(p_project_id UUID, p_user_id UUID)"
echo ""
echo -e "   ${YELLOW}→${NC} These will be validated during test execution"

# 5. Check if seed data exists
echo ""
echo "5. Checking seed data (roles)..."

ROLES_RESULT=$(curl -s "$SUPABASE_URL/rest/v1/roles?select=value&limit=5" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY")

if [[ "$ROLES_RESULT" == "[]" ]]; then
    echo -e "   ${YELLOW}⚠${NC}  No roles found in database"
    echo -e "   ${YELLOW}→${NC} Run: cd ~/dev/wildlifeai/wildlife-watcher-backend && supabase db reset"
else
    echo -e "   ${GREEN}✓${NC} Roles table has data"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$TABLE_CHECK_PASSED" = true ]; then
    echo -e "${GREEN}✅ Backend is ready for integration tests!${NC}"
    echo ""
    echo "Run tests with:"
    echo "  npm test -- tests/integration/ProjectService.integration.test.ts"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Backend needs setup before running tests${NC}"
    echo ""
    echo "Setup steps:"
    echo "  1. cd ~/dev/wildlifeai/wildlife-watcher-backend"
    echo "  2. supabase start"
    echo "  3. supabase db reset"
    echo ""
    exit 1
fi
