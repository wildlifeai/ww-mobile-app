---
allowed-tools: Task, Read, mcp__serena__*, Bash(grep:*)
description: Validate offline-first coverage and identify services needing migration
argument-hint: [optional: service name or "all"]
---

# Offline-First Coverage Check

Check: $ARGUMENTS (default: all services)

Execute using ww-aadf-mobile-offline-validator agent:

**Offline-First Template**: `src/services/ProjectService.ts` (900 lines)

**Mandatory Pattern**:
```typescript
// STEP 1: Read from SQLite FIRST (instant UI)
const localData = await this.db.getData();

// STEP 2: Trigger background sync (non-blocking)
this.backgroundSync().catch(console.warn);

// STEP 3: Return local data immediately
return localData;
```

**Coverage Analysis**:

### Current Status (as of 2025-11-09)
- **Total Services**: 10
- **Offline-First**: 1 (ProjectService only)
- **Direct Supabase**: 9
- **Coverage**: 10%
- **Target**: 100%

### Services Requiring Migration
**P0 (Critical) - Must migrate for MVP**:
1. auth.ts - Authentication service (12h effort)
2. deploymentsApi - RTK Query deployments (10h effort)

**P1 (High) - Should migrate for production**:
3. ProjectMemberService - Members service (8h effort)
4. devicesApi - RTK Query devices (8h effort)
5. usersApi - RTK Query users (8h effort)

**P2 (Medium) - Nice to have**:
6. DfuService - Firmware updates (6h effort)
7. mediaApi - RTK Query media (6h effort)
8. observationsApi - RTK Query observations (6h effort)
9. sensorRecordsApi - RTK Query sensor records (4h effort)

**Migration Effort**:
- P0 Total: 22 hours (2 services)
- P1 Total: 24 hours (3 services)
- P2 Total: 22 hours (4 services)
- Grand Total: 68 hours (~2 weeks for 1 developer)

**Usage Examples**:
```bash
# Check all services
/ww-aadf-mobile-check-offline all

# Check specific service
/ww-aadf-mobile-check-offline ProjectMemberService

# Check only P0 services
/ww-aadf-mobile-check-offline --priority P0

# Generate migration roadmap
/ww-aadf-mobile-check-offline --roadmap
```

**Expected Output**:
- Offline-First Architecture Validation Report
- Service-by-service breakdown (status, pattern, priority, effort)
- Pattern compliance analysis
- Gap analysis (services needing migration)
- Coverage roadmap (Phase 1: P0, Phase 2: P1, Phase 3: P2)
- Recommendations (immediate actions, architectural improvements)
- Migration template (ProjectMemberService example)
- Validation checklist (SQLite schema, queue integration, background sync, conflict resolution)
