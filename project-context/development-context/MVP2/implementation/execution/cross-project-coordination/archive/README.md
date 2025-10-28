# Archive - Mobile Repo Coordination Files

## Structure

**Single, flat monthly structure:**
```
archive/
├── 2025-09/    # September 2025 coordination files
├── 2025-10/    # October 2025 coordination files
└── README.md
```

## Contents

This archive contains **mobile repo coordination files** that have been completed, superseded, or are no longer actively referenced.

**Examples in 2025-10/**:
- Completion reports (TASK-11-COMPLETION-SUMMARY.md, TASK-12-PHASE2-I2-COMPLETE.md, etc.)
- Historical coordination status files
- Superseded backend coordination documents
- Old code review summaries (PROJECT-TEST-SUMMARY.md, REDUX-FIX-COMPLETION-SUMMARY.md)

## Not the Same as Shared Hub Archive

**This archive** (`mobile-app/.../archive/`): Mobile repo's internal coordination files
**Shared hub archive** (`~/cross-project-coordination/archive/`): Cross-team messages

## Archival Policy

Files are archived when:
- Coordination activity is complete
- Task/subtask reaches completion milestone
- Document is superseded by newer version
- Historical context is no longer actively referenced

**NEVER DELETE** - All files are archived, never permanently removed

## Finding Files

**By Month**:
```bash
ls archive/2025-10/
```

**By Type**:
```bash
ls archive/2025-10/*COMPLETION*
ls archive/2025-10/*STATUS*
ls archive/2025-10/*SUMMARY*
```

**By Search**:
```bash
grep -r "Task 11" archive/
find archive/ -name "*BACKEND*"
```

---

**Last Updated**: 2025-10-28
**Structure**: Flat monthly folders (YYYY-MM) - NO type-based folders
**Previous Structure**: Removed `completion-reports/` folder (merged into monthly folders)
