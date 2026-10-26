-- Soft delete, devices. Why a SECURITY DEFINER function: see
-- 23_soft_delete_deployment.sql (#160), which also gives the error contract.
CREATE OR REPLACE FUNCTION public.soft_delete_device(p_device_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted_at timestamptz;
BEGIN
  SELECT d.deleted_at INTO v_deleted_at
  FROM public.devices AS d
  WHERE d.id = p_device_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found' USING ERRCODE = 'P0002';
  END IF;

  -- ww_admin only: cameras belong to no organisation, so no manager owns one (#327).
  IF (SELECT auth.uid()) IS NULL OR NOT public.has_system_role((SELECT auth.uid()), 'ww_admin') THEN
    RAISE EXCEPTION 'Permission denied: only a ww_admin can delete a device'
      USING ERRCODE = '42501';
  END IF;

  IF v_deleted_at IS NULL THEN
    UPDATE public.devices SET deleted_at = pg_catalog.now() WHERE id = p_device_id;
  END IF;
END;
$$;
