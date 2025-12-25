-- Function to ensure only one firmware is active per type
CREATE OR REPLACE FUNCTION handle_single_active_firmware()
RETURNS TRIGGER AS $$
BEGIN
  -- If the new row is set to active
  IF NEW.is_active = true THEN
    -- Update all OTHER records of the same type to be inactive
    UPDATE firmware
    SET is_active = false
    WHERE type = NEW.type
    AND id != NEW.id
    AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
