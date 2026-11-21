-- Preserve effective-dated calorie targets so historical goal streaks remain accurate.
alter table public.tracker_settings
  add column if not exists goal_history jsonb not null default '[]'::jsonb;

update public.tracker_settings
set goal_history = jsonb_build_array(
  jsonb_build_object('goal', calorie_goal, 'effective_from', coalesce(updated_at, now()))
)
where goal_history = '[]'::jsonb;

alter table public.tracker_settings
  drop constraint if exists tracker_settings_goal_history_is_array;
alter table public.tracker_settings
  add constraint tracker_settings_goal_history_is_array
  check (jsonb_typeof(goal_history) = 'array');

grant select, insert, update on public.tracker_settings to authenticated;
