-- Per-frame evidence signals for the website's presence pipeline (#208): one row per
-- (media, signal, source, source_version). The verdict itself is the
-- source_type='consensus' row in observations; these are its inputs and score, in a
-- shape that takes a new signal without a migration. Contract: section 8 of the
-- evidence-pipeline architecture report in ww-website (wildlifeai/ww-website#156).
-- Only the website's service role writes; members read (84b policy).
CREATE TABLE media_evidence (
  id uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL,
  deployment_id uuid NOT NULL REFERENCES deployments (id) ON DELETE CASCADE,
  signal text NOT NULL,
  value float4,
  value_text text,
  source text NOT NULL,
  source_version text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  run_id uuid,

  -- (media, deployment) must match the media row, as in observations and media_embeddings.
  CONSTRAINT fk_media_evidence_media
    FOREIGN KEY (media_id, deployment_id) REFERENCES media (id, deployment_id) ON DELETE CASCADE,

  -- A row carries a number, a label, or both; never neither.
  CONSTRAINT chk_media_evidence_has_value CHECK (value IS NOT NULL OR value_text IS NOT NULL),

  -- The website upserts on exactly these columns. NULLS NOT DISTINCT, so a NULL
  -- source_version cannot produce duplicates.
  CONSTRAINT uq_media_evidence UNIQUE NULLS NOT DISTINCT (media_id, signal, source, source_version)
);

CREATE INDEX idx_media_evidence_deployment_signal ON media_evidence (deployment_id, signal);

COMMENT ON TABLE media_evidence IS 'Per-frame evidence signals for the presence pipeline: one row per (media, signal, source, source_version). Inputs and output of the website''s evidence score; the verdict itself is the source_type=consensus row in observations.';
COMMENT ON COLUMN media_evidence.signal IS 'Signal name, enumerated in the website (backend/app/services/media_evidence.py SIGNALS), deliberately not a CHECK: the website owns the list.';
COMMENT ON COLUMN media_evidence.value IS 'Numeric value (0 to 1 for presence and score signals, integers for burst counts). NULL for text-only signals.';
COMMENT ON COLUMN media_evidence.value_text IS 'Text value for identities and labels (burst_id, visibility label, weights version).';
COMMENT ON COLUMN media_evidence.source IS 'Producer: speciesnet, gemini, edge, motion, bursts, fusion.';
COMMENT ON COLUMN media_evidence.source_version IS 'Model id or code version of the producer, for example speciesnet-v4.0.1a or gemini-3.1-flash-lite.';
COMMENT ON COLUMN media_evidence.run_id IS 'annotation_runs.id of the run that produced the row, when one exists. Not a foreign key: the website writes that row best-effort.';

ALTER TABLE media_evidence ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.media_evidence TO authenticated;
GRANT ALL ON public.media_evidence TO service_role;
