# Runtime Environment Switching Implementation Plan

**Status**: 🟡 Ready to Execute
**Created**: 2025-10-29
**Objective**: Enable runtime database environment switching (local/cloud-dev/cloud-prod) in development builds with proper type synchronization workflow

---

## 📋 Executive Summary

### Problem Statement
Current setup forces developer to use cloud Supabase instance for device testing, creating slow feedback loops. Developer cannot test local backend schema changes on physical device without deploying to cloud first.

### Solution Overview
Implement runtime environment switching that allows:
1. **Development build** to toggle between localhost:54321 and cloud instances
2. **Preview build** fixed to cloud-dev (for stakeholders)
3. **Production build** fixed to cloud-prod (for app stores)
4. Proper type synchronization for each environment
5. GitHub Actions integration for cloud deployments

### Success Criteria
- ✅ Developer can switch environments via in-app settings
- ✅ Development build defaults to localhost
- ✅ Preview/Production builds fixed to appropriate cloud instances
- ✅ Type synchronization scripts for both local and cloud
- ✅ GitHub Actions validates cloud type alignment
- ✅ Complete documentation and workflow guides

---

## 🎯 Implementation Strategy

### Execution Model
- **Parallel Track A**: Core infrastructure (config, environment manager)
- **Parallel Track B**: UI components (developer settings screen)
- **Parallel Track C**: Type synchronization tooling (npm scripts, GitHub Actions)
- **Sequential**: Integration → Testing → Documentation

### Dependency Graph
```
Track A (Infrastructure)     Track B (UI Components)      Track C (Type Sync)
├─ Task 1.1: Config            ├─ Task 2.1: Settings         ├─ Task 3.1: Scripts
│  (Foundation)                │  Screen                     │  (npm scripts)
│                              │                             │
├─ Task 1.2: Environment       │                             ├─ Task 3.2: GitHub
│  Manager                     │                             │  Actions
│  (Depends on 1.1)            │                             │
│                              │                             │
└─ Task 1.3: Supabase Client   │                             └─ Task 3.3: Pre-commit
   Refactor                    │                                Hook
   (Depends on 1.2)            │                                (Depends on 3.1)
                               │
                               └─ Task 2.2: Navigation
                                  Integration
                                  (Depends on 2.1)

                    ↓ ↓ ↓ (All tracks complete) ↓ ↓ ↓

Task 4: Integration Testing (Depends on 1.3, 2.2, 3.3)
   ↓
Task 5: Documentation Update (Depends on 4)
   ↓
Task 6: Developer Workflow Guide (Depends on 5)
```

---

## 📦 Task Breakdown

### **Track A: Core Infrastructure** (Foundation Layer)

#### **Task 1.1: Environment Configuration System**
**Status**: 🔴 Not Started
**Priority**: P0 (Critical Path)
**Agent**: `backend-architect`
**Estimated Time**: 1 hour
**Dependencies**: None
**Parallel With**: Tasks 2.1, 3.1

**Objective**: Create centralized environment configuration system with type safety

**Context**:
- Currently `src/services/supabase.ts` reads config from `Constants.expoConfig.extra`
- Need multi-environment support (local/cloud-dev/cloud-prod)
- Must integrate with existing Expo configuration in `app.config.js`
- `.env.local` currently hardcoded to cloud instance (line 38-39)

**Implementation Requirements**:

1. **Create `src/config/environments.ts`**:
   ```typescript
   export type SupabaseEnvironment = 'local' | 'cloud-dev' | 'cloud-prod';

   export interface EnvironmentConfig {
     supabaseUrl: string;
     supabaseAnonKey: string;
     displayName: string;
     description: string;
     isProduction: boolean;
   }

   export const ENVIRONMENT_CONFIGS: Record<SupabaseEnvironment, EnvironmentConfig>;
   ```

2. **Define environment configurations**:
   - **Local**: `http://localhost:54321` (or WSL IP for device testing)
   - **Cloud Dev**: Current cloud instance from `.env.local` line 38
   - **Cloud Prod**: Placeholder for future production instance

3. **Environment detection logic**:
   - Read from `Constants.expoConfig.extra.isDevelopment`
   - Determine default environment based on build type
   - Expose validation utilities

**Acceptance Criteria**:
- ✅ Type-safe environment configuration object
- ✅ All three environments defined with proper URLs/keys
- ✅ Default environment detection logic implemented
- ✅ TypeScript compiles without errors
- ✅ Unit tests for environment detection

**Files to Create**:
- `src/config/environments.ts`
- `src/config/__tests__/environments.test.ts`

**Files to Read First**:
- `src/services/supabase.ts` (understand current config)
- `app.config.js` (understand Expo config structure)
- `.env.local` (get current cloud credentials)

---

#### **Task 1.2: Environment Manager with AsyncStorage**
**Status**: 🔴 Not Started
**Priority**: P0 (Critical Path)
**Agent**: `backend-architect`
**Estimated Time**: 1.5 hours
**Dependencies**: Task 1.1
**Parallel With**: Task 2.1, 3.1

**Objective**: Create environment manager for runtime switching with persistence

**Context**:
- Must persist environment selection across app restarts
- Only allow switching in development builds
- Provide hooks/utilities for React components
- Handle environment validation and error states

**Implementation Requirements**:

1. **Create `src/config/EnvironmentManager.ts`**:
   - AsyncStorage integration for persistence (`@supabase_environment` key)
   - `getEnvironment()`: Retrieve current environment
   - `setEnvironment()`: Persist environment selection (dev builds only)
   - `getEnvironmentConfig()`: Get full config for current environment
   - `canSwitchEnvironment()`: Check if switching is allowed
   - `resetToDefault()`: Reset to default environment

2. **Create React hooks**:
   - `useSupabaseEnvironment()`: Hook for components
   - `useCanSwitchEnvironment()`: Permission check hook
   - Return loading states, current environment, setter function

3. **Error handling**:
   - Handle AsyncStorage failures gracefully
   - Validate environment strings from storage
   - Fallback to default on corruption

**Acceptance Criteria**:
- ✅ Environment persists across app restarts
- ✅ Switching blocked in non-development builds
- ✅ React hooks work correctly with proper loading states
- ✅ Error handling for storage failures
- ✅ Unit tests for all functions
- ✅ Integration tests for AsyncStorage persistence

**Files to Create**:
- `src/config/EnvironmentManager.ts`
- `src/config/hooks/useSupabaseEnvironment.ts`
- `src/config/__tests__/EnvironmentManager.test.ts`
- `src/config/hooks/__tests__/useSupabaseEnvironment.test.ts`

**Files to Read First**:
- `src/config/environments.ts` (from Task 1.1)
- `app.config.js` (check isDevelopment flag)

---

#### **Task 1.3: Refactor Supabase Client for Dynamic Configuration**
**Status**: 🔴 Not Started
**Priority**: P0 (Critical Path)
**Agent**: `backend-architect`
**Estimated Time**: 2 hours
**Dependencies**: Task 1.2
**Blocks**: Task 4 (Integration Testing)

**Objective**: Refactor Supabase client initialization to support dynamic environment switching

**Context**:
- Current `src/services/supabase.ts` creates singleton client at module load
- Singleton approach incompatible with runtime environment switching
- Must maintain backward compatibility with existing code
- Need client recreation when environment changes

**Implementation Requirements**:

1. **Refactor client initialization**:
   - Replace singleton with factory pattern
   - Lazy initialization on first use
   - Client recreation when environment changes
   - Maintain same export signature for backward compatibility

2. **Create client lifecycle management**:
   - `initializeSupabaseClient()`: Initialize/reinitialize client
   - `getSupabaseClient()`: Get current client instance
   - `reconnectSupabase()`: Force reconnection with new environment
   - Event emission when client changes (for React components)

3. **Migration strategy**:
   - Preserve existing `supabase` export for compatibility
   - Add new `getSupabaseClient()` for explicit usage
   - Update critical services to use new pattern
   - Deprecation warnings for old usage (dev mode only)

4. **Services to update**:
   - `src/services/auth.ts`: Authentication service
   - `src/services/database.ts`: Database operations
   - `src/redux/api/`: RTK Query endpoints

**Acceptance Criteria**:
- ✅ Client recreates correctly when environment changes
- ✅ Backward compatibility maintained with existing code
- ✅ No memory leaks from old client instances
- ✅ All existing tests still pass
- ✅ New tests for client lifecycle
- ✅ TypeScript compiles without errors

**Files to Modify**:
- `src/services/supabase.ts` (refactor)

**Files to Create**:
- `src/services/__tests__/supabase-environment-switching.test.ts`

**Files to Read First**:
- `src/services/supabase.ts` (current implementation)
- `src/services/auth.ts` (understand usage patterns)
- `src/redux/api/authApi.ts` (understand RTK Query usage)

---

### **Track B: UI Components** (User Interface Layer)

#### **Task 2.1: Developer Settings Screen**
**Status**: 🔴 Not Started
**Priority**: P1 (Important)
**Agent**: `mobile-dev`
**Estimated Time**: 2 hours
**Dependencies**: None (can use mock data initially)
**Parallel With**: Tasks 1.1, 3.1

**Objective**: Create developer settings screen for environment switching

**Context**:
- Only visible in development builds
- Uses React Native Paper components (existing in `package.json`)
- Should match existing app design patterns
- Requires app restart after environment change

**Implementation Requirements**:

1. **Create `src/screens/DeveloperSettingsScreen.tsx`**:
   - Radio button group for environment selection
   - Display current environment with visual indicator
   - Show environment details (URL, description)
   - Connection status indicator for each environment
   - "Apply & Restart" button (uses Expo Updates or manual restart prompt)
   - Loading states during environment switch

2. **UI/UX Design**:
   - Use `react-native-paper` RadioButton component
   - Visual indicators: 🟢 Connected, 🟡 Testing, 🔴 Not Available
   - Current environment highlighted
   - Disabled state for non-development builds
   - Warning message about app restart requirement

3. **Integration with EnvironmentManager**:
   - Use `useSupabaseEnvironment()` hook
   - Use `useCanSwitchEnvironment()` for permission check
   - Call `setEnvironment()` on selection
   - Handle loading/error states

4. **Test connection feature**:
   - "Test Connection" button for each environment
   - Attempt basic Supabase query
   - Show success/failure status

**Acceptance Criteria**:
- ✅ Screen renders correctly in development builds
- ✅ Screen shows "Not Available" in production builds
- ✅ Environment selection works correctly
- ✅ Connection test provides accurate feedback
- ✅ App restart prompt works
- ✅ Component tests with React Testing Library

**Files to Create**:
- `src/screens/DeveloperSettingsScreen.tsx`
- `src/screens/__tests__/DeveloperSettingsScreen.test.tsx`

**Files to Read First**:
- `src/screens/` (understand existing screen patterns)
- Existing Paper component usage examples

---

#### **Task 2.2: Navigation Integration**
**Status**: 🔴 Not Started
**Priority**: P2 (Nice to Have)
**Agent**: `mobile-dev`
**Estimated Time**: 1 hour
**Dependencies**: Task 2.1

**Objective**: Integrate Developer Settings screen into navigation

**Context**:
- React Navigation setup in `src/navigation/`
- Bottom tabs navigation in `src/navigation/BottomTabs.tsx`
- Should be accessible but not prominent
- Only show in development builds

**Implementation Requirements**:

1. **Add to navigation stack**:
   - Create separate developer stack navigator
   - Add to main navigator conditionally (dev builds only)
   - Access via hidden gesture or debug menu

2. **Access methods** (choose one or combine):
   - **Option A**: Hidden tab in BottomTabs (dev only)
   - **Option B**: Shake gesture detector
   - **Option C**: Long press on settings icon
   - **Option D**: Triple-tap on app logo

3. **Navigation updates**:
   - Update navigation types
   - Add route parameters if needed
   - Test navigation flow

**Acceptance Criteria**:
- ✅ Developer Settings accessible in dev builds
- ✅ Not visible/accessible in production builds
- ✅ Navigation flow works correctly
- ✅ TypeScript navigation types updated

**Files to Modify**:
- `src/navigation/index.tsx` or relevant navigator
- Navigation type definitions

**Files to Read First**:
- `src/navigation/index.tsx`
- `src/navigation/BottomTabs.tsx`

---

### **Track C: Type Synchronization & CI/CD** (Tooling Layer)

#### **Task 3.1: Type Synchronization Scripts**
**Status**: 🔴 Not Started
**Priority**: P0 (Critical Path)
**Agent**: `devops-deployment-architect`
**Estimated Time**: 1.5 hours
**Dependencies**: None
**Parallel With**: Tasks 1.1, 2.1

**Objective**: Create npm scripts and shell scripts for type generation from multiple environments

**Context**:
- Current `types:local` script in `package.json` line 28 generates from local
- Need additional scripts for cloud environments
- Backend repo location: `~/dev/wildlifeai/wildlife-watcher-backend`
- GitHub Actions deployment in `.github/workflows/build.yml`

**Implementation Requirements**:

1. **Add npm scripts to `package.json`**:
   ```json
   {
     "scripts": {
       "types:local": "existing script (keep)",
       "types:cloud-dev": "script to generate from cloud-dev",
       "types:cloud-prod": "script to generate from cloud-prod (future)",
       "types:check-local": "existing script (keep)",
       "types:check-cloud-dev": "script to check cloud-dev alignment",
       "types:check-cloud-prod": "script to check cloud-prod alignment",
       "validate:local": "existing script (keep)",
       "validate:cloud-dev": "types:check-cloud-dev && type-check && test",
       "prebuild:preview": "validate:cloud-dev",
       "prebuild:production": "validate:cloud-prod"
     }
   }
   ```

2. **Create shell scripts**:
   - `scripts/generate-types-cloud.sh`: Generate from linked cloud instance
   - `scripts/check-types-cloud.sh`: Validate cloud type alignment
   - `scripts/switch-supabase-instance.sh`: Helper to switch Supabase link

3. **Supabase CLI integration**:
   - Use `supabase gen types typescript --linked` for cloud types
   - Ensure Supabase CLI authenticated to correct project
   - Handle multiple project links (dev vs prod)

4. **Error handling**:
   - Check Supabase CLI installed
   - Validate project linked
   - Handle network failures gracefully
   - Clear error messages for developers

**Acceptance Criteria**:
- ✅ All npm scripts work correctly
- ✅ Shell scripts have proper error handling
- ✅ Scripts work in both local and CI environments
- ✅ Clear documentation in script comments
- ✅ Executable permissions set correctly

**Files to Modify**:
- `package.json` (add scripts)

**Files to Create**:
- `scripts/generate-types-cloud.sh`
- `scripts/check-types-cloud.sh`
- `scripts/switch-supabase-instance.sh`

**Files to Read First**:
- `package.json` (understand current scripts)
- `scripts/check-types-local.sh` (understand existing pattern)
- `.github/workflows/type-validation.yml` (CI integration)

---

#### **Task 3.2: GitHub Actions Cloud Type Validation**
**Status**: 🔴 Not Started
**Priority**: P1 (Important)
**Agent**: `devops-deployment-architect`
**Estimated Time**: 2 hours
**Dependencies**: Task 3.1

**Objective**: Update GitHub Actions to validate type alignment for cloud deployments

**Context**:
- Existing `type-validation.yml` validates local types
- Need separate workflow for cloud type validation
- `build.yml` workflow should include type validation
- Prevent deployments with stale cloud types

**Implementation Requirements**:

1. **Create `.github/workflows/cloud-type-validation.yml`**:
   - Trigger on: Pull requests to main, manual dispatch
   - Authenticate to Supabase cloud project
   - Generate types from cloud instance
   - Compare with committed types
   - Fail if mismatch detected

2. **Update `.github/workflows/build.yml`**:
   - Add type validation step before build
   - Use cloud instance for preview/production builds
   - Block build if types out of sync
   - Add pre-build type check

3. **Supabase authentication in CI**:
   - Use GitHub secrets for Supabase credentials
   - Configure `supabase link` with project ref
   - Handle authentication errors

4. **Workflow optimization**:
   - Cache Supabase CLI installation
   - Parallel execution where possible
   - Clear error messages in workflow logs

**Acceptance Criteria**:
- ✅ Cloud type validation workflow runs successfully
- ✅ Build workflow includes type validation
- ✅ Workflow fails correctly on type mismatch
- ✅ GitHub secrets properly configured
- ✅ Workflow logs are clear and actionable

**Files to Create**:
- `.github/workflows/cloud-type-validation.yml`

**Files to Modify**:
- `.github/workflows/build.yml`

**Files to Read First**:
- `.github/workflows/type-validation.yml` (existing pattern)
- `.github/workflows/build.yml` (understand build process)

---

#### **Task 3.3: Environment-Aware Pre-Commit Hook**
**Status**: 🔴 Not Started
**Priority**: P2 (Nice to Have)
**Agent**: `devops-deployment-architect`
**Estimated Time**: 1 hour
**Dependencies**: Task 3.1

**Objective**: Update pre-commit hook to validate types based on commit context

**Context**:
- Current pre-commit hook validates local types only
- Need smart detection of local vs cloud commits
- Should not block local development unnecessarily

**Implementation Requirements**:

1. **Update `.git/hooks/pre-commit`**:
   - Detect commit context (local dev vs cloud deployment)
   - Check for environment-specific indicators in commit message
   - Validate against appropriate Supabase instance
   - Allow override with flag for emergency commits

2. **Detection logic**:
   - Check commit message for keywords: "cloud", "preview", "production"
   - Check if types were modified in staging area
   - Default to local validation for safety

3. **User feedback**:
   - Clear messages about which validation is running
   - Suggest correct command if validation fails
   - Show how to override if necessary

**Acceptance Criteria**:
- ✅ Hook detects commit context correctly
- ✅ Validates against appropriate instance
- ✅ Clear error messages guide developers
- ✅ Override mechanism works for emergency commits

**Files to Modify**:
- `.git/hooks/pre-commit` (if exists)

**Files to Create**:
- `scripts/pre-commit-hook.sh` (template)

**Files to Read First**:
- `.git/hooks/pre-commit` (current implementation)

---

### **Track D: Integration & Documentation** (Final Phase)

#### **Task 4: Integration Testing**
**Status**: 🔴 Not Started
**Priority**: P0 (Critical Path)
**Agent**: `quality-assurance-engineer`
**Estimated Time**: 3 hours
**Dependencies**: Tasks 1.3, 2.2, 3.3

**Objective**: Comprehensive integration testing of entire environment switching system

**Context**:
- All components must work together seamlessly
- Test real environment switches with actual Supabase instances
- Verify type alignment for each environment
- Test on both iOS and Android if possible

**Implementation Requirements**:

1. **Manual testing scenarios**:
   - **Scenario A: Local Development**:
     - Fresh app install
     - Default to local environment
     - Connect to localhost Supabase
     - Verify database operations work
     - Test offline sync

   - **Scenario B: Environment Switching**:
     - Switch from local to cloud-dev
     - App restart prompt appears
     - After restart, connected to cloud-dev
     - Verify authentication works
     - Verify data operations work

   - **Scenario C: Preview Build**:
     - Build preview profile
     - Verify fixed to cloud-dev
     - Developer settings not accessible
     - Type alignment correct

   - **Scenario D: Type Synchronization**:
     - Backend schema change locally
     - Run `npm run types:local`
     - Verify types updated
     - Backend deploys to cloud
     - Run `npm run types:cloud-dev`
     - Verify types updated differently

2. **Automated integration tests**:
   - Create E2E test suite (Maestro or Detox)
   - Test environment switching flow
   - Test type validation scripts
   - Test GitHub Actions workflows

3. **Device testing**:
   - Test on Android physical device
   - Test on iOS simulator (if macOS available)
   - Test local network connectivity (WSL → device)
   - Test cloud connectivity

4. **Error scenario testing**:
   - Invalid environment selection
   - Network failures during environment switch
   - Supabase instance unavailable
   - Type validation failures

**Acceptance Criteria**:
- ✅ All manual scenarios pass successfully
- ✅ Automated E2E tests pass
- ✅ No crashes or errors during environment switching
- ✅ Type synchronization works for all environments
- ✅ GitHub Actions workflows pass
- ✅ Device testing successful on Android

**Files to Create**:
- `tests/integration/environment-switching.test.ts`
- `tests/maestro/environment-switching.yaml` (E2E test)
- `project-context/development-context/MVP2/implementation/execution/ENVIRONMENT-SWITCHING-TEST-RESULTS.md`

---

#### **Task 5: Documentation Update**
**Status**: 🔴 Not Started
**Priority**: P1 (Important)
**Agent**: `docs-maintainer`
**Estimated Time**: 2 hours
**Dependencies**: Task 4

**Objective**: Update all project documentation to reflect new environment switching system

**Context**:
- CLAUDE.md needs major updates
- Type synchronization guides need cloud workflow
- Developer onboarding docs need updates

**Implementation Requirements**:

1. **Update `CLAUDE.md`**:
   - Add Runtime Environment Switching section
   - Update Type Synchronization section with cloud workflows
   - Update Development Workflow section
   - Add troubleshooting for environment switching

2. **Update type synchronization docs**:
   - `local-dev-sync-workflow.md`: Add cloud sync workflows
   - `Backend-Mobile-Type-Synchronization-Guide.md`: Add environment context
   - Create new guide: `multi-environment-type-sync-guide.md`

3. **Update quick reference sections**:
   - npm scripts reference
   - Environment switching quick start
   - Troubleshooting common issues

4. **Create visual diagrams**:
   - Environment switching workflow diagram
   - Type synchronization flow for each environment
   - Build profile to environment mapping

**Acceptance Criteria**:
- ✅ All documentation updated and accurate
- ✅ No outdated information remains
- ✅ Clear examples for all workflows
- ✅ Visual diagrams included
- ✅ Cross-references between docs correct

**Files to Modify**:
- `CLAUDE.md`
- `project-context/development-context/MVP2/implementation/execution/cross-project-coordination/protocols/type-synchronization/local-dev-sync-workflow.md`
- `project-context/development-context/MVP2/implementation/execution/cross-project-coordination/protocols/type-synchronization/Backend-Mobile-Type-Synchronization-Guide.md`

**Files to Create**:
- `project-context/development-context/MVP2/implementation/execution/cross-project-coordination/protocols/type-synchronization/multi-environment-type-sync-guide.md`

---

#### **Task 6: Developer Workflow Guide**
**Status**: 🔴 Not Started
**Priority**: P1 (Important)
**Agent**: `docs-maintainer`
**Estimated Time**: 1.5 hours
**Dependencies**: Task 5

**Objective**: Create comprehensive developer workflow guide for new system

**Context**:
- New developers need clear onboarding
- Existing patterns have changed significantly
- Need to cover all common scenarios

**Implementation Requirements**:

1. **Create workflow guide**:
   - Daily development workflow
   - Feature completion → preview build workflow
   - Production deployment workflow
   - Troubleshooting guide

2. **Include practical examples**:
   - "Your first day" walkthrough
   - "Preparing for stakeholder demo" scenario
   - "Emergency hotfix" scenario
   - "Backend schema changed" scenario

3. **Video/GIF demonstrations** (optional):
   - Environment switching in app
   - Type synchronization commands
   - Preview build creation

4. **Common pitfalls section**:
   - Forgetting to switch environment
   - Types out of sync
   - WSL networking issues
   - Cloud deployment timing

**Acceptance Criteria**:
- ✅ Complete workflow guide created
- ✅ All common scenarios covered
- ✅ Clear, actionable steps
- ✅ Troubleshooting section comprehensive

**Files to Create**:
- `project-context/development-context/MVP2/implementation/execution/DEVELOPER-WORKFLOW-MULTI-ENVIRONMENT.md`
- `project-context/development-context/MVP2/implementation/execution/TROUBLESHOOTING-ENVIRONMENT-SWITCHING.md`

---

## 📊 Progress Tracking

### Task Status Legend
- 🔴 Not Started
- 🟡 In Progress
- 🟢 Completed
- ⏸️ Blocked
- ❌ Failed/Cancelled

### Progress Summary
**Last Updated**: 2025-10-29

| Track | Tasks | Completed | In Progress | Not Started | Blocked |
|-------|-------|-----------|-------------|-------------|---------|
| **Track A: Infrastructure** | 3 | 0 | 0 | 3 | 0 |
| **Track B: UI Components** | 2 | 0 | 0 | 2 | 0 |
| **Track C: Type Sync & CI/CD** | 3 | 0 | 0 | 3 | 0 |
| **Track D: Integration & Docs** | 3 | 0 | 0 | 3 | 0 |
| **TOTAL** | **11** | **0** | **0** | **11** | **0** |

**Overall Progress**: 0% (0/11 tasks completed)

---

## 🚀 Execution Checklist

### Pre-Execution Validation
- [ ] Supabase local instance running (`supabase start`)
- [ ] Backend repo pulled and up to date
- [ ] Mobile repo on clean branch
- [ ] Node modules installed (`npm install`)
- [ ] Existing tests passing (`npm test`)

### Parallel Execution: Phase 1 (Can run simultaneously)
- [ ] **Task 1.1**: Environment Configuration System (backend-architect)
- [ ] **Task 2.1**: Developer Settings Screen (mobile-dev)
- [ ] **Task 3.1**: Type Synchronization Scripts (devops-deployment-architect)

### Sequential Execution: Phase 2 (After Phase 1)
- [ ] **Task 1.2**: Environment Manager (backend-architect) [Depends: 1.1]
- [ ] **Task 3.2**: GitHub Actions Updates (devops-deployment-architect) [Depends: 3.1]
- [ ] **Task 3.3**: Pre-Commit Hook (devops-deployment-architect) [Depends: 3.1]

### Sequential Execution: Phase 3 (After Phase 2)
- [ ] **Task 1.3**: Refactor Supabase Client (backend-architect) [Depends: 1.2]
- [ ] **Task 2.2**: Navigation Integration (mobile-dev) [Depends: 2.1]

### Final Phase: Integration & Documentation
- [ ] **Task 4**: Integration Testing (quality-assurance-engineer) [Depends: 1.3, 2.2, 3.3]
- [ ] **Task 5**: Documentation Update (docs-maintainer) [Depends: 4]
- [ ] **Task 6**: Developer Workflow Guide (docs-maintainer) [Depends: 5]

---

## 🎯 Next Actions

### Immediate Next Steps
1. **Read this entire document** to understand scope and dependencies
2. **Execute Phase 1 tasks in parallel** (Tasks 1.1, 2.1, 3.1)
3. **Validate each task** before proceeding to next phase
4. **Update progress tracking** as tasks complete
5. **Test continuously** throughout implementation

### Success Metrics
- [ ] All 11 tasks completed successfully
- [ ] Zero regression in existing functionality
- [ ] Type synchronization working for all environments
- [ ] Developer can switch environments in < 10 seconds
- [ ] Preview builds connect to correct cloud instance
- [ ] GitHub Actions validate cloud types
- [ ] Complete documentation updated

---

## 📝 Notes & Decisions

### Architectural Decisions
1. **Runtime switching preferred** over multiple builds (faster developer feedback)
2. **Factory pattern** for Supabase client (enables dynamic reconfiguration)
3. **AsyncStorage persistence** (survives app restarts)
4. **Development builds only** for switching (production fixed to cloud-prod)

### Technical Constraints
- WSL networking requires IP address instead of localhost for device testing
- Supabase client requires full recreation on environment change
- GitHub Actions needs separate workflow for cloud validation
- Pre-commit hook cannot validate cloud types without network access

### Risk Mitigation
- Maintain backward compatibility throughout refactor
- Comprehensive testing before merging to main
- Rollback plan: Keep old supabase.ts in git history
- Gradual rollout: Feature flag for environment switching

### Future Enhancements
- [ ] Automatic IP detection for WSL local environment
- [ ] Connection health monitoring
- [ ] Environment switch without app restart (technical challenge)
- [ ] Multi-user environment preferences (team coordination)

---

## 🆘 Troubleshooting

### Common Issues During Implementation

**Issue**: WSL localhost not accessible from physical device
**Solution**: Use Windows host IP (check `ipconfig` from Windows terminal), update environment config

**Issue**: Supabase client singleton causes state issues
**Solution**: Ensure proper client recreation, clear React Query cache on environment change

**Issue**: AsyncStorage fails silently
**Solution**: Add error handling, fallback to in-memory storage for tests

**Issue**: GitHub Actions can't authenticate to Supabase
**Solution**: Add `SUPABASE_ACCESS_TOKEN` to GitHub secrets, configure `supabase link`

**Issue**: Types differ between local and cloud unexpectedly
**Solution**: Verify migrations applied to both instances, check migration order

---

## 📞 Support & Communication

### Questions & Blockers
- **Technical Questions**: Review documentation first, then ask in chat
- **Blockers**: Document in this file under task status
- **Architectural Decisions**: Discuss before implementation

### Collaboration
- This document is the **single source of truth** for implementation status
- Update task status in real-time as you work
- Add notes/discoveries to relevant task sections
- Flag blockers immediately

---

**Document Version**: 1.0
**Last Updated**: 2025-10-29
**Status**: ✅ Ready for Execution
