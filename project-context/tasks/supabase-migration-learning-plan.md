# Wildlife Watcher → Supabase Integration: Learning-First Hybrid Approach

## Overview
A low-disruption, incremental migration that prioritizes learning and testing. Each phase builds understanding and confidence before proceeding to the next step.

**Migration Strategy**: Hybrid approach keeping RTK Query structure while updating to use Supabase's auto-generated REST API
**Focus**: Learning-first with small, testable steps
**Risk Level**: Low (incremental, reversible changes)

## Phase 0: Learning & Setup (2-3 hours)
**Goal**: Get comfortable with Claude Code, understand the current app, and test basic Supabase connectivity

### Step 0.1: Environment Familiarization (30 minutes)
- Walk through current app structure together
- Test running the current app (`npm start`, `npm run android/ios`)
- Verify current development workflow
- Learn Claude Code tool usage and file editing patterns

### Step 0.2: Supabase Connection Test (45 minutes)
- Install ONLY Supabase client: `npm install @supabase/supabase-js`
- Copy generated types to `src/types/supabase.ts`
- Create minimal Supabase client setup in isolated test file
- Test basic connection to your Supabase project
- Verify we can query one table (like `projects`) successfully

### Step 0.3: Single Endpoint Experiment (45 minutes)
- Create ONE new API function using Supabase directly
- Test it in isolation without affecting existing code
- Compare results with expected data structure
- Document learnings and any issues discovered

**Success Criteria**: 
- App still runs normally
- Can successfully connect to Supabase
- Retrieved real data from database
- Understood the development workflow with Claude Code

## Phase 1: Foundation Setup (1-2 hours)
**Goal**: Set up core Supabase integration without breaking existing functionality

### Step 1.1: Environment Configuration (30 minutes)
- Add Supabase environment variables to react-native-config
- Update TypeScript config for new environment variables
- Test environment variable access in app

### Step 1.2: Create Type Bridge System (45 minutes)
- Create adapter functions for ONE entity (projects)
- Map between current app types and Supabase types
- Test adapter functions in isolation
- Document field mapping differences

### Step 1.3: Parallel API Setup (30 minutes)
- Create new Supabase-based API functions alongside existing RTK Query
- Don't replace anything yet - just add parallel options
- Test both systems work independently

**Success Criteria**:
- Environment variables working
- Type adapters converting data correctly
- Both old and new API systems functional

## Phase 2: Single Entity Migration (2-3 hours)
**Goal**: Completely migrate ONE entity (projects) as proof of concept

### Step 2.1: Projects API Migration (90 minutes)
- Replace ONLY the projects RTK Query endpoints with Supabase
- Update base URL to point to Supabase REST API
- Add proper authentication headers for Supabase
- Test all CRUD operations for projects

### Step 2.2: Component Testing (30 minutes)
- Test project-related screens and components
- Verify data loads, creates, updates, deletes correctly
- Check for any breaking changes in UI
- Document any issues and solutions

### Step 2.3: Error Handling & Loading States (30 minutes)
- Ensure error handling works with Supabase responses
- Verify loading states still function properly
- Test edge cases (network errors, invalid data, etc.)

**Success Criteria**:
- Projects functionality works end-to-end
- No regressions in user experience
- Error handling and loading states working
- Data persistence verified

## Phase 3: Authentication Migration (2-3 hours)
**Goal**: Replace custom auth with Supabase Auth

### Step 3.1: Supabase Auth Setup (60 minutes)
- Configure Supabase Auth in client
- Create auth helper functions (login, register, logout)
- Test authentication flow in isolation

### Step 3.2: Redux Auth Integration (60 minutes)
- Update Redux auth slice to use Supabase Auth
- Replace login/register endpoints
- Test user session management

### Step 3.3: Security Testing (30 minutes)
- Verify RLS policies work with authenticated users
- Test data isolation between different users
- Confirm unauthorized access is blocked

**Success Criteria**:
- Users can login/register through Supabase
- User sessions persist correctly
- RLS security working as expected
- No unauthorized data access possible

## Phase 4: Remaining Entities (3-4 hours)
**Goal**: Apply learnings to migrate remaining entities

### Step 4.1: Deployments Migration (90 minutes)
- Apply same pattern used for projects
- Handle geographic data (latitude/longitude)
- Test device relationships

### Step 4.2: Devices & Users Migration (90 minutes)
- Migrate remaining core entities
- Test relationships between entities
- Verify data consistency

### Step 4.3: Lookup Tables (30 minutes)
- Migrate simple lookup tables (roles, capture_methods, etc.)
- Test dropdown/picker components

**Success Criteria**:
- All major app functionality working
- Data relationships intact
- UI components functioning normally

## Phase 5: Cleanup & Optimization (1-2 hours)
**Goal**: Remove old code and optimize the implementation

### Step 5.1: Legacy Code Removal (45 minutes)
- Remove old RTK Query endpoints
- Clean up unused type definitions
- Remove old API URL constants

### Step 5.2: Performance Testing (30 minutes)
- Test app performance with Supabase
- Verify caching still works effectively
- Check for any performance regressions

### Step 5.3: Documentation & Testing (30 minutes)
- Document the new architecture
- Create simple tests for critical paths
- Update development documentation

## Learning Support Features

### After Each Phase:
1. **Checkpoint Review**: Discuss what was learned
2. **Issue Documentation**: Record any problems and solutions
3. **Rollback Plan**: Ensure we can revert if needed
4. **Progress Verification**: Test that everything still works

### Safety Measures:
- Work in feature branch (not main branch)
- Commit after each successful step
- Keep old code commented out (not deleted) until confirmed working
- Test thoroughly before proceeding to next phase

### Learning Tools:
- Explain each change as we make it
- Show before/after code comparisons
- Test each change immediately
- Document patterns for future reference

## Critical Schema Mappings

### Projects Table
```typescript
// Current App Type → Supabase Type
title → name
acronym → (not in Supabase - will remove)
projectPrivacy → is_private (string → boolean)
samplingDesign → sampling_design (camelCase → snake_case)
captureMethod → (not in Supabase - stored in deployments)
```

### Deployments Table
```typescript
// Current App Type → Supabase Type
deploymentID → id (remove duplicate)
projectID → project_id (camelCase → snake_case)
setupBy → user_id (rename for clarity)
deviceID → device_id (camelCase → snake_case)
```

### Authentication
```typescript
// Current Auth → Supabase Auth
Custom JWT → Supabase Auth JWT
Custom user fields → Supabase User + Profile
```

## Supabase Configuration Details

### Environment Variables Needed:
```
SUPABASE_URL=https://nuhwmubvygxyddkycmpa.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_KEY=<your-service-key> (server-side only)
```

### Supabase Client Setup:
```typescript
import { createClient } from '@supabase/supabase-js'
import { Database } from './types/supabase'

const supabaseUrl = 'https://nuhwmubvygxyddkycmpa.supabase.co'
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

### RTK Query Base URL Update:
```typescript
// From: Custom REST API
baseUrl: Config.API_BASE

// To: Supabase REST API
baseUrl: 'https://nuhwmubvygxyddkycmpa.supabase.co/rest/v1'
```

## Risk Mitigation

### Low Risk Factors:
- Each phase is small and testable
- Can rollback any step if issues arise
- No big-bang changes - incremental approach
- Existing app functionality preserved during migration

### Safety Nets:
- Work in feature branch
- Commit after each successful step
- Keep old code commented out until confirmed working
- Test thoroughly before proceeding

### Rollback Strategy:
- Git branch for each phase
- Ability to revert to previous working state
- Old code preserved until migration complete
- Database rollback plan if needed

## Success Metrics

### Technical Success:
- All app functionality working with Supabase
- No performance regressions
- Type safety maintained
- Security (RLS) working correctly

### Learning Success:
- Understanding of Supabase concepts
- Comfort with migration patterns
- Ability to make similar changes independently
- Confidence in the new architecture

### Business Success:
- No user-facing disruption
- Improved security through RLS
- Simplified architecture (no custom backend needed)
- Foundation for future features

## Estimated Timeline

**Total Time: 10-15 hours**
- Phase 0: 2-3 hours (Learning & Setup)
- Phase 1: 1-2 hours (Foundation)
- Phase 2: 2-3 hours (Single Entity)
- Phase 3: 2-3 hours (Authentication)
- Phase 4: 3-4 hours (Remaining Entities)
- Phase 5: 1-2 hours (Cleanup)

**Approach**: Learn → Test → Verify → Proceed
**Flexibility**: Can pause/resume at any phase boundary
**Learning Focus**: Understanding over speed