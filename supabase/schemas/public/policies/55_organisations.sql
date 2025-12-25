-- - The organisation_member check in SELECT policy is technically correct but trivial
--   (all authenticated users can see "General" since they're all members)
-- - Organisation managers do NOT exist in MVP2
-- - This policy structure is ready for future multi-org expansion

-- SELECT: WW Admins see all, organisation members see their own
-- (MVP2: All users see "General" since all are members)
CREATE POLICY "organisations_select_policy"
  ON organisations
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL AND (
      -- WW Admins can see all organisations
      has_system_role((SELECT auth.uid()), 'ww_admin') OR
      -- Organisation members can see their organisation
      -- (MVP2: All users are members of "General", so this allows all authenticated users to see it)
      has_organisation_role((SELECT auth.uid()), organisations.id, 'organisation_member')
    )
  );

-- INSERT: Only WW Admins can create organisations (MVP2: Single General Org)
CREATE POLICY "organisations_insert_policy"
  ON organisations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND created_by = (SELECT auth.uid())
    AND has_system_role((SELECT auth.uid()), 'ww_admin')
  );

-- UPDATE: Only WW Admins can update organisations (MVP2: No Org Managers)
CREATE POLICY "organisations_update_policy"
  ON organisations
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL AND 
    has_system_role((SELECT auth.uid()), 'ww_admin')
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND 
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

-- DELETE: Only WW Admins can delete organisations
CREATE POLICY "organisations_delete_policy"
  ON organisations
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND has_system_role((SELECT auth.uid()), 'ww_admin')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    deleted_at IS NOT NULL
  );

COMMENT ON POLICY "organisations_select_policy" ON organisations
IS 'MVP2: WW Admins see all, members see their own. In MVP2, all users are members of "General" org.';

COMMENT ON POLICY "organisations_insert_policy" ON organisations
IS 'MVP2: Only WW Admins can create organisations.';

COMMENT ON POLICY "organisations_update_policy" ON organisations
IS 'MVP2: Only WW Admins can update organisations.';

COMMENT ON POLICY "organisations_delete_policy" ON organisations
IS 'MVP2: Only WW Admins can soft delete.';