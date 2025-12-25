-- Derive location from latitude and longitude
create or replace function public.sync_geolocation()
returns trigger
language plpgsql
security invoker
set search_path = extensions, public, pg_temp
as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.location := ST_SetSRID(ST_MakePoint(new.longitude, new.latitude), 4326)::geography;
  else
    new.location := null;
  end if;
  return new;
end;
$$;