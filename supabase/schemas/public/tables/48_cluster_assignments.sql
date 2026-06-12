CREATE TABLE cluster_assignments (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),

  deployment_id uuid NOT NULL REFERENCES deployments (id) ON DELETE CASCADE,
  embedding_run_id uuid NOT NULL REFERENCES embedding_runs (id) ON DELETE CASCADE,
  cluster_id int NOT NULL, -- HDBSCAN label within this deployment+run

  -- Species assignment (set when a reviewer confirms the cluster).
  taxon_id uuid REFERENCES taxa (id) ON DELETE SET NULL,
  scientific_name text, -- denormalised for CamtrapDP compatibility
  is_outlier_cluster boolean NOT NULL DEFAULT FALSE,

  -- Cluster quality metrics (computed at clustering time).
  image_count int NOT NULL DEFAULT 0 CHECK (image_count >= 0),
  mean_confidence float4 CHECK (mean_confidence IS NULL OR (mean_confidence >= 0 AND mean_confidence <= 1)),
  purity_score float4 CHECK (purity_score IS NULL OR (purity_score >= 0 AND purity_score <= 1)),
  review_depth text CHECK (review_depth IS NULL OR review_depth IN ('bulk', 'sample', 'full')),

  -- Multi-user review state + soft lock (auto-releases after lock_expires).
  review_state text NOT NULL DEFAULT 'open'
    CHECK (review_state IN ('open', 'locked', 'confirmed', 'conflicted')),
  confirmed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  locked_by uuid REFERENCES users (id) ON DELETE SET NULL,
  locked_at timestamptz,
  lock_expires timestamptz,

  CONSTRAINT uq_cluster_assignment UNIQUE (deployment_id, embedding_run_id, cluster_id),

  -- Attribution requires a timestamp (and vice-versa for a coherent audit trail).
  CONSTRAINT chk_lock_metadata CHECK (locked_by IS NULL OR locked_at IS NOT NULL),
  CONSTRAINT chk_confirm_metadata CHECK (confirmed_by IS NULL OR confirmed_at IS NOT NULL),
  -- A confirmed cluster must record when it was confirmed.
  CONSTRAINT chk_confirmed_state CHECK (review_state <> 'confirmed' OR confirmed_at IS NOT NULL)
);

CREATE INDEX idx_cluster_assignments_deployment ON cluster_assignments (deployment_id);
CREATE INDEX idx_cluster_assignments_run ON cluster_assignments (embedding_run_id);
CREATE INDEX idx_cluster_assignments_taxon ON cluster_assignments (taxon_id);
CREATE INDEX idx_cluster_assignments_review_state ON cluster_assignments (review_state);

COMMENT ON TABLE cluster_assignments IS 'Named HDBSCAN clusters per deployment+embedding run. A reviewer confirms a whole cluster to a taxon in one action; member observations are then created with full provenance. Carries review state, soft lock, and purity-driven review depth.';
COMMENT ON COLUMN cluster_assignments.cluster_id IS 'HDBSCAN integer label, unique within (deployment_id, embedding_run_id).';
COMMENT ON COLUMN cluster_assignments.taxon_id IS 'Confirmed taxon for the cluster (NULL until a reviewer confirms). Use taxa.status=candidate for novel-species clusters.';
COMMENT ON COLUMN cluster_assignments.purity_score IS 'Intra/inter cluster similarity ratio; >0.85 is high purity.';
COMMENT ON COLUMN cluster_assignments.review_depth IS 'Derived from purity: bulk (>=0.85), sample (0.65-0.84), full (<0.65).';
COMMENT ON COLUMN cluster_assignments.review_state IS 'open, locked (a reviewer holds the soft lock), confirmed, or conflicted (divergent confirmations need a supervisor).';
COMMENT ON COLUMN cluster_assignments.lock_expires IS 'Soft lock auto-release time (e.g. 30 min idle) to avoid stuck locks under multi-user review.';

ALTER TABLE cluster_assignments ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.cluster_assignments TO authenticated;

GRANT ALL ON public.cluster_assignments TO service_role;
