CREATE TABLE inat_observations (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),

  -- WW provenance: which deployment / consolidated burst / user this came from
  deployment_id uuid NOT NULL REFERENCES deployments (id) ON DELETE CASCADE,
  observation_event_id uuid REFERENCES observation_events (id) ON DELETE SET NULL, -- consolidated burst (NULL for ad-hoc selections)
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE, -- WW user whose linked iNat account owns this observation

  -- iNaturalist identifiers (populated once the observation is created on iNat)
  inat_observation_id bigint, -- numeric iNat observation id
  inat_uuid uuid,             -- stable iNat observation uuid
  inat_uri text,              -- public iNat URL

  -- What we sent to iNaturalist
  species_guess text,
  geoprivacy text NOT NULL DEFAULT 'obscured' CHECK (geoprivacy IN ('open', 'obscured', 'private')),

  -- Sync lifecycle (drives the thumbnail iNaturalist badge colour)
  sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN (
    'pending',       -- queued for upload
    'uploaded',      -- created on iNat, awaiting community ID
    'needs_id',      -- iNat quality_grade = needs_id
    'research',      -- iNat quality_grade = research (community agrees)
    'disagreement',  -- community taxon differs from the WW label
    'failed'         -- upload or sync error
  )),
  quality_grade text CHECK (quality_grade IS NULL OR quality_grade IN ('needs_id', 'research', 'casual')),
  community_taxon text,                                            -- current consensus scientific name
  community_taxon_id uuid REFERENCES taxa (id) ON DELETE SET NULL, -- resolved to a local taxon when possible
  error_message text,                                             -- populated when sync_status = 'failed'
  last_synced_at timestamptz                                      -- last time we polled iNat for this record
);

CREATE INDEX idx_inat_observations_deployment ON inat_observations (deployment_id);
CREATE INDEX idx_inat_observations_event ON inat_observations (observation_event_id);
CREATE INDEX idx_inat_observations_user ON inat_observations (user_id);
CREATE INDEX idx_inat_observations_inat_id ON inat_observations (inat_observation_id);
CREATE INDEX idx_inat_observations_sync_status ON inat_observations (sync_status);

COMMENT ON TABLE inat_observations IS 'Maps a Wildlife Watcher burst/event to an observation published on a user''s personal iNaturalist account, and tracks the community-identification sync lifecycle (drives the thumbnail iNaturalist badge).';
COMMENT ON COLUMN inat_observations.observation_event_id IS 'Consolidated burst this iNat observation represents; NULL when published from an ad-hoc media selection.';
COMMENT ON COLUMN inat_observations.user_id IS 'WW user whose linked iNaturalist account owns the observation (token stored in inat_tokens).';
COMMENT ON COLUMN inat_observations.sync_status IS 'Upload + community-ID lifecycle; drives the iNaturalist thumbnail badge colour.';
COMMENT ON COLUMN inat_observations.community_taxon IS 'Current iNaturalist community-consensus scientific name (updated by the sync daemon).';

ALTER TABLE inat_observations ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.inat_observations TO authenticated;

GRANT ALL ON public.inat_observations TO service_role;
