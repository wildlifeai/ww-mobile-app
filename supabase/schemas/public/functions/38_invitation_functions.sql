-- RPC: Send invitation (no email sent - handled by app notification system)
CREATE OR REPLACE FUNCTION send_project_invitation(
  p_project_id UUID,
  p_invitee_email TEXT,
  p_role TEXT DEFAULT 'project_member'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- RPC: Respond to invitation
CREATE OR REPLACE FUNCTION respond_to_invitation(
  p_invitation_id UUID,
  p_accept BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
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
  FROM project_invitations
  WHERE id = p_invitation_id
    AND invitee_email = v_user_email
    AND status = 'pending'
    AND expires_at > NOW();
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or expired';
  END IF;
  
  IF p_accept THEN
    -- Accept invitation
    UPDATE project_invitations
    SET status = 'accepted',
        invitee_id = v_user_id,
        responded_at = NOW()
    WHERE id = p_invitation_id;
    
    -- Add user to project with specified role
    INSERT INTO user_roles (user_id, role, scope_type, scope_id, granted_by)
    VALUES (
      v_user_id, 
      v_invitation.role, 
      'project', 
      v_invitation.project_id,
      v_invitation.inviter_id
    )
    ON CONFLICT (user_id, role, scope_type, scope_id) DO NOTHING; -- Conflict on partial index
  ELSE
    -- Decline invitation
    UPDATE project_invitations
    SET status = 'declined',
        invitee_id = v_user_id,
        responded_at = NOW()
    WHERE id = p_invitation_id;
  END IF;
END;
$$;

-- RPC: Get pending invitations for current user
CREATE OR REPLACE FUNCTION get_my_pending_invitations()
RETURNS TABLE (
  id UUID,
  project_id UUID,
  project_name TEXT,
  inviter_id UUID,
  inviter_email TEXT,
  inviter_name TEXT, -- Added for UI
  role TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  
  RETURN QUERY
  SELECT
    pi.id,
    pi.project_id,
    p.name AS project_name,
    pi.inviter_id,
    u.email AS inviter_email,
    COALESCE(up.firstname || ' ' || up.surname, 'Unknown') AS inviter_name, -- Join with users profile
    pi.role,
    pi.created_at,
    pi.expires_at
  FROM project_invitations pi
  JOIN projects p ON p.id = pi.project_id
  JOIN auth.users u ON u.id = pi.inviter_id
  LEFT JOIN users up ON up.id = pi.inviter_id -- Join for name
  WHERE pi.invitee_email = v_user_email
    AND pi.status = 'pending'
    AND pi.expires_at > NOW()
  ORDER BY pi.created_at DESC;
END;
$$;

-- Function to expire old invitations (for cron job)
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE project_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at <= NOW();
    
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
