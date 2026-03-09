-- NOTE: this is an extension to the auth.user supabase table and should link with the auth.users.id (uuid) in that table
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),
  deleted_at timestamptz,
  modified_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  firstname text NOT NULL,
  surname text NOT NULL
  -- email text UNIQUE NOT NULL,  -- this field is in auth.users
  -- encrypted_password text NOT NULL -- this field is in auth.users
);

COMMENT ON TABLE users IS 'User profile data (public schema). Synced with auth.users via triggers. Soft deletes preserve audit trail.';
COMMENT ON COLUMN users.id IS 'Links to Supabase auth.users (CASCADE delete)';
COMMENT ON COLUMN users.firstname IS 'User first name';
COMMENT ON COLUMN users.surname IS 'User surname';
COMMENT ON COLUMN users.modified_by IS 'User who last modified this record';
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp - NULL means active';

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
