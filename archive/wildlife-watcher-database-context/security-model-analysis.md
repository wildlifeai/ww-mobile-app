# Wildlife Watcher Database Security Model Analysis

## Overview

This document provides a comprehensive analysis of the security model implemented in the Wildlife Watcher database. The system uses Supabase's Row Level Security (RLS) combined with custom authorization functions to implement a robust multi-tenant security architecture.

## Security Architecture Summary

The Wildlife Watcher database implements a **multi-layered security model** with the following components:

1. **Authentication Layer**: Supabase Auth integration
2. **Authorization Layer**: Role-based access control (RBAC) 
3. **Data Access Layer**: Row Level Security policies
4. **Function Security**: Procedural authorization checks
5. **Audit Layer**: Comprehensive logging and tracking

## Row Level Security (RLS) Configuration

### RLS-Enabled Tables

**File**: `schemas/public/rls/40_rls_enable.sql`

```sql
-- Enable RLS on all security-sensitive tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

**Security Scope**: 6 core tables with comprehensive data protection

**Excluded Tables**: Lookup tables (`roles`, `capture_methods`, `deployment_statuses`, `log_levels`) remain accessible to authenticated users for reference data.

## Detailed Security Policies by Table

### 1. **PROJECTS Table Security**

**File**: `schemas/public/policies/50_projects.sql`

#### Policy: "Authenticated users can create projects"
```sql
CREATE POLICY "Authenticated users can create projects" ON projects
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
```
- **Operation**: INSERT
- **Target**: authenticated users
- **Logic**: User must be authenticated AND be the creator (`created_by = auth.uid()`)
- **Purpose**: Ensures only authenticated users can create projects they own

#### Policy: "Project members can view active projects"
```sql
CREATE POLICY "Project members can view active projects" ON projects
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL 
    AND (
      EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = projects.id
          AND pm.user_id = auth.uid()
          AND pm.deleted_at IS NULL
      )
    )
  );
```
- **Operation**: SELECT
- **Target**: authenticated users
- **Logic**: User must be a project member AND project is not soft-deleted
- **Purpose**: Project-based data isolation with membership verification

#### Policy: "Project admins can update projects"
```sql
CREATE POLICY "Project admins can update projects" ON projects
  FOR UPDATE TO authenticated
  USING (has_project_role(id, 'admin'));
```
- **Operation**: UPDATE
- **Target**: authenticated users
- **Logic**: User must have 'admin' role in the project
- **Purpose**: Role-based update permissions

#### Policy: "Project admins can soft-delete projects"
```sql
CREATE POLICY "Project admins can soft-delete projects" ON projects
  FOR UPDATE TO authenticated
  USING (has_project_role(id, 'admin'))
  WITH CHECK (deleted_at IS NOT NULL);
```
- **Operation**: UPDATE (soft delete)
- **Target**: authenticated users
- **Logic**: User must have 'admin' role AND can only set `deleted_at` field
- **Purpose**: Controlled project deletion with role verification

---

### 2. **PROJECT_MEMBERS Table Security**

**File**: `schemas/public/policies/51_project_members.sql`

#### Policy: "Users can view their own active memberships"
```sql
CREATE POLICY "Users can view their own active memberships" ON project_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);
```
- **Operation**: SELECT
- **Target**: authenticated users
- **Logic**: Users can only see their own memberships (`user_id = auth.uid()`) AND not soft-deleted
- **Purpose**: Personal membership visibility with privacy protection

#### Policy: "Admins can add members"
```sql
CREATE POLICY "Admins can add members" ON project_members
  FOR INSERT TO authenticated
  WITH CHECK (has_project_role(project_id, 'admin'));
```
- **Operation**: INSERT
- **Target**: authenticated users
- **Logic**: Only project admins can add new members
- **Purpose**: Controlled membership management

#### Policy: "Admins can update members"
```sql
CREATE POLICY "Admins can update members" ON project_members
  FOR UPDATE TO authenticated
  USING (has_project_role(project_id, 'admin'));
```
- **Operation**: UPDATE
- **Target**: authenticated users
- **Logic**: Only project admins can modify member details
- **Purpose**: Administrative control over member properties

#### Policy: "Admins can soft-remove members"
```sql
CREATE POLICY "Admins can soft-remove members" ON project_members
  FOR UPDATE TO authenticated
  USING (has_project_role(project_id, 'admin'))
  WITH CHECK (deleted_at IS NOT NULL);
```
- **Operation**: UPDATE (soft delete)
- **Target**: authenticated users
- **Logic**: Only project admins can soft-delete members
- **Purpose**: Controlled member removal

---

### 3. **DEPLOYMENTS Table Security**

**File**: `schemas/public/policies/52_deployments.sql`

#### Policy: "Project members can view active deployments"
```sql
CREATE POLICY "Project members can view active deployments" ON deployments
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND has_project_role(project_id, 'user')
  );
```
- **Operation**: SELECT
- **Target**: authenticated users
- **Logic**: Any project member can view deployments in their projects
- **Purpose**: Project-scoped deployment visibility

#### Policy: "Project members can create deployments"
```sql
CREATE POLICY "Project members can create deployments" ON deployments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND has_project_role(project_id, 'user')
  );
```
- **Operation**: INSERT
- **Target**: authenticated users
- **Logic**: Any project member can create deployments in their projects
- **Purpose**: Collaborative deployment creation

#### Policy: "Deployment creator can update own deployments"
```sql
CREATE POLICY "Deployment creator can update own deployments" ON deployments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
```
- **Operation**: UPDATE
- **Target**: authenticated users
- **Logic**: Users can only update deployments they created
- **Purpose**: Creator-based ownership control

#### Policy: "Deployment creator can soft-delete own deployments"
```sql
CREATE POLICY "Deployment creator can soft-delete own deployments" ON deployments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (deleted_at IS NOT NULL);
```
- **Operation**: UPDATE (soft delete)
- **Target**: authenticated users
- **Logic**: Users can only soft-delete deployments they created
- **Purpose**: Self-service deployment management

#### Policy: "Project admins can update deployments"
```sql
CREATE POLICY "Project admins can update deployments" ON deployments
  FOR UPDATE TO authenticated
  USING (has_project_role(project_id, 'admin'));
```
- **Operation**: UPDATE
- **Target**: authenticated users
- **Logic**: Project admins can update any deployment in their projects
- **Purpose**: Administrative override for deployment management

#### Policy: "Project admins can soft-delete deployments"
```sql
CREATE POLICY "Project admins can soft-delete deployments" ON deployments
  FOR UPDATE TO authenticated
  USING (has_project_role(project_id, 'admin'))
  WITH CHECK (deleted_at IS NOT NULL);
```
- **Operation**: UPDATE (soft delete)
- **Target**: authenticated users
- **Logic**: Project admins can soft-delete any deployment in their projects
- **Purpose**: Administrative deployment cleanup

---

### 4. **DEVICES Table Security**

**File**: `schemas/public/policies/53_devices.sql`

#### Policy: "Project members can view active devices"
```sql
CREATE POLICY "Project members can view active devices" ON devices
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM deployments d
      WHERE d.device_id = devices.id
        AND d.deleted_at IS NULL
        AND has_project_role(d.project_id, 'user')
    )
  );
```
- **Operation**: SELECT
- **Target**: authenticated users
- **Logic**: Members can view devices linked to deployments in their projects
- **Purpose**: Transitive access through deployment association

#### Policy: "Admins can update devices"
```sql
CREATE POLICY "Admins can update devices" ON devices
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deployments d
      WHERE d.device_id = devices.id
        AND d.deleted_at IS NULL
        AND has_project_role(d.project_id, 'admin')
    )
  );
```
- **Operation**: UPDATE
- **Target**: authenticated users
- **Logic**: Only project admins can update devices (through deployment association)
- **Purpose**: Administrative device management through project context

#### Policy: "Admins can soft-delete devices"
```sql
CREATE POLICY "Admins can soft-delete devices" ON devices
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deployments d
      WHERE d.device_id = devices.id
        AND d.deleted_at IS NULL
        AND has_project_role(d.project_id, 'admin')
    )
  )
  WITH CHECK (deleted_at IS NOT NULL);
```
- **Operation**: UPDATE (soft delete)
- **Target**: authenticated users
- **Logic**: Only project admins can soft-delete devices
- **Purpose**: Administrative device lifecycle management

---

### 5. **API_LOGS Table Security**

**File**: `schemas/public/policies/54_api_logs.sql`

#### Policy: "Project admins can view logs"
```sql
CREATE POLICY "Project admins can view logs" ON api_logs
  FOR SELECT TO authenticated
  USING (
    project_id IS NOT NULL
    AND has_project_role(project_id, 'admin')
  );
```
- **Operation**: SELECT
- **Target**: authenticated users
- **Logic**: Only project admins can view API logs for their projects
- **Purpose**: Administrative audit access with project isolation

---

## Authorization Framework

### Core Authorization Function: `has_project_role()`

**File**: `schemas/public/functions/21_has_project_role.sql`

```sql
CREATE OR REPLACE FUNCTION public.has_project_role(p_project_id uuid, p_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN exists (
    SELECT 1
    FROM public.project_members pm
    JOIN public.roles r ON r.id = pm.role_id
    WHERE pm.project_id = p_project_id
      AND pm.user_id = auth.uid()
      AND r.value = p_role
  );
END;
$$;
```

**Functionality**:
- Checks if current user (`auth.uid()`) has specific role in given project
- Joins `project_members` and `roles` tables for role resolution
- Returns boolean for easy policy integration
- Used throughout RLS policies for consistent authorization

**Security Features**:
- `SECURITY INVOKER`: Uses caller's permissions
- `SET search_path = ''`: Prevents search path injection attacks
- Optimized query pattern for performance

## Role-Based Access Control (RBAC) Model

### Role Hierarchy

1. **Anonymous Users**
   - **Access**: None
   - **Operations**: No access to protected data

2. **Authenticated Users**
   - **Access**: Can create new projects
   - **Operations**: Project creation only

3. **Project Members** (`user` role)
   - **Access**: View project data, create deployments
   - **Operations**: 
     - View projects, deployments, devices
     - Create deployments
     - View own project memberships

4. **Deployment Creators**
   - **Access**: Manage own deployments + member access
   - **Operations**: 
     - All member operations
     - Update/delete own deployments

5. **Project Administrators** (`admin` role)
   - **Access**: Full project management
   - **Operations**: 
     - All member and creator operations
     - Manage project settings
     - Manage all deployments in project
     - Manage project memberships
     - View project API logs
     - Manage devices

### Access Control Matrix

| Role | Projects | Members | Deployments | Devices | API Logs |
|------|----------|---------|-------------|---------|----------|
| **Anonymous** | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None |
| **Authenticated** | ✅ Create | ❌ None | ❌ None | ❌ None | ❌ None |
| **Member** | 👁️ View own | 👁️ View own | 👁️ View, ✅ Create | 👁️ View | ❌ None |
| **Creator** | 👁️ View own | 👁️ View own | 🔧 Manage own | 👁️ View | ❌ None |
| **Admin** | 🔧 Manage own | 🔧 Manage all | 🔧 Manage all | 🔧 Manage all | 👁️ View own |

**Legend**: ❌ None, 👁️ View, ✅ Create, 🔧 Full Management

## Security Patterns and Implementation

### 1. **Defense in Depth**

**Layer 1: Authentication**
- Supabase Auth integration
- JWT token validation
- Session management

**Layer 2: Row Level Security**
- Table-level access control
- Policy-based data filtering
- Automatic enforcement

**Layer 3: Function Authorization**
- Explicit permission checks in functions
- Role validation before operations
- Custom error messages

**Layer 4: Audit Trail**
- Comprehensive API logging
- Timestamp tracking
- Operation traceability

### 2. **Principle of Least Privilege**

**Implementation**:
- Users receive minimum necessary permissions
- Role-based escalation for administrative tasks
- No default administrative access
- Explicit permission grants only

**Examples**:
- Regular users cannot view other users' memberships
- Device access requires project association
- API logs restricted to project administrators

### 3. **Data Isolation**

**Project-Based Boundaries**:
- All data access scoped to user's project memberships
- Cross-project data access prevented
- Isolated logging per project

**User-Based Boundaries**:
- Personal data visibility (own memberships)
- Creator ownership of deployments
- Self-service operations where appropriate

### 4. **Soft Delete Security**

**Pattern**:
```sql
-- Consistent soft delete filtering
WHERE deleted_at IS NULL
```

**Benefits**:
- Data preservation for audit purposes
- Referential integrity maintenance
- Reversible deletion operations
- Historical data availability

## Security Vulnerabilities and Mitigations

### 1. **Privilege Escalation Prevention**

**Risk**: Users attempting to gain unauthorized access
**Mitigation**:
- Explicit role checking in all policies
- `has_project_role()` function for consistent validation
- No inheritance or implicit permissions

### 2. **Data Leakage Prevention**

**Risk**: Cross-project data exposure
**Mitigation**:
- Project-scoped policies on all tables
- Membership verification for all operations
- Isolated audit logs per project

### 3. **Injection Attack Prevention**

**Risk**: SQL injection and search path attacks
**Mitigation**:
- `SET search_path = ''` in all functions
- Parameterized queries in policies
- `SECURITY INVOKER` pattern

### 4. **Session Security**

**Risk**: Session hijacking or impersonation
**Mitigation**:
- Supabase Auth integration
- `auth.uid()` for user context
- JWT token validation

## Performance Considerations

### 1. **Policy Optimization**

**Efficient Patterns**:
```sql
-- Optimized EXISTS clauses
EXISTS (SELECT 1 FROM ...)

-- Early filtering with indexes
WHERE deleted_at IS NULL
```

**Indexing Strategy**:
- Indexes on `user_id`, `project_id`, `deleted_at`
- Composite indexes for common query patterns
- Performance monitoring for policy execution

### 2. **Function Performance**

**`has_project_role()` Optimization**:
- Single JOIN operation
- EXISTS clause for early termination
- Proper indexing on foreign keys

### 3. **Scaling Considerations**

**High-Volume Operations**:
- API logs designed for high insert volume
- Efficient policy evaluation
- Minimal overhead for common operations

## Monitoring and Compliance

### 1. **Audit Trail**

**Components**:
- API operation logging
- Automatic timestamp tracking
- User context preservation
- Project-level audit isolation

### 2. **Compliance Features**

**Data Protection**:
- Soft delete for GDPR compliance
- User data isolation
- Audit trail for regulatory requirements

**Access Control**:
- Role-based access documentation
- Permission audit capabilities
- Security policy enforcement

### 3. **Security Monitoring**

**Metrics**:
- Failed authorization attempts
- Policy evaluation performance
- Unusual access patterns
- Administrative operation tracking

## Best Practices and Recommendations

### 1. **Policy Development**

- Always test policies with different user roles
- Use explicit permission checks rather than implicit access
- Document security implications of policy changes
- Regular security audits of policy effectiveness

### 2. **Function Security**

- Always use `SECURITY INVOKER` for custom functions
- Set secure search paths to prevent injection
- Validate all input parameters
- Provide meaningful error messages for debugging

### 3. **Role Management**

- Regular review of project memberships
- Periodic audit of admin role assignments
- Documentation of role elevation procedures
- Monitoring of administrative operations

### 4. **Maintenance**

- Regular review of RLS policies for effectiveness
- Performance monitoring of security functions
- Testing of security boundaries with different scenarios
- Documentation updates for security model changes

This comprehensive security model provides robust protection for the Wildlife Watcher application while maintaining usability and performance for legitimate users within the wildlife monitoring context.