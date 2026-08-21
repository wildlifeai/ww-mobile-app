-- =============================================================================
-- MOBILE APP SUPPORT VIEW: projects_with_stats
-- =============================================================================
-- Purpose: Projects with computed statistics for mobile app display
-- Created: Task 12 - Mobile App Backend Integration
-- Evidence: Required by mobile app ProjectService for background sync
-- =============================================================================

CREATE OR REPLACE VIEW projects_with_stats AS
-- p.* is intentional: new project columns auto-appear whenever migra recreates the view
SELECT -- noqa: AM04
  p.*,

  -- Placeholder for future LoRaWAN webhook data
  null::INTEGER AS battery_level,
  null::INTEGER AS sd_card_usage,

  -- Member count (active project members)
  (
    SELECT COUNT(*)
    FROM user_roles AS ur
    WHERE ur.scope_type = 'project'
      AND ur.scope_id = p.id
      AND ur.is_active = true
      AND ur.deleted_at IS null
  ) AS member_count,

  -- Deployment count (active deployments)
  (
    SELECT COUNT(*)
    FROM deployments AS d
    WHERE d.project_id = p.id
      AND d.deleted_at IS null
  ) AS deployment_count,

  -- Device count (distinct devices across active deployments)
  (
    SELECT COUNT(DISTINCT d.device_id)
    FROM deployments AS d
    WHERE d.project_id = p.id
      AND d.deleted_at IS null
  ) AS lorawan_device_count

FROM projects AS p;

-- Grant access to authenticated users
GRANT SELECT ON projects_with_stats TO authenticated;

-- Enable RLS on view (inherits from projects table)
ALTER VIEW projects_with_stats SET (security_invoker = true);

COMMENT ON VIEW projects_with_stats IS 'Projects with computed statistics for mobile app display. Used by mobile app background sync to fetch project statistics.';

-- =============================================================================
-- End of Mobile App Support View
-- =============================================================================
