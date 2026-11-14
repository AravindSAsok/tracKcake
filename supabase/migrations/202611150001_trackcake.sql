-- trackcake: user-scoped food diary and calorie goal.
-- Run this migration after enabling Anonymous Sign-ins in Supabase Auth.

create extension if not exists pgcrypto;

create table if not exists public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 90),
  amount text not null check (char_length(amount) between 1 and 90),
  calories integer not null check (calories between 0 and 10000),
  protein_g numeric(7, 1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(7, 1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(7, 1) not null default 0 check (fat_g >= 0),
  meal_type text not null default 'snack'
    check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  eaten_at timestamptz not null default now(),
  source text not null default 'manual'
    check (source in ('ai', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists food_entries_user_eaten_at_idx
  on public.food_entries (user_id, eaten_at desc);

alter table public.food_entries enable row level security;

drop policy if exists "Users can read their own food entries" on public.food_entries;
create policy "Users can read their own food entries"
  on public.food_entries for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can add their own food entries" on public.food_entries;
create policy "Users can add their own food entries"
  on public.food_entries for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own food entries" on public.food_entries;
create policy "Users can update their own food entries"
  on public.food_entries for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own food entries" on public.food_entries;
create policy "Users can delete their own food entries"
  on public.food_entries for delete
  to authenticated
  using (auth.uid() = user_id);

create table if not exists public.tracker_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  calorie_goal integer not null default 2000
    check (calorie_goal between 500 and 10000),
  updated_at timestamptz not null default now()
);

alter table public.tracker_settings enable row level security;

drop policy if exists "Users can read their own tracker settings" on public.tracker_settings;
create policy "Users can read their own tracker settings"
  on public.tracker_settings for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own tracker settings" on public.tracker_settings;
create policy "Users can insert their own tracker settings"
  on public.tracker_settings for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own tracker settings" on public.tracker_settings;
create policy "Users can update their own tracker settings"
  on public.tracker_settings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.food_entries to authenticated;
grant select, insert, update on public.tracker_settings to authenticated;
