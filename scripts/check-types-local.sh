#!/bin/bash
# Quick check if local Supabase types are in sync with committed types

set -e

echo "🔍 Checking if types are current with local Supabase..."

# Generate fresh types from local Supabase
npx supabase gen types typescript --local > .types-check.ts 2>/dev/null

# Compare with committed types
if ! diff -q src/types/supabase.ts .types-check.ts > /dev/null 2>&1; then
  echo ""
  echo "❌ ERROR: Supabase types are out of sync!"
  echo ""
  echo "Backend schema changed but types not regenerated."
  echo ""
  echo "To fix, run:"
  echo "  npm run types:local"
  echo ""
  echo "Differences:"
  diff src/types/supabase.ts .types-check.ts | head -20
  echo ""
  rm .types-check.ts
  exit 1
fi

rm .types-check.ts
echo "✅ Types are current with local Supabase"
exit 0
