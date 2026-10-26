-- project_species: the species already used in each project, and how many live observations
-- name each, so the website's species picker suggests them before the user types (#338).
-- security_invoker, so the caller's RLS on observations, deployments and media decides which
-- projects appear. Live is the website's rule (frontend/src/lib/liveObservations.ts): the
-- observation and its deployment not deleted, and its photo, if it has one, not deleted.
CREATE OR REPLACE VIEW public.project_species
WITH (security_invoker = true) AS
SELECT
  d.project_id,
  o.taxon_id,
  o.scientific_name,
  o.vernacular_name,
  count(*) AS uses
FROM public.observations AS o
INNER JOIN public.deployments AS d ON o.deployment_id = d.id
LEFT JOIN public.media AS m ON o.media_id = m.id
WHERE
  o.deleted_at IS null
  AND d.deleted_at IS null
  AND o.scientific_name IS NOT null
  AND (o.media_id IS null OR m.deleted_at IS null)
GROUP BY d.project_id, o.taxon_id, o.scientific_name, o.vernacular_name;

GRANT SELECT ON public.project_species TO authenticated;
