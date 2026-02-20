# Package Version Dependency Validation System

## Table of Contents
- [What Is This System?](#what-is-this-system)
- [Why Does It Exist?](#why-does-it-exist)
- [System Architecture](#system-architecture)
- [Quick Start Guide](#quick-start-guide)
- [Configuration Reference](#configuration-reference)
- [CLI Tools](#cli-tools)
- [Integration Guide](#integration-guide)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## What Is This System?

The **Package Version Dependency Validation System** is a custom-built solution that validates npm package versions in your project against a configurable set of rules. It ensures that:

1. **Critical dependencies** maintain exact versions required for compatibility
2. **Optional dependencies** meet minimum version requirements
3. **Package overrides** are correctly configured
4. **Blocked packages** (incompatible with Expo managed workflow) are not installed
5. **Known version deviations** are documented and tracked

Think of it as a **quality gate** that prevents dependency-related build failures before they happen.

---

## Why Does It Exist?

### The Core Problem: Expo SDK Compatibility Chain

Wildlife Watcher's dependency chain is tightly coupled — the **BLE and DFU libraries** drive the React Native version, which drives the Expo SDK version, which constrains everything else:

```
BLE/DFU Libraries (Hardware Interface)
    ↓
react-native-ble-manager@11.3.2
react-native-bluetooth-state-manager@1.3.5
@getquip/expo-nordic-dfu
    ↓
React Native version must be compatible
    ↓
Expo SDK must match React Native version
    ↓
All Expo packages must match SDK version
```

**Current state:** Expo SDK 54 / React Native 0.81.5

### The Validation System's Purpose

This system exists to **protect the dependency chain** by:

1. **Version Locking**: Prevents accidental upgrades that break compatibility
   - `react-native: 0.81.5` — must match Expo SDK 54
   - `react-native-ble-manager: 11.3.2` — hardware interface
   - `react-native-bluetooth-state-manager: 1.3.5` — BLE state

2. **Expo SDK Enforcement**: Keeps all Expo packages aligned
   - `expo: ~54.0.0` — SDK version
   - `expo-dev-client: ~6.0.20` — must match SDK

3. **Package Migration Guards**: Prevents reverting to bare RN packages
   - **Blocks** `react-native-vector-icons` → **Must use** `@expo/vector-icons`

4. **Dependency Cascade Protection**: Ensures transitive dependencies don't break constraints
   - Package overrides enforce versions throughout the dependency tree

### What This System Prevents

**Without this validation system, developers might:**

❌ Run `npm update` and accidentally break the SDK compatibility chain
❌ Install Expo packages from a different SDK version → **Build fails**
❌ Re-add bare React Native packages during troubleshooting → **Incompatible with Expo managed workflow**
❌ Update transitive dependencies → **Cascade breaks compatibility**

**With this validation system:**

✅ Catches breaking changes **before builds fail** (seconds vs 15 minutes)
✅ Documents **why** each version is locked
✅ Provides **clear error messages** with actionable fixes
✅ Tracks **intentional deviations** with explanations
✅ Prevents **package migration reversals**

---

## System Architecture

### Components Overview

```
scripts/
├── validate-deps.js              # Core validation engine (~380 lines)
├── manage-dependency-rules.js    # Interactive CLI for rule management (~474 lines)
├── dependency-rules.json         # Validation configuration (~150 lines)
├── deps-cli.js                   # CLI wrapper script
└── post-install-helper.js        # Optional: Run validation after npm install
```

### Data Flow

```
┌─────────────────┐
│  package.json   │ ← Current dependencies
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  dependency-rules.json          │ ← Validation rules
│  - Required versions            │
│  - Severity levels              │
│  - Known deviations             │
│  - Blocked packages             │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  validate-deps.js               │ ← Validation engine
│  1. Load rules                  │
│  2. Check installed versions    │
│  3. Validate overrides          │
│  4. Check for duplicates        │
│  5. Run expo-doctor             │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Validation Report              │
│  ❌ Errors (must fix)           │
│  ⚠️  Warnings (review)          │
│  ℹ️  Info (awareness)           │
└─────────────────────────────────┘
```

---

## Quick Start Guide

### Running Validation

```bash
# Option 1: Via npm script (recommended)
npm run validate:deps

# Option 2: Direct execution
node scripts/validate-deps.js

# Option 3: As part of build check
npm run prebuild:check
```

### Managing Rules

```bash
# Interactive CLI
npm run deps

# Or direct execution
node scripts/manage-dependency-rules.js
```

#### CLI Menu Options:

1. **📦 Add new package rules** - Add validation rules for packages
2. **✏️  Modify existing rule** - Update version requirements, severity
3. **🗑️  Remove rule** - Delete a validation rule
4. **🔍 Scan for unmanaged packages** - Find packages without rules
5. **👀 View current rules** - Display all configured rules
6. **🚪 Exit** - Close the CLI

### Example: Adding a New Package Rule

```bash
$ npm run deps

What would you like to do?
> 1. 📦 Add new package rules

Found 3 packages without rules:
1. react-native-gesture-handler@2.16.0
2. react-native-safe-area-context@4.10.1
3. @react-navigation/stack@6.3.29

Select packages to add rules for:
> 1,2

📦 Adding rule for react-native-gesture-handler@2.16.0

Suggested version formats:
1. 2.16.0 - Exact version (strict)
2. ~2.16.0 - Patch updates allowed
3. ^2.16.0 - Minor updates allowed
4. >=2.16.0 <3.0.0 - Range within major version

Choose version format (1-4) or enter custom: 2

Severity levels:
1. error - Blocks installation (strict compliance)
2. warning - Shows warning but allows installation
3. info - Informational only

Choose severity (1-3): 2

Reason for this rule (optional): Expo SDK 54 compatibility

Is this package optional? (y/N): N

✅ Rule added for react-native-gesture-handler
💾 Configuration saved
```

---

## Configuration Reference

### `dependency-rules.json` Structure

```json
{
  "description": "Dependency validation rules for Wildlife Watcher Expo SDK 54",
  "lastUpdated": "2025-12-24T00:30:00Z",

  "rules": {
    "package-name": {
      "required": "version-requirement",
      "severity": "error|warning|info",
      "reason": "Why this version is required",
      "optional": true|false,
      "installed": "actual-version-if-deviated",
      "allowedRange": "semver-range"
    }
  },

  "blockedPackages": {
    "package-name": {
      "reason": "Why this package is blocked",
      "alternative": "recommended-replacement",
      "severity": "error|warning"
    }
  },

  "overrideRequirements": {
    "package-name": "exact-version"
  },

  "sdkCompatibility": {
    "54": {
      "package-name": "compatible-version"
    }
  },

  "validationSettings": {
    "blockOnError": false,
    "blockOnWarning": false,
    "runExpoDoctor": true,
    "checkOverrides": true,
    "checkDuplicates": true,
    "migrationMode": true
  }
}
```

### Rule Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `required` | string | Yes | Version requirement (exact or semver range) |
| `severity` | enum | No | `error`, `warning`, or `info` (default: `error`) |
| `reason` | string | No | Human-readable explanation for this rule |
| `optional` | boolean | No | If true, package can be missing without error |
| `installed` | string | No | Actual installed version if it deviates from `required` |
| `allowedRange` | string | No | Broader semver range that's acceptable |

### Severity Levels

#### `error` - Blocks Installation (Critical Chain)
- **Use when**: Package version is critical for Expo SDK / React Native compatibility
- **Examples**:
  - `react-native: 0.81.5` - **Must match Expo SDK 54**
  - `typescript: ~5.3.3` - Required for React Native compatibility
- **Behavior**: Validation fails (exit code 1) if version doesn't match
- **Why**: Breaking these versions means **builds fail or hardware stops working**

#### `warning` - Shows Warning (Supporting Packages)
- **Use when**: Package should meet requirement but isn't part of the critical chain
- **Examples**:
  - `react-native-ble-manager: 11.3.2` - Hardware interface
  - `react-native-reanimated: ~4.1.1` - UI animations
- **Behavior**: Warning shown but validation passes
- **Why**: Allows flexibility while still tracking requirements

#### `info` - Informational Only (Optional Features)
- **Use when**: Tracking optional packages not required for core functionality
- **Examples**:
  - `expo-localization: ~17.0.8` - Language support (nice to have)
  - Development tools and optional features
- **Behavior**: Information shown, no validation failure
- **Why**: Awareness without enforcement

### Known Deviations Pattern

When you intentionally use a different version than recommended:

```json
{
  "expo": {
    "required": "~54.0.0",
    "installed": "54.0.32",
    "severity": "warning",
    "reason": "54.0.32 is a compatible patch version within the ~54.0.0 range",
    "allowedRange": ">=54.0.0 <54.1.0"
  }
}
```

This pattern:
- ✅ Documents the deviation
- ✅ Explains why it's acceptable
- ✅ Prevents false-positive errors
- ✅ Shows as "known deviation" in validation output

---

## CLI Tools

### 1. Validation Engine (`validate-deps.js`)

**Purpose**: Core validation logic that checks package versions.

**How It Works**:

1. **Load Configuration**: Reads `dependency-rules.json`
2. **Load Package.json**: Reads current installed versions
3. **Rule Validation**: For each rule:
   - Check if package is installed
   - Compare version against requirement
   - Check for known deviations
   - Categorize issues by severity
4. **Override Validation**: Ensure `package.json` overrides match requirements
5. **Duplicate Detection**: Find packages in both dependencies and devDependencies
6. **Expo Doctor**: Run `npx expo-doctor --fix-dependencies` and parse output
7. **Generate Report**: Organize findings by severity

**Exit Codes**:
- `0` - Validation passed (or only warnings/info)
- `1` - Validation failed (errors found)

**Example Output**:

```
🔍 Wildlife Watcher Dependency Validation v2

📋 Using rules from: Dependency validation rules for Wildlife Watcher Expo SDK 54

📦 Validating package versions...

✅ react-native@0.81.5 satisfies 0.81.5
✅ typescript@5.3.3 satisfies ~5.3.3
ℹ️  expo@54.0.32 - known deviation from ~54.0.0
   Reason: 54.0.32 is a compatible patch version within the ~54.0.0 range

🔒 Validating package overrides...

🔄 Checking for version conflicts...

🏥 Running expo-doctor checks...
✅ expo-doctor passed all checks

📊 Validation Report
===================

✅ All dependency checks passed!
```

### 2. Rule Management CLI (`manage-dependency-rules.js`)

**Purpose**: Interactive tool for managing validation rules.

**Features**:

#### Add Missing Packages
- Scans for packages without rules
- Provides version format suggestions
- Guides through severity selection
- Prompts for optional reasoning

#### Modify Existing Rules
- Change version requirements
- Update severity levels
- Add/edit/remove reasons
- Toggle optional flag
- Add known deviation tracking
- Remove properties

#### Remove Rules
- Select rule to remove
- Confirmation prompt
- Safe deletion

#### Scan for Unmanaged
- Lists all packages without rules
- Offers to add rules immediately
- Helps maintain complete coverage

#### View Current Rules
- Displays all configured rules
- Shows installed vs required versions
- Highlights known deviations

**Version Format Suggestions**:

When adding a rule, the CLI suggests:

1. **Exact version**: `2.16.0` - Strict compliance
2. **Patch updates**: `~2.16.0` - Allows 2.16.x
3. **Minor updates**: `^2.16.0` - Allows 2.x.x
4. **Range**: `>=2.16.0 <3.0.0` - Within major version

### 3. CLI Wrapper (`deps-cli.js`)

Simple wrapper to run the management CLI with better error handling.

---

## Integration Guide

### NPM Scripts

These scripts are already configured in `package.json`:

```json
{
  "scripts": {
    "validate:deps": "node scripts/validate-deps.js",
    "deps": "node scripts/manage-dependency-rules.js",
    "deps:add": "node scripts/manage-dependency-rules.js add",
    "deps:scan": "node scripts/manage-dependency-rules.js scan",
    "prebuild:check": "bash scripts/pre-build-check.sh",
    "preinstall": "node scripts/validate-deps.js || true",
    "postinstall": "node scripts/post-install-helper.js"
  }
}
```

### CI/CD Integration

#### GitHub Actions Example:

```yaml
name: Dependency Validation

on: [push, pull_request]

jobs:
  validate-deps:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Validate package versions
        run: npm run validate:deps

      - name: Run pre-build checks
        run: npm run prebuild:check
```

#### Pre-commit Hook (Husky):

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run validate:deps"
    }
  }
}
```

### EAS Build Integration

Add to `eas.json`:

```json
{
  "build": {
    "development": {
      "prebuildCommand": "npm run prebuild:check && npm run validate:deps"
    },
    "preview": {
      "prebuildCommand": "npm run prebuild:check && npm run validate:deps"
    },
    "production": {
      "prebuildCommand": "npm run prebuild:check && npm run validate:deps"
    }
  }
}
```

---

## Troubleshooting

### Common Issues

#### 1. Validation Fails on Package Installation

**Symptom**:
```
❌ react-native@0.80.0 doesn't satisfy 0.81.5
   Fix: Run 'npm install react-native@0.81.5'
```

**Solution**:
```bash
# Follow the suggested fix
npm install react-native@0.81.5

# Or if it's an intentional deviation, document it
npm run deps
# Choose "Modify existing rule" → "Add installed field"
```

#### 2. Expo Doctor Reports Issues

**Symptom**:
```
⚠️  expo-doctor reported unexpected issues
```

**Solution**:
```bash
# Run expo-doctor directly to see details
npx expo-doctor

# Check if warnings are expected (known deviations)
# If so, add to dependency-rules.json with installed field
```

#### 3. Package Not Found in Rules

**Symptom**:
```
Found 5 packages without rules
```

**Solution**:
```bash
# Use the interactive CLI to add rules
npm run deps
# Choose "Add new package rules"

# Or run scan mode directly
npm run deps:scan
```

#### 4. Version Match Fails Despite Correct Version

**Symptom**:
```
❌ package@~2.16.0 doesn't satisfy ~2.16.0
```

**Cause**: Version prefix mismatch (tilde/caret in package.json vs rules)

**Solution**:
```json
// In dependency-rules.json, use allowedRange
{
  "package-name": {
    "required": "2.16.0",
    "allowedRange": "~2.16.0"
  }
}
```

#### 5. Duplicate Dependency Warning

**Symptom**:
```
❌ package has conflicting versions:
   dependencies: ^2.16.0
   devDependencies: ^2.15.0
```

**Solution**:
```bash
# Remove from devDependencies if it's a runtime dependency
npm uninstall --save-dev package-name

# Or align versions
npm install --save-dev package-name@^2.16.0
```

---

## Best Practices

### 1. Document All Rules

**Always provide a `reason` field that explains why a version is required**:

```json
{
  "react-native": {
    "required": "0.81.5",
    "severity": "error",
    "reason": "Expo SDK 54 compatibility requirement - must match exactly"
  },
  "react-native-ble-manager": {
    "required": "11.3.2",
    "severity": "warning",
    "reason": "Native module for BLE device communication"
  }
}
```

**Why**: Future developers need to understand:
- **What** the constraint is
- **Why** it exists (BLE/DFU hardware dependency)
- **What breaks** if changed (hardware stops working)

### 2. Use Severity Based on the Dependency Chain

**Error** — Part of the critical SDK compatibility chain:
- `react-native: 0.81.5` — **Must match Expo SDK 54**
- `typescript: ~5.3.3` — Required for React Native compatibility
- Core Expo SDK packages that must match the SDK version

**Warning** — BLE/DFU libraries and supporting packages:
- `react-native-ble-manager: 11.3.2` — hardware interface
- `react-native-bluetooth-state-manager: 1.3.5` — BLE state management
- `@getquip/expo-nordic-dfu` — firmware update capability
- Supporting libraries for navigation, UI, state management

**Info** — Optional features:
- Development tools
- Optional UI enhancements
- Nice-to-have packages

### 3. Track Known Deviations

**Always use the `installed` field for intentional differences**:

```json
{
  "expo": {
    "required": "~54.0.0",
    "installed": "54.0.32",
    "severity": "warning",
    "reason": "Compatible patch version within the ~54.0.0 range",
    "allowedRange": ">=54.0.0 <54.1.0"
  }
}
```

**Benefits**:
- Prevents false-positive errors
- Documents decision-making
- Shows as "known deviation" in reports

### 4. Keep Rules Up to Date

**Review regularly**:
- After Expo SDK upgrades
- When adding new features
- During dependency updates
- Before major releases

**Update process**:
```bash
# 1. Check for unmanaged packages
npm run deps:scan

# 2. Review and update rules
npm run deps

# 3. Test validation
npm run validate:deps

# 4. Update lastUpdated timestamp
```

### 5. Version Migration Strategy

**When migrating to new versions**:

1. **Create migration rules** before updating:
   ```json
   {
     "expo": {
       "required": "~52.0.0",
       "severity": "warning",
       "reason": "SDK 52 migration in progress"
     }
   }
   ```

2. **Set `migrationMode: true`** in validationSettings:
   ```json
   {
     "validationSettings": {
       "migrationMode": true,
       "blockOnError": false,
       "blockOnWarning": false
     }
   }
   ```

3. **Gradually tighten constraints** as migration progresses

4. **Switch to strict mode** after migration complete:
   ```json
   {
     "validationSettings": {
       "migrationMode": false,
       "blockOnError": true
     }
   }
   ```

### 6. Blocked Packages Pattern

**Use to prevent incompatible packages**:

```json
{
  "blockedPackages": {
    "react-native-fs": {
      "reason": "Migrated to expo-file-system for Expo managed workflow",
      "alternative": "expo-file-system",
      "severity": "error"
    }
  }
}
```

**Prevents**:
- Accidental installation of incompatible packages
- Reverting to old packages during troubleshooting
- Team members unaware of migration decisions

### 7. Override Management

**Use overrides to enforce dependency versions**:

```json
{
  "overrideRequirements": {
    "react-native": "0.74.5",
    "react-native-reanimated": "~3.10.1"
  }
}
```

**Add corresponding overrides to package.json**:

```json
{
  "overrides": {
    "react-native": "0.74.5",
    "react-native-reanimated": "~3.10.1"
  }
}
```

**Why**: Ensures transitive dependencies also use correct versions.

---

## Advanced Usage

### Custom Validation Logic

Extend `validate-deps.js` for project-specific checks:

```javascript
// Add to ConfigurableDependencyValidator class

validateCustomRules() {
  console.log('🔧 Running custom validation...\n');

  // Example: Check for peer dependency conflicts
  const peerDeps = this.config.peerDependencies || {};

  Object.entries(peerDeps).forEach(([pkg, required]) => {
    const installed = this.getInstalledVersion(pkg);

    if (!this.versionSatisfies(installed, required)) {
      this.addMessage('error',
        `Peer dependency ${pkg}@${installed} incompatible with ${required}`,
        `Install compatible version: npm install ${pkg}@${required}`
      );
    }
  });
}

// Call in run() method
run() {
  // ... existing validation
  this.validateCustomRules();
  // ... report generation
}
```

### Automated Rule Generation

You can generate rules from existing dependencies using a simple script:

```javascript
// Example: generate rules from current package.json
const fs = require('fs');
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const rules = {};
Object.entries(packageJson.dependencies || {}).forEach(([pkg, version]) => {
  rules[pkg] = { required: version, severity: 'warning', reason: 'Auto-generated' };
});
console.log(JSON.stringify(rules, null, 2));
```

### Integration with Renovate/Dependabot

Configure automated dependency updates to respect validation rules:

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["react-native", "expo"],
      "enabled": false,
      "description": "Manual updates only - see dependency-rules.json"
    },
    {
      "matchPackageNames": ["react-native-reanimated"],
      "allowedVersions": "~4.1.0",
      "description": "Constrained by Expo SDK 54 - see dependency-rules.json"
    }
  ]
}
```

---

## Migration History

### Why This System Was Created

**Timeline**:

1. **Initial Problem** (Early Expo Migration):
   - Manual dependency management was error-prone
   - Build failures discovered late (after 10-15 minute builds)
   - Unclear which versions were compatible

2. **First Attempt** (Manual Tracking):
   - Created spreadsheet of compatible versions
   - Manual validation before each install
   - Still prone to human error

3. **Second Attempt** (Shell Scripts):
   - Basic bash script to check versions
   - Hard-coded requirements
   - Difficult to maintain and update

4. **Current Solution** (Configurable System):
   - JSON-based configuration (easy to update)
   - Automated validation (fast feedback)
   - Interactive CLI (easy rule management)
   - CI/CD integration (automated enforcement)

### Lessons Learned

1. **Configuration over Code**: JSON rules easier to maintain than hard-coded checks
2. **Clear Error Messages**: Actionable fixes reduce debugging time
3. **Document Deviations**: Tracking "why" prevents confusion later
4. **Severity Levels**: Not all mismatches are critical
5. **Interactive Tools**: CLI reduces friction for rule management

---

## Future Enhancements

Potential improvements to consider:

1. **Auto-fix Mode**: Automatically update package.json to match rules
2. **Rule Templates**: Pre-configured rule sets for common scenarios
3. **Version Compatibility Matrix**: Visual dependency graph
4. **Historical Tracking**: Log validation results over time
5. **Team Collaboration**: Shared rule repositories
6. **IDE Integration**: VS Code extension for inline validation

---

## Summary

The **Package Version Dependency Validation System** protects the Expo SDK compatibility chain:

```
BLE/DFU Libraries (react-native-ble-manager@11.3.2)
    ↓
React Native 0.81.5
    ↓
Expo SDK 54
    ↓
All other dependencies
```

### Key Commands
- `npm run validate:deps` — **Run validation (use before any npm install)**
- `npm run deps` — Manage rules interactively
- `npm run prebuild:check` — Pre-build validation

### Key Files
- `scripts/validate-deps.js` — Validation engine (~380 lines)
- `scripts/manage-dependency-rules.js` — Rule management CLI (~474 lines)
- `scripts/dependency-rules.json` — **The critical configuration**

---

**Last Updated**: 2026-02-19
**System Version**: 2.0
**Maintained By**: Wildlife Watcher Development Team
