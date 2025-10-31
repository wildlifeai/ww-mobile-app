# Dynamic Cross-Project Coordination System - Design Specification

**Version**: 1.0.0
**Status**: Design Phase
**Created**: 2025-10-31

## Overview

A sophisticated coordination system for large-scale cross-project work between mobile and backend teams, featuring:

- 🔄 **Dynamic monitoring** of project-specific communication channels
- 📊 **Context window management** with automatic session recovery
- 🎯 **Milestone-based execution** with human checkpoints
- 🤖 **Agent orchestration** with parallel task execution
- 🔀 **Auto/manual mode switching** for file watching

## Architecture

### 1. Project Folder Structure

```
~/dev/wildlifeai/cross-project-coordination/
├── projects/
│   └── <project-slug>/                    # e.g., "ble-dfu-lorawan-integration"
│       ├── inbox/
│       │   ├── backend-to-mobile/         # Dynamic inbox (watched)
│       │   │   └── README.md              # Inbox usage instructions
│       │   └── mobile-to-backend/         # Dynamic inbox (watched)
│       │       └── README.md
│       ├── shared-docs/                   # Living documents both teams edit
│       │   ├── architecture-decisions.md  # ADRs
│       │   ├── api-contracts.yml          # API specifications
│       │   ├── data-models.yml            # Shared data models
│       │   └── integration-points.md      # Integration documentation
│       ├── master-plan/
│       │   ├── project-plan.md            # High-level plan
│       │   ├── task-definitions.yml       # All tasks with metadata
│       │   ├── dependency-graph.yml       # Task dependencies
│       │   └── priority-matrix.yml        # P0-P3 prioritization
│       ├── milestones/
│       │   ├── milestone-01-setup.md
│       │   ├── milestone-02-phase1.md
│       │   ├── milestone-03-integration.md
│       │   └── milestone-04-production.md
│       ├── context-snapshots/             # Session recovery system
│       │   ├── session-001/
│       │   │   ├── state.json             # Serialized state
│       │   │   ├── continuation.md        # Continuation prompt
│       │   │   └── metadata.json          # Session metadata
│       │   └── active-session.json        # Current session pointer
│       ├── archive/
│       │   └── YYYY-MM/                   # Monthly archives
│       ├── .watch-config.yml              # File watch configuration
│       ├── .project-config.yml            # Project configuration
│       └── PROJECT-README.md              # Project overview
```

### 2. Dynamic Monitoring System

**File Watch Architecture**:

```yaml
# .watch-config.yml
version: "1.0"
mode: auto  # auto | manual
watch_paths:
  - inbox/backend-to-mobile/
  - inbox/mobile-to-backend/
  - shared-docs/
poll_interval: 30  # seconds (auto mode)
notification_method: agent  # agent | webhook | file
```

**Watch Modes**:

1. **Auto Mode** (Default):
   - `inotifywait` monitors inbox folders
   - Detects new files, modifications, deletions
   - Triggers cross-project-coordinator agent notification
   - Runs in background (`nohup` or systemd service)

2. **Manual Mode**:
   - Human sends notification: `notify-project.sh <project-slug> <message-type>`
   - Useful for controlled coordination, debugging, or low-frequency projects

**Implementation**:
- Bash script: `~/dev/wildlifeai/cross-project-coordination/.scripts/watch-project.sh`
- Agent hook: Cross-project-coordinator checks on startup
- Notification format: JSON message in `.notifications/` folder

### 3. Context Window Management System

**Problem**: Large projects exceed 200k token limit, requiring session continuity.

**Solution**: Automated state serialization with continuation prompts.

#### 3.1 Token Monitoring

```bash
# .scripts/monitor-context.sh
# Tracks token usage in current conversation
# Warns at 80% (160k tokens)
# Auto-snapshots at 85% (170k tokens)
```

**Monitoring Points**:
- After each agent execution (count agent output tokens)
- After reading large documents (count file tokens)
- Before spawning parallel agents (estimate token budget)

**Warning Levels**:
- 🟢 **Green Zone** (0-80%): Normal operation
- 🟡 **Yellow Zone** (80-85%): Warning, prepare for snapshot
- 🟠 **Orange Zone** (85-90%): Auto-snapshot triggered
- 🔴 **Red Zone** (90-100%): Immediate session switch required

#### 3.2 Session State Serialization

**State Components**:
```json
{
  "session_id": "session-001",
  "project_slug": "ble-dfu-lorawan-integration",
  "timestamp": "2025-10-31T14:30:00Z",
  "current_milestone": "milestone-02-phase1",
  "active_tasks": [
    {
      "task_id": "T-001",
      "status": "in_progress",
      "assigned_agent": "mobile-dev",
      "progress_pct": 65,
      "blockers": []
    }
  ],
  "completed_tasks": ["T-000"],
  "pending_tasks": ["T-002", "T-003"],
  "context_summary": {
    "decisions_made": ["..."],
    "key_findings": ["..."],
    "open_questions": ["..."]
  },
  "file_states": {
    "src/services/BleService.ts": "modified",
    "src/services/DfuService.ts": "created"
  },
  "token_usage": {
    "current": 170000,
    "limit": 200000,
    "percentage": 85
  }
}
```

**Continuation Prompt Template**:
```markdown
# Session Continuation: {project_slug} - Session {session_id}

**Previous Session Summary**:
- Session ID: {session_id}
- Ended: {timestamp}
- Milestone: {current_milestone}
- Token Usage: {token_usage}

**Completed Work**:
{completed_tasks_summary}

**In-Progress Work**:
{active_tasks_summary}

**Critical Context**:
{key_decisions_and_findings}

**File Changes**:
{modified_files_list}

**Next Steps**:
{pending_tasks_summary}

**Resume Command**:
/aadf-work-smart "Resume {project_slug} from session {session_id}. Load state from context-snapshots/session-{session_id}/state.json and continue with task {next_task_id}."
```

#### 3.3 Session Recovery Workflow

```bash
# 1. Human detects context window warning (85%+)
# 2. Run snapshot script
~/dev/wildlifeai/cross-project-coordination/.scripts/snapshot-session.sh <project-slug>

# 3. Script generates:
#    - context-snapshots/session-XXX/state.json
#    - context-snapshots/session-XXX/continuation.md
#    - context-snapshots/session-XXX/metadata.json

# 4. Human starts NEW chat session

# 5. Human pastes continuation.md into new chat

# 6. Agent loads state.json and resumes work
```

### 4. Master Project Plan Framework

**Task Definition Format** (`task-definitions.yml`):

```yaml
version: "1.0"
project: "BLE DFU + LoRaWAN Integration"

tasks:
  - id: T-001
    title: "Implement BLE DFU Service"
    team: mobile
    priority: P0  # P0=critical, P1=high, P2=medium, P3=low
    estimated_hours: 8
    dependencies: [T-000]

    entry_criteria:
      - "BLE architecture design approved"
      - "Nordic DFU library integrated"
      - "Test environment setup complete"

    exit_criteria:
      - "DfuService.ts implemented with full error handling"
      - "Unit tests passing (>90% coverage)"
      - "Integration tests passing with mock BLE device"
      - "Documentation complete (JSDoc + README)"
      - "Code review approved"
      - "No TypeScript errors"

    agent_recommendation: mobile-dev
    parallel_safe: true  # Can run in parallel with other tasks

    subtasks:
      - "Research Nordic DFU protocol (Context7)"
      - "Implement DfuService.ts with TypeScript"
      - "Write unit tests (TDD)"
      - "Write integration tests"
      - "Document API and usage patterns"

    coordination_points:
      - team: backend
        type: status-update
        message: "DFU service implementation complete, ready for device testing"

  - id: T-002
    title: "Backend: Store DFU Progress in Database"
    team: backend
    priority: P1
    dependencies: [T-001]
    parallel_safe: false  # Must wait for T-001
    # ... similar structure
```

**Dependency Graph** (`dependency-graph.yml`):

```yaml
# Directed acyclic graph (DAG) of task dependencies
graph:
  T-000:
    depends_on: []
    enables: [T-001, T-002]

  T-001:
    depends_on: [T-000]
    enables: [T-003, T-004]
    parallel_with: [T-002]

  T-002:
    depends_on: [T-000]
    enables: [T-005]
    parallel_with: [T-001]
```

**Priority Matrix** (`priority-matrix.yml`):

```yaml
# Eisenhower Matrix: Urgent/Important
priorities:
  P0_critical:
    - T-001  # Blocking other work
    - T-005  # Security vulnerability

  P1_high:
    - T-002  # Important but not blocking
    - T-006  # Performance optimization

  P2_medium:
    - T-010  # Nice-to-have feature

  P3_low:
    - T-020  # Documentation improvement
```

### 5. Milestone Framework

**Milestone Template** (`milestone-XX-name.md`):

```markdown
# Milestone 02: Phase 1 Implementation

**Milestone ID**: M-02
**Status**: In Progress
**Start Date**: 2025-11-01
**Target Date**: 2025-11-15
**Owner**: Mobile & Backend Teams

## Objective

Complete BLE DFU and LoRaWAN device communication foundation with 90% test coverage.

## Entry Criteria

Before starting this milestone, the following MUST be complete:

- [ ] Milestone 01 (Setup) 100% complete
- [ ] All dependencies installed and verified
- [ ] Local development environment validated
- [ ] Cross-project coordination system operational
- [ ] Team alignment meeting completed

## Scope

**In Scope**:
- BLE DFU service implementation (T-001)
- Backend DFU progress tracking (T-002)
- LoRaWAN device registration (T-003)
- Integration tests for BLE stack (T-004)

**Out of Scope**:
- Production deployment (Milestone 04)
- Performance optimization (Milestone 03)
- Advanced error recovery (Future)

## Tasks

| Task ID | Title | Team | Priority | Status |
|---------|-------|------|----------|--------|
| T-001   | BLE DFU Service | Mobile | P0 | In Progress |
| T-002   | DFU Progress DB | Backend | P1 | Pending |
| T-003   | LoRaWAN Registration | Mobile | P0 | Pending |
| T-004   | BLE Integration Tests | Mobile | P1 | Pending |

## Exit Criteria (Done Definition)

This milestone is COMPLETE when:

### Development Phase (Local Testing)
- [ ] All tasks (T-001 to T-004) 100% complete with exit criteria met
- [ ] Integration tests passing (mobile + backend)
- [ ] Test coverage ≥90% for new code
- [ ] Zero TypeScript errors
- [ ] Code review approved by both teams
- [ ] Documentation complete and reviewed
- [ ] No P0/P1 bugs remaining
- [ ] Mobile types synchronized with local Supabase (`npm run types:check-local` passing)
- [ ] Developer testing complete on Expo dev build + local Supabase

### Preview Deployment (Stakeholder Testing)
- [ ] Backend components deployed to cloud-dev Supabase
  - [ ] Migrations applied to cloud-dev (`supabase db push --linked`)
  - [ ] Edge functions deployed to cloud-dev (if applicable)
  - [ ] RLS policies validated on cloud-dev
  - [ ] Cloud-dev database smoke tested
- [ ] Mobile types regenerated for cloud-dev (`npm run types:cloud-dev`)
- [ ] Type validation passing for cloud-dev (`npm run types:check-cloud-dev`)
- [ ] Preview build created via EAS (`eas build --profile preview`)
- [ ] Preview build distributed to stakeholders (TestFlight/Internal Testing)
- [ ] Stakeholder testing complete with feedback captured
- [ ] Critical bugs identified by stakeholders resolved

### Milestone Completion
- [ ] Human review checkpoint passed (see below)
- [ ] Context snapshot saved for next milestone
- [ ] Retrospective completed (what worked, what didn't)
- [ ] Next milestone planning initiated

## Human Review Checkpoint

**Before marking complete, human MUST review**:

1. **Local Development Demo**: Live demo of BLE DFU process on Expo dev build + local Supabase
2. **Test Results**: Review test reports and coverage (≥90%)
3. **Code Quality**: Review key implementation files
4. **Integration Status**: Verify mobile-backend coordination
5. **Preview Build Verification**:
   - Download and install preview build on test device
   - Verify app connects to cloud-dev Supabase
   - Test critical user workflows with cloud-dev data
   - Confirm no regression from previous milestone
6. **Stakeholder Feedback Review**:
   - Review feedback from stakeholders who tested preview build
   - Triage identified issues (P0/P1 must be fixed before completion)
   - Document enhancement requests for future milestones
7. **Cloud-Dev Health Check**:
   - Verify migrations applied successfully
   - Check RLS policies working correctly
   - Review cloud-dev logs for errors
8. **Risk Assessment**: Identify blockers for Milestone 03
9. **Decision Log**: Review architectural decisions made
10. **Deployment Retrospective**: What went well/poorly in deployment process

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| BLE permissions on Android 12+ | High | Research Context7 early, implement permission flow |
| DFU firmware compatibility | Medium | Test with multiple firmware versions |

## Deployment Workflow (Development → Preview)

### Phase 1: Local Development & Testing

**Mobile Team**:
```bash
# 1. Develop with local Supabase
npm start                      # Expo dev build connects to localhost:54321

# 2. Ensure types are synchronized
npm run types:check-local      # Verify alignment

# 3. Run tests
npm run test                   # Jest unit/integration tests
npm run test:maestro          # E2E tests (optional for milestone)

# 4. Commit regularly
git add . && git commit -m "feat(ble): implement DFU service"
```

**Backend Team**:
```bash
# 1. Develop with local Supabase
supabase start                 # Start local instance

# 2. Create migrations
supabase migration new add_dfu_progress_table

# 3. Apply migrations locally
supabase db reset              # Apply all migrations

# 4. Generate types
npm run types:generate         # Update database.types.ts

# 5. Commit
git add . && git commit -m "feat(db): add DFU progress tracking"
```

### Phase 2: Cloud-Dev Deployment (Pre-Preview)

**Backend Team** (Deploys First):
```bash
# 1. Link to cloud-dev project
supabase link --project-ref nuhwmubvygxyddkycmpa

# 2. Push migrations to cloud-dev
supabase db push --linked      # Apply migrations to cloud

# 3. Deploy Edge Functions (if applicable)
supabase functions deploy dfu-progress-tracker --project-ref nuhwmubvygxyddkycmpa

# 4. Verify deployment
supabase db diff --linked      # Should show "No changes"
supabase functions list        # Verify function deployed

# 5. Smoke test cloud-dev
# - Test API endpoints with Postman/curl
# - Verify RLS policies working
# - Check for errors in logs

# 6. Notify mobile team
~/dev/wildlifeai/cross-project-coordination/.scripts/send-message.sh \
  --project "ble-dfu-lorawan-integration" \
  --from "backend" \
  --to "mobile" \
  --type "deployment-ready" \
  --message "Backend deployed to cloud-dev. Migrations: add_dfu_progress_table. Mobile can regenerate types and build preview."
```

**Mobile Team** (After Backend Deployment):
```bash
# 1. Regenerate types from cloud-dev
npm run types:cloud-dev        # Generate from cloud Supabase

# 2. Verify type alignment
npm run types:check-cloud-dev  # Should pass

# 3. Full validation
npm run validate:cloud-dev     # Types + TypeScript + tests

# 4. Commit updated types
git add src/types/supabase.ts
git commit -m "chore(types): sync with cloud-dev schema"
```

### Phase 3: Preview Build Creation

**Mobile Team**:
```bash
# 1. Create preview build via EAS
eas build --profile preview --platform android

# 2. Wait for build to complete (~10-15 min)
# Build output: https://expo.dev/accounts/.../builds/...

# 3. Download APK or install via link
# Share build URL with stakeholders
```

### Phase 4: Stakeholder Testing

**Stakeholders**:
- Install preview build on test device
- Test new features (BLE DFU, LoRaWAN registration)
- Report issues via feedback form/coordination system
- Provide enhancement suggestions

**Teams**:
- Monitor feedback from stakeholders
- Triage bugs (P0/P1 must be fixed)
- Document enhancement requests for future milestones

### Phase 5: Iteration (If Needed)

If critical bugs found:
```bash
# 1. Fix bugs locally
# 2. Test locally (both teams)
# 3. Re-deploy to cloud-dev (backend)
# 4. Regenerate types (mobile)
# 5. Create new preview build
# 6. Re-test with stakeholders
```

## Communication Plan

- **Daily Standups**: Check inbox for status-update messages
- **Weekly Sync**: Human-led review on Fridays
- **Deployment Coordination**: Backend notifies mobile when cloud-dev ready
- **Stakeholder Updates**: Share preview build links and release notes
- **Blockers**: Immediate notification via coordination system

## Success Metrics

- **Velocity**: 32 estimated hours / 10 working days = 3.2 hrs/day
- **Quality**: ≥90% test coverage, 0 P0 bugs
- **Coordination**: <2 hour response time for messages
- **Context Usage**: Max 85% token usage before snapshot

---

**Next Milestone**: Milestone 03 - Integration & Performance
```

### 6. Agent Orchestration Strategy

**Safe Parallel Execution**:

1. **Dependency Check**: Read `dependency-graph.yml` before execution
2. **Parallel Batching**: Identify `parallel_safe: true` tasks with no shared files
3. **File Conflict Detection**: Check `file_states` in session state
4. **Sequential Fallback**: If conflict risk, execute sequentially

**Agent Assignment**:

```yaml
# In task-definitions.yml
agent_recommendation: mobile-dev  # Preferred agent
agent_fallback: coder             # If specialized agent unavailable
```

**Full Context Provision**:

```markdown
# Agent receives:
1. Task definition (entry/exit criteria, subtasks)
2. Project README (context)
3. Shared docs (API contracts, data models)
4. Dependency task outputs (if applicable)
5. Relevant code files (identified by grep/glob)
6. Test requirements (from testing-standards.md)
```

**Communication Protocol**:

```bash
# Agent → Coordination System
# After task completion, agent sends status-update:
~/dev/wildlifeai/cross-project-coordination/.scripts/send-message.sh \
  --project "ble-dfu-lorawan-integration" \
  --from "mobile" \
  --to "backend" \
  --type "status-update" \
  --task "T-001" \
  --status "complete" \
  --message "DFU service complete, ready for backend integration"
```

### 7. Control Modes

#### Auto Mode (Default)

```bash
# Start dynamic monitoring
~/dev/wildlifeai/cross-project-coordination/.scripts/watch-project.sh start <project-slug>

# File watcher detects changes in inbox/shared-docs
# → Triggers agent notification
# → Cross-project-coordinator agent checks inbox
# → Agent actions message (e.g., schema-change → regenerate types)
# → Agent sends confirmation
```

#### Manual Mode

```bash
# Switch to manual mode
~/dev/wildlifeai/cross-project-coordination/.scripts/watch-project.sh mode manual <project-slug>

# Human manually notifies:
~/dev/wildlifeai/cross-project-coordination/.scripts/notify-project.sh \
  <project-slug> \
  "New message from backend: schema-change for device_sessions table"

# Agent checks inbox on next interaction
```

**Mode Switching**:
```bash
# Auto → Manual
watch-project.sh mode manual <project-slug>

# Manual → Auto
watch-project.sh mode auto <project-slug>

# Check current mode
watch-project.sh status <project-slug>
```

## Implementation Phases

### Phase 1: Core Infrastructure (2 hours)

1. Create project folder structure template
2. Build project initialization script
3. Create configuration file templates
4. Document usage patterns

### Phase 2: Context Window Management (3 hours)

1. Implement token counting script
2. Build session state serialization
3. Create continuation prompt generator
4. Test session recovery workflow

### Phase 3: Dynamic Monitoring (2 hours)

1. Implement file watcher script
2. Build notification system
3. Create mode switching commands
4. Test auto/manual modes

### Phase 4: Master Project Plan Tools (2 hours)

1. Create task definition templates
2. Build dependency graph validator
3. Implement priority matrix system
4. Document task lifecycle

### Phase 5: Milestone Framework (1 hour)

1. Create milestone templates
2. Document entry/exit criteria patterns
3. Build human review checklist
4. Test milestone workflow

### Phase 6: Agent Integration (2 hours)

1. Update cross-project-coordinator agent
2. Add project-specific agent hooks
3. Test agent notification system
4. Document agent coordination patterns

### Phase 7: Testing & Documentation (2 hours)

1. End-to-end test with mock project
2. Create quick start guide
3. Document troubleshooting patterns
4. Create video walkthrough

**Total Estimated Time**: 14 hours

## Usage Workflow

### 1. Project Initialization

```bash
# Initialize new coordinated project
~/dev/wildlifeai/cross-project-coordination/.scripts/init-project.sh \
  --slug "ble-dfu-lorawan-integration" \
  --title "BLE DFU + LoRaWAN Integration" \
  --teams "mobile,backend" \
  --mode "auto"

# Creates:
# - projects/ble-dfu-lorawan-integration/
# - All subfolders and templates
# - Initial .watch-config.yml
# - PROJECT-README.md
```

### 2. Define Master Plan

```bash
cd ~/dev/wildlifeai/cross-project-coordination/projects/ble-dfu-lorawan-integration/

# Edit master-plan/task-definitions.yml (define all tasks)
# Edit master-plan/dependency-graph.yml (define dependencies)
# Edit master-plan/priority-matrix.yml (prioritize tasks)
# Edit milestones/milestone-*.md (define milestones)
```

### 3. Start Dynamic Monitoring

```bash
# Start file watcher (auto mode)
~/dev/wildlifeai/cross-project-coordination/.scripts/watch-project.sh start ble-dfu-lorawan-integration

# Watcher runs in background, monitors inbox/shared-docs
```

### 4. Execute Tasks

```bash
# In mobile app repo
/aadf-work-smart "Execute tasks from ble-dfu-lorawan-integration project. Load master plan from ~/dev/wildlifeai/cross-project-coordination/projects/ble-dfu-lorawan-integration/master-plan/. Start with Milestone 01, execute tasks in dependency order with parallel execution where safe."

# Agent:
# 1. Reads master-plan/task-definitions.yml
# 2. Checks dependency-graph.yml
# 3. Identifies parallel-safe tasks
# 4. Spawns specialized agents with full context
# 5. Monitors context window usage
# 6. Sends coordination messages as needed
# 7. Updates task status in session state
```

### 5. Monitor Context Window

```bash
# Check current context usage
~/dev/wildlifeai/cross-project-coordination/.scripts/check-context.sh

# Output:
# Context Usage: 165,000 / 200,000 tokens (82.5%)
# Status: 🟡 Yellow Zone - Prepare for snapshot

# When reaching 85%, auto-snapshot triggers:
# ✅ Snapshot saved: context-snapshots/session-003/
```

### 6. Milestone Review

```bash
# Human triggers milestone review
# 1. Check milestones/milestone-02-phase1.md
# 2. Verify all exit criteria met
# 3. Review test results, code quality
# 4. Demo functionality
# 5. Discuss risks and blockers
# 6. Decide: Proceed to Milestone 03 or iterate
```

### 7. Session Continuation

```bash
# If context window full (85%+):
# 1. Auto-snapshot triggers
# 2. Human opens NEW chat
# 3. Human pastes continuation.md
# 4. Agent resumes from state.json

# New chat:
[Paste continuation.md from context-snapshots/session-003/continuation.md]

# Agent loads state and continues work seamlessly
```

## Key Benefits

1. **Structured Coordination**: Clear communication channels and protocols
2. **Context Continuity**: Never lose progress due to token limits
3. **Milestone Clarity**: Well-defined entry/exit criteria with human checkpoints
4. **Safe Parallelism**: Dependency-aware task execution
5. **Automatic Monitoring**: File watchers + agent notifications
6. **Flexible Control**: Auto/manual mode switching
7. **Human Oversight**: Built-in review checkpoints at milestones

## Next Steps

1. **Review this design** with human for approval
2. **Implement Phase 1** (Core Infrastructure)
3. **Test with mock project** (simple 3-task scenario)
4. **Iterate based on findings**
5. **Apply to real project** (BLE DFU + LoRaWAN)

---

**Status**: Awaiting human review and approval to proceed with implementation.
