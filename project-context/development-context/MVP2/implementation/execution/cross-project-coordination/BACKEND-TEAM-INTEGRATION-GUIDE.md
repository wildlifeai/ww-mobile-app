# 🔌 Backend Team Integration Guide

This guide explains how the backend team should integrate with the cross-repository coordination system.

---

## 🎯 Overview for Backend Team

As the backend team, you are:
- **API Provider**: Mobile and web consume your APIs
- **Schema Owner**: Database changes require coordination
- **Type Generator**: TypeScript types flow from backend → mobile → web
- **Service Implementer**: Edge functions, storage policies, authentication

**Key Principle**: Your changes often trigger work in other repositories. This system ensures seamless coordination.

---

## 📦 Setup for Backend Repository

### Step 1: Run Mobile's Setup Script
```bash
# This creates the shared coordination hub
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
./project-context/development-context/MVP2/implementation/execution/cross-project-coordination/scripts/setup-coordination-hub.sh
```

### Step 2: Create Backend Coordination Folder
```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend
mkdir -p project-context/cross-project-coordination

# Create symbolic link to shared hub
ln -s ~/dev/wildlifeai/cross-project-coordination \
      project-context/cross-project-coordination/hub
```

### Step 3: Configure Backend Team Settings
```bash
cd ~/dev/wildlifeai/cross-project-coordination

# Update config for backend team
cat > .coordination/backend-config.yaml << 'EOF'
team: backend

notifications:
  terminal: true
  desktop: true
  sound: false

automation:
  auto_acknowledge: true
  auto_type_generation: true
  status_sync_interval: 3600

# Backend-specific settings
database:
  auto_type_export: true
  notify_on_migration: true
  check_mobile_sync: true
EOF
```

### Step 4: Install Git Hooks
```bash
# Copy hooks to backend repository
cp ~/dev/wildlifeai/cross-project-coordination/.coordination/hooks/pre-commit \
   ~/dev/wildlifeai/wildlife-watcher-backend/.git/hooks/

cp ~/dev/wildlifeai/cross-project-coordination/.coordination/hooks/post-merge \
   ~/dev/wildlifeai/wildlife-watcher-backend/.git/hooks/

chmod +x ~/dev/wildlifeai/wildlife-watcher-backend/.git/hooks/*
```

### Step 5: Start Coordination Watcher
```bash
cd ~/dev/wildlifeai/cross-project-coordination
./scripts/coordination-watch.sh start

# Add to your shell startup (~/.bashrc or ~/.zshrc)
echo 'cd ~/dev/wildlifeai/cross-project-coordination && ./scripts/coordination-watch.sh start' >> ~/.bashrc
```

---

## 🔄 Backend-Specific Workflows

### Workflow 1: Database Schema Change

**CRITICAL**: Every schema change requires mobile team coordination.

#### Step 1: Plan the Migration
```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend

# Create migration
npx supabase migration new add_deployment_verification_status

# Write migration SQL
nano supabase/migrations/YYYYMMDDHHMMSS_add_deployment_verification_status.sql
```

#### Step 2: Create Coordination Message
```bash
cd ~/dev/wildlifeai/cross-project-coordination

# Copy schema change template
cp templates/schema-change.md \
   inbox/backend-to-mobile/$(date +%Y%m%d-%H%M)-backend-mobile-SCHEMA_CHANGE-deployment-verification.md

# Edit with full details:
nano inbox/backend-to-mobile/$(date +%Y%m%d-%H%M)-backend-mobile-SCHEMA_CHANGE-deployment-verification.md
```

**What to include** (see template for full structure):
- Exact SQL DDL statements
- Tables affected
- RLS policy changes
- Breaking change indicator
- Timeline for deployment
- Required mobile actions
- TypeScript type changes expected

#### Step 3: Test Migration Locally
```bash
# Apply migration to local Supabase
npx supabase migration up

# Generate types
npm run db:types:update

# Verify types generated correctly
cat project-context/database.types.ts | grep "verification_status"

# Run all tests
npm test
```

#### Step 4: Wait for Mobile Acknowledgment
File watcher will notify when mobile team acknowledges:
- Review timeline feasibility
- Address questions/concerns
- Confirm deployment schedule

#### Step 5: Deploy to Staging
```bash
# Apply to staging
npx supabase db push --db-url $STAGING_DATABASE_URL

# Verify in staging
npx supabase db diff --db-url $STAGING_DATABASE_URL

# Notify mobile team
cp templates/status-update.md \
   inbox/backend-to-mobile/$(date +%Y%m%d-%H%M)-backend-mobile-STATUS_UPDATE-staging-deployed.md
```

#### Step 6: Mobile Integration Complete
Wait for mobile team to:
- Regenerate their types (`npm run types:local`)
- Update code to use new schema
- Test integration
- Acknowledge completion

#### Step 7: Deploy to Production
```bash
# Deploy migration
npx supabase db push --db-url $PRODUCTION_DATABASE_URL

# Notify completion
cp templates/status-update.md \
   inbox/backend-to-all/$(date +%Y%m%d-%H%M)-backend-all-STATUS_UPDATE-schema-deployed-production.md
```

### Workflow 2: Responding to Mobile API Requests

Mobile will send `TASK_REQUEST` messages for new APIs.

#### Step 1: Receive and Acknowledge
You'll get desktop notification:
```
⚠️ Coordination Message [HIGH]
From: mobile
Type: TASK_REQUEST
Task Request: Deployment Photos Upload API
```

**Acknowledge within 8 hours**:
```bash
cd ~/dev/wildlifeai/cross-project-coordination

# Move to active tasks
mv inbox/mobile-to-backend/MSG-*.md active/tasks/in-progress/

# Create acknowledgment
cp templates/status-update.md \
   inbox/backend-to-mobile/$(date +%Y%m%d-%H%M)-backend-mobile-STATUS_UPDATE-acknowledged.md

# Include:
# - Confirmed receipt
# - Estimated timeline
# - Any clarifying questions
# - Assigned developer
```

#### Step 2: Implement the API
```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend

# Create necessary components:
# 1. Database tables/functions (if needed)
# 2. Storage bucket policies
# 3. Edge function (if needed)
# 4. RLS policies

# Example: Storage bucket for deployment photos
npx supabase storage create-bucket deployment-photos

# Set up policies
npx supabase storage update-policy deployment-photos \
  --policy-name "Allow authenticated uploads" \
  --for INSERT \
  --to authenticated
```

#### Step 3: Write Tests
```bash
# Integration tests with real Supabase
npm run test:integration -- --grep "deployment photos"

# Edge function tests
npm run test:edge-functions -- deployment-photos-handler
```

#### Step 4: Update Status Regularly
```bash
# Daily status updates for active tasks
cp templates/status-update.md \
   inbox/backend-to-mobile/$(date +%Y%m%d-%H%M)-backend-mobile-STATUS_UPDATE-day-2.md

# Include:
# - Progress percentage
# - Completed items
# - Current work
# - Blockers (if any)
# - Updated timeline
```

#### Step 5: Integration Ready Notification
```bash
# When complete and tested
cp templates/status-update.md \
   inbox/backend-to-mobile/$(date +%Y%m%d-%H%M)-backend-mobile-INTEGRATION_READY-deployment-photos.md

# Include:
# - API endpoint URLs
# - TypeScript types location
# - Integration examples
# - Test credentials
# - Documentation links
```

### Workflow 3: Edge Function Deployment

#### Step 1: Notify Before Deployment
```bash
cp templates/deployment-notification.md \
   inbox/backend-to-all/$(date +%Y%m%d-%H%M)-backend-all-DEPLOYMENT_COORDINATION-edge-functions.md

# Include:
# - Functions being deployed
# - Endpoint changes
# - Deployment window
# - Expected downtime (if any)
# - Rollback plan
```

#### Step 2: Deploy Edge Functions
```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend

# Deploy to staging first
npx supabase functions deploy --project-ref $STAGING_REF

# Test staging
npm run test:edge-functions:staging

# Deploy to production
npx supabase functions deploy --project-ref $PRODUCTION_REF
```

#### Step 3: Post-Deployment Validation
```bash
# Run smoke tests
npm run test:smoke

# Notify completion
cp templates/status-update.md \
   inbox/backend-to-all/$(date +%Y%m%d-%H%M)-backend-all-STATUS_UPDATE-deployment-complete.md
```

---

## 🔐 Type Generation Integration

### Automatic Type Sync on Schema Changes

**Your git pre-commit hook should**:
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check if migrations changed
if git diff --cached --name-only | grep "supabase/migrations"; then
    echo "📊 Migrations detected - regenerating types..."

    # Generate types
    npm run db:types:update

    # Check if types changed
    if git diff --name-only | grep "database.types.ts"; then
        # Stage the updated types
        git add project-context/database.types.ts

        # Create coordination message
        MSG_FILE="inbox/backend-to-mobile/$(date +%Y%m%d-%H%M)-backend-mobile-SCHEMA_CHANGE-auto-detected.md"
        cd ~/dev/wildlifeai/cross-project-coordination

        # Auto-generate from template
        ./scripts/create-schema-change-notification.sh
    fi
fi
```

### Manual Type Generation
```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend

# Generate types from local Supabase
npm run db:types:update

# This updates: project-context/database.types.ts

# Mobile will pull your changes and run:
# npm run types:local (generates from same Supabase)
```

---

## 📊 Backend Status Updates

### Daily Status Template
```bash
# Create daily status
cd ~/dev/wildlifeai/cross-project-coordination

cat > status/backend-status.md << 'EOF'
# Backend Team Status

**Date**: $(date +%Y-%m-%d)
**Sprint**: MVP2 Week 2

## Completed Today
- ✅ User roles API - Deployed to staging
- ✅ Device registry table - Migration tested
- ✅ Storage bucket policies - Configured

## In Progress
- 🔄 LoRaWAN webhook Edge Function (70% complete)
- 🔄 Admin Portal UI (50% complete)

## Upcoming (Next 2 Days)
- 📋 Deployment validation API
- 📋 Real-time device status updates
- 📋 Performance optimization for project queries

## Blockers
None currently

## Coordination Items
- Waiting on mobile team: Task 16 device config integration
- Notified mobile team: Schema change for deployments table

## Metrics
- Tests passing: 156/156 (100%)
- Test coverage: 94%
- API response time: avg 142ms
- Database query time: avg 38ms
EOF
```

---

## 🎯 Backend-Specific Best Practices

### Schema Changes
1. ✅ **Always notify mobile BEFORE production deployment**
2. ✅ **Include exact SQL in coordination message**
3. ✅ **Specify timeline for mobile integration**
4. ✅ **Test migrations with existing data**
5. ✅ **Provide rollback plan**

### API Development
1. ✅ **Include TypeScript types in responses**
2. ✅ **Document error codes and messages**
3. ✅ **Provide integration examples**
4. ✅ **Test with real authentication**
5. ✅ **Validate RLS policies thoroughly**

### Type Generation
1. ✅ **Regenerate types after every migration**
2. ✅ **Commit types to project-context/**
3. ✅ **Notify mobile of type changes**
4. ✅ **Verify types are valid TypeScript**
5. ✅ **Include comments for complex types**

### Testing
1. ✅ **Use real Supabase, not mocks**
2. ✅ **Test with actual JWT tokens**
3. ✅ **Validate RLS with different roles**
4. ✅ **Performance test with realistic data**
5. ✅ **Integration tests before coordination messages**

---

## 📝 Message Templates for Backend

### Common Backend Messages

#### Schema Change
```bash
cp templates/schema-change.md inbox/backend-to-mobile/DATE-backend-mobile-SCHEMA_CHANGE-{topic}.md
```

#### API Ready
```bash
cp templates/integration-ready.md inbox/backend-to-mobile/DATE-backend-mobile-INTEGRATION_READY-{api-name}.md
```

#### Status Update
```bash
cp templates/status-update.md inbox/backend-to-mobile/DATE-backend-mobile-STATUS_UPDATE-{task-name}.md
```

#### Deployment Coordination
```bash
cp templates/deployment-notification.md inbox/backend-to-all/DATE-backend-all-DEPLOYMENT_COORDINATION-{deployment-name}.md
```

---

## 🔧 Backend Git Hooks

### Pre-Commit Hook
Location: `wildlife-watcher-backend/.git/hooks/pre-commit`

```bash
#!/bin/bash

# Check for schema changes
if git diff --cached --name-only | grep -q "supabase/migrations"; then
    echo "🗄️  Migration detected - checking coordination..."

    # Regenerate types
    npm run db:types:update

    # Check if coordination message exists
    LATEST_MSG=$(ls -t ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/ | grep SCHEMA_CHANGE | head -1)

    if [ -z "$LATEST_MSG" ]; then
        echo "⚠️  WARNING: Schema change detected but no coordination message found"
        echo "Please create a SCHEMA_CHANGE coordination message before committing"
        echo ""
        echo "Run: cp ~/dev/wildlifeai/cross-project-coordination/templates/schema-change.md \\"
        echo "        ~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/\$(date +%Y%m%d-%H%M)-backend-mobile-SCHEMA_CHANGE-{topic}.md"
        exit 1
    fi

    # Stage updated types
    git add project-context/database.types.ts
fi

# Check for unacknowledged urgent messages
URGENT_COUNT=$(find ~/dev/wildlifeai/cross-project-coordination/inbox/mobile-to-backend -name "*URGENT*" | wc -l)
if [ $URGENT_COUNT -gt 0 ]; then
    echo "⚠️  WARNING: You have $URGENT_COUNT unacknowledged URGENT messages"
fi

exit 0
```

### Post-Merge Hook
Location: `wildlife-watcher-backend/.git/hooks/post-merge`

```bash
#!/bin/bash

# Check if migrations were added
if git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD | grep -q "supabase/migrations"; then
    echo "🗄️  New migrations detected in merge"
    echo "Remember to:"
    echo "  1. Review migration SQL"
    echo "  2. Apply to local: npx supabase migration up"
    echo "  3. Regenerate types: npm run db:types:update"
    echo "  4. Check coordination messages in: ~/dev/wildlifeai/cross-project-coordination/inbox/"
fi

exit 0
```

---

## 📈 Monitoring Backend Coordination

### Check Coordination Health
```bash
# View messages requiring your attention
ls -la ~/dev/wildlifeai/cross-project-coordination/inbox/mobile-to-backend/

# Check active tasks
ls -la ~/dev/wildlifeai/cross-project-coordination/active/tasks/in-progress/

# View your team's action items
ls -la ~/dev/wildlifeai/cross-project-coordination/action-items/backend/

# Recent activity log
tail -f ~/dev/wildlifeai/cross-project-coordination/.coordination/logs/watcher.log
```

### Response Time Targets
- **URGENT**: Acknowledge within 2 hours
- **HIGH**: Acknowledge within 8 hours
- **NORMAL**: Acknowledge within 24 hours
- **Status Updates**: Send every 1-2 days for active tasks

---

## 🆘 Backend-Specific Troubleshooting

### Type Generation Fails
```bash
# Check Supabase is running
npx supabase status

# Check database connection
npx supabase db diff

# Regenerate types
npm run db:types:update

# If still failing, check migration syntax
npx supabase migration list
```

### Mobile Reports Type Mismatch
```bash
# Ensure both repos using same Supabase instance
echo $DATABASE_URL  # Should be localhost:54321

# Verify your types are committed
git status project-context/database.types.ts

# Check mobile is pulling latest
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
git log project-context/learnings/*.md  # Check if they pulled backend changes
```

### Schema Change Coordination Failed
1. Check message was created in correct inbox folder
2. Verify YAML frontmatter is valid
3. Ensure file watcher is running
4. Check mobile team acknowledged (look for response message)

---

## ✅ Backend Team Checklist

### Before Every Schema Change
- [ ] Create migration file
- [ ] Test migration locally
- [ ] Generate updated types
- [ ] Create SCHEMA_CHANGE coordination message
- [ ] Wait for mobile acknowledgment
- [ ] Deploy to staging
- [ ] Wait for mobile integration complete
- [ ] Deploy to production
- [ ] Confirm mobile app working

### Before Every API Release
- [ ] Write integration tests
- [ ] Test with real authentication
- [ ] Validate RLS policies
- [ ] Generate TypeScript types
- [ ] Create INTEGRATION_READY message
- [ ] Provide integration examples
- [ ] Document error codes
- [ ] Deploy to staging first

### Daily Routine
- [ ] Check inbox for new messages
- [ ] Respond to urgent items immediately
- [ ] Update status for active tasks
- [ ] Archive completed items
- [ ] Update backend-status.md
- [ ] Review tomorrow's coordination needs

---

**Questions about backend integration?**
Create a coordination message or check with the mobile team lead.

**Backend-specific scripts and automation:**
See `~/dev/wildlifeai/cross-project-coordination/.coordination/backend-scripts/`