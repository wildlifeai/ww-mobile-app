--soft delete helper - projects
create or replace function public.soft_delete_project(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not has_project_role(p_id, 'admin') then
    raise exception 'Permission denied: must be project admin to delete project.';
  end if;

  update public.projects
  set deleted_at = now()
  where id = p_id;
end;
$$;
