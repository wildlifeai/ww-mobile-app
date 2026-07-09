CREATE TABLE media_embeddings (
  media_id uuid PRIMARY KEY,
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),

  -- Denormalised for fast per-deployment queue/cluster queries without a media join.
  deployment_id uuid NOT NULL REFERENCES deployments (id) ON DELETE CASCADE,

  -- Linkage to the run that produced these values (current run; history in embedding_runs).
  embedding_run_id uuid REFERENCES embedding_runs (id) ON DELETE SET NULL,

  -- DINOv3 vector (pgvector). Unbounded dim so one column holds both variants
  -- (384-d dinov3-vits / 1280-d dinov3-vith); reads filter by embedding_model so
  -- compared vectors share a dim. Replaces the former Qdrant point.
  embedding extensions.vector,
  embedding_model text CHECK (embedding_model IS NULL OR embedding_model IN ('dinov3-vith', 'dinov3-vits')),

  qdrant_point_id uuid, -- DEPRECATED: vectors now live in `embedding`; retained transitionally

  -- HDBSCAN cluster membership.
  cluster_id int, -- HDBSCAN label; -1 = outlier/noise
  cluster_confidence float4 CHECK (cluster_confidence IS NULL OR (cluster_confidence >= 0 AND cluster_confidence <= 1)),
  cluster_purity text CHECK (cluster_purity IS NULL OR cluster_purity IN ('high', 'medium', 'low')),
  is_outlier boolean NOT NULL DEFAULT FALSE,

  -- UMAP 2D coordinates (persisted, stable across sessions; t-SNE is on-demand only).
  umap_x float4,
  umap_y float4,

  -- Active learning (Phase 8).
  active_learning_score float4 CHECK (active_learning_score IS NULL OR (active_learning_score >= 0 AND active_learning_score <= 1)),
  al_score_updated_at timestamptz,

  -- UMAP is a 2D point: both coords are set together or both NULL.
  CONSTRAINT chk_umap_coords_complete CHECK (
    (umap_x IS NULL AND umap_y IS NULL)
    OR (umap_x IS NOT NULL AND umap_y IS NOT NULL)
  ),

  -- A vector and its model are set together or both NULL — a model without a vector
  -- (or vice versa) is a broken row the search RPC can't use.
  CONSTRAINT chk_embedding_model_presence CHECK ((embedding IS NULL) = (embedding_model IS NULL)),

  -- Prevent deployment drift: the (media, deployment) pair must match the media row.
  CONSTRAINT fk_media_embeddings_media
    FOREIGN KEY (media_id, deployment_id) REFERENCES media (id, deployment_id) ON DELETE CASCADE
);

CREATE INDEX idx_media_embeddings_run ON media_embeddings (embedding_run_id);
CREATE INDEX idx_media_embeddings_deployment_cluster ON media_embeddings (deployment_id, cluster_id);
CREATE INDEX idx_media_embeddings_review_queue
  ON media_embeddings (deployment_id, is_outlier, active_learning_score DESC);

COMMENT ON TABLE media_embeddings IS 'Current DINOv3 embedding + clustering state per media row (1:1 with media). Overwritten on re-embed; full history lives in embedding_runs and Qdrant. Separate from media to keep mobile sync lean.';
COMMENT ON COLUMN media_embeddings.deployment_id IS 'Denormalised deployment link for efficient per-deployment review-queue and cluster queries.';
COMMENT ON COLUMN media_embeddings.embedding_run_id IS 'Embedding run that produced these values.';
COMMENT ON COLUMN media_embeddings.embedding IS 'DINOv3 embedding vector (pgvector); dim per embedding_model (384 vits / 1280 vith). Replaces the former Qdrant point.';
COMMENT ON COLUMN media_embeddings.embedding_model IS 'Which DINOv3 variant produced `embedding`; filter on it at read time so a model/dim change never mixes vector spaces.';
COMMENT ON COLUMN media_embeddings.qdrant_point_id IS 'DEPRECATED — vectors now live in media_embeddings.embedding (pgvector). Retained transitionally; to be dropped.';
COMMENT ON COLUMN media_embeddings.cluster_id IS 'HDBSCAN integer label for this deployment+run; -1 indicates an outlier/noise point.';
COMMENT ON COLUMN media_embeddings.cluster_purity IS 'Estimated purity bucket driving review depth: high (bulk), medium (sample), low (full).';
COMMENT ON COLUMN media_embeddings.umap_x IS 'Persisted UMAP X coordinate (stable across sessions). t-SNE coords are generated on demand and never stored.';
COMMENT ON COLUMN media_embeddings.active_learning_score IS 'Composite uncertainty score in [0,1]; higher = more valuable to review first.';

ALTER TABLE media_embeddings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.media_embeddings TO authenticated;

GRANT ALL ON public.media_embeddings TO service_role;
