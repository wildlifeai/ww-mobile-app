-- Migration: Create RPC functions for WatermelonDB Sync
-- Description: Adds pull_changes and push_changes functions to handle data synchronization.

-- ==============================================================================
-- 1. Helper Function: Epoch to Timestamp
-- ==============================================================================
CREATE OR REPLACE FUNCTION to_timestamp_ms(epoch_ms bigint)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_timestamp(epoch_ms / 1000.0);
$$;

-- ==============================================================================
-- 2. Pull Changes RPC
-- ==============================================================================
CREATE OR REPLACE FUNCTION pull_changes(last_pulled_at bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    )
    -- Add users/organisations if needed (usually read-only or handled differently)
  );

  RETURN jsonb_build_object(
    'changes', _changes,
    'timestamp', extract(epoch from now()) * 1000
  );
END;
$$;

-- ==============================================================================
-- 3. Push Changes RPC
-- ==============================================================================
CREATE OR REPLACE FUNCTION push_changes(changes jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _projects_created jsonb;
  _projects_updated jsonb;
  _projects_deleted jsonb;
  _deployments_created jsonb;
  _deployments_updated jsonb;
  _deployments_deleted jsonb;
  _record jsonb;
  _id text;
BEGIN
  -- ----------------------------------------------------------------------------
  -- PROJECTS
  -- ----------------------------------------------------------------------------
  _projects_created := changes->'projects'->'created';
  _projects_updated := changes->'projects'->'updated';
  _projects_deleted := changes->'projects'->'deleted';

  -- Insert Created
  IF _projects_created IS NOT NULL THEN
    FOR _record IN SELECT * FROM jsonb_array_elements(_projects_created)
    LOOP
      INSERT INTO projects (
        id, name, description, organisation_id, is_active, is_baited, 
        is_monitoring_marked_individuals, timelapse_interval_seconds, 
        project_image, website, created_by, modified_by, 
        created_at, updated_at
      )
      VALUES (
        _record->>'id',
        _record->>'name',
        _record->>'description',
        _record->>'organisation_id',
        (_record->>'is_active')::boolean,
        (_record->>'is_baited')::boolean,
        (_record->>'is_monitoring_marked_individuals')::boolean,
        (_record->>'timelapse_interval_seconds')::integer,
        _record->>'project_image',
        _record->>'website',
        _record->>'created_by',
        _record->>'modified_by',
        to_timestamp_ms((_record->>'created_at')::bigint),
        to_timestamp_ms((_record->>'updated_at')::bigint)
      )
      ON CONFLICT (id) DO UPDATE SET
        updated_at = EXCLUDED.updated_at; -- Idempotency
    END LOOP;
  END IF;

  -- Update Updated
  IF _projects_updated IS NOT NULL THEN
    FOR _record IN SELECT * FROM jsonb_array_elements(_projects_updated)
    LOOP
      UPDATE projects SET
        name = _record->>'name',
        description = _record->>'description',
        is_active = (_record->>'is_active')::boolean,
        is_baited = (_record->>'is_baited')::boolean,
        is_monitoring_marked_individuals = (_record->>'is_monitoring_marked_individuals')::boolean,
        timelapse_interval_seconds = (_record->>'timelapse_interval_seconds')::integer,
        project_image = _record->>'project_image',
        website = _record->>'website',
        modified_by = _record->>'modified_by',
        updated_at = to_timestamp_ms((_record->>'updated_at')::bigint)
      WHERE id = _record->>'id';
    END LOOP;
  END IF;

  -- Delete Deleted (Soft Delete)
  IF _projects_deleted IS NOT NULL THEN
    FOR _id IN SELECT * FROM jsonb_array_elements_text(_projects_deleted)
    LOOP
      UPDATE projects SET deleted_at = now() WHERE id = _id;
    END LOOP;
  END IF;

  -- ----------------------------------------------------------------------------
  -- DEPLOYMENTS
  -- ----------------------------------------------------------------------------
  _deployments_created := changes->'deployments'->'created';
  _deployments_updated := changes->'deployments'->'updated';
  _deployments_deleted := changes->'deployments'->'deleted';

  -- Insert Created
  IF _deployments_created IS NOT NULL THEN
    FOR _record IN SELECT * FROM jsonb_array_elements(_deployments_created)
    LOOP
      INSERT INTO deployments (
        id, project_id, user_id, device_id, location_name, 
        latitude, longitude, deployment_start, deployment_end,
        deployment_status_id, deployment_comments, 
        camera_location_description, camera_location_image_path,
        created_at, updated_at
      )
      VALUES (
        _record->>'id',
        _record->>'project_id',
        _record->>'user_id',
        _record->>'device_id',
        _record->>'location_name',
        (_record->>'latitude')::numeric,
        (_record->>'longitude')::numeric,
        to_timestamp_ms((_record->>'deployment_start')::bigint),
        to_timestamp_ms((_record->>'deployment_end')::bigint),
        (_record->>'deployment_status_id')::integer,
        _record->>'deployment_comments',
        _record->>'camera_location_description',
        _record->>'camera_location_image_path',
        to_timestamp_ms((_record->>'created_at')::bigint),
        to_timestamp_ms((_record->>'updated_at')::bigint)
      )
      ON CONFLICT (id) DO UPDATE SET
        updated_at = EXCLUDED.updated_at;
    END LOOP;
  END IF;

  -- Update Updated
  IF _deployments_updated IS NOT NULL THEN
    FOR _record IN SELECT * FROM jsonb_array_elements(_deployments_updated)
    LOOP
      UPDATE deployments SET
        project_id = _record->>'project_id',
        device_id = _record->>'device_id',
        location_name = _record->>'location_name',
        latitude = (_record->>'latitude')::numeric,
        longitude = (_record->>'longitude')::numeric,
        deployment_start = to_timestamp_ms((_record->>'deployment_start')::bigint),
        deployment_end = to_timestamp_ms((_record->>'deployment_end')::bigint),
        deployment_status_id = (_record->>'deployment_status_id')::integer,
        deployment_comments = _record->>'deployment_comments',
        camera_location_description = _record->>'camera_location_description',
        camera_location_image_path = _record->>'camera_location_image_path',
        updated_at = to_timestamp_ms((_record->>'updated_at')::bigint)
      WHERE id = _record->>'id';
    END LOOP;
  END IF;

  -- Delete Deleted (Soft Delete)
  IF _deployments_deleted IS NOT NULL THEN
    FOR _id IN SELECT * FROM jsonb_array_elements_text(_deployments_deleted)
    LOOP
      UPDATE deployments SET deleted_at = now() WHERE id = _id;
    END LOOP;
  END IF;

END;
$$;
