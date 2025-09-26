# Claude Code Configuration - SPARC Development Environment

## 🚨 CRITICAL: CONCURRENT EXECUTION & FILE MANAGEMENT

**ABSOLUTE RULES**:
1. ALL operations MUST be concurrent/parallel in a single message
2. **NEVER save working files, text/mds and tests to the root folder**
3. ALWAYS organize files in appropriate subdirectories
4. **MANDATORY**: Follow Evidence-Based Development - verify all assumptions with Context7 research FIRST

### ⚡ GOLDEN RULE: "1 MESSAGE = ALL RELATED OPERATIONS"

**MANDATORY PATTERNS:**
- **TodoWrite**: ALWAYS batch ALL todos in ONE call (5-10+ todos minimum)
- **Task tool**: ALWAYS spawn ALL agents in ONE message with full instructions
- **File operations**: ALWAYS batch ALL reads/writes/edits in ONE message
- **Bash commands**: ALWAYS batch ALL terminal operations in ONE message
- **Memory operations**: ALWAYS batch ALL memory store/retrieve in ONE message

### 📁 File Organization Rules

**NEVER save to root folder. Use these directories:**
- `/src` - Source code files
- `/tests` - Test files
- `/project-context` - Documentation and markdown files in relation to app development
- `/documentation` - Documentation and markdown files for developer reference (technical and reference)
- `/config` - Configuration files
- `/scripts` - Utility scripts
- `/examples` - Example code

## Project Overview

**Wildlife Watcher Mobile App** - React Native field deployment tool for wildlife camera management with offline-first architecture.

This project uses SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) methodology with Claude-Flow orchestration for systematic Test-Driven Development.

### MVP2 Architecture & Features
- **Architecture**: Offline-first with Supabase backend, BLE + LoRaWAN device communication, organisation multi-tenancy
- **Key Features**: 6-step deployment wizard, project management, real-time sync, WW Admin user provisioning (MVP)
- **User Roles**: ww_admin (global), project_admin (org-scoped), project_member (project-scoped)
- **LoRaWAN Integration**: battery_level, sd_card_usage webhook monitoring
- **Testing Framework**: Maestro TDD/BDD with comprehensive test coverage
- **Development Methodology**: SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) with TDD

### Where to Find Task Information
- **Current Task Status**: Check `@project-context/superclaude-task-management.md`
- **Task Dependencies**: See `@project-context/task-context-preservation.json`
- **Development Progress**: Review `@project-context/learnings/claude-flow-usage-log.md`
- **Task Specifications**: Located in `@project-context/development-context/MVP2/tasks/`

## SPARC Commands

### Core Commands
- `npx claude-flow sparc modes` - List available modes
- `npx claude-flow sparc run <mode> "<task>"` - Execute specific mode
- `npx claude-flow sparc tdd "<feature>"` - Run complete TDD workflow
- `npx claude-flow sparc info <mode>` - Get mode details

### Build Commands
- `npm run build` - Build project
- `npm run test` - Run tests  
- `npm run lint` - Linting
- `npm run typecheck` - Type checking

### MVP2 Specific Commands
- `npx claude-flow@alpha hive-mind init` - Initialize intelligent swarm coordination
- `npx claude-flow@alpha sparc tdd "feature"` - Run TDD workflow for MVP features
- `npx claude-flow@alpha task_orchestrate --strategy parallel` - Coordinate parallel development

## SPARC Workflow Phases

1. **Specification** - Requirements analysis
2. **Pseudocode** - Algorithm design
3. **Architecture** - System design
4. **Refinement** - TDD implementation
5. **Completion** - Integration

## Code Style & Best Practices

- **Modular Design**: Files under 500 lines
- **Environment Safety**: Never hardcode secrets
- **Test-First**: Write tests before implementation
- **Clean Architecture**: Separate concerns
- **Documentation**: Keep updated

## 🔴 CRITICAL: Quality Control Standards

### **MANDATORY DISCOVERY PHASE - NO EXCEPTIONS:**
- **✅ ALWAYS read `/src/types/` directory FIRST before ANY test or code**
- **✅ ALWAYS use `Read` tool to examine actual interfaces and types**
- **✅ ALWAYS use `Grep` tool to verify method signatures in existing services**
- **✅ ALWAYS check actual implementations vs assumptions**

**❌ DISCOVERY PHASE VIOLATIONS - ZERO TOLERANCE:**
- **❌ NEVER assume interface names or method signatures**
- **❌ NEVER create types that already exist in codebase**
- **❌ NEVER write tests without reading actual service implementations**
- **❌ NEVER import types without verifying they exist and are correct**

### **TEST INTEGRITY - ZERO TOLERANCE:**
- **❌ NEVER skip, delete, or modify tests without explicit user approval**
- **❌ NEVER use `.skip()`, `.todo()`, or comment out tests as shortcuts**
- **❌ NEVER change test expectations to make failing tests pass**
- **❌ NEVER reduce test coverage or scope without justification**

### **TDD/BDD METHODOLOGY - MANDATORY:**
- **✅ ALWAYS write tests BEFORE implementation** (true TDD)
- **✅ ALWAYS follow Red-Green-Refactor cycle**
- **✅ ALWAYS ensure tests validate actual business requirements**
- **✅ ALWAYS implement code to satisfy tests, not modify tests to satisfy code**

### **TYPE SAFETY & CONTRACT VALIDATION:**
- **✅ ALWAYS verify method signatures before using external services**
- **✅ ALWAYS check actual interface contracts vs assumed interfaces**
- **✅ ALWAYS validate database service methods exist before calling them**
- **✅ ALWAYS use TypeScript strict mode and resolve ALL type errors**

### **QUALITY GATES - MUST PASS:**
1. **Test Gate**: 100% of tests must pass without modifications
2. **Type Gate**: Zero TypeScript errors allowed
3. **Integration Gate**: All service calls must use correct method signatures
4. **TDD Gate**: Implementation must satisfy original test requirements
5. **Evidence Gate**: All implementation decisions backed by Context7 research (NEW)
6. **UUID Consistency Gate**: All UUID handling must maintain string types throughout (CRITICAL for Task 11.8)


## 📚 Reference Documentation

### Testing & Quality Control
See `@project-context/testing-standards.md` for:
- Comprehensive testing methodology
- TestID patterns and conventions
- Test structure and organization
- Commit strategies

### Agent Reference
See `@project-context/agent-reference.md` for:
- Complete list of 54+ available agents
- Agent descriptions and capabilities
- Agent selection guidelines
- Coordination patterns

### SuperClaude Architecture
See `@project-context/superclaude-architecture.md` for:
- How SuperClaude integrates with Claude Code
- Task management commands
- Context preservation features
- Session recovery mechanisms

### Command Examples
See `@project-context/command-examples.md` for:
- Execution patterns and examples
- Agent coordination protocols
- MCP tool categories
- Performance benefits

## 🎯 Tool Selection Hierarchy (Evidence-Based)

### 1. Context7 MCP - MANDATORY FIRST (Research Phase)
**ALWAYS use BEFORE implementation** - Proven 10x efficiency improvement
- Documentation research and vendor-specific patterns
- Eliminates false solution paths and assumption-based debugging
- **Evidence**: Backend achieved 15-minute solutions vs 2.5-hour debugging

### 2. Claude Code - PRIMARY EXECUTION
- File operations (Read, Write, Edit, MultiEdit, Glob, Grep)
- Code generation and programming
- Bash commands and system operations
- Implementation work and testing
- TodoWrite and task management
- Git operations and package management

### 3. Specialized Task Agents - DOMAIN EXPERTISE
- `mobile-dev` - React Native/Expo development
- `supabase-schema-architect` - Database schema management
- `quality-assurance-engineer` - Testing strategy
- **Use when**: Domain-specific expertise required

### 4. MCP Tools - COORDINATION ONLY
- Planning and orchestration
- Memory management and persistence
- Performance tracking and metrics
- GitHub integration and workflows

**PROVEN WORKFLOW**: Context7 Research → Claude Code Implementation → Specialized Agents → MCP Coordination

## 🚀 Quick Setup

```bash
# Add Claude Flow MCP server
claude mcp add claude-flow npx claude-flow@alpha mcp start

# Add Serena MCP server for enhanced development
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env
uvx --from git+https://github.com/oraios/serena serena start-mcp-server
```

## 📦 MCP Tools Available

### Context7 - Library Documentation (MANDATORY FIRST STEP)
**When to use**: ALWAYS before ANY implementation - verified 10x efficiency improvement
- `mcp__context7__resolve-library-id` - Find library ID from name
- `mcp__context7__get-library-docs` - Fetch comprehensive docs with examples

**Evidence-Based Pattern**:
```javascript
// MANDATORY: Research BEFORE implementation
// Backend Success: 2.5 hours → 15 minutes debugging via Context7
mcp__context7__resolve-library-id({ libraryName: "react-native-sqlite" })
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/resolved/library",
  topic: "uuid-handling",
  tokens: 15000
})
```

**Example**: Getting React Native, Expo, or SQLite documentation - PROVEN to eliminate false solution paths

### IDE Integration
**When to use**: Need TypeScript/linting diagnostics or run code in notebooks
- `mcp__ide__getDiagnostics` - Get VS Code language diagnostics
- `mcp__ide__executeCode` - Execute Python in Jupyter notebooks

### Playwright Browser Automation
**When to use**: Testing web interfaces or browser-based interactions
- `mcp__playwright__browser_*` - Full browser control (navigate, click, snapshot, etc.)
- Useful for E2E testing of web components or documentation sites

### Supabase MCP - Database & Backend
**When to use**: Managing Supabase database, migrations, and edge functions
- `mcp__supabase__list_tables`, `mcp__supabase__execute_sql` - Database operations
- `mcp__supabase__list_migrations`, `mcp__supabase__apply_migration` - Schema management
- `mcp__supabase__list_edge_functions`, `mcp__supabase__deploy_edge_function` - Serverless functions
- `mcp__supabase__generate_typescript_types` - Generate types from schema
- `mcp__supabase__search_docs` - Search Supabase documentation

### Serena MCP - Enhanced Development
**When to use**: Complex code analysis and intelligent editing
- **Symbolic Code Analysis** - Understand structure without reading entire files
- **Intelligent Editing** - Precise modifications using symbols and regex
- **Cross-Project Memory** - Persistent knowledge across sessions
- **Advanced Search** - Pattern-based code discovery
- **Enhanced File Operations** - Semantic understanding

### Tool Coordination Strategy
- **Claude Code**: Primary for file ops, bash, git, npm, testing
- **Context7**: Library documentation and examples
- **IDE MCP**: TypeScript validation and diagnostics
- **Playwright**: Browser automation and web testing
- **Serena**: Advanced code analysis and memory
- **Combined**: Optimal workflow for complex implementations

## 📋 Project Context & Documentation

### Development Context
The `@project-context/development-context/` contains critical project specifications:

**MVP2 Documentation** (`/MVP2/`):
- **Implementation Spec**: `implementation-spec-v1.4.md` - Core MVP2 requirements
- **Task Plan**: `TASK-RESTRUCTURING-PLAN.md` - 23-task breakdown
- **Claude Flow Plan**: `claude-flow-implementation-plan.md` - Development methodology
- **API Guide**: `API-INTEGRATION-GUIDE.md` - Supabase integration patterns
- **Component Patterns**: `COMPONENT-IMPLEMENTATION-PATTERNS.md` - UI/UX standards
- **Testing Requirements**: `TESTING-REQUIREMENTS.md` - Test coverage specs
- **Task Files**: `/tasks/` - Individual task specifications (task_001.txt - task_023.txt)

**Project Progress Tracker Dashboard** (`/project-progress-tracker/`):
- **Dashboard Location**: `@project-context/development-context/project-progress-tracker/`
- **Purpose**: Production-ready web dashboard for MVP2 development tracking
- **Access**: http://localhost:3333 (run `./start.sh` from dashboard directory)
- **Features**: Real-time task progress, development streams monitoring, cross-project coordination
- **Context Prompt**: `DASHBOARD-CONTEXT-PROMPT.md` - Complete dashboard documentation

**Supabase Backend** (`/supabase-backend/`):
- **Backend Project Location**: `/home/adarsh/dev/wildlifeai/wildlife-watcher-backend` (separate Git repository)
- **Backend Project Status**: `~/wildlife-watcher-backend/project-context/PROJECT-STATUS.md` - Live backend status
- **Backend Configuration**: `~/wildlife-watcher-backend/CLAUDE.md` - Backend development guide
- **Database Tasks**: `~/wildlife-watcher-backend/project-context/MVP2-Tasks/` - Cross-project task communication
- **Database Info**: `database-information.md` - Schema and structure (local copy)
- **Integration Progress**: `supabase-integration-progress.md` - Backend status (local copy)
- **Type Definitions**: `supabase.ts` - Generated types

### 📝 Documents to Keep Updated

**ALWAYS UPDATE** these documents as you work:
1. **Task Progress**: `@project-context/superclaude-task-management.md`
   - Mark tasks as completed
   - Update blockers and dependencies
   - Record implementation decisions

2. **Learning Log**: `@project-context/learnings/claude-flow-usage-log.md`
   - Document patterns discovered
   - Record problem solutions
   - Capture best practices

3. **Task Context**: `@project-context/task-context-preservation.json`
   - Save implementation state
   - Preserve decision context
   - Enable session recovery

4. **Integration Progress**: When working on backend
   - Update `supabase-integration-progress.md`
   - Document API changes
   - Record migration status

5. **Cross-Project Database Tasks**: When database changes are needed
   - Create/update task files in `~/wildlife-watcher-backend/project-context/MVP2-Tasks/`
   - Reference backend project status at `~/wildlife-watcher-backend/project-context/PROJECT-STATUS.md`
   - Follow backend development patterns from `~/wildlife-watcher-backend/CLAUDE.md`

6. **📊 METRICS TRACKING (CRITICAL)**: `@project-context/MVP2-Tasks/MVP2-METRICS-TRACKER.md`
   - **MANDATORY**: Record actual vs estimated hours for EVERY task
   - **Track Start/End Times**: Capture precise durations for accuracy
   - **Categorize Work Type**: UI, Backend, Testing, Debugging, Documentation
   - **Update Daily**: Activity logs and velocity metrics
   - **Variance Analysis**: Document why tasks took more/less time than estimated
   - **Technology Time**: Track hours spent on each technology/framework
   - **AI Agent Efficiency**: Record time saved using agents/MCP tools
   - **Blockers & Solutions**: Document what caused delays and how resolved
   - This data is CRITICAL for understanding real development velocity and improving future estimates

### 🎯 MVP2 Development Roadmap & Current Status

#### Primary Execution Plan
**`@project-context/MVP2-Tasks/MVP2-MASTER-EXECUTION-PLAN.md`** - FOLLOW THIS PLAN
- Complete task breakdown with dependencies and execution order
- 3 Parallel Streams ready to launch (Project Management, Deployment, Devices & Maps)
- Agent assignments and resource allocation for each task
- 20-day realistic timeline with quality gates
- Next immediate tasks: Complete Task 11.4-11.7, then launch parallel streams

#### Current Status (September 17, 2025)
- **Foundation Layer**: 50% COMPLETE ✅
  - Tasks 1-10: DONE (Expo migration, Auth, Redux)
  - Task 11.8: DONE (UUID alignment completed)
  - Task 11.3: DONE (OfflineService.ts discovered complete)
  - Task 11.4-11.7: PENDING (8-12 hours remaining)
- **Parallel Streams**: READY TO LAUNCH
- **Estimated Completion**: 20 working days from stream launch

### 📂 Task Tracking Documents

1. **`@project-context/superclaude-task-management.md`**
   - Legacy task tracker with SuperClaude commands
   - Contains Task 11 detailed breakdown
   - Historical context and decisions

2. **`@project-context/MVP2-Tasks/MVP2-MASTER-EXECUTION-PLAN.md`** ⭐ PRIMARY
   - **THIS IS THE MAIN PLAN TO FOLLOW**
   - Complete task list (Tasks 12-23) with dependencies
   - Stream assignments (A, B, C) and parallel execution strategy
   - Agent allocations and quality gates
   - Timeline and milestones

3. **`@project-context/MVP2-Tasks/MVP2-METRICS-TRACKER.md`** 📊 CRITICAL
   - Track actual vs estimated hours for EVERY task
   - Work category analysis (UI, Backend, Testing, etc.)
   - Variance tracking and efficiency metrics
   - Daily activity logs
   - **MUST UPDATE after each task/work session**

4. **`@project-context/development-context/MVP2/tasks/`**
   - Individual task specification files (task_001.txt through task_023.txt)
   - Detailed requirements for each task
   - Testing strategies and acceptance criteria

5. **`@project-context/task-context-preservation.json`**
   - Session state preservation
   - Implementation context between sessions
   - Decision history

### 🚀 Ready to Work Checklist

✅ **Execution Plan Ready**: MVP2-MASTER-EXECUTION-PLAN.md defines all work
✅ **Metrics Tracking Ready**: MVP2-METRICS-TRACKER.md for time tracking
✅ **Task Specifications Available**: All 23 tasks documented
✅ **Agent Assignments Done**: Each task has assigned agent type
✅ **Dependencies Mapped**: Clear execution order defined
✅ **Quality Gates Defined**: Success criteria for each phase

### 📋 Next Immediate Actions (In Order)

1. **Complete Task 11.4-11.7** (8-12 hours)
   - Conflict resolution, advanced sync, performance, testing
   - Non-blocking but good to complete foundation

2. **Launch Parallel Streams** (Begin simultaneously)
   - Stream A: Tasks 12-14 (Project Management) - 18 hours
   - Stream B: Tasks 15-17 (Deployment Workflows) - 24 hours
   - Stream C: Tasks 18-20 (Devices & Maps) - 30 hours

3. **Integration Phase** (After streams complete)
   - Tasks 21-23: Testing, Optimization, Production Prep - 16 hours

### ⚡ Development Protocol

1. **Before Starting Any Task**:
   - Check MVP2-MASTER-EXECUTION-PLAN.md for requirements
   - Note start time in MVP2-METRICS-TRACKER.md
   - Review task specification file in development-context/MVP2/tasks/

2. **During Development**:
   - Track actual time spent
   - Note any blockers or issues
   - Document decisions made

3. **After Completing Task**:
   - Update MVP2-METRICS-TRACKER.md with actual hours
   - Mark complete in execution plan
   - Commit code with descriptive message
   - Update variance analysis if significantly different from estimate

## Important Instructions

- Reference task details in `@project-context/development-context/MVP2/tasks/` before implementation
- Check in files to git regularly at sensible points (after each subtask completion)
- Update progress documentation after completing each task/feature/subtask
- Preserve implementation context for session recovery

## Support

- Documentation: https://github.com/ruvnet/claude-flow
- Issues: https://github.com/ruvnet/claude-flow/issues

## 🧬 AI Agentic Development Framework (AADF)

### **Living Framework Documentation**
**CRITICAL:** This project serves as the primary development laboratory for the **AI Agentic Development Framework (AADF)** - a comprehensive methodology for AI-orchestrated software development.

**Framework Document Locations:** 
- **Core Framework:** `@project-context/learnings/ai-agentic-development-framework.md`
- **Philosophical Foundations:** `@project-context/learnings/philosophical-foundations-aadf.md`

### **Framework Maintenance Directive**
**MANDATORY:** Update the AADF document with ALL discoveries, patterns, optimizations, and learnings encountered during development:

**Update Triggers:**
- New successful coordination patterns discovered
- Quality gate refinements and improvements  
- Tool integration insights and optimizations
- Performance breakthrough discoveries
- Template scaffolding pattern improvements
- Cross-project learning integration opportunities

**Update Categories:**
- **Behavioral Patterns:** SuperClaude optimization discoveries
- **Orchestration Insights:** Claude Flow workflow improvements
- **Tool Coordination:** MCP integration pattern refinements
- **Quality Standards:** Zero-tolerance gate enhancements
- **Performance Metrics:** Efficiency measurement improvements
- **Template Evolution:** Scaffolding pattern discoveries
- **Philosophical Foundations:** Epistemological and ontological insights
- **Applied Philosophy:** Practical philosophical applications in development

### **Framework Evolution Responsibility**
Every developer/session MUST contribute to framework evolution by:
1. **Documenting New Patterns:** Record successful workflows immediately
2. **Recording Optimization Insights:** Capture performance improvements
3. **Updating Quality Standards:** Refine validation gates based on learnings
4. **Enhancing Tool Integration:** Document MCP coordination discoveries
5. **Template Pattern Discovery:** Identify reusable scaffolding patterns
6. **Philosophical Integration:** Document epistemological and ontological insights
7. **Applied Philosophy:** Record practical philosophical applications in development

**Goal:** Create a comprehensive, battle-tested framework that can be packaged into a `create-aadf-app` equivalent for future projects.

## 🔗 Cross-Project Integration Insights (Backend Learnings)

### **Reality-First Testing Methodology (CRITICAL LEARNING)**
**DISCOVERED**: Backend spent 2+ days building elaborate test infrastructure instead of testing real user behavior
**IMPACT**: False security alerts and massive time waste vs feature delivery

### **MANDATORY TESTING PRIORITY ORDER:**
1. **User Journey Tests FIRST** (Real API + Real Auth + Real Database)
2. **Integration Tests SECOND** (Feature-Level Validation)
3. **Unit Tests LAST** (Only Complex Business Logic)

### **Mobile App Application:**
- Task 11.3 OfflineService.ts: Test with **real Supabase sync operations**
- Avoid elaborate SQLite mocking - use real database operations
- **Red Flag**: If test setup time > implementation time = WRONG approach

### **Database Schema Consistency (UUID Critical)**
**Backend Confirmed**: Supabase UUIDs must remain string types throughout entire system
**Mobile Requirements**:
- SQLite must handle UUID strings consistently (Task 11.8)
- No number conversion anywhere in the data flow
- Database sync operations must maintain UUID string integrity
- **Breaking Change**: Users must re-login after Task 11.8 completion

### **Evidence-Based Development Results (Context7 Success)**
**Backend Measured Results**:
- **Debugging Efficiency**: 10x improvement (2.5 hours → 15 minutes)
- **False Solution Elimination**: 100% (avoided 4 major debugging paths)
- **Documentation Access**: 38,009+ vendor-specific code snippets vs 0 general sources
- **Solution Quality**: Official patterns vs custom workarounds

### **Cross-Project Coordination Status**
**Backend**: 98% deployment ready (Phase 2 AADF complete)
**Mobile**: Task 11.8 UUID alignment required before proceeding
**Integration**: Backend ready for mobile app development continuation

---

Remember: **Evidence-Based Research → Specialized Implementation → Quality Validation!**