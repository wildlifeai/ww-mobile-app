# Continuation Prompt: Dynamic Cross-Project Coordination System Implementation

**Session Context**: Implementation of dynamic cross-project coordination system
**Priority**: URGENT - Complete within 2 hours
**Status**: Design approved, proceed with implementation

## Previous Work Completed

✅ **Design Phase Complete**:
- Comprehensive architecture documented in `DYNAMIC-PROJECT-COORDINATION-DESIGN.md` (850+ lines)
- Executive summary created in `DYNAMIC-PROJECT-SUMMARY.md`
- All requirements captured and validated
- Human approval received

✅ **Backend Coordination Complete**:
- Backend team notified and responded within 18 minutes
- Backend response: `~/dev/wildlifeai/cross-project-coordination/archive/2025-10/response-dynamic-coordination-2025-10-31.md`
- Backend decision: ✅ APPROVED - Proceed with implementation
- Backend enhancements requested: PROJECT-STATUS.md, .gitignore, --help flags, backend P0-P3 tools (weeks 1-3)

✅ **Progress Tracking System Created**:
- Live progress tracker: `IMPLEMENTATION-PROGRESS-TRACKER.md`
- Tracks all 42 sub-tasks across 4 priorities
- Enables session recovery if context window refresh needed
- **CRITICAL**: Update this file after EVERY sub-task completion

## ⚠️ IMPORTANT CLARIFICATION: General-Purpose Framework

**This is a GENERAL-PURPOSE coordination framework for ANY cross-team project**:
- ✅ NOT limited to BLE DFU + LoRaWAN (that's just an example in docs)
- ✅ Works for ANY large-scale mobile + backend coordinated project
- ✅ All templates and scripts are project-agnostic
- ✅ Create unlimited projects with `init-project.sh --slug "any-project-name"`

**Backend-Confirmed Use Cases** (from backend response):
1. Hardware integration projects (BLE, LoRaWAN, etc.)
2. Major feature rollouts (auth systems, new capabilities)
3. API redesigns (REST → GraphQL migrations)
4. Performance initiatives (DB optimization + mobile)
5. Security enhancements (E2E encryption)
6. Third-party integrations (payment gateways, analytics)
7. Multi-tenant features (organization isolation)

**Decision Criteria for Using This System**:
- Project has 3+ coordinated tasks across mobile and backend
- Requires milestone-based execution with human checkpoints
- Needs cloud-dev deployment coordination
- Has task dependencies requiring careful sequencing
- May exceed 200k token context window (needs session recovery)

**In Documentation**: "BLE DFU + LoRaWAN" is used as a concrete example to illustrate concepts, but all scripts/templates work for ANY project type.

## Stakeholder Decisions (Answered Questions)

1. **Approval**: ✅ APPROVED - Design meets requirements, proceed with implementation
2. **Scope Adjustment**: ✅ NO CHANGES - Implement as designed
3. **Implementation Priority**:
   - **Phase 1**: Local development tools (HIGHEST PRIORITY)
   - **Phase 2**: Milestone framework (SECOND)
   - **Phase 3**: Preview deployment workflow (THIRD)
4. **Testing Strategy**: ✅ YES - Test with mock 3-task project before real application
5. **Timeline**: ⚠️ **URGENT** - Complete within next 2 hours maximum

## Implementation Directive

**CRITICAL**: Implement in priority order with 2-hour hard deadline.

### Priority 1: Local Development Tools (45 minutes)

**Must Complete**:
1. Project initialization script (`~/dev/wildlifeai/cross-project-coordination/.scripts/init-project.sh`)
2. Basic folder structure templates
3. Task definition template (`task-definitions.yml`)
4. Dependency graph template (`dependency-graph.yml`)
5. Simple file watcher script (manual mode only for MVP)
6. Message sender script (`send-message.sh`)

**Success Criteria**:
- Can initialize new project folder
- Can define tasks with entry/exit criteria
- Can send messages between teams manually
- Basic coordination working

### Priority 2: Milestone Framework (30 minutes)

**Must Complete**:
1. Milestone template with deployment workflow sections
2. Entry/exit criteria checklists
3. Human review checkpoint template
4. Deployment workflow scripts (local → cloud-dev → preview)

**Success Criteria**:
- Can create milestone with all sections
- Deployment workflow clearly documented
- Human review checklist comprehensive

### Priority 3: Preview Deployment Workflow (30 minutes)

**Must Complete**:
1. Backend deployment notification script
2. Mobile type regeneration workflow
3. Preview build creation checklist
4. Stakeholder feedback collection template

**Success Criteria**:
- Backend can notify mobile when cloud-dev ready
- Mobile can regenerate types and build preview
- Stakeholder feedback captured systematically

### Priority 4: Testing & Documentation (15 minutes)

**Must Complete**:
1. Mock project walkthrough (simple 3-task scenario)
2. Quick start guide
3. Troubleshooting FAQ

**Success Criteria**:
- End-to-end workflow validated
- Documentation sufficient for teams to use independently

## Context Window Management (DEFERRED)

**Decision**: Implement context window monitoring in Phase 2 (next session)
**Rationale**: 2-hour deadline requires focus on core coordination functionality
**Status**: Design complete, implementation can be added incrementally

## Backend Team Coordination (COMPLETED)

✅ **Backend Response Received**: 18 minutes after request
✅ **Backend Decision**: APPROVED - Proceed with implementation
✅ **Backend Response File**: `~/dev/wildlifeai/cross-project-coordination/archive/2025-10/response-dynamic-coordination-2025-10-31.md`

**Key Backend Feedback Incorporated**:
1. Add PROJECT-STATUS.md template (Priority 1, sub-task 1.9)
2. Add .gitignore template (Priority 1, sub-task 1.10)
3. All scripts must have --help flags (verified in Priority 4, sub-task 4.10)
4. Backend P0-P3 tools documented for future (weeks 1-3, NOT in 2-hour scope)

**No blocking issues from backend. Proceed with implementation immediately.**

---

## Backend Team Coordination Message (FOR REFERENCE - ALREADY SENT AND RESPONDED)

**Subject**: Dynamic Cross-Project Coordination System - Backend Input Needed

**To**: Backend Team
**From**: Mobile Team
**Priority**: High
**Type**: `task-request`

### Overview

We're implementing a **Dynamic Cross-Project Coordination System** for large-scale projects (e.g., BLE DFU + LoRaWAN integration). This system provides:

- Dynamic project folders with team-specific inboxes
- Master project plans with task dependencies
- Milestone-based execution with deployment workflows
- Automated coordination and notifications

### Full Specification

**Location**: `~/dev/wildlifeai/wildlife-watcher-mobile-app/project-context/development-context/MVP2/implementation/execution/cross-project-coordination/`

**Key Documents**:
- `DYNAMIC-PROJECT-COORDINATION-DESIGN.md` - Complete technical specification (850+ lines)
- `DYNAMIC-PROJECT-SUMMARY.md` - Executive summary and usage examples

### What We Need From You

**Before we proceed with implementation, we need your input on:**

#### 1. Coordination System Design

**Question**: Does the proposed system meet your needs?

**Key Features**:
- Project folders: `~/dev/wildlifeai/cross-project-coordination/projects/<project-slug>/`
- Team inboxes: `inbox/backend-to-mobile/` and `inbox/mobile-to-backend/`
- Shared docs: `shared-docs/` for API contracts, architecture decisions
- Master plans: `master-plan/task-definitions.yml` with dependencies

**Your Input**: Any changes or additions needed?

#### 2. Message Types

**Question**: Are these message types sufficient?

**Proposed Types**:
- `schema-change` - Database schema modified, mobile should regenerate types
- `deployment-ready` - Backend deployed to cloud-dev, mobile can build preview
- `task-request` - Request implementation from other team
- `status-update` - Task completion or progress update
- `stakeholder-feedback` - Issues/enhancements from stakeholders
- `generic-message` - General coordination

**Your Input**: Any additional message types needed?

#### 3. Deployment Workflow

**Question**: Does this workflow work for you?

**Proposed Workflow**:

**Phase 1: Local Development**
```bash
# Backend
supabase start                      # Local Supabase
supabase migration new <name>       # Create migration
supabase db reset                   # Apply locally
npm run types:generate              # Update types
git commit -m "feat(db): ..."       # Commit
```

**Phase 2: Cloud-Dev Deployment**
```bash
# Backend deploys FIRST
supabase link --project-ref nuhwmubvygxyddkycmpa
supabase db push --linked           # Push to cloud-dev
supabase functions deploy <name>    # Deploy functions

# Backend NOTIFIES mobile
send-message.sh \
  --project "<project>" \
  --from "backend" \
  --to "mobile" \
  --type "deployment-ready" \
  --message "Backend deployed. Mobile can regenerate types and build preview."
```

**Phase 3: Mobile Preview Build**
```bash
# Mobile (after backend notification)
npm run types:cloud-dev             # Regenerate from cloud-dev
npm run types:check-cloud-dev       # Verify alignment
eas build --profile preview         # Create preview
```

**Your Input**: Any issues with this workflow?

#### 4. Backend-Specific Requirements

**Question**: Do you need any backend-specific tools?

**Potential Needs**:
- Custom scripts for common backend operations?
- Backend-specific task templates?
- Notifications when mobile completes tasks affecting backend?
- Health check scripts for cloud-dev?

**Your Input**: What would make your workflow smoother?

#### 5. Timeline & Implementation

**Status**: Design approved, implementing TODAY (next 2 hours)

**Priority Order**:
1. Local development tools (45 min)
2. Milestone framework (30 min)
3. Preview deployment workflow (30 min)
4. Testing with mock project (15 min)

**Your Input**:
- Do you need to implement anything on your side?
- Can you provide sample task definitions for testing?
- Any concerns about the 2-hour timeline?

### Action Required From Backend Team

**⏰ URGENT - Response needed within 1 hour**

Please review:
1. Full specification documents (linked above)
2. Proposed message types and workflows
3. Deployment workflow (especially cloud-dev push process)

**Respond with**:
- Approval to proceed as designed, OR
- Required changes/additions, OR
- Backend-specific requirements not captured

**How to Respond**:

**Option 1: Coordination System** (preferred)
```bash
# Send message to mobile inbox
~/dev/wildlifeai/cross-project-coordination/.scripts/send-message.sh \
  --from "backend" \
  --to "mobile" \
  --type "generic-message" \
  --message "Backend team input: [your response]"
```

**Option 2: Direct Communication**
- Reply via Slack/email
- Or create file: `~/dev/wildlifeai/cross-project-coordination/inbox/backend-to-mobile/backend-input-<date>.md`

### Next Steps

**After receiving your input**:
1. Mobile implements system (2 hours)
2. Test with mock 3-task project
3. Apply to real project (BLE DFU + LoRaWAN)
4. Both teams start using for coordinated development

**Questions?** Contact mobile team lead immediately.

---

**Message Status**: Ready to send
**Created**: 2025-10-31
**Deadline**: Response needed within 1 hour

---

## Implementation Command for Continuation Session

**Copy and paste this into new chat to resume work:**

```
I need to implement the Dynamic Cross-Project Coordination System.

CONTEXT:
- Design complete: ~/dev/wildlifeai/wildlife-watcher-mobile-app/project-context/development-context/MVP2/implementation/execution/cross-project-coordination/DYNAMIC-PROJECT-COORDINATION-DESIGN.md
- Summary: ~/dev/wildlifeai/wildlife-watcher-mobile-app/project-context/development-context/MVP2/implementation/execution/cross-project-coordination/DYNAMIC-PROJECT-SUMMARY.md
- Continuation prompt: ~/dev/wildlifeai/wildlife-watcher-mobile-app/project-context/development-context/MVP2/implementation/execution/cross-project-coordination/CONTINUATION-PROMPT-DYNAMIC-COORDINATION-SYSTEM.md
- Backend approved (response in ~/dev/wildlifeai/cross-project-coordination/archive/2025-10/response-dynamic-coordination-2025-10-31.md)

IMPORTANT CLARIFICATION - General-Purpose Framework:
- This is NOT limited to BLE DFU + LoRaWAN (that's just an example in docs)
- This is a GENERAL-PURPOSE coordination framework for ANY cross-team project
- All templates and scripts are project-agnostic
- Backend confirmed 7 use cases: hardware integration, feature rollouts, API redesigns, performance initiatives, security enhancements, third-party integrations, multi-tenant features
- Decision criteria: 3+ coordinated tasks, milestone-based execution, cloud-dev deployment coordination, task dependencies, or may exceed 200k context window

PROGRESS TRACKER (MANDATORY):
- File: ~/dev/wildlifeai/wildlife-watcher-mobile-app/project-context/development-context/MVP2/implementation/execution/cross-project-coordination/IMPLEMENTATION-PROGRESS-TRACKER.md
- **CRITICAL**: Update this file after EVERY sub-task completion
- Use Edit tool to check off completed items: [ ] → [x]
- Update status, actual times, files created
- This file is the SOURCE OF TRUTH for session recovery

PRIORITY ORDER (2-hour deadline):
1. Local development tools (45 min) - 12 sub-tasks
2. Milestone framework (30 min) - 10 sub-tasks
3. Preview deployment workflow (30 min) - 10 sub-tasks
4. Testing & docs (15 min) - 10 sub-tasks

WORKFLOW FOR EACH SUB-TASK:
1. Read progress tracker to find next unchecked item
2. Complete the sub-task
3. Update progress tracker (check off item, update times/notes)
4. Move to next sub-task

IMPLEMENTATION PRIORITY: Local > Milestone > Preview (per human directive)

CRITICAL REQUIREMENTS:
- Test with mock 3-task project before real application
- Context window monitoring DEFERRED to Phase 2 (focus on core functionality)
- All scripts in ~/dev/wildlifeai/cross-project-coordination/.scripts/
- All templates in ~/dev/wildlifeai/cross-project-coordination/.templates/
- All scripts MUST have --help flags (backend request)
- Include PROJECT-STATUS.md and .gitignore templates (backend request)

FIRST ACTIONS:
1. Read IMPLEMENTATION-PROGRESS-TRACKER.md to see current status
2. Read backend response (already approved, see file above)
3. Start with first unchecked sub-task in Priority 1
4. Update tracker after each completion

BEGIN IMPLEMENTATION NOW. Target completion: 2 hours maximum.
```

## Files to Reference During Implementation

1. **Full Specification**: `DYNAMIC-PROJECT-COORDINATION-DESIGN.md`
   - Section 1: Project folder structure
   - Section 4: Master project plan framework (task-definitions.yml format)
   - Section 5: Milestone framework (milestone template)
   - Section 7: Control modes (auto/manual switching)

2. **Summary Document**: `DYNAMIC-PROJECT-SUMMARY.md`
   - Usage workflow examples
   - Task definition examples
   - Deployment workflow commands

3. **Current Coordination System**: `~/dev/wildlifeai/cross-project-coordination/`
   - Existing templates in `templates/`
   - Existing scripts in `.coordination/`
   - Reference for consistency

## Success Metrics

**At End of 2-Hour Implementation**:

✅ Can initialize new coordinated project
✅ Can define tasks with entry/exit/deployment criteria
✅ Can create milestones with deployment workflow
✅ Can send coordination messages between teams
✅ Backend can notify mobile when cloud-dev ready
✅ Mobile can regenerate types from cloud-dev
✅ Mock project demonstrates end-to-end workflow
✅ Quick start guide enables independent usage

## Risk Mitigation

**If running behind schedule**:
1. **Priority 1 is CRITICAL** - Must complete local tools
2. **Priority 2 can be simplified** - Use basic milestone template
3. **Priority 3 can be documented** - Scripts optional, workflow docs essential
4. **Context window monitoring** - Already deferred to Phase 2

**If backend team doesn't respond within 1 hour**:
- Proceed with implementation as designed
- Make system flexible enough to incorporate backend feedback later
- Document "pending backend input" items for follow-up

## Current Status

- **Session**: Design phase complete
- **Next Session**: Implementation phase
- **Backend Coordination**: Message drafted, ready to send
- **Timeline**: 2 hours from backend response or 1-hour timeout
- **Priority**: URGENT

---

**Resume implementation immediately. Check backend inbox first, then START CODING.**
