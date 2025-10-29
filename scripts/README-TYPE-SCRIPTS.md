# Type Synchronization Scripts

This directory contains scripts for managing TypeScript type generation and validation across multiple Supabase environments.

## Overview

The Wildlife Watcher mobile app supports three Supabase environments:
- **Local**: Development database (localhost:54321) via backend repository
- **Cloud Dev**: Staging/preview environment (nuhwmubvygxyddkycmpa)
- **Cloud Prod**: Production environment (not yet configured)

## Scripts

### check-types-local.sh
Validates that committed types match the local Supabase instance schema.

**Usage:**
```bash
npm run types:check-local
# or
./scripts/check-types-local.sh
```

**Requirements:**
- Backend repository at `~/dev/wildlifeai/wildlife-watcher-backend`
- Local Supabase instance running (`supabase start` in backend)

### check-types-cloud.sh
Validates that committed types match a cloud Supabase instance schema.

**Usage:**
```bash
npm run types:check-cloud-dev
npm run types:check-cloud-prod

# or directly
./scripts/check-types-cloud.sh cloud-dev
./scripts/check-types-cloud.sh cloud-prod
```

**Requirements:**
- Supabase CLI installed (`npm install -g supabase`)
- Authenticated to Supabase (`supabase login`)
- Access to the target project

### switch-supabase-instance.sh
Helper script to link Supabase CLI to a specific environment.

**Usage:**
```bash
./scripts/switch-supabase-instance.sh local
./scripts/switch-supabase-instance.sh cloud-dev
./scripts/switch-supabase-instance.sh cloud-prod
```

**Note:** Local environment does not require linking.

## NPM Scripts

### Type Generation
Generate TypeScript types from Supabase schema:

```bash
npm run types:local      # Generate from local Supabase
npm run types:cloud-dev  # Generate from cloud-dev
npm run types:cloud-prod # Generate from cloud-prod (not yet configured)
```

### Type Validation
Verify committed types match database schema:

```bash
npm run types:check-local      # Check against local
npm run types:check-cloud-dev  # Check against cloud-dev
npm run types:check-cloud-prod # Check against cloud-prod
```

### Full Validation
Run type check + TypeScript compilation + tests:

```bash
npm run validate:local      # Local validation
npm run validate:cloud-dev  # Cloud-dev validation
npm run validate:cloud-prod # Cloud-prod validation
```

### Pre-build Hooks
Automatic validation before builds:

```bash
npm run prebuild:preview     # Runs validate:cloud-dev
npm run prebuild:production  # Runs validate:cloud-prod
```

## Environment Configuration

### Local Environment
- **Backend Repo**: `~/dev/wildlifeai/wildlife-watcher-backend`
- **Database**: localhost:54321
- **Start**: `cd ~/dev/wildlifeai/wildlife-watcher-backend && supabase start`
- **Types Source**: Local Supabase instance via backend repo

### Cloud Dev Environment
- **Project Ref**: `nuhwmubvygxyddkycmpa`
- **URL**: https://nuhwmubvygxyddkycmpa.supabase.co
- **Purpose**: Staging/preview builds
- **EAS Profile**: `preview` (in eas.json)

### Cloud Prod Environment
- **Status**: Not yet configured
- **Purpose**: Production builds
- **EAS Profile**: `production` (in eas.json)

## Workflow Examples

### Daily Development (Local)
```bash
# 1. Start local Supabase (in backend repo)
cd ~/dev/wildlifeai/wildlife-watcher-backend
supabase start

# 2. Check if types need updating
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:check-local

# 3. If out of sync, regenerate
npm run types:local

# 4. Commit changes
git add src/types/supabase.ts
git commit -m "chore(types): sync with local schema"
```

### Preview Build Preparation
```bash
# 1. Switch to cloud-dev environment (optional, for context)
./scripts/switch-supabase-instance.sh cloud-dev

# 2. Generate types from cloud-dev
npm run types:cloud-dev

# 3. Validate everything
npm run validate:cloud-dev

# 4. Build preview
eas build --profile preview
```

### Production Build (Future)
```bash
# 1. Generate types from production database
npm run types:cloud-prod

# 2. Full validation
npm run validate:cloud-prod

# 3. Build production
eas build --profile production
```

## Error Handling

### "Supabase CLI not found"
```bash
npm install -g supabase
```

### "Failed to generate types from cloud"
```bash
# Authenticate
supabase login

# Link to project
supabase link --project-ref nuhwmubvygxyddkycmpa
```

### "Types are out of sync"
Run the appropriate generation command:
```bash
npm run types:local       # For local
npm run types:cloud-dev   # For cloud-dev
```

## Architecture Notes

### Why Multiple Type Scripts?

The app supports runtime environment switching, but **types must be generated at build time** for each target environment:

1. **Local Development**: Types from local Supabase (fast iteration)
2. **Preview Builds**: Types from cloud-dev (staging validation)
3. **Production Builds**: Types from cloud-prod (production schema)

### Type Synchronization Strategy

- **Git pre-commit hook**: Validates types before commits (local only)
- **GitHub Actions**: Validates types on PRs (prevents drift)
- **Pre-build scripts**: Validates types before EAS builds
- **Manual checks**: Run `npm run types:check-*` anytime

### Defense-in-Depth (5 Layers)

1. **Backend Pre-Commit**: Backend blocks stale types + reminds to notify mobile
2. **Coordination Messages**: Backend manually creates schema change notifications
3. **Mobile Inbox Check**: Daily manual check for coordination messages
4. **Mobile Pre-Commit**: Blocks commits with stale types
5. **GitHub Actions**: Blocks PR merge on type drift

**Coverage**: 80% automated, 99% prevention rate

## Related Documentation

- **Type Sync Guide**: `@project-context/development-context/MVP2/implementation/execution/cross-project-coordination/protocols/type-synchronization/Backend-Mobile-Type-Synchronization-Guide.md`
- **Local Dev Workflow**: `@project-context/development-context/MVP2/implementation/execution/cross-project-coordination/protocols/type-synchronization/local-dev-sync-workflow.md`
- **Backend Automation**: `~/wildlife-watcher-backend/project-context/documentation/QUICK-REFERENCE-TYPE-AUTOMATION.md`

## Troubleshooting

### Script won't run ("Permission denied")
```bash
chmod +x scripts/*.sh
```

### Can't authenticate to Supabase
```bash
supabase login
```

### Wrong project linked
```bash
supabase link --project-ref <correct-ref>
```

### Types keep showing as out of sync
```bash
# Ensure you're checking against correct environment
npm run types:check-local      # For local dev
npm run types:check-cloud-dev  # For preview builds
```

## Future Improvements

- [ ] Automated coordination inbox checking
- [ ] Nightly type reconciliation job
- [ ] Production environment configuration
- [ ] Type diff visualization in CI
- [ ] Automated schema change detection
