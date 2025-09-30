# Wildlife Watcher - Development Scripts

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

**What it checks** (8 validation steps):

1. **Required Configuration Files**
   - app.json, package.json, metro.config.js, index.js
   - android/build.gradle, eas.json

2. **JavaScript Syntax**
   - Validates index.js entry point

3. **Core Dependencies**
   - react, react-native, expo
   - @supabase/supabase-js, @reduxjs/toolkit

4. **Critical Import Paths**
   - Validates the fixed projects API import path
   - Confirms api.types.ts target file exists

5. **TypeScript Configuration**
   - tsconfig.json presence

6. **Android Build Configuration**
   - android directory structure
   - android/app/build.gradle
   - applicationId configuration

7. **Environment Configuration**
   - .env file presence (warning if missing)
   - Supabase URL and anon key (warnings only)

8. **Git Repository Status**
   - Repository initialized
   - Working tree status (warnings for uncommitted changes)

**Exit Codes**:
- `0`: All critical checks passed (ready to build)
- `1`: One or more critical checks failed (fix before building)

**Time**: ~2-3 seconds (vs 5-15 minutes for full build)

**Benefits**:
- Catch 80% of common build failures in seconds
- No need to wait for Metro bundling
- Clear actionable feedback on what's wrong

**Recommended Workflow**:
```bash
# 1. Make changes
# 2. Run quick validation
npm run prebuild:check

# 3. If checks pass, proceed with build
eas build --platform android --local --profile preview

# 4. If checks fail, fix issues and repeat step 2
```

## Other Scripts

### Dependency Management
- `validate:deps` - Validates package versions against migration rules
- `deps` - Interactive dependency management CLI
- `deps:add` - Add new dependencies with validation
- `deps:scan` - Scan for dependency issues

### Testing
- `test` - Run all tests
- `test:unit` - Unit tests only
- `test:integration` - Integration tests
- `test:maestro` - UI automation tests

### Type Checking
- `type-check` - TypeScript compilation check (no emit)

## Contributing

When adding new scripts:
1. Add to this README with clear documentation
2. Follow bash best practices (set -e, clear error messages)
3. Use descriptive script names
4. Add to package.json scripts section