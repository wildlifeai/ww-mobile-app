-- soft delete helper - devices
-- UPDATED: 2025-11-27 - Adapted for MVP2 schema (devices linked via device_preparation)
create or replace function public.soft_delete_device(p_device_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_organisation_id uuid;
begin
  -- Get the organisation_id from the device
  select organisation_id
  into v_organisation_id
  from public.devices
  where id = p_device_id
  and deleted_at is null;

  -- Check if user has permission (organisation manager or ww_admin)
  if v_organisation_id is not null and not (
    has_system_role(auth.uid(), 'ww_admin') OR
    has_organisation_role(auth.uid(), v_organisation_id, 'organisation_manager')
  ) then
    raise exception 'Permission denied: must be organisation manager or admin to delete device.';
  end if;

  -- Soft delete the device
  update public.devices
  set deleted_at = now()
  where id = p_device_id;
end;
$$;