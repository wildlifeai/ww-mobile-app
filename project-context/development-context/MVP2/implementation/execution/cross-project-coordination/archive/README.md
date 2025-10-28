# Archive Directory

Historical coordination activities and completed work organized by date and type.

## Structure

### Date-Based Archives
- **`2025-09/`** - September 2025 coordination activities
- **`2025-10/`** - October 2025 coordination activities

### Type-Based Archives
- **`completion-reports/`** - Task completion summaries and project milestones

## Archival Policy

Files are archived when:
- Coordination activity is complete
- Task/subtask reaches completion milestone
- Document is superseded by newer version
- Historical context is no longer actively referenced

## Archive Principles

**NEVER DELETE** - All files are archived, never permanently removed:
- Preserves project history
- Maintains audit trail
- Enables future reference
- Documents decision rationale

## Finding Archived Content

**By Date**: Check `2025-{month}/` for time-based coordination
**By Type**: Check `completion-reports/` for task summaries

**Search Tips**:
```bash
# Find all archived coordination files
find archive/ -name "*.md"

# Search archive content
grep -r "search-term" archive/

# List recent archives
ls -lt archive/*/ | head -20
```

## Related Directories

- **Active** (`../active/`) - Current coordination tasks
- **Protocols** (`../protocols/`) - Active coordination protocols
- **Templates** (`../templates/`) - Message templates

---

Last Updated: 2025-10-28
