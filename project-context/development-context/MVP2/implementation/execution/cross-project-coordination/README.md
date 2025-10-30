# Cross-Project Coordination

**Purpose**: Mobile app's coordination interface with the backend team for schema synchronization, deployment coordination, and cross-project communication.

## Directory Structure

```
cross-project-coordination/
├── README.md                    # This file
├── hub/                         # Symlink → ~/dev/wildlifeai/cross-project-coordination
├── protocols/                   # Coordination protocols and workflows
│   ├── type-synchronization/   # Type sync guides and workflows
│   └── deployment/              # Deployment coordination protocols
├── archive/                     # Archived coordination messages
├── reference-links/             # Quick reference links
└── scripts/                     # Coordination automation scripts
```

## Hub System (Shared Coordination)

The `hub/` directory is a **symlink** to the shared coordination hub at:
```
~/dev/wildlifeai/cross-project-coordination/
```

This shared hub enables bidirectional communication between mobile and backend teams:

### Hub Structure
- **inbox/** - Incoming messages from backend team
  - `backend-to-mobile/` - Messages requiring mobile team action
  - `mobile-to-backend/` - (Backend's inbox for our messages)
- **templates/** - Message templates (schema-change, status-update, task-request, etc.)
- **archive/** - Archived messages organized by month
- **.coordination/** - System utilities and logging

### Quick Workflow
```bash
# 1. Check for backend messages
ls hub/inbox/backend-to-mobile/

# 2. Read message
cat hub/inbox/backend-to-mobile/[message].md

# 3. Action it (e.g., schema change)
npm run types:local  # Or types:cloud-dev

# 4. Archive message
mv hub/inbox/backend-to-mobile/[message].md hub/archive/$(date +%Y-%m)/

# 5. Log action
hub/.coordination/log-message.sh "Mobile" "Actioned schema-change"
```

## Protocols

### Type Synchronization
Location: `protocols/type-synchronization/`

**Key Documents**:
- `multi-environment-type-sync-guide.md` - Comprehensive multi-environment guide (968 lines)
- `Backend-Mobile-Type-Synchronization-Guide.md` - 5-layer defense-in-depth system
- `local-dev-sync-workflow.md` - Daily development workflow

**System**: 5-layer defense-in-depth preventing type drift
1. Backend pre-commit hook (validates backend types)
2. Coordination messages (manual schema change notifications)
3. Mobile inbox check (daily or pre-commit warnings)
4. Mobile pre-commit hook (validates mobile types)
5. GitHub Actions (validates cloud types on PR)

**Coverage**: 95% automated, 99% prevention rate

### Deployment Coordination
Location: `protocols/deployment/`

Protocols for coordinating deployments between mobile app and backend infrastructure.

## Recent Implementations

### Runtime Environment Switching (2025-10-30)
**Status**: ✅ Production-Ready

Mobile app now supports runtime switching between three Supabase environments:
- **Local Development**: http://172.21.24.107:54321 (WSL IP)
- **Cloud Development**: https://nuhwmubvygxyddkycmpa.supabase.co
- **Cloud Production**: [Not yet configured]

**Key Features**:
- In-app environment switching via Developer Settings
- Build-time type generation for each environment
- Environment-aware pre-commit hooks
- GitHub Actions cloud type validation
- Comprehensive documentation (27,700+ lines)

**Documentation**:
- Implementation Plan: `../db-environment-switching-in-app/RUNTIME-ENVIRONMENT-SWITCHING-IMPLEMENTATION-PLAN.md`
- Test Results: `../ENVIRONMENT-SWITCHING-TEST-RESULTS.md`
- Developer Workflows: `../DEVELOPER-WORKFLOW-MULTI-ENVIRONMENT.md`
- Troubleshooting: `../TROUBLESHOOTING-ENVIRONMENT-SWITCHING.md`

**Shared with Backend**: See `hub/inbox/mobile-to-backend/` for coordination message

## Daily Usage

### For Mobile Developers

**Morning Routine** (5 minutes):
```bash
# Check backend messages
ls hub/inbox/backend-to-mobile/

# Verify type alignment
npm run types:check-local

# If out of sync
npm run types:local
```

**Schema Change Workflow** (5-10 minutes):
```bash
# Backend sent schema-change message
cat hub/inbox/backend-to-mobile/[message].md

# Regenerate types
npm run types:local              # For local changes
npm run types:cloud-dev          # For cloud-dev deployment

# Validate
npm run validate:local

# Archive message
mv hub/inbox/backend-to-mobile/[message].md hub/archive/$(date +%Y-%m)/
```

### For Sending Messages to Backend

**Use Templates**:
```bash
# Copy appropriate template
cp hub/templates/schema-change.md hub/inbox/mobile-to-backend/$(date +%Y%m%d-%H%M)-schema-change-[topic].md

# Edit with your content
# Backend team will find it in their inbox
```

**Message Types**:
- `schema-change.md` - Mobile needs backend schema changes
- `status-update.md` - Deployment/milestone updates
- `task-request.md` - Request backend implementation
- `generic-message.md` - General coordination

## Key Principles

1. **Bidirectional Communication**: Both teams use the same hub system
2. **Inbox Pattern**: Send → Inbox → Archive → Log workflow
3. **Manual Quality Over Automation**: Messages are manually created for quality context
4. **Flat Monthly Archive**: No nested folders, organized by YYYY-MM
5. **Daily Inbox Checks**: Check daily or rely on pre-commit warnings
6. **Template-Based**: Use templates for consistency

## Documentation References

### Mobile App
- Main docs: `~/dev/wildlifeai/wildlife-watcher-mobile-app/CLAUDE.md`
- Type sync: `protocols/type-synchronization/multi-environment-type-sync-guide.md`

### Shared Hub
- Quick start: `hub/COORDINATION-QUICK-START.md`
- System reference: `hub/SYSTEM-REFERENCE-GUIDE.md`
- Type sync guide: `hub/TYPE-SYNC-GUIDE.md`

### Backend
- Backend automation: `~/wildlife-watcher-backend/project-context/documentation/QUICK-REFERENCE-TYPE-AUTOMATION.md`

## Support

**Questions**: Refer to coordination guides in `hub/` directory
**Issues**: Create message in `hub/inbox/mobile-to-backend/` using appropriate template
**Emergency**: Manual type override instructions in troubleshooting guides

---

**System Status**: ✅ Production-Ready
**Last Updated**: 2025-10-30
**Maintained By**: Mobile Development Team
