CREATE TABLE notifications (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),

  -- Recipient. One row per user per event; fan-out to subscribers happens in the
  -- backend emitter, so each notification belongs to exactly one user.
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  -- Optional context for filtering + deep-linking from the UI. NULL for account-level.
  project_id uuid REFERENCES projects (id) ON DELETE CASCADE,
  deployment_id uuid REFERENCES deployments (id) ON DELETE CASCADE,

  type text NOT NULL CHECK (type IN (
    'species_detection',  -- a watched species was detected during AI processing
    'camera_silent',      -- an active deployment stopped reporting (LoRaWAN; future)
    'upload_complete',    -- an upload + AI run finished
    'system'              -- account/system message
  )),
  title text NOT NULL,
  body text,
  data jsonb,           -- type-specific payload (species, counts, link target)
  read_at timestamptz   -- NULL = unread
);

-- Recipient feed (newest first) + a partial index for the unread badge count.
CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications (user_id) WHERE read_at IS NULL;

-- FK indexes so ON DELETE CASCADE from projects/deployments doesn't scan the
-- whole (high-growth) table.
CREATE INDEX idx_notifications_project ON notifications (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_notifications_deployment ON notifications (deployment_id) WHERE deployment_id IS NOT NULL;

COMMENT ON TABLE notifications IS 'Per-user in-app notifications (species detections, camera-silent, upload-complete, system). One row per recipient — the backend service role fans an event out to subscribed users. Recipients read their own rows and mark them read via RLS; inserts are service-role only.';
COMMENT ON COLUMN notifications.user_id IS 'Recipient. Each notification belongs to exactly one user.';
COMMENT ON COLUMN notifications.project_id IS 'Project the notification concerns; NULL for account-level messages.';
COMMENT ON COLUMN notifications.deployment_id IS 'Deployment the notification concerns; NULL for project/account-level messages.';
COMMENT ON COLUMN notifications.data IS 'Type-specific payload, e.g. {"scientific_name":"Rattus rattus","count":3,"deployment_id":"...","link":"/annotations?..."}.';
COMMENT ON COLUMN notifications.read_at IS 'When the recipient marked it read; NULL = unread (drives the avatar badge).';

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Recipients read their own feed and mark rows read. The UPDATE grant is column-level
-- (read_at only) so recipients cannot rewrite notification content; inserts are performed
-- by the backend with the service role (no INSERT grant to authenticated).
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;

GRANT ALL ON public.notifications TO service_role;
