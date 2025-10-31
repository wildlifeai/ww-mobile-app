# Wildlife Watcher MVP2 - Comprehensive Replanning Prompt
**Generated**: 2025-10-31
**Context**: Three Parallel Workstreams Convergence
**Methodology**: AADF Framework with Evidence-Based Discovery

---

## Executive Summary

There have been several activities in parallel requiring reorganization and replanning:

1. **Requirements Changes**: Stakeholder refinements (OVERVIEW.md → OVERVIEW-GOAL.md)
2. **Code Review Refactoring**: Technical debt remediation (Phase 1-3)
3. **Current Development**: Stream A Tasks 12-14 (Tasks 12-13 complete, Task 14 pending)

**Current State**:
- MVP2: 60.9% complete (Tasks 1-13 done, Tasks 14-23 pending)
- Stream A: 66.7% complete (Tasks 12-13 done, Task 14 pending)
- Development velocity: 1.3 tasks/day, 22% ahead of schedule

**Challenge**: These three workstreams need convergence into a unified, revised execution plan.

---

## 🔍 Comprehensive Discovery Findings

### Discovery Scope Completed
✅ Codebase structure & git history (30 commits analyzed)
✅ Backend schema evolution (mvp2-revised.md + comparison document)
✅ Code review findings (remediation plan + action items)
✅ Requirements gap analysis (baseline → goal state)
✅ Task specifications (all 24 tasks reviewed)

---

## 1. Backend Schema Evolution Impact (CRITICAL)

### Source
- `~/wildlife-watcher-backend/dbml/mvp2-revised.md` (Version: mvp2-20251025-1551)
- `~/wildlife-watcher-backend/dbml/SCHEMA-COMPARISON-MVP2-REVISED.md`

### Executive Assessment
**STATUS**: **MAJOR RESTRUCTURE** with 12 breaking changes
**IMPACT**: 4-6 weeks implementation effort
**MOBILE ALIGNMENT**: Type regeneration + complete API rebuild required

### Breaking Changes Summary

#### 1.1 User Role Rename (CRITICAL)
**Current**: `'ww_admin | model_manager | project_admin | project_member'`
**Revised**: `'ww_admin | organisation_manager | project_admin | project_member'`

**Mobile Impact**:
- All RLS policy checks referencing `model_manager` will fail
- Hard-coded role checks in mobile app need updates
- Type regeneration required: `npm run types:local`
- Estimated effort: 2-3 days

#### 1.2 Users Table Restructure (CRITICAL)
**Current**: `name text [not null]`
**Revised**: `firstname text [not null], surname text [not null], modified_by uuid`

**Mobile Impact**:
- User profile screens need firstname/surname fields
- API calls need restructuring
- Data migration: Split "John Doe" → firstname="John", surname="Doe"
- Questions: How to handle single-word names? (e.g., "Madonna")
- Estimated effort: 3-4 days

#### 1.3 Projects Table Major Restructure (CRITICAL)
**Columns Removed**:
- `owner_id` - Who owns projects now?
- `end_date` - How to track project completion?
- `is_private` - Privacy model changed?
- `metadata jsonb` - Data loss risk if used

**Columns Added**:
- `model_id uuid` - **AI MODEL INTEGRATION** (new feature)
- `is_baited boolean` - Camtrap DP compliance
- `is_monitoring_marked_individuals boolean` - Study type flag
- `project_image text` - UI enhancement
- `capture_method_id int FK` - Normalized lookup
- `activity_detection_sensitivity_id int FK` - Camera config
- `timelapse_interval_seconds int` - Camera config
- `sampling_design_id int FK` - Normalized from text field
- `created_by uuid FK` - Restored

**Mobile Impact**:
- Complete project create/edit UI rebuild required
- API endpoints `POST /projects`, `PATCH /projects/:id` need complete rewrite
- New model selection UI required
- Migration: Map `sampling_design` text → `sampling_design_id` FK
- Estimated effort: 7-10 days

#### 1.4 Devices Table Complete Rebuild (CRITICAL)
**Current**: `device_ref_identifier text, firmware_name text, model text`
**Revised**: Complete structure with:
- `bluetooth_id text [unique]` - Device identifier
- `organisation_id uuid` - Org-scoped devices
- `firmware_id uuid FK` - FK to firmware table
- `battery_level integer` - Health monitoring
- `last_battery_check timestampz` - Status tracking
- `sd_card_capacity_total/used int` - Storage monitoring
- `last_sd_card_check timestampz` - Storage tracking

**Mobile Impact**:
- Complete device management UI rebuild
- Migration: Map `device_ref_identifier` → `bluetooth_id`
- How to assign existing devices to organisations?
- Firmware management feature required
- Estimated effort: 5-7 days

#### 1.5 Deployments Table Major Restructure (CRITICAL)
**Changes**:
- `user_id` → `setup_by` + added `end_user_id` (who retrieves device)
- `camera_location_image_path` (text) → `camera_location_image_paths` (jsonb array)
- `deployment_comments` → `start_deployment_comments` + `end_deployment_comments`
- Added: `ai_model_id`, `firmware_id`, `device_eui`, `camera_model`, `camera_height`, `bait_use`, `location_id`

**Mobile Impact**:
- Deployment form needs restructuring
- Image upload logic: single path → jsonb array
- Comments split (impossible to automate - manual data entry required)
- New Camtrap DP fields required
- Estimated effort: 5-7 days

### New Features Requiring Implementation

#### 1.6 AI Models System (NEW FEATURE)
**Tables**: `ai_models`, `ai_model_organisation`
**Purpose**: Wildlife detection model management

**Implementation Required**:
- Supabase Storage bucket for model files (.tflite, .onnx)
- Model upload API endpoint
- RLS policies (organisation_manager can upload, project_admin can select)
- Mobile UI: Model selection in project settings
- Default model for "General" organisation

**Estimated effort**: 8-10 days

#### 1.7 Firmware Management (NEW FEATURE)
**Table**: `firmware`
**Purpose**: Camera firmware version tracking and updates

**Implementation Required**:
- Firmware binary storage in Supabase
- Version management (active/deprecated)
- Mobile UI: Display firmware version, update status
- RLS policies (ww_admin only)

**Estimated effort**: 3-5 days

#### 1.8 Device Preparation Workflow (NEW FEATURE)
**Table**: `device_preparation`
**Purpose**: Camera workbench process before deployment

**Business Rules**:
- Only 1 active preparation record per device
- Preparation must be complete (`is_deployment_ready = true`) before deployment
- Status calculated from test results (firmware, battery, SD card, camera view, LoRaWAN registration)

**Implementation Required**:
- Step-by-step preparation wizard UI
- LoRaWAN device registration integration
- Test workflows (firmware, battery, SD card, camera view)
- Computed field triggers for status

**Estimated effort**: 7-10 days

#### 1.9 LoRaWAN Message Processing (NEW FEATURE)
**Tables**: `lorawan_messages`, `lorawan_parsed_messages`
**Purpose**: Real-time device status from LoRaWAN network

**Implementation Required**:
- LoRaWAN webhook receiver endpoint
- Parser logic for raw_payload
- Device status sync triggers (battery_level, sd_card_used_capacity)
- Mobile UI: Device health dashboard

**Estimated effort**: 5-7 days

#### 1.10 Lookup Table Normalization (NEW)
**Tables**: `activity_sensitivity`, `sampling_designs`
**Migration**: `projects.sampling_design` text → `sampling_design_id` FK

**Implementation Required**:
- Seed data for lookup tables
- Migration script to convert text to FK
- Mobile UI: Dropdown selections

**Estimated effort**: 2-3 days

### Backend-Mobile Coordination Tasks

**Type Synchronization**:
```bash
# Required after ALL schema changes
npm run types:local           # Regenerate types from local Supabase
npm run validate:local        # Validate alignment
```

**New API Endpoints Required**:
```
GET    /ai_models                      # List available models
POST   /ai_models                      # Upload model (organisation_manager)
GET    /firmware                       # List firmware versions
POST   /device_preparation             # Create preparation record
PATCH  /device_preparation/:id         # Update test results
GET    /lorawan_messages               # View device messages
GET    /activity_sensitivity           # Lookup values
GET    /sampling_designs               # Lookup values
```

**API Endpoints Requiring Rebuild**:
```
GET    /users/:id                      # Return firstname/surname
PATCH  /users/:id                      # Accept firstname/surname
POST   /projects                       # Complete rebuild (new fields)
PATCH  /projects/:id                   # Complete rebuild
POST   /devices                        # Complete rebuild
PATCH  /devices/:id                    # Complete rebuild
POST   /deployments                    # Extensive field changes
PATCH  /deployments/:id                # Extensive field changes
```

### Backend Schema Impact Matrix

| Change | Mobile Components Affected | Estimated Effort |
|--------|---------------------------|------------------|
| Role rename | RLS checks, auth slices, role displays | 2-3 days |
| Users restructure | Profile screen, registration, user forms | 3-4 days |
| Projects restructure | Project create/edit, list, details screens | 7-10 days |
| Devices rebuild | Device management, BLE pairing, status displays | 5-7 days |
| Deployments restructure | Deployment wizard, forms, history screens | 5-7 days |
| AI Models (new) | Model selection UI, project settings, upload feature | 8-10 days |
| Firmware (new) | Firmware display, version tracking UI | 3-5 days |
| Device Preparation (new) | Preparation wizard, test workflows | 7-10 days |
| LoRaWAN (new) | Device health dashboard, message viewer | 5-7 days |
| Lookup tables (new) | Dropdown selectors, migration scripts | 2-3 days |

**Total Backend Integration Effort**: 47-66 days (≈9-13 weeks)

---

## 2. Code Review Remediation Status (BLOCKING WORK)

### Source
- `project-context/code-review/20251016/CODE-REVIEW-REMEDIATION-PLAN.md`
- `project-context/code-review/20251016/AI-Review-Docs/action-items.md`

### Current Remediation Progress

#### Phase 1: Critical Blockers (MUST FIX BEFORE NEW DEVELOPMENT)
**Status**: Partially Complete (33%)
**Blocking**: All future Tasks 14-23

| Task | Status | Completion | Blocker Level |
|------|--------|------------|---------------|
| CR-1.1: Security - Remove Hardcoded API Keys | ⚠️ NOT STARTED | 0% | **P0 - CRITICAL** |
| CR-1.2: TypeScript - Fix Compilation Errors | ✅ PARTIAL | 90% | **P0 - BLOCKING** |
| CR-1.3: Code Style - Auto-Fix Linting | ⚠️ NOT STARTED | 0% | P1 - HIGH |

**CR-1.1 Details** (SECURITY CRITICAL):
```json
// CURRENT (eas.json) - EXPOSED CREDENTIALS
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://nuhwmubvygxyddkycmpa.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "sb_publishable_SZ5M-5IzbkTs74QgD7c9wg_7EUyWzsd",
        "GOOGLE_MAPS_API_KEY_ANDROID": "AIzaSyD4GgP2HPVqgEOIbOiA1QF6AfTaSBg4vfI"
      }
    }
  }
}
```

**Required Actions**:
- Remove all secrets from `eas.json`
- Configure EAS Secrets for all environments
- **CRITICAL**: Rotate exposed Supabase anon key and Google Maps API key
- Update `app.config.js` to use `process.env`
- Add `.env` files to `.gitignore`
- **Estimated**: 2 hours

**CR-1.2 Details** (24 TypeScript Errors Remaining):
- ✅ Debug files removed (EmergencyApp.tsx, ExpoConstantsDebugger.tsx, SimpleApp.tsx) - Commit: ae8fb94
- ✅ Test type errors fixed (13 errors) - Commit: 8e448ea
- ✅ TypeScript errors reduced from 251 → 24 (90% reduction!)
- ⚠️ 24 remaining errors in projectsSlice/offlineSlice tests (non-blocking for MVP)
- **Estimated**: 2-3 hours to complete

**CR-1.3 Details** (1000+ Linting Violations):
- Mostly `prettier/prettier` auto-fixable violations
- Mixed quote styles, inconsistent indentation
- Can run `npm run lint --fix` for automatic cleanup
- **Estimated**: 1 hour

#### Phase 2: Quality Gates (BEFORE TASKS 14-23)
**Status**: 25% Complete
**Target**: Complete before starting Task 14

| Task | Status | Completion | Priority |
|------|--------|------------|----------|
| CR-2.1: Redux Architecture Consolidation | ✅ COMPLETE | 100% | P1 - HIGH |
| CR-2.2: Performance - React.memo List Components | ⚠️ NOT STARTED | 0% | P1 - HIGH |
| CR-2.3: Security - Secure Storage for Auth Tokens | ⚠️ NOT STARTED | 0% | P1 - HIGH |
| CR-2.4: Configuration - Complete app.json Setup | ⚠️ NOT STARTED | 0% | P2 - MEDIUM |

**CR-2.1 Details** (✅ COMPLETED):
- ✅ Moved projectsApi.ts from `src/store/api/` → `src/redux/api/`
- ✅ Deleted duplicate slices (offlineSlice, syncSlice, networkSlice) from `src/store/`
- ✅ Removed entire `src/store/` directory (-1205 lines)
- ✅ Updated 11 files with corrected import paths
- ✅ TypeScript type-check passes (pre-existing errors unrelated)
- Commit: c8ccecf
- **Actual effort**: 2 hours

**CR-2.2 Details** (Performance):
- Only 7 usages of React.memo/useCallback/useMemo in entire codebase
- List components (ProjectCard, DeploymentCard) not memoized
- Causing unnecessary re-renders in FlatLists
- **Estimated**: 3 hours

**CR-2.3 Details** (Security):
- AsyncStorage used for JWT tokens (NOT encrypted)
- Should use `expo-secure-store` for auth tokens
- Tokens stored in Keychain (iOS) / KeyStore (Android)
- **Estimated**: 2 hours

**CR-2.4 Details** (Configuration):
- Minimal app.json configuration
- Missing permissions declarations (CAMERA, LOCATION, BLUETOOTH)
- No icon/splash screen config
- Platform-specific settings incomplete
- **Estimated**: 1.5 hours

#### Phase 3: Debt Reduction (DURING TASKS 14-23)
**Status**: Not Started
**Approach**: Incremental improvements during feature development

| Task | Target | Current | Priority |
|------|--------|---------|----------|
| CR-3.1: Logging - Replace console.log | 50% reduction (243/486) | 0% | P2 - MEDIUM |
| CR-3.2: Architecture - Refactor Large Services | OfflineService <600 lines | 984 lines | P3 - LOW |
| CR-3.3: Testing - Add Component Tests | 70% coverage | 60% coverage | P3 - LOW |

**CR-3.1 Details**:
- 486 console statements across 56 files
- Top offenders:
  - OfflineService.ts: 73 statements
  - ProjectService.ts: 57 statements
  - auth.ts: 35 statements
  - useBle.ts: 28 statements
- Create `src/utils/logger.ts` service
- Replace during each feature task (14-23)
- **Estimated**: 4 hours (incremental)

**CR-3.2 Details**:
- OfflineService.ts: 984 lines (approaching 1000 line limit)
- DatabaseService.ts: 802 lines
- Extract modules: NetworkMonitor, RetryManager, OperationExecutor
- Refactor during modification
- **Estimated**: 6 hours (incremental)

**CR-3.3 Details**:
- Test coverage <60% currently
- No component tests (UI layer)
- Add tests for new components in Tasks 14-23
- **Estimated**: 4 hours (incremental)

### Code Review Technical Debt Summary

**Critical Blockers (Phase 1)**: 5-8 hours
- Security: 2 hours (API key rotation)
- TypeScript: 2-3 hours (remaining 24 errors)
- Linting: 1 hour (auto-fix)

**Quality Gates (Phase 2)**: 6.5 hours
- ✅ Redux consolidation: DONE
- Performance: 3 hours (React.memo)
- Security: 2 hours (SecureStore)
- Configuration: 1.5 hours (app.json)

**Debt Reduction (Phase 3)**: 14 hours (incremental)
- Logging: 4 hours (during feature work)
- Refactoring: 6 hours (during modifications)
- Testing: 4 hours (add tests for new features)

**Total Remediation Effort**: 25.5-27.5 hours (3-4 days full-time)

### Integration with Three Workstreams

**Recommendation**: Address Phase 1 + Phase 2 BEFORE starting Task 14
- **Rationale**: Avoids introducing new debt on top of existing issues
- **Benefit**: Clean foundation for Tasks 14-23 development
- **Risk**: 3-4 day delay to Task 14 start, BUT prevents compounding technical debt

**Alternative**: Address Phase 1 only (5-8 hours), defer Phase 2-3
- **Rationale**: Minimum viable fixes to unblock development
- **Benefit**: Faster Task 14 start (1 day delay)
- **Risk**: Accumulating debt, may need larger refactor later

---

## 3. Requirements Gap Analysis (Baseline → Goal)

### Source
- Baseline: `project-context/development-context/documentation-cleanup/WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW.md`
- Target: `project-context/development-context/documentation-cleanup/WILDLIFE-WATCHER-APP-STAKEHOLDER-OVERVIEW-GOAL.md`

### Major Requirements Changes

#### 3.1 User Role Simplification
**Baseline**: 4 roles (Project Member, Project Admin, Model Manager, WW Admin)
**Target**: 3 roles for MVP2 (Project Member, Project Admin, Organisation Member)

**Changes**:
- WW Admin mobile features moved to web portal (read-only mobile access)
- Model Manager → Organisation Manager (renamed)
- Organisation Member added for non-project users

**Mobile Impact**:
- Role checking logic needs updates
- UI elements showing role need updates
- Permission matrices need revision
- **Affected Tasks**: 12 (Projects), 13 (Members), 14 (Details), All auth screens

#### 3.2 Organization Model Simplification
**Baseline**: Multi-organization support with org switching
**Target**: Single "General" organization for MVP2

**Changes**:
- Multi-org features deferred to post-MVP
- All users/projects in "General" org for MVP2
- Org switching UI removed for MVP2

**Mobile Impact**:
- Simplifies org selection logic
- Removes org switcher components
- Backend still multi-tenant, mobile treats as single-org
- **Affected Tasks**: 12, 13, 14, 15 (org-aware components can be simplified)

#### 3.3 New Features Added

**Camera Preparation Workflow** (NEW):
- 2-step process before deployment
- Hardware checks: firmware, battery, SD card, camera view
- LoRaWAN registration
- Readiness validation before allowing deployment
- **Required**: New screens/wizard, integration with Task 15
- **Effort**: 7-10 days (aligns with backend device_preparation table)

**In-App Project Invitations** (NEW):
- Invite users to projects via app
- Email notification + in-app acceptance
- Role assignment during invitation
- **Required**: New invitation screens, notification system
- **Effort**: 5-7 days
- **Task Impact**: New subtask for Task 13 or Task 14

**User Self-Registration with Email Verification** (NEW):
- Users can sign up without admin pre-creation
- Email verification required
- Auto-assign to "General" organization
- **Required**: Enhanced registration screen, email templates
- **Effort**: 3-5 days
- **Task Impact**: Update Task 1 (Authentication) or add to Task 23

**Profile, Settings, Feedback Screens** (NEW):
- User profile management
- App settings (notifications, preferences)
- In-app feedback submission
- **Required**: New screens + API endpoints
- **Effort**: 4-6 days
- **Task Impact**: New task or integrate into Task 14/23

**Photo Storage Strategy** (NEW):
- Differentiate test photos (device preparation) vs deployment photos
- Separate storage buckets or tagging strategy
- **Required**: Storage service updates, upload logic changes
- **Effort**: 2-3 days
- **Task Impact**: Update Task 15 (deployments) and camera prep workflow

#### 3.4 Modified Workflows

**Deployment Wizard Simplification**:
**Baseline**: 6-step wizard
**Target**: 4-5 step wizard

**Changes**:
- Consolidate device discovery + configuration?
- Simplify camera preview + final setup?
- Exact steps TBD based on stakeholder feedback

**Mobile Impact**:
- **Task 15 needs revision** to match 4-5 step flow
- Wizard navigation component updates
- Step validation logic adjustments
- **Effort**: Update Task 15 specification, 1-2 days implementation adjustment

**Device Status Lifecycle Clarification**:
- More explicit status tracking (preparation → ready → deployed → retrieved)
- Status transitions enforced by workflow
- **Mobile Impact**: Device status display logic, validation checks
- **Task Impact**: Tasks 15, 18, 19

### Requirements Delta Impact Matrix

| Requirement Change | Tasks Affected | Rework Needed? | New Work? | Effort |
|--------------------|----------------|----------------|-----------|--------|
| Role simplification | 1, 12, 13, 14 | Minor updates | No | 1-2 days |
| Org simplification | 12, 13, 14, 15 | Remove org switcher | No | 1 day |
| Camera prep workflow | 15, 18 | Update deployment flow | Yes - NEW | 7-10 days |
| In-app invitations | 13, 14 | Add invitation feature | Yes - NEW | 5-7 days |
| Self-registration | 1, 23 | Enhanced auth flow | Yes - NEW | 3-5 days |
| Profile/Settings/Feedback | 14, 23 | New screens | Yes - NEW | 4-6 days |
| Photo storage strategy | 15, 18 | Update upload logic | Yes - NEW | 2-3 days |
| Deployment wizard 4-5 steps | 15 | Revise wizard | Update spec | 1-2 days |
| Device status lifecycle | 15, 18, 19 | Clarify status logic | Update logic | 1-2 days |

**Total New Work from Requirements**: 23-35 days (4.5-7 weeks)

---

## 4. Task Specification Evolution (Tasks 14-23)

### Source
- `project-context/development-context/MVP2/implementation/tasks/task_*.txt`

### Task Evolution Analysis

#### 4.1 Task 14: Project Details & Administration
**Original Scope**: Basic project details screen with admin tools
**Current Spec Adds**:
- **Organisation Context Bar** (multi-org users) - MAY BE SIMPLIFIED for MVP2
- **LoRaWAN Device Management**: Battery levels, SD card usage from webhooks - NEW
- **WW Admin Global Administration**: Read-only cross-org view - NEW
- **Role-Based Editable Fields**: Different capabilities for WW Admin/Project Admin/Project Member
- **Device Status Overview**: Real-time device health from LoRaWAN
- **Enhanced Analytics**: Cross-project analytics, LoRaWAN fleet health
- **Organisation Intelligence**: Benchmarking, territory mapping

**Specification Updates Needed**:
- Clarify if org context bar needed for single "General" org MVP2
- Confirm LoRaWAN integration scope (is backend ready?)
- Clarify WW Admin mobile vs web portal features
- Update to reflect single-org simplification

**Estimated Effort Adjustment**: +5-7 days for LoRaWAN integration

#### 4.2 Task 15: Start Deployment Flow (6-Step Wizard)
**Original Scope**: 6-step deployment wizard
**Current Spec Adds**:
- **Organisation Context** throughout wizard - MAY BE SIMPLIFIED
- **LoRaWAN Configuration**: Webhook setup, battery monitoring, data transmission frequency
- **Device Preparation Integration**: Requires preparation complete before deployment
- **Role-Based Device Access**: Validate user permissions for devices
- **Organisation Territory Validation**: Ensure deployment in approved areas
- **Deployment Conflict Detection**: Check for nearby deployments

**Specification Updates Needed**:
- Revise to 4-5 step wizard per requirements change
- Clarify device preparation integration (is it Step 2.5 or prerequisite?)
- Simplify org-specific features for single "General" org
- Confirm LoRaWAN configuration scope

**Estimated Effort Adjustment**: +7-10 days for device preparation + LoRaWAN

#### 4.3 Task 20: Offline Synchronization System
**Original Scope**: Bidirectional sync with conflict resolution
**Current Spec Adds**:
- **Organisation-Aware Sync**: Data isolation by org, role-based filtering
- **LoRaWAN Device Status Sync**: Priority handling for battery/SD card data
- **Role-Based Sync Filtering**: WW Admin, project admin, project member data scoping
- **Organisation Policy Conflicts**: Compliance validation during sync
- **WW Admin Conflict Oversight**: Cross-org conflict resolution

**Specification Updates Needed**:
- Simplify org-aware sync for single "General" org MVP2
- Clarify LoRaWAN sync priority (how critical is real-time device status?)
- Confirm if WW Admin features are mobile or web portal only

**Estimated Effort Adjustment**: +3-5 days for LoRaWAN sync logic

#### 4.4 Task 23: Production Readiness & Documentation
**Original Scope**: Security, documentation, deployment prep
**Current Spec Adds**:
- **Organisation Multi-Tenancy Security**: Data isolation validation, RLS policies across org boundaries
- **LoRaWAN Security**: Webhook authentication, device communication validation
- **WW Admin Launch Prep**: Read-only cross-org access, web portal
- **Organisation-Aware Documentation**: Multi-tenant setup guides, role-based procedures

**Specification Updates Needed**:
- Simplify org multi-tenancy docs for single "General" org MVP2
- Clarify WW Admin web portal scope (is it part of MVP2 mobile delivery?)
- Update security checklist for LoRaWAN integration

**Estimated Effort Adjustment**: +2-3 days for LoRaWAN security validation

### Task Modification Summary

| Task | Original Estimate | Additions Scope | Revised Estimate | Delta |
|------|-------------------|-----------------|------------------|-------|
| Task 14 | 15 hours | LoRaWAN device mgmt, WW Admin, org analytics | 20-22 hours | +5-7 hours |
| Task 15 | 20 hours | Device prep, LoRaWAN config, territory validation | 27-30 hours | +7-10 hours |
| Task 16-19 | Various | Minor org/LoRaWAN updates | +10-15% | +2-3 hours each |
| Task 20 | 15 hours | Org-aware sync, LoRaWAN sync, role filtering | 18-20 hours | +3-5 hours |
| Task 23 | 12 hours | Org multi-tenancy security, LoRaWAN security | 14-15 hours | +2-3 hours |

**Total Task Spec Overhead**: +25-35 hours (3-4 days)

---

## 5. Current Architecture & Codebase State

### Source
- `src/` directory analysis via `mcp__serena__list_dir`
- Git history (30 commits analyzed)
- Service and Redux slice inventory

### Codebase Architecture Summary

**Redux State Management** (15 slices):
- Core: auth, projects, deployments, devices, offline, sync, network
- BLE: bleLibrary, scanning, bluetoothStatus
- UI: androidPermissions, locationStatus, logs, configuration
- Admin: wwAdmin

**Service Layer** (14 services):
- Project Management: ProjectService, ProjectMemberService
- Offline: OfflineService (984 lines), DatabaseService (802 lines), SyncService, ConflictResolutionService, OfflineApiService, WWAdminOfflineService
- Integration: auth, supabase, database, apiTest, DfuService, MockLoRaWANService

**Provider Hierarchy** (6 layers):
```
App.tsx
├── AndroidPermissionsProvider
│   ├── BleEngineProvider
│   │   ├── ListenToBleEngineProvider
│   │   │   ├── DeviceReconnectProvider
│   │   │   │   ├── AuthProvider
│   │   │   │   │   └── AppSetupProvider
│   │   │   │   │       └── Navigation
```

**Technical Debt Identified**:
- Provider nesting depth (6 levels) creates complexity
- Large service files (OfflineService 984 lines, DatabaseService 802 lines)
- Limited React.memo usage (only 7 instances)
- 486 console.log statements
- Mixed architecture patterns (inconsistent state management)

**Recent Development Focus** (Last 30 commits):
- Environment switching (local/cloud-dev/cloud-prod): 7 commits
- Documentation improvements: 5 commits
- Type checking and infrastructure: 3 commits
- AADF framework updates: 2 commits
- Bug fixes (Supabase connectivity, Redux fixes): 5 commits

### Architecture Strengths
✅ Offline-first architecture foundation complete (Task 11)
✅ Redux state management established
✅ BLE integration working
✅ Multi-environment support (local/cloud-dev/cloud-prod)
✅ Type synchronization system with pre-commit hooks
✅ AADF methodology adopted

### Architecture Weaknesses
⚠️ Provider hierarchy complexity (6 levels)
⚠️ Large service files need decomposition
⚠️ Limited performance optimization (React.memo)
⚠️ Inconsistent logging approach
⚠️ Mixed state management patterns

---

## 6. Three Workstreams Convergence Strategy

### Workstream A: Requirements Changes
**Status**: Documented, needs integration into tasks
**Effort**: 23-35 days of new work identified
**Priority**: Must update task specs before implementation

**Key Deliverables**:
1. Camera preparation workflow (7-10 days)
2. In-app project invitations (5-7 days)
3. User self-registration (3-5 days)
4. Profile/Settings/Feedback screens (4-6 days)
5. Photo storage strategy (2-3 days)
6. Deployment wizard revision to 4-5 steps (1-2 days)

### Workstream B: Code Review Refactoring
**Status**: 25% complete (Phase 2, CR-2.1 done)
**Effort**: 25.5-27.5 hours remaining
**Priority**: Phase 1 MUST complete before Task 14

**Key Deliverables**:
1. **Phase 1 (BLOCKING)**: 5-8 hours
   - Security: Remove hardcoded API keys + rotate (2 hours)
   - TypeScript: Fix remaining 24 errors (2-3 hours)
   - Linting: Auto-fix violations (1 hour)

2. **Phase 2 (BEFORE TASK 14)**: 6.5 hours
   - Performance: React.memo list components (3 hours)
   - Security: SecureStore for auth tokens (2 hours)
   - Configuration: Complete app.json (1.5 hours)

3. **Phase 3 (INCREMENTAL)**: 14 hours
   - Logging: Replace console.log (4 hours during feature work)
   - Refactoring: Split large services (6 hours during modifications)
   - Testing: Add component tests (4 hours for new features)

### Workstream C: Current Development (Stream A Tasks 12-14)
**Status**: Tasks 12-13 complete, Task 14 pending
**Effort**: Task 14 = 20-22 hours (revised with LoRaWAN)
**Priority**: Blocked until Workstream B Phase 1+2 complete

**Key Deliverables**:
1. Task 14: Project Details & Administration
   - Comprehensive project info display
   - Administrative tools (edit, archive, delete, transfer)
   - Data export & analytics
   - LoRaWAN device management integration
   - WW Admin read-only features

### Convergence Approach: Phased Integration

**Phase 0: Blockers Resolution** (1-2 days)
```
Priority: P0 - CRITICAL
Duration: 5-8 hours (1 day with buffer)
Parallel: NO - sequential completion required

Tasks:
1. CR-1.1: Security - API key rotation and EAS Secrets setup
2. CR-1.2: TypeScript - Fix remaining 24 errors
3. CR-1.3: Linting - Auto-fix violations

Gate: NO new feature work until Phase 0 complete
```

**Phase 1: Quality Gates** (1-2 days)
```
Priority: P1 - HIGH
Duration: 6.5 hours (1 day with buffer)
Parallel: Partial (React.memo + SecureStore can run parallel)

Tasks:
1. CR-2.2: Performance - React.memo for list components
2. CR-2.3: Security - SecureStore for auth tokens
3. CR-2.4: Configuration - Complete app.json

Gate: Quality foundation before Task 14 start
```

**Phase 2: Backend Alignment** (2-3 days)
```
Priority: P0 - CRITICAL (for backend integration)
Duration: 2-3 days
Parallel: Can overlap with Phase 1 if backend team ready

Tasks:
1. Review backend mvp2-revised.md with backend team
2. Confirm schema changes timeline
3. Run npm run types:local after backend deploys changes
4. Validate type generation successful
5. Update services for new schema (users, projects, devices, deployments)
6. Create placeholder implementations for new features (ai_models, firmware, device_preparation, lorawan_messages)

Gate: Backend schema changes deployed, types regenerated
```

**Phase 3: Task Specification Updates** (1-2 days)
```
Priority: P1 - HIGH
Duration: 1-2 days
Parallel: NO - needs backend alignment first

Tasks:
1. Update Task 14 spec: Simplify org features, clarify LoRaWAN scope
2. Update Task 15 spec: Revise to 4-5 steps, integrate device prep
3. Update Task 20 spec: Simplify org-aware sync for single org
4. Update Task 23 spec: Clarify WW Admin web vs mobile
5. Create new task specs for requirements additions:
   - Task 14.5: Camera Preparation Workflow
   - Task 13.5: In-App Project Invitations
   - Task 1.5: User Self-Registration
   - Task 23.5: Profile/Settings/Feedback Screens

Gate: All task specs updated and approved
```

**Phase 4: Stream A Completion + Stream B Start** (Parallel Execution)
```
Priority: HIGH
Duration: 3-4 weeks
Parallel: YES - multiple streams

Stream A (Tasks 14):
├── Subtask 14.1: Project Details Screen (3 days)
├── Subtask 14.2: Admin Tools (2 days)
├── Subtask 14.3: Analytics & Reporting (2 days)
├── Subtask 14.4: Advanced Features (1 day)
└── Subtask 14.5: LoRaWAN Integration (2-3 days)

Stream B (Tasks 15-17):
├── Task 15: Start Deployment (4-5 step wizard) (4-5 days)
├── Task 16: End Deployment Flow (2-3 days)
└── Task 17: Deployment History & Details (2-3 days)

Stream C (Tasks 18-20):
├── Task 18: Device Management (3-4 days)
├── Task 19: Maps & Visualization (3-4 days)
└── Task 20: Offline Sync (3-4 days)

Incremental (Phase 3 Code Review):
├── Replace console.log in modified files (ongoing)
├── Refactor services if modifying (opportunistic)
└── Add tests for new components (TDD)

Gate: Streams A, B, C complete with quality improvements
```

**Phase 5: Integration & Polish** (1-2 weeks)
```
Priority: MEDIUM
Duration: 1-2 weeks

Tasks:
├── Task 21: Settings & Profile Management (2-3 days)
├── Task 22: Performance Optimization & Polish (2-3 days)
└── Task 23: Production Readiness & Documentation (2-3 days)

Gate: MVP2 production-ready
```

### Convergence Timeline Summary

| Phase | Duration | Parallel? | Gate |
|-------|----------|-----------|------|
| Phase 0: Blockers | 1-2 days | NO | Must complete before any new work |
| Phase 1: Quality Gates | 1-2 days | Partial | Foundation before Task 14 |
| Phase 2: Backend Alignment | 2-3 days | Can overlap Phase 1 | Types regenerated, schema validated |
| Phase 3: Task Spec Updates | 1-2 days | NO | All specs updated and approved |
| Phase 4: Streams A+B+C | 3-4 weeks | YES | Feature complete |
| Phase 5: Integration & Polish | 1-2 weeks | Partial | Production ready |

**Total Duration**: 6-8 weeks (accounting for parallel execution)

---

## 7. Risk Assessment & Mitigation

### High-Risk Areas

#### Risk 1: Backend Schema Changes Not Deployed
**Impact**: CRITICAL - Mobile development blocked
**Likelihood**: MEDIUM - Backend 98% complete but revised schema not deployed
**Mitigation**:
- Immediate coordination meeting with backend team
- Confirm backend deployment timeline
- Consider staging environment for schema migration testing
- Have rollback plan if schema changes cause issues

#### Risk 2: Hardcoded API Keys Still Exposed
**Impact**: CRITICAL - Security vulnerability, potential data breach
**Likelihood**: HIGH - Keys currently in version control
**Mitigation**:
- **IMMEDIATE ACTION** (within 24 hours):
  - Rotate Supabase anon key
  - Rotate Google Maps API key
  - Remove from eas.json
  - Configure EAS Secrets
  - Update app.config.js to use process.env
- Git history purge may be needed if keys were exposed for long period

#### Risk 3: Requirements Drift During Implementation
**Impact**: HIGH - Scope creep, timeline delays
**Likelihood**: MEDIUM - Stakeholder expectations evolving
**Mitigation**:
- Lock down requirements after Phase 3 (Task Spec Updates)
- Create "MVP2 Frozen" baseline
- Any new requirements go to "MVP2.1" or "Post-Launch" backlog
- Weekly stakeholder sync to manage expectations

#### Risk 4: Technical Debt Accumulation
**Impact**: MEDIUM - Slows future development, increases bug rate
**Likelihood**: HIGH - Pressure to ship features quickly
**Mitigation**:
- Mandatory Phase 0 + Phase 1 completion before feature work
- Incremental Phase 3 improvements during feature development
- Quality gates in PR reviews
- Reserve 20% of sprint capacity for debt reduction

#### Risk 5: LoRaWAN Integration Complexity
**Impact**: HIGH - New technology, unknown unknowns
**Likelihood**: MEDIUM - Limited team experience with LoRaWAN
**Mitigation**:
- Spike/proof-of-concept for LoRaWAN webhook integration (1-2 days)
- Context7 research for LoRaWAN best practices (MANDATORY)
- Backend team provides webhook payload examples
- Phased rollout: MVP2 ships with basic LoRaWAN, advanced features in MVP2.1

#### Risk 6: Offline Sync Conflicts with Schema Changes
**Impact**: HIGH - Data corruption, sync failures
**Likelihood**: MEDIUM - Complex bidirectional sync with schema evolution
**Mitigation**:
- Test offline sync extensively after type regeneration
- Version schema in SQLite database (add version column)
- Force re-sync if schema version mismatch
- User communication: "App update requires re-sync" messaging

---

## 8. Recommended Next Steps

### Immediate Actions (This Week)

#### 1. Stakeholder Alignment Meeting
**Attendees**: Product owner, backend lead, mobile lead
**Agenda**:
- Review comprehensive discovery findings
- Confirm backend schema deployment timeline
- Lock down MVP2 requirements (OVERVIEW-GOAL.md)
- Approve phased convergence approach
- Assign Phase 0 remediation tasks

**Decisions Needed**:
- Is revised backend schema ready for mobile integration?
- Are LoRaWAN features in scope for MVP2 or MVP2.1?
- Is single "General" org simplification approved?
- Are Profile/Settings/Feedback screens MVP2 or post-launch?

#### 2. Backend Coordination
**Action Items**:
- Backend team confirms deployment timeline for mvp2-revised schema
- Backend provides LoRaWAN webhook payload examples
- Backend seeds default AI model for "General" organisation
- Backend creates firmware records for current camera firmware
- Coordinate data migration strategy for users.name → firstname/surname

#### 3. Execute Phase 0: Blockers (IMMEDIATE)
**Priority**: P0 - CRITICAL
**Duration**: 1-2 days
**Owner**: Mobile team

**Tasks**:
```
[x] CR-1.1: Remove hardcoded API keys from eas.json
[x] CR-1.1: Rotate Supabase anon key
[x] CR-1.1: Rotate Google Maps API key
[x] CR-1.1: Configure EAS Secrets
[x] CR-1.1: Update app.config.js
[x] CR-1.2: Fix remaining 24 TypeScript errors
[x] CR-1.3: Run npm run lint --fix
[ ] Validation: npm run type-check (0 errors)
[ ] Validation: npm run lint (<50 violations)
[ ] Validation: eas build --platform android --profile preview (success)
```

#### 4. Plan Phase 1: Quality Gates
**Priority**: P1 - HIGH
**Duration**: 1-2 days
**Owner**: Mobile team

**Pre-work**:
- Research React Native performance optimization (Context7)
- Research expo-secure-store best practices (Context7)
- Prepare app.json configuration checklist

**Tasks**:
```
[ ] CR-2.2: Wrap ProjectCard, DeploymentCard, DeviceCard in React.memo
[ ] CR-2.2: Add useCallback for event handlers
[ ] CR-2.2: Add useMemo for computed values
[ ] CR-2.3: Install expo-secure-store
[ ] CR-2.3: Create SecureStorage adapter
[ ] CR-2.3: Update supabase client to use SecureStorage
[ ] CR-2.4: Add required permissions to app.json
[ ] CR-2.4: Configure bundle identifiers
[ ] CR-2.4: Add placeholder icon/splash
[ ] Validation: React DevTools Profiler shows reduced re-renders
[ ] Validation: Auth tokens in Keychain/KeyStore
[ ] Validation: eas build succeeds
```

### Short-Term Actions (Next 2 Weeks)

#### 5. Execute Phase 2: Backend Alignment
**Priority**: P0 - CRITICAL
**Duration**: 2-3 days
**Owner**: Mobile + Backend teams

**Tasks**:
```
[ ] Backend deploys mvp2-revised schema to staging
[ ] Mobile runs npm run types:local against staging
[ ] Mobile validates type generation successful
[ ] Mobile creates service adapters for new schema:
    - users: firstname/surname handling
    - projects: model_id, capture_method_id
    - devices: organisation_id, battery_level, sd_card
    - deployments: ai_model_id, firmware_id, device_eui
[ ] Mobile creates placeholder implementations:
    - AI Models: list, select (no upload for MVP2)
    - Firmware: display version only
    - Device Preparation: basic workflow skeleton
    - LoRaWAN: webhook receiver stub
[ ] Integration testing: CRUD operations with new schema
[ ] Rollback plan documented if issues arise
```

#### 6. Execute Phase 3: Task Specification Updates
**Priority**: P1 - HIGH
**Duration**: 1-2 days
**Owner**: Product + Mobile lead

**Tasks**:
```
[ ] Update Task 14 spec:
    - Simplify org context for single "General" org
    - Clarify LoRaWAN scope (display only vs full mgmt)
    - Confirm WW Admin mobile vs web features
[ ] Update Task 15 spec:
    - Revise wizard to 4-5 steps (consolidate steps)
    - Integrate device preparation as prerequisite
    - Simplify org-specific validation
[ ] Update Task 20 spec:
    - Simplify org-aware sync for single org
    - Clarify LoRaWAN sync priority
[ ] Update Task 23 spec:
    - Update security checklist for LoRaWAN
    - Clarify WW Admin web portal scope
[ ] Create new task specs:
    - Task 14.5: Camera Preparation Workflow (7-10 days)
    - Task 13.5: In-App Project Invitations (5-7 days)
    - Task 1.5: User Self-Registration (3-5 days)
    - Task 23.5: Profile/Settings/Feedback (4-6 days)
[ ] Get stakeholder approval on updated specs
[ ] Update MVP2-MASTER-EXECUTION-PLAN.md
[ ] Update MVP2-METRICS-TRACKER.md with revised estimates
```

### Medium-Term Actions (Weeks 3-6)

#### 7. Execute Phase 4: Parallel Stream Development
**Priority**: HIGH
**Duration**: 3-4 weeks
**Owner**: Mobile team (full capacity)

**Parallel Execution Strategy**:
```
Week 1:
  Stream A: Task 14 (Project Details) - Developer 1
  Stream B: Task 15 (Start Deployment) - Developer 2
  Stream C: Task 18 (Device Management) - Developer 3

Week 2:
  Stream A: Task 14 cont. + LoRaWAN integration
  Stream B: Task 16 (End Deployment) - Developer 2
  Stream C: Task 19 (Maps & Visualization) - Developer 3

Week 3:
  Stream A: Task 14.5 (Camera Prep Workflow) - Developer 1
  Stream B: Task 17 (Deployment History) - Developer 2
  Stream C: Task 20 (Offline Sync) - Developer 3

Week 4:
  Stream A: Task 13.5 (Invitations) - Developer 1
  Integration: Cross-stream testing - All developers
  Phase 3: Incremental improvements - Ongoing
```

**Quality Gates** (Per Task):
```
[ ] Unit tests written (TDD approach)
[ ] Integration tests passing
[ ] TypeScript errors: 0
[ ] Console statements replaced with logger
[ ] React.memo applied where appropriate
[ ] Code review approved
[ ] Maestro E2E tests (if applicable)
```

#### 8. Execute Phase 5: Integration & Polish
**Priority**: MEDIUM
**Duration**: 1-2 weeks
**Owner**: Mobile team

**Tasks**:
```
[ ] Task 21: Settings & Profile Management (2-3 days)
[ ] Task 22: Performance Optimization & Polish (2-3 days)
[ ] Task 23: Production Readiness & Documentation (2-3 days)
[ ] Final integration testing across all streams
[ ] Security audit (penetration testing)
[ ] Performance benchmarking
[ ] User acceptance testing
[ ] Production deployment preparation
```

---

## 9. Success Metrics & Quality Gates

### Phase 0 Success Criteria (BLOCKERS)
- [ ] Zero hardcoded secrets in codebase (grep for API keys returns 0)
- [ ] All secrets in EAS Secrets configuration
- [ ] Exposed credentials rotated and verified
- [ ] TypeScript errors: 0 (npm run type-check)
- [ ] Linting violations: <50 (npm run lint)
- [ ] EAS build succeeds (eas build --platform android --profile preview)

### Phase 1 Success Criteria (QUALITY GATES)
- [ ] List components memoized: ProjectCard, DeploymentCard, DeviceCard, MemberCard
- [ ] React DevTools Profiler shows >50% re-render reduction
- [ ] Auth tokens encrypted: Tokens in Keychain (iOS) / KeyStore (Android)
- [ ] app.json complete: All required permissions declared
- [ ] Bundle identifiers set correctly
- [ ] Build succeeds on both Android and iOS

### Phase 2 Success Criteria (BACKEND ALIGNMENT)
- [ ] Backend mvp2-revised schema deployed to staging
- [ ] Types regenerated successfully: npm run types:local
- [ ] Zero type generation errors
- [ ] Service adapters created for new schema
- [ ] Placeholder implementations for new features
- [ ] Integration tests passing with new schema
- [ ] Rollback plan tested and documented

### Phase 3 Success Criteria (TASK SPECS)
- [ ] All task specifications updated (Tasks 14, 15, 20, 23)
- [ ] New task specifications created (Tasks 14.5, 13.5, 1.5, 23.5)
- [ ] Stakeholder approval obtained
- [ ] MVP2-MASTER-EXECUTION-PLAN.md updated
- [ ] MVP2-METRICS-TRACKER.md updated with revised estimates
- [ ] Team aligned on updated scope and timeline

### Phase 4 Success Criteria (FEATURE COMPLETE)
- [ ] Stream A: Tasks 12-14 complete (100%)
- [ ] Stream B: Tasks 15-17 complete (100%)
- [ ] Stream C: Tasks 18-20 complete (100%)
- [ ] All features tested and validated
- [ ] Code quality gates met:
  - TypeScript errors: 0
  - Console statements reduced by 50%
  - Test coverage: ≥70%
  - All list components memoized
  - Large services refactored (<600 lines)
- [ ] Integration testing passed

### Phase 5 Success Criteria (PRODUCTION READY)
- [ ] Tasks 21-23 complete (100%)
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] App store submission ready
- [ ] Production deployment validated
- [ ] Team training completed

---

## 10. Updated Prompt Summary

### What Was Added to the Original Prompt

#### From Codebase & Git History Analysis:
1. **Architecture Current State Section** - 15 Redux slices, 14 services, 6-layer provider hierarchy documented
2. **Technical Debt Inventory** - 486 console statements, large service files (984/802 lines), limited React.memo usage
3. **Recent Development Focus** - 30 commits analyzed showing environment switching, documentation, type checking priorities

#### From Backend Schema Comparison:
1. **Complete Schema Delta Section** - 12 breaking changes detailed with mobile impact assessment
2. **New Features Requirements** - 8 new tables requiring 47-66 days implementation
3. **API Endpoint Changes** - Complete list of endpoints requiring rebuild vs new endpoints needed
4. **Mobile Impact Matrix** - Component-by-component impact analysis with effort estimates

#### From Code Review Findings:
1. **Remediation Status Section** - Phase 1 (33% complete), Phase 2 (25% complete), Phase 3 (not started)
2. **Blocking Issues Documented** - Security (hardcoded keys), TypeScript (24 errors), Performance (no memoization)
3. **Remediation Effort Estimates** - 25.5-27.5 hours total with phase breakdown
4. **Integration with Workstreams** - How code review fits into convergence strategy

#### From Requirements Gap Analysis:
1. **Requirements Delta Section** - Baseline → Goal state comparison with 9 major changes
2. **New Features Identified** - Camera prep workflow, in-app invitations, self-registration, profile/settings/feedback
3. **Modified Workflows** - Deployment wizard simplification (6 → 4-5 steps)
4. **Impact Matrix** - Which tasks affected by which requirement changes

#### From Task Specification Review:
1. **Task Evolution Analysis** - How Tasks 14, 15, 20, 23 evolved with org/LoRaWAN/role additions
2. **Specification Updates Needed** - Simplifications for single "General" org MVP2
3. **Effort Adjustments** - +25-35 hours across Tasks 14-23 for new requirements
4. **New Task Specifications** - 4 new tasks identified (14.5, 13.5, 1.5, 23.5)

### Why These Additions Are Critical

**Backend Schema Integration**:
- **Problem Solved**: Without schema alignment, mobile development will fail with type mismatches and runtime errors
- **Workstream Impact**: Blocks all three workstreams until types regenerated
- **Timeline Impact**: 2-3 days coordination + potential 4-6 weeks for new feature implementation

**Code Review Remediation**:
- **Problem Solved**: Building new features on top of technical debt compounds problems exponentially
- **Workstream Impact**: Security issues block production deployment, TypeScript errors block builds
- **Timeline Impact**: 3-4 days upfront, prevents 2-3 weeks rework later

**Requirements Gap Mapping**:
- **Problem Solved**: Implementing wrong features wastes development time, creates stakeholder misalignment
- **Workstream Impact**: Affects task specifications, implementation scope, testing strategy
- **Timeline Impact**: +23-35 days of new work identified that wasn't in original estimate

**Task Specification Evolution**:
- **Problem Solved**: Original task specs don't reflect current org/LoRaWAN/role requirements
- **Workstream Impact**: Developers would implement against outdated specs, requiring rework
- **Timeline Impact**: 1-2 days upfront spec updates prevents 1-2 weeks implementation rework

### Recommended Execution Path

**Option A: Full Quality Path** (6-8 weeks)
- Complete Phase 0-3 before any feature work (1-2 weeks)
- Parallel execution of Streams A/B/C (3-4 weeks)
- Integration & Polish (1-2 weeks)
- **Pros**: Clean foundation, minimal rework, high quality
- **Cons**: 1-2 week delay to feature development start

**Option B: Fast Track Path** (5-7 weeks)
- Complete Phase 0 only (1-2 days)
- Start feature development immediately
- Defer Phase 1-2 to incremental during feature work
- **Pros**: Faster feature development start
- **Cons**: Higher risk of rework, accumulating debt

**Option C: Hybrid Path** (5-7 weeks) - **RECOMMENDED**
- Complete Phase 0 (blockers) immediately (1-2 days)
- Complete Phase 1 (quality gates) before Task 14 (1-2 days)
- Phase 2 (backend alignment) overlaps with Phase 1 (2-3 days)
- Phase 3 (task specs) immediately after Phase 2 (1-2 days)
- Total prep: 1 week, then parallel streams (3-4 weeks)
- **Pros**: Balances speed with quality, addresses critical blockers
- **Cons**: Slightly longer prep phase, but prevents major rework

---

## Conclusion

This comprehensive analysis reveals that the three parallel workstreams (requirements changes, code review refactoring, current development) require careful convergence planning to avoid:

1. **Technical Debt Compounding** - Building features on unstable foundation
2. **Requirements Misalignment** - Implementing wrong features
3. **Backend Schema Mismatch** - Type errors and runtime failures
4. **Scope Creep** - Uncontrolled addition of new features

**Recommended Approach**: Hybrid Path (Option C)
- **Week 1**: Phase 0-3 preparation (blockers, quality gates, backend alignment, task specs)
- **Weeks 2-5**: Parallel stream development (Tasks 14-20)
- **Weeks 6-7**: Integration & polish (Tasks 21-23)

**Total Timeline**: 6-7 weeks to production-ready MVP2

**Key Success Factors**:
1. Immediate stakeholder alignment meeting (THIS WEEK)
2. Backend schema deployment coordination (THIS WEEK)
3. Phase 0 blocker resolution (WITHIN 48 HOURS)
4. Lock down requirements after Phase 3 (no more scope changes)
5. Parallel execution discipline (prevent work fragmentation)

---

**Next Actions**:
1. Schedule stakeholder alignment meeting (Product, Backend Lead, Mobile Lead)
2. Execute Phase 0 remediation (API key rotation, TypeScript fixes, linting)
3. Coordinate with backend team on schema deployment timeline
4. Update task specifications based on this analysis
5. Begin Phase 1 quality gates upon Phase 0 completion

---

**Document Version**: 1.0
**Analysis Date**: 2025-10-31
**Review Required**: YES - Stakeholder approval needed before proceeding
