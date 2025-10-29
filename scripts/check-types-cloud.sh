#!/bin/bash
# Type alignment validation for Supabase cloud environments
# Checks if committed types match the schema of a cloud Supabase instance
#
# Usage: ./scripts/check-types-cloud.sh <environment>
#   environment: cloud-dev or cloud-prod
#
# Environment Configuration:
#   cloud-dev:  nuhwmubvygxyddkycmpa (https://nuhwmubvygxyddkycmpa.supabase.co)
#   cloud-prod: [NOT YET CONFIGURED]
#
# Dependencies:
#   - Supabase CLI (must be authenticated to the project)
#   - Project must be linked: `supabase link --project-ref <ref>`
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

# Map environment to Supabase project ref
case $ENVIRONMENT in
  cloud-dev)
    PROJECT_REF="nuhwmubvygxyddkycmpa"
    ;;
  cloud-prod)
    echo "❌ Error: Production environment not yet configured"
    echo ""
    echo "Production Supabase project ref needs to be added to:"
    echo "  - scripts/check-types-cloud.sh"
    echo "  - package.json (types:cloud-prod script)"
    exit 1
    ;;
  *)
    echo "❌ Error: Unknown environment '$ENVIRONMENT'"
    exit 1
    ;;
esac

echo "🔍 Checking type alignment with $ENVIRONMENT Supabase instance..."
echo "   Project ref: $PROJECT_REF"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "❌ Error: Supabase CLI not found"
  echo ""
  echo "Install with: npm install -g supabase"
  echo "Or see: https://supabase.com/docs/guides/cli/getting-started"
  exit 1
fi

# Create temporary file for fresh types
TEMP_TYPES=$(mktemp)

# Ensure cleanup on exit
trap "rm -f $TEMP_TYPES" EXIT

# Generate types from cloud instance
echo "📡 Generating types from $ENVIRONMENT (this may take a few seconds)..."
if ! npx supabase gen types typescript --linked --project-ref "$PROJECT_REF" > "$TEMP_TYPES" 2>/dev/null; then
  echo ""
  echo "❌ Error: Failed to generate types from $ENVIRONMENT"
  echo ""
  echo "Possible causes:"
  echo "  1. Not authenticated to Supabase CLI (run: supabase login)"
  echo "  2. No access to project ref: $PROJECT_REF"
  echo "  3. Network connectivity issues"
  echo "  4. Project ref is incorrect"
  echo ""
  echo "To authenticate: supabase login"
  echo "To link project:  supabase link --project-ref $PROJECT_REF"
  exit 1
fi

# Check if temp file has content
if [ ! -s "$TEMP_TYPES" ]; then
  echo "❌ Error: Generated types file is empty"
  exit 1
fi

# Compare with committed types
if diff -q "$TEMP_TYPES" src/types/supabase.ts > /dev/null 2>&1; then
  echo ""
  echo "✅ Types are aligned with $ENVIRONMENT"
  echo ""
  echo "Committed types match the cloud database schema."
  exit 0
else
  echo ""
  echo "❌ ERROR: Types are out of sync with $ENVIRONMENT!"
  echo ""
  echo "The committed types (src/types/supabase.ts) do not match the"
  echo "current schema of the $ENVIRONMENT Supabase instance."
  echo ""
  echo "To fix, run:"
  echo "  npm run types:$ENVIRONMENT"
  echo ""
  echo "Then commit the updated types:"
  echo "  git add src/types/supabase.ts"
  echo "  git commit -m 'chore(types): sync with $ENVIRONMENT schema'"
  echo ""
  echo "First 20 lines of diff:"
  diff -u src/types/supabase.ts "$TEMP_TYPES" | head -30 || true
  echo ""
  exit 1
fi
