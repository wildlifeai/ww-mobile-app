-- Create project_invitations table for managing project invitations
-- Note: This system uses internal mobile app notifications only - no emails sent
-- Email addresses are used for user identification/matching only

CREATE TABLE project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  invitee_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('project_admin', 'project_member')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

-- Prevent duplicate pending invitations (partial unique index)
CREATE UNIQUE INDEX idx_unique_pending_invitation
  ON project_invitations (project_id, invitee_email)
  WHERE status = 'pending';

-- Indexes for querying user's invitations
CREATE INDEX idx_invitations_invitee_email ON project_invitations (invitee_email) WHERE status = 'pending';
CREATE INDEX idx_invitations_project_id ON project_invitations (project_id);
CREATE INDEX idx_invitations_expires_at ON project_invitations (expires_at) WHERE status = 'pending';


