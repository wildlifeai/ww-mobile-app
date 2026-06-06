CREATE TABLE species_event_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taxon_id uuid UNIQUE REFERENCES taxa (id) ON DELETE CASCADE,
  gap_minutes int NOT NULL DEFAULT 30 CHECK (gap_minutes > 0),
  min_images int NOT NULL DEFAULT 1 CHECK (min_images >= 1),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE species_event_config IS 'Configurations defining temporal grouping window criteria per species.';
COMMENT ON COLUMN species_event_config.taxon_id IS 'Unique link to the taxa table.';
COMMENT ON COLUMN species_event_config.gap_minutes IS 'Temporal gap window in minutes to cluster observations (default 30).';
COMMENT ON COLUMN species_event_config.min_images IS 'Minimum consecutive media to constitute an independent event.';

ALTER TABLE species_event_config ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.species_event_config TO authenticated;

GRANT ALL ON public.species_event_config TO service_role;
