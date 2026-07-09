-- Per-user advisory usage quotas across photos, storage, and AI compute. NULL
-- columns mean "no limit". Enforcement is advisory: usage is never blocked —
-- over-quota users are surfaced to admins (admin_user_usage) and warned in-app
-- (my_upload_usage). Admins set the caps; users may read their own.
CREATE TABLE upload_quotas (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),

  max_photos int CHECK (max_photos IS NULL OR max_photos >= 0),
  max_storage_bytes bigint CHECK (max_storage_bytes IS NULL OR max_storage_bytes >= 0),
  max_compute_seconds bigint CHECK (max_compute_seconds IS NULL OR max_compute_seconds >= 0)
);

COMMENT ON TABLE upload_quotas IS 'Per-user advisory usage limits (photos, storage, AI compute). NULL = unlimited. Soft-warn only — never blocks usage.';
COMMENT ON COLUMN upload_quotas.max_photos IS 'Soft cap on photos uploaded by this user (NULL = unlimited).';
COMMENT ON COLUMN upload_quotas.max_storage_bytes IS 'Soft cap on rendition storage for this user, in bytes (NULL = unlimited).';
COMMENT ON COLUMN upload_quotas.max_compute_seconds IS 'Soft cap on AI inference compute time (sum of annotation_runs durations), in seconds (NULL = unlimited).';

ALTER TABLE upload_quotas ENABLE ROW LEVEL SECURITY;

-- Users may read their own quota; writes are admin-only (see yyy_policies).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.upload_quotas TO authenticated;

GRANT ALL ON public.upload_quotas TO service_role;
