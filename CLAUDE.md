# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 CRITICAL: Concurrent Execution & File Management

**ABSOLUTE RULES**:
1. ALL operations MUST be concurrent/parallel in a single message
2. **NEVER save working files, text/mds and tests to the root folder**
3. ALWAYS organize files in appropriate subdirectories
4. **MANDATORY**: Follow Evidence-Based Development - verify assumptions with Context7 research FIRST

### ⚡ GOLDEN RULE: "1 MESSAGE = ALL RELATED OPERATIONS"

**MANDATORY PATTERNS:**
- **TodoWrite**: ALWAYS batch ALL todos in ONE call (5-10+ todos minimum)
- **Task tool**: ALWAYS spawn ALL agents in ONE message with full instructions
- **File operations**: ALWAYS batch ALL reads/writes/edits in ONE message
- **Bash commands**: ALWAYS batch ALL terminal operations in ONE message
- **Memory operations**: ALWAYS batch ALL memory store/retrieve in ONE message

### File Organization

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

- **Tech Stack**: Expo SDK 51, React Native 0.74.5, TypeScript, Redux Toolkit, Supabase
- **Architecture**: Offline-first with local SQLite sync, BLE + LoRaWAN device communication, organisation multi-tenancy
- **Key Features**: 6-step deployment wizard, project management, real-time sync, WW Admin access
- **User Roles**: ww_admin (global), project_admin (org-scoped), project_member (project-scoped)
- **Testing**: Jest (unit/integration), Maestro (E2E/BDD), Detox
- **Development**: SPARC methodology with TDD/BDD practices

## Essential Commands

### Development
```bash
npm start                    # Start Expo dev server
npm run android             # Run on Android device/emulator
npm run ios                 # Run on iOS simulator (macOS only)
```

### Testing
```bash
npm test                    # Run Jest unit/integration tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:maestro        # Run all Maestro E2E tests
npm run test:maestro:auth   # Auth workflow tests
npm run test:maestro:offline # Offline workflow tests
npm run type-check          # TypeScript type checking
```

### Type Synchronization (CRITICAL)
```bash
npm run types:local         # Generate types from local Supabase (3 sec)
npm run types:check-local   # Verify types are current (3 sec)
npm run validate:local      # Full validation: types + TypeScript + tests (30 sec)
```

**MANDATORY**: After ANY backend schema changes, run `npm run types:local` before coding. Git pre-commit hooks **BLOCK commits** with stale types.

### Build & Deploy
```bash
npm run lint                # ESLint
npm run prebuild:check      # Pre-build validation script
eas build --profile development   # Dev build via EAS
eas build --profile production    # Production build
```

### Dependencies
```bash
npm run validate:deps       # Validate dependency compatibility
npm run deps                # Interactive dependency management CLI
npm run deps:scan           # Scan for dependency issues
```

## Architecture Overview

### Directory Structure
```
src/
├── services/          # Business logic & integrations
│   ├── offline/      # OfflineService, SyncService, DatabaseService, ConflictResolution
│   ├── supabase.ts   # Supabase client
│   ├── auth.ts       # Authentication
│   ├── database.ts   # SQLite operations
│   └── ProjectService.ts, ProjectMemberService.ts, DfuService.ts
├── redux/            # Redux Toolkit state
│   ├── slices/      # auth, projects, offline, sync, deployments, devices, etc.
│   ├── api/         # RTK Query endpoints (auth, deployments, projects, users)
│   └── middleware/  # offlineSyncMiddleware
├── types/
│   └── supabase.ts  # Generated types (DO NOT EDIT - regenerate from backend)
├── navigation/      # React Navigation setup (index.tsx, BottomTabs.tsx)
├── screens/         # Screen components
├── components/      # Reusable UI components
├── features/        # Feature-specific modules (e.g., maps)
├── hooks/           # Custom React hooks
├── utils/           # Utility functions
├── providers/       # React context providers
└── App.tsx          # Root component

tests/
├── unit/            # Jest unit tests
├── integration/     # Jest integration tests
└── maestro/         # E2E test flows (.yaml)
```

### Key Architectural Patterns

#### Offline-First Architecture
**Pattern**: Local SQLite → Queue → Sync → Supabase

- **Local-first**: All data operations hit SQLite first
- **Background sync**: SyncService handles bi-directional Supabase sync
- **Conflict resolution**: Last-write-wins with manual override capability
- **Queue-based**: Offline operations queued and replayed when online

**Key Services** (read when implementing):
- `services/offline/OfflineService.ts` - Main coordinator for offline operations
- `services/offline/DatabaseService.ts` - SQLite CRUD operations, schema management
- `services/offline/SyncService.ts` - Sync queue, conflict detection, retry logic
- `redux/middleware/offlineSyncMiddleware.ts` - Redux middleware intercepting network actions

#### State Management (Redux Toolkit)
- **Slices**: Domain-specific state in `redux/slices/` (auth, projects, devices, deployments, offline, sync)
- **RTK Query**: API endpoints with automatic caching in `redux/api/`
- **Middleware**: Custom offline sync middleware bridges online/offline worlds

#### Authentication & Authorization
- **Supabase Auth**: Email/password authentication
- **Role-Based Access Control (RBAC)**: 4-tier system
  - `ww_admin` - Global admin (Wildlife.ai staff)
  - `project_admin` - Organisation-scoped admin
  - `project_member` - Project-scoped member
  - Anonymous users (limited access)
- **Type Safety**: Generated Supabase types in `src/types/supabase.ts`
- **See**: `@project-context/development-context/MVP2/specifications/user-roles-permissions.md` for complete RBAC details

#### Testing Strategy
1. **Unit Tests** (Jest): Services, utilities, Redux slices - co-located in `__tests__/` or `.test.ts` files
2. **Integration Tests** (Jest): Component + service integration in `tests/integration/`
3. **E2E Tests** (Maestro): Real user workflows in `tests/maestro/` (.yaml files)
4. **TDD/BDD**: Write tests before implementation (Red-Green-Refactor)
5. **See**: `@project-context/development-context/MVP2/implementation/guides/testing-standards.md` for comprehensive methodology

## Type Synchronization Critical Path

**The Problem**: Backend schema changes → mobile TypeScript types become stale → runtime errors

**The Solution**: Automated type generation + git hooks + CI/CD validation (95% coverage)

**Architecture**:
```
Backend Repo (Supabase Local)
  ↓ npx supabase gen types
  ↓
Backend: project-context/database.types.ts (committed)
  ↓
Mobile: npm run types:local (generates from same Supabase)
  ↓
Mobile: src/types/supabase.ts (committed)
  ↓
Git pre-commit hook validates types are current (80% coverage)
  ↓
GitHub Actions validates on PR (blocks merge on drift - 95% coverage)
```

**Daily Workflow**:
1. Backend developer makes schema change
2. Backend runs `npm run db:types:update`
3. Mobile developer pulls backend changes
4. Mobile runs `npm run types:local` (takes 3 seconds)
5. Git hooks prevent commits if types are stale
6. PR opens → GitHub Actions validates types (blocks merge on drift)

**Automated Safety Nets** (multi-layer protection):
1. **Local Git Hook** (80% coverage): Blocks commits with stale types
2. **CI/CD Validation** (95% coverage): Blocks PR merge on type drift
3. **Backend Git Hook**: Blocks backend commits without type regeneration
4. **Type Check Command**: `npm run types:check-local` (3 sec)

**ROI**: 160:1 (15 min setup → 40 hours saved annually)

**Key Files**:
- Mobile: `src/types/supabase.ts` (generated, committed)
- Backend Reference: `~/wildlife-watcher-backend/project-context/database.types.ts` (for cross-validation)
- Validation Script: `scripts/check-types-local.sh`
- CI/CD Workflow: `.github/workflows/type-validation.yml`
- Both generated from: Same local Supabase instance (localhost:54321)

**Documentation**:
- Daily workflow: `@project-context/learnings/local-dev-sync-workflow.md`
- Comprehensive guide: `@documentation/developer-docs/Backend-Mobile-Type-Synchronization-Guide.md`
- Backend automation: `~/wildlife-watcher-backend/project-context/documentation/QUICK-REFERENCE-TYPE-AUTOMATION.md`

**Bottom Line**: Run `npm run types:local` after backend changes. Git hooks + GitHub Actions prevent type drift. Takes 3 seconds. 95% coverage. ✅

## Quality Control Standards

### Discovery Phase (MANDATORY BEFORE CODING)
1. **Read type definitions** in `/src/types/` FIRST before ANY test or code
2. **Use Read tool** to examine actual interfaces and implementations
3. **Use Grep tool** to verify method signatures in existing services
4. **Never assume** interface names, method signatures, or existing types - always verify actual code structure

### Test Integrity (ZERO TOLERANCE)
- **Never skip, delete, or modify tests** without explicit user approval
- **Never use** `.skip()`, `.todo()`, or comment out tests as shortcuts
- **Never change test expectations** to make failing tests pass
- **Never reduce test coverage** or scope without justification
- **Follow TDD**: Write tests BEFORE implementation (Red-Green-Refactor cycle)

### Quality Gates (MUST PASS)
1. **Test Gate**: 100% of tests must pass without modifications
2. **Type Gate**: Zero TypeScript errors (`npm run type-check`)
3. **Integration Gate**: All service calls must use correct method signatures
4. **TDD Gate**: Implementation must satisfy original test requirements
5. **Evidence Gate**: All implementation decisions backed by Context7 research FIRST
6. **UUID Consistency Gate**: All UUID handling must maintain string types throughout
7. **Backend Sync Gate**: Types regenerated after ANY backend schema changes

## MCP Tools & When to Use Them

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

**Example**: Getting React Native, Expo, SQLite documentation - PROVEN to eliminate false solution paths

### Supabase MCP - Database & Backend
**When to use**: Managing Supabase database, migrations, and edge functions

- `mcp__supabase__list_tables`, `mcp__supabase__execute_sql` - Database operations
- `mcp__supabase__list_migrations`, `mcp__supabase__apply_migration` - Schema management
- `mcp__supabase__generate_typescript_types` - Generate types from schema
- `mcp__supabase__search_docs` - Search Supabase documentation

### Serena MCP - Enhanced Development
**When to use**: Complex code analysis and intelligent editing

- **Symbolic Code Analysis** - Understand structure without reading entire files
- **Intelligent Editing** - Precise modifications using symbols and regex
- **Cross-Project Memory** - Persistent knowledge across sessions
- **Advanced Search** - Pattern-based code discovery

### IDE Integration
**When to use**: Need TypeScript/linting diagnostics or run code in notebooks

- `mcp__ide__getDiagnostics` - Get VS Code language diagnostics
- `mcp__ide__executeCode` - Execute Python in Jupyter notebooks

### Playwright Browser Automation
**When to use**: Testing web interfaces or browser-based interactions

- `mcp__playwright__browser_*` - Full browser control (navigate, click, snapshot, etc.)

### Tool Coordination Strategy
1. **Context7**: MANDATORY FIRST - Library documentation and vendor-specific patterns
2. **Claude Code**: PRIMARY - File operations, coding, testing, git, npm
3. **Specialized Agents**: Domain expertise (mobile-dev, quality-assurance-engineer, supabase-schema-architect)
4. **MCP Tools**: Coordination, memory, metrics, GitHub integration

**PROVEN WORKFLOW**: Context7 Research → Claude Code Implementation → Specialized Agents → MCP Coordination

## AI Agentic Development Framework (AADF)

### Living Framework Documentation
**CRITICAL**: This project serves as the primary development laboratory for the **AI Agentic Development Framework (AADF)** - a comprehensive methodology for AI-orchestrated software development.

**Framework Document Locations**:
- **Core Framework**: `@project-context/learnings/ai-agentic-development-framework.md`
- **Philosophical Foundations**: `@project-context/learnings/philosophical-foundations-aadf.md`

### Framework Maintenance Directive (MANDATORY)
Update the AADF document with ALL discoveries, patterns, optimizations, and learnings encountered during development:

**Update Triggers**:
- New successful coordination patterns discovered
- Quality gate refinements and improvements
- Tool integration insights and optimizations
- Performance breakthrough discoveries
- Template scaffolding pattern improvements
- Cross-project learning integration opportunities

**Update Categories**:
- **Behavioral Patterns**: SuperClaude optimization discoveries
- **Orchestration Insights**: Claude Flow workflow improvements
- **Tool Coordination**: MCP integration pattern refinements
- **Quality Standards**: Zero-tolerance gate enhancements
- **Performance Metrics**: Efficiency measurement improvements
- **Template Evolution**: Scaffolding pattern discoveries
- **Philosophical Foundations**: Epistemological and ontological insights
- **Applied Philosophy**: Practical philosophical applications in development

### Framework Evolution Responsibility
Every developer/session MUST contribute to framework evolution by:
1. **Documenting New Patterns**: Record successful workflows immediately
2. **Recording Optimization Insights**: Capture performance improvements
3. **Updating Quality Standards**: Refine validation gates based on learnings
4. **Enhancing Tool Integration**: Document MCP coordination discoveries
5. **Template Pattern Discovery**: Identify reusable scaffolding patterns
6. **Philosophical Integration**: Document epistemological and ontological insights
7. **Applied Philosophy**: Record practical philosophical applications in development

**Goal**: Create a comprehensive, battle-tested framework that can be packaged into a `create-aadf-app` equivalent for future projects.

## Cross-Project Integration Insights (Backend Learnings)

### Reality-First Testing Methodology (CRITICAL LEARNING)
**DISCOVERED**: Backend spent 2+ days building elaborate test infrastructure instead of testing real user behavior
**IMPACT**: False security alerts and massive time waste vs feature delivery

**MANDATORY TESTING PRIORITY ORDER**:
1. **User Journey Tests FIRST** (Real API + Real Auth + Real Database)
2. **Integration Tests SECOND** (Feature-Level Validation)
3. **Unit Tests LAST** (Only Complex Business Logic)

**Mobile App Application**:
- Task 11.3 OfflineService.ts: Test with **real Supabase sync operations**
- Avoid elaborate SQLite mocking - use real database operations
- **Red Flag**: If test setup time > implementation time = WRONG approach

### Database Schema Consistency (UUID Critical)
**Backend Confirmed**: Supabase UUIDs must remain string types throughout entire system

**Mobile Requirements**:
- SQLite must handle UUID strings consistently (Task 11.8)
- No number conversion anywhere in the data flow
- Database sync operations must maintain UUID string integrity
- **Breaking Change**: Users must re-login after Task 11.8 completion

### Evidence-Based Development Results (Context7 Success)
**Backend Measured Results**:
- **Debugging Efficiency**: 10x improvement (2.5 hours → 15 minutes)
- **False Solution Elimination**: 100% (avoided 4 major debugging paths)
- **Documentation Access**: 38,009+ vendor-specific code snippets vs 0 general sources
- **Solution Quality**: Official patterns vs custom workarounds

### Cross-Project Coordination Status
- **Backend**: 98% deployment ready (Phase 2 AADF complete)
- **Mobile**: Task 11.8 UUID alignment required before proceeding
- **Integration**: Backend ready for mobile app development continuation

## MVP2 Development Context

### Current Task Status
- **Live Dashboard**: http://localhost:3333 (run `./start.sh` in `@project-context/development-context/project-progress-tracker/`)
- **Master Plan**: `@project-context/development-context/MVP2/implementation/execution/MVP2-MASTER-EXECUTION-PLAN.md`
- **Metrics Tracker**: `@project-context/development-context/MVP2/implementation/execution/MVP2-METRICS-TRACKER.md`
- **Task Specifications**: `@project-context/development-context/MVP2/implementation/tasks/task_*.txt`

### Primary Documentation
- **Implementation Spec**: `@project-context/development-context/MVP2/implementation-spec-v1.4.md` (17.5k tokens - read when needed, in `.claudeignore`)
- **User Roles**: `@project-context/development-context/MVP2/specifications/user-roles-permissions.md` (4-tier RBAC)
- **Testing Standards**: `@project-context/development-context/MVP2/implementation/guides/testing-standards.md`
- **API Integration**: `@project-context/development-context/MVP2/implementation/guides/api-integration-guide.md`
- **Component Patterns**: `@project-context/development-context/MVP2/implementation/guides/component-patterns.md`

### Backend Integration
- **Backend Repo**: `~/dev/wildlifeai/wildlife-watcher-backend` (separate Git repository)
- **Backend Status**: `~/wildlife-watcher-backend/project-context/PROJECT-STATUS.md`
- **Cross-Project Tasks**: `~/wildlife-watcher-backend/project-context/MVP2-Tasks/`
- **Backend Type Automation**: Backend has automated type sync with git pre-commit hooks. See `~/wildlife-watcher-backend/project-context/documentation/QUICK-REFERENCE-TYPE-AUTOMATION.md`

## Development Workflow

### Before Starting Any Task
1. **Check Current Status**: View Project Progress Tracker dashboard (http://localhost:3333)
2. **Review Strategy**: Consult `MVP2-MASTER-EXECUTION-PLAN.md` for current methodology
3. **Get Requirements**: Read `implementation-spec-v1.4.md` and specific task file
4. **Verify Types**: Run `npm run types:check-local` if backend schema changed
5. **Start Tracking**: Note start time in `MVP2-METRICS-TRACKER.md`

### During Development
- **Research FIRST**: Use Context7 for library documentation (proven 10x efficiency)
- **Write tests BEFORE code**: Follow TDD (Red-Green-Refactor)
- **Track time**: Document blockers and actual hours in metrics tracker
- **Follow current execution strategy**: Incremental/parallel/hybrid per master plan
- **Adhere to quality gates**: Defined in execution plan

### After Task Completion
- **Update metrics tracker**: Record actual time spent vs estimates
- **Monitor progress**: Check dashboard for status
- **Commit regularly**: At sensible points (subtask completion) with descriptive messages
- **Check cross-project status**: If applicable

### Important Development Instructions
- Reference task details in `@project-context/development-context/MVP2/implementation/tasks/` before implementation
- Check in files to git regularly at sensible points (after each subtask completion)
- Update progress documentation after completing each task/feature/subtask
- Preserve implementation context for session recovery

## Documents to Keep Updated

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
   - Track development progress and velocity

3. **Integration Progress**: When working on backend
   - Update `supabase-integration-progress.md`
   - Document API changes
   - Record migration status

4. **Cross-Project Database Tasks**: When database changes are needed
   - Create/update task files in `~/wildlife-watcher-backend/project-context/MVP2-Tasks/`
   - Reference backend project status at `~/wildlife-watcher-backend/project-context/PROJECT-STATUS.md`
   - Follow backend development patterns from `~/wildlife-watcher-backend/CLAUDE.md`

## Task Alignment Protocol

**Before starting ANY MVP2 task or subtask**:
1. **Read Implementation Spec**: `@project-context/development-context/MVP2/implementation-spec-v1.4.md`
2. **Read Task File**: Corresponding file in `@project-context/development-context/MVP2/implementation/tasks/`
3. **Check Master Plan**: `@project-context/development-context/MVP2/implementation/execution/MVP2-MASTER-EXECUTION-PLAN.md`
4. **Verify Alignment**: Cross-reference with:
   - `specifications/user-roles-permissions.md`
   - `specifications/admin-portal-spec.md`
5. **Flag Inconsistencies**: Report any discrepancies to user for clarification

This ensures the task/subtask aligns with latest specifications and architecture decisions.

## Reference Documentation

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

## Environment Configuration

**Key Files**:
- `.env.local` - Local environment variables (gitignored)
- `.env.example` - Template for required variables
- `app.config.js` - Expo configuration (dynamic based on NODE_ENV)

**Required Environment Variables**:
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `GOOGLE_MAPS_API_KEY_ANDROID` - Google Maps for Android
- `GOOGLE_MAPS_API_KEY_IOS` - Google Maps for iOS

## Stack Best Practices & Research (2024)

**CRITICAL**: Comprehensive research completed on React Native + Expo + Supabase best practices

**Research Documents** (MUST READ before major architectural decisions):
- **Comprehensive Guide**: `@documentation/developer-docs/Stack-Best-Practices-Research-2024.md` (Quick Reference)
- **Type Synchronization**: `@project-context/learnings/typescript-cross-repo-sync-best-practices-2025.md`
- **Testing Architecture**: `@project-context/research/testing-architecture-react-native-offline-first.md`
- **Production Security**: `@project-context/production-security-performance-guide.md`

**Key Findings**:
- **Type Synchronization**: 80% coverage (git hooks) → 95% with CI/CD (✅ GitHub Actions workflow added)
- **Testing Strategy**: Maestro recommended for E2E (official Expo support, 2 hours setup vs 4+ hours for Detox)
- **Performance**: SQLite WAL mode enabled ✅ (5-10x write performance improvement)
- **Security**: Console.log removal pattern, SecureStore for credentials, RLS optimization patterns
- **Bundle Size**: 12.27 MB (baseline measured, optimization opportunities identified)

**Evidence-Based ROI**:
- GitHub Actions type validation: 160:1 ROI (15 min → 40 hours saved annually)
- Backend project measured: 10x debugging efficiency improvement via Context7 research
- Context7 analysis: 38,000+ vendor-specific code snippets validated

**Infrastructure Improvements** (Task 24):
- [x] GitHub Actions type validation (`.github/workflows/type-validation.yml`)
- [x] SQLite WAL mode (already enabled in DatabaseService.ts)
- [x] Bundle analysis baseline (12.27 MB Android bundle)
- [ ] Maestro E2E testing setup (2 hours)
- [ ] Security audit (console.log removal, env var validation)
- [ ] Nightly type reconciliation
- [ ] Production monitoring (Sentry)
- [ ] RLS performance optimization (backend coordination)

**Action Items Reference**: See Task 24 (`@project-context/development-context/MVP2/implementation/tasks/task_024_infrastructure_quality_improvements.txt`)

## Code Style & Best Practices

- **TypeScript**: Strict mode, prefer types over interfaces (per `.cursorrules`)
- **Modular Design**: Files under 500 lines
- **Environment Safety**: Never hardcode secrets
- **Clean Architecture**: Separate concerns
- **Test-First**: Write tests before implementation
- **Documentation**: Update as you code
- **Evidence-Based Development**: Use Context7 research BEFORE implementation (proven 10x efficiency)

## Quick Setup

```bash
# Add Claude Flow MCP server
claude mcp add claude-flow npx claude-flow@alpha mcp start

# Add Serena MCP server for enhanced development
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env
uvx --from git+https://github.com/oraios/serena serena start-mcp-server
```

## Support

- **Documentation**: https://github.com/ruvnet/claude-flow
- **Issues**: https://github.com/ruvnet/claude-flow/issues
- **Project Repository**: https://github.com/wildlifeai/wildlife-watcher-mobile-app
- **Project Overview**: https://www.youtube.com/watch?v=Ima3n2EYfeE
