CREATE TABLE media_assets (
  media_id uuid PRIMARY KEY REFERENCES media (id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),

  -- Storage-agnostic provider + key (resolved by the website Media Registry).
  storage_provider text
    CHECK (storage_provider IS NULL OR storage_provider IN ('google_drive', 'azure_blob', 'supabase_storage')),
  storage_key text, -- Google Drive file ID or storage path

  -- Derived renditions served from the public Supabase Storage bucket (media-renditions).
  thumbnail_url text,    -- ~300px JPEG (grid)
  preview_url text,      -- ~800px JPEG (detail panel)
  animal_crop_url text,  -- best-detection bbox crop, DINOv3 input

  -- Source image dimensions / size.
  file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  original_width int CHECK (original_width IS NULL OR original_width > 0),
  original_height int CHECK (original_height IS NULL OR original_height > 0),

  -- Dimensions are known as a pair or not at all.
  CONSTRAINT chk_dimensions_complete CHECK (
    (original_width IS NULL AND original_height IS NULL)
    OR (original_width IS NOT NULL AND original_height IS NOT NULL)
  ),

  -- A storage location is described by provider + key together, or neither.
  CONSTRAINT chk_storage_complete CHECK (
    (storage_provider IS NULL AND storage_key IS NULL)
    OR (storage_provider IS NOT NULL AND storage_key IS NOT NULL)
  )
);

COMMENT ON TABLE media_assets IS 'Website/AI-derived storage metadata and CDN renditions for a media row. Kept separate from the mobile-synced media table so AI columns never bloat offline sync.';
COMMENT ON COLUMN media_assets.storage_provider IS 'Where the rendition lives: supabase_storage (default), google_drive, or azure_blob.';
COMMENT ON COLUMN media_assets.storage_key IS 'Provider-specific key: Google Drive file ID or storage object path.';
COMMENT ON COLUMN media_assets.thumbnail_url IS '~300px JPEG served from the public Supabase Storage CDN; primary source for the image grid.';
COMMENT ON COLUMN media_assets.preview_url IS '~800px JPEG served from the public Supabase Storage CDN; used in the detail panel.';
COMMENT ON COLUMN media_assets.animal_crop_url IS 'Best-detection bounding-box crop in Supabase Storage; consumed as DINOv3 input.';

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.media_assets TO authenticated;

GRANT ALL ON public.media_assets TO service_role;
