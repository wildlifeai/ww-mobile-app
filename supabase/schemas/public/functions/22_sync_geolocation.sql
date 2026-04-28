-- Derive location from latitude and longitude
create or replace function public.sync_geolocation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.location := public.ST_SetSRID(public.ST_MakePoint(new.longitude, new.latitude), 4326)::public.geography;
  else
    new.location := null;
  end if;
  return new;
end;
$$;