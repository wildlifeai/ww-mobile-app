CREATE TABLE inat_observation_media (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),

  inat_observation_id uuid NOT NULL REFERENCES inat_observations (id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES media (id) ON DELETE CASCADE, -- WW photo included in the iNat observation

  inat_photo_id bigint,    -- iNat observation_photo id returned on upload
  original_filename text,  -- value sent to iNat as the photo original_filename (the WW media id) for sync reconciliation

  CONSTRAINT uq_inat_observation_media UNIQUE (inat_observation_id, media_id)
);

CREATE INDEX idx_inat_observation_media_obs ON inat_observation_media (inat_observation_id);
CREATE INDEX idx_inat_observation_media_media ON inat_observation_media (media_id);

COMMENT ON TABLE inat_observation_media IS 'Join table: the WW media (photos) that make up each published iNaturalist observation. Lets a thumbnail derive its iNat badge state via media_id -> inat_observations.sync_status.';
COMMENT ON COLUMN inat_observation_media.original_filename IS 'The WW media id sent to iNat as the photo original_filename; reconciliation fallback during community-ID sync.';

ALTER TABLE inat_observation_media ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.inat_observation_media TO authenticated;

GRANT ALL ON public.inat_observation_media TO service_role;
