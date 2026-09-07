-- =============================================================================
-- REPORTING VIEWS AND FUNCTIONS
-- =============================================================================
-- Purpose: Comprehensive reporting views and functions for organisations,
--          users, projects, and system activity
-- Created: October 11, 2025
-- =============================================================================

-- =============================================================================
-- ORGANISATION REPORTING VIEWS
-- =============================================================================

-- View: organisation_summary
-- Purpose: Complete overview of each organisation with member and project counts
-- Security: Admin-only access (ww_admin role required)
CREATE OR REPLACE VIEW organisation_summary
WITH (security_invoker = true) AS
SELECT
  o.id,
  o.slug,
  o.name,
  o.is_active,
  o.created_at,
  o.updated_at,
  o.deleted_at,

  -- Creator info
  creator.email AS created_by_email,
  CONCAT(creator.firstname, ' ', creator.surname) AS created_by_name,

  -- Statistics
  COUNT(DISTINCT ur_member.user_id) FILTER (WHERE ur_member.deleted_at IS null AND ur_member.is_active = true) AS active_member_count,
  COUNT(DISTINCT p.id) FILTER (WHERE p.deleted_at IS null AND p.is_active = true) AS active_project_count,
  COUNT(DISTINCT dep.id) FILTER (WHERE dep.deleted_at IS null) AS active_deployment_count,
  COUNT(DISTINCT dep.device_id) FILTER (WHERE dep.deleted_at IS null AND dep.device_id IS NOT null) AS active_device_count,

  -- Activity metrics
  MAX(p.created_at) AS last_project_created,
  MAX(dep.created_at) AS last_deployment_created,

  -- Role distribution
  -- organisation_manager removed for MVP2
  COUNT(DISTINCT ur.user_id) FILTER (
    WHERE ur.scope_type = 'organisation'
    AND ur.scope_id = o.id
    AND ur.role = 'project_admin'
    AND ur.is_active = true
    AND ur.deleted_at IS null
  ) AS org_project_admin_count

FROM organisations AS o
LEFT JOIN users AS creator ON o.created_by = creator.id
LEFT JOIN user_roles AS ur_member ON o.id = ur_member.scope_id AND ur_member.scope_type = 'organisation'
LEFT JOIN projects AS p ON o.id = p.organisation_id
LEFT JOIN deployments AS dep ON p.id = dep.project_id AND dep.deleted_at IS null
LEFT JOIN user_roles AS ur ON o.id = ur.scope_id

WHERE o.deleted_at IS null
  -- SECURITY: Admin-only access (multi-tenant isolation protection)
  AND HAS_SYSTEM_ROLE()

GROUP BY o.id, o.slug, o.name, o.is_active, o.created_at,
         o.updated_at, o.deleted_at, CONCAT(creator.firstname, ' ', creator.surname), creator.email;

COMMENT ON VIEW organisation_summary IS
  'Complete organisation overview with member counts, project counts, and activity metrics';

-- =============================================================================

-- View: organisation_members_detailed
-- Purpose: Detailed list of all organisation members with their roles
-- Security: Admin-only access (ww_admin role required)
CREATE OR REPLACE VIEW organisation_members_detailed
WITH (security_invoker = true) AS
SELECT
  o.id AS organisation_id,
  o.slug AS organisation_slug,
  o.name AS organisation_name,

  u.id AS user_id,
  u.email AS user_email,
  ur_org.granted_at AS member_since,

  -- Membership info
  ur_org.updated_at AS membership_updated,
  CONCAT(u.firstname, ' ', u.surname) AS user_name,

  -- System role (sys_ur: outer query joins user_roles AS ur — don't shadow it)
  COALESCE(EXISTS (
      SELECT 1 FROM user_roles AS sys_ur
      WHERE sys_ur.user_id = u.id
      AND sys_ur.role = 'ww_admin'
      AND sys_ur.scope_type = 'system'
      AND sys_ur.is_active = true
      AND sys_ur.deleted_at IS null
    ), false) AS is_ww_admin,

  -- Organisation-level roles
  ARRAY_AGG(DISTINCT ur.role) FILTER (
    WHERE ur.scope_type = 'organisation'
    AND ur.scope_id = o.id
    AND ur.is_active = true
    AND ur.deleted_at IS null
  ) AS organisation_roles,

  -- Project count and roles — scoped to THIS organisation only.
  -- proj_roles is joined on user_id alone, so a user's roles in OTHER orgs'
  -- projects would inflate these. p is NULL for those (its join is org-scoped),
  -- so key off p.id (not proj_roles.scope_id) and guard the agg with p.id IS NOT NULL.
  COUNT(DISTINCT p.id) FILTER (
    WHERE proj_roles.scope_type = 'project'
    AND proj_roles.is_active = true
    AND proj_roles.deleted_at IS null
  ) AS project_count,

  ARRAY_AGG(DISTINCT proj_roles.role) FILTER (
    WHERE proj_roles.scope_type = 'project'
    AND proj_roles.is_active = true
    AND proj_roles.deleted_at IS null
    AND p.id IS NOT null
  ) AS project_roles

FROM organisations AS o
INNER JOIN user_roles AS ur_org ON o.id = ur_org.scope_id AND ur_org.scope_type = 'organisation' AND ur_org.deleted_at IS null
INNER JOIN users AS u ON ur_org.user_id = u.id AND u.deleted_at IS null
LEFT JOIN user_roles AS ur ON u.id = ur.user_id
LEFT JOIN user_roles AS proj_roles ON u.id = proj_roles.user_id
  AND proj_roles.scope_type = 'project'
LEFT JOIN projects AS p ON proj_roles.scope_id = p.id AND o.id = p.organisation_id

WHERE o.deleted_at IS null
  -- SECURITY: Admin-only access (multi-tenant isolation protection)
  AND HAS_SYSTEM_ROLE()

GROUP BY o.id, o.slug, o.name, u.id, u.firstname, u.surname, u.email, ur_org.granted_at, ur_org.updated_at;

COMMENT ON VIEW organisation_members_detailed IS
  'Detailed view of organisation members with all their roles and project participation';

-- =============================================================================
-- USER REPORTING VIEWS
-- =============================================================================

-- View: user_access_summary
-- Purpose: Complete overview of each user's access across the system
-- Security: Admin-only access (ww_admin role required)
CREATE OR REPLACE VIEW user_access_summary
WITH (security_invoker = true) AS
SELECT
  u.id AS user_id,
  u.email AS user_email,
  u.created_at AS user_created_at,
  CONCAT(u.firstname, ' ', u.surname) AS user_name,

  -- System role (sys_ur: outer query joins user_roles AS ur — don't shadow it)
  CASE
    WHEN EXISTS (
      SELECT 1 FROM user_roles AS sys_ur
      WHERE sys_ur.user_id = u.id
      AND sys_ur.role = 'ww_admin'
      AND sys_ur.scope_type = 'system'
      AND sys_ur.is_active = true
      AND sys_ur.deleted_at IS null
    ) THEN 'ww_admin'
  END AS system_role,

  -- Organisation access
  COUNT(DISTINCT ur_org.scope_id) FILTER (WHERE ur_org.deleted_at IS null) AS organisation_count,
  ARRAY_AGG(DISTINCT o.name) FILTER (WHERE o.deleted_at IS null) AS organisations,

  -- Role counts
  COUNT(DISTINCT CASE
    WHEN ur.scope_type = 'organisation' AND ur.is_active = true AND ur.deleted_at IS null
    THEN ur.id
  END) AS organisation_role_count,
  COUNT(DISTINCT CASE
    WHEN ur.scope_type = 'project' AND ur.is_active = true AND ur.deleted_at IS null
    THEN ur.id
  END) AS project_role_count,

  -- Project access
  COUNT(DISTINCT CASE
    WHEN proj_roles.scope_type = 'project'
    AND proj_roles.is_active = true
    AND proj_roles.deleted_at IS null
    THEN proj_roles.scope_id
  END) AS project_count,

  -- Activity metrics
  MAX(ur.granted_at) AS last_role_granted,
  MAX(ur_org.granted_at) AS last_org_joined,

  -- Highest privilege level
  CASE
    WHEN EXISTS (
      SELECT 1 FROM user_roles AS ur2
      WHERE ur2.user_id = u.id
      AND ur2.role = 'ww_admin'
      AND ur2.scope_type = 'system'
      AND ur2.is_active = true
      AND ur2.deleted_at IS null
    ) THEN 'System Admin'
    -- Organisation Manager removed for MVP2
    WHEN EXISTS (
      SELECT 1 FROM user_roles AS ur2
      WHERE ur2.user_id = u.id
      AND ur2.role = 'project_admin'
      AND ur2.is_active = true
      AND ur2.deleted_at IS null
    ) THEN 'Project Admin'
    WHEN EXISTS (
      SELECT 1 FROM user_roles AS ur2
      WHERE ur2.user_id = u.id
      AND ur2.role = 'project_member'
      AND ur2.is_active = true
      AND ur2.deleted_at IS null
    ) THEN 'Project Member'
    ELSE 'No Roles'
  END AS highest_privilege

FROM users AS u
LEFT JOIN user_roles AS ur_org ON u.id = ur_org.user_id AND ur_org.scope_type = 'organisation'
LEFT JOIN organisations AS o ON ur_org.scope_id = o.id AND o.deleted_at IS null
LEFT JOIN user_roles AS ur ON u.id = ur.user_id
LEFT JOIN user_roles AS proj_roles ON u.id = proj_roles.user_id AND proj_roles.scope_type = 'project'

WHERE u.deleted_at IS null
  -- SECURITY: Admin-only access (multi-tenant isolation protection)
  AND HAS_SYSTEM_ROLE()

GROUP BY u.id, u.firstname, u.surname, u.email, u.created_at;

COMMENT ON VIEW user_access_summary IS
  'Complete user access overview including organisations, roles, and privilege levels';

-- =============================================================================

-- View: user_roles_detailed
-- Purpose: Detailed breakdown of all user roles with context
-- Security: Admin-only access (ww_admin role required)
CREATE OR REPLACE VIEW user_roles_detailed
WITH (security_invoker = true) AS
SELECT
  u.id AS user_id,
  u.email AS user_email,
  ur.id AS role_id,

  ur.role,
  ur.scope_type,
  ur.scope_id,
  ur.is_active,

  -- Scope context
  ur.granted_at,

  ur.expires_at,

  -- Role metadata
  ur.deleted_at,
  granter.email AS granted_by_email,
  CONCAT(u.firstname, ' ', u.surname) AS user_name,
  CASE
    WHEN ur.scope_type = 'system' THEN 'SYSTEM-WIDE'
    WHEN ur.scope_type = 'organisation' THEN o.name
    WHEN ur.scope_type = 'project' THEN p.name
  END AS scope_name,

  -- Granting info
  CASE
    WHEN ur.scope_type = 'organisation' THEN o.slug
    WHEN ur.scope_type = 'project' THEN org_via_proj.slug
  END AS organisation_slug,
  CONCAT(granter.firstname, ' ', granter.surname) AS granted_by_name

FROM user_roles AS ur
INNER JOIN users AS u ON ur.user_id = u.id AND u.deleted_at IS null
LEFT JOIN organisations AS o ON ur.scope_id = o.id AND ur.scope_type = 'organisation'
LEFT JOIN projects AS p ON ur.scope_id = p.id AND ur.scope_type = 'project'
LEFT JOIN organisations AS org_via_proj ON p.organisation_id = org_via_proj.id
LEFT JOIN users AS granter ON ur.granted_by = granter.id

WHERE ur.deleted_at IS null
  AND (ur.expires_at IS null OR ur.expires_at > NOW())
  -- SECURITY: Admin-only access (multi-tenant isolation protection)
  AND HAS_SYSTEM_ROLE()

ORDER BY u.firstname, u.surname, ur.scope_type, ur.role;

COMMENT ON VIEW user_roles_detailed IS
  'Detailed view of all user roles with full context and granting information';

-- =============================================================================
-- PROJECT REPORTING VIEWS
-- =============================================================================

-- View: project_summary
-- Purpose: Complete overview of projects with member and deployment stats
-- Security: Admin-only access (ww_admin role required)
CREATE OR REPLACE VIEW project_summary
WITH (security_invoker = true) AS
SELECT
  p.id AS project_id,
  p.name AS project_name,
  p.description,
  p.created_at,
  p.updated_at,
  p.deleted_at,

  -- Organisation context
  o.id AS organisation_id,
  o.name AS organisation_name,
  o.slug AS organisation_slug,

  -- Creator info
  creator.email AS created_by_email,
  CONCAT(creator.firstname, ' ', creator.surname) AS created_by_name,

  -- Member statistics
  COUNT(DISTINCT ur.user_id) FILTER (
    WHERE ur.scope_type = 'project'
    AND ur.scope_id = p.id
    AND ur.is_active = true
    AND ur.deleted_at IS null
  ) AS total_members,

  COUNT(DISTINCT ur.user_id) FILTER (
    WHERE ur.scope_type = 'project'
    AND ur.scope_id = p.id
    AND ur.role = 'project_admin'
    AND ur.is_active = true
    AND ur.deleted_at IS null
  ) AS admin_count,

  COUNT(DISTINCT ur.user_id) FILTER (
    WHERE ur.scope_type = 'project'
    AND ur.scope_id = p.id
    AND ur.role = 'project_member'
    AND ur.is_active = true
    AND ur.deleted_at IS null
  ) AS member_count,

  -- Deployment statistics
  COUNT(DISTINCT d.id) FILTER (WHERE d.deleted_at IS null) AS deployment_count,
  -- 'started' is the running state. deployment_statuses holds only planned/started/ended;
  -- this filtered on a non-existent 'active' row until 2026-09 and so was always 0.
  COUNT(DISTINCT d.id) FILTER (
    WHERE d.deleted_at IS null
    AND d.deployment_status_id = (SELECT deployment_statuses.id FROM deployment_statuses
WHERE deployment_statuses.value = 'started'
ORDER BY deployment_statuses.id LIMIT 1)
  ) AS active_deployment_count,
  COUNT(DISTINCT dev.id) FILTER (WHERE dev.deleted_at IS null) AS device_count,

  -- Activity metrics
  MAX(d.created_at) AS last_deployment_created,
  MAX(d.updated_at) AS last_deployment_updated,

  -- API activity
  COUNT(DISTINCT al.id) AS api_log_count,
  MAX(al.created_at) AS last_api_activity

FROM projects AS p
INNER JOIN organisations AS o ON p.organisation_id = o.id AND o.deleted_at IS null
LEFT JOIN users AS creator ON p.created_by = creator.id
LEFT JOIN user_roles AS ur ON p.id = ur.scope_id AND ur.scope_type = 'project'
LEFT JOIN deployments AS d ON p.id = d.project_id
LEFT JOIN devices AS dev ON d.device_id = dev.id
LEFT JOIN api_logs AS al ON p.id = al.project_id

WHERE p.deleted_at IS null
  -- SECURITY: Admin-only access (multi-tenant isolation protection)
  AND HAS_SYSTEM_ROLE()

GROUP BY p.id, p.name, p.description, p.created_at, p.updated_at, p.deleted_at,
         o.id, o.name, o.slug, CONCAT(creator.firstname, ' ', creator.surname), creator.email;

COMMENT ON VIEW project_summary IS
  'Complete project overview with member counts, deployment stats, and activity metrics';

-- =============================================================================

-- View: project_members_detailed
-- Purpose: Detailed list of project members with roles and permissions
-- Security: Admin-only access (ww_admin role required)
CREATE OR REPLACE VIEW project_members_detailed
WITH (security_invoker = true) AS
SELECT
  p.id AS project_id,
  p.name AS project_name,
  o.id AS organisation_id,
  o.name AS organisation_name,
  o.slug AS organisation_slug,

  u.id AS user_id,
  u.email AS user_email,
  ur.role AS project_role,

  -- Project role
  ur.granted_at AS role_granted_at,
  ur.is_active AS role_is_active,
  granter.email AS granted_by_email,

  -- Role granting info
  CONCAT(u.firstname, ' ', u.surname) AS user_name,
  CONCAT(granter.firstname, ' ', granter.surname) AS granted_by_name,

  -- Organisation-level roles for this user
  ARRAY_AGG(DISTINCT org_roles.role) FILTER (
    WHERE org_roles.scope_type = 'organisation'
    AND org_roles.scope_id = o.id
    AND org_roles.is_active = true
    AND org_roles.deleted_at IS null
  ) AS organisation_roles,

  -- System role check
  COALESCE(EXISTS (
      SELECT 1 FROM user_roles AS sys_role
      WHERE sys_role.user_id = u.id
      AND sys_role.role = 'ww_admin'
      AND sys_role.scope_type = 'system'
      AND sys_role.is_active = true
      AND sys_role.deleted_at IS null
    ), false) AS is_ww_admin

FROM projects AS p
INNER JOIN organisations AS o ON p.organisation_id = o.id AND o.deleted_at IS null
INNER JOIN user_roles AS ur ON p.id = ur.scope_id
  AND ur.scope_type = 'project'
  AND ur.is_active = true
  AND ur.deleted_at IS null
INNER JOIN users AS u ON ur.user_id = u.id AND u.deleted_at IS null
LEFT JOIN users AS granter ON ur.granted_by = granter.id
LEFT JOIN user_roles AS org_roles ON u.id = org_roles.user_id

WHERE p.deleted_at IS null
  -- SECURITY: Admin-only access (multi-tenant isolation protection)
  AND HAS_SYSTEM_ROLE()

GROUP BY p.id, p.name, o.id, o.name, o.slug, u.id, u.firstname, u.surname, u.email,
         ur.role, ur.granted_at, ur.is_active, granter.firstname, granter.surname, granter.email;

COMMENT ON VIEW project_members_detailed IS
  'Detailed view of project members with roles, permissions, and granting information';

-- =============================================================================
-- DEPLOYMENT REPORTING VIEWS
-- =============================================================================

-- View: deployment_overview
-- Purpose: Complete overview of deployments with device and project context
-- Security: Admin-only access (ww_admin role required)
CREATE OR REPLACE VIEW deployment_overview
WITH (security_invoker = true) AS
SELECT
  d.id AS deployment_id,
  d.name AS deployment_name,
  d.location_name,
  d.deployment_start,
  d.deployment_end,
  d.created_at,
  d.updated_at,
  d.deleted_at,

  -- Project context
  p.id AS project_id,
  p.name AS project_name,
  o.id AS organisation_id,
  o.name AS organisation_name,

  -- Device info
  dev.id AS device_id,
  dev.bluetooth_id,
  dev.name AS device_name,
  d.ble_firmware_id,
  d.himax_firmware_id,

  -- Status
  ds.value AS deployment_status,
  ds.description AS status_description,

  -- Location
  d.latitude,
  d.longitude,
  d.altitude,
  d.accuracy,
  d.location AS geolocation,
  d.location_description,

  -- Comments and metadata
  d.start_deployment_comments,
  d.end_deployment_comments,
  d.camera_location_image_paths,
  d.camera_height,

  -- Creator info
  creator.email AS created_by_email,
  CONCAT(creator.firstname, ' ', creator.surname) AS created_by_name

FROM deployments AS d
INNER JOIN projects AS p ON d.project_id = p.id AND p.deleted_at IS null
INNER JOIN organisations AS o ON p.organisation_id = o.id AND o.deleted_at IS null
LEFT JOIN devices AS dev ON d.device_id = dev.id AND dev.deleted_at IS null
LEFT JOIN deployment_statuses AS ds ON d.deployment_status_id = ds.id
LEFT JOIN users AS creator ON d.setup_by = creator.id

WHERE d.deleted_at IS null
  -- SECURITY: Admin-only access (multi-tenant isolation protection)
  AND HAS_SYSTEM_ROLE()

ORDER BY d.created_at DESC;

COMMENT ON VIEW deployment_overview IS
  'Complete deployment overview with project, device, and location context';

-- =============================================================================
-- AUDIT AND ACTIVITY VIEWS
-- =============================================================================

-- View: admin_activity_log
-- Purpose: Comprehensive admin activity audit trail
-- Security: Admin-only access (ww_admin role required)
-- DISABLED: admin_audit_log table does not exist
-- CREATE OR REPLACE VIEW admin_activity_log
-- WITH (security_invoker = true) AS
-- SELECT
--   aal.id as log_id,
--   aal.action,
--   aal.created_at as action_timestamp,
-- 
--   -- Admin info
--   admin.id as admin_user_id,
--   CONCAT(admin.firstname, ' ', admin.surname) as admin_name,
--   admin_auth.email as admin_email,
-- 
--   -- Target user info
--   target_user.id as target_user_id,
--   CONCAT(target_user.firstname, ' ', target_user.surname) as target_user_name,
--   target_user_auth.email as target_user_email,
-- 
--   -- Project context
--   p.id as target_project_id,
--   p.name as target_project_name,
--   o.id as organisation_id,
--   o.name as organisation_name,
-- 
--   -- Metadata
--   aal.metadata,
-- 
--   -- Role information from metadata
--   aal.metadata->>'role' as role_affected,
--   aal.metadata->>'organisation_id' as metadata_org_id
-- 
-- FROM admin_audit_log aal
-- INNER JOIN users admin ON admin.id = aal.admin_id AND admin.deleted_at IS NULL
-- LEFT JOIN public.users admin_auth ON admin_auth.id = admin.id
-- LEFT JOIN users target_user ON target_user.id = aal.target_user_id AND target_user.deleted_at IS NULL
-- LEFT JOIN public.users target_user_auth ON target_user_auth.id = target_user.id
-- LEFT JOIN projects p ON p.id = aal.target_project_id AND p.deleted_at IS NULL
-- LEFT JOIN organisations o ON o.id = p.organisation_id AND o.deleted_at IS NULL
-- 
-- WHERE (SELECT has_system_role((SELECT auth.uid()), 'ww_admin'))
-- 
-- ORDER BY aal.created_at DESC;

-- COMMENT ON VIEW admin_activity_log IS
--   'Comprehensive admin activity audit trail with full context';

-- =============================================================================

-- View: recent_activity_summary
-- Purpose: Recent system activity across all entities
-- Security: Admin-only access (ww_admin role required)
CREATE OR REPLACE VIEW recent_activity_summary
WITH (security_invoker = true) AS
SELECT * FROM (
  SELECT
    'USER_CREATED' AS activity_type,
    u.created_at AS activity_timestamp,
    CONCAT(u.firstname, ' ', u.surname) AS entity_name,
    'User' AS entity_type,
    null AS organisation_name,
    null AS project_name,
    JSON_BUILD_OBJECT('user_id', u.id, 'email', u.email) AS details
  FROM users AS u
  WHERE u.deleted_at IS null

  UNION ALL

  SELECT
    'ORGANISATION_CREATED' AS activity_type,
    o.created_at AS activity_timestamp,
    o.name AS entity_name,
    'Organisation' AS entity_type,
    o.name AS organisation_name,
    null AS project_name,
    JSON_BUILD_OBJECT('organisation_id', o.id, 'slug', o.slug, 'member_count',
      (SELECT COUNT(*) FROM user_roles
WHERE user_roles.scope_id = o.id AND user_roles.scope_type = 'organisation' AND user_roles.deleted_at IS null)
    ) AS details
  FROM organisations AS o
  WHERE o.deleted_at IS null

  UNION ALL

  SELECT
    'PROJECT_CREATED' AS activity_type,
    p.created_at AS activity_timestamp,
    p.name AS entity_name,
    'Project' AS entity_type,
    o.name AS organisation_name,
    p.name AS project_name,
    JSON_BUILD_OBJECT('project_id', p.id, 'organisation_id', o.id) AS details
  FROM projects AS p
  -- ST09 misfires on this multi-condition ON inside UNION ALL (flags either operand order)
  INNER JOIN organisations AS o ON p.organisation_id = o.id AND o.deleted_at IS null -- noqa: ST09
  WHERE p.deleted_at IS null

  UNION ALL

  SELECT
    'DEPLOYMENT_CREATED' AS activity_type,
    d.created_at AS activity_timestamp,
    COALESCE(d.name, d.location_name) AS entity_name,
    'Deployment' AS entity_type,
    o.name AS organisation_name,
    p.name AS project_name,
    JSON_BUILD_OBJECT('deployment_id', d.id, 'project_id', p.id, 'device_id', d.device_id, 'location_name', d.location_name) AS details
  FROM deployments AS d
  INNER JOIN projects AS p ON d.project_id = p.id AND p.deleted_at IS null
  INNER JOIN organisations AS o ON p.organisation_id = o.id AND o.deleted_at IS null -- noqa: ST09
  WHERE d.deleted_at IS null

  UNION ALL

  SELECT
    'ROLE_GRANTED' AS activity_type,
    ur.granted_at AS activity_timestamp,
    ur.role AS entity_name,
    'Role Assignment' AS entity_type,
    CASE
      WHEN ur.scope_type = 'organisation' THEN o.name
      WHEN ur.scope_type = 'project' THEN org_via_proj.name
    END AS organisation_name,
    CASE
      WHEN ur.scope_type = 'project' THEN p.name
    END AS project_name,
    JSON_BUILD_OBJECT(
      'user_id', ur.user_id,
      'role', ur.role,
      'scope_type', ur.scope_type,
      'granted_by', ur.granted_by
    ) AS details
  FROM user_roles AS ur
  LEFT JOIN organisations AS o ON ur.scope_id = o.id AND ur.scope_type = 'organisation'
  LEFT JOIN projects AS p ON ur.scope_id = p.id AND ur.scope_type = 'project'
  LEFT JOIN organisations AS org_via_proj ON p.organisation_id = org_via_proj.id
  WHERE ur.deleted_at IS null
    AND ur.is_active = true
) AS activities
-- SECURITY: Admin-only access (multi-tenant isolation protection)
WHERE HAS_SYSTEM_ROLE()
ORDER BY activity_timestamp DESC
LIMIT 100;

COMMENT ON VIEW recent_activity_summary IS
  'Recent system activity across all entities (last 100 activities)';

-- =============================================================================
-- REPORTING FUNCTIONS
-- =============================================================================

-- Function: get_organisation_report
-- Purpose: Generate comprehensive organisation report with optional filtering
CREATE OR REPLACE FUNCTION GET_ORGANISATION_REPORT(
  p_organisation_id UUID DEFAULT null,
  p_organisation_slug TEXT DEFAULT null,
  p_include_inactive BOOLEAN DEFAULT false
)
RETURNS TABLE (
  organisation_id UUID,
  organisation_name TEXT,
  organisation_slug TEXT,
  is_active BOOLEAN,
  member_count BIGINT,
  project_count BIGINT,
  device_count BIGINT,
  deployment_count BIGINT,
  created_at TIMESTAMPTZ,
  members JSONB,
  projects JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id as organisation_id,
    o.name as organisation_name,
    o.slug as organisation_slug,
    o.is_active,
    COUNT(DISTINCT ur_org.user_id) FILTER (WHERE ur_org.deleted_at IS NULL) as member_count,
    COUNT(DISTINCT p.id) FILTER (WHERE p.deleted_at IS NULL) as project_count,
    COUNT(DISTINCT dep.device_id) FILTER (WHERE dep.deleted_at IS NULL AND dep.device_id IS NOT NULL) as device_count,
    COUNT(DISTINCT dep.id) FILTER (WHERE dep.deleted_at IS NULL) as deployment_count,
    o.created_at,

    -- Members as JSON array
    COALESCE(
      json_agg(DISTINCT jsonb_build_object(
        'user_id', u.id,
        'user_name', CONCAT(u.firstname, ' ', u.surname),
        'user_email', u.email,
        'member_since', ur_org.granted_at
      )) FILTER (WHERE u.id IS NOT NULL),
      '[]'::json
    )::jsonb as members,

    -- Projects as JSON array
    COALESCE(
      json_agg(DISTINCT jsonb_build_object(
        'project_id', p.id,
        'project_name', p.name,
        'project_created_at', p.created_at,
        'deployment_count', (
          SELECT COUNT(*) 
          FROM public.deployments d
          WHERE d.project_id = p.id AND d.deleted_at IS NULL
        )
      )) FILTER (WHERE p.id IS NOT NULL),
      '[]'::json
    )::jsonb as projects

  FROM public.organisations o
  LEFT JOIN public.user_roles ur_org ON ur_org.scope_id = o.id AND ur_org.scope_type = 'organisation' AND ur_org.deleted_at IS NULL
  LEFT JOIN public.users u ON u.id = ur_org.user_id AND u.deleted_at IS NULL
  LEFT JOIN public.projects p ON p.organisation_id = o.id AND p.deleted_at IS NULL
  LEFT JOIN public.deployments dep ON dep.project_id = p.id AND dep.deleted_at IS NULL

  WHERE
    (p_organisation_id IS NULL OR o.id = p_organisation_id)
    AND (p_organisation_slug IS NULL OR o.slug = p_organisation_slug)
    AND (p_include_inactive OR o.is_active = TRUE)
    AND o.deleted_at IS NULL

  GROUP BY o.id, o.name, o.slug, o.is_active, o.created_at;
END;
$$;

COMMENT ON FUNCTION GET_ORGANISATION_REPORT IS
  'Generate comprehensive organisation report with members and projects. Parameters: organisation_id (optional), organisation_slug (optional), include_inactive (default false)';

-- =============================================================================

-- Function: get_user_access_report
-- Purpose: Generate detailed user access report showing all permissions
CREATE OR REPLACE FUNCTION GET_USER_ACCESS_REPORT(
  p_user_id UUID DEFAULT null,
  p_user_email TEXT DEFAULT null
)
RETURNS TABLE (
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  system_role TEXT,
  organisations JSONB,
  projects JSONB,
  total_permissions INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id as user_id,
    CONCAT(u.firstname, ' ', u.surname) as user_name,
    u.email::text as user_email,

    -- System role
    (
      SELECT ur.role FROM public.user_roles ur
      WHERE ur.user_id = u.id
      AND ur.scope_type = 'system'
      AND ur.role = 'ww_admin'
      AND ur.is_active = true
      AND ur.deleted_at IS NULL
      LIMIT 1
    ) as system_role,

    -- Organisations with roles
    COALESCE(
      (
        SELECT json_agg(org_data)::jsonb
        FROM (
          SELECT
            o.id as organisation_id,
            o.name as organisation_name,
            o.slug as organisation_slug,
            ARRAY_AGG(DISTINCT uo.role) as roles
          FROM public.user_roles uo
          INNER JOIN public.organisations o ON o.id = uo.scope_id AND o.deleted_at IS NULL
          WHERE uo.user_id = u.id 
            AND uo.scope_type = 'organisation'
            AND uo.is_active = true 
            AND uo.deleted_at IS NULL
          GROUP BY o.id, o.name, o.slug
        ) org_data
      ),
      '[]'::jsonb
    ) as organisations,

    -- Projects with roles
    COALESCE(
      (
        SELECT json_agg(proj_data)::jsonb
        FROM (
          SELECT DISTINCT
            p.id as project_id,
            p.name as project_name,
            o.name as organisation_name,
            proj_roles.role,
            proj_roles.granted_at
          FROM public.user_roles proj_roles
          INNER JOIN public.projects p ON p.id = proj_roles.scope_id AND p.deleted_at IS NULL
          INNER JOIN public.organisations o ON o.id = p.organisation_id AND o.deleted_at IS NULL
          WHERE proj_roles.user_id = u.id
          AND proj_roles.scope_type = 'project'
          AND proj_roles.is_active = true
          AND proj_roles.deleted_at IS NULL
        ) proj_data
      ),
      '[]'::jsonb
    ) as projects,

    -- Total permission count
    (
      SELECT COUNT(*) FROM public.user_roles ur
      WHERE ur.user_id = u.id
      AND ur.is_active = true
      AND ur.deleted_at IS NULL
    )::INT as total_permissions

  FROM public.users u

  WHERE
    (p_user_id IS NULL OR u.id = p_user_id)
    AND (p_user_email IS NULL OR u.email = p_user_email)
    AND u.deleted_at IS NULL;
END;
$$;

COMMENT ON FUNCTION GET_USER_ACCESS_REPORT IS
  'Generate detailed user access report showing all organisations, projects, and roles. Parameters: user_id (optional), user_email (optional)';

-- =============================================================================

-- Function: get_project_health_report
-- Purpose: Generate project health metrics and status
CREATE OR REPLACE FUNCTION GET_PROJECT_HEALTH_REPORT(
  p_organisation_id UUID DEFAULT null
)
RETURNS TABLE (
  project_id UUID,
  project_name TEXT,
  organisation_name TEXT,
  health_score INT,
  has_admin BOOLEAN,
  member_count INT,
  deployment_count INT,
  active_deployment_count INT,
  last_activity TIMESTAMPTZ,
  issues JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as project_id,
    p.name as project_name,
    o.name as organisation_name,

    -- Health score (0-100)
    (
      CASE
        WHEN admin_count = 0 THEN 0
        WHEN admin_count = 1 THEN 40
        ELSE 50
      END +
      CASE
        WHEN total_members > 0 THEN 25
        ELSE 0
      END +
      CASE
        WHEN active_deployments > 0 THEN 25
        ELSE 0
      END
    )::INT as health_score,

    -- Has at least one admin
    (admin_count > 0) as has_admin,

    total_members::INT as member_count,
    total_deployments::INT as deployment_count,
    active_deployments::INT as active_deployment_count,

    GREATEST(
      p.updated_at,
      COALESCE(last_deployment, p.created_at),
      COALESCE(last_api_log, p.created_at)
    ) as last_activity,

    -- Issues array
    jsonb_build_object(
      'no_admin', (admin_count = 0),
      'single_admin', (admin_count = 1),
      'no_members', (total_members = 0),
      'no_deployments', (total_deployments = 0),
      'no_active_deployments', (active_deployments = 0),
      'stale', (
        GREATEST(
          p.updated_at,
          COALESCE(last_deployment, p.created_at),
          COALESCE(last_api_log, p.created_at)
        ) < NOW() - INTERVAL '30 days'
      )
    ) as issues

  FROM public.projects p
  INNER JOIN public.organisations o ON o.id = p.organisation_id AND o.deleted_at IS NULL

  CROSS JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (
        WHERE ur.role = 'project_admin'
        AND ur.is_active = true
        AND ur.deleted_at IS NULL
      ) as admin_count,
      COUNT(*) FILTER (
        WHERE ur.is_active = true
        AND ur.deleted_at IS NULL
      ) as total_members
    FROM public.user_roles ur
    WHERE ur.scope_id = p.id
    AND ur.scope_type = 'project'
  ) members

  CROSS JOIN LATERAL (
    SELECT
      COUNT(*) as total_deployments,
      -- 'started' is the running state; see the note in project_summary above.
      COUNT(*) FILTER (
        WHERE d.deployment_status_id = (
          SELECT id FROM public.deployment_statuses WHERE value = 'started' LIMIT 1
        )
      ) as active_deployments,
      MAX(d.created_at) as last_deployment
    FROM public.deployments d
    WHERE d.project_id = p.id
    AND d.deleted_at IS NULL
  ) deps

  CROSS JOIN LATERAL (
    SELECT MAX(al.created_at) as last_api_log
    FROM public.api_logs al
    WHERE al.project_id = p.id
  ) logs

  WHERE
    p.deleted_at IS NULL
    AND (p_organisation_id IS NULL OR o.id = p_organisation_id)

  ORDER BY health_score ASC, p.name;
END;
$$;

COMMENT ON FUNCTION GET_PROJECT_HEALTH_REPORT IS
  'Generate project health metrics including health score, member counts, and identified issues. Parameters: organisation_id (optional)';

-- =============================================================================
-- SECURITY FIX: Admin-Only Access to Reporting Views
-- =============================================================================
-- CRITICAL SECURITY VULNERABILITY FIXED (Issue #1):
-- Previously, all authenticated users could SELECT from reporting views without
-- organization scoping, violating multi-tenant isolation. These views expose
-- aggregated data across ALL organizations.
--
-- DECISION: Restrict to ww_admin role only via WHERE clause filtering
-- RATIONALE:
-- - Views contain organization-aggregated sensitive data
-- - No org-scoping possible in view definitions (cross-org reporting purpose)
-- - Mobile app does not use these views (backend/admin tooling only)
-- - Follows principle of least privilege
-- - PostgreSQL doesn't support RLS on views (only tables)
--
-- IMPLEMENTATION:
-- 1. Add 'WITH (security_invoker = true)' to all views (PostgreSQL 15+ security)
-- 2. Add WHERE clause: '(SELECT has_system_role((SELECT auth.uid()), 'ww_admin'))'
-- 3. Keep authenticated GRANT (views filter at query level)
--
-- SECURITY MECHANISM:
-- - security_invoker = true: View honors invoker's permissions (not owner's)
-- - WHERE has_system_role(): Filters entire result set to ww_admin users only
-- - Non-admin users get empty result set (zero rows returned)
-- - No RLS policies needed (views use query-level filtering)
--
-- TESTED:
-- - ww_admin users: Can see all organization data (expected)
-- - Non-admin users: Get empty result set (security enforced)
-- - Performance: Minimal overhead (single role check per query)
-- =============================================================================

-- Grant SELECT permission to authenticated (views enforce access via WHERE clause)
GRANT SELECT ON organisation_summary TO authenticated;
GRANT SELECT ON organisation_members_detailed TO authenticated;
GRANT SELECT ON user_access_summary TO authenticated;
GRANT SELECT ON user_roles_detailed TO authenticated;
GRANT SELECT ON project_summary TO authenticated;
GRANT SELECT ON project_members_detailed TO authenticated;
GRANT SELECT ON deployment_overview TO authenticated;
-- GRANT SELECT ON admin_activity_log TO authenticated;
GRANT SELECT ON recent_activity_summary TO authenticated;

-- Grant execute permissions on reporting functions (functions use SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION get_organisation_report TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_access_report TO authenticated;
GRANT EXECUTE ON FUNCTION get_project_health_report TO authenticated;

-- =============================================================================
-- End of Reporting Views and Functions
-- =============================================================================
