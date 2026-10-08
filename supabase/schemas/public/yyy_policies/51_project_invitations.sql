-- Enable RLS
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;

-- Reads only. Invitations are written exclusively through the SECURITY DEFINER
-- RPCs in 38_invitation_functions.sql (send_project_invitation,
-- respond_to_invitation), which bind the actor to auth.uid() and decide every
-- column themselves.
--
-- There used to be an INSERT policy for project admins and an UPDATE policy for
-- the invitee. The UPDATE policy only checked that the row was addressed to the
-- caller, so an invitee could rewrite project_id and role on their own pending
-- invitation, and respond_to_invitation then granted whatever the row said.
-- Any user could invite themselves from a project of their own, point the
-- invitation at another project as project_admin, and accept it. The INSERT
-- policy let an admin write any inviter_id. Neither client used either policy.
-- See supabase/tests/database/23_invitation_write_policies.test.sql.

-- Users can view invitations sent to their email
CREATE POLICY "Users can view their invitations"
  ON project_invitations FOR SELECT
  USING (
    lower(invitee_email) = lower(current_setting('request.jwt.claims', true)::jsonb ->> 'email')
    OR inviter_id = auth.uid()
    OR has_project_role(auth.uid(), project_id, 'project_admin')
  );
