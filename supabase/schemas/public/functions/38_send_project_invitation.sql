CREATE OR REPLACE FUNCTION public.send_project_invitation(p_project_id uuid, p_invitee_email text, p_role text DEFAULT 'project_member'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_invitation_id UUID;
  v_inviter_id UUID;
BEGIN
  -- Get current user ID
  v_inviter_id := auth.uid();
  
  -- Verify user is project admin
  IF NOT has_project_role(v_inviter_id, p_project_id, 'project_admin') THEN
    RAISE EXCEPTION 'Only project admins can send invitations';
  END IF;
  
  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    WHERE ur.scope_type = 'project'
      AND ur.scope_id = p_project_id
      AND u.email = p_invitee_email
      AND ur.is_active = true
      AND ur.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'User is already a project member';
  END IF;
  
  -- Create invitation (notification handled by app's realtime subscription)
  INSERT INTO project_invitations (
    project_id,
    inviter_id,
    invitee_email,
    role
  )
  VALUES (
    p_project_id,
    v_inviter_id,
    p_invitee_email,
    p_role
  )
  RETURNING id INTO v_invitation_id;
  
  RETURN v_invitation_id;
END;
$function$;
