---
allowed-tools: Task, TodoWrite, Read, Write, Edit, Bash(git:*), Bash(npm:*), mcp__context7__*, mcp__serena__*
description: Intelligent task orchestration with parallel execution, smart agents, and evidence-based research
argument-hint: [task or work instruction]
---

# AADF Work Smart - Intelligent Task Orchestration

Execute the following instruction with **maximum efficiency** using AADF principles:

**Task**: $ARGUMENTS

## 🎯 Execution Protocol

### Phase 1: Evidence-Based Research (MANDATORY FIRST)
**Before ANY implementation**, research with Context7 to validate assumptions:
- Identify all technologies/libraries involved
- Use `mcp__context7__resolve-library-id` and `mcp__context7__get-library-docs` for EACH
- **Result**: Eliminate false solution paths (proven 10x efficiency improvement)

### Phase 2: Intelligent Task Analysis
Break down the instruction into:
1. **Atomic Tasks** - Single responsibility, clearly defined
2. **Dependencies** - Sequential requirements
3. **Parallel Groups** - Tasks that can run concurrently
4. **Agent Selection** - Best specialized agent for each task
5. **MCP Recommendations** - Required tools per agent

**Use project-organizer agent** to create execution plan at:
`@project-context/investigation/aadf-work-smart/[timestamp]-[task-name].md`

**Plan Structure**:
```markdown
# AADF Work Smart Execution Plan
**Objective**: [instruction]
**Created**: [timestamp]

## Evidence-Based Research
- [ ] Technology X: Context7 validated
- [ ] Pattern Y: Docs verified

## Task Breakdown
### Parallel Group 1
- **Task 1.1**: [description] | Agent: mobile-dev | MCPs: Context7, Serena
- **Task 1.2**: [description] | Agent: qa-engineer | MCPs: Context7

### Sequential Group 2 (Depends on Group 1)
- **Task 2.1**: [description] | Agent: backend-architect | MCPs: Supabase, Context7

## Quality Gates
- [ ] All tests passing
- [ ] TypeScript errors resolved
- [ ] Evidence-based validation complete

## Metrics
- Estimated: X hours | Actual: Y hours
```

### Phase 3: Parallel Agent Execution
**CRITICAL**: Execute ALL independent tasks in ONE message using Task tool:

For each agent, provide:
- **Overall Context**: What this is part of
- **Specific Task**: Their atomic responsibility
- **Evidence Results**: Context7 research findings
- **MCP Tools**: Which tools they should use
- **Quality Gates**: What must pass
- **Reporting**: What to report back

**Agent-MCP Mapping**:
- `mobile-dev`: Context7, Serena, IDE
- `backend-architect`: Supabase, Context7, Serena
- `quality-assurance-engineer`: Context7, Playwright, IDE
- `supabase-*`: Supabase MCP tools
- `frontend-design-expert`: Context7, Playwright
- All agents: Context7 for research, Serena for code analysis

### Phase 4: Progress Tracking
Update execution plan document as you progress:
- Mark tasks completed
- Record actual time spent
- Document blockers and solutions
- Capture learnings for AADF framework

### Phase 5: Quality Validation
**Zero-Tolerance Gates**:
- [ ] All tests passing (`npm test`)
- [ ] TypeScript compilation successful (`npm run typecheck`)
- [ ] No console errors/warnings
- [ ] Evidence-based validation complete
- [ ] User approval obtained

### Phase 6: Archive & Document
**After user approval**:
1. Use project-organizer agent to archive execution plan
2. Update `@project-context/learnings/ai-agentic-development-framework.md` with:
   - New patterns discovered
   - Optimization insights
   - Tool coordination learnings
3. Clean up investigation directory

## 🚀 Smart Execution Principles

**Work Smart**:
- Context7 research FIRST (10x efficiency proven)
- Parallel execution for independent tasks
- Sequential execution only when dependencies exist
- Right agent for right job

**Work Fast**:
- Batch ALL parallel tasks in ONE message
- Use specialized agents for domain expertise
- Leverage MCP tools for efficiency

**Work Efficiently**:
- No redundant research or file reads
- Minimal context window usage
- Evidence-based decisions only

**Don't Break Things**:
- Quality gates before any changes
- Test coverage validation
- TypeScript strict mode
- Incremental validation

## 📊 Report Format

After execution, provide concise summary:
```markdown
## Execution Summary
- **Tasks Completed**: X/Y
- **Time**: Estimated vs Actual
- **Efficiency Gains**: Context7 research saved Z hours
- **Quality**: All gates passed ✅
- **Learnings**: [key insights for AADF framework]
- **Next Steps**: [if any follow-up needed]
```

## Example Usage
```bash
/aadf-work-smart "Implement offline sync for camera deployments with SQLite and Supabase integration"
```

This command will:
1. Research react-native-sqlite, Supabase sync patterns via Context7
2. Break into parallel tasks (DB schema, sync service, tests)
3. Execute with mobile-dev, backend-architect, qa-engineer agents
4. Track progress in investigation document
5. Validate quality gates
6. Archive after approval
