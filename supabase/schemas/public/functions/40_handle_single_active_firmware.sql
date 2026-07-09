-- Function to ensure only one firmware is active per type AND camera variant.
--
-- The WW500 holds TWO Himax firmware images at once (camera variants RP3 and
-- HM0360 in A/B flash slots), so "single active" must be scoped per variant:
-- one active RP3, one active HM0360. A type-only scope caused the CI upload of
-- the second variant to deactivate the first, leaving setup folders with only
-- one camera image. camera_variant IS NULL (BLE firmware, legacy Himax rows)
-- forms its own group via IS NOT DISTINCT FROM, preserving the old behaviour
-- for those records.
CREATE OR REPLACE FUNCTION handle_single_active_firmware()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
  -- If the new row is set to active
  IF NEW.is_active = true THEN
    -- Deactivate all OTHER records of the same type and camera variant
    UPDATE public.firmware
    SET is_active = false
    WHERE type = NEW.type
    AND camera_variant IS NOT DISTINCT FROM NEW.camera_variant
    AND id != NEW.id
    AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
