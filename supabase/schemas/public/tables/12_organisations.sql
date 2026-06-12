CREATE TABLE public.organisations (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),
  deleted_at timestamptz,
  modified_by uuid DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  is_active boolean DEFAULT true NOT NULL
);

-- Create unique partial index on slug (excluding soft deleted records)
CREATE UNIQUE INDEX organisations_slug_unique_idx ON organisations (slug)
WHERE deleted_at IS null;

COMMENT ON TABLE organisations IS 'Wildlife monitoring organisations that own and manage projects. Provides multi-tenant organisation structure for the Wildlife Watcher platform.';
COMMENT ON COLUMN organisations.name IS 'Display name of the organisation (e.g., "Wildlife Conservation Society").';
COMMENT ON COLUMN organisations.slug IS 'URL-safe unique identifier for the organisation (e.g., "wildlife-conservation-society").';
COMMENT ON COLUMN organisations.created_by IS 'ID of the user who created this organisation (must be WW Admin).';
COMMENT ON COLUMN organisations.modified_by IS 'ID of the user who last modified this organisation.';
COMMENT ON COLUMN organisations.is_active IS 'Whether the organisation is currently active and can create projects.';

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;