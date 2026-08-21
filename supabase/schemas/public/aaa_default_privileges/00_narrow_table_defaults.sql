-- Narrow the blanket table defaults for app roles BEFORE any table is
-- created (this directory sorts first). Without this the shadow database
-- used by `db diff` is born with Supabase's GRANT ALL defaults - including
-- TRUNCATE, which RLS does not gate - and migra echoes grant-backs against
-- the narrowed live DB on every run. Deployed environments get the same
-- narrowing from migration 20260726074500_revoke_default_table_grants.

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM "anon", "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  REVOKE ALL ON TABLES FROM "anon";

ALTER DEFAULT PRIVILEGES IN SCHEMA "public"
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM "anon", "authenticated";
ALTER DEFAULT PRIVILEGES IN SCHEMA "public"
  REVOKE ALL ON TABLES FROM "anon";
