CREATE TABLE observations (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),
  deleted_at timestamptz,

  -- Deployment, media, and event links
  deployment_id uuid NOT NULL REFERENCES deployments (id) ON DELETE CASCADE,
  media_id uuid,
  observation_event_id uuid,
  CONSTRAINT fk_observations_media
    FOREIGN KEY (media_id, deployment_id)
    REFERENCES media (id, deployment_id) ON DELETE SET NULL,
  CONSTRAINT fk_observations_event
    FOREIGN KEY (observation_event_id, deployment_id)
    REFERENCES observation_events (id, deployment_id) ON DELETE SET NULL,

  -- CamtrapDP observationLevel and observationType discriminators
  observation_level text CHECK (observation_level IS NULL OR (observation_level IN ('media', 'event'))),
  observation_type text CHECK (observation_type IS NULL OR (observation_type IN ('animal', 'human', 'vehicle', 'blank', 'unknown'))),

  -- Taxonomy references
  taxon_id uuid REFERENCES taxa (id) ON DELETE SET NULL,
  scientific_name text, -- Denormalised for direct CamtrapDP compatibility
  vernacular_name text,

  -- Bounding Box geometry (observation_level = 'media' only)
  bbox_x float4 CHECK (bbox_x IS NULL OR (bbox_x >= 0 AND bbox_x <= 1)),
  bbox_y float4 CHECK (bbox_y IS NULL OR (bbox_y >= 0 AND bbox_y <= 1)),
  bbox_w float4 CHECK (bbox_w IS NULL OR (bbox_w >= 0 AND bbox_w <= 1)),
  bbox_h float4 CHECK (bbox_h IS NULL OR (bbox_h >= 0 AND bbox_h <= 1)),
  CONSTRAINT chk_bbox_complete CHECK (
    (bbox_x IS NULL AND bbox_y IS NULL AND bbox_w IS NULL AND bbox_h IS NULL)
    OR (bbox_x IS NOT NULL AND bbox_y IS NOT NULL AND bbox_w IS NOT NULL AND bbox_h IS NOT NULL)
  ),
  CONSTRAINT chk_bbox_level CHECK (
    (bbox_x IS NULL AND bbox_y IS NULL AND bbox_w IS NULL AND bbox_h IS NULL)
    OR (observation_level IS NOT DISTINCT FROM 'media')
  ),
  classifier_category text, -- 'animal' | 'person' | 'vehicle' | 'blank'

  -- Per-observation rendition: this detection's bbox cropped from the frame
  -- (Supabase Storage, media-renditions bucket). Complements the single hero
  -- crop on media_assets.animal_crop_url so multi-animal frames get one crop per
  -- box. NULL for whole-image/blank observations or until the crop pipeline runs.
  crop_url text,

  -- Count and physical metrics
  count int CHECK (count IS NULL OR count >= 0),
  life_stage text CHECK (life_stage IS NULL OR (life_stage IN ('adult', 'subadult', 'juvenile', 'hatchling', 'unknown'))),
  sex text CHECK (sex IS NULL OR (sex IN ('male', 'female', 'unknown'))),
  behavior text,
  individual_id text,

  -- Provenance (traceable lineage)
  source_type text CHECK (source_type IS NULL OR (source_type IN ('ai', 'human', 'imported', 'consensus'))),
  -- For source_type='ai': which AI layer produced the row. 'edge' = the camera's
  -- on-device model (ingested from EXIF UserComment); 'cloud' = the website
  -- pipeline (SpeciesNet/BioCLIP). NULL for human/imported/consensus rows.
  ai_origin text CHECK (ai_origin IS NULL OR (ai_origin IN ('edge', 'cloud'))),
  source_model_id uuid REFERENCES ai_models (id) ON DELETE SET NULL,
  source_model_version text,
  annotator_id uuid REFERENCES users (id) ON DELETE SET NULL,
  reviewer_id uuid REFERENCES users (id) ON DELETE SET NULL,
  review_status text NOT NULL DEFAULT 'unreviewed' CHECK (
    review_status IN ('unreviewed', 'ai_reviewed', 'human_reviewed', 'expert_reviewed', 'consensus_approved')
  ),

  -- Confidence metrics
  confidence float4 CHECK (
    confidence IS NULL
    OR (confidence >= 0 AND confidence <= 1)
  ),
  classification_method text CHECK (classification_method IS NULL OR (classification_method IN ('human', 'machine'))),
  classified_by text,
  classification_timestamp timestamptz,
  classification_probability float4 CHECK (
    classification_probability IS NULL
    OR (classification_probability >= 0 AND classification_probability <= 1)
  ),

  -- Embedding provenance (Wildlife Brain — links a label back to the run/cluster that proposed it)
  embedding_run_id uuid REFERENCES embedding_runs (id) ON DELETE SET NULL,
  cluster_id int, -- HDBSCAN label this observation was confirmed from (NULL for non-cluster labels)
  -- A cluster-derived label must record which run it came from (traceable provenance).
  CONSTRAINT chk_obs_cluster_provenance CHECK (cluster_id IS NULL OR embedding_run_id IS NOT NULL),

  -- Extra metadata
  observation_tags text [],
  observation_comments text
);

-- Indexes
CREATE INDEX idx_observations_deployment_id ON observations (deployment_id);
CREATE INDEX idx_observations_media_id ON observations (media_id);
CREATE INDEX idx_observations_event_id ON observations (observation_event_id);
CREATE INDEX idx_observations_taxon_id ON observations (taxon_id);
CREATE INDEX idx_observations_deleted_at ON observations (deleted_at);

COMMENT ON TABLE observations IS 'Unified table for image-level detections (observation_level=media) and ecologically grouped events (observation_level=event). Collapses previous detections and observations tables to conform to CamtrapDP.';
COMMENT ON COLUMN observations.deployment_id IS 'Deployment of interest (CamtrapDP deploymentID).';
COMMENT ON COLUMN observations.media_id IS 'Media file containing this observation (null for event-level records).';
COMMENT ON COLUMN observations.observation_event_id IS 'Link to the parent observation_events ecological grouping.';
COMMENT ON COLUMN observations.observation_level IS 'Discriminating level: media (bounding box on image) or event (ecological burst grouping).';
COMMENT ON COLUMN observations.observation_type IS 'Category classification: animal, human, vehicle, blank, or unknown.';
COMMENT ON COLUMN observations.taxon_id IS 'Link to taxonomical reference table.';
COMMENT ON COLUMN observations.scientific_name IS 'Denormalised scientific name (e.g. Apteryx mantelli) for direct CamtrapDP compatibility.';
COMMENT ON COLUMN observations.crop_url IS 'Per-observation bounding-box crop in Supabase Storage (media-renditions bucket). One crop per detection, complementing media_assets.animal_crop_url (the single hero crop). NULL for whole-image/blank observations.';
COMMENT ON COLUMN observations.vernacular_name IS 'Denormalised common name (e.g. North Island Brown Kiwi).';
COMMENT ON COLUMN observations.source_type IS 'Indicates whether the label came from AI, human review, imported packages, or consensus voting.';
COMMENT ON COLUMN observations.ai_origin IS 'AI layer that produced an ai-sourced row: edge (camera on-device model, via EXIF) or cloud (website SpeciesNet/BioCLIP pipeline). NULL for non-AI rows.';
COMMENT ON COLUMN observations.source_model_id IS 'AI model reference if generated automatically.';
COMMENT ON COLUMN observations.annotator_id IS 'Authenticating user ID who labeled this record.';
COMMENT ON COLUMN observations.reviewer_id IS 'Authenticating user ID who verified this record.';
COMMENT ON COLUMN observations.review_status IS 'Scientific validation workflow stage.';
COMMENT ON COLUMN observations.embedding_run_id IS 'Embedding run whose cluster proposed this label (deep provenance for publications/audits).';
COMMENT ON COLUMN observations.cluster_id IS 'HDBSCAN cluster label this observation was bulk-confirmed from (NULL when not cluster-derived).';

ALTER TABLE observations ENABLE ROW LEVEL SECURITY;

-- authenticated may read and write observations (writes scoped by RLS, see
-- yyy_policies/71_observations.sql). DELETE withheld — soft-deletes are UPDATEs.
GRANT SELECT, INSERT, UPDATE ON public.observations TO authenticated;

GRANT ALL ON public.observations TO service_role;
