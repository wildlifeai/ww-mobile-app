-- Read rules for projects and devices, shared by their SELECT policies and by
-- sync_deleted_ids (#160). The policies put `deleted_at IS NULL` in front, so a
-- soft-deleted row is invisible to every client read. sync_deleted_ids asks the
-- same question about rows deleted since the app last pulled, so the app still
-- learns which rows to remove. One rule, two callers: change it here, not in a copy.
--
-- Like has_project_role: plpgsql (the functions load before the tables, and a SQL
-- body is checked at creation), SECURITY DEFINER to read user_roles past RLS, and
-- VOLATILE because tests switch auth.uid() mid-transaction.

-- A project: ww_admin, a project-scope role on it, its creator (#181: needed during
-- the INSERT that creates it), or a manager of its organisation (#162).
CREATE OR REPLACE FUNCTION public.can_read_project(
  p_project_id uuid, p_organisation_id uuid, p_created_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
VOLATILE
AS $$
BEGIN
  -- COALESCE: a NULL created_by makes the OR NULL rather than false, which RLS
  -- reads as a refusal but a caller negating the result does not.
  RETURN COALESCE((SELECT auth.uid()) IS NOT NULL AND (
    public.has_system_role((SELECT auth.uid()), 'ww_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles AS ur
      WHERE ur.scope_type = 'project'
        AND ur.scope_id = p_project_id
        AND ur.user_id = (SELECT auth.uid())
        AND ur.is_active = TRUE
        AND ur.deleted_at IS NULL
    )
    OR p_created_by = (SELECT auth.uid())
    OR public.has_organisation_role((SELECT auth.uid()), p_organisation_id, 'organisation_manager')
  ), false);
END;
$$;

-- A device: a project role on a live deployment that uses it, or any role in the
-- organisation that owns it.
CREATE OR REPLACE FUNCTION public.can_read_device(p_device_id uuid, p_organisation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
VOLATILE
AS $$
BEGIN
  -- COALESCE: a NULL created_by makes the OR NULL rather than false, which RLS
  -- reads as a refusal but a caller negating the result does not.
  RETURN COALESCE((SELECT auth.uid()) IS NOT NULL AND (
    EXISTS (
      SELECT 1
      FROM public.deployments AS d
      INNER JOIN public.user_roles AS ur ON ur.scope_type = 'project' AND d.project_id = ur.scope_id
      WHERE d.device_id = p_device_id
        AND d.deleted_at IS NULL
        AND ur.user_id = (SELECT auth.uid())
        AND ur.is_active = TRUE
        AND ur.deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles AS ur
      WHERE ur.scope_type = 'organisation'
        AND ur.scope_id = p_organisation_id
        AND ur.user_id = (SELECT auth.uid())
        AND ur.is_active = TRUE
        AND ur.deleted_at IS NULL
    )
  ), false);
END;
$$;

REVOKE ALL ON FUNCTION public.can_read_project(uuid, uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.can_read_device(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_read_project(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_device(uuid, uuid) TO authenticated;
