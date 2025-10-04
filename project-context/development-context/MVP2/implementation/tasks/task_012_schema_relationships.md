# Task 12: Database Schema Relationships Reference

**Created**: 2025-10-04
**Purpose**: Document user and project table relationships for Task 12 implementation

---

## 🔑 User Schema Architecture (Supabase Pattern)

### Two-Table User System

**`auth.users`** (Supabase Auth System)
- Managed by Supabase Auth
- Contains authentication data: email, encrypted_password, email_confirmed_at, etc.
- Primary source of truth for user identity
- Users created via Supabase Auth signup/signin

**`public.users`** (Application Extension)
- Extends `auth.users` with app-specific data
- Fields: `id`, `name`, `created_at`, `updated_at`, `deleted_at`
- `id` is FK to `auth.users(id)` with CASCADE delete
- Created via trigger or app logic when user signs up
- Currently empty (will populate during user registration)

### Foreign Key Strategy

**✅ CORRECT PATTERN** (Current Implementation - Verified 2025-10-04):

All user relationships reference **`auth.users(id)` directly**:

| Table | Column | FK Target | Delete Rule | Purpose |
|-------|--------|-----------|-------------|---------|
| `projects` | `owner_id` | `auth.users(id)` | SET NULL | Project owner (can be transferred) |
| `projects` | `created_by` | `auth.users(id)` | SET NULL | Audit trail (preserve even if user deleted) |
| `project_members` | `user_id` | `auth.users(id)` | CASCADE | Member removed when user deleted |
| `user_roles` | `user_id` | `auth.users(id)` | CASCADE | Roles removed when user deleted |
| `user_roles` | `granted_by` | `auth.users(id)` | SET NULL | Preserve audit trail |
| `user_organisations` | `user_id` | `auth.users(id)` | CASCADE | Org membership removed with user |
| `deployments` | `user_id` | `auth.users(id)` | CASCADE | Deployment removed with user |
| `api_logs` | `user_id` | `auth.users(id)` | SET NULL | Preserve logs, anonymize user |
| `public.users` | `id` | `auth.users(id)` | CASCADE | Extension table cascades with auth |

**Note**: `project_members.user_id` has TWO FK constraints (`project_members_user_id_fkey` and `fk_project_members_user`) - both CASCADE

**Why this works**:
1. Supabase best practice - single source of truth
2. `public.users` cascades when `auth.users` deleted (maintains integrity)
3. Can JOIN either table as needed for queries
4. Simpler query patterns (no double JOIN required)

---

## 📊 Project Management Schema

### Core Tables

**`organisations`**
- `id` (uuid, PK)
- `name`, `slug`, `created_by`, `is_active`, `metadata`
- No FK dependencies (root entity)

**`projects`**
- `id` (uuid, PK)
- `name`, `description`, `organisation_id` (FK → organisations)
- `owner_id` (FK → auth.users) - nullable, SET NULL on delete
- `created_by` (FK → auth.users) - nullable, SET NULL on delete
- `privacy_level` ('public' | 'internal' | 'private')
- `is_baited`, `is_monitoring_marked_individual`, `sampling_design`
- **Organisation-scoped**: All projects belong to ONE organisation

**`project_members`**
- `project_id` (FK → projects, CASCADE)
- `user_id` (FK → auth.users, CASCADE)
- `role_id` (FK → roles, SET NULL)
- Composite PK: (project_id, user_id)
- Links users to projects with role-based permissions

**`user_organisations`**
- `user_id` (FK → auth.users, CASCADE)
- `organisation_id` (FK → organisations, CASCADE)
- **Business Rule**: Standard users max 1 org, WW Admin max 2 orgs
- **Validation**: Backend trigger `validate_user_org_limit` enforces limits

**`user_roles`**
- `user_id` (FK → auth.users, CASCADE)
- `role` (text: 'ww_admin' | 'model_manager' | 'project_admin' | 'project_member')
- `scope_type` ('system' | 'organisation' | 'project')
- `scope_id` (uuid, nullable - references org or project depending on scope)
- `is_active`, `expires_at`, `granted_by`

**`roles`** (Lookup table)
- `id` (number, PK)
- `value` (text: role names)
- `description`

---

## 🔍 Query Patterns for Task 12

### Getting Projects with User Info

```typescript
// Get projects with owner name from public.users
const { data: projects } = await supabase
  .from('projects')
  .select(`
    *,
    organisation:organisations(id, name, slug),
    owner_profile:owner_id(name),
    created_by_profile:created_by(name)
  `)
  .eq('organisation_id', currentOrgId);
```

**Note**: The JOIN syntax `owner_id(name)` automatically resolves:
1. `projects.owner_id` → `auth.users.id`
2. `auth.users.id` → `public.users.id` (via FK cascade)
3. Returns `public.users.name`

### Getting Project Members with Names

```typescript
const { data: members } = await supabase
  .from('project_members')
  .select(`
    user_id,
    role:roles(value, description),
    user_profile:user_id(name)
  `)
  .eq('project_id', projectId);
```

### Getting User's Organisations

```typescript
const { data: userOrgs } = await supabase
  .from('user_organisations')
  .select(`
    organisation:organisations(*)
  `)
  .eq('user_id', userId)
  .is('deleted_at', null);
```

### Getting User Roles

```typescript
const { data: roles } = await supabase
  .from('user_roles')
  .select('*')
  .eq('user_id', userId)
  .eq('is_active', true)
  .is('deleted_at', null);
```

---

## 🔒 Row Level Security (RLS) Implications

### Organisation Isolation

All project queries MUST filter by organisation:
```sql
-- RLS Policy Pattern
organisation_id IN (
  SELECT organisation_id
  FROM user_organisations
  WHERE user_id = auth.uid()
    AND deleted_at IS NULL
)
```

### WW Admin Mobile Scope

**CRITICAL**: WW Admin in mobile app is **org-scoped**, NOT global:
- Filter by user's assigned organisations (max 2)
- Filter by project membership
- NO cross-organisation visibility in mobile
- Global access only in web portal (out of scope for Task 12)

### Role-Based Permissions

```sql
-- Check if user has project role
has_project_role_mvp2(project_id, 'project_admin', auth.uid())

-- Check if user has organisation role
has_organisation_role(organisation_id, 'model_manager', auth.uid())

-- Check if user has system role
has_system_role('ww_admin', auth.uid())
```

---

## 📝 Task 12 Implementation Notes

### Type Definitions Needed

```typescript
// src/types/project.ts
import { Tables } from './supabase';

// Base types from generated Supabase types
export type Project = Tables<'projects'>;
export type ProjectMember = Tables<'project_members'>;
export type Organisation = Tables<'organisations'>;
export type UserOrganisation = Tables<'user_organisations'>;
export type UserRole = Tables<'user_roles'>;

// Extended types with computed fields
export type ProjectWithDetails = Project & {
  organisation?: Organisation;
  owner_profile?: { name: string } | null;
  created_by_profile?: { name: string } | null;
  member_count?: number;
  deployment_count?: number;
  lorawan_device_count?: number;
  battery_level?: number;
  sd_card_usage?: number;
};

export type ProjectMemberWithProfile = ProjectMember & {
  user_profile?: { name: string };
  role?: { value: string; description: string };
};
```

### Service Layer Patterns

```typescript
// Org-aware project queries
async getUserProjects(organisationId: string) {
  return this.supabase
    .from('projects')
    .select('*')
    .eq('organisation_id', organisationId);
}

// Member management
async addProjectMember(projectId: string, userId: string, roleId: number) {
  // Verify user belongs to same org as project
  // Then insert into project_members
}
```

---

## ✅ Schema Validation Checklist

- [x] `auth.users` exists and is managed by Supabase Auth
- [x] `public.users` has FK to `auth.users` with CASCADE
- [x] All user FKs reference `auth.users` directly
- [x] Organisation isolation enforced via `user_organisations`
- [x] Project membership tracked via `project_members`
- [x] Role system supports 4-tier RBAC
- [x] Org membership limits validated by trigger
- [x] Generated TypeScript types reflect current schema

---

**Last Updated**: 2025-10-04 17:15
**Schema Source**: Local Supabase (postgresql://postgres@127.0.0.1:54322/postgres)
