TypeScript Error Remediation - Wildlife Watcher Mobile App

  Context

  The Wildlife Watcher mobile app (React Native + Expo SDK 51) currently has ~48 TypeScript compilation errors after removing debug files. These errors are blocking
  production builds and need to be resolved systematically.

  Recent Progress

  - ✅ Debug files removed (commit ae8fb94): EmergencyApp.tsx, ExpoConstantsDebugger.tsx, SimpleApp.tsx, utils/fileSystem.ts
  - ✅ Error count reduced: 57 → ~48 errors
  - ✅ Documentation updated: CODE-REVIEW-REMEDIATION-PLAN.md

  Your Task

  Fix all remaining TypeScript compilation errors in priority order (easiest to hardest):

  Priority 1: Implicit 'any' Types (~30 errors) - ✅ COMPLETED

  Status: COMPLETED ✅
  Actual Time: ~1 hour
  Commit: 07ca314 - fix(types): resolve all implicit 'any' TypeScript errors (Priority 1)

  Fixed all 30 implicit 'any' type errors by adding explicit type annotations:

  **Source Files:**
  - SupabaseConnectivityTest.tsx: RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES
  - redux/api/enhanced/index.ts: RealtimePostgresChangesPayload
  - services/apiTest.ts: Supabase realtime types, Tables
  - services/auth.ts: AuthChangeEvent, Session, Tables (user_organisations, organisations, user_roles)
  - store/middleware/offlineSyncMiddleware.ts: OfflineOperation
  - store/slices/offlineSlice.ts: OfflineOperation

  **Test Files:**
  - airplane-mode.test.ts: OfflineOperation, Tables<'projects'>
  - organisation-isolation.test.ts: Tables<'projects'>
  - auth.test.ts: AuthChangeEvent, Session
  - wwAdminSlice.test.ts: Project

  **Result:**
  - Implicit 'any' errors: 30 → 0 ✅
  - All parameters now have explicit types
  - Enhanced type safety for Supabase realtime callbacks

  ---
  Priority 2: Navigation Parameter Mismatches (~12 errors) - MEDIUM

  Estimated Time: 1.5-2 hours

  Fix navigation type mismatches where screens receive parameters not defined in their type definitions.

  Example errors:
  // src/hooks/useDeepLinking.ts:59,74
  // src/components/TestDeepLink.tsx:13
  // Expected: ForgotPassword has no params
  // Actual: ForgotPassword receives { token, refreshToken, mode }

  Fix Strategy:
  1. Read navigation type definitions in src/navigation/types.ts or src/types/navigation.ts
  2. Update screen parameter types to match actual usage
  3. Or update callers to match defined types (if types are correct)

  Acceptance Criteria:
  - All navigation.navigate() calls match type definitions
  - Screen params properly typed in navigation stack
  - Deep linking navigation types fixed
  - Run npm run type-check to verify fixes

  ---
  Priority 3: AuthResponse Type Conflict (~15 errors) - HARDEST

  Estimated Time: 2-3 hours

  Resolve duplicate AuthResponse type definitions causing conflicts across auth flow.

  Problem:
  // src/redux/api/auth/types.ts
  export interface AuthResponse {
    user: { id, username, email, confirmed, blocked, createdAt, updatedAt }
  }

  // src/redux/slices/authSlice.ts  
  export interface AuthResponse {
    user: User; // Different User with role, organisation_id
  }

  Affected Files (~15 files):
  - src/hooks/useSupabaseAuth.ts:26,36,67
  - src/navigation/screens/Login.tsx:73
  - src/navigation/screens/Register.tsx:64
  - src/providers/AuthProvider.tsx:16,21

  Fix Strategy (Research First):
  1. MANDATORY: Use Context7 to research Supabase auth response patterns
  mcp__context7__resolve-library-id({ libraryName: "@supabase/supabase-js" })
  mcp__context7__get-library-docs({
    context7CompatibleLibraryID: "/resolved/id",
    topic: "authentication response types",
    tokens: 10000
  })
  2. Read both AuthResponse definitions and understand differences
  3. Identify which is canonical (likely the one matching Supabase's actual response)
  4. Create type adapter/transformer if needed, OR merge types
  5. Update all imports to use canonical type
  6. Test auth flow still works

  Acceptance Criteria:
  - Single source of truth for AuthResponse type
  - All auth-related files use consistent type
  - Type transformers in place if needed
  - Zero TypeScript errors related to AuthResponse
  - Auth functionality verified working (login/logout/register)

  ---
  Execution Instructions

  Phase 1: Setup

  # Verify current error count
  npm run type-check 2>&1 | grep -c "error TS"

  # Create feature branch
  git checkout -b fix/typescript-compilation-errors

  Phase 2: Fix in Priority Order

  1. Start with Implicit 'any' Types (quickest wins)
  2. Then Navigation Mismatches (medium difficulty)
  3. Finally AuthResponse Conflict (requires research + careful refactoring)

  Phase 3: Validation

  After each priority:
  # Check error count reduction
  npm run type-check

  # Verify app still runs
  npx expo start --clear

  # Commit progress
  git add .
  git commit -m "fix(types): resolve [category] TypeScript errors

  - Fixed X implicit any types
  - Reduced total errors from Y to Z
  - Files affected: [list]"

  Phase 4: Final Verification

  # Zero TypeScript errors
  npm run type-check  # Should show: Found 0 errors

  # Build succeeds
  npx expo export --platform android

  # Update documentation
  # Edit: project-context/code-review/20251016/CODE-REVIEW-REMEDIATION-PLAN.md
  # Mark CR-1.2 as COMPLETED

  ---
  Important Guidelines

  Evidence-Based Development (CRITICAL)

  - ALWAYS use Context7 for library documentation (proven 10x efficiency)
  - Research Supabase types before making AuthResponse decisions
  - Research React Navigation types if needed
  - Don't assume - verify with official docs

  Quality Standards

  - ✅ Write type-safe code (no any unless absolutely necessary)
  - ✅ Use TypeScript strict mode compatible patterns
  - ✅ Prefer explicit types over inference for public APIs
  - ✅ Test after each phase to ensure no runtime breaks

  Tools Available

  - Context7 MCP: Library documentation (use FIRST for AuthResponse research)
  - Serena MCP: Code analysis and symbol search
  - Claude Code: File operations, TypeScript fixes
  - Specialized Agents:
    - quality-assurance-engineer - Type system expertise
    - react-native-expo-architect - React Native/Expo patterns

  Commit Strategy

  - Commit after each priority phase
  - Use conventional commit format: fix(types): description
  - Reference error counts in commit messages
  - Update CODE-REVIEW-REMEDIATION-PLAN.md when CR-1.2 is complete

  ---
  Reference Documents

  - Remediation Plan: @project-context/code-review/20251016/CODE-REVIEW-REMEDIATION-PLAN.md
  - Debug Analysis: @project-context/code-review/DEBUG-FILES-ANALYSIS.md
  - Code Quality: @project-context/code-review/20251016/code-quality-assessment.md

  ---
  Success Criteria

  - Zero TypeScript compilation errors (npm run type-check passes)
  - Build succeeds (npx expo export --platform android)
  - App runs without runtime errors
  - All changes committed with clear messages
  - Documentation updated (CR-1.2 marked complete)

  Estimated Total Time: 4.5-6.5 hours
  Priority: P0 - BLOCKING (must complete before new feature work)

  ---
  Start with Priority 1 (Implicit 'any' Types) for quick wins!