# Dynamic Cross-Project Coordination System - Summary

**Version**: 1.0.0
**Status**: Design Complete, Ready for Implementation
**Created**: 2025-10-31

## What This System Provides

A **comprehensive coordination framework** for large-scale cross-team projects with:

1. ✅ **Dynamic project folders** in shared hub with team-specific inboxes
2. ✅ **Context window monitoring** with automatic session snapshots
3. ✅ **Milestone-based execution** with entry/exit criteria
4. ✅ **Development → Preview → Stakeholder testing** workflow
5. ✅ **Auto/manual file watching** with agent notifications
6. ✅ **Master project plans** with task dependencies and parallel execution
7. ✅ **Session recovery system** for seamless continuation across chats

## Key Design Decisions

### 1. Three-Phase Deployment Workflow

**Phase 1: Local Development**
- Developer works with Expo dev build + local Supabase
- Both teams iterate rapidly with local testing
- Types synchronized via `npm run types:check-local`

**Phase 2: Cloud-Dev Deployment**
- Backend deploys migrations and Edge Functions to cloud-dev
- Backend notifies mobile team via coordination system
- Mobile regenerates types from cloud-dev: `npm run types:cloud-dev`

**Phase 3: Preview Build & Stakeholder Testing**
- Mobile creates preview build: `eas build --profile preview`
- Stakeholders test new features on real devices
- Teams triage feedback and fix critical bugs

### 2. Enhanced Milestone Exit Criteria

Milestones now have **three checkpoint stages**:

1. **Development Phase** (Local Testing)
   - All tasks complete with tests passing
   - Code review approved
   - Types synchronized with local Supabase

2. **Preview Deployment** (Stakeholder Testing)
   - Backend deployed to cloud-dev
   - Mobile types regenerated for cloud-dev
   - Preview build created and distributed
   - Stakeholder testing complete with feedback captured

3. **Milestone Completion**
   - Human review checkpoint passed
   - Context snapshot saved
   - Retrospective completed

### 3. Context Window Management

**Problem Solved**: Large projects exceed 200k token limit

**Solution**: Automated state serialization with continuation prompts

**Warning Levels**:
- 🟢 **Green Zone** (0-80%): Normal operation
- 🟡 **Yellow Zone** (80-85%): Warning, prepare for snapshot
- 🟠 **Orange Zone** (85-90%): Auto-snapshot triggered
- 🔴 **Red Zone** (90-100%): Immediate session switch

**Recovery Process**:
1. Auto-snapshot at 85% token usage
2. Generate continuation prompt with full context
3. Human starts new chat
4. Paste continuation prompt → agent resumes seamlessly

### 4. Dynamic File Watching

**Auto Mode** (Default):
- Background process monitors inbox folders
- Detects new messages, modifications, deletions
- Triggers cross-project-coordinator agent notifications
- 30-second polling interval

**Manual Mode**:
- Human manually notifies: `notify-project.sh <project> <message-type>`
- Useful for controlled coordination or debugging
- Switch modes: `watch-project.sh mode manual <project>`

### 5. Message Types

**Extended message types** for coordination:

- `schema-change` - Backend schema changed, regenerate types
- `deployment-ready` - Backend deployed to cloud-dev, mobile can build preview
- `task-request` - Request implementation from other team
- `status-update` - Task completion or progress update
- `stakeholder-feedback` - Issues/enhancements from stakeholders
- `generic-message` - General coordination

## Project Folder Structure

```
~/dev/wildlifeai/cross-project-coordination/
└── projects/
    └── <project-slug>/                    # e.g., "ble-dfu-lorawan-integration"
        ├── inbox/
        │   ├── backend-to-mobile/         # Dynamic inbox (watched)
        │   └── mobile-to-backend/         # Dynamic inbox (watched)
        ├── shared-docs/                   # Living documents both teams edit
        │   ├── architecture-decisions.md
        │   ├── api-contracts.yml
        │   ├── data-models.yml
        │   └── integration-points.md
        ├── master-plan/
        │   ├── project-plan.md
        │   ├── task-definitions.yml       # All tasks with metadata
        │   ├── dependency-graph.yml       # Task dependencies (DAG)
        │   └── priority-matrix.yml        # P0-P3 prioritization
        ├── milestones/
        │   ├── milestone-01-setup.md
        │   ├── milestone-02-phase1.md
        │   ├── milestone-03-integration.md
        │   └── milestone-04-production.md
        ├── context-snapshots/             # Session recovery system
        │   ├── session-001/
        │   │   ├── state.json             # Serialized state
        │   │   ├── continuation.md        # Continuation prompt
        │   │   └── metadata.json
        │   └── active-session.json
        ├── archive/
        │   └── YYYY-MM/
        ├── .watch-config.yml              # File watch configuration
        ├── .project-config.yml            # Project configuration
        └── PROJECT-README.md
```

## Task Definition Example

```yaml
tasks:
  - id: T-001
    title: "Implement BLE DFU Service"
    team: mobile
    priority: P0
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

    deployment_criteria:
      - "Local testing complete on Expo dev build"
      - "Preview build tested by stakeholder"
      - "No P0 bugs identified"

    agent_recommendation: mobile-dev
    parallel_safe: true

    subtasks:
      - "Research Nordic DFU protocol (Context7)"
      - "Implement DfuService.ts"
      - "Write unit tests (TDD)"
      - "Write integration tests"
      - "Document API"

    coordination_points:
      - team: backend
        type: deployment-ready
        message: "DFU service complete, deployed to cloud-dev, ready for preview build"
```

## Usage Workflow

### 1. Initialize Project

```bash
~/dev/wildlifeai/cross-project-coordination/.scripts/init-project.sh \
  --slug "ble-dfu-lorawan-integration" \
  --title "BLE DFU + LoRaWAN Integration" \
  --teams "mobile,backend" \
  --mode "auto"
```

### 2. Define Master Plan

Edit the following files in the project folder:
- `master-plan/task-definitions.yml` - Define all tasks with criteria
- `master-plan/dependency-graph.yml` - Define task dependencies
- `master-plan/priority-matrix.yml` - Prioritize tasks (P0-P3)
- `milestones/milestone-*.md` - Define milestones with deployment workflow

### 3. Start Dynamic Monitoring

```bash
~/dev/wildlifeai/cross-project-coordination/.scripts/watch-project.sh \
  start ble-dfu-lorawan-integration

# Watcher runs in background, monitors inbox/shared-docs
```

### 4. Execute Tasks (Mobile Team)

```bash
# In mobile app repo
/aadf-work-smart "Execute tasks from ble-dfu-lorawan-integration project. Load master plan from ~/dev/wildlifeai/cross-project-coordination/projects/ble-dfu-lorawan-integration/master-plan/. Start with Milestone 01, execute tasks in dependency order with parallel execution where safe."
```

### 5. Local Development & Testing

**Mobile**:
```bash
npm start                      # Expo dev build + local Supabase
npm run types:check-local      # Verify type alignment
npm run test                   # Run tests
git commit -m "feat(ble): implement DFU service"
```

**Backend**:
```bash
supabase start                 # Local Supabase
supabase migration new add_dfu_progress
supabase db reset              # Apply migrations
git commit -m "feat(db): add DFU progress tracking"
```

### 6. Deploy to Cloud-Dev (Backend First)

```bash
# Backend deploys
supabase link --project-ref nuhwmubvygxyddkycmpa
supabase db push --linked

# Backend notifies mobile
~/dev/wildlifeai/cross-project-coordination/.scripts/send-message.sh \
  --project "ble-dfu-lorawan-integration" \
  --from "backend" \
  --to "mobile" \
  --type "deployment-ready" \
  --message "Backend deployed to cloud-dev. Mobile can build preview."
```

### 7. Regenerate Types & Build Preview (Mobile)

```bash
# Mobile receives notification (auto mode)
# or checks inbox manually

npm run types:cloud-dev        # Regenerate from cloud-dev
npm run types:check-cloud-dev  # Verify alignment
eas build --profile preview    # Create preview build
```

### 8. Stakeholder Testing

- Distribute preview build to stakeholders
- Collect feedback via coordination system
- Triage bugs (P0/P1 must be fixed)
- Iterate if needed

### 9. Milestone Review

Human reviews:
- Local development demo
- Test results (≥90% coverage)
- Preview build verification
- Stakeholder feedback
- Cloud-dev health check
- Risk assessment

### 10. Context Snapshot (If Needed)

```bash
# When context reaches 85%:
~/dev/wildlifeai/cross-project-coordination/.scripts/snapshot-session.sh \
  ble-dfu-lorawan-integration

# Generates:
# - context-snapshots/session-003/state.json
# - context-snapshots/session-003/continuation.md

# Start new chat, paste continuation.md
# Agent resumes from state.json
```

## Implementation Status

**✅ Design Complete**:
- Project folder structure defined
- Milestone framework with deployment workflow
- Context window management strategy
- Dynamic file watching architecture
- Message types and coordination protocols

**⏳ Pending Implementation**:
1. Create initialization script (`init-project.sh`)
2. Build file watcher (`watch-project.sh`)
3. Implement context monitoring (`monitor-context.sh`)
4. Create session snapshot script (`snapshot-session.sh`)
5. Build notification system (`notify-project.sh`)
6. Create message sender (`send-message.sh`)
7. Update cross-project-coordinator agent
8. Create templates (task-definitions.yml, milestone.md, etc.)
9. Write usage documentation
10. End-to-end testing with mock project

**Estimated Implementation Time**: 14 hours

## Next Steps

1. **Human Review**: Review this design and approve to proceed
2. **Phase 1 Implementation** (2 hours): Core infrastructure and templates
3. **Phase 2 Testing** (1 hour): Mock project walkthrough
4. **Phase 3 Application** (2 hours): Apply to BLE DFU + LoRaWAN project
5. **Phase 4 Refinement**: Iterate based on real-world usage

## Questions for Human

Before proceeding with implementation:

1. **Approval**: Does this design meet your requirements?
2. **Priority**: Which phase should we implement first?
3. **Testing**: Should we test with a simple mock project first?
4. **Scope**: Are there any additional features needed?
5. **Timeline**: When do you need this system operational?

---

**Status**: ✅ Design complete, awaiting approval to proceed with implementation.
