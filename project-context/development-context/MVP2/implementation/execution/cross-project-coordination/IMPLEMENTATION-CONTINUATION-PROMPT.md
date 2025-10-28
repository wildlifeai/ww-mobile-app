# Cross-Project Coordination Implementation - Continuation Prompt

**Purpose**: Use this prompt when resuming work on the cross-project coordination system implementation in a new session or fresh context window.

**Last Updated**: 2025-10-28 (Updated with AADF Agent-Based Parallel Execution Strategy)

---

## 📋 Quick Start (Copy-Paste This)

```
I'm continuing work on the Wildlife Watcher Cross-Project Coordination System implementation.

**IMPORTANT**: This system uses AADF agent-based parallel execution for maximum efficiency.

Please read this file to understand current status:
@project-context/development-context/MVP2/implementation/execution/cross-project-coordination/IMPLEMENTATION-PROGRESS-TRACKER.md

**File Location**: /home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/project-context/development-context/MVP2/implementation/execution/cross-project-coordination/

After reading the tracker, please:
1. Tell me which track and task we're currently on
2. Show me the current overall progress
3. List what needs to be done next
4. Identify any blockers
5. Recommend parallel execution strategy using specialized agents:
   - Track 1 → project-organizer agent
   - Track 2 → devops-deployment-architect agent (or direct execution)
   - Track 3 → docs-maintainer agent
   - Track 4 → cicd-engineer agent (after Tracks 1-3 complete)

Then ask me if I'm ready to execute tracks in parallel using agents.
```

---

## 🤖 Agent-Based Parallel Execution (AADF Methodology)

### Why Agent-Based Parallel Execution?

This implementation uses **specialized AI agents** for maximum efficiency, following AADF (AI Agentic Development Framework) principles:

**Traditional Sequential Approach**: 3.25 hours
**Agent-Based Parallel Approach**: ~2 hours (40% time savings)

### Specialized Agent Assignments

1. **Track 1: project-organizer**
   - File reorganization specialist
   - Handles 73 coordination files
   - Applies consistent archival patterns
   - Updates references automatically

2. **Track 2: devops-deployment-architect** (or direct execution)
   - Infrastructure setup expert
   - Runs bash scripts safely
   - Verifies system configuration
   - Tests automation watchers

3. **Track 3: docs-maintainer**
   - Documentation coordination specialist
   - Prepares handoff materials
   - Maintains cross-project docs
   - Coordinates with backend team

4. **Track 4: cicd-engineer** (sequential after 1-3)
   - GitHub Actions expert
   - Git hooks specialist
   - Automation testing
   - End-to-end validation

### Parallel Execution Pattern

**Single message with 3 Task tool calls** for Tracks 1, 2, 3:

```typescript
// Execute all three tracks simultaneously
Task({ subagent_type: "project-organizer", ... })
Task({ subagent_type: "devops-deployment-architect", ... })
Task({ subagent_type: "docs-maintainer", ... })
```

After all three complete, execute Track 4:

```typescript
Task({ subagent_type: "cicd-engineer", ... })
```

---

## 🎯 What This Prompt Does

When you paste the above prompt in a new conversation:

1. **Reads Progress Tracker**: Loads `IMPLEMENTATION-PROGRESS-TRACKER.md` with all checkboxes and status
2. **Analyzes Current State**: Determines where you left off based on completed checkboxes
3. **Identifies Next Step**: Tells you exactly what to do next
4. **Checks Dependencies**: Verifies if current task has blocking dependencies
5. **Recommends Agent Strategy**: Suggests optimal agent-based parallel execution
6. **Provides Context**: Gives you the full picture without needing to remember details

---

## 📖 Full Continuation Prompt (Detailed Version)

Use this expanded version if you need more guidance or want to provide additional context:

```
I'm continuing work on the Wildlife Watcher Cross-Project Coordination System.

**Background:**
- We're implementing a comprehensive cross-repository coordination system
- System coordinates mobile app ↔ backend ↔ web portal development
- Implementation is organized into 4 parallel/sequential tracks
- All design and documentation is complete (Phase 1)
- We're now in the implementation phase (Tracks 1-4)

**Key Documents Location:**
@project-context/development-context/MVP2/implementation/execution/cross-project-coordination/

**Please do the following:**

1. **Read the progress tracker:**
   @project-context/development-context/MVP2/implementation/execution/cross-project-coordination/IMPLEMENTATION-PROGRESS-TRACKER.md

2. **Analyze current state:**
   - Which tracks are complete? (check progress bars)
   - Which track/task am I currently on? (look for in-progress items)
   - What percentage complete is each track?
   - Are there any blockers?

3. **Identify next steps:**
   - What is the next immediate task?
   - What are the task objectives?
   - What is the estimated time?
   - Are there any dependencies blocking progress?

4. **Provide recommendations:**
   - Should I continue with current task?
   - Should I switch to a different track? (if parallel execution)
   - Are there any prerequisites I need to complete first?
   - What's the optimal execution strategy from this point?

5. **Show me a summary:**
   - Current progress (visual progress bars)
   - Time spent vs estimated
   - Next 3 tasks in priority order
   - Any urgent issues or blockers

**Context about my environment:**
- OS: Windows 11 WSL2 with Ubuntu
- Location: ~/dev/wildlifeai/wildlife-watcher-mobile-app/
- Backend repo: ~/dev/wildlifeai/wildlife-watcher-backend/
- Mobile repo: Current working directory

**I'm ready to continue. What should I do next?**
```

---

## 🔍 What the AI Will Tell You

After reading the progress tracker, the AI will provide:

### 1. Current Status Summary
```
📊 Overall Progress:
Phase 1: Design & Documentation    [████████████████████] 100% ✅
Track 1: Mobile Repo Organization  [████████░░░░░░░░░░░░]  40% 🔄
Track 2: Shared Hub Setup          [████████████████████] 100% ✅
Track 3: Backend Team Handoff      [██████░░░░░░░░░░░░░░]  30% 🔄
Track 4: Automation Integration    [░░░░░░░░░░░░░░░░░░░░]   0% 🔒
```

### 2. Current Task Identification
```
📍 You are currently on: Track 1, Task 1.3 (Archive Historical Files)
⏱️  Task Progress: 6 of 14 files archived
⏳ Time on task: 20 minutes / 45 minutes estimated
🎯 Next file to archive: code-review/BACKEND-UPDATE-SUMMARY.md
```

### 3. Next Steps List
```
🎯 Next 3 Tasks (Priority Order):
1. Complete Track 1, Task 1.3 (8 files remaining) - 25 min
2. Start Track 1, Task 1.4 (Create reference links) - 15 min
3. Complete Track 1, Task 1.5 (Update references) - 15 min
```

### 4. Blocker Analysis
```
🚧 Current Blockers: None
✅ Dependencies Met: All prerequisites satisfied
⚡ Can Execute in Parallel: Track 3 (if not started)
```

### 5. Recommendation
```
💡 Recommendation: Continue with Track 1, Task 1.3
   - You're 40% through this task
   - Estimated 25 minutes to complete
   - No blockers
   - After completion, proceed to Task 1.4
```

---

## 🚀 Different Scenarios & Prompts

### Scenario 1: Just Starting Implementation (AADF Agent-Based)
**Prompt:**
```
I'm starting the cross-project coordination system implementation.

Read: @project-context/development-context/MVP2/implementation/execution/cross-project-coordination/IMPLEMENTATION-PROGRESS-TRACKER.md

Execute Tracks 1, 2, and 3 in parallel using specialized agents as defined in the AADF Parallel Execution Strategy section.

Use a single message with 3 Task tool calls:
- Track 1: project-organizer agent
- Track 2: devops-deployment-architect agent (or direct execution)
- Track 3: docs-maintainer agent
```

**Expected Response:**
- AI spawns 3 agents in parallel (single message with 3 Task calls)
- Each agent executes its track autonomously
- All three tracks complete simultaneously (~2 hours total)
- AI reports completion of all three tracks
- AI asks if ready to proceed with Track 4

---

### Scenario 2: Mid-Implementation (Unknown Progress)
**Prompt:**
```
I was implementing the coordination system but stopped partway through.
Read @IMPLEMENTATION-PROGRESS-TRACKER.md and tell me where I left off and what to do next.
```

**Expected Response:**
- AI identifies last completed checkbox
- Determines current task
- Provides continuation instructions
- Highlights any blockers

---

### Scenario 3: Track Complete, Need Next Track
**Prompt:**
```
I just completed Track 1 (mobile repo organization).
Read @IMPLEMENTATION-PROGRESS-TRACKER.md and tell me what track to do next.
```

**Expected Response:**
- AI confirms Track 1 completion
- Checks Track 2 status
- Provides instructions for next track
- Verifies dependencies for Track 4

---

### Scenario 4: Encountered a Blocker
**Prompt:**
```
I'm stuck on Track 4, Task 4.2 (backend git hooks).
Backend team hasn't completed their setup yet.
What should I do? Can I proceed with other tasks?
```

**Expected Response:**
- AI identifies the blocker
- Suggests parallel work (other Track 4 tasks)
- Recommends what can be done independently
- Provides workaround if available

---

### Scenario 5: All Tracks Complete - Need Validation
**Prompt:**
```
I believe I've completed all tracks.
Read @IMPLEMENTATION-PROGRESS-TRACKER.md and verify completion.
Then tell me what validation tests I need to run.
```

**Expected Response:**
- AI checks all track checkboxes
- Confirms completion or identifies missing items
- Provides validation test list
- Recommends next steps (documentation updates, etc.)

---

## 🛠️ Troubleshooting Scenarios

### Issue: AI Can't Find Progress Tracker
**Solution:**
```
The progress tracker is located at:
/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/project-context/development-context/MVP2/implementation/execution/cross-project-coordination/IMPLEMENTATION-PROGRESS-TRACKER.md

Full directory path:
/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/project-context/development-context/MVP2/implementation/execution/cross-project-coordination/

Please read this file and execute the AADF Parallel Execution Strategy.
```

### Issue: Checkboxes Not Updated
**Before new session:**
```
Update @IMPLEMENTATION-PROGRESS-TRACKER.md with my current progress:
- Track 1, Task 1.2: Complete (all boxes checked)
- Track 1, Task 1.3: In progress (6 of 14 files archived)
- Update progress bar for Track 1 to 40%
```

### Issue: Need to Change Strategy Mid-Implementation
**Prompt:**
```
I started with parallel execution but need to switch to sequential.
Read @IMPLEMENTATION-PROGRESS-TRACKER.md and help me reorganize remaining work into sequential order.
```

---

## 📝 Manual Progress Update Template

If you need to manually update the tracker before using continuation prompt:

```
Before I continue, let me update the progress tracker.

Please update @IMPLEMENTATION-PROGRESS-TRACKER.md with the following:

**Track 1 Progress:**
- Task 1.1: ✅ Complete (all checkboxes)
- Task 1.2: ✅ Complete (all checkboxes)
- Task 1.3: 🔄 In Progress (6 of 14 checkboxes)
- Progress bar: Update to 40%
- Time spent: 1.5 hours

**Track 2 Progress:**
- Status: Not started yet

**Track 3 Progress:**
- Status: Not started yet

**Track 4 Progress:**
- Status: Blocked (waiting for Tracks 1-3)

After updating, tell me what to do next.
```

---

## 🎓 Best Practices for Session Continuity

### Before Ending a Session:
1. ✅ **Update all checkboxes** in progress tracker for completed items
2. ✅ **Note current task** explicitly (even if in-progress)
3. ✅ **Update time spent** in tracker
4. ✅ **Document any blockers** in "Known Issues" section
5. ✅ **Commit progress** to git with descriptive message
6. ✅ **Save any terminal commands** or notes in tracker

### When Starting a New Session:
1. ✅ **Use this continuation prompt** (copy-paste from above)
2. ✅ **Review AI's analysis** of current state
3. ✅ **Verify progress** matches your memory
4. ✅ **Correct any discrepancies** in tracker
5. ✅ **Proceed with next task** as recommended

### If You Skipped Updates:
```
I stopped mid-implementation but didn't update the tracker.
Here's what I remember completing:
- [List what you completed]

Please update @IMPLEMENTATION-PROGRESS-TRACKER.md accordingly,
then tell me what to do next.
```

---

## 🔗 Related Commands Reference

### Check Current Progress (Manual)
```bash
# View progress tracker
cat project-context/development-context/MVP2/implementation/execution/cross-project-coordination/IMPLEMENTATION-PROGRESS-TRACKER.md | grep -A5 "Overall Progress"

# Check git status
git status

# Check if shared hub exists
ls -la ~/dev/wildlifeai/cross-project-coordination/
```

### Update Progress (Manual)
```bash
# Edit progress tracker
nano project-context/development-context/MVP2/implementation/execution/cross-project-coordination/IMPLEMENTATION-PROGRESS-TRACKER.md

# Commit progress
git add project-context/development-context/MVP2/implementation/execution/cross-project-coordination/
git commit -m "chore(coordination): update implementation progress [Track X, Task X.X]"
```

---

## 🎯 Quick Decision Tree

**Use this to decide which prompt to use:**

```
START
  │
  ├─ First time implementing?
  │   └─ YES → Use "Scenario 1" prompt
  │   └─ NO → Continue
  │
  ├─ Do you know where you left off?
  │   └─ YES → Use "Quick Start" prompt
  │   └─ NO → Use "Scenario 2" prompt
  │
  ├─ Just completed a track?
  │   └─ YES → Use "Scenario 3" prompt
  │   └─ NO → Continue
  │
  ├─ Hit a blocker?
  │   └─ YES → Use "Scenario 4" prompt
  │   └─ NO → Continue
  │
  ├─ Think you're done?
  │   └─ YES → Use "Scenario 5" prompt
  │   └─ NO → Use "Quick Start" prompt
  │
  └─ Tracker not updated?
      └─ YES → Use "Manual Progress Update" template first
      └─ NO → Use "Quick Start" prompt
```

---

## 🚀 Ready to Continue?

**Copy this prompt to start:**

```
I'm continuing the Cross-Project Coordination System implementation.

Read: @project-context/development-context/MVP2/implementation/execution/cross-project-coordination/IMPLEMENTATION-PROGRESS-TRACKER.md

Tell me: Current status, what's next, any blockers, and recommended action.
```

---

**End of Continuation Prompt**

**Last Updated**: 2025-10-28
**Version**: 1.0
**Maintained By**: Project Lead / AI Assistant

---

## 💡 Tips for Success

1. **Always update tracker before ending session** - 2 minutes now saves 10 minutes later
2. **Use git commits frequently** - Commits are checkpoints for recovery
3. **Keep notes in tracker** - "Session Recovery Notes" section is for you
4. **Test the continuation prompt** - Try it once while you remember context
5. **Keep this file open** - Bookmark it in your browser/editor for quick access

**Happy coordinating!** 🎉
