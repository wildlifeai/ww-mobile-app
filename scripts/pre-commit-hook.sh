#!/bin/bash
# Environment-Aware Pre-Commit Hook - Type Drift Prevention
# Part of 5-layer defense-in-depth strategy (Layer 4)
# Created: 2025-10-29
# Purpose: Validate types based on commit context (local vs cloud)

# Exit on error
set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Emergency override check
if [ -n "$SKIP_TYPE_CHECK" ]; then
  echo ""
  echo "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo "${YELLOW}⚠️  WARNING: Type validation SKIPPED (SKIP_TYPE_CHECK=1)${NC}"
  echo "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Emergency override enabled. Commit will proceed without type validation."
  echo ""
  echo "${RED}⚠️  Use this ONLY in emergencies!${NC}"
  echo "Remember to validate types manually after commit:"
  echo "  npm run types:check-local    (for local development)"
  echo "  npm run types:check-cloud-dev (for cloud deployment)"
  echo ""
  exit 0
fi

echo ""
echo "${BLUE}🔍 Validating database types...${NC}"
echo ""

# Function to detect commit context from staged files and commit message
detect_commit_context() {
  local commit_msg_file=".git/COMMIT_EDITMSG"
  local context="local"

  # Check if supabase.ts is being modified
  if git diff --cached --name-only | grep -q "src/types/supabase.ts"; then
    echo "${BLUE}ℹ️  Type file modification detected${NC}" >&2
  fi

  # Read commit message if available (during commit-msg hook or if file exists)
  if [ -f "$commit_msg_file" ]; then
    local commit_msg=$(cat "$commit_msg_file" 2>/dev/null || echo "")

    # Check for cloud-related keywords
    if echo "$commit_msg" | grep -qiE "(cloud|preview|production|deploy|release|staging)"; then
      echo "${YELLOW}ℹ️  Cloud-related commit detected in message${NC}" >&2
      context="cloud"
    fi

    # Check for environment-specific tags
    if echo "$commit_msg" | grep -qE "\[cloud-dev\]|\[cloud-prod\]|\[preview\]"; then
      echo "${YELLOW}ℹ️  Cloud environment tag detected${NC}" >&2
      context="cloud"
    fi
  fi

  # Check environment variable override
  if [ -n "$COMMIT_CONTEXT" ]; then
    echo "${BLUE}ℹ️  Manual context override: COMMIT_CONTEXT=$COMMIT_CONTEXT${NC}" >&2
    context="$COMMIT_CONTEXT"
  fi

  echo "$context"
}

# Function to validate types against local Supabase
validate_local() {
  echo "${BLUE}📍 Validating against LOCAL Supabase instance${NC}"
  echo ""

  # Check if local Supabase is reachable
  if ! curl -s http://localhost:54321/health > /dev/null 2>&1; then
    echo "${YELLOW}⚠️  WARNING: Local Supabase instance not reachable${NC}"
    echo ""
    echo "Cannot connect to http://localhost:54321"
    echo ""
    echo "Options:"
    echo "  1. Start local Supabase: cd ~/dev/wildlifeai/wildlife-watcher-backend && npx supabase start"
    echo "  2. Skip validation (emergency only): SKIP_TYPE_CHECK=1 git commit ..."
    echo "  3. Validate against cloud: COMMIT_CONTEXT=cloud git commit ..."
    echo ""
    return 1
  fi

  # Run local type validation
  if npm run types:check-local --silent; then
    echo ""
    echo "${GREEN}✅ Types are synchronized with LOCAL Supabase${NC}"
    return 0
  else
    echo ""
    echo "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "${RED}❌ COMMIT BLOCKED: Types out of sync with LOCAL Supabase${NC}"
    echo "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Your committed types don't match the local database schema."
    echo ""
    echo "${YELLOW}To fix this issue:${NC}"
    echo "  1. Regenerate types: npm run types:local"
    echo "  2. Review changes:    git diff src/types/supabase.ts"
    echo "  3. Stage types:       git add src/types/supabase.ts"
    echo "  4. Commit again:      git commit"
    echo ""
    echo "${BLUE}This usually happens when:${NC}"
    echo "  • Backend team made schema changes (check coordination inbox)"
    echo "  • You pulled backend migration files without regenerating types"
    echo "  • Local Supabase instance has pending migrations"
    echo ""
    echo "${YELLOW}Alternative options:${NC}"
    echo "  • Validate against cloud instead: COMMIT_CONTEXT=cloud git commit ..."
    echo "  • Emergency override (NOT recommended): SKIP_TYPE_CHECK=1 git commit ..."
    echo ""
    echo "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    return 1
  fi
}

# Function to suggest cloud validation
suggest_cloud_validation() {
  echo "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo "${YELLOW}ℹ️  CLOUD-RELATED COMMIT DETECTED${NC}"
  echo "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Your commit message suggests this is for cloud deployment."
  echo ""
  echo "${YELLOW}Recommendation:${NC} Validate against cloud environment instead"
  echo ""
  echo "${BLUE}To validate against cloud-dev:${NC}"
  echo "  npm run types:check-cloud-dev"
  echo ""
  echo "If types are aligned, retry commit:"
  echo "  git commit"
  echo ""
  echo "Or force cloud validation:"
  echo "  COMMIT_CONTEXT=cloud git commit ..."
  echo ""
  echo "${YELLOW}Proceeding with LOCAL validation (default safe behavior)${NC}"
  echo "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# Main execution
CONTEXT=$(detect_commit_context)

if [ "$CONTEXT" = "cloud" ]; then
  # Cloud context detected - suggest cloud validation but default to local for safety
  suggest_cloud_validation

  # Still validate local (safe default)
  if ! validate_local; then
    exit 1
  fi
else
  # Local context - validate local
  if ! validate_local; then
    exit 1
  fi
fi

# Check for unread coordination messages (warning only, doesn't block)
INBOX_DIR="$HOME/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile"
if [ -d "$INBOX_DIR" ]; then
  UNREAD_COUNT=$(find "$INBOX_DIR" -maxdepth 1 -name "*.md" -not -name "README.md" 2>/dev/null | wc -l)

  if [ "$UNREAD_COUNT" -gt 0 ]; then
    echo ""
    echo "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "${YELLOW}⚠️  WARNING: Unread coordination messages ($UNREAD_COUNT)${NC}"
    echo "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Check inbox: $INBOX_DIR"
    echo ""
    echo "Messages may contain:"
    echo "  • Schema change notifications"
    echo "  • Task requests from backend team"
    echo "  • Important system updates"
    echo ""
    echo "This is a warning only - commit will proceed."
    echo "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
  fi
fi

echo ""
echo "${GREEN}✅ Pre-commit checks passed${NC}"
echo ""

exit 0
