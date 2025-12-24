--soft delete helper - projects
create or replace function public.soft_delete_project(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Check if user is a project admin (correct signature)
  if not public.has_project_role(auth.uid(), p_id, 'project_admin') then
    raise exception 'Permission denied: must be project admin to delete project.';
  end if;

  update public.projects
  set deleted_at = now()
  where id = p_id;
end;
$$;
