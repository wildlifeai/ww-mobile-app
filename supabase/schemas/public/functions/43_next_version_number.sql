-- next_version_number: Atomically assigns the next version number for a model within a family.
-- SECURITY DEFINER: Bypasses RLS to read ai_models for MAX() calculation.
CREATE OR REPLACE FUNCTION public.next_version_number(p_family_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_next INTEGER;
    v_org_id UUID;
BEGIN
    -- Verify the family exists and get its org (FOR UPDATE prevents concurrent race)
    SELECT organisation_id INTO v_org_id
      FROM public.ai_model_families
     WHERE id = p_family_id
       FOR UPDATE;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'ai_model_family % not found', p_family_id;
    END IF;

    -- Atomically compute next version
    SELECT COALESCE(MAX(version_number), 0) + 1
      INTO v_next
      FROM public.ai_models
     WHERE model_family_id = p_family_id;

    RETURN v_next;
END;
$$;

COMMENT ON FUNCTION public.next_version_number IS
    'Returns the next sequential version_number for ai_models within a given family. '
    'Must be called by service_role or a SECURITY DEFINER wrapper — not directly by the client.';

REVOKE EXECUTE ON FUNCTION public.next_version_number(UUID) FROM public;
REVOKE EXECUTE ON FUNCTION public.next_version_number(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.next_version_number(UUID) TO service_role;
