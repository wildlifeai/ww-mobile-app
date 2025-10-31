# Dynamic Cross-Project Coordination System - Complete Guide

**Version**: 1.0.0
**Status**: ✅ Production-Ready
**Last Updated**: 2025-11-01

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Core Components](#core-components)
4. [Quick Start Guide](#quick-start-guide)
5. [Complete Workflow Example](#complete-workflow-example)
6. [Script Reference](#script-reference)
7. [Template Reference](#template-reference)
8. [Message Types & Workflows](#message-types--workflows)
9. [Deployment Workflow](#deployment-workflow)
10. [Troubleshooting](#troubleshooting)
11. [Advanced Topics](#advanced-topics)
12. [Appendix](#appendix)

---

## Executive Summary

### What Is This?

The **Dynamic Cross-Project Coordination System** is a comprehensive framework for managing large-scale coordinated projects between backend and mobile teams. It provides:

- **Project Isolation**: Each coordinated project has its own dedicated folder with inboxes, templates, milestones
- **Task Orchestration**: Master plans with task dependencies, priorities, and parallel execution support
- **Milestone-Based Workflow**: Clear progression through Local → Cloud-Dev → Preview → Stakeholder testing
- **Automated Coordination**: Bidirectional messaging system with file watching capabilities
- **Session Recovery**: Continue work across context window limits (future enhancement)

### Why It Was Created

**Problem Solved**:
- Ad-hoc coordination messages scattered across Slack/Email
- Schema changes causing mobile type drift (frequent incidents)
- Unclear deployment dependencies between teams
- Loss of context when switching chat sessions
- No systematic approach to large coordinated projects

**Solution Delivered**:
- Centralized coordination hub (`~/dev/wildlifeai/cross-project-coordination/`)
- Structured message types (schema-change, deployment-ready, task-request, etc.)
- Template-driven project planning (task definitions, dependencies, milestones)
- Automated notifications via file watchers (optional)
- Project-specific inboxes for team isolation

### Key Benefits

1. **Reduced Coordination Overhead**: Structured messaging vs ad-hoc Slack
2. **Fewer Type Drift Incidents**: Explicit deployment-ready notifications
3. **Clear Task Dependencies**: Visual dependency graphs (DAG)
4. **Human Review Checkpoints**: Built into milestone templates
5. **Failure Isolation**: Per-project architecture (one project issue doesn't block others)
6. **Scalability**: Supports multiple concurrent coordinated projects

### When to Use It

**Decision Criteria** - Use this system when a project has:

✅ **3+ coordinated tasks** across mobile and backend teams
✅ **Milestone-based execution** with human review checkpoints
✅ **Cloud-dev deployment coordination** requirements
✅ **Task dependencies** requiring careful sequencing
✅ **Risk of exceeding 200k context window** (complex projects)

**Example Use Cases**:
- Hardware integration projects (BLE DFU + LoRaWAN)
- Major feature rollouts (new authentication system with RLS + mobile UI)
- API redesigns (RESTful → GraphQL migration)
- Performance initiatives (database optimization + mobile query updates)
- Security enhancements (end-to-end encryption across stack)
- Third-party integrations (payment gateway + mobile UI)
- Multi-tenant features (organization isolation + org switching UI)

---

## System Overview

### Architecture

```
~/dev/wildlifeai/cross-project-coordination/
├── .scripts/                          # 6 coordination scripts
│   ├── init-project.sh                # Initialize new project
│   ├── send-message.sh                # Send team messages
│   ├── check-inbox.sh                 # Check inbox for messages
│   ├── watch-project.sh               # Per-project file watcher
│   ├── watch-all-projects.sh          # Multi-project watcher
│   └── check-notifications.sh         # Notification system
│
├── .templates/                        # 10 project templates
│   ├── task-definitions.yml           # Task metadata & criteria
│   ├── dependency-graph.yml           # Task dependencies (DAG)
│   ├── priority-matrix.yml            # P0-P3 prioritization
│   ├── milestone-template.md          # Milestone structure
│   ├── deployment-checklist.md        # 5-phase deployment
│   ├── stakeholder-feedback-template.md
│   ├── PROJECT-README.md              # Project overview
│   ├── PROJECT-STATUS.md              # Status tracking
│   ├── .watch-config.yml              # Watcher configuration
│   └── .gitignore                     # Sensitive file protection
│
└── projects/                          # Active coordinated projects
    └── <project-slug>/                # e.g., "ble-dfu-lorawan"
        ├── inbox/
        │   ├── backend-to-mobile/     # Backend sends, mobile reads
        │   └── mobile-to-backend/     # Mobile sends, backend reads
        ├── shared-docs/               # Living docs both teams edit
        ├── master-plan/               # Task definitions & dependencies
        ├── milestones/                # Milestone tracking
        ├── context-snapshots/         # Session recovery (future)
        ├── archive/                   # Completed items
        ├── .watch-config.yml          # Project watcher config
        └── PROJECT-README.md          # Project overview
```

### Components and Their Roles

**Coordination Scripts** (6 files):
- `init-project.sh`: Bootstraps new project with folder structure + templates
- `send-message.sh`: Creates timestamped messages in appropriate inbox
- `check-inbox.sh`: Lists unread messages for a team
- `watch-project.sh`: Monitors single project for file changes
- `watch-all-projects.sh`: Centralized watcher for all projects
- `check-notifications.sh`: Checks notification queue

**Templates** (10 files):
- YAML templates: Task definitions, dependencies, priorities, watch config
- Markdown templates: Milestones, deployment checklists, feedback forms
- Project templates: README, STATUS, .gitignore

**Project Folders**:
- Each coordinated project gets isolated folder
- Team-specific inboxes prevent message confusion
- Shared docs for collaborative editing (API contracts, data models)
- Master plan for task orchestration

### Integration Points

**With Type Synchronization System**:
- Backend sends `schema-change` message → Mobile runs `npm run types:local`
- Backend sends `deployment-ready` message → Mobile runs `npm run types:cloud-dev` + builds preview

**With GitHub Workflows**:
- Backend GitHub Actions can auto-send `deployment-ready` on successful cloud-dev deploy (future)

**With Development Workflow**:
- Local Development → Cloud-Dev Deployment → Preview Build → Stakeholder Testing
- Clear handoff points with explicit notifications

---

## Core Components

### 1. Coordination Scripts (6 files)

#### `init-project.sh` (689 lines)

**Purpose**: Initialize new coordinated project

**Usage**:
```bash
./init-project.sh \
  --slug "project-slug" \
  --title "Project Title" \
  --teams "mobile,backend"
```

**What it does**:
- Creates project folder structure
- Copies all 10 templates
- Sets up team inboxes
- Creates initial README and STATUS files
- Configures file watcher (optional)

**Options**:
- `--slug`: URL-friendly project identifier (required)
- `--title`: Human-readable project name (required)
- `--teams`: Comma-separated team list (required)
- `--mode`: auto|manual (default: auto)

#### `send-message.sh` (282 lines)

**Purpose**: Send coordination message to another team

**Usage**:
```bash
./send-message.sh \
  --project "project-slug" \
  --from "mobile" \
  --to "backend" \
  --type "deployment-ready" \
  --message "Backend deployed to cloud-dev. Migration: add_table. Mobile can regenerate types."
```

**Message Types**:
1. `schema-change` - Backend schema changed, mobile must regenerate types
2. `deployment-ready` - Backend deployed to cloud-dev, mobile can build preview
3. `task-request` - Request implementation from other team
4. `status-update` - Task completion or progress update
5. `stakeholder-feedback` - Issues/enhancements from stakeholders
6. `generic-message` - General coordination

**Output**: Timestamped markdown file in recipient's inbox

#### `check-inbox.sh` (184 lines)

**Purpose**: Check inbox for unread messages

**Usage**:
```bash
./check-inbox.sh --project "project-slug" --team "mobile"
```

**Output**:
- Lists all messages with timestamp, type, sender, status
- Shows message preview (first 100 chars)
- Provides file path for full message

#### `watch-project.sh` (298 lines)

**Purpose**: Monitor single project for file changes

**Usage**:
```bash
./watch-project.sh start <project-slug>   # Start watching
./watch-project.sh stop <project-slug>    # Stop watching
./watch-project.sh status <project-slug>  # Check status
```

**Features**:
- Uses `inotifywait` for file system monitoring
- Watches inbox folders and shared-docs
- Creates notifications on changes
- Runs in background (nohup)

#### `watch-all-projects.sh` (277 lines)

**Purpose**: Centralized watcher for all projects

**Usage**:
```bash
./watch-all-projects.sh start   # Watch all projects
./watch-all-projects.sh stop    # Stop all watchers
./watch-all-projects.sh status  # Show watching status
```

**Features**:
- Single process monitors multiple projects
- Auto-detects new projects
- Routes notifications to correct team
- Failure isolation (one project's issues don't affect others)

#### `check-notifications.sh` (197 lines)

**Purpose**: Check notification queue

**Usage**:
```bash
./check-notifications.sh mobile   # Check mobile team notifications
./check-notifications.sh backend  # Check backend team notifications
```

---

### 2. Templates (10 files)

#### `task-definitions.yml` (138 lines)

**Purpose**: Define all project tasks with metadata

**Structure**:
```yaml
version: "1.0"
project: "Project Name"

tasks:
  - id: T-001
    title: "Task Title"
    team: mobile|backend
    priority: P0|P1|P2|P3
    estimated_hours: 8
    dependencies: [T-000]

    entry_criteria:
      - "Prerequisite 1"
      - "Prerequisite 2"

    exit_criteria:
      - "Deliverable 1"
      - "Tests passing"

    deployment_criteria:
      - "Cloud-dev deployed"
      - "Preview build tested"

    agent_recommendation: mobile-dev
    parallel_safe: true|false
```

**Key Fields**:
- **entry_criteria**: What must be true before starting
- **exit_criteria**: What must be delivered (local testing)
- **deployment_criteria**: What must be validated (cloud-dev + preview)
- **parallel_safe**: Can this task run in parallel with others?

#### `dependency-graph.yml` (85 lines)

**Purpose**: Define task dependencies (DAG)

**Structure**:
```yaml
graph:
  T-000:
    depends_on: []
    enables: [T-001, T-002]

  T-001:
    depends_on: [T-000]
    enables: [T-003]
    parallel_with: [T-002]
```

**Usage**: Prevents circular dependencies, identifies parallel execution opportunities

#### `priority-matrix.yml` (78 lines)

**Purpose**: Eisenhower Matrix (P0-P3)

**Structure**:
```yaml
priorities:
  P0_critical:      # Urgent + Important (blocking)
    - T-001
  P1_high:          # Important (not blocking)
    - T-002
  P2_medium:        # Nice-to-have
    - T-003
  P3_low:           # Documentation, cleanup
    - T-004
```

#### `milestone-template.md` (561 lines)

**Purpose**: Comprehensive milestone structure

**Sections**:
1. Objective & Scope
2. Entry Criteria (prerequisites)
3. Tasks Table
4. Exit Criteria (3-phase):
   - Development Phase (local testing)
   - Preview Deployment (cloud-dev + stakeholder)
   - Milestone Completion (human review)
5. Human Review Checkpoint (10-point checklist)
6. Deployment Workflow (5 phases)
7. Risks & Mitigations
8. Communication Plan
9. Success Metrics

#### `deployment-checklist.md` (283 lines)

**Purpose**: 5-phase deployment validation

**Phases**:
1. **Local Development**: Both teams develop with local Supabase
2. **Cloud-Dev Deployment**: Backend deploys, notifies mobile
3. **Preview Build**: Mobile regenerates types, builds preview
4. **Stakeholder Testing**: Distribute build, collect feedback
5. **Iteration**: Fix bugs, re-deploy if needed

#### `stakeholder-feedback-template.md` (269 lines)

**Purpose**: Structured feedback collection

**Sections**:
- Build information
- Tested scenarios
- Issues found (P0/P1/P2)
- Enhancement requests
- Overall feedback

#### `PROJECT-README.md` (106 lines)

**Purpose**: Project overview and quick links

#### `PROJECT-STATUS.md` (161 lines)

**Purpose**: Current status snapshot (backend request)

**Sections**:
- Overall progress (%)
- Active tasks
- Completed tasks
- Blockers
- Next milestones

#### `.watch-config.yml` (60 lines)

**Purpose**: File watcher configuration

```yaml
version: "1.0"
mode: auto  # auto | manual
watch_paths:
  - inbox/backend-to-mobile/
  - inbox/mobile-to-backend/
  - shared-docs/
poll_interval: 30  # seconds
notification_method: agent  # agent | webhook | file
```

#### `.gitignore` (53 lines)

**Purpose**: Prevent committing sensitive files (backend request)

---

## Quick Start Guide

### Step 1: Initialize Project (2 minutes)

```bash
# Navigate to coordination root
cd ~/dev/wildlifeai/cross-project-coordination

# Initialize new project
./.scripts/init-project.sh \
  --slug "ble-dfu-lorawan-integration" \
  --title "BLE DFU + LoRaWAN Integration" \
  --teams "mobile,backend"
```

**Result**: Project folder created at `projects/ble-dfu-lorawan-integration/` with all templates

### Step 2: Define Tasks (10 minutes)

```bash
# Navigate to project
cd projects/ble-dfu-lorawan-integration/

# Edit task definitions
nano master-plan/task-definitions.yml
```

Add your tasks using the template structure (see Template Reference above).

### Step 3: Define Dependencies (5 minutes)

```bash
# Edit dependency graph
nano master-plan/dependency-graph.yml
```

Map out which tasks depend on others and which can run in parallel.

### Step 4: Create Milestones (10 minutes)

```bash
# Copy milestone template
cp milestones/milestone-template.md milestones/milestone-01-setup.md

# Edit milestone
nano milestones/milestone-01-setup.md
```

Define entry/exit criteria and deployment workflow.

### Step 5: Start Coordination (ongoing)

**Backend sends message after cloud-dev deployment**:
```bash
cd ~/dev/wildlifeai/cross-project-coordination

./.scripts/send-message.sh \
  --project "ble-dfu-lorawan-integration" \
  --from "backend" \
  --to "mobile" \
  --type "deployment-ready" \
  --message "Backend deployed to cloud-dev. Migration: add_dfu_progress_table. Mobile can regenerate types and build preview."
```

**Mobile checks inbox**:
```bash
./.scripts/check-inbox.sh \
  --project "ble-dfu-lorawan-integration" \
  --team "mobile"
```

**Mobile actions message**:
```bash
# Regenerate types from cloud-dev
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:cloud-dev

# Build preview
eas build --profile preview
```

**Mobile confirms**:
```bash
cd ~/dev/wildlifeai/cross-project-coordination

./.scripts/send-message.sh \
  --project "ble-dfu-lorawan-integration" \
  --from "mobile" \
  --to "backend" \
  --type "status-update" \
  --message "Preview build complete. Build ID: abc123. Distributed to stakeholders for testing."
```

---

## Complete Workflow Example

### Scenario: BLE DFU + LoRaWAN Integration

**Project Goal**: Integrate BLE Device Firmware Update (DFU) and LoRaWAN device registration into Wildlife Watcher mobile app.

**Teams Involved**: Mobile, Backend
**Duration**: 2 weeks
**Tasks**: 5 (3 mobile, 2 backend)

### Week 1: Setup & Development

#### Day 1: Project Initialization

**Mobile Team**:
```bash
# Initialize project
cd ~/dev/wildlifeai/cross-project-coordination
./.scripts/init-project.sh \
  --slug "ble-dfu-lorawan-integration" \
  --title "BLE DFU + LoRaWAN Integration" \
  --teams "mobile,backend"

# Define tasks
cd projects/ble-dfu-lorawan-integration/
# Edit master-plan/task-definitions.yml
# Edit master-plan/dependency-graph.yml
# Edit master-plan/priority-matrix.yml
```

**Tasks Defined**:
- T-000: Setup & Architecture (both teams, P0, Day 1)
- T-001: Implement BLE DFU Service (mobile, P0, Days 2-4)
- T-002: Store DFU Progress in Database (backend, P1, Days 2-3)
- T-003: Implement LoRaWAN Registration (mobile, P0, Days 5-6)
- T-004: Create DFU Progress Dashboard (mobile, P2, Days 7-8)

**Dependencies**:
```yaml
graph:
  T-000:
    depends_on: []
    enables: [T-001, T-002]

  T-001:
    depends_on: [T-000]
    enables: [T-004]
    parallel_with: [T-002, T-003]

  T-002:
    depends_on: [T-000]
    enables: [T-004]
    parallel_with: [T-001, T-003]

  T-003:
    depends_on: [T-000]
    enables: []
    parallel_with: [T-001, T-002]

  T-004:
    depends_on: [T-001, T-002]
    enables: []
```

#### Day 1-2: Backend Defines Data Models

**Backend Team**:
```bash
# Create shared data model
cd ~/dev/wildlifeai/cross-project-coordination/projects/ble-dfu-lorawan-integration/
nano shared-docs/data-models.yml
```

**Data Model**:
```yaml
dfu_progress:
  id: uuid (primary key)
  session_id: uuid (references dfu_sessions)
  device_id: uuid (references devices)
  progress_pct: integer (0-100)
  status: enum (pending, in_progress, complete, failed)
  firmware_version: text
  created_at: timestamp
  updated_at: timestamp
```

**Backend sends API contract**:
```bash
cd ~/dev/wildlifeai/cross-project-coordination
./.scripts/send-message.sh \
  --project "ble-dfu-lorawan-integration" \
  --from "backend" \
  --to "mobile" \
  --type "generic-message" \
  --message "Data model defined in shared-docs/data-models.yml. Review before T-001 implementation."
```

#### Day 2-4: Mobile Implements BLE DFU Service (T-001)

**Mobile Team**:
```bash
# Check inbox
./.scripts/check-inbox.sh --project "ble-dfu-lorawan-integration" --team "mobile"

# Read data model
cat ~/dev/wildlifeai/cross-project-coordination/projects/ble-dfu-lorawan-integration/shared-docs/data-models.yml

# Implement DfuService.ts
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
# ... implementation work ...

# Local testing with mock backend
npm test -- DfuService
```

#### Day 3: Backend Creates Migration (T-002)

**Backend Team**:
```bash
cd ~/dev/wildlifeai/wildlife-watcher-backend

# Create migration
supabase migration new add_dfu_progress_table

# Apply locally
supabase db reset

# Regenerate types
npm run types:generate

# Commit
git add . && git commit -m "feat(db): add DFU progress tracking"
```

#### Day 3: Backend Deploys to Cloud-Dev

**Backend Team**:
```bash
# Deploy to cloud-dev
supabase link --project-ref nuhwmubvygxyddkycmpa
supabase db push --linked

# Verify deployment
supabase db diff --linked  # Should show "No changes"

# Send deployment-ready message
cd ~/dev/wildlifeai/cross-project-coordination
./.scripts/send-message.sh \
  --project "ble-dfu-lorawan-integration" \
  --from "backend" \
  --to "mobile" \
  --type "deployment-ready" \
  --message "Backend deployed to cloud-dev. Migration: add_dfu_progress_table (adds dfu_progress table with RLS policies). Mobile can regenerate types and test integration."
```

#### Day 4: Mobile Regenerates Types & Integrates

**Mobile Team**:
```bash
# Check inbox
./.scripts/check-inbox.sh --project "ble-dfu-lorawan-integration" --team "mobile"

# Regenerate types from cloud-dev
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:cloud-dev

# Commit types
git add src/types/supabase.ts
git commit -m "chore(types): sync with cloud-dev schema (dfu_progress)"

# Update DfuService to use real types
# ... code changes ...

# Test against cloud-dev (optional)
# Settings → Developer Settings → Cloud Development → Apply & Restart
```

### Week 2: Preview Build & Stakeholder Testing

#### Day 8: Mobile Completes All Tasks

**Mobile Team**:
```bash
# Verify all exit criteria met
# - T-001: BLE DFU Service (complete)
# - T-003: LoRaWAN Registration (complete)
# - T-004: DFU Progress Dashboard (complete)

# Send status update
cd ~/dev/wildlifeai/cross-project-coordination
./.scripts/send-message.sh \
  --project "ble-dfu-lorawan-integration" \
  --from "mobile" \
  --to "backend" \
  --type "status-update" \
  --message "All mobile tasks complete. Ready for preview build creation. Local testing passed (90% coverage, 0 P0 bugs)."
```

#### Day 9: Create Preview Build

**Mobile Team**:
```bash
# Final type sync
npm run types:check-cloud-dev  # Should pass
npm run validate:cloud-dev     # Types + TypeScript + tests

# Create preview build
eas build --profile preview --platform android

# Wait for build (~15 min)

# Distribute build
# Build URL: https://expo.dev/accounts/.../builds/...
```

**Mobile sends build notification**:
```bash
cd ~/dev/wildlifeai/cross-project-coordination
./.scripts/send-message.sh \
  --project "ble-dfu-lorawan-integration" \
  --from "mobile" \
  --to "backend" \
  --type "stakeholder-feedback" \
  --message "Preview build ready. URL: https://expo.dev/.../builds/abc123. Please test: 1) BLE DFU workflow, 2) LoRaWAN registration, 3) DFU progress dashboard. Report issues using stakeholder-feedback-template.md."
```

#### Day 10-12: Stakeholder Testing

**Stakeholders Test**:
- Install preview build
- Test BLE DFU workflow
- Test LoRaWAN registration
- Report issues

**Example Feedback**:
```markdown
# Stakeholder Feedback

**Tester**: John Doe
**Date**: 2025-11-15
**Build**: abc123

## Issues Found

### P0 - Critical
- [ ] BLE DFU fails on Android 12+ (permission issue)

### P1 - High
- [ ] LoRaWAN registration UI freezes on slow connections

### P2 - Medium
- [ ] DFU progress dashboard shows stale data (refresh issue)
```

#### Day 13-14: Bug Fixes & Re-Deploy

**Mobile Team**:
```bash
# Fix P0 bug (BLE permission)
# ... code fixes ...

# Test locally
npm test

# Commit
git add . && git commit -m "fix(ble): add Android 12+ permission handling"
```

**Backend Team** (if backend changes needed):
```bash
# No backend changes required for P0 bug
```

**Mobile Team**:
```bash
# Create new preview build
eas build --profile preview --platform android

# Notify stakeholders
cd ~/dev/wildlifeai/cross-project-coordination
./.scripts/send-message.sh \
  --project "ble-dfu-lorawan-integration" \
  --from "mobile" \
  --to "backend" \
  --type "status-update" \
  --message "P0 bug fixed (BLE permission). New preview build: xyz456. Re-test BLE DFU workflow."
```

### Week 2 End: Milestone Complete

**Human Review Checkpoint**:
1. ✅ All exit criteria met (local + cloud-dev + preview)
2. ✅ Stakeholder testing complete (P0 bugs fixed)
3. ✅ Code review approved
4. ✅ Documentation updated
5. ✅ Ready for production deployment (future milestone)

**Project Status**:
```yaml
status: milestone-01-complete
progress: 100%
next_milestone: milestone-02-production-deployment
```

---

## Script Reference

See [Core Components](#core-components) section above for detailed script documentation.

**Quick Command Reference**:

```bash
# Initialize project
./init-project.sh --slug "name" --title "Title" --teams "mobile,backend"

# Send message
./send-message.sh --project "name" --from "mobile" --to "backend" --type "deployment-ready" --message "..."

# Check inbox
./check-inbox.sh --project "name" --team "mobile"

# Start watcher (single project)
./watch-project.sh start <project-slug>

# Start watcher (all projects)
./watch-all-projects.sh start

# Check notifications
./check-notifications.sh mobile
```

All scripts have `--help` flags for detailed usage.

---

## Template Reference

See [Core Components](#core-components) section above for detailed template documentation.

---

## Message Types & Workflows

### 1. schema-change Workflow

**Use Case**: Backend changes database schema, mobile must regenerate types

**Backend Workflow**:
```bash
# 1. Create migration locally
supabase migration new add_new_table
supabase db reset

# 2. Test migration
npm run types:generate
# ... test locally ...

# 3. Commit
git add . && git commit -m "feat(db): add new table"

# 4. Send coordination message
cd ~/dev/wildlifeai/cross-project-coordination
./.scripts/send-message.sh \
  --project "project-name" \
  --from "backend" \
  --to "mobile" \
  --type "schema-change" \
  --message "Schema changed: added new_table. Migration: 20251101_add_new_table.sql. Mobile must run: npm run types:local"
```

**Mobile Workflow**:
```bash
# 1. Check inbox
./.scripts/check-inbox.sh --project "project-name" --team "mobile"

# 2. Regenerate types
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:local

# 3. Verify types
npm run types:check-local

# 4. Commit updated types
git add src/types/supabase.ts
git commit -m "chore(types): sync with local schema (new_table)"

# 5. Update code to use new types (if needed)
```

### 2. deployment-ready Workflow

**Use Case**: Backend deployed to cloud-dev, mobile can build preview

**Backend Workflow**:
```bash
# 1. Deploy to cloud-dev
supabase link --project-ref nuhwmubvygxyddkycmpa
supabase db push --linked

# 2. Verify deployment
supabase db diff --linked  # Should show "No changes"
# Test API endpoints, check logs

# 3. Send deployment-ready message
cd ~/dev/wildlifeai/cross-project-coordination
./.scripts/send-message.sh \
  --project "project-name" \
  --from "backend" \
  --to "mobile" \
  --type "deployment-ready" \
  --message "Backend deployed to cloud-dev. Migration: migration_name. Edge Functions: function_name. Mobile can regenerate types and build preview."
```

**Mobile Workflow**:
```bash
# 1. Check inbox
./.scripts/check-inbox.sh --project "project-name" --team "mobile"

# 2. Regenerate types from cloud-dev
cd ~/dev/wildlifeai/wildlife-watcher-mobile-app
npm run types:cloud-dev

# 3. Validate types
npm run types:check-cloud-dev
npm run validate:cloud-dev

# 4. Commit types
git add src/types/supabase.ts
git commit -m "chore(types): sync with cloud-dev schema"

# 5. Create preview build
eas build --profile preview

# 6. Confirm build created
cd ~/dev/wildlifeai/cross-project-coordination
./.scripts/send-message.sh \
  --project "project-name" \
  --from "mobile" \
  --to "backend" \
  --type "status-update" \
  --message "Preview build complete. Build ID: abc123. URL: https://expo.dev/.../builds/abc123"
```

### 3. task-request Workflow

**Use Case**: One team requests implementation from other team

**Example: Mobile requests backend RPC function**:

```bash
# Mobile sends request
cd ~/dev/wildlifeai/cross-project-coordination
./.scripts/send-message.sh \
  --project "project-name" \
  --from "mobile" \
  --to "backend" \
  --type "task-request" \
  --message "Please add RPC function: check_user_permissions(user_id uuid, resource text) RETURNS boolean. Checks if user has permission to access resource. Needed for T-005 implementation."
```

**Backend acknowledges**:
```bash
./.scripts/send-message.sh \
  --project "project-name" \
  --from "backend" \
  --to "mobile" \
  --type "status-update" \
  --message "Task request acknowledged. Adding to task-definitions.yml as T-006. Estimated completion: 2 days. Will notify when deployed to cloud-dev."
```

### 4. status-update Workflow

**Use Case**: Async progress tracking

```bash
# Update on task completion
./.scripts/send-message.sh \
  --project "project-name" \
  --from "mobile" \
  --to "backend" \
  --type "status-update" \
  --message "T-001 complete: BLE DFU Service implemented. Local testing passed (95% coverage). Ready for backend integration."
```

### 5. stakeholder-feedback Workflow

**Use Case**: Report issues from stakeholder testing

```bash
# Report critical bug
./.scripts/send-message.sh \
  --project "project-name" \
  --from "mobile" \
  --to "backend" \
  --type "stakeholder-feedback" \
  --message "P0 Bug: User authentication fails on preview build. Stakeholder cannot login. Backend RLS policy issue suspected. See attached feedback template."
```

### 6. generic-message Workflow

**Use Case**: General coordination

```bash
# Ask question or share information
./.scripts/send-message.sh \
  --project "project-name" \
  --from "backend" \
  --to "mobile" \
  --type "generic-message" \
  --message "FYI: Cloud-dev database will be offline for maintenance on Saturday 10am-12pm UTC. Plan preview builds accordingly."
```

---

## Deployment Workflow

See [Complete Workflow Example](#complete-workflow-example) above for detailed walkthrough.

**5-Phase Summary**:

1. **Phase 1: Local Development**
   - Both teams develop with local Supabase
   - Frequent local testing and iteration

2. **Phase 2: Cloud-Dev Deployment**
   - Backend deploys migrations and functions to cloud-dev
   - Backend sends `deployment-ready` message

3. **Phase 3: Preview Build Creation**
   - Mobile regenerates types from cloud-dev
   - Mobile creates preview build via EAS

4. **Phase 4: Stakeholder Testing**
   - Distribute preview build to stakeholders
   - Collect feedback via stakeholder-feedback-template.md

5. **Phase 5: Iteration**
   - Fix P0/P1 bugs
   - Re-deploy to cloud-dev (if backend changes)
   - Create new preview build (if mobile changes)
   - Re-test with stakeholders

---

## Troubleshooting

### Common Issues

**Issue**: "Project does not exist"
**Solution**:
```bash
# Verify project exists
ls ~/dev/wildlifeai/cross-project-coordination/projects/

# If missing, initialize it
./init-project.sh --slug "project-name" --title "Project Title" --teams "mobile,backend"
```

**Issue**: "No messages in inbox"
**Solution**: Check if messages were sent to correct inbox
```bash
# List all inbox files
ls -la ~/dev/wildlifeai/cross-project-coordination/projects/project-name/inbox/mobile-to-backend/
ls -la ~/dev/wildlifeai/cross-project-coordination/projects/project-name/inbox/backend-to-mobile/
```

**Issue**: "File watcher not detecting changes"
**Solution**:
```bash
# Check if watcher is running
./watch-all-projects.sh status

# Restart watcher
./watch-all-projects.sh stop
./watch-all-projects.sh start

# Check watcher logs
cat ~/dev/wildlifeai/cross-project-coordination/.watch-logs/project-name.log
```

**Issue**: "Types out of sync after deployment"
**Solution**:
```bash
# Regenerate types from correct environment
npm run types:cloud-dev  # For preview builds
npm run types:local      # For local development

# Verify alignment
npm run types:check-cloud-dev
npm run types:check-local
```

For more troubleshooting, see: `~/dev/wildlifeai/cross-project-coordination/TROUBLESHOOTING-DYNAMIC-COORDINATION.md`

---

## Advanced Topics

### Per-Project Watcher Architecture

**Decision**: Each project has its own watcher process (not centralized)

**Rationale**:
- **Failure Isolation**: One project's watcher failure doesn't affect others
- **Project-Specific Configuration**: Each project can have custom watch settings
- **Scalability**: N concurrent projects = N watchers (manageable with systemd)
- **Debugging**: Easier to identify and fix project-specific issues

**Implementation**: `watch-project.sh` for single project, `watch-all-projects.sh` for convenience wrapper

### Context Window Management (Future)

**Status**: Not implemented (deferred to Phase 2)

**Planned Features**:
- Automatic token counting
- Session state serialization
- Continuation prompt generation
- 80%/85%/90% warning system

**Location for future implementation**: `context-snapshots/` folder in each project

### Backend-Specific Utilities (P0-P3)

**Backend Team Responsibility** (Week 1-3 post-launch):

**P0 (Week 1)**: Health check script for cloud-dev
- Verifies migrations applied
- Checks RLS policies
- Reviews logs for errors

**P1 (Week 2)**: RLS policy testing utility
- Automated validation with different user roles
- Cross-tenant isolation testing

**P2 (Week 3)**: Migration verification + Type drift detection
- Ensures cloud-dev matches committed migrations
- Alerts if mobile types are stale

**P3 (As needed)**: Automated notifications
- GitHub Actions integration
- Auto-send deployment-ready messages

**Location**: `~/dev/wildlifeai/cross-project-coordination/.scripts/backend/`

---

## Appendix

### A. Decision Criteria (When to Use This System)

Use dynamic coordination when a project has:

✅ **3+ coordinated tasks** across mobile and backend teams
✅ **Milestone-based execution** with human review checkpoints
✅ **Cloud-dev deployment coordination** requirements
✅ **Task dependencies** requiring careful sequencing
✅ **Risk of exceeding 200k context window** (complex projects)

**Don't use** for:
- Simple 1-2 task projects
- Independent team work (no coordination needed)
- Ad-hoc bug fixes or small enhancements

### B. Backend Requirements Met

✅ **All backend requests incorporated**:
1. ✅ PROJECT-STATUS.md template
2. ✅ .gitignore template
3. ✅ All scripts have --help flags
4. ✅ Backend-specific utilities documented (P0-P3 for Week 1-3)

### C. Test Results Summary

**Mock Project**: `test-coordination-system`
**End-to-End Validation**: ✅ PASS

- ✅ Project initialization: SUCCESS
- ✅ Bidirectional messaging (mobile ↔ backend): SUCCESS
- ✅ Inbox checking: SUCCESS
- ✅ Template copying: SUCCESS (14 files)
- ✅ Help documentation: SUCCESS

**All Quality Gates**: ✅ PASSED

### D. Related Documentation

**Coordination Hub**:
- Quick Start: `~/dev/wildlifeai/cross-project-coordination/QUICK-START-DYNAMIC-COORDINATION.md`
- Troubleshooting: `~/dev/wildlifeai/cross-project-coordination/TROUBLESHOOTING-DYNAMIC-COORDINATION.md`
- Main README: `~/dev/wildlifeai/cross-project-coordination/README.md`

**Mobile App Repo**:
- Implementation Report: `project-context/.../IMPLEMENTATION-COMPLETE-REPORT.md`
- This Guide: `project-context/.../DYNAMIC-COORDINATION-SYSTEM-GUIDE.md`

**Type Synchronization**:
- Local Dev Workflow: `project-context/.../protocols/type-synchronization/local-dev-sync-workflow.md`
- Comprehensive Guide: `project-context/.../protocols/type-synchronization/Backend-Mobile-Type-Synchronization-Guide.md`
- Multi-Environment: `project-context/.../protocols/type-synchronization/multi-environment-type-sync-guide.md`

**Backend Repo**:
- Type Automation: `~/wildlife-watcher-backend/project-context/documentation/QUICK-REFERENCE-TYPE-AUTOMATION.md`
- Backend Status: `~/wildlife-watcher-backend/project-context/PROJECT-STATUS.md`

---

## Quick Reference Card

**Initialize Project**:
```bash
cd ~/dev/wildlifeai/cross-project-coordination
./.scripts/init-project.sh --slug "name" --title "Title" --teams "mobile,backend"
```

**Send Message**:
```bash
./.scripts/send-message.sh --project "name" --from "team" --to "team" --type "type" --message "msg"
```

**Check Inbox**:
```bash
./.scripts/check-inbox.sh --project "name" --team "team"
```

**Watch Projects**:
```bash
./.scripts/watch-all-projects.sh start
```

**Get Help**:
```bash
./.scripts/init-project.sh --help
./.scripts/send-message.sh --help
./.scripts/check-inbox.sh --help
```

---

**Status**: ✅ Production-Ready
**Version**: 1.0.0
**Last Updated**: 2025-11-01
**Maintained By**: Mobile Team (with backend contributions for P0-P3 utilities)

