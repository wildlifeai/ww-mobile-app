# Backend Schema Coordination - Invitation Fixes

The mobile app relies on specific RPC functions for managing project invitations. During testing, it was discovered that `get_project_pending_invitations` was missing from the backend's declarative schema, leading to failures in the mobile UI.

## Changes Made to Backend Repository

I have proactively updated the backend repository at `wildlife-watcher-backend/` with the following:

1.  **Updated `38_invitation_functions.sql`**: Added the `get_project_pending_invitations` RPC function.
2.  **Cleaned up redundant logic**: Removed `38_send_project_invitation.sql` as it was a duplicate of what's already in `38_invitation_functions.sql`.

## Action Required by Backend Team

When rebuilding the database or pushing changes to Supabase Cloud, ensure these updated declarative schema files are applied.

### Manual SQL Fix (for immediate resolution on current instances)

Run this SQL in the Supabase SQL Editor:

```sql
CREATE OR REPLACE FUNCTION get_project_pending_invitations(p_project_id UUID)
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
AS $$
BEGIN
  -- Verify requester is project admin
  IF NOT has_project_role(auth.uid(), p_project_id, 'project_admin') THEN
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
  FROM project_invitations pi
  WHERE pi.project_id = p_project_id
    AND pi.status = 'pending'
    AND pi.expires_at > NOW()
  ORDER BY pi.created_at DESC;
END;
$$;
```

## Future Proofing

The mobile app's `npm run db:sync-schema` command will now pull this corrected logic automatically in future syncs, keeping the repositories aligned.
