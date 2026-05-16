CREATE TABLE media (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),
  deleted_at timestamptz,

  -- Deployment link
  deployment_id uuid NOT NULL REFERENCES deployments (id) ON DELETE CASCADE,

  -- CamtrapDP core fields
  file_path text NOT NULL,
  file_name text,
  file_mediatype text NOT NULL DEFAULT 'image/jpeg',
  timestamp timestamptz,
  capture_method_id int REFERENCES capture_methods (id),
  exif_metadata jsonb,
  file_public boolean NOT NULL DEFAULT false,
  favorite boolean NOT NULL DEFAULT false,
  media_comments text,

  -- Provenance / deduplication
  file_hash text,
  uploaded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_media_deployment_id ON media (deployment_id);
CREATE INDEX idx_media_timestamp ON media (timestamp);
CREATE INDEX idx_media_file_hash ON media (file_hash);
CREATE INDEX idx_media_deleted_at ON media (deleted_at);

COMMENT ON TABLE media IS 'Image and video records captured by camera trap deployments. Equivalent to the CamtrapDP media table.';
COMMENT ON COLUMN media.deployment_id IS 'Deployment that produced this media file.';
COMMENT ON COLUMN media.file_path IS 'Storage path or Google Drive path for the media file.';
COMMENT ON COLUMN media.file_name IS 'Original filename from the camera or SD card.';
COMMENT ON COLUMN media.file_mediatype IS 'MIME type of the file (CamtrapDP fileMediatype).';
COMMENT ON COLUMN media.timestamp IS 'Capture timestamp extracted from EXIF (CamtrapDP timestamp).';
COMMENT ON COLUMN media.capture_method_id IS 'How the image was triggered: activity detection or timelapse (CamtrapDP captureMethod).';
COMMENT ON COLUMN media.exif_metadata IS 'Raw EXIF metadata extracted from the file on ingest.';
COMMENT ON COLUMN media.file_public IS 'Whether this file may be publicly shared (CamtrapDP filePublic).';
COMMENT ON COLUMN media.favorite IS 'User-flagged favourite image (CamtrapDP favorite).';
COMMENT ON COLUMN media.file_hash IS 'SHA-256 hash of file contents used for deduplication on upload.';
COMMENT ON COLUMN media.uploaded_by IS 'User who uploaded this file via the web interface.';
COMMENT ON COLUMN media.deleted_at IS 'Soft delete timestamp — NULL means active.';

ALTER TABLE media ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.media TO authenticated;
