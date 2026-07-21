CREATE TABLE conservation_alerts (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),

  project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  deployment_id uuid REFERENCES deployments (id) ON DELETE CASCADE, -- NULL for project-level alerts
  -- TODO (review item 1C, deferred): enforce the deployment belongs to project_id via a composite FK
  --   FOREIGN KEY (deployment_id, project_id) REFERENCES deployments (id, project_id)
  -- to prevent cross-project leakage. Requires first adding UNIQUE (id, project_id) to the
  -- deployments table (a core, mobile-synced table — coordinate with the backend/mobile owner).

  alert_type text NOT NULL CHECK (alert_type IN (
    'species_disappearance',
    'novel_species_candidate',
    'population_shift',
    'migration_shift',
    'camera_malfunction',
    'embedding_drift',
    'qa_precision_drop'
  )),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  taxon_id uuid REFERENCES taxa (id) ON DELETE SET NULL,
  details jsonb,

  first_seen timestamptz DEFAULT (now()),
  acknowledged_by uuid REFERENCES users (id) ON DELETE SET NULL,
  acknowledged_at timestamptz,

  -- If a user is attributed to the acknowledgement, it must have a timestamp.
  -- (acknowledged_by may be NULL while acknowledged_at is set, due to ON DELETE SET NULL.)
  CONSTRAINT chk_acknowledgement_integrity CHECK (
    acknowledged_by IS NULL OR acknowledged_at IS NOT NULL
  )
);

CREATE INDEX idx_conservation_alerts_project ON conservation_alerts (project_id);
CREATE INDEX idx_conservation_alerts_deployment ON conservation_alerts (deployment_id);
CREATE INDEX idx_conservation_alerts_type ON conservation_alerts (alert_type);
CREATE INDEX idx_conservation_alerts_severity ON conservation_alerts (severity);

COMMENT ON TABLE conservation_alerts IS 'Actionable conservation signals surfaced on the dataset health dashboard (and optionally emailed/webhooked): species disappearance, novel species, population/migration shift, camera malfunction, embedding drift, QA precision drop.';
COMMENT ON COLUMN conservation_alerts.deployment_id IS 'Deployment the alert concerns; NULL for project-wide alerts.';
COMMENT ON COLUMN conservation_alerts.details IS 'Alert-type-specific payload (thresholds, observed values, affected clusters).';
COMMENT ON COLUMN conservation_alerts.acknowledged_by IS 'User who acknowledged the alert (NULL until acknowledged).';

ALTER TABLE conservation_alerts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.conservation_alerts TO authenticated;

GRANT ALL ON public.conservation_alerts TO service_role;
