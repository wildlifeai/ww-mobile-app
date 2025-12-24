--soft delete helper - deployments
create or replace function public.soft_delete_deployment(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.deployments
  set deleted_at = now()
  where id = p_id and user_id = auth.uid();
end;
$$;