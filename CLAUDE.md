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

### File Organization Rules

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
- **Key Features**: 6-step deployment wizard, project management, real-time sync, WW Admin read-only access + web portal navigation (MVP)
- **User Roles**: ww_admin (global), project_admin (org-scoped), project_member (project-scoped)
- **LoRaWAN Integration**: battery_level, sd_card_usage webhook monitoring
- **Testing Framework**: Maestro TDD/BDD with comprehensive test coverage
- **Development Methodology**: SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) with TDD

### Where to Find Task Information
- **Current Task Status**: Check `@project-context/development-context/MVP2/implementation/execution/MVP2-METRICS-TRACKER.md` or live dashboard at http://localhost:3333
- **Current Strategy**: See `@project-context/development-context/MVP2/implementation/execution/MVP2-MASTER-EXECUTION-PLAN.md`
- **Development Progress**: Review `@project-context/learnings/claude-flow-usage-log.md`
- **Task Specifications**: Located in `@project-context/development-context/MVP2/implementation/tasks/`
- **Archived State Files**: See `@project-context/development-context/MVP2/archive/` for legacy tracking files

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

## ⚡ CRITICAL: Backend-Mobile Type Sync

**MANDATORY WORKFLOW**: After ANY backend schema changes (migrations, functions, tables, views), IMMEDIATELY regenerate mobile types with `npm run types:local` before writing ANY mobile code. Pre-commit hook will block commits if types are stale. Prevents runtime function signature mismatches and type errors.

**Type Sync Commands** (run from mobile repo):
```bash
npm run types:local         # Generate types from backend's local Supabase
npm run types:check-local   # Validate types are current (< 5 seconds)
npm run validate:local      # Full pre-commit validation workflow
```

**Backend Reference Types**: Backend maintains authoritative types at `~/dev/wildlifeai/wildlife-watcher-backend/project-context/database.types.ts` for cross-validation.

**Implementation Note**: Commands run Supabase CLI from backend repo (where `supabase/config.toml` exists), output to mobile repo. Mobile repo doesn't need Supabase project configuration.

**Docs**: See `@project-context/learnings/local-dev-sync-workflow.md` (workflow) and `@project-context/learnings/supabase-type-consistency-strategy.md` (production automation). Test results: `@project-context/learnings/type-sync-workflow-test-results.md`

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
7. **Backend Sync Gate**: After ANY backend schema changes, ALWAYS regenerate types with `npm run types:local` and validate with `npm run types:check-local` before writing mobile code. Cross-validate against backend's `database.types.ts` if needed (CRITICAL - see `@project-context/learnings/local-dev-sync-workflow.md`)


## 📚 Reference Documentation

### Testing & Quality Control
See `@project-context/development-context/MVP2/implementation/guides/testing-standards.md` for:
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

## Tool Selection Hierarchy (Evidence-Based)

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

## Quick Setup

```bash
# Add Claude Flow MCP server
claude mcp add claude-flow npx claude-flow@alpha mcp start

# Add Serena MCP server for enhanced development
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env
uvx --from git+https://github.com/oraios/serena serena start-mcp-server
```

## MCP Tools Available

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

## Project Context & Documentation

### Development Context
The `@project-context/development-context/` contains critical project specifications:

**MVP2 Documentation** (`/MVP2/`):
- **Primary Specification**: `implementation-spec-v1.4.md` - **AUTHORITATIVE SOURCE** for all MVP2 requirements, architecture, and cross-project coordination (17.5k tokens - read when needed)
- **User Roles Specification**: `specifications/user-roles-permissions.md` - 4-tier RBAC system definitions
- **Task Breakdown**: `implementation/guides/task-restructuring-plan.md` - 23-task implementation structure
- **Current Execution Strategy**: `MVP2-MASTER-EXECUTION-PLAN.md` - Live development methodology (check for latest approach)
- **Testing Requirements**: `implementation/guides/testing-requirements.md` - Test coverage specifications
- **API Integration**: `implementation/guides/api-integration-guide.md` - Supabase integration patterns
- **Component Patterns**: `implementation/guides/component-patterns.md` - UI/UX standards
- **Task Specifications**: `implementation/tasks/` - Individual task details (task_001.txt - task_023.txt)

**Note**: Implementation spec is in `.claudeignore` to save context. Read `@project-context/development-context/MVP2/implementation-spec-v1.4.md` when starting new tasks or need architecture details.

**Project Progress Tracker Dashboard** (`/project-progress-tracker/`):
- **Dashboard Location**: `@project-context/development-context/project-progress-tracker/`
- **Purpose**: Production-ready web dashboard for MVP2 development tracking
- **Access**: http://localhost:3333 (run `./start.sh` from dashboard directory)
- **Features**: Real-time task progress, development streams monitoring, cross-project coordination
- **Context Prompt**: `DASHBOARD-CONTEXT-PROMPT.md` - Complete dashboard documentation

**Supabase Backend** (`/supabase-backend/`):
- **Source Repository**: `~/dev/wildlifeai/wildlife-watcher-backend` (**separate Git repository**)
- **Integration Architecture**: Read `@project-context/development-context/MVP2/implementation-spec-v1.4.md` for backend coordination requirements
- **Live Backend Status**: `~/wildlife-watcher-backend/project-context/PROJECT-STATUS.md`
- **Cross-Project Tasks**: `~/wildlife-watcher-backend/project-context/MVP2-Tasks/` - Task communication
- **Local Integration Docs**: `@project-context/development-context/supabase-backend/` - Reference documentation
- **Generated Types**:
  - Mobile: `src/types/supabase.ts` - Generated from backend's local Supabase
  - Backend Reference: `~/wildlife-watcher-backend/project-context/database.types.ts` - Authoritative type reference for cross-validation

### Documents to Keep Updated

**ALWAYS UPDATE** these documents as you work:
1. **Metrics Tracker**: `@project-context/development-context/MVP2/implementation/execution/MVP2-METRICS-TRACKER.md`
   - Record actual vs estimated hours for every task
   - Track start/end times for accuracy
   - Update completion status and variance analysis
   - Document blockers and solutions

2. **Learning Log**: `@project-context/learnings/claude-flow-usage-log.md`
   - Document patterns discovered
   - Record problem solutions
   - Capture best practices

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

### MVP2 Development Information Sources

#### Current Status & Progress
- **Live Dashboard**: Project Progress Tracker at http://localhost:3333
- **Execution Strategy**: `@project-context/development-context/MVP2/implementation/execution/MVP2-MASTER-EXECUTION-PLAN.md` (**check for current methodology**)
- **Progress Tracking**: `@project-context/development-context/MVP2/implementation/execution/MVP2-METRICS-TRACKER.md`
- **Task Details**: Individual specs in `@project-context/development-context/MVP2/implementation/tasks/`

#### Information Hierarchy
| Document | Authority Level | Purpose |
|----------|----------------|----------|
| `implementation-spec-v1.4.md` | **PRIMARY SOURCE** | All requirements & architecture (read when needed) |
| `MVP2-MASTER-EXECUTION-PLAN.md` | **CURRENT STRATEGY** | Live execution methodology |
| Project Progress Tracker | **REAL-TIME STATUS** | Live progress monitoring |
| `MVP2-METRICS-TRACKER.md` |**TIME TRACKING** | Velocity & variance analysis |

### Task Information Sources

| Document | Purpose | When to Use |
|----------|---------|-------------|
| `implementation/execution/MVP2-MASTER-EXECUTION-PLAN.md` | **Primary execution strategy** | Before starting any work |
| `implementation/execution/MVP2-METRICS-TRACKER.md` | **Time tracking & velocity** | Start/end of tasks |
| `implementation/tasks/` | **Individual task specs** | During implementation |
| Project Progress Tracker | **Live status dashboard** | Continuous monitoring |
| Archived state files | Legacy context (see MVP2/archive/) | Historical reference only |

### Ready to Work Resources

✅ **Requirements**: Read `@project-context/development-context/MVP2/implementation-spec-v1.4.md` for complete architecture
✅ **Current Strategy**: `implementation/execution/MVP2-MASTER-EXECUTION-PLAN.md` shows live methodology
✅ **Live Monitoring**: Project Progress Tracker provides real-time status
✅ **Task Specifications**: All 23 tasks documented in `implementation/tasks/` directory
✅ **Quality Standards**: Defined in current execution strategy document

### Current Actions (Always Check Live Sources)

- **What's Next**: Check Project Progress Tracker dashboard for current priorities
- **Execution Strategy**: Consult `implementation/execution/MVP2-MASTER-EXECUTION-PLAN.md` for latest methodology
- **Task Details**: Review specific task files in `implementation/tasks/`
- **Track Progress**: Update `implementation/execution/MVP2-METRICS-TRACKER.md` with time spent

### Cross-Project Coordination

| Information Source | Purpose | Authority Level |
|-------------------|---------|----------------|
| `implementation-spec-v1.4.md` | **Backend integration requirements** | **PRIMARY** (read when needed) |
| Project Progress Tracker | **Cross-project status dashboard** | 📊 Real-time |
| `~/wildlife-watcher-backend/project-context/` | **Backend project status** | ✅ Live status |

### Development Protocol

**Before Any Task**:
1. **Check Current Status**: View Project Progress Tracker dashboard
2. **Review Strategy**: Consult `MVP2-MASTER-EXECUTION-PLAN.md` for current methodology
3. **Get Requirements**: Read `@project-context/development-context/MVP2/implementation-spec-v1.4.md` and specific task file
4. **Start Tracking**: Note start time in `MVP2-METRICS-TRACKER.md`

**During Development**:
- Follow current execution strategy (incremental/parallel/hybrid)
- Track time and document any blockers
- Adhere to quality gates defined in execution plan

**After Task Completion**:
- Update metrics tracker with actual time spent
- Monitor progress via dashboard
- Commit with descriptive messages
- Check cross-project coordination status if applicable

## Important Instructions

- Reference task details in `@project-context/development-context/MVP2/implementation/tasks/` before implementation
- Check in files to git regularly at sensible points (after each subtask completion)
- Update progress documentation after completing each task/feature/subtask
- Preserve implementation context for session recovery

## Support

- Documentation: https://github.com/ruvnet/claude-flow
- Issues: https://github.com/ruvnet/claude-flow/issues

## AI Agentic Development Framework (AADF)

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

## Cross-Project Integration Insights (Backend Learnings)

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

## Task Alignment Protocol

**Before starting ANY MVP2 task or subtask:**
1. **Read Implementation Spec**: `@project-context/development-context/MVP2/implementation-spec-v1.4.md`
2. **Read Task File**: Corresponding file in `@project-context/development-context/MVP2/implementation/tasks/`
3. **Check Master Plan**: `@project-context/MVP2-Tasks/MVP2-MASTER-EXECUTION-PLAN.md`
4. **Verify Alignment**: Cross-reference with:
   - `specifications/user-roles-permissions.md`
   - `specifications/admin-portal-spec.md`
5. **Flag Inconsistencies**: Report any discrepancies to user for clarification

This ensures the task/subtask aligns with latest specifications and architecture decisions.