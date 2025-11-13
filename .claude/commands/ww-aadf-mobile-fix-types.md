---
allowed-tools: Task, Bash(npm run types:*), Bash(git:*), Read
description: Quick type regeneration and validation for schema changes
argument-hint: [environment: local|cloud-dev|cloud-prod]
---

# Mobile Type Synchronization

Fix types for: $ARGUMENTS (default: local)

Execute using ww-aadf-mobile-type-guardian agent:

**5-Layer Defense Strategy**:

1. **Layer 1: Backend Pre-Commit** ✅
   - Backend validates types before commit
   - Backend creates coordination message

2. **Layer 2: Coordination Messages** ✅
   - Backend sends schema change notification
   - Mobile receives message in inbox

3. **Layer 3: Mobile Inbox Check** 🔄
   - Check coordination inbox: `~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/`
   - Read schema change messages
   - Identify target environment

4. **Layer 4: Mobile Pre-Commit** ✅
   - Regenerate types: `npm run types:$ENVIRONMENT`
   - Validate alignment: `npm run types:check-$ENVIRONMENT`
   - Block commits if types out of sync

5. **Layer 5: GitHub Actions** ✅
   - Validate types on PR creation
   - Block PR merge if types drift

**Type Regeneration Workflow**:
```bash
# Step 1: Check inbox for schema changes
ls ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/

# Step 2: Regenerate types for target environment
npm run types:$ENVIRONMENT

# Step 3: Validate alignment
npm run types:check-$ENVIRONMENT

# Step 4: Full validation (types + TypeScript + tests)
npm run validate:$ENVIRONMENT

# Step 5: Archive coordination message
mv msg.md ~/dev/wildlifeai/cross-project-coordination/archive/$(date +%Y-%m)/
```

**Usage Examples**:
```bash
# Fix types for local environment (most common)
/ww-aadf-mobile-fix-types local

# Fix types for cloud-dev environment
/ww-aadf-mobile-fix-types cloud-dev

# Fix types for cloud-prod environment (future)
/ww-aadf-mobile-fix-types cloud-prod

# Check coordination inbox + fix types
/ww-aadf-mobile-fix-types
```

**Expected Output**:
- Type Synchronization Report
- Schema change detection
- Type regeneration command
- Validation results (type file metrics, TypeScript compilation)
- 5-layer defense validation status
- Action items (commit types, archive message, log action)
- Troubleshooting guide (if issues detected)
