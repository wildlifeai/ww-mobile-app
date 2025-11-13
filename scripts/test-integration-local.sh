#!/bin/bash
# Quick integration test against local Supabase
# Run before committing mobile code

set -e

echo "🧪 Testing mobile app against local Supabase..."
echo ""

# 1. Verify Supabase is running
echo "1️⃣ Checking local Supabase is running..."
if ! curl -s http://localhost:54321/rest/v1/ > /dev/null 2>&1; then
  echo "❌ Local Supabase not running!"
  echo ""
  echo "Start it with:"
  echo "  cd ~/dev/wildlifeai/wildlife-watcher-backend && supabase start"
  echo ""
  exit 1
fi
echo "✅ Local Supabase is running"
echo ""

# 2. Check types are current
echo "2️⃣ Checking types are current..."
./scripts/check-types-local.sh
echo ""

# 3. Run TypeScript check
echo "3️⃣ Running TypeScript type check..."
npm run type-check
echo "✅ TypeScript types valid"
echo ""

# 4. Run tests
echo "4️⃣ Running tests..."
npm test
echo "✅ Tests passed"
echo ""

echo "🎉 All integration tests passed!"
echo ""
echo "Safe to commit ✅"
