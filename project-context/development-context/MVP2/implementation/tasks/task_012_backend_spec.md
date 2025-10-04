# Task 12: Backend API Specification - Projects CRUD

**Version**: 1.0
**Created**: 2025-10-04
**Backend Repo**: `~/dev/wildlifeai/wildlife-watcher-backend`
**Mobile Repo**: `~/dev/wildlifeai/wildlife-watcher-mobile-app`
**Status**: Specification Ready for Backend Implementation

---

## 🎯 Overview

This document specifies the backend API requirements for Task 12 (Projects CRUD Operations) to enable cross-repo coordination between mobile and backend development.

**Purpose**: Define exact API endpoints, business logic functions, and data structures needed by the mobile app for project management.

**Coordination Model**: Mobile team creates this spec → Backend team implements → Mobile team integrates

---

## ✅ Already Implemented (Verified)

### Tables
```sql
✅ organisations (id, name, slug, created_by, is_active, metadata)
✅ user_organisations (id, user_id, organisation_id, deleted_at)
✅ user_roles (id, user_id, role, scope_type, scope_id, is_active, expires_at)
✅ projects (id, name, organisation_id, owner_id, description, privacy_level, ...)
✅ project_members (project_id, user_id, role_id)
```

### RLS Policies
```sql
✅ projects_select_policy (org member OR project member can view)
✅ projects_insert_policy (org member can create)
✅ projects_update_policy (admin roles only)
✅ projects_delete_policy (soft delete, admin only)
```

### Helper Functions
```sql
✅ has_system_role(user_id, role)
✅ has_organisation_role(user_id, org_id, role)
✅ has_project_role_mvp2(user_id, project_id, role)
```

---

## ⚠️ Required Implementations (Gaps)

### 1. Organisation Membership Limit Enforcement

**Requirement**: Enforce business rules for organisation membership based on user role.

**Business Rules:**
- Non-WW Admin users: **maximum 1 organisation**
- WW Admin users: **maximum 2 organisations**
- Prevent INSERT if limit exceeded

**Implementation:**

```sql
-- Create trigger function
CREATE OR REPLACE FUNCTION validate_user_org_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_org_count INTEGER;
  is_ww_admin BOOLEAN;
BEGIN
  -- Count existing active org memberships for this user
  SELECT COUNT(*)
  INTO current_org_count
  FROM user_organisations
  WHERE user_id = NEW.user_id
    AND deleted_at IS NULL;

  -- Check if user is WW Admin
  SELECT EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = NEW.user_id
      AND role = 'ww_admin'
      AND scope_type = 'system'
      AND is_active = true
      AND deleted_at IS NULL
  ) INTO is_ww_admin;

  -- Enforce limits
  IF is_ww_admin AND current_org_count >= 2 THEN
    RAISE EXCEPTION 'WW Admin users cannot belong to more than 2 organisations';
  END IF;

  IF NOT is_ww_admin AND current_org_count >= 1 THEN
    RAISE EXCEPTION 'Non-WW Admin users cannot belong to more than 1 organisation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
CREATE TRIGGER enforce_user_org_limit
  BEFORE INSERT ON user_organisations
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_org_limit();
```

**Test Cases:**
```sql
-- Test 1: Non-WW Admin trying to join 2nd org (should fail)
INSERT INTO user_organisations (user_id, organisation_id) VALUES ('user1', 'org2');
-- Expected: ERROR: Non-WW Admin users cannot belong to more than 1 organisation

-- Test 2: WW Admin joining 2nd org (should succeed)
INSERT INTO user_organisations (user_id, organisation_id) VALUES ('ww_admin_user', 'org2');
-- Expected: Success

-- Test 3: WW Admin trying to join 3rd org (should fail)
INSERT INTO user_organisations (user_id, organisation_id) VALUES ('ww_admin_user', 'org3');
-- Expected: ERROR: WW Admin users cannot belong to more than 2 organisations
```

---

### 2. Computed Fields for Projects

**Requirement**: Add computed fields to project queries for mobile app display.

**Required Fields:**
- `member_count`: Number of active project members
- `deployment_count`: Number of active deployments
- `device_count`: Number of devices across deployments
- `battery_status`: Aggregated LoRaWAN battery levels
- `storage_status`: Aggregated LoRaWAN SD card usage

**Implementation Option 1: Database View (Recommended)**

```sql
CREATE OR REPLACE VIEW projects_with_stats AS
SELECT
  p.*,
  (
    SELECT COUNT(*)
    FROM project_members pm
    WHERE pm.project_id = p.id
      AND pm.deleted_at IS NULL
  ) AS member_count,
  (
    SELECT COUNT(*)
    FROM deployments d
    WHERE d.project_id = p.id
      AND d.deleted_at IS NULL
      AND d.deployment_status_id IN (
        SELECT id FROM deployment_statuses WHERE value = 'active'
      )
  ) AS deployment_count,
  (
    SELECT COUNT(DISTINCT d.device_id)
    FROM deployments d
    WHERE d.project_id = p.id
      AND d.deleted_at IS NULL
      AND d.deployment_status_id IN (
        SELECT id FROM deployment_statuses WHERE value = 'active'
      )
  ) AS device_count,
  (
    SELECT COALESCE(AVG(d.battery_level), 0)::INTEGER
    FROM deployments d
    WHERE d.project_id = p.id
      AND d.deleted_at IS NULL
      AND d.battery_level IS NOT NULL
  ) AS avg_battery_level,
  (
    SELECT COALESCE(AVG(d.sd_card_usage), 0)::INTEGER
    FROM deployments d
    WHERE d.project_id = p.id
      AND d.deleted_at IS NULL
      AND d.sd_card_usage IS NOT NULL
  ) AS avg_storage_usage
FROM projects p
WHERE p.deleted_at IS NULL;

-- Grant access with same RLS policies as projects table
ALTER VIEW projects_with_stats OWNER TO authenticated;

-- Mobile app queries this view instead of projects table
-- GET /rest/v1/projects_with_stats?organisation_id=eq.{org_id}
```

**Implementation Option 2: RPC Function (Alternative)**

```sql
CREATE OR REPLACE FUNCTION get_user_projects_with_stats(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  organisation_id UUID,
  description TEXT,
  member_count BIGINT,
  deployment_count BIGINT,
  device_count BIGINT,
  avg_battery_level INTEGER,
  avg_storage_usage INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.organisation_id,
    p.description,
    COUNT(DISTINCT pm.user_id) AS member_count,
    COUNT(DISTINCT d.id) FILTER (WHERE d.deployment_status_id IN (
      SELECT id FROM deployment_statuses WHERE value = 'active'
    )) AS deployment_count,
    COUNT(DISTINCT d.device_id) AS device_count,
    COALESCE(AVG(d.battery_level)::INTEGER, 0) AS avg_battery_level,
    COALESCE(AVG(d.sd_card_usage)::INTEGER, 0) AS avg_storage_usage
  FROM projects p
  LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.deleted_at IS NULL
  LEFT JOIN deployments d ON d.project_id = p.id AND d.deleted_at IS NULL
  WHERE p.deleted_at IS NULL
    AND (
      -- User is org member
      EXISTS (
        SELECT 1 FROM user_organisations uo
        WHERE uo.user_id = p_user_id
          AND uo.organisation_id = p.organisation_id
          AND uo.deleted_at IS NULL
      )
      OR
      -- User is project member
      EXISTS (
        SELECT 1 FROM project_members pm2
        WHERE pm2.project_id = p.id
          AND pm2.user_id = p_user_id
          AND pm2.deleted_at IS NULL
      )
      OR
      -- User is WW Admin
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = p_user_id
          AND ur.role = 'ww_admin'
          AND ur.is_active = true
      )
    )
  GROUP BY p.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mobile app calls: POST /rest/v1/rpc/get_user_projects_with_stats
```

**Recommendation**: Use **database view** for better performance and simpler mobile integration.

---

### 3. Project Member Management APIs

**Requirement**: Add/remove project members with email invitations and role assignment.

#### 3.1 Add Project Member

```sql
CREATE OR REPLACE FUNCTION add_project_member(
  p_project_id UUID,
  p_email TEXT,
  p_role TEXT -- 'project_admin' or 'project_member'
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_role_id INTEGER;
  v_organisation_id UUID;
  v_can_add BOOLEAN;
BEGIN
  -- Get project's organisation
  SELECT organisation_id INTO v_organisation_id
  FROM projects
  WHERE id = p_project_id AND deleted_at IS NULL;

  IF v_organisation_id IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  -- Check if current user can add members (project_admin or ww_admin)
  SELECT (
    has_system_role(auth.uid(), 'ww_admin') OR
    has_project_role_mvp2(auth.uid(), p_project_id, 'project_admin') OR
    has_organisation_role(auth.uid(), v_organisation_id, 'model_manager')
  ) INTO v_can_add;

  IF NOT v_can_add THEN
    RAISE EXCEPTION 'Permission denied: must be project admin to add members';
  END IF;

  -- Find user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;

  IF v_user_id IS NULL THEN
    -- User doesn't exist - create invitation (future enhancement)
    RAISE EXCEPTION 'User not found. Email invitations not yet implemented.';
  END IF;

  -- Get role_id from legacy roles table
  SELECT id INTO v_role_id
  FROM roles
  WHERE value = CASE
    WHEN p_role = 'project_admin' THEN 'admin'
    WHEN p_role = 'project_member' THEN 'member'
  END;

  -- Add to project_members (legacy table)
  INSERT INTO project_members (project_id, user_id, role_id)
  VALUES (p_project_id, v_user_id, v_role_id)
  ON CONFLICT (project_id, user_id) DO UPDATE
    SET role_id = EXCLUDED.role_id,
        deleted_at = NULL;

  -- Add user_role entry (new MVP2 table)
  INSERT INTO user_roles (user_id, role, scope_type, scope_id, granted_by)
  VALUES (v_user_id, p_role, 'project', p_project_id, auth.uid())
  ON CONFLICT (user_id, role, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'))
  WHERE deleted_at IS NULL AND is_active = true
  DO UPDATE
    SET deleted_at = NULL,
        is_active = true;

  RETURN json_build_object(
    'success', true,
    'user_id', v_user_id,
    'role', p_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mobile app calls: POST /rest/v1/rpc/add_project_member
-- Body: { "p_project_id": "uuid", "p_email": "user@example.com", "p_role": "project_member" }
```

#### 3.2 Remove Project Member

```sql
CREATE OR REPLACE FUNCTION remove_project_member(
  p_project_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_organisation_id UUID;
  v_can_remove BOOLEAN;
BEGIN
  -- Get project's organisation
  SELECT organisation_id INTO v_organisation_id
  FROM projects
  WHERE id = p_project_id AND deleted_at IS NULL;

  -- Check permissions
  SELECT (
    has_system_role(auth.uid(), 'ww_admin') OR
    has_project_role_mvp2(auth.uid(), p_project_id, 'project_admin') OR
    has_organisation_role(auth.uid(), v_organisation_id, 'model_manager')
  ) INTO v_can_remove;

  IF NOT v_can_remove THEN
    RAISE EXCEPTION 'Permission denied: must be project admin to remove members';
  END IF;

  -- Soft delete from project_members
  UPDATE project_members
  SET deleted_at = NOW()
  WHERE project_id = p_project_id
    AND user_id = p_user_id;

  -- Deactivate user_roles entry
  UPDATE user_roles
  SET deleted_at = NOW(),
      is_active = false
  WHERE user_id = p_user_id
    AND scope_type = 'project'
    AND scope_id = p_project_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mobile app calls: POST /rest/v1/rpc/remove_project_member
-- Body: { "p_project_id": "uuid", "p_user_id": "uuid" }
```

#### 3.3 Get Project Members with Profiles

```sql
-- Query via REST API with joins
GET /rest/v1/project_members
  ?project_id=eq.{project_id}
  &deleted_at=is.null
  &select=user_id,role_id,added_at,user:users(id,email,full_name,avatar_url),role:roles(value,description)

-- Returns:
[
  {
    "user_id": "uuid",
    "role_id": 1,
    "added_at": "2025-10-04T10:00:00Z",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "avatar_url": "https://..."
    },
    "role": {
      "value": "admin",
      "description": "Project Administrator"
    }
  }
]
```

---

### 4. User Organisations Query

**Requirement**: Mobile app needs to fetch user's organisations for org switching (WW Admin only).

**Implementation:**

```sql
-- Simple REST query (RLS policies already filter correctly)
GET /rest/v1/user_organisations
  ?user_id=eq.{user_id}
  &deleted_at=is.null
  &select=organisation_id,organisation:organisations(id,name,slug,metadata)

-- Returns:
[
  {
    "organisation_id": "uuid",
    "organisation": {
      "id": "uuid",
      "name": "Wildlife.ai",
      "slug": "wildlife-ai",
      "metadata": {}
    }
  },
  {
    "organisation_id": "uuid2",
    "organisation": {
      "id": "uuid2",
      "name": "Conservation Org",
      "slug": "conservation-org",
      "metadata": {}
    }
  }
]
```

**No additional implementation needed** - RLS policies already handle this correctly.

---

### 5. LoRaWAN Device Status Aggregation

**Requirement**: Aggregate LoRaWAN device status per project for mobile app display.

**Note**: LoRaWAN webhook integration is future work. For now, mobile uses **mock data**.

**Future Implementation** (when webhook ready):

```sql
CREATE TABLE lorawan_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_eui TEXT NOT NULL,
  deployment_id UUID REFERENCES deployments(id),
  battery_level INTEGER,
  sd_card_usage INTEGER,
  signal_strength INTEGER,
  raw_payload JSONB,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION get_project_lorawan_status(p_project_id UUID)
RETURNS TABLE (
  device_count INTEGER,
  avg_battery_level INTEGER,
  min_battery_level INTEGER,
  avg_storage_usage INTEGER,
  max_storage_usage INTEGER,
  devices_low_battery INTEGER,
  devices_high_storage INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT lm.device_eui)::INTEGER AS device_count,
    COALESCE(AVG(lm.battery_level)::INTEGER, 0) AS avg_battery_level,
    COALESCE(MIN(lm.battery_level)::INTEGER, 0) AS min_battery_level,
    COALESCE(AVG(lm.sd_card_usage)::INTEGER, 0) AS avg_storage_usage,
    COALESCE(MAX(lm.sd_card_usage)::INTEGER, 0) AS max_storage_usage,
    COUNT(*) FILTER (WHERE lm.battery_level < 20)::INTEGER AS devices_low_battery,
    COUNT(*) FILTER (WHERE lm.sd_card_usage > 80)::INTEGER AS devices_high_storage
  FROM deployments d
  LEFT JOIN LATERAL (
    SELECT device_eui, battery_level, sd_card_usage
    FROM lorawan_messages
    WHERE deployment_id = d.id
    ORDER BY received_at DESC
    LIMIT 1
  ) lm ON true
  WHERE d.project_id = p_project_id
    AND d.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**For Task 12**: Mobile app uses **MockLoRaWANService** - no backend implementation needed yet.

---

## 📋 API Endpoint Summary

### Required Endpoints

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/rest/v1/projects_with_stats` | GET | List projects with computed fields | ⚠️ **Need to create view** |
| `/rest/v1/projects` | POST | Create project | ✅ Already works |
| `/rest/v1/projects?id=eq.{id}` | PATCH | Update project | ✅ Already works |
| `/rest/v1/projects?id=eq.{id}` | DELETE | Soft delete project | ✅ Already works |
| `/rest/v1/rpc/add_project_member` | POST | Add member to project | ⚠️ **Need to create function** |
| `/rest/v1/rpc/remove_project_member` | POST | Remove member from project | ⚠️ **Need to create function** |
| `/rest/v1/project_members` | GET | Get project members | ✅ Already works (with select) |
| `/rest/v1/user_organisations` | GET | Get user's organisations | ✅ Already works |

---

## 🧪 Testing Requirements

### Integration Tests (Backend)

```typescript
describe('Task 12 Backend APIs', () => {
  describe('Organisation Membership Limits', () => {
    it('prevents non-WW Admin from joining 2 orgs');
    it('allows WW Admin to join 2 orgs');
    it('prevents WW Admin from joining 3rd org');
  });

  describe('Projects with Stats View', () => {
    it('returns correct member count');
    it('returns correct deployment count');
    it('returns correct device count');
    it('filters by organisation correctly');
  });

  describe('Member Management Functions', () => {
    it('adds project member with correct role');
    it('prevents non-admin from adding members');
    it('removes project member correctly');
    it('soft deletes without hard delete');
  });

  describe('RLS Policies', () => {
    it('user sees only their org projects');
    it('user sees projects they are member of');
    it('WW Admin sees org-scoped projects (not global)');
    it('prevents cross-org data access');
  });
});
```

### Manual Testing Script

```bash
# Run in backend repo
cd ~/dev/wildlifeai/wildlife-watcher-backend

# Reset database
supabase db reset --linked

# Create test users
psql $DATABASE_URL <<EOF
  -- Create WW Admin user
  INSERT INTO user_roles (user_id, role, scope_type, granted_by)
  SELECT id, 'ww_admin', 'system', id
  FROM auth.users WHERE email = 'admin@wildlife.ai';

  -- Test org membership limits
  -- ... (test cases)
EOF

# Test APIs via HTTP
curl -X GET "https://qywmokszgdoykzuewlhm.supabase.co/rest/v1/projects_with_stats" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_TOKEN"
```

---

## 📝 Handoff Documentation

### Backend → Mobile Handoff Checklist

**When backend implementation complete:**

- [ ] All database migrations applied to dev environment
- [ ] Integration tests passing (>90%)
- [ ] RLS policies verified with different user roles
- [ ] API endpoints tested via Postman/curl
- [ ] Performance acceptable (<500ms for typical queries)
- [ ] Error handling returns clear messages
- [ ] Test users created in dev environment

**Create handoff document:**

```markdown
# Task 12 Backend Implementation Complete

**Date**: {date}
**Developer**: {name}
**Dev Environment**: https://qywmokszgdoykzuewlhm.supabase.co

## ✅ Implemented
- Organisation membership limit enforcement
- Projects with computed fields view
- Add/remove project member functions
- RLS policy verification

## 🧪 Test Results
- Integration tests: 25/25 passing
- RLS policies: Verified with 3 user roles
- Performance: All queries <500ms

## 🔑 Test Credentials
- WW Admin: admin@wildlife.ai (password: {test_password})
- Project Admin: projectadmin@org.com (password: {test_password})
- Project Member: member@org.com (password: {test_password})

## ⚠️ Known Issues
- None

## 📚 API Documentation
See: project-context/MVP2-Tasks/task-12-api-docs.md
```

---

## 🚀 Deployment Checklist

**Backend developer:**

1. **Create migration files** for all new functions/triggers
2. **Run migrations** on dev environment: `supabase db push`
3. **Verify deployment**: Check functions created successfully
4. **Run integration tests**: Ensure all passing
5. **Create test data**: Seed with realistic projects/users
6. **Update PROJECT-STATUS.md**: Mark Task 12 backend complete
7. **Notify mobile team**: Backend ready for integration

---

**Document Status**: ✅ Ready for Backend Implementation
**Coordination**: Copy to `~/wildlife-watcher-backend/project-context/MVP2-Tasks/task-12-mobile-requirements.md`
