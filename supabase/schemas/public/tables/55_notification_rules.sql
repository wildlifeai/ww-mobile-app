CREATE TABLE notification_rules (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),

  -- Whose preference this is, and for which project. One rule per (user, project, event).
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,

  event_type text NOT NULL CHECK (event_type IN (
    'species_detection',
    'camera_silent',
    'upload_complete'
  )),

  -- For species_detection: NULL = any species; otherwise a case-insensitive substring
  -- matched against the detected scientific/vernacular name (e.g. 'rat', 'Mustela').
  species_filter text,

  -- Delivery channels (subset of web/email/push). push is recorded but delivered by the
  -- mobile app, not this backend.
  channels text[] NOT NULL DEFAULT ARRAY['web']::text[]
    CHECK (channels <@ ARRAY['web', 'email', 'push']::text[]),

  digest text NOT NULL DEFAULT 'immediate' CHECK (digest IN ('immediate', 'daily')),
  is_active boolean NOT NULL DEFAULT true,

  UNIQUE (user_id, project_id, event_type)
);

CREATE INDEX idx_notification_rules_project_event
  ON notification_rules (project_id, event_type) WHERE is_active;

COMMENT ON TABLE notification_rules IS 'Per-user, per-project notification preferences: which events to be told about, an optional species filter, and which channels (web/email/push) + digest cadence. The backend emitter consults these to decide who to notify and how. Managed by the owning user via RLS.';
COMMENT ON COLUMN notification_rules.species_filter IS 'species_detection only: NULL = any species; else a case-insensitive substring match on the detected name.';
COMMENT ON COLUMN notification_rules.channels IS 'Subset of {web,email,push}. push is recorded here but delivered by the mobile app.';
COMMENT ON COLUMN notification_rules.digest IS 'immediate = one message per event; daily = batched into a daily rollup (scheduled sweep).';

ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;

-- Users manage their own rules; the backend (service role) reads them when emitting.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_rules TO authenticated;

GRANT ALL ON public.notification_rules TO service_role;
