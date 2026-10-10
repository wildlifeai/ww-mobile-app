-- The cloud models every environment needs (#234): the website's annotation pipeline
-- runs models with no uploaded artifact, but annotation_runs.chk_annotation_run_provenance
-- requires every ai_inference run to cite an ai_models row. These are those rows, with
-- stable ids that MUST match CLOUD_MODEL_IDS in ww-website backend/app/domain/pipeline.py.
-- model_path and labels_path are UNIQUE, so each has a distinct cloud:// placeholder.
--
-- Rows are owned by the General organisation, so they can only be inserted where it
-- exists. The migration that added this calls it, which fills staging; on dev and
-- locally the migrations run before the seed creates General, so dev/data.sql calls
-- it again right after. Idempotent: returns how many rows it inserted.
CREATE OR REPLACE FUNCTION public.ensure_cloud_models()
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_general uuid;
  v_inserted integer;
BEGIN
  SELECT o.id INTO v_general
  FROM public.organisations AS o
  WHERE o.slug = 'general' AND o.deleted_at IS NULL
  LIMIT 1;

  IF v_general IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.ai_models (
    id, organisation_id, name, version, version_number,
    model_path, labels_path, status, description
  ) VALUES
    ('a0000000-0000-4000-8000-000000000001', v_general,
     'SpeciesNet', '4.0.1a', 1, 'cloud://speciesnet/4.0.1a', 'cloud://speciesnet/4.0.1a/labels',
     'deployed', 'Google SpeciesNet ensemble (detector + classifier). Cloud/library model, no uploaded artifact.'),
    ('a0000000-0000-4000-8000-000000000002', v_general,
     'BioCLIP', '2', 1, 'cloud://bioclip/2', 'cloud://bioclip/2/labels',
     'deployed', 'Imageomics BioCLIP zero-shot classifier (pybioclip). Cloud/library model.'),
    ('a0000000-0000-4000-8000-000000000003', v_general,
     'DINOv3', 'vits', 1, 'cloud://dinov3/vits', 'cloud://dinov3/vits/labels',
     'deployed', 'DINOv3 ViT-S embeddings (Wildlife Brain). Cloud/library model.'),
    -- #209: the website's GeminiPresenceStep. version is the model id the step
    -- records in observations.source_model_version.
    ('a0000000-0000-4000-8000-000000000004', v_general,
     'Gemini', 'gemini-3.1-flash-lite', 1, 'cloud://gemini/gemini-3.1-flash-lite',
     'cloud://gemini/gemini-3.1-flash-lite/labels',
     'deployed', 'Google Gemini presence verdict (VLM, animal present or not). Cloud API model, no uploaded artifact.')
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- Called by migrations and seeds as postgres, never by a client.
REVOKE ALL ON FUNCTION public.ensure_cloud_models() FROM public, anon, authenticated;
