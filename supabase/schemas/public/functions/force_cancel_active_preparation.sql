-- Function: force_cancel_active_preparation
-- Created: 2025-12-18
-- Description: Unconditionally cancels any in_progress device preparations for a device.
--            Runs with SECURITY DEFINER to bypass RLS.

CREATE OR REPLACE FUNCTION force_cancel_active_preparation(p_device_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Soft-cancel any in_progress preparations for this device
  UPDATE device_preparation
  SET 
    status = 'cancelled',
    updated_at = NOW()
  WHERE device_id = p_device_id
    AND status = 'in_progress'
    AND deleted_at IS NULL;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION force_cancel_active_preparation(uuid) TO authenticated;

-- Comments
COMMENT ON FUNCTION force_cancel_active_preparation(uuid) IS 
  'Forcefully cancels any in_progress preparations for a device. Bypasses RLS to ensure clean state before new preparation.';
