-- Account deletion requests submitted via Google Form
-- Admin reviews and manually executes deletion
CREATE TABLE account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  email text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'completed', 'rejected')),
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  completed_at timestamptz,
  notes text
);

CREATE INDEX idx_account_deletion_requests_status ON account_deletion_requests (status);
CREATE INDEX idx_account_deletion_requests_user_id ON account_deletion_requests (user_id);

COMMENT ON TABLE account_deletion_requests IS 'Tracks user account deletion requests. Submitted via Google Form, reviewed by admin before manual execution.';
COMMENT ON COLUMN account_deletion_requests.user_id IS 'User requesting deletion (SET NULL - audited even if user is deleted)';
COMMENT ON COLUMN account_deletion_requests.email IS 'Email submitted in the deletion request form';
COMMENT ON COLUMN account_deletion_requests.reason IS 'Optional reason provided by the user';
COMMENT ON COLUMN account_deletion_requests.status IS 'Workflow status: pending -> approved -> completed, or rejected';
COMMENT ON COLUMN account_deletion_requests.reviewed_by IS 'Admin who reviewed the request';
COMMENT ON COLUMN account_deletion_requests.reviewed_at IS 'When the admin reviewed the request';
COMMENT ON COLUMN account_deletion_requests.completed_at IS 'When the account was actually deleted';
COMMENT ON COLUMN account_deletion_requests.notes IS 'Admin notes about the deletion request';

ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;


