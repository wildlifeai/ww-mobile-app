# Templates Directory

Reusable message templates for cross-project coordination.

## Available Templates

### Schema Change Notification (`schema-change-notification.md`)
**Purpose**: Notify mobile team of backend schema changes requiring type synchronization

**When to Use**:
- Backend migration adds/modifies tables or columns
- RLS policies change affecting mobile queries
- Database functions or triggers added/modified

**Key Fields**:
- Change description
- Affected tables/types
- Required mobile actions
- Migration file reference

---

### Status Update (`status-update.md`)
**Purpose**: Share coordination progress and status with other team

**When to Use**:
- Milestone reached in cross-project feature
- Blocker encountered requiring assistance
- Timeline or scope change
- Completion of coordinated work

**Key Fields**:
- Current status
- Progress summary
- Blockers/issues
- Next steps

---

### Task Request (`task-request.md`)
**Purpose**: Request work from other team (mobile → backend or backend → mobile)

**When to Use**:
- Mobile team needs backend API endpoint
- Backend team needs mobile testing/validation
- Cross-repo feature requires parallel work
- Schema change needed for mobile feature

**Key Fields**:
- Task description
- Priority level
- Technical requirements
- Success criteria

---

## Using Templates

1. **Copy Template**: Copy template file to appropriate directory
2. **Fill Sections**: Complete all required fields
3. **Add Context**: Include relevant links, code snippets, or diagrams
4. **Place in Folder**: Move to appropriate coordination folder
5. **Notify Team**: Alert other team via agreed communication channel

## Template Lifecycle

Templates are **living documents**:
- Update based on team feedback
- Add new templates as patterns emerge
- Deprecate unused templates
- Version control for major changes

## Creating New Templates

When creating new templates:
1. **Identify Pattern**: Document recurring coordination scenario
2. **Define Structure**: Create consistent format with required fields
3. **Add Documentation**: Update this README with template description
4. **Get Feedback**: Review with both teams before adoption

---

Last Updated: 2025-10-28
