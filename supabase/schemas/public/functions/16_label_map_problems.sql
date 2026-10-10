-- LM-10 (#292): what a class in ai_models.label_map may assert. One message per invalid
-- class, an empty array when the map is valid, NULL for a NULL map. The
-- ai_models_label_map_lm10 CHECK (tables/16_ai_models.sql) refuses any map with a
-- message, so a direct PostgREST write cannot skip the website's check (SQLSTATE 23514).
--
-- Ported from entry_problem in ww-website backend/app/domain/label_map.py, the reference
-- (rule decided on wildlifeai/ww-website#135). Change both together. The messages are the
-- website's, values quoted the way Python's repr quotes them; they come in jsonb's key
-- order, not the order the map was written in.
--
--   background                      valid, nothing else needed
--   target, predicts taxon          needs a non-blank taxon_id or scientific_name. A target
--                                   with no predicts predates ww-website#135 and means taxon.
--   target, predicts type           needs observation_type animal, human or vehicle. blank
--                                   and unknown are not detections: such a class is background.
--   anything else                   refused, behaviour included
CREATE OR REPLACE FUNCTION public.label_map_problems(p_label_map jsonb)
RETURNS text []
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
DECLARE
  -- Python's str.strip() whitespace, for the website's _text().
  ws CONSTANT text := E' \t\n\r\f\v';
  allowed CONSTANT text := 'animal, human, vehicle';
  v_label text;
  v_entry jsonb;
  v_role jsonb;
  v_raw jsonb;
  v_predicts text;
  v_type text;
  v_problems text [] := '{}';
BEGIN
  IF pg_catalog.jsonb_typeof(p_label_map) <> 'object' THEN
    RETURN ARRAY['LM-10: label_map must be an object keyed by class label'];
  END IF;

  FOR v_label, v_entry IN SELECT e.key, e.value FROM pg_catalog.jsonb_each(p_label_map) AS e LOOP
    IF pg_catalog.jsonb_typeof(v_entry) <> 'object' THEN
      v_problems := v_problems || pg_catalog.format('LM-10: class ''%s'' must be an object with a role', v_label);
      CONTINUE;
    END IF;

    v_role := v_entry -> 'role';
    CONTINUE WHEN v_role = '"background"'::jsonb;
    IF v_role IS DISTINCT FROM '"target"'::jsonb THEN
      v_problems := v_problems || pg_catalog.format(
        'LM-10: class ''%s'' has role %s; it must be ''target'' or ''background''',
        v_label,
        CASE
          WHEN v_role IS NULL OR v_role = 'null'::jsonb THEN 'None'
          WHEN pg_catalog.jsonb_typeof(v_role) = 'string' THEN '''' || (v_role #>> '{}') || ''''
          WHEN v_role = 'true'::jsonb THEN 'True'
          WHEN v_role = 'false'::jsonb THEN 'False'
          ELSE v_role::text
        END
      );
      CONTINUE;
    END IF;

    v_raw := v_entry -> 'predicts';
    v_predicts := CASE
      WHEN v_raw IS NULL OR v_raw = 'null'::jsonb THEN 'taxon'
      WHEN pg_catalog.jsonb_typeof(v_raw) = 'string' THEN pg_catalog.lower(pg_catalog.btrim(v_raw #>> '{}', ws))
    END;

    IF v_predicts IN ('behavior', 'behaviour') THEN
      v_problems := v_problems || pg_catalog.format(
        'LM-10: class ''%s'' predicts behaviour, which is not supported: a behaviour prediction '
        'is not an observation. A class can predict a taxon or a type; mark this class background.',
        v_label
      );
    ELSIF v_predicts = 'taxon' THEN
      IF COALESCE(pg_catalog.btrim(CASE WHEN pg_catalog.jsonb_typeof(v_entry -> 'taxon_id') = 'string' THEN v_entry ->> 'taxon_id' END, ws), '') = ''
        AND COALESCE(pg_catalog.btrim(CASE WHEN pg_catalog.jsonb_typeof(v_entry -> 'scientific_name') = 'string' THEN v_entry ->> 'scientific_name' END, ws), '') = ''
      THEN
        v_problems := v_problems || pg_catalog.format(
          'LM-10: class ''%s'' predicts a taxon but names none; map it to a species or mark it background', v_label
        );
      END IF;
    ELSIF v_predicts = 'type' THEN
      v_type := NULLIF(pg_catalog.btrim(
        CASE WHEN pg_catalog.jsonb_typeof(v_entry -> 'observation_type') = 'string' THEN v_entry ->> 'observation_type' END, ws
      ), '');
      IF v_type IN ('animal', 'human', 'vehicle') THEN
        NULL;
      ELSIF v_type IN ('blank', 'unknown') THEN
        v_problems := v_problems || pg_catalog.format(
          'LM-10: class ''%s'' predicts type ''%s'', which is not a detection; mark the class background', v_label, v_type
        );
      ELSIF v_type IS NULL THEN
        v_problems := v_problems || pg_catalog.format(
          'LM-10: class ''%s'' predicts a type but has no observation_type; use one of %s', v_label, allowed
        );
      ELSE
        v_problems := v_problems || pg_catalog.format(
          'LM-10: class ''%s'' predicts type ''%s''; use one of %s', v_label, v_type, allowed
        );
      END IF;
    ELSE
      v_problems := v_problems || pg_catalog.format(
        'LM-10: class ''%s'' predicts %s; a class can predict ''taxon'' or ''type''',
        v_label,
        CASE
          WHEN pg_catalog.jsonb_typeof(v_raw) = 'string' THEN '''' || (v_raw #>> '{}') || ''''
          WHEN v_raw = 'true'::jsonb THEN 'True'
          WHEN v_raw = 'false'::jsonb THEN 'False'
          ELSE v_raw::text
        END
      );
    END IF;
  END LOOP;

  RETURN v_problems;
END;
$$;

COMMENT ON FUNCTION public.label_map_problems(jsonb) IS 'LM-10 over an ai_models.label_map: one message per invalid class, empty when valid (#292). Ported from ww-website backend/app/domain/label_map.py; change both together.';
