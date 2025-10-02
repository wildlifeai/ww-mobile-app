# MVP2 Execution Plan Review - Prompt & Context

## 🎯 Prompt for Review Session

### Primary Request
Please review and refine the Wildlife Watcher MVP2 execution plan based on my feedback. The plan is located at `@project-context/MVP2-Tasks/MVP2-MASTER-EXECUTION-PLAN.md`.

### Review Focus Areas

1. **Task Clarity**: Each task needs:
   - Concise plain English overview of what it does
   - Clear objective statement
   - User-facing value proposition
   - Technical implementation summary

2. **Agent Assignments**: Verify:
   - Correct agent for each task/subtask
   - Agent expertise matches task requirements
   - Cross-project-coordinator used for all Supabase backend work
   - Clear primary vs secondary agent roles

3. **Cross-Project Dependencies**:
   - Backend components properly identified
   - Backend spec creation tasks defined
   - Communication protocol via cross-project-coordinator
   - Separate VS Code instance workflow documented

4. **Execution Sequencing**:
   - Dependencies correctly mapped
   - Parallel execution opportunities identified
   - Backend-first approach for blocking dependencies
   - Mobile UI work that can proceed independently

5. **Time Estimates**:
   - Realistic hours for each task
   - Backend vs mobile split clearly shown
   - Buffer for cross-project coordination
   - Integration testing time included

### My Review Points
[I will provide specific feedback points here]

### Expected Deliverables
1. Updated MVP2-MASTER-EXECUTION-PLAN.md with refinements
2. Backend specification templates for cross-project work
3. Clear execution sequence with parallel opportunities
4. Agent assignment rationale for each task

## 📋 Essential Context to Include

### Key Documents
```
@project-context/MVP2-Tasks/MVP2-MASTER-EXECUTION-PLAN.md
@project-context/MVP2-Tasks/MVP2-METRICS-TRACKER.md
@project-context/development-context/MVP2/tasks/ (task specifications)
@project-context/superclaude-task-management.md
```

### Current Status
- **Completed**: Tasks 1-10, 11.3 (OfflineService), 11.8 (UUID alignment)
- **Pending**: Tasks 11.4-11.7 (non-blocking), Tasks 12-23
- **Foundation Layer**: 50% complete
- **Timeline**: 20 working days target

### Project Architecture
- **Frontend**: React Native/Expo (Wildlife Watcher Mobile App)
- **Backend**: Supabase (separate repository: wildlife-watcher-backend)
- **Cross-Project**: Two VS Code instances with coordination via spec files

### Available Agents
- `mobile-dev`: React Native/Expo UI implementation
- `cross-project-coordinator`: Backend API specs and coordination
- `backend-architect`: Supabase implementation guidance
- `quality-assurance-engineer`: Testing and validation
- `frontend-design-expert`: UI/UX patterns
- `supabase-*` agents: Various Supabase specializations
- `ai-project-orchestrator`: Task planning and dependencies

### Cross-Project Workflow
1. Mobile repo: Create backend spec using cross-project-coordinator
2. Backend repo: Execute spec in separate VS Code instance
3. Communication: Via spec files in ~/wildlife-watcher-backend/project-context/MVP2-Tasks/
4. Integration: Test endpoints once backend confirms completion

### Task Categories
- **Mobile-only**: Tasks 14 (org switch), 19 (maps)
- **Backend-heavy**: Task 13 (role management)
- **Balanced**: Tasks 12, 15-18, 20
- **Integration**: Tasks 21-23

## 🔄 Review Process

1. **Clear Context**: Start fresh session with this prompt
2. **Load Documents**: Include only essential execution plan docs
3. **Apply Feedback**: Incorporate review points systematically
4. **Update Plan**: Refine based on feedback
5. **Generate Specs**: Create backend specification templates
6. **Validate**: Ensure all dependencies and agents correct

## 📝 Template for Backend Specifications

Each backend task should generate a spec with:
```markdown
# Task [Number] Backend Specification

## Overview
[Plain English description of backend requirements]

## Database Changes
- Tables to create/modify
- RLS policies needed
- Indexes for performance

## API Endpoints
- Endpoint URL and method
- Request/response schemas
- Authentication requirements
- Error handling

## Edge Functions (if needed)
- Function purpose
- Trigger conditions
- Implementation logic

## Migrations
- Migration file names
- SQL commands
- Rollback procedures

## Testing Requirements
- Test scenarios
- Expected behaviors
- Performance benchmarks

## Integration Points
- Mobile app connections
- Data sync requirements
- Real-time subscriptions
```

---

**Use this prompt to start a fresh review session with focused context on the MVP2 execution plan refinement.**