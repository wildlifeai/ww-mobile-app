CREATE TABLE observation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,

  deployment_id uuid NOT NULL REFERENCES deployments (id) ON DELETE CASCADE,
  taxon_id uuid REFERENCES taxa (id) ON DELETE SET NULL,

  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  event_duration_seconds int NOT NULL CHECK (event_duration_seconds >= 0),
  CONSTRAINT chk_event_times CHECK (end_time >= start_time),
  media_count int NOT NULL DEFAULT 1 CHECK (media_count >= 1),
  primary_media_id uuid,
  CONSTRAINT fk_observation_events_primary_media
    FOREIGN KEY (primary_media_id, deployment_id)
    REFERENCES media (id, deployment_id) ON DELETE SET NULL,

  review_status text NOT NULL DEFAULT 'unreviewed' CHECK (
    review_status IN ('unreviewed', 'ai_reviewed', 'human_reviewed', 'expert_reviewed', 'consensus_approved')
  ),
  confidence float4 CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  empty_event_score float4 CHECK (empty_event_score IS NULL OR (empty_event_score >= 0 AND empty_event_score <= 1)),
  trigger_type text CHECK (
    trigger_type IS NULL OR trigger_type IN ('animal', 'wind', 'rain', 'lightning', 'vegetation', 'unknown')
  ),
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  validated_by uuid REFERENCES users (id) ON DELETE SET NULL
);

-- Unique constraint to support composite FK from observations
ALTER TABLE observation_events ADD CONSTRAINT uq_observation_events_id_deployment UNIQUE (id, deployment_id);

-- Indexes
CREATE INDEX idx_observation_events_deployment ON observation_events (deployment_id);
CREATE INDEX idx_observation_events_taxon ON observation_events (taxon_id);
CREATE INDEX idx_observation_events_start_time ON observation_events (start_time);
CREATE INDEX idx_observation_events_deleted ON observation_events (deleted_at);

COMMENT ON TABLE observation_events IS 'Ecological grouping unit representing independent capture events of a specific species.';
COMMENT ON COLUMN observation_events.deployment_id IS 'Deployment where this event occurred.';
COMMENT ON COLUMN observation_events.taxon_id IS 'Taxon detected during this event.';
COMMENT ON COLUMN observation_events.start_time IS 'Timestamp of the first media file in the event burst.';
COMMENT ON COLUMN observation_events.end_time IS 'Timestamp of the last media file in the event burst.';
COMMENT ON COLUMN observation_events.event_duration_seconds IS 'Duration in seconds between the first and last media.';
COMMENT ON COLUMN observation_events.media_count IS 'Total number of media files in this event.';
COMMENT ON COLUMN observation_events.primary_media_id IS 'Representative media file for this event (highest confidence frame).';
COMMENT ON COLUMN observation_events.review_status IS 'Workflow validation status.';
COMMENT ON COLUMN observation_events.confidence IS 'Aggregated confidence across member detections.';
COMMENT ON COLUMN observation_events.empty_event_score IS 'Probability this event is a false trigger (e.g. wind, leaves).';
COMMENT ON COLUMN observation_events.trigger_type IS 'Scientific trigger category.';

ALTER TABLE observation_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.observation_events TO authenticated;
