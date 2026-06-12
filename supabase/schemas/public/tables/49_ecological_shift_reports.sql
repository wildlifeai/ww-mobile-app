CREATE TABLE ecological_shift_reports (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  computed_at timestamptz DEFAULT (now()),

  deployment_id uuid NOT NULL REFERENCES deployments (id) ON DELETE CASCADE,

  -- Two compared time windows.
  period_a_start timestamptz NOT NULL,
  period_a_end timestamptz NOT NULL,
  period_b_start timestamptz NOT NULL,
  period_b_end timestamptz NOT NULL,

  -- Divergence between the two embedding distributions (Jensen-Shannon base-2 is in [0,1]).
  method text CHECK (method IS NULL OR method IN ('jensen_shannon', 'mmd')),
  divergence float4 CHECK (divergence IS NULL OR (divergence >= 0 AND divergence <= 1)),
  alert_level text CHECK (alert_level IS NULL OR alert_level IN ('low', 'medium', 'high')),
  changed_clusters jsonb, -- [{cluster_id, change_type, delta}]

  CONSTRAINT chk_shift_periods CHECK (period_a_end >= period_a_start AND period_b_end >= period_b_start)
);

CREATE INDEX idx_ecological_shift_reports_deployment ON ecological_shift_reports (deployment_id);

COMMENT ON TABLE ecological_shift_reports IS 'Ecological change detection: compares embedding distributions between two time windows for a deployment (Jensen-Shannon / MMD). Surfaces species appearance/disappearance and population shifts on the dataset health dashboard.';
COMMENT ON COLUMN ecological_shift_reports.divergence IS 'Distribution divergence score between period A and period B.';
COMMENT ON COLUMN ecological_shift_reports.changed_clusters IS 'JSON array of significant cluster changes: [{cluster_id, change_type, delta}].';

ALTER TABLE ecological_shift_reports ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.ecological_shift_reports TO authenticated;

GRANT ALL ON public.ecological_shift_reports TO service_role;
