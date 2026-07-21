-- *** Device Alert Rules ***
--
-- Per-project LoRaWAN alerting configuration for the camera's on-device (edge) model.
-- Rules are compiled into the device config by the website manifest job — the label is
-- resolved to the deployed model version's output class index at compile time — and
-- drive what the camera transmits over LoRaWAN: instant alerts, a daily digest, or
-- smart back-off (alert immediately, then progressively suppress while the target
-- remains present; reset after a quiet window).
--
-- Distinct from notification_rules (per-USER delivery preferences, cloud side):
-- device_alert_rules decide what the DEVICE transmits; notification_rules decide who
-- is told once the decoded uplink reaches the backend.

CREATE TABLE device_alert_rules (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,

  project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  model_family_id uuid NOT NULL REFERENCES ai_model_families (id) ON DELETE CASCADE,

  -- Output class this rule fires on. Must name a role='target' label in the deployed
  -- version's ai_models.label_map (validated at manifest compile time, not by FK).
  label text NOT NULL,

  mode text NOT NULL CHECK (mode IN ('instant', 'digest', 'backoff')),
  threshold_pct smallint NOT NULL DEFAULT 80 CHECK (threshold_pct BETWEEN 1 AND 100),

  -- digest only: UTC hour of the daily digest uplink.
  digest_send_utc smallint CHECK (digest_send_utc BETWEEN 0 AND 23),

  -- backoff only: suppression steps applied after each alert, and the quiet window
  -- (no detections) that resets the sequence. Defaults: 5 min -> 30 min -> 2 h -> 12 h.
  backoff_steps_min integer [] NOT NULL DEFAULT '{5,30,120,720}',
  clear_window_min integer NOT NULL DEFAULT 60 CHECK (clear_window_min > 0),

  enabled boolean NOT NULL DEFAULT true,

  UNIQUE (project_id, model_family_id, label),

  -- digest_send_utc is only meaningful for digest rules.
  CONSTRAINT chk_alert_digest_hour CHECK (mode = 'digest' OR digest_send_utc IS null)
);

CREATE INDEX idx_device_alert_rules_project
  ON device_alert_rules (project_id) WHERE enabled;

COMMENT ON TABLE device_alert_rules IS
    'Per-project LoRaWAN alert configuration for the on-device (edge) model. '
    'Compiled into the device config by the manifest job (label resolved to a class '
    'index); the Nordic firmware executes the instant/digest/backoff strategies. '
    'Complements notification_rules, which govern per-user delivery on the cloud side.';
COMMENT ON COLUMN device_alert_rules.label IS 'Model output class the rule fires on; must be a target label in the deployed version''s label_map.';
COMMENT ON COLUMN device_alert_rules.mode IS 'instant = uplink per qualifying detection (rate-limited); digest = one daily summary; backoff = immediate first alert then progressive suppression.';
COMMENT ON COLUMN device_alert_rules.threshold_pct IS 'Minimum confidence (percent) for a detection to qualify. Converted to device logit units at manifest compile time using the model''s output quantization.';
COMMENT ON COLUMN device_alert_rules.digest_send_utc IS 'digest mode only: UTC hour (0-23) at which the daily digest uplink is sent.';
COMMENT ON COLUMN device_alert_rules.backoff_steps_min IS 'backoff mode only: minutes of suppression after each successive alert while the target remains present.';
COMMENT ON COLUMN device_alert_rules.clear_window_min IS 'backoff mode only: minutes without a qualifying detection before the sequence resets (next detection alerts instantly again).';

ALTER TABLE device_alert_rules ENABLE ROW LEVEL SECURITY;

-- Project members read; project admins manage (policies restrict, see
-- yyy_policies/93_device_alert_rules.sql). The manifest job and LoRaWAN decoder
-- read with the service role.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_alert_rules TO authenticated;

GRANT ALL ON public.device_alert_rules TO service_role;
