-- *************************************
-- 4. Triggers using functions
-- *************************************
-- Trigger for deployments
CREATE TRIGGER trg_deployments_updated_at
BEFORE UPDATE ON deployments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Trigger for capture_methods
CREATE TRIGGER trg_capture_methods_updated_at
BEFORE UPDATE ON capture_methods
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Trigger for deployment_statuses
CREATE TRIGGER trg_deployment_statuses_updated_at
BEFORE UPDATE ON deployment_statuses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Trigger for devices
CREATE TRIGGER trg_devices_updated_at
BEFORE UPDATE ON devices
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Skip users (managed by Supabase Auth)

-- Trigger for projects
CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Trigger for log_levels
CREATE TRIGGER trg_log_levels_updated_at
BEFORE UPDATE ON log_levels
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Trigger for api_logs (T-002 enhancement)
CREATE TRIGGER trg_api_logs_updated_at
BEFORE UPDATE ON api_logs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- NEW: Triggers for MVP2 tables
-- Trigger for organisations
CREATE TRIGGER trg_organisations_updated_at
BEFORE UPDATE ON organisations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Trigger for user_roles
CREATE TRIGGER trg_user_roles_updated_at
BEFORE UPDATE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Trigger for ai_model_organisation
CREATE TRIGGER trg_ai_model_organisation_updated_at
BEFORE UPDATE ON ai_model_organisation
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Trigger for lorawan_messages
CREATE TRIGGER trg_lorawan_messages_updated_at
BEFORE UPDATE ON lorawan_messages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Trigger for lorawan_parsed_messages
CREATE TRIGGER trg_lorawan_parsed_messages_updated_at
BEFORE UPDATE ON lorawan_parsed_messages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- trigger to derive lat/long from location
CREATE TRIGGER sync_geolocation_trigger
BEFORE INSERT OR UPDATE ON public.deployments
FOR EACH ROW
EXECUTE FUNCTION public.sync_geolocation();

-- Trigger for project_invitations (moved from table file)
CREATE TRIGGER update_project_invitations_updated_at
  BEFORE UPDATE ON project_invitations
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Trigger for api_jobs
CREATE TRIGGER trg_api_jobs_updated_at
  BEFORE UPDATE ON api_jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Trigger for media
CREATE TRIGGER trg_media_updated_at
  BEFORE UPDATE ON media
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Trigger for observations
CREATE TRIGGER trg_observations_updated_at
  BEFORE UPDATE ON observations
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- NOTE: detections has no updated_at trigger — it is an append-only archive table.

-- ── v4 Wildlife Brain tables ──────────────────────────────────────────
-- NOTE: embedding_runs (created_at/completed_at) and ecological_shift_reports
-- (computed_at) intentionally have no updated_at trigger.

-- Trigger for media_assets
CREATE TRIGGER trg_media_assets_updated_at
  BEFORE UPDATE ON media_assets
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Trigger for media_embeddings
CREATE TRIGGER trg_media_embeddings_updated_at
  BEFORE UPDATE ON media_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Trigger for cluster_assignments
CREATE TRIGGER trg_cluster_assignments_updated_at
  BEFORE UPDATE ON cluster_assignments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Trigger for conservation_alerts
CREATE TRIGGER trg_conservation_alerts_updated_at
  BEFORE UPDATE ON conservation_alerts
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
-- Trigger for notification_rules (notifications is insert-then-mark-read only and
-- has no updated_at column, so it intentionally has no trigger).
CREATE TRIGGER trg_notification_rules_updated_at
  BEFORE UPDATE ON notification_rules
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Trigger for upload_quotas (keep updated_at fresh on edits).
CREATE TRIGGER trg_upload_quotas_updated_at
  BEFORE UPDATE ON upload_quotas
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Trigger for device_alert_rules
CREATE TRIGGER trg_device_alert_rules_updated_at
  BEFORE UPDATE ON device_alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
