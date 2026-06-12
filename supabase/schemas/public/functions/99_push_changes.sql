CREATE OR REPLACE FUNCTION public.push_changes(changes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
    _projects_created jsonb;
    _projects_updated jsonb;
    _projects_deleted jsonb;
    _deployments_created jsonb;
    _deployments_updated jsonb;
    _deployments_deleted jsonb;
    _devices_created jsonb;
    _devices_updated jsonb;
    _devices_deleted jsonb;
    _processed_count int := 0;
    _conflicts jsonb := '[]'::jsonb;
    _item jsonb;
BEGIN
    -- Extract changes
    _projects_created := changes->'projects'->'created';
    _projects_updated := changes->'projects'->'updated';
    _projects_deleted := changes->'projects'->'deleted';
    
    _devices_created := changes->'devices'->'created';
    _devices_updated := changes->'devices'->'updated';
    _devices_deleted := changes->'devices'->'deleted';

    _deployments_created := changes->'deployments'->'created';
    _deployments_updated := changes->'deployments'->'updated';
    _deployments_deleted := changes->'deployments'->'deleted';

    -- 1. PROJECTS: Created
    IF _projects_created IS NOT NULL THEN
        FOR _item IN SELECT * FROM pg_catalog.jsonb_array_elements(_projects_created)
        LOOP
            INSERT INTO public.projects (
                id, name, description, organisation_id, created_by, modified_by,
                is_active, sampling_design_id, website, model_id, capture_method_id,
                activity_detection_sensitivity_id, timelapse_interval_seconds,
                is_baited, is_monitoring_marked_individuals, project_image,
                created_at, updated_at
            )
            VALUES (
                (_item->>'id')::uuid,
                _item->>'name',
                _item->>'description',
                (_item->>'organisation_id')::uuid,
                (_item->>'created_by')::uuid,
                (_item->>'modified_by')::uuid,
                COALESCE((_item->>'is_active')::boolean, true),
                (_item->>'sampling_design_id')::int,
                _item->>'website',
                (_item->>'model_id')::uuid,
                (_item->>'capture_method_id')::int,
                (_item->>'activity_detection_sensitivity_id')::int,
                (_item->>'timelapse_interval_seconds')::int,
                (_item->>'is_baited')::boolean,
                (_item->>'is_monitoring_marked_individuals')::boolean,
                _item->>'project_image',
                (_item->>'created_at')::timestamptz,
                (_item->>'updated_at')::timestamptz
            )
            ON CONFLICT (id) DO NOTHING;
            _processed_count := _processed_count + 1;
        END LOOP;
    END IF;

    -- PROJECTS: Updated
    IF _projects_updated IS NOT NULL THEN
        FOR _item IN SELECT * FROM pg_catalog.jsonb_array_elements(_projects_updated)
        LOOP
            UPDATE public.projects
            SET
                name = _item->>'name',
                description = _item->>'description',
                organisation_id = (_item->>'organisation_id')::uuid,
                modified_by = (_item->>'modified_by')::uuid,
                is_active = COALESCE((_item->>'is_active')::boolean, true),
                sampling_design_id = (_item->>'sampling_design_id')::int,
                website = _item->>'website',
                model_id = (_item->>'model_id')::uuid,
                capture_method_id = (_item->>'capture_method_id')::int,
                activity_detection_sensitivity_id = (_item->>'activity_detection_sensitivity_id')::int,
                timelapse_interval_seconds = (_item->>'timelapse_interval_seconds')::int,
                is_baited = (_item->>'is_baited')::boolean,
                is_monitoring_marked_individuals = (_item->>'is_monitoring_marked_individuals')::boolean,
                project_image = _item->>'project_image',
                updated_at = (_item->>'updated_at')::timestamptz
            WHERE id = (_item->>'id')::uuid;
            _processed_count := _processed_count + 1;
        END LOOP;
    END IF;

    -- PROJECTS: Deleted (String IDs)
    IF _projects_deleted IS NOT NULL THEN
        FOR _item IN SELECT * FROM pg_catalog.jsonb_array_elements(_projects_deleted)
        LOOP
            UPDATE public.projects
            SET deleted_at = pg_catalog.now()
            WHERE id = (_item#>>'{}'::text[])::uuid;
            _processed_count := _processed_count + 1;
        END LOOP;
    END IF;

    -- 2. DEVICES: Created
    IF _devices_created IS NOT NULL THEN
        FOR _item IN SELECT * FROM pg_catalog.jsonb_array_elements(_devices_created)
        LOOP
            INSERT INTO public.devices (
                id,
                bluetooth_id,
                organisation_id,
                name,
                device_eui,
                modified_by,
                created_at,
                updated_at
            )
            VALUES (
                (_item->>'id')::uuid,
                _item->>'bluetooth_id',
                (_item->>'organisation_id')::uuid,
                _item->>'name',
                _item->>'device_eui',
                (_item->>'modified_by')::uuid,
                (_item->>'created_at')::timestamptz,
                (_item->>'updated_at')::timestamptz
            )
            ON CONFLICT (id) DO NOTHING;
            _processed_count := _processed_count + 1;
        END LOOP;
    END IF;

    -- DEVICES: Updated
    IF _devices_updated IS NOT NULL THEN
        FOR _item IN SELECT * FROM pg_catalog.jsonb_array_elements(_devices_updated)
        LOOP
            UPDATE public.devices
            SET
                bluetooth_id = _item->>'bluetooth_id',
                organisation_id = (_item->>'organisation_id')::uuid,
                name = _item->>'name',
                device_eui = _item->>'device_eui',
                modified_by = (_item->>'modified_by')::uuid,
                updated_at = (_item->>'updated_at')::timestamptz
            WHERE id = (_item->>'id')::uuid;
            _processed_count := _processed_count + 1;
        END LOOP;
    END IF;

    -- DEVICES: Deleted (String IDs)
    IF _devices_deleted IS NOT NULL THEN
        FOR _item IN SELECT * FROM pg_catalog.jsonb_array_elements(_devices_deleted)
        LOOP
            UPDATE public.devices
            SET deleted_at = pg_catalog.now()
            WHERE id = (_item#>>'{}'::text[])::uuid;
            _processed_count := _processed_count + 1;
        END LOOP;
    END IF;

    -- 4. DEPLOYMENTS: Created
    IF _deployments_created IS NOT NULL THEN
        FOR _item IN SELECT * FROM pg_catalog.jsonb_array_elements(_deployments_created)
        LOOP
            INSERT INTO public.deployments (
                id, 
                project_id, 
                name, 
                setup_by, 
                deployment_start, 
                deployment_end,
                ended_by,
                deployment_status_id, 
                capture_method_id, 
                location_name,
                location_description, 
                latitude, 
                longitude,
                camera_location_image_paths, 
                deployment_photos,
                device_id,
                start_deployment_comments,
                end_deployment_comments,
                camera_height,
                activity_detection_sensitivity_id,
                timelapse_interval_seconds,
                location_data,
                altitude,
                accuracy,
                camera_model,
                lorawan_network,
                device_eui,
                lorawan_registration_completed,
                lorawan_last_verified_at,
                ai_model_id,
                ble_firmware_id,
                himax_firmware_id,
                battery_level_at_start,
                sd_card_total_kb_at_start,
                sd_card_available_kb_at_start,
                lorawan_rssi_at_start,
                lorawan_snr_at_start,
                created_at,
                updated_at
            )
            VALUES (
                (_item->>'id')::uuid,
                (_item->>'project_id')::uuid,
                _item->>'name',
                (_item->>'setup_by')::uuid,
                (_item->>'deployment_start')::timestamptz,
                (_item->>'deployment_end')::timestamptz,
                (_item->>'ended_by')::uuid,
                (_item->>'deployment_status_id')::int,
                (_item->>'capture_method_id')::int,
                _item->>'location_name',
                COALESCE(_item->>'location_description', _item->>'camera_location_description'),
                public.safe_to_double(NULLIF(_item->>'latitude', '')),
                public.safe_to_double(NULLIF(_item->>'longitude', '')),
                CASE 
                    WHEN _item->>'camera_location_image_path' IS NOT NULL 
                    THEN pg_catalog.jsonb_build_array(_item->>'camera_location_image_path')
                    WHEN _item->>'camera_location_image_paths' IS NOT NULL
                    THEN (_item->'camera_location_image_paths')
                    ELSE NULL
                END,
                (_item->'deployment_photos'),
                (_item->>'device_id')::uuid,
                _item->>'start_deployment_comments',
                _item->>'end_deployment_comments',
                public.safe_to_numeric(NULLIF(_item->>'camera_height', '')),
                (_item->>'activity_detection_sensitivity_id')::int,
                (_item->>'timelapse_interval_seconds')::int,
                (_item->>'location')::jsonb,
                public.safe_to_double(NULLIF(_item->>'altitude', '')),
                public.safe_to_double(NULLIF(_item->>'accuracy', '')),
                _item->>'camera_model',
                _item->>'lorawan_network',
                _item->>'device_eui',
                COALESCE((_item->>'lorawan_registration_completed')::boolean, false),
                (_item->>'lorawan_last_verified_at')::timestamptz,
                (_item->>'ai_model_id')::uuid,
                (_item->>'ble_firmware_id')::uuid,
                (_item->>'himax_firmware_id')::uuid,
                (_item->>'battery_level_at_start')::int,
                (_item->>'sd_card_total_kb_at_start')::int,
                (_item->>'sd_card_available_kb_at_start')::int,
                (_item->>'lorawan_rssi_at_start')::int,
                public.safe_to_double(NULLIF(_item->>'lorawan_snr_at_start', '')),
                (_item->>'created_at')::timestamptz,
                (_item->>'updated_at')::timestamptz
            )
            ON CONFLICT (id) DO NOTHING;
            _processed_count := _processed_count + 1;
        END LOOP;
    END IF;

    -- DEPLOYMENTS: Updated
    IF _deployments_updated IS NOT NULL THEN
        FOR _item IN SELECT * FROM pg_catalog.jsonb_array_elements(_deployments_updated)
        LOOP
            UPDATE public.deployments
            SET
                project_id = (_item->>'project_id')::uuid,
                name = _item->>'name',
                deployment_start = (_item->>'deployment_start')::timestamptz,
                deployment_end = (_item->>'deployment_end')::timestamptz,
                ended_by = (_item->>'ended_by')::uuid,
                deployment_status_id = (_item->>'deployment_status_id')::int,
                capture_method_id = (_item->>'capture_method_id')::int,
                location_name = _item->>'location_name',
                location_description = COALESCE(_item->>'location_description', _item->>'camera_location_description'),
                latitude = public.safe_to_double(NULLIF(_item->>'latitude', '')),
                longitude = public.safe_to_double(NULLIF(_item->>'longitude', '')),
                camera_location_image_paths = CASE 
                    WHEN _item->>'camera_location_image_path' IS NOT NULL 
                    THEN pg_catalog.jsonb_build_array(_item->>'camera_location_image_path')
                    WHEN _item->>'camera_location_image_paths' IS NOT NULL
                    THEN (_item->'camera_location_image_paths')
                    ELSE camera_location_image_paths
                END,
                deployment_photos = (_item->'deployment_photos'),
                device_id = (_item->>'device_id')::uuid,
                start_deployment_comments = _item->>'start_deployment_comments',
                end_deployment_comments = _item->>'end_deployment_comments',
                camera_height = public.safe_to_numeric(NULLIF(_item->>'camera_height', '')),
                activity_detection_sensitivity_id = (_item->>'activity_detection_sensitivity_id')::int,
                timelapse_interval_seconds = (_item->>'timelapse_interval_seconds')::int,
                location_data = (_item->>'location')::jsonb,
                altitude = public.safe_to_double(NULLIF(_item->>'altitude', '')),
                accuracy = public.safe_to_double(NULLIF(_item->>'accuracy', '')),
                camera_model = _item->>'camera_model',
                lorawan_network = _item->>'lorawan_network',
                device_eui = _item->>'device_eui',
                lorawan_registration_completed = COALESCE((_item->>'lorawan_registration_completed')::boolean, lorawan_registration_completed),
                lorawan_last_verified_at = (_item->>'lorawan_last_verified_at')::timestamptz,
                ai_model_id = (_item->>'ai_model_id')::uuid,
                ble_firmware_id = (_item->>'ble_firmware_id')::uuid,
                himax_firmware_id = (_item->>'himax_firmware_id')::uuid,
                battery_level_at_start = (_item->>'battery_level_at_start')::int,
                sd_card_total_kb_at_start = (_item->>'sd_card_total_kb_at_start')::int,
                sd_card_available_kb_at_start = (_item->>'sd_card_available_kb_at_start')::int,
                lorawan_rssi_at_start = (_item->>'lorawan_rssi_at_start')::int,
                lorawan_snr_at_start = public.safe_to_double(NULLIF(_item->>'lorawan_snr_at_start', '')),
                updated_at = (_item->>'updated_at')::timestamptz
            WHERE id = (_item->>'id')::uuid;
            _processed_count := _processed_count + 1;
        END LOOP;
    END IF;

    -- DEPLOYMENTS: Deleted (String IDs)
    IF _deployments_deleted IS NOT NULL THEN
        FOR _item IN SELECT * FROM pg_catalog.jsonb_array_elements(_deployments_deleted)
        LOOP
            UPDATE public.deployments
            SET deleted_at = pg_catalog.now()
            WHERE id = (_item#>>'{}'::text[])::uuid;
            _processed_count := _processed_count + 1;
        END LOOP;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'processed', _processed_count,
        'conflicts', _conflicts
    );
END;
$function$;
