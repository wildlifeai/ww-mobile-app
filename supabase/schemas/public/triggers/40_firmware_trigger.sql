-- Trigger to call the function on BEFORE INSERT or UPDATE
CREATE TRIGGER on_firmware_active_check
BEFORE INSERT OR UPDATE ON firmware
FOR EACH ROW
EXECUTE FUNCTION handle_single_active_firmware();
