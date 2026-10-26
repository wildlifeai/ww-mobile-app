-- media.local_hour is a photo's capture hour in its deployment's time zone, so the website can
-- filter photos by day or night in the database (#335). A generated column cannot read
-- deployments.timezone, so two triggers keep it (triggers/30_triggers.sql): one on media, one
-- on deployments when the zone changes.

-- The hour of p_ts in time zone p_tz, or in UTC when p_tz is NULL or unknown, so a bad zone
-- never refuses a photo or a deployment edit. NULL when p_ts is NULL. A pure helper, safe for
-- any caller.
CREATE OR REPLACE FUNCTION public.local_hour_of(p_ts timestamptz, p_tz text)
RETURNS smallint
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF p_ts IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN EXTRACT(HOUR FROM p_ts AT TIME ZONE COALESCE(p_tz, 'UTC'))::smallint;
  EXCEPTION WHEN invalid_parameter_value THEN
    RETURN EXTRACT(HOUR FROM p_ts AT TIME ZONE 'UTC')::smallint;
  END;
END;
$$;

-- BEFORE INSERT, and UPDATE OF timestamp, deployment_id or local_hour, on media. SECURITY
-- DEFINER to read the deployment's time zone whatever the writer may read; a trigger function
-- cannot be called directly, so it shows a client nothing.
CREATE OR REPLACE FUNCTION public.set_media_local_hour()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.local_hour := public.local_hour_of(
    NEW."timestamp",
    (SELECT d.timezone FROM public.deployments AS d WHERE d.id = NEW.deployment_id)
  );
  RETURN NEW;
END;
$$;

-- AFTER UPDATE OF timezone on deployments: recompute the deployment's photos. SECURITY DEFINER
-- because whoever may change a deployment's zone (its creator, a project admin, the website's
-- backend) need not be allowed to update its photos. Setting local_hour fires
-- set_media_local_hour, which reads the new zone, so the rule lives in one place.
CREATE OR REPLACE FUNCTION public.refresh_media_local_hour()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.media SET local_hour = NULL
  WHERE deployment_id = NEW.id AND "timestamp" IS NOT NULL;
  RETURN NULL;
END;
$$;
