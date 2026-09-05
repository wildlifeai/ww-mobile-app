-- SECURITY INVOKER, deliberately (issue #166). This was SECURITY DEFINER and so
-- bypassed RLS, while performing no authorisation of its own: every write below is
-- a bare `WHERE id = (_item->>'id')::uuid` with no ownership test. Any authenticated
-- user could modify any organisation's projects, devices and deployments —
-- demonstrated by renaming another org's project from an unrelated user's session.
-- The `deleted` branches were cheaper still, needing only an id.
--
-- As INVOKER the existing INSERT/UPDATE policies authorise each write, so a row the
-- caller may not touch simply does not match and is reported in `conflicts` rather
-- than silently applied. `authenticated` already holds INSERT/UPDATE/DELETE on all
-- three tables, so RLS — not a missing grant — is what does the rejecting.
--
-- A row that affects 0 rows is reported in `conflicts` as {id, reason: 'not_applied'}
-- and is NOT counted in `processed`. The reason is deliberately non-specific: an
-- UPDATE matching nothing may be an RLS rejection, a deleted row or a bad id, and an
-- INSERT ... ON CONFLICT DO NOTHING may simply be a duplicate — distinguishing them
-- would need extra queries per row. Before this, every branch incremented
-- `processed` unconditionally, so a write RLS had silently dropped was reported to
-- the client as success; WatermelonDB would mark it synced and lose the change.
CREATE OR REPLACE FUNCTION public.push_changes(changes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
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
    _affected int;
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
                lorawan_required, record_gps_in_images, is_archived,
                flash_mode, flash_led,
                flash_window_start_minutes_utc, flash_window_minutes,
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
                -- Added in #170. Each fallback must equal the column's own DEFAULT: a
                -- payload from an older app build carries none of these keys, and
                -- because this INSERT names the columns explicitly the table default
                -- never gets a chance to apply. On INSERT (unlike UPDATE) there is no
                -- stored value to preserve, so the fallback is the only value there is.
                --
                -- flash_mode was 'light_sensor' here until #173 changed the column
                -- default to 'off' and left this line behind, so a project created by
                -- an older build deployed with the one mode whose behaviour depends on
                -- a light check we do not yet trust. Test 17 now compares these
                -- fallbacks against the table defaults so the pair cannot drift again.
                COALESCE((_item->>'lorawan_required')::boolean, false),
                COALESCE((_item->>'record_gps_in_images')::boolean, false),
                COALESCE((_item->>'is_archived')::boolean, false),
                COALESCE(_item->>'flash_mode', 'off'),
                COALESCE(_item->>'flash_led', 'ir'),
                (_item->>'flash_window_start_minutes_utc')::int,
                (_item->>'flash_window_minutes')::int,
                (_item->>'created_at')::timestamptz,
                (_item->>'updated_at')::timestamptz
            )
            ON CONFLICT (id) DO NOTHING;
            GET DIAGNOSTICS _affected = ROW_COUNT;
            IF _affected = 0 THEN
                _conflicts := _conflicts || pg_catalog.jsonb_build_object(
                    'id', COALESCE(_item->>'id', _item#>>'{}'),
                    'reason', 'not_applied');
            ELSE
                _processed_count := _processed_count + 1;
            END IF;
        END LOOP;
    END IF;

    -- PROJECTS: Updated
    IF _projects_updated IS NOT NULL THEN
        FOR _item IN SELECT * FROM pg_catalog.jsonb_array_elements(_projects_updated)
        LOOP
            -- `CASE WHEN _item ? 'col'` throughout, NOT a bare assignment or a
            -- COALESCE to a default (#172). A bare assignment nulls any column the
            -- payload omits; a COALESCE to a default resets it, which would let an
            -- older app build wipe a website-set flash value on an unrelated edit.
            -- The `?` operator distinguishes "key absent" (keep the stored value)
            -- from "key present but null" (clear the field), which COALESCE cannot.
            UPDATE public.projects
            SET
                name = CASE WHEN _item ? 'name' THEN _item->>'name' ELSE name END,
                description = CASE WHEN _item ? 'description' THEN _item->>'description' ELSE description END,
                organisation_id = CASE WHEN _item ? 'organisation_id' THEN (_item->>'organisation_id')::uuid ELSE organisation_id END,
                modified_by = CASE WHEN _item ? 'modified_by' THEN (_item->>'modified_by')::uuid ELSE modified_by END,
                is_active = CASE WHEN _item ? 'is_active' THEN COALESCE((_item->>'is_active')::boolean, true) ELSE is_active END,
                sampling_design_id = CASE WHEN _item ? 'sampling_design_id' THEN (_item->>'sampling_design_id')::int ELSE sampling_design_id END,
                website = CASE WHEN _item ? 'website' THEN _item->>'website' ELSE website END,
                model_id = CASE WHEN _item ? 'model_id' THEN (_item->>'model_id')::uuid ELSE model_id END,
                capture_method_id = CASE WHEN _item ? 'capture_method_id' THEN (_item->>'capture_method_id')::int ELSE capture_method_id END,
                activity_detection_sensitivity_id = CASE WHEN _item ? 'activity_detection_sensitivity_id' THEN (_item->>'activity_detection_sensitivity_id')::int ELSE activity_detection_sensitivity_id END,
                timelapse_interval_seconds = CASE WHEN _item ? 'timelapse_interval_seconds' THEN (_item->>'timelapse_interval_seconds')::int ELSE timelapse_interval_seconds END,
                is_baited = CASE WHEN _item ? 'is_baited' THEN (_item->>'is_baited')::boolean ELSE is_baited END,
                is_monitoring_marked_individuals = CASE WHEN _item ? 'is_monitoring_marked_individuals' THEN (_item->>'is_monitoring_marked_individuals')::boolean ELSE is_monitoring_marked_individuals END,
                project_image = CASE WHEN _item ? 'project_image' THEN _item->>'project_image' ELSE project_image END,
                -- Added in this change (#170): previously absent from both lists, so
                -- app edits to them were dropped without an error.
                lorawan_required = CASE WHEN _item ? 'lorawan_required' THEN COALESCE((_item->>'lorawan_required')::boolean, false) ELSE lorawan_required END,
                record_gps_in_images = CASE WHEN _item ? 'record_gps_in_images' THEN COALESCE((_item->>'record_gps_in_images')::boolean, false) ELSE record_gps_in_images END,
                is_archived = CASE WHEN _item ? 'is_archived' THEN COALESCE((_item->>'is_archived')::boolean, false) ELSE is_archived END,
                -- All four flash columns COALESCE to the STORED value, so a null from a
                -- sync client can never clear them — unlike the nullable columns above,
                -- where an explicit null legitimately clears the field.
                --
                -- Why they are the exception: the flash settings are website-owned for
                -- now (ww-website #137), and the app's local schema already carries the
                -- columns. An app whose local copy predates a website change sends
                -- nulls, and clearing only the window would leave flash_mode
                -- 'time_of_day' with no window — a state the device cannot act on
                -- (op34=3 with no op35/op36). Verified: without this, a stale payload
                -- took 300+120 to null+null while leaving the mode set.
                --
                -- The website writes these through PostgREST, not push_changes, so it
                -- can still clear them. Revisit when the app owns these fields
                -- (ww-mobile-app #282).
                flash_mode = CASE WHEN _item ? 'flash_mode' THEN COALESCE(_item->>'flash_mode', flash_mode) ELSE flash_mode END,
                flash_led = CASE WHEN _item ? 'flash_led' THEN COALESCE(_item->>'flash_led', flash_led) ELSE flash_led END,
                flash_window_start_minutes_utc = CASE WHEN _item ? 'flash_window_start_minutes_utc' THEN COALESCE((_item->>'flash_window_start_minutes_utc')::int, flash_window_start_minutes_utc) ELSE flash_window_start_minutes_utc END,
                flash_window_minutes = CASE WHEN _item ? 'flash_window_minutes' THEN COALESCE((_item->>'flash_window_minutes')::int, flash_window_minutes) ELSE flash_window_minutes END,
                updated_at = CASE WHEN _item ? 'updated_at' THEN (_item->>'updated_at')::timestamptz ELSE updated_at END
            WHERE id = (_item->>'id')::uuid;
            GET DIAGNOSTICS _affected = ROW_COUNT;
            IF _affected = 0 THEN
                _conflicts := _conflicts || pg_catalog.jsonb_build_object(
                    'id', COALESCE(_item->>'id', _item#>>'{}'),
                    'reason', 'not_applied');
            ELSE
                _processed_count := _processed_count + 1;
            END IF;
        END LOOP;
    END IF;

    -- PROJECTS: Deleted (String IDs)
    IF _projects_deleted IS NOT NULL THEN
        FOR _item IN SELECT * FROM pg_catalog.jsonb_array_elements(_projects_deleted)
        LOOP
            UPDATE public.projects
            SET deleted_at = pg_catalog.now()
            WHERE id = (_item#>>'{}'::text[])::uuid;
            GET DIAGNOSTICS _affected = ROW_COUNT;
            IF _affected = 0 THEN
                _conflicts := _conflicts || pg_catalog.jsonb_build_object(
                    'id', COALESCE(_item->>'id', _item#>>'{}'),
                    'reason', 'not_applied');
            ELSE
                _processed_count := _processed_count + 1;
            END IF;
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
            GET DIAGNOSTICS _affected = ROW_COUNT;
            IF _affected = 0 THEN
                _conflicts := _conflicts || pg_catalog.jsonb_build_object(
                    'id', COALESCE(_item->>'id', _item#>>'{}'),
                    'reason', 'not_applied');
            ELSE
                _processed_count := _processed_count + 1;
            END IF;
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
            GET DIAGNOSTICS _affected = ROW_COUNT;
            IF _affected = 0 THEN
                _conflicts := _conflicts || pg_catalog.jsonb_build_object(
                    'id', COALESCE(_item->>'id', _item#>>'{}'),
                    'reason', 'not_applied');
            ELSE
                _processed_count := _processed_count + 1;
            END IF;
        END LOOP;
    END IF;

    -- DEVICES: Deleted (String IDs)
    IF _devices_deleted IS NOT NULL THEN
        FOR _item IN SELECT * FROM pg_catalog.jsonb_array_elements(_devices_deleted)
        LOOP
            UPDATE public.devices
            SET deleted_at = pg_catalog.now()
            WHERE id = (_item#>>'{}'::text[])::uuid;
            GET DIAGNOSTICS _affected = ROW_COUNT;
            IF _affected = 0 THEN
                _conflicts := _conflicts || pg_catalog.jsonb_build_object(
                    'id', COALESCE(_item->>'id', _item#>>'{}'),
                    'reason', 'not_applied');
            ELSE
                _processed_count := _processed_count + 1;
            END IF;
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
                camera_tilt,
                detection_distance,
                bait_use,
                feature_type,
                habitat,
                deployment_tags,
                timezone,
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
                COALESCE(NULLIF(_item->>'lorawan_registration_completed', '')::boolean, false),
                NULLIF(_item->>'lorawan_last_verified_at', '')::timestamptz,
                NULLIF(_item->>'ai_model_id', '')::uuid,
                NULLIF(_item->>'ble_firmware_id', '')::uuid,
                NULLIF(_item->>'himax_firmware_id', '')::uuid,
                NULLIF(_item->>'battery_level_at_start', '')::int,
                NULLIF(_item->>'sd_card_total_kb_at_start', '')::int,
                NULLIF(_item->>'sd_card_available_kb_at_start', '')::int,
                NULLIF(_item->>'lorawan_rssi_at_start', '')::int,
                public.safe_to_double(NULLIF(_item->>'lorawan_snr_at_start', '')),
                -- Added in this change (#170). All nullable, so an older app build's
                -- payload simply leaves them NULL.
                public.safe_to_double(NULLIF(_item->>'camera_tilt', '')),
                public.safe_to_double(NULLIF(_item->>'detection_distance', '')),
                _item->>'bait_use',
                _item->>'feature_type',
                _item->>'habitat',
                CASE WHEN pg_catalog.jsonb_typeof(_item->'deployment_tags') = 'array'
                     THEN ARRAY(SELECT pg_catalog.jsonb_array_elements_text(_item->'deployment_tags'))
                     ELSE NULL END,
                _item->>'timezone',
                (_item->>'created_at')::timestamptz,
                (_item->>'updated_at')::timestamptz
            )
            ON CONFLICT (id) DO NOTHING;
            GET DIAGNOSTICS _affected = ROW_COUNT;
            IF _affected = 0 THEN
                _conflicts := _conflicts || pg_catalog.jsonb_build_object(
                    'id', COALESCE(_item->>'id', _item#>>'{}'),
                    'reason', 'not_applied');
            ELSE
                _processed_count := _processed_count + 1;
            END IF;
        END LOOP;
    END IF;

    -- DEPLOYMENTS: Updated
    IF _deployments_updated IS NOT NULL THEN
        FOR _item IN SELECT * FROM pg_catalog.jsonb_array_elements(_deployments_updated)
        LOOP
            UPDATE public.deployments
            SET
                project_id = CASE WHEN _item ? 'project_id' THEN (_item->>'project_id')::uuid ELSE project_id END,
                name = CASE WHEN _item ? 'name' THEN _item->>'name' ELSE name END,
                deployment_start = CASE WHEN _item ? 'deployment_start' THEN (_item->>'deployment_start')::timestamptz ELSE deployment_start END,
                deployment_end = CASE WHEN _item ? 'deployment_end' THEN (_item->>'deployment_end')::timestamptz ELSE deployment_end END,
                ended_by = CASE WHEN _item ? 'ended_by' THEN (_item->>'ended_by')::uuid ELSE ended_by END,
                deployment_status_id = CASE WHEN _item ? 'deployment_status_id' THEN (_item->>'deployment_status_id')::int ELSE deployment_status_id END,
                capture_method_id = CASE WHEN _item ? 'capture_method_id' THEN (_item->>'capture_method_id')::int ELSE capture_method_id END,
                location_name = CASE WHEN _item ? 'location_name' THEN _item->>'location_name' ELSE location_name END,
                -- Two accepted keys (the second is the legacy name), so the guard must
                -- test both or a client sending only the legacy one would be ignored.
                location_description = CASE
                    WHEN _item ? 'location_description' OR _item ? 'camera_location_description'
                    THEN COALESCE(_item->>'location_description', _item->>'camera_location_description')
                    ELSE location_description END,
                latitude = CASE WHEN _item ? 'latitude' THEN public.safe_to_double(NULLIF(_item->>'latitude', '')) ELSE latitude END,
                longitude = CASE WHEN _item ? 'longitude' THEN public.safe_to_double(NULLIF(_item->>'longitude', '')) ELSE longitude END,
                camera_location_image_paths = CASE 
                    WHEN _item->>'camera_location_image_path' IS NOT NULL 
                    THEN pg_catalog.jsonb_build_array(_item->>'camera_location_image_path')
                    WHEN _item->>'camera_location_image_paths' IS NOT NULL
                    THEN (_item->'camera_location_image_paths')
                    ELSE camera_location_image_paths
                END,
                deployment_photos = CASE WHEN _item ? 'deployment_photos' THEN (_item->'deployment_photos') ELSE deployment_photos END,
                device_id = CASE WHEN _item ? 'device_id' THEN (_item->>'device_id')::uuid ELSE device_id END,
                start_deployment_comments = CASE WHEN _item ? 'start_deployment_comments' THEN _item->>'start_deployment_comments' ELSE start_deployment_comments END,
                end_deployment_comments = CASE WHEN _item ? 'end_deployment_comments' THEN _item->>'end_deployment_comments' ELSE end_deployment_comments END,
                camera_height = CASE WHEN _item ? 'camera_height' THEN public.safe_to_numeric(NULLIF(_item->>'camera_height', '')) ELSE camera_height END,
                activity_detection_sensitivity_id = CASE WHEN _item ? 'activity_detection_sensitivity_id' THEN (_item->>'activity_detection_sensitivity_id')::int ELSE activity_detection_sensitivity_id END,
                timelapse_interval_seconds = CASE WHEN _item ? 'timelapse_interval_seconds' THEN (_item->>'timelapse_interval_seconds')::int ELSE timelapse_interval_seconds END,
                -- Column and key names differ deliberately: the app sends 'location'.
                location_data = CASE WHEN _item ? 'location' THEN (_item->>'location')::jsonb ELSE location_data END,
                altitude = CASE WHEN _item ? 'altitude' THEN public.safe_to_double(NULLIF(_item->>'altitude', '')) ELSE altitude END,
                accuracy = CASE WHEN _item ? 'accuracy' THEN public.safe_to_double(NULLIF(_item->>'accuracy', '')) ELSE accuracy END,
                camera_model = CASE WHEN _item ? 'camera_model' THEN _item->>'camera_model' ELSE camera_model END,
                lorawan_network = CASE WHEN _item ? 'lorawan_network' THEN _item->>'lorawan_network' ELSE lorawan_network END,
                device_eui = CASE WHEN _item ? 'device_eui' THEN _item->>'device_eui' ELSE device_eui END,
                lorawan_registration_completed = CASE WHEN _item ? 'lorawan_registration_completed' THEN COALESCE(NULLIF(_item->>'lorawan_registration_completed', '')::boolean, lorawan_registration_completed) ELSE lorawan_registration_completed END,
                lorawan_last_verified_at = CASE WHEN _item ? 'lorawan_last_verified_at' THEN NULLIF(_item->>'lorawan_last_verified_at', '')::timestamptz ELSE lorawan_last_verified_at END,
                ai_model_id = CASE WHEN _item ? 'ai_model_id' THEN NULLIF(_item->>'ai_model_id', '')::uuid ELSE ai_model_id END,
                ble_firmware_id = CASE WHEN _item ? 'ble_firmware_id' THEN NULLIF(_item->>'ble_firmware_id', '')::uuid ELSE ble_firmware_id END,
                himax_firmware_id = CASE WHEN _item ? 'himax_firmware_id' THEN NULLIF(_item->>'himax_firmware_id', '')::uuid ELSE himax_firmware_id END,
                battery_level_at_start = CASE WHEN _item ? 'battery_level_at_start' THEN NULLIF(_item->>'battery_level_at_start', '')::int ELSE battery_level_at_start END,
                sd_card_total_kb_at_start = CASE WHEN _item ? 'sd_card_total_kb_at_start' THEN NULLIF(_item->>'sd_card_total_kb_at_start', '')::int ELSE sd_card_total_kb_at_start END,
                sd_card_available_kb_at_start = CASE WHEN _item ? 'sd_card_available_kb_at_start' THEN NULLIF(_item->>'sd_card_available_kb_at_start', '')::int ELSE sd_card_available_kb_at_start END,
                lorawan_rssi_at_start = CASE WHEN _item ? 'lorawan_rssi_at_start' THEN NULLIF(_item->>'lorawan_rssi_at_start', '')::int ELSE lorawan_rssi_at_start END,
                lorawan_snr_at_start = CASE WHEN _item ? 'lorawan_snr_at_start' THEN public.safe_to_double(NULLIF(_item->>'lorawan_snr_at_start', '')) ELSE lorawan_snr_at_start END,
                -- Added in this change (#170): previously absent from both lists, so
                -- app edits to these CamtrapDP fields were dropped without an error.
                -- camera_tilt/detection_distance are double precision, so safe_to_double
                -- (as latitude/longitude/altitude above), not safe_to_numeric.
                camera_tilt = CASE WHEN _item ? 'camera_tilt' THEN public.safe_to_double(NULLIF(_item->>'camera_tilt', '')) ELSE camera_tilt END,
                detection_distance = CASE WHEN _item ? 'detection_distance' THEN public.safe_to_double(NULLIF(_item->>'detection_distance', '')) ELSE detection_distance END,
                bait_use = CASE WHEN _item ? 'bait_use' THEN _item->>'bait_use' ELSE bait_use END,
                feature_type = CASE WHEN _item ? 'feature_type' THEN _item->>'feature_type' ELSE feature_type END,
                habitat = CASE WHEN _item ? 'habitat' THEN _item->>'habitat' ELSE habitat END,
                -- deployment_tags is text[], NOT jsonb: a bare (_item->'deployment_tags')
                -- fails to cast. jsonb_typeof returns NULL for an absent key, so the ELSE
                -- keeps the stored value, while an explicit JSON null clears it.
                deployment_tags = CASE
                    WHEN pg_catalog.jsonb_typeof(_item->'deployment_tags') = 'array'
                        THEN ARRAY(SELECT pg_catalog.jsonb_array_elements_text(_item->'deployment_tags'))
                    WHEN pg_catalog.jsonb_typeof(_item->'deployment_tags') = 'null'
                        THEN NULL
                    ELSE deployment_tags END,
                timezone = CASE WHEN _item ? 'timezone' THEN _item->>'timezone' ELSE timezone END,
                updated_at = CASE WHEN _item ? 'updated_at' THEN (_item->>'updated_at')::timestamptz ELSE updated_at END
            WHERE id = (_item->>'id')::uuid;
            GET DIAGNOSTICS _affected = ROW_COUNT;
            IF _affected = 0 THEN
                _conflicts := _conflicts || pg_catalog.jsonb_build_object(
                    'id', COALESCE(_item->>'id', _item#>>'{}'),
                    'reason', 'not_applied');
            ELSE
                _processed_count := _processed_count + 1;
            END IF;
        END LOOP;
    END IF;

    -- DEPLOYMENTS: Deleted (String IDs)
    IF _deployments_deleted IS NOT NULL THEN
        FOR _item IN SELECT * FROM pg_catalog.jsonb_array_elements(_deployments_deleted)
        LOOP
            UPDATE public.deployments
            SET deleted_at = pg_catalog.now()
            WHERE id = (_item#>>'{}'::text[])::uuid;
            GET DIAGNOSTICS _affected = ROW_COUNT;
            IF _affected = 0 THEN
                _conflicts := _conflicts || pg_catalog.jsonb_build_object(
                    'id', COALESCE(_item->>'id', _item#>>'{}'),
                    'reason', 'not_applied');
            ELSE
                _processed_count := _processed_count + 1;
            END IF;
        END LOOP;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'processed', _processed_count,
        'conflicts', _conflicts
    );
END;
$function$;
