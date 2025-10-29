# Continuation Prompt: Runtime Environment Switching Implementation

**Purpose**: Resume work on the Runtime Environment Switching implementation from any point in the process.

**How to Use**: Execute with `/aadf-prompt-file project-context/development-context/MVP2/implementation/execution/CONTINUE-ENVIRONMENT-SWITCHING.prompt.md`

---

## 📋 Context Restoration

You are continuing work on implementing **Runtime Environment Switching** for the Wildlife Watcher Mobile App. This system enables developers to switch between local and cloud Supabase instances at runtime in development builds, while fixing preview/production builds to appropriate cloud environments.

### Implementation Plan Location
**Master Plan**: `@project-context/development-context/MVP2/implementation/execution/RUNTIME-ENVIRONMENT-SWITCHING-IMPLEMENTATION-PLAN.md`

### Your Immediate Instructions

1. **Read the master plan document**:
   ```
   Read the file: project-context/development-context/MVP2/implementation/execution/RUNTIME-ENVIRONMENT-SWITCHING-IMPLEMENTATION-PLAN.md
   ```

2. **Identify current status**:
   - Check the "Progress Tracking" section
   - Review which tasks are completed (🟢)
   - Identify current in-progress task (🟡)
   - Find next blocked/not-started task (🔴)

3. **Resume from current state**:
   - If a task is 🟡 In Progress: Continue that task
   - If no tasks in progress: Start next task according to dependency graph
   - If blocked: Resolve blocker or skip to next available task

4. **Execution Strategy**:
   - Follow the **Parallel Execution** model where possible
   - Use appropriate sub-agents as specified in each task
   - Update progress tracking after completing each task
   - Run tests continuously during implementation

---

## 🎯 Quick Status Assessment

Run this assessment before continuing:

### Current State Checklist
- [ ] What is the overall progress percentage? (Check Progress Summary table)
- [ ] Which track (A/B/C/D) are you currently working on?
- [ ] Are there any blocked tasks? (Check for ⏸️ status)
- [ ] Have any tasks failed? (Check for ❌ status)
- [ ] What was the last completed task?

### Next Action Decision Tree

```
IF all Phase 1 tasks complete (1.1, 2.1, 3.1):
  → Start Phase 2 tasks (1.2, 3.2, 3.3) in parallel

ELSE IF any Phase 1 task incomplete:
  → Continue/start remaining Phase 1 tasks

IF all Phase 2 tasks complete (1.2, 3.2, 3.3):
  → Start Phase 3 tasks (1.3, 2.2)

IF all Phase 3 tasks complete (1.3, 2.2):
  → Start Task 4 (Integration Testing)

IF Task 4 complete:
  → Start Task 5 (Documentation)

IF Task 5 complete:
  → Start Task 6 (Workflow Guide)

IF all tasks complete:
  → Final validation and deployment preparation
```

---

## 🚀 Resume Execution

### Step 1: Update Your Context
```bash
# Read the master plan
Read: project-context/development-context/MVP2/implementation/execution/RUNTIME-ENVIRONMENT-SWITCHING-IMPLEMENTATION-PLAN.md

# Identify what needs to be done next
# Look for the first 🔴 Not Started or 🟡 In Progress task
```

### Step 2: Verify Prerequisites
```bash
# Ensure environment is ready
npm test                    # All existing tests passing?
npm run type-check          # No TypeScript errors?
supabase status             # Local Supabase running?
git status                  # Clean working directory?
```

### Step 3: Execute Next Task

Based on the task you're continuing, spawn the appropriate agent:

**For Track A tasks (Infrastructure)**:
```
Use Task tool with subagent_type: backend-architect
Provide full task context from master plan
```

**For Track B tasks (UI Components)**:
```
Use Task tool with subagent_type: mobile-dev
Provide full task context from master plan
```

**For Track C tasks (Type Sync & CI/CD)**:
```
Use Task tool with subagent_type: devops-deployment-architect
Provide full task context from master plan
```

**For Track D tasks (Integration & Docs)**:
```
Task 4: Use quality-assurance-engineer
Task 5-6: Use docs-maintainer
Provide full task context from master plan
```

### Step 4: Update Progress Tracking

After completing each task:

1. **Mark task as complete** in master plan:
   - Change status from 🟡 → 🟢
   - Update Progress Summary table
   - Update completion percentage

2. **Document findings**:
   - Add notes to task section
   - Document any blockers encountered
   - Record decisions made

3. **Commit progress**:
   ```bash
   git add [modified files]
   git commit -m "feat(env-switching): complete Task X.Y - [description]"
   ```

4. **Move to next task**:
   - Check dependency graph
   - Identify next available task
   - Update task status to 🟡

---

## 📊 Progress Reporting Template

Use this template when updating progress:

```markdown
### Task [X.Y] Progress Update

**Task**: [Task Name]
**Status**: 🟡 In Progress → 🟢 Completed
**Time Spent**: [X] hours
**Agent Used**: [agent-name]

**What was completed**:
- [Bullet point of what was done]
- [Another accomplishment]

**Files Created**:
- `path/to/file.ts`

**Files Modified**:
- `path/to/file.ts`

**Tests Added**:
- `path/to/test.test.ts`

**Challenges Encountered**:
- [Any issues and how they were resolved]

**Next Steps**:
- [What should happen next]

**Validation**:
- [ ] TypeScript compiles without errors
- [ ] All tests pass
- [ ] Code reviewed (if applicable)
- [ ] Documentation updated
```

---

## 🎯 Task-Specific Continuation Guides

### If continuing Task 1.1 (Environment Configuration)
1. Read current `src/services/supabase.ts` to understand config pattern
2. Review `app.config.js` to understand Expo configuration
3. Check `.env.local` for current Supabase credentials
4. Implement `src/config/environments.ts` with all three environment configs
5. Write unit tests for environment detection logic
6. Validate TypeScript compilation

### If continuing Task 1.2 (Environment Manager)
1. Ensure Task 1.1 is complete
2. Review AsyncStorage usage patterns in codebase
3. Implement `EnvironmentManager.ts` with persistence
4. Create React hooks for component integration
5. Write integration tests for AsyncStorage persistence
6. Test fallback scenarios

### If continuing Task 1.3 (Supabase Client Refactor)
1. Ensure Task 1.2 is complete
2. Study current `src/services/supabase.ts` singleton pattern
3. Design factory pattern replacement
4. Identify all services using Supabase client
5. Implement client lifecycle management
6. Update critical services
7. Ensure backward compatibility
8. Run full test suite

### If continuing Task 2.1 (Developer Settings Screen)
1. Review existing screen patterns in `src/screens/`
2. Check React Native Paper component library usage
3. Implement Developer Settings screen UI
4. Integrate with EnvironmentManager hooks (from Task 1.2)
5. Add connection testing feature
6. Write component tests
7. Test on device

### If continuing Task 3.1 (Type Sync Scripts)
1. Review existing `package.json` scripts (line 28-30)
2. Study current `scripts/check-types-local.sh` pattern
3. Implement cloud type generation scripts
4. Test Supabase CLI `--linked` flag
5. Add npm scripts to package.json
6. Test all scripts in local environment

### If continuing Task 4 (Integration Testing)
1. Ensure all Track A, B, C tasks complete
2. Review master plan test scenarios
3. Execute manual testing scenarios
4. Create automated E2E tests (Maestro)
5. Test on physical Android device
6. Document test results
7. Fix any issues discovered

### If continuing Task 5 (Documentation Update)
1. Ensure Task 4 complete and all tests passing
2. Read all existing documentation to understand structure
3. Update CLAUDE.md with new environment switching section
4. Update type synchronization guides
5. Create new multi-environment guide
6. Add visual diagrams
7. Cross-check all documentation for accuracy

---

## 🔍 Validation Checkpoints

After completing each phase, run these validations:

### After Phase 1 (Tasks 1.1, 2.1, 3.1)
```bash
npm run type-check          # TypeScript compiles?
npm test                    # All tests pass?
npm run types:local         # Local type gen works?
npm run types:cloud-dev     # Cloud type gen works? (if implemented)
```

### After Phase 2 (Tasks 1.2, 3.2, 3.3)
```bash
# Test environment manager
npm test -- EnvironmentManager

# Verify GitHub Actions workflow syntax
cat .github/workflows/cloud-type-validation.yml | grep -v "^#" | grep -v "^$"

# Test pre-commit hook (if implemented)
git commit --dry-run -m "test"
```

### After Phase 3 (Tasks 1.3, 2.2)
```bash
# Full integration test
npm run validate:local

# Test Supabase client refactor
npm test -- supabase

# Test navigation (manual)
npm start  # Launch app and verify Developer Settings accessible
```

### After Task 4 (Integration Testing)
```bash
# Run full test suite
npm test

# Run E2E tests
npm run test:maestro

# Verify on device
# (Manual testing required)
```

---

## 🆘 If You Encounter Blockers

### Blocker Resolution Protocol

1. **Document the blocker**:
   - Update task status to ⏸️ Blocked
   - Add detailed description in master plan
   - Include what you've tried

2. **Attempt resolution**:
   - Review related documentation
   - Check troubleshooting section in master plan
   - Search for similar issues in codebase

3. **Escalate if needed**:
   - Ask user for clarification
   - Request additional context
   - Propose alternative approaches

4. **Workaround if possible**:
   - Implement temporary solution
   - Document technical debt
   - Continue with next available task

---

## 📝 Communication Protocol

### Status Updates
Provide status updates in this format:

```
🎯 Environment Switching Implementation Status

Current Phase: [Phase X]
Overall Progress: [X]% ([Y]/11 tasks completed)

✅ Completed:
- Task 1.1: Environment Configuration
- Task 2.1: Developer Settings Screen
- ...

🟡 In Progress:
- Task X.Y: [Name] ([Z]% complete)

⏸️ Blocked:
- Task X.Y: [Name] - [Reason for block]

🔴 Next Up:
- Task X.Y: [Name] (ready to start)

⏱️ Estimated Time to Completion: [X] hours
```

### Decision Points
When you need to make a decision:

1. **Review architectural decisions** in master plan
2. **Check existing patterns** in codebase
3. **Propose solution** with rationale
4. **Document decision** in master plan
5. **Proceed with implementation**

---

## 🎯 Final Checklist (When All Tasks Complete)

Before marking the implementation as complete:

- [ ] All 11 tasks show 🟢 status
- [ ] Overall progress is 100%
- [ ] All tests pass (unit, integration, E2E)
- [ ] TypeScript compiles without errors
- [ ] Documentation updated and accurate
- [ ] Manual testing on device successful
- [ ] GitHub Actions workflows pass
- [ ] No regression in existing functionality
- [ ] Code reviewed (if applicable)
- [ ] Ready for merge to main branch

### Final Actions
1. **Create comprehensive test report**
2. **Generate deployment checklist**
3. **Update CHANGELOG.md**
4. **Create pull request with detailed description**
5. **Request code review**
6. **Prepare demo for stakeholders**

---

## 📞 Quick Reference

### Key Files
- **Master Plan**: `project-context/development-context/MVP2/implementation/execution/RUNTIME-ENVIRONMENT-SWITCHING-IMPLEMENTATION-PLAN.md`
- **Main Config**: `app.config.js`
- **Supabase Client**: `src/services/supabase.ts`
- **Environment File**: `.env.local`
- **Package Scripts**: `package.json`

### Key Commands
```bash
# Type synchronization
npm run types:local              # Generate from local
npm run types:cloud-dev          # Generate from cloud-dev
npm run types:check-local        # Validate local alignment
npm run types:check-cloud-dev    # Validate cloud alignment

# Testing
npm test                         # All tests
npm run type-check               # TypeScript validation
npm run validate:local           # Full local validation

# Environment
supabase status                  # Check local Supabase
npm start                        # Start Expo dev server
```

### Sub-Agents Reference
- **backend-architect**: Infrastructure tasks (Track A)
- **mobile-dev**: UI component tasks (Track B)
- **devops-deployment-architect**: CI/CD and tooling (Track C)
- **quality-assurance-engineer**: Testing (Task 4)
- **docs-maintainer**: Documentation (Tasks 5-6)

---

**Ready to Continue**: Read the master plan, assess current status, and execute next task! 🚀

**Remember**:
- Update progress tracking as you work
- Test continuously
- Document decisions
- Ask for help when blocked
- Celebrate small wins! 🎉
