#!/bin/bash
# Helper script to switch Supabase CLI link between environments
#
# Usage: ./scripts/switch-supabase-instance.sh <environment>
#   environment: local, cloud-dev, or cloud-prod
#
# Project ID is read dynamically from the active .env.development file.
#
# Purpose:
#   This script manages the Supabase CLI link to ensure type generation
#   targets the correct environment. The CLI can only be linked to one
#   project at a time, so switching is necessary when working with
#   multiple environments.
#
# Note: Since sync-types-cloud.js now reads the project ID from
#   .env.development dynamically, this script is mainly useful for
#   Supabase CLI operations that require an explicit project link.
#
# Exit Codes:
#   0 = Successfully linked to environment
#   1 = Error occurred during linking

set -e

ENVIRONMENT=$1

# Validate environment parameter
if [ -z "$ENVIRONMENT" ]; then
  echo "❌ Error: Environment not specified"
  echo ""
  echo "Usage: $0 <environment>"
  echo "  environment: local, cloud-dev, or cloud-prod"
  exit 1
fi

# Check if npx is available
if ! command -v npx &> /dev/null; then
  echo "❌ Error: npx not found (Node.js required)"
  exit 1
fi

# Verify Supabase CLI is available via npx
if ! npx supabase --version &> /dev/null; then
  echo "❌ Error: Supabase CLI not available"
  echo ""
  echo "The Supabase CLI will be installed automatically via npx on first use"
  exit 1
fi

# Read project ref dynamically from .env.development
read_project_ref() {
  ENV_FILE="$(dirname "$0")/../.env.development"
  if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: .env.development not found at $ENV_FILE"
    exit 1
  fi

  PROJECT_REF=$(grep -E '^[^#]*EXPO_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | head -1 | sed 's/.*=https:\/\/\([a-z0-9]*\)\.supabase\.co.*/\1/')

  if [ -z "$PROJECT_REF" ]; then
    echo "❌ Error: Could not extract Supabase project ID from .env.development"
    exit 1
  fi

  PROJECT_URL="https://${PROJECT_REF}.supabase.co"
}

echo "🔄 Switching Supabase CLI link to: $ENVIRONMENT"
echo ""

case $ENVIRONMENT in
  local)
    echo "📍 Using local Supabase instance"
    echo ""
    echo "Local instance does not require CLI linking."
    echo "Type generation uses: npx supabase gen types typescript --local"
    echo ""
    echo "To start local instance:"
    echo "  cd <backend-repo-path>"
    echo "  npx supabase start"
    echo ""
    echo "✅ No action needed for local environment"
    ;;

  cloud-dev|cloud-prod)
    read_project_ref

    echo "📡 Linking to $ENVIRONMENT environment"
    echo "   Project ref: $PROJECT_REF (from .env.development)"
    echo "   Project URL: $PROJECT_URL"
    echo ""

    # Check if already linked
    CURRENT_LINK=$(npx supabase link --project-ref "$PROJECT_REF" 2>&1 || true)

    if echo "$CURRENT_LINK" | grep -q "already linked"; then
      echo "✅ Already linked to $ENVIRONMENT"
    elif echo "$CURRENT_LINK" | grep -q "Finished supabase link"; then
      echo "✅ Successfully linked to $ENVIRONMENT"
    else
      echo "❌ Failed to link to $ENVIRONMENT"
      echo ""
      echo "Output: $CURRENT_LINK"
      echo ""
      echo "Possible causes:"
      echo "  1. Not authenticated (run: npx supabase login)"
      echo "  2. No access to project"
      echo "  3. Network connectivity issues"
      exit 1
    fi
    ;;

  *)
    echo "❌ Error: Invalid environment '$ENVIRONMENT'"
    echo ""
    echo "Valid environments: local, cloud-dev, cloud-prod"
    exit 1
    ;;
esac

echo ""
echo "Current environment: $ENVIRONMENT"
echo ""
echo "Next steps:"
echo "  - Generate types: npm run types:cloud-dev"
echo "  - Check types:    npm run types:check-$ENVIRONMENT"
echo ""
