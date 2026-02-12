-- RPC: Send invitation (no email sent - handled by app notification system)
CREATE OR REPLACE FUNCTION public.send_project_invitation(
  p_project_id UUID,
  p_invitee_email TEXT,
  p_role TEXT DEFAULT 'project_member'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation_id UUID;
  v_inviter_id UUID;
BEGIN
  -- Get current user ID
  v_inviter_id := auth.uid();
  
  -- Verify user is project admin
  IF NOT public.has_project_role(v_inviter_id, p_project_id, 'project_admin') THEN
    RAISE EXCEPTION 'Only project admins can send invitations';
  END IF;
  
  
  -- Create invitation
  INSERT INTO public.project_invitations (
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
$$;

-- RPC: Respond to invitation
CREATE OR REPLACE FUNCTION public.respond_to_invitation(
  p_invitation_id UUID,
  p_accept BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation RECORD;
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  
  -- Get invitation details
  SELECT * INTO v_invitation
  FROM public.project_invitations
  WHERE id = p_invitation_id
    AND invitee_email = v_user_email
    AND status = 'pending'
    AND expires_at > NOW();
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or expired';
  END IF;
  
  IF p_accept THEN
    -- Accept invitation
    UPDATE public.project_invitations
    SET status = 'accepted',
        invitee_id = v_user_id,
        responded_at = NOW()
    WHERE id = p_invitation_id;
    
    -- Try to reactivate a soft-deleted role first
    -- This handles the case where a user was previously a member but was removed
    UPDATE public.user_roles
    SET is_active = true,
        deleted_at = NULL,
        granted_by = v_invitation.inviter_id,
        modified_by = v_user_id,
        updated_at = NOW()
    WHERE user_id = v_user_id
      AND role = v_invitation.role
      AND scope_type = 'project'
      AND scope_id = v_invitation.project_id
      AND (deleted_at IS NOT NULL OR is_active = false);

    -- If no record was found to reactivate, insert a new one
    -- We use ON CONFLICT to handle the rare race condition where two requests process same invitation
    IF NOT FOUND THEN
      INSERT INTO public.user_roles (user_id, role, scope_type, scope_id, granted_by, modified_by)
      VALUES (
        v_user_id, 
        v_invitation.role, 
        'project', 
        v_invitation.project_id,
        v_invitation.inviter_id,
        v_user_id
      )
      ON CONFLICT (user_id, role, scope_type, (COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))) 
      WHERE deleted_at IS NULL AND is_active = true
      DO NOTHING;
    END IF;
  ELSE
    -- Decline invitation
    UPDATE public.project_invitations
    SET status = 'declined',
        invitee_id = v_user_id,
        responded_at = NOW()
    WHERE id = p_invitation_id;
  END IF;
END;
$$;

-- RPC: Get pending invitations for current user
CREATE OR REPLACE FUNCTION public.get_my_pending_invitations()
RETURNS TABLE (
  id UUID,
  project_id UUID,
  project_name TEXT,
  inviter_id UUID,
  inviter_email TEXT,
  inviter_name TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  -- FIX: Aliased auth.users to 'au' and used 'au.id' to resolve ambiguity
  SELECT email INTO v_user_email FROM auth.users au WHERE au.id = auth.uid();
  
  RETURN QUERY
  SELECT
    pi.id,
    pi.project_id,
    p.name AS project_name,
    pi.inviter_id,
    u.email::TEXT AS inviter_email,
    COALESCE(up.firstname || ' ' || up.surname, 'Unknown') AS inviter_name,
    pi.role,
    pi.created_at,
    pi.expires_at
  FROM public.project_invitations pi
  JOIN public.projects p ON p.id = pi.project_id
  JOIN auth.users u ON u.id = pi.inviter_id
  LEFT JOIN public.users up ON up.id = pi.inviter_id
  WHERE pi.invitee_email = v_user_email
    AND pi.status = 'pending'
    AND pi.expires_at > NOW()
  ORDER BY pi.created_at DESC;
END;
$$;

-- RPC: Get pending invitations for a specific project
CREATE OR REPLACE FUNCTION public.get_project_pending_invitations(p_project_id UUID)
RETURNS TABLE (
  id UUID,
  project_id UUID,
  inviter_id UUID,
  invitee_email TEXT,
  role TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Verify requester is project admin
  IF NOT public.has_project_role(auth.uid(), p_project_id, 'project_admin') THEN
    RAISE EXCEPTION 'Only project admins can view invitations';
  END IF;

  RETURN QUERY
  SELECT
    pi.id,
    pi.project_id,
    pi.inviter_id,
    pi.invitee_email,
    pi.role,
    pi.status,
    pi.created_at,
    pi.expires_at
  FROM public.project_invitations pi
  WHERE pi.project_id = p_project_id
    AND pi.status = 'pending'
    AND pi.expires_at > NOW()
  ORDER BY pi.created_at DESC;
END;
$$;

-- Function to expire old invitations (for cron job)
CREATE OR REPLACE FUNCTION public.expire_old_invitations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.project_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at <= NOW();
    
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
