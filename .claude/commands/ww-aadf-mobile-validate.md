---
allowed-tools: Task, Bash(npm:*), Read, mcp__serena__*
description: Run all 13 quality gates and generate validation report
argument-hint: [optional: specific gate name or "all"]
---

# Mobile Quality Gate Validation

Validate: $ARGUMENTS (default: all 13 quality gates)

Execute all quality gates using ww-aadf-mobile-quality-enforcer agent:

**Quality Gates Validated**:
1. Test Gate (npm test --coverage)
2. Type Gate (npm run type-check)
3. Integration Gate (service signature validation)
4. TDD Gate (test-first verification)
5. Evidence Gate (Context7 research validation)
6. UUID Consistency Gate (string type enforcement)
7. Backend Sync Gate (type drift detection)
8. Type System Validation Gate (empty type file check)
9. Pre-Commit Hook Enforcement Gate (no --no-verify)
10. Console.log Pollution Gate (logger.ts enforcement)
11. TestID Coverage Gate (accessibility validation)
12. Input Validation Gate (Yup/zod schema validation)
13. Offline-First Architecture Gate (OfflineService integration)

**Output**: Comprehensive validation report with pass/fail status, blocking issues, action items.

**Usage Examples**:
```bash
# Validate all 13 quality gates
/ww-aadf-mobile-validate all

# Validate specific gate
/ww-aadf-mobile-validate "Test Gate"

# Validate before commit
/ww-aadf-mobile-validate
```

**Expected Output**:
- Quality Gate Enforcement Report
- 13 gate pass/fail status
- Blocking issues (if any)
- Warnings (if any)
- Action items for remediation
- Overall quality score (X/10)
- Production readiness (Y%)
