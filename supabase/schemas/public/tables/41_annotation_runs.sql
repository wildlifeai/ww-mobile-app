CREATE TABLE annotation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id uuid NOT NULL REFERENCES deployments (id) ON DELETE CASCADE,
  run_type text NOT NULL CHECK (run_type IN ('ai_inference', 'human_review', 'event_aggregation')),
  model_id uuid REFERENCES ai_models (id) ON DELETE SET NULL,
  config jsonb,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz CHECK (completed_at IS NULL OR completed_at >= started_at),
  observation_count int DEFAULT 0 CHECK (observation_count >= 0),
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_annotation_run_provenance CHECK (
    (run_type <> 'ai_inference' OR model_id IS NOT NULL)
    AND (run_type <> 'human_review' OR created_by IS NOT NULL)
  )
);

-- Per-user compute aggregation (admin_user_usage / my_upload_usage).
CREATE INDEX idx_annotation_runs_created_by ON annotation_runs (created_by);

COMMENT ON TABLE annotation_runs IS 'Tracks history, provenance, and configuration of model inferences, human labeling, and clustering jobs.';
COMMENT ON COLUMN annotation_runs.deployment_id IS 'Deployment of interest.';
COMMENT ON COLUMN annotation_runs.run_type IS 'Category of job: ai_inference, human_review, or event_aggregation.';
COMMENT ON COLUMN annotation_runs.model_id IS 'AI model version run (null for human review).';
COMMENT ON COLUMN annotation_runs.config IS 'Key parameters used during execution (e.g. confidence threshold, temporal gap).';

ALTER TABLE annotation_runs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.annotation_runs TO authenticated;

GRANT ALL ON public.annotation_runs TO service_role;
