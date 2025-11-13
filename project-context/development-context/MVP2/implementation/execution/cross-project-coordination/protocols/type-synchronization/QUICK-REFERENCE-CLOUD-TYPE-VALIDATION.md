# Quick Reference: Cloud Type Validation

## What Is This?
GitHub Actions workflows that prevent deployments with stale cloud types by validating type alignment before builds.

## Two Workflows

### 1. cloud-type-validation.yml (PR Protection)
**Purpose**: Validates types on pull requests to main
**Triggers**:
- Automatic: PRs to main
- Manual: Actions tab → Cloud Type Validation → Run workflow

**What it does**:
- Generates types from cloud-dev Supabase
- Compares with committed types
- Fails PR if types don't match
- Provides diff artifact for debugging

### 2. build.yml (Build Protection)
**Purpose**: Validates types before building iOS/Android apps
**Triggers**: Version tags (e.g., v1.0.0)

**What it does**:
- Runs type validation FIRST
- Blocks entire build pipeline if types stale
- Ensures deployed apps have current types

## Required Setup

### GitHub Secret: SUPABASE_ACCESS_TOKEN
1. Get token: [Supabase Dashboard](https://supabase.com/dashboard) → Profile → Access Tokens
2. Add to GitHub: Repo Settings → Secrets → Actions → New secret
3. Name: `SUPABASE_ACCESS_TOKEN`

**See**: `github-secrets-setup.md` for detailed instructions

## Common Workflows

### Fix "Types out of sync" error
```bash
# 1. Regenerate types from cloud
npm run types:cloud-dev

# 2. Commit updated types
git add src/types/supabase.ts
git commit -m 'chore(types): sync with cloud-dev schema'
git push
```

### Test workflow manually
```bash
# Go to GitHub: Actions → Cloud Type Validation → Run workflow
# Select: cloud-dev
# Click: Run workflow
```

### View type differences
```bash
# After workflow fails, download artifact:
# Actions → Failed workflow run → Artifacts → type-diff-cloud-dev
# Extract and view the diff
```

## Workflow Behavior

### Success Path
```
✅ Types validated → ✅ Build proceeds → ✅ App deployed
```

### Failure Path (Type Mismatch)
```
❌ Types out of sync → ❌ Build blocked → ℹ️  Fix required
```

### Graceful Degradation (Missing Secret)
- **cloud-type-validation.yml**: Fails immediately (strict)
- **build.yml**: Logs warning, continues (graceful)

## Quick Diagnostics

### Workflow fails: "SUPABASE_ACCESS_TOKEN not configured"
**Fix**: Add secret to GitHub (see github-secrets-setup.md)

### Workflow fails: "Types are out of sync"
**Fix**: Run `npm run types:cloud-dev` and commit

### Workflow fails: "Failed to generate types"
**Check**:
- Token expired? Generate new token
- Network issues? Check Supabase status
- Project ref correct? Should be nuhwmubvygxyddkycmpa

### Workflow timeout (>10 minutes)
**Check**:
- GitHub Actions status page
- Supabase status page
- Re-run workflow

## Architecture

```
PR → Validate Types → Pass? → Merge
                    → Fail? → Fix types → Push

Tag → Validate Types → Pass? → Extract Metadata → Build iOS/Android
                     → Fail? → Block entire pipeline
```

## Files

### Workflows
- `.github/workflows/cloud-type-validation.yml` (PR validation)
- `.github/workflows/build.yml` (build validation)

### Scripts
- `scripts/check-types-cloud.sh` (validation logic)
- `package.json` (npm scripts: types:cloud-dev, types:check-cloud-dev)

### Documentation
- `github-secrets-setup.md` (detailed setup)
- This file (quick reference)

## NPM Scripts

```bash
# Generate types from cloud
npm run types:cloud-dev          # Development instance
npm run types:cloud-prod         # Production (not yet configured)

# Validate types against cloud
npm run types:check-cloud-dev    # Check if aligned with dev
npm run types:check-cloud-prod   # Check if aligned with prod

# Full validation
npm run validate:cloud-dev       # Types + type-check + tests
npm run validate:cloud-prod      # Types + type-check + tests
```

## Environment Configuration

### Cloud Dev
- **Project Ref**: nuhwmubvygxyddkycmpa
- **URL**: https://nuhwmubvygxyddkycmpa.supabase.co
- **Status**: ✅ Configured

### Cloud Prod
- **Status**: ⚠️ Not yet configured
- **Workflows**: Will fail gracefully with clear message

## Integration Points

### Local Development
- Uses local Supabase instance
- Types validated via `.git/hooks/pre-commit`
- Separate from cloud validation

### Cloud Deployments
- Uses cloud Supabase instances
- Types validated via GitHub Actions
- Blocks builds if stale

### Cross-Environment Flow
```
Local Dev → Local Types → Commit
                ↓
GitHub PR → Cloud Type Validation (PR protection)
                ↓
Merge to main → Tag created
                ↓
Build Pipeline → Cloud Type Validation (build protection)
                ↓
iOS/Android Build → Deploy
```

## Performance

### Typical Runtime
- cloud-type-validation.yml: 3-5 minutes
- build.yml (type validation step): 2-3 minutes

### Optimization
- NPM dependency caching: ~2 min → ~30 sec
- Parallel builds after validation
- 10-minute timeout prevents runaway workflows

## Security

- Token never logged (--token - uses stdin)
- Encrypted at rest by GitHub
- Audit trail of all access
- Recommended rotation: every 90 days

## Troubleshooting Resources

1. **GitHub Actions logs**: Check detailed step output
2. **Artifacts**: Download type-diff files for comparison
3. **Scripts**: Run `npm run types:check-cloud-dev` locally
4. **Documentation**: See github-secrets-setup.md

## Support

- **Workflow issues**: Check .github/workflows/ files
- **Script issues**: Check scripts/check-types-cloud.sh
- **Secret issues**: See github-secrets-setup.md
- **Type issues**: Run npm run types:cloud-dev

## Related Documentation

- `github-secrets-setup.md` - Detailed secret configuration
- `Backend-Mobile-Type-Synchronization-Guide.md` - Overall strategy
- `local-dev-sync-workflow.md` - Local development workflow
- `type-sync-implementation-templates.md` - Implementation patterns
