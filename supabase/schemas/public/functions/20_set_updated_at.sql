-- Utility function to auto-update the `updated_at` column
-- UPDATED: 2025-11-27 - Offline-first friendly logic
-- Only sets updated_at to now() if the client hasn't provided a new value.
-- This preserves the actual modification time for offline actions synced later.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- If the client didn't change updated_at (it matches OLD), or set it to NULL
  -- then we assume this is a direct server-side update (or client forgot) and set it to NOW().
  -- If NEW.updated_at is different from OLD.updated_at, we assume the client 
  -- explicitly set the time (e.g. when the offline edit happened), so we keep it.
  if new.updated_at is null or new.updated_at = old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
