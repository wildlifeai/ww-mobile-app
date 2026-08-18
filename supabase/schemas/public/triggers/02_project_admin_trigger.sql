-- Auto-assign project_admin role to project creator
-- This trigger ensures that when a project is created, the creator is automatically
-- assigned the project_admin role in the user_roles table

CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Insert project_admin role for the project creator
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.user_roles (
      user_id,
      role,
      scope_type,
      scope_id,
      granted_by,
      modified_by,
      is_active
    ) VALUES (
      NEW.created_by,
      'project_admin',
      'project',
      NEW.id,
      NEW.created_by,  -- Self-granted
      NEW.created_by,
      true
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_project();

COMMENT ON FUNCTION public.handle_new_project IS 'Automatically assigns project_admin role to the project creator when a new project is created';
