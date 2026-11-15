-- TrackCake V2: keep modification timestamps trustworthy without changing ownership.
create or replace function public.trackcake_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.trackcake_set_updated_at() from public, anon, authenticated;

drop trigger if exists food_entries_set_updated_at on public.food_entries;
create trigger food_entries_set_updated_at
before update on public.food_entries
for each row execute function public.trackcake_set_updated_at();

drop trigger if exists tracker_settings_set_updated_at on public.tracker_settings;
create trigger tracker_settings_set_updated_at
before update on public.tracker_settings
for each row execute function public.trackcake_set_updated_at();

create index if not exists food_entries_user_created_at_idx
  on public.food_entries (user_id, created_at desc);
