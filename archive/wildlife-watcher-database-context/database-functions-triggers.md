# Wildlife Watcher Database: Functions and Triggers Documentation

## Overview

This document provides comprehensive technical documentation of all database functions and triggers implemented in the Wildlife Watcher backend. These components provide automated data management, security enforcement, and business logic implementation.

## Database Functions

### 1. **set_updated_at()** - Timestamp Management Function

**File**: `schemas/public/functions/20_set_updated_at.sql`

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;
```

- **Purpose**: Automatically updates the `updated_at` timestamp field on record modifications
- **Type**: Trigger function
- **Parameters**: None (operates on NEW record in trigger context)
- **Return Type**: `trigger`
- **Security**: `SECURITY INVOKER` (uses caller's permissions)
- **Logic**: Sets `new.updated_at` to current timestamp (`now()`)
- **Usage**: Called by UPDATE triggers across all tables to maintain audit trails

---

### 2. **has_project_role(p_project_id uuid, p_role text)** - Authorization Helper

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

- **Purpose**: Validates if the current authenticated user has a specific role within a project
- **Parameters**: 
  - `p_project_id` (uuid): Project identifier to check
  - `p_role` (text): Role name to validate ('admin', 'user', etc.)
- **Return Type**: `boolean`
- **Security**: `SECURITY INVOKER` with secure search path
- **Logic**: 
  - Joins `project_members` and `roles` tables
  - Checks if `auth.uid()` (current user) has the specified role in the project
  - Returns true if role exists, false otherwise
- **Usage**: Core authorization function used in RLS policies and other business functions

---

### 3. **sync_geolocation()** - Spatial Data Synchronization

**File**: `schemas/public/functions/22_sync_geolocation.sql`

```sql
CREATE OR REPLACE FUNCTION public.sync_geolocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF new.latitude IS NOT NULL AND new.longitude IS NOT NULL THEN
    new.location = ST_SetSRID(ST_MakePoint(new.longitude, new.latitude), 4326);
  ELSE
    new.location = NULL;
  END IF;
  RETURN new;
END;
$$;
```

- **Purpose**: Automatically converts latitude/longitude coordinates to PostGIS geography type
- **Type**: Trigger function
- **Parameters**: None (operates on NEW record)
- **Return Type**: `trigger`
- **Logic**: 
  - Checks if both latitude and longitude are provided
  - Creates PostGIS point using `ST_MakePoint()` with WGS84 SRID (4326)
  - Sets location field to NULL if coordinates are missing
- **Usage**: Maintains spatial data consistency when coordinates are updated in deployments table

---

### 4. **soft_delete_deployment(p_id uuid)** - Deployment Soft Delete

**File**: `schemas/public/functions/23_soft_delete_deployment.sql`

```sql
CREATE OR REPLACE FUNCTION public.soft_delete_deployment(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.deployments
  SET deleted_at = now()
  WHERE id = p_id
    AND user_id = auth.uid()
    AND deleted_at IS NULL;
END;
$$;
```

- **Purpose**: Safely soft deletes deployments with ownership verification
- **Parameters**: `p_id` (uuid): Deployment ID to delete
- **Return Type**: `void`
- **Security**: Only deployment owners can delete their own deployments
- **Logic**: 
  - Sets `deleted_at` timestamp to current time
  - Validates ownership (`user_id = auth.uid()`)
  - Only affects non-deleted records (`deleted_at IS NULL`)
- **Usage**: API endpoint for safe deployment removal by creators

---

### 5. **soft_delete_project(p_id uuid)** - Project Soft Delete with Authorization

**File**: `schemas/public/functions/24_soft_delete_project.sql`

```sql
CREATE OR REPLACE FUNCTION public.soft_delete_project(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_project_role(p_id, 'admin') THEN
    RAISE EXCEPTION 'Access denied: Only project admins can delete projects';
  END IF;
  
  UPDATE public.projects
  SET deleted_at = now()
  WHERE id = p_id
    AND deleted_at IS NULL;
END;
$$;
```

- **Purpose**: Soft deletes projects with admin permission verification
- **Parameters**: `p_id` (uuid): Project ID to delete
- **Return Type**: `void`
- **Security**: Only project admins can delete projects
- **Logic**: 
  - Validates admin permissions using `has_project_role(p_id, 'admin')`
  - Raises exception if user lacks admin rights
  - Sets `deleted_at` timestamp for authorized deletions
- **Usage**: API endpoint for project deletion with role-based access control

---

### 6. **soft_remove_project_member(p_project_id uuid, p_user_id uuid)** - Member Removal

**File**: `schemas/public/functions/25_soft_remove_project_member.sql`

```sql
CREATE OR REPLACE FUNCTION public.soft_remove_project_member(p_project_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_project_role(p_project_id, 'admin') THEN
    RAISE EXCEPTION 'Access denied: Only project admins can remove members';
  END IF;
  
  UPDATE public.project_members
  SET deleted_at = now()
  WHERE project_id = p_project_id
    AND user_id = p_user_id
    AND deleted_at IS NULL;
END;
$$;
```

- **Purpose**: Removes project members with admin authorization
- **Parameters**: 
  - `p_project_id` (uuid): Project ID
  - `p_user_id` (uuid): User ID to remove from project
- **Return Type**: `void`
- **Security**: Only project admins can remove members
- **Logic**: 
  - Validates admin permissions using `has_project_role()`
  - Raises exception for unauthorized attempts
  - Soft deletes the project member relationship
- **Usage**: Member management functionality for project administrators

---

### 7. **soft_delete_device(p_device_id uuid)** - Device Deletion with Context-Aware Authorization

**File**: `schemas/public/functions/26_soft_delete_device.sql`

```sql
CREATE OR REPLACE FUNCTION public.soft_delete_device(p_device_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  project_id_for_device uuid;
BEGIN
  -- Find the project associated with this device through active deployments
  SELECT DISTINCT d.project_id INTO project_id_for_device
  FROM public.deployments d
  WHERE d.device_id = p_device_id
    AND d.deleted_at IS NULL
  LIMIT 1;
  
  -- Check if user is admin of the associated project
  IF project_id_for_device IS NULL OR NOT public.has_project_role(project_id_for_device, 'admin') THEN
    RAISE EXCEPTION 'Access denied: Only project admins can delete devices';
  END IF;
  
  UPDATE public.devices
  SET deleted_at = now()
  WHERE id = p_device_id
    AND deleted_at IS NULL;
END;
$$;
```

- **Purpose**: Soft deletes devices with deployment-aware permission checking
- **Parameters**: `p_device_id` (uuid): Device ID to delete
- **Return Type**: `void`
- **Security**: Context-aware authorization through project association
- **Logic**: 
  - Finds associated project through active deployments
  - Validates admin role for the associated project
  - Raises exception if no project association or insufficient permissions
  - Soft deletes the device if authorized
- **Usage**: Device management with project-based authorization context

## Database Triggers

### Timestamp Management Triggers

**File**: `schemas/public/triggers/30_triggers.sql`

All timestamp triggers follow the same pattern and execute the `set_updated_at()` function **BEFORE UPDATE** operations:

```sql
CREATE TRIGGER trg_{table_name}_updated_at
  BEFORE UPDATE ON public.{table_name}
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
```

#### Implemented Triggers:

1. **trg_deployments_updated_at** - `deployments` table
2. **trg_capture_methods_updated_at** - `capture_methods` table  
3. **trg_deployment_statuses_updated_at** - `deployment_statuses` table
4. **trg_devices_updated_at** - `devices` table
5. **trg_projects_updated_at** - `projects` table
6. **trg_project_members_updated_at** - `project_members` table
7. **trg_roles_updated_at** - `roles` table
8. **trg_log_levels_updated_at** - `log_levels` table

### Spatial Data Synchronization Trigger

```sql
CREATE TRIGGER sync_geolocation_trigger
  BEFORE INSERT OR UPDATE ON public.deployments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_geolocation();
```

- **Table**: `deployments`
- **Events**: BEFORE INSERT OR UPDATE
- **Function**: `sync_geolocation()`
- **Purpose**: Automatically maintains consistency between latitude/longitude coordinates and PostGIS geography field

## Function and Trigger Integration Patterns

### 1. **Comprehensive Audit Trail System**

**Components**: 
- `set_updated_at()` function
- Multiple timestamp triggers across all tables

**Implementation**:
- Every table modification automatically records when it occurred
- Consistent audit trail across all core business entities
- No manual timestamp management required

**Benefits**:
- Automatic compliance with audit requirements
- Consistent data tracking
- Zero developer overhead for timestamp management

### 2. **Role-Based Authorization Framework**

**Components**:
- `has_project_role()` foundation function
- Integration into all soft delete functions
- RLS policy integration

**Implementation**:
```sql
-- Example usage in soft delete functions
IF NOT public.has_project_role(p_project_id, 'admin') THEN
  RAISE EXCEPTION 'Access denied: Only project admins can delete projects';
END IF;
```

**Benefits**:
- Centralized authorization logic
- Consistent permission checking
- Supports hierarchical project-based security model

### 3. **Consistent Soft Delete Pattern**

**Components**:
- Standardized soft delete functions for all major entities
- Authorization checks in each function
- Consistent error handling

**Implementation Pattern**:
```sql
-- 1. Validate permissions
IF NOT {authorization_check} THEN
  RAISE EXCEPTION 'Access denied: {specific_message}';
END IF;

-- 2. Perform soft delete
UPDATE {table_name}
SET deleted_at = now()
WHERE {conditions}
  AND deleted_at IS NULL;
```

**Benefits**:
- Data preservation while supporting logical deletion
- Consistent authorization patterns
- Prevents unauthorized deletions

### 4. **Automated Spatial Data Management**

**Components**:
- `sync_geolocation()` function
- `sync_geolocation_trigger` on deployments table

**Implementation**:
- Automatic conversion from coordinate pairs to PostGIS geography objects
- Handles NULL coordinate scenarios gracefully
- Maintains data consistency without manual intervention

**Benefits**:
- Supports GIS operations and spatial queries
- Eliminates coordinate/geography sync issues
- Zero developer overhead for spatial data management

## Security Features

### 1. **Secure Function Design**
- All functions use `SECURITY INVOKER` (caller's permissions)
- `SET search_path = ''` prevents search path injection attacks
- Integration with Supabase Auth (`auth.uid()`) for user context

### 2. **Authorization Patterns**
- Role-based authorization through `has_project_role()`
- Context-aware permissions (device deletion through project association)
- Explicit permission validation with meaningful error messages

### 3. **Data Integrity**
- Soft delete pattern preserves referential integrity
- Automatic timestamp management prevents data inconsistencies
- Spatial data synchronization ensures geographic accuracy

## Performance Considerations

### 1. **Efficient Authorization Queries**
- `has_project_role()` uses optimal JOIN pattern
- EXISTS clause for efficient boolean returns
- Proper indexing supports fast permission checks

### 2. **Trigger Performance**
- Lightweight timestamp triggers with minimal overhead
- Spatial trigger only activates when coordinates change
- No cascading trigger dependencies

### 3. **Function Optimization**
- Single-purpose functions minimize execution time
- Early returns and exception handling
- Efficient query patterns with proper WHERE clauses

## Maintenance and Extensibility

### 1. **Consistent Patterns**
- Standardized naming conventions
- Consistent error handling approach
- Modular design allows easy extension

### 2. **Documentation Standards**
- Clear function documentation
- Consistent parameter naming
- Meaningful error messages

### 3. **Future Enhancements**
- Framework supports additional roles and permissions
- Soft delete pattern can be extended to new entities
- Spatial framework ready for advanced GIS features

This procedural component architecture provides a robust, secure, and maintainable foundation for the Wildlife Watcher application, ensuring data consistency, security, and performance while supporting complex business logic requirements.