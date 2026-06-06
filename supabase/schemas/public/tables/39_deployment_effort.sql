CREATE TABLE deployment_effort (
  deployment_id uuid PRIMARY KEY REFERENCES deployments (id) ON DELETE CASCADE,
  trap_nights float4 NOT NULL DEFAULT 0 CHECK (trap_nights >= 0),
  camera_uptime_hours float4 NOT NULL DEFAULT 0 CHECK (camera_uptime_hours >= 0),
  battery_failures int NOT NULL DEFAULT 0 CHECK (battery_failures >= 0),
  false_trigger_rate float4 NOT NULL DEFAULT 0 CHECK (false_trigger_rate >= 0 AND false_trigger_rate <= 1),
  total_events int NOT NULL DEFAULT 0 CHECK (total_events >= 0),
  total_media int NOT NULL DEFAULT 0 CHECK (total_media >= 0),
  computed_at timestamptz DEFAULT now()
);

COMMENT ON TABLE deployment_effort IS 'Maintains trap nights and camera uptime statistics for effort-normalized species detection rates.';
COMMENT ON COLUMN deployment_effort.deployment_id IS 'Primary key linking to deployments (CASCADE delete).';
COMMENT ON COLUMN deployment_effort.trap_nights IS 'Computed trap nights (days active).';
COMMENT ON COLUMN deployment_effort.camera_uptime_hours IS 'Computed camera uptime hours.';
COMMENT ON COLUMN deployment_effort.battery_failures IS 'Number of power/battery failures observed.';
COMMENT ON COLUMN deployment_effort.false_trigger_rate IS 'Fraction of false triggers (empty_events / total_events).';
COMMENT ON COLUMN deployment_effort.total_events IS 'Total clustered events for this deployment.';
COMMENT ON COLUMN deployment_effort.total_media IS 'Total media files registered.';

ALTER TABLE deployment_effort ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.deployment_effort TO authenticated;

GRANT ALL ON public.deployment_effort TO service_role;
