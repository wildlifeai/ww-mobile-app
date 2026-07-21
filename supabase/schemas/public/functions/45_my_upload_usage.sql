-- my_upload_usage — the caller's own upload totals vs their quota, for the
-- in-app soft-warning banner. SECURITY DEFINER so the count covers all of the
-- user's uploads (media RLS is project-scoped); only ever reports the caller's
-- own data.

CREATE OR REPLACE FUNCTION public.my_upload_usage()
RETURNS TABLE (
  photos_uploaded bigint,
  storage_bytes bigint,
  compute_seconds bigint,
  max_photos int,
  max_storage_bytes bigint,
  max_compute_seconds bigint,
  over_quota boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    usage.photos,
    usage.bytes,
    compute.seconds,
    q.max_photos,
    q.max_storage_bytes,
    q.max_compute_seconds,
    (
      (q.max_photos IS NOT NULL AND usage.photos > q.max_photos)
      OR (q.max_storage_bytes IS NOT NULL AND usage.bytes > q.max_storage_bytes)
      OR (q.max_compute_seconds IS NOT NULL AND compute.seconds > q.max_compute_seconds)
    )
  FROM (
    SELECT
      pg_catalog.count(m.id) AS photos,
      COALESCE(pg_catalog.sum(ma.file_size_bytes), 0)::bigint AS bytes
    FROM public.media m
    LEFT JOIN public.media_assets ma ON ma.media_id = m.id
    WHERE m.uploaded_by = me AND m.deleted_at IS NULL
  ) usage
  CROSS JOIN (
    SELECT COALESCE(pg_catalog.sum(EXTRACT(EPOCH FROM (ar.completed_at - ar.started_at))), 0)::bigint AS seconds
    FROM public.annotation_runs ar
    WHERE ar.created_by = me AND ar.run_type = 'ai_inference' AND ar.completed_at IS NOT NULL
  ) compute
  LEFT JOIN public.upload_quotas q ON q.user_id = me;
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_upload_usage() TO authenticated;
