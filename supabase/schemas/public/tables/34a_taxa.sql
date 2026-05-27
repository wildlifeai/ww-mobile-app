CREATE TABLE taxa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scientific_name text UNIQUE NOT NULL,
  common_name text,
  rank text NOT NULL CHECK (rank IN ('kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species', 'subspecies')),
  kingdom text,
  phylum text,
  class text,
  order_name text,
  family text,
  genus text,
  species text,
  gbif_taxon_id text,
  inat_taxon_id text,
  nzor_id text,
  conservation_status text,
  invasive_status boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE taxa IS 'Taxonomy reference table for resolving scientific and common names of observed species.';
COMMENT ON COLUMN taxa.scientific_name IS 'Unique scientific name of the taxon (e.g. Apteryx mantelli).';
COMMENT ON COLUMN taxa.common_name IS 'Common name or vernacular name (e.g. North Island Brown Kiwi).';
COMMENT ON COLUMN taxa.rank IS 'Taxonomic rank (e.g. species, genus, family).';
COMMENT ON COLUMN taxa.gbif_taxon_id IS 'GBIF backbone taxon ID for integration and export validation.';
COMMENT ON COLUMN taxa.inat_taxon_id IS 'iNaturalist taxon ID for upload mapping and syncing.';
COMMENT ON COLUMN taxa.nzor_id IS 'New Zealand Organisms Register ID for local context.';
COMMENT ON COLUMN taxa.conservation_status IS 'IUCN conservation status (e.g. LC, NT, VU, EN, CR).';
COMMENT ON COLUMN taxa.invasive_status IS 'True if the species is introduced/invasive in New Zealand.';

ALTER TABLE taxa ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.taxa TO authenticated;
