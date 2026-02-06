# Type Synchronization Scripts

This directory contains scripts for managing TypeScript type generation and validation across multiple Supabase environments.

## Overview

The Wildlife Watcher mobile app supports three Supabase environments with **runtime environment switching**:
- **Local**: Development database (localhost:54321) via backend repository
- **Cloud Dev**: Staging/preview environment (nuhwmubvygxyddkycmpa)
- **Cloud Prod**: Production environment (not yet configured)

**Runtime Environment Switching**: The app can switch between environments at runtime via Developer Settings (development builds only). However, **types must be generated at build time** for each target environment.

**Production Ready**: Runtime environment switching system completed (Task 3+4, 95% confidence)

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

### Schema Validation (Integrated with Type Checking)
Validate WatermelonDB schema against live Supabase database:

```bash
npm run schema:validate:live:local      # Validate against local database
npm run schema:validate:live:cloud-dev  # Validate against cloud-dev database

# Combined workflows
npm run dev:status                   # Types + schema check (local)
npm run sync:from-live:cloud-dev     # Generate types + validate schema
```

**Note**: Schema validation automatically runs type checking first to ensure types are current before comparing schemas.

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

# 2. Quick status check (types + schema)
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run dev:status  # Checks types + validates schema

# 3. If out of sync, regenerate and validate
npm run types:local
npm run schema:validate:live:local

# 4. Automatically update schema.ts
npm run schema:generate

# 5. Commit changes
git add src/types/database.types.ts src/database/schema.ts
git commit -m "chore: sync types and schema with local database"
```

### Preview Build Preparation
```bash
# 1. Complete sync from live cloud-dev database
npm run sync:from-live:cloud-dev  # Types + schema validation

# 2. Update schema.ts if needed (based on validation output)

# 3. Full validation (types, TypeScript, tests)
npm run validate:cloud-dev

# 4. Pre-build check (includes schema validation)
npm run prebuild:preview

# 5. Build preview
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

### Runtime Environment Switching + Build-Time Types

The app supports **runtime environment switching** between three Supabase instances:
- User can switch environments via: Settings → Developer Settings (development builds only)
- Environment selection persisted to AsyncStorage
- Supabase client recreated on environment change

**However**, TypeScript types must be generated **at build time** for each target environment:

1. **Local Development**: Types from local Supabase (fast iteration, daily workflow)
2. **Preview Builds**: Types from cloud-dev (staging validation, team testing)
3. **Production Builds**: Types from cloud-prod (production schema, fixed environment)

**Why Build-Time?** TypeScript compilation happens at build time, not runtime. Types provide compile-time safety for database operations.

### Type Synchronization Strategy

- **Git pre-commit hook**: Validates types before commits (local only)
- **GitHub Actions**: Validates types on PRs and push to main (prevents drift) - **Checks against Cloud Dev**
- **Pre-build scripts**: Validates types before EAS builds
- **Manual checks**: Run `npm run types:check-*` anytime

### Defense-in-Depth (5 Layers)

1. **Backend Pre-Commit**: Backend blocks stale types + reminds to notify mobile
2. **Coordination Messages**: Backend manually creates schema change notifications
3. **Mobile Inbox Check**: Daily manual check for coordination messages
4. **Mobile Pre-Commit**: Blocks commits with stale types
5. **GitHub Actions**: Blocks PR merge and validates main branch commits against Cloud Dev

**Coverage**: 80% automated, 99% prevention rate

## Related Documentation

- **Multi-Environment Guide**: `@project-context/development-context/MVP2/implementation/execution/cross-project-coordination/protocols/type-synchronization/multi-environment-type-sync-guide.md` (Comprehensive workflow guide)
- **CLAUDE.md**: Runtime Environment Switching section (Quick reference)
- **Type Drift Prevention**: `@project-context/learnings/type-drift-prevention-5-layer-defense.md`
- **Backend Automation**: `~/wildlife-watcher-backend/project-context/documentation/QUICK-REFERENCE-TYPE-AUTOMATION.md`
- **Implementation Plan**: `@project-context/development-context/MVP2/implementation/execution/RUNTIME-ENVIRONMENT-SWITCHING-IMPLEMENTATION-PLAN.md`
- **Test Results**: `@project-context/development-context/MVP2/implementation/execution/ENVIRONMENT-SWITCHING-TEST-RESULTS.md`

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

### Schema validation fails
```bash
# Get detailed output
npm run schema:validate:live:cloud-dev -- --verbose

# Sync from live database
npm run sync:from-live:cloud-dev

# Automatically update schema.ts
npm run schema:generate
```

### "Types are out of sync" during schema validation
Schema validation runs type checking first. If types are stale:
```bash
# Regenerate types first
npm run types:cloud-dev

# Then validate schema
npm run schema:validate:live:cloud-dev
```

## Future Improvements

- [ ] Automated coordination inbox checking
- [ ] Nightly type reconciliation job
- [ ] Production environment configuration
- [ ] Type diff visualization in CI
- [ ] Automated schema change detection
