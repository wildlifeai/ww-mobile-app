-- Only admins can view deletion requests
CREATE POLICY "System admins can manage deletion requests" ON account_deletion_requests
AS PERMISSIVE FOR ALL
TO authenticated
USING (
  public.has_system_role(auth.uid(), 'ww_admin')
);
