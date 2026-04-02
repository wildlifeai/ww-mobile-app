-- Helper Function: Epoch to Timestamp
CREATE OR REPLACE FUNCTION public.to_timestamp_ms(epoch_ms bigint)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_timestamp(epoch_ms / 1000.0);
$$;

-- Pull Changes RPC (needed for WatermelonDB sync)
CREATE OR REPLACE FUNCTION public.pull_changes(last_pulled_at bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _ts timestamptz;
  _changes jsonb;
  
  -- Projects
  _projects_created jsonb;
  _projects_updated jsonb;
  _projects_deleted jsonb;
  
  -- Deployments
  _deployments_created jsonb;
  _deployments_updated jsonb;
  _deployments_deleted jsonb;

  -- Devices
  _devices_created jsonb;
  _devices_updated jsonb;
  _devices_deleted jsonb;

  -- Device Preparation
  _device_prep_created jsonb;
  _device_prep_updated jsonb;
  _device_prep_deleted jsonb;

BEGIN
  _ts := to_timestamp_ms(last_pulled_at);

  -- ----------------------------------------------------------------------------
  -- PROJECTS
  -- ----------------------------------------------------------------------------
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO _projects_created
  FROM projects t
  WHERE created_at > _ts AND deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO _projects_updated
  FROM projects t
  WHERE updated_at > _ts AND created_at <= _ts AND deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(id), '[]'::jsonb) INTO _projects_deleted
  FROM projects
  WHERE deleted_at > _ts;

  -- ----------------------------------------------------------------------------
  -- DEPLOYMENTS
  -- ----------------------------------------------------------------------------
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO _deployments_created
  FROM deployments t
  WHERE created_at > _ts AND deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO _deployments_updated
  FROM deployments t
  WHERE updated_at > _ts AND created_at <= _ts AND deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(id), '[]'::jsonb) INTO _deployments_deleted
  FROM deployments
  WHERE deleted_at > _ts;

  -- ----------------------------------------------------------------------------
  -- DEVICES
  -- ----------------------------------------------------------------------------
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO _devices_created
  FROM devices t
  WHERE created_at > _ts AND deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO _devices_updated
  FROM devices t
  WHERE updated_at > _ts AND created_at <= _ts AND deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(id), '[]'::jsonb) INTO _devices_deleted
  FROM devices
  WHERE deleted_at > _ts;

  -- ----------------------------------------------------------------------------
  -- DEVICE PREPARATION
  -- ----------------------------------------------------------------------------
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO _device_prep_created
  FROM device_preparation t
  WHERE created_at > _ts AND deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO _device_prep_updated
  FROM device_preparation t
  WHERE updated_at > _ts AND created_at <= _ts AND deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(id), '[]'::jsonb) INTO _device_prep_deleted
  FROM device_preparation
  WHERE deleted_at > _ts;

  -- ----------------------------------------------------------------------------
  -- CONSTRUCT RESPONSE
  -- ----------------------------------------------------------------------------
  _changes := jsonb_build_object(
    'projects', jsonb_build_object(
      'created', _projects_created,
      'updated', _projects_updated,
      'deleted', _projects_deleted
    ),
    'deployments', jsonb_build_object(
      'created', _deployments_created,
      'updated', _deployments_updated,
      'deleted', _deployments_deleted
    ),
    'devices', jsonb_build_object(
      'created', _devices_created,
      'updated', _devices_updated,
      'deleted', _devices_deleted
    ),
    'device_preparation', jsonb_build_object(
      'created', _device_prep_created,
      'updated', _device_prep_updated,
      'deleted', _device_prep_deleted
    )
  );

  RETURN jsonb_build_object(
    'changes', _changes,
    'timestamp', (extract(epoch from now()) * 1000)::bigint
  );
END;
$$;
