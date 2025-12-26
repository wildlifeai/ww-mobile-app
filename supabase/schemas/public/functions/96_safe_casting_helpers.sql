-- Safe type casting helper functions
-- Purpose: Prevent sync failures from invalid data by returning NULL instead of throwing exceptions
-- These functions are used in push_changes to safely convert text to numeric types

-- For double precision fields (latitude, longitude, altitude, accuracy)
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

COMMENT ON FUNCTION public.safe_to_double(text) IS 'Safely converts text to double precision. Returns NULL if conversion fails instead of throwing an error.';

-- For numeric fields (camera_height)
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

COMMENT ON FUNCTION public.safe_to_numeric(text) IS 'Safely converts text to numeric. Returns NULL if conversion fails instead of throwing an error.';
