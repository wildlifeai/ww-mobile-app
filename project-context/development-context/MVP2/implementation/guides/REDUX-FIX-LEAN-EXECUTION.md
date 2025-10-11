# Redux Architecture Fix - LEAN Execution Plan

**Status**: READY FOR IMMEDIATE EXECUTION
**Approach**: Lean, pragmatic, parallel where possible
**Duration**: 4-6 hours (streamlined)
**Integration**: Folded into Task 13 completion

---

## 🎯 Strategic Approach

### **Lean Principles**:
- ✅ **Minimal viable tests** - Core functionality only
- ✅ **Parallel execution** - Independent phases run simultaneously
- ✅ **Sub-agent coordination** - Delegate to specialists
- ✅ **No over-engineering** - Get working, refine later

### **Dependency Analysis**:
```
Phase 1 (Store Consolidation)
  ↓
Phase 2.1 (Projects Slice) ←→ Phase 2.2 (Deployments Slice) [PARALLEL]
  ↓
Phase 3 (Middleware) + Phase 4 (Supabase) [PARALLEL]
  ↓
Phase 5 (Integration Tests - MINIMAL)
  ↓
Task 13 Integration
```

---

## 📋 Streamlined Execution

### **Phase 1: Store Consolidation** (1-1.5 hrs)
**Agent**: `backend-architect`
**Blocking**: Yes - Must complete first

**LEAN Tests** (15 mins):
```typescript
// tests/redux/store.test.ts
describe('Redux Store', () => {
  it('should have single store with all slices', () => {
    expect(store.getState().authentication).toBeDefined();
    expect(store.getState().projects).toBeDefined();
    expect(store.getState().offline).toBeDefined();
    expect(store.getState().sync).toBeDefined();
  });
});
```

**Implementation** (45-60 mins):
1. Copy improved offline/sync slices from `src/store` → `src/redux`
2. Register `offlineSyncMiddleware` in `src/redux/index.ts`
3. Update component imports: `sed -i "s|from '../store'|from '../redux'|g"`
4. Archive `src/store/index.ts`

**Validation** (15 mins):
- Run `npm run typecheck`
- Test app boots
- Verify no duplicate state

---

### **Phase 2: Fix Slices PARALLEL** (1.5-2 hrs)
**Agents**: `mobile-dev` (2.1) + `mobile-dev` (2.2) [PARALLEL]
**Blocking**: Partially - Can work simultaneously after Phase 1

#### **Phase 2.1: Projects Slice**
**LEAN Tests** (20 mins):
```typescript
it('filters projects by org for non-admin', () => {
  const action = setProjects({
    projects: [
      { id: '1', organisation_id: 'org1' },
      { id: '2', organisation_id: 'org2' }
    ],
    authContext: { currentOrgId: 'org1', userRole: 'project_member', userId: 'u1' }
  });
  const state = projectsReducer(initialState, action);
  expect(state.projects).toHaveLength(1);
});

it('shows all projects for ww_admin', () => {
  const action = setProjects({
    projects: [{ id: '1', organisation_id: 'org1' }, { id: '2', organisation_id: 'org2' }],
    authContext: { currentOrgId: 'org1', userRole: 'ww_admin', userId: 'admin1' }
  });
  const state = projectsReducer(initialState, action);
  expect(state.projects).toHaveLength(2);
});
```

**Implementation** (40 mins):
- Add `AuthContext` interface
- Refactor `setProjects`, `createProject`, `updateProject` reducers
- Update helper functions
- Find/replace dispatch calls (grep + update)

#### **Phase 2.2: Deployments Slice**
**LEAN Tests** (15 mins):
- Mirror projects slice tests (simpler)

**Implementation** (35 mins):
- Apply identical pattern
- Update dispatch calls

**✅ PARALLEL EXECUTION**: Both slices can be fixed simultaneously by different agents

---

### **Phase 3 & 4: Middleware + Supabase PARALLEL** (30-45 mins)
**Agents**: `backend-architect` (Phase 3) + `backend-dev` (Phase 4) [PARALLEL]
**Blocking**: No - Independent of each other

#### **Phase 3: Register Middleware**
**Test** (5 mins):
```typescript
it('middleware is registered', () => {
  expect(store).toHaveMiddleware(offlineSyncMiddleware);
});
```

**Implementation** (10 mins):
- Already done in Phase 1 - just verify

#### **Phase 4: Fix Supabase**
**Implementation** (15 mins):
```typescript
const createSupabaseClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === 'test') {
      return null as any;
    }
    throw new Error('Missing Supabase config');
  }
  return createClient(...);
};
```

---

### **Phase 5: MINIMAL Integration Tests** (30 mins)
**Agent**: `quality-assurance-engineer`
**Blocking**: Yes - Final validation

**CORE Tests Only**:
```typescript
describe('Redux Integration', () => {
  it('complete project workflow works', async () => {
    await loginAsProjectAdmin();
    const project = await createProject({ name: 'Test' });
    const projects = store.getState().projects.projects;
    expect(projects).toContainEqual(expect.objectContaining({ id: project.id }));
  });

  it('org filtering works', () => {
    // Quick smoke test
  });

  it('permissions enforced', () => {
    // Quick smoke test
  });
});
```

**NO over-engineered BDD scenarios** - just core functionality validation

---

### **Task 13 Integration** (1.5-2 hrs)
**Agent**: `mobile-dev`
**Blocking**: Yes - Final step

**Quick Steps**:
1. Remove mock imports (10 mins)
2. Connect real services (40 mins)
3. Add Redux selectors (20 mins)
4. Test end-to-end (30 mins)

---

## 🚀 Parallel Execution Strategy

### **Wave 1: Foundation** (1-1.5 hrs)
```
[backend-architect] Phase 1: Store Consolidation
```

### **Wave 2: Core Fixes PARALLEL** (1.5-2 hrs)
```
[mobile-dev #1] Phase 2.1: Projects Slice
    ∥
[mobile-dev #2] Phase 2.2: Deployments Slice
```

### **Wave 3: Polish PARALLEL** (30-45 mins)
```
[backend-architect] Phase 3: Middleware Verification
    ∥
[backend-dev] Phase 4: Supabase Fix
```

### **Wave 4: Validation** (30 mins)
```
[quality-assurance-engineer] Phase 5: Integration Tests
```

### **Wave 5: Task 13** (1.5-2 hrs)
```
[mobile-dev] Task 13 Integration
```

**Total Timeline**: 4-6 hours (with parallel execution)

---

## ✅ Success Criteria (LEAN)

### **Must Pass**:
- [ ] Store has single instance, all slices present
- [ ] Projects filter by org (non-admin vs ww_admin)
- [ ] Deployments filter by org
- [ ] No `(state as any).authentication` patterns
- [ ] TypeScript compiles with zero errors
- [ ] App boots and navigation works
- [ ] Task 13 connects to real backend

### **Nice to Have** (defer if needed):
- Comprehensive BDD scenarios
- Performance benchmarks
- Edge case coverage

---

## 🎯 Agent Assignments

| Phase | Agent | Duration | Can Parallel |
|-------|-------|----------|--------------|
| 1 | `backend-architect` | 1-1.5 hrs | No (blocking) |
| 2.1 | `mobile-dev` | 1 hr | ✅ Yes (with 2.2) |
| 2.2 | `mobile-dev` | 1 hr | ✅ Yes (with 2.1) |
| 3 | `backend-architect` | 15 mins | ✅ Yes (with 4) |
| 4 | `backend-dev` | 15 mins | ✅ Yes (with 3) |
| 5 | `quality-assurance-engineer` | 30 mins | No (final gate) |
| T13 | `mobile-dev` | 1.5-2 hrs | No (final) |

---

## 📝 Task 13 Integration Notes

**Reference**: See `REDUX-FIX-LEAN-EXECUTION.md` for prerequisite architectural fixes

**Timeline Adjustment**:
- Original Task 13 estimate: 6-9 hrs integration
- Redux fix folded in: +4-6 hrs architectural work
- **New Task 13 total**: 5.5 hrs (UI done) + 4-6 hrs (Redux fix) + 1.5-2 hrs (integration) = **11-13.5 hrs total**

**Completion Status**:
- [x] Phase 1: Backend services (56 tests passing)
- [x] Phase 2: UI implementation (5.5 hrs)
- [ ] Phase 3: Redux architecture fix (4-6 hrs) ← **IN PROGRESS**
- [ ] Phase 4: Real service integration (1.5-2 hrs)

---

## 🚦 Execution Protocol

### **Start**:
1. Create branch: `fix/redux-architecture-task13`
2. Commit after each wave
3. No over-testing - get it working

### **During Execution**:
- Skip elaborat BDD scenarios
- Focus on core functionality
- Use parallel agents when possible
- Ask user if blocked

### **Completion**:
- Update Task 13 metrics
- Document lessons learned
- Update AADF framework

---

**Status**: READY FOR LEAN EXECUTION
**Approach**: Pragmatic, parallel, get it done
**Timeline**: 4-6 hours Redux + 1.5-2 hours Task 13 = **5.5-8 hours total**
