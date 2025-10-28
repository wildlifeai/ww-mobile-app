---
message_id: "MSG-YYYY-MM-DD-NNN"
thread_id: "THR-SCHEMA-{table-name}-NNN"
sender:
  team: "backend"
  agent: "{agent-name}"
  repository: "wildlife-watcher-backend"
recipient:
  team: "all"  # Schema changes affect all teams
  broadcast: true
priority: "HIGH"  # Schema changes are always HIGH priority
type: "SCHEMA_CHANGE"
status: "SENT"
created: "{ISO-8601-timestamp}"
deployment_date: "{when-migration-will-run}"
requires_response: true
response_deadline: "{acknowledge-by-timestamp}"
breaking_change: true|false  # Critical indicator
tags:
  - "database"
  - "schema-change"
  - "types-regeneration-required"
---

# Schema Change: {Clear Description of Change}

## Executive Summary
**Change Type**: {New Table | Column Addition | Column Modification | Column Deletion | Constraint Change | Index Change}
**Tables Affected**: {comma-separated list of tables}
**Breaking Change**: {Yes | No}
**Action Required**: {Type regeneration | API updates | Data migration}

## Change Details

### What's Changing
```sql
-- Migration: {migration-filename}
-- Description: {purpose of this change}

{Include the actual SQL DDL statements}

-- Example:
ALTER TABLE deployments
ADD COLUMN verification_status text
CHECK (verification_status IN ('pending', 'verified', 'rejected'))
DEFAULT 'pending';

CREATE INDEX idx_deployments_verification_status
ON deployments(verification_status);
```

### Tables Affected
| Table | Change Type | Impact |
|-------|-------------|--------|
| {table_name} | {add/modify/delete column} | {description of impact} |
| {table_name} | {constraint change} | {description of impact} |

### RLS Policy Changes
{If RLS policies are affected, detail the changes}

```sql
-- New or modified RLS policies
CREATE POLICY "policy_name" ON table_name
FOR {SELECT|INSERT|UPDATE|DELETE}
USING ({condition});
```

## Impact Assessment

### Mobile App Impact
**Severity**: {Critical | High | Medium | Low}

**Required Actions**:
- [ ] Regenerate TypeScript types (`npm run types:local`)
- [ ] Update API integration code in `{specific-files}`
- [ ] Update Redux slices in `{specific-files}`
- [ ] Update database sync logic in `{specific-files}`
- [ ] Add/update UI fields in `{specific-screens}`
- [ ] Update tests in `{test-files}`

**Breaking Changes**:
{If any, list what will break if mobile doesn't update}

**Estimated Effort**: {hours to integrate this change}

### Backend API Impact
**API Endpoints Affected**:
- `{endpoint-path}` - {how it's affected}
- `{endpoint-path}` - {how it's affected}

**Edge Functions Affected**:
- `{function-name}` - {required updates}

### Web Portal Impact (Future)
{Expected impact on future web portal development}

## Migration Strategy

### Deployment Plan
1. **Pre-migration** (Run before deployment)
   ```sql
   {Any preparation steps}
   ```

2. **Migration** (Main schema changes)
   ```sql
   {Main migration SQL}
   ```

3. **Post-migration** (Data backfill, cleanup)
   ```sql
   {Any post-migration steps}
   ```

### Rollback Plan
```sql
-- Rollback migration if needed
{SQL to reverse the changes}
```

**Rollback Safety**: {Can be rolled back without data loss | Requires backup restore}

### Data Migration Requirements
{If existing data needs to be migrated or transformed}

- **Affected Rows**: {approximate number}
- **Migration Script**: {path to script}
- **Duration Estimate**: {how long migration will take}
- **Downtime Required**: {Yes/No and duration}

## Timeline

### Key Dates
- **Review Deadline**: {when teams must review and provide feedback}
- **Migration to Staging**: {date/time}
- **Mobile Integration Deadline**: {when mobile must have changes integrated}
- **Migration to Production**: {date/time}
- **Cutover Window**: {specific time window for production migration}

### Coordination Requirements
- **Backend**: Complete and test migration by {date}
- **Mobile**: Regenerate types and integrate by {date}
- **Web**: Acknowledge awareness for future integration

## TypeScript Type Changes

### New Types Generated
```typescript
// Expected changes to src/types/supabase.ts

// New type definitions that will be generated
export interface NewTableType {
  // Generated fields
}

// Modified existing types
export interface ExistingTableType {
  // Changed fields
  new_field?: string;  // Added
  modified_field: number;  // Type changed from string
}
```

### Type Import Changes
{List any imports that will need updating in mobile code}

## Testing Requirements

### Backend Testing
- [ ] Migration applies cleanly to empty database
- [ ] Migration applies to database with existing data
- [ ] Rollback migration works correctly
- [ ] All pgTAP tests pass
- [ ] RLS policies enforce correct access
- [ ] Performance benchmarks meet targets

### Mobile Integration Testing
- [ ] Types regenerate without errors
- [ ] TypeScript compilation succeeds
- [ ] API calls work with new schema
- [ ] Offline sync handles new fields
- [ ] UI displays new data correctly
- [ ] All existing tests still pass
- [ ] New tests added for new fields

### Data Integrity Testing
- [ ] No data loss during migration
- [ ] Constraints enforce data quality
- [ ] Indexes improve query performance
- [ ] Backups and restore work correctly

## Security Considerations

### RLS Impact
{How does this change affect row-level security?}

### Permission Changes
{Any changes to who can access or modify data?}

### Sensitive Data
{Does this introduce any new sensitive data fields?}

## Performance Impact

### Query Performance
**Expected Impact**: {Positive | Neutral | Negative}
**Details**: {How queries will be affected}

### Index Strategy
- **New Indexes**: {list indexes being added and why}
- **Modified Indexes**: {list changes to existing indexes}
- **Index Sizes**: {approximate size of new indexes}

### Migration Duration
- **Estimated Time**: {minutes/hours for migration}
- **During Migration**: {what operations will be affected}

## Documentation Updates

### Files to Update
- [ ] `database-schema-analysis.md`
- [ ] API documentation in `{path}`
- [ ] Mobile integration guide in `{path}`
- [ ] Type synchronization docs
- [ ] User-facing documentation (if applicable)

### New Documentation Required
- [ ] {List any new docs that need to be created}

## Coordination Checklist

### Before Migration
- [ ] Schema change reviewed by all teams
- [ ] Mobile team acknowledges and schedules integration
- [ ] Web team (future) acknowledges awareness
- [ ] Migration tested in local environment
- [ ] Migration tested in staging environment
- [ ] Performance impact assessed
- [ ] Rollback plan validated

### During Migration
- [ ] Announce maintenance window (if downtime required)
- [ ] Run migration on production
- [ ] Verify migration success
- [ ] Check application functionality
- [ ] Monitor error rates
- [ ] Verify performance metrics

### After Migration
- [ ] Confirm all teams have integrated changes
- [ ] Update all documentation
- [ ] Archive migration artifacts
- [ ] Document lessons learned
- [ ] Close coordination thread

## Questions & Discussion
{Space for teams to ask questions and discuss concerns}

### Open Questions
1. {Question from mobile team}
   - **Answer**: {Backend team's response}

2. {Question from another team}
   - **Answer**: {Response}

## Attachments
- [{migration-file}.sql](attachments/{migration-file}.sql) - Full migration script
- [{rollback-file}.sql](attachments/{rollback-file}.sql) - Rollback script
- [{test-data}.sql](attachments/{test-data}.sql) - Test data for validation
- [migration-plan.md](attachments/migration-plan.md) - Detailed deployment plan

---

## Acknowledgment Required
**All teams must acknowledge this schema change by**: {response_deadline}

To acknowledge, create a response message including:
1. ✅ Reviewed and understood the changes
2. 📅 Estimated integration completion date
3. ❓ Any questions or concerns
4. 🚫 Any blockers preventing integration

---

## Status Tracking
*Auto-updated by coordination system*

| Team | Acknowledged | Integration Status | Completed |
|------|-------------|-------------------|-----------|
| Mobile | {timestamp} | {in-progress/blocked/complete} | {timestamp} |
| Backend | {timestamp} | {complete} | {timestamp} |
| Web | {timestamp} | {acknowledged} | N/A |

---

## Migration Execution Log
*Updated during actual migration*
- **Started**: {timestamp}
- **Pre-migration**: {timestamp} - {success/failed}
- **Main migration**: {timestamp} - {success/failed}
- **Post-migration**: {timestamp} - {success/failed}
- **Completed**: {timestamp}
- **Issues Encountered**: {none or description}

---
*This is a HIGH priority message requiring acknowledgment within {response_deadline}*
*Mobile team: Run `npm run types:local` after backend migration completes*