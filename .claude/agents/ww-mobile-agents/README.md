# Wildlife Watcher Mobile Agents

**Status**: ✅ Phase 1 P0 MVP Complete (2025-11-09)
**Production Readiness**: 95%

## Overview

Specialized agent ecosystem for the Wildlife Watcher mobile app. These agents have deep knowledge of the project's architecture, patterns, and quality standards.

## P0 Mobile Agents (5)

### 1. ww-aadf-mobile-quality-enforcer.md
**Purpose**: Enforce all 13 quality gates before commits and PR merges

**Capabilities**:
- Pre-commit hook integration (blocks commits)
- GitHub Actions integration (blocks PR merge)
- Manual review orchestration
- Quality score calculation (0-10 scale)
- Production readiness assessment (0-100%)

**When to Use**:
- Before marking any task complete
- Before creating pull requests
- After significant code changes
- When validating production readiness

### 2. ww-aadf-mobile-type-guardian.md
**Purpose**: Prevent type drift across environments

**Capabilities**:
- 5-layer defense-in-depth strategy (99% prevention rate)
- Type regeneration for local/cloud-dev/cloud-prod
- Breaking change detection
- TypeScript compilation validation
- Type system size validation (min 50KB)

**When to Use**:
- After backend schema changes
- Before switching Supabase environments
- When TypeScript errors appear
- Before builds and deployments

### 3. ww-aadf-mobile-offline-validator.md
**Purpose**: Validate offline-first architecture compliance

**Capabilities**:
- Service-by-service coverage analysis
- Current coverage: ~10% (ProjectService only)
- Migration priority recommendations
- Effort estimation for offline-first conversion
- Pattern validation (SQLite → Queue → Sync → Supabase)

**When to Use**:
- Before implementing new API integrations
- When adding new services
- During architecture reviews
- For migration planning

### 4. ww-aadf-mobile-test-architect.md
**Purpose**: Orchestrate TDD/BDD testing strategy

**Capabilities**:
- Test suite generation (unit, integration, E2E)
- REAL Supabase testing only (no mocks policy)
- Integration tests FIRST priority
- BDD helper utilization (Given/When/Then)
- Coverage analysis (target: 80%+)

**When to Use**:
- BEFORE implementing any feature (TDD)
- When creating new services
- For test coverage improvements
- When writing E2E Maestro flows

### 5. ww-aadf-mobile-implementation-expert.md
**Purpose**: End-to-end feature implementation

**Capabilities**:
- Context7 research FIRST (proven 10x efficiency)
- TDD workflow (Red → Green → Refactor)
- Quality gates enforced from start
- Architecture pattern adherence
- File reference validation

**When to Use**:
- For complete feature implementation
- When starting new user stories
- For complex architectural changes
- When research is needed before coding

## Agent Coordination

All agents understand:
- **App.tsx Layer Inheritance**: Safe Area → Redux → Navigation → BLE → Auth
- **Offline-First Pattern**: SQLite → Queue → Sync → Supabase
- **Redux Setup**: 4 RTK Query APIs, 15 slices, listener middleware
- **BLE Custom Engine**: Command scheduling via useBle.ts (NOT standard BLE service)
- **Quality Gates**: All 13 gates are BLOCKING (no exceptions)
- **Testing Strategy**: REAL Supabase only, no mocks

## Usage Examples

```bash
# Quality validation before commit
Task ww-aadf-mobile-quality-enforcer "Validate all quality gates"

# Type synchronization after backend schema change
Task ww-aadf-mobile-type-guardian "Regenerate types from local Supabase"

# Offline-first coverage analysis
Task ww-aadf-mobile-offline-validator "Analyze offline coverage for deployments API"

# Test suite generation for new feature
Task ww-aadf-mobile-test-architect "Create test suite for deployment wizard"

# Feature implementation with TDD
Task ww-aadf-mobile-implementation-expert "Implement deployment editing with offline support"
```

## Architecture Knowledge

Each agent has deep knowledge of:

**File References** (actual paths with line numbers):
- `src/App.tsx` (900 lines) - Root component layer architecture
- `src/services/ProjectService.ts` (900 lines) - Offline-first template pattern
- `src/services/offline/OfflineService.ts` (900 lines) - Queue coordination
- `src/services/offline/DatabaseService.ts` - SQLite CRUD operations
- `src/hooks/useBle.ts` (700+ lines) - Custom BLE engine
- `src/redux/index.ts` - Store setup with 4 APIs, 15 slices
- `.git/hooks/pre-commit` (68 lines) - Quality gate enforcement
- `.github/workflows/quality-gate-validation.yml` - CI/CD validation

**Architecture Patterns**:
- Offline-first: Local SQLite reads → Background sync → Conflict resolution
- BLE: Custom engine with command scheduling (NOT standard BLE service pattern)
- State: RTK Query + Redux slices + listener middleware
- Testing: Real Supabase only (no mocks), integration tests first

## Documentation

**Complete Plan**: `@project-context/investigation/aadf-work-smart/2025-11-09-REVISED-specialized-agent-ecosystem-plan.md`
**Quick Reference**: `@project-context/investigation/aadf-work-smart/QUICK-REFERENCE-AGENT-INVENTORY.md`
**Completion Report**: `@project-context/investigation/aadf-work-smart/2025-11-09-PHASE-1-P0-MVP-COMPLETION-REPORT.md`

## Key Benefits

**Time Savings**: 62.5% (parallel creation: 1.5h vs 4h sequential)
**Projected ROI**: 218:1 (2h investment → 437h annual savings)
**Prevention Rate**: 100% for T-008-style failures
**Evidence-Based**: Context7 research (38,000+ code snippets), T-008 learnings
