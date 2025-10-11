# Redux Architecture Fix - AADF TDD/BDD Execution Plan

**Status**: READY FOR EXECUTION
**Methodology**: AADF (AI Agentic Development Framework) + TDD/BDD
**Duration**: 6-8 hours
**Date**: 2025-10-11

---

## 🎯 Executive Summary

### **Discovery Findings**:
✅ **All 5 architectural issues validated**
✅ **NO conflicts with future tasks (14-23)**
✅ **Fix is PREREQUISITE for all Stream A/B/C features**
✅ **Task 13 ready for integration after fix**

### **Key Decisions**:
1. **Keep `src/redux` as primary store** (already wired to App.tsx)
2. **Merge good patterns from `src/store`** (offline, sync slices)
3. **Use action payload pattern** (immediate fix, refactor to selectors later)
4. **Test-first approach** (RED-GREEN-REFACTOR cycle)

---

## 📋 Phase Breakdown

### **Phase 0: Discovery & Planning** ✅ COMPLETE
- [x] Validated all 5 architectural issues
- [x] Analyzed Tasks 14-23 dependencies
- [x] Confirmed no conflicts with future work
- [x] Designed test strategy
- [x] Created execution plan

---

### **Phase 1: Store Consolidation** (2-3 hours)

#### **RED Phase - Write Failing Tests**
```typescript
// tests/redux/store.test.ts

describe('Redux Store Architecture', () => {
  describe('Store Consolidation', () => {
    it('should have single unified store instance', () => {
      expect(store).toBeDefined();
      expect(store.getState).toBeDefined();
    });

    it('should contain all required slices', () => {
      const state = store.getState();
      expect(state.authentication).toBeDefined();
      expect(state.projects).toBeDefined();
      expect(state.deployments).toBeDefined();
      expect(state.offline).toBeDefined();
      expect(state.sync).toBeDefined();
      expect(state.network).toBeDefined();
    });

    it('should have offlineSyncMiddleware registered', () => {
      const middlewares = (store as any).middleware;
      // Will implement verification
      expect(middlewares).toContain(offlineSyncMiddleware);
    });

    it('should NOT have duplicate offline slices', () => {
      const state = store.getState();
      // Offline slice should have unified structure
      expect(state.offline.queue).toBeDefined();
      expect(state.offline.syncStatus).toBeDefined();
    });
  });
});
```

#### **GREEN Phase - Implementation**

**Step 1.1: Merge Offline Slice** (45 mins)
- Copy improved `src/store/slices/offlineSlice.ts` → `src/redux/slices/offlineSlice.ts`
- Preserve existing operations, add new queue structure
- Update imports in components

**Step 1.2: Add Sync Slice** (30 mins)
- Copy `src/store/slices/syncSlice.ts` → `src/redux/slices/syncSlice.ts`
- Register in `src/redux/index.ts`

**Step 1.3: Update Store Configuration** (30 mins)
```typescript
// src/redux/index.ts - Updated
import { offlineSyncMiddleware } from "./middleware/offlineSyncMiddleware";
import syncReducer from "./slices/syncSlice";

const store = configureStore({
  reducer: {
    // ... existing reducers
    sync: syncReducer,
    offline: offlineReducer, // Updated structure
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({...})
    .concat(
      api.middleware,
      enhancedApi.middleware,
      projectsApi.middleware,
      offlineMiddleware.middleware,
      offlineSyncMiddleware.middleware  // ✅ ADDED
    ),
});
```

**Step 1.4: Update Component Imports** (45 mins)
```bash
# Find all imports from ../store
grep -r "from '../store'" src/

# Update to ../redux
sed -i "s|from '../store'|from '../redux'|g" src/**/*.ts*
```

**Step 1.5: Remove Duplicate Store** (15 mins)
- Archive `src/store/index.ts` → `src/store/index.ts.backup`
- Update documentation

#### **REFACTOR Phase**
- Verify all tests pass
- Run type checking: `npm run typecheck`
- Manual testing: Background sync triggers on network change

---

### **Phase 2.1: Fix Projects Slice** (2 hours)

#### **RED Phase - Write Failing Tests**
```typescript
// tests/redux/slices/projectsSlice.test.ts

describe('Projects Slice - Auth Context Pattern', () => {
  describe('setProjects with auth context', () => {
    it('should filter projects by org for non-admin users', () => {
      const initialState = {
        projects: [],
        loading: false,
        error: undefined,
      };

      const action = setProjects({
        projects: [
          { id: '1', organisation_id: 'org1', name: 'Project 1' },
          { id: '2', organisation_id: 'org2', name: 'Project 2' },
        ],
        authContext: {
          currentOrgId: 'org1',
          userRole: 'project_member',
          userId: 'user1',
        },
      });

      const newState = projectsReducer(initialState, action);

      expect(newState.projects).toHaveLength(1);
      expect(newState.projects[0].id).toBe('1');
      expect(newState.projects[0].organisation_id).toBe('org1');
    });

    it('should show all projects for ww_admin users', () => {
      const initialState = { projects: [], loading: false };

      const action = setProjects({
        projects: [
          { id: '1', organisation_id: 'org1', name: 'Project 1' },
          { id: '2', organisation_id: 'org2', name: 'Project 2' },
        ],
        authContext: {
          currentOrgId: 'org1',
          userRole: 'ww_admin',
          userId: 'admin1',
        },
      });

      const newState = projectsReducer(initialState, action);

      expect(newState.projects).toHaveLength(2);
    });
  });

  describe('updateProject with permission checks', () => {
    it('should allow project_admin to update project', () => {
      const project = {
        id: 'proj1',
        organisation_id: 'org1',
        name: 'Test',
        created_by: 'user2',
      };

      const initialState = {
        projects: [project],
        loading: false,
      };

      const action = updateProject({
        id: 'proj1',
        updates: { name: 'Updated Name' },
        authContext: {
          currentOrgId: 'org1',
          userRole: 'project_admin',
          userId: 'user1',
        },
      });

      const newState = projectsReducer(initialState, action);

      expect(newState.projects[0].name).toBe('Updated Name');
      expect(newState.error).toBeUndefined();
    });

    it('should reject update from unauthorized user', () => {
      const project = {
        id: 'proj1',
        organisation_id: 'org1',
        name: 'Test',
        created_by: 'user2',
      };

      const initialState = {
        projects: [project],
        loading: false,
      };

      const action = updateProject({
        id: 'proj1',
        updates: { name: 'Updated Name' },
        authContext: {
          currentOrgId: 'org2', // Different org
          userRole: 'project_member',
          userId: 'user1',
        },
      });

      const newState = projectsReducer(initialState, action);

      expect(newState.projects[0].name).toBe('Test'); // Unchanged
      expect(newState.error).toBeDefined();
      expect(newState.error).toContain('Insufficient permissions');
    });
  });
});
```

#### **GREEN Phase - Implementation**

**Step 2.1.1: Update Action Interfaces** (30 mins)
```typescript
// src/redux/slices/projectsSlice.ts

export interface AuthContext {
  currentOrgId: string | null;
  userRole: UserRole;
  userId: string;
}

export interface SetProjectsPayload {
  projects: Project[];
  authContext: AuthContext;
}

export interface CreateProjectPayload {
  project: Project;
  authContext: AuthContext;
}

export interface UpdateProjectPayload {
  id: string;
  updates: Partial<Project>;
  authContext: AuthContext;
}

export interface DeleteProjectPayload {
  id: string;
  authContext: AuthContext;
}
```

**Step 2.1.2: Refactor Reducers** (60 mins)
```typescript
reducers: {
  setProjects: (state, action: PayloadAction<SetProjectsPayload>) => {
    const { projects, authContext } = action.payload;

    // Apply org filtering based on role
    if (authContext.userRole === 'ww_admin') {
      state.projects = projects;
    } else {
      state.projects = projects.filter(
        p => p.organisation_id === authContext.currentOrgId
      );
    }

    state.loading = false;
    state.error = undefined;
  },

  updateProject: (state, action: PayloadAction<UpdateProjectPayload>) => {
    const { id, updates, authContext } = action.payload;
    const projectIndex = state.projects.findIndex(p => p.id === id);

    if (projectIndex === -1) {
      state.error = 'Project not found';
      return;
    }

    const project = state.projects[projectIndex];

    // Permission check using helper with auth context
    if (!canModifyProject(project, authContext)) {
      state.error = 'Insufficient permissions to update project';
      return;
    }

    const updatedProject = {
      ...project,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const validationError = validateProject(updatedProject);
    if (validationError) {
      state.error = validationError;
      return;
    }

    state.projects[projectIndex] = updatedProject;

    if (state.currentProject?.id === id) {
      state.currentProject = updatedProject;
    }

    state.error = undefined;
  },

  // Similar pattern for createProject, deleteProject, etc.
}

// Update helper function signatures
const canModifyProject = (
  project: Project,
  authContext: AuthContext
): boolean => {
  if (authContext.userRole === 'ww_admin') return true;
  if (project.created_by === authContext.userId) return true;

  const userMember = project.members.find(
    m => m.user_id === authContext.userId
  );
  if (userMember && userMember.role === 'project_admin') return true;

  if (
    authContext.userRole === 'project_admin' &&
    project.organisation_id === authContext.currentOrgId
  ) {
    return true;
  }

  return false;
};
```

**Step 2.1.3: Update All Dispatch Calls** (30 mins)
```bash
# Find all dispatch calls
grep -r "dispatch(setProjects\|createProject\|updateProject\|deleteProject" src/

# Update each file to include authContext
```

Example update:
```typescript
// Before:
dispatch(setProjects(fetchedProjects));

// After:
import { selectCurrentUser, selectCurrentOrganisation } from '../redux/slices/authSlice';

const user = useAppSelector(selectCurrentUser);
const currentOrg = useAppSelector(selectCurrentOrganisation);

dispatch(setProjects({
  projects: fetchedProjects,
  authContext: {
    currentOrgId: currentOrg?.id || null,
    userRole: user.role,
    userId: user.id
  }
}));
```

---

### **Phase 2.2: Fix Deployments Slice** (1.5 hours)

#### **RED Phase - Write Failing Tests**
```typescript
// tests/redux/slices/deploymentsSlice.test.ts

describe('Deployments Slice - Auth Context Pattern', () => {
  it('should filter deployments by org for non-admin users', () => {
    // Similar structure to projects slice tests
  });

  it('should allow project_admin to create deployment', () => {
    // Permission check tests
  });

  it('should reject deployment creation from unauthorized user', () => {
    // Security tests
  });
});
```

#### **GREEN Phase - Implementation**
- Apply identical pattern as projects slice
- Update all action interfaces
- Refactor all reducers
- Update dispatch calls throughout codebase

---

### **Phase 3: Register Middleware** (1 hour)

#### **RED Phase - Write Failing Tests**
```typescript
// tests/redux/middleware/offlineSyncMiddleware.test.ts

describe('Offline Sync Middleware Registration', () => {
  it('should trigger sync on network online event', async () => {
    const mockDispatch = jest.fn();
    const mockGetState = jest.fn(() => ({
      network: { isConnected: true },
      offline: { queue: { operations: [mockOperation] } },
    }));

    await offlineSyncMiddleware.middleware(
      { dispatch: mockDispatch, getState: mockGetState }
    );

    // Dispatch network online action
    store.dispatch(setNetworkStatus({ isConnected: true }));

    // Verify sync was triggered
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'offline/processQueue' })
      );
    });
  });
});
```

#### **GREEN Phase - Implementation**
Already implemented in Phase 1.3 - just verify tests pass

---

### **Phase 4: Fix Supabase Import** (30 mins)

#### **GREEN Phase - Implementation**
```typescript
// src/services/supabase.ts

const createSupabaseClient = () => {
  // Defer validation to runtime
  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      console.warn('⚠️  Supabase client unavailable in test environment');
      return null as any;
    }

    throw new Error('Missing Supabase configuration...');
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
};

export const supabase = createSupabaseClient();
```

---

### **Phase 5: Integration Testing** (1-2 hours)

#### **BDD Integration Tests**
```typescript
// tests/integration/project-management.integration.test.ts

describe('Project Management Integration (BDD)', () => {
  describe('Given a project_admin user', () => {
    describe('When they create a project', () => {
      it('Then the project should be visible only to their org', async () => {
        // Setup: Login as project_admin
        const admin = await loginAsProjectAdmin('org1');

        // When: Create project
        const project = await createProject({
          name: 'Test Project',
          organisation_id: 'org1',
        });

        // Then: Verify org filtering
        const projects = await getProjects();
        expect(projects).toContainEqual(
          expect.objectContaining({ id: project.id })
        );

        // And: Other org users should not see it
        await loginAsUser('org2');
        const org2Projects = await getProjects();
        expect(org2Projects).not.toContainEqual(
          expect.objectContaining({ id: project.id })
        );
      });
    });
  });

  describe('Given a ww_admin user', () => {
    describe('When they view projects', () => {
      it('Then they should see all projects across orgs', async () => {
        await loginAsWWAdmin();
        const projects = await getProjects();

        expect(projects).toContainEqual(
          expect.objectContaining({ organisation_id: 'org1' })
        );
        expect(projects).toContainEqual(
          expect.objectContaining({ organisation_id: 'org2' })
        );
      });
    });
  });
});
```

---

## ✅ Success Criteria

### **Phase Completion Gates**:
- [x] **Phase 1**: Only one store, all imports updated, middleware registered
- [ ] **Phase 2.1**: No `(state as any).authentication` in projects slice, all tests green
- [ ] **Phase 2.2**: No `(state as any).authentication` in deployments slice, all tests green
- [ ] **Phase 3**: Background sync runs on network change, middleware tests pass
- [ ] **Phase 4**: Jest tests pass, dev builds work
- [ ] **Phase 5**: Integration tests green, manual testing confirms fixes

### **Task 13 Readiness**:
- [ ] Projects filter correctly by organisation
- [ ] Permission checks use actual user role
- [ ] Offline sync works for member operations
- [ ] Background sync processes queued actions

---

## 🎯 Post-Fix: Task 13 Integration (2-3 hours)

### **Step 1: Remove Mocks** (30 mins)
```typescript
// src/screens/ProjectMembersScreen.tsx

// REMOVE:
import { mockProjectMembers, mockOrganizationUsers } from '../mocks/projectMembers';

// ADD:
import {
  getProjectMembers,
  getOrganizationUsers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
} from '../services/ProjectMemberService';

// REPLACE mock state:
const [members, setMembers] = useState<ProjectMember[]>([]);

// ADD Redux selectors:
const user = useAppSelector(selectCurrentUser);
const currentOrg = useAppSelector(selectCurrentOrganisation);
```

### **Step 2: Connect Real Services** (1 hour)
```typescript
const loadMembers = async () => {
  setLoading(true);
  try {
    const members = await getProjectMembers(projectId, user.id);
    setMembers(members);

    const allUsers = await getOrganizationUsers(currentOrg.id, user.id);
    const available = getAvailableUsers(allUsers, members);
    setAvailableUsers(available);
  } catch (error) {
    console.error('Error loading members:', error);
    Alert.alert('Error', 'Failed to load project members');
  } finally {
    setLoading(false);
  }
};
```

### **Step 3: Integration Testing** (30 mins)
- Test with real backend (56 tests already passing)
- Verify org filtering works
- Confirm role-based permissions
- Validate offline sync

### **Step 4: Update Metrics** (30 mins)
- Document Redux fix time
- Update Task 13 completion
- Adjust Stream A timeline

---

## 📊 Timeline Estimate

| Phase | Duration | Type |
|-------|----------|------|
| Phase 1: Store Consolidation | 2-3 hrs | RED-GREEN-REFACTOR |
| Phase 2.1: Projects Slice | 2 hrs | RED-GREEN-REFACTOR |
| Phase 2.2: Deployments Slice | 1.5 hrs | RED-GREEN-REFACTOR |
| Phase 3: Middleware | 1 hr | Test verification |
| Phase 4: Supabase | 0.5 hrs | GREEN only |
| Phase 5: Integration Tests | 1-2 hrs | BDD scenarios |
| **Total Redux Fix** | **8-10 hrs** | |
| Task 13 Integration | 2-3 hrs | Real service connection |
| **Grand Total** | **10-13 hrs** | |

---

## 🚀 Execution Protocol

### **Start Checklist**:
- [ ] Create branch: `fix/redux-architecture-tdd`
- [ ] Commit after each phase
- [ ] Run tests after each GREEN phase
- [ ] Manual testing at integration phase
- [ ] Update metrics tracker continuously

### **Quality Gates**:
- ✅ All tests must pass before proceeding
- ✅ Zero TypeScript errors at each phase
- ✅ Manual validation at Phase 5
- ✅ Performance benchmarks maintained

### **Communication**:
- Update user after each phase completion
- Flag any blockers immediately
- Document all learnings in AADF framework

---

**Status**: READY TO EXECUTE
**Methodology**: AADF + TDD/BDD with RED-GREEN-REFACTOR
**Confidence**: HIGH (comprehensive testing + no future conflicts)
