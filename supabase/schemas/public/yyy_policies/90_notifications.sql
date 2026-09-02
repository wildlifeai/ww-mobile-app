-- *** notifications RLS Policies ***
-- A notification belongs to exactly one recipient. Users may read and mark read ONLY
-- their own rows. Rows are created by the backend with the service role (no INSERT
-- policy / grant for authenticated).

CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
  );

CREATE POLICY "Users can mark their own notifications read"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
  );
