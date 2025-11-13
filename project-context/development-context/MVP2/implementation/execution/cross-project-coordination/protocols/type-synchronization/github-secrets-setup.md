# GitHub Secrets Configuration for Cloud Type Validation

## Overview
Cloud type validation workflows require authentication to Supabase cloud instances. This document describes the required GitHub secrets and how to configure them.

## Required Secrets

### SUPABASE_ACCESS_TOKEN
**Purpose**: Authenticates Supabase CLI to cloud instances for type generation

**How to obtain**:
1. Visit [Supabase Dashboard](https://supabase.com/dashboard)
2. Click on your profile icon (top right)
3. Select "Access Tokens"
4. Click "Generate New Token"
5. Give it a descriptive name (e.g., "GitHub Actions - Wildlife Watcher Mobile")
6. Set appropriate permissions:
   - Read access to project settings
   - Read access to database schema
7. Copy the generated token (you won't be able to see it again)

**How to configure in GitHub**:
1. Go to your repository on GitHub
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `SUPABASE_ACCESS_TOKEN`
5. Value: Paste the token you copied from Supabase
6. Click "Add secret"

**Security Notes**:
- Never commit this token to your repository
- Never log this token in CI/CD output
- Rotate the token periodically (every 90 days recommended)
- Use separate tokens for different environments if possible

## Workflow Usage

### cloud-type-validation.yml
This workflow uses `SUPABASE_ACCESS_TOKEN` to:
- Authenticate to Supabase CLI
- Link to cloud project (nuhwmubvygxyddkycmpa for dev)
- Generate types from cloud instance
- Compare with committed types

**Triggers**:
- Pull requests to main branch (automatic)
- Manual dispatch with environment selection

**Environment Support**:
- `cloud-dev`: nuhwmubvygxyddkycmpa
- `cloud-prod`: Not yet configured (will fail gracefully)

### build.yml
This workflow uses `SUPABASE_ACCESS_TOKEN` to:
- Validate types before building app
- Ensure deployed app has current types
- Block builds with stale types

**Triggers**:
- Push of version tags (e.g., v1.0.0)
- Manual workflow dispatch

**Behavior**:
- If `SUPABASE_ACCESS_TOKEN` is not set: Logs warning, skips validation
- If types are out of sync: Fails build with clear error message

## Testing the Configuration

### Test cloud-type-validation.yml
```bash
# 1. Push a PR to main branch
git checkout -b test/type-validation
git push origin test/type-validation

# 2. Open PR on GitHub - workflow will run automatically

# 3. Or trigger manually:
# Go to Actions → Cloud Type Validation → Run workflow
# Select environment: cloud-dev
```

### Test build.yml integration
```bash
# 1. Create a version tag (local testing)
git tag v0.0.1-test
git push origin v0.0.1-test

# 2. Check Actions tab on GitHub
# The validate-types job should run first
# If it passes, build jobs will proceed
# If it fails, build jobs will be skipped
```

## Validation Workflow

### Success Case
```
✅ Authenticate to Supabase
✅ Link to cloud-dev project
✅ Generate types from cloud instance
✅ Compare with committed types
✅ Types match → workflow passes
✅ Build proceeds (if part of build.yml)
```

### Failure Case: Out of Sync Types
```
✅ Authenticate to Supabase
✅ Link to cloud-dev project
✅ Generate types from cloud instance
❌ Compare with committed types
❌ Types don't match → workflow fails
❌ Build is blocked (if part of build.yml)
```

**Error Message**:
```
❌ ERROR: Types are out of sync with cloud-dev

To fix this issue, run:
  npm run types:cloud-dev

Then commit the updated types:
  git add src/types/supabase.ts
  git commit -m 'chore(types): sync with cloud-dev schema'
```

**Artifact Available**: `type-diff-cloud-dev` (shows exact differences)

### Failure Case: Missing Secret
```
❌ Authenticate to Supabase
⚠️  Warning: SUPABASE_ACCESS_TOKEN not configured
```

**In cloud-type-validation.yml**: Workflow fails immediately
**In build.yml**: Logs warning, skips validation (graceful degradation)

## Troubleshooting

### "SUPABASE_ACCESS_TOKEN not configured"
**Problem**: Secret not set in GitHub repository
**Solution**: Follow "How to configure in GitHub" above

### "Failed to generate types from cloud-dev"
**Possible causes**:
1. Token expired or revoked
2. Token doesn't have access to project
3. Project ref is incorrect
4. Network connectivity issues

**Solutions**:
1. Generate new token and update secret
2. Ensure token has read access to project
3. Verify project ref: nuhwmubvygxyddkycmpa
4. Check Supabase status page

### "Types are out of sync"
**Problem**: Committed types don't match cloud schema
**Solution**:
```bash
# Regenerate types from cloud
npm run types:cloud-dev

# Commit updated types
git add src/types/supabase.ts
git commit -m 'chore(types): sync with cloud-dev schema'
git push
```

### Workflow timeout
**Problem**: Workflow times out after 10 minutes
**Possible causes**:
1. Supabase CLI installation slow
2. Type generation taking too long
3. Network issues

**Solutions**:
1. Check GitHub Actions status
2. Check Supabase status page
3. Re-run workflow
4. If persistent, increase timeout in workflow file

## Maintenance

### Token Rotation
**Recommended frequency**: Every 90 days

**Process**:
1. Generate new token in Supabase Dashboard
2. Update `SUPABASE_ACCESS_TOKEN` in GitHub secrets
3. Test workflow with manual trigger
4. Revoke old token in Supabase Dashboard

### Adding Production Environment
When cloud-prod is ready:

1. **Update workflow file** (`.github/workflows/cloud-type-validation.yml`):
```yaml
- name: Link to cloud-prod project
  run: |
    echo "Linking to cloud-prod Supabase instance..."
    npx supabase link --project-ref YOUR_PROD_PROJECT_REF
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

- name: Generate fresh types from cloud-prod
  run: |
    echo "Generating types from cloud-prod Supabase instance..."
    npx supabase gen types typescript --linked --project-ref YOUR_PROD_PROJECT_REF > /tmp/cloud-prod-types.ts
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

2. **Update scripts**:
   - `scripts/check-types-cloud.sh` (add prod ref)
   - `package.json` (update types:cloud-prod script)

3. **Test thoroughly** with manual dispatch before enabling automatic triggers

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ GitHub Actions Workflow                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Checkout code                                           │
│  2. Setup Node.js + npm ci                                  │
│  3. Setup Supabase CLI                                      │
│     │                                                       │
│     ├─→ 4. Authenticate (SUPABASE_ACCESS_TOKEN)            │
│     │      │                                                │
│     │      └─→ npx supabase login --token -                │
│     │                                                       │
│     ├─→ 5. Link to cloud project                           │
│     │      │                                                │
│     │      └─→ npx supabase link --project-ref XXX         │
│     │                                                       │
│     └─→ 6. Generate types from cloud                       │
│            │                                                │
│            └─→ npx supabase gen types typescript           │
│                │                                            │
│                └─→ /tmp/cloud-dev-types.ts                 │
│                                                             │
│  7. Compare types                                           │
│     │                                                       │
│     ├─→ diff src/types/supabase.ts /tmp/cloud-dev-types.ts │
│     │                                                       │
│     ├─→ Match? ✅ Continue workflow                        │
│     │                                                       │
│     └─→ No match? ❌ Fail workflow + upload diff artifact  │
│                                                             │
│  8. TypeScript type check                                   │
│  9. Run tests                                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Integration with Build Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ Tag pushed to repository (e.g., v1.0.0)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Job: validate-types (NEW)                                   │
├─────────────────────────────────────────────────────────────┤
│ - Validate types against cloud-dev                          │
│ - Run TypeScript type check                                 │
│                                                             │
│ Success? ✅                                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Job: extract-metadata                                       │
│ (needs: validate-types)                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────────┐     ┌─────────────────────┐
│ Job: ios-build      │     │ Job: android-build  │
│ (needs: extract-)   │     │ (needs: extract-)   │
│        metadata)    │     │        metadata)    │
└─────────────────────┘     └─────────────────────┘
```

**Key Points**:
- Type validation runs FIRST (blocks entire pipeline)
- Metadata extraction only runs if types valid
- Platform builds only run if metadata extraction succeeds
- One failing step blocks downstream jobs

## Cost Optimization

### Caching Strategy
The workflow uses `cache: 'npm'` to cache npm dependencies, reducing:
- Installation time: ~2 minutes → ~30 seconds
- Network bandwidth usage
- GitHub Actions minutes consumption

### Parallel Execution
- Type validation runs independently of builds
- Once types validated, iOS and Android builds run in parallel

### Timeout Settings
- All jobs have 10-minute timeout
- Prevents runaway workflows consuming excessive minutes
- Typical runtime: 3-5 minutes

## Security Best Practices

1. **Least Privilege**: Token has only necessary permissions
2. **No Logging**: Token never appears in logs (--token - reads from stdin)
3. **Encrypted Storage**: GitHub encrypts secrets at rest
4. **Audit Trail**: GitHub logs all secret access attempts
5. **Rotation**: Regular token rotation every 90 days
6. **Separation**: Separate tokens for dev/prod if possible

## References

- [Supabase CLI Authentication](https://supabase.com/docs/guides/cli/managing-access-tokens)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [GitHub Actions Best Practices](https://docs.github.com/en/actions/learn-github-actions/security-hardening-for-github-actions)
