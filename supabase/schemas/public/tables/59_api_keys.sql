-- Organisation API keys for ww-website's public API (/api/v1, wildlifeai/ww-website#307), #289.
-- Read and written only by the website backend's service role, which validates a presented
-- key by its hash and manages keys after checking the caller is an organisation_manager of
-- the organisation (ww-website backend/app/services/api_key.py). No client role may read it.
CREATE TABLE api_keys (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  organisation_id uuid NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  -- Nullable, so deleting the creator's account does not fail on the keys they made.
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  name text NOT NULL,
  -- SHA-256 hex of the raw key. A key carries 128 random bits, so a slow hash adds nothing.
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  scopes text [] NOT NULL DEFAULT '{}',
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT (now())
);

-- The website lists an organisation's keys. Lookups by key_hash use its UNIQUE index.
CREATE INDEX idx_api_keys_organisation_id ON api_keys (organisation_id);

COMMENT ON TABLE api_keys IS 'Organisation API keys for the ww-website public API. Read and written only by the website backend service role; never granted to anon or authenticated.';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hex of the raw key (ww_live_ plus 32 random hex characters). The raw key is shown once, at creation, and never stored.';
COMMENT ON COLUMN api_keys.key_prefix IS 'The start of the raw key (ww_live_ plus 8 characters), shown in key lists.';
COMMENT ON COLUMN api_keys.scopes IS 'Permission scopes the key carries, validated by the website (VALID_SCOPES in api_key.py).';
COMMENT ON COLUMN api_keys.revoked_at IS 'Set when the key is revoked; a revoked key never validates again.';

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Service-role only, like inat_tokens: RLS on with no policies denies every other role,
-- and 98_authenticated_write_grants.sql revokes what Supabase's defaults grant.
GRANT ALL PRIVILEGES ON TABLE api_keys TO service_role;
