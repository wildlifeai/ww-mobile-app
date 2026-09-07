-- Narrow the blanket FUNCTION defaults for the anon role BEFORE any function is
-- created (this directory sorts first), for the same reason as
-- 00_narrow_table_defaults.sql: without it the shadow database used by
-- `db diff` is born with anon holding EXECUTE, and migra echoes grant-backs
-- against the narrowed live DB on every run.
--
-- Why anon must not hold EXECUTE by default: PostgreSQL grants EXECUTE on every
-- new function to PUBLIC, and Supabase's anon role inherits it. Combined with
-- SECURITY DEFINER — which most of this repo's RPCs use, deliberately, to
-- bypass RLS — that made functions like pull_changes callable by anyone holding
-- the public anon key, returning the whole database. See issue #166 and
-- migration 20260904_revoke_anon_execute_on_definer_functions.
--
-- The declared anon surface is tables only (yyy_policies/99_anon_access_grants.sql:
-- firmware, ai_models and lookups, for OTA and manifest generation). No function
-- is intended to be anon-callable. If one ever is, grant it explicitly there —
-- never rely on the default.

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  REVOKE EXECUTE ON FUNCTIONS FROM "anon";

ALTER DEFAULT PRIVILEGES IN SCHEMA "public"
  REVOKE EXECUTE ON FUNCTIONS FROM "anon";
