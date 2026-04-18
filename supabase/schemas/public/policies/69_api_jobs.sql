-- *** api_jobs RLS Policies ***
-- SECURITY MODEL: WW Admin only access
-- - Only WW Admin can view API jobs for debugging purposes
-- - API Service uses service_role key to bypass RLS entirely for upserts
-- - Regular users cannot see any backend pipeline jobs

CREATE POLICY "ww_admin_view_api_jobs"
  ON api_jobs
  FOR SELECT
  TO authenticated
  USING (
    has_system_role(auth.uid(), 'ww_admin')
  );
