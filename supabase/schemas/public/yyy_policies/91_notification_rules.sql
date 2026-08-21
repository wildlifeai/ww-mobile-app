-- *** notification_rules RLS Policies ***
-- A rule is owned by one user. Users manage (CRUD) only their own rules, and only for
-- projects they belong to. The backend reads all rules with the service role when emitting.

CREATE POLICY "Users can view their own notification_rules"
  ON notification_rules
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
  );

CREATE POLICY "Users can create their own notification_rules"
  ON notification_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND has_project_role((SELECT auth.uid()), notification_rules.project_id, 'project_member')
  );

CREATE POLICY "Users can update their own notification_rules"
  ON notification_rules
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    -- Re-check membership on the (possibly changed) project_id: without this a user
    -- could repoint an existing rule at a project they don't belong to and receive
    -- its notifications.
    AND has_project_role((SELECT auth.uid()), notification_rules.project_id, 'project_member')
  );

CREATE POLICY "Users can delete their own notification_rules"
  ON notification_rules
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
  );
