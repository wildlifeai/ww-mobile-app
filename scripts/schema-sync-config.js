/**
 * What `sync-db-schema.js` copies from ww-backend, and what it never deletes.
 * Shared with `check-schema-mirror.js`, which compares instead of copying, so
 * the two cannot disagree about which folders make up the mirror.
 *
 * SCHEMA_MAP mirrors the backend's own directory names. The aaa_/xxx_/yyy_/zzz_
 * prefixes encode apply order there, so copying them verbatim keeps a local
 * `supabase db reset` correct. These names are a cross-repo contract: when the
 * backend renamed `policies` to `yyy_policies` this list was not updated, and
 * because a missing source directory was only a warning, RLS quietly stopped
 * syncing. The app sat on 21 stale policy files while the backend had 38.
 */
const SCHEMA_MAP = [
    'schemas/public/tables',
    'schemas/public/functions',
    'schemas/public/triggers',
    'schemas/public/views',
    'schemas/public/xxx_rls',        // ENABLE ROW LEVEL SECURITY: policies do nothing without it
    'schemas/public/yyy_policies',   // was 'schemas/public/policies'
    'schemas/public/zzz_indexes',
    'schemas/public/aaa_default_privileges',
];

// Mobile-only files that must never be deleted even though the backend lacks them.
const PRESERVE_FILES = [
    '01_watermelon_sync.sql',
    '99_push_changes.sql',
    '01_auth_user_trigger.sql',
];

module.exports = { SCHEMA_MAP, PRESERVE_FILES };
