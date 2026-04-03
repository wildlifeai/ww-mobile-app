# Wildlife Watcher - Development Scripts

## Quick Reference

| Script | Purpose | Platform |
|--------|---------|----------|
| `sync-types-cloud.js` | Generate Supabase types from active `.env.development` | Cross-platform |
| `sync-db-schema.js` | Sync WatermelonDB schema from backend repo | Cross-platform |
| `generate-watermelon-schema.js` | Generate WatermelonDB schema from Supabase types | Cross-platform |
| `validate-build-env.js` | Validate Gradle + critical dependencies before EAS build | Cross-platform |
| `validate-deps.js` | Enforce dependency rules | Cross-platform |
| `validate-watermelon-schema.js` | Static WatermelonDB schema validation | Cross-platform |
| `validate-watermelon-schema-live.js` | Live schema comparison against Supabase | Cross-platform |
| `deps-cli.js` | Interactive dependency management CLI | Cross-platform |
| `post-install-helper.js` | Detect new packages after npm install | Cross-platform |
| `check-types-cloud.sh` / `.ps1` | Compare committed types against cloud DB | Bash / PowerShell |
| `check-types-local.sh` / `.ps1` | Compare committed types against local DB | Bash / PowerShell |
| `switch-supabase-instance.sh` | Switch Supabase CLI project link | Bash |
| `pre-build-check.sh` | Full pre-build validation (9 checks) | Bash |
| `pre-commit-hook.sh` | Git pre-commit hook | Bash |
| `test-integration-local.sh` | Run local integration tests | Bash |
| `install-maestro-wsl2.sh` | Install Maestro testing in WSL2 | Bash (WSL2) |

## Environment Configuration

All scripts that interact with Supabase read the project ID **dynamically** from `.env.development`. You never need to hardcode project refs — just update your `.env.development` file:

```bash
# To use staging (current setup):
EXPO_PUBLIC_SUPABASE_URL=https://nuhwmubvygxyddkycmpa.supabase.co

# To switch back to dev, comment out staging and uncomment dev:
# EXPO_PUBLIC_SUPABASE_URL=https://qegeovogqxiouqbrxmnh.supabase.co
```

Then `npm run android`, `npm run types:cloud-dev`, etc. will all target the correct instance automatically.

## Pre-Build Validation

### `pre-build-check.sh`

**Purpose**: Fast static validation before running EAS builds to catch common issues early.

**Usage**:
```bash
# Direct execution
./scripts/pre-build-check.sh

# Via npm script (recommended)
npm run prebuild:check
```

**What it checks** (9 validation steps):

1. **Required Configuration Files** — app.json, package.json, metro.config.js, index.js, android/build.gradle, eas.json
2. **JavaScript Syntax** — Validates index.js entry point
3. **Core Dependencies** — react, react-native, expo, @supabase/supabase-js, @reduxjs/toolkit
4. **Critical Import Paths** — api.types import validation
5. **TypeScript Configuration** — tsconfig.json presence
6. **Android Build Configuration** — android directory, build.gradle, applicationId
7. **Environment Configuration** — .env file, Supabase URL/key (warnings only)
8. **Git Repository Status** — repo initialized, uncommitted changes (warnings)
9. **Schema Validation** — WatermelonDB schema vs cloud-dev

**Time**: ~2-3 seconds (vs 5-15 minutes for full build)

## Type Generation

### `sync-types-cloud.js`

**Purpose**: Generate TypeScript types from the active Supabase cloud instance.

- Reads `EXPO_PUBLIC_SUPABASE_URL` from `.env.development`
- Extracts the project ID automatically
- Gracefully handles paused/sleeping databases (warns but doesn't fail the build)

Called automatically by `npm run android`, `npm run ios`, and `npm run start`.

## Dependency Management

- `npm run validate:deps` — Validates package versions against migration rules
- `npm run deps` — Interactive dependency management CLI
- `npm run deps:add` — Add new dependencies with validation
- `npm run deps:scan` — Scan for dependency issues

## Schema Management

- `npm run schema:generate` — Generate WatermelonDB schema from Supabase types
- `npm run schema:validate` — Static schema validation
- `npm run schema:validate:live` — Live comparison against Supabase database
- `npm run db:sync-schema` — Sync SQL schema files from backend repo

## Testing

- `npm test` — Run all tests
- `npm run test:unit` — Unit tests only
- `npm run test:integration` — Integration tests
- `npm run test:maestro` — UI automation tests (requires Maestro)

## Contributing

When adding new scripts:
1. Add to this README with clear documentation
2. Prefer Node.js (`.js`) scripts for cross-platform compatibility
3. Use descriptive script names
4. Read environment config from `.env.development`, never hardcode project refs
5. Add to `package.json` scripts section