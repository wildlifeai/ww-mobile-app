-- *** species_event_config RLS Policies ***
-- Authenticated users can view configuration; only admins can manage it.

CREATE POLICY "Authenticated users can view species_event_config"
  ON species_event_config
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage species_event_config"
  ON species_event_config
  FOR ALL
  TO authenticated
  USING (public.has_system_role(auth.uid(), 'ww_admin'))
  WITH CHECK (public.has_system_role(auth.uid(), 'ww_admin'));
