CREATE TABLE inat_tokens (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),

  -- One linked iNaturalist account per WW user. UNIQUE supports the backend's
  -- upsert (on_conflict = user_id) and gives a 1:1 user -> token mapping.
  user_id uuid NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,

  -- Fernet-encrypted iNat OAuth token bundle (access_token, refresh_token,
  -- expiry). SENSITIVE — decrypted only by the backend with the app secret.
  encrypted_token text NOT NULL,
  inat_username text   -- cached iNat login for display
);

COMMENT ON TABLE inat_tokens IS 'Encrypted per-user iNaturalist OAuth tokens (Fernet-encrypted JSON). Read and written ONLY by the backend service role; never exposed to the authenticated client. Connection status is surfaced via the backend API (/api/inat/status).';
COMMENT ON COLUMN inat_tokens.user_id IS 'WW user who linked this iNaturalist account (one per user; UNIQUE supports upsert on_conflict = user_id).';
COMMENT ON COLUMN inat_tokens.encrypted_token IS 'Fernet-encrypted iNat OAuth token bundle (access/refresh/expiry). Sensitive — intentionally never granted to the authenticated role.';

ALTER TABLE inat_tokens ENABLE ROW LEVEL SECURITY;

-- Service-role only: encrypted OAuth secrets must never be readable by the
-- authenticated client, so no GRANT is issued to `authenticated`. RLS is enabled
-- as defense-in-depth (no policies => deny-all for any non-service role).
GRANT ALL PRIVILEGES ON TABLE inat_tokens TO service_role;
