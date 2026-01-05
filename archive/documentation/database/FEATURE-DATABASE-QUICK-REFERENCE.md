# Feature-to-Database Quick Reference

**Purpose**: Fast lookup guide connecting mobile app features to database tables and security rules
**Audience**: Developers, Product Managers, Stakeholders
**Last Updated**: October 17, 2025

---

## Quick Navigation

| What You Want to Know | Go To Section |
|-----------------------|---------------|
| What tables support a feature | [Feature Mapping](#feature-mapping) |
| What a specific table does | [Table Directory](#table-directory) |
| Who can access what data | [Access Control Matrix](#access-control-matrix) |
| Security rules for operations | [Operation Security](#operation-security) |

---

## Feature Mapping

### 🏢 Organization Management

**User Actions**: Create organization, invite users, manage settings

**Database Tables**:
```
PRIMARY:
- organisations (stores org details)
- user_organisations (links users to orgs)
- user_roles (defines permissions)

SECONDARY:
- admin_audit_log (tracks admin actions)
```

**Who Can Do What**:
- ✅ **WW Admin**: Create org, invite users, manage settings
- ✅ **Model Manager**: Invite users, update org settings
- ❌ **Project Admin**: View org only
- ❌ **Project Member**: View org only

**Key Security Rules**:
- Only WW Admins can create organizations
- Users only see orgs they belong to
- Model Managers can invite users to their org
- All admin actions logged to audit trail

---

### 📋 Project Management

**User Actions**: Create project, configure settings, manage team

**Database Tables**:
```
PRIMARY:
- projects (project details)
- user_roles (role assignments)

SECONDARY:
- organisations (parent org)
- admin_audit_log (team changes)
```

**Who Can Do What**:
- ✅ **WW Admin**: Full access (within their org)
- ✅ **Model Manager**: View all org projects
- ✅ **Project Admin**: Create, manage own projects
- ✅ **Project Member**: View assigned projects

**Key Security Rules**:
- Project Admins+ can create projects
- Projects auto-scoped to user's organization
- Cannot create projects in other organizations
- Privacy level controls visibility

---

### 👥 Team Management

**User Actions**: Add/remove members, assign roles, view team

**Database Tables**:
```
PRIMARY:
- user_roles (role assignments with scope)
- admin_audit_log (membership changes)

SECONDARY:
- user_organisations (org membership validation)
- project_members (legacy - may be replaced)
```

**Who Can Do What**:
- ✅ **WW Admin**: Manage all teams in their org
- ✅ **Model Manager**: Manage org-level roles
- ✅ **Project Admin**: Manage project teams
- ❌ **Project Member**: View team only

**Key Security Rules**:
- Can only add users from same organization
- Cannot grant roles higher than own role
- All changes logged to immutable audit trail
- Removed users lose access immediately

---

### 🎥 Camera Deployment

**User Actions**: Create deployment, add location, upload photos

**Database Tables**:
```
PRIMARY:
- deployments (deployment records + location)
- devices (camera equipment)

SECONDARY:
- projects (parent project)
- deployment_statuses (Planned/Started/Ended)
- capture_methods (Activity Detection/TimeLapse)
```

**Who Can Do What**:
- ✅ **Project Member+**: Create deployments
- ✅ **Deployment Creator**: Update own deployments
- ✅ **Project Admin**: Update all deployments
- ❌ **Non-members**: No access

**Key Security Rules**:
- Can only deploy in assigned projects
- Creator owns their deployments
- Project Admins can manage all deployments
- Geographic data uses PostGIS for spatial queries

---

### 📍 Location & Mapping

**User Actions**: View deployment map, search by location, analyze coverage

**Database Tables**:
```
PRIMARY:
- deployments (PostGIS geography column)

CAPABILITIES:
- Find nearby deployments (within X km)
- Calculate distances between sites
- Cluster analysis by geographic grid
- Area coverage calculations
```

**Who Can Access**:
- ✅ **Project Member+**: View deployment locations
- ✅ **Model Manager**: View all org deployment locations
- ✅ **WW Admin**: View all org deployment locations

**Technical Details**:
- **Coordinate System**: WGS 84 (SRID 4326)
- **Data Type**: PostGIS geography (earth-aware)
- **Performance**: GiST spatial index for fast queries
- **Accuracy**: GPS-level precision (~10m)

---

### 📱 Device Management

**User Actions**: Register cameras, track inventory, view device history

**Database Tables**:
```
PRIMARY:
- devices (equipment details)

SECONDARY:
- deployments (device usage history)
- projects (via deployments)
```

**Who Can Do What**:
- ✅ **Project Member+**: Register devices
- ✅ **Project Admin**: Manage device inventory
- ✅ **Model Manager**: View all org devices

**Key Security Rules**:
- Devices accessible via deployments
- Project-level access control
- Cannot see devices from other orgs

---

### 🔐 Audit & Compliance

**User Actions**: View action history, track changes, compliance reporting

**Database Tables**:
```
PRIMARY:
- admin_audit_log (immutable admin actions)
- api_logs (system activity)

LOGGED ACTIONS:
- Team membership changes
- Role assignments/removals
- Organization updates
- Project modifications
```

**Who Can Access**:
- ✅ **WW Admin**: View all audit logs
- ✅ **Action Owner**: View own actions
- ❌ **Other Users**: No access

**Key Features**:
- **Immutable**: Cannot edit/delete audit records
- **Complete History**: Before/after values captured
- **Attribution**: User + timestamp on every action
- **Compliance**: GDPR/audit trail requirements

---

## Table Directory

### Core Business Tables

| Table | Purpose | Record Count (typical) | Key Features |
|-------|---------|------------------------|--------------|
| **organisations** | Research institutions | 10-100 | Multi-tenant foundation |
| **users** | User profiles | 100-1000 | Links to Supabase auth |
| **user_organisations** | Org membership | 100-1000 | Many-to-many junction |
| **user_roles** | Permission assignments | 200-2000 | Hierarchical, expiring roles |
| **projects** | Monitoring projects | 50-500 | Privacy controls, metadata |
| **deployments** | Camera instances | 500-5000 | PostGIS locations, photos |
| **devices** | Physical equipment | 100-1000 | Serial numbers, firmware |
| **project_members** | Team access (legacy?) | 200-2000 | May be replaced by user_roles |

### Lookup/Reference Tables

| Table | Purpose | Record Count | Update Frequency |
|-------|---------|--------------|------------------|
| **roles** | Role definitions | 4 (fixed) | Rarely |
| **capture_methods** | Detection types | 2 (fixed) | Rarely |
| **deployment_statuses** | Status options | 3 (fixed) | Rarely |
| **log_levels** | Severity levels | 8 (fixed) | Never |

### System Tables

| Table | Purpose | Record Count (typical) | Retention |
|-------|---------|------------------------|-----------|
| **api_logs** | API activity | 10,000-100,000+ | 90 days |
| **admin_audit_log** | Admin actions | 1,000-10,000 | Permanent |

---

## Access Control Matrix

### By Role

| Role | Organizations | Projects | Deployments | Devices | Team Mgmt | Audit Logs |
|------|---------------|----------|-------------|---------|-----------|------------|
| **WW Admin** | Create, manage (own orgs) | Full (own orgs) | Full (own orgs) | Full (own orgs) | Full | View all |
| **Model Manager** | View, update (own org) | View all (own org) | View all (own org) | View all (own org) | Org-level | View own |
| **Project Admin** | View (own org) | Create, manage | Manage all | Manage | Project-level | View own |
| **Project Member** | View (own org) | View assigned | Create, manage own | View | View only | No access |

### By Table

| Table | Create | Read | Update | Delete | Soft Delete |
|-------|--------|------|--------|--------|-------------|
| **organisations** | WW Admin only | Members + WW Admin | WW Admin, Model Manager | N/A | WW Admin |
| **user_roles** | Admins (can't escalate) | Self + Managers | Admins | N/A | Admins |
| **projects** | Project Admin+ | Org members | Project Admin+ | N/A | Project Admin+ |
| **deployments** | Project Member+ | Project members | Creator + Admin | N/A | Creator + Admin |
| **admin_audit_log** | Authenticated (via functions) | WW Admin, Self | **NEVER** | **NEVER** | **NEVER** |

---

## Operation Security

### Creating Records

#### Create Organization
```
Required Role: ww_admin (system scope)
Required Membership: N/A (system level)
Validation:
  ✅ User has ww_admin role
  ✅ created_by = current user
Result: Organization created, user added as member
```

#### Create Project
```
Required Role: project_admin+ (org or system scope)
Required Membership: User belongs to organization
Validation:
  ✅ User has project_admin role or higher
  ✅ User is member of target organization
  ✅ organisation_id set to user's org
Result: Project created with owner_id = current user
```

#### Create Deployment
```
Required Role: project_member+ (project or org scope)
Required Membership: User has access to project
Validation:
  ✅ User has project_member role or higher
  ✅ User belongs to project's organization
  ✅ Project exists and not deleted
Result: Deployment created with user_id = creator
```

#### Add Team Member
```
Required Role: project_admin+ (for target project)
Required Membership: Both users in same organization
Validation:
  ✅ Admin has project_admin role
  ✅ Target user in same organization
  ✅ Cannot grant role higher than own
  ✅ Log to admin_audit_log
Result: user_roles record created, target gains access
```

---

### Reading Records

#### View Organizations
```
Filter: User is member of organization
Security Policy:
  user_organisations.user_id = current_user
  OR has_system_role('ww_admin')
Result: Only user's organizations shown
```

#### View Projects
```
Filter: User belongs to project's organization
Security Policy:
  user belongs to project.organisation_id
  AND respects privacy_level
Result: Only accessible projects shown
```

#### View Deployments
```
Filter: User has access to deployment's project
Security Policy:
  User has role in deployment.project_id
  OR user in project's organisation
Result: Only authorized deployments shown
```

---

### Updating Records

#### Update Organization
```
Required Role: ww_admin OR model_manager (for that org)
Validation:
  ✅ has_system_role('ww_admin')
  OR has_organisation_role(org_id, 'model_manager')
Result: Organization updated
```

#### Update Project
```
Required Role: project_admin+ (for that project)
Validation:
  ✅ has_project_role(project_id, 'project_admin')
  OR higher role in organization
Result: Project updated
```

#### Update Deployment
```
Required Role: Deployment creator OR project_admin+
Validation:
  ✅ user_id = creator (can update own)
  OR has_project_role(project_id, 'project_admin')
Result: Deployment updated
```

---

### Deleting Records

#### Soft Delete Organization
```
Required Role: ww_admin only
Operation: SET deleted_at = NOW()
Validation:
  ✅ has_system_role('ww_admin')
  ✅ organization currently active (deleted_at IS NULL)
Result: Organization marked deleted, hidden from queries
Recovery: WW Admin can unset deleted_at
```

#### Soft Delete Project
```
Required Role: project_admin+ (for that project)
Operation: SET deleted_at = NOW()
Validation:
  ✅ has_project_role(project_id, 'project_admin')
  ✅ project currently active
Result: Project marked deleted
Recovery: Project Admin+ can unset deleted_at
```

#### Remove Team Member
```
Required Role: project_admin+ (for that project)
Operation: Soft delete user_roles record
Validation:
  ✅ has_project_role(project_id, 'project_admin')
  ✅ Cannot remove role equal/higher than own
  ✅ Log to admin_audit_log
Result: User role marked deleted, access revoked
```

---

## Common Query Patterns

### Get User's Organizations
```sql
-- What: Organizations user belongs to
-- Tables: organisations, user_organisations
SELECT o.*
FROM organisations o
JOIN user_organisations uo ON uo.organisation_id = o.id
WHERE uo.user_id = current_user_id
  AND uo.deleted_at IS NULL
  AND o.deleted_at IS NULL
```

### Get User's Roles
```sql
-- What: All active roles for user
-- Tables: user_roles
SELECT *
FROM user_roles
WHERE user_id = current_user_id
  AND is_active = true
  AND deleted_at IS NULL
  AND (expires_at IS NULL OR expires_at > NOW())
```

### Get Organization's Projects
```sql
-- What: All projects in organization
-- Tables: projects, user_organisations
SELECT p.*
FROM projects p
WHERE p.organisation_id IN (
  SELECT organisation_id
  FROM user_organisations
  WHERE user_id = current_user_id
    AND deleted_at IS NULL
)
AND p.deleted_at IS NULL
```

### Get Project Deployments
```sql
-- What: All deployments in project
-- Tables: deployments, user_roles (via RLS)
SELECT d.*
FROM deployments d
WHERE d.project_id = target_project_id
  AND d.deleted_at IS NULL
-- RLS automatically filters by user access
```

### Find Nearby Deployments
```sql
-- What: Deployments within 10km of point
-- Tables: deployments (PostGIS)
SELECT
  d.*,
  ST_Distance(d.location, ST_GeogFromText('POINT(lon lat)')) as distance_meters
FROM deployments d
WHERE ST_DWithin(
  d.location,
  ST_GeogFromText('POINT(lon lat)'),
  10000  -- 10km in meters
)
  AND d.deleted_at IS NULL
ORDER BY distance_meters
```

---

## Security Checklist

### Before Any Operation, Check:

1. **Authentication**
   - ✅ User is authenticated (valid JWT)
   - ✅ JWT contains user ID claim

2. **Authorization**
   - ✅ User has required role
   - ✅ Role scope matches operation scope
   - ✅ Role is active and not expired

3. **Membership**
   - ✅ User belongs to target organization
   - ✅ User has access to target project (if applicable)

4. **Data Integrity**
   - ✅ Target record exists
   - ✅ Target record not soft-deleted
   - ✅ Foreign keys valid

5. **Audit Trail**
   - ✅ Admin actions logged
   - ✅ Attribution captured (who, what, when)

---

## Common Security Patterns

### Pattern 1: Organization Membership Check
```sql
-- Verify user belongs to organization
EXISTS (
  SELECT 1
  FROM user_organisations uo
  WHERE uo.user_id = current_user_id
    AND uo.organisation_id = target_org_id
    AND uo.deleted_at IS NULL
)
```

### Pattern 2: Role Check with Hierarchy
```sql
-- Check if user has required role (with inheritance)
has_project_role(user_id, project_id, 'project_admin')
-- Checks: Direct project role → Org-level role → System admin
```

### Pattern 3: Privilege Escalation Prevention
```sql
-- User can only grant roles they already have
-- Cannot grant:
--   - Higher role than own role
--   - Role in scope they don't have access to
--   - System roles (unless they're WW Admin)
```

### Pattern 4: Multi-Tenant Filtering
```sql
-- Automatic filtering by organization membership
-- Applied to: Projects, Deployments, Devices
WHERE entity.organisation_id IN (
  SELECT organisation_id
  FROM user_organisations
  WHERE user_id = current_user_id
    AND deleted_at IS NULL
)
```

---

## Troubleshooting Guide

### User Can't See Organization
**Possible Causes**:
- ❌ Not a member (no user_organisations record)
- ❌ Membership soft-deleted (deleted_at set)
- ❌ Organization soft-deleted
- ❌ RLS policy preventing access

**Check**:
```sql
-- Verify membership exists
SELECT * FROM user_organisations
WHERE user_id = '<user_id>'
  AND organisation_id = '<org_id>';

-- Check if deleted
SELECT deleted_at FROM organisations WHERE id = '<org_id>';
```

---

### User Can't Create Project
**Possible Causes**:
- ❌ Doesn't have project_admin role or higher
- ❌ Not member of target organization
- ❌ Role expired or inactive
- ❌ Trying to create in wrong organization

**Check**:
```sql
-- Verify user has required role
SELECT * FROM user_roles
WHERE user_id = '<user_id>'
  AND role IN ('project_admin', 'model_manager', 'ww_admin')
  AND is_active = true
  AND deleted_at IS NULL;

-- Check organization membership
SELECT * FROM user_organisations
WHERE user_id = '<user_id>'
  AND organisation_id = '<org_id>'
  AND deleted_at IS NULL;
```

---

### User Can't Access Project
**Possible Causes**:
- ❌ Not member of project's organization
- ❌ Project privacy level restricts access
- ❌ Project soft-deleted
- ❌ No role assignment for private projects

**Check**:
```sql
-- Check project access
SELECT
  p.id,
  p.organisation_id,
  p.privacy_level,
  uo.user_id as user_is_org_member,
  ur.role as user_project_role
FROM projects p
LEFT JOIN user_organisations uo
  ON uo.organisation_id = p.organisation_id
  AND uo.user_id = '<user_id>'
LEFT JOIN user_roles ur
  ON ur.scope_id = p.id
  AND ur.user_id = '<user_id>'
  AND ur.scope_type = 'project'
WHERE p.id = '<project_id>';
```

---

### Deployment Not Showing on Map
**Possible Causes**:
- ❌ Location field NULL or invalid
- ❌ Wrong coordinate format (latitude/longitude swapped)
- ❌ Deployment soft-deleted
- ❌ User doesn't have access to project

**Check**:
```sql
-- Verify deployment location data
SELECT
  id,
  location_name,
  latitude,
  longitude,
  location,  -- PostGIS geography
  deleted_at,
  project_id
FROM deployments
WHERE id = '<deployment_id>';

-- Check if valid PostGIS point
SELECT ST_AsText(location) FROM deployments WHERE id = '<deployment_id>';
```

---

## Performance Tips

### For Developers

1. **Use Indexed Columns**
   - Filter by: user_id, organisation_id, project_id (all indexed)
   - Avoid: Full table scans, JSON field queries

2. **Leverage RLS Functions**
   - Use helper functions: `has_project_role()`, `has_organisation_role()`
   - Don't reimplement role checks in app code

3. **Batch Queries**
   - Fetch related data in single query with JOINs
   - Use Supabase's query builder for optimization

4. **Geographic Queries**
   - PostGIS queries are fast with GiST index
   - Use `ST_DWithin` instead of calculating distances

5. **Cache Reference Data**
   - Lookup tables (roles, statuses, methods) rarely change
   - Cache on client to reduce API calls

---

## Quick Reference: Supabase Functions

### Role Checking
```javascript
// Check if user can manage project
const { data: canManage } = await supabase
  .rpc('has_project_role', {
    user_id: user.id,
    project_id: projectId,
    required_role: 'project_admin'
  });

// Check organization-level role
const { data: isModelManager } = await supabase
  .rpc('has_organisation_role', {
    user_id: user.id,
    organisation_id: orgId,
    required_role: 'model_manager'
  });
```

### Team Management
```javascript
// Add project member (via API or function)
const { data, error } = await supabase
  .from('user_roles')
  .insert({
    user_id: targetUserId,
    role: 'project_member',
    scope_type: 'project',
    scope_id: projectId,
    granted_by: currentUserId
  });

// Remove project member (soft delete)
const { data, error } = await supabase
  .from('user_roles')
  .update({ deleted_at: new Date().toISOString() })
  .eq('user_id', targetUserId)
  .eq('scope_id', projectId)
  .eq('scope_type', 'project');
```

### Geographic Queries
```javascript
// Find deployments near location
const { data: nearbyDeployments } = await supabase
  .rpc('deployments_near_point', {
    target_lat: -2.3333,
    target_lon: 34.8333,
    radius_meters: 10000
  });
```

---

## Document History

- **2025-10-17**: Initial creation
- **Purpose**: Quick reference for feature-database mappings
- **Target Audience**: Developers, Product Managers, QA
- **Related Docs**: See STAKEHOLDER-DATABASE-SUMMARY.md for detailed explanations

---

**Questions or Updates?**
Contact technical lead or update this document via PR to backend repository.
