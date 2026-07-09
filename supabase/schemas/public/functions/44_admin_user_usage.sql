-- admin_user_usage — per-user upload + activity summary for system admins.
--
-- Aggregates media uploads (count + rendition storage), last upload, and last
-- API activity per user. SECURITY DEFINER so it can summarise across all users'
-- data (media RLS is project-scoped); gated internally so only ww_admins get
-- rows — everyone else receives an empty set.

CREATE OR REPLACE FUNCTION public.admin_user_usage()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  photos_uploaded bigint,
  storage_bytes bigint,
  compute_runs bigint,
  compute_seconds bigint,
  last_upload timestamptz,
  last_active timestamptz,
  max_photos int,
  max_storage_bytes bigint,
  max_compute_seconds bigint,
  over_quota boolean
)
LANGUAGE plpgsql
SECURITY DEFINER  -- bypasses RLS to aggregate every user's uploads
SET search_path = ''  -- prevent search-path injection (all refs schema-qualified)
STABLE
AS $$
BEGIN
  -- Admin-only: non-admins receive no rows.
  IF NOT public.has_system_role(auth.uid(), 'ww_admin') THEN
    RETURN;
  END IF;

  -- Each subquery is pre-aggregated to one row per user, so the outer query
  -- needs no GROUP BY — avoids grouping millions of media rows by user text.
  RETURN QUERY
  SELECT
    u.id,
    u.email,
    pg_catalog.concat(u.firstname, ' ', u.surname),
    COALESCE(um.photos, 0),
    COALESCE(um.bytes, 0),
    COALESCE(cr.runs, 0),
    COALESCE(cr.seconds, 0),
    um.last_upload,
    la.last_active,
    q.max_photos,
    q.max_storage_bytes,
    q.max_compute_seconds,
    (
      (q.max_photos IS NOT NULL AND COALESCE(um.photos, 0) > q.max_photos)
      OR (q.max_storage_bytes IS NOT NULL AND COALESCE(um.bytes, 0) > q.max_storage_bytes)
      OR (q.max_compute_seconds IS NOT NULL AND COALESCE(cr.seconds, 0) > q.max_compute_seconds)
    )
  FROM public.users u
  LEFT JOIN (
    SELECT m.uploaded_by AS uid,
           pg_catalog.count(m.id) AS photos,
           COALESCE(pg_catalog.sum(ma.file_size_bytes), 0)::bigint AS bytes,
           pg_catalog.max(m.created_at) AS last_upload
    FROM public.media m
    LEFT JOIN public.media_assets ma ON ma.media_id = m.id
    WHERE m.deleted_at IS NULL
    GROUP BY m.uploaded_by
  ) um ON um.uid = u.id
  LEFT JOIN (
    SELECT al.user_id AS uid, pg_catalog.max(al.created_at) AS last_active
    FROM public.api_logs al
    GROUP BY al.user_id
  ) la ON la.uid = u.id
  LEFT JOIN (
    SELECT ar.created_by AS uid,
           pg_catalog.count(*) AS runs,
           COALESCE(pg_catalog.sum(EXTRACT(EPOCH FROM (ar.completed_at - ar.started_at))), 0)::bigint AS seconds
    FROM public.annotation_runs ar
    WHERE ar.run_type = 'ai_inference' AND ar.completed_at IS NOT NULL
    GROUP BY ar.created_by
  ) cr ON cr.uid = u.id
  LEFT JOIN public.upload_quotas q ON q.user_id = u.id
  WHERE u.deleted_at IS NULL
  ORDER BY COALESCE(um.photos, 0) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_user_usage() TO authenticated;
