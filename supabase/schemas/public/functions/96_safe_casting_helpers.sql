-- Helper Functions for Safe Casting
-- Extracted from migration: 20251227020000_fix_sync_functions.sql

CREATE OR REPLACE FUNCTION public.safe_to_double(p_text text)
RETURNS double precision 
LANGUAGE plpgsql 
IMMUTABLE 
AS $$
BEGIN
  RETURN p_text::double precision;
EXCEPTION 
  WHEN others THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_to_numeric(p_text text)
RETURNS numeric 
LANGUAGE plpgsql 
IMMUTABLE 
AS $$
BEGIN
  RETURN p_text::numeric;
EXCEPTION 
  WHEN others THEN
    RETURN NULL;
END;
$$;
