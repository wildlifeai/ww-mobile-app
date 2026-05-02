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
SET search_path = ''
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


BEGIN
  _ts := public.to_timestamp_ms(last_pulled_at);

  -- ----------------------------------------------------------------------------
  -- PROJECTS
  -- ----------------------------------------------------------------------------
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)), '[]'::jsonb) INTO _projects_created
  FROM public.projects t
  WHERE created_at > _ts AND deleted_at IS NULL;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)), '[]'::jsonb) INTO _projects_updated
  FROM public.projects t
  WHERE updated_at > _ts AND created_at <= _ts AND deleted_at IS NULL;

  SELECT COALESCE(pg_catalog.jsonb_agg(id), '[]'::jsonb) INTO _projects_deleted
  FROM public.projects
  WHERE deleted_at > _ts;

  -- ----------------------------------------------------------------------------
  -- DEPLOYMENTS
  -- ----------------------------------------------------------------------------
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)), '[]'::jsonb) INTO _deployments_created
  FROM public.deployments t
  WHERE created_at > _ts AND deleted_at IS NULL;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)), '[]'::jsonb) INTO _deployments_updated
  FROM public.deployments t
  WHERE updated_at > _ts AND created_at <= _ts AND deleted_at IS NULL;

  SELECT COALESCE(pg_catalog.jsonb_agg(id), '[]'::jsonb) INTO _deployments_deleted
  FROM public.deployments
  WHERE deleted_at > _ts;

  -- ----------------------------------------------------------------------------
  -- DEVICES
  -- ----------------------------------------------------------------------------
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)), '[]'::jsonb) INTO _devices_created
  FROM public.devices t
  WHERE created_at > _ts AND deleted_at IS NULL;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)), '[]'::jsonb) INTO _devices_updated
  FROM public.devices t
  WHERE updated_at > _ts AND created_at <= _ts AND deleted_at IS NULL;

  SELECT COALESCE(pg_catalog.jsonb_agg(id), '[]'::jsonb) INTO _devices_deleted
  FROM public.devices
  WHERE deleted_at > _ts;



  -- ----------------------------------------------------------------------------
  -- CONSTRUCT RESPONSE
  -- ----------------------------------------------------------------------------
  _changes := pg_catalog.jsonb_build_object(
    'projects', pg_catalog.jsonb_build_object(
      'created', _projects_created,
      'updated', _projects_updated,
      'deleted', _projects_deleted
    ),
    'deployments', pg_catalog.jsonb_build_object(
      'created', _deployments_created,
      'updated', _deployments_updated,
      'deleted', _deployments_deleted
    ),
    'devices', pg_catalog.jsonb_build_object(
      'created', _devices_created,
      'updated', _devices_updated,
      'deleted', _devices_deleted
    )
  );

  RETURN pg_catalog.jsonb_build_object(
    'changes', _changes,
    'timestamp', (extract(epoch from pg_catalog.now()) * 1000)::bigint
  );
END;
$$;
