# 🎯 Wildlife Watcher MVP2 - Master Execution Plan

**Generated**: 2025-09-17
**Status**: READY FOR EXECUTION
**Timeline**: 20 working days (Realistic Estimate)
**Methodology**: AADF Framework with Evidence-Based Development

## 📊 Executive Summary

### Current State (September 17, 2025)
- **Foundation Layer**: 50% Complete
  - ✅ Tasks 1-10: Complete (Expo migration, auth, Redux)
  - ✅ Task 11.8: UUID alignment COMPLETED
  - ✅ Task 11.3: OfflineService.ts DISCOVERED COMPLETE
  - ⏳ Tasks 11.4-11.7: Remaining SQLite work (non-blocking)

### Key Discoveries
1. **Critical Infrastructure READY**: All blocking components completed
2. **Parallel Execution ENABLED**: 3 streams can launch immediately
3. **3x Velocity Increase**: Available through parallel development

## 🗺️ Task Dependency Map

```mermaid
graph TD
    subgraph "Foundation Layer [90% COMPLETE]"
        T1[Task 1-8: Setup ✅]
        T9[Task 9: Redux ✅]
        T10[Task 10: Auth ✅]
        T11[Task 11: SQLite 50%]
    end

    subgraph "Parallel Streams [READY]"
        A[Stream A: Tasks 12-14<br/>Project Management]
        B[Stream B: Tasks 15-17<br/>Deployment Workflows]
        C[Stream C: Tasks 18-20<br/>Devices & Maps]
    end

    subgraph "Integration Phase"
        I[Tasks 21-23<br/>Testing & Deployment]
    end

    T11 --> A
    T11 --> B
    T11 --> C
    A --> I
    B --> I
    C --> I
```

## 📋 Task Execution Plan

### ✅ COMPLETED TASKS (1-10, 11.3, 11.8)

| Task | Title | Status | Key Achievements |
|------|-------|--------|------------------|
| 1-8 | Foundation Setup | ✅ COMPLETE | Expo SDK 51 migration, environment setup |
| 9 | Redux Store Setup | ✅ COMPLETE | State management operational |
| 10 | Auth System | ✅ COMPLETE | Supabase auth with role-based access |
| 11.8 | UUID Alignment | ✅ COMPLETE | String UUIDs throughout system |
| 11.3 | OfflineService.ts | ✅ COMPLETE | 594 lines production code found |

### 🚀 STREAM A: Project Management (Tasks 12-14)
**Duration**: 18 hours | **Dependencies**: Task 11 foundation | **Status**: READY TO START

#### Task 12: Project List & Management Interface
- **Priority**: HIGH
- **Primary Agent**: `mobile-dev` (UI/UX implementation)
- **Secondary Agent**: `cross-project-coordinator` (Backend API coordination)
- **Duration**: 6 hours (4 hrs mobile, 2 hrs backend)
- **Dependencies**: Task 11 (SQLite)
- **Cross-Project Requirements** 🔄:
  - Backend: Project CRUD API endpoints
  - Backend: RLS policies for organisation isolation
  - Backend: Project member management functions
- **Mobile Requirements**:
  - Project list UI with pull-to-refresh
  - Project creation/edit forms
  - Organisation-scoped data filtering
  - Offline queue integration
- **Resources**:
  - Context7: React Native List components
  - Existing DatabaseService.ts
  - Redux store integration
- **Backend Spec Location**: `~/wildlife-watcher-backend/project-context/MVP2-Tasks/task-12-backend-spec.md`
- **Quality Gates**:
  - TypeScript compilation ✓
  - CRUD operations tested ✓
  - Organisation isolation verified ✓
  - Backend/Mobile sync tested ✓

#### Task 13: User Role Management & Permissions
- **Priority**: HIGH
- **Primary Agent**: `cross-project-coordinator` (Backend-heavy task)
- **Secondary Agent**: `mobile-dev` (UI components)
- **Duration**: 6 hours (4 hrs backend, 2 hrs mobile)
- **Dependencies**: Task 12
- **Cross-Project Requirements** 🔄:
  - Backend: Role assignment API endpoints
  - Backend: Permission checking functions
  - Backend: Organisation role management
  - Backend: Role change audit logging
- **Mobile Requirements**:
  - Role assignment UI
  - Permission visualization
  - Role selector components
- **Resources**:
  - Supabase user_roles table
  - Auth system from Task 10
  - Role-based sync from Task 11.3
- **Backend Spec Location**: `~/wildlife-watcher-backend/project-context/MVP2-Tasks/task-13-backend-spec.md`
- **Quality Gates**:
  - Role changes persist ✓
  - Permissions enforced ✓
  - Cross-org isolation ✓
  - Audit trail functional ✓

#### Task 14: Organisation Context Switching
- **Priority**: MEDIUM
- **Primary Agent**: `mobile-dev` (Mobile-only implementation)
- **Agent Rationale**: Pure mobile UI/state management, no backend changes needed
- **Duration**: 6 hours (all mobile)
- **Dependencies**: Task 13
- **Requirements**:
  - Organisation selector UI
  - Context persistence in Redux
  - Data refresh on switch
  - Clear current cache on org change
- **Resources**:
  - Redux organisation slice
  - OfflineService organisation filtering
  - Context7: React Native dropdown/selector patterns
- **Quality Gates**:
  - Context switches cleanly ✓
  - Data isolation maintained ✓
  - UI responsive ✓
  - Cache properly cleared ✓

### 🎯 STREAM B: Deployment Workflows (Tasks 15-17)
**Duration**: 24 hours | **Dependencies**: Task 11 foundation | **Status**: READY TO START

#### Task 15: 6-Step Deployment Wizard UI
- **Priority**: CRITICAL
- **Primary Agent**: `mobile-dev` (Complex UI state management)
- **Secondary Agent**: `cross-project-coordinator` (Deployment API)
- **Agent Rationale**: Complex wizard requires mobile expertise, backend needs deployment storage
- **Duration**: 10 hours (8 hrs mobile, 2 hrs backend)
- **Dependencies**: Task 11
- **Cross-Project Requirements** 🔄:
  - Backend: Deployment creation/update endpoints
  - Backend: Draft deployment storage
  - Backend: Deployment validation rules
- **Mobile Requirements**:
  - 6-step form wizard framework
  - State persistence between steps
  - Progress indication UI
  - Step validation logic
- **Resources**:
  - Context7: React Native form/wizard patterns
  - Redux for wizard state management
  - Existing deployment types
- **Backend Spec Location**: `~/wildlife-watcher-backend/project-context/MVP2-Tasks/task-15-backend-spec.md`
- **Quality Gates**:
  - All 6 steps functional ✓
  - State persists on navigation ✓
  - Validation comprehensive ✓
  - Draft saves work ✓

#### Task 16: Device Configuration & Setup
- **Priority**: HIGH
- **Primary Agent**: `mobile-dev` (BLE implementation)
- **Secondary Agent**: `cross-project-coordinator` (Device registry)
- **Agent Rationale**: BLE is mobile-specific, backend needs device tracking
- **Duration**: 8 hours (6 hrs mobile BLE, 2 hrs backend)
- **Dependencies**: Task 15
- **Cross-Project Requirements** 🔄:
  - Backend: Device registration endpoints
  - Backend: Configuration template storage
  - Backend: LoRaWAN device registry
- **Mobile Requirements**:
  - BLE device discovery UI
  - Configuration payload builder
  - LoRaWAN setup interface
  - BLE connection management
- **Resources**:
  - react-native-ble-manager
  - Device configuration protocols
  - Context7: BLE integration patterns
- **Backend Spec Location**: `~/wildlife-watcher-backend/project-context/MVP2-Tasks/task-16-backend-spec.md`
- **Quality Gates**:
  - BLE connection stable ✓
  - Configuration persists ✓
  - Error handling robust ✓
  - Device registered in backend ✓

#### Task 17: Field Deployment Validation
- **Priority**: HIGH
- **Primary Agent**: `mobile-dev` (Mobile-heavy validation)
- **Secondary Agent**: `cross-project-coordinator` (Validation storage)
- **Agent Rationale**: Validation UI/logic is mobile, backend stores results
- **Duration**: 6 hours (4 hrs mobile, 2 hrs backend)
- **Dependencies**: Task 16
- **Cross-Project Requirements** 🔄:
  - Backend: Deployment validation endpoints
  - Backend: Photo storage integration
  - Backend: GPS validation rules
- **Mobile Requirements**:
  - Deployment checklist UI
  - Photo capture integration
  - GPS location capture
  - Final confirmation flow
- **Resources**:
  - expo-camera
  - expo-location
  - Context7: Camera/location patterns
- **Backend Spec Location**: `~/wildlife-watcher-backend/project-context/MVP2-Tasks/task-17-backend-spec.md`
- **Quality Gates**:
  - All validations work ✓
  - Photos upload correctly ✓
  - Location accurate ✓
  - Backend stores validation ✓

### 🗺️ STREAM C: Devices & Maps (Tasks 18-20)
**Duration**: 30 hours | **Dependencies**: Task 11 foundation | **Status**: READY TO START

#### Task 18: Device Management Interface
- **Priority**: HIGH
- **Agent**: `mobile-dev`
- **Duration**: 10 hours
- **Dependencies**: Task 11
- **Requirements**:
  - Device list with status
  - Device details view
  - LoRaWAN status display
  - Battery/storage indicators
- **Resources**:
  - Device types and schemas
  - LoRaWAN status from Task 11.3
  - UI component library
- **Quality Gates**:
  - Device list renders ✓
  - Status updates real-time ✓
  - Details comprehensive ✓

#### Task 19: Map Visualization & Deployment Tracking
- **Priority**: HIGH
- **Agent**: `frontend-design-expert`
- **Duration**: 12 hours
- **Dependencies**: Task 18
- **Requirements**:
  - MapBox/Google Maps integration
  - Device markers on map
  - Clustering for many devices
  - Deployment routes
- **Resources**:
  - react-native-maps
  - Context7: Map integration patterns
  - GPS coordinates from deployments
- **Quality Gates**:
  - Map renders correctly ✓
  - Markers interactive ✓
  - Performance acceptable ✓

#### Task 20: BLE Communication & Device Sync
- **Priority**: CRITICAL
- **Agent**: BLE specialist + `sync-engine-agent`
- **Duration**: 8 hours
- **Dependencies**: Task 19
- **Requirements**:
  - BLE sync protocol
  - Data download from devices
  - Progress indication
  - Error recovery
- **Resources**:
  - react-native-ble-manager
  - Device communication specs
  - Offline sync patterns
- **Quality Gates**:
  - BLE sync reliable ✓
  - Data integrity maintained ✓
  - Error handling comprehensive ✓

### 🔧 INTEGRATION PHASE (Tasks 21-23)
**Duration**: 16 hours | **Dependencies**: All streams complete | **Status**: PENDING

#### Task 21: End-to-End Testing & Validation
- **Priority**: CRITICAL
- **Agent**: `quality-assurance-engineer`
- **Duration**: 8 hours
- **Dependencies**: Tasks 12-20
- **Requirements**:
  - Maestro E2E test suite
  - Integration test coverage
  - Performance benchmarking
  - User acceptance criteria
- **Resources**:
  - Maestro framework (Task 14.5)
  - Test specifications
  - Performance targets
- **Quality Gates**:
  - E2E tests pass ✓
  - Performance acceptable ✓
  - No critical bugs ✓

#### Task 22: Performance Optimization
- **Priority**: HIGH
- **Agent**: `performance-optimizer`
- **Duration**: 4 hours
- **Dependencies**: Task 21
- **Requirements**:
  - Bundle size optimization
  - Render performance tuning
  - Memory leak detection
  - Network optimization
- **Resources**:
  - React DevTools
  - Performance profiling tools
  - Bundle analyzers
- **Quality Gates**:
  - Bundle < 50MB ✓
  - 60 FPS UI ✓
  - No memory leaks ✓

#### Task 23: Production Deployment Preparation
- **Priority**: CRITICAL
- **Agent**: `devops-deployment-architect`
- **Duration**: 4 hours
- **Dependencies**: Task 22
- **Requirements**:
  - Production build configuration
  - App store assets
  - Release notes
  - Deployment checklist
- **Resources**:
  - EAS Build
  - App store guidelines
  - Deployment documentation
- **Quality Gates**:
  - Builds successfully ✓
  - Store compliance ✓
  - Documentation complete ✓

## 👥 Agent Assignment Matrix with Rationale

### Primary Agent Assignments

| Agent | Tasks | Why This Agent | Key Strengths |
|-------|-------|----------------|---------------|
| **`mobile-dev`** | 12, 14, 15, 16, 17, 18, 19, 20 | Primary UI/UX implementation | React Native expertise, Expo SDK, component architecture |
| **`cross-project-coordinator`** | 12, 13, 15, 16, 17, 18, 20 | Backend API coordination | Cross-repo communication, spec creation, dependency management |
| **`backend-architect`** | Backend specs | Supabase implementation | Database design, API endpoints, RLS policies |
| **`quality-assurance-engineer`** | 21 | E2E testing | Maestro framework, test coverage, validation |
| **`performance-optimizer`** | 22 | App optimization | Bundle size, render performance, memory management |
| **`devops-deployment-architect`** | 23 | Production prep | EAS Build, app store deployment, CI/CD |

### Agent Selection Rationale

#### Mobile-Heavy Tasks (Primary: `mobile-dev`)
- **Tasks 14, 19**: Pure mobile UI with no backend changes
- **Tasks 15-17**: Complex UI with minimal backend needs
- **Tasks 18, 20**: Device/BLE interfaces with backend sync

#### Backend-Heavy Tasks (Primary: `cross-project-coordinator`)
- **Task 13**: Role management requires significant backend work
- **Tasks 12, 16**: Balanced mobile/backend split

#### Cross-Project Dependencies
- **High Backend**: Tasks 13 (roles), 16 (device registry)
- **Medium Backend**: Tasks 12 (projects), 15 (deployments), 17 (validation)
- **Low/No Backend**: Tasks 14 (org switch), 19 (maps)

### Coordination Strategy

1. **Sequential Backend Work**: Create all backend specs first
2. **Parallel Mobile Development**: Launch UI work while backend builds
3. **Integration Points**: Sync at task completion for testing

## 🔄 Cross-Project Execution Protocol

### Backend Specification Process
1. **Spec Creation** (Mobile repo):
   - `cross-project-coordinator` creates detailed backend spec
   - Spec includes: endpoints, RLS policies, functions, migrations
   - Location: `~/wildlife-watcher-backend/project-context/MVP2-Tasks/task-XX-backend-spec.md`

2. **Backend Implementation** (Backend repo):
   - Separate VS Code instance executes spec
   - Creates migrations, functions, API endpoints
   - Updates backend PROJECT-STATUS.md

3. **Integration Confirmation** (Cross-repo):
   - Backend confirms completion via status file
   - Mobile app integrates with new endpoints
   - End-to-end testing validates integration

### Cross-Project Task Dependencies

| Mobile Task | Backend Requirements | Blocking? | Backend Priority |
|-------------|---------------------|-----------|------------------|
| Task 12 | Project CRUD APIs | Partial | HIGH |
| Task 13 | Role management APIs | Yes | CRITICAL |
| Task 14 | None (mobile only) | No | - |
| Task 15 | Deployment APIs | Partial | HIGH |
| Task 16 | Device registry | Yes | HIGH |
| Task 17 | Validation storage | Partial | MEDIUM |
| Task 18 | Device query APIs | Partial | MEDIUM |
| Task 19 | None (mobile only) | No | - |
| Task 20 | Sync endpoints | Yes | HIGH |

### Optimized Execution Sequence

#### Phase 1: Backend Specs (Day 1)
- Create ALL backend specs upfront
- Prioritize blocking dependencies
- Bundle related migrations

#### Phase 2: Parallel Execution (Days 2-15)
- Backend: Implement APIs in priority order
- Mobile: Start non-blocking UI work
- Sync at integration points

#### Phase 3: Integration (Days 16-20)
- Test mobile-backend integration
- Resolve any API mismatches
- Performance optimization

## 📅 Timeline & Milestones

### Week 1 (Days 1-5)
- **Day 1-2**: Complete remaining Task 11 subtasks
- **Day 2-5**: Launch all 3 parallel streams
- **Milestone**: All streams operational

### Week 2 (Days 6-10)
- **Day 6-8**: Stream progress (50% completion)
- **Day 9-10**: Mid-stream integration testing
- **Milestone**: Core features functional

### Week 3 (Days 11-15)
- **Day 11-13**: Complete all streams
- **Day 14-15**: Begin integration phase
- **Milestone**: Features complete

### Week 4 (Days 16-20)
- **Day 16-18**: Testing & optimization
- **Day 19-20**: Production preparation
- **Milestone**: MVP2 Ready for deployment

## ⚠️ Risk Register & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| BLE Integration Issues | HIGH | MEDIUM | Early spike, fallback to manual config |
| Map Performance | MEDIUM | LOW | Use clustering, lazy loading |
| Stream Coordination | MEDIUM | LOW | Daily syncs, shared context |
| Testing Delays | LOW | MEDIUM | Parallel test development |

## ✅ Quality Gates

### Stream-Level Gates
1. **TypeScript Compilation**: Zero errors
2. **Test Coverage**: >80% per stream
3. **Integration Tests**: Pass 100%
4. **Performance**: Meet benchmarks
5. **Security**: Role-based access verified

### Integration Gates
1. **E2E Tests**: 95% pass rate
2. **Cross-Stream**: No conflicts
3. **Production Build**: Successful
4. **Documentation**: Complete
5. **Deployment Ready**: Checklist 100%

## 📈 Success Metrics

### Development Metrics
- **Velocity**: 3x improvement via parallel execution
- **Quality**: <5 critical bugs found
- **Timeline**: Within 20 working days
- **Coverage**: >85% test coverage

### Business Metrics
- **Features**: 100% MVP2 requirements
- **Performance**: <2s screen loads
- **Reliability**: 99% uptime capable
- **Usability**: Intuitive 6-step wizard

## 🔄 Execution Protocol

### Daily Operations
1. **Morning**: Stream sync meeting (15 min)
2. **Development**: Parallel work on assigned tasks
3. **Afternoon**: Integration testing if needed
4. **Evening**: Context preservation & updates

### Weekly Checkpoints
1. **Monday**: Week planning & resource allocation
2. **Wednesday**: Mid-week progress check
3. **Friday**: Integration testing & demos

### Communication
- **Primary Channel**: Task comments in MVP2-Tasks folder
- **Blockers**: Immediate escalation
- **Updates**: Daily in project status tracker
- **Context**: Preserved in task-specific files

## 🚀 Next Immediate Actions

1. **Complete Task 11 Remaining Subtasks** (8-12 hours)
   - Task 11.4: Conflict resolution
   - Task 11.5: Advanced sync
   - Task 11.6: Performance optimization
   - Task 11.7: Testing suite

2. **Launch Parallel Streams** (Immediate after Task 11)
   - Assign agents to streams
   - Create stream-specific task files
   - Initialize daily sync protocol

3. **Setup Monitoring** (Day 1)
   - Progress tracking dashboard
   - Quality gate automation
   - Risk monitoring system

## 📝 Document Maintenance

This document should be updated:
- **Daily**: Task status changes
- **On Completion**: Mark tasks complete with notes
- **On Blocking**: Document blockers and mitigation
- **Weekly**: Overall progress summary

---

**Document Version**: 1.0
**Last Updated**: 2025-09-17
**Next Review**: Daily during execution
**Owner**: Development Team Lead