-- Enable RLS
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;

-- Project admins can send invitations
CREATE POLICY "Project admins can send invitations"
  ON project_invitations FOR INSERT
  WITH CHECK (
    has_project_role(auth.uid(), project_id, 'project_admin')
  );

-- Users can view invitations sent to their email
CREATE POLICY "Users can view their invitations"
  ON project_invitations FOR SELECT
  USING (
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR inviter_id = auth.uid()
    OR has_project_role(auth.uid(), project_id, 'project_admin')
  );

-- Users can respond to their invitations
CREATE POLICY "Users can respond to their invitations"
  ON project_invitations FOR UPDATE
  USING (
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
