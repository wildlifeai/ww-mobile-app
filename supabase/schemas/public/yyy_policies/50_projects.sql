-- *** Projects RLS Policies ***
--
-- Organisation-scoped project access with multi-tenant isolation
-- - Projects are isolated by organisation
-- - Users can only see projects they have roles for
-- - Cross-organisation access is prevented
-- - Role-based access within organisation boundaries
-- - WW Admins have unrestricted access to all projects
-- UPDATED: 2025-11-28 - Clarified ww_admin unrestricted access

-- SELECT: Role-based project visibility
-- Users can see projects they have roles for
-- SELECT: Role-based project visibility (MVP2: Strict Isolation)
-- Users can ONLY see projects they have direct roles for, plus their own
-- creations, plus their organisation's projects if they manage it, plus WW Admin.
--
-- The `created_by` branch is not a convenience; without it a non-admin cannot
-- create a project at all (#181). PostgreSQL applies a table's SELECT policy to
-- the new row as an extra check whenever an INSERT carries `RETURNING` or
-- `ON CONFLICT`, and `push_changes` inserts projects with
-- `ON CONFLICT (id) DO NOTHING`. At that moment the creator holds no role on the
-- row, because `on_project_created` grants them `project_admin` in an AFTER
-- INSERT trigger that has not fired yet. So the check failed and the push was
-- refused with 42501:
--
--   INSERT INTO projects (...)                        -- passes
--   INSERT INTO projects (...) RETURNING id           -- 42501
--   INSERT INTO projects (...) ON CONFLICT DO NOTHING -- 42501
--
-- A `ww_admin` short-circuits on has_system_role, which is why project creation
-- kept working for tui@ww.org and why this went unseen from 866b45c (27 May
-- 2026) until a bench run as an ordinary member on 5 September.
--
-- Fixing the policy rather than the `ON CONFLICT` covers the class: `RETURNING`
-- and PostgREST's `return=representation` hit the same wall. The `ON CONFLICT` is
-- also load-bearing for idempotency, since WatermelonDB re-pushes an op whose
-- ack was lost.
--
-- Known consequence: this outlives the trigger's grant. Revoking a creator's
-- project_admin no longer removes their read access to a project they created.
-- That is deliberate and was accepted with the fix; if project access must be
-- fully revocable, this branch is what to revisit.
CREATE POLICY "projects_select_policy"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    -- A soft-deleted project is invisible to clients (#160); pull_changes learns of
    -- the deletion through sync_deleted_ids. The read rule is can_read_project,
    -- shared with that helper: ww_admin, a project role, the creator (#181: the
    -- INSERT that creates it needs this), or a manager of its organisation (#162).
    deleted_at IS NULL
    AND can_read_project(projects.id, projects.organisation_id, projects.created_by)
  );

-- INSERT: Authenticated users can create projects (MVP2: Users can become project admins)
CREATE POLICY "projects_insert_policy"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND created_by = (SELECT auth.uid())
  );

-- UPDATE: Project admins can update (MVP2: No Org Managers)
-- The policy checks the row's own id only, so it cannot keep organisation_id in
-- place; trg_projects_lock_organisation refuses that change unless the caller is
-- ww_admin (#260).
CREATE POLICY "projects_update_policy"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL AND (
      has_system_role((SELECT auth.uid()), 'ww_admin')
      OR has_project_role((SELECT auth.uid()), projects.id, 'project_admin')
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND (
      has_system_role((SELECT auth.uid()), 'ww_admin')
      OR has_project_role((SELECT auth.uid()), projects.id, 'project_admin')
    )
  );

-- Soft deletes go through soft_delete_project (SECURITY DEFINER), not an UPDATE policy:
-- the SELECT policy hides soft-deleted rows, and Postgres checks an UPDATE's new row
-- against it, so no client UPDATE that sets deleted_at can pass (#160).

COMMENT ON POLICY "projects_select_policy" ON projects
IS 'Updated 2025-11-27: Uses user_roles instead of project_members';

COMMENT ON POLICY "projects_update_policy" ON projects
IS 'Updated 2025-11-27: Removed user_organisations dependency';

