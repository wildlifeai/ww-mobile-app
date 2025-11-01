# Wildlife Watcher MVP2 - Tranche 1 Foundation Replanning Prompt
**Generated**: 2025-11-01
**Context**: Two-Tranche Execution Strategy
**Methodology**: AADF Framework with Evidence-Based Discovery
**Target**: 24-Hour Tranche 1 Completion

---

## Executive Summary

**Strategic Approach**: Two separate tranches with independent planning and execution

### Tranche 1: Foundation & Stabilization (Tasks 1-14)
**Objective**: Get what currently exists working properly with backend schema alignment AND implement revised requirements for Tasks 1-14

**Scope**:
1. **Code Review Remediation**: Critical blockers, quality gates, characterization testing, database logging
2. **Backend Schema Alignment**: TypeScript-guided migration for mvp2-revised schema
3. **Foundation Tasks 1-14**: Stabilize existing functionality + implement revised requirements
4. **Quality Gates**: Zero TypeScript errors, passing tests, secure configuration

**Current State**:
- MVP2: 60.9% complete (Tasks 1-13 done, Task 14 pending)
- Development velocity: 1.3 tasks/day, 22% ahead of schedule
- Backend: mvp2-revised schema ready for deployment
- Code Review: Remediation plan defined

### Tranche 2: New Features (Tasks 15-23)
**Status**: SEPARATE PLANNING EFFORT after Tranche 1 completion

**Scope** (to be planned separately):
- Device preparation workflows
- LoRaWAN integration features
- Advanced admin features
- Enhanced sync capabilities

**Rationale**: Plan Tranche 2 after Tranche 1 demonstrates working foundation and clarifies remaining scope.

---

## AADF Acceleration Strategies (24-Hour Target)

### Parallel Execution Architecture
**Pattern**: Multiple specialized subagents working simultaneously on independent tasks

**Stream A: Backend Schema Migration**
- **Agent**: backend-architect
- **Tasks**: TypeScript-guided role rename, users table migration, type regeneration
- **Duration**: Compiler-guided refactoring (TypeScript flags all instances)
- **Dependencies**: None (can start immediately after backend deployment)

**Stream B: Code Review Critical Blockers**
- **Agent**: quality-assurance-engineer
- **Tasks**: API key rotation, TypeScript error fixes, linting auto-fixes
- **Duration**: Automated tooling + security best practices
- **Dependencies**: None (independent work)

**Stream C: Quality Gates**
- **Agent**: frontend-design-expert + mobile-dev
- **Tasks**: React.memo optimization, SecureStore implementation, app.json completion
- **Duration**: Pattern-based implementation with existing guides
- **Dependencies**: Blocker resolution (Stream B)

**Stream D: Large Services Refactor**
- **Agent**: code-analyzer + backend-architect
- **Tasks**: Characterization tests, modular decomposition, regression prevention
- **Duration**: Test-first approach with safe refactoring patterns
- **Dependencies**: None (can run in parallel)

### Dependency Management
**Critical Path**:
1. Backend deploys mvp2-revised schema → Type regeneration → Schema migration (Stream A)
2. Blockers resolved (Stream B) → Quality gates (Stream C)
3. Characterization tests (Stream D) → Service refactoring

**Parallel Opportunities**:
- Streams A, B, D can execute simultaneously from start
- Stream C waits only for Stream B completion
- Total wall-clock time minimized through parallelization

### Subagent Specialization
**Quality Assurance**: quality-assurance-engineer for testing strategy
**Backend Integration**: backend-architect for schema migration
**Mobile Development**: mobile-dev for React Native patterns
**Security Review**: supabase-rls-security for RLS policy updates
**Code Analysis**: code-analyzer for refactoring safety

### Evidence-Based Development (MANDATORY)
**Context7 Research FIRST** for all implementations:
- 10x debugging efficiency improvement (measured in backend project)
- 38,000+ vendor-specific code snippets vs 0 general sources
- Eliminates false solution paths before coding begins

**Pattern**:
```bash
# BEFORE implementation
mcp__context7__resolve-library-id({ libraryName: "react-native-ble-manager" })
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/resolved/library",
  topic: "uuid-handling",
  tokens: 15000
})

# THEN implement with official patterns
```

---

## 1. Backend Schema Alignment (TypeScript-Guided)

**Source**: `~/wildlife-watcher-backend/dbml/mvp2-revised.md`

### Critical Breaking Changes

**1. Role Rename: `model_manager` → `organisation_manager`**

**Approach**: Let TypeScript compiler guide the refactoring
```typescript
// After backend deploys schema:
1. Run: npm run types:local
2. TypeScript compiler flags ALL instances
3. Fix each flagged location:
   - Database schema: role ENUM definition
   - RLS policies: role = 'model_manager' checks
   - TypeScript types: UserRole type definition
   - Redux slices: Hard-coded role strings
   - Service files: Role validation logic
   - Seed data: User role assignments
   - UI components: Role-based conditional rendering
```

**Risk Level**: 🟢 LOW - Compiler catches 100% of instances

**2. Users Table: `name` → `firstname`/`surname`**

**Approach**: Same TypeScript-guided pattern
```typescript
// After type regeneration:
1. Compiler flags all User.name references
2. Update to User.firstname + ' ' + User.surname
3. Backend to provide seed data script updates
4. Mobile updates display logic
```

**Backend Coordination Needed**:
- Request seed data script update (firstname/surname for test users)
- Confirm data migration strategy for existing users

**3. Projects, Devices, Deployments Schema Changes**

**Approach**: Type-driven refactoring
- Projects: Added model_id, removed owner_id/end_date
- Devices: Complete rebuild with org_id, battery_level, sd_card_usage
- Deployments: Added ai_model_id, firmware_id, split comments

**Strategy**:
1. Regenerate types after backend deployment
2. Fix TypeScript errors one by one
3. Update service layer adapters
4. Update UI components with new fields

---

## 2. Code Review Remediation (Tranche 1 Scope)

**Source**: `@project-context/code-review/20251016/CODE-REVIEW-REMEDIATION-PLAN.md`

### Phase 1: Critical Blockers
⚠️ **MUST COMPLETE BEFORE OTHER WORK**

**CR-1.1: Remove Hardcoded API Keys**
- Location: `eas.json` and other config files
- Action: Move to EAS secrets configuration
- Security: Rotate existing keys after migration
- Validation: Grep codebase for hard-coded keys

**CR-1.2: Fix TypeScript Errors**
- Current: 24 TypeScript errors
- Strategy: Fix one by one with proper type definitions
- Quality Gate: Zero TypeScript errors before proceeding

**CR-1.3: Auto-Fix Linting Violations**
- Current: 1000+ linting violations
- Action: `npm run lint -- --fix`
- Manual Review: Review auto-fixes for correctness

### Phase 2: Quality Gates
📋 **FOUNDATION FOR TRANCHE 1 TASKS**

**CR-2.1: Redux Consolidation**
✅ **COMPLETE** (already done)

**CR-2.2: React.memo for List Components**
- Pattern: Memoize expensive list renderings
- Files: ProjectList, DeviceList, DeploymentList components
- Performance: Prevent unnecessary re-renders

**CR-2.3: SecureStore for Auth Tokens**
- Current: AsyncStorage (not secure)
- Target: expo-secure-store for tokens
- Security: Encrypted storage for credentials

**CR-2.4: Complete app.json Setup**
- Review: app.json configuration completeness
- Add: Missing platform-specific configurations
- Validate: EAS build succeeds on both platforms

### Phase 3: Debt Reduction & Database Logging
🔄 **TRANCHE 1 SCOPE: COMPLETE LOGGING IMPLEMENTATION**

**CR-3.1: Database Logging System (Full Implementation)**

**Backend Enhancement** (Coordinate with backend team):
```sql
-- Enhance api_logs table with logging best practices
ALTER TABLE api_logs ADD COLUMN correlation_id UUID;
ALTER TABLE api_logs ADD COLUMN source TEXT;
ALTER TABLE api_logs ADD COLUMN context JSONB;
ALTER TABLE api_logs ADD COLUMN stack_trace TEXT;
ALTER TABLE api_logs ADD COLUMN session_id UUID;
ALTER TABLE api_logs ADD COLUMN app_version TEXT;
ALTER TABLE api_logs ADD COLUMN platform TEXT;
ALTER TABLE api_logs ADD COLUMN log_category TEXT;
```

**Mobile LoggingService Implementation**:
```typescript
// Complete LoggingService with Supabase sync
class LoggingService {
  async log(level: LogLevel, message: string, context?: any) {
    const logEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      correlation_id: generateCorrelationId(),
      source: getComponentName(),
      session_id: getSessionId(),
      app_version: Constants.expoConfig?.version,
      platform: Platform.OS,
      log_category: deriveCategory(context)
    };

    // Store locally in AsyncStorage (offline support)
    await AsyncStorage.setItem(`log_${logEntry.correlation_id}`, JSON.stringify(logEntry));

    // Sync to Supabase api_logs table (when online)
    if (isOnline) {
      await supabase.from('api_logs').insert(logEntry);
    }
  }

  // Background sync for offline logs
  async syncPendingLogs() {
    // Sync any logs stored in AsyncStorage to api_logs table
  }
}
```

**Replace console.log Statements**:
- Convert 486 console.log statements to LoggingService calls
- Categorize logs: auth, sync, deployment, device, project, error
- Add appropriate log levels: debug, info, warn, error
- Include contextual information for debugging

**Backend Coordination Required**:
- Enhance api_logs table schema (see SQL above)
- Confirm RLS policies for api_logs table
- Update seed data with log_levels if needed

**CR-3.2: Refactor Large Services (Characterization Testing)**

**Strategy**: Prevent regression during refactoring
```typescript
// Step 1: Add characterization tests (capture current behavior)
describe('ProjectService - Characterization Tests', () => {
  it('getUserProjects returns projects with computed fields', async () => {
    // Test EXACTLY what it does now (even if buggy)
    const result = await ProjectService.getUserProjects(userId)
    expect(result).toMatchSnapshot()
  })
})

// Step 2: Refactor into smaller modules
src/services/projects/
  ├── ProjectService.ts (orchestrator, <200 lines)
  ├── ProjectRepository.ts (CRUD operations)
  ├── ProjectCalculations.ts (memberCount, activeDeployments)
  └── __tests__/

// Step 3: Tests still pass (behavior unchanged)
// Step 4: NOW fix bugs in isolated modules
```

**Files to Refactor**:
- ProjectService.ts (>500 lines → 3-4 modules)
- DeploymentService.ts (>400 lines → 3-4 modules)
- SyncService.ts (>600 lines → 4-5 modules)

**CR-3.3: Add Component Tests**
- Incremental: Add tests for new components in Tranche 1
- Pattern: Jest + React Testing Library
- Coverage: Aim for ≥70% test coverage

---

## 3. Feature-Proofed Org Switching (KEEP HIDDEN)

**User Requirement**: "Keep org switching feature but hide it for now - in future user can belong to multiple organisations."

**Strategy**: Feature flag approach (hidden but functional)

### Implementation Pattern
```typescript
// Feature flag configuration
const FEATURES = {
  MULTI_ORG_SWITCHING: __DEV__ && false, // Hidden for MVP2, easy to enable
}

// UI: Hide org switcher
<OrganisationSwitcher visible={FEATURES.MULTI_ORG_SWITCHING} />

// Logic: Default to "General" org
const userOrgs = await getUserOrganisations(userId)
const currentOrg = FEATURES.MULTI_ORG_SWITCHING
  ? userSelectedOrg
  : userOrgs.find(o => o.name === 'General')

// Services: Org-aware but defaults to General
class ProjectService {
  async getProjects(userId: string, orgId?: string) {
    const targetOrgId = FEATURES.MULTI_ORG_SWITCHING
      ? orgId
      : await getDefaultOrgId('General')
    // ... rest of logic
  }
}
```

### Backend RLS Coordination
```sql
-- Backend creates RLS policy restricting to General org
CREATE POLICY "Users see only General org" ON projects
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM ww_admins) OR
    organisation_id = (SELECT id FROM organisations WHERE name = 'General')
  );
```

### Benefits
- ✅ Zero technical debt (no rework later)
- ✅ Zero maintenance burden (feature flag pattern)
- ✅ Zero interference with MVP2 UX (hidden from users)
- ✅ 100% ready when needed (flip feature flag)
- **Effort**: 1-2 hours vs removing and rebuilding later

### Tranche 1 Scope
- Keep existing org switching logic intact
- Add feature flag to hide UI
- Default all operations to "General" org
- Backend coordination for RLS policy

---

## 4. LoRaWAN Integration (DISPLAY-ONLY SCOPE)

**Confirmed Scope**: Display LoRaWAN device data received via backend webhook (NOT full device management)

### What We Display (Read-Only)
**Device Metadata** (from LoRaWAN messages):
- `battery_level` (percentage)
- `sd_card_usage` (percentage)
- `last_seen` (timestamp of last webhook message)

**Backend Provides**:
- Webhook receiver processes LoRaWAN messages
- Parses device metadata from payload
- Updates devices table with battery_level, sd_card_usage, last_seen
- Mobile app reads via standard Supabase queries

### Mobile App Scope (Tranche 1)
**UI Changes**:
```typescript
// DeviceCard.tsx - Display battery and SD card status
<DeviceCard>
  <DeviceInfo />
  {device.battery_level && (
    <BatteryIndicator level={device.battery_level} />
  )}
  {device.sd_card_usage && (
    <StorageIndicator usage={device.sd_card_usage} />
  )}
  <LastSeen timestamp={device.last_seen} />
</DeviceCard>
```

**No LoRaWAN Device Management**:
- ❌ No device configuration UI
- ❌ No LoRaWAN network settings
- ❌ No message sending from mobile app
- ✅ Just display backend-provided device metadata

### Backend Coordination Needed
- Request example LoRaWAN webhook payload format
- Confirm devices table schema includes battery_level, sd_card_usage, last_seen
- Request seed data with sample LoRaWAN devices

---

## 5. Requirements Simplification (Tranche 1)

### Org Simplification
**Baseline**: Multi-org switching with UI
**Goal**: Single "General" org with hidden multi-org support

**Implementation**: Feature flag approach (see Section 3)

### Role Simplification
**Baseline**: 4 roles (ww_admin, model_manager, project_admin, project_member)
**Goal**: 3 roles for MVP2 (ww_admin, organisation_manager, project_admin, project_member)

**Implementation**: Role rename (see Section 1)

### Deferred to Tranche 2
**New Features** (out of scope for Tranche 1):
- Camera prep workflow (2-step process)
- In-app invitations (project invitation system)
- Self-registration with email verification
- Profile/Settings/Feedback screens
- Photo storage strategy refinements
- Device preparation workbench
- AI model upload/management
- Firmware management UI

**Tranche 1 Focus**: Get Tasks 1-14 working with schema alignment

---

## 6. Execution Strategy (24-Hour Target)

### Immediate Actions (Backend Team)
1. **Deploy mvp2-revised Schema**
   - Deploy to local Supabase first (mobile team testing)
   - Provide data migration scripts (firstname/surname, role rename)
   - Confirm LoRaWAN fields in devices table

2. **Coordination Messages**
   - Send schema-change notification when deployed
   - Share example LoRaWAN webhook payload
   - Provide seed data script updates

### Immediate Actions (Mobile Team)
**Hour 0-2: Blockers (Parallel Streams)**
- Stream A: API key rotation (quality-assurance-engineer)
- Stream B: TypeScript error fixes (backend-architect)
- Stream C: Linting auto-fixes (mobile-dev)

**Hour 2-4: Backend Schema Migration (After Backend Deployment)**
- Stream A: Type regeneration (npm run types:local)
- Stream A: Role rename refactoring (TypeScript-guided)
- Stream A: Users table migration (firstname/surname)

**Hour 4-8: Quality Gates (Parallel Streams)**
- Stream B: React.memo optimization (frontend-design-expert)
- Stream C: SecureStore implementation (mobile-dev)
- Stream D: app.json completion (mobile-dev)

**Hour 8-16: Service Refactoring (Parallel)**
- Stream A: Characterization tests (quality-assurance-engineer)
- Stream A: ProjectService modular decomposition (backend-architect)
- Stream B: DeploymentService refactoring (backend-architect)
- Stream C: SyncService refactoring (backend-architect)

**Hour 16-20: Task 14 Completion**
- Complete remaining Task 14 subtasks
- Integrate LoRaWAN display components
- Feature flag org switching UI

**Hour 20-24: Validation & Integration**
- Run full test suite
- Build preview with `eas build --profile preview`
- Deploy to cloud-dev for stakeholder testing
- Documentation updates

### Quality Gates (Must Pass)
**Gate 1: Security** (Hour 2)
- [ ] Zero hardcoded secrets
- [ ] All keys rotated and configured in EAS secrets

**Gate 2: TypeScript** (Hour 4)
- [ ] Zero TypeScript errors
- [ ] Types regenerated from backend schema

**Gate 3: Performance** (Hour 8)
- [ ] List components memoized
- [ ] No obvious performance regressions

**Gate 4: Security** (Hour 8)
- [ ] Auth tokens encrypted in SecureStore
- [ ] app.json configuration complete

**Gate 5: Architecture** (Hour 16)
- [ ] Large services refactored (<300 lines each)
- [ ] Characterization tests passing
- [ ] No behavior regression

**Gate 6: Integration** (Hour 24)
- [ ] All tests passing (unit + integration)
- [ ] EAS build succeeds (preview profile)
- [ ] Cloud-dev deployment verified

---

## 7. Success Metrics (Tranche 1)

### Technical Metrics
- **TypeScript Errors**: 0
- **Test Coverage**: ≥70%
- **Linting Violations**: <50
- **Bundle Size**: No regression from baseline (12.27 MB)
- **Service File Size**: All <300 lines after refactoring

### Functional Metrics
- **Tasks 1-14**: 100% complete
- **Backend Schema**: Fully aligned with mvp2-revised
- **Security**: Zero hardcoded secrets, encrypted token storage
- **Quality Gates**: All 6 gates passed

### Integration Metrics
- **Type Sync**: Mobile types match backend schema
- **Build Success**: Preview build succeeds on both platforms
- **Cloud-Dev Health**: App functions correctly with cloud-dev Supabase
- **LoRaWAN Display**: Device metadata displayed correctly

---

## 8. Risk Mitigation

### High-Risk Areas

**1. Backend Schema Not Deployed**
- **Mitigation**: Coordinate deployment before mobile work begins
- **Contingency**: Mobile can work on blockers/quality gates while waiting

**2. Hardcoded API Keys Exposed**
- **Mitigation**: Rotate within first 2 hours of Tranche 1
- **Validation**: Grep codebase after rotation

**3. Characterization Tests Fail**
- **Mitigation**: Indicates existing bugs - document and fix carefully
- **Strategy**: Fix bugs AFTER refactoring (with smaller modules)

**4. TypeScript Migration Complexity**
- **Mitigation**: Compiler-guided approach ensures complete coverage
- **Fallback**: Incremental fixes with comprehensive testing

**5. Time Overrun (>24 Hours)**
- **Mitigation**: Parallel execution, AADF framework, specialized subagents
- **Contingency**: Defer Phase 3 improvements to Tranche 2 if needed

**6. Type Drift During Development**
- **Mitigation**: Pre-commit hooks block stale types
- **Validation**: npm run types:check-local before commits

---

## 9. Cross-Project Coordination

### Coordination Project Created
**Location**: `~/dev/wildlifeai/cross-project-coordination/projects/mvp2-tranche1-foundation-replanning`

**Structure**:
```
mvp2-tranche1-foundation-replanning/
├── inbox/
│   ├── mobile/          # Messages TO mobile team
│   └── backend/         # Messages TO backend team
├── master-plan/
│   ├── task-definitions.yml
│   ├── dependency-graph.yml
│   └── priority-matrix.yml
├── milestones/
└── shared-docs/
```

### Message Flow
**Backend → Mobile**:
- Schema deployment notifications
- LoRaWAN payload examples
- Seed data script updates

**Mobile → Backend**:
- api_logs table enhancement request
- RLS policy coordination (org restriction)
- Type validation confirmation

### Daily Workflow
```bash
# Check backend inbox (mobile team)
~/dev/wildlifeai/cross-project-coordination/.scripts/check-inbox.sh \
  --project "mvp2-tranche1-foundation-replanning" \
  --team "mobile"

# Send message to backend
~/dev/wildlifeai/cross-project-coordination/.scripts/send-message.sh \
  --project "mvp2-tranche1-foundation-replanning" \
  --from "mobile" \
  --to "backend" \
  --type "task-request" \
  --message "Request: Enhance api_logs table with correlation_id, source, context, stack_trace, session_id, app_version, platform, log_category"
```

---

## 10. Tranche 2 Planning (Separate Effort)

**Scope**: Tasks 15-23 (new features)

**Planning Approach**:
1. Complete Tranche 1 successfully
2. Demonstrate working foundation to stakeholders
3. Gather feedback from Tranche 1 execution
4. Create separate coordination project for Tranche 2
5. Plan Tranche 2 with updated context and learnings

**Why Separate**:
- Tranche 1 clarifies actual complexity of remaining work
- Backend schema changes may reveal additional requirements
- Stakeholder feedback from working Tranche 1 foundation
- Lessons learned from AADF execution in Tranche 1

**Deferred Features**:
- Device preparation workflows
- Advanced LoRaWAN features (beyond display)
- In-app invitations
- Self-registration
- Profile/Settings/Feedback screens
- AI model management
- Firmware management

---

## Conclusion

**Tranche 1 Objective**: Get existing functionality (Tasks 1-14) working properly with backend schema alignment

**Key Success Factors**:
1. **AADF Parallel Execution**: Multiple specialized subagents working simultaneously
2. **TypeScript-Guided Migration**: Compiler catches all schema breaking changes
3. **Characterization Testing**: Safe refactoring without regression
4. **Two-Phase Logging**: Client-side now, backend sync later
5. **Feature-Proofed Org Switching**: Hidden but functional for future use
6. **Display-Only LoRaWAN**: Simple scope (just show device metadata)
7. **Evidence-Based Development**: Context7 research BEFORE implementation
8. **24-Hour Target**: Achievable with parallel execution and smart shortcuts

**Next Actions**:
1. ✅ **Cross-Project Coordination Created**: `mvp2-tranche1-foundation-replanning`
2. **Backend Deployment**: Deploy mvp2-revised schema to local Supabase
3. **Kickoff Message**: Send initial coordination message to backend team
4. **Execute Tranche 1**: Use AADF framework with parallel subagent execution
5. **Validate Success**: All 6 quality gates passed, preview build deployed
6. **Plan Tranche 2**: Separate planning effort after Tranche 1 success

---

**Document Version**: 2.0 (Two-Tranche Strategy)
**Coordination Project**: mvp2-tranche1-foundation-replanning
**Target Timeline**: 24 hours for Tranche 1 completion
**Review Required**: Backend team collaboration via coordination inbox
