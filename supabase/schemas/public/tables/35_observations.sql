CREATE TABLE observations (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),
  deleted_at timestamptz,

  -- Deployment and media links
  deployment_id uuid NOT NULL REFERENCES deployments (id) ON DELETE CASCADE,
  media_id uuid REFERENCES media (id) ON DELETE SET NULL,

  -- Event grouping (burst / encounter)
  event_id uuid,

  -- CamtrapDP observation fields
  observation_level text CHECK (observation_level IS NULL OR (observation_level IN ('media', 'event'))),
  observation_type text CHECK (observation_type IS NULL OR (observation_type IN ('animal', 'human', 'vehicle', 'blank', 'unknown'))),
  scientific_name text,
  count int CHECK (count IS NULL OR count >= 0),
  life_stage text CHECK (life_stage IS NULL OR (life_stage IN ('adult', 'subadult', 'juvenile', 'hatchling', 'unknown'))),
  sex text CHECK (sex IS NULL OR (sex IN ('male', 'female', 'unknown'))),
  behavior text,
  individual_id text,

  -- Classification provenance
  classification_method text CHECK (classification_method IS NULL OR (classification_method IN ('human', 'machine'))),
  classified_by text,
  classification_timestamp timestamptz,
  classification_probability float4 CHECK (
    classification_probability IS NULL
    OR (classification_probability >= 0 AND classification_probability <= 1)
  ),

  -- GBIF taxonomy validation provenance
  -- Populated async by the validate-species Edge Function after observation submission.
  -- Intentionally NOT a hard FK or blocking constraint:
  --   - AI model classifications may not map directly to GBIF backbone names
  --   - Observers may be offline at submission time
  --   - GBIF API may be temporarily unavailable
  gbif_taxon_key int,
  gbif_match_type text CHECK (gbif_match_type IS NULL OR (gbif_match_type IN ('EXACT', 'FUZZY', 'HIGHERRANK', 'NONE'))),
  gbif_confidence int CHECK (gbif_confidence IS NULL OR (gbif_confidence >= 0 AND gbif_confidence <= 100)),

  observation_tags text[],
  observation_comments text
);

-- Indexes
CREATE INDEX idx_observations_deployment_id ON observations (deployment_id);
CREATE INDEX idx_observations_media_id ON observations (media_id);
CREATE INDEX idx_observations_event_id ON observations (event_id);
CREATE INDEX idx_observations_scientific_name ON observations (scientific_name);
CREATE INDEX idx_observations_deleted_at ON observations (deleted_at);

COMMENT ON TABLE observations IS 'Species and event observations linked to media records. Equivalent to the CamtrapDP observations table.';
COMMENT ON COLUMN observations.deployment_id IS 'Deployment this observation belongs to (CamtrapDP deploymentID).';
COMMENT ON COLUMN observations.media_id IS 'Media file this observation is linked to (CamtrapDP mediaID). Null for event-level observations.';
COMMENT ON COLUMN observations.event_id IS 'Groups related observations in the same encounter event (CamtrapDP eventID).';
COMMENT ON COLUMN observations.observation_level IS 'Granularity of observation: media or event (CamtrapDP observationLevel).';
COMMENT ON COLUMN observations.observation_type IS 'Classification: animal, human, vehicle, blank, or unknown (CamtrapDP observationType).';
COMMENT ON COLUMN observations.scientific_name IS 'Scientific name of the observed taxon (CamtrapDP scientificName).';
COMMENT ON COLUMN observations.count IS 'Number of individuals observed (CamtrapDP count).';
COMMENT ON COLUMN observations.life_stage IS 'Life stage of observed individuals: adult, subadult, juvenile, hatchling, or unknown (CamtrapDP lifeStage).';
COMMENT ON COLUMN observations.sex IS 'Sex of observed individuals: male, female, or unknown (CamtrapDP sex).';
COMMENT ON COLUMN observations.behavior IS 'Observed behaviour description (CamtrapDP behavior).';
COMMENT ON COLUMN observations.individual_id IS 'Individual animal identifier if tracking marked individuals (CamtrapDP individualID).';
COMMENT ON COLUMN observations.classification_method IS 'How the observation was made: human or machine (CamtrapDP classificationMethod).';
COMMENT ON COLUMN observations.classified_by IS 'Identifier of the classifier — user display name or model name (CamtrapDP classifiedBy).';
COMMENT ON COLUMN observations.classification_timestamp IS 'When the classification was made (CamtrapDP classificationTimestamp).';
COMMENT ON COLUMN observations.classification_probability IS 'Model confidence score 0-1 (CamtrapDP classificationProbability).';
COMMENT ON COLUMN observations.gbif_taxon_key IS 'GBIF backbone taxon key returned by the validate-species Edge Function. NULL = not yet validated or no match.';
COMMENT ON COLUMN observations.gbif_match_type IS 'GBIF match quality: EXACT, FUZZY, HIGHERRANK, or NONE.';
COMMENT ON COLUMN observations.gbif_confidence IS 'GBIF match confidence score 0-100.';
COMMENT ON COLUMN observations.observation_tags IS 'Free-form tags for grouping or filtering observations (CamtrapDP observationTags).';
COMMENT ON COLUMN observations.deleted_at IS 'Soft delete timestamp — NULL means active.';

ALTER TABLE observations ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.observations TO authenticated;
