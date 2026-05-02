#!/bin/bash
# Type alignment validation for Supabase cloud environments
# Checks if committed types match the schema of a cloud Supabase instance
#
# Usage: ./scripts/check-types-cloud.sh <environment>
#   environment: cloud-dev or cloud-prod
#
# Project ID is read dynamically from the active .env.development file.
#
# Dependencies:
#   - Supabase CLI (must be authenticated to the project)
#
# Exit Codes:
#   0 = Types are aligned with cloud environment
#   1 = Types are out of sync OR error occurred

set -e

ENVIRONMENT=$1

# Validate environment parameter
if [ -z "$ENVIRONMENT" ]; then
  echo "❌ Error: Environment not specified"
  echo ""
  echo "Usage: $0 <environment>"
  echo "  environment: cloud-dev or cloud-prod"
  exit 1
fi

# Validate environment value
if [ "$ENVIRONMENT" != "cloud-dev" ] && [ "$ENVIRONMENT" != "cloud-prod" ]; then
  echo "❌ Error: Invalid environment '$ENVIRONMENT'"
  echo ""
  echo "Valid environments: cloud-dev, cloud-prod"
  exit 1
fi

# Read project ref dynamically from .env.development
ENV_FILE="$(dirname "$0")/../.env.development"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error: .env.development not found at $ENV_FILE"
  exit 1
fi

# Extract the active (uncommented) EXPO_PUBLIC_SUPABASE_URL
SUPABASE_URL=$(grep -E '^[^#]*EXPO_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | head -1 | sed 's/.*=https:\/\/\([a-z0-9]*\)\.supabase\.co.*/\1/')

if [ -z "$SUPABASE_URL" ]; then
  echo "❌ Error: Could not extract Supabase project ID from .env.development"
  exit 1
fi

PROJECT_REF="$SUPABASE_URL"

echo "🔍 Checking type alignment with $ENVIRONMENT Supabase instance..."
echo "   Project ref: $PROJECT_REF (from .env.development)"
echo ""

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

# Create temporary file for fresh types
TEMP_TYPES=$(mktemp)

# Ensure cleanup on exit
trap "rm -f $TEMP_TYPES" EXIT

# Generate types from cloud instance
echo "📡 Generating types from $ENVIRONMENT (this may take a few seconds)..."
if ! npx supabase gen types typescript --project-id "$PROJECT_REF" > "$TEMP_TYPES" 2>/dev/null; then
  echo ""
  echo "❌ Error: Failed to generate types from $ENVIRONMENT"
  echo ""
  echo "Possible causes:"
  echo "  1. Not authenticated to Supabase CLI (run: npx supabase login)"
  echo "  2. No access to project ref: $PROJECT_REF"
  echo "  3. Network connectivity issues"
  echo "  4. Project is paused — wake it via the Supabase Dashboard"
  echo ""
  echo "To authenticate: npx supabase login"
  exit 1
fi

# Check if temp file has content
if [ ! -s "$TEMP_TYPES" ]; then
  echo "❌ Error: Generated types file is empty"
  exit 1
fi

# Compare with committed types
if diff -q "$TEMP_TYPES" src/types/database.types.ts > /dev/null 2>&1; then
  echo ""
  echo "✅ Types are aligned with $ENVIRONMENT"
  echo ""
  echo "Committed types match the cloud database schema."
  exit 0
else
  echo ""
  echo "❌ ERROR: Types are out of sync with $ENVIRONMENT!"
  echo ""
  echo "The committed types (src/types/database.types.ts) do not match the"
  echo "current schema of the $ENVIRONMENT Supabase instance."
  echo ""
  echo "To fix, run:"
  echo "  npm run types:cloud-dev"
  echo ""
  echo "Then commit the updated types:"
  echo "  git add src/types/database.types.ts"
  echo "  git commit -m 'chore(types): sync with $ENVIRONMENT schema'"
  echo ""
  echo "First 20 lines of diff:"
  diff -u src/types/database.types.ts "$TEMP_TYPES" | head -30 || true
  echo ""
  exit 1
fi
