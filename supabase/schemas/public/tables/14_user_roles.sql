CREATE TABLE user_roles (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),
  deleted_at timestamptz,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('ww_admin', 'organisation_manager', 'organisation_member', 'project_admin', 'project_member')),
  scope_type text NOT NULL CHECK (scope_type IN ('system', 'organisation', 'project')),
  scope_id uuid, -- NULL for system roles, organisation_id for org roles, project_id for project roles
  granted_by uuid, -- Allow NULL when granting user is deleted
  granted_at timestamptz DEFAULT (now()) NOT NULL,
  expires_at timestamptz, -- NULL means no expiration
  is_active boolean DEFAULT true NOT NULL,
  modified_by uuid NOT NULL REFERENCES auth.users(id),
  CONSTRAINT user_roles_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT user_roles_granted_by_fkey
    FOREIGN KEY (granted_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  -- Ensure scope_id is NULL for system roles
  CONSTRAINT user_roles_system_scope_check 
    CHECK (scope_type != 'system' OR scope_id IS NULL),
  -- Ensure scope_id is NOT NULL for organisation and project roles  
  CONSTRAINT user_roles_scoped_role_check
    CHECK (scope_type = 'system' OR scope_id IS NOT NULL)
);

-- Create unique constraint to prevent duplicate role assignments
-- User can only have one specific role per scope
CREATE UNIQUE INDEX user_roles_unique_idx 
ON user_roles (user_id, role, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid)) 
WHERE deleted_at IS NULL AND is_active = true;

-- Create indexes for performance
CREATE INDEX user_roles_user_id_idx ON user_roles (user_id);
CREATE INDEX user_roles_scope_idx ON user_roles (scope_type, scope_id);
CREATE INDEX user_roles_active_idx ON user_roles (is_active, expires_at);

-- Add role validation constraint
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_scope_validation CHECK (
  (role = 'ww_admin' AND scope_type = 'system') OR
  (role = 'organisation_manager' AND scope_type IN ('system', 'organisation')) OR
  (role = 'organisation_member' AND scope_type = 'organisation') OR
  (role = 'project_admin' AND scope_type IN ('organisation', 'project')) OR
  (role = 'project_member' AND scope_type IN ('organisation', 'project'))
);

COMMENT ON TABLE user_roles IS 'Stores user role assignments with hierarchical scope (system > organisation > project). Implements the 4-tier role system for Wildlife Watcher.';
COMMENT ON COLUMN user_roles.role IS 'The role type: ww_admin (system), organisation_manager (organisation management), project_admin (project management), project_member (basic access).';
COMMENT ON COLUMN user_roles.scope_type IS 'The scope of the role: system (global), organisation (org-wide), project (project-specific).';
COMMENT ON COLUMN user_roles.scope_id IS 'ID of the scope entity (organisation_id or project_id). NULL for system roles.';
COMMENT ON COLUMN user_roles.granted_by IS 'User ID who granted this role (audit trail).';
COMMENT ON COLUMN user_roles.expires_at IS 'When the role expires (NULL for permanent roles).';
COMMENT ON COLUMN user_roles.modified_by IS 'ID of the user who last modified this role assignment.';

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles" ON "public"."user_roles"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Ensure authenticated users can select (RLS will still apply)
GRANT SELECT ON public.user_roles TO authenticated;
