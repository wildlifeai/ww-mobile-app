---
allowed-tools: Task, TodoWrite, Read, Write, Edit, Bash(npm:*), Bash(git:*), mcp__context7__*, mcp__serena__*
description: End-to-end feature implementation with TDD and quality gates
argument-hint: [feature specification or user story]
---

# Mobile Feature Implementation

Implement: $ARGUMENTS

Execute using ww-aadf-mobile-implementation-expert agent:

**Implementation Workflow** (MANDATORY):

1. **Context7 Research FIRST**
   - Research React Native patterns
   - Research Expo SDK 51 best practices
   - Research Redux Toolkit integration
   - Research Supabase offline-first patterns
   - Document architecture decisions

2. **TDD Workflow (RED → GREEN → REFACTOR)**
   - RED: Write failing tests BEFORE implementation
   - GREEN: Minimal implementation to make tests pass
   - REFACTOR: Code quality improvements

3. **Offline-First Integration**
   - SQLite schema design
   - OfflineService queue operations
   - Background sync implementation
   - Conflict resolution strategy

4. **All 13 Quality Gates Pass**
   - Test coverage >= 80%
   - TypeScript errors = 0
   - Console.log statements = 0
   - TestIDs on all interactive elements
   - Offline-first architecture validated

5. **Production Readiness Validation**
   - Quality score: 9/10+
   - Production readiness: 85%+
   - Remediation time: 0 hours

**Usage Examples**:
```bash
# Full feature implementation
/ww-aadf-mobile-implement "User profile editing: As a user, I want to edit my profile so that I can keep my information current"

# Enhancement implementation
/ww-aadf-mobile-implement "Add AI model selection to project forms"

# Bug fix implementation
/ww-aadf-mobile-implement "Fix offline sync conflict resolution bug"
```

**Expected Output**:
- Feature Implementation Plan
- Context7 research summary
- TDD test suite (integration + unit + E2E)
- Service layer implementation (offline-first)
- UI implementation (React Native + Redux)
- Quality gate validation report
- Production readiness assessment
