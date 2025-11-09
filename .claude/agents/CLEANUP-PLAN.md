# Agent Cleanup Plan for Specialized Agent Ecosystem

**Date**: 2025-11-09
**Context**: Implementing specialized ww-aadf-mobile-* agent ecosystem per `2025-11-09-REVISED-specialized-agent-ecosystem-plan.md`

## Overview

Removing project-specific agents that will be replaced by 8 specialized ww-aadf-mobile-* agents with deep Wildlife Watcher knowledge.

## Files to Remove

### Project-Specific Agents (Being Replaced)
1. `react-native-expo-architect.md` → Replaced by 8 ww-aadf-mobile-* agents
2. `cross-project-coordinator.md` → Replaced by ww-aadf-coordinator (remove after new one created)
3. `specialized/mobile/spec-mobile-react-native.md` → Replaced by specialized agents

### Documentation Artifacts (Historical)
4. `AGENT-REVIEW-AND-RECOMMENDATIONS.md` → Historical review (2025-10-28)
5. `CLEANUP-COMPLETE.md` → Cleanup documentation
6. `MIGRATION_SUMMARY.md` → Migration documentation

## Files to Keep

### Generic/Reusable Agents
- ✅ `base-template-generator.md` - Generic scaffolding
- ✅ `supabase-edge-function-generator.md` - Generic Supabase tool
- ✅ `supabase-schema-manager.md` - Generic Supabase schema tool
- ✅ `project-context-manager.md` - Generic context management

### Generic Agent Directories (ALL)
- ✅ `core/` - coder, planner, researcher, reviewer, tester
- ✅ `data/` - Data processing agents
- ✅ `development/` - Development agents
- ✅ `devops/` - DevOps agents
- ✅ `documentation/` - Documentation agents
- ✅ `sparc/` - SPARC methodology agents
- ✅ `testing/` - Testing agents
- ✅ `templates/` - Generic templates
- ✅ `analysis/` - Code analysis agents
- ✅ `architecture/` - Architecture agents

## Cleanup Commands

```bash
cd /home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/.claude/agents

# Create archive directory
mkdir -p _archived/2025-11-09-specialized-agent-cleanup

# Archive project-specific agents (being replaced)
mv react-native-expo-architect.md _archived/2025-11-09-specialized-agent-cleanup/
mv cross-project-coordinator.md _archived/2025-11-09-specialized-agent-cleanup/
mv specialized/mobile/spec-mobile-react-native.md _archived/2025-11-09-specialized-agent-cleanup/

# Archive documentation artifacts
mv AGENT-REVIEW-AND-RECOMMENDATIONS.md _archived/2025-11-09-specialized-agent-cleanup/
mv CLEANUP-COMPLETE.md _archived/2025-11-09-specialized-agent-cleanup/
mv MIGRATION_SUMMARY.md _archived/2025-11-09-specialized-agent-cleanup/

# Optional: Remove empty specialized/mobile directory if no other files
rmdir specialized/mobile 2>/dev/null || echo "Directory not empty or doesn't exist"
```

## Verification

After cleanup, `.claude/agents/` should contain:

```
.claude/agents/
├── README.md (keep if exists)
├── CLEANUP-PLAN.md (this file)
├── base-template-generator.md
├── project-context-manager.md
├── supabase-edge-function-generator.md
├── supabase-schema-manager.md
├── analysis/ (generic agents)
├── architecture/ (generic agents)
├── core/ (generic agents)
├── data/ (generic agents)
├── development/ (generic agents)
├── devops/ (generic agents)
├── documentation/ (generic agents)
├── sparc/ (generic agents)
├── templates/ (generic templates)
├── testing/ (generic agents)
└── _archived/
    └── 2025-11-09-specialized-agent-cleanup/ (6 archived files)
```

## Next Steps

1. ✅ Execute cleanup commands above
2. ⏳ Create 8 specialized ww-aadf-mobile-* agents in `specialized/mobile/`:
   - ww-aadf-mobile-offline-architect.md
   - ww-aadf-mobile-ble-specialist.md
   - ww-aadf-mobile-performance-optimizer.md
   - ww-aadf-mobile-testing-coordinator.md
   - ww-aadf-mobile-type-sync-guardian.md
   - ww-aadf-mobile-environment-manager.md
   - ww-aadf-mobile-quality-gate-enforcer.md
   - ww-aadf-mobile-code-reviewer.md
3. ⏳ Create ww-aadf-coordinator.md (replaces cross-project-coordinator)
4. ⏳ Create 10 slash commands in `.claude/commands/mobile/`

## Rationale

**Why Remove Project-Specific Agents?**
- Generic `react-native-expo-architect` doesn't know Wildlife Watcher specifics:
  - ❌ Doesn't know about offline-first architecture (SQLite + OfflineService)
  - ❌ Doesn't know about custom BLE engine patterns (useBle.ts)
  - ❌ Doesn't know about Redux setup (4 RTK Query APIs, 15 slices)
  - ❌ Doesn't know about specific file references (ProjectService.ts:1-900)

- New `ww-aadf-mobile-*` agents WILL know:
  - ✅ Exact file paths and line numbers
  - ✅ Offline-first implementation patterns
  - ✅ BLE command scheduling patterns
  - ✅ Redux middleware setup
  - ✅ Supabase environment switching
  - ✅ Quality gate requirements

**Why Keep Generic Agents?**
- Provide general domain capabilities (testing, coding, planning)
- Work across ANY project (not Wildlife Watcher specific)
- Complement specialized agents (generic + specific = complete coverage)
- Plan explicitly acknowledges these as separate from specialized agents

## Restoration Plan

If any archived agent is needed:
```bash
# Restore from archive
mv _archived/2025-11-09-specialized-agent-cleanup/[agent-name].md ./
```

All files preserved in `_archived/` - no permanent deletion.
