---
allowed-tools: Task, Read, mcp__serena__*, Bash(git:*)
description: Comprehensive code review with quality gate validation
argument-hint: [optional: file paths or commit hash]
---

# Mobile Code Review

Review: $ARGUMENTS (default: git diff HEAD)

Execute using ww-aadf-mobile-quality-enforcer agent:

**Review Checklist**:

### Automated Quality Gates (8 gates)
1. Test Gate (npm test --coverage)
2. Type Gate (npm run type-check)
7. Backend Sync Gate (npm run types:check-local)
8. Type System Validation Gate (file size check)
9. Pre-Commit Hook Enforcement Gate (no --no-verify)
10. Console.log Pollution Gate (logger.ts enforcement)
Linting (npm run lint)

### Manual Review Gates (5 gates)
3. Integration Gate (service method signatures)
4. TDD Gate (test-first workflow validation)
5. Evidence Gate (Context7 research artifacts)
6. UUID Consistency Gate (string types maintained)
11. TestID Coverage Gate (interactive components)
12. Input Validation Gate (Yup/zod schemas)
13. Offline-First Architecture Gate (OfflineService integration)

**Architecture Compliance**:
- Offline-first pattern verification
- Redux state management review
- React Navigation integration
- BLE integration patterns (if applicable)

**Usage Examples**:
```bash
# Review all uncommitted changes
/ww-aadf-mobile-review

# Review specific files
/ww-aadf-mobile-review "src/services/ProjectService.ts src/screens/ProjectFormScreen.tsx"

# Review specific commit
/ww-aadf-mobile-review "abc123"

# Review PR changes
/ww-aadf-mobile-review "origin/main..HEAD"
```

**Expected Output**:
- Quality Gate Enforcement Report
- 13/13 gate status (pass/fail/warn)
- Code quality score (X/10)
- Production readiness (Y%)
- Blocking issues (MUST fix before merge)
- Warnings (SHOULD fix)
- Recommendations (NICE to have)
- Remediation effort estimate
