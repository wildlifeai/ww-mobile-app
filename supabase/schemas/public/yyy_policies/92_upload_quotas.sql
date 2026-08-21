-- upload_quotas RLS: a user may read their own quota (to show their own warning);
-- only system admins (ww_admin) may create, change, or remove quotas.

CREATE POLICY "Users read their own quota, admins read all"
  ON upload_quotas
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR has_system_role((SELECT auth.uid()), 'ww_admin')
  );

CREATE POLICY "Admins insert quotas"
  ON upload_quotas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

CREATE POLICY "Admins update quotas"
  ON upload_quotas
  FOR UPDATE
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  )
  WITH CHECK (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

CREATE POLICY "Admins delete quotas"
  ON upload_quotas
  FOR DELETE
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );
