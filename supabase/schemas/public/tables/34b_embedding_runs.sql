CREATE TABLE embedding_runs (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  completed_at timestamptz CHECK (completed_at IS NULL OR completed_at >= created_at),

  -- Scope: a run targets one deployment, a whole project, or the global platform.
  scope text NOT NULL DEFAULT 'deployment'
    CHECK (scope IN ('deployment', 'project', 'global')),
  scope_id uuid, -- deployment_id or project_id depending on scope; NULL for global
  deployment_id uuid REFERENCES deployments (id) ON DELETE CASCADE,  -- convenience FK for deployment scope
  project_id uuid REFERENCES projects (id) ON DELETE CASCADE,  -- referential integrity for project scope

  -- Model identity (variant explicit at the data level — see ww-website embedding_registry).
  model_name text NOT NULL CHECK (model_name IN ('dinov3-vith', 'dinov3-vits')),
  model_version text NOT NULL,
  embedding_dim int NOT NULL DEFAULT 1280 CHECK (embedding_dim > 0),
  execution_provider text
    CHECK (execution_provider IS NULL OR execution_provider IN ('server_gpu', 'server_cpu', 'webgpu')),

  -- Dimensionality reduction + clustering configuration (for reproducibility).
  reduction_method text CHECK (reduction_method IS NULL OR reduction_method IN ('umap', 'tsne')),
  reduction_params jsonb,
  clustering_method text CHECK (clustering_method IS NULL OR clustering_method IN ('hdbscan', 'hierarchical')),
  clustering_params jsonb,

  -- Vector store linkage.
  qdrant_collection text NOT NULL DEFAULT 'media_embeddings',

  -- Lifecycle.
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'complete', 'failed', 'superseded')),
  image_count int NOT NULL DEFAULT 0 CHECK (image_count >= 0),
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,

  CONSTRAINT chk_embedding_run_scope CHECK (
    (scope = 'global' AND scope_id IS NULL)
    OR (scope <> 'global' AND scope_id IS NOT NULL)
  ),
  -- For deployment-scoped runs, the convenience FK must match scope_id.
  CONSTRAINT chk_deployment_scope_match CHECK (
    scope <> 'deployment' OR deployment_id = scope_id
  ),
  -- For project-scoped runs, project_id must be set and equal scope_id (real-project integrity).
  CONSTRAINT chk_project_scope_match CHECK (
    scope <> 'project' OR project_id = scope_id
  )
);

CREATE INDEX idx_embedding_runs_deployment_id ON embedding_runs (deployment_id);
CREATE INDEX idx_embedding_runs_project_id ON embedding_runs (project_id);
CREATE INDEX idx_embedding_runs_status ON embedding_runs (status);
CREATE INDEX idx_embedding_runs_scope ON embedding_runs (scope, scope_id);

COMMENT ON TABLE embedding_runs IS 'One row per execution of the DINOv3 embedding pipeline (server GPU/CPU or in-browser WebGPU). Makes every vector in Qdrant traceable to a model variant, version, reduction, and clustering config; enables safe re-embedding and cross-generation comparison.';
COMMENT ON COLUMN embedding_runs.scope IS 'Granularity of the run: deployment, project, or global platform re-embed.';
COMMENT ON COLUMN embedding_runs.scope_id IS 'deployment_id or project_id depending on scope; NULL for global.';
COMMENT ON COLUMN embedding_runs.deployment_id IS 'Convenience FK for the common deployment-scoped run (NULL for project/global runs).';
COMMENT ON COLUMN embedding_runs.model_name IS 'DINOv3 variant: dinov3-vith (server ViT-H/16+) or dinov3-vits (local WebGPU ViT-S/16+). Both target a 1280d shared vector space.';
COMMENT ON COLUMN embedding_runs.embedding_dim IS 'Vector dimensionality (1280 for the shared DINOv3 collection). Validated server-side before Qdrant upsert.';
COMMENT ON COLUMN embedding_runs.execution_provider IS 'Where embeddings were computed: server_gpu, server_cpu, or webgpu (in-browser local run).';
COMMENT ON COLUMN embedding_runs.status IS 'Lifecycle: running, complete, failed, or superseded (replaced by a newer run).';

ALTER TABLE embedding_runs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.embedding_runs TO authenticated;

GRANT ALL ON public.embedding_runs TO service_role;
