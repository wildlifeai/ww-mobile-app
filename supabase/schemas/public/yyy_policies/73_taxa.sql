-- *** taxa RLS Policies ***
-- Read-only for authenticated users.

CREATE POLICY "Authenticated users can view taxa"
  ON taxa
  FOR SELECT
  TO authenticated
  USING (true);
