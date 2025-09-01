# SuperClaude Task Management System - Wildlife Watcher MVP2

**Generated**: 2025-08-31 @ 16:45 UTC  
**Updated**: 2025-09-01 @ 00:00 UTC  
**Current Phase**: Task 11 - SQLite Foundation (25% complete - 2/8 subtasks)  
**CRITICAL PREREQUISITE**: Task 11.8 UUID Alignment & Strapi Removal (blocks 11.3)  
**Critical Blocker**: Task 11.3 OfflineService.ts implementation (blocked by 11.8)  
**Branch**: dev-mvp2-development-claude-flow-test

## 🎯 SuperClaude Task Commands Available

### Current Task Management
```bash
/task:current                 # Show Task 11.8 current status & requirements
/task:focus 11.8             # Deep dive into UUID alignment implementation
/task:break:11.8             # Smart breakdown into 5-phase TDD approach
/task:uuid:align             # Execute UUID alignment with TDD regression prevention
/task:strapi:remove          # Remove all Strapi legacy types systematically
/task:test:types             # Run comprehensive type system validation tests
```

### Next Task Preparation (Post-11.8)
```bash
/task:focus 11.3             # Deep dive into OfflineService.ts implementation (after 11.8)
/task:break:11.3             # Smart breakdown of OfflineService.ts architecture
/task:implement:offline      # Execute TDD implementation for offline service layer
/task:test:offline           # Run comprehensive offline service test suite
```

### Context Preservation & Recovery
```bash
/task:save:context           # Save current implementation context
/task:restore:context        # Restore from saved context with full state
/task:checkpoint:11.3        # Create checkpoint before OfflineService.ts work
/task:resume:11.3            # Resume OfflineService.ts with preserved context
```

### Progress Tracking & Coordination
```bash
/task:status:foundation      # Check Foundation Layer (Tasks 9-11) completion
/task:ready:streams          # Assess parallel streams readiness (Tasks 12-23)
/task:swarm:prepare          # Prepare swarm coordination for post-Task 11
/task:update:progress        # Update project documentation with current status
```

### Advanced Task Operations
```bash
/task:analyze:blockers       # Identify blockers preventing parallel development
/task:optimize:sequence      # Optimize task execution sequence
/task:validate:dependencies  # Check dependency chain for Tasks 12-23
/task:estimate:completion    # Estimate completion timeline for remaining work
```

## 🚨 CRITICAL PREREQUISITE: Task 11.8

### **ABSOLUTE BLOCKER**: UUID Alignment & Strapi Removal

**Status**: 🔄 IN PROGRESS (Type system alignment required)  
**Dependencies**: ✅ Task 11.2 (Database Schema) - COMPLETED  
**Blocks**: Task 11.3 OfflineService.ts AND ALL Tasks 12-23  
**Urgency**: CRITICAL - All CRUD operations will fail without this fix

### Critical Issues Blocking Development:
1. **UUID vs Number ID Misalignment**: Auth system converts Supabase UUIDs to numbers
2. **Strapi Legacy Types**: `src/redux/api/types.ts` contains incompatible types
3. **SQLite Misalignment**: Database uses strings but not proper UUIDs
4. **CRUD Operation Failures**: All database operations will break in sync scenarios

### 5-Phase Implementation Plan (TDD Approach):

#### Phase 1: Remove Strapi Legacy Types (2 hours)
- Create `src/types/app.ts` with Supabase-aligned types
- Replace all imports from `redux/api/types.ts`
- Remove legacy Strapi files completely
- **Testing Gate**: Full test suite + TypeScript compilation

#### Phase 2: Fix Auth UUID Alignment (4 hours) 
- Update `AuthResponse` type: `id: string` (was number)
- Remove UUID→number conversion in `transformSupabaseUser()`
- Update all components using `user.id`
- **Testing Gate**: Auth flow end-to-end tests

#### Phase 3: SQLite Schema UUID Alignment (6 hours)
- Install `expo-crypto` for UUID generation
- Update SQLite schema to use UUID primary keys
- Implement offline UUID generation for records
- **Testing Gate**: Offline data + sync compatibility tests

#### Phase 4: Fix CRUD Operations (4 hours)
- Update all database operations for UUID consistency
- Fix user/project/deployment operations
- Ensure LoRaWAN device ID alignment
- **Testing Gate**: Complete CRUD test suite

#### Phase 5: Redux & API Updates (3 hours)
- Update all Redux slices to use string IDs
- Replace custom types with Supabase types
- Update API layer integration
- **Testing Gate**: Redux state + API integration tests

## 📋 Next Task Analysis: Task 11.3 (Post-11.8)

### **CRITICAL BLOCKER**: OfflineService.ts Implementation

**Status**: ⏳ BLOCKED by Task 11.8  
**Dependencies**: 🔄 Task 11.8 (UUID Alignment) - MUST BE COMPLETED FIRST  
**Blocks**: ALL Tasks 12-23 (Parallel streams cannot start without offline foundation)

### Key Requirements for Task 11.3:

#### Core Architecture Components
1. **OfflineService.ts** - Main service orchestrator
2. **NetworkMonitor** - Using `@react-native-community/netinfo`
3. **OperationsQueue** - Organisation-scoped offline operation queuing
4. **SyncEngine** - Role-based synchronization logic
5. **ConflictResolver** - Basic conflict detection (full resolution in Task 11.4)

#### Role-Based Sync Logic Implementation
```typescript
// Required sync filtering by user role
interface RoleBasedSyncConfig {
  ww_admin: {
    scope: 'global';           // All organisations, all data
    priority: 'highest';       // First sync priority
    permissions: 'full_access'; // Complete data access
  };
  project_admin: {
    scope: 'organisation';     // Current organisation only
    priority: 'high';          // Second sync priority  
    permissions: 'org_scoped'; // Organisation data access
  };
  project_member: {
    scope: 'project';          // Assigned projects only
    priority: 'normal';        // Standard sync priority
    permissions: 'project_scoped'; // Project data access
  };
}
```

#### Organisation-Aware Operations
- All operations must include `organisation_id` context
- Data isolation enforcement at service layer
- Organisation boundary validation for all sync operations
- Role-based data filtering throughout operation pipeline

#### LoRaWAN Integration Requirements
- Sync `battery_level` and `sd_card_usage` fields from webhook data
- Cache device status for offline access
- Priority sync for critical device alerts (low battery, full storage)
- Organisation-scoped device management

### Implementation Strategy (TDD Approach)

1. **Write Tests FIRST** (Following established pattern)
   - Unit tests: `tests/unit/services/offline/OfflineService.test.ts`
   - Integration tests with NetworkMonitor
   - Role-based sync filtering tests
   - Organisation isolation validation tests

2. **Implement Core Architecture**
   - Create `src/services/offline/OfflineService.ts`
   - Implement NetworkMonitor with state management
   - Build operations queue with persistence
   - Add role-based filtering logic

3. **Integrate with Existing Systems**
   - Connect to Redux store (from Task 10)
   - Integrate with DatabaseService (from Task 11.2)
   - Connect to API service layer
   - Add offline status indicators

## 🚀 Parallel Development Streams (Post-Task 11)

### Stream A: Project Management (Tasks 12-14)
**Agents**: Auth-Agent + Data-Agent  
**Dependencies**: ✅ Task 11 (SQLite Foundation)  
**Features**: Organisation-scoped project CRUD, WW Admin oversight

### Stream B: Deployment Workflows (Tasks 15-17)  
**Agents**: UI-Agent + BLE-Agent  
**Dependencies**: ✅ Task 11 (SQLite Foundation)  
**Features**: 6-step deployment wizard, LoRaWAN integration

### Stream C: Devices & Maps (Tasks 18-20)
**Agents**: BLE-Agent + Sync-Agent  
**Dependencies**: ✅ Task 11 (SQLite Foundation)  
**Features**: Device management, map visualizations, BLE communication

### Integration Phase (Tasks 21-23)
**Agents**: Quality-Agent + Integration-Agent  
**Dependencies**: ✅ Streams A, B, C completion  
**Features**: Testing, optimization, production deployment

## 🧠 Context Preservation System

### Implementation Context Storage
```typescript
interface TaskContext {
  taskId: '11.3';
  phase: 'implementation';
  currentWork: {
    component: 'OfflineService.ts';
    testsCovered: string[];
    implementationStatus: 'planned' | 'in-progress' | 'testing' | 'complete';
    codeGenerated: boolean;
    testsGenerated: boolean;
    integrationTested: boolean;
  };
  blockers: string[];
  nextSteps: string[];
  sessionNotes: string;
}
```

### Session Recovery Protocol
1. **Auto-save** implementation state after each major step
2. **Restore** full context including code progress, test status, integration points
3. **Resume** from exact stopping point with all context preserved
4. **Validate** restored state before continuing implementation

## 🎯 Smart Task Breakdown: Task 11.3

### Micro-Tasks (SuperClaude Auto-Generated)
1. **11.3.1**: Create OfflineService.ts skeleton with interfaces
2. **11.3.2**: Implement NetworkMonitor with @react-native-community/netinfo
3. **11.3.3**: Build operations queue with organisation scoping
4. **11.3.4**: Add role-based sync filtering logic
5. **11.3.5**: Integrate LoRaWAN status sync functionality
6. **11.3.6**: Implement retry logic with exponential backoff
7. **11.3.7**: Add conflict detection preparation
8. **11.3.8**: Create comprehensive test suite
9. **11.3.9**: Integration testing with DatabaseService
10. **11.3.10**: Update Redux store integration

### Complexity Analysis (Post-11.8)
- **Estimated Effort**: 6-8 hours (Complex architecture task) 
- **Risk Level**: High (Blocks all parallel development)
- **Dependencies**: High (Requires Task 11.8 UUID alignment completion)
- **Testing Requirements**: Comprehensive (Multiple integration points)

## 🔄 Git Integration Strategy

### Branch Management
- **Current**: dev-mvp2-development-claude-flow-test
- **Commit Strategy**: Logical feature completion points
- **Merge Target**: dev-mvp2-development-claude-flow

### Commit Sequence for Task 11.8 (Immediate Priority)
1. `feat(types): create Supabase-aligned types and remove Strapi legacy`
2. `fix(auth): align AuthResponse with Supabase UUIDs, remove number conversion`
3. `feat(sqlite): update schema for UUID alignment with expo-crypto`
4. `fix(crud): update all CRUD operations for UUID consistency`
5. `feat(redux): replace custom types with Supabase types in all slices`
6. `docs: update Task 11.8 completion and unblock Task 11.3`

### Commit Sequence for Task 11.3 (Post-11.8)
1. `feat(offline): add OfflineService architecture and tests`
2. `feat(offline): implement NetworkMonitor with role-based sync`
3. `feat(offline): add operations queue with organisation scoping`
4. `feat(offline): integrate LoRaWAN status sync functionality`
5. `feat(offline): complete OfflineService integration with Redux`
6. `docs: update Task 11.3 completion in project context`

## 🎪 Swarm Coordination Readiness

### Swarm Initialization Criteria
- ✅ **Foundation Layer Complete**: Tasks 9-10 ✅, Task 11.8 + 11.3 target completion
- ✅ **Architecture Stable**: Redux + SQLite + UUID alignment + Offline services operational
- ✅ **Testing Framework**: TDD patterns established and operational
- ⏳ **Task 11.8 Complete**: UUID alignment REQUIRED before 11.3
- ⏳ **Task 11.3 Complete**: REQUIRED before parallel streams

### Agent Specialization Strategy
```yaml
agents:
  auth_agent:
    expertise: [authentication, user_roles, permissions, organisation_access]
    tasks: [12, 13, 14]
    
  data_agent:
    expertise: [database_operations, offline_sync, crud_operations]
    tasks: [12, 13, 14]
    
  ui_agent:
    expertise: [react_native, expo, user_interface, navigation]
    tasks: [15, 16, 17]
    
  ble_agent:
    expertise: [bluetooth, device_communication, lorawan_integration]
    tasks: [15, 16, 17, 18, 19, 20]
    
  sync_agent:
    expertise: [data_synchronization, conflict_resolution, network_management]
    tasks: [18, 19, 20]
    
  quality_agent:
    expertise: [testing, performance, security, validation]
    tasks: [21, 22, 23]
    
  integration_agent:
    expertise: [deployment, production, integration, optimization]
    tasks: [21, 22, 23]
```

### Coordination Protocol
1. **Sequential Completion**: Task 11.8 (UUID) → Task 11.3 (Offline) → Enable parallel streams
2. **Stream Independence**: A, B, C can run simultaneously post-Task 11.8 + 11.3
3. **Integration Dependencies**: Streams A+B+C → Integration phase
4. **Quality Gates**: Each stream must pass quality validation before integration

## 📊 Progress Tracking Integration

### TaskMaster CLI Integration
```bash
# Current status commands
task-master show 11                    # View complete Task 11 status
task-master show 11.3                 # View specific subtask details  
task-master set-status --id=11.3 --status=in-progress
task-master update-subtask --id=11.3 --prompt="OfflineService.ts implementation started"

# Progress tracking
task-master progress                   # Overall project progress
task-master next                       # Get next priority task
task-master blockers                   # List current blockers
```

### Documentation Updates
- **Real-time**: Update `/project-context/learnings/claude-flow-usage-log.md`
- **Milestone**: Update project progress reports
- **Completion**: Update implementation spec status
- **Git Integration**: Include TaskMaster IDs in commit messages

## 🎯 Next Actions Priority Queue

### Immediate (Next 30 minutes)
1. `/task:focus 11.3` - Deep dive into OfflineService.ts requirements
2. `/task:break:11.3` - Smart breakdown into micro-tasks
3. `/task:checkpoint:11.3` - Create implementation checkpoint

### Short-term (Next 2-4 hours)  
1. `/task:implement:offline` - Execute TDD implementation
2. `/task:test:offline` - Comprehensive testing validation
3. `/task:update:progress` - Document completion status

### Medium-term (Next 4-8 hours)
1. Complete Task 11.4-11.7 (Remaining SQLite foundation)
2. `/task:swarm:prepare` - Initialize swarm coordination
3. Launch parallel development streams A, B, C

### Long-term (Next 1-2 weeks)
1. Complete all parallel streams (Tasks 12-20)
2. Execute integration phase (Tasks 21-23)
3. Production deployment preparation

---

**SuperClaude Task Management System v1.0**  
**Wildlife Watcher MVP2 Development**  
**Status**: Ready for Task 11.3 implementation  
**Last Updated**: 2025-08-31 @ 16:45 UTC