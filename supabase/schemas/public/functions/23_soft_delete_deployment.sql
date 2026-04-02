--soft delete helper - deployments
create or replace function public.soft_delete_deployment(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
DECLARE
  v_project_id uuid;
BEGIN
  -- Get project_id for the deployment to check permissions
  SELECT d.project_id INTO v_project_id
  FROM public.deployments d
  WHERE d.id = p_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Deployment not found: %', p_id;
  END IF;

  -- Check if user is a project admin for the associated project
  IF NOT public.has_project_role(auth.uid(), v_project_id, 'project_admin') THEN
    RAISE EXCEPTION 'Permission denied: You must be a project admin to delete a deployment.';
  END IF;

  UPDATE public.deployments
  SET deleted_at = now()
  WHERE id = p_id;
END;
$$;