#!/bin/bash
# Helper script to switch Supabase CLI link between environments
#
# Usage: ./scripts/switch-supabase-instance.sh <environment>
#   environment: local, cloud-dev, or cloud-prod
#
# Environment Configuration:
#   local:      Uses local Supabase instance (no link needed)
#   cloud-dev:  nuhwmubvygxyddkycmpa (https://nuhwmubvygxyddkycmpa.supabase.co)
#   cloud-prod: [NOT YET CONFIGURED]
#
# Purpose:
#   This script manages the Supabase CLI link to ensure type generation
#   targets the correct environment. The CLI can only be linked to one
#   project at a time, so switching is necessary when working with
#   multiple environments.
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
    echo "  cd ~/dev/wildlifeai/wildlife-watcher-backend"
    echo "  npx supabase start"
    echo ""
    echo "✅ No action needed for local environment"
    ;;

  cloud-dev)
    PROJECT_REF="nuhwmubvygxyddkycmpa"
    PROJECT_URL="https://nuhwmubvygxyddkycmpa.supabase.co"

    echo "📡 Linking to cloud-dev environment"
    echo "   Project ref: $PROJECT_REF"
    echo "   Project URL: $PROJECT_URL"
    echo ""

    # Check if already linked
    CURRENT_LINK=$(npx supabase link --project-ref "$PROJECT_REF" 2>&1 || true)

    if echo "$CURRENT_LINK" | grep -q "already linked"; then
      echo "✅ Already linked to cloud-dev"
    elif echo "$CURRENT_LINK" | grep -q "Finished supabase link"; then
      echo "✅ Successfully linked to cloud-dev"
    else
      echo "❌ Failed to link to cloud-dev"
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

  cloud-prod)
    echo "❌ Error: Production environment not yet configured"
    echo ""
    echo "Production Supabase project needs to be set up."
    echo ""
    echo "When ready, update this script with:"
    echo "  - Production project ref"
    echo "  - Production project URL"
    exit 1
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
echo "  - Generate types: npm run types:$ENVIRONMENT"
echo "  - Check types:    npm run types:check-$ENVIRONMENT"
echo ""
