# Backend Schema Coordination - Missing Mobile RPCs

The mobile app relies on specific RPC functions for WatermelonDB sync and invitation management. During testing, it was discovered that several functions were missing from the backend's cloud instance.

## Missing Functions Identified

1. **`pull_changes`** - Required for WatermelonDB bidirectional sync
2. **`get_project_pending_invitations`** - Required for invitation management UI

## Changes Made to Backend Repository

I have proactively updated the backend repository at `wildlife-watcher-backend/` with the following:

1.  **Updated `38_invitation_functions.sql`**: Added the `get_project_pending_invitations` RPC function.
2.  **Cleaned up redundant logic**: Removed `38_send_project_invitation.sql` as it was a duplicate.

> [!NOTE]
> The `pull_changes` function is mobile-specific and lives in the mobile repo's `supabase/schemas/public/functions/01_watermelon_sync.sql`. It should be added to the backend if you want a unified source of truth.

## Action Required by Backend Team

Run the following SQL in your Supabase SQL Editor to fix the current cloud instance:

### 1. Add WatermelonDB Sync Functions

```sql
-- Helper Function: Epoch to Timestamp
CREATE OR REPLACE FUNCTION public.to_timestamp_ms(epoch_ms bigint)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_timestamp(epoch_ms / 1000.0);
$$;

-- Pull Changes RPC (needed for WatermelonDB sync)
CREATE OR REPLACE FUNCTION public.pull_changes(last_pulled_at bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ts timestamptz;
  _changes jsonb;
  
  -- Projects
  _projects_created jsonb;
  _projects_updated jsonb;
  _projects_deleted jsonb;
  
  -- Deployments
  _deployments_created jsonb;
  _deployments_updated jsonb;
  _deployments_deleted jsonb;

BEGIN
  _ts := to_timestamp_ms(last_pulled_at);

  -- PROJECTS
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO _projects_created
  FROM projects t
  WHERE created_at > _ts AND deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO _projects_updated
  FROM projects t
  WHERE updated_at > _ts AND created_at <= _ts AND deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(id), '[]'::jsonb) INTO _projects_deleted
  FROM projects
  WHERE deleted_at > _ts;

  -- DEPLOYMENTS
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO _deployments_created
  FROM deployments t
  WHERE created_at > _ts AND deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO _deployments_updated
  FROM deployments t
  WHERE updated_at > _ts AND created_at <= _ts AND deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(id), '[]'::jsonb) INTO _deployments_deleted
  FROM deployments
  WHERE deleted_at > _ts;

  -- CONSTRUCT RESPONSE
  _changes := jsonb_build_object(
    'projects', jsonb_build_object(
      'created', _projects_created,
      'updated', _projects_updated,
      'deleted', _projects_deleted
    ),
    'deployments', jsonb_build_object(
      'created', _deployments_created,
      'updated', _deployments_updated,
      'deleted', _deployments_deleted
    )
  );

  RETURN jsonb_build_object(
    'changes', _changes,
    'timestamp', (extract(epoch from now()) * 1000)::bigint
  );
END;
$$;
```

### 2. Add Invitation Management Function

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

The mobile app's `npm run db:sync-schema` command will pull the corrected invitation logic automatically. Consider adding the sync functions to the backend's declarative schema for a unified source of truth.
