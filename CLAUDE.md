# Claude Code Configuration - SPARC Development Environment

## 🚨 CRITICAL: CONCURRENT EXECUTION & FILE MANAGEMENT

**ABSOLUTE RULES**:
1. ALL operations MUST be concurrent/parallel in a single message
2. **NEVER save working files, text/mds and tests to the root folder**
3. ALWAYS organize files in appropriate subdirectories

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

### Batchtools Commands
- `npx claude-flow sparc batch <modes> "<task>"` - Parallel execution
- `npx claude-flow sparc pipeline "<task>"` - Full pipeline processing
- `npx claude-flow sparc concurrent <mode> "<tasks-file>"` - Multi-task processing

### Build Commands
- `npm run build` - Build project
- `npm run test` - Run tests  
- `npm run lint` - Linting
- `npm run typecheck` - Type checking

### MVP2 Specific Commands
- `npx claude-flow@alpha hive-mind init` - Initialize intelligent swarm coordination
- `npx claude-flow@alpha sparc tdd "feature"` - Run TDD workflow for MVP features
- `npx claude-flow@alpha task_orchestrate --strategy parallel` - Coordinate parallel development

### Task Management via SuperClaude
SuperClaude provides comprehensive task management capabilities through slash commands available in Claude Code sessions:

**SuperClaude Task Commands**:
```bash
# Current Task Focus
/task:current                 # Show current task status & requirements
/task:focus 11.3             # Deep dive into OfflineService.ts implementation
/task:break:11.3             # Smart breakdown into micro-tasks

# Implementation & Testing
/task:implement:offline      # Execute TDD implementation for offline service
/task:test:offline           # Run comprehensive test suite
/task:checkpoint:11.3        # Create implementation checkpoint

# Context Preservation & Recovery
/task:save:context           # Save current implementation state
/task:restore:context        # Restore with full context preservation
/task:resume:11.3            # Resume OfflineService.ts with preserved context

# Progress & Coordination
/task:status:foundation      # Check Foundation Layer (Tasks 9-11) progress
/task:ready:streams          # Assess parallel streams readiness (Tasks 12-23)
/task:swarm:prepare          # Initialize swarm coordination for post-Task 11
/task:update:progress        # Update project documentation with status
```

**Key Features**:
- ✅ **Smart Task Breakdown**: Automatic complexity analysis → micro-task creation
- ✅ **Context Preservation**: Working state saved across sessions with full implementation context
- ✅ **Session Recovery**: Resume from checkpoints with complete context restoration
- ✅ **Progress Tracking**: Real-time updates and intelligent blocker detection
- ✅ **Git Integration**: Branch management and automated checkpoint system
- ✅ **Swarm Coordination**: Prepare parallel development streams for Tasks 12-23

**Task Management System**:
- **SuperClaude Task Manager**: `@project-context/superclaude-task-management.md` - Complete orchestration system
- **Context Preservation**: `@project-context/task-context-preservation.json` - Session recovery with implementation state
- **Swarm Coordination**: `@project-context/swarm-coordination-strategy.md` - 3-stream parallel development strategy
- **Task Reference Files**: `@project-context/development-context/MVP2/tasks/` - Complete task backup (task_001.txt through task_023.txt)
- **Task Structure**: `@project-context/development-context/MVP2/tasks/tasks.json` - Complete task hierarchy

## SPARC Workflow Phases

1. **Specification** - Requirements analysis (`sparc run spec-pseudocode`)
2. **Pseudocode** - Algorithm design (`sparc run spec-pseudocode`)
3. **Architecture** - System design (`sparc run architect`)
4. **Refinement** - TDD implementation (`sparc tdd`)
5. **Completion** - Integration (`sparc run integration`)

## Code Style & Best Practices

- **Modular Design**: Files under 500 lines
- **Environment Safety**: Never hardcode secrets
- **Test-First**: Write tests before implementation
- **Clean Architecture**: Separate concerns
- **Documentation**: Keep updated

## 🔴 CRITICAL: Type System Alignment Rules

### **UUID vs Number ID Alignment (Task 11.8)**
**ABSOLUTE REQUIREMENTS**:
- **NEVER convert UUIDs to numbers**: Supabase UUIDs must remain as string types
- **NO Strapi legacy types**: All `src/redux/api/types.ts` references must be replaced with Supabase types  
- **SQLite UUID compliance**: All database operations must use UUID strings consistently
- **CRUD operation validation**: All database sync operations must be tested with UUIDs

### **TDD Regression Prevention Protocol**
**MANDATORY TESTING GATES**:
1. **NEVER skip failing tests** - Fix implementation, not test expectations
2. **Full test suite validation** after each phase - No regressions allowed
3. **TypeScript errors are blockers** - Zero tolerance for type assertions or `as any` usage
4. **Testing gate requirements**:
   - Phase 1: Full test suite + TypeScript compilation
   - Phase 2: Auth flow end-to-end tests + Login/Register integration  
   - Phase 3: Offline data creation + sync compatibility tests
   - Phase 4: Complete CRUD test suite validation
   - Phase 5: Redux state management + API integration tests

### **Quality Control Standards**
**ZERO TOLERANCE POLICIES**:
- **NO test modifications without root cause analysis** - Tests represent business requirements
- **NO commits without 100% pass rate** - Quality gates cannot be bypassed
- **NO type assertions or workarounds** - Fix the underlying type issues
- **NO progression to next phase** - Until current phase testing gate passes completely

### **Breaking Change Management**
**REQUIRED FOR TASK 11.8**:
- **Clear Redux persisted state** - Users will need to re-login after UUID alignment
- **Database migration script** - Existing SQLite data needs UUID conversion
- **Component updates** - All user.id references must be updated for string types
- **API layer alignment** - Ensure consistent UUID usage throughout integration points

## 🚨 STRICT QUALITY CONTROL RULES

### **ABSOLUTE PROHIBITIONS - NEVER ALLOWED:**

#### **1. MANDATORY DISCOVERY PHASE - NO EXCEPTIONS:**
- **✅ ALWAYS read `/src/types/` directory FIRST before ANY test or code**
- **✅ ALWAYS use `Read` tool to examine actual interfaces and types**
- **✅ ALWAYS use `Grep` tool to verify method signatures in existing services**
- **✅ ALWAYS check actual implementations vs assumptions**

**❌ DISCOVERY PHASE VIOLATIONS - ZERO TOLERANCE:**
- **❌ NEVER assume interface names or method signatures**
- **❌ NEVER create types that already exist in codebase**
- **❌ NEVER write tests without reading actual service implementations**
- **❌ NEVER import types without verifying they exist and are correct**

**MANDATORY DISCOVERY SEQUENCE:**
```bash
# PHASE 1: DISCOVER TYPES (ALWAYS FIRST)
1. Read /src/types/index.ts - Main type exports
2. Read /src/types/offline.ts - Offline-related types  
3. Read /src/types/supabase.ts - Backend types
4. Grep for service method signatures in actual files

# PHASE 2: VERIFY INTERFACES  
5. Read actual service files to check method names
6. Verify return types and parameters
7. Check existing Redux slice exports

# PHASE 3: WRITE REQUIREMENT-DRIVEN TESTS
8. Write tests based on REQUIREMENTS, not assumed implementations
9. Use ACTUAL types from codebase
10. Follow true Red-Green-Refactor
```

#### **2. TEST STRUCTURE - IMPLEMENTATION SPEC COMPLIANCE:**
- **✅ ALL tests MUST be in `/tests/` directory per implementation spec Section 3.1**
- **❌ NEVER create tests in `/src/test/` directory**
- **❌ NEVER use scattered `__tests__` directories in `/src/`**
- **❌ NEVER mix test structures - single source of truth only**

**CORRECT TEST STRUCTURE:**
```
/tests/                 # ONLY location for tests
├── maestro/           # UI automation tests  
├── unit/              # Unit tests
│   ├── services/      # Service tests
│   ├── redux/         # Redux tests
│   └── components/    # Component tests
└── __mocks__/         # Mock implementations
```

#### **3. TEST INTEGRITY - ZERO TOLERANCE:**
- **❌ NEVER skip, delete, or modify tests without explicit user approval**
- **❌ NEVER use `.skip()`, `.todo()`, or comment out tests as shortcuts**
- **❌ NEVER change test expectations to make failing tests pass**
- **❌ NEVER reduce test coverage or scope without justification**

**✅ REQUIRED ACTIONS FOR TEST ISSUES:**
1. **Root Cause Analysis**: Identify WHY the test is failing
2. **Fix Implementation**: Correct the actual code, not the test
3. **User Consultation**: If test modification is needed, explain WHY and get approval
4. **Documentation**: Document any test changes with clear justification

#### **4. TDD/BDD METHODOLOGY - MANDATORY:**
- **✅ ALWAYS write tests BEFORE implementation** (true TDD)
- **✅ ALWAYS follow Red-Green-Refactor cycle**
- **✅ ALWAYS ensure tests validate actual business requirements**
- **✅ ALWAYS implement code to satisfy tests, not modify tests to satisfy code**

#### **5. TYPE SAFETY & CONTRACT VALIDATION:**
- **✅ ALWAYS verify method signatures before using external services**
- **✅ ALWAYS check actual interface contracts vs assumed interfaces**
- **✅ ALWAYS validate database service methods exist before calling them**
- **✅ ALWAYS use TypeScript strict mode and resolve ALL type errors**

**❌ COMMON MISTAKES TO AVOID:**
- Assuming method names without checking actual implementation
- Using placeholder interfaces without verifying real service contracts
- Ignoring TypeScript errors as "minor issues"
- Making API calls based on documentation without checking actual methods

#### **6. INTEGRATION VERIFICATION PROTOCOL:**
**MANDATORY SEQUENCE BEFORE ANY INTEGRATION CODE:**
1. **Discovery Phase**: Read all types in `/src/types/`
2. **Interface Verification**: Read actual service files 
3. **Method Validation**: Use Grep to find exact method signatures
4. **Type Matching**: Ensure imported types match actual exports
5. **Mock Verification**: Ensure test mocks match real service behavior

**EXAMPLE - Correct Discovery Process:**
```typescript
// ✅ STEP 1: Read /src/types/offline.ts FIRST
// ✅ STEP 2: Read actual service file to verify methods
// ✅ STEP 3: Grep for method signatures
// ✅ STEP 4: Write tests using ACTUAL types and methods

// RESULT: Correct implementation using real interfaces
await this.databaseService.addToOfflineQueue(queueItem);
await this.databaseService.getPendingQueueItems();
```

#### **5. ERROR HANDLING - NO SILENT FAILURES:**
- **✅ ALWAYS address root cause of failures**
- **✅ ALWAYS provide meaningful error messages**
- **✅ ALWAYS implement proper retry/recovery mechanisms**
- **❌ NEVER suppress errors without proper handling**
- **❌ NEVER use try-catch blocks to hide problems**

#### **6. CODE REVIEW STANDARDS:**
**MANDATORY SELF-REVIEW CHECKLIST:**
- [ ] All tests pass without skipping or modification
- [ ] All TypeScript errors resolved
- [ ] All method calls verified against actual implementations
- [ ] All integration points tested with correct interfaces
- [ ] No hardcoded values or shortcuts
- [ ] Proper error handling implemented
- [ ] Documentation updated with changes

### **QUALITY GATES - MUST PASS:**
1. **Test Gate**: 100% of tests must pass without modifications
2. **Type Gate**: Zero TypeScript errors allowed
3. **Integration Gate**: All service calls must use correct method signatures
4. **TDD Gate**: Implementation must satisfy original test requirements

## 🚀 Available Agents (54 Total)

### Core Development
`coder`, `reviewer`, `tester`, `planner`, `researcher`

### Swarm Coordination
`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`, `collective-intelligence-coordinator`, `swarm-memory-manager`

### Consensus & Distributed
`byzantine-coordinator`, `raft-manager`, `gossip-coordinator`, `consensus-builder`, `crdt-synchronizer`, `quorum-manager`, `security-manager`

### Performance & Optimization
`perf-analyzer`, `performance-benchmarker`, `task-orchestrator`, `memory-coordinator`, `smart-agent`

### GitHub & Repository
`github-modes`, `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`, `workflow-automation`, `project-board-sync`, `repo-architect`, `multi-repo-swarm`

### SPARC Methodology
`sparc-coord`, `sparc-coder`, `specification`, `pseudocode`, `architecture`, `refinement`

### Specialized Development
`backend-dev`, `mobile-dev`, `ml-developer`, `cicd-engineer`, `api-docs`, `system-architect`, `code-analyzer`, `base-template-generator`

### Testing & Validation
`tdd-london-swarm`, `production-validator`

### Migration & Planning
`migration-planner`, `swarm-init`

## 🎯 Claude Code vs MCP Tools

### Claude Code Handles ALL:
- File operations (Read, Write, Edit, MultiEdit, Glob, Grep)
- Code generation and programming
- Bash commands and system operations
- Implementation work
- Project navigation and analysis
- TodoWrite and task management
- Git operations
- Package management
- Testing and debugging

### MCP Tools ONLY:
- Coordination and planning
- Memory management
- Neural features
- Performance tracking
- Swarm orchestration
- GitHub integration

**KEY**: MCP coordinates, Claude Code executes.

## 🚀 Quick Setup

```bash
# Add Claude Flow MCP server
claude mcp add claude-flow npx claude-flow@alpha mcp start

# Add Serena MCP server for enhanced development
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env
uvx --from git+https://github.com/oraios/serena serena start-mcp-server
```

## 🎯 Enhanced Development Tools

### Serena MCP Integration (Added 2025-08-31)
**Status**: ✅ Successfully integrated with 25 advanced coding tools

**Key Capabilities**:
- **Symbolic Code Analysis**: Understand code structure without reading entire files
- **Intelligent Editing**: Precise modifications using symbols and regex patterns
- **Cross-Project Memory**: Persistent knowledge across development sessions
- **Advanced Search**: Pattern-based code discovery with 20+ language support
- **Enhanced File Operations**: Semantic understanding for better code management

**Installation**:
```bash
# Global uvx installation for cross-project use
uvx --from git+https://github.com/oraios/serena serena start-mcp-server

# Web dashboard available at: http://127.0.0.1:24282/dashboard/index.html
# Configuration: /home/adarsh/.serena/serena_config.yml
```

**Available Serena Tools (25 total)**:
- File Operations: `read_file`, `create_text_file`, `list_dir`, `find_file`
- Code Analysis: `get_symbols_overview`, `find_symbol`, `find_referencing_symbols`
- Intelligent Editing: `replace_symbol_body`, `insert_after_symbol`, `insert_before_symbol`, `replace_regex`
- Memory Management: `write_memory`, `read_memory`, `list_memories`, `delete_memory`
- Search & Pattern: `search_for_pattern`
- Project Management: `activate_project`, `switch_modes`
- System: `execute_shell_command`, `onboarding`, `prepare_for_new_conversation`

**Tool Coordination Strategy**:
- **Claude Code**: Primary for bash commands, git, package management, testing
- **Serena MCP**: Enhanced for symbolic editing, code analysis, persistent memory
- **SuperClaude**: Task management, advanced commands, cognitive personas, development methodologies
- **Combined Power**: Optimal development workflow for complex implementations

## 🎯 SuperClaude Integration Architecture

### 📍 **Where SuperClaude Lives**

SuperClaude is installed in your **home directory**, not globally:

```bash
~/.claude/                    # This is where everything is
├── CLAUDE.md                # Main configuration file
├── shared/                  # YAML templates
│   ├── superclaude-core.yml
│   ├── superclaude-mcp.yml
│   ├── superclaude-personas.yml
│   └── superclaude-rules.yml
└── commands/                # Command definitions
```

### 🔗 **How It Integrates with Claude Code**

SuperClaude works through **configuration injection**:

1. **Not a system-wide installation** - It's just config files in `~/.claude/`
2. **Claude Code reads from `~/.claude/`** automatically
3. **No daemon/service running** - It's passive configuration
4. **No PATH modification needed** - Not an executable

### 🎯 **The Integration Mechanism**

When you type a command like `/build` in Claude Code:

```
You type: /build --react --magic
    ↓
Claude Code checks ~/.claude/
    ↓
Finds command definition in ~/.claude/commands/build.md
    ↓
Loads configuration from CLAUDE.md
    ↓
Applies personas, flags, and rules
    ↓
Claude responds with SuperClaude behavior
```

### 🖥️ **Is It Global?**

**No**, SuperClaude is:
- ✅ **User-specific**: Only in your user's home directory
- ✅ **Claude Code-specific**: Only affects Claude Code
- ❌ **Not system-wide**: Other users won't have it
- ❌ **Not in PATH**: Can't run from terminal
- ❌ **Not a binary**: Just text configuration files

### 🔍 **You Can Verify This**

```bash
# Check what's actually installed
ls -la ~/.claude/

# It's just text files - you can read them
cat ~/.claude/CLAUDE.md | head -20

# Nothing in system paths
which superclaude  # Should return nothing
echo $PATH | grep -i superclaude  # Should return nothing

# Not a running process
ps aux | grep -i superclaude  # Should return nothing
```

### 🛡️ **Security & Privacy**

- **100% local**: No network calls from SuperClaude itself
- **No telemetry**: Just passive config files
- **You control it**: Can delete with `rm -rf ~/.claude/`
- **Transparent**: All configs are readable text files

### 🎮 **How Claude Code "Knows" About It**

Claude Code has a built-in feature to read from `~/.claude/`:
1. Claude Code starts
2. Checks if `~/.claude/` exists
3. If yes, loads configurations
4. Applies them to Claude's behavior

This is why the installer just copies files - it doesn't need to modify Claude Code itself.

### 🔄 **Updates & Maintenance**

```bash
# Your SuperClaude is completely self-contained
cd ~/SuperClaude
git pull  # Gets updates
./install.sh --update  # Copies new files to ~/.claude/
```

### 💡 **Key Points**

1. **SuperClaude = Configuration files in `~/.claude/`**
2. **Not globally installed** - just in your home directory
3. **Only affects Claude Code** when it reads from `~/.claude/`
4. **No system modification** - completely removable
5. **Works through Claude Code's config loading** feature

Think of it like custom CSS for a website - it doesn't change the browser, it just tells the browser how to display things differently. SuperClaude doesn't change Claude Code, it just gives it different instructions on how to behave.

## MCP Tool Categories

### Coordination
`swarm_init`, `agent_spawn`, `task_orchestrate`

### Monitoring
`swarm_status`, `agent_list`, `agent_metrics`, `task_status`, `task_results`

### Memory & Neural
`memory_usage`, `neural_status`, `neural_train`, `neural_patterns`

### GitHub Integration
`github_swarm`, `repo_analyze`, `pr_enhance`, `issue_triage`, `code_review`

### System
`benchmark_run`, `features_detect`, `swarm_monitor`

## 📋 Agent Coordination Protocol

### Every Agent MUST:

**1️⃣ BEFORE Work:**
```bash
npx claude-flow@alpha hooks pre-task --description "[task]"
npx claude-flow@alpha hooks session-restore --session-id "swarm-[id]"
```

**2️⃣ DURING Work:**
```bash
npx claude-flow@alpha hooks post-edit --file "[file]" --memory-key "swarm/[agent]/[step]"
npx claude-flow@alpha hooks notify --message "[what was done]"
```

**3️⃣ AFTER Work:**
```bash
npx claude-flow@alpha hooks post-task --task-id "[task]"
npx claude-flow@alpha hooks session-end --export-metrics true
```

## 🎯 Concurrent Execution Examples

### ✅ CORRECT (Single Message):
```javascript
[BatchTool]:
  // Initialize swarm
  mcp__claude-flow__swarm_init { topology: "mesh", maxAgents: 6 }
  mcp__claude-flow__agent_spawn { type: "researcher" }
  mcp__claude-flow__agent_spawn { type: "coder" }
  mcp__claude-flow__agent_spawn { type: "tester" }
  
  // Spawn agents with Task tool
  Task("Research agent: Analyze requirements...")
  Task("Coder agent: Implement features...")
  Task("Tester agent: Create test suite...")
  
  // Batch todos
  TodoWrite { todos: [
    {id: "1", content: "Research", status: "in_progress", priority: "high"},
    {id: "2", content: "Design", status: "pending", priority: "high"},
    {id: "3", content: "Implement", status: "pending", priority: "high"},
    {id: "4", content: "Test", status: "pending", priority: "medium"},
    {id: "5", content: "Document", status: "pending", priority: "low"}
  ]}
  
  // File operations
  Bash "mkdir -p app/{src,tests,docs}"
  Write "app/src/index.js"
  Write "app/tests/index.test.js"
  Write "app/docs/README.md"
```

### ❌ WRONG (Multiple Messages):
```javascript
Message 1: mcp__claude-flow__swarm_init
Message 2: Task("agent 1")
Message 3: TodoWrite { todos: [single todo] }
Message 4: Write "file.js"
// This breaks parallel coordination!
```

## Performance Benefits

- **84.8% SWE-Bench solve rate**
- **32.3% token reduction**
- **2.8-4.4x speed improvement**
- **27+ neural models**

## Hooks Integration

### Pre-Operation
- Auto-assign agents by file type
- Validate commands for safety
- Prepare resources automatically
- Optimize topology by complexity
- Cache searches

### Post-Operation
- Auto-format code
- Train neural patterns
- Update memory
- Analyze performance
- Track token usage

### Session Management
- Generate summaries
- Persist state
- Track metrics
- Restore context
- Export workflows

## Advanced Features (v2.0.0)

- 🚀 Automatic Topology Selection
- ⚡ Parallel Execution (2.8-4.4x speed)
- 🧠 Neural Training
- 📊 Bottleneck Analysis
- 🤖 Smart Auto-Spawning
- 🛡️ Self-Healing Workflows
- 💾 Cross-Session Memory
- 🔗 GitHub Integration

## Integration Tips

1. Start with basic swarm init
2. Scale agents gradually
3. Use memory for context
4. Monitor progress regularly
5. Train patterns from success
6. Enable hooks automation
7. Use GitHub tools first

## 📋 Current Task Status (SuperClaude Management)

### Task Completion Status
- **Tasks 1-8**: ✅ **COMPLETED** - Expo SDK 51 Migration
- **Task 9**: ✅ **DONE** - Authentication Screens & Navigation 
- **Task 10**: ✅ **COMPLETED** - Core Redux Integration with Supabase (Enhanced with spec v1.4.6)
  - Includes: User roles, organisation multi-tenancy, LoRaWAN integration, WW Admin slice, Maestro testing
- **Task 11**: 🔄 **IN-PROGRESS** - Offline SQLite Foundation (28.6% complete - 2/7 subtasks done)
  - ✅ Subtask 11.1: SQLite Testing Framework 
  - ✅ Subtask 11.2: SQLite Database Schema
  - 🔄 **Subtask 11.3**: OfflineService.ts Implementation (CRITICAL BLOCKER for Tasks 12-23)
  - ⏳ Subtasks 11.4-11.7: Sync, WW Admin, Redux Integration, E2E Testing
- **Tasks 12-23**: ⏳ **PENDING** - All updated with Implementation Spec v1.4.6 enhancements

### Next Steps (SuperClaude Coordinated)
1. ✅ **Complete Task 10**: Core Redux Integration (6/6 subtasks completed)
2. 🔄 **Execute Task 11.3**: OfflineService.ts implementation (CRITICAL PATH BLOCKER)
   - Use `/task:focus 11.3` for detailed requirements
   - Use `/task:implement:offline` to start TDD implementation
3. Complete Task 11.4-11.7 (Sync Infrastructure, WW Admin features, Redux Integration, E2E Testing)
4. 🚀 **Launch Parallel Development Streams**: After Task 11 completion
   - **Stream A** (Tasks 12-14): Project Management - Auth-Agent + Data-Agent
   - **Stream B** (Tasks 15-17): Deployment Workflows - UI-Agent + BLE-Agent  
   - **Stream C** (Tasks 18-20): Devices & Maps - BLE-Agent + Sync-Agent
5. **Integration Phase** (Tasks 21-23): Testing, Optimization, Production with Quality-Agent + Integration-Agent

## 📋 MVP2 Implementation References

### Key Documents
- **Implementation Spec**: `@project-context/development-context/MVP2/implementation-spec-v1.4.md` (v1.4.6 - Latest)
- **Task Plan**: `@project-context/development-context/MVP2/TASK-RESTRUCTURING-PLAN.md` (✅ Documented in project context)
- **Claude Flow Plan**: `@project-context/development-context/MVP2/claude-flow-implementation-plan.md`
- **Development TODO**: `@project-context/development-context/MVP2/to-do`
- **Task Files**: All tasks (1-23) available in `@project-context/development-context/MVP2/tasks/` with full Implementation Spec v1.4.6 enhancements

### Development Streams (Enhanced with Spec v1.4.6)
- **Foundation Layer**: Tasks 9-11 (Auth ✅, Redux with roles ✅, SQLite with multi-tenancy 🔄) - Sequential execution required
  - Organisation multi-tenancy and role-based data access throughout
  - WW Admin offline user provisioning features (MVP requirement)
  - Enhanced with Serena MCP for intelligent code analysis and editing
- **Stream A**: Tasks 12-14 (Project Management) - Auth-Agent + Data-Agent
  - WW Admin cross-organisation project oversight and user provisioning
  - Organisation-scoped project CRUD with role-based permissions
- **Stream B**: Tasks 15-17 (Deployment Workflows) - UI-Agent + BLE-Agent
  - LoRaWAN device integration throughout deployment lifecycle
  - Real-time status monitoring with battery/storage tracking
- **Stream C**: Tasks 18-20 (Devices & Maps) - BLE-Agent + Sync-Agent
  - Organisation-scoped deployment visualization on maps
  - Enhanced BLE with LoRaWAN webhook integration
- **Integration**: Tasks 21-23 (Testing, Optimization, Production) - Quality-Agent + Integration-Agent
  - Multi-tenancy validation and WW Admin feature testing
  - Production security with organisation boundaries

### Critical Implementation Notes (Spec v1.4.6 Requirements)
- **Offline-First**: All operations must work without network connectivity
- **Organisation Multi-Tenancy**: Complete data isolation and scoped operations
- **User Roles System**: ww_admin (global), project_admin (org-scoped), project_member (project-scoped)
- **BLE Integration**: Wildlife Watcher camera communication via Bluetooth
- **LoRaWAN Integration**: Webhook status updates with battery_level and sd_card_usage fields
- **Supabase Backend**: RLS policies with role validation, Edge Functions, real-time subscriptions
- **WW Admin Features**: User provisioning across organisations (MVP requirement per spec line 73)
- **Maestro Testing**: TDD/BDD framework integrated throughout Tasks 10-23
- **Serena MCP**: Symbolic code analysis and intelligent editing for enhanced development efficiency

## Support

- Documentation: https://github.com/ruvnet/claude-flow
- Issues: https://github.com/ruvnet/claude-flow/issues

---

Remember: **Claude Flow coordinates, Claude Code creates!**

## 🧪 Testing Standards & Quality Control (React Native TDD Excellence)

### Test Restructuring Success: From 70/217 to 180/217 Tests Passing ✅

**Achievement**: 82.9% test pass rate with systematic test debugging methodology

#### Test Environment Debugging Mastery:
1. **Jest Environment Conflicts**: Resolved React Native vs jsdom conflicts 
2. **Mock Configuration Precision**: Fixed service mock data structures
3. **TestID Implementation**: Added unique identifiers for reliable UI testing
4. **Interface Contract Validation**: Verified actual service methods vs assumed methods
5. **Form Validation Testing**: Comprehensive form workflow validation with React Hook Form

### React Native Screen Testing Excellence Pattern ✅

**TestID-Based Element Selection Strategy**:
```typescript
// ✅ GOLD STANDARD PATTERN - Unique TestIDs
<WWTextInput testID="email-input" />      // Unique, semantic identifier
<Button testID="login-button" />          // Clear purpose identification
<Button testID="register-button" />       // Distinguishable from other buttons

// ❌ FRAGILE PATTERN - Generic TestIDs  
<WWTextInput testID="text-input-outlined" />  // Same ID on all inputs
<Button testID="button" />                    // Same ID on all buttons
```

**Integration Testing Focus**:
- **UI + Service Integration**: Test complete user workflows, not just UI components
- **Form Validation Workflows**: Validate user input → form validation → service call → state update
- **Navigation Integration**: Test screen transitions and parameter passing
- **Error Handling**: Test network failures, validation errors, authentication failures
- **State Management**: Verify Redux store updates through user interactions

### Test Restructuring Rules Applied Successfully:

#### 1. Service Layer Testing (100% Success Rate Achieved):
```bash
✅ DatabaseService: 22/22 tests passing (Jest environment fixed)
✅ Auth Service: 31/31 tests passing (Mock configuration corrected)
✅ SyncService: 15/16 tests passing (Permission validation added)
```

**Key Fixes Applied**:
- **Environment Conflicts**: Removed `@jest-environment jsdom` from React Native service tests
- **Mock Data Precision**: Updated mocks to return `{ user_version: 0 }` not `undefined`
- **Interface Validation**: Used actual service methods, not assumed methods

#### 2. Screen Integration Testing (Login Screen: 16/16 Passing):
```typescript
// ✅ SUCCESSFUL PATTERN - TestID + Workflow Testing
const emailInput = screen.getByTestId('email-input');
const passwordInput = screen.getByTestId('password-input');
const loginButton = screen.getByTestId('login-button');

// Test complete workflow: Input → Validation → Submit → State Update
fireEvent.changeText(emailInput, 'test@example.com');
fireEvent.changeText(passwordInput, 'password123');
fireEvent.press(loginButton);

await waitFor(() => {
  const state = store.getState();
  expect(state.authentication.user).toEqual(
    expect.objectContaining({ email: 'test@example.com' })
  );
});
```

### Quality Control Standards Established:

#### Testing Quality Gates - ZERO TOLERANCE:
- **❌ NEVER skip tests with `it.skip()` or `.todo()`** - Fix implementation, not tests
- **❌ NEVER modify test expectations to make failing tests pass** - Root cause analysis required
- **❌ NEVER assume interface methods** - Always verify actual service contracts first
- **❌ NEVER commit with failing tests** - 100% pass rate required

#### Test-Driven Development Discipline:
1. **Red Phase**: Write comprehensive tests first (business requirements as tests)
2. **Green Phase**: Implement minimal code to make tests pass
3. **Refactor Phase**: Improve code while maintaining 100% test pass rate
4. **Validation Phase**: Ensure tests validate actual user workflows, not implementation details

### Hybrid Testing Structure ✅ BATTLE-TESTED

**Test Organization (Proven Effective)**:
```
/tests/                          # Centralized complex tests
├── setup/                       # Global test configuration
│   ├── setupTests.ts           # Jest setup and mocks (fixed global conflicts)
│   ├── utils/                  # Test utilities (navigation mocking)
│   ├── helpers/                # Test helpers (BDD patterns)
│   ├── fixtures/               # Test data fixtures (interface-aligned)
│   └── __mocks__/              # Custom mocks (service contracts)
├── unit/                       # Cross-cutting unit tests
│   ├── redux/                  # Redux integration tests
│   └── services/               # Service layer tests (100% passing)
├── integration/                # Integration tests
│   ├── navigation/             # Screen integration tests (TestID pattern)
│   └── services/               # Service integration tests
├── maestro/                    # E2E tests (Maestro BDD)
└── __mocks__/                  # Jest auto-mocks (Supabase, AsyncStorage)
```

**Jest Configuration Optimized**:
- **setupFilesAfterEnv**: `<rootDir>/tests/setup/setupTests.ts` (global mock configuration)
- **testMatch**: Co-located + Centralized patterns
- **moduleNameMapper**: Image/asset mocking + `@test/(.*)` → test utilities
- **testEnvironment**: Default Node.js (React Native compatible) unless DOM required

**Test Script Organization**:
```json
{
  "test": "jest",
  "test:unit:services": "jest --testPathPattern=tests/unit/services/",
  "test:integration:screens": "jest --testPathPattern=tests/integration/navigation/",
  "test:maestro": "maestro test tests/maestro/",
  "test:coverage": "jest --coverage --collectCoverageFrom='src/**/*.{ts,tsx}'"
}
```

### Commit Organization Strategy - Logical Groupings:

#### Git Strategy for Complex Test Fixes:
```bash
# Logical commit grouping pattern (applied successfully):
1. "fix: resolve Jest environment conflicts in DatabaseService tests"
2. "fix: correct auth service mock configuration and fixtures"
3. "feat: add unique testIDs to Login screen for reliable testing"
4. "fix: update Login integration tests to use TestID selectors"
5. "test: achieve 100% Login screen integration test coverage (16/16)"
6. "docs: update learning log with test restructuring methodology"
```

**Commit Quality Standards**:
- **Functional Grouping**: Group changes by feature/fix, not by file type
- **Test Results in Commits**: Include pass/fail counts in commit messages
- **Documentation Sync**: Update learning documentation with each major fix
- **Verification Before Commit**: Always run tests before committing changes

### Scaling Strategy - TestID Pattern Application:

#### Next Screens to Fix (Prioritized):
1. **Register Screen**: Apply TestID pattern (same methodology as Login)
2. **ForgotPassword Screen**: Add unique testIDs for form elements
3. **Profile Screens**: Apply TestID + workflow testing pattern
4. **Project Management Screens**: TestID pattern for complex forms
5. **Deployment Screens**: TestID pattern for multi-step workflows

#### TestID Naming Convention Established:
```typescript
// Semantic naming pattern:
testID="{component-type}-{purpose}-{identifier}"

// Examples:
testID="email-input"           // Form input fields
testID="login-button"          // Action buttons  
testID="forgot-password-link"  // Navigation links
testID="project-list-item-0"   // Dynamic list items
testID="deployment-step-3"     // Multi-step workflow elements
```

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
Never save working files, text/mds and tests to the root folder.
- Reference task details in @project-context/development-context/MVP2/tasks/ and update documentation as we progress
- check in files to git regularly as you implement the app at sensible points as you implement each task/feature/subtask and where releavnt tests pass so that we are using good source control best practice.
- keep @project-context/learnings/claude-flow-usage-log.md updated as we implemenent and commit features substasks and tasks