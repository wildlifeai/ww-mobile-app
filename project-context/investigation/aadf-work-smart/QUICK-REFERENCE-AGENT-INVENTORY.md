# Wildlife Watcher AADF Agent Ecosystem - Quick Reference

**Last Updated**: 2025-11-09
**Status**: Ready for Implementation

---

## Naming Convention

**Pattern**: `ww-aadf-{domain}-{capability}`

- `ww` = Wildlife Watcher (project-specific)
- `aadf` = AI Agentic Development Framework
- `{domain}` = mobile, backend, coordination
- `{capability}` = specific function

---

## Mobile Team (19 deliverables)

### Agents (8)

**P0 (Must Implement - 5)**:
1. `ww-aadf-mobile-quality-gate-enforcer` - Enforce 13 quality gates
2. `ww-aadf-mobile-type-sync-guardian` - Prevent type drift
3. `ww-aadf-mobile-offline-architect` - Offline-first architecture
4. `ww-aadf-mobile-testing-coordinator` - TDD/BDD orchestration
5. `ww-aadf-mobile-code-reviewer` - Code review automation

**P1 (High Value - 2)**:
6. `ww-aadf-mobile-ble-specialist` - BLE + DFU
7. `ww-aadf-mobile-performance-optimizer` - Bundle + SQLite optimization

**P2 (Nice-to-Have - 1)**:
8. `ww-aadf-mobile-environment-manager` - Runtime environment switching

### Slash Commands (10)

**P0 (Must Implement - 6)**:
1. `/ww-aadf-mobile-test` - Run full test suite
2. `/ww-aadf-mobile-validate-local` - Full local validation
3. `/ww-aadf-mobile-quality-gate` - Run all quality gates
4. `/ww-aadf-mobile-sync-types` - Sync types from backend
5. `/ww-aadf-mobile-validate-cloud-dev` - Full cloud-dev validation
6. `/ww-aadf-mobile-check-inbox` - Check coordination inbox

**P1 (High Value - 3)**:
7. `/ww-aadf-mobile-bundle-analyze` - Analyze bundle size
8. `/ww-aadf-mobile-performance` - Performance benchmarks
9. `/ww-aadf-mobile-security-audit` - Security scan

**P2 (Nice-to-Have - 1)**:
10. `/ww-aadf-mobile-offline-coverage` - Offline-first coverage report

### Coordination (1)
- `ww-aadf-coordinator` (P0) - Cross-project coordination

---

## Backend Team Pattern (18 deliverables)

**NOTE**: Backend team responsibility - mobile provides pattern only

### Agents (8)

**P0**: quality-gate-enforcer, schema-guardian, rls-architect, testing-coordinator, code-reviewer
**P1**: migration-specialist, performance-optimizer
**P2**: edge-function-architect

### Slash Commands (10)

**P0**: test, validate-local, quality-gate, sync-types, validate-cloud-dev, send-message
**P1**: migration, rls-validate, performance
**P2**: edge-function

---

## Grand Total

- **Mobile**: 18 deliverables (THIS PLAN)
- **Backend**: 18 deliverables (BACKEND TEAM)
- **Coordination**: 2 deliverables (SHARED)
- **TOTAL**: 38 deliverables (18 agents + 20 commands)

---

## P0 MVP (12 deliverables - 3 weeks)

**Week 1**:
- Agent: ww-aadf-mobile-quality-gate-enforcer
- Agent: ww-aadf-mobile-type-sync-guardian
- Commands: /ww-aadf-mobile-quality-gate, /ww-aadf-mobile-sync-types, /ww-aadf-mobile-check-inbox

**Week 2**:
- Agent: ww-aadf-mobile-testing-coordinator
- Agent: ww-aadf-mobile-offline-architect
- Commands: /ww-aadf-mobile-test, /ww-aadf-mobile-validate-local, /ww-aadf-mobile-validate-cloud-dev

**Week 3**:
- Agent: ww-aadf-mobile-code-reviewer
- Agent: ww-aadf-coordinator

---

## File Locations

**Mobile Agents**:
`.claude/agents/specialized/mobile/ww-aadf-mobile-*.md`

**Mobile Commands**:
`.claude/commands/mobile/ww-aadf-mobile-*.md`

**Coordination Agents**:
`.claude/agents/coordination/ww-aadf-*.md`

---

## Documentation

**Complete Plan**:
`project-context/investigation/aadf-work-smart/2025-11-09-REVISED-specialized-agent-ecosystem-plan.md`

**Update Summary**:
`project-context/investigation/aadf-work-smart/UPDATE-SUMMARY-2025-11-09.md`

**Section 11**: Agent & Slash Command Inventory (detailed tables, patterns, guidance)

---

**For Details**: See Section 11 of the complete plan
