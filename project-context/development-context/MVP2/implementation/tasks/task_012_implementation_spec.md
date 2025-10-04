# Task 12: Projects CRUD Operations - Implementation Specification

**Version**: 1.0
**Created**: 2025-10-04
**Status**: Ready for Implementation
**Related Documents**:
- Original Task: `task_012.txt`
- Execution Plan: `task_012_execution_plan.md`
- Backend Coordination: `task_012_backend_spec.md`

---

## 📋 Executive Summary

Implement comprehensive project management system for Wildlife Watcher mobile app with:
- Organisation multi-tenancy with data isolation
- Role-based access control (4-tier system)
- Offline-first architecture with sync capabilities
- LoRaWAN device status integration
- Cross-repo coordination with backend

**Estimated Time**: 4.5 hours (with parallel execution)
**Dependencies**: Task 11 (Offline SQLite Foundation)

---

## 🔑 Key Clarifications & Requirements

### 1. Organisation Membership Rules ✅

**Standard Users (Non-WW Admin):**
- Belong to **exactly ONE organisation** per login account
- Multiple organisations require **separate login accounts**
- Cannot switch organisations within mobile app
- Organisation assigned during account creation

**WW Admin Users:**
- Automatically belong to **Wildlife.ai organisation** (system default)
- Can belong to **ONE additional organisation** (maximum 2 total)
- Can switch between their 2 organisations via mobile app side menu
- Existing users can be promoted to WW Admin (gain 2-org capability)

**Business Logic Requirements:**
```typescript
// Backend validation required
- Non-WW Admin: max_organisations = 1
- WW Admin: max_organisations = 2
- Enforce during user_organisations INSERT
- Error if limit exceeded
```

---

### 2. WW Admin Access Scope - Mobile App ⚠️

**CRITICAL CLARIFICATION**: WW Admin mobile app access is **NOT** global.

**Web Portal (Out of Scope for Task 12):**
- ✅ View all projects across all organisations
- ✅ User management capabilities
- ✅ System-wide administration

**Mobile App (Task 12 Scope):**
- ❌ NO cross-organisation visibility
- ✅ See ONLY their assigned organisation(s) projects
- ✅ See ONLY projects they're assigned to (like other users)
- ✅ Organisation switching (if they have 2 orgs) via side menu
- ✅ Same role-based permissions as other users

**Implementation Impact:**
- Remove "get all projects admin" logic from mobile
- WW Admin queries filtered by organisation_id
- WW Admin queries filtered by project membership
- Org switching clears cache and refetches for new org context

---

### 3. Role-Based Access Matrix

| Role | Scope | Mobile App Access |
|------|-------|-------------------|
| **ww_admin** | System | • Projects in their org(s) only<br/>• Projects they're members of<br/>• Can switch between max 2 orgs<br/>• Admin permissions in their orgs |
| **model_manager** | Organisation | • All projects in their organisation<br/>• Can manage organisation settings<br/>• Can assign project roles |
| **project_admin** | Project | • Projects they administer<br/>• Can edit project settings<br/>• Can manage project members |
| **project_member** | Project | • Projects they're members of<br/>• Read-only access<br/>• Can view deployments |

**Key Points:**
- All roles are **organisation-scoped** in mobile app
- All roles see **only assigned projects**
- WW Admin is **NOT special** in mobile (just can have 2 orgs)

---

### 4. Backend Schema Status

#### ✅ Already Implemented

**Tables:**
```sql
-- Core organisation tables
organisations (id, name, slug, created_by, is_active, metadata)
user_organisations (id, user_id, organisation_id, deleted_at)
user_roles (id, user_id, role, scope_type, scope_id, is_active, expires_at)

-- Projects table with org support
projects (
  id, name, organisation_id, owner_id,
  sampling_design, description, website,
  is_private, using_bait, monitoring_marked,
  privacy_level, created_at, updated_at, deleted_at
)

-- Legacy tables (still functional)
project_members (project_id, user_id, role_id)
roles (id, value, description)
```

**RLS Policies:**
- ✅ organisations_select_policy (user must be member)
- ✅ projects_select_policy (org member OR project member)
- ✅ projects_insert_policy (org member can create)
- ✅ projects_update_policy (admin roles only)
- ✅ projects_delete_policy (soft delete, admin only)

**Helper Functions:**
- ✅ `has_system_role(user_id, role)` - Check WW Admin
- ✅ `has_organisation_role(user_id, org_id, role)` - Check org role
- ✅ `has_project_role_mvp2(user_id, project_id, role)` - Check project role
- ✅ `has_project_role(project_id, role)` - Legacy role check

#### ⚠️ Needs Verification

**API Endpoints** (need integration testing):
- `GET /rest/v1/projects` - List projects
- `POST /rest/v1/projects` - Create project
- `PATCH /rest/v1/projects?id=eq.{id}` - Update project
- `DELETE /rest/v1/projects?id=eq.{id}` - Soft delete

**Computed Fields** (need verification):
- Member count per project
- Deployment count per project
- Device count per project
- Aggregated LoRaWAN status

#### ❓ Potential Gaps (TDD Will Reveal)

**Business Logic Functions:**
```sql
-- Enforce organisation membership limits
CREATE FUNCTION validate_user_org_limit() RETURNS TRIGGER

-- Project member management
CREATE FUNCTION add_project_member(project_id, user_id, role)
CREATE FUNCTION remove_project_member(project_id, user_id)

-- LoRaWAN aggregation
CREATE FUNCTION get_project_device_status(project_id)
  RETURNS TABLE(battery_level int, sd_card_usage int, device_count int)
```

**API Endpoints:**
- `GET /rest/v1/user_organisations?user_id=eq.{id}` - User's orgs
- `POST /rpc/add_project_member` - Add member with email
- `POST /rpc/remove_project_member` - Remove member
- `GET /rest/v1/project_members?project_id=eq.{id}&select=*,profiles(*)` - Members with profiles

---

### 5. LoRaWAN Integration Approach 📡

**Current Status:**
- Backend spec defines `lorawan_messages` table (NOT YET CREATED)
- Webhook handler specified but not implemented
- Data format TBD by hardware team

**Task 12 Strategy:**
Use **mock LoRaWAN data** with realistic structure for development.

**Mock Data Structure:**
```typescript
interface LoRaWANDeviceStatus {
  device_eui: string;              // Device identifier
  battery_level: number;           // 0-100%
  sd_card_usage: number;           // 0-100%
  signal_strength?: number;        // -120 to 0 dBm
  last_received: Date;             // Last webhook timestamp
  status: 'online' | 'offline' | 'warning';
}

// Typical LoRaWAN payload structure
interface LoRaWANPayload {
  deviceEUI: string;
  timestamp: string;
  data: {
    battery: number;    // Voltage or percentage
    storage: number;    // Bytes used or percentage
    rssi: number;       // Signal strength
    snr: number;        // Signal-to-noise ratio
  };
}
```

**Mock Service Implementation:**
```typescript
class MockLoRaWANService {
  // Generate realistic mock data for testing
  getProjectDeviceStatus(projectId: string): LoRaWANDeviceStatus[] {
    // Return 3-5 mock devices per project
    // Random battery: 20-100%
    // Random storage: 10-80%
    // Last received: within last 24 hours
  }
}
```

**UI Display:**
- Project cards show aggregated device health
- Battery icon with percentage
- SD card icon with percentage
- Warning indicator if battery < 20% or storage > 80%

**Future Integration:**
- Swap `MockLoRaWANService` with `RealLoRaWANService`
- Connect to webhook-populated database table
- Maintain same interface for seamless swap

---

### 6. Testing Strategy - Pragmatic TDD/BDD

**Philosophy**: Balance test coverage with MVP delivery speed.

#### ✅ DO Test (Priority)

**Service Layer (80% coverage target):**
```typescript
describe('ProjectService', () => {
  it('creates project with organisation scoping')
  it('lists projects filtered by user organisation')
  it('lists projects filtered by user membership')
  it('prevents cross-organisation access')
  it('enforces role-based update permissions')
  it('queues offline operations correctly')
  it('syncs offline projects when online')
  it('handles conflict resolution')
})
```

**RTK Query Integration:**
```typescript
describe('projectsApi', () => {
  it('fetches projects with org filtering')
  it('creates project with optimistic update')
  it('invalidates cache on mutation')
  it('handles network errors gracefully')
})
```

**Critical User Journeys:**
```typescript
describe('Project Creation Flow', () => {
  it('completes full project creation online')
  it('creates project offline and syncs later')
  it('validates required fields')
  it('assigns organisation automatically')
})

describe('Organisation Switching (WW Admin)', () => {
  it('switches between 2 organisations')
  it('clears cache on org switch')
  it('refetches projects for new org')
  it('hides switch option for non-WW Admin')
})
```

#### ❌ DON'T Over-Engineer

- ❌ 100% code coverage (diminishing returns)
- ❌ Complex mock frameworks (simple mocks sufficient)
- ❌ Testing implementation details (test behavior)
- ❌ Every possible edge case (focus MVP paths)
- ❌ Maestro E2E if unstable (defer to later)

**Test Time Allocation:**
- Service layer: 40% of testing time
- Integration tests: 30% of testing time
- UI component tests: 20% of testing time
- E2E (if working): 10% of testing time

---

## 🏗️ Component Architecture

### 1. Service Layer

**`ProjectService.ts`** - Core business logic
```typescript
class ProjectService extends BaseService {
  // CRUD Operations
  async createProject(data: ProjectCreate): Promise<Project>
  async getUserProjects(userId: string): Promise<Project[]>
  async getOrganisationProjects(orgId: string): Promise<Project[]>
  async updateProject(id: string, data: ProjectUpdate): Promise<Project>
  async deleteProject(id: string): Promise<void>

  // Member Management
  async addProjectMember(projectId: string, email: string, role: string): Promise<void>
  async removeProjectMember(projectId: string, userId: string): Promise<void>
  async getProjectMembers(projectId: string): Promise<ProjectMember[]>

  // Organisation Context
  async getUserOrganisations(userId: string): Promise<Organisation[]>
  async switchOrganisation(orgId: string): Promise<void>

  // LoRaWAN Integration (mock for now)
  async getProjectDeviceStatus(projectId: string): Promise<LoRaWANDeviceStatus[]>
}
```

**Key Patterns:**
- Extends `BaseService` for offline support
- Uses `OfflineService` for queue management
- Integrates `ConflictResolutionService`
- Type-safe with generated Supabase types
- Organisation-scoped queries by default

---

### 2. State Management

**`store/api/projectsApi.ts`** - RTK Query endpoints
```typescript
export const projectsApi = createApi({
  reducerPath: 'projectsApi',
  baseQuery: supabaseBaseQuery,
  tagTypes: ['Projects', 'ProjectMembers', 'Organisations'],
  endpoints: (builder) => ({
    // Queries
    getProjects: builder.query<Project[], { organisationId?: string }>({
      providesTags: ['Projects'],
    }),
    getProject: builder.query<Project, string>({
      providesTags: (result, error, id) => [{ type: 'Projects', id }],
    }),
    getUserOrganisations: builder.query<Organisation[], string>({
      providesTags: ['Organisations'],
    }),

    // Mutations
    createProject: builder.mutation<Project, ProjectCreate>({
      invalidatesTags: ['Projects'],
      // Optimistic update
      async onQueryStarted(data, { dispatch, queryFulfilled }) {
        // Add optimistic project to cache
      }
    }),
    updateProject: builder.mutation<Project, { id: string; data: ProjectUpdate }>({
      invalidatesTags: (result, error, { id }) => [{ type: 'Projects', id }],
    }),
    deleteProject: builder.mutation<void, string>({
      invalidatesTags: ['Projects'],
    }),
    switchOrganisation: builder.mutation<void, string>({
      invalidatesTags: ['Projects', 'Organisations'],
      // Clear all cached project data
    }),
  }),
})
```

**Redux Slices:**
```typescript
// store/slices/projectsSlice.ts
interface ProjectsState {
  currentOrganisationId: string | null;
  selectedProjectId: string | null;
  searchQuery: string;
  filters: ProjectFilters;
}

// store/slices/userSlice.ts
interface UserState {
  organisations: Organisation[];
  currentOrganisation: Organisation | null;
  isWWAdmin: boolean;
  canSwitchOrganisations: boolean;
}
```

---

### 3. UI Components

**`ProjectsScreen.tsx`** - Main project list
```typescript
interface ProjectsScreenProps {
  navigation: NavigationProp<any>;
}

export const ProjectsScreen: FC<ProjectsScreenProps> = ({ navigation }) => {
  const currentOrgId = useSelector(selectCurrentOrganisationId);
  const { data: projects, isLoading } = useGetProjectsQuery({ organisationId: currentOrgId });

  return (
    <SafeAreaView>
      <SearchBar onSearch={handleSearch} />
      <FlatList
        data={projects}
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            onPress={() => navigation.navigate('ProjectDetails', { id: item.id })}
          />
        )}
        refreshControl={<RefreshControl onRefresh={handleRefresh} />}
      />
    </SafeAreaView>
  );
};
```

**`ProjectCard.tsx`** - Individual project card
```typescript
interface ProjectCardProps {
  project: Project;
  onPress: () => void;
}

export const ProjectCard: FC<ProjectCardProps> = ({ project, onPress }) => {
  const deviceStatus = useGetProjectDeviceStatusQuery(project.id);

  return (
    <Card onPress={onPress}>
      <Card.Title title={project.name} />
      <Card.Content>
        <Text>{project.description}</Text>
        <View style={styles.stats}>
          <Chip icon="account-multiple">{project.member_count} members</Chip>
          <Chip icon="camera">{project.deployment_count} deployments</Chip>
        </View>
        <LoRaWANStatusIndicator status={deviceStatus} />
      </Card.Content>
    </Card>
  );
};
```

**`NewProjectScreen.tsx`** - Project creation form
```typescript
export const NewProjectScreen: FC = () => {
  const [createProject, { isLoading }] = useCreateProjectMutation();
  const currentOrgId = useSelector(selectCurrentOrganisationId);

  const { control, handleSubmit } = useForm<ProjectCreate>({
    defaultValues: {
      organisation_id: currentOrgId,
    },
  });

  const onSubmit = async (data: ProjectCreate) => {
    await createProject(data).unwrap();
    navigation.goBack();
  };

  return (
    <ScrollView>
      <Controller
        control={control}
        name="name"
        rules={{ required: 'Project name is required' }}
        render={({ field }) => <TextInput {...field} label="Project Name" />}
      />
      {/* More form fields */}
      <Button onPress={handleSubmit(onSubmit)} loading={isLoading}>
        Create Project
      </Button>
    </ScrollView>
  );
};
```

**`OrganisationSwitcher.tsx`** - Side menu component (WW Admin only)
```typescript
export const OrganisationSwitcher: FC = () => {
  const isWWAdmin = useSelector(selectIsWWAdmin);
  const organisations = useSelector(selectUserOrganisations);
  const currentOrgId = useSelector(selectCurrentOrganisationId);
  const [switchOrganisation] = useSwitchOrganisationMutation();

  if (!isWWAdmin || organisations.length < 2) return null;

  return (
    <Menu>
      <Menu.Item title="Switch Organisation" />
      {organisations.map(org => (
        <Menu.Item
          key={org.id}
          title={org.name}
          icon={org.id === currentOrgId ? 'check' : undefined}
          onPress={() => switchOrganisation(org.id)}
        />
      ))}
    </Menu>
  );
};
```

---

## ✅ Success Criteria

### Functional Requirements
- [ ] Project creation works online and offline
- [ ] Projects list shows only user's organisation projects
- [ ] Projects list shows only projects user is member of
- [ ] Search and filter work efficiently (<500ms)
- [ ] Team member management functional (add/remove)
- [ ] WW Admin can switch between max 2 organisations
- [ ] Standard users cannot switch organisations

### Organisation & Role Logic
- [ ] Non-WW Admin users limited to 1 organisation (enforced)
- [ ] WW Admin users limited to 2 organisations max (enforced)
- [ ] WW Admin sees org-scoped projects (not global)
- [ ] Cross-organisation access prevented
- [ ] Role-based permissions enforced (admin edit, member view-only)

### Offline Support
- [ ] Projects created offline queue correctly
- [ ] Offline edits sync when online
- [ ] Conflict resolution handles concurrent edits
- [ ] Offline indicator shows sync status

### LoRaWAN Display
- [ ] Mock device status displays on project cards
- [ ] Battery level and SD card usage shown
- [ ] Warning indicators for low battery/high storage
- [ ] Placeholder ready for real webhook integration

### Performance
- [ ] Project list renders <2s for 100+ projects
- [ ] Search completes <500ms
- [ ] Org switching completes <3s with cache clear
- [ ] No memory leaks during scrolling

### Code Quality
- [ ] Zero TypeScript errors
- [ ] >80% meaningful test coverage
- [ ] All critical tests passing
- [ ] ESLint/Prettier compliance
- [ ] Backend integration validated

---

## 📝 Notes & Considerations

### WW Admin Clarification Summary
- Web portal = global view (out of scope)
- Mobile app = org-scoped view (same as other users)
- Can switch between max 2 orgs
- No special privileges in mobile beyond org switching

### Backend Dependencies
- Need org membership limit enforcement
- Need computed fields for project stats
- Need member management APIs
- Mock LoRaWAN data for now

### Future Enhancements (Post-MVP)
- Real LoRaWAN webhook integration
- Project templates for quick creation
- Bulk member import via CSV
- Advanced search with filters
- Project analytics dashboard

---

**Document Status**: ✅ Ready for Implementation
**Next Steps**: See `task_012_execution_plan.md` for dependency graph and parallel execution strategy
