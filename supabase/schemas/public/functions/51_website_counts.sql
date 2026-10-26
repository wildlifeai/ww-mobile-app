-- Counts the website used to compute in the browser from every observation row: the Insights
-- page's charts (#334) and the review grid's filter lists (#336).
--
-- Who counts what is the observations read rule, applied once per deployment: the deployment
-- not deleted, and project_viewer or above on its project, which counts the organisation's
-- managers and ww_admin (has_project_role), as the deployments, observations and media read
-- policies apply it. SECURITY DEFINER for speed, not to widen access: under RLS the policies
-- call has_project_role for every observation and photo, 2.3 s per call on one
-- 50,000-observation deployment, against 24 to 45 ms with the check done once per deployment
-- (measured locally, 2026-10-25). A caller with no auth.uid(), the service role included,
-- counts nothing.
--
-- Live is the website's rule (frontend/src/lib/liveObservations.ts): the observation not
-- deleted, and its photo, if it has one, not deleted.
--
-- plpgsql, not SQL: functions load before the tables, and a SQL body is checked at creation.
-- `#variable_conflict use_column` because the output columns share the tables' column names.

-- Observations per deployment, species and type, over the deployments of p_project_ids,
-- narrowed to p_deployment_ids when given (#334).
CREATE OR REPLACE FUNCTION public.insights_observation_counts(
  p_project_ids uuid [],
  p_deployment_ids uuid [] DEFAULT null
)
RETURNS TABLE (deployment_id uuid, scientific_name text, observation_type text, n bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH readable AS (
    SELECT d.id
    FROM public.deployments AS d
    WHERE d.project_id = ANY (p_project_ids)
      AND (p_deployment_ids IS NULL OR d.id = ANY (p_deployment_ids))
      AND d.deleted_at IS NULL
      AND public.has_project_role((SELECT auth.uid()), d.project_id, 'project_viewer')
  )
  SELECT o.deployment_id, o.scientific_name, o.observation_type, pg_catalog.count(*)
  FROM readable AS r
  INNER JOIN public.observations AS o ON o.deployment_id = r.id
  LEFT JOIN public.media AS m ON m.id = o.media_id
  WHERE o.deleted_at IS NULL
    AND (o.media_id IS NULL OR m.deleted_at IS NULL)
  GROUP BY o.deployment_id, o.scientific_name, o.observation_type;
END;
$$;

-- Named observations per deployment, day and species, the day being the photo's capture date
-- in the deployment's time zone, or p_fallback_tz (the browser's) when it has none (#334).
-- An observation with no photo, or whose photo has no timestamp, comes back with day NULL, so
-- the website can say how many it left out. An unknown p_fallback_tz raises 22023.
CREATE OR REPLACE FUNCTION public.deployment_daily_counts(
  p_deployment_ids uuid [],
  p_species text [] DEFAULT null,
  p_fallback_tz text DEFAULT 'UTC'
)
RETURNS TABLE (deployment_id uuid, day date, scientific_name text, n bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH readable AS (
    SELECT d.id, d.timezone
    FROM public.deployments AS d
    WHERE d.id = ANY (p_deployment_ids)
      AND d.deleted_at IS NULL
      AND public.has_project_role((SELECT auth.uid()), d.project_id, 'project_viewer')
  )
  SELECT
    o.deployment_id,
    (m.timestamp AT TIME ZONE COALESCE(r.timezone, p_fallback_tz))::date,
    o.scientific_name,
    pg_catalog.count(*)
  FROM readable AS r
  INNER JOIN public.observations AS o ON o.deployment_id = r.id
  LEFT JOIN public.media AS m ON m.id = o.media_id
  WHERE o.scientific_name IS NOT NULL
    AND (p_species IS NULL OR o.scientific_name = ANY (p_species))
    AND o.deleted_at IS NULL
    AND (o.media_id IS NULL OR m.deleted_at IS NULL)
  GROUP BY 1, 2, 3;
END;
$$;

-- The review grid's filter options for the selected deployments, with how many live
-- observations carry each value (#336): facet is scientific_name, source_model_version or
-- classified_by. classified_by counts human labels only: source_type 'human', or
-- classification_method 'human' where source_type is NULL. NULL values are not options.
CREATE OR REPLACE FUNCTION public.grid_facets(p_deployment_ids uuid [])
RETURNS TABLE (facet text, value text, n bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH readable AS (
    SELECT d.id
    FROM public.deployments AS d
    WHERE d.id = ANY (p_deployment_ids)
      AND d.deleted_at IS NULL
      AND public.has_project_role((SELECT auth.uid()), d.project_id, 'project_viewer')
  ),
  live AS (
    SELECT o.scientific_name, o.source_model_version, o.classified_by, o.source_type, o.classification_method
    FROM readable AS r
    INNER JOIN public.observations AS o ON o.deployment_id = r.id
    LEFT JOIN public.media AS m ON m.id = o.media_id
    WHERE o.deleted_at IS NULL
      AND (o.media_id IS NULL OR m.deleted_at IS NULL)
  )
  SELECT 'scientific_name'::text, l.scientific_name, pg_catalog.count(*)
  FROM live AS l WHERE l.scientific_name IS NOT NULL GROUP BY l.scientific_name
  UNION ALL
  SELECT 'source_model_version'::text, l.source_model_version, pg_catalog.count(*)
  FROM live AS l WHERE l.source_model_version IS NOT NULL GROUP BY l.source_model_version
  UNION ALL
  SELECT 'classified_by'::text, l.classified_by, pg_catalog.count(*)
  FROM live AS l
  WHERE l.classified_by IS NOT NULL
    AND (l.source_type = 'human' OR (l.source_type IS NULL AND l.classification_method = 'human'))
  GROUP BY l.classified_by;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.insights_observation_counts(uuid [], uuid []) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.deployment_daily_counts(uuid [], text [], text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.grid_facets(uuid []) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.insights_observation_counts(uuid [], uuid []) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deployment_daily_counts(uuid [], text [], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grid_facets(uuid []) TO authenticated;
