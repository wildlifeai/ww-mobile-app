# Continuation Prompt - Cross-Project Coordination Documentation Consolidation

## Purpose
Use this prompt to continue the documentation consolidation work after interruption or context window reset.

---

## Prompt to Use

```
Continue the cross-project coordination documentation consolidation work.

Read the execution plan at:
@project-context/development-context/MVP2/implementation/execution/cross-project-coordination/consolidation-plan/CONSOLIDATION-EXECUTION-PLAN.md

Current status and next steps:
1. Check the "Progress Tracking" section to see which tasks are complete (✅) vs not started (❌)
2. Identify the next batch of tasks to execute based on dependencies
3. Update task statuses as you complete them
4. Follow the parallel execution strategy defined in the plan

Key points:
- Execute tasks in batches according to dependency diagram
- Use assigned subagents for each task (specified in plan)
- Update the CONSOLIDATION-EXECUTION-PLAN.md file after completing each task
- Mark tasks complete (✅) and update overall progress percentage
- Verify no broken links or references after changes

Goal: Consolidate 21,000 lines of mobile coordination docs → 50 lines in CLAUDE.md + comprehensive shared hub docs.

Start with the next incomplete batch of tasks.
```

---

## How to Use This Prompt

### After Interruption
1. Copy the prompt above
2. Paste into a new Claude Code session
3. Claude will read the execution plan and continue from where it left off

### Before Starting
Claude will:
1. Read `CONSOLIDATION-EXECUTION-PLAN.md`
2. Check progress tracking section
3. Identify next batch of tasks
4. Execute tasks with appropriate subagents
5. Update plan document with progress

### As Work Progresses
Claude should:
1. Mark tasks complete (change ❌ to ✅) in the plan
2. Update "Last Updated" timestamp
3. Update overall progress percentage
4. Note any issues in "Risk Register"
5. Update "File Change Summary" with actual changes

---

## Quick Status Check Commands

```bash
# Check current progress
grep "Overall Progress:" @project-context/development-context/MVP2/implementation/execution/cross-project-coordination/consolidation-plan/CONSOLIDATION-EXECUTION-PLAN.md

# See which tasks are complete
grep "✅" @project-context/development-context/MVP2/implementation/execution/cross-project-coordination/consolidation-plan/CONSOLIDATION-EXECUTION-PLAN.md | wc -l

# See which tasks remain
grep "❌" @project-context/development-context/MVP2/implementation/execution/cross-project-coordination/consolidation-plan/CONSOLIDATION-EXECUTION-PLAN.md | wc -l

# View last update time
grep "Last Updated:" @project-context/development-context/MVP2/implementation/execution/cross-project-coordination/consolidation-plan/CONSOLIDATION-EXECUTION-PLAN.md | tail -1
```

---

## Execution Strategy Summary

**Batch 1 (30 min)** - Start first, 5 tasks in parallel:
- Create COORDINATION-QUICK-START.md (Agent: backend-architect)
- Create TYPE-SYNC-GUIDE.md (Agent: backend-architect)
- Update Mobile CLAUDE.md (Agent: docs-maintainer)
- Archive Historical Docs (Agent: project-organizer)
- Update agent-reference.md (Agent: docs-maintainer)

**Batch 2 (15 min)** - After Batch 1 complete:
- Update SYSTEM-REFERENCE-GUIDE.md
- Delete Redundant Files
- Move Misplaced File
- Update agent definition

**Batch 3 (15 min)** - After Batch 2 complete:
- Draft Backend Notification
- Log Message Activity
- Clean Empty Directories

**Batch 4 (10 min)** - Final verification:
- Verify Mobile Workflow

---

## Critical Files

**Execution Plan**: `@project-context/development-context/MVP2/implementation/execution/cross-project-coordination/consolidation-plan/CONSOLIDATION-EXECUTION-PLAN.md`

**Mobile CLAUDE.md**: `/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/CLAUDE.md`

**Shared Hub Location**: `~/dev/wildlifeai/cross-project-coordination/`

**Archive Destination**: `project-context/archive/cross-project-coordination-implementation-2025-10/`

---

## Success Criteria Checklist

After completion, verify:
- [ ] Mobile CLAUDE.md coordination section is ~50 lines
- [ ] Shared hub has COORDINATION-QUICK-START.md (~400 lines)
- [ ] Shared hub has TYPE-SYNC-GUIDE.md (~300 lines)
- [ ] SYSTEM-REFERENCE-GUIDE.md updated with agent info
- [ ] Backend team notified via coordination message
- [ ] Historical docs archived (26 files)
- [ ] Redundant docs deleted (38 files)
- [ ] Agent references updated (agent-reference.md + agent definition)
- [ ] All cross-references working
- [ ] Mobile workflow verified (can action schema-change)

---

## Common Issues & Solutions

### Issue: Context window full during execution
**Solution**: Use this continuation prompt to resume in new session

### Issue: Unsure which batch to execute next
**Solution**: Check "Progress Tracking" section, follow dependency diagram

### Issue: Task dependencies unclear
**Solution**: See "Task Dependencies Diagram" in execution plan

### Issue: Need to verify progress
**Solution**: Run quick status check commands above

### Issue: Broken links after reorganization
**Solution**: Task 6.1 (Verification) will catch these, fix before completion

---

## Notes for Continuation

- **Always** update the execution plan after completing tasks
- **Always** check dependencies before starting a task
- **Always** use the assigned subagent for each task
- **Always** verify changes don't break existing workflows
- **Never** skip the verification phase (Task 6.1)

---

**Created**: 2025-10-29
**Purpose**: Resume documentation consolidation work after interruption
**Target**: 95 minutes total execution time across all batches
