-- Helper Function: Epoch to Timestamp
CREATE OR REPLACE FUNCTION public.to_timestamp_ms(epoch_ms bigint)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_timestamp(epoch_ms / 1000.0);
$$;

-- Ids of projects, deployments and devices the app should remove, since `since`.
-- Two reasons a row goes (#160, #330):
--
--   1. It was soft-deleted, and the caller could read it. The SELECT policies hide
--      soft-deleted rows, so pull_changes cannot find these itself.
--   2. The caller lost access: one of their roles on the row's project or
--      organisation changed since `since` (removed, deactivated, downgraded), and
--      they can no longer read the row. The app never hears about this otherwise,
--      because a row it may no longer read simply stops appearing.
--
-- SECURITY DEFINER to see past the policies, and scoped with the very rules they use
-- (can_read_project, has_project_role, can_read_device). A lost-access row is only
-- reported when one of the caller's own role rows that could have granted it points
-- at it, so joining an organisation does not report projects the caller never had.
-- Ids only, never rows.
-- What role timestamps cannot show (an expired role, a hard-deleted row, a database
-- reset) pull_changes covers with visible_project_ids.
CREATE OR REPLACE FUNCTION public.sync_deleted_ids(since timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
VOLATILE
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  RETURN pg_catalog.jsonb_build_object(
    'projects', (
      SELECT COALESCE(pg_catalog.jsonb_agg(p.id), '[]'::jsonb)
      FROM public.projects AS p
      WHERE (
          p.deleted_at > since
          AND public.can_read_project(p.id, p.organisation_id, p.created_by)
        ) OR (
          EXISTS (
            SELECT 1 FROM public.user_roles AS ur
            WHERE ur.user_id = v_uid
              AND ((ur.scope_type = 'project' AND ur.scope_id = p.id)
                OR (ur.scope_type = 'organisation' AND ur.scope_id = p.organisation_id
                    AND ur.role = 'organisation_manager'))
              AND GREATEST(ur.updated_at, ur.deleted_at) > since
          )
          AND (p.deleted_at IS NULL
               AND public.can_read_project(p.id, p.organisation_id, p.created_by)) IS NOT TRUE
        )
    ),
    'deployments', (
      SELECT COALESCE(pg_catalog.jsonb_agg(d.id), '[]'::jsonb)
      FROM public.deployments AS d
      JOIN public.projects AS p ON p.id = d.project_id
      WHERE (
          d.deleted_at > since
          AND public.has_project_role(v_uid, d.project_id, 'project_viewer')
        ) OR (
          EXISTS (
            SELECT 1 FROM public.user_roles AS ur
            WHERE ur.user_id = v_uid
              AND ((ur.scope_type = 'project' AND ur.scope_id = d.project_id)
                OR (ur.scope_type = 'organisation' AND ur.scope_id = p.organisation_id
                    AND ur.role = 'organisation_manager'))
              AND GREATEST(ur.updated_at, ur.deleted_at) > since
          )
          AND (d.deleted_at IS NULL
               AND public.has_project_role(v_uid, d.project_id, 'project_viewer')) IS NOT TRUE
        )
    ),
    'devices', (
      SELECT COALESCE(pg_catalog.jsonb_agg(v.id), '[]'::jsonb)
      FROM public.devices AS v
      WHERE (
          v.deleted_at > since
          AND public.can_read_device(v.id, v.organisation_id)
        ) OR (
          EXISTS (
            SELECT 1 FROM public.user_roles AS ur
            WHERE ur.user_id = v_uid
              AND GREATEST(ur.updated_at, ur.deleted_at) > since
              AND ((ur.scope_type = 'organisation' AND ur.scope_id = v.organisation_id)
                OR (ur.scope_type = 'project' AND EXISTS (
                      SELECT 1 FROM public.deployments AS d
                      WHERE d.device_id = v.id AND d.project_id = ur.scope_id)))
          )
          AND (v.deleted_at IS NULL
               AND public.can_read_device(v.id, v.organisation_id)) IS NOT TRUE
        )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_deleted_ids(timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_deleted_ids(timestamptz) TO authenticated;

-- Pull Changes RPC (needed for WatermelonDB sync)
--
-- SECURITY INVOKER, deliberately (issue #166). This was SECURITY DEFINER and so
-- bypassed RLS, while performing no caller scoping of its own: its queries filter
-- on time and deleted_at only, never on who is asking. Any authenticated user
-- received every organisation's projects, deployments and devices — measured as
-- 6 projects for a user whose RLS-scoped view of the same table was 2.
--
-- As INVOKER the existing SELECT policies do the scoping, which is exactly the
-- behaviour we want and keeps one source of truth for access rules. `authenticated`
-- already holds SELECT on all three tables, so nothing else is required.
--
-- The delete lists come from sync_deleted_ids (below), not from these tables:
-- since #160 the SELECT policies hide soft-deleted rows, so a query here for
-- `deleted_at > _ts` would return nothing, clients would never learn about a
-- deletion, and nothing would fail. Test 15 pins both halves.
CREATE OR REPLACE FUNCTION public.pull_changes(last_pulled_at bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _ts timestamptz;
  _changes jsonb;
  
  -- Projects
  _projects_created jsonb;
  _projects_updated jsonb;
  _projects_deleted jsonb;
  
  -- Deployments
  _deployments_created jsonb;
  _deployments_updated jsonb;
  _deployments_deleted jsonb;

  -- Devices
  _devices_created jsonb;
  _devices_updated jsonb;
  _devices_deleted jsonb;

  _deleted jsonb;
  _visible_project_ids jsonb;

BEGIN
  _ts := public.to_timestamp_ms(last_pulled_at);
  _deleted := public.sync_deleted_ids(_ts);

  -- ----------------------------------------------------------------------------
  -- PROJECTS
  -- ----------------------------------------------------------------------------
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)), '[]'::jsonb) INTO _projects_created
  FROM public.projects t
  WHERE created_at > _ts AND deleted_at IS NULL;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)), '[]'::jsonb) INTO _projects_updated
  FROM public.projects t
  WHERE updated_at > _ts AND created_at <= _ts AND deleted_at IS NULL;

  _projects_deleted := _deleted->'projects';

  -- ----------------------------------------------------------------------------
  -- DEPLOYMENTS
  -- ----------------------------------------------------------------------------
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)), '[]'::jsonb) INTO _deployments_created
  FROM public.deployments t
  WHERE created_at > _ts AND deleted_at IS NULL;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)), '[]'::jsonb) INTO _deployments_updated
  FROM public.deployments t
  WHERE updated_at > _ts AND created_at <= _ts AND deleted_at IS NULL;

  _deployments_deleted := _deleted->'deployments';

  -- ----------------------------------------------------------------------------
  -- DEVICES
  -- ----------------------------------------------------------------------------
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)), '[]'::jsonb) INTO _devices_created
  FROM public.devices t
  WHERE created_at > _ts AND deleted_at IS NULL;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)), '[]'::jsonb) INTO _devices_updated
  FROM public.devices t
  WHERE updated_at > _ts AND created_at <= _ts AND deleted_at IS NULL;

  _devices_deleted := _deleted->'devices';



  -- ----------------------------------------------------------------------------
  -- CONSTRUCT RESPONSE
  -- ----------------------------------------------------------------------------
  _changes := pg_catalog.jsonb_build_object(
    'projects', pg_catalog.jsonb_build_object(
      'created', _projects_created,
      'updated', _projects_updated,
      'deleted', _projects_deleted
    ),
    'deployments', pg_catalog.jsonb_build_object(
      'created', _deployments_created,
      'updated', _deployments_updated,
      'deleted', _deployments_deleted
    ),
    'devices', pg_catalog.jsonb_build_object(
      'created', _devices_created,
      'updated', _devices_updated,
      'deleted', _devices_deleted
    )
  );

  -- Every project the caller can read right now (#330). The delete lists cannot
  -- report what left without a trace (an expired role, a hard-deleted row, a dev
  -- database reset), so the app can drop any synced local project not in this list.
  -- RLS does the scoping; soft-deleted projects are already hidden.
  SELECT COALESCE(pg_catalog.jsonb_agg(p.id), '[]'::jsonb) INTO _visible_project_ids
  FROM public.projects AS p;

  RETURN pg_catalog.jsonb_build_object(
    'changes', _changes,
    'timestamp', (extract(epoch from pg_catalog.now()) * 1000)::bigint,
    'visible_project_ids', _visible_project_ids
  );
END;
$$;
