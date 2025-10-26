# Code Review Issues

This folder contains organized documentation for specific issues discovered during code review and remediation.

---

## 📁 Folder Structure

Each issue gets its own subfolder with format: `NNN-issue-name-brief`

Example:
```
issues/
├── README.md (this file)
├── 001-member-access-rls-regression/
│   ├── README.md
│   ├── REGRESSION-ROOT-CAUSE-ANALYSIS.md
│   ├── MEMBER-MANAGEMENT-REGRESSION-ANALYSIS.md
│   └── ... (related investigation files)
└── 002-next-issue/
    └── ...
```

---

## 🗂️ Current Issues

### 001: Member Access RLS Regression
**Status**: 🔴 CRITICAL - Backend fix required
**Date**: 2025-10-19
**Summary**: ww_admin users cannot view project members due to backend RLS policy
**Folder**: `001-member-access-rls-regression/`

---

## 📋 Issue Numbering Convention

- **001-099**: Critical production blockers
- **100-199**: High priority bugs
- **200-299**: Medium priority issues
- **300-399**: Low priority / technical debt
- **400+**: Enhancement requests

---

## 🏷️ Issue Status Labels

- 🔴 **CRITICAL**: Blocking production functionality
- 🟡 **HIGH**: Significant impact, needs immediate attention
- 🟠 **MEDIUM**: Important but not blocking
- 🟢 **LOW**: Minor issues, nice-to-have fixes
- ✅ **RESOLVED**: Issue fixed and validated
- 🔵 **DEFERRED**: Postponed to future milestone

---

## 📝 Creating a New Issue Folder

When documenting a new issue:

1. **Create folder**: `NNN-brief-issue-name/`
2. **Add README.md** with:
   - Issue summary
   - Status and priority
   - Root cause analysis
   - Files in folder explanation
   - Resolution status
   - Related files/links
3. **Move investigation files** into the folder
4. **Update this README** with new issue entry

---

## 🔍 Finding Issues

- **By number**: `001-member-access-rls-regression/`
- **By status**: Check this README's "Current Issues" section
- **By date**: Folder names include creation date in parent folder
- **By keyword**: Use grep/search across README files

---

**Last Updated**: 2025-10-19
**Total Issues**: 1
**Active Issues**: 1
**Resolved Issues**: 0
