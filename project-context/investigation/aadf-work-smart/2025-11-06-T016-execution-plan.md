# AADF Work Smart Execution Plan - Task T-016

**Task**: Complete LoggingService implementation with Supabase sync
**Project**: MVP2 Tranche 1 - Foundation Replanning
**Stream**: Stream D - Database Logging
**Created**: 2025-11-06
**Status**: IN PROGRESS

---

## Overview

**Objective**: Implement production-ready LoggingService with distributed tracing, offline queueing, and Supabase api_logs integration.

**Current State**:
- Backend api_logs table ready (20 columns, 9 indexes, WW Admin RLS policy)
- 513 console.log/error/warn/info/debug calls across 56 files
- No LoggingService implementation exists
- Types regenerated from backend schema (organisation_id required field)

**Success Criteria**:
- LoggingService class implemented with distributed tracing
- Correlation ID generation and propagation
- Offline queue with batch sync to Supabase
- Context enrichment (app_version, platform, session_id)
- Integration with existing error boundaries
- 100% test coverage (unit + integration)
- Zero TypeScript errors
- Ready for T-017 (console.log replacement)

---

## Evidence-Based Research (Phase 1)

**Status**: ⏳ IN PROGRESS

**Technologies**:
1. React Native logging patterns
2. TypeScript logger architecture
3. Supabase JavaScript client (log shipping)
4. AsyncStorage (offline persistence)
5. Distributed tracing patterns (correlation IDs)

**Research Agent**: General-purpose agent researching via Context7

**Deliverable**: Research findings document
- Location: `@project-context/investigation/aadf-work-smart/2025-11-06-T016-logging-service-research.md`
- Expected: 1000-1500 words with vendor-specific patterns

---

## Task Breakdown

### Phase 1: Evidence-Based Research (MANDATORY FIRST) ⏳
**Agent**: general-purpose | **Estimated**: 0.5h | **Status**: IN PROGRESS

**Sub-tasks**:
- [ ] Context7: React Native logging patterns (distributed tracing, correlation IDs)
- [ ] Context7: TypeScript logger design patterns
- [ ] Context7: Supabase client integration patterns
- [ ] Context7: Offline queue and sync strategies
- [ ] WebSearch: 2025 React Native logging best practices
- [ ] Document research findings

**Exit Criteria**:
- Research document created with vendor-specific patterns
- Architecture pattern validated (singleton vs class-based)
- Offline sync strategy defined (batch size, frequency)
- Security considerations documented (PII sanitization)

---

### Phase 2: Codebase Analysis (Parallel with Research) 🔄
**Agent**: self (Claude Code) | **Estimated**: 0.25h | **Status**: PENDING

**Sub-tasks**:
- [ ] Analyze api_logs schema (20 columns, all nullable except organisation_id)
- [ ] Review existing console.log usage patterns (56 files)
- [ ] Examine current error boundaries (src/components/)
- [ ] Review Redux auth slice (user_id, organisation_id access)
- [ ] Check app.config.js (app_version access)
- [ ] Review Platform API usage (React Native)

**Exit Criteria**:
- Complete understanding of api_logs schema requirements
- User/org/project/deployment context access mapped
- App metadata access points identified
- Error boundary integration points defined

---

### Phase 3: LoggingService Architecture Design
**Agent**: backend-architect | **Estimated**: 0.5h | **Status**: PENDING

**Dependencies**: Phase 1 (Research), Phase 2 (Analysis)

**Sub-tasks**:
- [ ] Design LoggingService class interface
- [ ] Design correlation ID generation strategy (UUID v4)
- [ ] Design session ID lifecycle management
- [ ] Design offline queue structure (AsyncStorage)
- [ ] Design batch sync mechanism (size, frequency)
- [ ] Design context enrichment pipeline
- [ ] Design error handling and fallback strategies
- [ ] Create architecture diagram

**Deliverable**: Architecture design document
- Location: `@project-context/investigation/aadf-work-smart/2025-11-06-T016-architecture.md`

**Exit Criteria**:
- Class interface defined with TypeScript types
- Correlation ID propagation strategy documented
- Offline queue strategy defined (max size, batch size)
- Sync frequency determined (network change, interval)
- Context enrichment pipeline specified

---

### Phase 4: TDD - Write Tests FIRST (Red)
**Agent**: quality-assurance-engineer | **Estimated**: 1.0h | **Status**: PENDING

**Dependencies**: Phase 3 (Architecture)

**Test Categories**:

**Unit Tests** (`src/services/__tests__/LoggingService.test.ts`):
- [ ] Correlation ID generation (UUID v4 format)
- [ ] Session ID lifecycle (persists across app restarts)
- [ ] Log level filtering (debug < info < warn < error < fatal)
- [ ] Context enrichment (app_version, platform, user_id, org_id)
- [ ] Offline queue operations (enqueue, dequeue, batch)
- [ ] Queue size limits (max 1000 logs)
- [ ] PII sanitization (strip sensitive fields)

**Integration Tests** (`src/services/__tests__/LoggingService.integration.test.ts`):
- [ ] Supabase log insert (successful upload)
- [ ] Offline queue persistence (AsyncStorage)
- [ ] Batch sync on network change
- [ ] Error boundary integration
- [ ] Redux state access (user_id, org_id)
- [ ] Correlation ID propagation across async ops

**Exit Criteria**:
- 15+ unit tests written (all failing - Red phase)
- 5+ integration tests written (all failing - Red phase)
- Test coverage plan: 100% of LoggingService methods
- TestID patterns follow testing-standards.md

---

### Phase 5: Implementation - LoggingService Core (Green)
**Agent**: mobile-dev | **Estimated**: 1.0h | **Status**: PENDING

**Dependencies**: Phase 4 (Tests written)

**Implementation Steps**:
- [ ] Create `src/services/LoggingService.ts`
- [ ] Implement singleton pattern (getInstance())
- [ ] Implement correlation ID generator (crypto.randomUUID())
- [ ] Implement session ID manager (AsyncStorage persistence)
- [ ] Implement log level methods (debug, info, warn, error, fatal)
- [ ] Implement context enrichment (app_version, platform, user_id, org_id)
- [ ] Implement PII sanitization
- [ ] Export typed interfaces

**File Structure**:
```typescript
// src/services/LoggingService.ts
export interface LogEntry {
  correlation_id: string;
  session_id: string;
  log_level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  log_message: string;
  source: string; // filename:line
  context?: Record<string, any>;
  stack_trace?: string;
  // ... api_logs columns
}

export class LoggingService {
  private static instance: LoggingService;
  private sessionId: string;
  private logQueue: LogEntry[] = [];

  static getInstance(): LoggingService;

  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, error?: Error, context?: Record<string, any>): void;
  fatal(message: string, error: Error, context?: Record<string, any>): void;

  generateCorrelationId(): string;
  enrichContext(entry: LogEntry): LogEntry;
  sanitizePII(data: any): any;
}
```

**Exit Criteria**:
- LoggingService.ts created with complete implementation
- All unit tests passing (Green phase)
- TypeScript compilation successful
- No lint errors

---

### Phase 6: Implementation - Offline Queue & Supabase Sync (Green)
**Agent**: mobile-dev | **Estimated**: 1.0h | **Status**: PENDING

**Dependencies**: Phase 5 (Core implementation)

**Implementation Steps**:
- [ ] Implement offline queue (AsyncStorage key: 'logging_queue')
- [ ] Implement batch operations (max batch size: 50 logs)
- [ ] Implement queue size limits (max 1000 logs, drop oldest)
- [ ] Implement Supabase sync method (insert batch)
- [ ] Implement network change listener (NetInfo)
- [ ] Implement sync interval (every 5 minutes if online)
- [ ] Implement error handling (retry with exponential backoff)
- [ ] Add queue metrics (size, oldest timestamp)

**AsyncStorage Integration**:
```typescript
// Queue persistence
private async loadQueue(): Promise<LogEntry[]>;
private async saveQueue(): Promise<void>;
private async clearQueue(): Promise<void>;

// Batch sync
private async syncBatch(): Promise<void>;
private async uploadToSupabase(batch: LogEntry[]): Promise<void>;
```

**Exit Criteria**:
- Offline queue persists across app restarts
- Batch sync uploads to api_logs table successfully
- Network change triggers sync automatically
- All integration tests passing (Green phase)
- Zero memory leaks (queue bounded)

---

### Phase 7: Integration with Error Boundaries
**Agent**: mobile-dev | **Estimated**: 0.5h | **Status**: PENDING

**Dependencies**: Phase 6 (Sync implementation)

**Integration Points**:
- [ ] Update error boundaries to use LoggingService.fatal()
- [ ] Update Redux error middleware (if exists)
- [ ] Update navigation error handlers
- [ ] Test error capture and upload

**Exit Criteria**:
- Error boundaries log to LoggingService
- Errors include stack traces
- Errors sync to Supabase when online

---

### Phase 8: Refactor & Optimize (Refactor)
**Agent**: mobile-dev | **Estimated**: 0.5h | **Status**: PENDING

**Dependencies**: Phase 7 (Integration complete)

**Refactoring Steps**:
- [ ] Extract constants (BATCH_SIZE, MAX_QUEUE_SIZE, SYNC_INTERVAL)
- [ ] Add JSDoc comments
- [ ] Optimize batch operations (reduce AsyncStorage writes)
- [ ] Add performance monitoring (log sync latency)
- [ ] Code cleanup (remove debug console.logs)

**Exit Criteria**:
- Code follows component-patterns.md
- Performance optimized (minimal AsyncStorage I/O)
- All tests still passing (Refactor phase)

---

### Phase 9: Quality Validation
**Agent**: quality-assurance-engineer | **Estimated**: 0.5h | **Status**: PENDING

**Dependencies**: Phase 8 (Refactor complete)

**Validation Steps**:
- [ ] Run full test suite (`npm test`)
- [ ] Run TypeScript type check (`npm run type-check`)
- [ ] Run ESLint (`npm run lint`)
- [ ] Verify 100% test coverage
- [ ] Manual testing (log generation, offline sync)
- [ ] Performance testing (1000 logs, sync time < 2s)
- [ ] Memory leak testing (queue bounded at 1000)

**Exit Criteria**:
- All tests passing (15+ unit, 5+ integration)
- Zero TypeScript errors
- Zero ESLint errors
- Test coverage ≥ 95%
- Performance validated (sync < 2s for 1000 logs)

---

### Phase 10: Documentation & Commit
**Agent**: self (Claude Code) | **Estimated**: 0.25h | **Status**: PENDING

**Dependencies**: Phase 9 (Quality validated)

**Documentation Steps**:
- [ ] Update AADF framework learnings (`@project-context/learnings/ai-agentic-development-framework.md`)
- [ ] Document LoggingService usage examples
- [ ] Update PROJECT-STATUS.md (T-016 complete)
- [ ] Archive execution plan
- [ ] Commit with conventional commits message

**Commit Structure**:
```bash
git add src/services/LoggingService.ts
git add src/services/__tests__/LoggingService.test.ts
git add src/services/__tests__/LoggingService.integration.test.ts
git add project-context/investigation/aadf-work-smart/
git commit -m "feat(logging): implement LoggingService with distributed tracing and Supabase sync

- Implement LoggingService singleton with correlation IDs
- Add offline queue with AsyncStorage persistence
- Add batch sync to api_logs table (50 logs per batch)
- Add context enrichment (app_version, platform, user_id, org_id)
- Add PII sanitization
- Integrate with error boundaries
- 100% test coverage (20+ tests)
- Stream D (T-016) complete

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Exit Criteria**:
- AADF framework updated with logging patterns
- LoggingService documented with usage examples
- PROJECT-STATUS.md updated (T-016 complete)
- Execution plan archived
- Clean git commit created

---

## Execution Streams (Parallel Opportunities)

**Stream 1: Research + Analysis** (0.75h total)
- Phase 1: Evidence-Based Research (0.5h) - general-purpose agent
- Phase 2: Codebase Analysis (0.25h) - Claude Code

**Stream 2: Design + TDD** (1.5h total) - SEQUENTIAL
- Phase 3: Architecture Design (0.5h) - backend-architect agent
- Phase 4: Write Tests FIRST (1.0h) - quality-assurance-engineer agent

**Stream 3: Implementation** (2.0h total) - SEQUENTIAL
- Phase 5: LoggingService Core (1.0h) - mobile-dev agent
- Phase 6: Offline Queue & Sync (1.0h) - mobile-dev agent

**Stream 4: Integration + Quality** (1.25h total) - SEQUENTIAL
- Phase 7: Error Boundary Integration (0.5h) - mobile-dev agent
- Phase 8: Refactor & Optimize (0.5h) - mobile-dev agent
- Phase 9: Quality Validation (0.25h) - quality-assurance-engineer agent

**Stream 5: Documentation** (0.25h total)
- Phase 10: Documentation & Commit (0.25h) - Claude Code

**Total Estimated Time**: 4.0 hours (with parallelization)
**Wall-Clock Time**: ~3.0 hours (Stream 1 parallel with Stream 2 start)

---

## Quality Gates

### Gate 1: Research Complete (Hour 0.5)
- [ ] Context7 research document created
- [ ] Architecture pattern validated
- [ ] Offline sync strategy defined

### Gate 2: Tests Written (Hour 2.0)
- [ ] 15+ unit tests written (all failing - Red)
- [ ] 5+ integration tests written (all failing - Red)
- [ ] Test coverage plan approved

### Gate 3: Core Implementation (Hour 3.0)
- [ ] LoggingService class implemented
- [ ] All unit tests passing (Green)
- [ ] TypeScript compilation successful

### Gate 4: Integration Complete (Hour 4.0)
- [ ] Offline queue implemented
- [ ] Supabase sync working
- [ ] All integration tests passing
- [ ] Error boundaries integrated

### Gate 5: Quality Validated (Hour 4.0)
- [ ] All tests passing (20+ tests)
- [ ] Zero TypeScript errors
- [ ] Zero ESLint errors
- [ ] Test coverage ≥ 95%
- [ ] Performance validated

### Gate 6: Ready for Commit (Hour 4.0)
- [ ] AADF framework updated
- [ ] Documentation complete
- [ ] Clean git commit prepared
- [ ] USER APPROVAL OBTAINED

---

## Risk Management

**Risk 1**: AsyncStorage performance issues with large queues
- **Mitigation**: Queue bounded at 1000 logs, batch writes, use JSON.stringify efficiently
- **Fallback**: Reduce max queue size to 500

**Risk 2**: Supabase rate limits on batch upload
- **Mitigation**: Batch size limited to 50 logs, exponential backoff on errors
- **Fallback**: Reduce batch size to 25

**Risk 3**: Correlation ID propagation complex across async ops
- **Mitigation**: Use AsyncLocalStorage or context parameter approach (evidence-based from research)
- **Fallback**: Simplify to session-level correlation only

**Risk 4**: Organisation_id required but user not in org yet
- **Mitigation**: Use default "General" org ID (550e8400-e29b-41d4-a716-446655440002) as fallback
- **Fallback**: Skip logging until user has org (not ideal)

**Risk 5**: Test writing takes longer than 1 hour
- **Mitigation**: Focus on critical path tests first (correlation ID, offline queue, sync)
- **Adjustment**: Extend test phase by 0.5h if needed

---

## Success Metrics

**Immediate**:
- LoggingService class created with all methods
- 100% test coverage achieved
- Zero TypeScript/lint errors
- All quality gates passed

**T-016 Completion**:
- Distributed tracing with correlation IDs working
- Offline queue persisting logs across app restarts
- Batch sync to api_logs table successful
- Context enrichment working (8 metadata fields)
- Error boundaries integrated
- Ready for T-017 (console.log replacement)

**AADF Framework**:
- Research-first approach validated (Context7)
- TDD methodology followed (Red-Green-Refactor)
- Parallel execution utilized (research + analysis)
- Quality gates enforced (6 checkpoints)
- Evidence-based decisions documented

---

## Agent Coordination Matrix

| Phase | Agent | MCPs Required | Dependencies |
|-------|-------|---------------|--------------|
| 1 | general-purpose | Context7, WebSearch, Serena | None |
| 2 | Claude Code | Serena, Read, Grep | None |
| 3 | backend-architect | Context7, Serena | Phase 1, 2 |
| 4 | quality-assurance-engineer | Context7, Serena | Phase 3 |
| 5 | mobile-dev | Serena, IDE | Phase 4 |
| 6 | mobile-dev | Serena, Supabase, IDE | Phase 5 |
| 7 | mobile-dev | Serena, IDE | Phase 6 |
| 8 | mobile-dev | Serena, IDE | Phase 7 |
| 9 | quality-assurance-engineer | IDE, Bash | Phase 8 |
| 10 | Claude Code | Write, Bash | Phase 9 |

---

## Timeline

**Hour 0.0-0.5**: Phase 1 (Research) - general-purpose agent
**Hour 0.0-0.25**: Phase 2 (Analysis) - Claude Code (PARALLEL)
**Hour 0.5-1.0**: Phase 3 (Architecture) - backend-architect agent
**Hour 1.0-2.0**: Phase 4 (Tests) - quality-assurance-engineer agent
**Hour 2.0-3.0**: Phase 5 (Core) - mobile-dev agent
**Hour 3.0-4.0**: Phase 6 (Sync) - mobile-dev agent
**Hour 4.0-4.5**: Phase 7 (Integration) - mobile-dev agent
**Hour 4.5-5.0**: Phase 8 (Refactor) - mobile-dev agent
**Hour 5.0-5.25**: Phase 9 (Quality) - quality-assurance-engineer agent
**Hour 5.25-5.5**: Phase 10 (Documentation) - Claude Code

**Target Completion**: 4.0 hours (estimated) → 3.5 hours (optimized with parallelization)

---

## Notes

- This is Stream D, Task T-016 from MVP2 Tranche 1
- Backend T-002 complete (api_logs table ready with 20 columns)
- Mobile types regenerated (organisation_id required field confirmed)
- Evidence-based development MANDATORY (Context7 research first)
- TDD methodology MANDATORY (tests before implementation)
- AADF framework learnings will be captured throughout
- User approval required before final commit

---

**Status**: ⏳ IN PROGRESS - Phase 1 (Research) started
**Next Gate**: Gate 1 - Research Complete (Hour 0.5)
