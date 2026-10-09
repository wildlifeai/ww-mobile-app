-- One row per move of a deployment from one project to another (#260). Written only by
-- move_deployment (SECURITY DEFINER), so it is the audit trail of moves, and
-- sync_deleted_ids reads it to tell a member of the source project, who can no longer
-- read the deployment, to drop it. Viewers of either project read it (94 policy);
-- clients write nothing (98_authenticated_write_grants.sql).
CREATE TABLE deployment_moves (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  deployment_id uuid NOT NULL REFERENCES deployments (id) ON DELETE CASCADE,
  from_project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  to_project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  -- Nullable so deleting the account keeps the move, as deployments.setup_by does.
  moved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  moved_at timestamptz NOT NULL DEFAULT (now()),

  CONSTRAINT chk_deployment_moves_projects_differ CHECK (from_project_id <> to_project_id)
);

-- sync_deleted_ids looks moves up by deployment and time; the project indexes serve
-- the SELECT policy and the cascades.
CREATE INDEX idx_deployment_moves_deployment ON deployment_moves (deployment_id, moved_at);
CREATE INDEX idx_deployment_moves_from_project ON deployment_moves (from_project_id);
CREATE INDEX idx_deployment_moves_to_project ON deployment_moves (to_project_id);
CREATE INDEX idx_deployment_moves_moved_by ON deployment_moves (moved_by);

COMMENT ON TABLE deployment_moves IS 'One row per move of a deployment between projects, written only by move_deployment. The audit trail of moves, and the record sync_deleted_ids uses to tell source-project members to drop a moved deployment.';

ALTER TABLE deployment_moves ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.deployment_moves TO authenticated;
GRANT ALL ON public.deployment_moves TO service_role;
