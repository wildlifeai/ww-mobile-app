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

## 📦 MCP Tools Available

### Context7 - Library Documentation
**When to use**: Need up-to-date documentation for any library/framework
- `mcp__context7__resolve-library-id` - Find library ID from name
- `mcp__context7__get-library-docs` - Fetch comprehensive docs with examples

**Example**: Getting React Native or Expo documentation during implementation

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

**Supabase Backend** (`/supabase-backend/`):
- **Database Info**: `database-information.md` - Schema and structure
- **Integration Progress**: `supabase-integration-progress.md` - Backend status
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

### Current Task Context
See `@project-context/superclaude-task-management.md` for:
- Current task status (Task 11.8 UUID alignment)
- Critical blockers and dependencies
- Development stream coordination
- Progress tracking

## Important Instructions

- Reference task details in `@project-context/development-context/MVP2/tasks/` before implementation
- Check in files to git regularly at sensible points (after each subtask completion)
- Update progress documentation after completing each task/feature/subtask
- Preserve implementation context for session recovery

## Support

- Documentation: https://github.com/ruvnet/claude-flow
- Issues: https://github.com/ruvnet/claude-flow/issues

---

Remember: **Claude Flow coordinates, Claude Code creates!**