-- *** users RLS Policies ***
-- RLS was enabled with no policies at all, so every client read returned no rows,
-- including a user's own profile (#67, re-found in #189).
--
-- SELECT: own row only. Not "users who share an organisation": every account is
-- enrolled in General by handle_new_user, so that would publish every mirrored
-- email to every signed-in user (rls-and-security.md). A soft-deleted user who can
-- still sign in keeps seeing their own row, since account deletion has to show what
-- is being removed. Clients that need other users' names go through the SECURITY
-- DEFINER RPCs (get_project_members, get_organisation_users).
--
-- No INSERT, UPDATE or DELETE: the handle_new_user and sync_user_email triggers are
-- the only writers, and authenticated holds no write grant (98_authenticated_write_grants.sql).
CREATE POLICY "Users can view their own row"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));
