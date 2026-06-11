-- NOTE: this is an extension to the auth.user supabase table and should link with the auth.users.id (uuid) in that table
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),
  deleted_at timestamptz,
  modified_by uuid DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  firstname text NOT NULL,
  surname text NOT NULL,
  -- Mirrored from auth.users.email by the handle_new_user / sync_user_email triggers
  -- so public views can show email WITHOUT joining the restricted auth schema (which
  -- breaks under security_invoker for the authenticated role). Nullable + un-unique on
  -- purpose: soft-deleted users may share an email with a re-registered active user.
  email text
  -- encrypted_password text NOT NULL -- this field is in auth.users
);

COMMENT ON TABLE users IS 'User profile data (public schema). Synced with auth.users via triggers. Soft deletes preserve audit trail.';
COMMENT ON COLUMN users.id IS 'Links to Supabase auth.users (CASCADE delete)';
COMMENT ON COLUMN users.firstname IS 'User first name';
COMMENT ON COLUMN users.surname IS 'User surname';
COMMENT ON COLUMN users.email IS 'Mirror of auth.users.email, kept in sync by triggers so public views avoid joining auth.users';
COMMENT ON COLUMN users.modified_by IS 'User who last modified this record';
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp - NULL means active';

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
