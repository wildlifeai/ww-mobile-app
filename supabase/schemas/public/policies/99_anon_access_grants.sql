-- =================================================================
-- PUBLIC ACCESS GRANTS (ANON ROLE)
-- Explicitly grant SELECT permission on tables intended for public access.
-- RLS policies exist ("USING (true)"), but table-level GRANT is required first.
-- =================================================================

-- 1. Grant Usage on Public Schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. Grant Select on Public Tables
-- Firmware (for OTA updates)
GRANT SELECT ON TABLE public.firmware TO anon, authenticated;

-- AI Models (for Model downloads and Manifest generation)
GRANT SELECT ON TABLE public.ai_models TO anon, authenticated;
GRANT SELECT ON TABLE public.ai_model_organisation TO anon, authenticated;

-- Lookup Tables (Context for models/projects)
GRANT SELECT ON TABLE public.activity_sensitivity TO anon, authenticated;
GRANT SELECT ON TABLE public.sampling_designs TO anon, authenticated;
