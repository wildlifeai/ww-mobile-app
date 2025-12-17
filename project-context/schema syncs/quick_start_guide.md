# Quick Start: Implementing Enhanced Schema Validation

## 30-Minute Quick Start

### Step 1: Create Enhanced Validator (10 mins)

```bash
# 1. Create the new script
cat > scripts/validate-watermelon-schema-live.js << 'EOF'
# [Copy content from artifact: enhanced_schema_validator]
EOF

# 2. Make executable
chmod +x scripts/validate-watermelon-schema-live.js

# 3. Test it works
node scripts/validate-watermelon-schema-live.js --env=local
```

### Step 2: Update package.json (5 mins)

```bash
# Add these scripts to package.json:
npm pkg set scripts.schema:validate:live="node scripts/validate-watermelon-schema-live.js"
npm pkg set scripts.schema:validate:live:local="node scripts/validate-watermelon-schema-live.js --env=local"
npm pkg set scripts.schema:validate:live:cloud-dev="node scripts/validate-watermelon-schema-live.js --env=cloud-dev"
npm pkg set scripts.sync:from-live:cloud-dev="npm run types:cloud-dev && npm run schema:validate:live:cloud-dev"
npm pkg set scripts.dev:status="npm run types:check-local && npm run schema:validate:live:local"
```

### Step 3: Test the Workflow (10 mins)

```bash
# Test local validation
npm run schema:validate:live:local

# Test cloud-dev validation
npm run schema:validate:live:cloud-dev

# Test complete sync workflow
npm run sync:from-live:cloud-dev

# Test dev status check
npm run dev:status
```

### Step 4: Update Pre-Build Check (5 mins)

Add to `scripts/pre-build-check.sh` before the summary:

```bash
# Check 9: Schema validation
print_check "9/9" "Validating WatermelonDB schema..."
SCHEMA_CHECK_PASSED=true

if npm run schema:validate:live:cloud-dev --silent 2>/dev/null; then
    print_pass "Schema matches cloud-dev database"
else
    print_fail "Schema out of sync with cloud-dev"
    SCHEMA_CHECK_PASSED=false
fi

if [ "$SCHEMA_CHECK_PASSED" = true ]; then
    ((CHECKS_PASSED++))
else
    ((CHECKS_FAILED++))
fi
```

---

## 1-Hour Complete Implementation

### Include Quick Start + GitHub Actions

#### Step 5: Create GitHub Actions Workflow (20 mins)

```bash
# 1. Create workflow directory
mkdir -p .github/workflows

# 2. Create workflow file
cat > .github/workflows/schema-validation.yml << 'EOF'
name: Schema Validation

on:
  pull_request:
    paths:
      - 'src/database/schema.ts'
      - 'src/types/supabase.ts'
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:

jobs:
  validate-schema:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [cloud-dev]
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Validate types
        env:
          EXPO_PUBLIC_SUPABASE_URL_CLOUD_DEV: ${{ secrets.EXPO_PUBLIC_SUPABASE_URL_CLOUD_DEV }}
          EXPO_PUBLIC_SUPABASE_ANON_KEY_CLOUD_DEV: ${{ secrets.EXPO_PUBLIC_SUPABASE_ANON_KEY_CLOUD_DEV }}
        run: npm run types:check-${{ matrix.environment }}
      
      - name: Validate schema
        env:
          EXPO_PUBLIC_SUPABASE_URL_CLOUD_DEV: ${{ secrets.EXPO_PUBLIC_SUPABASE_URL_CLOUD_DEV }}
          EXPO_PUBLIC_SUPABASE_ANON_KEY_CLOUD_DEV: ${{ secrets.EXPO_PUBLIC_SUPABASE_ANON_KEY_CLOUD_DEV }}
        run: npm run schema:validate:live:${{ matrix.environment }} -- --json > validation-report.json
      
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: schema-validation-report
          path: validation-report.json
      
      - name: Comment on PR
        if: github.event_name == 'pull_request' && failure()
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('validation-report.json', 'utf8'));
            
            let comment = `## ❌ Schema Validation Failed\n\n`;
            comment += `**Environment**: ${report.environment}\n\n`;
            
            if (report.details.errors.length > 0) {
              comment += `### Errors (${report.details.errors.length})\n\n`;
              report.details.errors.slice(0, 5).forEach(error => {
                comment += `- ${error.message}\n`;
              });
              if (report.details.errors.length > 5) {
                comment += `\n... and ${report.details.errors.length - 5} more errors\n`;
              }
            }
            
            comment += `\n**Action**: Update \`src/database/schema.ts\` to match database schema.\n`;
            comment += `Run: \`npm run sync:from-live:${report.environment}\``;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
EOF

# 3. Add secrets to GitHub (do this via GitHub web UI):
# Settings → Secrets → Actions → New repository secret
# - EXPO_PUBLIC_SUPABASE_URL_CLOUD_DEV
# - EXPO_PUBLIC_SUPABASE_ANON_KEY_CLOUD_DEV
```

#### Step 6: Test CI Workflow (10 mins)

```bash
# Create test branch
git checkout -b test/schema-validation-ci

# Commit changes
git add .github/workflows/schema-validation.yml
git add scripts/validate-watermelon-schema-live.js
git add package.json
git commit -m "ci: add schema validation workflow"

# Push and create PR
git push origin test/schema-validation-ci
gh pr create --title "Test: Schema validation CI" --body "Testing automated schema validation"

# Monitor workflow run
gh run watch
```

#### Step 7: Documentation (10 mins)

Update `scripts/README.md`:

```markdown
## Schema Validation

### Quick Commands

```bash
# Check schema status
npm run dev:status

# Sync from live database
npm run sync:from-live:cloud-dev

# Validate before building
npm run prebuild:preview
```

### Workflows

**Daily Development**:
1. Check status: `npm run dev:status`
2. If drift detected: `npm run dev:sync`
3. Review changes: `git diff src/types/supabase.ts`
4. Update schema.ts manually if needed
5. Commit: `git add src/database/schema.ts src/types/supabase.ts`

**Before Preview Build**:
```bash
npm run prebuild:preview  # Validates everything
eas build --profile preview
```

**When Backend Schema Changes**:
```bash
npm run sync:from-live:cloud-dev  # Regenerate types + validate
# Review validation output
# Update schema.ts based on errors/warnings
npm run schema:validate:live:cloud-dev  # Verify fixes
```

### Troubleshooting

**"Types are out of sync"**:
```bash
npm run types:cloud-dev  # Regenerate types
git diff src/types/supabase.ts  # Review changes
```

**"Schema validation failed"**:
- Read error messages carefully
- Each error includes suggested fix
- Update `src/database/schema.ts` with suggested changes
- Re-run validation

**"CI workflow failing"**:
- Check if types are committed
- Ensure schema.ts matches types
- Run validation locally first
```

---

## Testing Checklist

### Local Testing
- [ ] `npm run schema:validate:live:local` works
- [ ] Shows errors when schema is intentionally broken
- [ ] Shows success when schema is correct
- [ ] Verbose mode provides detailed output
- [ ] JSON output is valid JSON

### Cloud Testing  
- [ ] `npm run schema:validate:live:cloud-dev` works
- [ ] Validates against actual cloud database
- [ ] Error messages are actionable
- [ ] Fix suggestions are correct

### Workflow Testing
- [ ] `npm run sync:from-live:cloud-dev` regenerates types and validates
- [ ] `npm run dev:status` gives quick status
- [ ] `npm run prebuild:preview` includes schema validation

### CI Testing
- [ ] GitHub Actions workflow triggers on PR
- [ ] Workflow validates types and schema
- [ ] Failures create PR comments
- [ ] Daily cron job runs successfully
- [ ] Manual dispatch works

---

## Common Issues & Solutions

### Issue: "Cannot find check-types-local.sh"
**Solution**: Ensure you're running from repository root
```bash
pwd  # Should show: .../wildlife-watcher-mobile-app
ls scripts/check-types-local.sh  # Should exist
```

### Issue: "Local Supabase not reachable"  
**Solution**: Start backend Supabase
```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase start
```

### Issue: "Types check passes but schema validation fails"
**Solution**: This is correct behavior - types are current but schema.ts needs updating
```bash
# Review the specific errors
npm run schema:validate:live:cloud-dev -- --verbose

# Update src/database/schema.ts based on error messages
# Each error includes the exact fix needed
```

### Issue: "CI workflow not triggering"
**Solution**: Check workflow file syntax and triggers
```bash
# Validate workflow syntax
cat .github/workflows/schema-validation.yml | head -20

# Check if paths match
git log --oneline --name-only | grep -E '(schema.ts|supabase.ts)'
```

---

## Rollback Instructions

If you need to revert these changes:

```bash
# 1. Remove new script
git rm scripts/validate-watermelon-schema-live.js

# 2. Revert package.json changes
git checkout HEAD -- package.json

# 3. Revert pre-build-check.sh changes  
git checkout HEAD -- scripts/pre-build-check.sh

# 4. Disable GitHub Actions
git mv .github/workflows/schema-validation.yml \
       .github/workflows/schema-validation.yml.disabled

# 5. Commit
git commit -m "revert: remove enhanced schema validation"

# 6. Continue using old workflow
npm run types:check-cloud-dev
npm run schema:validate
```

---

## Success Indicators

After implementation, you should see:

✅ **Immediate**:
- New npm scripts work without errors
- Local validation catches schema mismatches
- Pre-build check includes schema validation

✅ **Within 1 day**:
- CI workflow runs on first PR
- Team members can use new commands
- Documentation is clear

✅ **Within 1 week**:
- No schema-related build failures
- Faster feedback on schema issues
- Reduced coordination overhead

✅ **Within 1 month**:
- Daily cron job has detected drift (if any)
- Team workflow is smooth
- Fewer production schema issues

---

## Next Steps

After successful implementation:

1. **Monitor for 1 week**
   - Watch CI workflow runs
   - Gather team feedback
   - Tune validation rules if needed

2. **Iterate based on feedback**
   - Add exemptions for known differences
   - Improve error messages
   - Enhance fix suggestions

3. **Expand coverage**
   - Add more validation rules
   - Implement schema diff visualization
   - Add automated schema.ts updates

4. **Document learnings**
   - Update team wiki
   - Share best practices
   - Create video walkthrough

---

## Support

If you encounter issues:

1. **Check verbose output**:
   ```bash
   npm run schema:validate:live:cloud-dev -- --verbose
   ```

2. **Review logs**:
   ```bash
   # Local validation logs
   cat /tmp/schema-validation-*.log
   
   # CI workflow logs
   gh run view --log
   ```

3. **Ask for help**:
   - Post in team Slack channel
   - Create GitHub issue with error output
   - Reference this guide in your question

Remember: The goal is **faster feedback** on schema issues, not perfection. Start simple, iterate based on real usage.
