-- Whether the camera with this Bluetooth id is deployed, and in which project (#328). The app
-- asks before Start Monitoring; RLS hides deployments in projects the user has no role in, so
-- without this a second deployment fails only at its push (23P01). Decided 22 Oct 2026: the
-- person holding the camera learns that it is deployed and the project's name, nothing more:
-- no start date, no person, no deployment id. A camera with no open deployment, or no camera
-- with that id, gives (false, NULL). Signed-in callers only, not the demo account (42501).
CREATE OR REPLACE FUNCTION public.camera_open_deployment(p_bluetooth_id text)
RETURNS TABLE (deployed boolean, project_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
  v_project_name text;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.caller_is_demo() THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT p.name INTO v_project_name
  FROM public.devices AS v
  INNER JOIN public.deployments AS d ON d.device_id = v.id
  INNER JOIN public.projects AS p ON p.id = d.project_id
  WHERE v.bluetooth_id = p_bluetooth_id
    AND v.deleted_at IS NULL
    AND d.deployment_end IS NULL
    AND d.deleted_at IS NULL
  LIMIT 1;

  RETURN QUERY SELECT v_project_name IS NOT NULL, v_project_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.camera_open_deployment(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.camera_open_deployment(text) TO authenticated;
