CREATE TABLE detections (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),

  -- Media link (cascade delete: detections are meaningless without their image)
  media_id uuid NOT NULL REFERENCES media (id) ON DELETE CASCADE,

  -- Model version lineage (mandatory for reproducibility — SET NULL preserves record if model deleted)
  ai_model_id uuid REFERENCES ai_models (id) ON DELETE SET NULL,

  -- Detection output
  category text,
  confidence float4 CHECK (
    confidence IS null
    OR (confidence >= 0 AND confidence <= 1)
  ),
  bbox jsonb,
  is_blank_candidate boolean NOT NULL DEFAULT false
);

-- Indexes
CREATE INDEX idx_detections_media_id ON detections (media_id);
CREATE INDEX idx_detections_ai_model_id ON detections (ai_model_id);
CREATE INDEX idx_detections_category ON detections (category);

COMMENT ON TABLE detections IS 'AI model detection outputs with bounding boxes. Append-only archive — one row per model run per image. Multiple rows per image are expected as models are retrained and re-run.';
COMMENT ON COLUMN detections.media_id IS 'Media file this detection was found in.';
COMMENT ON COLUMN detections.ai_model_id IS 'AI model version that produced this detection (SET NULL on delete preserves the archive record).';
COMMENT ON COLUMN detections.category IS 'Detection category output by the model: animal, person, vehicle, or blank.';
COMMENT ON COLUMN detections.confidence IS 'Model confidence score 0–1.';
COMMENT ON COLUMN detections.bbox IS 'Bounding box in normalised image coordinates: {x, y, w, h} each in range 0–1.';
COMMENT ON COLUMN detections.is_blank_candidate IS 'True when the model scored this image as likely blank (no wildlife).';

ALTER TABLE detections ENABLE ROW LEVEL SECURITY;

-- Authenticated users read via project membership (policies file)
GRANT SELECT ON public.detections TO authenticated;

-- Service role writes detections on behalf of the inference pipeline
GRANT INSERT ON public.detections TO service_role;
